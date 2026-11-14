import type { PageConfig, SiteConfig } from './resolve-site'

/**
 * Build JSON-LD schema objects for a page.
 * Returns an array of schema objects to be rendered as <script type="application/ld+json">.
 *
 * GUARDRAIL: LocalBusiness is NEVER emitted.
 */
export function buildSchema(
  page: PageConfig,
  site: SiteConfig
): Record<string, any>[] {
  const schemas: Record<string, any>[] = []

  const baseUrl = site.domain ? `https://${site.domain}` : ''

  // Organization — always present
  const org: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.brand,
    url: baseUrl || undefined,
  }
  if (site.phone) {
    org.telephone = site.phone
  }
  schemas.push(org)

  // WebSite — home page only
  if (page.type === 'home') {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site.brand,
      url: baseUrl || undefined,
    })
  }

  // BreadcrumbList — every non-home page
  if (page.type !== 'home') {
    const items: Record<string, any>[] = [
      {
        '@type': 'ListItem',
        position: 1,
        item: {
          '@id': baseUrl + '/',
          name: 'Home',
        },
      },
    ]

    // Build breadcrumb trail from slug
    const segments = page.slug
      .split('/')
      .filter((s) => s)
    let currentPath = ''
    for (let i = 0; i < segments.length; i++) {
      currentPath += '/' + segments[i]
      const isLast = i === segments.length - 1
      const name = isLast ? page.h1 : segments[i].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      items.push({
        '@type': 'ListItem',
        position: i + 2,
        item: {
          '@id': baseUrl + currentPath + '/',
          name,
        },
      })
    }

    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items,
    })
  }

  // Service — service pages
  if (page.type === 'service') {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: page.h1,
      provider: {
        '@type': 'Organization',
        name: site.brand,
      },
      areaServed: {
        '@type': 'City',
        name: site.city,
        containedInPlace: {
          '@type': 'State',
          name: site.state,
        },
      },
    })
  }

  // FAQPage — faq and tool pages
  if (page.type === 'faq' || page.type === 'tool') {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [],
    })
  }

  // WebApplication — tool pages
  if (page.type === 'tool') {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: page.h1,
      applicationCategory: 'UtilityApplication',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    })
  }

  // Safety check — NEVER emit LocalBusiness
  for (const s of schemas) {
    if (s['@type'] === 'LocalBusiness') {
      throw new Error(
        'GUARDRAIL VIOLATION: LocalBusiness schema must never be emitted. ' +
        'These sites do not represent a single business.'
      )
    }
  }

  return schemas
}
