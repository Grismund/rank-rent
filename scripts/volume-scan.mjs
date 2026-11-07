#!/usr/bin/env node
// scripts/volume-scan.mjs
// City-mode volume scanning: checks local demand for DISCOVERED_NICHES in target cities
// Usage: node scripts/volume-scan.mjs "Houston" "Tulsa" [--dry-run] [--filter=niche1,niche2] [--region="West Texas"]

import { readFileSync, writeFileSync, existsSync } from 'fs'
import {
  generateSlug, generatePhrases, parseCandidatesCsv, serializeCandidatesCsv,
} from '../lib/candidates.js'
import { DISCOVERED_NICHES, VOLUME_SCAN_DEFAULTS, AREA_STATE } from '../lib/constants.js'
import { createClient } from '../lib/dataforseo-client.js'

// --- CLI args ---
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const filterArg = args.find(a => a.startsWith('--filter='))
const nicheFilter = filterArg ? filterArg.split('=')[1].split(',').map(s => s.trim().toLowerCase()) : null
const regionArg = args.find(a => a.startsWith('--region='))
const region = regionArg ? regionArg.split('=')[1].replace(/^["']|["']$/g, '') : ''
const cities = args.filter(a => !a.startsWith('--'))

if (cities.length === 0) {
  console.error('Usage: node scripts/volume-scan.mjs "City1" "City2" [--dry-run] [--filter=niche1,niche2] [--region="Label"]')
  process.exit(1)
}

// --- DataForSEO client ---
const envContent = readFileSync(`${process.env.HOME}/.config/rank-rent/.env`, 'utf8')
const { apiPost, sleep } = createClient.fromEnvContent(envContent)

// --- Main ---
async function main() {
  // Filter niches if specified
  let niches = DISCOVERED_NICHES
  if (nicheFilter) {
    niches = niches.filter(n => nicheFilter.includes(n.niche.toLowerCase()))
    console.log(`Filtered to ${niches.length} niches: ${niches.map(n => n.niche).join(', ')}`)
  }

  console.log(`\nCity-mode volume scan`)
  console.log(`  Cities: ${cities.join(', ')}`)
  console.log(`  Niches: ${niches.length}`)
  if (region) console.log(`  Region: ${region}`)

  // Build keyword lists per city
  const allKeywords = []  // { keyword, city, niche, state }
  for (const city of cities) {
    const state = AREA_STATE[city]
    if (!state) {
      console.error(`\n⚠ Unknown city "${city}" — not in AREA_STATE map. Add it to lib/constants.js first.`)
      process.exit(1)
    }
    for (const n of niches) {
      const phrases = generatePhrases(n.niche, city, state)
      for (const p of phrases) {
        allKeywords.push({ keyword: p, city, niche: n.niche, state })
      }
    }
  }

  console.log(`  Total keywords: ${allKeywords.length}`)

  // Batch into groups of 700
  const BATCH_SIZE = 700
  const batches = []
  for (let i = 0; i < allKeywords.length; i += BATCH_SIZE) {
    batches.push(allKeywords.slice(i, i + BATCH_SIZE))
  }
  const estCost = batches.length * 0.05
  console.log(`  Batches: ${batches.length} × $0.05 = $${estCost.toFixed(2)}`)

  if (estCost > 1) {
    console.error('\nCost exceeds $1 — aborting. Get user approval first.')
    process.exit(1)
  }

  if (dryRun) {
    console.log('\n── Dry Run — would scan these niche × city pairs: ──')
    for (const city of cities) {
      for (const n of niches) {
        console.log(`  ${n.niche} × ${city}`)
      }
    }
    console.log(`\nEstimated cost: $${estCost.toFixed(2)}`)
    return
  }

  // Load existing CSV
  const csvPath = 'data/candidates.csv'
  let allCandidates = []
  if (existsSync(csvPath)) {
    allCandidates = parseCandidatesCsv(readFileSync(csvPath, 'utf8'))
  }
  const existingSlugs = new Set(allCandidates.map(c => c.slug))

  // Call API per batch
  console.log('\n── Fetching volumes ──')
  const volumeMap = new Map()  // keyword → { search_volume, cpc }

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]
    const keywords = [...new Set(batch.map(k => k.keyword))]
    console.log(`  Batch ${b + 1}/${batches.length}: ${keywords.length} keywords`)
    const resp = await apiPost('/v3/keywords_data/google_ads/search_volume/live', [{
      keywords,
      location_code: 2840,  // United States
      language_code: 'en',
      search_partners: false,
    }])
    if (resp.tasks?.[0]?.result) {
      for (const r of resp.tasks[0].result) {
        volumeMap.set(r.keyword, {
          search_volume: r.search_volume || 0,
          cpc: r.cpc || 0,
        })
      }
    } else {
      console.warn(`  ⚠ No results for batch ${b + 1}:`, resp.tasks?.[0]?.status_message)
    }
    if (b < batches.length - 1) await sleep(5100) // rate limit
  }

  // Aggregate per niche × city
  console.log('\n── Aggregating results ──')
  const { localVolumeFloor, localCpcFloor } = VOLUME_SCAN_DEFAULTS
  const newCandidates = []

  for (const city of cities) {
    const state = AREA_STATE[city]
    for (const n of niches) {
      const slug = generateSlug(n.niche, city)
      if (existingSlugs.has(slug)) continue // idempotent

      const phrases = generatePhrases(n.niche, city, state)
      let totalVol = 0, maxCpc = 0, primaryVol = 0
      const primaryPhrase = `${n.niche.toLowerCase()} ${city.toLowerCase()}`

      for (const p of phrases) {
        const v = volumeMap.get(p)
        if (v) {
          totalVol += v.search_volume
          if (v.cpc > maxCpc) maxCpc = v.cpc
          if (p === primaryPhrase) primaryVol = v.search_volume
        }
      }

      // Apply thresholds
      if (totalVol < localVolumeFloor || maxCpc < localCpcFloor) continue

      newCandidates.push({
        slug,
        niche: n.niche,
        area: city,
        region: region || '',
        primary_phrase: primaryPhrase,
        phrases: phrases.join('|'),
        population: '',
        license_barrier: 'none',
        franchise_dominated: '',
        vol_total: totalVol,
        vol_primary: primaryVol,
        cpc: maxCpc,
        map_pack_weak: '',
        organic_weak: '',
        renter_count: '',
        seasonality: '',
        rent_estimate: '',
        score_vol: '',
        score_cpc: '',
        score_map: '',
        score_organic: '',
        score_renters: '',
        score_license: '',
        score_season: '',
        score_rent: '',
        score_total: '',
        status: 'discovered',
        validated_date: '',
        teardown_date: '',
        viability_date: '',
      })
    }
  }

  // Write CSV
  if (newCandidates.length > 0) {
    allCandidates.push(...newCandidates)
    if (!existsSync('data')) {
      const { mkdirSync } = await import('fs')
      mkdirSync('data', { recursive: true })
    }
    writeFileSync(csvPath, serializeCandidatesCsv(allCandidates))
    console.log(`\nWrote ${newCandidates.length} new candidates to ${csvPath}`)
  } else {
    console.log('\nNo new viable candidates found (all below thresholds or already exist)')
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════════════════════════════════')
  console.log(`  VOLUME SCAN SUMMARY  —  Mode: City  |  Cities: ${cities.length}  |  Niches: ${niches.length}  |  New: ${newCandidates.length}`)
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════')
  if (newCandidates.length > 0) {
    console.log(`${'Niche'.padEnd(30)} ${'City'.padEnd(18)} ${'Volume'.padStart(7)} ${'CPC'.padStart(7)} ${'Status'.padEnd(12)}`)
    console.log('─'.repeat(80))
    for (const c of newCandidates.sort((a, b) => b.vol_total - a.vol_total)) {
      console.log(`${c.niche.padEnd(30)} ${c.area.padEnd(18)} ${String(c.vol_total).padStart(7)} ${String(c.cpc).padStart(7)} ${c.status}`)
    }
  }
  console.log(`\nTotal DataForSEO cost: ~$${estCost.toFixed(2)}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
