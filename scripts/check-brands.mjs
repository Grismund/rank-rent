#!/usr/bin/env node
/**
 * check-brands.mjs — Check domain availability for proposed brands and assign them.
 *
 * Usage:
 *   node scripts/check-brands.mjs              # check all TBD sites, print table
 *   node scripts/check-brands.mjs --apply       # check + write brands to site.yaml
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import { parseEnv } from '../lib/dataforseo-client.js'
import { brandToDomains } from '../lib/brand-check.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const apply = args.includes('--apply')

// ── Load env ────────────────────────────────────────────────────────

const envPath = resolve(process.env.HOME, '.config/rank-rent/.env')
const envContent = readFileSync(envPath, 'utf-8')
const env = parseEnv(envContent)

const CF_TOKEN = env.CLOUDFLARE_API_TOKEN
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID

if (!CF_TOKEN || !CF_ACCOUNT) {
  console.error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID in .env')
  process.exit(1)
}

// ── Discover TBD sites ──────────────────────────────────────────────

function getTBDSites() {
  const sitesDir = resolve(ROOT, 'sites')
  const dirs = readdirSync(sitesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(sitesDir, d.name, 'site.yaml')))
    .map(d => d.name)

  const tbdSites = []
  for (const slug of dirs) {
    const yamlPath = resolve(sitesDir, slug, 'site.yaml')
    const config = loadYaml(readFileSync(yamlPath, 'utf-8'))
    if (!config.brand || config.brand === 'TBD') {
      tbdSites.push({ slug, config, yamlPath })
    }
  }
  return tbdSites
}

// ── Parse ASSIGNMENTS.md proposed brands ────────────────────────────

function parseProposedBrands() {
  const assignPath = resolve(ROOT, 'sites', 'ASSIGNMENTS.md')
  const text = readFileSync(assignPath, 'utf-8')

  // Find the "## Proposed brands" section table
  const lines = text.split('\n')
  const brandMap = new Map() // slug → [brand1, brand2, brand3]

  let inBrandTable = false
  let headerSkipped = false

  for (const line of lines) {
    if (line.startsWith('## Proposed brands')) {
      inBrandTable = true
      continue
    }
    if (inBrandTable && line.startsWith('## ')) {
      break // next section
    }
    if (!inBrandTable) continue

    // Skip table header row and separator
    if (line.startsWith('| Site dir')) { headerSkipped = false; continue }
    if (line.startsWith('|---')) { headerSkipped = true; continue }
    if (!headerSkipped) continue

    // Parse table row: | slug | brand1 | brand2 | brand3 |
    const cells = line.split('|').map(c => c.trim()).filter(c => c)
    if (cells.length >= 4) {
      brandMap.set(cells[0], [cells[1], cells[2], cells[3]])
    }
  }

  return brandMap
}

// ── Cloudflare domain availability check ────────────────────────────
// Uses POST /registrar/domain-check (batch up to 20 domains per request)

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function checkDomainsBatch(domains) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/registrar/domain-check`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ domains }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Cloudflare API ${resp.status}: ${text}`)
  }

  const data = await resp.json()
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${data.errors?.[0]?.message || 'unknown'}`)
  }

  // Map results by domain name
  const resultMap = new Map()
  for (const d of data.result?.domains || []) {
    resultMap.set(d.name, {
      available: d.registrable === true,
      price: d.pricing?.registration_cost ?? null,
      reason: d.reason || null,
    })
  }
  return resultMap
}

// ── Main ────────────────────────────────────────────────────────────

const tbdSites = getTBDSites()
console.log(`Found ${tbdSites.length} sites with brand: TBD\n`)

if (tbdSites.length === 0) {
  console.log('Nothing to do.')
  process.exit(0)
}

const brandMap = parseProposedBrands()

// Build the list of all candidate domains across all sites/brands
const siteEntries = [] // { slug, brands: [{ brand, domains: string[] }] }
const allDomains = []

for (const { slug } of tbdSites) {
  const proposed = brandMap.get(slug)
  if (!proposed) {
    console.warn(`⚠ ${slug}: no proposed brands in ASSIGNMENTS.md, skipping`)
    continue
  }

  const brands = proposed.map(brand => {
    const domains = brandToDomains(brand)
    allDomains.push(...domains)
    return { brand, domains }
  })
  siteEntries.push({ slug, brands })
}

// Batch check all domains (max 20 per request)
console.log(`Checking ${allDomains.length} candidate domains...\n`)
const availabilityMap = new Map()

for (let i = 0; i < allDomains.length; i += 20) {
  const batch = allDomains.slice(i, i + 20)
  const batchResults = await checkDomainsBatch(batch)
  for (const [k, v] of batchResults) availabilityMap.set(k, v)
  if (i + 20 < allDomains.length) await sleep(200)
}

// Assemble results
const results = siteEntries.map(({ slug, brands }) => ({
  slug,
  brandResults: brands.map(({ brand, domains }) => ({
    brand,
    checks: domains.map(domain => ({
      domain,
      ...(availabilityMap.get(domain) || { available: false, price: null, reason: 'not checked' }),
    })),
  })),
}))

// ── Print results table ─────────────────────────────────────────────

console.log('| Site | Brand | Domain | Available | Price |')
console.log('|------|-------|--------|-----------|-------|')

const recommendations = new Map() // slug → brand

for (const { slug, brandResults } of results) {
  let recommended = null

  for (const { brand, checks } of brandResults) {
    for (const { domain, available, price, reason } of checks) {
      const avail = available ? 'YES' : reason ? `no (${reason})` : 'no'
      const priceStr = price != null ? `$${price}` : '-'
      console.log(`| ${slug} | ${brand} | ${domain} | ${avail} | ${priceStr} |`)

      if (!recommended && available) {
        recommended = brand
      }
    }
  }

  if (recommended) {
    recommendations.set(slug, recommended)
  } else {
    console.warn(`⚠ ${slug}: no available .com domain found among proposed brands`)
    // Fall back to first proposed brand anyway
    recommendations.set(slug, brandResults[0]?.brand || 'TBD')
  }
}

// ── Print recommendations ───────────────────────────────────────────

console.log('\n--- Recommendations ---\n')
for (const [slug, brand] of recommendations) {
  console.log(`  ${slug} → ${brand}`)
}

// ── Apply if requested ──────────────────────────────────────────────

if (apply) {
  console.log('\nApplying brands...\n')

  for (const { slug, yamlPath } of tbdSites) {
    const brand = recommendations.get(slug)
    if (!brand || brand === 'TBD') {
      console.warn(`  ⚠ ${slug}: no recommendation, skipping`)
      continue
    }

    let yamlText = readFileSync(yamlPath, 'utf-8')

    // Replace brand: TBD with the recommended brand
    yamlText = yamlText.replace(/^brand:\s+TBD$/m, `brand: ${brand}`)

    // Replace "| TBD" in title lines with "| Brand"
    yamlText = yamlText.replace(/(title:\s+.+?)\| TBD/g, `$1| ${brand}`)

    writeFileSync(yamlPath, yamlText, 'utf-8')
    console.log(`  ${slug} → ${brand}`)
  }

  console.log('\nDone. Run `grep "brand:" sites/*/site.yaml` to verify.')
} else {
  console.log(`\nRun with --apply to write brands to site.yaml files.`)
}
