# SEO Standards

All site builds and audits must check against these standards. Skills reference this file — do not hardcode these rules inline.

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
- No trailing parameters, session IDs, or unnecessary depth

## Internal linking

- Every page is reachable within 2 clicks from the home page
- Service pages link to related town pages and vice versa
- Home page links to all service pages
- Anchor text is descriptive, not "click here"

## Meta descriptions

- 120–160 characters
- Include the target phrase naturally
- Include a call to action (call, get a quote, etc.)
- Unique per page

## Technical

- Valid HTML — no broken tags
- All images have `alt` attributes
- `robots.txt` does not block crawlers from content pages
- XML sitemap includes all content pages and excludes non-content pages (privacy, thank-you)
- Canonical tags on every page
- Mobile-responsive viewport meta tag
- HTTPS enforced (redirect HTTP to HTTPS)
- Page loads under 3 seconds on mobile (Lighthouse performance score 80+)

## Schema markup

- `Service` schema on service pages
- `FAQPage` schema on FAQ page
- No `LocalBusiness` schema (sites do not represent a single business)
- Schema validates with Google's Rich Results Test

## Click-to-call

- Phone number in the header, visible on every page
- `tel:` link for mobile click-to-call
- Tracking number, not a personal or client number
