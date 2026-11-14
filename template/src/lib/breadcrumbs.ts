import type { PageConfig } from './resolve-site'

export interface BreadcrumbItem {
  label: string
  href: string
}

/**
 * Build breadcrumb items for a page.
 * Home page returns empty array.
 * Top-level pages: [Home, page].
 * Nested pages (areas/X, guides/X): [Home, parent, page].
 */
export function buildBreadcrumbs(page: PageConfig): BreadcrumbItem[] {
  if (page.type === 'home') return []

  const segments = page.slug.split('/').filter((s) => s)
  const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }]

  if (segments.length > 1) {
    // Add intermediate breadcrumb (e.g. "Areas", "Guides")
    const parentSlug = segments[0]
    const parentLabel = parentSlug.charAt(0).toUpperCase() + parentSlug.slice(1)
    items.push({ label: parentLabel, href: `/${parentSlug}/` })
  }

  items.push({ label: page.h1, href: page.slug })

  return items
}
