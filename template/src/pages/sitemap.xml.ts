import { resolve } from 'node:path'
import { resolveSite } from '../lib/resolve-site'
import type { APIRoute } from 'astro'

export const GET: APIRoute = () => {
  const siteSlug = process.env.SITE || 'default'
  const rootDir = resolve(process.cwd(), '..')
  const config = resolveSite(siteSlug, rootDir)

  const domain = config.domain || `${siteSlug}.example.com`
  const baseUrl = `https://${domain}`

  // Pages to exclude from sitemap
  const noIndexSlugs = new Set(['/privacy/', '/thank-you/'])

  const urls: string[] = []

  for (const page of config.pages) {
    if ((page as any).status === 'draft') continue
    if (noIndexSlugs.has(page.slug)) continue

    const loc = page.slug === '/' ? baseUrl + '/' : baseUrl + page.slug
    const frontmatterUpdated = (page as any).updated
    const lastmod = frontmatterUpdated
      ? `\n    <lastmod>${frontmatterUpdated}</lastmod>`
      : ''

    urls.push(`  <url>\n    <loc>${loc}</loc>${lastmod}\n  </url>`)
  }

  // Include static utility pages (except noindex ones)
  const staticPages = ['about', 'contact']
  for (const sp of staticPages) {
    const exists = config.pages.some(
      (p: any) => p.slug.replace(/^\/|\/$/g, '') === sp
    )
    if (!exists) {
      urls.push(`  <url>\n    <loc>${baseUrl}/${sp}/</loc>\n  </url>`)
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
