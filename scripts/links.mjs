#!/usr/bin/env node
/**
 * links.mjs — Discover backlink prospects via the copycat method.
 *
 * Usage:
 *   node scripts/links.mjs <slug>              # prospect one site
 *   node scripts/links.mjs --wave 1            # prospect a wave
 *   node scripts/links.mjs --all               # prospect all eligible
 *   node scripts/links.mjs --dry-run <slug>    # estimate cost only, no API calls
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import { parseEnv, createClient } from '../lib/dataforseo-client.js'
import { readSitesCsv } from '../lib/sites-csv.js'
import { readLinksCsv, writeLinksCsv } from '../lib/indexing.js'
import { parseWaveAssignments, getTargetSlugs } from '../lib/wave-assignments.js'
import { AREA_STATE } from '../lib/constants.js'
import {
  buildCompetitorQueries,
  extractCompetitorDomains,
  classifyBacklinkType,
  filterSelfServeProspects,
  buildProspectRow,
  deduplicateProspects,
  selectOutreachPage,
  estimateLinksCost,
  mergeProspects,
  isPortfolioLink,
  formatLinksReport,
} from '../lib/links.js'
import * as readline from 'node:readline'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const allSites = args.includes('--all')
const waveIdx = args.indexOf('--wave')
const waveNum = waveIdx !== -1 ? parseInt(args[waveIdx + 1], 10) : null
const slugArg = args.find(a =>
  !a.startsWith('--') &&
  (waveIdx === -1 || args.indexOf(a) !== waveIdx + 1)
)

if (!slugArg && !allSites && waveNum === null) {
  console.error('Usage: node scripts/links.mjs <slug> | --wave N | --all [--dry-run]')
  process.exit(1)
}

// ── Load data ───────────────────────────────────────────────────────

const envContent = readFileSync(resolve(process.env.HOME, '.config/rank-rent/.env'), 'utf8')
const env = parseEnv(envContent)

const sitesCsv = readFileSync(resolve(ROOT, 'data/sites.csv'), 'utf8')
const allSiteRows = readSitesCsv(sitesCsv)

const linksCsv = readFileSync(resolve(ROOT, 'data/links.csv'), 'utf8')
let existingLinks = readLinksCsv(linksCsv)

const assignmentsMd = readFileSync(resolve(ROOT, 'sites/ASSIGNMENTS.md'), 'utf8')
const waveMap = parseWaveAssignments(assignmentsMd)
const allSlugs = allSiteRows.map(r => r.slug).sort()

const targetSlugs = getTargetSlugs({
  slugArg: slugArg || null,
  waveNum,
  allSlugs,
  waveMap,
})

if (targetSlugs.length === 0) {
  console.error('No target sites found.')
  process.exit(1)
}

// Portfolio domains for inter-site link exclusion
const portfolioDomains = allSiteRows
  .map(r => r.domain)
  .filter(d => d)

console.log(`Targeting ${targetSlugs.length} site(s): ${targetSlugs.join(', ')}`)

// ── Load site configs ───────────────────────────────────────────────

const siteConfigs = {}
const siteRows = {}
for (const slug of targetSlugs) {
  const yamlPath = resolve(ROOT, `sites/${slug}/site.yaml`)
  try {
    siteConfigs[slug] = loadYaml(readFileSync(yamlPath, 'utf8'))
  } catch {
    console.warn(`  Warning: no site.yaml for ${slug}`)
    siteConfigs[slug] = {}
  }
  siteRows[slug] = allSiteRows.find(r => r.slug === slug) || {}
}

// ── Build search cities for competitor discovery ────────────────────

function getSearchCities(homeCity, homeState, maxCities = 10) {
  const cities = []
  // Prefer same-state cities first
  for (const [city, state] of Object.entries(AREA_STATE)) {
    if (city === homeCity) continue
    if (state === homeState) cities.push(city)
  }
  // Then other cities
  for (const [city, state] of Object.entries(AREA_STATE)) {
    if (city === homeCity || state === homeState) continue
    cities.push(city)
  }
  return cities.slice(0, maxCities)
}

// ── Cost estimate ───────────────────────────────────────────────────

const QUERIES_PER_SITE = 10
const EST_COMPETITORS_PER_SITE = 30

const totalSerpQueries = targetSlugs.length * QUERIES_PER_SITE
const totalCompetitors = targetSlugs.length * EST_COMPETITORS_PER_SITE
const estimate = estimateLinksCost(totalSerpQueries, totalCompetitors)

console.log(`\nCost estimate:`)
console.log(`  SERP queries: ${totalSerpQueries} × $0.0025 = $${estimate.serpCost.toFixed(3)}`)
console.log(`  Backlink lookups: ~${totalCompetitors} × $0.02 = $${estimate.backlinkCost.toFixed(2)}`)
console.log(`  Total: $${estimate.totalCost.toFixed(2)}`)

if (dryRun) {
  console.log('\n--dry-run: exiting without API calls.')
  process.exit(0)
}

// Cost gate: >$1 requires approval
if (estimate.totalCost > 1.0) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise(resolve => {
    rl.question(`\nEstimated cost $${estimate.totalCost.toFixed(2)} exceeds $1. Proceed? (y/N) `, resolve)
  })
  rl.close()
  if (answer.toLowerCase() !== 'y') {
    console.log('Aborted.')
    process.exit(0)
  }
}

// ── API client ──────────────────────────────────────────────────────

const client = createClient({
  login: env.DATAFORSEO_LOGIN || env.DATAFORSEO_USERNAME,
  password: env.DATAFORSEO_PASSWORD,
})

// ── Process each site ───────────────────────────────────────────────

let allNewProspects = []

for (const slug of targetSlugs) {
  const config = siteConfigs[slug]
  const niche = config.display_name || config.niche || ''
  const homeCity = config.city || ''
  const homeState = config.state || ''
  const pages = config.pages || []
  const outreachPage = selectOutreachPage(pages)

  console.log(`\n=== ${slug} ===`)
  console.log(`  Niche: ${niche}, City: ${homeCity}, Outreach page: ${outreachPage}`)

  // Phase 1: Competitor discovery via SERP
  const searchCities = getSearchCities(homeCity, homeState)
  const queries = buildCompetitorQueries(niche, homeCity, searchCities)
  const competitorDomains = new Set()

  console.log(`  Phase 1: ${queries.length} SERP queries for competitor discovery...`)

  for (const query of queries) {
    try {
      const resp = await client.apiPost('/v3/serp/google/organic/live/regular', [{
        keyword: query,
        location_name: 'United States',
        language_name: 'English',
        depth: 20,
      }])

      const items = resp?.tasks?.[0]?.result?.[0]?.items || []
      const domains = extractCompetitorDomains(
        items.map(it => ({ url: it.url || '', domain: it.domain || '' })),
        portfolioDomains
      )
      for (const d of domains) competitorDomains.add(d)

      await sleep(200) // Rate limiting
    } catch (err) {
      console.warn(`    Warning: SERP query "${query}" failed: ${err.message}`)
    }
  }

  console.log(`  Found ${competitorDomains.size} unique competitor domains`)

  // Phase 2: Backlink extraction per competitor
  const siteProspects = []
  let competitorCount = 0

  console.log(`  Phase 2: Extracting backlinks from competitors...`)

  for (const compDomain of competitorDomains) {
    try {
      const resp = await client.apiPost('/v3/backlinks/referring_domains/live', [{
        target: compDomain,
        limit: 100,
        order_by: ['rank,desc'],
        backlinks_filters: ['dofollow', '=', true],
      }])

      const items = resp?.tasks?.[0]?.result?.[0]?.items || []
      const filtered = filterSelfServeProspects(items)

      for (const item of filtered) {
        const refDomain = item.target || ''
        if (!refDomain) continue
        if (isPortfolioLink(`https://${refDomain}`, portfolioDomains)) continue

        const type = classifyBacklinkType(refDomain)
        siteProspects.push({
          ...buildProspectRow(slug, refDomain, type, outreachPage),
          rank: item.rank || 0,
        })
      }

      competitorCount++
      await sleep(200) // Rate limiting
    } catch (err) {
      console.warn(`    Warning: Backlink query for ${compDomain} failed: ${err.message}`)
    }
  }

  // Deduplicate
  const deduped = deduplicateProspects(siteProspects)

  // Count by type
  const byType = {}
  for (const p of deduped) {
    byType[p.type] = (byType[p.type] || 0) + 1
  }

  const actualCost = estimateLinksCost(queries.length, competitorCount)

  console.log(formatLinksReport({
    slug,
    domain: siteRows[slug]?.domain || '',
    prospectCount: deduped.length,
    byType,
    cost: actualCost,
  }))

  // Strip the temporary rank field before merging
  for (const p of deduped) delete p.rank
  allNewProspects.push(...deduped)
}

// ── Merge and write ─────────────────────────────────────────────────

const merged = mergeProspects(existingLinks, allNewProspects)
const linksPath = resolve(ROOT, 'data/links.csv')
writeFileSync(linksPath, writeLinksCsv(merged) + '\n')

const added = merged.length - existingLinks.length
console.log(`\n=== Summary ===`)
console.log(`  New prospects added: ${added}`)
console.log(`  Total in links.csv: ${merged.length}`)
