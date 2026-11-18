import { describe, it, expect } from 'vitest'
import {
  extractPriceRange,
  extractFirstSentence,
  extractTownSnippet,
  extractFaqTopics,
  extractServiceList,
  buildMetaDescription,
  rewriteFrontmatter,
} from '../lib/meta-description.js'

// --- extractPriceRange ---

describe('extractPriceRange', () => {
  it('extracts "$1,600 to $3,500" from body text', () => {
    const text = 'Most two-car garages come in between $1,600 to $3,500 when a professional handles the work.'
    expect(extractPriceRange(text)).toBe('$1,600 to $3,500')
  })

  it('extracts "$3 to $7 per square foot" format', () => {
    const text = 'Standard epoxy costs $3 to $7 per square foot for materials and labor.'
    expect(extractPriceRange(text)).toBe('$3 to $7 per square foot')
  })

  it('returns null when no price found', () => {
    const text = 'Epoxy flooring is a great choice for your garage. It lasts for years.'
    expect(extractPriceRange(text)).toBeNull()
  })

  it('handles "$X–$Y" en-dash format', () => {
    const text = 'Expect to pay $1,250–$2,500 for a one-car garage.'
    expect(extractPriceRange(text)).toBe('$1,250–$2,500')
  })
})

// --- extractFirstSentence ---

describe('extractFirstSentence', () => {
  it('returns first sentence up to period + space', () => {
    const text = 'If you need garage floor epoxy in Fort Myers, you are solving the same problem. This is the second sentence.'
    expect(extractFirstSentence(text)).toBe('If you need garage floor epoxy in Fort Myers, you are solving the same problem.')
  })

  it('strips markdown bold/italic markers', () => {
    const text = 'If you need **garage floor epoxy in Fort Myers**, you are solving the same problem. Second sentence.'
    expect(extractFirstSentence(text)).toBe('If you need garage floor epoxy in Fort Myers, you are solving the same problem.')
  })

  it('truncates at ~80 chars on word boundary if sentence is too long', () => {
    const text = 'Fort Myers Floor Coatings is your connection to professional epoxy flooring contractors who install garage coatings and commercial systems across all of Lee County and the surrounding areas. Second sentence.'
    const result = extractFirstSentence(text)
    expect(result.length).toBeLessThanOrEqual(83) // 80 + "..." length
    expect(result).toMatch(/\.\.\.$/)
  })
})

// --- extractTownSnippet ---

describe('extractTownSnippet', () => {
  it('takes first fact, trims to ~60 chars on word boundary', () => {
    const facts = [
      'Population 236,264 (2025); largest city in Lee County, across the Caloosahatchee from Fort Myers',
      'Second fact here',
    ]
    const result = extractTownSnippet(facts)
    expect(result.length).toBeLessThanOrEqual(63)
    expect(result.length).toBeGreaterThan(0)
  })

  it('handles empty/missing town_facts', () => {
    expect(extractTownSnippet([])).toBeNull()
    expect(extractTownSnippet(null)).toBeNull()
    expect(extractTownSnippet(undefined)).toBeNull()
  })

  it('strips leading "Population X;" prefix to get the interesting part', () => {
    const facts = ['Population 236,264 (2025); largest city in Lee County, across the Caloosahatchee from Fort Myers']
    const result = extractTownSnippet(facts)
    expect(result).not.toMatch(/^Population/)
  })
})

// --- extractFaqTopics ---

describe('extractFaqTopics', () => {
  it('extracts 2-3 topic keywords from FAQ question strings', () => {
    const faqs = [
      'How long does epoxy flooring last?',
      'Can you epoxy a garage floor yourself?',
      'How long does epoxy take to cure?',
    ]
    const result = extractFaqTopics(faqs)
    expect(result).toContain('lifespan')
    // Should be a comma-separated string
    expect(typeof result).toBe('string')
    expect(result.split(', ').length).toBeGreaterThanOrEqual(2)
    expect(result.split(', ').length).toBeLessThanOrEqual(3)
  })

  it('handles object-format {question, answer} entries', () => {
    const faqs = [
      { question: 'How much does epoxy cost?', answer: 'It depends.' },
      { question: 'Is epoxy slippery?', answer: 'Not usually.' },
    ]
    const result = extractFaqTopics(faqs)
    expect(typeof result).toBe('string')
    expect(result.split(', ').length).toBeGreaterThanOrEqual(2)
  })

  it('produces comma-separated topic string', () => {
    const faqs = ['How much does it cost?', 'How long does installation take?', 'Is it waterproof?']
    const result = extractFaqTopics(faqs)
    expect(result).toMatch(/^[^,]+, [^,]+/)
  })
})

// --- extractServiceList ---

describe('extractServiceList', () => {
  it('pulls display names from service-type pages', () => {
    const siteYaml = {
      pages: [
        { slug: '/', type: 'home', h1: 'Epoxy Flooring in Fort Myers, Florida' },
        { slug: '/garage-floor-epoxy/', type: 'service', h1: 'Garage Floor Epoxy in Fort Myers, Florida' },
        { slug: '/commercial-epoxy-flooring/', type: 'service', h1: 'Commercial Epoxy Flooring in Fort Myers, Florida' },
        { slug: '/cost/', type: 'cost_guide', h1: 'How Much Does Epoxy Flooring Cost?' },
      ],
    }
    const result = extractServiceList(siteYaml)
    expect(result).toContain('garage floor epoxy')
    expect(result).toContain('commercial epoxy flooring')
    expect(result).not.toContain('cost')
  })

  it('joins as comma-separated list, truncated to fit', () => {
    const siteYaml = {
      pages: [
        { slug: '/', type: 'home', h1: 'Home' },
        { slug: '/a/', type: 'service', h1: 'Garage Floor Epoxy in Fort Myers, Florida' },
        { slug: '/b/', type: 'service', h1: 'Commercial Epoxy Flooring in Fort Myers, Florida' },
        { slug: '/c/', type: 'service', h1: 'Metallic Epoxy Flooring in Fort Myers, Florida' },
        { slug: '/d/', type: 'service', h1: 'Epoxy Floor Coating in Fort Myers, Florida' },
      ],
    }
    const result = extractServiceList(siteYaml)
    expect(result.length).toBeLessThanOrEqual(80)
    expect(typeof result).toBe('string')
  })
})

// --- buildMetaDescription ---

describe('buildMetaDescription', () => {
  it('builds home description 120-160 chars with keyword and CTA', () => {
    const result = buildMetaDescription({
      type: 'home',
      keyword: 'epoxy flooring fort myers',
      city: 'Fort Myers',
      state: 'Florida',
      serviceList: 'garage floor epoxy, commercial epoxy flooring, metallic epoxy',
    })
    expect(result.length).toBeGreaterThanOrEqual(120)
    expect(result.length).toBeLessThanOrEqual(160)
    expect(result.toLowerCase()).toContain('epoxy flooring')
    expect(result.toLowerCase()).toContain('fort myers')
  })

  it('builds service description with first-sentence extract', () => {
    const result = buildMetaDescription({
      type: 'service',
      keyword: 'garage floor epoxy fort myers',
      city: 'Fort Myers',
      state: 'Florida',
      firstSentence: 'Epoxy coating for residential garage floors over prepared concrete.',
    })
    expect(result.length).toBeGreaterThanOrEqual(120)
    expect(result.length).toBeLessThanOrEqual(160)
    expect(result.toLowerCase()).toContain('garage floor epoxy')
  })

  it('builds town description with town snippet', () => {
    const result = buildMetaDescription({
      type: 'town',
      keyword: 'epoxy flooring cape coral',
      city: 'Cape Coral',
      state: 'Florida',
      townSnippet: 'largest city in Lee County with 400+ miles of canals',
    })
    expect(result.length).toBeGreaterThanOrEqual(120)
    expect(result.length).toBeLessThanOrEqual(160)
    expect(result.toLowerCase()).toContain('epoxy flooring')
    expect(result.toLowerCase()).toContain('cape coral')
  })

  it('builds cost_guide description with price range', () => {
    const result = buildMetaDescription({
      type: 'cost_guide',
      keyword: 'epoxy flooring cost fort myers',
      city: 'Fort Myers',
      state: 'Florida',
      priceRange: '$1,600 to $3,500',
    })
    expect(result.length).toBeGreaterThanOrEqual(120)
    expect(result.length).toBeLessThanOrEqual(160)
    expect(result).toContain('$1,600')
  })

  it('builds faq description with topic list', () => {
    const result = buildMetaDescription({
      type: 'faq',
      keyword: 'epoxy flooring faq',
      city: 'Fort Myers',
      state: 'Florida',
      faqTopics: 'lifespan, DIY vs pro, curing time',
    })
    expect(result.length).toBeGreaterThanOrEqual(120)
    expect(result.length).toBeLessThanOrEqual(160)
    expect(result.toLowerCase()).toContain('epoxy flooring')
  })

  it('builds tool description', () => {
    const result = buildMetaDescription({
      type: 'tool',
      keyword: 'garage floor cost calculator fort myers',
      city: 'Fort Myers',
      state: 'Florida',
      firstSentence: 'Get a price range for an epoxy floor before you talk to anyone.',
    })
    expect(result.length).toBeGreaterThanOrEqual(120)
    expect(result.length).toBeLessThanOrEqual(160)
    expect(result.toLowerCase()).toContain('fort myers')
  })

  it('builds guide description', () => {
    const result = buildMetaDescription({
      type: 'guide',
      keyword: 'epoxy vs polyaspartic fort myers',
      city: 'Fort Myers',
      state: 'Florida',
      h2List: 'quick summary, key differences, how this affects your decision',
    })
    expect(result.length).toBeGreaterThanOrEqual(120)
    expect(result.length).toBeLessThanOrEqual(160)
    expect(result.toLowerCase()).toContain('epoxy')
  })

  it('all descriptions include a CTA phrase', () => {
    const types = [
      { type: 'home', keyword: 'epoxy flooring fort myers', city: 'Fort Myers', state: 'Florida', serviceList: 'garage epoxy, commercial epoxy' },
      { type: 'service', keyword: 'garage floor epoxy fort myers', city: 'Fort Myers', state: 'Florida', firstSentence: 'Coating for residential garage floors.' },
      { type: 'town', keyword: 'epoxy flooring cape coral', city: 'Cape Coral', state: 'Florida', townSnippet: 'largest city in Lee County' },
      { type: 'cost_guide', keyword: 'epoxy flooring cost fort myers', city: 'Fort Myers', state: 'Florida', priceRange: '$1,600 to $3,500' },
      { type: 'faq', keyword: 'epoxy flooring faq', city: 'Fort Myers', state: 'Florida', faqTopics: 'lifespan, DIY' },
      { type: 'tool', keyword: 'garage floor cost calculator', city: 'Fort Myers', state: 'Florida', firstSentence: 'Get a price range.' },
      { type: 'guide', keyword: 'epoxy vs polyaspartic', city: 'Fort Myers', state: 'Florida', h2List: 'summary, differences' },
    ]
    const ctaPatterns = /free quote|free estimate|compare|contact|call|get started|request/i
    for (const params of types) {
      const result = buildMetaDescription(params)
      expect(result).toMatch(ctaPatterns)
    }
  })
})

// --- rewriteFrontmatter ---

describe('rewriteFrontmatter', () => {
  it('replaces meta_description line in frontmatter YAML', () => {
    const raw = `---
title: Epoxy Flooring Fort Myers
meta_description: Short old description.
h1: Epoxy Flooring
---

Body content here.`
    const result = rewriteFrontmatter(raw, 'New longer meta description that is definitely over 120 characters and includes the primary keyword and a call to action for the reader.')
    expect(result).toContain('meta_description: "New longer meta description')
    expect(result).not.toContain('Short old description')
    expect(result).toContain('Body content here.')
  })

  it('handles single-quoted and double-quoted values', () => {
    const singleQuoted = `---
title: Test
meta_description: 'Old single-quoted description here.'
h1: Test
---

Body.`
    const doubleQuoted = `---
title: Test
meta_description: "Old double-quoted description here."
h1: Test
---

Body.`
    const newDesc = 'New description that is long enough to pass validation and contains all the right keywords for SEO purposes and a call to action.'
    const r1 = rewriteFrontmatter(singleQuoted, newDesc)
    const r2 = rewriteFrontmatter(doubleQuoted, newDesc)
    expect(r1).toContain(`meta_description: "${newDesc}"`)
    expect(r2).toContain(`meta_description: "${newDesc}"`)
    expect(r1).toContain('Body.')
    expect(r2).toContain('Body.')
  })

  it('handles multi-line >- block scalar format', () => {
    const raw = `---
title: Test Tool Page
meta_description: >-
  Free cost calculator for Fort Myers, Florida. Get an instant
  estimate for your project.
h1: Cost Calculator
type: tool
---

Body text here.`
    const newDesc = 'New tool page description that meets the 120-160 char requirement and includes relevant keywords for search engines.'
    const result = rewriteFrontmatter(raw, newDesc)
    expect(result).toContain(`meta_description: "${newDesc}"`)
    // Continuation lines must be removed
    expect(result).not.toContain('estimate for your project')
    expect(result).not.toContain('Free cost calculator')
    // Everything else preserved
    expect(result).toContain('title: Test Tool Page')
    expect(result).toContain('h1: Cost Calculator')
    expect(result).toContain('type: tool')
    expect(result).toContain('Body text here.')
  })

  it('preserves everything else in the file unchanged', () => {
    const raw = `---
title: Epoxy Flooring Fort Myers | Fort Myers Floor Coatings
meta_description: Connect with epoxy flooring pros in Fort Myers, Florida. Free quotes from local contractors.
h1: Epoxy Flooring in Fort Myers, Florida
primary_keyword: epoxy flooring fort myers
type: home
status: draft
updated: '2026-11-15'
sections:
  - h2: Local Epoxy Flooring Contractors in Fort Myers
sources: []
faqs: []
town_facts: []
---

Fort Myers Floor Coatings is your connection to professional **epoxy flooring in Fort Myers**.`
    const newDesc = 'Professional epoxy flooring in Fort Myers, Florida — garage coatings, commercial systems, and decorative finishes. Get free quotes from local contractors today.'
    const result = rewriteFrontmatter(raw, newDesc)
    // All other frontmatter preserved
    expect(result).toContain('title: Epoxy Flooring Fort Myers | Fort Myers Floor Coatings')
    expect(result).toContain('h1: Epoxy Flooring in Fort Myers, Florida')
    expect(result).toContain('primary_keyword: epoxy flooring fort myers')
    expect(result).toContain('type: home')
    expect(result).toContain("updated: '2026-11-15'")
    expect(result).toContain('  - h2: Local Epoxy Flooring Contractors in Fort Myers')
    // Body preserved
    expect(result).toContain('Fort Myers Floor Coatings is your connection to professional **epoxy flooring in Fort Myers**.')
    // New description in place
    expect(result).toContain(newDesc)
    // Old description gone
    expect(result).not.toContain('Connect with epoxy flooring pros')
  })
})
