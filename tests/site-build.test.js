import { describe, it, expect } from 'vitest'
import {
  pickH2Variant,
  buildSectionsFrontmatter,
  buildPageFrontmatter,
  generateScaffoldMarkdown,
  updateBrandInSiteYaml,
  pageSlugToFilename,
} from '../lib/site-build.js'
import { load as loadYaml } from 'js-yaml'

// ── pickH2Variant ───────────────────────────────────────────────────

describe('pickH2Variant', () => {
  const variants = ['Variant A', 'Variant B', 'Variant C']

  it('returns the same variant for identical inputs (deterministic)', () => {
    const a = pickH2Variant(variants, 'epoxy-flooring-new-braunfels', 'home', 0)
    const b = pickH2Variant(variants, 'epoxy-flooring-new-braunfels', 'home', 0)
    expect(a).toBe(b)
  })

  it('returns different picks for different site slugs on at least some sections', () => {
    // Try several section indices — at least one should differ between sites
    const picks1 = []
    const picks2 = []
    for (let i = 0; i < 10; i++) {
      picks1.push(pickH2Variant(variants, 'epoxy-flooring-new-braunfels', 'home', i))
      picks2.push(pickH2Variant(variants, 'epoxy-flooring-fort-myers', 'home', i))
    }
    const hasDiff = picks1.some((p, i) => p !== picks2[i])
    expect(hasDiff).toBe(true)
  })

  it('always returns an element from the variants array', () => {
    for (let i = 0; i < 20; i++) {
      const pick = pickH2Variant(variants, `site-${i}`, 'service', i)
      expect(variants).toContain(pick)
    }
  })

  it('works with arrays of length other than 3', () => {
    const two = ['Alpha', 'Beta']
    const pick = pickH2Variant(two, 'some-site', 'home', 0)
    expect(two).toContain(pick)
  })
})

// ── buildSectionsFrontmatter ────────────────────────────────────────

describe('buildSectionsFrontmatter', () => {
  const packOutline = {
    sections: [
      {
        h2: 'Professional {display_name} Services',
        h2_variants: [
          'Professional {display_name} Services',
          '{display_name} Services for Your Home and Business',
          'Local {display_name} Contractors in {city}',
        ],
        h3s: ['Why Choose Epoxy Flooring?', 'Where Epoxy Flooring Works Best'],
      },
      {
        h2: 'Our Services',
        h2_variants: ['Our Services', '{display_name} Services We Offer', 'Coating Options Available in {city}'],
        h3s: [],
      },
    ],
  }

  const vars = { display_name: 'Epoxy Flooring', city: 'New Braunfels', state: 'Texas', brand: 'Comal Epoxy Floors' }

  it('returns an array of {h2, h3s} objects matching the outline length', () => {
    const sections = buildSectionsFrontmatter(packOutline, 'home', 'epoxy-flooring-new-braunfels', vars)
    expect(sections).toHaveLength(2)
    expect(sections[0]).toHaveProperty('h2')
  })

  it('replaces template vars in h2 text', () => {
    const sections = buildSectionsFrontmatter(packOutline, 'home', 'epoxy-flooring-new-braunfels', vars)
    for (const s of sections) {
      expect(s.h2).not.toContain('{display_name}')
      expect(s.h2).not.toContain('{city}')
    }
  })

  it('preserves h3s from the pack outline', () => {
    const sections = buildSectionsFrontmatter(packOutline, 'home', 'epoxy-flooring-new-braunfels', vars)
    expect(sections[0].h3s).toEqual(['Why Choose Epoxy Flooring?', 'Where Epoxy Flooring Works Best'])
  })

  it('omits h3s key when the outline section has no h3s', () => {
    const sections = buildSectionsFrontmatter(packOutline, 'home', 'epoxy-flooring-new-braunfels', vars)
    // Section with empty h3s array should not include h3s in output
    expect(sections[1].h3s).toBeUndefined()
  })

  it('replaces {sub_service} in service page h2', () => {
    const serviceOutline = {
      sections: [
        {
          h2: 'What Is {sub_service}?',
          h2_variants: ['What Is {sub_service}?', 'About {sub_service}', 'Understanding {sub_service}'],
          h3s: [],
        },
      ],
    }
    const serviceVars = { ...vars, sub_service: 'Garage Floor Epoxy' }
    const sections = buildSectionsFrontmatter(serviceOutline, 'service', 'epoxy-flooring-new-braunfels', serviceVars)
    expect(sections[0].h2).not.toContain('{sub_service}')
    expect(sections[0].h2).toContain('Garage Floor Epoxy')
  })

  it('replaces {city} in town page h2 with the town name', () => {
    const townOutline = {
      sections: [
        {
          h2: '{display_name} Services in {city}',
          h2_variants: ['{display_name} Services in {city}', '{city} {display_name} Contractors', 'Local {display_name} in {city}'],
          h3s: [],
        },
      ],
    }
    const townVars = { ...vars, city: 'San Marcos' }
    const sections = buildSectionsFrontmatter(townOutline, 'town', 'epoxy-flooring-new-braunfels', townVars)
    expect(sections[0].h2).toContain('San Marcos')
    expect(sections[0].h2).not.toContain('{city}')
  })

  it('replaces {topic} in guide page h2', () => {
    const guideOutline = {
      sections: [
        {
          h2: 'Overview',
          h2_variants: ['Overview', 'What You Need to Know', 'Quick Summary'],
          h3s: [],
        },
      ],
    }
    const guideVars = { ...vars, topic: 'Epoxy vs. Polyaspartic Garage Floors' }
    const sections = buildSectionsFrontmatter(guideOutline, 'guide', 'epoxy-flooring-new-braunfels', guideVars)
    // These variants don't use {topic}, so just confirm no unresolved vars
    expect(sections[0].h2).not.toMatch(/\{[a-z_]+\}/)
  })
})

// ── buildPageFrontmatter ────────────────────────────────────────────

describe('buildPageFrontmatter', () => {
  const homePage = {
    slug: '/',
    type: 'home',
    primary_keyword: 'epoxy flooring new braunfels',
    h1: 'Epoxy Flooring in New Braunfels, Texas',
    title: 'Epoxy Flooring New Braunfels | Comal Epoxy Floors',
    meta_description_intent: 'Connect with epoxy flooring pros in New Braunfels, Texas.',
    word_count: { min: 800, max: 1500 },
  }

  const packOutline = {
    sections: [
      {
        h2: 'Professional {display_name} Services',
        h2_variants: ['Professional {display_name} Services', '{display_name} Services for Your Home', 'Local {display_name} Contractors in {city}'],
        h3s: ['Why Choose Epoxy Flooring?', 'Where Epoxy Flooring Works Best'],
      },
    ],
  }

  const vars = { display_name: 'Epoxy Flooring', city: 'New Braunfels', state: 'Texas', brand: 'Comal Epoxy Floors' }

  it('includes all required frontmatter keys', () => {
    const fm = buildPageFrontmatter(homePage, packOutline, 'epoxy-flooring-new-braunfels', 'Comal Epoxy Floors', vars)
    expect(fm).toHaveProperty('title')
    expect(fm).toHaveProperty('meta_description')
    expect(fm).toHaveProperty('h1')
    expect(fm).toHaveProperty('primary_keyword')
    expect(fm).toHaveProperty('type')
    expect(fm).toHaveProperty('status')
    expect(fm).toHaveProperty('updated')
    expect(fm).toHaveProperty('word_count_target')
    expect(fm).toHaveProperty('sections')
    expect(fm).toHaveProperty('sources')
    expect(fm).toHaveProperty('faqs')
    expect(fm).toHaveProperty('town_facts')
  })

  it('sets status to "draft"', () => {
    const fm = buildPageFrontmatter(homePage, packOutline, 'epoxy-flooring-new-braunfels', 'Comal Epoxy Floors', vars)
    expect(fm.status).toBe('draft')
  })

  it('sets type from the page definition', () => {
    const fm = buildPageFrontmatter(homePage, packOutline, 'epoxy-flooring-new-braunfels', 'Comal Epoxy Floors', vars)
    expect(fm.type).toBe('home')
  })

  it('uses title from the page definition', () => {
    const fm = buildPageFrontmatter(homePage, packOutline, 'epoxy-flooring-new-braunfels', 'Comal Epoxy Floors', vars)
    expect(fm.title).toBe('Epoxy Flooring New Braunfels | Comal Epoxy Floors')
  })

  it('replaces | TBD with the brand in the title', () => {
    const tbdPage = { ...homePage, title: 'Epoxy Flooring New Braunfels | TBD' }
    const fm = buildPageFrontmatter(tbdPage, packOutline, 'epoxy-flooring-new-braunfels', 'Comal Epoxy Floors', vars)
    expect(fm.title).toBe('Epoxy Flooring New Braunfels | Comal Epoxy Floors')
    expect(fm.title).not.toContain('TBD')
  })

  it('uses meta_description_intent as meta_description', () => {
    const fm = buildPageFrontmatter(homePage, packOutline, 'epoxy-flooring-new-braunfels', 'Comal Epoxy Floors', vars)
    expect(fm.meta_description).toBe('Connect with epoxy flooring pros in New Braunfels, Texas.')
  })

  it('sets updated to today', () => {
    const fm = buildPageFrontmatter(homePage, packOutline, 'epoxy-flooring-new-braunfels', 'Comal Epoxy Floors', vars)
    // Should be a YYYY-MM-DD string
    expect(fm.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('initializes sources, faqs, and town_facts as empty arrays', () => {
    const fm = buildPageFrontmatter(homePage, packOutline, 'epoxy-flooring-new-braunfels', 'Comal Epoxy Floors', vars)
    expect(fm.sources).toEqual([])
    expect(fm.faqs).toEqual([])
    expect(fm.town_facts).toEqual([])
  })

  it('includes schema and figures for tool pages', () => {
    const toolPage = {
      slug: '/floor-coating-cost-calculator/',
      type: 'tool',
      primary_keyword: 'floor coating cost calculator new braunfels',
      h1: 'Floor Coating Cost Calculator — New Braunfels, Texas',
      title: 'Floor Coating Cost Calculator | Comal Epoxy Floors',
      meta_description_intent: 'Free floor coating cost calculator.',
      word_count: { min: 300, max: 800 },
      schema: ['WebApplication', 'FAQPage'],
    }
    const toolOutline = { sections: [] }
    const fm = buildPageFrontmatter(toolPage, toolOutline, 'epoxy-flooring-new-braunfels', 'Comal Epoxy Floors', vars)
    expect(fm.schema).toEqual(['WebApplication', 'FAQPage'])
    expect(fm.figures).toEqual([])
  })

  it('includes schema for faq pages', () => {
    const faqPage = {
      slug: '/faq/',
      type: 'faq',
      primary_keyword: 'epoxy flooring faq',
      h1: 'Epoxy Flooring FAQ — New Braunfels, Texas',
      title: 'Epoxy Flooring FAQ New Braunfels | Comal Epoxy Floors',
      meta_description_intent: 'FAQ about epoxy flooring.',
      word_count: { min: 400, max: 1000 },
      schema: 'FAQPage',
    }
    const faqOutline = { sections: [] }
    const fm = buildPageFrontmatter(faqPage, faqOutline, 'epoxy-flooring-new-braunfels', 'Comal Epoxy Floors', vars)
    expect(fm.schema).toBe('FAQPage')
  })

  it('does not include schema or figures for regular pages', () => {
    const fm = buildPageFrontmatter(homePage, packOutline, 'epoxy-flooring-new-braunfels', 'Comal Epoxy Floors', vars)
    expect(fm.schema).toBeUndefined()
    expect(fm.figures).toBeUndefined()
  })
})

// ── generateScaffoldMarkdown ────────────────────────────────────────

describe('generateScaffoldMarkdown', () => {
  const sampleFrontmatter = {
    title: 'Epoxy Flooring New Braunfels | Comal Epoxy Floors',
    meta_description: 'Connect with epoxy flooring pros.',
    h1: 'Epoxy Flooring in New Braunfels, Texas',
    primary_keyword: 'epoxy flooring new braunfels',
    type: 'home',
    status: 'draft',
    updated: '2026-11-14',
    word_count_target: { min: 800, max: 1500 },
    sections: [{ h2: 'Professional Epoxy Flooring Services' }],
    sources: [],
    faqs: [],
    town_facts: [],
  }

  it('starts with YAML front matter delimiter', () => {
    const md = generateScaffoldMarkdown(sampleFrontmatter)
    expect(md.startsWith('---\n')).toBe(true)
  })

  it('ends with closing delimiter and newline', () => {
    const md = generateScaffoldMarkdown(sampleFrontmatter)
    expect(md.endsWith('---\n')).toBe(true)
  })

  it('contains valid YAML between delimiters', () => {
    const md = generateScaffoldMarkdown(sampleFrontmatter)
    const yamlStr = md.slice(4, md.lastIndexOf('---'))
    const parsed = loadYaml(yamlStr)
    expect(parsed.title).toBe(sampleFrontmatter.title)
    expect(parsed.status).toBe('draft')
    expect(parsed.sections).toHaveLength(1)
  })

  it('has no body content after the closing delimiter', () => {
    const md = generateScaffoldMarkdown(sampleFrontmatter)
    const afterClosing = md.slice(md.lastIndexOf('---') + 4)
    expect(afterClosing.trim()).toBe('')
  })
})

// ── updateBrandInSiteYaml ───────────────────────────────────────────

describe('updateBrandInSiteYaml', () => {
  it('replaces | TBD with the brand in title fields', () => {
    const yaml = [
      'brand: Comal Epoxy Floors',
      'pages:',
      '  - slug: /',
      '    title: Epoxy Flooring New Braunfels | TBD',
      '    h1: Epoxy Flooring in New Braunfels',
      '  - slug: /faq/',
      '    title: Epoxy Flooring FAQ | TBD',
    ].join('\n')
    const result = updateBrandInSiteYaml(yaml, 'Comal Epoxy Floors')
    expect(result).toContain('| Comal Epoxy Floors')
    expect(result).not.toContain('| TBD')
  })

  it('does not alter non-title fields', () => {
    const yaml = [
      'brand: TBD',
      'phone: null',
      'pages:',
      '  - slug: /',
      '    title: Epoxy Flooring | TBD',
      '    h1: Epoxy Flooring in New Braunfels',
      '    primary_keyword: epoxy flooring new braunfels',
    ].join('\n')
    const result = updateBrandInSiteYaml(yaml, 'Comal Epoxy Floors')
    // brand: TBD line should NOT be changed (it's not a title pattern)
    expect(result).toContain('brand: TBD')
    expect(result).toContain('h1: Epoxy Flooring in New Braunfels')
    expect(result).toContain('primary_keyword: epoxy flooring new braunfels')
  })

  it('handles multiple title lines in one pass', () => {
    const yaml = [
      '    title: Service A | TBD',
      '    title: Service B | TBD',
      '    title: Service C | TBD',
    ].join('\n')
    const result = updateBrandInSiteYaml(yaml, 'MyBrand')
    const matches = result.match(/\| MyBrand/g)
    expect(matches).toHaveLength(3)
  })
})

// ── pageSlugToFilename ──────────────────────────────────────────────

describe('pageSlugToFilename', () => {
  it('converts root slug to home', () => {
    expect(pageSlugToFilename('/')).toBe('home')
  })

  it('converts top-level service slug', () => {
    expect(pageSlugToFilename('/garage-floor-epoxy/')).toBe('garage-floor-epoxy')
  })

  it('converts nested area slug with single-dash separator', () => {
    expect(pageSlugToFilename('/areas/san-marcos/')).toBe('areas-san-marcos')
  })

  it('converts nested guide slug with single-dash separator', () => {
    expect(pageSlugToFilename('/guides/epoxy-vs-polyaspartic-garage-floors/')).toBe('guides-epoxy-vs-polyaspartic-garage-floors')
  })

  it('handles slug without trailing slash', () => {
    expect(pageSlugToFilename('/cost')).toBe('cost')
  })

  it('converts multi-level path correctly', () => {
    expect(pageSlugToFilename('/areas/canyon-lake/')).toBe('areas-canyon-lake')
  })
})
