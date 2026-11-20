import { describe, it, expect } from 'vitest'
import {
  MATCH_CSV_COLUMNS,
  normalizeSlug,
  matchBuyerToSite,
  matchAllBuyers,
  groupMatchesBySite,
  assessContactCompleteness,
  projectRentValue,
  parseNicheEconomics,
  buildMatchRow,
  writeMatchesCsv,
  readMatchesCsv,
  generateEmailTemplate,
  generatePhoneScript,
  formatSitePitchSummary,
  formatPitchPrepSummary,
} from '../lib/pitch-prep.js'

// ── Fixtures ────────────────────────────────────────────────────────

const makeBuyer = (overrides = {}) => ({
  candidate_slug: 'epoxy-flooring-fort-myers',
  business_name: 'Acme Epoxy',
  phone: '+15551234567',
  email: 'owner@acme.com',
  owner_name: 'John Smith',
  website: '',
  domain: '',
  city: 'Fort Myers',
  state: 'Florida',
  rating: '4.5',
  review_count: '12',
  is_claimed: 'true',
  website_weakness: 'no_website',
  fb_presence: 'not_found',
  pitch_priority: 'hot',
  notes: 'No website, 4.5★, 12 reviews',
  ...overrides,
})

const makeSite = (overrides = {}) => ({
  slug: 'epoxy-flooring-fort-myers',
  niche: 'epoxy-flooring',
  area: 'Fort Myers',
  domain: '',
  status: 'audited',
  ...overrides,
})

const makeSiteConfig = (overrides = {}) => ({
  niche: 'epoxy-flooring',
  display_name: 'Epoxy Flooring',
  city: 'Fort Myers',
  state: 'Florida',
  brand: 'Fort Myers Floor Coatings',
  pages: [
    { slug: '/', type: 'home' },
    { slug: '/garage-floor-epoxy/', type: 'service' },
    { slug: '/cost/', type: 'cost_guide' },
    { slug: '/garage-floor-cost-calculator/', type: 'tool' },
  ],
  ...overrides,
})

const SAMPLE_ECONOMICS_MD = `# Niche Economics Reference

| Niche | Avg Job Value | Margin | Source/Notes |
|-------|--------------|--------|-------------|
| junk removal | $300–$500 | 60–70% | Half to full truck load |
| epoxy flooring | $1,600–$3,500 | 40–50% | Very low COGS |
| pressure washing | $275–$425 | 45–60% | Residential |
| bathroom remodel | $6,000–$15,000 | 25–40% | Avg ~$10K |
`

// ── MATCH_CSV_COLUMNS ───────────────────────────────────────────────

describe('MATCH_CSV_COLUMNS', () => {
  it('has correct first and last columns', () => {
    expect(MATCH_CSV_COLUMNS[0]).toBe('site_slug')
    expect(MATCH_CSV_COLUMNS[MATCH_CSV_COLUMNS.length - 1]).toBe('notes')
  })

  it('includes fit_score and pitch_priority', () => {
    expect(MATCH_CSV_COLUMNS).toContain('fit_score')
    expect(MATCH_CSV_COLUMNS).toContain('pitch_priority')
  })
})

// ── normalizeSlug ───────────────────────────────────────────────────

describe('normalizeSlug', () => {
  it('strips dots from abbreviation slugs', () => {
    expect(normalizeSlug('junk-removal-port-st.-lucie')).toBe('junk-removal-port-st-lucie')
  })

  it('is a no-op for clean slugs', () => {
    expect(normalizeSlug('epoxy-flooring-fort-myers')).toBe('epoxy-flooring-fort-myers')
  })

  it('handles multiple dots', () => {
    expect(normalizeSlug('a.b.c-test')).toBe('abc-test')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeSlug('')).toBe('')
  })
})

// ── matchBuyerToSite ────────────────────────────────────────────────

describe('matchBuyerToSite', () => {
  it('matches when slugs align', () => {
    const result = matchBuyerToSite(makeBuyer(), makeSite(), makeSiteConfig())
    expect(result.matched).toBe(true)
    expect(result.fitScore).toBeGreaterThan(0)
  })

  it('fails when slugs differ', () => {
    const buyer = makeBuyer({ candidate_slug: 'junk-removal-miami' })
    const result = matchBuyerToSite(buyer, makeSite(), makeSiteConfig())
    expect(result.matched).toBe(false)
    expect(result.fitScore).toBe(0)
  })

  it('gives higher fitScore to hot buyers with full contact info', () => {
    const hot = makeBuyer({ pitch_priority: 'hot', email: 'a@b.com', phone: '555', owner_name: 'Joe' })
    const cold = makeBuyer({ pitch_priority: 'cold', email: '', phone: '', owner_name: '' })
    const rHot = matchBuyerToSite(hot, makeSite(), makeSiteConfig())
    const rCold = matchBuyerToSite(cold, makeSite(), makeSiteConfig())
    expect(rHot.fitScore).toBeGreaterThan(rCold.fitScore)
  })

  it('handles normalized slug matching (dots)', () => {
    const buyer = makeBuyer({ candidate_slug: 'junk-removal-port-st.-lucie' })
    const site = makeSite({ slug: 'junk-removal-port-st-lucie' })
    const result = matchBuyerToSite(buyer, site, makeSiteConfig())
    expect(result.matched).toBe(true)
  })
})

// ── matchAllBuyers ──────────────────────────────────────────────────

describe('matchAllBuyers', () => {
  it('maps each buyer to at most one site', () => {
    const buyers = [makeBuyer(), makeBuyer({ business_name: 'Other Co' })]
    const sites = [makeSite()]
    const configs = { 'epoxy-flooring-fort-myers': makeSiteConfig() }
    const matches = matchAllBuyers(buyers, sites, configs)
    expect(matches).toHaveLength(2)
    matches.forEach(m => expect(m.site.slug).toBe('epoxy-flooring-fort-myers'))
  })

  it('excludes unmatched buyers', () => {
    const buyers = [makeBuyer({ candidate_slug: 'unknown-niche-city' })]
    const sites = [makeSite()]
    const configs = { 'epoxy-flooring-fort-myers': makeSiteConfig() }
    const matches = matchAllBuyers(buyers, sites, configs)
    expect(matches).toHaveLength(0)
  })

  it('returns empty for empty input', () => {
    expect(matchAllBuyers([], [], {})).toHaveLength(0)
  })
})

// ── groupMatchesBySite ──────────────────────────────────────────────

describe('groupMatchesBySite', () => {
  it('groups matches by site slug', () => {
    const matches = [
      { buyer: makeBuyer(), site: makeSite(), fitScore: 5 },
      { buyer: makeBuyer({ business_name: 'B' }), site: makeSite(), fitScore: 3 },
    ]
    const grouped = groupMatchesBySite(matches)
    expect(grouped.get('epoxy-flooring-fort-myers')).toHaveLength(2)
  })

  it('sorts by fitScore descending within each group', () => {
    const matches = [
      { buyer: makeBuyer(), site: makeSite(), fitScore: 2 },
      { buyer: makeBuyer({ business_name: 'B' }), site: makeSite(), fitScore: 8 },
    ]
    const grouped = groupMatchesBySite(matches)
    const list = grouped.get('epoxy-flooring-fort-myers')
    expect(list[0].fitScore).toBe(8)
    expect(list[1].fitScore).toBe(2)
  })

  it('handles empty input', () => {
    const grouped = groupMatchesBySite([])
    expect(grouped.size).toBe(0)
  })
})

// ── assessContactCompleteness ───────────────────────────────────────

describe('assessContactCompleteness', () => {
  it('reports complete when all present', () => {
    const result = assessContactCompleteness(makeBuyer())
    expect(result.complete).toBe(true)
    expect(result.missing).toHaveLength(0)
  })

  it('lists missing fields', () => {
    const result = assessContactCompleteness(makeBuyer({ email: '', owner_name: '' }))
    expect(result.complete).toBe(false)
    expect(result.missing).toContain('email')
    expect(result.missing).toContain('owner_name')
  })

  it('handles empty row', () => {
    const result = assessContactCompleteness({ phone: '', email: '', owner_name: '' })
    expect(result.complete).toBe(false)
    expect(result.missing).toHaveLength(3)
  })
})

// ── parseNicheEconomics ─────────────────────────────────────────────

describe('parseNicheEconomics', () => {
  it('parses the markdown table', () => {
    const econ = parseNicheEconomics(SAMPLE_ECONOMICS_MD)
    expect(econ.has('epoxy flooring')).toBe(true)
    expect(econ.has('junk removal')).toBe(true)
  })

  it('extracts job value range', () => {
    const econ = parseNicheEconomics(SAMPLE_ECONOMICS_MD)
    const ep = econ.get('epoxy flooring')
    expect(ep.jobLow).toBe(1600)
    expect(ep.jobHigh).toBe(3500)
  })

  it('extracts margin values', () => {
    const econ = parseNicheEconomics(SAMPLE_ECONOMICS_MD)
    const ep = econ.get('epoxy flooring')
    expect(ep.marginLow).toBe(40)
    expect(ep.marginHigh).toBe(50)
  })

  it('handles hyphenated niche names', () => {
    const econ = parseNicheEconomics(SAMPLE_ECONOMICS_MD)
    expect(econ.has('bathroom remodel')).toBe(true)
    const br = econ.get('bathroom remodel')
    expect(br.jobLow).toBe(6000)
    expect(br.jobHigh).toBe(15000)
  })
})

// ── projectRentValue ────────────────────────────────────────────────

describe('projectRentValue', () => {
  it('computes low and high rent estimates', () => {
    const econ = parseNicheEconomics(SAMPLE_ECONOMICS_MD)
    const result = projectRentValue('epoxy flooring', econ)
    // lowRent ≈ 1600 × 0.05 = 80, highRent ≈ 3500 × 0.10 = 350
    expect(result.lowRent).toBe(80)
    expect(result.highRent).toBe(350)
  })

  it('returns zero for unknown niche', () => {
    const econ = parseNicheEconomics(SAMPLE_ECONOMICS_MD)
    const result = projectRentValue('underwater basket weaving', econ)
    expect(result.lowRent).toBe(0)
    expect(result.highRent).toBe(0)
  })

  it('includes basis text', () => {
    const econ = parseNicheEconomics(SAMPLE_ECONOMICS_MD)
    const result = projectRentValue('epoxy flooring', econ)
    expect(result.basis).toMatch(/job value/i)
  })
})

// ── buildMatchRow / writeMatchesCsv / readMatchesCsv ────────────────

describe('buildMatchRow', () => {
  it('builds a row with correct columns', () => {
    const match = {
      buyer: makeBuyer(),
      site: makeSite(),
      fitScore: 5,
    }
    const row = buildMatchRow(match, makeSiteConfig())
    expect(row.site_slug).toBe('epoxy-flooring-fort-myers')
    expect(row.buyer_name).toBe('Acme Epoxy')
    expect(row.fit_score).toBe(5)
    expect(row.site_niche).toBe('epoxy-flooring')
  })
})

describe('writeMatchesCsv / readMatchesCsv', () => {
  it('roundtrips correctly', () => {
    const match = {
      buyer: makeBuyer(),
      site: makeSite(),
      fitScore: 5,
    }
    const rows = [buildMatchRow(match, makeSiteConfig())]
    const csv = writeMatchesCsv(rows)
    const parsed = readMatchesCsv(csv)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].site_slug).toBe('epoxy-flooring-fort-myers')
    expect(parsed[0].buyer_name).toBe('Acme Epoxy')
  })

  it('handles quoted fields', () => {
    const match = {
      buyer: makeBuyer({ business_name: 'Acme, Inc.' }),
      site: makeSite(),
      fitScore: 3,
    }
    const rows = [buildMatchRow(match, makeSiteConfig())]
    const csv = writeMatchesCsv(rows)
    const parsed = readMatchesCsv(csv)
    expect(parsed[0].buyer_name).toBe('Acme, Inc.')
  })
})

// ── generateEmailTemplate ───────────────────────────────────────────

describe('generateEmailTemplate', () => {
  const econ = new Map([['epoxy flooring', { jobLow: 1600, jobHigh: 3500, marginLow: 40, marginHigh: 50 }]])

  it('uses owner_name when available', () => {
    const result = generateEmailTemplate(makeBuyer(), makeSiteConfig(), econ)
    expect(result.body).toMatch(/John/)
  })

  it('falls back to business_name when no owner', () => {
    const buyer = makeBuyer({ owner_name: '' })
    const result = generateEmailTemplate(buyer, makeSiteConfig(), econ)
    expect(result.body).toMatch(/Acme Epoxy/)
  })

  it('references the brand name', () => {
    const result = generateEmailTemplate(makeBuyer(), makeSiteConfig(), econ)
    expect(result.body).toMatch(/Fort Myers Floor Coatings/)
  })

  it('labels projections as estimates', () => {
    const result = generateEmailTemplate(makeBuyer(), makeSiteConfig(), econ)
    expect(result.body).toMatch(/estimate/i)
  })

  it('has a subject line', () => {
    const result = generateEmailTemplate(makeBuyer(), makeSiteConfig(), econ)
    expect(result.subject.length).toBeGreaterThan(0)
  })
})

// ── generatePhoneScript ─────────────────────────────────────────────

describe('generatePhoneScript', () => {
  const econ = new Map([['epoxy flooring', { jobLow: 1600, jobHigh: 3500, marginLow: 40, marginHigh: 50 }]])

  it('includes an opening and value prop', () => {
    const script = generatePhoneScript(makeBuyer(), makeSiteConfig(), econ)
    expect(script).toMatch(/Fort Myers Floor Coatings/)
  })

  it('references website weakness', () => {
    const script = generatePhoneScript(makeBuyer({ website_weakness: 'no_website' }), makeSiteConfig(), econ)
    expect(script).toMatch(/website/i)
  })
})

// ── formatSitePitchSummary ──────────────────────────────────────────

describe('formatSitePitchSummary', () => {
  it('includes match count and projected value', () => {
    const econ = new Map([['epoxy flooring', { jobLow: 1600, jobHigh: 3500, marginLow: 40, marginHigh: 50 }]])
    const summary = formatSitePitchSummary({
      site: makeSite(),
      matches: [{ buyer: makeBuyer(), site: makeSite(), fitScore: 5 }],
      economics: econ,
      siteConfig: makeSiteConfig(),
    })
    expect(summary).toMatch(/1/)
    expect(summary).toMatch(/\$/)
  })

  it('handles zero matches', () => {
    const econ = new Map()
    const summary = formatSitePitchSummary({
      site: makeSite(),
      matches: [],
      economics: econ,
      siteConfig: makeSiteConfig(),
    })
    expect(summary).toMatch(/0/)
  })
})

// ── formatPitchPrepSummary ──────────────────────────────────────────

describe('formatPitchPrepSummary', () => {
  it('includes per-site and totals', () => {
    const summary = formatPitchPrepSummary({
      allMatches: [
        { buyer: makeBuyer(), site: makeSite(), fitScore: 5 },
      ],
      siteCount: 1,
    })
    expect(summary).toMatch(/1 site/)
    expect(summary).toMatch(/1 match/)
  })

  it('handles multiple sites', () => {
    const summary = formatPitchPrepSummary({
      allMatches: [
        { buyer: makeBuyer(), site: makeSite(), fitScore: 5 },
        { buyer: makeBuyer(), site: makeSite({ slug: 'other-site' }), fitScore: 3 },
      ],
      siteCount: 2,
    })
    expect(summary).toMatch(/2 sites/)
    expect(summary).toMatch(/2 matches/)
  })
})
