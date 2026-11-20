#!/usr/bin/env node
/**
 * index-site.mjs — Submit deployed sites to Google Search Console, Bing Webmaster, and IndexNow.
 *
 * Usage:
 *   node scripts/index-site.mjs <slug>                  # index one site
 *   node scripts/index-site.mjs --wave 1                # index a wave
 *   node scripts/index-site.mjs --all                   # index all deployed
 *   node scripts/index-site.mjs --dry-run <slug>        # show what would submit
 *   node scripts/index-site.mjs --indexnow-only <slug>  # re-ping IndexNow only
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import { parseEnv } from '../lib/dataforseo-client.js'
import { readSitesCsv } from '../lib/sites-csv.js'
import { parseWaveAssignments, getTargetSlugs } from '../lib/wave-assignments.js'
import { getGoogleAccessToken } from '../lib/google-auth.js'
import {
  buildSitemapUrl,
  buildIndexNowPayload,
  generateIndexNowKey,
  buildPageUrls,
  buildGscVerificationRecord,
  buildGscPropertyUrl,
  formatIndexingReport,
} from '../lib/indexing.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const indexNowOnly = args.includes('--indexnow-only')
const allSites = args.includes('--all')
const waveIdx = args.indexOf('--wave')
const waveNum = waveIdx !== -1 ? parseInt(args[waveIdx + 1], 10) : null
const slugArg = args.find(a =>
  !a.startsWith('--') &&
  (waveIdx === -1 || args.indexOf(a) !== waveIdx + 1)
)

if (!slugArg && !allSites && waveNum === null) {
  console.error('Usage: node scripts/index-site.mjs <slug> | --wave N | --all [--dry-run] [--indexnow-only]')
  process.exit(1)
}

// ── Load env ────────────────────────────────────────────────────────

const envPath = resolve(process.env.HOME, '.config/rank-rent/.env')
const envContent = readFileSync(envPath, 'utf-8')
const env = parseEnv(envContent)

const CF_TOKEN = env.CLOUDFLARE_API_TOKEN
const CF_ACCOUNT = env.CLOUDFLARE_ACCOUNT_ID
const BING_API_KEY = env.BING_WEBMASTER_API_KEY
const GOOGLE_CREDS_PATH = env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS
const GOOGLE_PROJECT = env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT

// ── Cloudflare DNS helper ───────────────────────────────────────────

async function getZoneId(domain) {
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
    { headers: { Authorization: `Bearer ${CF_TOKEN}` } }
  )
  const data = await resp.json()
  if (data.result && data.result.length > 0) return data.result[0].id
  throw new Error(`No Cloudflare zone found for ${domain}`)
}

async function addDnsTxtRecord(zoneId, domain, content) {
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'TXT',
        name: domain,
        content,
        ttl: 300,
      }),
    }
  )
  const data = await resp.json()
  if (!data.success) {
    const msg = data.errors?.[0]?.message || 'unknown'
    // Duplicate record is OK
    if (msg.includes('already exists')) return true
    throw new Error(`DNS TXT add failed: ${msg}`)
  }
  return true
}

// ── Discover targets ────────────────────────────────────────────────

const sitesDir = resolve(ROOT, 'sites')
const assignText = readFileSync(resolve(sitesDir, 'ASSIGNMENTS.md'), 'utf-8')
const waveMap = parseWaveAssignments(assignText)

const allSlugs = readdirSync(sitesDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(resolve(sitesDir, d.name, 'site.yaml')))
  .map(d => d.name)
  .sort()

const targetSlugs = getTargetSlugs({ slugArg, waveNum, allSlugs, waveMap })

// Load sites.csv to check deployed status
const sitesCsvPath = resolve(ROOT, 'data', 'sites.csv')
const sitesCsvRows = existsSync(sitesCsvPath)
  ? readSitesCsv(readFileSync(sitesCsvPath, 'utf-8'))
  : []

// Filter: must have status=deployed and a domain
const eligible = targetSlugs.filter(slug => {
  const csvRow = sitesCsvRows.find(r => r.slug === slug)
  if (!csvRow || csvRow.status !== 'deployed') {
    console.log(`SKIP: ${slug} — not deployed yet`)
    return false
  }
  const yamlPath = resolve(sitesDir, slug, 'site.yaml')
  const config = loadYaml(readFileSync(yamlPath, 'utf-8'))
  if (!config.domain || config.domain === 'null') {
    console.log(`SKIP: ${slug} — no domain set`)
    return false
  }
  return true
}).map(slug => {
  const yamlPath = resolve(sitesDir, slug, 'site.yaml')
  const config = loadYaml(readFileSync(yamlPath, 'utf-8'))
  return { slug, config }
})

console.log(`\nFound ${eligible.length} deployed site(s) to index\n`)

if (eligible.length === 0) {
  console.log('Nothing to do.')
  process.exit(0)
}

// ── Index each site ─────────────────────────────────────────────────

for (const { slug, config } of eligible) {
  const domain = config.domain
  const siteUrl = buildGscPropertyUrl(domain)
  const sitemapUrl = buildSitemapUrl(domain)
  const pageUrls = buildPageUrls(config, domain)
  const indexNowKey = generateIndexNowKey(slug)

  const report = {
    slug, domain,
    gscAdded: false, gscVerified: false, sitemapSubmitted: false,
    bingAdded: false, indexNowPinged: false,
    urlCount: pageUrls.length,
    errors: [],
  }

  console.log(`\n=== Indexing ${slug} (${domain}) ===\n`)
  console.log(`  Pages: ${pageUrls.length}`)
  console.log(`  Sitemap: ${sitemapUrl}`)

  if (dryRun) {
    console.log('\n  --dry-run: would submit to:')
    console.log(`    GSC: ${siteUrl}`)
    console.log(`    Bing: ${siteUrl}`)
    console.log(`    IndexNow: ${pageUrls.length} URLs`)
    console.log(`    IndexNow key: ${indexNowKey}`)
    continue
  }

  // ── Google Search Console ───────────────────────────────────────

  if (!indexNowOnly) {
    if (GOOGLE_CREDS_PATH && existsSync(GOOGLE_CREDS_PATH)) {
      console.log('  Google Search Console:')
      try {
        const accessToken = await getGoogleAccessToken(GOOGLE_CREDS_PATH, [
          'https://www.googleapis.com/auth/webmasters',
          'https://www.googleapis.com/auth/siteverification',
        ])

        // Add property
        const addResp = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        )
        if (addResp.ok || addResp.status === 204) {
          report.gscAdded = true
          console.log('    Property: added')
        } else {
          const text = await addResp.text()
          console.warn(`    Property: ${addResp.status} ${text.slice(0, 200)}`)
          report.errors.push(`GSC add property: ${addResp.status}`)
        }

        // Get DNS TXT verification token
        const tokenResp = await fetch(
          'https://www.googleapis.com/siteVerification/v1/token',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              site: { type: 'INET_DOMAIN', identifier: domain },
              verificationMethod: 'DNS_TXT',
            }),
          }
        )

        if (tokenResp.ok) {
          const tokenData = await tokenResp.json()
          const verifyToken = tokenData.token
          console.log(`    Verification token: ${verifyToken.slice(0, 40)}...`)

          // Add DNS TXT record via Cloudflare
          if (CF_TOKEN) {
            try {
              const zoneId = await getZoneId(domain)
              const record = buildGscVerificationRecord(verifyToken)
              await addDnsTxtRecord(zoneId, domain, record.content)
              console.log('    DNS TXT: added')

              // Wait for propagation then verify
              console.log('    Waiting 10s for DNS propagation...')
              await sleep(10000)

              const verifyResp = await fetch(
                'https://www.googleapis.com/siteVerification/v1/webResource',
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    site: { type: 'INET_DOMAIN', identifier: domain },
                    verificationMethod: 'DNS_TXT',
                  }),
                }
              )

              if (verifyResp.ok) {
                report.gscVerified = true
                console.log('    Verification: confirmed')
              } else {
                console.warn('    Verification: pending (DNS may need more time — retry later)')
                report.errors.push('GSC verification pending')
              }
            } catch (err) {
              console.warn(`    DNS/verify error: ${err.message}`)
              report.errors.push(`DNS: ${err.message}`)
            }
          }
        } else {
          console.warn('    Token request failed')
          report.errors.push('GSC token request failed')
        }

        // Submit sitemap
        const smResp = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        )
        if (smResp.ok || smResp.status === 204) {
          report.sitemapSubmitted = true
          console.log('    Sitemap: submitted')
        } else {
          console.warn(`    Sitemap: ${smResp.status}`)
          report.errors.push(`GSC sitemap: ${smResp.status}`)
        }

      } catch (err) {
        console.error(`    GSC error: ${err.message}`)
        report.errors.push(`GSC: ${err.message}`)
      }
    } else {
      console.warn('  Google Search Console: SKIPPED (no credentials)')
      report.errors.push('GSC: no credentials file')
    }

    // ── Bing Webmaster ──────────────────────────────────────────────

    if (BING_API_KEY) {
      console.log('  Bing Webmaster:')
      try {
        // Add site
        const addResp = await fetch(
          `https://ssl.bing.com/webmaster/api.svc/json/AddSite?apikey=${encodeURIComponent(BING_API_KEY)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteUrl }),
          }
        )
        if (addResp.ok) {
          report.bingAdded = true
          console.log('    Site: added')
        } else {
          const text = await addResp.text()
          // ErrorCode 4 = site already exists
          if (text.includes('"ErrorCode":4') || text.includes('already exists')) {
            report.bingAdded = true
            console.log('    Site: already exists')
          } else {
            console.warn(`    Site add: ${addResp.status} ${text.slice(0, 200)}`)
            report.errors.push(`Bing add: ${addResp.status}`)
          }
        }

        // Submit sitemap
        const smResp = await fetch(
          `https://ssl.bing.com/webmaster/api.svc/json/SubmitSitemap?apikey=${encodeURIComponent(BING_API_KEY)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteUrl, feedUrl: sitemapUrl }),
          }
        )
        if (smResp.ok) {
          console.log('    Sitemap: submitted')
        } else {
          console.warn(`    Sitemap: ${smResp.status}`)
        }
      } catch (err) {
        console.error(`    Bing error: ${err.message}`)
        report.errors.push(`Bing: ${err.message}`)
      }
    } else {
      console.warn('  Bing Webmaster: SKIPPED (no API key)')
      report.errors.push('Bing: no API key')
    }
  }

  // ── IndexNow ────────────────────────────────────────────────────

  console.log('  IndexNow:')
  try {
    const payload = buildIndexNowPayload(domain, indexNowKey, pageUrls)

    const inResp = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })

    if (inResp.ok || inResp.status === 200 || inResp.status === 202) {
      report.indexNowPinged = true
      console.log(`    Pinged: ${pageUrls.length} URLs`)
    } else {
      const text = await inResp.text()
      console.warn(`    IndexNow: ${inResp.status} ${text.slice(0, 200)}`)
      report.errors.push(`IndexNow: ${inResp.status}`)
    }
  } catch (err) {
    console.error(`    IndexNow error: ${err.message}`)
    report.errors.push(`IndexNow: ${err.message}`)
  }

  // Print per-site report
  console.log(`\n${formatIndexingReport(report)}`)

  // Rate limit between sites
  await sleep(1000)
}

console.log('\nDone.')
