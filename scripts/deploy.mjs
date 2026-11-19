#!/usr/bin/env node
/**
 * deploy.mjs — Build and deploy rank-rent sites to Cloudflare Pages.
 *
 * Usage:
 *   node scripts/deploy.mjs <slug>              # deploy one site
 *   node scripts/deploy.mjs --wave 1            # deploy Wave 1
 *   node scripts/deploy.mjs --all               # deploy all eligible
 *   node scripts/deploy.mjs --dry-run <slug>    # build + validate only
 *   node scripts/deploy.mjs --skip-phone <slug> # deploy before phone provisioned
 *   node scripts/deploy.mjs --force <slug>      # override wave order
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { execSync } from 'node:child_process'
import { load as loadYaml } from 'js-yaml'
import { parseEnv } from '../lib/dataforseo-client.js'
import { readSitesCsv, writeSitesCsv, updateSiteRow } from '../lib/sites-csv.js'
import { parseWaveAssignments, getTargetSlugs } from '../lib/wave-assignments.js'
import {
  slugToProjectName,
  buildPagesEnvVars,
  checkDeployReadiness,
  checkLaunchCadence,
  checkWaveOrder,
  formatDeploySummary,
  parseWranglerDeployUrl,
} from '../lib/deploy.js'
import { generateIndexNowKey } from '../lib/indexing.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const skipPhone = args.includes('--skip-phone')
const force = args.includes('--force')
const allSites = args.includes('--all')
const waveIdx = args.indexOf('--wave')
const waveNum = waveIdx !== -1 ? parseInt(args[waveIdx + 1], 10) : null
const slugArg = args.find(a =>
  !a.startsWith('--') &&
  (waveIdx === -1 || args.indexOf(a) !== waveIdx + 1)
)

if (!slugArg && !allSites && waveNum === null) {
  console.error('Usage: node scripts/deploy.mjs <slug> | --wave N | --all [--dry-run] [--skip-phone] [--force]')
  process.exit(1)
}

// ── Load env ────────────────────────────────────────────────────────

const envPath = resolve(process.env.HOME, '.config/rank-rent/.env')
const envContent = readFileSync(envPath, 'utf-8')
const env = parseEnv(envContent)

const CF_TOKEN = env.CLOUDFLARE_API_TOKEN
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID
const RESEND_KEY = env.RESEND_API_KEY

if (!CF_TOKEN || !CF_ACCOUNT) {
  console.error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID in .env')
  process.exit(1)
}

if (!RESEND_KEY) {
  console.error('Missing RESEND_API_KEY in .env')
  process.exit(1)
}

// ── Discover target sites ───────────────────────────────────────────

const sitesDir = resolve(ROOT, 'sites')
const assignText = readFileSync(resolve(sitesDir, 'ASSIGNMENTS.md'), 'utf-8')
const waveMap = parseWaveAssignments(assignText)

const allSlugs = readdirSync(sitesDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(resolve(sitesDir, d.name, 'site.yaml')))
  .map(d => d.name)
  .sort()

const targetSlugs = getTargetSlugs({ slugArg, waveNum, allSlugs, waveMap })

const sites = targetSlugs.map(slug => {
  const yamlPath = resolve(sitesDir, slug, 'site.yaml')
  const config = loadYaml(readFileSync(yamlPath, 'utf-8'))
  return { slug, config, yamlPath, wave: waveMap.get(slug) }
})

console.log(`Found ${sites.length} target site(s)\n`)

if (sites.length === 0) {
  console.log('Nothing to do.')
  process.exit(0)
}

// ── Load sites.csv ──────────────────────────────────────────────────

const sitesCsvPath = resolve(ROOT, 'data', 'sites.csv')
let sitesCsvRows = existsSync(sitesCsvPath)
  ? readSitesCsv(readFileSync(sitesCsvPath, 'utf-8'))
  : []

// ── Pre-flight checks ──────────────────────────────────────────────

function hasPassingAudit(slug) {
  const dir = resolve(sitesDir, slug)
  const files = readdirSync(dir).filter(f => f.match(/^seo-audit-.*\.md$/))
  if (files.length === 0) return false
  const latest = files.sort().pop()
  const content = readFileSync(resolve(dir, latest), 'utf-8')
  return content.includes('PASS')
}

const today = new Date().toISOString().slice(0, 10)
const deployedRows = sitesCsvRows.filter(r => r.launch_date)

const eligible = []
for (const site of sites) {
  // Already deployed?
  const csvRow = sitesCsvRows.find(r => r.slug === site.slug)
  if (csvRow && csvRow.status === 'deployed') {
    console.log(`SKIP: ${site.slug} already deployed`)
    continue
  }

  // Readiness
  const readiness = checkDeployReadiness(site.config, site.slug, hasPassingAudit(site.slug), { skipPhone })
  if (!readiness.ready) {
    console.error(`REFUSE: ${site.slug} — ${readiness.reasons.join(', ')}`)
    continue
  }

  // Cadence
  const cadence = checkLaunchCadence(deployedRows, site.config.niche, today)
  if (!cadence.allowed && !force) {
    console.warn(`BLOCKED: ${site.slug} — ${cadence.reason} (use --force to override)`)
    continue
  } else if (!cadence.allowed && force) {
    console.warn(`WARNING: ${site.slug} — ${cadence.reason} (overridden with --force)`)
  }

  // Wave order
  const waveCheck = checkWaveOrder(site.wave, waveMap, sitesCsvRows)
  if (!waveCheck.allowed && !force) {
    console.warn(`BLOCKED: ${site.slug} — ${waveCheck.reason} (use --force to override)`)
    continue
  } else if (!waveCheck.allowed && force) {
    console.warn(`WARNING: ${site.slug} — ${waveCheck.reason} (overridden with --force)`)
  }

  eligible.push(site)
}

if (eligible.length === 0) {
  console.log('\nNo sites eligible for deployment.')
  process.exit(0)
}

console.log(`\n${eligible.length} site(s) eligible for deployment:\n`)
for (const s of eligible) {
  console.log(`  Wave ${s.wave}: ${s.slug} (${s.config.domain})`)
}

// ── Deploy each site ────────────────────────────────────────────────

const results = []

for (const site of eligible) {
  const { slug, config } = site
  const projectName = slugToProjectName(slug)
  const domain = config.domain

  console.log(`\n=== Deploying ${slug} ===\n`)

  // 1. Build
  console.log('Building site...')
  try {
    execSync(`node scripts/build-site.mjs ${slug}`, {
      cwd: ROOT,
      stdio: 'pipe',
      env: { ...process.env, SITE: slug },
    })
    console.log('  Build: OK')
  } catch (err) {
    console.error(`  Build FAILED: ${err.stderr?.toString() || err.message}`)
    results.push({ slug, domain, success: false, error: 'build failed' })
    continue
  }

  // 2. Generate IndexNow key file
  const distDir = resolve(ROOT, 'template', 'dist', slug)
  const indexNowKey = generateIndexNowKey(slug)
  const keyFilePath = resolve(distDir, `${indexNowKey}.txt`)
  writeFileSync(keyFilePath, indexNowKey, 'utf-8')
  console.log(`  IndexNow key: ${indexNowKey.slice(0, 8)}...`)

  if (dryRun) {
    console.log('  --dry-run: skipping deploy')
    results.push({ slug, domain, url: '(dry run)', success: true })
    continue
  }

  // 3. Create Pages project (idempotent with --force)
  console.log('Creating Pages project...')
  try {
    execSync(
      `npx wrangler pages project create ${projectName} --production-branch main --force`,
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: CF_TOKEN, CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT } }
    )
    console.log('  Project: created (or already exists)')
  } catch (err) {
    // Project might already exist — not fatal
    const msg = err.stderr?.toString() || ''
    if (msg.includes('already exists') || msg.includes('A project with this name already exists')) {
      console.log('  Project: already exists')
    } else {
      console.warn(`  Project create warning: ${msg.slice(0, 200)}`)
    }
  }

  // 4. Set env vars via Cloudflare API
  console.log('Setting env vars...')
  const envVars = buildPagesEnvVars({
    resendApiKey: RESEND_KEY,
    siteBrand: config.brand,
    leadEmail: env.LEAD_EMAIL || `leads@${domain}`,
  })

  const envVarsPayload = {}
  for (const [k, v] of Object.entries(envVars)) {
    envVarsPayload[k] = { value: v, type: 'secret_text' }
  }

  try {
    const patchResp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/pages/projects/${projectName}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${CF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deployment_configs: {
            production: { env_vars: envVarsPayload },
          },
        }),
      }
    )
    if (!patchResp.ok) {
      const text = await patchResp.text()
      console.warn(`  Env vars warning: ${patchResp.status} ${text.slice(0, 200)}`)
    } else {
      console.log('  Env vars: set')
    }
  } catch (err) {
    console.warn(`  Env vars warning: ${err.message}`)
  }

  // 5. Deploy
  console.log('Deploying to Cloudflare Pages...')
  let deployUrl = null
  try {
    const deployOut = execSync(
      `npx wrangler pages deploy ${distDir} --project-name ${projectName}`,
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: CF_TOKEN, CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT } }
    ).toString()
    deployUrl = parseWranglerDeployUrl(deployOut) || `https://${projectName}.pages.dev`
    console.log(`  Deployed: ${deployUrl}`)
  } catch (err) {
    console.error(`  Deploy FAILED: ${err.stderr?.toString().slice(0, 300) || err.message}`)
    results.push({ slug, domain, success: false, error: 'deploy failed' })
    continue
  }

  // 6. Attach custom domain
  if (domain) {
    console.log(`Attaching custom domain: ${domain}...`)
    try {
      const domainResp = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/pages/projects/${projectName}/domains`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CF_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: domain }),
        }
      )
      if (!domainResp.ok) {
        const text = await domainResp.text()
        if (text.includes('already exists') || text.includes('already associated')) {
          console.log('  Custom domain: already attached')
        } else {
          console.warn(`  Custom domain warning: ${domainResp.status} ${text.slice(0, 200)}`)
        }
      } else {
        console.log('  Custom domain: attached')
      }
    } catch (err) {
      console.warn(`  Custom domain warning: ${err.message}`)
    }

    // 7. Verify HTTPS (retry up to 60s)
    console.log(`Verifying HTTPS at https://${domain}/...`)
    let httpsOk = false
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const resp = await fetch(`https://${domain}/`, { redirect: 'follow' })
        if (resp.ok) {
          httpsOk = true
          break
        }
      } catch {
        // Expected during DNS propagation
      }
      await sleep(10000)
    }
    if (httpsOk) {
      console.log('  HTTPS: verified')
    } else {
      console.warn('  HTTPS: not yet available (DNS propagation may need more time)')
    }
  }

  // 8. Update sites.csv
  sitesCsvRows = updateSiteRow(sitesCsvRows, slug, {
    launch_date: today,
    status: 'deployed',
  })
  writeFileSync(sitesCsvPath, writeSitesCsv(sitesCsvRows), 'utf-8')
  console.log('  sites.csv: updated')

  results.push({
    slug,
    domain,
    url: deployUrl,
    success: true,
  })

  // Rate limit between deploys
  if (eligible.indexOf(site) < eligible.length - 1) {
    await sleep(2000)
  }
}

// ── Summary ─────────────────────────────────────────────────────────

console.log(formatDeploySummary(results))
