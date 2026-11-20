import { describe, it, expect } from 'vitest'
import {
  LINK_TYPES,
  LINK_STATUSES,
  buildCompetitorQueries,
  extractCompetitorDomains,
  classifyBacklinkType,
  filterSelfServeProspects,
  buildProspectRow,
  deduplicateProspects,
  selectOutreachPage,
  estimateLinksCost,
  mergeProspects,
  isPortfolioLink,
  formatLinksReport,
} from '../lib/links.js'

// ── Constants ───────────────────────────────────────────────────────

describe('LINK_TYPES', () => {
  it('has the expected types', () => {
    expect(LINK_TYPES).toContain('editorial')
    expect(LINK_TYPES).toContain('directory_niche')
    expect(LINK_TYPES).toContain('directory_local')
    expect(LINK_TYPES).toContain('chamber')
    expect(LINK_TYPES).toContain('local_news')
    expect(LINK_TYPES).toContain('other')
  })
})

describe('LINK_STATUSES', () => {
  it('has the expected statuses', () => {
    expect(LINK_STATUSES).toContain('prospect')
    expect(LINK_STATUSES).toContain('outreach_sent')
    expect(LINK_STATUSES).toContain('linked')
    expect(LINK_STATUSES).toContain('rejected')
  })
})

// ── buildCompetitorQueries ──────────────────────────────────────────

describe('buildCompetitorQueries', () => {
  it('builds "[niche] [city]" queries for other cities', () => {
    const queries = buildCompetitorQueries('epoxy flooring', 'Fort Myers', ['Orlando', 'Miami'])
    expect(queries).toEqual(['epoxy flooring Orlando', 'epoxy flooring Miami'])
  })

  it('excludes homeCity from queries', () => {
    const queries = buildCompetitorQueries('epoxy flooring', 'Orlando', ['Orlando', 'Miami', 'Tampa'])
    expect(queries).not.toContain('epoxy flooring Orlando')
    expect(queries).toContain('epoxy flooring Miami')
    expect(queries).toContain('epoxy flooring Tampa')
  })

  it('returns empty array when no other cities', () => {
    const queries = buildCompetitorQueries('epoxy flooring', 'Fort Myers', [])
    expect(queries).toHaveLength(0)
  })

  it('returns empty when only homeCity in list', () => {
    const queries = buildCompetitorQueries('epoxy flooring', 'Orlando', ['Orlando'])
    expect(queries).toHaveLength(0)
  })
})

// ── extractCompetitorDomains ────────────────────────────────────────

describe('extractCompetitorDomains', () => {
  const makeResult = (domain) => ({ url: `https://${domain}/page`, domain })

  it('extracts unique domains', () => {
    const results = [makeResult('contractor-a.com'), makeResult('contractor-b.com')]
    expect(extractCompetitorDomains(results, [])).toEqual(['contractor-a.com', 'contractor-b.com'])
  })

  it('deduplicates domains', () => {
    const results = [
      makeResult('contractor-a.com'),
      makeResult('contractor-a.com'),
    ]
    expect(extractCompetitorDomains(results, [])).toEqual(['contractor-a.com'])
  })

  it('filters platform domains', () => {
    const results = [makeResult('google.com'), makeResult('contractor-a.com')]
    expect(extractCompetitorDomains(results, [])).toEqual(['contractor-a.com'])
  })

  it('filters directory domains', () => {
    const results = [makeResult('yelp.com'), makeResult('contractor-a.com')]
    expect(extractCompetitorDomains(results, [])).toEqual(['contractor-a.com'])
  })

  it('filters portfolio domains (excludeDomains)', () => {
    const results = [makeResult('my-site.com'), makeResult('contractor-a.com')]
    expect(extractCompetitorDomains(results, ['my-site.com'])).toEqual(['contractor-a.com'])
  })

  it('handles empty results', () => {
    expect(extractCompetitorDomains([], [])).toEqual([])
  })
})

// ── classifyBacklinkType ────────────────────────────────────────────

describe('classifyBacklinkType', () => {
  it('classifies .edu as editorial', () => {
    expect(classifyBacklinkType('university.edu')).toBe('editorial')
  })

  it('classifies .gov as editorial', () => {
    expect(classifyBacklinkType('city.gov')).toBe('editorial')
  })

  it('classifies chamber domains as chamber', () => {
    expect(classifyBacklinkType('fortmyerschamber.com')).toBe('chamber')
  })

  it('classifies news domains as local_news', () => {
    expect(classifyBacklinkType('fortmyersnews.com')).toBe('local_news')
  })

  it('classifies niche directory patterns as directory_niche', () => {
    expect(classifyBacklinkType('homeadvisor.com')).toBe('directory_niche')
  })

  it('classifies local directory patterns as directory_local', () => {
    expect(classifyBacklinkType('fortmyersdirectory.com')).toBe('directory_local')
  })

  it('defaults to other', () => {
    expect(classifyBacklinkType('random-blog.com')).toBe('other')
  })
})

// ── filterSelfServeProspects ────────────────────────────────────────

describe('filterSelfServeProspects', () => {
  const makeItem = (overrides = {}) => ({
    target: 'example.com',
    rank: 500,
    backlinks_spam_score: 10,
    broken_backlinks: 0,
    backlinks: 5,
    ...overrides,
  })

  it('keeps items with good metrics', () => {
    const result = filterSelfServeProspects([makeItem()])
    expect(result).toHaveLength(1)
  })

  it('removes low rank items', () => {
    const result = filterSelfServeProspects([makeItem({ rank: 50 })])
    expect(result).toHaveLength(0)
  })

  it('removes high spam score items', () => {
    const result = filterSelfServeProspects([makeItem({ backlinks_spam_score: 60 })])
    expect(result).toHaveLength(0)
  })

  it('removes broken-only items', () => {
    const result = filterSelfServeProspects([makeItem({ broken_backlinks: 3, backlinks: 0 })])
    expect(result).toHaveLength(0)
  })

  it('keeps items with broken + live backlinks', () => {
    const result = filterSelfServeProspects([makeItem({ broken_backlinks: 1, backlinks: 3 })])
    expect(result).toHaveLength(1)
  })

  it('respects custom minRank', () => {
    const result = filterSelfServeProspects([makeItem({ rank: 150 })], { minRank: 200 })
    expect(result).toHaveLength(0)
  })
})

// ── buildProspectRow ────────────────────────────────────────────────

describe('buildProspectRow', () => {
  it('builds correct columns', () => {
    const row = buildProspectRow('epoxy-flooring-fort-myers', 'example.com', 'directory_local', '/cost/')
    expect(row.site_slug).toBe('epoxy-flooring-fort-myers')
    expect(row.target_url).toBe('example.com')
    expect(row.type).toBe('directory_local')
    expect(row.status).toBe('prospect')
    expect(row.page_linked_to).toBe('/cost/')
  })

  it('defaults anchor_text to empty', () => {
    const row = buildProspectRow('slug', 'url', 'other', '/')
    expect(row.anchor_text).toBe('')
  })

  it('sets today date', () => {
    const row = buildProspectRow('slug', 'url', 'other', '/')
    expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ── deduplicateProspects ────────────────────────────────────────────

describe('deduplicateProspects', () => {
  it('removes duplicate target_url entries', () => {
    const prospects = [
      { target_url: 'a.com', rank: 500 },
      { target_url: 'a.com', rank: 300 },
    ]
    const result = deduplicateProspects(prospects)
    expect(result).toHaveLength(1)
  })

  it('keeps highest-rank entry', () => {
    const prospects = [
      { target_url: 'a.com', rank: 300 },
      { target_url: 'a.com', rank: 700 },
    ]
    const result = deduplicateProspects(prospects)
    expect(result[0].rank).toBe(700)
  })

  it('passes through all-unique entries', () => {
    const prospects = [
      { target_url: 'a.com', rank: 100 },
      { target_url: 'b.com', rank: 200 },
    ]
    expect(deduplicateProspects(prospects)).toHaveLength(2)
  })
})

// ── selectOutreachPage ──────────────────────────────────────────────

describe('selectOutreachPage', () => {
  it('picks tool page first', () => {
    const pages = [
      { slug: '/', type: 'home' },
      { slug: '/cost/', type: 'cost_guide' },
      { slug: '/calculator/', type: 'tool' },
    ]
    expect(selectOutreachPage(pages)).toBe('/calculator/')
  })

  it('falls back to cost_guide', () => {
    const pages = [
      { slug: '/', type: 'home' },
      { slug: '/cost/', type: 'cost_guide' },
    ]
    expect(selectOutreachPage(pages)).toBe('/cost/')
  })

  it('falls back to home', () => {
    const pages = [
      { slug: '/', type: 'home' },
      { slug: '/about/', type: 'service' },
    ]
    expect(selectOutreachPage(pages)).toBe('/')
  })

  it('returns / for empty pages', () => {
    expect(selectOutreachPage([])).toBe('/')
  })
})

// ── estimateLinksCost ───────────────────────────────────────────────

describe('estimateLinksCost', () => {
  it('computes correct total', () => {
    const result = estimateLinksCost(10, 30)
    expect(result.serpCost).toBeCloseTo(0.025, 3)
    expect(result.backlinkCost).toBeCloseTo(0.6, 2)
    expect(result.totalCost).toBeCloseTo(0.625, 3)
  })

  it('returns zero for zero inputs', () => {
    const result = estimateLinksCost(0, 0)
    expect(result.totalCost).toBe(0)
  })
})

// ── mergeProspects ──────────────────────────────────────────────────

describe('mergeProspects', () => {
  it('adds new prospects', () => {
    const existing = [{ target_url: 'a.com', status: 'prospect' }]
    const incoming = [{ target_url: 'b.com', status: 'prospect' }]
    const result = mergeProspects(existing, incoming)
    expect(result).toHaveLength(2)
  })

  it('skips already-existing target_urls', () => {
    const existing = [{ target_url: 'a.com', status: 'linked' }]
    const incoming = [{ target_url: 'a.com', status: 'prospect' }]
    const result = mergeProspects(existing, incoming)
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('linked')
  })

  it('never regresses status', () => {
    const existing = [{ target_url: 'a.com', status: 'linked' }]
    const incoming = [{ target_url: 'a.com', status: 'prospect' }]
    const result = mergeProspects(existing, incoming)
    expect(result[0].status).toBe('linked')
  })
})

// ── isPortfolioLink ─────────────────────────────────────────────────

describe('isPortfolioLink', () => {
  it('returns true for matching domain', () => {
    expect(isPortfolioLink('https://my-site.com/page', ['my-site.com'])).toBe(true)
  })

  it('returns false for unrelated domain', () => {
    expect(isPortfolioLink('https://other.com/page', ['my-site.com'])).toBe(false)
  })

  it('handles www prefix', () => {
    expect(isPortfolioLink('https://www.my-site.com/page', ['my-site.com'])).toBe(true)
  })

  it('handles empty portfolio list', () => {
    expect(isPortfolioLink('https://any.com', [])).toBe(false)
  })
})

// ── formatLinksReport ───────────────────────────────────────────────

describe('formatLinksReport', () => {
  it('includes all report fields', () => {
    const report = formatLinksReport({
      slug: 'epoxy-flooring-fort-myers',
      domain: 'fortmyersfloorcoatings.com',
      prospectCount: 25,
      byType: { editorial: 2, directory_niche: 5, directory_local: 8, chamber: 1, local_news: 3, other: 6 },
      cost: { serpCost: 0.025, backlinkCost: 0.6, totalCost: 0.625 },
    })
    expect(report).toMatch(/epoxy-flooring-fort-myers/)
    expect(report).toMatch(/25/)
    expect(report).toMatch(/\$/)
  })

  it('handles zero prospects', () => {
    const report = formatLinksReport({
      slug: 'test-site',
      domain: 'test.com',
      prospectCount: 0,
      byType: {},
      cost: { serpCost: 0, backlinkCost: 0, totalCost: 0 },
    })
    expect(report).toMatch(/0/)
  })
})
