import { describe, it, expect } from 'vitest'
import { buildSchema } from '../src/lib/schema'
import type { PageConfig, SiteConfig } from '../src/lib/resolve-site'

function makeSite(overrides?: Partial<SiteConfig>): SiteConfig {
  return {
    slug: 'test-site',
    niche: 'epoxy-flooring',
    city: 'Orlando',
    state: 'Florida',
    brand: 'Orlando Epoxy Works',
    phone: '555-123-4567',
    domain: 'orlandoepoxyworks.com',
    design: {
      shell: 'B',
      tokens: 'epoxy-flooring-2',
      orders: { home: 'O1', service: 'O1', town: 'O1', guide: 'O1', cost_guide: 'O1', faq: 'O1', tool: 'O1' },
      variants: {},
      classmap: {},
    },
    copy: {
      nav: { services: 'Services', areas: 'Areas', cost: 'Pricing', faq: 'FAQ', about: 'About' },
      cta: { primary: 'Call Now', secondary: 'Get a Quote' },
      form_heading: 'Request a Quote',
      disclosure: 1,
      trust_heading: 'How This Works',
    },
    tool: { slug: '/calculator/', type: 'epoxy-cost-estimator', primary_keyword: 'epoxy calculator orlando' },
    towns: ['Winter Park'],
    pages: [],
    ...overrides,
  }
}

function makePage(overrides?: Partial<PageConfig>): PageConfig {
  return {
    slug: '/',
    type: 'home',
    primary_keyword: 'epoxy flooring orlando',
    h1: 'Epoxy Flooring in Orlando',
    title: 'Epoxy Flooring Orlando',
    meta_description_intent: 'test',
    word_count: { min: 800, max: 1500 },
    ...overrides,
  }
}

describe('buildSchema', () => {
  it('home page emits Organization + WebSite schemas', () => {
    const schemas = buildSchema(makePage({ type: 'home' }), makeSite())
    const types = schemas.map((s: any) => s['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('WebSite')
  })

  it('service page emits Organization + Service + BreadcrumbList', () => {
    const schemas = buildSchema(
      makePage({ type: 'service', slug: '/garage-floor-epoxy/' }),
      makeSite()
    )
    const types = schemas.map((s: any) => s['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('Service')
    expect(types).toContain('BreadcrumbList')
  })

  it('FAQ page emits Organization + FAQPage + BreadcrumbList', () => {
    const schemas = buildSchema(
      makePage({ type: 'faq', slug: '/faq/' }),
      makeSite()
    )
    const types = schemas.map((s: any) => s['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('FAQPage')
    expect(types).toContain('BreadcrumbList')
  })

  it('tool page emits Organization + WebApplication + FAQPage + BreadcrumbList', () => {
    const schemas = buildSchema(
      makePage({ type: 'tool', slug: '/calculator/' }),
      makeSite()
    )
    const types = schemas.map((s: any) => s['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('WebApplication')
    expect(types).toContain('FAQPage')
    expect(types).toContain('BreadcrumbList')
  })

  it('guide page emits Organization + BreadcrumbList', () => {
    const schemas = buildSchema(
      makePage({ type: 'guide', slug: '/guides/test/' }),
      makeSite()
    )
    const types = schemas.map((s: any) => s['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('BreadcrumbList')
    // No HowTo unless explicitly step-by-step
    expect(types).not.toContain('HowTo')
  })

  it('LocalBusiness is NEVER emitted regardless of input', () => {
    const pageTypes = ['home', 'service', 'town', 'guide', 'cost_guide', 'faq', 'tool']
    for (const type of pageTypes) {
      const schemas = buildSchema(
        makePage({ type, slug: type === 'home' ? '/' : `/${type}/` }),
        makeSite()
      )
      const types = schemas.map((s: any) => s['@type'])
      expect(types).not.toContain('LocalBusiness')
    }
  })

  it('Organization uses brand name, not niche name', () => {
    const schemas = buildSchema(makePage(), makeSite())
    const org = schemas.find((s: any) => s['@type'] === 'Organization')
    expect(org).toBeDefined()
    expect(org.name).toBe('Orlando Epoxy Works')
    expect(org.name).not.toBe('epoxy-flooring')
  })

  it('BreadcrumbList has correct position numbering', () => {
    const schemas = buildSchema(
      makePage({ type: 'service', slug: '/garage-floor-epoxy/', h1: 'Garage Floor Epoxy' }),
      makeSite()
    )
    const bc = schemas.find((s: any) => s['@type'] === 'BreadcrumbList')
    expect(bc).toBeDefined()
    expect(bc.itemListElement[0].position).toBe(1)
    expect(bc.itemListElement[0].item.name).toBe('Home')
    expect(bc.itemListElement[1].position).toBe(2)
  })

  it('town page emits Organization + BreadcrumbList', () => {
    const schemas = buildSchema(
      makePage({ type: 'town', slug: '/areas/winter-park/' }),
      makeSite()
    )
    const types = schemas.map((s: any) => s['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('BreadcrumbList')
  })

  it('cost_guide page emits Organization + BreadcrumbList', () => {
    const schemas = buildSchema(
      makePage({ type: 'cost_guide', slug: '/cost/' }),
      makeSite()
    )
    const types = schemas.map((s: any) => s['@type'])
    expect(types).toContain('Organization')
    expect(types).toContain('BreadcrumbList')
  })
})
