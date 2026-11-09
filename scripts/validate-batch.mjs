#!/usr/bin/env node
// scripts/validate-batch.mjs
// Batch validation of discovered candidates using DataForSEO APIs
// Usage: node scripts/validate-batch.mjs [--niche="gutter installation"] [--dry-run]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { parseCandidatesCsv, serializeCandidatesCsv } from '../lib/candidates.js'
import { estimateValidationCost } from '../lib/cost-estimator.js'
import { createClient } from '../lib/dataforseo-client.js'
import { DIRECTORY_DOMAINS } from '../lib/constants.js'
import {
  scoreSearchVolume, scoreCPC, scoreMapPackWeakness, scoreOrganicWeakness,
  scoreRenterAvailability, scoreLicenseBarrier, scoreSeasonality,
  estimateRent, scoreRentPotential, totalScore,
} from '../lib/scoring.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const nicheArg = args.find(a => a.startsWith('--niche='))
const nicheFilter = nicheArg
  ? nicheArg.split('=')[1].replace(/^["']|["']$/g, '').toLowerCase()
  : null

const TODAY = new Date().toISOString().slice(0, 10)
const SERP_BATCH_SIZE = 100  // DataForSEO allows up to 100 tasks per request
const RATE_LIMIT_MS = 1200   // ~50 req/min to stay safe

async function main() {
  // Load candidates
  const csvPath = 'data/candidates.csv'
  const allRows = parseCandidatesCsv(readFileSync(csvPath, 'utf8'))
  let discovered = allRows.filter(c => c.status === 'discovered')
  if (nicheFilter) {
    discovered = discovered.filter(c => c.niche.toLowerCase() === nicheFilter)
  }

  if (discovered.length === 0) {
    console.log('No discovered candidates to validate.')
    return
  }

  console.log(`Candidates to validate: ${discovered.length}`)

  // Cost estimate
  const cost = estimateValidationCost(discovered)
  console.log(`\nEstimated cost: $${cost.total.toFixed(3)}`)
  console.log(`  Keyword volume: $${cost.breakdown.keywordVolume.toFixed(3)} (${Math.ceil(discovered.length * 8 / 1000)} batches)`)
  console.log(`  Organic SERP:   $${cost.breakdown.organicSerp.toFixed(3)} (${discovered.length * 2} calls)`)
  console.log(`  Maps SERP:      $${cost.breakdown.mapsSerp.toFixed(3)} (${discovered.length} calls)`)
  console.log(`  Trends:         $${cost.breakdown.trends.toFixed(3)}`)

  if (dryRun) {
    console.log('\n── Dry run — stopping here ──')
    return
  }

  // Init client
  const envContent = readFileSync(`${process.env.HOME}/.config/rank-rent/.env`, 'utf8')
  const { apiPost, sleep } = createClient.fromEnvContent(envContent)

  // ═══════════════════════════════════════════════════
  // STEP 1: Google Trends (1 call per unique niche)
  // ═══════════════════════════════════════════════════
  const uniqueNiches = [...new Set(discovered.map(c => c.niche))]
  const seasonalityMap = new Map()  // niche → monthlyValues[]

  console.log('\n── Fetching Google Trends ──')
  for (const niche of uniqueNiches) {
    console.log(`  Trends: "${niche}"`)
    try {
      const resp = await apiPost('/v3/keywords_data/google_trends/explore/live', [{
        keywords: [niche],
        location_name: 'United States',
        language_name: 'English',
        time_range: 'past_12_months',
      }])
      const items = resp.tasks?.[0]?.result?.[0]?.items
      if (items && items.length > 0) {
        const monthlyValues = items[0].data?.map(d => d.values?.[0] ?? 0) ?? []
        seasonalityMap.set(niche, monthlyValues)
        console.log(`    → ${monthlyValues.length} months, range: ${Math.min(...monthlyValues)}-${Math.max(...monthlyValues)}`)
      } else {
        seasonalityMap.set(niche, [])
        console.log('    → No data')
      }
    } catch (err) {
      console.warn(`    ⚠ Trends error: ${err.message}`)
      seasonalityMap.set(niche, [])
    }
    await sleep(RATE_LIMIT_MS)
  }

  // ═══════════════════════════════════════════════════
  // STEP 2: Keyword volumes (batched, location-specific)
  // ═══════════════════════════════════════════════════
  console.log('\n── Fetching keyword volumes ──')

  // Group candidates by state for location-specific volume queries
  const byState = new Map()
  for (const c of discovered) {
    const state = c.region.split(' (')[0]
    if (!byState.has(state)) byState.set(state, [])
    byState.get(state).push(c)
  }

  // Volume results: slug → { phrases: [{keyword, volume, cpc}] }
  const volumeResults = new Map()

  for (const [state, candidates] of byState) {
    const allPhrases = []
    for (const c of candidates) {
      const phrases = c.phrases ? c.phrases.split('|') : []
      // Filter out "near me" phrases — not location-specific
      const locPhrases = phrases.filter(p => !p.includes('near me'))
      for (const p of locPhrases) {
        allPhrases.push({ keyword: p, slug: c.slug })
      }
    }

    // Batch into groups of 700
    const batches = []
    for (let i = 0; i < allPhrases.length; i += 700) {
      batches.push(allPhrases.slice(i, i + 700))
    }

    console.log(`  ${state}: ${allPhrases.length} keywords in ${batches.length} batch(es)`)

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b]
      const keywords = [...new Set(batch.map(k => k.keyword))]
      try {
        const resp = await apiPost('/v3/keywords_data/google_ads/search_volume/live', [{
          keywords,
          location_name: `${state},United States`,
          language_code: 'en',
          search_partners: false,
        }])
        const resultMap = new Map()
        if (resp.tasks?.[0]?.result) {
          for (const r of resp.tasks[0].result) {
            resultMap.set(r.keyword, { search_volume: r.search_volume || 0, cpc: r.cpc || 0 })
          }
        }
        // Map back to slugs
        for (const item of batch) {
          if (!volumeResults.has(item.slug)) volumeResults.set(item.slug, [])
          const vol = resultMap.get(item.keyword) || { search_volume: 0, cpc: 0 }
          volumeResults.get(item.slug).push({ keyword: item.keyword, ...vol })
        }
      } catch (err) {
        console.warn(`    ⚠ Volume error (${state} batch ${b + 1}): ${err.message}`)
      }
      await sleep(5100)
    }
  }

  // ═══════════════════════════════════════════════════
  // STEP 3: Organic SERP (batched, 100 tasks per call)
  // ═══════════════════════════════════════════════════
  console.log('\n── Fetching organic SERP ──')

  // Build tasks: primary phrase uses live/regular, secondary uses live/advanced
  // For efficiency, batch into live/regular calls (primary) and live/advanced calls (secondary)
  const organicTasks = []  // { slug, keyword, endpoint, state }
  for (const c of discovered) {
    const state = c.region.split(' (')[0]
    const volData = volumeResults.get(c.slug) || []
    // Sort phrases by volume, take top 2
    const sorted = volData.sort((a, b) => b.search_volume - a.search_volume)
    const topPhrases = sorted.slice(0, 2)
    if (topPhrases.length > 0) {
      organicTasks.push({ slug: c.slug, keyword: topPhrases[0].keyword, endpoint: 'regular', state })
    }
    if (topPhrases.length > 1) {
      organicTasks.push({ slug: c.slug, keyword: topPhrases[1].keyword, endpoint: 'advanced', state })
    }
  }

  // Split by endpoint type
  const regularTasks = organicTasks.filter(t => t.endpoint === 'regular')
  const advancedTasks = organicTasks.filter(t => t.endpoint === 'advanced')

  const organicResults = new Map()  // slug → { topDomains[], serpItems[] }

  async function fetchOrganicBatch(tasks, endpointType) {
    const batches = []
    for (let i = 0; i < tasks.length; i += SERP_BATCH_SIZE) {
      batches.push(tasks.slice(i, i + SERP_BATCH_SIZE))
    }

    console.log(`  ${endpointType}: ${tasks.length} tasks in ${batches.length} batch(es)`)

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b]
      const taskData = batch.map(t => ({
        keyword: t.keyword,
        location_name: `${t.state},United States`,
        language_name: 'English',
        depth: 10,
        tag: t.slug,
      }))

      try {
        const resp = await apiPost(`/v3/serp/google/organic/live/${endpointType}`, taskData)
        if (resp.tasks) {
          for (const task of resp.tasks) {
            const slug = task.data?.tag
            if (!slug) continue
            if (!organicResults.has(slug)) organicResults.set(slug, { topDomains: [], serpItems: [] })
            const entry = organicResults.get(slug)

            const items = task.result?.[0]?.items || []
            for (const item of items) {
              if (item.type === 'organic') {
                const domain = (item.domain || '').replace(/^www\./, '')
                if (domain && !entry.topDomains.includes(domain)) {
                  entry.topDomains.push(domain)
                }
                entry.serpItems.push({
                  position: item.rank_group,
                  domain,
                  title: item.title,
                  url: item.url,
                  breadcrumb: item.breadcrumb,
                })
              }
            }
          }
        }
      } catch (err) {
        console.warn(`    ⚠ Organic ${endpointType} batch ${b + 1} error: ${err.message}`)
      }
      console.log(`    Batch ${b + 1}/${batches.length} done`)
      if (b < batches.length - 1) await sleep(RATE_LIMIT_MS)
    }
  }

  await fetchOrganicBatch(regularTasks, 'regular')
  await fetchOrganicBatch(advancedTasks, 'advanced')

  // ═══════════════════════════════════════════════════
  // STEP 4: Maps SERP (batched)
  // ═══════════════════════════════════════════════════
  console.log('\n── Fetching Maps SERP ──')

  const mapsTasks = discovered.map(c => ({
    slug: c.slug,
    keyword: c.primary_phrase,
    state: c.region.split(' (')[0],
  }))

  const mapsResults = new Map()  // slug → { topThree[], totalCount }

  const mapsBatches = []
  for (let i = 0; i < mapsTasks.length; i += SERP_BATCH_SIZE) {
    mapsBatches.push(mapsTasks.slice(i, i + SERP_BATCH_SIZE))
  }

  console.log(`  ${mapsTasks.length} tasks in ${mapsBatches.length} batch(es)`)

  for (let b = 0; b < mapsBatches.length; b++) {
    const batch = mapsBatches[b]
    const taskData = batch.map(t => ({
      keyword: t.keyword,
      location_name: `${t.state},United States`,
      language_name: 'English',
      depth: 20,
      tag: t.slug,
    }))

    try {
      const resp = await apiPost('/v3/serp/google/maps/live/advanced', taskData)
      if (resp.tasks) {
        for (const task of resp.tasks) {
          const slug = task.data?.tag
          if (!slug) continue
          const items = task.result?.[0]?.items || []
          const mapsItems = items.filter(i => i.type === 'maps_search')
          const topThree = mapsItems.slice(0, 3).map(i => ({
            name: i.title || '',
            reviews: i.reviews_count || 0,
            rating: i.rating?.value || 0,
          }))
          mapsResults.set(slug, {
            topThree,
            totalCount: mapsItems.length,
          })
        }
      }
    } catch (err) {
      console.warn(`    ⚠ Maps batch ${b + 1} error: ${err.message}`)
    }
    console.log(`    Batch ${b + 1}/${mapsBatches.length} done`)
    if (b < mapsBatches.length - 1) await sleep(RATE_LIMIT_MS)
  }

  // ═══════════════════════════════════════════════════
  // STEP 5: Score all candidates
  // ═══════════════════════════════════════════════════
  console.log('\n── Scoring candidates ──')

  const slugToRow = new Map(allRows.map(r => [r.slug, r]))
  let passCount = 0, marginalCount = 0, walkCount = 0

  for (const c of discovered) {
    const row = slugToRow.get(c.slug)
    if (!row) continue

    // Volume data
    const volData = volumeResults.get(c.slug) || []
    const totalVol = volData.reduce((sum, v) => sum + v.search_volume, 0)
    const primaryVol = volData.find(v => v.keyword === c.primary_phrase)?.search_volume || 0
    const maxCpc = Math.max(...volData.map(v => v.cpc), 0)

    // Organic data
    const organic = organicResults.get(c.slug) || { topDomains: [], serpItems: [] }
    const topFive = organic.topDomains.slice(0, 5)

    // Maps data
    const maps = mapsResults.get(c.slug) || { topThree: [], totalCount: 0 }

    // Seasonality
    const monthlyValues = seasonalityMap.get(c.niche) || []

    // Score
    const volScore = scoreSearchVolume(primaryVol)
    const cpcScore = scoreCPC(maxCpc)
    const mapScore = scoreMapPackWeakness(maps.topThree)
    const organicScore = scoreOrganicWeakness(topFive, DIRECTORY_DOMAINS)
    const rentersScore = scoreRenterAvailability(maps.totalCount)
    const licenseScore = scoreLicenseBarrier(row.license_barrier || 'none')
    const seasonScore = scoreSeasonality(monthlyValues)
    const rent = estimateRent(primaryVol, maxCpc)
    const rentScore = scoreRentPotential(rent)

    const signals = {
      volume: volScore,
      cpc: cpcScore,
      mapPack: mapScore,
      organic: organicScore,
      renters: rentersScore,
      license: licenseScore,
      seasonality: seasonScore,
      rent: rentScore,
    }
    const { total, status } = totalScore(signals)

    // Update row
    row.vol_total = totalVol
    row.vol_primary = primaryVol
    row.cpc = maxCpc
    row.map_pack_weak = maps.topThree.length < 3 ? 'yes' : maps.topThree.filter(b => b.reviews < 50 || b.rating < 4.0).length >= 1 ? 'partial' : 'no'
    row.organic_weak = topFive.filter(d => DIRECTORY_DOMAINS.some(dir => d === dir || d.endsWith(`.${dir}`))).length >= 2 ? 'yes' : 'no'
    row.renter_count = maps.totalCount
    row.seasonality = monthlyValues.length > 0 ? monthlyValues.join('|') : ''
    row.rent_estimate = Math.round(rent)
    row.score_vol = volScore
    row.score_cpc = cpcScore
    row.score_map = mapScore
    row.score_organic = organicScore
    row.score_renters = rentersScore
    row.score_license = licenseScore
    row.score_season = seasonScore
    row.score_rent = rentScore
    row.score_total = total
    row.status = total >= 8 ? 'validated' : 'walk_away'
    row.validated_date = TODAY

    if (total >= 11) passCount++
    else if (total >= 8) marginalCount++
    else walkCount++

    // Save validation data
    const researchDir = `research/${c.slug}`
    if (!existsSync(researchDir)) mkdirSync(researchDir, { recursive: true })
    writeFileSync(`${researchDir}/validation-data.json`, JSON.stringify({
      slug: c.slug,
      validated: TODAY,
      volume: volData,
      organic: organic.serpItems,
      topDomains: organic.topDomains,
      maps: maps,
      seasonality: monthlyValues,
      scores: signals,
      totalScore: total,
      status: row.status,
    }, null, 2))
  }

  // Write updated CSV
  writeFileSync(csvPath, serializeCandidatesCsv(allRows))
  console.log(`\nUpdated ${csvPath}`)

  // ═══════════════════════════════════════════════════
  // STEP 6: Summary
  // ═══════════════════════════════════════════════════
  const validated = allRows.filter(r => discovered.some(d => d.slug === r.slug))
    .sort((a, b) => (Number(b.score_total) || 0) - (Number(a.score_total) || 0))

  console.log('\n═══════════════════════════════════════════════════════════════════════════════════════════')
  console.log(`  VALIDATION SUMMARY  —  ${discovered.length} candidates  |  Pass: ${passCount}  |  Marginal: ${marginalCount}  |  Walk away: ${walkCount}`)
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════')
  console.log(`${'Slug'.padEnd(45)} ${'Score'.padStart(5)} ${'Status'.padEnd(12)} ${'Vol'.padStart(6)} ${'CPC'.padStart(7)} ${'Rent'.padStart(6)}`)
  console.log('─'.repeat(90))
  for (const c of validated) {
    const marker = Number(c.score_total) >= 11 ? '★' : Number(c.score_total) >= 8 ? '◆' : ' '
    console.log(`${marker} ${c.slug.padEnd(44)} ${String(c.score_total).padStart(5)} ${c.status.padEnd(12)} ${String(c.vol_primary).padStart(6)} ${String(c.cpc).padStart(7)} $${String(c.rent_estimate).padStart(5)}`)
  }
  console.log(`\nPass (11+): ${passCount}  |  Marginal (8-10): ${marginalCount}  |  Walk away (<8): ${walkCount}`)
}

main().catch(err => { console.error(err); process.exit(1) })
