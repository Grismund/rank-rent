#!/usr/bin/env node
/**
 * domains.mjs — Check domain availability and register domains for rank-rent sites.
 *
 * Usage:
 *   node scripts/domains.mjs <slug>              # one site
 *   node scripts/domains.mjs --wave 1            # Wave 1 sites
 *   node scripts/domains.mjs --all               # all sites
 *   node scripts/domains.mjs --check-only        # availability check, no purchase
 *   node scripts/domains.mjs --check-only --all  # check all sites
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createInterface } from 'node:readline'
import { load as loadYaml, dump as dumpYaml } from 'js-yaml'
import { parseEnv } from '../lib/dataforseo-client.js'
import {
  generateCandidateDomains,
  formatAvailabilityTable,
  formatApprovalPrompt,
  buildRegistrationPayload,
  parseDomainCheckResponse,
  calculateRenewalDate,
} from '../lib/domains.js'
import { readSitesCsv, writeSitesCsv, updateSiteRow } from '../lib/sites-csv.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const checkOnly = args.includes('--check-only')
const allSites = args.includes('--all')
const waveIdx = args.indexOf('--wave')
const waveNum = waveIdx !== -1 ? parseInt(args[waveIdx + 1], 10) : null
const slugArg = args.find(a => !a.startsWith('--') && (waveIdx === -1 || args.indexOf(a) !== waveIdx + 1))

if (!slugArg && !allSites && waveNum === null) {
  console.error('Usage: node scripts/domains.mjs <slug> | --wave N | --all [--check-only]')
  process.exit(1)
}

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

// ── Parse wave assignments from ASSIGNMENTS.md ──────────────────────

function parseWaveAssignments() {
  const assignPath = resolve(ROOT, 'sites', 'ASSIGNMENTS.md')
  const text = readFileSync(assignPath, 'utf-8')
  const lines = text.split('\n')
  const waveMap = new Map() // slug → wave number

  let inTable = false
  let headerSkipped = false

  for (const line of lines) {
    if (line.startsWith('## Assignments')) { inTable = true; continue }
    if (inTable && line.startsWith('## ')) break
    if (!inTable) continue
    if (line.startsWith('| Site dir')) { headerSkipped = false; continue }
    if (line.startsWith('|---')) { headerSkipped = true; continue }
    if (!headerSkipped) continue

    const cells = line.split('|').map(c => c.trim()).filter(c => c)
    if (cells.length >= 10) {
      const slug = cells[0]
      const wave = parseInt(cells[9], 10)
      waveMap.set(slug, wave)
    }
  }
  return waveMap
}

// ── Discover target sites ───────────────────────────────────────────

function getTargetSites() {
  const sitesDir = resolve(ROOT, 'sites')
  const dirs = readdirSync(sitesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(sitesDir, d.name, 'site.yaml')))
    .map(d => d.name)
    .sort()

  const waveMap = parseWaveAssignments()
  const sites = []

  for (const slug of dirs) {
    const yamlPath = resolve(sitesDir, slug, 'site.yaml')
    const config = loadYaml(readFileSync(yamlPath, 'utf-8'))

    // Filter by target
    if (slugArg && slug !== slugArg) continue
    if (waveNum !== null && waveMap.get(slug) !== waveNum) continue

    sites.push({ slug, config, yamlPath, wave: waveMap.get(slug) })
  }
  return sites
}

// ── Cloudflare domain availability check ────────────────────────────

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

  return parseDomainCheckResponse(data)
}

// ── Cloudflare domain registration ──────────────────────────────────

async function registerDomain(domain) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/registrar/domains`
  const payload = buildRegistrationPayload(domain)

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Registration failed for ${domain}: ${resp.status} ${text}`)
  }

  const data = await resp.json()
  if (!data.success) {
    throw new Error(`Registration error for ${domain}: ${data.errors?.[0]?.message || 'unknown'}`)
  }

  return data.result
}

// ── Enable auto-renew ───────────────────────────────────────────────

async function enableAutoRenew(domain) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/registrar/domains/${domain}`
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ auto_renew: true }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    console.warn(`Warning: auto-renew PATCH failed for ${domain}: ${resp.status} ${text}`)
    return false
  }

  return true
}

// ── Interactive approval ────────────────────────────────────────────

function askQuestion(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// ── Pre-flight checks ───────────────────────────────────────────────

function checkBrandSet(config, slug) {
  if (!config.brand || config.brand === 'TBD') {
    console.error(`REFUSE: ${slug} has no brand set. Run check-brands.mjs first.`)
    return false
  }
  return true
}

function checkAuditPassed(slug) {
  const sitesDir = resolve(ROOT, 'sites', slug)
  const files = readdirSync(sitesDir).filter(f => f.match(/^seo-audit-.*\.md$/))
  if (files.length === 0) {
    console.error(`REFUSE: ${slug} has no SEO audit report. Run seo-audit.mjs first.`)
    return false
  }
  // Check the latest audit file for PASS verdict
  const latest = files.sort().pop()
  const content = readFileSync(resolve(sitesDir, latest), 'utf-8')
  if (!content.includes('PASS')) {
    console.error(`REFUSE: ${slug} SEO audit did not pass. Fix issues and re-audit.`)
    return false
  }
  return true
}

function checkDomainNotSet(config, slug) {
  if (config.domain && config.domain !== 'null') {
    console.warn(`SKIP: ${slug} already has domain: ${config.domain}`)
    return false
  }
  return true
}

// ── Main ────────────────────────────────────────────────────────────

const sites = getTargetSites()
console.log(`Found ${sites.length} target site(s)\n`)

if (sites.length === 0) {
  console.log('Nothing to do.')
  process.exit(0)
}

// Pre-flight: validate all sites before any API calls
const validSites = []
for (const site of sites) {
  if (!checkBrandSet(site.config, site.slug)) continue
  if (!checkAuditPassed(site.slug)) continue
  if (!checkDomainNotSet(site.config, site.slug)) continue
  validSites.push(site)
}

if (validSites.length === 0) {
  console.log('No sites eligible for domain registration.')
  process.exit(0)
}

console.log(`\nChecking domains for ${validSites.length} site(s)...\n`)

// Generate candidate domains for each site
const siteChecks = validSites.map(site => ({
  ...site,
  candidates: generateCandidateDomains(site.config.brand, site.slug),
}))

// Batch check all candidate domains (max 20 per request)
const allCandidates = siteChecks.flatMap(s => s.candidates)
const availabilityMap = new Map()

for (let i = 0; i < allCandidates.length; i += 20) {
  const batch = allCandidates.slice(i, i + 20)
  const results = await checkDomainsBatch(batch)
  for (const r of results) {
    availabilityMap.set(r.domain, r)
  }
  if (i + 20 < allCandidates.length) await sleep(200)
}

// Print results per site
for (const site of siteChecks) {
  const results = site.candidates.map(d => availabilityMap.get(d) || {
    domain: d, available: false, price: null, reason: 'not checked',
  })

  console.log(`\n--- ${site.slug} (brand: ${site.config.brand}) ---\n`)
  console.log(formatAvailabilityTable(results))

  // Show best available
  const best = results.find(r => r.available)
  if (best) {
    console.log(`\nRecommended: ${best.domain} ($${best.price})`)
  } else {
    console.warn('\nNo available domains found among candidates.')
  }
}

if (checkOnly) {
  console.log('\n--check-only mode: no purchases made.')
  process.exit(0)
}

// ── Purchase flow ───────────────────────────────────────────────────

console.log('\n\n=== DOMAIN REGISTRATION ===\n')

// Collect available domains for approval
const availableDomains = []
for (const site of siteChecks) {
  for (const d of site.candidates) {
    const info = availabilityMap.get(d)
    if (info && info.available) {
      availableDomains.push({ ...info, slug: site.slug, brand: site.config.brand })
    }
  }
}

if (availableDomains.length === 0) {
  console.log('No available domains to register.')
  process.exit(0)
}

// Show approval prompt
const totalCost = availableDomains.reduce((sum, d) => sum + (d.price || 0), 0)
console.log(formatApprovalPrompt(
  availableDomains.map(d => ({ domain: d.domain, price: d.price })),
  totalCost,
))

// Wait for operator approval
const answer = await askQuestion('\n> ')
if (answer.toLowerCase() === 'cancel') {
  console.log('Cancelled. No purchases made.')
  process.exit(0)
}

// Parse approved domains from answer
const approvedDomains = answer.split(/[\s,]+/).filter(d => d.includes('.'))

if (approvedDomains.length === 0) {
  console.log('No valid domains in response. Cancelled.')
  process.exit(0)
}

// Verify each approved domain is in the available list
const availableSet = new Set(availableDomains.map(d => d.domain))
for (const d of approvedDomains) {
  if (!availableSet.has(d)) {
    console.error(`ERROR: "${d}" is not in the available list. Aborting.`)
    process.exit(1)
  }
}

// Register each approved domain
const today = new Date().toISOString().slice(0, 10)
const registered = []

for (const domain of approvedDomains) {
  const info = availableDomains.find(d => d.domain === domain)
  console.log(`\nRegistering ${domain}...`)

  try {
    await registerDomain(domain)
    console.log(`  Registered: ${domain}`)

    // Enable auto-renew (guardrail: always)
    const renewed = await enableAutoRenew(domain)
    if (renewed) {
      console.log(`  Auto-renew: enabled`)
    } else {
      console.warn(`  Auto-renew: FAILED — enable manually in Cloudflare dashboard!`)
    }

    registered.push({
      domain,
      slug: info.slug,
      brand: info.brand,
      price: info.price,
      renewalDate: calculateRenewalDate(today),
    })
  } catch (err) {
    console.error(`  FAILED: ${err.message}`)
  }

  await sleep(500) // Rate limit between registrations
}

if (registered.length === 0) {
  console.log('\nNo domains were successfully registered.')
  process.exit(1)
}

// ── Update site.yaml and sites.csv ──────────────────────────────────

console.log('\n\n=== UPDATING RECORDS ===\n')

// Update site.yaml: set domain field
for (const reg of registered) {
  const yamlPath = resolve(ROOT, 'sites', reg.slug, 'site.yaml')
  let yamlText = readFileSync(yamlPath, 'utf-8')
  yamlText = yamlText.replace(/^domain:\s+null$/m, `domain: ${reg.domain}`)
  writeFileSync(yamlPath, yamlText, 'utf-8')
  console.log(`  ${reg.slug}/site.yaml → domain: ${reg.domain}`)
}

// Update sites.csv
const sitesCsvPath = resolve(ROOT, 'data', 'sites.csv')
if (existsSync(sitesCsvPath)) {
  let rows = readSitesCsv(readFileSync(sitesCsvPath, 'utf-8'))
  for (const reg of registered) {
    rows = updateSiteRow(rows, reg.slug, {
      domain: reg.domain,
      registrar: 'cloudflare',
      renewal_date: reg.renewalDate,
    })
  }
  writeFileSync(sitesCsvPath, writeSitesCsv(rows), 'utf-8')
  console.log(`  data/sites.csv updated`)
}

// ── Summary ─────────────────────────────────────────────────────────

console.log('\n\n=== SUMMARY ===\n')
for (const reg of registered) {
  console.log(`  ${reg.slug} → ${reg.domain} (renews ${reg.renewalDate})`)
}
console.log(`\nTotal cost: $${registered.reduce((s, r) => s + (r.price || 0), 0).toFixed(2)}`)
console.log(`Registered: ${registered.length} domain(s)`)
