import { describe, it, expect } from 'vitest'
import { validatePack } from '../lib/pack-schema.js'

// --- Minimal valid pack fixture ---

function makeValidPack() {
  return {
    niche: 'epoxy-flooring',
    display_name: 'Epoxy Flooring',
    sub_services: [
      { slug: 'garage-floor-epoxy', display: 'Garage Floor Epoxy', primary_keyword: 'garage floor epoxy {city}', intent: 'Garage floors' },
    ],
    page_outlines: {
      home: {
        h1: '{display_name} in {city}, {state}',
        title: '{display_name} {city} | {brand}',
        sections: [
          {
            h2: 'Professional {display_name} Services',
            h2_variants: ['Professional {display_name} Services', '{display_name} Services for Your Home', 'Our {display_name} Services'],
            content_guidance: 'Intro paragraph.',
            h3s: [],
          },
        ],
        word_count: { min: 800, max: 1500 },
      },
      service: {
        h1: '{sub_service} in {city}, {state}',
        title: '{sub_service} {city} | {brand}',
        sections: [
          {
            h2: 'What Is {sub_service}?',
            h2_variants: ['What Is {sub_service}?', 'About {sub_service}', 'Understanding {sub_service}'],
            content_guidance: 'Explain the service.',
            h3s: [],
          },
        ],
        word_count: { min: 500, max: 1000 },
      },
      town: {
        h1: '{display_name} in {city}, {state}',
        title: '{display_name} {city} {state} | {brand}',
        sections: [
          {
            h2: '{display_name} Services in {city}',
            h2_variants: ['{display_name} Services in {city}', '{city} {display_name} Services', 'Local {display_name} in {city}'],
            content_guidance: 'Tie the service to the town.',
            h3s: [],
          },
        ],
        word_count: { min: 500, max: 1000 },
      },
      cost_guide: {
        h1: 'How Much Does {display_name} Cost in {city}?',
        title: '{display_name} Cost {city} | {brand}',
        sections: [
          {
            h2: 'Average {display_name} Prices',
            h2_variants: ['Average {display_name} Prices', '{display_name} Price Ranges', 'How Much Does {display_name} Cost?'],
            content_guidance: 'Price ranges by project type.',
            h3s: [],
          },
        ],
        word_count: { min: 500, max: 1000 },
      },
      faq: {
        h1: '{display_name} FAQ — {city}, {state}',
        title: '{display_name} FAQ {city} | {brand}',
        sections: [
          {
            h2: 'Frequently Asked Questions About {display_name}',
            h2_variants: ['Frequently Asked Questions About {display_name}', '{display_name} Questions Answered', 'Common {display_name} Questions'],
            content_guidance: 'Answer each question.',
            h3s: [],
          },
        ],
        word_count: { min: 400, max: 1000 },
        schema: 'FAQPage',
      },
      guide: {
        h1: '{topic} — {city}, {state}',
        title: '{topic} | {brand}',
        sections: [
          {
            h2: 'Overview',
            h2_variants: ['Overview', 'What You Need to Know', 'Quick Summary'],
            content_guidance: 'Introduce the topic.',
            h3s: [],
          },
          {
            h2: 'Key Takeaways',
            h2_variants: ['Key Takeaways', 'The Bottom Line', 'Summary'],
            content_guidance: 'Summarize findings.',
            h3s: [],
          },
        ],
        word_count: { min: 600, max: 1500 },
      },
      tool_page: {
        h1: '{tool_name} — {city}, {state}',
        title: '{tool_name} {city} | {brand}',
        sections: [
          {
            h2: 'How This Calculator Works',
            h2_variants: ['How This Calculator Works', 'About This Estimator', 'How to Use This Tool'],
            content_guidance: 'Explain tool inputs and outputs.',
            h3s: [],
          },
          {
            h2: 'Frequently Asked Questions',
            h2_variants: ['Frequently Asked Questions', 'Common Questions', 'FAQ'],
            content_guidance: 'Tool-related FAQs.',
            h3s: [],
          },
        ],
        word_count: { min: 300, max: 800 },
        schema: ['WebApplication', 'FAQPage'],
      },
    },
    tool: {
      type: 'epoxy-cost-estimator',
      default_slug: '/garage-floor-cost-calculator/',
      inputs: ['garage_size', 'finish', 'floor_condition'],
      outputs: ['sq_ft', 'price_per_sq_ft_range', 'total_range', 'estimated_days'],
    },
    guide_topics: [
      { type: 'guide', topic: 'Epoxy vs. polyaspartic garage floors', target_keyword: 'epoxy vs polyaspartic {city}' },
      { type: 'guide', topic: 'How long does an epoxy floor last?', target_keyword: 'how long does epoxy garage floor last' },
    ],
    design: {
      tokens: ['epoxy-flooring-1', 'epoxy-flooring-2'],
      image_set: 'epoxy-flooring',
    },
  }
}

// --- Tests ---

describe('validatePack', () => {
  it('validates a complete pack with all required fields', () => {
    const result = validatePack(makeValidPack())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects pack missing h2_variants on any section', () => {
    const pack = makeValidPack()
    delete pack.page_outlines.home.sections[0].h2_variants
    const result = validatePack(pack)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('h2_variants'))).toBe(true)
  })

  it('rejects h2_variants with fewer than 3 entries', () => {
    const pack = makeValidPack()
    pack.page_outlines.home.sections[0].h2_variants = ['Only One', 'Only Two']
    const result = validatePack(pack)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('3'))).toBe(true)
  })

  it('requires first h2_variant to match the h2 string', () => {
    const pack = makeValidPack()
    pack.page_outlines.home.sections[0].h2_variants = ['Wrong First Entry', 'Second', 'Third']
    const result = validatePack(pack)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('first h2_variant') || e.includes('match'))).toBe(true)
  })

  it('requires tool block with type and default_slug', () => {
    const pack = makeValidPack()
    delete pack.tool
    const result = validatePack(pack)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('tool'))).toBe(true)
  })

  it('rejects tool block missing type', () => {
    const pack = makeValidPack()
    delete pack.tool.type
    const result = validatePack(pack)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('tool.type'))).toBe(true)
  })

  it('rejects tool block missing default_slug', () => {
    const pack = makeValidPack()
    delete pack.tool.default_slug
    const result = validatePack(pack)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('tool.default_slug'))).toBe(true)
  })

  it('requires guide page outline and tool_page outline', () => {
    const pack = makeValidPack()
    delete pack.page_outlines.guide
    const result = validatePack(pack)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('guide'))).toBe(true)

    const pack2 = makeValidPack()
    delete pack2.page_outlines.tool_page
    const result2 = validatePack(pack2)
    expect(result2.valid).toBe(false)
    expect(result2.errors.some(e => e.includes('tool_page'))).toBe(true)
  })

  it('requires design block with tokens array', () => {
    const pack = makeValidPack()
    delete pack.design
    const result = validatePack(pack)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('design'))).toBe(true)
  })

  it('rejects design block without tokens', () => {
    const pack = makeValidPack()
    delete pack.design.tokens
    const result = validatePack(pack)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('design.tokens'))).toBe(true)
  })

  it('requires at least 2 guide_topics entries with type: guide', () => {
    const pack = makeValidPack()
    pack.guide_topics = [
      { type: 'guide', topic: 'Only one', target_keyword: 'only one' },
    ]
    const result = validatePack(pack)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('guide_topics') && e.includes('2'))).toBe(true)
  })

  it('rejects missing guide_topics entirely', () => {
    const pack = makeValidPack()
    delete pack.guide_topics
    const result = validatePack(pack)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('guide_topics'))).toBe(true)
  })

  it('does not count non-guide types toward the 2 guide minimum', () => {
    const pack = makeValidPack()
    pack.guide_topics = [
      { type: 'cost_guide', topic: 'Cost guide', target_keyword: 'cost' },
      { type: 'faq', questions: ['Q1', 'Q2'] },
      { type: 'guide', topic: 'Only one guide', target_keyword: 'one' },
    ]
    const result = validatePack(pack)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('guide_topics') && e.includes('2'))).toBe(true)
  })
})
