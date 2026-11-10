import { DIRECTORY_DOMAINS, BUYERS_CSV_COLUMNS } from './constants.js'

export const NICHE_CATEGORY_MAP = {
  'epoxy flooring': 'flooring_contractor',
  'bathroom remodel': 'bathroom_remodeler',
  'kitchen remodel': 'kitchen_remodeler',
  'junk removal': 'junk_removal_service',
  'pool builders': 'swimming_pool_contractor',
  'pressure washing': 'pressure_washing_service',
  'window tinting': 'window_tinting_service',
  'paver sealing': 'concrete_contractor',
}

const SOCIAL_DOMAINS = ['facebook.com', 'instagram.com']

export function extractDomain(url) {
  if (!url) return ''
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function assessWebsiteWeakness(listing) {
  const url = listing.url || listing.website || ''
  if (!url) return 'no_website'

  const domain = extractDomain(url)
  if (!domain) return 'no_website'

  if (SOCIAL_DOMAINS.some(s => domain === s || domain.endsWith(`.${s}`))) {
    return 'social_only'
  }

  if (DIRECTORY_DOMAINS.some(d => domain === d || domain.endsWith(`.${d}`))) {
    return 'directory_only'
  }

  return 'no_organic_rank'
}

export function scorePitchPriority(listing) {
  let signals = 0
  const w = listing.website_weakness

  if (w === 'no_website' || w === 'social_only') signals += 2
  else if (w === 'directory_only') signals += 1

  if (listing.review_count < 20) signals += 1
  if (listing.rating < 4.0) signals += 1
  if (!listing.is_claimed) signals += 1
  if (listing.fb_presence === 'advertising') signals += 1

  if (signals >= 3) return 'hot'
  if (signals >= 1) return 'warm'
  return 'cold'
}

export function generateBuyerSlug(businessName, city) {
  return `${businessName} ${city}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function deduplicateListings(listings) {
  const byPhone = new Map()
  const byDomain = new Map()
  const result = []

  // Sort by review_count desc so first seen = highest
  const sorted = [...listings].sort((a, b) => (b.review_count || 0) - (a.review_count || 0))

  for (const listing of sorted) {
    const phone = listing.phone || ''
    const domain = listing.domain || ''

    if (phone && byPhone.has(phone)) continue
    if (domain && byDomain.has(domain)) continue

    if (phone) byPhone.set(phone, true)
    if (domain) byDomain.set(domain, true)
    result.push(listing)
  }

  return result
}

export function parseBusinessListing(item) {
  const url = item.url || ''
  const addressInfo = item.address_info || {}
  const rating = item.rating || {}

  return {
    business_name: item.title || '',
    phone: item.phone || '',
    website: url,
    domain: extractDomain(url),
    address: item.address || '',
    city: addressInfo.city || '',
    state: addressInfo.region || '',
    rating: rating.value || 0,
    review_count: rating.votes_count || 0,
    is_claimed: item.is_claimed || false,
  }
}

export { BUYERS_CSV_COLUMNS } from './constants.js'

export function parseBuyersCsv(csvString) {
  const lines = csvString.trim().split('\n')
  if (lines.length <= 1) return []
  const headers = lines[0].split(',')
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          current += ch
        }
      } else if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        values.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    values.push(current)
    const row = {}
    headers.forEach((h, i) => {
      row[h] = values[i] !== undefined ? values[i] : ''
    })
    return row
  })
}

export function serializeBuyersCsv(rows) {
  const header = BUYERS_CSV_COLUMNS.join(',')
  const lines = rows.map(row =>
    BUYERS_CSV_COLUMNS.map(col => {
      const val = row[col] !== undefined ? String(row[col]) : ''
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"'
      }
      return val
    }).join(',')
  )
  return [header, ...lines].join('\n')
}

export function buildFacebookSearchQuery(niche, city, state) {
  return `"${niche} ${city} ${state}" site:facebook.com`
}

export function generatePitchNote(listing) {
  const parts = []
  const w = listing.website_weakness

  if (w === 'no_website') parts.push('No website')
  else if (w === 'social_only') parts.push('Social only')
  else if (w === 'directory_only') parts.push('Directory listing only')

  if (listing.rating > 0) parts.push(`${listing.rating}★`)
  if (listing.review_count > 0) parts.push(`${listing.review_count} reviews`)

  if (!listing.is_claimed) parts.push('unclaimed')

  if (listing.fb_presence === 'advertising') parts.push('FB ads active')
  else if (listing.fb_presence === 'found') parts.push('on Facebook')

  if (w === 'no_website') parts.push('hungry for leads')
  else if (w === 'social_only') parts.push('easy sell')
  else if (w === 'directory_only') parts.push('needs own site')

  return parts.join(', ')
}
