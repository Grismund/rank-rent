import { describe, it, expect } from 'vitest'
import {
  generateSlug,
  generatePhrases,
  isDirectoryDomain,
  isLicensedTrade,
  parseCandidatesCsv,
  serializeCandidatesCsv,
} from '../lib/candidates.js'

describe('generateSlug', () => {
  it('generates kebab-case slug from niche and town', () => {
    expect(generateSlug('house cleaning', 'McKinney')).toBe('house-cleaning-mckinney')
  })

  it('handles multi-word town names', () => {
    expect(generateSlug('lawn care', 'Fort Worth')).toBe('lawn-care-fort-worth')
  })

  it('strips extra whitespace', () => {
    expect(generateSlug('  tree trimming ', ' Allen ')).toBe('tree-trimming-allen')
  })

  it('lowercases everything', () => {
    expect(generateSlug('Pest Control', 'PLANO')).toBe('pest-control-plano')
  })
})

describe('generatePhrases', () => {
  it('returns an array of 5–10 phrases', () => {
    const phrases = generatePhrases('house cleaning', 'McKinney', 'Texas')
    expect(phrases.length).toBeGreaterThanOrEqual(5)
    expect(phrases.length).toBeLessThanOrEqual(10)
  })

  it('includes the primary phrase (niche + town)', () => {
    const phrases = generatePhrases('house cleaning', 'McKinney', 'Texas')
    expect(phrases).toContain('house cleaning mckinney')
  })

  it('includes variations with state', () => {
    const phrases = generatePhrases('lawn care', 'Plano', 'Texas')
    const hasState = phrases.some((p) => p.includes('tx') || p.includes('texas'))
    expect(hasState).toBe(true)
  })

  it('includes "near me" variant', () => {
    const phrases = generatePhrases('pest control', 'Allen', 'Texas')
    const hasNearMe = phrases.some((p) => p.includes('near me'))
    expect(hasNearMe).toBe(true)
  })

  it('all phrases are lowercase strings', () => {
    const phrases = generatePhrases('Tree Trimming', 'Fort Worth', 'Texas')
    phrases.forEach((p) => {
      expect(typeof p).toBe('string')
      expect(p).toBe(p.toLowerCase())
    })
  })
})

describe('isDirectoryDomain', () => {
  it('returns true for exact directory domain', () => {
    expect(isDirectoryDomain('yelp.com')).toBe(true)
    expect(isDirectoryDomain('angi.com')).toBe(true)
  })

  it('returns true for subdomain of directory domain', () => {
    expect(isDirectoryDomain('www.yelp.com')).toBe(true)
    expect(isDirectoryDomain('m.thumbtack.com')).toBe(true)
  })

  it('returns false for non-directory domain', () => {
    expect(isDirectoryDomain('localbiz.com')).toBe(false)
    expect(isDirectoryDomain('yelper.com')).toBe(false)
  })
})

describe('isLicensedTrade', () => {
  it('returns true for licensed trades', () => {
    expect(isLicensedTrade('plumbing')).toBe(true)
    expect(isLicensedTrade('electrical')).toBe(true)
    expect(isLicensedTrade('hvac')).toBe(true)
  })

  it('returns false for unlicensed services', () => {
    expect(isLicensedTrade('house cleaning')).toBe(false)
    expect(isLicensedTrade('lawn care')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isLicensedTrade('PLUMBING')).toBe(true)
    expect(isLicensedTrade('Hvac')).toBe(true)
  })
})

describe('parseCandidatesCsv / serializeCandidatesCsv', () => {
  const csvString = `slug,niche,area,region,primary_phrase,phrases,population,license_barrier,franchise_dominated,vol_total,vol_primary,cpc,map_pack_weak,organic_weak,renter_count,seasonality,rent_estimate,score_vol,score_cpc,score_map,score_organic,score_renters,score_license,score_season,score_rent,score_total,status,validated_date,teardown_date
house-cleaning-mckinney,house cleaning,McKinney,DFW,house cleaning McKinney,house cleaning McKinney|maid service McKinney,200000,none,false,,,,,,,,,,,,,,,,,,discovered,,`

  it('parses CSV string into array of row objects', () => {
    const rows = parseCandidatesCsv(csvString)
    expect(rows).toHaveLength(1)
    expect(rows[0].slug).toBe('house-cleaning-mckinney')
    expect(rows[0].niche).toBe('house cleaning')
    expect(rows[0].area).toBe('McKinney')
    expect(rows[0].status).toBe('discovered')
  })

  it('parses pipe-delimited phrases', () => {
    const rows = parseCandidatesCsv(csvString)
    expect(rows[0].phrases).toBe('house cleaning McKinney|maid service McKinney')
  })

  it('round-trips correctly', () => {
    const rows = parseCandidatesCsv(csvString)
    const serialized = serializeCandidatesCsv(rows)
    const reparsed = parseCandidatesCsv(serialized)
    expect(reparsed).toEqual(rows)
  })

  it('handles empty CSV (header only)', () => {
    const headerOnly = 'slug,niche,area,region,primary_phrase,phrases,population,license_barrier,franchise_dominated,vol_total,vol_primary,cpc,map_pack_weak,organic_weak,renter_count,seasonality,rent_estimate,score_vol,score_cpc,score_map,score_organic,score_renters,score_license,score_season,score_rent,score_total,status,validated_date,teardown_date'
    const rows = parseCandidatesCsv(headerOnly)
    expect(rows).toHaveLength(0)
  })

  it('serializes with header row', () => {
    const rows = [{ slug: 'test-slug', niche: 'test', area: 'Town', region: 'Region', primary_phrase: 'test Town', phrases: 'test Town|test near me', population: '50000', license_barrier: 'none', franchise_dominated: 'false', vol_total: '', vol_primary: '', cpc: '', map_pack_weak: '', organic_weak: '', renter_count: '', seasonality: '', rent_estimate: '', score_vol: '', score_cpc: '', score_map: '', score_organic: '', score_renters: '', score_license: '', score_season: '', score_rent: '', score_total: '', status: 'discovered', validated_date: '', teardown_date: '' }]
    const csv = serializeCandidatesCsv(rows)
    expect(csv.startsWith('slug,niche,')).toBe(true)
    expect(csv).toContain('test-slug')
  })
})
