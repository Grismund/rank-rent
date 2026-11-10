#!/usr/bin/env node
/**
 * GBP Contact Enrichment — Phase 2 Step A
 *
 * Re-queries DataForSEO Business Listings for all 18 candidates to capture
 * contact_info data (emails, additional phones) that Phase 1 discovery skipped.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NICHE_CATEGORY_MAP,
  parseBuyersCsv,
  serializeBuyersCsv,
  parseGbpContactInfo,
  mergeContactData,
  buildEnrichmentSummary,
} from '../lib/renters.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUYERS_PATH = resolve(__dirname, '../data/buyers.csv')
const TODAY = '2026-11-10'

// Approximate city-center GPS for each area in our 18 candidates
const CITY_COORDS = {
  'Georgetown': { lat: 30.6333, lng: -97.6781 },
  'Port St. Lucie': { lat: 27.2730, lng: -80.3582 },
  'Conroe': { lat: 30.3119, lng: -95.4561 },
  'Goodyear': { lat: 33.4353, lng: -112.3577 },
  'New Braunfels': { lat: 29.7030, lng: -98.1245 },
  'Palm Bay': { lat: 28.0345, lng: -80.5887 },
  'Fort Myers': { lat: 26.6406, lng: -81.8723 },
  'Miami': { lat: 25.7617, lng: -80.1918 },
  'Orlando': { lat: 28.5383, lng: -81.3792 },
  'San Antonio': { lat: 29.4241, lng: -98.4936 },
  'Cape Coral': { lat: 26.5629, lng: -81.9495 },
}

// DataForSEO credentials from env
const DFS_LOGIN = process.env.DATAFORSEO_USERNAME || process.env.DATAFORSEO_LOGIN
const DFS_PASSWORD = process.env.DATAFORSEO_PASSWORD
if (!DFS_LOGIN || !DFS_PASSWORD) {
  // Try loading from .env file
  try {
    const envPath = resolve(process.env.HOME, '.config/rank-rent/.env')
    const envContent = readFileSync(envPath, 'utf8')
    for (const line of envContent.split('\n')) {
      const match = line.match(/^(\w+)=(.+)$/)
      if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* ignore */ }
}
const login = process.env.DATAFORSEO_USERNAME || process.env.DATAFORSEO_LOGIN
const password = process.env.DATAFORSEO_PASSWORD
if (!login || !password) {
  console.error('Missing DATAFORSEO_USERNAME/DATAFORSEO_PASSWORD')
  process.exit(1)
}

const AUTH = Buffer.from(`${login}:${password}`).toString('base64')

async function queryBusinessListings(category, description, coords) {
  const body = [{
    categories: [category],
    description,
    title: description,
    search_type: 'maps',
    location_coordinate: `${coords.lat},${coords.lng},50`,
    limit: 20,
  }]

  const resp = await fetch('https://api.dataforseo.com/v3/business_data/business_listings/search/live', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    throw new Error(`DataForSEO HTTP ${resp.status}: ${await resp.text()}`)
  }

  const data = await resp.json()
  const task = data.tasks?.[0]
  if (!task || task.status_code !== 20000) {
    throw new Error(`DataForSEO task error: ${task?.status_message || 'unknown'}`)
  }

  return task.result?.[0]?.items || []
}

function normalizePhone(phone) {
  if (!phone) return ''
  return phone.replace(/[^\d]/g, '').slice(-10)
}

function normalizeName(name) {
  if (!name) return ''
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseSlug(slug) {
  // e.g., "junk-removal-georgetown" or "junk-removal-port-st.-lucie"
  // Niche is everything before the last city part
  // Strategy: try each niche and see which one the slug starts with
  const niches = Object.keys(NICHE_CATEGORY_MAP)
  for (const niche of niches) {
    const nicheSlug = niche.replace(/\s+/g, '-')
    if (slug.startsWith(nicheSlug + '-')) {
      const area = slug.slice(nicheSlug.length + 1)
      return { niche, area }
    }
  }
  return null
}

function findCityFromArea(area) {
  // area is like "georgetown" or "port-st.-lucie"
  // Match against CITY_COORDS keys
  for (const city of Object.keys(CITY_COORDS)) {
    const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '.')
    const areaClean = area.toLowerCase()
    if (areaClean === citySlug || areaClean === citySlug.replace(/\./g, '')) {
      return city
    }
  }
  // Fuzzy: try stripping dots from both
  for (const city of Object.keys(CITY_COORDS)) {
    const cityNorm = city.toLowerCase().replace(/[^a-z]/g, '')
    const areaNorm = area.toLowerCase().replace(/[^a-z]/g, '')
    if (areaNorm === cityNorm) {
      return city
    }
  }
  return null
}

async function main() {
  console.log('Reading buyers.csv...')
  const csvContent = readFileSync(BUYERS_PATH, 'utf8')
  const buyers = parseBuyersCsv(csvContent)
  console.log(`  ${buyers.length} buyer rows loaded`)

  // Group by candidate_slug
  const slugGroups = new Map()
  for (const row of buyers) {
    const slug = row.candidate_slug
    if (!slugGroups.has(slug)) slugGroups.set(slug, [])
    slugGroups.get(slug).push(row)
  }
  console.log(`  ${slugGroups.size} unique candidate slugs\n`)

  let totalEnriched = 0
  let totalQueries = 0
  let totalApiItems = 0

  for (const [slug, rows] of slugGroups) {
    // Check if already enriched (all rows have enriched_date)
    const alreadyEnriched = rows.every(r => r.enriched_date)
    if (alreadyEnriched) {
      console.log(`  SKIP ${slug} — already enriched`)
      continue
    }

    const parsed = parseSlug(slug)
    if (!parsed) {
      console.log(`  SKIP ${slug} — cannot parse niche/area`)
      continue
    }

    const { niche, area } = parsed
    const city = findCityFromArea(area)
    if (!city) {
      console.log(`  SKIP ${slug} — no coords for area "${area}"`)
      continue
    }

    const category = NICHE_CATEGORY_MAP[niche]
    if (!category) {
      console.log(`  SKIP ${slug} — no category for niche "${niche}"`)
      continue
    }

    const coords = CITY_COORDS[city]
    console.log(`  Querying ${slug} (${niche} / ${city})...`)

    try {
      const items = await queryBusinessListings(category, niche, coords)
      totalQueries++
      totalApiItems += items.length
      console.log(`    ${items.length} listings returned`)

      // Build lookup of API results with contact_info
      const apiContacts = []
      for (const item of items) {
        if (!item.contact_info || item.contact_info.length === 0) continue
        const gbpData = parseGbpContactInfo(item.contact_info)
        apiContacts.push({
          phone: normalizePhone(item.phone),
          name: normalizeName(item.title),
          url: item.url || '',
          gbpData,
          raw: item,
        })
      }

      // Match to buyer rows
      let matched = 0
      for (const row of rows) {
        if (row.enriched_date) continue

        const rowPhone = normalizePhone(row.phone)
        const rowName = normalizeName(row.business_name)

        // Try phone match first, then name match
        let bestMatch = null
        for (const ac of apiContacts) {
          if (rowPhone && ac.phone && rowPhone === ac.phone) {
            bestMatch = ac
            break
          }
        }
        if (!bestMatch) {
          for (const ac of apiContacts) {
            if (rowName && ac.name && rowName === ac.name) {
              bestMatch = ac
              break
            }
          }
        }

        if (bestMatch) {
          const merged = mergeContactData(row, bestMatch.gbpData)
          // Also try to get website from the API result
          if (!row.website && bestMatch.raw.url) {
            const websiteData = { website: bestMatch.raw.url, website_source: 'GBP' }
            Object.assign(merged, mergeContactData(merged, websiteData))
          }
          Object.assign(row, merged)
          matched++
        }

        // Mark as enriched regardless (we attempted it)
        row.enriched_date = TODAY
        // Ensure all enrichment columns exist
        row.owner_name = row.owner_name || ''
        row.owner_name_source = row.owner_name_source || ''
        row.email = row.email || ''
        row.email_source = row.email_source || ''
        row.phone_source = row.phone_source || ''
        row.website_source = row.website_source || ''
      }

      totalEnriched += matched
      console.log(`    ${matched}/${rows.length} rows matched with contact data`)

      // Rate limit: small delay between queries
      await new Promise(r => setTimeout(r, 200))
    } catch (err) {
      console.error(`    ERROR: ${err.message}`)
      // Still mark rows as attempted so we don't re-query
      for (const row of rows) {
        if (!row.enriched_date) {
          row.enriched_date = TODAY
          row.owner_name = row.owner_name || ''
          row.owner_name_source = row.owner_name_source || ''
          row.email = row.email || ''
          row.email_source = row.email_source || ''
          row.phone_source = row.phone_source || ''
          row.website_source = row.website_source || ''
        }
      }
    }
  }

  // Write updated CSV
  console.log('\nWriting updated buyers.csv...')
  const newCsv = serializeBuyersCsv(buyers)
  writeFileSync(BUYERS_PATH, newCsv + '\n')
  console.log(`  Written ${buyers.length} rows with ${BUYERS_PATH.split('/').pop()}`)

  // Summary
  console.log(`\n--- Enrichment Summary ---`)
  console.log(`  Queries: ${totalQueries}`)
  console.log(`  API items scanned: ${totalApiItems}`)
  console.log(`  Rows matched: ${totalEnriched}`)

  const summary = buildEnrichmentSummary(buyers)
  console.log(`  Total buyers: ${summary.total}`)
  console.log(`  With email: ${summary.withEmail}`)
  console.log(`  With phone: ${summary.withPhone}`)
  console.log(`  With owner: ${summary.withOwner}`)
  console.log(`  With website: ${summary.withWebsite}`)
  console.log(`  By source: GBP=${summary.bySource.GBP}, SITE=${summary.bySource.SITE}, FB=${summary.bySource.FB}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
