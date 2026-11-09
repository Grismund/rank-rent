import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs before importing the module
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}))

import { readFileSync, existsSync } from 'node:fs'
import {
  loadTeardownHtml,
  loadViabilityHtml,
  loadShortlistHtml,
  buildReportMaps,
  buildShortlistMap,
} from '../lib/report-loader.js'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('loadTeardownHtml', () => {
  it('returns HTML when teardown.md exists', () => {
    existsSync.mockReturnValue(true)
    readFileSync.mockReturnValue('## Verdict: BEATABLE\n\nWeak competitors.')
    const result = loadTeardownHtml('epoxy-flooring-miami', '/research')
    expect(existsSync).toHaveBeenCalledWith('/research/epoxy-flooring-miami/teardown.md')
    expect(result).toContain('<h2>Verdict: BEATABLE</h2>')
    expect(result).toContain('<p>Weak competitors.</p>')
  })

  it('returns null when file does not exist', () => {
    existsSync.mockReturnValue(false)
    expect(loadTeardownHtml('no-such-slug', '/research')).toBeNull()
  })
})

describe('loadViabilityHtml', () => {
  it('returns HTML when viability.md exists', () => {
    existsSync.mockReturnValue(true)
    readFileSync.mockReturnValue('# Viability\n\n**Verdict:** viable')
    const result = loadViabilityHtml('bathroom-remodel-conroe', '/research')
    expect(existsSync).toHaveBeenCalledWith('/research/bathroom-remodel-conroe/viability.md')
    expect(result).toContain('<h1>Viability</h1>')
    expect(result).toContain('<strong>Verdict:</strong> viable')
  })

  it('returns null when file does not exist', () => {
    existsSync.mockReturnValue(false)
    expect(loadViabilityHtml('missing', '/research')).toBeNull()
  })
})

describe('loadShortlistHtml', () => {
  it('converts shortlist markdown to HTML', () => {
    readFileSync.mockReturnValue('# Shortlist\n\n- candidate A\n- candidate B')
    const result = loadShortlistHtml('shortlist-2026-11-02.md', '/research')
    expect(readFileSync).toHaveBeenCalledWith('/research/shortlist-2026-11-02.md', 'utf8')
    expect(result).toContain('<h1>Shortlist</h1>')
    expect(result).toContain('<li>candidate A</li>')
  })
})

describe('buildReportMaps', () => {
  it('builds maps for slugs with existing reports', () => {
    existsSync.mockImplementation((path) => {
      if (path.includes('slug-a/teardown.md')) return true
      if (path.includes('slug-a/viability.md')) return true
      if (path.includes('slug-b/teardown.md')) return false
      if (path.includes('slug-b/viability.md')) return true
      return false
    })
    readFileSync.mockImplementation((path) => {
      if (path.includes('slug-a/teardown.md')) return '## Teardown A'
      if (path.includes('slug-a/viability.md')) return '## Viability A'
      if (path.includes('slug-b/viability.md')) return '## Viability B'
      return ''
    })

    const { teardownHtmlMap, viabilityHtmlMap } = buildReportMaps(['slug-a', 'slug-b'], '/research')

    expect(Object.keys(teardownHtmlMap)).toEqual(['slug-a'])
    expect(teardownHtmlMap['slug-a']).toContain('<h2>Teardown A</h2>')
    expect(Object.keys(viabilityHtmlMap).sort()).toEqual(['slug-a', 'slug-b'])
    expect(viabilityHtmlMap['slug-b']).toContain('<h2>Viability B</h2>')
  })

  it('returns empty maps for empty slugs array', () => {
    const { teardownHtmlMap, viabilityHtmlMap } = buildReportMaps([], '/research')
    expect(teardownHtmlMap).toEqual({})
    expect(viabilityHtmlMap).toEqual({})
  })
})

describe('buildShortlistMap', () => {
  it('builds map of filename to HTML', () => {
    readFileSync.mockImplementation((path) => {
      if (path.includes('shortlist-a.md')) return '# List A'
      if (path.includes('shortlist-b.md')) return '# List B'
      return ''
    })

    const map = buildShortlistMap(['shortlist-a.md', 'shortlist-b.md'], '/research')
    expect(map['shortlist-a.md']).toContain('<h1>List A</h1>')
    expect(map['shortlist-b.md']).toContain('<h1>List B</h1>')
  })

  it('returns empty map for empty filenames array', () => {
    expect(buildShortlistMap([], '/research')).toEqual({})
  })
})
