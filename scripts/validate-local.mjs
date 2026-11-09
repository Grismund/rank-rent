#!/usr/bin/env node
// scripts/validate-local.mjs
// Validates local-discover candidates: keyword volume, SERP, Maps, Trends → 8-signal scoring
// Usage: node scripts/validate-local.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { parseCandidatesCsv, serializeCandidatesCsv, isDirectoryDomain } from '../lib/candidates.js'
import { DIRECTORY_DOMAINS } from '../lib/constants.js'
import { createClient } from '../lib/dataforseo-client.js'
import {
  scoreSearchVolume, scoreCPC, scoreMapPackWeakness, scoreOrganicWeakness,
  scoreRenterAvailability, scoreLicenseBarrier, scoreSeasonality,
  estimateRent, scoreRentPotential, totalScore,
} from '../lib/scoring.js'

const envContent = readFileSync(`${process.env.HOME}/.config/rank-rent/.env`, 'utf8')
const { apiPost, sleep } = createClient.fromEnvContent(envContent)

const TODAY = new Date().toISOString().slice(0, 10)

// --- Load candidates ---
const csvPath = 'data/candidates.csv'
const allRows = parseCandidatesCsv(readFileSync(csvPath, 'utf8'))
const candidates = allRows.filter(r => r.region.includes('local-discover') && r.status === 'discovered')

console.log(`Validating ${candidates.length} local-discover candidates\n`)
if (candidates.length === 0) { console.log('No candidates to validate.'); process.exit(0) }

// --- Step 1: Keyword volume ---
console.log('── Step 1: Keyword volume ──')

// Group phrases by location for accurate local volumes
const locationGroups = new Map() // "City,State,United States" → [{candidate, phrases}]
for (const c of candidates) {
  const loc = `${c.area},${c.region.replace(' (local-discover)', '')},United States`
  if (!locationGroups.has(loc)) locationGroups.set(loc, [])
  const sep = c.phrases.includes('|') ? '|' : '; '
  const phrases = c.phrases ? c.phrases.split(sep).map(p => p.trim()) : []
  locationGroups.get(loc).push({ candidate: c, phrases })
}

const volumeMap = new Map() // "phrase|location" → { search_volume, cpc }

for (const [location, entries] of locationGroups) {
  const allPhrases = [...new Set(entries.flatMap(e => e.phrases))]
  console.log(`  ${location}: ${allPhrases.length} phrases`)

  // Batch into 700 per request
  for (let i = 0; i < allPhrases.length; i += 700) {
    const batch = allPhrases.slice(i, i + 700)
    const resp = await apiPost('/v3/keywords_data/google_ads/search_volume/live', [{
      keywords: batch,
      location_name: location,
      language_name: 'English',
    }])
    if (resp.tasks?.[0]?.result) {
      for (const r of resp.tasks[0].result) {
        volumeMap.set(`${r.keyword}|${location}`, {
          search_volume: r.search_volume || 0,
          cpc: r.cpc || 0,
        })
      }
    }
    await sleep(5100)
  }
}

console.log(`  Total keyword data points: ${volumeMap.size}\n`)

// --- Step 2: Organic SERP ---
console.log('── Step 2: Organic SERP ──')

const organicData = new Map() // slug → { topDomains, serpItems }

for (let i = 0; i < candidates.length; i++) {
  const c = candidates[i]
  const loc = `${c.area},${c.region.replace(' (local-discover)', '')},United States`

  // Use primary phrase for SERP
  const keyword = c.primary_phrase || `${c.niche} ${c.area}`.toLowerCase()
  console.log(`  [${i + 1}/${candidates.length}] ${keyword}`)

  const resp = await apiPost('/v3/serp/google/organic/live/advanced', [{
    keyword,
    location_name: loc,
    language_name: 'English',
    depth: 10,
  }])

  const items = resp.tasks?.[0]?.result?.[0]?.items || []
  const organicItems = items.filter(it => it.type === 'organic')
  const topDomains = organicItems.slice(0, 5).map(it => {
    try { return new URL(it.url).hostname.replace(/^www\./, '') } catch { return '' }
  }).filter(Boolean)

  organicData.set(c.slug, { topDomains, serpItems: organicItems.slice(0, 5) })

  if (i < candidates.length - 1) await sleep(5100)
}
console.log()

// --- Step 3: Maps SERP ---
console.log('── Step 3: Maps SERP ──')

const mapsData = new Map() // slug → { topThree, totalCount }

for (let i = 0; i < candidates.length; i++) {
  const c = candidates[i]
  const loc = `${c.area},${c.region.replace(' (local-discover)', '')},United States`
  const keyword = c.primary_phrase || `${c.niche} ${c.area}`.toLowerCase()
  console.log(`  [${i + 1}/${candidates.length}] ${keyword}`)

  const resp = await apiPost('/v3/serp/google/maps/live/advanced', [{
    keyword,
    location_name: loc,
    language_name: 'English',
    depth: 20,
  }])

  const items = resp.tasks?.[0]?.result?.[0]?.items || []
  const mapsItems = items.filter(it => it.type === 'maps_search')
  const topThree = mapsItems.slice(0, 3).map(it => ({
    name: it.title || '',
    reviews: it.reviews_count || 0,
    rating: it.rating?.value || 0,
  }))

  mapsData.set(c.slug, { topThree, totalCount: mapsItems.length })

  if (i < candidates.length - 1) await sleep(5100)
}
console.log()

// --- Step 4: Google Trends ---
console.log('── Step 4: Google Trends ──')

const trendsData = new Map() // niche → monthlyValues[]
const uniqueNiches = [...new Set(candidates.map(c => c.niche))]

for (let i = 0; i < uniqueNiches.length; i++) {
  const niche = uniqueNiches[i]
  console.log(`  [${i + 1}/${uniqueNiches.length}] ${niche}`)

  const resp = await apiPost('/v3/keywords_data/google_trends/explore/live', [{
    keywords: [niche],
    location_name: 'United States',
    language_name: 'English',
    time_range: 'past_12_months',
  }])

  const items = resp.tasks?.[0]?.result || []
  const monthlyValues = []
  if (items.length > 0 && items[0].items) {
    for (const item of items[0].items) {
      if (item.values) {
        monthlyValues.push(item.values[0] || 0)
      }
    }
  }

  trendsData.set(niche, monthlyValues.length > 0 ? monthlyValues : [50]) // default stable
  if (i < uniqueNiches.length - 1) await sleep(5100)
}
console.log()

// --- Step 5: Score all 8 signals ---
console.log('── Step 5: Scoring ──')

const results = []

for (const c of candidates) {
  const loc = `${c.area},${c.region.replace(' (local-discover)', '')},United States`
  const sep = c.phrases.includes('|') ? '|' : '; '
  const phrases = c.phrases ? c.phrases.split(sep).map(p => p.trim()) : []

  // Compute volumes
  let volTotal = 0, volPrimary = 0, maxCpc = 0
  const primaryPhrase = c.primary_phrase || phrases[0] || ''

  for (const p of phrases) {
    const key = `${p}|${loc}`
    const v = volumeMap.get(key)
    if (v) {
      volTotal += v.search_volume
      if (v.cpc > maxCpc) maxCpc = v.cpc
      if (p === primaryPhrase) volPrimary = v.search_volume
    }
  }

  // Get SERP/Maps data
  const organic = organicData.get(c.slug) || { topDomains: [], serpItems: [] }
  const maps = mapsData.get(c.slug) || { topThree: [], totalCount: 0 }
  const monthly = trendsData.get(c.niche) || [50]

  // Score
  const signals = {
    volume: scoreSearchVolume(volPrimary),
    cpc: scoreCPC(maxCpc),
    mapPack: scoreMapPackWeakness(maps.topThree),
    organic: scoreOrganicWeakness(organic.topDomains, DIRECTORY_DOMAINS),
    renters: scoreRenterAvailability(maps.totalCount),
    license: scoreLicenseBarrier(c.license_barrier || 'none'),
    seasonality: scoreSeasonality(monthly),
    rent: scoreRentPotential(estimateRent(volPrimary, maxCpc)),
  }

  const { total, status } = totalScore(signals)
  const rentEst = estimateRent(volPrimary, maxCpc)

  // Save validation data
  const researchDir = `research/${c.slug}`
  if (!existsSync(researchDir)) mkdirSync(researchDir, { recursive: true })
  writeFileSync(`${researchDir}/validation-data.json`, JSON.stringify({
    volTotal, volPrimary, maxCpc, rentEst,
    organic: organic.serpItems,
    topDomains: organic.topDomains,
    maps: maps.topThree,
    mapsTotal: maps.totalCount,
    trends: monthly,
    signals, total, status,
  }, null, 2))

  // Update candidate row
  const row = allRows.find(r => r.slug === c.slug)
  if (row) {
    row.vol_total = volTotal
    row.vol_primary = volPrimary
    row.cpc = maxCpc
    row.map_pack_weak = maps.topThree.filter(b => b.reviews < 50 || b.rating < 4.0).length >= 1 ? 'yes' : 'no'
    row.organic_weak = organic.topDomains.filter(d => DIRECTORY_DOMAINS.some(dir => d === dir || d.endsWith(`.${dir}`))).length >= 2 ? 'yes' : 'no'
    row.renter_count = maps.totalCount
    row.rent_estimate = Math.round(rentEst)
    row.score_vol = signals.volume
    row.score_cpc = signals.cpc
    row.score_map = signals.mapPack
    row.score_organic = signals.organic
    row.score_renters = signals.renters
    row.score_license = signals.license
    row.score_season = signals.seasonality
    row.score_rent = signals.rent
    row.score_total = total
    row.status = total >= 8 ? 'validated' : 'walk_away'
    row.validated_date = TODAY
  }

  results.push({ slug: c.slug, niche: c.niche, area: c.area, total, status: total >= 8 ? 'validated' : 'walk_away', volPrimary, maxCpc, rentEst: Math.round(rentEst) })
}

// --- Write CSV ---
writeFileSync(csvPath, serializeCandidatesCsv(allRows))

// --- Summary ---
results.sort((a, b) => b.total - a.total)
const pass = results.filter(r => r.total >= 11)
const marginal = results.filter(r => r.total >= 8 && r.total < 11)
const walkAway = results.filter(r => r.total < 8)

console.log('\n═══════════════════════════════════════════════════════════════════════════════════════════')
console.log(`  VALIDATION SUMMARY  |  Pass: ${pass.length}  |  Marginal: ${marginal.length}  |  Walk away: ${walkAway.length}`)
console.log('═══════════════════════════════════════════════════════════════════════════════════════════')
console.log(`${'Slug'.padEnd(40)} ${'Score'.padStart(5)} ${'Status'.padEnd(10)} ${'Vol'.padStart(5)} ${'CPC'.padStart(7)} ${'Rent'.padStart(6)}`)
console.log('─'.repeat(78))
for (const r of results) {
  const marker = r.total >= 11 ? '✓' : r.total >= 8 ? '~' : '✗'
  console.log(`${marker} ${r.slug.padEnd(39)} ${String(r.total).padStart(5)} ${r.status.padEnd(10)} ${String(r.volPrimary).padStart(5)} ${r.maxCpc.toFixed(2).padStart(7)} ${('$' + r.rentEst).padStart(6)}`)
}
console.log(`\nTotal: ${results.length} validated | ${pass.length} pass | ${marginal.length} marginal | ${walkAway.length} walk_away`)
