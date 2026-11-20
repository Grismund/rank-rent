#!/usr/bin/env node
/**
 * weekly-review.mjs — Query GSC and Twilio for deployed sites, detect milestones,
 * propose new pages and content refreshes, flag kill candidates.
 *
 * Usage:
 *   node scripts/weekly-review.mjs <slug>              # one site
 *   node scripts/weekly-review.mjs --wave 1            # one wave
 *   node scripts/weekly-review.mjs --all               # all deployed
 *   node scripts/weekly-review.mjs --dry-run <slug>    # show what would query
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import { parseEnv } from '../lib/dataforseo-client.js'
import { readSitesCsv, writeSitesCsv, updateSiteRow } from '../lib/sites-csv.js'
import { parseWaveAssignments, getTargetSlugs } from '../lib/wave-assignments.js'
import { getGoogleAccessToken } from '../lib/google-auth.js'
import { buildGscPropertyUrl, buildPageUrls } from '../lib/indexing.js'
import {
  buildSearchAnalyticsRequest,
  parseSearchAnalyticsRows,
  buildReviewDateRanges,
  findNewPageCandidates,
  selectTopPageProposal,
  findRefreshCandidates,
  checkKillCandidate,
  buildCallLogParams,
  countCalls,
  detectMilestones,
  formatWeeklyReviewSummary,
  formatSiteReviewDetail,
} from '../lib/weekly-review.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── CLI args ────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const allSites = args.includes('--all')
const waveIdx = args.indexOf('--wave')
const waveNum = waveIdx !== -1 ? parseInt(args[waveIdx + 1], 10) : null
const slugArg = args.find(a =>
  !a.startsWith('--') &&
  (waveIdx === -1 || args.indexOf(a) !== waveIdx + 1)
)

if (!slugArg && !allSites && waveNum === null) {
  console.error('Usage: node scripts/weekly-review.mjs <slug> | --wave N | --all [--dry-run]')
  process.exit(1)
}

// ── Load env ────────────────────────────────────────────────────────

const envPath = resolve(process.env.HOME, '.config/rank-rent/.env')
const envContent = readFileSync(envPath, 'utf-8')
const env = parseEnv(envContent)

const GOOGLE_CREDS_PATH = env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS
const TWILIO_SID = env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = env.TWILIO_AUTH_TOKEN

// ── Discover targets ────────────────────────────────────────────────

const sitesDir = resolve(ROOT, 'sites')
const assignText = readFileSync(resolve(sitesDir, 'ASSIGNMENTS.md'), 'utf-8')
const waveMap = parseWaveAssignments(assignText)

const allSlugs = readdirSync(sitesDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(resolve(sitesDir, d.name, 'site.yaml')))
  .map(d => d.name)
  .sort()

const targetSlugs = getTargetSlugs({ slugArg, waveNum, allSlugs, waveMap })

// Load sites.csv
const sitesCsvPath = resolve(ROOT, 'data', 'sites.csv')
let sitesCsvRows = existsSync(sitesCsvPath)
  ? readSitesCsv(readFileSync(sitesCsvPath, 'utf-8'))
  : []

// Filter: must be deployed with a domain
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
  const csvRow = sitesCsvRows.find(r => r.slug === slug)
  return { slug, config, csvRow }
})

console.log(`\nFound ${eligible.length} deployed site(s) to review\n`)

if (eligible.length === 0) {
  console.log('Nothing to do — no deployed sites found.')
  process.exit(0)
}

// ── Date ranges ─────────────────────────────────────────────────────

const today = new Date().toISOString().slice(0, 10)
const dateRanges = buildReviewDateRanges(today)

console.log(`Review period: ${dateRanges.currentStart} to ${dateRanges.currentEnd}`)
console.log(`Comparison:    ${dateRanges.priorStart} to ${dateRanges.priorEnd}`)

// ── Dry run ─────────────────────────────────────────────────────────

if (dryRun) {
  console.log('\n--dry-run: would query:')
  for (const { slug, config, csvRow } of eligible) {
    const domain = config.domain
    const property = buildGscPropertyUrl(domain)
    console.log(`\n  ${slug} (${domain}):`)
    console.log(`    GSC property: ${property}`)
    console.log(`    GSC Search Analytics: ${dateRanges.currentStart} → ${dateRanges.currentEnd}`)
    console.log(`    GSC Search Analytics: ${dateRanges.priorStart} → ${dateRanges.priorEnd}`)
    if (csvRow.tracking_number) {
      console.log(`    Twilio calls: ${csvRow.tracking_number}`)
    } else {
      console.log(`    Twilio calls: SKIP (no tracking number)`)
    }
  }
  process.exit(0)
}

// ── Google auth ─────────────────────────────────────────────────────

let googleToken = null
if (GOOGLE_CREDS_PATH && existsSync(GOOGLE_CREDS_PATH)) {
  try {
    googleToken = await getGoogleAccessToken(GOOGLE_CREDS_PATH, [
      'https://www.googleapis.com/auth/webmasters.readonly',
    ])
    console.log('Google auth: OK')
  } catch (err) {
    console.warn(`Google auth failed: ${err.message}`)
    console.warn('Continuing without GSC data.')
  }
} else {
  console.warn('Google credentials not found — skipping GSC queries.')
}

// ── Twilio auth ─────────────────────────────────────────────────────

const twilioAuth = TWILIO_SID && TWILIO_TOKEN
  ? 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
  : null

if (!twilioAuth) {
  console.warn('Twilio credentials not found — skipping call log queries.')
}

// ── Review each site ────────────────────────────────────────────────

const reviews = []
const reviewsDir = resolve(ROOT, 'data', 'reviews')
if (!existsSync(reviewsDir)) mkdirSync(reviewsDir, { recursive: true })

for (const { slug, config, csvRow } of eligible) {
  const domain = config.domain
  const property = buildGscPropertyUrl(domain)
  const pageUrls = buildPageUrls(config, domain)

  console.log(`\n=== ${slug} (${domain}) ===`)

  // ── Query GSC ───────────────────────────────────────────────────
  let currentQueryData = []
  let priorQueryData = []

  if (googleToken) {
    try {
      // Current period
      const currentReq = buildSearchAnalyticsRequest(dateRanges.currentStart, dateRanges.currentEnd)
      const currentResp = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(currentReq),
        }
      )
      if (currentResp.ok) {
        currentQueryData = parseSearchAnalyticsRows(await currentResp.json())
        console.log(`  GSC current: ${currentQueryData.length} rows`)
      } else {
        console.warn(`  GSC current: ${currentResp.status} (${await currentResp.text().then(t => t.slice(0, 100))})`)
      }

      await sleep(500)

      // Prior period
      const priorReq = buildSearchAnalyticsRequest(dateRanges.priorStart, dateRanges.priorEnd)
      const priorResp = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(priorReq),
        }
      )
      if (priorResp.ok) {
        priorQueryData = parseSearchAnalyticsRows(await priorResp.json())
        console.log(`  GSC prior:   ${priorQueryData.length} rows`)
      } else {
        console.warn(`  GSC prior: ${priorResp.status}`)
      }
    } catch (err) {
      console.warn(`  GSC error: ${err.message}`)
    }
  } else {
    console.log('  GSC: skipped (no auth)')
  }

  // ── Query Twilio ───────────────────────────────────────────────
  let callData = { totalCalls: 0, completedCalls: 0, totalDuration: 0 }

  if (twilioAuth && csvRow.tracking_number) {
    try {
      const params = buildCallLogParams(csvRow.tracking_number, dateRanges.currentStart, dateRanges.currentEnd)
      const qs = new URLSearchParams(params).toString()
      const callResp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json?${qs}`,
        { headers: { Authorization: twilioAuth } }
      )
      if (callResp.ok) {
        callData = countCalls(await callResp.json())
        console.log(`  Calls: ${callData.completedCalls} completed`)
      } else {
        console.warn(`  Calls: ${callResp.status}`)
      }
    } catch (err) {
      console.warn(`  Calls error: ${err.message}`)
    }
  } else {
    console.log('  Calls: skipped (no tracking number or no auth)')
  }

  // ── Analysis ──────────────────────────────────────────────────

  const totalImpressions = currentQueryData.reduce((s, d) => s + d.impressions, 0)
  const totalClicks = currentQueryData.reduce((s, d) => s + d.clicks, 0)

  // New page candidates
  const existingPageKeywords = pageUrls.map(url => {
    const path = new URL(url).pathname.replace(/^\/|\/$/g, '').replace(/-/g, ' ')
    return path
  })
  const newPageCandidates = findNewPageCandidates(currentQueryData, existingPageKeywords)
  const newPageProposal = selectTopPageProposal(newPageCandidates)

  // Refresh candidates
  const refreshCandidates = findRefreshCandidates(currentQueryData, priorQueryData, pageUrls)

  // Kill candidate check
  const killCandidate = csvRow.launch_date
    ? checkKillCandidate(totalImpressions, csvRow.launch_date, today)
    : { isKillCandidate: false, monthsSinceLaunch: 0 }

  // Milestones
  const milestones = detectMilestones(csvRow, totalImpressions, callData.completedCalls, today)

  // Update sites.csv if milestones found
  if (Object.keys(milestones).length > 0) {
    sitesCsvRows = updateSiteRow(sitesCsvRows, slug, milestones)
    console.log(`  Milestones: ${Object.keys(milestones).join(', ')}`)
  }

  // Build review object
  const review = {
    slug,
    domain,
    dateRange: dateRanges,
    totalImpressions,
    totalClicks,
    totalCalls: callData.completedCalls,
    totalDuration: callData.totalDuration,
    queryCount: currentQueryData.length,
    newPageProposal,
    newPageCandidateCount: newPageCandidates.length,
    refreshCandidates,
    killCandidate,
    milestones,
  }

  reviews.push(review)

  // Write review JSON
  const reviewPath = resolve(reviewsDir, `${slug}-${today}.json`)
  writeFileSync(reviewPath, JSON.stringify(review, null, 2) + '\n', 'utf-8')
  console.log(`  Review saved: data/reviews/${slug}-${today}.json`)

  // Print detail
  console.log('\n' + formatSiteReviewDetail(review))

  await sleep(500)
}

// ── Save milestones to sites.csv ────────────────────────────────────

writeFileSync(sitesCsvPath, writeSitesCsv(sitesCsvRows) + '\n', 'utf-8')

// ── Portfolio summary ───────────────────────────────────────────────

console.log('\n' + formatWeeklyReviewSummary(reviews))
console.log('\nDone.')
