import { resolve } from 'node:path'
import { resolveSite } from '../lib/resolve-site'
import type { APIRoute } from 'astro'

export const GET: APIRoute = () => {
  const siteSlug = process.env.SITE || 'default'
  const rootDir = resolve(process.cwd(), '..')
  const config = resolveSite(siteSlug, rootDir)

  const domain = config.domain || `${siteSlug}.example.com`

  const body = `User-agent: *
Allow: /
Sitemap: https://${domain}/sitemap.xml
`

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain' },
  })
}
