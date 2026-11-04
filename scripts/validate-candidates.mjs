#!/usr/bin/env node
// scripts/validate-candidates.mjs
// Validates all discovered candidates using DataForSEO API
// Orchestration script — business logic lives in lib/scoring.js (tested)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { parseCandidatesCsv, serializeCandidatesCsv } from '../lib/candidates.js'
import { estimateValidationCost } from '../lib/cost-estimator.js'
import {
  scoreSearchVolume, scoreCPC, scoreMapPackWeakness, scoreOrganicWeakness,
  scoreRenterAvailability, scoreLicenseBarrier, scoreSeasonality,
  estimateRent, scoreRentPotential, totalScore,
} from '../lib/scoring.js'
import { DIRECTORY_DOMAINS } from '../lib/constants.js'
import { extractOrganicDomains, extractMapsResults } from '../lib/serp-parsing.js'
import { aggregateWeeklyToMonthly } from '../lib/trends.js'

// --- Config ---
const AREA_STATE = {
  'Oklahoma City': 'Oklahoma', Tulsa: 'Oklahoma',
  Tucson: 'Arizona', Albuquerque: 'New Mexico',
  Midland: 'Texas', Houston: 'Texas', Abilene: 'Texas',
  'El Paso': 'Texas', Odessa: 'Texas', 'Big Spring': 'Texas',
}

function locationName(area) {
  const state = AREA_STATE[area]
  if (!state) throw new Error(`Unknown area: ${area}`)
  return `${area},${state},United States`
}

// --- DataForSEO client ---
function loadEnv() {
  const envPath = `${process.env.HOME}/.config/rank-rent/.env`
  const lines = readFileSync(envPath, 'utf8').split('\n')
  const env = {}
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const env = loadEnv()
const login = env.DATAFORSEO_LOGIN || env.DATAFORSEO_USERNAME
const password = env.DATAFORSEO_PASSWORD
const authHeader = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64')

async function apiPost(path, data) {
  const resp = await fetch(`https://api.dataforseo.com${path}`, {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --- Main ---
async function main() {
  const csv = readFileSync('data/candidates.csv', 'utf8')
  const allCandidates = parseCandidatesCsv(csv)
  const discovered = allCandidates.filter((c) => c.status === 'discovered')

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
        locVolMap.set(r.keyword, { search_volume: r.search_volume || 0, cpc: r.cpc || 0 })
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
    for (const { phrase } of c._topPhrases.slice(0, 2)) {
      orgTasks.push({ keyword: phrase, location_name: locationName(c.area), language_name: 'English', depth: 10, _slug: c.slug })
    }
  }

  // Live SERP endpoints: 1 task per request
  for (let i = 0; i < orgTasks.length; i++) {
    const { _slug: slug, ...taskPayload } = orgTasks[i]
    process.stdout.write(`  [${i + 1}/${orgTasks.length}] ${slug} [${orgTasks[i].keyword}]: `)
    const resp = await apiPost('/v3/serp/google/organic/live/advanced', [taskPayload])
    const task = resp.tasks?.[0]
    const items = task?.result?.[0]?.items || []
    const domains = extractOrganicDomains(items, 5)
    const itemTypes = [...new Set(items.map((it) => it.type))]
    console.log(`${domains.length} domains (${itemTypes.join(',')})`)
    if (!raw[slug].organic_raw) raw[slug].organic_raw = []
    raw[slug].organic_raw.push({ keyword: orgTasks[i].keyword, items_types: itemTypes })
    raw[slug].organic.push({ keyword: orgTasks[i].keyword, topDomains: domains })
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
    c.vol_total = c._volTotal
    c.vol_primary = c._volPrimary
    c.cpc = c._cpc

    // Maps
    const mData = raw[c.slug].maps
    const topThree = mData?.topThree || []
    const renterCount = mData?.totalCount || 0
    c.map_pack_weak = topThree.map((m) => `${m.reviews}r/${m.rating}`).join('|')
    c.renter_count = renterCount

    // Organic — unique domains across both SERP pulls
    const orgDomains = []
    for (const o of raw[c.slug].organic) {
      for (const d of o.topDomains) {
        if (!orgDomains.includes(d)) orgDomains.push(d)
      }
    }
    c.organic_weak = orgDomains.slice(0, 5).join('|')

    // Seasonality
    const monthly = trendsByNiche.get(c.niche) || []
    c.seasonality = monthly.join('|')

    // Rent
    const rentEst = estimateRent(c._volPrimary, c._cpc)
    c.rent_estimate = Math.round(rentEst * 100) / 100

    // 8 scores
    const signals = {
      volume: scoreSearchVolume(c._volPrimary),
      cpc: scoreCPC(c._cpc),
      mapPack: scoreMapPackWeakness(topThree),
      organic: scoreOrganicWeakness(orgDomains.slice(0, 5), DIRECTORY_DOMAINS),
      renters: scoreRenterAvailability(renterCount),
      license: scoreLicenseBarrier(c.license_barrier),
      seasonality: scoreSeasonality(monthly),
      rent: scoreRentPotential(rentEst),
    }
    const { total, status } = totalScore(signals)

    c.score_vol = signals.volume
    c.score_cpc = signals.cpc
    c.score_map = signals.mapPack
    c.score_organic = signals.organic
    c.score_renters = signals.renters
    c.score_license = signals.license
    c.score_season = signals.seasonality
    c.score_rent = signals.rent
    c.score_total = total
    // validated if score ≥ 8, walk_away if < 8
    c.status = total >= 8 ? 'validated' : 'walk_away'
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
