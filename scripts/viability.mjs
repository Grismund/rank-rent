#!/usr/bin/env node
// scripts/viability.mjs
// Runs rr-viability procedure for torn-down candidates
// Checks unit economics, pulls live SERP for paid ad analysis, writes reports
// Uses cached SERP data from validation when available (< 30 days old)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { parseCandidatesCsv, serializeCandidatesCsv } from '../lib/candidates.js'
import { parseNicheEconomics } from '../lib/niche-economics-parser.js'
import { DISCOVERED_NICHES, PLATFORM_DOMAINS, DIRECTORY_DOMAINS } from '../lib/constants.js'
import { estimateRent } from '../lib/scoring.js'
import {
  lookupJobEconomics, flagInflatedCPC, computeBreakEven,
  assessViability, countPaidAds, detectBaitAndSwitch, assessOrganicFragmentation,
} from '../lib/viability.js'
import { estimateViabilityCost } from '../lib/cost-estimator.js'
import { createClient, locationName } from '../lib/dataforseo-client.js'

// --- CLI args ---
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const filterSlugs = args.find(a => a.startsWith('--filter='))?.split('=')[1]?.split(',') || null

// --- DataForSEO client ---
const envContent = readFileSync(`${process.env.HOME}/.config/rank-rent/.env`, 'utf8')
const { apiPost, sleep } = createClient.fromEnvContent(envContent)

// --- SERP cache helpers ---
const CACHE_MAX_AGE_DAYS = 30

function hasFreshSerpCache(slug) {
  const rawPath = `research/${slug}/validation-data.json`
  if (!existsSync(rawPath)) return false
  const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
  if (!raw.serp_items || !Array.isArray(raw.serp_items)) return false
  // Check if validation data is fresh enough
  if (!raw.cached_at) return true // If no date, assume it's from recent validation
  const age = (Date.now() - new Date(raw.cached_at).getTime()) / (1000 * 60 * 60 * 24)
  return age < CACHE_MAX_AGE_DAYS
}

function loadCachedSerpItems(slug) {
  const rawPath = `research/${slug}/validation-data.json`
  const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
  return raw.serp_items || []
}

// --- Main ---
async function main() {
  const csv = readFileSync('data/candidates.csv', 'utf8')
  const allCandidates = parseCandidatesCsv(csv)
  let candidates = allCandidates.filter((c) => c.status === 'torn_down')

  if (filterSlugs) {
    candidates = candidates.filter((c) => filterSlugs.includes(c.slug))
  }

  console.log(`Found ${candidates.length} torn-down candidates for viability analysis`)
  if (candidates.length === 0) { console.log('Nothing to analyze.'); return }

  // Load economics reference
  const econMd = readFileSync('reference/niche-economics.md', 'utf8')
  const econTable = parseNicheEconomics(econMd)

  // Build national CPC lookup
  const nationalCpcMap = new Map()
  for (const n of DISCOVERED_NICHES) {
    nationalCpcMap.set(n.niche.toLowerCase(), n.avg_cpc)
  }

  // Cost gate — check cache hits
  let cachedCount = 0
  for (const c of candidates) {
    if (hasFreshSerpCache(c.slug)) cachedCount++
  }
  const cost = estimateViabilityCost(candidates.length, cachedCount)
  console.log(`\nEstimated cost: $${cost.total.toFixed(3)}`)
  console.log(`  API calls needed: ${cost.apiCalls} (${cost.cached} cached)`)

  if (cost.total > 1) {
    console.error('\nCost exceeds $1 — aborting. Get user approval first.')
    process.exit(1)
  }

  if (dryRun) {
    console.log('\n── Dry Run — Candidates ──')
    for (const c of candidates) {
      const cached = hasFreshSerpCache(c.slug) ? '(cached)' : '(API call)'
      console.log(`  ${c.slug} — score=${c.score_total} rent=$${c.rent_estimate} ${cached}`)
    }
    return
  }

  const today = new Date().toISOString().split('T')[0]

  // --- Process each candidate ---
  for (const c of candidates) {
    console.log(`\n── ${c.slug} ──`)

    // a. Look up job economics
    const econ = lookupJobEconomics(c.niche, econTable)
    if (!econ) {
      console.log(`  ⚠ No economics data for niche "${c.niche}" — skipping`)
      continue
    }

    // b. Check CPC inflation
    const nationalCpc = nationalCpcMap.get(c.niche.toLowerCase()) || 0
    const localCpc = Number(c.cpc) || 0
    const isInflated = flagInflatedCPC(localCpc, nationalCpc)
    const inflationRatio = nationalCpc > 0 ? (localCpc / nationalCpc).toFixed(1) : 'N/A'

    let effectiveRent = Number(c.rent_estimate) || 0
    if (isInflated && nationalCpc > 0) {
      // Recompute rent using national CPC
      effectiveRent = Math.round(estimateRent(Number(c.vol_primary) || 0, nationalCpc) * 100) / 100
      console.log(`  CPC inflated: local=$${localCpc} vs national=$${nationalCpc} (${inflationRatio}×) — adjusted rent=$${effectiveRent}`)
    }

    // c. Get SERP data (cached or fresh)
    let serpItems
    if (hasFreshSerpCache(c.slug)) {
      console.log(`  Using cached SERP data`)
      serpItems = loadCachedSerpItems(c.slug)
    } else {
      console.log(`  Pulling live SERP for "${c.primary_phrase}"`)
      const resp = await apiPost('/v3/serp/google/organic/live/regular', [{
        keyword: c.primary_phrase,
        location_name: locationName(c.area),
        language_name: 'English',
        depth: 20,
      }])
      serpItems = resp.tasks?.[0]?.result?.[0]?.items || []

      // Save SERP items to validation data for future cache
      const rawPath = `research/${c.slug}/validation-data.json`
      if (existsSync(rawPath)) {
        const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
        raw.serp_items = serpItems
        raw.cached_at = today
        writeFileSync(rawPath, JSON.stringify(raw, null, 2))
      }

      // Also save standalone for reference
      const dir = `research/${c.slug}`
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(`${dir}/viability-serp.json`, JSON.stringify(serpItems, null, 2))
      await sleep(100)
    }

    // d. Analyze SERP
    const paidCount = countPaidAds(serpItems)
    const paidItems = serpItems.filter((it) => it.type === 'paid')
    const baitFlags = detectBaitAndSwitch(paidItems)
    const organicItems = serpItems.filter((it) => it.type === 'organic')
    const fragmentation = assessOrganicFragmentation(organicItems, PLATFORM_DOMAINS, DIRECTORY_DOMAINS)

    console.log(`  Paid ads: ${paidCount}, Bait-and-switch: ${baitFlags.length}`)
    console.log(`  Organic: ${fragmentation.dedicatedSiteCount} sites, ${fragmentation.directoryCount} dirs, ${fragmentation.socialCount} social`)

    // e. Compute break-even
    const avgJobValue = (econ.avgJobLow + econ.avgJobHigh) / 2
    const marginPct = (econ.marginLow + econ.marginHigh) / 2
    const netPerJob = avgJobValue * marginPct
    const breakEvenJobs = computeBreakEven(effectiveRent, avgJobValue, marginPct)
    const monthlyLeads = Math.round((Number(c.vol_primary) || 0) * 0.15)
    const viabilityResult = assessViability(breakEvenJobs, monthlyLeads)
    const breakEvenRatio = monthlyLeads > 0 ? ((breakEvenJobs / monthlyLeads) * 100).toFixed(1) : 'N/A'

    console.log(`  Break-even: ${breakEvenJobs} jobs/mo (${breakEvenRatio}% of ${monthlyLeads} leads) → ${viabilityResult}`)

    // f. Set status
    const newStatus = viabilityResult === 'fail' ? 'walk_away' : 'viable'
    c.status = newStatus
    c.viability_date = today

    // Write viability report
    const dir = `research/${c.slug}`
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const md = `# Viability Report — ${c.niche} in ${c.area}

**Date:** ${today}
**Verdict:** ${viabilityResult}

## Job Economics

| Metric | Value |
|--------|-------|
| Avg job value | $${econ.avgJobLow}–$${econ.avgJobHigh} |
| Gross margin | ${(econ.marginLow * 100).toFixed(0)}–${(econ.marginHigh * 100).toFixed(0)}% |
| Source | ${econ.notes} |

## CPC Analysis

| Metric | Value |
|--------|-------|
| Local CPC | $${localCpc} |
| National avg CPC | $${nationalCpc} |
| Inflation ratio | ${inflationRatio}× |
| Inflated? | ${isInflated ? 'yes' : 'no'} |

${isInflated ? `**Adjusted rent estimate:** $${effectiveRent}/mo (using national CPC instead of inflated local CPC)` : ''}

## SERP Analysis

| Metric | Value |
|--------|-------|
| Paid ad count | ${paidCount} |
| Bait-and-switch flags | ${baitFlags.length}${baitFlags.length > 0 ? ' — ' + baitFlags.map(a => `"${a.title || ''}"`).join(', ') : ''} |
| Social/platform results | ${fragmentation.socialCount} |
| Dedicated business sites | ${fragmentation.dedicatedSiteCount} |
| Directory results | ${fragmentation.directoryCount} |

## Break-Even Math

| Metric | Value |
|--------|-------|
| Rent estimate | $${effectiveRent}/mo |
| Net revenue per job | $${netPerJob.toFixed(0)} |
| Jobs to break even | ${breakEvenJobs}/mo |
| Estimated monthly leads | ${monthlyLeads} |
| Break-even ratio | ${breakEvenRatio}% of leads |
| Assessment | ${viabilityResult} |
`

    writeFileSync(`${dir}/viability.md`, md)
    console.log(`  → ${dir}/viability.md written`)
  }

  // --- Save CSV ---
  writeFileSync('data/candidates.csv', serializeCandidatesCsv(allCandidates))
  console.log('\nCSV updated')

  // --- Summary ---
  const viable = candidates.filter((c) => c.status === 'viable')
  const walkAway = candidates.filter((c) => c.status === 'walk_away')
  const skipped = candidates.filter((c) => c.status === 'torn_down') // no economics data

  console.log(`\n═══════════════════════════════════════════════════════════════════════════════════════════`)
  console.log(`  VIABILITY SUMMARY  —  Viable: ${viable.length}  |  Walk Away: ${walkAway.length}  |  Skipped: ${skipped.length}  |  Total: ${candidates.length}`)
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════')
  for (const c of [...viable, ...walkAway]) {
    const mark = c.status === 'viable' ? '✓' : ' '
    console.log(`${mark} ${c.slug.padEnd(44)} rent=$${c.rent_estimate}  ${c.status}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
