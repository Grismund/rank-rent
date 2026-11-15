import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import {
  pageSlugToFilename,
  splitByHeadings,
  loadPageContent,
  matchSectionContent,
} from '../src/lib/content'

const fixtureDir = resolve(import.meta.dirname, 'fixtures/content')

describe('pageSlugToFilename', () => {
  it('converts root slug to home', () => {
    expect(pageSlugToFilename('/')).toBe('home')
  })

  it('converts top-level service slug', () => {
    expect(pageSlugToFilename('/garage-floor-epoxy/')).toBe('garage-floor-epoxy')
  })

  it('converts nested area slug with single-dash separator', () => {
    expect(pageSlugToFilename('/areas/winter-park/')).toBe('areas-winter-park')
  })

  it('converts nested guide slug with single-dash separator', () => {
    expect(pageSlugToFilename('/guides/topic/')).toBe('guides-topic')
  })

  it('handles slug without trailing slash', () => {
    expect(pageSlugToFilename('/cost')).toBe('cost')
  })
})

describe('splitByHeadings', () => {
  it('returns all text as intro when no headings present', () => {
    const result = splitByHeadings('Just some text\nwith lines.')
    expect(result.intro).toBe('Just some text\nwith lines.')
    expect(result.sections).toHaveLength(0)
  })

  it('splits on ## headings correctly', () => {
    const md = 'Intro text.\n\n## First\n\nBody one.\n\n## Second\n\nBody two.'
    const result = splitByHeadings(md)
    expect(result.intro).toBe('Intro text.')
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].heading).toBe('First')
    expect(result.sections[0].body).toContain('Body one.')
    expect(result.sections[1].heading).toBe('Second')
    expect(result.sections[1].body).toContain('Body two.')
  })

  it('does not split on ### subheadings', () => {
    const md = '## Main\n\nText.\n\n### Sub\n\nMore text.'
    const result = splitByHeadings(md)
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].heading).toBe('Main')
    expect(result.sections[0].body).toContain('### Sub')
    expect(result.sections[0].body).toContain('More text.')
  })

  it('handles heading at the very start (no intro)', () => {
    const md = '## First\n\nBody.'
    const result = splitByHeadings(md)
    expect(result.intro).toBe('')
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].heading).toBe('First')
  })

  it('preserves markdown formatting in body', () => {
    const md = '## Section\n\n**bold** text and [link](url).\n\n- list item'
    const result = splitByHeadings(md)
    expect(result.sections[0].body).toContain('**bold**')
    expect(result.sections[0].body).toContain('[link](url)')
    expect(result.sections[0].body).toContain('- list item')
  })
})

describe('loadPageContent', () => {
  it('returns null when file is missing', () => {
    const result = loadPageContent('nonexistent-site', 'index', fixtureDir)
    expect(result).toBeNull()
  })

  it('parses frontmatter and sections from fixture', () => {
    // The fixture is at fixtureDir/index.md — we pass '' as siteSlug
    // and fixtureDir as rootDir; loadPageContent looks at rootDir/siteSlug/pageFilename.md
    // We need to set up a path that works: rootDir = fixtures/content, siteSlug = '', filename = index
    // Actually loadPageContent signature: (siteSlug, pageSlug, rootDir) where it builds path.
    // Since fixture lives at fixtureDir/index.md, we pass rootDir as dirname of fixtureDir
    // and siteSlug such that the path resolves correctly.
    // For simplicity, just test that it loads from a known path structure.
    const result = loadPageContent('', 'index', fixtureDir)
    expect(result).not.toBeNull()
    expect(result!.frontmatter.title).toBe('Epoxy Flooring Orlando | TestBrand')
    expect(result!.frontmatter.updated).toBe('2026-10-01')
    expect(result!.intro).toContain('Orlando homeowners')
    expect(result!.sections).toHaveLength(3)
    expect(result!.sections[0].heading).toBe('Services We Offer')
  })
})

describe('matchSectionContent', () => {
  it('maps headings to order keys by normalized matching', () => {
    const order = ['services', 'process', 'areas']
    const sections = [
      { heading: 'Services We Offer', body: 'Service body.' },
      { heading: 'Our Process', body: 'Process body.' },
      { heading: 'Areas Served', body: 'Areas body.' },
    ]
    const result = matchSectionContent(order, sections)
    expect(result['services']).toBe('Service body.')
    expect(result['process']).toBe('Process body.')
    expect(result['areas']).toBe('Areas body.')
  })

  it('returns empty object for empty inputs', () => {
    expect(matchSectionContent([], [])).toEqual({})
  })

  it('skips sections that do not match any order key', () => {
    const order = ['services']
    const sections = [
      { heading: 'Random Stuff', body: 'Whatever.' },
      { heading: 'Our Services', body: 'Service body.' },
    ]
    const result = matchSectionContent(order, sections)
    expect(result['services']).toBe('Service body.')
    expect(Object.keys(result)).toHaveLength(1)
  })

  it('leaves key absent when no section matches', () => {
    const order = ['services', 'trust']
    const sections = [
      { heading: 'Our Services', body: 'Service body.' },
    ]
    const result = matchSectionContent(order, sections)
    expect(result['services']).toBe('Service body.')
    expect(result['trust']).toBeUndefined()
  })
})
