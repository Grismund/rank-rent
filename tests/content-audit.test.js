import { describe, it, expect } from 'vitest'
import {
  validateMetaDescription,
  extractMarkdownLinks,
  validateInternalLinks,
  validateSchemaFrontmatter,
  checkBrandUniqueness,
  checkTitleUniqueness,
  checkH1Uniqueness,
  validateTownPageDepth,
  validateFaqConsistency,
  checkPhonePlaceholder,
  checkSourcesPopulated,
  extractH2Sequence,
  checkH2SequenceUniqueness,
  checkHashCoverage,
} from '../lib/content-audit.js'

// --- validateMetaDescription ---

describe('validateMetaDescription', () => {
  it('passes for 140-char description containing target phrase', () => {
    const fm = {
      meta_description: 'Epoxy flooring in Fort Myers offers durable garage coatings for homes and businesses. Get free quotes from local contractors in Lee County today.',
      primary_keyword: 'epoxy flooring',
    }
    const result = validateMetaDescription(fm)
    expect(result.pass).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('fails below 120 chars', () => {
    const fm = {
      meta_description: 'Short description about epoxy.',
      primary_keyword: 'epoxy',
    }
    const result = validateMetaDescription(fm)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.severity === 'FAIL' && i.message.includes('120'))).toBe(true)
  })

  it('fails above 160 chars', () => {
    const fm = {
      meta_description: 'A'.repeat(161),
      primary_keyword: 'epoxy',
    }
    const result = validateMetaDescription(fm)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.severity === 'FAIL' && i.message.includes('160'))).toBe(true)
  })

  it('warns when target phrase absent from meta description', () => {
    const fm = {
      meta_description: 'Get free quotes from local contractors in Lee County for your garage floor coating project today and save money on labor.',
      primary_keyword: 'epoxy flooring',
    }
    const result = validateMetaDescription(fm)
    expect(result.pass).toBe(true) // warn doesn't fail
    expect(result.issues.some(i => i.severity === 'WARN')).toBe(true)
  })

  it('handles missing meta_description gracefully', () => {
    const fm = { primary_keyword: 'epoxy' }
    const result = validateMetaDescription(fm)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.severity === 'FAIL')).toBe(true)
  })
})

// --- extractMarkdownLinks ---

describe('extractMarkdownLinks', () => {
  it('extracts internal /slug/ links', () => {
    const body = 'Check our [garage floor epoxy](/garage-floor-epoxy/) page for details.'
    const result = extractMarkdownLinks(body)
    expect(result.internal).toEqual([{ text: 'garage floor epoxy', href: '/garage-floor-epoxy/' }])
    expect(result.external).toHaveLength(0)
  })

  it('separates external https:// links', () => {
    const body = 'See [Google](https://google.com) and [home page](/) for more.'
    const result = extractMarkdownLinks(body)
    expect(result.external).toEqual([{ text: 'Google', href: 'https://google.com' }])
    expect(result.internal).toEqual([{ text: 'home page', href: '/' }])
  })

  it('ignores anchor and mailto links', () => {
    const body = 'Jump to [section](#faq) or [email us](mailto:info@test.com).'
    const result = extractMarkdownLinks(body)
    expect(result.internal).toHaveLength(0)
    expect(result.external).toHaveLength(0)
  })

  it('handles links in list items', () => {
    const body = '- [Service A](/service-a/)\n- [Service B](/service-b/)\n'
    const result = extractMarkdownLinks(body)
    expect(result.internal).toHaveLength(2)
    expect(result.internal[0].href).toBe('/service-a/')
    expect(result.internal[1].href).toBe('/service-b/')
  })

  it('normalizes trailing slashes', () => {
    const body = '[no slash](/cost) and [with slash](/cost/)'
    const result = extractMarkdownLinks(body)
    expect(result.internal[0].href).toBe('/cost/')
    expect(result.internal[1].href).toBe('/cost/')
  })
})

// --- validateInternalLinks ---

describe('validateInternalLinks', () => {
  const slugs = new Set(['/', '/garage-floor-epoxy/', '/cost/', '/faq/'])
  const portfolioDomains = ['example-site.com', 'other-site.com']

  it('passes when all links resolve', () => {
    const links = [
      { text: 'epoxy', href: '/garage-floor-epoxy/' },
      { text: 'cost', href: '/cost/' },
    ]
    const result = validateInternalLinks(links, slugs, portfolioDomains)
    expect(result.pass).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('fails on broken link', () => {
    const links = [
      { text: 'epoxy', href: '/garage-floor-epoxy/' },
      { text: 'nonexistent', href: '/does-not-exist/' },
    ]
    const result = validateInternalLinks(links, slugs, portfolioDomains)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.severity === 'FAIL' && i.message.includes('/does-not-exist/'))).toBe(true)
  })

  it('fails on cross-portfolio link', () => {
    const links = [
      { text: 'other site', href: 'https://example-site.com/about/' },
    ]
    // External links checked against portfolio domains
    const result = validateInternalLinks(links, slugs, portfolioDomains)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.severity === 'FAIL' && i.message.includes('portfolio'))).toBe(true)
  })

  it('handles root / link', () => {
    const links = [{ text: 'home', href: '/' }]
    const result = validateInternalLinks(links, slugs, portfolioDomains)
    expect(result.pass).toBe(true)
  })
})

// --- validateSchemaFrontmatter ---

describe('validateSchemaFrontmatter', () => {
  it('requires FAQPage on faq pages', () => {
    const fm = { type: 'faq', schema: 'FAQPage' }
    const result = validateSchemaFrontmatter(fm)
    expect(result.pass).toBe(true)
  })

  it('requires WebApplication and FAQPage on tool pages', () => {
    const fm = { type: 'tool', schema: ['WebApplication', 'FAQPage'] }
    const result = validateSchemaFrontmatter(fm)
    expect(result.pass).toBe(true)
  })

  it('passes on home/service/town/guide (no schema required)', () => {
    for (const type of ['home', 'service', 'town', 'guide', 'cost_guide']) {
      const result = validateSchemaFrontmatter({ type })
      expect(result.pass).toBe(true)
    }
  })

  it('handles string vs array schema field', () => {
    const fmString = { type: 'faq', schema: 'FAQPage' }
    const fmArray = { type: 'faq', schema: ['FAQPage'] }
    expect(validateSchemaFrontmatter(fmString).pass).toBe(true)
    expect(validateSchemaFrontmatter(fmArray).pass).toBe(true)
  })

  it('fails when faq page has no schema', () => {
    const fm = { type: 'faq' }
    const result = validateSchemaFrontmatter(fm)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.severity === 'FAIL' && i.message.includes('FAQPage'))).toBe(true)
  })
})

// --- checkBrandUniqueness ---

describe('checkBrandUniqueness', () => {
  it('passes for unique brands', () => {
    const sites = [
      { slug: 'a', brand: 'Fort Myers Floor Coatings' },
      { slug: 'b', brand: 'Orlando Epoxy Floors' },
    ]
    const result = checkBrandUniqueness(sites)
    expect(result.pass).toBe(true)
  })

  it('fails on duplicates (case-insensitive)', () => {
    const sites = [
      { slug: 'a', brand: 'Fort Myers Floor Coatings' },
      { slug: 'b', brand: 'fort myers floor coatings' },
    ]
    const result = checkBrandUniqueness(sites)
    expect(result.pass).toBe(false)
    expect(result.issues[0].severity).toBe('FAIL')
  })

  it('ignores null/TBD brands', () => {
    const sites = [
      { slug: 'a', brand: null },
      { slug: 'b', brand: 'TBD' },
      { slug: 'c', brand: 'Real Brand' },
    ]
    const result = checkBrandUniqueness(sites)
    expect(result.pass).toBe(true)
  })
})

// --- checkTitleUniqueness / checkH1Uniqueness ---

describe('checkTitleUniqueness', () => {
  it('passes when all titles unique', () => {
    const pages = [
      { file: 'home.md', title: 'Epoxy Flooring Fort Myers' },
      { file: 'cost.md', title: 'Epoxy Flooring Cost' },
    ]
    const result = checkTitleUniqueness(pages)
    expect(result.pass).toBe(true)
  })

  it('fails on duplicate titles', () => {
    const pages = [
      { file: 'home.md', title: 'Same Title' },
      { file: 'cost.md', title: 'Same Title' },
    ]
    const result = checkTitleUniqueness(pages)
    expect(result.pass).toBe(false)
    expect(result.issues[0].message).toContain('Same Title')
  })
})

describe('checkH1Uniqueness', () => {
  it('passes when all H1s unique', () => {
    const pages = [
      { file: 'home.md', h1: 'Epoxy Flooring in Fort Myers' },
      { file: 'cost.md', h1: 'Epoxy Flooring Cost' },
    ]
    const result = checkH1Uniqueness(pages)
    expect(result.pass).toBe(true)
  })

  it('fails on duplicate H1s', () => {
    const pages = [
      { file: 'home.md', h1: 'Same H1' },
      { file: 'cost.md', h1: 'Same H1' },
    ]
    const result = checkH1Uniqueness(pages)
    expect(result.pass).toBe(false)
    expect(result.issues[0].message).toContain('Same H1')
  })
})

// --- validateTownPageDepth ---

describe('validateTownPageDepth', () => {
  const baseFm = {
    type: 'town',
    town_facts: ['fact 1', 'fact 2', 'fact 3'],
  }

  it('passes with permits heading + service links', () => {
    const body = `## Why Choose Epoxy

Some content here.

## What to Know Before Coating in Cape Coral

Permits info here. The city requires a permit for structural work.

Check our [garage floor epoxy](/garage-floor-epoxy/) for details.
See [commercial epoxy](/commercial-epoxy-flooring/) too.
`
    const result = validateTownPageDepth(body, baseFm)
    expect(result.pass).toBe(true)
  })

  it('fails without permits/regulations heading', () => {
    const body = `## Why Choose Epoxy

Some content.

## Get a Quote

Call us at [PHONE] for [garage floor epoxy](/garage-floor-epoxy/).
`
    const result = validateTownPageDepth(body, baseFm)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.message.includes('permit'))).toBe(true)
  })

  it('fails without internal service page links', () => {
    const body = `## Local Considerations

Permits info here.

## Get a Quote

Call us today.
`
    const result = validateTownPageDepth(body, baseFm)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.message.includes('service'))).toBe(true)
  })

  it('accepts flexible heading patterns', () => {
    const patterns = [
      '## Local Considerations for Cape Coral',
      '## Permit Rules in Lee County',
      '## Regulations and Code Requirements',
      '## What to Know Before Coating',
    ]
    for (const heading of patterns) {
      const body = `${heading}\n\nPermit details.\n\n[epoxy](/garage-floor-epoxy/) link here.\n`
      const result = validateTownPageDepth(body, baseFm)
      expect(result.issues.some(i => i.message.includes('permit'))).toBe(false)
    }
  })
})

// --- validateFaqConsistency ---

describe('validateFaqConsistency', () => {
  it('passes when faqs[] matches H3s in body', () => {
    const fm = {
      type: 'faq',
      faqs: ['How much does epoxy cost?', 'How long does it take?'],
    }
    const body = `## FAQ Section

### How much does epoxy cost?

It depends on square footage.

### How long does it take?

One to two days.
`
    const result = validateFaqConsistency(fm, body)
    expect(result.pass).toBe(true)
  })

  it('fails when H3 missing from faqs[]', () => {
    const fm = {
      type: 'faq',
      faqs: ['How much does epoxy cost?'],
    }
    const body = `### How much does epoxy cost?

Answer.

### How long does it take?

Answer.
`
    const result = validateFaqConsistency(fm, body)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.message.includes('body but not in faqs'))).toBe(true)
  })

  it('fails when faqs[] entry has no matching H3', () => {
    const fm = {
      type: 'faq',
      faqs: ['How much does epoxy cost?', 'Is epoxy safe for pets?'],
    }
    const body = `### How much does epoxy cost?

Answer.
`
    const result = validateFaqConsistency(fm, body)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.message.includes('faqs but not in body'))).toBe(true)
  })

  it('normalizes punctuation and case', () => {
    const fm = {
      type: 'tool',
      faqs: ['How much does epoxy cost'],
    }
    const body = `### How Much Does Epoxy Cost?

Answer.
`
    const result = validateFaqConsistency(fm, body)
    expect(result.pass).toBe(true)
  })

  it('handles object-format faqs with question/answer keys', () => {
    const fm = {
      type: 'faq',
      faqs: [
        { question: 'How much does epoxy cost?', answer: 'It depends.' },
        { question: 'How long does it take?', answer: 'One to two days.' },
      ],
    }
    const body = `### How much does epoxy cost?

It depends.

### How long does it take?

One to two days.
`
    const result = validateFaqConsistency(fm, body)
    expect(result.pass).toBe(true)
  })
})

// --- checkPhonePlaceholder ---

describe('checkPhonePlaceholder', () => {
  it('passes when [PHONE] found', () => {
    const body = 'Call us at [PHONE] for a free quote.'
    const result = checkPhonePlaceholder(body, 'home')
    expect(result.pass).toBe(true)
  })

  it('warns when absent', () => {
    const body = 'Call us for a free quote today.'
    const result = checkPhonePlaceholder(body, 'home')
    expect(result.pass).toBe(true) // warn doesn't fail
    expect(result.issues.some(i => i.severity === 'WARN' && i.message.includes('[PHONE]'))).toBe(true)
  })
})

// --- checkSourcesPopulated ---

describe('checkSourcesPopulated', () => {
  it('passes for cost_guide/tool/guide with non-empty sources[]', () => {
    for (const type of ['cost_guide', 'tool', 'guide']) {
      const fm = { type, sources: ['Source A'] }
      const result = checkSourcesPopulated(fm)
      expect(result.pass).toBe(true)
    }
  })

  it('fails for those types with empty sources[]', () => {
    for (const type of ['cost_guide', 'tool', 'guide']) {
      const fm = { type, sources: [] }
      const result = checkSourcesPopulated(fm)
      expect(result.pass).toBe(false)
      expect(result.issues[0].severity).toBe('WARN')
    }
  })

  it('passes for home/service/town regardless', () => {
    for (const type of ['home', 'service', 'town']) {
      const fm = { type, sources: [] }
      const result = checkSourcesPopulated(fm)
      expect(result.pass).toBe(true)
    }
  })
})

// --- extractH2Sequence / checkH2SequenceUniqueness ---

describe('extractH2Sequence', () => {
  it('extracts ordered H2 array from markdown', () => {
    const body = `## First Heading

Content.

## Second Heading

More content.

## Third Heading

Even more.
`
    const result = extractH2Sequence(body)
    expect(result).toEqual(['First Heading', 'Second Heading', 'Third Heading'])
  })
})

describe('checkH2SequenceUniqueness', () => {
  it('passes when same-niche sites differ in H2 order', () => {
    const sitesByNiche = {
      'epoxy-flooring': {
        service: [
          ['Why Choose Epoxy', 'Types of Coatings', 'Get a Quote'],
          ['Available Coatings', 'Why Epoxy Works', 'Request a Quote'],
        ],
      },
    }
    const result = checkH2SequenceUniqueness(sitesByNiche)
    expect(result.pass).toBe(true)
  })

  it('fails when identical H2 sequences for same page type', () => {
    const sitesByNiche = {
      'epoxy-flooring': {
        service: [
          ['Why Choose Epoxy', 'Types of Coatings', 'Get a Quote'],
          ['Why Choose Epoxy', 'Types of Coatings', 'Get a Quote'],
        ],
      },
    }
    const result = checkH2SequenceUniqueness(sitesByNiche)
    expect(result.pass).toBe(false)
    expect(result.issues[0].severity).toBe('WARN')
  })
})

// --- checkHashCoverage ---

describe('checkHashCoverage', () => {
  it('passes with all expected niches having > 0 hashes', () => {
    const hashes = {
      'epoxy-flooring': ['a', 'b'],
      'bathroom-remodel': ['c'],
      'junk-removal': ['d'],
    }
    const expected = ['epoxy-flooring', 'bathroom-remodel', 'junk-removal']
    const result = checkHashCoverage(hashes, expected)
    expect(result.pass).toBe(true)
  })

  it('fails when a niche has 0 hashes', () => {
    const hashes = {
      'epoxy-flooring': ['a'],
      'bathroom-remodel': [],
    }
    const expected = ['epoxy-flooring', 'bathroom-remodel']
    const result = checkHashCoverage(hashes, expected)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.message.includes('bathroom-remodel'))).toBe(true)
  })

  it('fails when expected niche missing', () => {
    const hashes = {
      'epoxy-flooring': ['a'],
    }
    const expected = ['epoxy-flooring', 'junk-removal']
    const result = checkHashCoverage(hashes, expected)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.message.includes('junk-removal'))).toBe(true)
  })
})
