#!/usr/bin/env node
// scripts/local-discover.mjs
// Local niche discovery: queries keywords_for_keywords with city-level targeting
// to find niches with strong local demand that don't register nationally.
//
// Usage:
//   node scripts/local-discover.mjs [options]
//     --dry-run                     Show cost estimate, don't query API
//     --cities="Georgetown,Buckeye" Filter to specific cities
//     --top=N                       Use top N cities by growth_pct (default: all)
//     --max-cost=N                  Cost gate in dollars (default: 1.00)
//     --min-vol=N                   Min cluster volume (default: 50)
//     --min-cpc=N                   Min avg CPC (default: 6)

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { loadCities } from '../lib/cities.js'
import { parseCandidatesCsv, serializeCandidatesCsv } from '../lib/candidates.js'
import { DISCOVERY_SEED_GROUPS } from '../lib/constants.js'
import { createClient } from '../lib/dataforseo-client.js'
import {
  buildLocalSeedRequests,
  estimateLocalDiscoveryCost,
  processLocalResults,
  localClusterToCandidate,
  LOCAL_DISCOVER_DEFAULTS,
} from '../lib/local-discover.js'

// --- CLI args ---
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

const citiesArg = args.find(a => a.startsWith('--cities='))
const citiesFilter = citiesArg
  ? citiesArg.split('=')[1].replace(/^["']|["']$/g, '').split(',').map(s => s.trim().toLowerCase())
  : null

const topArg = args.find(a => a.startsWith('--top='))
const topN = topArg ? parseInt(topArg.split('=')[1], 10) : null

const maxCostArg = args.find(a => a.startsWith('--max-cost='))
const maxCost = maxCostArg ? parseFloat(maxCostArg.split('=')[1]) : LOCAL_DISCOVER_DEFAULTS.maxCost

const minVolArg = args.find(a => a.startsWith('--min-vol='))
const minVolume = minVolArg ? parseInt(minVolArg.split('=')[1], 10) : LOCAL_DISCOVER_DEFAULTS.minVolume

const minCpcArg = args.find(a => a.startsWith('--min-cpc='))
const minCpc = minCpcArg ? parseFloat(minCpcArg.split('=')[1]) : LOCAL_DISCOVER_DEFAULTS.minCpc

// --- Main ---
async function main() {
  // 1. Load cities, apply filters
  let cities = await loadCities('data/cities.csv')

  if (citiesFilter) {
    cities = cities.filter(c => citiesFilter.includes(c.city.toLowerCase()))
    if (cities.length === 0) {
      console.error('No matching cities found. Check --cities argument.')
      process.exit(1)
    }
  }

  // Sort by growth_pct descending for --top
  cities.sort((a, b) => b.growth_pct - a.growth_pct)
  if (topN) {
    cities = cities.slice(0, topN)
  }

  // 2. Build requests per city to count batches
  const sampleRequests = buildLocalSeedRequests(DISCOVERY_SEED_GROUPS, cities[0])
  const batchesPerCity = sampleRequests.length

  // 3. Cost gate
  const estCost = estimateLocalDiscoveryCost(cities.length, batchesPerCity)
  console.log(`\nLocal niche discovery`)
  console.log(`  Cities: ${cities.length}`)
  console.log(`  Batches per city: ${batchesPerCity}`)
  console.log(`  Total requests: ${cities.length * batchesPerCity}`)
  console.log(`  Estimated cost: $${estCost.toFixed(2)}`)

  if (estCost > maxCost) {
    console.error(`\nCost $${estCost.toFixed(2)} exceeds --max-cost=$${maxCost.toFixed(2)} — aborting.`)
    console.error(`Use --max-cost=${estCost.toFixed(2)} to allow, or reduce city count with --top=N.`)
    process.exit(1)
  }

  // 4. Dry-run: print summary and exit
  if (dryRun) {
    console.log('\n── Dry Run — would query these cities: ──')
    for (const c of cities) {
      console.log(`  ${c.city}, ${c.state} (pop ${c.pop_2026.toLocaleString()}, growth ${c.growth_pct}%)`)
    }
    console.log(`\nSeed groups: ${DISCOVERY_SEED_GROUPS.length} (${DISCOVERY_SEED_GROUPS.flat().length} keywords)`)
    console.log(`Thresholds: minVolume=${minVolume}, minCpc=${minCpc}`)
    console.log(`Estimated cost: $${estCost.toFixed(2)}`)
    return
  }

  // --- DataForSEO client ---
  const envContent = readFileSync(`${process.env.HOME}/.config/rank-rent/.env`, 'utf8')
  const { apiPost, sleep } = createClient.fromEnvContent(envContent)

  // Load existing CSV for dedup
  const csvPath = 'data/candidates.csv'
  let allCandidates = []
  if (existsSync(csvPath)) {
    allCandidates = parseCandidatesCsv(readFileSync(csvPath, 'utf8'))
  }
  const existingSlugs = new Set(allCandidates.map(c => c.slug))

  // 5. Query per city
  console.log('\n── Querying keywords_for_keywords per city ──')
  const newCandidates = []
  let requestCount = 0

  for (const city of cities) {
    const cityInfo = { city: city.city, state: city.state, pop_2026: city.pop_2026 }
    const requests = buildLocalSeedRequests(DISCOVERY_SEED_GROUPS, cityInfo)

    console.log(`\n  ${city.city}, ${city.state} (${requests.length} batches)`)

    const apiResults = []
    for (let i = 0; i < requests.length; i++) {
      requestCount++
      console.log(`    Batch ${i + 1}/${requests.length}...`)

      const resp = await apiPost('/v3/keywords_data/google_ads/keywords_for_keywords/live', [requests[i]])
      apiResults.push(resp)

      if (i < requests.length - 1 || city !== cities[cities.length - 1]) {
        await sleep(5100) // 12 req/min rate limit
      }
    }

    // Process results for this city
    const clusters = processLocalResults(apiResults, cityInfo, { minVolume, minCpc })
    console.log(`    Found ${clusters.length} home-service niches`)

    // Convert to candidates, dedup
    for (const cluster of clusters) {
      const candidate = localClusterToCandidate(cluster)
      if (existingSlugs.has(candidate.slug)) {
        continue
      }
      existingSlugs.add(candidate.slug)
      newCandidates.push(candidate)
    }
  }

  // 7. Write CSV
  if (newCandidates.length > 0) {
    allCandidates.push(...newCandidates)
    writeFileSync(csvPath, serializeCandidatesCsv(allCandidates))
    console.log(`\nWrote ${newCandidates.length} new candidates to ${csvPath}`)
  } else {
    console.log('\nNo new candidates found (all below thresholds or already exist)')
  }

  // 8. Summary table
  const actualCost = requestCount * LOCAL_DISCOVER_DEFAULTS.costPerRequest
  console.log('\n═══════════════════════════════════════════════════════════════════════════════════════════')
  console.log(`  LOCAL DISCOVERY SUMMARY  |  Cities: ${cities.length}  |  Requests: ${requestCount}  |  New: ${newCandidates.length}`)
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════')
  if (newCandidates.length > 0) {
    console.log(`${'Niche'.padEnd(30)} ${'City'.padEnd(20)} ${'Volume'.padStart(7)} ${'CPC'.padStart(7)}`)
    console.log('─'.repeat(66))
    for (const c of newCandidates.sort((a, b) => b.vol_total - a.vol_total)) {
      console.log(`${c.niche.padEnd(30)} ${c.area.padEnd(20)} ${String(c.vol_total).padStart(7)} ${(typeof c.cpc === 'number' ? c.cpc.toFixed(2) : c.cpc).padStart(7)}`)
    }
  }
  console.log(`\nTotal DataForSEO cost: ~$${actualCost.toFixed(2)}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
