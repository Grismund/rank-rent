#!/usr/bin/env node
/**
 * Website Scraping Enrichment — Phase 2 Step B
 *
 * For buyers with a website but missing email/owner_name, fetches their
 * website's contact/about pages and extracts emails and owner names.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseBuyersCsv,
  serializeBuyersCsv,
  mergeContactData,
  buildEnrichmentSummary,
  extractEmailFromText,
  extractOwnerFromText,
  buildContactPageUrls,
} from '../lib/renters.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUYERS_PATH = resolve(__dirname, '../data/buyers.csv')
const TODAY = '2026-11-10'

const FETCH_TIMEOUT = 8000 // 8s per page
const DELAY_MS = 500 // 500ms between businesses (polite crawl)

async function fetchPageText(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RankRentBot/1.0; research)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    })
    if (!resp.ok) return ''
    const contentType = resp.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return ''
    const text = await resp.text()
    return text
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  console.log('Reading buyers.csv...')
  const csvContent = readFileSync(BUYERS_PATH, 'utf8')
  const buyers = parseBuyersCsv(csvContent)
  console.log(`  ${buyers.length} buyer rows loaded`)

  // Find buyers with website but missing email or owner_name
  const targets = buyers.filter(b =>
    b.website && (!b.email || !b.owner_name)
  )
  console.log(`  ${targets.length} buyers with website needing email/owner enrichment\n`)

  let enrichedEmails = 0
  let enrichedOwners = 0
  let fetchedPages = 0
  let errors = 0

  for (let i = 0; i < targets.length; i++) {
    const b = targets[i]
    const needEmail = !b.email
    const needOwner = !b.owner_name

    console.log(`[${i + 1}/${targets.length}] ${b.business_name} — ${b.website}`)

    const urls = buildContactPageUrls(b.website)
    let foundEmail = ''
    let foundOwner = ''

    for (const url of urls) {
      // Stop early if we found everything
      if ((!needEmail || foundEmail) && (!needOwner || foundOwner)) break

      try {
        const text = await fetchPageText(url)
        fetchedPages++
        if (!text) continue

        if (needEmail && !foundEmail) {
          foundEmail = extractEmailFromText(text)
        }
        if (needOwner && !foundOwner) {
          foundOwner = extractOwnerFromText(text)
        }
      } catch {
        errors++
      }
    }

    // Merge findings
    const newData = {}
    if (foundEmail) {
      newData.email = foundEmail
      newData.email_source = 'SITE'
      enrichedEmails++
      console.log(`  ✓ email: ${foundEmail}`)
    }
    if (foundOwner) {
      newData.owner_name = foundOwner
      newData.owner_name_source = 'SITE'
      enrichedOwners++
      console.log(`  ✓ owner: ${foundOwner}`)
    }

    if (Object.keys(newData).length > 0) {
      const merged = mergeContactData(b, newData)
      Object.assign(b, merged)
      b.enriched_date = TODAY
    }

    if (!foundEmail && !foundOwner) {
      console.log(`  — no new data`)
    }

    // Polite delay
    await sleep(DELAY_MS)
  }

  // Write updated CSV
  console.log('\nWriting updated buyers.csv...')
  const newCsv = serializeBuyersCsv(buyers)
  writeFileSync(BUYERS_PATH, newCsv + '\n')

  // Summary
  const summary = buildEnrichmentSummary(buyers)
  console.log(`\n--- Website Enrichment Summary ---`)
  console.log(`  Pages fetched: ${fetchedPages}`)
  console.log(`  Fetch errors: ${errors}`)
  console.log(`  New emails found: ${enrichedEmails}`)
  console.log(`  New owners found: ${enrichedOwners}`)
  console.log(`\n--- Overall Enrichment ---`)
  console.log(`  Total buyers: ${summary.total}`)
  console.log(`  With email: ${summary.withEmail} (${(100 * summary.withEmail / summary.total).toFixed(1)}%)`)
  console.log(`  With phone: ${summary.withPhone} (${(100 * summary.withPhone / summary.total).toFixed(1)}%)`)
  console.log(`  With owner: ${summary.withOwner} (${(100 * summary.withOwner / summary.total).toFixed(1)}%)`)
  console.log(`  With website: ${summary.withWebsite} (${(100 * summary.withWebsite / summary.total).toFixed(1)}%)`)
  console.log(`  By source: GBP=${summary.bySource.GBP}, SITE=${summary.bySource.SITE}, FB=${summary.bySource.FB}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
