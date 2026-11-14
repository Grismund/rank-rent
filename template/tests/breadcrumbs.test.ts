import { describe, it, expect } from 'vitest'
import { buildBreadcrumbs } from '../src/lib/breadcrumbs'
import type { PageConfig } from '../src/lib/resolve-site'

function makePage(overrides: Partial<PageConfig>): PageConfig {
  return {
    slug: '/',
    type: 'home',
    primary_keyword: 'test',
    h1: 'Test Page',
    title: 'Test',
    meta_description_intent: 'test',
    word_count: { min: 500, max: 1000 },
    ...overrides,
  }
}

describe('buildBreadcrumbs', () => {
  it('returns empty array for home page', () => {
    const page = makePage({ slug: '/', type: 'home' })
    expect(buildBreadcrumbs(page)).toEqual([])
  })

  it('returns [Home, page h1] for top-level page', () => {
    const page = makePage({
      slug: '/garage-floor-epoxy/',
      type: 'service',
      h1: 'Garage Floor Epoxy in Orlando',
    })
    const crumbs = buildBreadcrumbs(page)
    expect(crumbs).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Garage Floor Epoxy in Orlando', href: '/garage-floor-epoxy/' },
    ])
  })

  it('returns [Home, Areas, h1] for nested area page', () => {
    const page = makePage({
      slug: '/areas/winter-park/',
      type: 'town',
      h1: 'Epoxy Flooring in Winter Park',
    })
    const crumbs = buildBreadcrumbs(page)
    expect(crumbs).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Areas', href: '/areas/' },
      { label: 'Epoxy Flooring in Winter Park', href: '/areas/winter-park/' },
    ])
  })

  it('returns [Home, Guides, h1] for nested guide page', () => {
    const page = makePage({
      slug: '/guides/epoxy-vs-polyaspartic/',
      type: 'guide',
      h1: 'Epoxy vs. Polyaspartic',
    })
    const crumbs = buildBreadcrumbs(page)
    expect(crumbs).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Guides', href: '/guides/' },
      { label: 'Epoxy vs. Polyaspartic', href: '/guides/epoxy-vs-polyaspartic/' },
    ])
  })
})
