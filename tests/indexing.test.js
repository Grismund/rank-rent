import { describe, it, expect } from 'vitest'
import {
  LINKS_CSV_COLUMNS,
  readLinksCsv,
  writeLinksCsv,
  buildSitemapUrl,
  buildIndexNowPayload,
  generateIndexNowKey,
  buildPageUrls,
  buildGscVerificationRecord,
  buildGscPropertyUrl,
  formatIndexingReport,
} from '../lib/indexing.js'

describe('LINKS_CSV_COLUMNS', () => {
  it('has the correct columns in order', () => {
    expect(LINKS_CSV_COLUMNS[0]).toBe('site_slug')
    expect(LINKS_CSV_COLUMNS[1]).toBe('target_url')
    expect(LINKS_CSV_COLUMNS[2]).toBe('type')
    expect(LINKS_CSV_COLUMNS[3]).toBe('status')
    expect(LINKS_CSV_COLUMNS[4]).toBe('date')
    expect(LINKS_CSV_COLUMNS[5]).toBe('page_linked_to')
    expect(LINKS_CSV_COLUMNS[6]).toBe('anchor_text')
    expect(LINKS_CSV_COLUMNS[7]).toBe('notes')
  })

  it('has exactly 8 columns', () => {
    expect(LINKS_CSV_COLUMNS).toHaveLength(8)
  })
})

describe('readLinksCsv', () => {
  it('parses CSV string into row objects', () => {
    const csv = 'site_slug,target_url,type,status,date,page_linked_to,anchor_text,notes\nsite-a,https://dir.com,directory,submitted,2026-11-19,/,Fort Myers Epoxy,first submission'
    const rows = readLinksCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].site_slug).toBe('site-a')
    expect(rows[0].target_url).toBe('https://dir.com')
    expect(rows[0].type).toBe('directory')
    expect(rows[0].status).toBe('submitted')
  })

  it('returns empty array for header-only CSV', () => {
    const csv = 'site_slug,target_url,type,status,date,page_linked_to,anchor_text,notes'
    expect(readLinksCsv(csv)).toHaveLength(0)
  })

  it('handles quoted fields', () => {
    const csv = 'site_slug,target_url,type,status,date,page_linked_to,anchor_text,notes\nsite-a,https://example.com,directory,submitted,2026-11-19,/,"Best epoxy, guaranteed","First, second"'
    const rows = readLinksCsv(csv)
    expect(rows[0].anchor_text).toBe('Best epoxy, guaranteed')
    expect(rows[0].notes).toBe('First, second')
  })

  it('returns empty array for empty string', () => {
    expect(readLinksCsv('')).toHaveLength(0)
  })
})

describe('writeLinksCsv', () => {
  it('serializes rows with header', () => {
    const rows = [{
      site_slug: 'site-a',
      target_url: 'https://dir.com',
      type: 'directory',
      status: 'submitted',
      date: '2026-11-19',
      page_linked_to: '/',
      anchor_text: 'Test',
      notes: '',
    }]
    const csv = writeLinksCsv(rows)
    const lines = csv.split('\n')
    expect(lines[0]).toBe(LINKS_CSV_COLUMNS.join(','))
    expect(lines[1]).toContain('site-a')
  })

  it('quotes fields with commas', () => {
    const rows = [{
      site_slug: 'site-a', target_url: 'https://dir.com', type: 'directory',
      status: 'submitted', date: '2026-11-19', page_linked_to: '/',
      anchor_text: 'best, fastest', notes: '',
    }]
    const csv = writeLinksCsv(rows)
    expect(csv).toContain('"best, fastest"')
  })

  it('roundtrips through read and write', () => {
    const rows = [{
      site_slug: 'site-a', target_url: 'https://dir.com', type: 'directory',
      status: 'submitted', date: '2026-11-19', page_linked_to: '/',
      anchor_text: 'Test', notes: 'some note',
    }]
    const csv = writeLinksCsv(rows)
    const parsed = readLinksCsv(csv)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].site_slug).toBe('site-a')
    expect(parsed[0].notes).toBe('some note')
  })
})

describe('buildSitemapUrl', () => {
  it('builds HTTPS sitemap URL', () => {
    expect(buildSitemapUrl('example.com')).toBe('https://example.com/sitemap.xml')
  })

  it('does not add www', () => {
    const url = buildSitemapUrl('test.com')
    expect(url).not.toContain('www')
  })
})

describe('buildIndexNowPayload', () => {
  it('builds correct payload structure', () => {
    const payload = buildIndexNowPayload('example.com', 'abc123', ['https://example.com/', 'https://example.com/about/'])
    expect(payload.host).toBe('example.com')
    expect(payload.key).toBe('abc123')
    expect(payload.keyLocation).toBe('https://example.com/abc123.txt')
    expect(payload.urlList).toEqual(['https://example.com/', 'https://example.com/about/'])
  })
})

describe('generateIndexNowKey', () => {
  it('returns a 32-character hex string', () => {
    const key = generateIndexNowKey('test-slug')
    expect(key).toMatch(/^[0-9a-f]{32}$/)
  })

  it('is deterministic for the same slug', () => {
    const a = generateIndexNowKey('test-slug')
    const b = generateIndexNowKey('test-slug')
    expect(a).toBe(b)
  })

  it('produces unique keys for different slugs', () => {
    const a = generateIndexNowKey('slug-one')
    const b = generateIndexNowKey('slug-two')
    expect(a).not.toBe(b)
  })
})

describe('buildPageUrls', () => {
  it('builds full URLs from site config', () => {
    const config = {
      pages: [
        { slug: '/' },
        { slug: '/garage-floor-epoxy/' },
        { slug: '/areas/cape-coral/' },
      ],
    }
    const urls = buildPageUrls(config, 'example.com')
    expect(urls).toContain('https://example.com/')
    expect(urls).toContain('https://example.com/garage-floor-epoxy/')
    expect(urls).toContain('https://example.com/areas/cape-coral/')
  })

  it('excludes pages with noindex set', () => {
    const config = {
      pages: [
        { slug: '/' },
        { slug: '/draft/', noindex: true },
      ],
    }
    const urls = buildPageUrls(config, 'example.com')
    expect(urls).toHaveLength(1)
    expect(urls).not.toContain('https://example.com/draft/')
  })

  it('handles empty pages array', () => {
    const urls = buildPageUrls({ pages: [] }, 'example.com')
    expect(urls).toHaveLength(0)
  })
})

describe('buildGscVerificationRecord', () => {
  it('returns a TXT record object', () => {
    const record = buildGscVerificationRecord('google-site-verification=abc123')
    expect(record.type).toBe('TXT')
    expect(record.content).toBe('google-site-verification=abc123')
  })
})

describe('buildGscPropertyUrl', () => {
  it('returns HTTPS URL with trailing slash', () => {
    expect(buildGscPropertyUrl('example.com')).toBe('https://example.com/')
  })
})

describe('formatIndexingReport', () => {
  it('includes all status fields', () => {
    const report = formatIndexingReport({
      slug: 'test-site',
      domain: 'test.com',
      gscAdded: true,
      gscVerified: true,
      sitemapSubmitted: true,
      bingAdded: true,
      indexNowPinged: true,
      urlCount: 14,
    })
    expect(report).toContain('test-site')
    expect(report).toContain('test.com')
    expect(report).toContain('GSC')
    expect(report).toContain('Bing')
    expect(report).toContain('IndexNow')
  })

  it('handles errors in report', () => {
    const report = formatIndexingReport({
      slug: 'fail-site',
      domain: 'fail.com',
      gscAdded: false,
      gscVerified: false,
      sitemapSubmitted: false,
      bingAdded: false,
      indexNowPinged: false,
      urlCount: 0,
      errors: ['GSC verification failed', 'Bing add failed'],
    })
    expect(report).toContain('fail-site')
    expect(report).toContain('GSC verification failed')
  })
})
