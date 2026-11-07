#!/usr/bin/env node
// scripts/validate-candidates.mjs
// Validates all discovered candidates using DataForSEO API
// Orchestration script — business logic lives in lib/scoring.js (tested)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { parseCandidatesCsv, serializeCandidatesCsv } from '../lib/candidates.js'
import { estimateValidationCost } from '../lib/cost-estimator.js'
import { extractOrganicDomains, extractOrganicResults, extractMapsResults } from '../lib/serp-parsing.js'
import { aggregateWeeklyToMonthly } from '../lib/trends.js'
import { createClient, locationName } from '../lib/dataforseo-client.js'
import { scoreCandidateFromRaw } from '../lib/score-candidate.js'

// --- CLI args ---
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const filterSlugs = args.find(a => a.startsWith('--filter='))?.split('=')[1]?.split(',') || null
const statusFilter = args.find(a => a.startsWith('--status='))?.split('=')[1] || 'discovered'

// --- DataForSEO client ---
const envContent = readFileSync(`${process.env.HOME}/.config/rank-rent/.env`, 'utf8')
const { apiPost, sleep } = createClient.fromEnvContent(envContent)

// --- Main ---
async function main() {
  const csv = readFileSync('data/candidates.csv', 'utf8')
  const allCandidates = parseCandidatesCsv(csv)
  let discovered = allCandidates.filter((c) => c.status === statusFilter)
  if (filterSlugs) {
    discovered = discovered.filter((c) => filterSlugs.includes(c.slug))
  }

  console.log(`Found ${discovered.length} discovered candidates`)
  if (discovered.length === 0) { console.log('Nothing to validate.'); return }

  // Cost gate
  const cost = estimateValidationCost(discovered)
  console.log(`\nEstimated cost: $${cost.total.toFixed(3)}`)
  console.log(`  Keyword volume:  $${cost.breakdown.keywordVolume.toFixed(3)}`)
  console.log(`  Organic SERP:    $${cost.breakdown.organicSerp.toFixed(3)}`)
  console.log(`  Maps SERP:       $${cost.breakdown.mapsSerp.toFixed(3)}`)
  console.log(`  Trends:          $${cost.breakdown.trends.toFixed(3)}`)
  if (cost.total > 1) {
    console.error('\nCost exceeds $1 — aborting. Get user approval first.')
    process.exit(1)
  }

  if (dryRun) {
    console.log('\n── Dry Run — Candidates ──')
    for (const c of discovered) {
      console.log(`  ${c.slug} — ${c.niche} in ${c.area}`)
    }
    return
  }

  // Per-candidate raw data store
  const raw = Object.fromEntries(discovered.map((c) => [c.slug, { volumes: {}, organic: [], maps: null, trends: null }]))

  // ────────────────────────────────────────────
  // Step 1: Keyword volumes — group by location
  // ────────────────────────────────────────────
  console.log('\n── Step 1: Keyword Volumes ──')
  const locGroups = new Map()
  for (const c of discovered) {
    const loc = locationName(c.area)
    if (!locGroups.has(loc)) locGroups.set(loc, [])
    for (const p of (c.phrases || '').split('|').filter(Boolean)) {
      locGroups.get(loc).push({ phrase: p, slug: c.slug })
    }
  }

  for (const [loc, items] of locGroups) {
    const keywords = [...new Set(items.map((i) => i.phrase))]
    console.log(`  ${loc}: ${keywords.length} keywords`)
    const resp = await apiPost('/v3/keywords_data/google_ads/search_volume/live', [{
      keywords,
      location_name: loc,
      language_name: 'English',
    }])
    const locVolMap = new Map()
    if (resp.tasks?.[0]?.result) {
      for (const r of resp.tasks[0].result) {
        locVolMap.set(r.keyword, {
          search_volume: r.search_volume || 0,
          cpc: r.cpc || 0,
          competition_index: r.competition_index ?? null,
          monthly_searches: r.monthly_searches || null,
        })
      }
    } else {
      console.warn(`  ⚠ No results for ${loc}:`, resp.tasks?.[0]?.status_message)
    }
    // Store per-candidate (not global) to avoid shared-phrase overwrites
    for (const item of items) {
      const v = locVolMap.get(item.phrase)
      if (v) raw[item.slug].volumes[item.phrase] = v
    }
    await sleep(5100) // rate limit: 12 req/min
  }

  // Compute per-candidate volume aggregates from per-candidate raw data
  for (const c of discovered) {
    const phrases = (c.phrases || '').split('|').filter(Boolean)
    let totalVol = 0, maxCpc = 0
    for (const p of phrases) {
      const v = raw[c.slug].volumes[p]
      if (v) { totalVol += v.search_volume; if (v.cpc > maxCpc) maxCpc = v.cpc }
    }
    const primaryV = raw[c.slug].volumes[c.primary_phrase]
    c._volTotal = totalVol
    c._volPrimary = primaryV?.search_volume || 0
    c._cpc = maxCpc
    c._topPhrases = phrases
      .map((p) => ({ phrase: p, vol: raw[c.slug].volumes[p]?.search_volume || 0 }))
      .sort((a, b) => b.vol - a.vol)
  }

  // ────────────────────────────────────────────
  // Step 2: Organic SERP — top 2 phrases/candidate
  // ────────────────────────────────────────────
  console.log('\n── Step 2: Organic SERP ──')
  const orgTasks = []
  for (const c of discovered) {
    const topTwo = c._topPhrases.slice(0, 2)
    for (let j = 0; j < topTwo.length; j++) {
      orgTasks.push({
        keyword: topTwo[j].phrase,
        location_name: locationName(c.area),
        language_name: 'English',
        depth: 10,
        _slug: c.slug,
        // Primary phrase uses live/regular to capture paid items (for viability cache)
        _isPrimary: topTwo[j].phrase === c.primary_phrase,
      })
    }
  }

  // Live SERP endpoints: 1 task per request
  for (let i = 0; i < orgTasks.length; i++) {
    const { _slug: slug, _isPrimary: isPrimary, ...taskPayload } = orgTasks[i]
    const endpoint = isPrimary
      ? '/v3/serp/google/organic/live/regular'    // captures paid items too
      : '/v3/serp/google/organic/live/advanced'
    process.stdout.write(`  [${i + 1}/${orgTasks.length}] ${slug} [${orgTasks[i].keyword}]${isPrimary ? ' (regular)' : ''}: `)
    const resp = await apiPost(endpoint, [taskPayload])
    const task = resp.tasks?.[0]
    const items = task?.result?.[0]?.items || []
    const domains = extractOrganicDomains(items, 5)
    const organicResults = extractOrganicResults(items, 10)
    const itemTypes = [...new Set(items.map((it) => it.type))]
    console.log(`${domains.length} domains (${itemTypes.join(',')})`)
    if (!raw[slug].organic_raw) raw[slug].organic_raw = []
    raw[slug].organic_raw.push({ keyword: orgTasks[i].keyword, items_types: itemTypes })
    raw[slug].organic.push({ keyword: orgTasks[i].keyword, topDomains: domains })
    // Save richer organic results for Phase 3+ (teardown URL discovery, content strategy)
    if (!raw[slug].organic_results) raw[slug].organic_results = []
    raw[slug].organic_results.push({ keyword: orgTasks[i].keyword, results: organicResults })
    // For primary phrase: save all items for viability SERP cache
    if (isPrimary) {
      raw[slug].serp_items = items
      raw[slug].cached_at = new Date().toISOString().split('T')[0]
    }
    if (i < orgTasks.length - 1) await sleep(100)
  }

  // ────────────────────────────────────────────
  // Step 3: Maps SERP — primary phrase/candidate
  // ────────────────────────────────────────────
  console.log('\n── Step 3: Maps SERP ──')
  const mapTasks = discovered.map((c) => ({
    keyword: c.primary_phrase, location_name: locationName(c.area), language_name: 'English', depth: 20, _slug: c.slug,
  }))

  // Live SERP endpoints: 1 task per request
  for (let i = 0; i < mapTasks.length; i++) {
    const { _slug: slug, ...taskPayload } = mapTasks[i]
    process.stdout.write(`  [${i + 1}/${mapTasks.length}] ${slug}: `)
    const resp = await apiPost('/v3/serp/google/maps/live/advanced', [taskPayload])
    const task = resp.tasks?.[0]
    const items = task?.result?.[0]?.items || []
    const itemsCount = task?.result?.[0]?.items_count || 0
    const { topThree, totalCount } = extractMapsResults(items, itemsCount)
    const itemTypes = [...new Set(items.map((it) => it.type))]
    console.log(`${topThree.length} top3, ${totalCount} total (${itemTypes.join(',')})`)
    raw[slug].maps_raw = { keyword: mapTasks[i].keyword, items_types: itemTypes }
    raw[slug].maps = { keyword: mapTasks[i].keyword, topThree, totalCount }
    if (i < mapTasks.length - 1) await sleep(100)
  }

  // ────────────────────────────────────────────
  // Step 4: Trends — one per unique niche
  // ────────────────────────────────────────────
  console.log('\n── Step 4: Google Trends ──')
  const uniqueNiches = [...new Set(discovered.map((c) => c.niche))]
  const trendsByNiche = new Map()

  for (const niche of uniqueNiches) {
    console.log(`  ${niche}`)
    const resp = await apiPost('/v3/keywords_data/google_trends/explore/live', [{
      keywords: [niche],
      location_name: 'United States',
      language_name: 'English',
      time_range: 'past_12_months',
    }])
    let rawValues = []
    let rawDates = []
    const items = resp.tasks?.[0]?.result?.[0]?.items || []
    for (const item of items) {
      if (item.type === 'google_trends_graph' && Array.isArray(item.data)) {
        rawValues = item.data.map((d) => d.values?.[0] ?? d.value ?? 0)
        rawDates = item.data.map((d) => d.date_from?.split(' ')[0] || '').filter(Boolean)
        break
      }
    }
    // Fallback: check top-level data array
    if (rawValues.length === 0) {
      for (const item of items) {
        if (Array.isArray(item.data)) {
          rawValues = item.data.map((d) => {
            if (typeof d === 'number') return d
            return d.values?.[0] ?? d.value ?? 0
          })
          rawDates = item.data.map((d) => d.date_from?.split(' ')[0] || '').filter(Boolean)
          break
        }
      }
    }
    // Aggregate weekly to 12 monthly values
    const monthly = aggregateWeeklyToMonthly(rawValues, rawDates)
    console.log(`    Raw: ${rawValues.length} values → ${monthly.length} monthly`)
    trendsByNiche.set(niche, monthly)
    // Store on each candidate's raw data
    for (const c of discovered.filter((c) => c.niche === niche)) {
      raw[c.slug].trends = monthly
      raw[c.slug].trends_raw = rawValues
      raw[c.slug].trends_dates = rawDates
    }
    await sleep(1000)
  }

  // ────────────────────────────────────────────
  // Step 5: Score all 8 signals
  // ────────────────────────────────────────────
  console.log('\n── Step 5: Scoring ──')
  const today = new Date().toISOString().split('T')[0]

  for (const c of discovered) {
    const scored = scoreCandidateFromRaw(c, raw[c.slug])
    Object.assign(c, scored)
    c.validated_date = today

    // Clean temp fields
    delete c._volTotal; delete c._volPrimary; delete c._cpc; delete c._topPhrases
  }

  // ────────────────────────────────────────────
  // Step 6: Save raw data per candidate
  // ────────────────────────────────────────────
  console.log('\n── Step 6: Saving Raw Data ──')
  for (const c of discovered) {
    const dir = `research/${c.slug}`
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(`${dir}/validation-data.json`, JSON.stringify(raw[c.slug], null, 2))
    console.log(`  ${dir}/validation-data.json`)
  }

  // ────────────────────────────────────────────
  // Step 7: Update CSV
  // ────────────────────────────────────────────
  console.log('\n── Step 7: Updating CSV ──')
  writeFileSync('data/candidates.csv', serializeCandidatesCsv(allCandidates))
  console.log('  data/candidates.csv written')

  // ────────────────────────────────────────────
  // Step 8: Summary
  // ────────────────────────────────────────────
  const validated = discovered.filter((c) => c.status === 'validated')
  const walkAway = discovered.filter((c) => c.status === 'walk_away')

  console.log('\n═══════════════════════════════════════════════════════════════════════════════════════════')
  console.log(`  VALIDATION SUMMARY  —  Validated: ${validated.length}  |  Walk Away: ${walkAway.length}  |  Total: ${discovered.length}`)
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════')
  console.log(`${'Slug'.padEnd(44)} ${'Score'.padStart(5)}  ${'Status'.padEnd(10)} ${'Vol'.padStart(5)} ${'CPC'.padStart(8)} ${'Rent'.padStart(8)}`)
  console.log('─'.repeat(90))

  discovered
    .sort((a, b) => Number(b.score_total) - Number(a.score_total))
    .forEach((c) => {
      const mark = c.status === 'validated' ? '✓' : ' '
      console.log(
        `${mark} ${c.slug.padEnd(42)} ${String(c.score_total).padStart(5)}  ${c.status.padEnd(10)} ${String(c.vol_primary).padStart(5)} ${String(c.cpc).padStart(8)} ${String(c.rent_estimate).padStart(8)}`
      )
    })
}

main().catch((err) => { console.error(err); process.exit(1) })
