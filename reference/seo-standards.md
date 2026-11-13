# SEO Standards

All site builds and audits must check against these standards. Skills reference this file — do not hardcode these rules inline.

These are the floor every page must clear. `ranking-playbook.md` defines what goes beyond the floor (portfolio footprint, town-page depth, tools, links, growth) and adds portfolio-level audit checks.

## Page titles

- Under 60 characters
- Format: `{Primary Keyword} | {Brand Name}`
- Every page has a unique title
- Target phrase appears in the title

## Headings

- Exactly one H1 per page
- H1 matches or closely reflects the target phrase
- Subheadings (H2, H3) follow a logical hierarchy — no skipped levels
- No keyword-stuffed headings

## Keyword alignment

- Each page targets one primary phrase
- The primary phrase appears in: title, H1, URL slug, first 100 words, and meta description
- No two pages target the same primary phrase (cannibalization check)

## URL structure

- Lowercase, hyphen-separated slugs
- Service pages: `/service-name/`
- Town pages: `/service-name-town/` or `/areas/town/`
- Guides: `/guides/topic-slug/`; cost guide at `/cost/`; tool page at `/cost-calculator/` or a niche-specific slug
- No trailing parameters, session IDs, or unnecessary depth

## Internal linking

- Every page is reachable within 2 clicks from the home page
- Service pages link to related town pages and vice versa
- Home page links to all service pages
- Visible breadcrumbs on every non-home page, matching `BreadcrumbList` schema
- Town pages link to the 1–2 sub-service pages that town skews toward (see `ranking-playbook.md` §2)
- Anchor text is descriptive, not "click here"
- **Never** link to another portfolio site (any domain in `data/sites.csv`)

## Meta descriptions

- 120–160 characters
- Include the target phrase naturally
- Include a call to action (call, get a quote, etc.)
- Unique per page

## Technical

- Valid HTML — no broken tags
- All images have `alt` attributes
- `robots.txt` does not block crawlers from content pages
- XML sitemap includes all content pages and excludes non-content pages (privacy, thank-you); `lastmod` reflects real content change, not build time
- `/privacy/` and `/thank-you/` are `noindex`; `robots.txt` references the sitemap
- Canonical tags on every page
- Mobile-responsive viewport meta tag
- HTTPS enforced (redirect HTTP to HTTPS)
- Page loads under 3 seconds on mobile; Lighthouse ≥ 80 on mobile in all four categories, run in `rr-seo-audit`
- One OG image per page (1200×630, brand + H1)
- Images: descriptive filenames, alt text, explicit width/height, AVIF with WebP fallback, lazy-loaded below the fold
- IndexNow ping for changed URLs on every deploy
- Custom 404 with nav and phone number

## Schema markup

- `Organization` (site brand) on every page; `WebSite` on the home page
- `BreadcrumbList` on every non-home page
- `Service` schema on service pages
- `FAQPage` schema on FAQ page (and on the tool page for the questions it answers)
- `WebApplication` on the tool page
- `HowTo` on guide pages that are actually step-by-step
- No `LocalBusiness` schema (sites do not represent a single business)
- All schema generated from `site.yaml` fields and validated in `rr-seo-audit`

## Click-to-call

- Phone number in the header, visible on every page
- Sticky call bar on mobile viewports
- `tel:` link for mobile click-to-call
- Tracking number, not a personal or client number
