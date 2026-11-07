#!/usr/bin/env node
// scripts/revalidate-empty.mjs
// Re-pulls organic SERP + Maps for candidates with empty data,
// re-aggregates weekly trends to monthly, and re-scores all validated candidates.
// Orchestration script — business logic lives in lib/ (tested)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { parseCandidatesCsv, serializeCandidatesCsv } from '../lib/candidates.js'
import { extractOrganicDomains, extractMapsResults } from '../lib/serp-parsing.js'
import { aggregateWeeklyToMonthly } from '../lib/trends.js'
import { createClient, locationName } from '../lib/dataforseo-client.js'
import { scoreCandidateFromRaw } from '../lib/score-candidate.js'

// --- DataForSEO client ---
const envContent = readFileSync(`${process.env.HOME}/.config/rank-rent/.env`, 'utf8')
const { apiPost, sleep } = createClient.fromEnvContent(envContent)

// --- Main ---
async function main() {
  const csv = readFileSync('data/candidates.csv', 'utf8')
  const allCandidates = parseCandidatesCsv(csv)

  // Find candidates with validation data that have empty organic/maps
  const toRepull = allCandidates.filter((c) => {
    if (!c.validated_date) return false
    if (c.status === 'shortlisted') return false
    const rawPath = `research/${c.slug}/validation-data.json`
    if (!existsSync(rawPath)) return false
    const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
    const emptyOrg = !raw.organic || raw.organic.every((o) => !o.topDomains || o.topDomains.length === 0)
    const emptyMaps = !raw.maps || raw.maps.totalCount === 0
    return emptyOrg || emptyMaps
  })

  console.log(`Found ${toRepull.length} candidates needing organic/maps re-pull`)
  if (toRepull.length === 0) {
    console.log('Nothing to re-pull.')
    // Still re-aggregate trends and re-score below
  }

  // Cost estimate
  const orgCost = toRepull.length * 2 * 0.003
  const mapsCost = toRepull.length * 0.003
  const totalCost = orgCost + mapsCost
  console.log(`Estimated cost: $${totalCost.toFixed(3)} (organic: $${orgCost.toFixed(3)}, maps: $${mapsCost.toFixed(3)})`)
  if (totalCost > 1) {
    console.error('Cost exceeds $1 — aborting. Get user approval first.')
    process.exit(1)
  }

  // ── Re-pull Organic SERP ──
  if (toRepull.length > 0) {
    console.log('\n── Re-pulling Organic SERP ──')
    const orgTasks = []
    for (const c of toRepull) {
      const phrases = (c.phrases || '').split('|').filter(Boolean)
        .map((p) => ({ phrase: p, vol: 0 }))
      // Use top 2 phrases (by volume from saved data)
      const rawPath = `research/${c.slug}/validation-data.json`
      const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
      const ranked = phrases.map((p) => ({
        phrase: p.phrase,
        vol: raw.volumes?.[p.phrase]?.search_volume || 0,
      })).sort((a, b) => b.vol - a.vol)
      for (const { phrase } of ranked.slice(0, 2)) {
        orgTasks.push({
          keyword: phrase, location_name: locationName(c.area),
          language_name: 'English', depth: 10, _slug: c.slug,
        })
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

      // Update saved raw data
      const rawPath = `research/${slug}/validation-data.json`
      const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
      const existing = raw.organic?.findIndex((o) => o.keyword === orgTasks[i].keyword)
      if (existing >= 0) {
        raw.organic[existing].topDomains = domains
      } else {
        if (!raw.organic) raw.organic = []
        raw.organic.push({ keyword: orgTasks[i].keyword, topDomains: domains })
      }
      if (!raw.organic_raw) raw.organic_raw = []
      raw.organic_raw.push({ keyword: orgTasks[i].keyword, items_types: itemTypes })
      writeFileSync(rawPath, JSON.stringify(raw, null, 2))
      if (i < orgTasks.length - 1) await sleep(100) // 10k/min limit allows fast pacing
    }

    // ── Re-pull Maps SERP ──
    console.log('\n── Re-pulling Maps SERP ──')
    const mapTasks = toRepull.map((c) => ({
      keyword: c.primary_phrase, location_name: locationName(c.area),
      language_name: 'English', depth: 20, _slug: c.slug,
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

      // Update saved raw data
      const rawPath = `research/${slug}/validation-data.json`
      const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
      raw.maps = { keyword: mapTasks[i].keyword, topThree, totalCount }
      raw.maps_raw = { keyword: mapTasks[i].keyword, items_types: itemTypes }
      writeFileSync(rawPath, JSON.stringify(raw, null, 2))
      if (i < mapTasks.length - 1) await sleep(100)
    }
  }

  // ── Re-aggregate trends (weekly → monthly) for all validated candidates ──
  console.log('\n── Re-aggregating Trends ──')
  const allValidated = allCandidates.filter((c) => c.validated_date)
  let trendsFixed = 0
  for (const c of allValidated) {
    const rawPath = `research/${c.slug}/validation-data.json`
    if (!existsSync(rawPath)) continue
    const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
    const trends = raw.trends || []
    if (trends.length > 12) {
      // Weekly data — aggregate to monthly
      const dates = raw.trends_dates || []
      const monthly = aggregateWeeklyToMonthly(trends, dates)
      raw.trends_monthly = monthly
      raw.trends_weekly = trends // preserve originals
      raw.trends = monthly
      writeFileSync(rawPath, JSON.stringify(raw, null, 2))
      trendsFixed++
    }
  }
  console.log(`  Fixed ${trendsFixed} candidates (weekly → monthly)`)

  // ── Re-score all validated candidates ──
  console.log('\n── Re-scoring ──')
  const today = new Date().toISOString().split('T')[0]
  let changed = 0

  for (const c of allValidated) {
    const rawPath = `research/${c.slug}/validation-data.json`
    if (!existsSync(rawPath)) continue
    const raw = JSON.parse(readFileSync(rawPath, 'utf8'))

    const scored = scoreCandidateFromRaw(c, raw)
    const oldTotal = Number(c.score_total)
    if (scored.score_total !== oldTotal) {
      console.log(`  ${c.slug}: ${oldTotal}→${scored.score_total} (${c.status}→${scored.status})`)
      changed++
    }

    Object.assign(c, scored)
    c.validated_date = c.validated_date || today
  }

  // Save CSV
  writeFileSync('data/candidates.csv', serializeCandidatesCsv(allCandidates))
  console.log(`\n${changed} candidates had score changes`)
  console.log('CSV updated')

  // Summary
  const validated = allValidated.filter((c) => c.status === 'validated')
  const walkAway = allValidated.filter((c) => c.status === 'walk_away')
  console.log(`\nValidated: ${validated.length}  |  Walk Away: ${walkAway.length}`)

  // Show top candidates by score
  console.log('\n── Top Candidates ──')
  validated
    .sort((a, b) => Number(b.score_total) - Number(a.score_total))
    .slice(0, 15)
    .forEach((c) => {
      console.log(`  ${c.slug.padEnd(44)} score=${c.score_total}  vol=${c.vol_primary}  cpc=${c.cpc}  rent=$${c.rent_estimate}`)
    })
}

main().catch((err) => { console.error(err); process.exit(1) })
