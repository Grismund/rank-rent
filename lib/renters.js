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
    contact_info: item.contact_info || [],
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

const PHONE_TYPES = new Set(['telephone', 'cell_phone'])

export function extractContactInfo(contactInfoArray) {
  if (!contactInfoArray || contactInfoArray.length === 0) {
    return { phones: [], emails: [] }
  }
  const phones = []
  const emails = []
  const seenPhones = new Set()
  const seenEmails = new Set()

  for (const entry of contactInfoArray) {
    const type = entry.type || ''
    const value = entry.value || ''
    if (!value) continue

    if (PHONE_TYPES.has(type) && !seenPhones.has(value)) {
      seenPhones.add(value)
      phones.push({ value, source: 'GBP' })
    } else if ((type === 'email' || type === 'mail') && !seenEmails.has(value)) {
      seenEmails.add(value)
      emails.push({ value, source: 'GBP' })
    }
  }

  return { phones, emails }
}

export function parseGbpContactInfo(contactInfoArray) {
  const { phones, emails } = extractContactInfo(contactInfoArray)
  return {
    phone: phones.length > 0 ? phones[0].value : '',
    phone_source: phones.length > 0 ? 'GBP' : '',
    email: emails.length > 0 ? emails[0].value : '',
    email_source: emails.length > 0 ? 'GBP' : '',
  }
}

const MERGEABLE_FIELDS = ['email', 'phone', 'owner_name', 'website']

export function mergeContactData(existingRow, newContactData) {
  const result = { ...existingRow }
  if (!newContactData) return result

  for (const field of MERGEABLE_FIELDS) {
    if (!result[field] && newContactData[field]) {
      result[field] = newContactData[field]
      const sourceKey = `${field}_source`
      if (newContactData[sourceKey]) {
        result[sourceKey] = newContactData[sourceKey]
      }
      if (field === 'website') {
        result.domain = extractDomain(newContactData[field])
      }
    }
  }

  return result
}

export function buildEnrichmentSummary(buyers) {
  const summary = {
    total: buyers.length,
    withEmail: 0,
    withPhone: 0,
    withOwner: 0,
    withWebsite: 0,
    bySource: { GBP: 0, SITE: 0, FB: 0 },
  }

  for (const b of buyers) {
    if (b.email) summary.withEmail++
    if (b.phone) summary.withPhone++
    if (b.owner_name) summary.withOwner++
    if (b.website) summary.withWebsite++

    for (const field of ['email_source', 'phone_source', 'owner_name_source', 'website_source']) {
      const src = b[field]
      if (src && summary.bySource[src] !== undefined) {
        summary.bySource[src]++
      }
    }
  }

  return summary
}

// --- Website scraping helpers ---

const GENERIC_EMAIL_PREFIXES = new Set([
  'noreply', 'no-reply', 'support', 'webmaster', 'admin',
])
const GENERIC_EMAIL_DOMAINS = new Set(['sentry.io', 'example.com', 'wordpress.com'])

export function extractEmailFromText(text) {
  if (!text) return ''
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = text.match(emailRegex) || []

  for (const email of matches) {
    const lower = email.toLowerCase()
    const prefix = lower.split('@')[0]
    const domain = lower.split('@')[1]
    if (GENERIC_EMAIL_PREFIXES.has(prefix)) continue
    if (GENERIC_EMAIL_DOMAINS.has(domain)) continue
    if (prefix === 'info' && domain.startsWith('wordpress')) continue
    return lower
  }
  return ''
}

const OWNER_PATTERNS = [
  /(?:Owner|CEO|President|Founder|Principal)\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
  /(?:Owned|Founded)\s+by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
  /Meet\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
]

export function extractOwnerFromText(text) {
  if (!text) return ''
  for (const pattern of OWNER_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      // Clean trailing words that aren't part of the name
      const name = match[1].replace(/,.*$/, '').trim()
      return name
    }
  }
  return ''
}

const CONTACT_PATHS = ['/contact', '/contact-us', '/about', '/about-us']

export function buildContactPageUrls(websiteUrl) {
  if (!websiteUrl) return []
  let urlStr = websiteUrl
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = 'https://' + urlStr
  }
  try {
    const u = new URL(urlStr)
    const base = u.origin
    return [base, ...CONTACT_PATHS.map(p => base + p)]
  } catch {
    return []
  }
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
