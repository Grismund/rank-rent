#!/usr/bin/env node
/**
 * route.mjs — Manage call routing for rank-rent tracking numbers.
 *
 * Usage:
 *   node scripts/route.mjs status                          # show all routes
 *   node scripts/route.mjs status <slug>                   # show one route
 *   node scripts/route.mjs set <slug> voicemail            # switch to voicemail
 *   node scripts/route.mjs set <slug> trial --forward +1XXXXXXXXXX --client "Name"
 *   node scripts/route.mjs set <slug> paid  --forward +1XXXXXXXXXX --client "Name"
 *   node scripts/route.mjs deploy                          # deploy/update Worker
 *   node scripts/route.mjs init                            # create KV namespace + seed configs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { createInterface } from 'node:readline'
import { load as loadYaml } from 'js-yaml'
import { execSync } from 'node:child_process'
import { parseEnv } from '../lib/dataforseo-client.js'
import { readSitesCsv, writeSitesCsv, updateSiteRow } from '../lib/sites-csv.js'
import { formatE164 } from '../lib/phone.js'
import {
  buildRouteConfig,
  validateRouteConfig,
  buildVoiceUrlUpdate,
  formatRouteStatus,
  formatModeTransition,
  buildWelcomeEmail,
} from '../lib/call-router.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const WORKER_DIR = resolve(ROOT, 'workers', 'call-router')

// ── Load env ────────────────────────────────────────────────────────

const envPath = resolve(process.env.HOME, '.config/rank-rent/.env')
const envContent = readFileSync(envPath, 'utf-8')
const env = parseEnv(envContent)

const CF_TOKEN = env.CLOUDFLARE_API_TOKEN
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID
const TWILIO_SID = env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = env.TWILIO_AUTH_TOKEN
const RESEND_API_KEY = env.RESEND_API_KEY
const OPERATOR_EMAIL = env.OPERATOR_EMAIL || ''

const twilioAuth = TWILIO_SID && TWILIO_TOKEN
  ? 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
  : null

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const command = args[0]

if (!command) {
  console.error('Usage: node scripts/route.mjs <status|set|deploy|init> [args...]')
  process.exit(1)
}

// ── Helpers ─────────────────────────────────────────────────────────

function loadSitesCsv() {
  const path = resolve(ROOT, 'data', 'sites.csv')
  if (!existsSync(path)) return []
  return readSitesCsv(readFileSync(path, 'utf-8'))
}

function saveSitesCsv(rows) {
  const path = resolve(ROOT, 'data', 'sites.csv')
  writeFileSync(path, writeSitesCsv(rows) + '\n', 'utf-8')
}

function askQuestion(prompt) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(prompt, answer => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

async function kvPut(key, value) {
  // Uses wrangler KV to put a value. Requires KV namespace ID in wrangler.toml.
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${await getKvNamespaceId()}/values/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${CF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: value,
    }
  )
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`KV PUT failed: ${resp.status} ${text}`)
  }
}

async function kvGet(key) {
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${await getKvNamespaceId()}/values/${encodeURIComponent(key)}`,
    {
      headers: { Authorization: `Bearer ${CF_TOKEN}` },
    }
  )
  if (resp.status === 404) return null
  if (!resp.ok) throw new Error(`KV GET failed: ${resp.status}`)
  return resp.text()
}

async function kvList() {
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${await getKvNamespaceId()}/keys`,
    {
      headers: { Authorization: `Bearer ${CF_TOKEN}` },
    }
  )
  if (!resp.ok) throw new Error(`KV LIST failed: ${resp.status}`)
  const data = await resp.json()
  return (data.result || []).map(k => k.name)
}

let _kvNamespaceId = null
async function getKvNamespaceId() {
  if (_kvNamespaceId) return _kvNamespaceId
  // Read from wrangler.toml
  const tomlPath = resolve(WORKER_DIR, 'wrangler.toml')
  const toml = readFileSync(tomlPath, 'utf-8')
  const match = toml.match(/id\s*=\s*"([^"]+)"/)
  if (match && match[1]) {
    _kvNamespaceId = match[1]
    return _kvNamespaceId
  }
  throw new Error('KV namespace ID not set in wrangler.toml. Run `node scripts/route.mjs init` first.')
}

async function updateTwilioVoiceUrl(numberSid, voiceUrl) {
  if (!twilioAuth) throw new Error('Twilio credentials not configured')
  const params = buildVoiceUrlUpdate(voiceUrl)
  const body = new URLSearchParams(params)

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers/${numberSid}.json`,
    {
      method: 'POST',
      headers: {
        Authorization: twilioAuth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  )
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Twilio update failed: ${resp.status} ${text}`)
  }
  return resp.json()
}

async function sendWelcomeEmail(email, emailData) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured')
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${emailData.brandName} <leads@${emailData.siteDomain}>`,
      to: email,
      subject: emailData.subject,
      html: emailData.html,
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Resend failed: ${resp.status} ${text}`)
  }
  return resp.json()
}

// ── Commands ────────────────────────────────────────────────────────

if (command === 'status') {
  const slugFilter = args[1]
  const rows = loadSitesCsv()
  const deployed = rows.filter(r => r.status === 'deployed' && r.tracking_number)

  if (deployed.length === 0) {
    console.log('No deployed sites with tracking numbers found.')
    process.exit(0)
  }

  if (slugFilter) {
    const row = deployed.find(r => r.slug === slugFilter)
    if (!row) {
      console.error(`Site "${slugFilter}" not found or not deployed.`)
      process.exit(1)
    }
    // Try to fetch KV config
    try {
      const configJson = await kvGet(row.tracking_number)
      if (configJson) {
        const config = JSON.parse(configJson)
        console.log(`\n${row.slug} (${row.domain}):`)
        console.log(`  Phone: ${row.tracking_number}`)
        console.log(`  Mode:  ${config.mode}`)
        console.log(`  Brand: ${config.brand}`)
        if (config.forwardTo) console.log(`  Forward: ${config.forwardTo}`)
        if (config.clientName) console.log(`  Client: ${config.clientName}`)
      } else {
        console.log(`\n${row.slug}: no route configured (KV empty)`)
      }
    } catch {
      console.log(`\n${row.slug}: ${row.tracking_number} (KV not accessible — run init first)`)
    }
  } else {
    // Show all as table
    const routes = []
    for (const row of deployed) {
      try {
        const configJson = await kvGet(row.tracking_number)
        if (configJson) {
          routes.push(JSON.parse(configJson))
        } else {
          routes.push({ slug: row.slug, mode: 'unconfigured', brand: '—', forwardTo: '' })
        }
      } catch {
        routes.push({ slug: row.slug, mode: 'unknown', brand: '—', forwardTo: '' })
      }
    }
    console.log('\n' + formatRouteStatus(routes))
  }

} else if (command === 'set') {
  const slug = args[1]
  const mode = args[2]
  const forwardIdx = args.indexOf('--forward')
  const forwardTo = forwardIdx !== -1 ? formatE164(args[forwardIdx + 1]) : ''
  const clientIdx = args.indexOf('--client')
  const clientName = clientIdx !== -1 ? args[clientIdx + 1] : ''

  if (!slug || !mode) {
    console.error('Usage: node scripts/route.mjs set <slug> <voicemail|trial|paid> [--forward +1...] [--client "Name"]')
    process.exit(1)
  }

  const rows = loadSitesCsv()
  const row = rows.find(r => r.slug === slug)
  if (!row) {
    console.error(`Site "${slug}" not found in sites.csv.`)
    process.exit(1)
  }
  if (!row.tracking_number) {
    console.error(`Site "${slug}" has no tracking number.`)
    process.exit(1)
  }
  if (!row.tracking_number_sid) {
    console.error(`Site "${slug}" has no tracking_number_sid. Re-run rr-phone to populate.`)
    process.exit(1)
  }

  // Load site.yaml for brand
  const yamlPath = resolve(ROOT, 'sites', slug, 'site.yaml')
  const config = loadYaml(readFileSync(yamlPath, 'utf-8'))

  const routeConfig = buildRouteConfig({
    slug,
    mode,
    brand: config.brand,
    forwardTo,
    clientName,
    operatorEmail: OPERATOR_EMAIL,
  })

  const validation = validateRouteConfig(routeConfig)
  if (!validation.valid) {
    console.error('Invalid route config:')
    for (const e of validation.errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  // Show transition
  let currentMode = 'unconfigured'
  try {
    const existing = await kvGet(row.tracking_number)
    if (existing) currentMode = JSON.parse(existing).mode
  } catch { /* KV may not be accessible */ }

  console.log(`\n${formatModeTransition(currentMode, mode, { forwardTo, clientName })}`)
  const answer = await askQuestion('\nConfirm? (yes/no): ')
  if (answer.toLowerCase() !== 'yes') {
    console.log('Cancelled.')
    process.exit(0)
  }

  // Update KV
  console.log('\nUpdating KV...')
  await kvPut(row.tracking_number, JSON.stringify(routeConfig))
  console.log('  KV: updated')

  // Update Twilio VoiceUrl
  console.log('Updating Twilio VoiceUrl...')
  const workerUrl = `https://call-router.${CF_ACCOUNT}.workers.dev`
  await updateTwilioVoiceUrl(row.tracking_number_sid, workerUrl)
  console.log('  Twilio: updated')

  // Update sites.csv
  let updatedRows = rows
  if (forwardTo) {
    updatedRows = updateSiteRow(updatedRows, slug, { forwarding_target: forwardTo })
  }
  if (clientName) {
    updatedRows = updateSiteRow(updatedRows, slug, { client: clientName })
  }
  saveSitesCsv(updatedRows)
  console.log('  sites.csv: updated')

  // Send welcome email for trial mode
  if (mode === 'trial' && clientName && RESEND_API_KEY) {
    const email = buildWelcomeEmail({
      brandName: config.brand,
      clientName,
      siteDomain: config.domain,
      niche: config.niche,
      city: config.city,
    })
    // Note: We don't have the client's email from CLI args.
    // The operator should provide it or handle email separately.
    console.log('\n  Welcome email template generated. Send manually to client.')
    console.log(`  Subject: ${email.subject}`)
  }

  console.log('\nDone.')

} else if (command === 'deploy') {
  console.log('Deploying call-router Worker...')
  try {
    const output = execSync('npx wrangler deploy', {
      cwd: WORKER_DIR,
      encoding: 'utf-8',
      env: { ...process.env, CLOUDFLARE_API_TOKEN: CF_TOKEN, CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT },
    })
    console.log(output)
    console.log('Worker deployed.')
  } catch (err) {
    console.error(`Deploy failed: ${err.message}`)
    process.exit(1)
  }

} else if (command === 'init') {
  console.log('Initializing call-router KV namespace...\n')

  // Create KV namespace
  try {
    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'call-router-ROUTES' }),
      }
    )
    const data = await resp.json()
    if (data.success) {
      const nsId = data.result.id
      console.log(`  Created KV namespace: ${nsId}`)

      // Update wrangler.toml with the namespace ID
      const tomlPath = resolve(WORKER_DIR, 'wrangler.toml')
      let toml = readFileSync(tomlPath, 'utf-8')
      toml = toml.replace(/^id\s*=\s*".*"/m, `id = "${nsId}"`)
      writeFileSync(tomlPath, toml, 'utf-8')
      console.log('  Updated wrangler.toml with namespace ID')
      _kvNamespaceId = nsId
    } else {
      const msg = data.errors?.[0]?.message || 'unknown'
      if (msg.includes('already exists')) {
        console.log('  KV namespace already exists')
      } else {
        throw new Error(msg)
      }
    }
  } catch (err) {
    console.error(`  KV namespace creation failed: ${err.message}`)
    process.exit(1)
  }

  // Seed default configs for all deployed sites with tracking numbers
  const rows = loadSitesCsv()
  const deployed = rows.filter(r => r.status === 'deployed' && r.tracking_number)

  if (deployed.length === 0) {
    console.log('\n  No deployed sites with tracking numbers to seed.')
  } else {
    console.log(`\n  Seeding ${deployed.length} route configs...`)
    for (const row of deployed) {
      const yamlPath = resolve(ROOT, 'sites', row.slug, 'site.yaml')
      if (!existsSync(yamlPath)) continue
      const config = loadYaml(readFileSync(yamlPath, 'utf-8'))
      const routeConfig = buildRouteConfig({
        slug: row.slug,
        mode: 'voicemail',
        brand: config.brand || row.slug,
        operatorEmail: OPERATOR_EMAIL,
      })
      await kvPut(row.tracking_number, JSON.stringify(routeConfig))
      console.log(`    ${row.slug} → voicemail`)
    }
  }

  console.log('\nInit complete.')

} else {
  console.error(`Unknown command: ${command}`)
  console.error('Commands: status, set, deploy, init')
  process.exit(1)
}
