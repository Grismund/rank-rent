#!/usr/bin/env node
/**
 * site-build.mjs — Scaffold content directories for Gate-1 sites.
 *
 * Usage:
 *   node scripts/site-build.mjs <slug>            # one site
 *   node scripts/site-build.mjs --all              # all 18
 *   node scripts/site-build.mjs --dry-run [slug]   # preview without writing
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import {
  buildPageFrontmatter,
  generateScaffoldMarkdown,
  updateBrandInSiteYaml,
  pageSlugToFilename,
} from '../lib/site-build.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const all = args.includes('--all')
const slugArg = args.find(a => !a.startsWith('--'))

if (!all && !slugArg) {
  console.error('Usage: node scripts/site-build.mjs [--dry-run] <slug>')
  console.error('       node scripts/site-build.mjs [--dry-run] --all')
  process.exit(1)
}

// ── Discover site directories ───────────────────────────────────────

import { readdirSync } from 'node:fs'

function getSiteDirs() {
  const sitesDir = resolve(ROOT, 'sites')
  return readdirSync(sitesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(sitesDir, d.name, 'site.yaml')))
    .map(d => d.name)
}

const targetSlugs = all ? getSiteDirs() : [slugArg]

// ── Pack cache ──────────────────────────────────────────────────────

const packCache = new Map()

function loadPack(niche) {
  if (packCache.has(niche)) return packCache.get(niche)
  const packPath = resolve(ROOT, 'niches', niche, 'pack.yaml')
  if (!existsSync(packPath)) {
    throw new Error(`Pack not found: ${packPath}`)
  }
  const pack = loadYaml(readFileSync(packPath, 'utf-8'))
  packCache.set(niche, pack)
  return pack
}

// ── Outline key mapping ─────────────────────────────────────────────

function getOutlineKey(pageType) {
  if (pageType === 'tool') return 'tool_page'
  return pageType
}

// ── Template vars ───────────────────────────────────────────────────

function buildVarsForPage(page, siteConfig, pack) {
  const vars = {
    display_name: pack.display_name,
    city: siteConfig.city,
    state: siteConfig.state,
    brand: siteConfig.brand,
  }

  // Service pages: find the sub_service display name
  if (page.type === 'service') {
    const slugTrimmed = page.slug.replace(/^\/|\/$/g, '')
    const sub = (pack.sub_services || []).find(s => s.slug === slugTrimmed)
    if (sub) vars.sub_service = sub.display
  }

  // Town pages: override city with the specific town
  if (page.type === 'town') {
    const townSlug = page.slug.replace(/^\/areas\//, '').replace(/\/$/, '')
    const town = (siteConfig.towns || []).find(t =>
      t.toLowerCase().replace(/\s+/g, '-') === townSlug
    )
    if (town) vars.city = town
  }

  // Guide pages: extract topic from h1 ("Topic — City, State")
  if (page.type === 'guide') {
    const dashIdx = page.h1.indexOf(' — ')
    if (dashIdx > -1) vars.topic = page.h1.slice(0, dashIdx)
  }

  // Tool pages: extract tool_name from h1 ("Tool Name — City, State")
  if (page.type === 'tool') {
    const dashIdx = page.h1.indexOf(' — ')
    if (dashIdx > -1) vars.tool_name = page.h1.slice(0, dashIdx)
  }

  return vars
}

// ── Main ────────────────────────────────────────────────────────────

let totalCreated = 0
let totalSkipped = 0
let totalBrandUpdated = 0
let sitesSkippedTBD = 0

for (const slug of targetSlugs) {
  const siteDir = resolve(ROOT, 'sites', slug)
  const yamlPath = resolve(siteDir, 'site.yaml')

  if (!existsSync(yamlPath)) {
    console.warn(`⚠ ${slug}: site.yaml not found, skipping`)
    continue
  }

  const yamlText = readFileSync(yamlPath, 'utf-8')
  const siteConfig = loadYaml(yamlText)

  // Validate brand ≠ TBD
  if (!siteConfig.brand || siteConfig.brand === 'TBD') {
    console.warn(`⚠ ${slug}: brand is TBD — assign a brand first, skipping`)
    sitesSkippedTBD++
    continue
  }

  const pack = loadPack(siteConfig.niche)
  const contentDir = resolve(siteDir, 'content')

  let siteCreated = 0
  let siteSkipped = 0

  for (const page of siteConfig.pages) {
    const outlineKey = getOutlineKey(page.type)
    const outline = pack.page_outlines?.[outlineKey]

    if (!outline) {
      console.warn(`  ⚠ ${slug}: no pack outline for type "${page.type}" (key: ${outlineKey}), skipping page ${page.slug}`)
      continue
    }

    const vars = buildVarsForPage(page, siteConfig, pack)
    const frontmatter = buildPageFrontmatter(page, outline, slug, siteConfig.brand, vars)
    const markdown = generateScaffoldMarkdown(frontmatter)
    const filename = pageSlugToFilename(page.slug)
    const filePath = resolve(contentDir, `${filename}.md`)

    if (existsSync(filePath)) {
      siteSkipped++
      if (dryRun) console.log(`  SKIP ${filename}.md (exists)`)
      continue
    }

    if (dryRun) {
      console.log(`  CREATE ${filename}.md`)
    } else {
      mkdirSync(contentDir, { recursive: true })
      writeFileSync(filePath, markdown, 'utf-8')
    }
    siteCreated++
  }

  // Update brand in site.yaml titles if any still say "| TBD"
  if (yamlText.includes('| TBD')) {
    const updated = updateBrandInSiteYaml(yamlText, siteConfig.brand)
    if (updated !== yamlText) {
      if (dryRun) {
        console.log(`  UPDATE site.yaml titles: | TBD → | ${siteConfig.brand}`)
      } else {
        writeFileSync(yamlPath, updated, 'utf-8')
      }
      totalBrandUpdated++
    }
  }

  console.log(`${dryRun ? '[DRY RUN] ' : ''}${slug}: ${siteCreated} created, ${siteSkipped} skipped`)
  totalCreated += siteCreated
  totalSkipped += siteSkipped
}

console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Done: ${totalCreated} files created, ${totalSkipped} skipped, ${totalBrandUpdated} site.yaml updated${sitesSkippedTBD ? `, ${sitesSkippedTBD} sites skipped (brand TBD)` : ''}`)
