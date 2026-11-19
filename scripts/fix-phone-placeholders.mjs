#!/usr/bin/env node
/**
 * fix-phone-placeholders.mjs — Insert [PHONE] into town pages missing it.
 *
 * Scans all areas-*.md files and inserts "Call [PHONE] or" before the
 * "Request a free estimate/quote" line in the final CTA section.
 *
 * Usage:
 *   node scripts/fix-phone-placeholders.mjs --dry-run    # preview, no writes
 *   node scripts/fix-phone-placeholders.mjs --write       # fix all sites
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { insertPhonePlaceholder } from '../lib/phone-placeholder.js'

const ROOT = resolve(import.meta.dirname, '..')
const SITES_DIR = resolve(ROOT, 'sites')

function discoverSites() {
  return readdirSync(SITES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(SITES_DIR, d.name, 'site.yaml')))
    .map(d => d.name)
    .sort()
}

function discoverTownPages(site) {
  const contentDir = resolve(SITES_DIR, site, 'content')
  if (!existsSync(contentDir)) return []
  return readdirSync(contentDir)
    .filter(f => f.startsWith('areas-') && f.endsWith('.md'))
    .map(f => resolve(contentDir, f))
}

const mode = process.argv[2]
if (!mode || (mode !== '--dry-run' && mode !== '--write')) {
  console.error('Usage: node scripts/fix-phone-placeholders.mjs --dry-run|--write')
  process.exit(1)
}

const write = mode === '--write'
const sites = discoverSites()
let totalScanned = 0
let totalFixed = 0
let totalAlreadyOk = 0
let totalSkipped = 0

for (const site of sites) {
  const pages = discoverTownPages(site)
  for (const pagePath of pages) {
    totalScanned++
    const raw = readFileSync(pagePath, 'utf8')

    // Split frontmatter from body
    const fmMatch = raw.match(/^(---\n[\s\S]*?\n---\n?)/)
    if (!fmMatch) {
      totalSkipped++
      continue
    }

    const frontmatter = fmMatch[1]
    const body = raw.slice(frontmatter.length)

    if (body.includes('[PHONE]')) {
      totalAlreadyOk++
      continue
    }

    const { modified, inserted } = insertPhonePlaceholder(body)

    if (!inserted) {
      totalSkipped++
      const rel = pagePath.replace(ROOT + '/', '')
      console.log(`  SKIP  ${rel} — no insertion point found`)
      continue
    }

    totalFixed++
    const rel = pagePath.replace(ROOT + '/', '')

    if (write) {
      writeFileSync(pagePath, frontmatter + modified, 'utf8')
      console.log(`  FIXED ${rel}`)
    } else {
      console.log(`  WOULD FIX ${rel}`)
    }
  }
}

console.log(`\n${totalScanned} town pages scanned`)
console.log(`${totalAlreadyOk} already have [PHONE]`)
console.log(`${totalFixed} ${write ? 'fixed' : 'would be fixed'}`)
console.log(`${totalSkipped} skipped (no insertion point)`)
