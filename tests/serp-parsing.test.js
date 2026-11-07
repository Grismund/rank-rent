import { describe, it, expect } from 'vitest'
import { extractOrganicDomains, extractOrganicResults, extractMapsResults } from '../lib/serp-parsing.js'

describe('extractOrganicDomains', () => {
  it('extracts domains from organic items', () => {
    const items = [
      { type: 'organic', domain: 'example.com', title: 'Test' },
      { type: 'organic', domain: 'other.com', title: 'Other' },
    ]
    expect(extractOrganicDomains(items, 5)).toEqual(['example.com', 'other.com'])
  })

  it('limits to maxCount domains', () => {
    const items = Array(10).fill(null).map((_, i) => ({
      type: 'organic', domain: `site${i}.com`, title: `Site ${i}`,
    }))
    expect(extractOrganicDomains(items, 3)).toHaveLength(3)
  })

  it('skips non-organic item types', () => {
    const items = [
      { type: 'organic', domain: 'example.com', title: 'Test' },
      { type: 'paid', domain: 'ad.com', title: 'Ad' },
      { type: 'featured_snippet', domain: 'snippet.com', title: 'Snippet' },
      { type: 'organic', domain: 'second.com', title: 'Second' },
    ]
    expect(extractOrganicDomains(items, 5)).toEqual(['example.com', 'second.com'])
  })

  it('returns empty array for null/undefined items', () => {
    expect(extractOrganicDomains(null, 5)).toEqual([])
    expect(extractOrganicDomains(undefined, 5)).toEqual([])
    expect(extractOrganicDomains([], 5)).toEqual([])
  })

  it('skips items without domain field', () => {
    const items = [
      { type: 'organic', domain: 'example.com', title: 'Test' },
      { type: 'organic', title: 'No domain' },
    ]
    expect(extractOrganicDomains(items, 5)).toEqual(['example.com'])
  })
})

describe('extractOrganicResults', () => {
  it('extracts full result objects from organic items', () => {
    const items = [
      { type: 'organic', domain: 'example.com', url: 'https://example.com/page', title: 'Test', description: 'A test result', rank_absolute: 1 },
      { type: 'organic', domain: 'other.com', url: 'https://other.com/', title: 'Other', description: 'Another', rank_absolute: 2 },
    ]
    const results = extractOrganicResults(items, 5)
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      domain: 'example.com',
      url: 'https://example.com/page',
      title: 'Test',
      description: 'A test result',
      position: 1,
    })
  })

  it('limits to maxCount results', () => {
    const items = Array(10).fill(null).map((_, i) => ({
      type: 'organic', domain: `site${i}.com`, url: `https://site${i}.com/`, title: `Site ${i}`, description: '', rank_absolute: i + 1,
    }))
    expect(extractOrganicResults(items, 3)).toHaveLength(3)
  })

  it('skips non-organic items', () => {
    const items = [
      { type: 'organic', domain: 'a.com', url: 'https://a.com/', title: 'A', description: '', rank_absolute: 1 },
      { type: 'paid', domain: 'ad.com', url: 'https://ad.com/', title: 'Ad', description: '', rank_absolute: 2 },
    ]
    expect(extractOrganicResults(items, 5)).toHaveLength(1)
  })

  it('returns empty array for null input', () => {
    expect(extractOrganicResults(null, 5)).toEqual([])
  })

  it('handles missing optional fields', () => {
    const items = [
      { type: 'organic', domain: 'example.com' },
    ]
    const results = extractOrganicResults(items, 5)
    expect(results[0]).toEqual({
      domain: 'example.com',
      url: '',
      title: '',
      description: '',
      position: 0,
    })
  })
})

describe('extractMapsResults', () => {
  it('extracts top three and total count from maps_search items', () => {
    const items = [
      { type: 'maps_search', title: 'Biz A', rating: { value: 4.5, reviews_count: 100 } },
      { type: 'maps_search', title: 'Biz B', rating: { value: 3.8, reviews_count: 50 } },
      { type: 'maps_search', title: 'Biz C', rating: { value: 4.9, reviews_count: 200 } },
      { type: 'maps_search', title: 'Biz D', rating: { value: 4.0, reviews_count: 30 } },
    ]
    const result = extractMapsResults(items, 20)
    expect(result.topThree).toHaveLength(3)
    expect(result.topThree[0]).toEqual({ name: 'Biz A', reviews: 100, rating: 4.5, domain: '', phone: '', address: '', category: '' })
    expect(result.totalCount).toBe(20)
  })

  it('handles maps_paid items as well', () => {
    const items = [
      { type: 'maps_paid', title: 'Paid Biz', rating: { value: 4.0, reviews_count: 10 } },
      { type: 'maps_search', title: 'Organic Biz', rating: { value: 4.5, reviews_count: 50 } },
    ]
    const result = extractMapsResults(items, 5)
    expect(result.topThree).toHaveLength(2)
  })

  it('falls back to items with title + rating fields regardless of type', () => {
    const items = [
      { type: 'maps_local_pack', title: 'Local Biz', rating: { value: 4.2, reviews_count: 75 } },
    ]
    const result = extractMapsResults(items, 3)
    expect(result.topThree).toHaveLength(1)
    expect(result.topThree[0].name).toBe('Local Biz')
  })

  it('returns empty topThree for null/undefined items', () => {
    expect(extractMapsResults(null, 0)).toEqual({ topThree: [], totalCount: 0 })
    expect(extractMapsResults([], 0)).toEqual({ topThree: [], totalCount: 0 })
  })

  it('handles missing rating gracefully', () => {
    const items = [
      { type: 'maps_search', title: 'No Rating Biz' },
      { type: 'maps_search', title: 'Has Rating', rating: { value: 4.0, reviews_count: 10 } },
    ]
    const result = extractMapsResults(items, 5)
    expect(result.topThree).toHaveLength(2)
    expect(result.topThree[0]).toEqual({ name: 'No Rating Biz', reviews: 0, rating: 0, domain: '', phone: '', address: '', category: '' })
  })

  it('extracts domain, phone, address, and category when present', () => {
    const items = [
      {
        type: 'maps_search',
        title: 'Pro Junk Removal',
        rating: { value: 4.7, reviews_count: 85 },
        domain: 'projunkremoval.com',
        phone: '(555) 123-4567',
        address: '123 Main St, Houston, TX',
        category: 'Junk Removal Service',
      },
    ]
    const result = extractMapsResults(items, 5)
    expect(result.topThree[0]).toEqual({
      name: 'Pro Junk Removal',
      reviews: 85,
      rating: 4.7,
      domain: 'projunkremoval.com',
      phone: '(555) 123-4567',
      address: '123 Main St, Houston, TX',
      category: 'Junk Removal Service',
    })
  })
})
