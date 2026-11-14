#!/usr/bin/env node
/**
 * Town-page readiness checker.
 * Reads each site's town list, checks area facts sheets against
 * content-rules.md steps 5–8, and generates a readiness report.
 *
 * Usage: node scripts/town-page-readiness.mjs
 * Exit 1 if any site has < 3 ready towns.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { load as yamlLoad } from 'js-yaml'
import { checkTownReadiness, summarizeReadiness } from '../lib/town-readiness.js'

const ROOT = new URL('..', import.meta.url).pathname
const today = new Date().toISOString().slice(0, 10)

// --- Load all site.yaml files ---
const sitesDir = join(ROOT, 'sites')
const siteDirs = readdirSync(sitesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort()

const siteResults = []
let anyBelowThreshold = false

for (const dir of siteDirs) {
  const siteYamlPath = join(sitesDir, dir, 'site.yaml')
  if (!existsSync(siteYamlPath)) continue

  const site = yamlLoad(readFileSync(siteYamlPath, 'utf-8'))
  const niche = site.niche
  const hubCity = site.city
  const towns = site.towns || []

  const townResults = []

  for (const town of towns) {
    const slug = town.toLowerCase().replace(/[.?!,'"]/g, '').replace(/\s+/g, '-')
    const factsPath = join(ROOT, 'research/areas', `${slug}.md`)

    let markdown = null
    if (existsSync(factsPath)) {
      markdown = readFileSync(factsPath, 'utf-8')
    } else {
      // Try alternate slug with periods preserved
      const altSlug = town.toLowerCase().replace(/\s+/g, '-')
      const altPath = join(ROOT, 'research/areas', `${altSlug}.md`)
      if (existsSync(altPath)) {
        markdown = readFileSync(altPath, 'utf-8')
      }
    }

    const result = checkTownReadiness(markdown, niche, hubCity)
    townResults.push({ town, ...result })
  }

  const summary = summarizeReadiness(townResults)
  if (summary.readyCount < 3) anyBelowThreshold = true

  siteResults.push({
    dir,
    niche,
    hubCity,
    towns: townResults,
    summary,
  })
}

// --- Generate report ---
const lines = [
  `# Town-Page Readiness Report`,
  '',
  `**Generated:** ${today}`,
  `**Sites checked:** ${siteResults.length}`,
  '',
  '## Summary',
  '',
  '| Site | Niche | Hub | Ready | Total | Status |',
  '|------|-------|-----|-------|-------|--------|',
]

for (const s of siteResults) {
  const status = s.summary.readyCount >= 3 ? 'PASS' : 'FAIL'
  lines.push(`| ${s.dir} | ${s.niche} | ${s.hubCity} | ${s.summary.readyCount} | ${s.summary.total} | ${status} |`)
}

lines.push('', '## Details', '')

for (const s of siteResults) {
  lines.push(`### ${s.dir}`, '')
  lines.push(`**Niche:** ${s.niche} | **Hub:** ${s.hubCity}`, '')

  for (const t of s.towns) {
    const icon = t.ready ? '  READY' : '  NEEDS WORK'
    lines.push(`- **${t.town}**:${icon}`)
    if (!t.ready) {
      for (const m of t.missing) {
        lines.push(`  - ${m}`)
      }
    }
  }
  lines.push('')
}

const report = lines.join('\n')

// --- Write report ---
const reportPath = join(ROOT, 'research', `town-readiness-${today}.md`)
writeFileSync(reportPath, report)
console.log(`Report written to research/town-readiness-${today}.md`)

// --- Console summary ---
console.log('')
for (const s of siteResults) {
  const status = s.summary.readyCount >= 3 ? 'PASS' : 'FAIL'
  console.log(`  ${status === 'PASS' ? '✓' : '✗'} ${s.dir}: ${s.summary.readyCount}/${s.summary.total} ready`)
}

if (anyBelowThreshold) {
  console.log('\nFAIL: One or more sites have < 3 ready towns.')
  process.exit(1)
} else {
  console.log('\nAll sites have >= 3 ready towns.')
  process.exit(0)
}
