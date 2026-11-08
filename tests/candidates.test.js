import { describe, it, expect } from 'vitest'
import {
  generateSlug,
  generatePhrases,
  isDirectoryDomain,
  isPlatformDomain,
  isNicheCompetitor,
  isLicensedTrade,
  parseCandidatesCsv,
  serializeCandidatesCsv,
  extractNicheFromKeyword,
  normalizeNiche,
  isServiceKeyword,
  clusterNiches,
  filterNewNiches,
  classifyHomeService,
  extractCompetitorDomains,
  updateCandidateStatuses,
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
  const csvString = `slug,niche,area,region,primary_phrase,phrases,population,license_barrier,franchise_dominated,vol_total,vol_primary,cpc,map_pack_weak,organic_weak,renter_count,seasonality,rent_estimate,score_vol,score_cpc,score_map,score_organic,score_renters,score_license,score_season,score_rent,score_total,status,validated_date,teardown_date,viability_date
house-cleaning-mckinney,house cleaning,McKinney,DFW,house cleaning McKinney,house cleaning McKinney|maid service McKinney,200000,none,false,,,,,,,,,,,,,,,,,,discovered,,,`

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
    const headerOnly = 'slug,niche,area,region,primary_phrase,phrases,population,license_barrier,franchise_dominated,vol_total,vol_primary,cpc,map_pack_weak,organic_weak,renter_count,seasonality,rent_estimate,score_vol,score_cpc,score_map,score_organic,score_renters,score_license,score_season,score_rent,score_total,status,validated_date,teardown_date,viability_date'
    const rows = parseCandidatesCsv(headerOnly)
    expect(rows).toHaveLength(0)
  })

  it('serializes with header row', () => {
    const rows = [{ slug: 'test-slug', niche: 'test', area: 'Town', region: 'Region', primary_phrase: 'test Town', phrases: 'test Town|test near me', population: '50000', license_barrier: 'none', franchise_dominated: 'false', vol_total: '', vol_primary: '', cpc: '', map_pack_weak: '', organic_weak: '', renter_count: '', seasonality: '', rent_estimate: '', score_vol: '', score_cpc: '', score_map: '', score_organic: '', score_renters: '', score_license: '', score_season: '', score_rent: '', score_total: '', status: 'discovered', validated_date: '', teardown_date: '', viability_date: '' }]
    const csv = serializeCandidatesCsv(rows)
    expect(csv.startsWith('slug,niche,')).toBe(true)
    expect(csv).toContain('test-slug')
  })
})

describe('extractNicheFromKeyword', () => {
  it('extracts service from keyword with city', () => {
    expect(extractNicheFromKeyword('junk removal houston')).toBe('junk removal')
  })

  it('extracts service from keyword with city and state', () => {
    expect(extractNicheFromKeyword('pressure washing dallas tx')).toBe('pressure washing')
  })

  it('extracts service from keyword with "near me"', () => {
    expect(extractNicheFromKeyword('fence installation near me')).toBe('fence installation')
  })

  it('extracts service from keyword with "in city"', () => {
    expect(extractNicheFromKeyword('tree removal in abilene')).toBe('tree removal')
  })

  it('handles multi-word city names', () => {
    expect(extractNicheFromKeyword('deck staining fort worth tx')).toBe('deck staining')
  })

  it('returns the whole keyword when no city/location found', () => {
    expect(extractNicheFromKeyword('concrete leveling')).toBe('concrete leveling')
  })

  it('strips "services" suffix', () => {
    expect(extractNicheFromKeyword('cleaning services dallas')).toBe('cleaning')
  })

  it('strips "company" and "companies" suffixes', () => {
    expect(extractNicheFromKeyword('roofing company near me')).toBe('roofing')
    expect(extractNicheFromKeyword('roofing companies near me')).toBe('roofing')
  })

  it('strips "cost" and "prices" suffixes', () => {
    expect(extractNicheFromKeyword('junk removal cost')).toBe('junk removal')
    expect(extractNicheFromKeyword('pressure washing prices')).toBe('pressure washing')
  })

  it('handles explicit city parameter', () => {
    expect(extractNicheFromKeyword('junk removal houston tx', 'houston')).toBe('junk removal')
  })

  it('lowercases the result', () => {
    expect(extractNicheFromKeyword('Junk Removal Houston')).toBe('junk removal')
  })

  it('trims whitespace', () => {
    expect(extractNicheFromKeyword('  junk removal  houston  ')).toBe('junk removal')
  })
})

describe('normalizeNiche', () => {
  it('returns canonical form for known synonyms', () => {
    expect(normalizeNiche('concrete lifting')).toBe('concrete leveling')
    expect(normalizeNiche('mudjacking')).toBe('concrete leveling')
    expect(normalizeNiche('slab jacking')).toBe('concrete leveling')
  })

  it('collapses power washing to pressure washing', () => {
    expect(normalizeNiche('power washing')).toBe('pressure washing')
  })

  it('collapses trash removal to junk removal', () => {
    expect(normalizeNiche('trash removal')).toBe('junk removal')
    expect(normalizeNiche('debris removal')).toBe('junk removal')
    expect(normalizeNiche('rubbish removal')).toBe('junk removal')
  })

  it('collapses yard cleanup variants', () => {
    expect(normalizeNiche('yard cleanup')).toBe('yard clean up')
    expect(normalizeNiche('yard clean-up')).toBe('yard clean up')
  })

  it('returns the input when no synonym match', () => {
    expect(normalizeNiche('fence installation')).toBe('fence installation')
  })

  it('is case-insensitive', () => {
    expect(normalizeNiche('Power Washing')).toBe('pressure washing')
  })

  it('trims whitespace', () => {
    expect(normalizeNiche('  junk removal  ')).toBe('junk removal')
  })
})

describe('isServiceKeyword', () => {
  it('returns true for home service keywords', () => {
    expect(isServiceKeyword('junk removal')).toBe(true)
    expect(isServiceKeyword('pressure washing houston')).toBe(true)
    expect(isServiceKeyword('fence installation near me')).toBe(true)
  })

  it('returns false for medical noise', () => {
    expect(isServiceKeyword('tattoo removal')).toBe(false)
    expect(isServiceKeyword('laser hair removal near me')).toBe(false)
    expect(isServiceKeyword('mole removal cost')).toBe(false)
  })

  it('returns false for software noise', () => {
    expect(isServiceKeyword('malware removal')).toBe(false)
    expect(isServiceKeyword('virus removal service')).toBe(false)
  })

  it('returns false for cosmetic noise', () => {
    expect(isServiceKeyword('laser removal')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isServiceKeyword('Tattoo Removal')).toBe(false)
    expect(isServiceKeyword('Junk Removal')).toBe(true)
  })
})

describe('clusterNiches', () => {
  it('groups keywords by normalized niche with correct stats', () => {
    const keywords = [
      { keyword: 'junk removal houston', search_volume: 1000, cpc: 12 },
      { keyword: 'junk removal dallas', search_volume: 800, cpc: 14 },
      { keyword: 'pressure washing houston', search_volume: 500, cpc: 10 },
    ]
    const clusters = clusterNiches(keywords, { minVolume: 0, minCpc: 0 })
    expect(clusters).toHaveLength(2)
    const junk = clusters.find((c) => c.niche === 'junk removal')
    expect(junk).toBeDefined()
    expect(junk.total_volume).toBe(1800)
    expect(junk.avg_cpc).toBe(13)
    expect(junk.keyword_count).toBe(2)
    expect(junk.top_keywords).toHaveLength(2)
  })

  it('collapses synonyms via normalizeNiche', () => {
    const keywords = [
      { keyword: 'power washing houston', search_volume: 600, cpc: 11 },
      { keyword: 'pressure washing dallas', search_volume: 400, cpc: 12 },
    ]
    const clusters = clusterNiches(keywords, { minVolume: 0, minCpc: 0 })
    expect(clusters).toHaveLength(1)
    expect(clusters[0].niche).toBe('pressure washing')
    expect(clusters[0].total_volume).toBe(1000)
  })

  it('filters out noise via isServiceKeyword', () => {
    const keywords = [
      { keyword: 'tattoo removal houston', search_volume: 5000, cpc: 20 },
      { keyword: 'junk removal houston', search_volume: 1000, cpc: 12 },
    ]
    const clusters = clusterNiches(keywords, { minVolume: 0, minCpc: 0 })
    expect(clusters).toHaveLength(1)
    expect(clusters[0].niche).toBe('junk removal')
  })

  it('filters out licensed trades via isLicensedTrade', () => {
    const keywords = [
      { keyword: 'plumbing houston', search_volume: 5000, cpc: 25 },
      { keyword: 'junk removal houston', search_volume: 1000, cpc: 12 },
    ]
    const clusters = clusterNiches(keywords, { minVolume: 0, minCpc: 0 })
    expect(clusters).toHaveLength(1)
    expect(clusters[0].niche).toBe('junk removal')
  })

  it('returns clusters sorted by total_volume * avg_cpc descending', () => {
    const keywords = [
      { keyword: 'fence installation houston', search_volume: 300, cpc: 10 },
      { keyword: 'junk removal houston', search_volume: 1000, cpc: 12 },
      { keyword: 'pressure washing houston', search_volume: 500, cpc: 15 },
    ]
    const clusters = clusterNiches(keywords, { minVolume: 0, minCpc: 0 })
    // junk: 1000*12=12000, pressure: 500*15=7500, fence: 300*10=3000
    expect(clusters[0].niche).toBe('junk removal')
    expect(clusters[1].niche).toBe('pressure washing')
    expect(clusters[2].niche).toBe('fence installation')
  })

  it('respects minVolume option', () => {
    const keywords = [
      { keyword: 'junk removal houston', search_volume: 1000, cpc: 12 },
      { keyword: 'fence installation houston', search_volume: 300, cpc: 10 },
    ]
    const clusters = clusterNiches(keywords, { minVolume: 500, minCpc: 0 })
    expect(clusters).toHaveLength(1)
    expect(clusters[0].niche).toBe('junk removal')
  })

  it('respects minCpc option', () => {
    const keywords = [
      { keyword: 'junk removal houston', search_volume: 1000, cpc: 12 },
      { keyword: 'fence installation houston', search_volume: 500, cpc: 5 },
    ]
    const clusters = clusterNiches(keywords, { minVolume: 0, minCpc: 10 })
    expect(clusters).toHaveLength(1)
    expect(clusters[0].niche).toBe('junk removal')
  })

  it('uses defaults of minVolume=1000 and minCpc=10 when no options', () => {
    const keywords = [
      { keyword: 'junk removal houston', search_volume: 2000, cpc: 12 },
      { keyword: 'fence installation houston', search_volume: 500, cpc: 15 },
      { keyword: 'pressure washing houston', search_volume: 1500, cpc: 5 },
    ]
    const clusters = clusterNiches(keywords)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].niche).toBe('junk removal')
  })

  it('returns empty array for empty input', () => {
    expect(clusterNiches([])).toEqual([])
  })

  it('limits top_keywords to 5 entries sorted by volume', () => {
    const cities = ['houston', 'dallas', 'austin', 'tucson', 'tulsa', 'odessa', 'midland', 'lubbock']
    const keywords = cities.map((city, i) => ({
      keyword: `junk removal ${city}`,
      search_volume: (i + 1) * 100,
      cpc: 12,
    }))
    const clusters = clusterNiches(keywords, { minVolume: 0, minCpc: 0 })
    expect(clusters[0].top_keywords).toHaveLength(5)
    // highest volume first — lubbock has 800
    expect(clusters[0].top_keywords[0].keyword).toBe('junk removal lubbock')
  })
})

describe('isPlatformDomain', () => {
  it('identifies google.com as a platform', () => {
    expect(isPlatformDomain('google.com')).toBe(true)
    expect(isPlatformDomain('www.google.com')).toBe(true)
  })

  it('identifies social media platforms', () => {
    expect(isPlatformDomain('facebook.com')).toBe(true)
    expect(isPlatformDomain('instagram.com')).toBe(true)
    expect(isPlatformDomain('youtube.com')).toBe(true)
  })

  it('does not flag real business domains', () => {
    expect(isPlatformDomain('localbiz.com')).toBe(false)
    expect(isPlatformDomain('houstonplumbing.com')).toBe(false)
  })
})

describe('isNicheCompetitor', () => {
  it('returns false for directory domains', () => {
    expect(isNicheCompetitor('yelp.com')).toBe(false)
    expect(isNicheCompetitor('www.thumbtack.com')).toBe(false)
  })

  it('returns false for platform domains', () => {
    expect(isNicheCompetitor('google.com')).toBe(false)
    expect(isNicheCompetitor('facebook.com')).toBe(false)
  })

  it('returns true for actual business domains', () => {
    expect(isNicheCompetitor('houstonplumbing.com')).toBe(true)
    expect(isNicheCompetitor('texaspfs.com')).toBe(true)
  })
})

describe('classifyHomeService', () => {
  it('returns true for known home services', () => {
    expect(classifyHomeService('bathroom remodeling')).toBe(true)
    expect(classifyHomeService('attic insulation')).toBe(true)
    expect(classifyHomeService('driveway paving')).toBe(true)
    expect(classifyHomeService('crawl space encapsulation')).toBe(true)
    expect(classifyHomeService('window tinting')).toBe(true)
    expect(classifyHomeService('paver sealing')).toBe(true)
    expect(classifyHomeService('junk removal')).toBe(true)
    expect(classifyHomeService('fence installation')).toBe(true)
  })

  it('returns false for medical terms', () => {
    expect(classifyHomeService('colonoscopy')).toBe(false)
    expect(classifyHomeService('hair loss treatment')).toBe(false)
    expect(classifyHomeService('psoriasis treatment')).toBe(false)
    expect(classifyHomeService('mammogram')).toBe(false)
    expect(classifyHomeService('hormone therapy')).toBe(false)
    expect(classifyHomeService('uti treatment')).toBe(false)
  })

  it('returns false for financial/generic terms', () => {
    expect(classifyHomeService('currency converter')).toBe(false)
    expect(classifyHomeService('gpa conversion')).toBe(false)
    expect(classifyHomeService('xml to json converter')).toBe(false)
  })

  it('returns false for single generic words', () => {
    expect(classifyHomeService('maintenance')).toBe(false)
    expect(classifyHomeService('insulation')).toBe(false)
    expect(classifyHomeService('screening')).toBe(false)
    expect(classifyHomeService('treatment')).toBe(false)
  })

  it('returns true for standalone service words', () => {
    expect(classifyHomeService('landscaping')).toBe(true)
    expect(classifyHomeService('demolition')).toBe(true)
    expect(classifyHomeService('handyman')).toBe(true)
    expect(classifyHomeService('waterproofing')).toBe(true)
    expect(classifyHomeService('painting')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(classifyHomeService('Bathroom Remodeling')).toBe(true)
    expect(classifyHomeService('DRIVEWAY PAVING')).toBe(true)
    expect(classifyHomeService('Colonoscopy')).toBe(false)
  })
})

describe('filterNewNiches', () => {
  const existing = [
    { niche: 'junk removal', nat_vol: 691300, avg_cpc: 14.08 },
    { niche: 'pressure washing', nat_vol: 561000, avg_cpc: 11.32 },
  ]

  it('removes niches already in existing list', () => {
    const clusters = [
      { niche: 'junk removal', total_volume: 5000, avg_cpc: 12 },
      { niche: 'deck staining', total_volume: 3000, avg_cpc: 15 },
    ]
    const result = filterNewNiches(clusters, existing)
    expect(result).toHaveLength(1)
    expect(result[0].niche).toBe('deck staining')
  })

  it('returns all clusters when none overlap', () => {
    const clusters = [
      { niche: 'fence installation', total_volume: 4000, avg_cpc: 14 },
      { niche: 'deck staining', total_volume: 3000, avg_cpc: 15 },
    ]
    const result = filterNewNiches(clusters, existing)
    expect(result).toHaveLength(2)
  })

  it('returns empty array when all already exist', () => {
    const clusters = [
      { niche: 'junk removal', total_volume: 5000, avg_cpc: 12 },
      { niche: 'pressure washing', total_volume: 4000, avg_cpc: 11 },
    ]
    const result = filterNewNiches(clusters, existing)
    expect(result).toHaveLength(0)
  })

  it('uses case-insensitive comparison', () => {
    const clusters = [
      { niche: 'Junk Removal', total_volume: 5000, avg_cpc: 12 },
      { niche: 'PRESSURE WASHING', total_volume: 4000, avg_cpc: 11 },
      { niche: 'deck staining', total_volume: 3000, avg_cpc: 15 },
    ]
    const result = filterNewNiches(clusters, existing)
    expect(result).toHaveLength(1)
    expect(result[0].niche).toBe('deck staining')
  })
})

describe('updateCandidateStatuses', () => {
  const makeRows = () => [
    { slug: 'junk-removal-houston', niche: 'junk removal', area: 'Houston', status: 'discovered' },
    { slug: 'pressure-washing-dallas', niche: 'pressure washing', area: 'Dallas', status: 'validated' },
    { slug: 'fence-install-austin', niche: 'fence installation', area: 'Austin', status: 'torn_down' },
  ]

  it('returns rows unchanged when slugStatusPairs is empty', () => {
    const rows = makeRows()
    const result = updateCandidateStatuses(rows, [])
    expect(result).toEqual(rows)
  })

  it('updates status for a single matching slug', () => {
    const rows = makeRows()
    const result = updateCandidateStatuses(rows, [{ slug: 'junk-removal-houston', status: 'walk_away' }])
    expect(result[0].status).toBe('walk_away')
    expect(result[1].status).toBe('validated')
    expect(result[2].status).toBe('torn_down')
  })

  it('updates multiple slugs in one call', () => {
    const rows = makeRows()
    const result = updateCandidateStatuses(rows, [
      { slug: 'junk-removal-houston', status: 'walk_away' },
      { slug: 'fence-install-austin', status: 'shortlisted' },
    ])
    expect(result[0].status).toBe('walk_away')
    expect(result[2].status).toBe('shortlisted')
  })

  it('ignores slugs not found in rows', () => {
    const rows = makeRows()
    const result = updateCandidateStatuses(rows, [{ slug: 'nonexistent-slug', status: 'walk_away' }])
    expect(result).toEqual(rows)
  })

  it('does not mutate original row objects', () => {
    const rows = makeRows()
    const originalStatus = rows[0].status
    updateCandidateStatuses(rows, [{ slug: 'junk-removal-houston', status: 'walk_away' }])
    expect(rows[0].status).toBe(originalStatus)
  })
})

describe('extractCompetitorDomains', () => {
  it('extracts domains from serp_items breadcrumbs', () => {
    const data = {
      serp_items: [
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://www.kleandry.com › service-area' },
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://bearcarpet.com' },
      ],
      organic: [{ keyword: 'test', topDomains: ['google.com'] }],
    }
    const result = extractCompetitorDomains(data)
    expect(result).toContain('kleandry.com')
    expect(result).toContain('bearcarpet.com')
    expect(result).not.toContain('google.com')
  })

  it('filters out directory and platform domains', () => {
    const data = {
      serp_items: [
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://www.yelp.com › some-biz' },
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://realcompetitor.com' },
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://www.thumbtack.com › service' },
      ],
    }
    const result = extractCompetitorDomains(data)
    expect(result).toEqual(['realcompetitor.com'])
  })

  it('deduplicates domains (strips www)', () => {
    const data = {
      serp_items: [
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://www.acme.com › page1' },
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://acme.com › page2' },
      ],
    }
    const result = extractCompetitorDomains(data)
    expect(result).toEqual(['acme.com'])
  })

  it('returns at most 4 competitors', () => {
    const data = {
      serp_items: [
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://a.com' },
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://b.com' },
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://c.com' },
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://d.com' },
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://e.com' },
      ],
    }
    expect(extractCompetitorDomains(data)).toHaveLength(4)
  })

  it('handles missing or malformed breadcrumbs', () => {
    const data = {
      serp_items: [
        { type: 'organic', domain: 'google.com', breadcrumb: '310+ followers' },
        { type: 'organic', domain: 'google.com' },
        { type: 'organic', domain: 'google.com', breadcrumb: 'https://real.com' },
      ],
    }
    const result = extractCompetitorDomains(data)
    expect(result).toEqual(['real.com'])
  })

  it('returns empty array when no serp_items exist', () => {
    expect(extractCompetitorDomains({})).toEqual([])
    expect(extractCompetitorDomains({ serp_items: [] })).toEqual([])
  })

  it('falls back to topDomains when serp_items yields nothing', () => {
    const data = {
      serp_items: [],
      organic: [
        { keyword: 'test', topDomains: ['realsite.com', 'yelp.com'] },
      ],
    }
    const result = extractCompetitorDomains(data)
    expect(result).toEqual(['realsite.com'])
  })
})
