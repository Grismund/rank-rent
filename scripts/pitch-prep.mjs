#!/usr/bin/env node
/**
 * pitch-prep.mjs — Generate buyer-to-site matches and pitch materials.
 *
 * Usage:
 *   node scripts/pitch-prep.mjs                    # all sites
 *   node scripts/pitch-prep.mjs <slug>             # one site
 *   node scripts/pitch-prep.mjs --wave 1           # wave 1 sites
 *   node scripts/pitch-prep.mjs --hot-only         # only hot-priority buyers
 *   node scripts/pitch-prep.mjs --with-templates   # generate email + phone templates
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import { parseBuyersCsv } from '../lib/renters.js'
import { readSitesCsv } from '../lib/sites-csv.js'
import { parseWaveAssignments, getTargetSlugs } from '../lib/wave-assignments.js'
import {
  matchAllBuyers,
  groupMatchesBySite,
  parseNicheEconomics,
  projectRentValue,
  buildMatchRow,
  writeMatchesCsv,
  generateEmailTemplate,
  generatePhoneScript,
  formatSitePitchSummary,
  formatPitchPrepSummary,
} from '../lib/pitch-prep.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const hotOnly = args.includes('--hot-only')
const withTemplates = args.includes('--with-templates')
const allSites = args.includes('--all')
const waveIdx = args.indexOf('--wave')
const waveNum = waveIdx !== -1 ? parseInt(args[waveIdx + 1], 10) : null
const slugArg = args.find(a =>
  !a.startsWith('--') &&
  (waveIdx === -1 || args.indexOf(a) !== waveIdx + 1)
)

// Default to all if no specific target
const targetAll = !slugArg && waveNum === null

// ── Load data ───────────────────────────────────────────────────────

const buyersCsv = readFileSync(resolve(ROOT, 'data/buyers.csv'), 'utf8')
const buyers = parseBuyersCsv(buyersCsv)
console.log(`Loaded ${buyers.length} buyers from buyers.csv`)

const sitesCsv = readFileSync(resolve(ROOT, 'data/sites.csv'), 'utf8')
const allSiteRows = readSitesCsv(sitesCsv)
console.log(`Loaded ${allSiteRows.length} sites from sites.csv`)

const econMd = readFileSync(resolve(ROOT, 'reference/niche-economics.md'), 'utf8')
const economics = parseNicheEconomics(econMd)
console.log(`Parsed economics for ${economics.size} niches`)

// ── Filter target sites ─────────────────────────────────────────────

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
  console.error('No target sites found. Provide a slug, --wave N, or run with no args for all.')
  process.exit(1)
}

console.log(`\nTargeting ${targetSlugs.length} site(s): ${targetSlugs.join(', ')}`)

// ── Load site configs ───────────────────────────────────────────────

const targetSiteRows = allSiteRows.filter(r => targetSlugs.includes(r.slug))
const siteConfigs = {}

for (const slug of targetSlugs) {
  const yamlPath = resolve(ROOT, `sites/${slug}/site.yaml`)
  if (existsSync(yamlPath)) {
    siteConfigs[slug] = loadYaml(readFileSync(yamlPath, 'utf8'))
  } else {
    console.warn(`  ⚠ No site.yaml found for ${slug}`)
    siteConfigs[slug] = {}
  }
}

// ── Match buyers to sites ───────────────────────────────────────────

let matches = matchAllBuyers(buyers, targetSiteRows, siteConfigs)

if (hotOnly) {
  const before = matches.length
  matches = matches.filter(m => m.buyer.pitch_priority === 'hot')
  console.log(`Filtered to hot-only: ${before} → ${matches.length} matches`)
}

const grouped = groupMatchesBySite(matches)

// ── Write matches.csv ───────────────────────────────────────────────

const matchRows = matches.map(m => buildMatchRow(m, siteConfigs[m.site.slug] || {}))
const matchesCsvPath = resolve(ROOT, 'data/matches.csv')
writeFileSync(matchesCsvPath, writeMatchesCsv(matchRows) + '\n')
console.log(`\nWrote ${matchRows.length} rows to data/matches.csv`)

// ── Print per-site summaries ────────────────────────────────────────

console.log('')
for (const site of targetSiteRows) {
  const siteMatches = grouped.get(site.slug) || []
  console.log(formatSitePitchSummary({
    site,
    matches: siteMatches,
    economics,
    siteConfig: siteConfigs[site.slug] || {},
  }))
}

// ── Generate templates if requested ─────────────────────────────────

if (withTemplates) {
  console.log('\n=== Pitch Templates ===\n')
  for (const m of matches) {
    if (m.buyer.pitch_priority === 'hot' || m.buyer.pitch_priority === 'warm') {
      const config = siteConfigs[m.site.slug] || {}
      const email = generateEmailTemplate(m.buyer, config, economics)
      const phone = generatePhoneScript(m.buyer, config, economics)

      console.log(`--- ${m.buyer.business_name} (${m.buyer.pitch_priority}) → ${m.site.slug} ---`)
      console.log(`\nEMAIL SUBJECT: ${email.subject}`)
      console.log(`\n${email.body}`)
      console.log(`\nPHONE SCRIPT:\n${phone}`)
      console.log('')
    }
  }
}

// ── Overall summary ─────────────────────────────────────────────────

console.log(formatPitchPrepSummary({
  allMatches: matches,
  siteCount: targetSiteRows.length,
}))
