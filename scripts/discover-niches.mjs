#!/usr/bin/env node
// scripts/discover-niches.mjs
// Automates Pass 1 seed expansion: queries DataForSEO for keyword ideas per seed group,
// clusters them, filters to home-service niches, and presents new discoveries.
//
// Usage:
//   node scripts/discover-niches.mjs [--dry-run] [--groups=0,1,2] [--min-vol=1000] [--min-cpc=10]
//   node scripts/discover-niches.mjs --apply           # applies discovered-niches JSON to constants

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { DISCOVERY_SEED_GROUPS, DISCOVERED_NICHES } from '../lib/constants.js'
import { createClient } from '../lib/dataforseo-client.js'
import { buildSeedRequests, processRawResults, discoverNewNiches, formatNicheTable } from '../lib/discover.js'

// --- CLI args ---
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const applyMode = args.includes('--apply')
const groupsArg = args.find(a => a.startsWith('--groups='))
const minVolArg = args.find(a => a.startsWith('--min-vol='))
const minCpcArg = args.find(a => a.startsWith('--min-cpc='))

const groupFilter = groupsArg ? groupsArg.split('=')[1].split(',').map(Number) : null
const minVolume = minVolArg ? Number(minVolArg.split('=')[1]) : 1000
const minCpc = minCpcArg ? Number(minCpcArg.split('=')[1]) : 10

// --- Apply mode: read JSON and update constants ---
if (applyMode) {
  const files = readdirSync('data').filter(f => f.startsWith('discovered-niches-') && f.endsWith('.json')).sort()
  if (files.length === 0) {
    console.error('No discovered-niches JSON files found in data/. Run discovery first.')
    process.exit(1)
  }
  const latest = files[files.length - 1]
  console.log(`Applying ${latest}...`)
  const newNiches = JSON.parse(readFileSync(`data/${latest}`, 'utf8'))

  // Read current constants file
  const constPath = 'lib/constants.js'
  let constContent = readFileSync(constPath, 'utf8')

  // Build new entries to append
  const existingNames = new Set(DISCOVERED_NICHES.map(n => n.niche.toLowerCase()))
  const toAdd = newNiches.filter(n => !existingNames.has(n.niche.toLowerCase()))

  if (toAdd.length === 0) {
    console.log('All niches already in DISCOVERED_NICHES. Nothing to apply.')
    process.exit(0)
  }

  // Insert before the closing bracket of DISCOVERED_NICHES
  const newEntries = toAdd.map(n =>
    `  { niche: '${n.niche}', nat_vol: ${n.total_volume}, avg_cpc: ${n.avg_cpc.toFixed(2)} },`
  ).join('\n')

  // Find the last entry line before the closing ]
  const closingIdx = constContent.lastIndexOf(']', constContent.indexOf('export const AREA_STATE'))
  const insertIdx = constContent.lastIndexOf('\n', closingIdx)
  constContent = constContent.slice(0, insertIdx) + '\n' + newEntries + constContent.slice(insertIdx)
  writeFileSync(constPath, constContent)

  // Update test count
  const testPath = 'tests/constants.test.js'
  let testContent = readFileSync(testPath, 'utf8')
  const oldCount = DISCOVERED_NICHES.length
  const newCount = oldCount + toAdd.length
  testContent = testContent.replace(
    `toHaveLength(${oldCount})`,
    `toHaveLength(${newCount})`
  )
  writeFileSync(testPath, testContent)

  console.log(`Added ${toAdd.length} niches to DISCOVERED_NICHES (${oldCount} → ${newCount})`)
  console.log(`Updated test count in ${testPath}`)
  console.log('\nRun: npm test to verify')
  process.exit(0)
}

// --- Select seed groups ---
let seedGroups = DISCOVERY_SEED_GROUPS
if (groupFilter) {
  seedGroups = groupFilter.map(i => {
    if (i < 0 || i >= DISCOVERY_SEED_GROUPS.length) {
      console.error(`Invalid group index ${i}. Valid: 0-${DISCOVERY_SEED_GROUPS.length - 1}`)
      process.exit(1)
    }
    return DISCOVERY_SEED_GROUPS[i]
  })
}

const requests = buildSeedRequests(seedGroups)
const estCost = requests.length * 0.09
console.log(`\n── Discover Niches — Pass 1 Seed Expansion ──`)
console.log(`  Seed groups: ${seedGroups.length}`)
console.log(`  Estimated cost: $${estCost.toFixed(2)}`)
console.log(`  Min volume: ${minVolume}  |  Min CPC: $${minCpc}`)

if (estCost > 1) {
  console.error('\nCost exceeds $1 — aborting. Get user approval first.')
  process.exit(1)
}

if (dryRun) {
  console.log('\n── Dry Run — would query these seed groups: ──')
  seedGroups.forEach((g, i) => {
    const idx = groupFilter ? groupFilter[i] : i
    console.log(`  Group ${idx}: ${g.join(', ')}`)
  })
  console.log(`\nEstimated cost: $${estCost.toFixed(2)}`)
  process.exit(0)
}

// --- DataForSEO client ---
const envContent = readFileSync(`${process.env.HOME}/.config/rank-rent/.env`, 'utf8')
const { apiPost, sleep } = createClient.fromEnvContent(envContent)

// --- Main ---
async function main() {
  console.log('\n── Querying DataForSEO ──')
  const apiResults = []

  for (let i = 0; i < requests.length; i++) {
    const groupIdx = groupFilter ? groupFilter[i] : i
    console.log(`  Group ${groupIdx}: ${seedGroups[i].join(', ')}`)
    const resp = await apiPost('/v3/keywords_data/google_ads/keywords_for_keywords/live', [requests[i]])
    apiResults.push(resp)
    const resultCount = resp.tasks?.[0]?.result?.length || 0
    console.log(`    → ${resultCount} keywords returned`)
    if (i < requests.length - 1) await sleep(5100) // rate limit: 12 req/min
  }

  // Process results
  const rawKeywords = processRawResults(apiResults)
  console.log(`\n  Total raw keywords: ${rawKeywords.length}`)

  const newNiches = discoverNewNiches(rawKeywords, DISCOVERED_NICHES, { minVolume, minCpc })
  console.log(`  New home-service niches found: ${newNiches.length}`)

  if (newNiches.length === 0) {
    console.log('\nNo new home-service niches discovered. Try adjusting thresholds or adding seed groups.')
    return
  }

  // Display results
  console.log('\n── New Home-Service Niches ──\n')
  console.log(formatNicheTable(newNiches))

  // Write JSON for review
  const today = new Date().toISOString().split('T')[0]
  const outPath = `data/discovered-niches-${today}.json`
  if (!existsSync('data')) {
    const { mkdirSync } = await import('fs')
    mkdirSync('data', { recursive: true })
  }
  writeFileSync(outPath, JSON.stringify(newNiches, null, 2))
  console.log(`\nResults written to: ${outPath}`)
  console.log(`\nTo add these niches, run:\n  node scripts/discover-niches.mjs --apply`)

  const actualCost = requests.length * 0.09
  console.log(`\nTotal DataForSEO cost: ~$${actualCost.toFixed(2)}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
