#!/usr/bin/env node
/**
 * Generate site.yaml files for all facts_gathered candidates.
 * Pure computation — no API calls, $0 cost.
 *
 * Usage: node scripts/generate-keywords.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { load as yamlLoad, dump as yamlDump } from 'js-yaml'
import { buildPagePlan, validateSiteYaml, extractStateFromRegion, slugify } from '../lib/keywords.js'
import { parseCandidatesCsv, serializeCandidatesCsv } from '../lib/candidates.js'

const ROOT = new URL('..', import.meta.url).pathname
const dryRun = process.argv.includes('--dry-run')

// --- Load candidates ---
const csvText = readFileSync(join(ROOT, 'data/candidates.csv'), 'utf-8')
const allRows = parseCandidatesCsv(csvText)
const candidates = allRows.filter(r => r.status === 'facts_gathered')

console.log(`Found ${candidates.length} candidates with status=facts_gathered\n`)

// --- Load packs ---
const packs = new Map()
for (const c of candidates) {
  const nicheSlug = slugify(c.niche)
  if (!packs.has(nicheSlug)) {
    const packPath = join(ROOT, 'niches', nicheSlug, 'pack.yaml')
    packs.set(nicheSlug, yamlLoad(readFileSync(packPath, 'utf-8')))
  }
}

// --- Load nearby towns from local facts ---
const townCache = new Map()

function loadNearbyTowns(city) {
  const slug = slugify(city)
  if (townCache.has(slug)) return townCache.get(slug)

  // Try with and without period in slug (e.g., port-st.-lucie vs port-st-lucie)
  let factsPath = join(ROOT, 'research/areas', `${slug}.md`)
  if (!existsSync(factsPath)) {
    // Try with periods preserved (e.g., "Port St. Lucie" -> "port-st.-lucie")
    const altSlug = city.toLowerCase().replace(/\s+/g, '-')
    factsPath = join(ROOT, 'research/areas', `${altSlug}.md`)
  }

  const content = readFileSync(factsPath, 'utf-8')
  const nearbyMatch = content.match(/### Nearby Cities\n([\s\S]*?)(?=\n##|\n$|$)/)
  if (!nearbyMatch) {
    console.error(`WARNING: No nearby cities section found for ${city}`)
    townCache.set(slug, [])
    return []
  }

  const lines = nearbyMatch[1].trim().split('\n')
  const towns = []
  for (const line of lines) {
    const match = line.match(/^-\s+(.+?)(?:\s*\((.+?)\))?$/)
    if (!match) continue
    const name = match[1].trim()
    const detail = match[2] || ''

    // Skip cities 30+ miles away
    const distMatch = detail.match(/(\d+)\s*miles/)
    if (distMatch && parseInt(distMatch[1]) >= 30) continue

    towns.push(name)
  }

  townCache.set(slug, towns)
  return towns
}

// --- Generate site.yaml for each candidate ---
const results = []
const errors = []

for (const c of candidates) {
  const nicheSlug = slugify(c.niche)
  const pack = packs.get(nicheSlug)
  const state = extractStateFromRegion(c.region)
  const city = c.area

  let towns
  try {
    const allTowns = loadNearbyTowns(city)
    towns = allTowns.slice(0, 4)
  } catch (e) {
    errors.push(`${c.slug}: Failed to load nearby towns for ${city}: ${e.message}`)
    continue
  }

  if (towns.length === 0) {
    errors.push(`${c.slug}: No nearby towns found for ${city}`)
    continue
  }

  const plan = buildPagePlan({ niche: nicheSlug, area: city, region: c.region }, pack, towns)
  const siteYaml = {
    niche: nicheSlug,
    display_name: pack.display_name,
    city,
    state,
    brand: plan.brand,
    phone: null,
    domain: null,
    towns,
    pages: plan.pages,
  }

  const validation = validateSiteYaml(siteYaml, pack)
  if (!validation.valid) {
    errors.push(`${c.slug}: Validation failed:\n  ${validation.errors.join('\n  ')}`)
    continue
  }

  const siteDir = `${nicheSlug}-${slugify(city)}`
  results.push({ candidate: c, siteYaml, siteDir, pageCount: plan.pages.length, towns })
}

// --- Print summary table ---
console.log('Site Generation Summary')
console.log('═'.repeat(90))
console.log(
  'Dir'.padEnd(35) +
  'Niche'.padEnd(20) +
  'City'.padEnd(18) +
  'Pages'.padEnd(7) +
  'Svcs'.padEnd(6) +
  'Towns'
)
console.log('─'.repeat(90))
for (const r of results) {
  const svcs = r.siteYaml.pages.filter(p => p.type === 'service').length
  const twns = r.siteYaml.pages.filter(p => p.type === 'town').length
  console.log(
    r.siteDir.padEnd(35) +
    r.siteYaml.niche.padEnd(20) +
    r.siteYaml.city.padEnd(18) +
    String(r.pageCount).padEnd(7) +
    String(svcs).padEnd(6) +
    String(twns)
  )
}
console.log('─'.repeat(90))
console.log(`Total: ${results.length} sites\n`)

if (errors.length > 0) {
  console.log('ERRORS:')
  for (const e of errors) console.log(`  ✗ ${e}`)
  console.log()
}

if (dryRun) {
  console.log('DRY RUN — no files written')
  process.exit(errors.length > 0 ? 1 : 0)
}

// --- Write site.yaml files ---
for (const r of results) {
  const dir = join(ROOT, 'sites', r.siteDir)
  mkdirSync(dir, { recursive: true })

  const yamlContent = yamlDump(r.siteYaml)
  writeFileSync(join(dir, 'site.yaml'), yamlContent)
  console.log(`  ✓ sites/${r.siteDir}/site.yaml`)
}

// --- Update candidates.csv ---
const updatedRows = allRows.map(row => {
  const match = results.find(r => r.candidate.slug === row.slug)
  if (match) return { ...row, status: 'keywords_mapped' }
  return row
})
writeFileSync(join(ROOT, 'data/candidates.csv'), serializeCandidatesCsv(updatedRows))
console.log(`\n  ✓ data/candidates.csv updated (${results.length} rows → keywords_mapped)`)
