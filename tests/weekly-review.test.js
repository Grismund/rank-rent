import { describe, it, expect } from 'vitest'
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

describe('buildSearchAnalyticsRequest', () => {
  it('includes correct dimensions and date range', () => {
    const req = buildSearchAnalyticsRequest('2026-11-01', '2026-11-14')
    expect(req.startDate).toBe('2026-11-01')
    expect(req.endDate).toBe('2026-11-14')
    expect(req.dimensions).toEqual(['query', 'page'])
  })

  it('defaults rowLimit to 500', () => {
    const req = buildSearchAnalyticsRequest('2026-11-01', '2026-11-14')
    expect(req.rowLimit).toBe(500)
  })

  it('allows custom rowLimit', () => {
    const req = buildSearchAnalyticsRequest('2026-11-01', '2026-11-14', 1000)
    expect(req.rowLimit).toBe(1000)
  })
})

describe('parseSearchAnalyticsRows', () => {
  it('parses normal GSC response rows', () => {
    const response = {
      rows: [
        { keys: ['epoxy flooring', 'https://example.com/'], clicks: 5, impressions: 100, position: 8.2 },
        { keys: ['floor coating', 'https://example.com/services'], clicks: 2, impressions: 50, position: 12.5 },
      ],
    }
    const result = parseSearchAnalyticsRows(response)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ query: 'epoxy flooring', page: 'https://example.com/', clicks: 5, impressions: 100, position: 8.2 })
    expect(result[1].query).toBe('floor coating')
  })

  it('returns empty array for missing rows', () => {
    expect(parseSearchAnalyticsRows({})).toEqual([])
    expect(parseSearchAnalyticsRows({ rows: null })).toEqual([])
  })

  it('handles rows with missing fields gracefully', () => {
    const response = {
      rows: [{ keys: ['query', 'page'] }],
    }
    const result = parseSearchAnalyticsRows(response)
    expect(result[0].clicks).toBe(0)
    expect(result[0].impressions).toBe(0)
    expect(result[0].position).toBe(0)
  })
})

describe('buildReviewDateRanges', () => {
  it('builds correct 4-week window', () => {
    // Reference date: 2026-11-20
    const ranges = buildReviewDateRanges('2026-11-20')
    expect(ranges.currentStart).toBe('2026-11-06')
    expect(ranges.currentEnd).toBe('2026-11-20')
    expect(ranges.priorStart).toBe('2026-10-23')
    expect(ranges.priorEnd).toBe('2026-11-06')
  })

  it('returns ISO date strings', () => {
    const ranges = buildReviewDateRanges('2026-01-15')
    expect(ranges.currentStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(ranges.priorStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('findNewPageCandidates', () => {
  const queryData = [
    { query: 'epoxy flooring near me', page: 'https://ex.com/', impressions: 30, position: 20 },
    { query: 'garage floor coating', page: 'https://ex.com/', impressions: 25, position: 18 },
    { query: 'epoxy cost', page: 'https://ex.com/cost', impressions: 10, position: 25 },
    { query: 'floor polish', page: 'https://ex.com/', impressions: 50, position: 10 },
    { query: 'metallic epoxy', page: 'https://ex.com/', impressions: 40, position: 22 },
  ]
  const existingPages = ['/epoxy-flooring-near-me']

  it('finds queries with high impressions and poor position', () => {
    const result = findNewPageCandidates(queryData, [])
    // Should include queries with impressions >= 20 and position > 15
    const queries = result.map(r => r.query)
    expect(queries).toContain('epoxy flooring near me')
    expect(queries).toContain('garage floor coating')
    expect(queries).toContain('metallic epoxy')
  })

  it('filters out queries below impression threshold', () => {
    const result = findNewPageCandidates(queryData, [])
    const queries = result.map(r => r.query)
    expect(queries).not.toContain('epoxy cost') // only 10 impressions
  })

  it('filters out queries with good position', () => {
    const result = findNewPageCandidates(queryData, [])
    const queries = result.map(r => r.query)
    expect(queries).not.toContain('floor polish') // position 10, already ranking
  })

  it('excludes queries matching existing pages', () => {
    const result = findNewPageCandidates(queryData, ['epoxy flooring near me'])
    const queries = result.map(r => r.query)
    expect(queries).not.toContain('epoxy flooring near me')
  })

  it('returns empty for empty input', () => {
    expect(findNewPageCandidates([], [])).toEqual([])
  })
})

describe('selectTopPageProposal', () => {
  it('picks the candidate with highest impressions', () => {
    const candidates = [
      { query: 'a', impressions: 30, position: 20 },
      { query: 'b', impressions: 50, position: 18 },
      { query: 'c', impressions: 40, position: 22 },
    ]
    const result = selectTopPageProposal(candidates)
    expect(result.query).toBe('b')
  })

  it('returns null for empty list', () => {
    expect(selectTopPageProposal([])).toBeNull()
  })
})

describe('findRefreshCandidates', () => {
  it('detects pages with position drop > 5', () => {
    const current = [
      { query: 'epoxy flooring', page: 'https://ex.com/', position: 15 },
    ]
    const prior = [
      { query: 'epoxy flooring', page: 'https://ex.com/', position: 8 },
    ]
    const pages = ['https://ex.com/']
    const result = findRefreshCandidates(current, prior, pages)
    expect(result).toHaveLength(1)
    expect(result[0].drop).toBe(7)
    expect(result[0].currentPos).toBe(15)
    expect(result[0].priorPos).toBe(8)
  })

  it('ignores small drops', () => {
    const current = [{ query: 'q', page: 'https://ex.com/', position: 10 }]
    const prior = [{ query: 'q', page: 'https://ex.com/', position: 8 }]
    const result = findRefreshCandidates(current, prior, ['https://ex.com/'])
    expect(result).toHaveLength(0)
  })

  it('matches by page and query', () => {
    const current = [
      { query: 'q1', page: 'https://ex.com/a', position: 20 },
      { query: 'q2', page: 'https://ex.com/b', position: 20 },
    ]
    const prior = [
      { query: 'q1', page: 'https://ex.com/a', position: 5 },
      { query: 'q2', page: 'https://ex.com/b', position: 5 },
    ]
    const pages = ['https://ex.com/a']
    const result = findRefreshCandidates(current, prior, pages)
    // Only ex.com/a is in the pages list
    expect(result).toHaveLength(1)
    expect(result[0].page).toBe('https://ex.com/a')
  })

  it('handles missing prior data gracefully', () => {
    const current = [{ query: 'q', page: 'https://ex.com/', position: 15 }]
    const result = findRefreshCandidates(current, [], ['https://ex.com/'])
    expect(result).toHaveLength(0)
  })
})

describe('checkKillCandidate', () => {
  it('flags zero impressions after 6 months', () => {
    const result = checkKillCandidate(0, '2026-04-01', '2026-11-20')
    expect(result.isKillCandidate).toBe(true)
    expect(result.monthsSinceLaunch).toBeGreaterThanOrEqual(6)
  })

  it('allows zero impressions before 6 months', () => {
    const result = checkKillCandidate(0, '2026-08-01', '2026-11-20')
    expect(result.isKillCandidate).toBe(false)
  })

  it('allows non-zero impressions after 6 months', () => {
    const result = checkKillCandidate(100, '2026-04-01', '2026-11-20')
    expect(result.isKillCandidate).toBe(false)
  })
})

describe('buildCallLogParams', () => {
  it('formats phone number for Twilio API', () => {
    const params = buildCallLogParams('+12395550123', '2026-11-06', '2026-11-20')
    expect(params.To).toBe('+12395550123')
  })

  it('includes correct date range params', () => {
    const params = buildCallLogParams('+12395550123', '2026-11-06', '2026-11-20')
    expect(params['StartTime>']).toBe('2026-11-06')
    expect(params['StartTime<']).toBe('2026-11-20')
    expect(params.PageSize).toBe(1000)
  })
})

describe('countCalls', () => {
  it('counts completed inbound calls', () => {
    const response = {
      calls: [
        { direction: 'inbound', status: 'completed', duration: '45' },
        { direction: 'inbound', status: 'completed', duration: '120' },
      ],
    }
    const result = countCalls(response)
    expect(result.totalCalls).toBe(2)
    expect(result.completedCalls).toBe(2)
    expect(result.totalDuration).toBe(165)
  })

  it('excludes outbound calls', () => {
    const response = {
      calls: [
        { direction: 'outbound', status: 'completed', duration: '30' },
        { direction: 'inbound', status: 'completed', duration: '45' },
      ],
    }
    const result = countCalls(response)
    expect(result.totalCalls).toBe(1)
    expect(result.completedCalls).toBe(1)
  })

  it('excludes zero-duration calls', () => {
    const response = {
      calls: [
        { direction: 'inbound', status: 'completed', duration: '0' },
        { direction: 'inbound', status: 'completed', duration: '45' },
      ],
    }
    const result = countCalls(response)
    expect(result.completedCalls).toBe(1)
    expect(result.totalDuration).toBe(45)
  })
})

describe('detectMilestones', () => {
  it('sets first_impression when impressions detected and not set', () => {
    const row = { first_impression: '', first_call: '', monthly_calls: '' }
    const result = detectMilestones(row, 100, 0, '2026-11-20')
    expect(result.first_impression).toBe('2026-11-20')
  })

  it('skips first_impression if already set', () => {
    const row = { first_impression: '2026-10-01', first_call: '', monthly_calls: '' }
    const result = detectMilestones(row, 100, 0, '2026-11-20')
    expect(result.first_impression).toBeUndefined()
  })

  it('sets first_call when calls detected and not set', () => {
    const row = { first_impression: '2026-10-01', first_call: '', monthly_calls: '' }
    const result = detectMilestones(row, 100, 5, '2026-11-20')
    expect(result.first_call).toBe('2026-11-20')
  })

  it('updates monthly_calls count', () => {
    const row = { first_impression: '2026-10-01', first_call: '2026-10-15', monthly_calls: '3' }
    const result = detectMilestones(row, 100, 8, '2026-11-20')
    expect(result.monthly_calls).toBe('8')
  })
})

describe('formatWeeklyReviewSummary', () => {
  it('includes all sites in the summary', () => {
    const reviews = [
      { slug: 'site-a', domain: 'a.com', totalImpressions: 100, totalClicks: 10, totalCalls: 5 },
      { slug: 'site-b', domain: 'b.com', totalImpressions: 50, totalClicks: 3, totalCalls: 0 },
    ]
    const output = formatWeeklyReviewSummary(reviews)
    expect(output).toContain('site-a')
    expect(output).toContain('site-b')
  })

  it('handles empty review list', () => {
    const output = formatWeeklyReviewSummary([])
    expect(output).toContain('No sites')
  })
})

describe('formatSiteReviewDetail', () => {
  it('includes key metrics', () => {
    const review = {
      slug: 'epoxy-flooring-fort-myers',
      domain: 'fortmyersfloorcoatings.com',
      totalImpressions: 200,
      totalClicks: 15,
      totalCalls: 3,
      newPageProposal: { query: 'metallic epoxy', impressions: 40, position: 22 },
      refreshCandidates: [],
      killCandidate: { isKillCandidate: false, monthsSinceLaunch: 2 },
    }
    const output = formatSiteReviewDetail(review)
    expect(output).toContain('epoxy-flooring-fort-myers')
    expect(output).toContain('200')
    expect(output).toContain('metallic epoxy')
  })
})
