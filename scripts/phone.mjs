#!/usr/bin/env node
/**
 * phone.mjs — Search and provision Twilio tracking numbers for rank-rent sites.
 *
 * Usage:
 *   node scripts/phone.mjs <slug>              # one site
 *   node scripts/phone.mjs --wave 1            # Wave 1 sites
 *   node scripts/phone.mjs --all               # all sites
 *   node scripts/phone.mjs --check-only        # search numbers, no purchase
 *   node scripts/phone.mjs --check-only --all  # search all sites
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createInterface } from 'node:readline'
import { load as loadYaml } from 'js-yaml'
import { parseEnv } from '../lib/dataforseo-client.js'
import {
  formatPhoneNumber,
  formatE164,
  buildSearchParams,
  formatNumberTable,
  formatPhoneApprovalPrompt,
  buildVoicemailTwiml,
} from '../lib/phone.js'
import { readSitesCsv, writeSitesCsv, updateSiteRow } from '../lib/sites-csv.js'
import { parseWaveAssignments as _parseWaveAssignments, getTargetSlugs } from '../lib/wave-assignments.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const TWILIO_NUMBER_COST = 1.15 // $/month per local number

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const checkOnly = args.includes('--check-only')
const allSites = args.includes('--all')
const waveIdx = args.indexOf('--wave')
const waveNum = waveIdx !== -1 ? parseInt(args[waveIdx + 1], 10) : null
const slugArg = args.find(a => !a.startsWith('--') && (waveIdx === -1 || args.indexOf(a) !== waveIdx + 1))

if (!slugArg && !allSites && waveNum === null) {
  console.error('Usage: node scripts/phone.mjs <slug> | --wave N | --all [--check-only]')
  process.exit(1)
}

// ── Load env ────────────────────────────────────────────────────────

const envPath = resolve(process.env.HOME, '.config/rank-rent/.env')
const envContent = readFileSync(envPath, 'utf-8')
const env = parseEnv(envContent)

const TWILIO_SID = env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = env.TWILIO_AUTH_TOKEN

if (!TWILIO_SID || !TWILIO_TOKEN) {
  console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in .env')
  process.exit(1)
}

const twilioAuth = 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')

// ── Discover target sites ───────────────────────────────────────────

function getTargetSites() {
  const sitesDir = resolve(ROOT, 'sites')
  const assignText = readFileSync(resolve(ROOT, 'sites', 'ASSIGNMENTS.md'), 'utf-8')
  const waveMap = _parseWaveAssignments(assignText)

  const allSlugs = readdirSync(sitesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(sitesDir, d.name, 'site.yaml')))
    .map(d => d.name)
    .sort()

  const targetSlugs = getTargetSlugs({ slugArg, waveNum, allSlugs, waveMap })

  return targetSlugs.map(slug => {
    const yamlPath = resolve(sitesDir, slug, 'site.yaml')
    const config = loadYaml(readFileSync(yamlPath, 'utf-8'))
    return { slug, config, yamlPath, wave: waveMap.get(slug) }
  })
}

// ── Twilio API ──────────────────────────────────────────────────────

async function searchAvailableNumbers(city, state) {
  const params = buildSearchParams(city, state)
  const qs = new URLSearchParams(params).toString()
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/US/Local.json?${qs}`

  const resp = await fetch(url, {
    headers: { Authorization: twilioAuth },
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Twilio search ${resp.status}: ${text}`)
  }

  const data = await resp.json()
  return (data.available_phone_numbers || []).map(n => ({
    phoneNumber: n.phone_number,
    friendlyName: n.friendly_name,
    locality: n.locality || city,
    region: n.region || params.InRegion,
  }))
}

async function purchaseNumber(phoneNumber, brandName) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json`

  const body = new URLSearchParams({
    PhoneNumber: phoneNumber,
    FriendlyName: brandName,
  })

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: twilioAuth,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Twilio purchase ${resp.status}: ${text}`)
  }

  return resp.json()
}

async function configureVoicemail(numberSid, twiml) {
  // Create a TwiML bin
  const binUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers/${numberSid}.json`

  // Set VoiceUrl to a TwiML Bin — for now, store a simple voicemail response
  // Phase 5 (rr-route) will replace this with a Cloudflare Worker
  const body = new URLSearchParams({
    VoiceUrl: `https://handler.twilio.com/twiml/${numberSid}`,
    VoiceMethod: 'GET',
  })

  // Note: TwiML Bins require Twilio Console or API; for now we set
  // a placeholder VoiceUrl. The operator should create the TwiML Bin
  // manually or Phase 5 rr-route will configure the Worker endpoint.
  console.log(`  Note: Configure voicemail TwiML Bin manually or via rr-route (Phase 5)`)
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

function checkPhoneNotSet(config, slug) {
  if (config.phone && config.phone !== 'null') {
    console.warn(`SKIP: ${slug} already has phone: ${config.phone}`)
    return false
  }
  return true
}

function checkBrandSet(config, slug) {
  if (!config.brand || config.brand === 'TBD') {
    console.error(`REFUSE: ${slug} has no brand set.`)
    return false
  }
  return true
}

function checkAuditPassed(slug) {
  const sitesDir = resolve(ROOT, 'sites', slug)
  const files = readdirSync(sitesDir).filter(f => f.match(/^seo-audit-.*\.md$/))
  if (files.length === 0) {
    console.error(`REFUSE: ${slug} has no SEO audit report.`)
    return false
  }
  const latest = files.sort().pop()
  const content = readFileSync(resolve(sitesDir, latest), 'utf-8')
  if (!content.includes('PASS')) {
    console.error(`REFUSE: ${slug} SEO audit did not pass.`)
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

// Pre-flight
const validSites = []
for (const site of sites) {
  if (!checkBrandSet(site.config, site.slug)) continue
  if (!checkAuditPassed(site.slug)) continue
  if (!checkPhoneNotSet(site.config, site.slug)) continue
  validSites.push(site)
}

if (validSites.length === 0) {
  console.log('No sites eligible for phone provisioning.')
  process.exit(0)
}

console.log(`\nSearching numbers for ${validSites.length} site(s)...\n`)

// Search available numbers for each site
const siteNumbers = []

for (const site of validSites) {
  console.log(`--- ${site.slug} (${site.config.city}, ${site.config.state}) ---`)

  try {
    const numbers = await searchAvailableNumbers(site.config.city, site.config.state)

    if (numbers.length === 0) {
      console.warn(`  No local numbers found for ${site.config.city}, ${site.config.state}`)
      // Try region-only fallback
      console.log(`  Trying state-wide search...`)
      const params = buildSearchParams(site.config.city, site.config.state)
      delete params.InLocality
      const qs = new URLSearchParams(params).toString()
      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/US/Local.json?${qs}`
      const resp = await fetch(url, { headers: { Authorization: twilioAuth } })
      if (resp.ok) {
        const data = await resp.json()
        const fallback = (data.available_phone_numbers || []).map(n => ({
          phoneNumber: n.phone_number,
          friendlyName: n.friendly_name,
          locality: n.locality || site.config.city,
          region: n.region || buildSearchParams(site.config.city, site.config.state).InRegion,
        }))
        if (fallback.length > 0) {
          console.log(`  Found ${fallback.length} state-wide number(s)`)
          siteNumbers.push({ ...site, numbers: fallback })
        } else {
          console.warn(`  No numbers available in state either. Skip.`)
        }
      }
    } else {
      console.log(`  Found ${numbers.length} local number(s)`)
      siteNumbers.push({ ...site, numbers })
    }
  } catch (err) {
    console.error(`  ERROR: ${err.message}`)
  }

  await sleep(200)
}

// Print number tables
for (const site of siteNumbers) {
  console.log(`\n--- ${site.slug} ---\n`)
  console.log(formatNumberTable(site.numbers))

  // Recommend first number
  if (site.numbers.length > 0) {
    const rec = site.numbers[0]
    console.log(`\nRecommended: ${formatPhoneNumber(rec.phoneNumber)} (${rec.locality}, ${rec.region})`)
  }
}

if (checkOnly) {
  console.log('\n--check-only mode: no purchases made.')
  process.exit(0)
}

// ── Purchase flow ───────────────────────────────────────────────────

console.log('\n\n=== PHONE PROVISIONING ===\n')

// Collect recommended numbers (first per site)
const recommended = siteNumbers.map(s => ({
  slug: s.slug,
  brand: s.config.brand,
  phoneNumber: s.numbers[0].phoneNumber,
  friendlyName: formatPhoneNumber(s.numbers[0].phoneNumber),
}))

const totalMonthlyCost = recommended.length * TWILIO_NUMBER_COST

console.log(formatPhoneApprovalPrompt(
  recommended.map(r => ({ phoneNumber: r.phoneNumber, friendlyName: r.friendlyName })),
  totalMonthlyCost,
))

// Wait for operator approval
const answer = await askQuestion('\n> ')
if (answer.toLowerCase() === 'cancel') {
  console.log('Cancelled. No purchases made.')
  process.exit(0)
}

// Parse approved numbers from answer (expect display format or E.164)
const approvedRaw = answer.split(/,\s*/).map(s => s.trim()).filter(s => s)
const approvedE164 = approvedRaw.map(n => formatE164(n))

const recommendedSet = new Set(recommended.map(r => r.phoneNumber))
for (const n of approvedE164) {
  if (!recommendedSet.has(n)) {
    console.error(`ERROR: "${n}" is not in the recommended list. Aborting.`)
    process.exit(1)
  }
}

// Provision each approved number
const provisioned = []

for (const e164 of approvedE164) {
  const info = recommended.find(r => r.phoneNumber === e164)
  console.log(`\nProvisioning ${formatPhoneNumber(e164)} for ${info.brand}...`)

  try {
    const result = await purchaseNumber(e164, info.brand)
    console.log(`  Provisioned: ${formatPhoneNumber(e164)} (SID: ${result.sid})`)

    // Generate voicemail TwiML for reference
    const twiml = buildVoicemailTwiml(info.brand)
    console.log(`  Voicemail TwiML generated (configure via TwiML Bin or rr-route)`)

    provisioned.push({
      slug: info.slug,
      brand: info.brand,
      phoneNumber: e164,
      displayNumber: formatPhoneNumber(e164),
      sid: result.sid,
      twiml,
    })
  } catch (err) {
    console.error(`  FAILED: ${err.message}`)
  }

  await sleep(500)
}

if (provisioned.length === 0) {
  console.log('\nNo numbers were successfully provisioned.')
  process.exit(1)
}

// ── Update site.yaml and sites.csv ──────────────────────────────────

console.log('\n\n=== UPDATING RECORDS ===\n')

// Update site.yaml: set phone field
for (const p of provisioned) {
  const yamlPath = resolve(ROOT, 'sites', p.slug, 'site.yaml')
  let yamlText = readFileSync(yamlPath, 'utf-8')
  yamlText = yamlText.replace(/^phone:\s+null$/m, `phone: "${p.phoneNumber}"`)
  writeFileSync(yamlPath, yamlText, 'utf-8')
  console.log(`  ${p.slug}/site.yaml → phone: ${p.phoneNumber}`)
}

// Update sites.csv
const sitesCsvPath = resolve(ROOT, 'data', 'sites.csv')
if (existsSync(sitesCsvPath)) {
  let rows = readSitesCsv(readFileSync(sitesCsvPath, 'utf-8'))
  for (const p of provisioned) {
    rows = updateSiteRow(rows, p.slug, {
      tracking_number: p.phoneNumber,
      tracking_number_sid: p.sid,
    })
  }
  writeFileSync(sitesCsvPath, writeSitesCsv(rows), 'utf-8')
  console.log(`  data/sites.csv updated`)
}

// ── Summary ─────────────────────────────────────────────────────────

console.log('\n\n=== SUMMARY ===\n')
for (const p of provisioned) {
  console.log(`  ${p.slug} → ${p.displayNumber}`)
}
console.log(`\nMonthly cost: $${(provisioned.length * TWILIO_NUMBER_COST).toFixed(2)}/month`)
console.log(`Provisioned: ${provisioned.length} number(s)`)
console.log('\nNote: Configure voicemail TwiML Bins manually or wait for rr-route (Phase 5).')
