#!/usr/bin/env node
/**
 * Regenerate page plans for existing site.yaml files.
 * Reads each site's metadata (brand, phone, domain, towns), loads the
 * updated pack.yaml, and rebuilds the pages array with tool + guide pages.
 *
 * Usage: node scripts/regen-page-plans.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { load as yamlLoad, dump as yamlDump } from 'js-yaml'
import { buildPagePlan, validateSiteYaml } from '../lib/keywords.js'

const ROOT = new URL('..', import.meta.url).pathname
const dryRun = process.argv.includes('--dry-run')

// --- Load packs ---
const packs = new Map()
const nichesDir = join(ROOT, 'niches')
for (const dir of readdirSync(nichesDir, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue
  const packPath = join(nichesDir, dir.name, 'pack.yaml')
  if (existsSync(packPath)) {
    packs.set(dir.name, yamlLoad(readFileSync(packPath, 'utf-8')))
  }
}

// --- Process each site ---
const sitesDir = join(ROOT, 'sites')
const siteDirs = readdirSync(sitesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort()

const results = []
const errors = []
const skipped = []

for (const dir of siteDirs) {
  const siteYamlPath = join(sitesDir, dir, 'site.yaml')
  if (!existsSync(siteYamlPath)) continue

  const existing = yamlLoad(readFileSync(siteYamlPath, 'utf-8'))
  const niche = existing.niche
  const pack = packs.get(niche)

  if (!pack) {
    errors.push(`${dir}: No pack found for niche "${niche}"`)
    continue
  }

  // Check if this site already has tool + guide pages
  const pageTypes = new Set(existing.pages.map(p => p.type))
  if (pageTypes.has('tool') && pageTypes.has('guide')) {
    skipped.push(dir)
    continue
  }

  // Rebuild page plan
  const candidate = { niche, area: existing.city, region: existing.state }
  const plan = buildPagePlan(candidate, pack, existing.towns || [])

  const updated = {
    niche: existing.niche,
    display_name: existing.display_name || pack.display_name,
    city: existing.city,
    state: existing.state,
    brand: existing.brand || plan.brand,
    phone: existing.phone || null,
    domain: existing.domain || null,
    towns: existing.towns || [],
    pages: plan.pages,
  }

  const validation = validateSiteYaml(updated, pack)
  if (!validation.valid) {
    errors.push(`${dir}: Validation failed:\n  ${validation.errors.join('\n  ')}`)
    continue
  }

  const oldCount = existing.pages.length
  const newCount = updated.pages.length
  const hasToolNow = updated.pages.some(p => p.type === 'tool')
  const guideCount = updated.pages.filter(p => p.type === 'guide').length

  results.push({ dir, updated, oldCount, newCount, hasToolNow, guideCount })
}

// --- Print summary ---
console.log('Page Plan Regeneration Summary')
console.log('═'.repeat(80))
console.log(
  'Dir'.padEnd(38) +
  'Old'.padEnd(6) +
  'New'.padEnd(6) +
  'Tool'.padEnd(7) +
  'Guides'
)
console.log('─'.repeat(80))
for (const r of results) {
  console.log(
    r.dir.padEnd(38) +
    String(r.oldCount).padEnd(6) +
    String(r.newCount).padEnd(6) +
    (r.hasToolNow ? 'yes' : 'no').padEnd(7) +
    String(r.guideCount)
  )
}
console.log('─'.repeat(80))
console.log(`Updated: ${results.length} | Skipped (already has tool+guide): ${skipped.length}`)

if (skipped.length > 0) {
  console.log(`\nSkipped: ${skipped.join(', ')}`)
}

if (errors.length > 0) {
  console.log('\nERRORS:')
  for (const e of errors) console.log(`  ✗ ${e}`)
}

if (dryRun) {
  console.log('\nDRY RUN — no files written')
  process.exit(errors.length > 0 ? 1 : 0)
}

// --- Write updated files ---
console.log('')
for (const r of results) {
  const yamlContent = yamlDump(r.updated)
  writeFileSync(join(sitesDir, r.dir, 'site.yaml'), yamlContent)
  console.log(`  ✓ sites/${r.dir}/site.yaml (${r.oldCount} → ${r.newCount} pages)`)
}

console.log(`\nDone. ${results.length} site.yaml files regenerated.`)
