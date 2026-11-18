#!/usr/bin/env node
/**
 * fix-meta-descriptions.mjs — Rewrite all meta_description frontmatter fields.
 *
 * Generates SEO-grade descriptions (120-160 chars) from page content
 * instead of the short intent strings copied from site.yaml.
 *
 * Usage:
 *   node scripts/fix-meta-descriptions.mjs --dry-run           # preview, no writes
 *   node scripts/fix-meta-descriptions.mjs --write             # rewrite all sites
 *   node scripts/fix-meta-descriptions.mjs --write <slug>      # rewrite one site
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import { validateMetaDescriptionLength } from '../lib/content-validator.js'
import {
  extractPriceRange,
  extractFirstSentence,
  extractTownSnippet,
  extractFaqTopics,
  extractServiceList,
  buildMetaDescription,
  rewriteFrontmatter,
} from '../lib/meta-description.js'

const ROOT = resolve(import.meta.dirname, '..')

// ── Site discovery ───────────────────────────────────────────────────

function discoverSites() {
  const sitesDir = resolve(ROOT, 'sites')
  return readdirSync(sitesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(sitesDir, d.name, 'site.yaml')))
    .map(d => d.name)
    .sort()
}

// ── Frontmatter parsing ─────────────────────────────────────────────

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  return loadYaml(match[1]) || {}
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n?/, '')
}

// ── Extract H2 list from body ────────────────────────────────────────

function extractH2List(body) {
  const h2Re = /^## (.+)$/gm
  const headings = []
  let match
  while ((match = h2Re.exec(body)) !== null) {
    headings.push(match[1].trim().toLowerCase())
  }
  // Filter out generic CTA headings
  const filtered = headings.filter(h => !/get a (free )?quote|get started|contact/i.test(h))
  return filtered.slice(0, 3).join(', ')
}

// ── Process a single page ────────────────────────────────────────────

function processPage(filePath, siteYaml) {
  const raw = readFileSync(filePath, 'utf8')
  const fm = parseFrontmatter(raw)
  const body = stripFrontmatter(raw)

  const type = fm.type
  const keyword = fm.primary_keyword || ''
  const city = siteYaml.city || ''
  const state = siteYaml.state || ''
  const oldDesc = fm.meta_description || ''

  // Build extraction params based on page type
  const params = { type, keyword, city, state }

  switch (type) {
    case 'home':
      params.serviceList = extractServiceList(siteYaml)
      break
    case 'service':
      params.firstSentence = extractFirstSentence(body)
      break
    case 'town':
      params.townSnippet = extractTownSnippet(fm.town_facts)
      break
    case 'cost_guide':
      params.priceRange = extractPriceRange(body)
      break
    case 'faq':
      params.faqTopics = fm.faqs && fm.faqs.length > 0 ? extractFaqTopics(fm.faqs) : null
      break
    case 'tool':
      params.firstSentence = extractFirstSentence(body)
      break
    case 'guide':
      params.h2List = extractH2List(body)
      break
  }

  const newDesc = buildMetaDescription(params)

  return { filePath, type, keyword, oldDesc, newDesc, raw }
}

// ── Main ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const writeMode = args.includes('--write')
const dryRun = args.includes('--dry-run')
const siteFilter = args.find(a => !a.startsWith('--'))

if (!writeMode && !dryRun) {
  console.log('Usage:')
  console.log('  node scripts/fix-meta-descriptions.mjs --dry-run           # preview')
  console.log('  node scripts/fix-meta-descriptions.mjs --write             # apply to all')
  console.log('  node scripts/fix-meta-descriptions.mjs --write <slug>      # apply to one site')
  process.exit(0)
}

const slugs = siteFilter ? [siteFilter] : discoverSites()
let totalPages = 0
let totalUpdated = 0
let totalFailed = 0
const lengthBuckets = { short: 0, ok: 0, long: 0 }
const failures = []

for (const slug of slugs) {
  const siteDir = resolve(ROOT, 'sites', slug)
  const yamlPath = resolve(siteDir, 'site.yaml')
  const contentDir = resolve(siteDir, 'content')

  if (!existsSync(yamlPath) || !existsSync(contentDir)) {
    console.log(`  SKIP ${slug} — missing site.yaml or content/`)
    continue
  }

  const siteYaml = loadYaml(readFileSync(yamlPath, 'utf8'))
  const mdFiles = readdirSync(contentDir).filter(f => f.endsWith('.md')).sort()

  console.log(`\n── ${slug} (${mdFiles.length} pages) ──`)

  for (const file of mdFiles) {
    const filePath = resolve(contentDir, file)
    const result = processPage(filePath, siteYaml)
    totalPages++

    // Validate new description
    const validation = validateMetaDescriptionLength(result.newDesc)
    if (!validation.valid) {
      totalFailed++
      failures.push({ file: `${slug}/${file}`, error: validation.error, desc: result.newDesc })
      console.log(`  FAIL ${file} — ${validation.error}`)
      console.log(`       "${result.newDesc}"`)
      if (result.newDesc.length < 120) lengthBuckets.short++
      else lengthBuckets.long++
      continue
    }

    lengthBuckets.ok++

    const oldLen = result.oldDesc.length
    const newLen = result.newDesc.length
    console.log(`  ${file.padEnd(50)} ${oldLen}→${newLen}  ${dryRun ? '(preview)' : 'OK'}`)

    if (writeMode) {
      const updated = rewriteFrontmatter(result.raw, result.newDesc)
      writeFileSync(filePath, updated, 'utf8')
      totalUpdated++
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────

console.log('\n═══ Summary ═══')
console.log(`Sites:   ${slugs.length}`)
console.log(`Pages:   ${totalPages}`)
console.log(`Updated: ${writeMode ? totalUpdated : '0 (dry run)'}`)
console.log(`Failed:  ${totalFailed}`)
console.log(`Lengths: ${lengthBuckets.short} short, ${lengthBuckets.ok} ok (120-160), ${lengthBuckets.long} long`)

if (failures.length > 0) {
  console.log('\n── Failures ──')
  for (const f of failures) {
    console.log(`  ${f.file}: ${f.error}`)
    console.log(`    "${f.desc}"`)
  }
  process.exit(1)
}
