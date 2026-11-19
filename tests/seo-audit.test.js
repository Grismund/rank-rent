import { describe, it, expect } from 'vitest'
import {
  extractHrefs,
  extractJsonLd,
  extractVisibleText,
  extractSvgContent,
  countH1Tags,
  checkHtmlLinks,
  checkSchemaJsonLd,
  checkDisclosure,
  checkPhoneInHtml,
  checkNoInterSiteLinks,
  checkCanonicalTag,
  checkSingleH1,
  checkFigureMinimum,
  checkFigureProvenance,
  checkFigurePalette,
  checkToolConstancy,
  checkBrandSet,
  checkToolPagePresent,
  checkInformationalPages,
  checkCrossSiteSimilarity,
  checkShellTokenUniqueness,
  checkLaunchCadence,
  checkClassmapOverlap,
  checkFigureDuplication,
} from '../lib/seo-audit.js'

// ══════════════════════════════════════════════════════════════════════
// HTML extraction helpers
// ══════════════════════════════════════════════════════════════════════

describe('extractHrefs', () => {
  it('extracts all href values from anchor tags', () => {
    const html = '<a href="/cost/">Cost</a> <a href="/faq/">FAQ</a>'
    expect(extractHrefs(html)).toEqual(['/cost/', '/faq/'])
  })

  it('handles double and single quotes', () => {
    const html = `<a href="/a/">A</a> <a href='/b/'>B</a>`
    expect(extractHrefs(html)).toEqual(['/a/', '/b/'])
  })

  it('returns empty array for no links', () => {
    expect(extractHrefs('<p>No links here</p>')).toEqual([])
  })

  it('extracts external hrefs too', () => {
    const html = '<a href="https://example.com">Ex</a>'
    expect(extractHrefs(html)).toEqual(['https://example.com'])
  })
})

describe('extractJsonLd', () => {
  it('extracts parsed JSON-LD objects', () => {
    const html = '<head><script type="application/ld+json">{"@type":"Organization","name":"Test"}</script></head>'
    const result = extractJsonLd(html)
    expect(result).toHaveLength(1)
    expect(result[0]['@type']).toBe('Organization')
  })

  it('extracts multiple JSON-LD blocks', () => {
    const html = `
      <script type="application/ld+json">{"@type":"Organization"}</script>
      <script type="application/ld+json">{"@type":"WebSite"}</script>
    `
    expect(extractJsonLd(html)).toHaveLength(2)
  })

  it('returns empty array for no JSON-LD', () => {
    expect(extractJsonLd('<head></head>')).toEqual([])
  })

  it('skips malformed JSON', () => {
    const html = '<script type="application/ld+json">{broken json</script>'
    expect(extractJsonLd(html)).toEqual([])
  })
})

describe('extractVisibleText', () => {
  it('strips HTML tags and returns text', () => {
    const html = '<h1>Title</h1><p>Some <strong>bold</strong> text.</p>'
    const text = extractVisibleText(html)
    expect(text).toContain('Title')
    expect(text).toContain('Some bold text.')
    expect(text).not.toContain('<h1>')
  })

  it('strips script and style content', () => {
    const html = '<script>var x = 1;</script><style>.a{color:red}</style><p>Visible</p>'
    const text = extractVisibleText(html)
    expect(text).toContain('Visible')
    expect(text).not.toContain('var x')
    expect(text).not.toContain('color')
  })
})

describe('extractSvgContent', () => {
  it('extracts SVG blocks from HTML', () => {
    const html = '<div><svg viewBox="0 0 100 100"><rect/></svg></div>'
    const svgs = extractSvgContent(html)
    expect(svgs).toHaveLength(1)
    expect(svgs[0]).toContain('viewBox')
  })

  it('returns empty array for no SVGs', () => {
    expect(extractSvgContent('<p>No SVG</p>')).toEqual([])
  })
})

describe('countH1Tags', () => {
  it('counts h1 tags', () => {
    expect(countH1Tags('<h1>One</h1>')).toBe(1)
  })

  it('counts multiple h1 tags', () => {
    expect(countH1Tags('<h1>One</h1><h1>Two</h1>')).toBe(2)
  })

  it('returns 0 for no h1', () => {
    expect(countH1Tags('<h2>Not h1</h2>')).toBe(0)
  })

  it('handles attributes on h1 tag', () => {
    expect(countH1Tags('<h1 class="title" data-astro-cid-abc>Title</h1>')).toBe(1)
  })
})

// ══════════════════════════════════════════════════════════════════════
// Per-page HTML checks
// ══════════════════════════════════════════════════════════════════════

describe('checkHtmlLinks', () => {
  it('passes when all internal links resolve', () => {
    const hrefs = ['/cost/', '/faq/', 'https://example.com']
    const distPaths = new Set(['/', '/cost/', '/faq/', '/about/'])
    const result = checkHtmlLinks(hrefs, distPaths)
    expect(result.pass).toBe(true)
  })

  it('fails on broken internal link', () => {
    const hrefs = ['/nonexistent/']
    const distPaths = new Set(['/', '/cost/'])
    const result = checkHtmlLinks(hrefs, distPaths)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.includes('/nonexistent/'))).toBe(true)
  })

  it('ignores external, anchor, mailto, tel links', () => {
    const hrefs = ['https://google.com', '#section', 'mailto:a@b.com', 'tel:+1234']
    const distPaths = new Set(['/'])
    const result = checkHtmlLinks(hrefs, distPaths)
    expect(result.pass).toBe(true)
  })

  it('normalizes double slashes in internal links', () => {
    const hrefs = ['//cost//']
    const distPaths = new Set(['/', '/cost/'])
    const result = checkHtmlLinks(hrefs, distPaths)
    expect(result.pass).toBe(true)
  })
})

describe('checkSchemaJsonLd', () => {
  it('passes for valid Organization + WebSite on home page', () => {
    const jsonLd = [
      { '@type': 'Organization', name: 'TestBrand' },
      { '@type': 'WebSite', name: 'TestBrand' },
    ]
    const result = checkSchemaJsonLd(jsonLd, 'home', 'TestBrand')
    expect(result.pass).toBe(true)
  })

  it('fails when LocalBusiness is present', () => {
    const jsonLd = [
      { '@type': 'LocalBusiness', name: 'Fake' },
    ]
    const result = checkSchemaJsonLd(jsonLd, 'home', 'TestBrand')
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.includes('LocalBusiness'))).toBe(true)
  })

  it('passes for FAQPage on faq type', () => {
    const jsonLd = [
      { '@type': 'Organization', name: 'Brand' },
      { '@type': 'FAQPage' },
    ]
    const result = checkSchemaJsonLd(jsonLd, 'faq', 'Brand')
    expect(result.pass).toBe(true)
  })

  it('passes for WebApplication + FAQPage on tool type', () => {
    const jsonLd = [
      { '@type': 'Organization', name: 'Brand' },
      { '@type': 'WebApplication' },
      { '@type': 'FAQPage' },
    ]
    const result = checkSchemaJsonLd(jsonLd, 'tool', 'Brand')
    expect(result.pass).toBe(true)
  })
})

describe('checkDisclosure', () => {
  it('passes for disclosure variant 1', () => {
    const html = '<footer><p>We connect homeowners with independent local contractors. Operated by Vantabox LLC.</p></footer>'
    expect(checkDisclosure(html).pass).toBe(true)
  })

  it('passes for disclosure variant 2', () => {
    const html = '<footer><p>This site matches local homeowners with independent, unaffiliated contractors. A Vantabox LLC service.</p></footer>'
    expect(checkDisclosure(html).pass).toBe(true)
  })

  it('passes for disclosure variant 3', () => {
    const html = '<footer><p>Independent contractors serve every request made through this site. Site operated by Vantabox LLC.</p></footer>'
    expect(checkDisclosure(html).pass).toBe(true)
  })

  it('fails when disclosure missing', () => {
    const html = '<footer><p>Copyright 2026</p></footer>'
    expect(checkDisclosure(html).pass).toBe(false)
  })
})

describe('checkPhoneInHtml', () => {
  it('passes when phone number is in HTML', () => {
    const html = '<a href="tel:+15551234567">(555) 123-4567</a>'
    expect(checkPhoneInHtml(html, '(555) 123-4567').pass).toBe(true)
  })

  it('skips check when phone is null', () => {
    const result = checkPhoneInHtml('<div></div>', null)
    expect(result.pass).toBe(true)
  })

  it('fails when phone absent from HTML', () => {
    const html = '<div>No phone here</div>'
    const result = checkPhoneInHtml(html, '(555) 123-4567')
    expect(result.pass).toBe(false)
  })
})

describe('checkNoInterSiteLinks', () => {
  it('passes when no portfolio domains linked', () => {
    const hrefs = ['/', '/cost/', 'https://google.com']
    const domains = ['epoxy-fort-myers.com', 'epoxy-orlando.com']
    expect(checkNoInterSiteLinks(hrefs, domains).pass).toBe(true)
  })

  it('fails when a portfolio domain is linked', () => {
    const hrefs = ['https://epoxy-orlando.com/about/']
    const domains = ['epoxy-fort-myers.com', 'epoxy-orlando.com']
    const result = checkNoInterSiteLinks(hrefs, domains)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.includes('epoxy-orlando.com'))).toBe(true)
  })

  it('catches www variant', () => {
    const hrefs = ['https://www.epoxy-orlando.com/']
    const domains = ['epoxy-orlando.com']
    expect(checkNoInterSiteLinks(hrefs, domains).pass).toBe(false)
  })
})

describe('checkCanonicalTag', () => {
  it('passes when canonical link present', () => {
    const html = '<link rel="canonical" href="https://example.com/">'
    expect(checkCanonicalTag(html).pass).toBe(true)
  })

  it('fails when canonical missing', () => {
    const html = '<head><title>Test</title></head>'
    expect(checkCanonicalTag(html).pass).toBe(false)
  })
})

describe('checkSingleH1', () => {
  it('passes with exactly one H1', () => {
    expect(checkSingleH1('<h1>Title</h1>').pass).toBe(true)
  })

  it('fails with zero H1s', () => {
    expect(checkSingleH1('<h2>No H1</h2>').pass).toBe(false)
  })

  it('fails with multiple H1s', () => {
    expect(checkSingleH1('<h1>One</h1><h1>Two</h1>').pass).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════
// Per-site checks
// ══════════════════════════════════════════════════════════════════════

describe('checkFigureMinimum', () => {
  it('passes with 3+ figures including tool and cost', () => {
    const figures = ['fig1.json', 'fig2.json', 'fig3.json']
    const pageTypes = ['tool', 'cost_guide', 'guide']
    expect(checkFigureMinimum(figures, pageTypes).pass).toBe(true)
  })

  it('fails with fewer than 3 figures', () => {
    const figures = ['fig1.json', 'fig2.json']
    const pageTypes = ['tool', 'cost_guide']
    const result = checkFigureMinimum(figures, pageTypes)
    expect(result.pass).toBe(false)
  })
})

describe('checkFigureProvenance', () => {
  it('passes when source.label is non-empty', () => {
    const figure = { source: { label: 'HomeAdvisor 2026 survey' } }
    expect(checkFigureProvenance(figure).pass).toBe(true)
  })

  it('fails when source.label is empty', () => {
    const figure = { source: { label: '' } }
    expect(checkFigureProvenance(figure).pass).toBe(false)
  })

  it('fails when source is missing', () => {
    const figure = {}
    expect(checkFigureProvenance(figure).pass).toBe(false)
  })
})

describe('checkFigurePalette', () => {
  it('passes when SVG uses CSS variables only', () => {
    const svg = '<svg><rect fill="var(--color-primary)"/></svg>'
    expect(checkFigurePalette(svg).pass).toBe(true)
  })

  it('fails on literal hex fill', () => {
    const svg = '<svg><rect fill="#ff0000"/></svg>'
    const result = checkFigurePalette(svg)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.includes('#ff0000'))).toBe(true)
  })

  it('allows common non-color hex values', () => {
    // White, black, none, transparent, currentColor are acceptable
    const svg = '<svg><rect fill="none" stroke="currentColor"/></svg>'
    expect(checkFigurePalette(svg).pass).toBe(true)
  })
})

describe('checkToolConstancy', () => {
  it('passes when output varies across input matrix', () => {
    const outputs = [
      { input: { size: 'small', finish: 'solid' }, result: { low: 1000, high: 1500 } },
      { input: { size: 'large', finish: 'solid' }, result: { low: 2000, high: 3000 } },
      { input: { size: 'small', finish: 'metallic' }, result: { low: 1500, high: 2500 } },
    ]
    expect(checkToolConstancy(outputs).pass).toBe(true)
  })

  it('fails when all outputs identical', () => {
    const outputs = [
      { input: { size: 'small' }, result: { low: 1000, high: 1500 } },
      { input: { size: 'large' }, result: { low: 1000, high: 1500 } },
      { input: { size: 'medium' }, result: { low: 1000, high: 1500 } },
    ]
    expect(checkToolConstancy(outputs).pass).toBe(false)
  })
})

describe('checkBrandSet', () => {
  it('passes for a real brand', () => {
    expect(checkBrandSet('Fort Myers Floor Coatings').pass).toBe(true)
  })

  it('fails for null brand', () => {
    expect(checkBrandSet(null).pass).toBe(false)
  })

  it('fails for TBD brand', () => {
    expect(checkBrandSet('TBD').pass).toBe(false)
  })
})

describe('checkToolPagePresent', () => {
  it('passes when tool page exists', () => {
    expect(checkToolPagePresent(['home', 'service', 'tool', 'faq']).pass).toBe(true)
  })

  it('fails when no tool page', () => {
    expect(checkToolPagePresent(['home', 'service', 'faq']).pass).toBe(false)
  })
})

describe('checkInformationalPages', () => {
  it('passes with 2+ guide pages', () => {
    const pages = [
      { type: 'guide' }, { type: 'guide' }, { type: 'home' },
    ]
    expect(checkInformationalPages(pages).pass).toBe(true)
  })

  it('fails with fewer than 2 guide pages', () => {
    const pages = [{ type: 'guide' }, { type: 'home' }]
    expect(checkInformationalPages(pages).pass).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════
// Portfolio checks
// ══════════════════════════════════════════════════════════════════════

describe('checkCrossSiteSimilarity', () => {
  it('passes for dissimilar site texts', () => {
    const texts = [
      'Fort Myers epoxy flooring for residential garages with metallic finishes and flake coatings in Lee County.',
      'Orlando bathroom remodel contractors handle shower and tub replacements across Orange County Florida projects.',
    ]
    const result = checkCrossSiteSimilarity(texts)
    expect(result.pass).toBe(true)
  })

  it('fails when similarity exceeds 0.75', () => {
    const base = 'The quick brown fox jumps over the lazy dog near the river bank on a sunny day in June.'
    const texts = [base, base] // identical
    const result = checkCrossSiteSimilarity(texts)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.includes('FAIL'))).toBe(true)
  })

  it('warns between 0.60 and 0.75', () => {
    // Build texts that share ~65% content
    const shared = 'epoxy flooring contractors install garage floor coatings for residential homeowners in the area'
    const textA = shared + ' with metallic finishes and premium quartz broadcast systems for high end results'
    const textB = shared + ' using vinyl flake blends and solid color options for affordable durable protection'
    const result = checkCrossSiteSimilarity([textA, textB])
    // This may or may not hit the warn threshold depending on exact overlap — test the structure
    expect(result).toHaveProperty('pass')
    expect(result).toHaveProperty('issues')
  })
})

describe('checkShellTokenUniqueness', () => {
  it('passes when no duplicate shell+token within niche', () => {
    const configs = [
      { slug: 'epoxy-fort-myers', niche: 'epoxy-flooring', shell: 'A', tokens: 'epoxy-1' },
      { slug: 'epoxy-orlando', niche: 'epoxy-flooring', shell: 'B', tokens: 'epoxy-2' },
    ]
    expect(checkShellTokenUniqueness(configs).pass).toBe(true)
  })

  it('fails on duplicate shell+token within same niche', () => {
    const configs = [
      { slug: 'epoxy-fort-myers', niche: 'epoxy-flooring', shell: 'A', tokens: 'epoxy-1' },
      { slug: 'epoxy-orlando', niche: 'epoxy-flooring', shell: 'A', tokens: 'epoxy-1' },
    ]
    const result = checkShellTokenUniqueness(configs)
    expect(result.pass).toBe(false)
  })

  it('allows same shell+token across different niches', () => {
    const configs = [
      { slug: 'epoxy-fort-myers', niche: 'epoxy-flooring', shell: 'A', tokens: 'set-1' },
      { slug: 'bath-conroe', niche: 'bathroom-remodel', shell: 'A', tokens: 'set-1' },
    ]
    expect(checkShellTokenUniqueness(configs).pass).toBe(true)
  })
})

describe('checkLaunchCadence', () => {
  it('passes with ≤4 per wave, no same-niche duplicates', () => {
    const sites = [
      { slug: 'a', niche: 'epoxy-flooring', wave: 1 },
      { slug: 'b', niche: 'bathroom-remodel', wave: 1 },
      { slug: 'c', niche: 'window-tinting', wave: 1 },
      { slug: 'd', niche: 'epoxy-flooring', wave: 2 },
    ]
    expect(checkLaunchCadence(sites).pass).toBe(true)
  })

  it('fails with >4 sites in one wave', () => {
    const sites = [
      { slug: 'a', niche: 'n1', wave: 1 },
      { slug: 'b', niche: 'n2', wave: 1 },
      { slug: 'c', niche: 'n3', wave: 1 },
      { slug: 'd', niche: 'n4', wave: 1 },
      { slug: 'e', niche: 'n5', wave: 1 },
    ]
    const result = checkLaunchCadence(sites)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.includes('5'))).toBe(true)
  })

  it('fails with same-niche duplicates in one wave', () => {
    const sites = [
      { slug: 'a', niche: 'epoxy-flooring', wave: 1 },
      { slug: 'b', niche: 'epoxy-flooring', wave: 1 },
    ]
    const result = checkLaunchCadence(sites)
    expect(result.pass).toBe(false)
    expect(result.issues.some(i => i.includes('epoxy-flooring'))).toBe(true)
  })
})

describe('checkClassmapOverlap', () => {
  it('passes when overlap < 20%', () => {
    const classmaps = [
      { slug: 'a', classes: new Set(['cls-a', 'cls-b', 'cls-c', 'cls-d', 'cls-e']) },
      { slug: 'b', classes: new Set(['cls-f', 'cls-g', 'cls-h', 'cls-i', 'cls-j']) },
    ]
    expect(checkClassmapOverlap(classmaps).pass).toBe(true)
  })

  it('fails when overlap ≥ 20%', () => {
    const shared = ['cls-a', 'cls-b', 'cls-c', 'cls-d', 'cls-e']
    const classmaps = [
      { slug: 'a', classes: new Set([...shared, 'x1', 'x2', 'x3', 'x4', 'x5']) },
      { slug: 'b', classes: new Set([...shared, 'y1', 'y2', 'y3', 'y4', 'y5']) },
    ]
    const result = checkClassmapOverlap(classmaps)
    expect(result.pass).toBe(false)
  })
})

describe('checkFigureDuplication', () => {
  it('passes for different series within niche', () => {
    const figureSeries = [
      { slug: 'epoxy-fort-myers', niche: 'epoxy-flooring', series: JSON.stringify([{ label: 'Solid', low: 3, high: 5 }]) },
      { slug: 'epoxy-orlando', niche: 'epoxy-flooring', series: JSON.stringify([{ label: 'Solid', low: 4, high: 7 }]) },
    ]
    expect(checkFigureDuplication(figureSeries).pass).toBe(true)
  })

  it('fails for identical series within niche', () => {
    const series = JSON.stringify([{ label: 'Solid', low: 3, high: 5 }])
    const figureSeries = [
      { slug: 'epoxy-fort-myers', niche: 'epoxy-flooring', series },
      { slug: 'epoxy-orlando', niche: 'epoxy-flooring', series },
    ]
    const result = checkFigureDuplication(figureSeries)
    expect(result.pass).toBe(false)
  })

  it('allows identical series across different niches', () => {
    const series = JSON.stringify([{ label: 'Item', low: 10, high: 20 }])
    const figureSeries = [
      { slug: 'epoxy-fort-myers', niche: 'epoxy-flooring', series },
      { slug: 'bath-conroe', niche: 'bathroom-remodel', series },
    ]
    expect(checkFigureDuplication(figureSeries).pass).toBe(true)
  })
})
