import { describe, it, expect } from 'vitest'
import {
  buildFunnel,
  enrichCandidates,
  enrichWithJobEconomics,
  extractTeardownVerdict,
  extractTeardownData,
  buildRegionSummary,
  buildNicheSummary,
  findCommonSources,
  prioritizeLinkTargets,
} from '../lib/dashboard-data.js'

describe('buildFunnel', () => {
  const candidates = [
    { status: 'discovered', score_total: '' },
    { status: 'walk_away', score_total: '5' },
    { status: 'walk_away', score_total: '' },
    { status: 'validated', score_total: '8' },
    { status: 'validated', score_total: '11' },
    { status: 'shortlisted', score_total: '11' },
    { status: 'torn_down', score_total: '9' },
  ]

  it('counts total candidates', () => {
    expect(buildFunnel(candidates).total).toBe(7)
  })

  it('counts validated as score_total >= 8 (includes validated, shortlisted, torn_down)', () => {
    // validated(8), validated(11), shortlisted(11), torn_down(9) = 4
    expect(buildFunnel(candidates).validated).toBe(4)
  })

  it('counts high_scorers as score_total >= 11 among validated+', () => {
    // validated(11), shortlisted(11) = 2
    expect(buildFunnel(candidates).highScorers).toBe(2)
  })

  it('counts torn_down status', () => {
    expect(buildFunnel(candidates).tornDown).toBe(1)
  })

  it('counts shortlisted status', () => {
    expect(buildFunnel(candidates).shortlisted).toBe(1)
  })

  it('returns all zeros for empty array', () => {
    const funnel = buildFunnel([])
    expect(funnel.total).toBe(0)
    expect(funnel.validated).toBe(0)
    expect(funnel.highScorers).toBe(0)
    expect(funnel.tornDown).toBe(0)
    expect(funnel.shortlisted).toBe(0)
  })
})

describe('enrichCandidates', () => {
  it('merges validation data onto matching candidate', () => {
    const candidates = [
      { slug: 'tree-removal-odessa', niche: 'tree removal', area: 'Odessa', score_total: '11' },
    ]
    const validationMap = {
      'tree-removal-odessa': {
        signals: { volume: 0, cpc: 2, mapPack: 1, organic: 1, renters: 2, license: 2, seasonality: 2, rent: 1 },
        maps_data: { topThree: [{ reviews: 125, rating: 4.9 }], totalCount: 20 },
        organic_domains: ['www.yelp.com', 'advancedtreeclinic.com'],
        trends_monthly: [57, 50, 57, 71, 79, 80, 89, 88, 74, 74, 73, 57],
      },
    }
    const result = enrichCandidates(candidates, validationMap, {}, {})
    expect(result[0].validation).toBeDefined()
    expect(result[0].validation.signals.cpc).toBe(2)
    expect(result[0].validation.trends_monthly).toHaveLength(12)
  })

  it('leaves validation undefined for candidates without data', () => {
    const candidates = [
      { slug: 'house-cleaning-midland', score_total: '' },
    ]
    const result = enrichCandidates(candidates, {}, {}, {})
    expect(result[0].validation).toBeUndefined()
  })

  it('normalizes batch-format validation: constructs signals from CSV score fields', () => {
    const candidates = [{
      slug: 'junk-removal-houston',
      score_vol: '0', score_cpc: '2', score_map: '2', score_organic: '1',
      score_renters: '2', score_license: '2', score_season: '2', score_rent: '2',
    }]
    const validationMap = {
      'junk-removal-houston': {
        trends: [51, 50, 60, 73, 70, 75, 70, 86, 71, 64, 55, 57],
        maps: { topThree: [{ name: 'Junk Co', reviews: 10, rating: 4.9 }], totalCount: 20 },
        organic: [
          { keyword: 'junk removal houston', topDomains: ['google.com', 'yelp.com'] },
          { keyword: 'houston junk removal', topDomains: ['google.com', 'angi.com'] },
        ],
      },
    }
    const result = enrichCandidates(candidates, validationMap, {}, {})
    const v = result[0].validation
    expect(v.signals).toEqual({
      volume: 0, cpc: 2, mapPack: 2, organic: 1,
      renters: 2, license: 2, seasonality: 2, rent: 2,
    })
  })

  it('normalizes batch-format validation: falls back trends to v.trends', () => {
    const candidates = [{ slug: 'test-slug', score_vol: '1', score_cpc: '1', score_map: '1', score_organic: '1', score_renters: '1', score_license: '1', score_season: '1', score_rent: '1' }]
    const validationMap = {
      'test-slug': {
        trends: [10, 20, 30, 40, 50, 60, 70, 80, 90, 80, 70, 60],
      },
    }
    const result = enrichCandidates(candidates, validationMap, {}, {})
    expect(result[0].validation.trends_monthly).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 80, 70, 60])
  })

  it('normalizes batch-format validation: falls back maps_data to v.maps', () => {
    const candidates = [{ slug: 'test-slug', score_vol: '1', score_cpc: '1', score_map: '1', score_organic: '1', score_renters: '1', score_license: '1', score_season: '1', score_rent: '1' }]
    const validationMap = {
      'test-slug': {
        maps: { topThree: [{ name: 'Biz', reviews: 5, rating: 4.8 }], totalCount: 10 },
      },
    }
    const result = enrichCandidates(candidates, validationMap, {}, {})
    expect(result[0].validation.maps_data).toEqual({ topThree: [{ name: 'Biz', reviews: 5, rating: 4.8 }], totalCount: 10 })
  })

  it('normalizes batch-format validation: flattens and dedupes organic domains', () => {
    const candidates = [{ slug: 'test-slug', score_vol: '1', score_cpc: '1', score_map: '1', score_organic: '1', score_renters: '1', score_license: '1', score_season: '1', score_rent: '1' }]
    const validationMap = {
      'test-slug': {
        organic: [
          { keyword: 'kw1', topDomains: ['google.com', 'yelp.com', 'angi.com'] },
          { keyword: 'kw2', topDomains: ['google.com', 'thumbtack.com'] },
        ],
      },
    }
    const result = enrichCandidates(candidates, validationMap, {}, {})
    expect(result[0].validation.organic_domains).toEqual(['google.com', 'yelp.com', 'angi.com', 'thumbtack.com'])
  })

  it('preserves interactive-format validation data unchanged', () => {
    const candidates = [{
      slug: 'spray-foam-houston',
      score_vol: '0', score_cpc: '2', score_map: '1', score_organic: '0',
      score_renters: '2', score_license: '2', score_season: '2', score_rent: '2',
    }]
    const signals = { volume: 0, cpc: 2, mapPack: 1, organic: 0, renters: 2, license: 2, seasonality: 2, rent: 2 }
    const validationMap = {
      'spray-foam-houston': {
        signals,
        trends_monthly: [87, 83, 87, 87, 83, 87, 83, 91, 85, 82, 82, 87],
        maps_data: { topThree: [{ name: 'Biz', reviews: 8, rating: 5 }], totalCount: 20 },
        organic_domains: ['www.31w.com', 'www.thumbtack.com'],
      },
    }
    const result = enrichCandidates(candidates, validationMap, {}, {})
    const v = result[0].validation
    expect(v.signals).toBe(signals)
    expect(v.trends_monthly).toEqual([87, 83, 87, 87, 83, 87, 83, 91, 85, 82, 82, 87])
    expect(v.maps_data.topThree).toHaveLength(1)
    expect(v.organic_domains).toEqual(['www.31w.com', 'www.thumbtack.com'])
  })

  it('merges teardown verdict onto matching candidate', () => {
    const candidates = [
      { slug: 'tree-removal-odessa', score_total: '11' },
    ]
    const teardownMap = { 'tree-removal-odessa': 'TOUGH' }
    const result = enrichCandidates(candidates, {}, teardownMap, {})
    expect(result[0].teardownVerdict).toBe('TOUGH')
  })

  it('merges backlink sources onto matching candidate', () => {
    const candidates = [{ slug: 'tree-removal-odessa', score_total: '11' }]
    const backlinkMap = {
      'tree-removal-odessa': {
        competitors: [{ domain: 'example.com', top_referring_domains: [] }],
        common_sources: ['shared.com'],
        link_building_targets: ['shared.com'],
      },
    }
    const result = enrichCandidates(candidates, {}, {}, backlinkMap)
    expect(result[0].backlinkSources).toBeDefined()
    expect(result[0].backlinkSources.common_sources).toContain('shared.com')
  })
})

describe('extractTeardownVerdict', () => {
  it('extracts BEATABLE verdict from teardown markdown', () => {
    const md = '# Teardown\n\n## Verdict: BEATABLE\n\nThe competitors are weak.'
    expect(extractTeardownVerdict(md)).toBe('BEATABLE')
  })

  it('extracts TOUGH verdict', () => {
    const md = '## Verdict: TOUGH\n\nSubstantial backlink gap.'
    expect(extractTeardownVerdict(md)).toBe('TOUGH')
  })

  it('extracts SKIP verdict', () => {
    const md = '## Verdict: SKIP\n\nAll strong.'
    expect(extractTeardownVerdict(md)).toBe('SKIP')
  })

  it('returns null when no verdict found', () => {
    expect(extractTeardownVerdict('# Some markdown\n\nNo verdict here.')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractTeardownVerdict('')).toBeNull()
  })
})

describe('extractTeardownData', () => {
  it('extracts verdict, assessment, and keyFinding from well-formed teardown markdown', () => {
    const md = `# Teardown: tree removal in Odessa

## Verdict: BEATABLE

Majority of competitors have thin content, few referring domains, or poor on-page SEO. This niche is winnable with solid content and basic link building.`
    const result = extractTeardownData(md)
    expect(result.verdict).toBe('BEATABLE')
    expect(result.assessment).toBe('Majority of competitors have thin content, few referring domains, or poor on-page SEO. This niche is winnable with solid content and basic link building.')
    expect(result.keyFinding).toBe('Majority of competitors have thin content, few referring domains, or poor on-page SEO.')
  })

  it('returns first sentence as keyFinding (up to first period)', () => {
    const md = `## Verdict: TOUGH

The backlink gap is substantial. However, no competitor specifically targets this keyword. A purpose-built site could compete.`
    const result = extractTeardownData(md)
    expect(result.keyFinding).toBe('The backlink gap is substantial.')
  })

  it('handles multiline assessment paragraphs', () => {
    const md = `## Verdict: TOUGH

The backlink gap is substantial (median 99 referring domains), making this a medium-to-high effort play. However, no competitor specifically targets "tree removal odessa" with both domain and on-page optimization.
The strongest Odessa-specific site (advancedtreeclinic) has weak on-page SEO.`
    const result = extractTeardownData(md)
    expect(result.verdict).toBe('TOUGH')
    expect(result.assessment).toContain('medium-to-high effort play')
    expect(result.assessment).toContain('weak on-page SEO')
  })

  it('returns null fields for markdown without a verdict', () => {
    const md = '# Some markdown\n\nNo verdict here.'
    const result = extractTeardownData(md)
    expect(result.verdict).toBeNull()
    expect(result.assessment).toBeNull()
    expect(result.keyFinding).toBeNull()
  })

  it('returns null fields for null/undefined input', () => {
    expect(extractTeardownData(null)).toEqual({ verdict: null, assessment: null, keyFinding: null })
    expect(extractTeardownData(undefined)).toEqual({ verdict: null, assessment: null, keyFinding: null })
  })

  it('returns empty assessment when verdict heading has no paragraph after it', () => {
    const md = '## Verdict: SKIP\n'
    const result = extractTeardownData(md)
    expect(result.verdict).toBe('SKIP')
    expect(result.assessment).toBe('')
    expect(result.keyFinding).toBe('')
  })

  it('stops assessment at next heading', () => {
    const md = `## Verdict: BEATABLE

Competitors are weak and poorly optimized.

## Next Section

More content here.`
    const result = extractTeardownData(md)
    expect(result.assessment).toBe('Competitors are weak and poorly optimized.')
    expect(result.assessment).not.toContain('Next Section')
  })

  it('backward compat: extractTeardownVerdict still works unchanged', () => {
    const md = '## Verdict: BEATABLE\n\nSome assessment text.'
    expect(extractTeardownVerdict(md)).toBe('BEATABLE')
    expect(extractTeardownVerdict('')).toBeNull()
    expect(extractTeardownVerdict(null)).toBeNull()
  })
})

describe('enrichCandidates teardown data', () => {
  it('attaches teardownAssessment and teardownKeyFinding when teardownMap has object entries', () => {
    const candidates = [{ slug: 'tree-removal-odessa', score_total: '11' }]
    const teardownMap = {
      'tree-removal-odessa': {
        verdict: 'TOUGH',
        assessment: 'The backlink gap is substantial. No competitor targets this keyword.',
        keyFinding: 'The backlink gap is substantial.',
      },
    }
    const result = enrichCandidates(candidates, {}, teardownMap, {})
    expect(result[0].teardownVerdict).toBe('TOUGH')
    expect(result[0].teardownAssessment).toBe('The backlink gap is substantial. No competitor targets this keyword.')
    expect(result[0].teardownKeyFinding).toBe('The backlink gap is substantial.')
  })

  it('still works with legacy string teardownMap entries', () => {
    const candidates = [{ slug: 'tree-removal-odessa', score_total: '11' }]
    const teardownMap = { 'tree-removal-odessa': 'TOUGH' }
    const result = enrichCandidates(candidates, {}, teardownMap, {})
    expect(result[0].teardownVerdict).toBe('TOUGH')
    expect(result[0].teardownAssessment).toBeUndefined()
    expect(result[0].teardownKeyFinding).toBeUndefined()
  })
})

describe('buildRegionSummary', () => {
  const candidates = [
    { area: 'Midland', niche: 'tree removal', status: 'walk_away', score_total: '7' },
    { area: 'Midland', niche: 'painting', status: 'walk_away', score_total: '6' },
    { area: 'Odessa', niche: 'tree removal', status: 'shortlisted', score_total: '11' },
    { area: 'Odessa', niche: 'landscaping', status: 'validated', score_total: '8' },
    { area: 'Big Spring', niche: 'tree removal', status: 'walk_away', score_total: '6' },
  ]

  it('groups candidates by area', () => {
    const summary = buildRegionSummary(candidates)
    expect(Object.keys(summary)).toHaveLength(3)
    expect(summary['Midland'].count).toBe(2)
    expect(summary['Odessa'].count).toBe(2)
    expect(summary['Big Spring'].count).toBe(1)
  })

  it('counts viable candidates (score >= 8) per area', () => {
    const summary = buildRegionSummary(candidates)
    expect(summary['Odessa'].viable).toBe(2)
    expect(summary['Midland'].viable).toBe(0)
  })

  it('tracks best score per area', () => {
    const summary = buildRegionSummary(candidates)
    expect(summary['Odessa'].bestScore).toBe(11)
    expect(summary['Midland'].bestScore).toBe(7)
  })

  it('returns empty object for empty array', () => {
    expect(buildRegionSummary([])).toEqual({})
  })
})

describe('buildNicheSummary', () => {
  const candidates = [
    { niche: 'tree removal', area: 'Midland', status: 'walk_away', score_total: '7' },
    { niche: 'tree removal', area: 'Odessa', status: 'shortlisted', score_total: '11' },
    { niche: 'landscaping', area: 'Odessa', status: 'validated', score_total: '8' },
  ]

  it('groups candidates by niche', () => {
    const summary = buildNicheSummary(candidates)
    expect(Object.keys(summary)).toHaveLength(2)
    expect(summary['tree removal'].count).toBe(2)
    expect(summary['landscaping'].count).toBe(1)
  })

  it('counts viable candidates per niche', () => {
    const summary = buildNicheSummary(candidates)
    expect(summary['tree removal'].viable).toBe(1)
    expect(summary['landscaping'].viable).toBe(1)
  })

  it('tracks best score per niche', () => {
    const summary = buildNicheSummary(candidates)
    expect(summary['tree removal'].bestScore).toBe(11)
  })

  it('includes avgJobRange when economics map provided', () => {
    const economicsMap = new Map([
      ['tree removal', { avgJobLow: 300, avgJobHigh: 1500, marginLow: 0.4, marginHigh: 0.6, notes: '' }],
    ])
    const summary = buildNicheSummary(candidates, economicsMap)
    expect(summary['tree removal'].avgJobRange).toBe('$300–$1500')
    expect(summary['landscaping'].avgJobRange).toBeUndefined()
  })

  it('works without economics map (backward compatible)', () => {
    const summary = buildNicheSummary(candidates)
    expect(summary['tree removal'].avgJobRange).toBeUndefined()
  })
})

describe('enrichWithJobEconomics', () => {
  const economicsMap = new Map([
    ['tree removal', { avgJobLow: 300, avgJobHigh: 1500, marginLow: 0.4, marginHigh: 0.6, notes: '' }],
    ['dryer vent cleaning', { avgJobLow: 104, avgJobHigh: 188, marginLow: 0.5, marginHigh: 0.7, notes: '' }],
  ])

  it('attaches job value fields when niche matches', () => {
    const candidates = [
      { niche: 'tree removal', slug: 'tree-removal-odessa' },
    ]
    const result = enrichWithJobEconomics(candidates, economicsMap)
    expect(result[0].jobValueRange).toBe('$300–$1500')
    expect(result[0].avgJobLow).toBe(300)
    expect(result[0].avgJobHigh).toBe(1500)
  })

  it('leaves fields undefined when niche has no economics entry', () => {
    const candidates = [
      { niche: 'landscaping', slug: 'landscaping-odessa' },
    ]
    const result = enrichWithJobEconomics(candidates, economicsMap)
    expect(result[0].jobValueRange).toBeUndefined()
    expect(result[0].avgJobLow).toBeUndefined()
    expect(result[0].avgJobHigh).toBeUndefined()
  })

  it('matches niches case-insensitively', () => {
    const candidates = [
      { niche: 'Tree Removal', slug: 'tree-removal-midland' },
    ]
    const result = enrichWithJobEconomics(candidates, economicsMap)
    expect(result[0].jobValueRange).toBe('$300–$1500')
  })
})

describe('findCommonSources', () => {
  it('returns domains appearing in 2+ competitor profiles', () => {
    const competitors = [
      { domain: 'a.com', top_referring_domains: [{ domain: 'shared.com' }, { domain: 'only-a.com' }] },
      { domain: 'b.com', top_referring_domains: [{ domain: 'shared.com' }, { domain: 'only-b.com' }] },
      { domain: 'c.com', top_referring_domains: [{ domain: 'shared.com' }, { domain: 'shared2.com' }] },
    ]
    // shared.com appears in all 3, shared2.com only in 1
    const common = findCommonSources(competitors)
    expect(common).toContain('shared.com')
    expect(common).not.toContain('only-a.com')
    expect(common).not.toContain('shared2.com')
  })

  it('returns empty array when no common sources', () => {
    const competitors = [
      { domain: 'a.com', top_referring_domains: [{ domain: 'x.com' }] },
      { domain: 'b.com', top_referring_domains: [{ domain: 'y.com' }] },
    ]
    expect(findCommonSources(competitors)).toEqual([])
  })

  it('returns empty array for empty input', () => {
    expect(findCommonSources([])).toEqual([])
  })
})

describe('prioritizeLinkTargets', () => {
  it('puts common sources first, sorted by rank descending', () => {
    const competitors = [
      {
        domain: 'a.com',
        top_referring_domains: [
          { domain: 'common.com', rank: 300 },
          { domain: 'unique-a.com', rank: 500 },
        ],
      },
      {
        domain: 'b.com',
        top_referring_domains: [
          { domain: 'common.com', rank: 300 },
          { domain: 'unique-b.com', rank: 100 },
        ],
      },
    ]
    const commonSources = ['common.com']
    const targets = prioritizeLinkTargets(competitors, commonSources)
    // common sources first
    expect(targets[0].domain).toBe('common.com')
    expect(targets[0].isCommon).toBe(true)
    // then unique by rank desc
    expect(targets[1].domain).toBe('unique-a.com')
    expect(targets[2].domain).toBe('unique-b.com')
  })

  it('deduplicates domains across competitors', () => {
    const competitors = [
      { domain: 'a.com', top_referring_domains: [{ domain: 'dup.com', rank: 100 }] },
      { domain: 'b.com', top_referring_domains: [{ domain: 'dup.com', rank: 100 }] },
    ]
    const targets = prioritizeLinkTargets(competitors, ['dup.com'])
    const dupEntries = targets.filter((t) => t.domain === 'dup.com')
    expect(dupEntries).toHaveLength(1)
  })

  it('returns empty array for no competitors', () => {
    expect(prioritizeLinkTargets([], [])).toEqual([])
  })
})
