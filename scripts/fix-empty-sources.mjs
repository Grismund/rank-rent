#!/usr/bin/env node
/**
 * fix-empty-sources.mjs — Populate empty sources[] on cost_guide, tool, and guide pages.
 *
 * Reads niche job values from reference/niche-economics.md and price ranges
 * from each page's body to generate 2-3 source strings.
 *
 * Usage:
 *   node scripts/fix-empty-sources.mjs --dry-run    # preview, no writes
 *   node scripts/fix-empty-sources.mjs --write       # fix all sites
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { load as loadYaml, dump as dumpYaml } from 'js-yaml'
import { generateSources } from '../lib/source-populator.js'

const ROOT = resolve(import.meta.dirname, '..')
const SITES_DIR = resolve(ROOT, 'sites')
const REQUIRED_TYPES = new Set(['cost_guide', 'tool', 'guide'])

// ── Parse niche economics ──────────────────────────────────────────

function parseNicheEconomics() {
  const text = readFileSync(resolve(ROOT, 'reference/niche-economics.md'), 'utf8')
  const map = new Map()
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*(\$[\d,]+[–-]\$[\d,]+)\s*\|/)
    if (m && m[1] !== 'Niche') {
      const niche = m[1].trim().replace(/\s+/g, '-')
      map.set(niche, m[2].trim())
    }
  }
  return map
}

// ── Site/page discovery ────────────────────────────────────────────

function discoverSites() {
  return readdirSync(SITES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(SITES_DIR, d.name, 'site.yaml')))
    .map(d => d.name)
    .sort()
}

function getNiche(siteName) {
  // Extract niche from directory: "epoxy-flooring-san-antonio" → "epoxy-flooring"
  // Try loading site.yaml first
  const yamlPath = resolve(SITES_DIR, siteName, 'site.yaml')
  try {
    const yaml = loadYaml(readFileSync(yamlPath, 'utf8'))
    if (yaml.niche) return yaml.niche
  } catch { /* fall through */ }

  // Fallback: strip the last word (city) from the dir name
  // This is unreliable so we prefer site.yaml
  return siteName
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return null
  return loadYaml(match[1]) || null
}

function replaceFrontmatterSources(text, sources) {
  // Replace `sources: []` or `sources:\n  - ...` block in frontmatter
  const fmMatch = text.match(/^(---\n)([\s\S]*?)(\n---)/)
  if (!fmMatch) return text

  let fm = fmMatch[2]

  // Replace sources line(s)
  // Handle both `sources: []` and multiline sources blocks
  if (fm.includes('sources: []')) {
    const sourcesYaml = sources.map(s => `  - ${JSON.stringify(s)}`).join('\n')
    fm = fm.replace('sources: []', `sources:\n${sourcesYaml}`)
  } else {
    // Multiline replacement — find the sources block
    fm = fm.replace(
      /sources:\n(?:  - .*\n?)*/,
      `sources:\n${sources.map(s => `  - ${JSON.stringify(s)}`).join('\n')}\n`
    )
  }

  return `${fmMatch[1]}${fm}${fmMatch[3]}${text.slice(fmMatch[0].length)}`
}

// ── Main ───────────────────────────────────────────────────────────

const mode = process.argv[2]
if (!mode || (mode !== '--dry-run' && mode !== '--write')) {
  console.error('Usage: node scripts/fix-empty-sources.mjs --dry-run|--write')
  process.exit(1)
}

const write = mode === '--write'
const economics = parseNicheEconomics()
const sites = discoverSites()

let totalScanned = 0
let totalFixed = 0
let totalSkipped = 0

for (const site of sites) {
  const niche = getNiche(site)
  const jobValue = economics.get(niche)

  const contentDir = resolve(SITES_DIR, site, 'content')
  if (!existsSync(contentDir)) continue

  const files = readdirSync(contentDir).filter(f => f.endsWith('.md'))

  for (const file of files) {
    const filePath = resolve(contentDir, file)
    const raw = readFileSync(filePath, 'utf8')
    const fm = parseFrontmatter(raw)
    if (!fm) continue

    if (!REQUIRED_TYPES.has(fm.type)) continue
    totalScanned++

    if (fm.sources && fm.sources.length > 0) {
      totalSkipped++
      continue
    }

    if (!jobValue) {
      const rel = filePath.replace(ROOT + '/', '')
      console.log(`  SKIP  ${rel} — no job value found for niche "${niche}"`)
      totalSkipped++
      continue
    }

    const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '')
    const sources = generateSources({
      body,
      pageType: fm.type,
      nicheJobValue: jobValue,
    })

    totalFixed++
    const rel = filePath.replace(ROOT + '/', '')

    if (write) {
      const updated = replaceFrontmatterSources(raw, sources)
      writeFileSync(filePath, updated, 'utf8')
      console.log(`  FIXED ${rel} (${sources.length} sources)`)
    } else {
      console.log(`  WOULD FIX ${rel}`)
      for (const s of sources) console.log(`    → ${s}`)
    }
  }
}

console.log(`\n${totalScanned} cost_guide/tool/guide pages scanned`)
console.log(`${totalFixed} ${write ? 'fixed' : 'would be fixed'}`)
console.log(`${totalSkipped} already populated or skipped`)
