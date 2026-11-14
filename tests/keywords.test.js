import { describe, it, expect } from 'vitest'
import { buildPagePlan, validateSiteYaml, extractStateFromRegion, slugify } from '../lib/keywords.js'

// --- Test fixtures ---

const epoxyPack = {
  niche: 'epoxy-flooring',
  display_name: 'Epoxy Flooring',
  sub_services: [
    { slug: 'garage-floor-epoxy', display: 'Garage Floor Epoxy', primary_keyword: 'garage floor epoxy {city}', intent: 'Garage floors' },
    { slug: 'commercial-epoxy-flooring', display: 'Commercial Epoxy Flooring', primary_keyword: 'commercial epoxy flooring {city}', intent: 'Commercial' },
    { slug: 'epoxy-floor-coating', display: 'Epoxy Floor Coating', primary_keyword: 'epoxy floor coating {city}', intent: 'General' },
    { slug: 'metallic-epoxy-flooring', display: 'Metallic Epoxy Flooring', primary_keyword: 'metallic epoxy flooring {city}', intent: 'Decorative' },
  ],
  page_outlines: {
    home: { h1: '{display_name} in {city}, {state}', title: '{display_name} {city} | {brand}', word_count: { min: 800, max: 1500 } },
    service: { h1: '{sub_service} in {city}, {state}', title: '{sub_service} {city} | {brand}', word_count: { min: 500, max: 1000 } },
    town: { h1: '{display_name} in {city}, {state}', title: '{display_name} {city} {state} | {brand}', word_count: { min: 500, max: 1000 } },
    cost_guide: { h1: 'How Much Does {display_name} Cost in {city}?', title: '{display_name} Cost {city} | {brand}', word_count: { min: 500, max: 1000 } },
    faq: { h1: '{display_name} FAQ — {city}, {state}', title: '{display_name} FAQ {city} | {brand}', word_count: { min: 400, max: 1000 }, schema: 'FAQPage' },
  },
}

const bathroomPack = {
  niche: 'bathroom-remodel',
  display_name: 'Bathroom Remodel',
  sub_services: [
    { slug: 'full-bathroom-remodel', display: 'Full Bathroom Remodel', primary_keyword: 'bathroom remodel {city}', intent: 'Complete rebuild' },
    { slug: 'shower-remodel', display: 'Shower Remodel', primary_keyword: 'shower remodel {city}', intent: 'Shower replacement' },
    { slug: 'bathtub-replacement', display: 'Bathtub Replacement', primary_keyword: 'bathtub replacement {city}', intent: 'Tub swap' },
    { slug: 'tub-to-shower-conversion', display: 'Tub-to-Shower Conversion', primary_keyword: 'tub to shower conversion {city}', intent: 'Tub removal' },
    { slug: 'small-bathroom-remodel', display: 'Small Bathroom Remodel', primary_keyword: 'small bathroom remodel {city}', intent: 'Budget update' },
  ],
  page_outlines: {
    home: { h1: '{display_name} in {city}, {state}', title: '{display_name} {city} | {brand}', word_count: { min: 800, max: 1500 } },
    service: { h1: '{sub_service} in {city}, {state}', title: '{sub_service} {city} | {brand}', word_count: { min: 500, max: 1000 } },
    town: { h1: '{display_name} in {city}, {state}', title: '{display_name} {city} {state} | {brand}', word_count: { min: 500, max: 1000 } },
    cost_guide: { h1: 'How Much Does {display_name} Cost in {city}?', title: '{display_name} Cost {city} | {brand}', word_count: { min: 500, max: 1000 } },
    faq: { h1: '{display_name} FAQ — {city}, {state}', title: '{display_name} FAQ {city} | {brand}', word_count: { min: 400, max: 1000 }, schema: 'FAQPage' },
  },
}

// Pack with Phase 4 fields (tool, guide_topics, guide/tool_page outlines)
const epoxyPackFull = {
  ...epoxyPack,
  page_outlines: {
    ...epoxyPack.page_outlines,
    guide: { h1: '{topic} — {city}, {state}', title: '{topic} | {brand}', word_count: { min: 600, max: 1500 } },
    tool_page: { h1: '{tool_name} — {city}, {state}', title: '{tool_name} {city} | {brand}', word_count: { min: 300, max: 800 }, schema: ['WebApplication', 'FAQPage'] },
  },
  tool: {
    type: 'epoxy-cost-estimator',
    default_slug: '/garage-floor-cost-calculator/',
    inputs: ['garage_size', 'finish', 'floor_condition'],
    outputs: ['sq_ft', 'price_per_sq_ft_range', 'total_range', 'estimated_days'],
  },
  guide_topics: [
    { type: 'cost_guide', topic: 'How much does epoxy flooring cost?', target_keyword: 'epoxy flooring cost {city}' },
    { type: 'faq', questions: ['Q1', 'Q2'] },
    { type: 'guide', topic: 'Epoxy vs. Polyaspartic Garage Floors', target_keyword: 'epoxy vs polyaspartic {city}' },
    { type: 'guide', topic: 'How Long Does an Epoxy Floor Last?', target_keyword: 'how long does epoxy garage floor last' },
  ],
}

const miamiCandidate = { niche: 'epoxy-flooring', area: 'Miami', region: 'Florida (city-list)' }
const conroeCandidate = { niche: 'bathroom-remodel', area: 'Conroe', region: 'Texas (local-discover)' }
const miamiTowns = ['Hialeah', 'Coral Gables', 'Miami Beach', 'Doral']
const conroeTowns = ['The Woodlands', 'Willis', 'Spring', 'Shenandoah']

// --- extractStateFromRegion ---

describe('extractStateFromRegion', () => {
  it('extracts state from "(city-list)" region', () => {
    expect(extractStateFromRegion('Florida (city-list)')).toBe('Florida')
  })

  it('extracts state from "(local-discover)" region', () => {
    expect(extractStateFromRegion('Texas (local-discover)')).toBe('Texas')
  })

  it('extracts multi-word state names', () => {
    expect(extractStateFromRegion('North Carolina (city-list)')).toBe('North Carolina')
  })

  it('returns region as-is when no parenthetical suffix', () => {
    expect(extractStateFromRegion('Florida')).toBe('Florida')
  })
})

// --- slugify ---

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Miami Beach')).toBe('miami-beach')
  })

  it('handles "The" prefix', () => {
    expect(slugify('The Woodlands')).toBe('the-woodlands')
  })

  it('strips periods', () => {
    expect(slugify('Port St. Lucie')).toBe('port-st-lucie')
  })
})

// --- buildPagePlan ---

describe('buildPagePlan', () => {
  it('returns correct page count (1 home + 4 services + 4 towns + cost_guide + faq = 11)', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    expect(result.pages).toHaveLength(11)
  })

  it('returns 12 pages for 5-service niche with 4 towns (1+5+4+1+1)', () => {
    const result = buildPagePlan(conroeCandidate, bathroomPack, conroeTowns)
    expect(result.pages).toHaveLength(12)
  })

  it('every page has required fields', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    for (const page of result.pages) {
      expect(page).toHaveProperty('slug')
      expect(page).toHaveProperty('type')
      expect(page).toHaveProperty('primary_keyword')
      expect(page).toHaveProperty('h1')
      expect(page).toHaveProperty('title')
      expect(page).toHaveProperty('meta_description_intent')
      expect(page).toHaveProperty('word_count')
      expect(page.word_count).toHaveProperty('min')
      expect(page.word_count).toHaveProperty('max')
    }
  })

  it('home page primary_keyword = "{display_name} {city}" lowercased', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    const home = result.pages.find(p => p.type === 'home')
    expect(home.primary_keyword).toBe('epoxy flooring miami')
    expect(home.slug).toBe('/')
  })

  it('service page keywords use pack primary_keyword with {city} substituted', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    const services = result.pages.filter(p => p.type === 'service')
    expect(services).toHaveLength(4)
    expect(services[0].primary_keyword).toBe('garage floor epoxy miami')
    expect(services[0].slug).toBe('/garage-floor-epoxy/')
  })

  it('town page keywords use "{display_name} {town}" pattern', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    const towns = result.pages.filter(p => p.type === 'town')
    expect(towns).toHaveLength(4)
    expect(towns[0].primary_keyword).toBe('epoxy flooring hialeah')
    expect(towns[0].slug).toBe('/areas/hialeah/')
  })

  it('cost guide page has correct keyword', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    const cost = result.pages.find(p => p.type === 'cost_guide')
    expect(cost.primary_keyword).toBe('epoxy flooring cost miami')
    expect(cost.slug).toBe('/cost/')
  })

  it('faq page has correct keyword and schema', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    const faq = result.pages.find(p => p.type === 'faq')
    expect(faq.primary_keyword).toBe('epoxy flooring faq')
    expect(faq.slug).toBe('/faq/')
    expect(faq.schema).toBe('FAQPage')
  })

  it('no two pages share the same primary_keyword', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    const keywords = result.pages.map(p => p.primary_keyword)
    expect(new Set(keywords).size).toBe(keywords.length)
  })

  it('all titles under 60 characters', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    for (const page of result.pages) {
      expect(page.title.length).toBeLessThanOrEqual(60)
    }
  })

  it('deduplicates when service display matches niche display (paver sealing)', () => {
    const paverPack = {
      ...epoxyPack,
      niche: 'paver-sealing',
      display_name: 'Paver Sealing',
      sub_services: [
        { slug: 'paver-sealing', display: 'Paver Sealing', primary_keyword: 'paver sealing {city}', intent: 'Sealing' },
        { slug: 'paver-cleaning', display: 'Paver Cleaning', primary_keyword: 'paver cleaning {city}', intent: 'Cleaning' },
      ],
    }
    const candidate = { niche: 'paver-sealing', area: 'Cape Coral', region: 'Florida (local-discover)' }
    const result = buildPagePlan(candidate, paverPack, ['Fort Myers', 'Lehigh Acres'])
    const keywords = result.pages.map(p => p.primary_keyword)
    expect(new Set(keywords).size).toBe(keywords.length)
    const sealingSvc = result.pages.find(p => p.slug === '/paver-sealing/')
    expect(sealingSvc.primary_keyword).toContain('services')
  })

  it('deduplicates when service keyword matches home keyword', () => {
    // bathroom-remodel's first sub_service has keyword "bathroom remodel {city}"
    // which collides with the home page keyword pattern
    const result = buildPagePlan(conroeCandidate, bathroomPack, conroeTowns)
    const keywords = result.pages.map(p => p.primary_keyword)
    // No duplicates
    expect(new Set(keywords).size).toBe(keywords.length)
    // The home keyword should be "bathroom remodel conroe"
    const home = result.pages.find(p => p.type === 'home')
    expect(home.primary_keyword).toBe('bathroom remodel conroe')
    // The colliding service should use its display name to differentiate
    const fullRemodel = result.pages.find(p => p.slug === '/full-bathroom-remodel/')
    expect(fullRemodel.primary_keyword).not.toBe('bathroom remodel conroe')
    expect(fullRemodel.primary_keyword).toContain('conroe')
  })

  it('empty sub_services produces only home + town + cost_guide + faq pages', () => {
    const emptyPack = { ...epoxyPack, sub_services: [] }
    const result = buildPagePlan(miamiCandidate, emptyPack, miamiTowns)
    const types = result.pages.map(p => p.type)
    expect(types).not.toContain('service')
    expect(types).toContain('home')
    expect(types).toContain('town')
    expect(types).toContain('cost_guide')
    expect(types).toContain('faq')
  })

  it('brand defaults to TBD', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    expect(result.brand).toBe('TBD')
  })

  it('h1 uses correct templates', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    const home = result.pages.find(p => p.type === 'home')
    expect(home.h1).toBe('Epoxy Flooring in Miami, Florida')
    const service = result.pages.find(p => p.slug === '/garage-floor-epoxy/')
    expect(service.h1).toBe('Garage Floor Epoxy in Miami, Florida')
  })

  it('town page h1 uses town name, not main city', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    const hialeah = result.pages.find(p => p.slug === '/areas/hialeah/')
    expect(hialeah.h1).toBe('Epoxy Flooring in Hialeah, Florida')
  })

  // --- Tool and guide page tests (Phase 4) ---

  it('includes tool page when pack has tool block', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPackFull, miamiTowns)
    const tool = result.pages.find(p => p.type === 'tool')
    expect(tool).toBeDefined()
    expect(tool.slug).toBe('/garage-floor-cost-calculator/')
  })

  it('tool page slug comes from assignment toolSlug parameter', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPackFull, miamiTowns, { toolSlug: '/floor-coating-cost-calculator/' })
    const tool = result.pages.find(p => p.type === 'tool')
    expect(tool.slug).toBe('/floor-coating-cost-calculator/')
  })

  it('tool page keyword does not collide with cost guide keyword', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPackFull, miamiTowns)
    const tool = result.pages.find(p => p.type === 'tool')
    const cost = result.pages.find(p => p.type === 'cost_guide')
    expect(tool.primary_keyword).not.toBe(cost.primary_keyword)
    // Tool targets calculator/estimator phrase, cost guide targets cost/price
    expect(tool.primary_keyword).toMatch(/calculator|estimator/)
  })

  it('includes 2 guide pages when pack has guide_topics with type: guide', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPackFull, miamiTowns)
    const guides = result.pages.filter(p => p.type === 'guide')
    expect(guides).toHaveLength(2)
  })

  it('guide page slugs are under /guides/', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPackFull, miamiTowns)
    const guides = result.pages.filter(p => p.type === 'guide')
    for (const guide of guides) {
      expect(guide.slug).toMatch(/^\/guides\//)
    }
  })

  it('total page count is 14 for standard site with tool + guides (1+4+4+1+1+1+2)', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPackFull, miamiTowns)
    expect(result.pages).toHaveLength(14)
  })

  it('does not add tool or guide pages when pack lacks those fields', () => {
    const result = buildPagePlan(miamiCandidate, epoxyPack, miamiTowns)
    expect(result.pages.find(p => p.type === 'tool')).toBeUndefined()
    expect(result.pages.find(p => p.type === 'guide')).toBeUndefined()
  })
})

// --- validateSiteYaml ---

describe('validateSiteYaml', () => {
  // Uses Phase 4 pack (with tool + guides) to produce 14-page plans
  function makeSiteYaml(overrides = {}) {
    const plan = buildPagePlan(miamiCandidate, epoxyPackFull, miamiTowns)
    return {
      niche: 'epoxy-flooring',
      display_name: 'Epoxy Flooring',
      city: 'Miami',
      state: 'Florida',
      brand: 'TBD',
      phone: null,
      domain: null,
      towns: miamiTowns,
      pages: plan.pages,
      ...overrides,
    }
  }

  it('returns valid for well-formed site.yaml with 14 pages', () => {
    const result = validateSiteYaml(makeSiteYaml(), epoxyPackFull)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns errors for duplicate primary_keywords', () => {
    const site = makeSiteYaml()
    site.pages[1].primary_keyword = site.pages[0].primary_keyword
    const result = validateSiteYaml(site, epoxyPackFull)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('duplicate'))).toBe(true)
  })

  it('returns errors when title exceeds 60 chars', () => {
    const site = makeSiteYaml()
    site.pages[0].title = 'A'.repeat(61)
    const result = validateSiteYaml(site, epoxyPackFull)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('title'))).toBe(true)
  })

  it('returns errors when page count below 12', () => {
    const site = makeSiteYaml()
    site.pages = site.pages.slice(0, 11)
    const result = validateSiteYaml(site, epoxyPackFull)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('page count'))).toBe(true)
  })

  it('returns errors when page count exceeds 16', () => {
    const site = makeSiteYaml()
    while (site.pages.length <= 16) {
      site.pages.push({ ...site.pages[0], primary_keyword: `extra keyword ${site.pages.length}`, slug: `/extra-${site.pages.length}/`, type: 'town' })
    }
    const result = validateSiteYaml(site, epoxyPackFull)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('page count'))).toBe(true)
  })

  it('accepts 12 pages (minimum valid)', () => {
    const site = makeSiteYaml()
    // Remove 2 town pages to get 12
    const townPages = site.pages.filter(p => p.type === 'town')
    const toRemove = townPages.slice(2).map(p => p.slug)
    site.pages = site.pages.filter(p => !toRemove.includes(p.slug))
    expect(site.pages).toHaveLength(12)
    const result = validateSiteYaml(site, epoxyPackFull)
    expect(result.valid).toBe(true)
  })

  it('returns errors when required page types missing (home)', () => {
    const site = makeSiteYaml()
    site.pages = site.pages.filter(p => p.type !== 'home')
    while (site.pages.length < 12) {
      site.pages.push({ ...site.pages[0], primary_keyword: `filler ${site.pages.length}`, slug: `/filler-${site.pages.length}/`, type: 'town' })
    }
    const result = validateSiteYaml(site, epoxyPackFull)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('home'))).toBe(true)
  })

  it('returns errors when required page types missing (faq)', () => {
    const site = makeSiteYaml()
    site.pages = site.pages.filter(p => p.type !== 'faq')
    while (site.pages.length < 12) {
      site.pages.push({ ...site.pages[0], primary_keyword: `filler ${site.pages.length}`, slug: `/filler-${site.pages.length}/`, type: 'town' })
    }
    const result = validateSiteYaml(site, epoxyPackFull)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('faq'))).toBe(true)
  })

  it('returns errors when required page type tool is missing', () => {
    const site = makeSiteYaml()
    site.pages = site.pages.filter(p => p.type !== 'tool')
    while (site.pages.length < 12) {
      site.pages.push({ ...site.pages[0], primary_keyword: `filler ${site.pages.length}`, slug: `/filler-${site.pages.length}/`, type: 'town' })
    }
    const result = validateSiteYaml(site, epoxyPackFull)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('tool'))).toBe(true)
  })
})
