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
})

// --- parseBuyersCsv / serializeBuyersCsv ---

describe('parseBuyersCsv / serializeBuyersCsv', () => {
  it('round-trips a buyer row', () => {
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
    }]
    const csv = serializeBuyersCsv(rows)
    const parsed = parseBuyersCsv(csv)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].candidate_slug).toBe('junk-removal-georgetown')
    expect(parsed[0].business_name).toBe('Acme Junk')
    expect(parsed[0].pitch_priority).toBe('warm')
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
    }]
    const csv = serializeBuyersCsv(rows)
    expect(csv).toContain('"Acme, Inc."')
    const parsed = parseBuyersCsv(csv)
    expect(parsed[0].business_name).toBe('Acme, Inc.')
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
