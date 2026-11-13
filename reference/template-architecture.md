# Template Architecture

The spec for `template/` and for `rr-site-build`. One Astro codebase produces every site; no two sites in the portfolio share the same visible structure, copy patterns, or class names. `ranking-playbook.md` §1 states the why; this file states the how.

Read with: `site-design.md` (page inventory, visual requirements), `seo-standards.md` (page-level floor), `niche-design-specs.md` (per-niche tokens, tools, imagery), `sites/ASSIGNMENTS.md` (which site gets which combination).

## 1. Design principle

Vary the **expression**, never the **decision**.

Decisions that have a correct answer are fixed invariants (§7): phone above the fold, one H1 with the target phrase, heading hierarchy from the page plan, breadcrumbs, schema, form fields, disclosure. Everything else — layout shell, section markup, section order, copy phrasing, tokens, imagery, class names — is drawn from a pool so that the rendered DOM, visible text patterns, and stylesheet of any two sites differ.

Three excellent shells beat eight mediocre ones. Build four, polish them, and let the combinatorics do the rest.

## 2. Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | Astro 5, `output: 'static'` | One project in `template/`; each site is a build with `SITE=<slug>` |
| Styling | Astro scoped styles + CSS custom properties for tokens | No Tailwind (utility classes are a shared fingerprint across sites) |
| Interactive islands | Preact (`@astrojs/preact`) | Tool page and FAQ accordion only; everything else is zero-JS |
| Images | `astro:assets` `<Image>` / `<Picture>` with sharp | AVIF + WebP, explicit dimensions, lazy below the fold |
| Fonts | `@fontsource-variable/*`, self-hosted, subset | Two families per site max; no Google Fonts requests |
| Content | Markdown per page in `sites/<slug>/content/<slug>.md` with frontmatter | Written by `rr-content`; template renders it |
| Config | `sites/<slug>/site.yaml` | Extended schema in §8 |
| Schema.org | Generated in `src/lib/schema.ts` from site.yaml + page frontmatter | Validated by `rr-seo-audit` |
| Hosting | Cloudflare Pages, one project per site | `wrangler pages deploy dist --project-name <slug>` |
| Forms | HTML form → Cloudflare Pages Function → Resend | `/thank-you/` is `noindex` |

## 3. Build pipeline

```
sites/<slug>/site.yaml ─┐
niches/<niche>/pack.yaml ├─▶ resolve-site.ts ─▶ SiteConfig (shell, tokens, order, copy, classMap, pages)
sites/ASSIGNMENTS.md ───┘            │
                                     ▼
sites/<slug>/content/*.md ──▶ Astro pages (src/pages/[...slug].astro) ──▶ dist/
                                     │
                                     ▼
                              rr-seo-audit ──▶ pass/fail ──▶ rr-deploy
```

`resolve-site.ts` is the only place that reads the seed and the assignment. Every component receives a resolved `SiteConfig`; no component reads YAML or hashes anything itself.

Build: `SITE=epoxy-flooring-orlando npm run build` → `dist/`. `npm run build:all` iterates `sites/*/site.yaml` with `status != draft`.

## 4. Variation axes

Six axes. Explicit assignment (`sites/ASSIGNMENTS.md`) fixes the first three per site; the seed fixes the rest.

### 4.1 Shells (layout skeleton) — 4

A shell defines header, hero, footer, content width, and whether there is a sidebar. Shells differ in DOM structure, not just CSS.

| Shell | Name | Header | Hero | Body | Footer | Type pairing |
|---|---|---|---|---|---|---|
| **A** | Classic Contractor | Top bar: logo left, inline nav, phone button right | Centered headline over full-width image, CTA pair below | Single column, 72ch max, alternating full-bleed section backgrounds | 4-column: brand, services, areas, contact | Sans display + sans body |
| **B** | Split Editorial | Slim top bar with phone; nav as a second row | Two-column: headline + bullets left, quote-form card right | Content left, sticky sidebar right (phone card, "areas served", related pages) | 2-column: disclosure + nav, bottom bar with phone | Serif display + sans body |
| **C** | Bold Banner | Dark full-width header, logo centered, phone as pill button | Full-bleed image with gradient overlay, headline bottom-left, single CTA | Single column, 80ch, services as horizontal cards, towns as chips | Single dark band: nav inline, phone, disclosure | Condensed display + sans body |
| **D** | Guide-First | Minimal header: wordmark + phone link, hamburger nav on all sizes | No image hero; large headline, lede paragraph, inline phone, then table of contents | Article layout, 65ch, with a floating "Call" card that docks on mobile | Compact: brand line, disclosure, 3 links | Serif display + serif body |

Each shell is its own layout file: `src/layouts/ShellA.astro` … `ShellD.astro`. Shared pieces (`<head>`, schema, skip link, sticky mobile bar) live in `src/components/base/` and are the only components all shells import.

### 4.2 Token sets — 2 per niche (16 total)

Defined in `niche-design-specs.md`. A token set is a CSS custom-property block: palette (bg, surface, text, muted, accent, accent-text, border), type scale ratio, radius, spacing density, shadow style, image treatment (none / duotone / rounded / framed). Token sets live in `template/src/tokens/<niche>-<1|2>.css`.

Uniqueness rule: within a niche, no two sites share **both** shell and token set. Across the portfolio, no two sites share shell + token set + nav label set.

### 4.3 Section-order sets — 3 per page type

Each page type has a fixed set of sections (from pack outlines) and 3 allowed orderings that keep the CTA last and the H1/intro first. Example for `home`:

| Set | Order |
|---|---|
| O1 | intro → services → process → areas → trust → cta |
| O2 | intro → process → services → areas → cta (trust folded into intro) |
| O3 | intro → areas → services → trust → process → cta |

`service`, `town`, `guide`, `cost_guide`, `faq`, `tool` each get their own O1–O3 in `template/src/config/section-orders.ts`. Assignment picks the set per site; all pages of one type on a site use the same set.

### 4.4 Section component variants — 2–3 each (seed-picked)

Every section has variants that differ in markup. The seed picks one per section per site; the same variant is used site-wide so the site feels consistent.

| Section | Variants |
|---|---|
| `ServicesList` | `cards` (grid of `<article>`), `list` (`<ul>` with icon + 2-line description), `tabs` (no-JS `<details>` per service) |
| `AreasServed` | `chips` (inline `<ul>` of links), `columns` (2-col list with county grouping), `table` (town, distance, link) |
| `Process` | `steps` (`<ol>` numbered), `timeline` (vertical rail), `cards` (3 cards) |
| `TrustBlock` | `disclosure-first` (how-it-works paragraph + sources), `stat-free-facts` (3 sourced local facts), `checklist` (what to expect) — never testimonials or ratings |
| `FAQ` | `details` (native `<details>`), `open-list` (`<dl>`), `two-column` |
| `CostTable` | `table`, `range-bars` (CSS-only), `cards` |
| `CTABand` | `band` (full-width), `card` (boxed), `inline` (paragraph + button) |
| `Breadcrumbs` | `slash`, `chevron`, `arrow` (markup identical; separators and position differ) |
| `Hero` | per shell (not separately varied) |
| `ToolShell` | `card` (tool in a framed card), `full` (tool full-width above copy), `split` (copy left, tool right on desktop) |

Variants are files: `src/components/sections/ServicesList/{cards,list,tabs}.astro`. The resolver maps section → variant; `[...slug].astro` renders via a `SectionRenderer` that switches on the resolved variant.

### 4.5 Copy banks (seed-picked, then written into site.yaml so they are editable)

Short strings that would otherwise be identical across sites. Each bank has ≥ 4 entries; the resolver picks one set per site and **writes the choice into `site.yaml` `copy:`** on first build so the operator can edit and the choice is stable.

| Bank | Examples |
|---|---|
| `nav.services` | Services · What We Do · Our Work · Service Menu |
| `nav.areas` | Areas Served · Where We Work · Service Area · Locations |
| `nav.cost` | Pricing · Cost Guide · What It Costs · Estimates |
| `nav.faq` | FAQ · Common Questions · Good to Know · Questions |
| `nav.about` | How It Works · About · Our Process · Who We Are |
| `cta.primary` | Call for a Free Quote · Talk to a Local Pro · Get Pricing by Phone · Request a Call Back · Speak With a Contractor |
| `cta.secondary` | Request a Quote · Send Details · Get an Estimate · Tell Us About Your Project |
| `form.heading` | Prefer to Type? · Send Us the Details · Request a Quote Online · Get a Written Estimate |
| `footer.disclosure` | 4 sentences with identical meaning, different wording (see §7.3) |
| `trust.heading` | How This Works · What to Expect · Before You Call · The Process |
| `areas.intro` | 4 one-sentence lead-ins |

### 4.6 Heading variants (pack-level, seed-picked)

Pack outlines currently fix every H2 string per niche. Each `pack.yaml` section gets `h2_variants: [3 phrasings]`; the resolver picks one per section per site. The H1 is **not** varied — it carries the target phrase from the page plan. `rr-content` receives the chosen H2s and writes to them. Example (`home.sections[0]`):

```yaml
- h2: "Professional {display_name} Services"
  h2_variants:
    - "Professional {display_name} Services"
    - "{display_name} for {city} Homeowners"
    - "Local {display_name}, Done Right"
```

### 4.7 Class-name map (seed-generated)

Semantic class names are generated per site from a vocabulary so that no two sites share stylesheet selectors even for identical components.

- `src/lib/classmap.ts` exposes `cls(key)`; components only ever call `cls('callButton')`, never write literal class strings.
- Keys: ~40 semantic names (`callButton`, `heroWrap`, `navList`, `serviceCard`, `areaChip`, `ctaBand`, `footerGrid`, …).
- Each key has 3–4 candidate names built from a small vocabulary (`cta-call-button`, `phone-button-cta`, `call-now-btn`, `tel-action`). Seed picks one per key. The map is written to `sites/<slug>/classmap.json` on first build and reused thereafter.
- Astro's scoped-style hash varies per build anyway; this map covers the readable classes and any global CSS.
- Audit: no two sites in the portfolio share more than 20% of class-map values.

## 5. Seed

`seed = sha256(site_dir_slug)`; the first 16 hex chars drive a seeded PRNG (`seedrandom`-style, implemented in `src/lib/seed.ts`). Picks are deterministic and recorded:

- Shell, token set, section-order sets → **explicit** in `sites/ASSIGNMENTS.md` (the audit's uniqueness constraints are easier to guarantee by hand for 18 sites; the seed is the fallback for sites not listed).
- Component variants, copy bank picks, heading variants, class map → seed, then persisted into `site.yaml` / `classmap.json` on first resolve so later edits by the operator stick.

Re-running the resolver never overwrites a persisted pick.

## 6. Page rendering

`src/pages/[...slug].astro` → `getStaticPaths()` from `site.yaml.pages`. For each page:

1. Load `sites/<slug>/content/<page>.md` (frontmatter: `title`, `meta_description`, `h1`, `primary_keyword`, `type`, `status`, `updated`, `sources[]`, `faqs[]`, `town_facts[]`).
2. Pick layout by shell; pick section order by page type; render sections via `SectionRenderer` with the resolved variants; pass the markdown body split by `## ` headings into the sections that expect prose.
3. `<head>`: title, meta description, canonical, OG tags + per-page OG image (`/og/<page>.png`, generated at build with `satori` or `@resvg/resvg-js`), schema JSON-LD from `schema.ts`.
4. Sticky mobile call bar and skip link from `base/`.
5. Breadcrumbs on every non-home page.

Content with `status: draft` builds locally but is excluded from `dist/` in production builds and from the sitemap.

## 7. Invariants (never varied, always audited)

### 7.1 Above the fold, every page, every shell
- Brand (text or SVG) linking to `/`
- Phone number as `<a href="tel:">` with the number visible, in the header
- On mobile (< 768px): sticky bottom call bar with the number, present on every page
- H1 containing the page's `primary_keyword`

### 7.2 Structure
- Exactly one H1; H2/H3 follow the page plan in the chosen order; no skipped levels
- Breadcrumbs (visible + `BreadcrumbList`) on every non-home page
- Primary keyword in the first 100 words of body copy
- Internal links per `seo-standards.md` (home → all services; service ↔ relevant towns; town → 1–2 sub-services)
- CTA section is always the last content section
- Contact form fields: name, phone, town, details — nothing more

### 7.3 Disclosure
Footer carries one of four sentences, all meaning "this site connects homeowners with independent local contractors and is operated by Vantabox LLC":
1. "We connect homeowners with independent local contractors. Operated by Vantabox LLC."
2. "This site matches local homeowners with independent, unaffiliated contractors. A Vantabox LLC service."
3. "Independent contractors serve every request made through this site. Site operated by Vantabox LLC."
4. "We're a local referral service: your request goes to an independent contractor in your area. Vantabox LLC."

### 7.4 Schema set
`Organization` (brand) sitewide; `WebSite` on home; `BreadcrumbList` on non-home; `Service` on service pages; `FAQPage` on FAQ and tool pages; `WebApplication` on tool; `HowTo` only where the guide is step-by-step. **Never `LocalBusiness`.**

### 7.5 Technical
Canonical, viewport, `lang`, sitemap with real `lastmod`, `robots.txt` with sitemap line, `noindex` on `/privacy/` `/thank-you/`, custom 404, Lighthouse ≥ 80 mobile all categories, no third-party scripts except call tracking, no cookies set.

## 8. `site.yaml` schema additions

```yaml
niche: epoxy-flooring
display_name: Epoxy Flooring
city: Orlando
state: Florida
brand: Orlando Epoxy Works          # required, not TBD, before rr-content
brand_short: OEW                     # optional, for tight spaces
domain: null                         # set by rr-domains
phone: null                          # set by rr-phone
status: draft | content_ready | audited | deployed

design:
  shell: B                           # A|B|C|D — from ASSIGNMENTS.md
  tokens: epoxy-flooring-2           # from niche-design-specs.md
  order:                             # section-order set per page type
    home: O2
    service: O1
    town: O3
    guide: O1
    cost_guide: O2
    faq: O1
    tool: O3
  variants:                          # seed-filled on first resolve, editable
    ServicesList: list
    AreasServed: columns
    Process: timeline
    TrustBlock: checklist
    FAQ: details
    CostTable: range-bars
    CTABand: card
    Breadcrumbs: chevron
    ToolShell: split
  classmap: classmap.json            # seed-generated on first resolve

copy:                                # seed-filled on first resolve, editable
  nav: { services: "What We Do", areas: "Service Area", cost: "Pricing", faq: "Good to Know", about: "How It Works" }
  cta: { primary: "Talk to a Local Pro", secondary: "Send Details" }
  form_heading: "Request a Quote Online"
  disclosure: 2                      # index into §7.3
  trust_heading: "What to Expect"

tool:
  slug: /garage-floor-cost-calculator/
  type: epoxy-cost-estimator         # from niche-design-specs.md
  primary_keyword: "epoxy garage floor cost calculator orlando"

images:
  set: epoxy-flooring-2              # from niche-design-specs.md
  hero: garage-two-car-metallic.avif

towns: [...]
pages: [...]                          # existing, plus type: tool and type: guide entries
```

`rr-keywords` already writes `towns` and `pages`; `rr-site-build` adds `design`, `copy`, `tool`, `images` from ASSIGNMENTS.md + seed; the operator sets `brand`.

## 9. Repository layout for `template/`

```
template/
  astro.config.mjs
  package.json
  src/
    layouts/ShellA.astro ShellB.astro ShellC.astro ShellD.astro
    components/
      base/Head.astro Schema.astro StickyCallBar.astro SkipLink.astro Breadcrumbs/
      sections/<Section>/<variant>.astro
      tools/<tool-type>.tsx                 # Preact islands
    tokens/<niche>-<n>.css
    config/section-orders.ts copy-banks.ts classmap-vocab.ts
    lib/resolve-site.ts seed.ts classmap.ts schema.ts content.ts og-image.ts
    pages/[...slug].astro 404.astro
    pages/sitemap.xml.ts robots.txt.ts
  functions/api/lead.ts                     # Cloudflare Pages Function → Resend
  public/img/<niche>/...
  public/fonts/...
scripts/
  build-site.mjs      # SITE=<slug> → dist/<slug>
  build-all.mjs
  resolve-site.mjs    # writes seed picks back into site.yaml / classmap.json
```

## 10. Audit hooks (consumed by `rr-seo-audit`)

Beyond `seo-standards.md` and the `ranking-playbook.md` checklist, the template exposes `dist/<slug>/_audit.json` per build with: shell, tokens, order sets, variants, copy picks, classmap hash, per-page word counts, headings tree, internal link graph, schema types present, image list with alt/dimensions, OG image presence. The audit reads these across all sites to enforce:

- Shell + tokens unique within niche; shell + tokens + nav set unique portfolio-wide
- Class-map overlap ≤ 20% between any two sites
- No two sites in a niche with identical H2 sequence on any page type
- Disclosure present, one of the four approved sentences
- Phone `tel:` link in header and sticky bar on every page
- No outbound link to any `sites.csv` domain

## 11. Acceptance criteria for `template/` (Phase 4 build)

1. `SITE=<slug> npm run build` produces a complete static site for any of the 18 `site.yaml` files with placeholder content and passes `rr-seo-audit` structural checks.
2. All four shells render all seven page types (home, service, town, cost_guide, guide, faq, tool) plus about, contact, privacy, thank-you, 404.
3. Every section has its listed variants and each is reachable by config.
4. Resolver persists seed picks into `site.yaml`/`classmap.json`; re-running changes nothing.
5. Lighthouse mobile ≥ 90 on the empty template (headroom for content and images).
6. Tool islands for all 8 niches work with JS, and the page still renders meaningful copy and the CTA with JS disabled.
7. Lead form posts to the Pages Function and arrives via Resend in a local test.
8. `_audit.json` emitted per build with every field in §10.
9. Two sites in the same niche built side by side produce HTML with no identical `<section>` subtrees other than the form and sticky bar.
