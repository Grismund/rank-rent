import { describe, it, expect } from 'vitest'
import {
  NICHE_CATEGORY_MAP,
  extractDomain,
  assessWebsiteWeakness,
  scorePitchPriority,
  generateBuyerSlug,
  deduplicateListings,
  parseBusinessListing,
  parseBuyersCsv,
  serializeBuyersCsv,
  buildFacebookSearchQuery,
  generatePitchNote,
  extractContactInfo,
  parseGbpContactInfo,
  mergeContactData,
  buildEnrichmentSummary,
  extractEmailFromText,
  extractOwnerFromText,
  buildContactPageUrls,
} from '../lib/renters.js'

// --- NICHE_CATEGORY_MAP ---

describe('NICHE_CATEGORY_MAP', () => {
  it('maps all 8 niches to DataForSEO category strings', () => {
    const expected = [
      'epoxy flooring',
      'bathroom remodel',
      'kitchen remodel',
      'junk removal',
      'pool builders',
      'pressure washing',
      'window tinting',
      'paver sealing',
    ]
    for (const niche of expected) {
      expect(NICHE_CATEGORY_MAP[niche]).toBeDefined()
      expect(typeof NICHE_CATEGORY_MAP[niche]).toBe('string')
    }
  })
})

// --- extractDomain ---

describe('extractDomain', () => {
  it('returns domain from full URL, stripping www', () => {
    expect(extractDomain('https://www.example.com/about')).toBe('example.com')
  })

  it('returns domain without www when no www present', () => {
    expect(extractDomain('https://acmeplumbing.com/services?id=1')).toBe('acmeplumbing.com')
  })

  it('returns empty string for null/undefined', () => {
    expect(extractDomain(null)).toBe('')
    expect(extractDomain(undefined)).toBe('')
    expect(extractDomain('')).toBe('')
  })

  it('handles URLs with ports and query params', () => {
    expect(extractDomain('http://example.com:8080/page?q=test')).toBe('example.com')
  })
})

// --- assessWebsiteWeakness ---

describe('assessWebsiteWeakness', () => {
  it('returns no_website when url is null or empty', () => {
    expect(assessWebsiteWeakness({ url: null })).toBe('no_website')
    expect(assessWebsiteWeakness({ url: '' })).toBe('no_website')
    expect(assessWebsiteWeakness({})).toBe('no_website')
  })

  it('returns social_only when url is facebook.com or instagram.com', () => {
    expect(assessWebsiteWeakness({ url: 'https://www.facebook.com/mybiz' })).toBe('social_only')
    expect(assessWebsiteWeakness({ url: 'https://instagram.com/mybiz' })).toBe('social_only')
  })

  it('returns directory_only when url is yelp, angi, etc.', () => {
    expect(assessWebsiteWeakness({ url: 'https://www.yelp.com/biz/foo' })).toBe('directory_only')
    expect(assessWebsiteWeakness({ url: 'https://www.angi.com/foo' })).toBe('directory_only')
    expect(assessWebsiteWeakness({ url: 'https://www.homeadvisor.com/foo' })).toBe('directory_only')
  })

  it('returns no_organic_rank when url has a real domain', () => {
    expect(assessWebsiteWeakness({ url: 'https://acmejunk.com' })).toBe('no_organic_rank')
  })
})

// --- scorePitchPriority ---

describe('scorePitchPriority', () => {
  it('returns hot for no website + low reviews (≥3 signals)', () => {
    expect(scorePitchPriority({
      website_weakness: 'no_website',
      review_count: 5,
      rating: 3.5,
      is_claimed: false,
      fb_presence: 'not_found',
    })).toBe('hot')
  })

  it('returns hot for social-only website + unclaimed', () => {
    expect(scorePitchPriority({
      website_weakness: 'social_only',
      review_count: 10,
      rating: 4.2,
      is_claimed: false,
      fb_presence: 'not_found',
    })).toBe('hot')
  })

  it('returns warm for directory-only website with decent reviews (1-2 signals)', () => {
    expect(scorePitchPriority({
      website_weakness: 'directory_only',
      review_count: 50,
      rating: 4.5,
      is_claimed: true,
      fb_presence: 'not_found',
    })).toBe('warm')
  })

  it('returns cold for real website, high reviews, claimed (0 signals)', () => {
    expect(scorePitchPriority({
      website_weakness: 'no_organic_rank',
      review_count: 200,
      rating: 4.8,
      is_claimed: true,
      fb_presence: 'not_found',
    })).toBe('cold')
  })

  it('returns hot when fb_presence is advertising', () => {
    expect(scorePitchPriority({
      website_weakness: 'no_website',
      review_count: 5,
      rating: 3.0,
      is_claimed: false,
      fb_presence: 'advertising',
    })).toBe('hot')
  })
})

// --- generateBuyerSlug ---

describe('generateBuyerSlug', () => {
  it('slugifies name + city, strips special chars', () => {
    expect(generateBuyerSlug("Bob's Junk Removal", 'Georgetown')).toBe('bobs-junk-removal-georgetown')
  })

  it('handles multiple spaces and special chars', () => {
    expect(generateBuyerSlug('A & B  Cleaning Co.', 'Port St. Lucie')).toBe('a-b-cleaning-co-port-st-lucie')
  })
})

// --- deduplicateListings ---

describe('deduplicateListings', () => {
  it('removes dupe by phone, keeps higher review count', () => {
    const listings = [
      { phone: '555-1234', domain: 'a.com', review_count: 10, business_name: 'A' },
      { phone: '555-1234', domain: 'b.com', review_count: 20, business_name: 'B' },
    ]
    const result = deduplicateListings(listings)
    expect(result).toHaveLength(1)
    expect(result[0].business_name).toBe('B')
  })

  it('removes dupe by domain, keeps higher review count', () => {
    const listings = [
      { phone: '555-1111', domain: 'same.com', review_count: 30, business_name: 'X' },
      { phone: '555-2222', domain: 'same.com', review_count: 5, business_name: 'Y' },
    ]
    const result = deduplicateListings(listings)
    expect(result).toHaveLength(1)
    expect(result[0].business_name).toBe('X')
  })

  it('keeps distinct businesses', () => {
    const listings = [
      { phone: '555-1111', domain: 'a.com', review_count: 10, business_name: 'A' },
      { phone: '555-2222', domain: 'b.com', review_count: 20, business_name: 'B' },
    ]
    const result = deduplicateListings(listings)
    expect(result).toHaveLength(2)
  })

  it('handles empty phone and domain gracefully', () => {
    const listings = [
      { phone: '', domain: '', review_count: 10, business_name: 'A' },
      { phone: '', domain: '', review_count: 20, business_name: 'B' },
    ]
    const result = deduplicateListings(listings)
    expect(result).toHaveLength(2)
  })
})

// --- parseBusinessListing ---

describe('parseBusinessListing', () => {
  it('extracts all fields from complete API response', () => {
    const item = {
      title: 'Acme Junk Removal',
      phone: '+1-555-1234',
      url: 'https://www.acmejunk.com/services',
      address: '123 Main St',
      address_info: { city: 'Georgetown', region: 'Texas' },
      rating: { value: 4.5, votes_count: 42 },
      is_claimed: true,
    }
    const result = parseBusinessListing(item)
    expect(result.business_name).toBe('Acme Junk Removal')
    expect(result.phone).toBe('+1-555-1234')
    expect(result.website).toBe('https://www.acmejunk.com/services')
    expect(result.domain).toBe('acmejunk.com')
    expect(result.address).toBe('123 Main St')
    expect(result.city).toBe('Georgetown')
    expect(result.state).toBe('Texas')
    expect(result.rating).toBe(4.5)
    expect(result.review_count).toBe(42)
    expect(result.is_claimed).toBe(true)
  })

  it('handles missing optional fields', () => {
    const item = {
      title: 'No Phone Biz',
      phone: null,
      url: null,
      address: null,
      address_info: null,
      rating: null,
      is_claimed: false,
    }
    const result = parseBusinessListing(item)
    expect(result.business_name).toBe('No Phone Biz')
    expect(result.phone).toBe('')
    expect(result.website).toBe('')
    expect(result.domain).toBe('')
    expect(result.address).toBe('')
    expect(result.city).toBe('')
    expect(result.state).toBe('')
    expect(result.rating).toBe(0)
    expect(result.review_count).toBe(0)
    expect(result.is_claimed).toBe(false)
  })

  it('extracts contact_info when present', () => {
    const item = {
      title: 'Contact Biz',
      phone: '+1-555-1234',
      url: null,
      address: null,
      address_info: null,
      rating: null,
      is_claimed: false,
      contact_info: [
        { type: 'email', value: 'info@biz.com' },
        { type: 'telephone', value: '+1-555-9999' },
      ],
    }
    const result = parseBusinessListing(item)
    expect(result.contact_info).toHaveLength(2)
    expect(result.contact_info[0].value).toBe('info@biz.com')
  })

  it('handles missing contact_info', () => {
    const item = {
      title: 'No Contact Biz',
      phone: '+1-555-1234',
      url: null,
      address: null,
      address_info: null,
      rating: null,
      is_claimed: false,
    }
    const result = parseBusinessListing(item)
    expect(result.contact_info).toEqual([])
  })
})

// --- parseBuyersCsv / serializeBuyersCsv ---

describe('parseBuyersCsv / serializeBuyersCsv', () => {
  it('round-trips a buyer row with enrichment columns', () => {
    const rows = [{
      candidate_slug: 'junk-removal-georgetown',
      business_name: 'Acme Junk',
      phone: '555-1234',
      website: 'https://acme.com',
      domain: 'acme.com',
      address: '123 Main St',
      city: 'Georgetown',
      state: 'Texas',
      rating: '4.5',
      review_count: '42',
      is_claimed: 'true',
      source: 'google_maps',
      has_website: 'true',
      website_weakness: 'no_organic_rank',
      fb_presence: 'not_found',
      pitch_priority: 'warm',
      notes: 'Has website but no organic rank',
      researched_date: '2026-11-09',
      owner_name: 'Bob Smith',
      owner_name_source: 'SITE',
      email: 'bob@acme.com',
      email_source: 'GBP',
      phone_source: 'GBP',
      website_source: '',
      enriched_date: '2026-11-10',
    }]
    const csv = serializeBuyersCsv(rows)
    const parsed = parseBuyersCsv(csv)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].candidate_slug).toBe('junk-removal-georgetown')
    expect(parsed[0].business_name).toBe('Acme Junk')
    expect(parsed[0].pitch_priority).toBe('warm')
    expect(parsed[0].owner_name).toBe('Bob Smith')
    expect(parsed[0].owner_name_source).toBe('SITE')
    expect(parsed[0].email).toBe('bob@acme.com')
    expect(parsed[0].email_source).toBe('GBP')
    expect(parsed[0].phone_source).toBe('GBP')
    expect(parsed[0].enriched_date).toBe('2026-11-10')
  })

  it('handles commas in business names (quoting)', () => {
    const rows = [{
      candidate_slug: 'junk-removal-georgetown',
      business_name: 'Acme, Inc.',
      phone: '',
      website: '',
      domain: '',
      address: '',
      city: 'Georgetown',
      state: 'Texas',
      rating: '0',
      review_count: '0',
      is_claimed: 'false',
      source: 'facebook',
      has_website: 'false',
      website_weakness: 'no_website',
      fb_presence: 'found',
      pitch_priority: 'hot',
      notes: 'No website — hungry for leads',
      researched_date: '2026-11-09',
      owner_name: '',
      owner_name_source: '',
      email: '',
      email_source: '',
      phone_source: '',
      website_source: '',
      enriched_date: '',
    }]
    const csv = serializeBuyersCsv(rows)
    expect(csv).toContain('"Acme, Inc."')
    const parsed = parseBuyersCsv(csv)
    expect(parsed[0].business_name).toBe('Acme, Inc.')
  })

  it('parses old CSV without enrichment columns gracefully', () => {
    const oldCsv = 'candidate_slug,business_name,phone,website,domain,address,city,state,rating,review_count,is_claimed,source,has_website,website_weakness,fb_presence,pitch_priority,notes,researched_date\njunk-removal-georgetown,Acme,555,,,,Georgetown,Texas,4.5,10,true,google_maps,false,no_website,not_found,hot,note,2026-11-09'
    const parsed = parseBuyersCsv(oldCsv)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].candidate_slug).toBe('junk-removal-georgetown')
    expect(parsed[0].owner_name).toBeUndefined()
    expect(parsed[0].email).toBeUndefined()
  })
})

// --- buildFacebookSearchQuery ---

describe('buildFacebookSearchQuery', () => {
  it('returns niche city state site:facebook.com query', () => {
    const q = buildFacebookSearchQuery('junk removal', 'Georgetown', 'Texas')
    expect(q).toBe('"junk removal Georgetown Texas" site:facebook.com')
  })
})

// --- generatePitchNote ---

describe('generatePitchNote', () => {
  it('generates note for no website business', () => {
    const note = generatePitchNote({
      website_weakness: 'no_website',
      rating: 4.8,
      review_count: 12,
      is_claimed: true,
      fb_presence: 'not_found',
    })
    expect(note).toContain('No website')
    expect(note).toContain('4.8')
    expect(note).toContain('12')
  })

  it('generates note for Facebook-only, unclaimed GMB', () => {
    const note = generatePitchNote({
      website_weakness: 'social_only',
      rating: 0,
      review_count: 0,
      is_claimed: false,
      fb_presence: 'found',
    })
    expect(note).toContain('Social only')
    expect(note).toContain('unclaimed')
  })
})

// --- extractContactInfo ---

describe('extractContactInfo', () => {
  it('returns empty arrays for null input', () => {
    const result = extractContactInfo(null)
    expect(result).toEqual({ phones: [], emails: [] })
  })

  it('returns empty arrays for empty array', () => {
    const result = extractContactInfo([])
    expect(result).toEqual({ phones: [], emails: [] })
  })

  it('extracts telephone entries', () => {
    const result = extractContactInfo([
      { type: 'telephone', value: '+1-555-1234' },
    ])
    expect(result.phones).toEqual([{ value: '+1-555-1234', source: 'GBP' }])
    expect(result.emails).toEqual([])
  })

  it('extracts email entries', () => {
    const result = extractContactInfo([
      { type: 'email', value: 'bob@acme.com' },
    ])
    expect(result.emails).toEqual([{ value: 'bob@acme.com', source: 'GBP' }])
    expect(result.phones).toEqual([])
  })

  it('handles mixed types', () => {
    const result = extractContactInfo([
      { type: 'telephone', value: '+1-555-1234' },
      { type: 'email', value: 'bob@acme.com' },
      { type: 'fax', value: '+1-555-9999' },
    ])
    expect(result.phones).toHaveLength(1)
    expect(result.emails).toHaveLength(1)
  })

  it('deduplicates values', () => {
    const result = extractContactInfo([
      { type: 'email', value: 'bob@acme.com' },
      { type: 'email', value: 'bob@acme.com' },
    ])
    expect(result.emails).toHaveLength(1)
  })

  it('handles entries with cell_phone type as phone', () => {
    const result = extractContactInfo([
      { type: 'cell_phone', value: '+1-555-9876' },
    ])
    expect(result.phones).toEqual([{ value: '+1-555-9876', source: 'GBP' }])
  })

  it('recognizes "mail" type as email (DataForSEO uses "mail" not "email")', () => {
    const result = extractContactInfo([
      { type: 'mail', value: 'info@biz.com' },
    ])
    expect(result.emails).toEqual([{ value: 'info@biz.com', source: 'GBP' }])
  })
})

// --- parseGbpContactInfo ---

describe('parseGbpContactInfo', () => {
  it('picks first phone and first email', () => {
    const result = parseGbpContactInfo([
      { type: 'telephone', value: '+1-555-1111' },
      { type: 'telephone', value: '+1-555-2222' },
      { type: 'email', value: 'first@a.com' },
      { type: 'email', value: 'second@b.com' },
    ])
    expect(result.phone).toBe('+1-555-1111')
    expect(result.phone_source).toBe('GBP')
    expect(result.email).toBe('first@a.com')
    expect(result.email_source).toBe('GBP')
  })

  it('returns empty strings when nothing found', () => {
    const result = parseGbpContactInfo([])
    expect(result.phone).toBe('')
    expect(result.phone_source).toBe('')
    expect(result.email).toBe('')
    expect(result.email_source).toBe('')
  })

  it('handles null input', () => {
    const result = parseGbpContactInfo(null)
    expect(result.phone).toBe('')
    expect(result.email).toBe('')
  })
})

// --- mergeContactData ---

describe('mergeContactData', () => {
  it('fills empty email field', () => {
    const row = { email: '', email_source: '' }
    const result = mergeContactData(row, { email: 'new@a.com', email_source: 'GBP' })
    expect(result.email).toBe('new@a.com')
    expect(result.email_source).toBe('GBP')
  })

  it('does not overwrite existing phone', () => {
    const row = { phone: '555-1234', phone_source: 'GBP' }
    const result = mergeContactData(row, { phone: '555-9999', phone_source: 'SITE' })
    expect(result.phone).toBe('555-1234')
    expect(result.phone_source).toBe('GBP')
  })

  it('fills website and auto-populates domain', () => {
    const row = { website: '', domain: '', website_source: '' }
    const result = mergeContactData(row, { website: 'https://www.acme.com/about', website_source: 'GBP' })
    expect(result.website).toBe('https://www.acme.com/about')
    expect(result.domain).toBe('acme.com')
    expect(result.website_source).toBe('GBP')
  })

  it('fills owner_name', () => {
    const row = { owner_name: '', owner_name_source: '' }
    const result = mergeContactData(row, { owner_name: 'Bob Smith', owner_name_source: 'SITE' })
    expect(result.owner_name).toBe('Bob Smith')
    expect(result.owner_name_source).toBe('SITE')
  })

  it('no-op when newContactData is empty object', () => {
    const row = { email: 'keep@me.com', email_source: 'GBP', phone: '555-1234', phone_source: 'GBP' }
    const result = mergeContactData(row, {})
    expect(result.email).toBe('keep@me.com')
    expect(result.phone).toBe('555-1234')
  })

  it('handles null newContactData', () => {
    const row = { email: '', phone: '555-1234' }
    const result = mergeContactData(row, null)
    expect(result.phone).toBe('555-1234')
    expect(result.email).toBe('')
  })
})

// --- buildEnrichmentSummary ---

describe('buildEnrichmentSummary', () => {
  it('counts correct totals', () => {
    const buyers = [
      { email: 'a@b.com', phone: '555', owner_name: 'Bob', website: 'https://a.com', email_source: 'GBP', phone_source: 'GBP', owner_name_source: 'GBP', website_source: 'GBP' },
      { email: '', phone: '555', owner_name: '', website: '', email_source: '', phone_source: 'SITE', owner_name_source: '', website_source: '' },
      { email: 'c@d.com', phone: '', owner_name: '', website: 'https://c.com', email_source: 'SITE', phone_source: '', owner_name_source: '', website_source: 'SITE' },
    ]
    const summary = buildEnrichmentSummary(buyers)
    expect(summary.total).toBe(3)
    expect(summary.withEmail).toBe(2)
    expect(summary.withPhone).toBe(2)
    expect(summary.withOwner).toBe(1)
    expect(summary.withWebsite).toBe(2)
  })

  it('counts correct source breakdown', () => {
    const buyers = [
      { email: 'a@b.com', email_source: 'GBP', phone: '', phone_source: '', owner_name: '', owner_name_source: '', website: '', website_source: '' },
      { email: 'c@d.com', email_source: 'SITE', phone: '555', phone_source: 'GBP', owner_name: '', owner_name_source: '', website: '', website_source: '' },
      { email: 'e@f.com', email_source: 'FB', phone: '', phone_source: '', owner_name: 'Joe', owner_name_source: 'FB', website: '', website_source: '' },
    ]
    const summary = buildEnrichmentSummary(buyers)
    expect(summary.bySource.GBP).toBe(2) // email GBP + phone GBP
    expect(summary.bySource.SITE).toBe(1)
    expect(summary.bySource.FB).toBe(2) // email FB + owner FB
  })

  it('returns zeros for empty input', () => {
    const summary = buildEnrichmentSummary([])
    expect(summary.total).toBe(0)
    expect(summary.withEmail).toBe(0)
    expect(summary.withPhone).toBe(0)
    expect(summary.withOwner).toBe(0)
    expect(summary.withWebsite).toBe(0)
    expect(summary.bySource).toEqual({ GBP: 0, SITE: 0, FB: 0 })
  })
})

// --- extractEmailFromText ---

describe('extractEmailFromText', () => {
  it('extracts a plain email from body text', () => {
    expect(extractEmailFromText('Contact us at bob@acmejunk.com for a quote')).toBe('bob@acmejunk.com')
  })

  it('skips generic emails and returns first non-generic', () => {
    const text = 'noreply@acme.com support@acme.com bob@acme.com'
    expect(extractEmailFromText(text)).toBe('bob@acme.com')
  })

  it('returns empty string when only generic emails present', () => {
    const text = 'Email us at noreply@example.com or admin@example.com'
    expect(extractEmailFromText(text)).toBe('')
  })

  it('filters out sentry and example.com domains', () => {
    const text = 'error@sentry.io test@example.com'
    expect(extractEmailFromText(text)).toBe('')
  })

  it('returns empty string when no emails present', () => {
    expect(extractEmailFromText('No contact info here')).toBe('')
  })

  it('handles null and empty input', () => {
    expect(extractEmailFromText(null)).toBe('')
    expect(extractEmailFromText('')).toBe('')
    expect(extractEmailFromText(undefined)).toBe('')
  })

  it('extracts email from mailto link text', () => {
    expect(extractEmailFromText('href="mailto:info@realjunk.com"')).toBe('info@realjunk.com')
  })

  it('filters out info@wordpress domains', () => {
    expect(extractEmailFromText('info@wordpress.com real@biz.com')).toBe('real@biz.com')
  })
})

// --- extractOwnerFromText ---

describe('extractOwnerFromText', () => {
  it('extracts "Owner: Name" pattern', () => {
    expect(extractOwnerFromText('Owner: John Smith')).toBe('John Smith')
  })

  it('extracts "Owned by Name" pattern', () => {
    expect(extractOwnerFromText('Owned by Maria Garcia')).toBe('Maria Garcia')
  })

  it('extracts "Founded by Name" pattern', () => {
    expect(extractOwnerFromText('Founded by David Lee')).toBe('David Lee')
  })

  it('extracts "CEO: Name" pattern', () => {
    expect(extractOwnerFromText('CEO: Sarah Johnson')).toBe('Sarah Johnson')
  })

  it('extracts "President: Name" pattern', () => {
    expect(extractOwnerFromText('President: Mike Brown')).toBe('Mike Brown')
  })

  it('returns empty string when no pattern matches', () => {
    expect(extractOwnerFromText('We provide quality service in your area.')).toBe('')
  })

  it('handles null and empty input', () => {
    expect(extractOwnerFromText(null)).toBe('')
    expect(extractOwnerFromText('')).toBe('')
    expect(extractOwnerFromText(undefined)).toBe('')
  })

  it('extracts name from "Meet Name" heading context', () => {
    expect(extractOwnerFromText('Meet Bob Wilson, our founder')).toBe('Bob Wilson')
  })
})

// --- buildContactPageUrls ---

describe('buildContactPageUrls', () => {
  it('returns homepage + common contact/about pages', () => {
    const urls = buildContactPageUrls('https://acmejunk.com')
    expect(urls).toContain('https://acmejunk.com')
    expect(urls).toContain('https://acmejunk.com/contact')
    expect(urls).toContain('https://acmejunk.com/contact-us')
    expect(urls).toContain('https://acmejunk.com/about')
    expect(urls).toContain('https://acmejunk.com/about-us')
    expect(urls).toHaveLength(5)
  })

  it('handles trailing slash', () => {
    const urls = buildContactPageUrls('https://acmejunk.com/')
    expect(urls[0]).toBe('https://acmejunk.com')
    expect(urls).toContain('https://acmejunk.com/contact')
  })

  it('handles URL with path by using origin only', () => {
    const urls = buildContactPageUrls('https://acmejunk.com/services/junk')
    expect(urls[0]).toBe('https://acmejunk.com')
    expect(urls).toContain('https://acmejunk.com/contact')
  })

  it('adds protocol when missing', () => {
    const urls = buildContactPageUrls('acmejunk.com')
    expect(urls[0]).toBe('https://acmejunk.com')
    expect(urls).toContain('https://acmejunk.com/about')
  })

  it('returns empty array for null/empty input', () => {
    expect(buildContactPageUrls(null)).toEqual([])
    expect(buildContactPageUrls('')).toEqual([])
    expect(buildContactPageUrls(undefined)).toEqual([])
  })
})
