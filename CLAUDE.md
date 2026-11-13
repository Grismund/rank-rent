# rank-rent

AI-powered rank-and-rent SEO system. Claude runs 20 skills across eight stages to research niches, build sites, buy domains, launch them, and prepare pitch materials — while the operator holds three gates: what to build, what goes live, and who rents it.

## Repo layout

```
rank-rent/
  .claude/skills/rr-*/SKILL.md     one skill per folder
  reference/
    rubric.md                       8-signal scoring, thresholds
    seo-standards.md                page structure, headings, keyword alignment
    content-rules.md                word counts, local-fact minimums, banned claims
    naming-rules.md                 domain naming conventions
    niche-economics.md              avg job values + margins per niche
    site-design.md                  brand-first design principles, page inventory
    ranking-playbook.md             what ranks beyond the floor: portfolio footprint, town depth, tools, links, growth
    template-architecture.md        spec for template/: shells, variants, orders, copy banks, seed, classmap, site.yaml schema
    niche-design-specs.md           per-niche token sets, imagery, interactive tool, guide topics
  data/
    candidates.csv                  every niche × area scored
    counties.csv                    109 high-growth US counties (8%+ pop growth since 2020)
    cities.csv                      59 high-growth US cities (population growth leaders)
    sites.csv                       domain, registrar, renewal, number, status, client
    buyers.csv                      renters per niche and area
    links.csv                       backlink targets and status
  lib/                              shared business logic (scoring, candidates, trends, renters, etc.)
  scripts/                          operational scripts (dashboard, validation, enrichment, etc.)
  tests/                            vitest unit tests (1:1 with lib/, 20 test files)
  research/
    <niche>-<area>/                 validation data, teardown per candidate
    dashboard.html                  generated research dashboard
    shortlist-*.md                  generated shortlists
  niches/<niche>/pack.yaml           niche content pack (sub-services, outlines, local vars)
  template/                         shared Astro site template (Phase 4)
  sites/ASSIGNMENTS.md             per-site shell/tokens/orders/copy/wave + proposed brands (Phase 4 input)
  sites/<domain>/site.yaml          niche, brand, design, copy, tool, towns, phone, page plan
  sites/<domain>/content/*.md       per-page content with frontmatter (Phase 4)
  workers/call-router/              tracking-number Cloudflare Worker (Phase 5)
  docs/                             connectivity report, master workflow (may be stale), phase-4-build-plan.md (current build order)
```

## Skill conventions

Skills live at `.claude/skills/rr-<name>/SKILL.md`. The `rr-` prefix is mandatory.

### Naming

| Phase | Skills |
|-------|--------|
| 1 | `rr-smoke-test` |
| 2 | `rr-volume-scan`, `rr-validate`, `rr-teardown`, `rr-viability`, `rr-shortlist` [^1] |
| 3 | `rr-niche-pack`, `rr-niche-brief`, `rr-local-facts`, `rr-keywords`, `rr-renters` |
| 4 | `rr-site-build`, `rr-content`, `rr-seo-audit`, `rr-domains`, `rr-phone` |
| 5 | `rr-deploy`, `rr-index`, `rr-links`, `rr-weekly-review`, `rr-pitch-prep`, `rr-route` |

[^1]: `rr-discover` is deprecated — `rr-volume-scan` replaced it with batch keyword volume lookups. `rr-viability` was added between teardown and shortlist to check unit economics.

### Structure

Each SKILL.md should specify:
- **Purpose** — one sentence
- **Inputs** — files or arguments it reads
- **Outputs** — files it writes or modifies
- **Tools** — APIs or CLIs it calls
- **Guardrails** — cost gates, approval requirements, forbidden actions

## Workflow

> **Current status:** Phase 3 substantially complete. 18 candidates approved at Gate 1 across 8 niches. Niche packs (8), niche briefs, local facts, keywords (18 site.yaml files), and renters (540 buyers in `buyers.csv`) all done. Enrichment pipeline active: GBP contact enrichment and website scraping for emails/owner names. Pipeline reordered: domains/phones moved to end of Phase 4 (after SEO audit, before Gate 2).

### Pipeline overview

```
  Volume Scan ──→ Validate ──→ Teardown ──→ Viability ──→ Shortlist ──→ ◆ GATE 1
  (discover)      (score 8)     (score 11+)  (economics)   (memo)       (operator picks winners)
       │               │             │             │             │
       ▼               ▼             ▼             ▼             ▼
  candidates.csv  validation-   teardown.md  viability.md   shortlist-
  status=          data.json    backlink-    status=         YYYY-MM-DD.md
  discovered                    sources.json viable

  ◆ GATE 1 ──→ Niche Pack ──→ Niche Brief ──→ Local Facts ──→ Keywords ──→ Renters
                    │               │               │              │            │
                    ▼               ▼               ▼              ▼            ▼
              niches/<n>/      niches/<n>.md    areas/<t>.md    site.yaml    buyers.csv
              pack.yaml

  ──→ Site Build ──→ Content ──→ SEO Audit ──→ Domains ──→ Phone ──→ ◆ GATE 2
       │               │            │             │           │
       ▼               ▼            ▼             ▼           ▼
   site files      page content  pass/fail     sites.csv   sites.csv

  ◆ GATE 2 ──→ Deploy ──→ Index ──→ Links ──→ Weekly Review ──→ Pitch Prep ──→ Route
                                                                                  │
                                                                            ◆ GATE 3
                                                                      (operator sells)
```

### Phase summary

| Phase | Skills | Status | Produces |
|-------|--------|--------|----------|
| 1 | `rr-smoke-test` | DONE | `docs/connectivity-report.md` |
| 2 | `rr-volume-scan`, `rr-validate`, `rr-teardown`, `rr-viability`, `rr-shortlist` | DONE | `candidates.csv`, validation data, teardowns, viability reports, shortlist memo |
| 3 | `rr-niche-pack`, `rr-niche-brief`, `rr-local-facts`, `rr-keywords`, `rr-renters` | DONE | Niche packs (8), briefs, local facts, 18 site.yaml page plans, 540 buyers in `buyers.csv` |
| 4 | `rr-site-build`, `rr-content`, `rr-seo-audit`, `rr-domains`, `rr-phone` | SPECCED — see `docs/phase-4-build-plan.md` | `template/`, sites, content, audit reports, registered domains |
| 5 | `rr-deploy`, `rr-index`, `rr-links`, `rr-weekly-review`, `rr-pitch-prep`, `rr-route` | NOT BUILT | Live sites, backlinks, review reports, pitch materials |

### Gates

- **Gate 1** — Which candidates to build sites for (after shortlist)
- **Gate 2** — Which sites to purchase domains/numbers for and deploy (after SEO audit passes)
- **Gate 3** — Who rents each site (operator makes sales calls)

### Candidate status lifecycle

```
discovered → validated (score ≥8) → torn_down (score ≥11) → viable (economics pass) → shortlisted
                ↘ walk_away (score <8)    ↘ walk_away (SKIP)       ↘ walk_away (economics fail)

shortlisted → ◆ GATE 1 → packed → briefed → content_ready → audited → ◆ GATE 2 → purchased → deployed
```

## Data model

- **CSV** files in `data/` are the source of truth for candidates, sites, buyers, and links. Currently `candidates.csv`, `counties.csv`, `cities.csv`, and `buyers.csv` exist; `sites.csv` and `links.csv` are defined for Phase 4+.
- **`counties.csv`** holds 109 high-growth US counties (8%+ population growth since 2020) used by `scripts/county-scan.mjs` for county-level volume scanning. Columns: `county, state, pop_2026, pop_2020, growth_pct`.
- **`cities.csv`** holds 59 high-growth US cities used by `scripts/city-scan.mjs` for city-level volume scanning. Columns: `city, state, pop_2026, pop_2020, growth_pct`.
- **YAML** (`niches/<niche>/pack.yaml`) holds per-niche content packs: sub-services, page outlines with heading structures, guide topics, and local variable definitions with research questions. One pack per niche, shared across all cities.
- **YAML** (`sites/<domain>/site.yaml`) holds per-site config: niche, towns served, phone number, and the page plan.
- **Markdown** in `research/` holds research output (niche briefs, town fact sheets, teardowns, shortlists).
- **Reference docs** in `reference/` hold shared scoring rubrics and content standards that skills import.

`data/sites.csv` columns: site, niche, area, domain, registrar, renewal date, tracking number, forwarding target, launch date, first impression, first call, monthly calls, client, price, start date, payment status.

`data/buyers.csv` columns: candidate_slug, business_name, phone, website, domain, address, city, state, rating, review_count, is_claimed, source, has_website, website_weakness, fb_presence, pitch_priority, notes, researched_date, owner_name, owner_name_source, email, email_source, phone_source, website_source, enriched_date.

### Buyer enrichment pipeline

Buyers in `buyers.csv` are enriched in multiple passes, each adding contact details with source attribution:

| Pass | Script | Source tag | What it finds |
|------|--------|------------|---------------|
| 1 | `scripts/enrich-contacts.mjs` | `GBP` | Re-queries DataForSEO Business Listings `contact_info` for emails and extra phones |
| 2 | `scripts/enrich-websites.mjs` | `SITE` | Fetches buyer websites (homepage, /contact, /about pages) to extract emails and owner names |

Each contact field (`email`, `phone`, `owner_name`, `website`) has a companion `*_source` column tracking where it came from (`GBP`, `SITE`, `FB`). The `mergeContactData()` function in `lib/renters.js` implements first-wins merge — it never overwrites an existing value. The `enriched_date` column records when a row was last enrichment-attempted.

Key functions in `lib/renters.js` for enrichment:
- `extractEmailFromText(text)` — regex email extraction, filtering generic addresses (noreply, admin, sentry.io, etc.)
- `extractOwnerFromText(text)` — pattern matching for Owner/CEO/President/Founded by names
- `buildContactPageUrls(websiteUrl)` — generates homepage + /contact, /contact-us, /about, /about-us URLs
- `mergeContactData(row, newData)` — first-wins merge with source tracking
- `buildEnrichmentSummary(buyers)` — aggregates enrichment coverage stats

### Scripts

Operational scripts in `scripts/`:

| Script | Purpose |
|--------|---------|
| `build-dashboard.mjs` | Generates `research/dashboard.html` from all research data |
| `serve-dashboard.mjs` | Local dev server for the dashboard |
| `volume-scan.mjs` | Batch keyword volume lookups via DataForSEO |
| `city-scan.mjs` | City-level volume scanning using `cities.csv` |
| `county-scan.mjs` | County-level volume scanning using `counties.csv` |
| `validate-candidates.mjs` | Batch validation scoring |
| `validate-batch.mjs` | Batch validation with parallel processing |
| `validate-local.mjs` | Local-only validation |
| `revalidate-empty.mjs` | Re-validates candidates with missing data |
| `teardown.mjs` | Competitor teardown analysis |
| `viability.mjs` | Unit economics viability check |
| `shortlist.mjs` | Generates shortlist memos |
| `discover-niches.mjs` | Niche discovery via seed expansion |
| `local-discover.mjs` | Local keyword discovery |
| `generate-keywords.mjs` | Keyword generation for site plans |
| `enrich-contacts.mjs` | GBP contact enrichment (DataForSEO) |
| `enrich-websites.mjs` | Website scraping enrichment (emails, owner names) |
| `rescore-candidates.mjs` | Re-scores candidates after data changes |
| `verify-data.mjs` | Data integrity verification |

## API integrations

All keys live in `~/.config/rank-rent/.env`. **Never commit, print, or log API keys.**

| Service | Env vars | Purpose |
|---------|----------|---------|
| DataForSEO | `DATAFORSEO_USERNAME`, `DATAFORSEO_PASSWORD` | Keyword volumes, SERP data, Maps, backlinks |
| Cloudflare | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Domain registration, DNS, Pages, Workers |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Local phone numbers, call routing |
| Google | `GOOGLE_APPLICATION_CREDENTIALS` (path to JSON), `GOOGLE_CLOUD_PROJECT`, `GSC_SERVICE_ACCOUNT_EMAIL` | Search Console, Site Verification |
| Bing | `BING_WEBMASTER_API_KEY` | Webmaster Tools, IndexNow |
| Resend | `RESEND_API_KEY` | Contact form emails |
| Porkbun | `PORKBUN_API_KEY`, `PORKBUN_SECRET_API_KEY` | Backup registrar |

The DataForSEO MCP server is configured in Claude Code and provides direct tool access. Other integrations use REST APIs or CLIs from within skills.

## Guardrails

These are non-negotiable:

1. **Purchase approval** — Never buy a domain or phone number without explicit user approval naming the exact items and total cost.
2. **Cost warnings** — Any research batch estimated over **$1** must show the cost and wait for approval before proceeding.
3. **Auto-renew** — Always enable auto-renew immediately after every domain purchase (Cloudflare defaults it to off).
4. **No fake claims** — Never invent years in business, licenses, crew sizes, reviews, or any other fabricated business details in site content.
5. **No LocalBusiness schema** — Sites do not represent a single business; never generate LocalBusiness structured data with a fake address.
6. **Deploy gate** — `rr-seo-audit` must pass before any site deploys. Failing sites cannot go live.
7. **Key security** — Keys stay in the env file. Skills never print, log, or commit them.
8. **Human-only tasks** — Account creation, CAPTCHAs, directory sign-ups, sales calls, and billing are always manual.

## SEO standards

Once created, the `reference/` files are the canonical source for:

- `rubric.md` — 8-signal scoring (pass at 11/16, walk away under 8)
- `seo-standards.md` — titles under 60 chars, exactly one H1 per page, keyword alignment, internal linking
- `content-rules.md` — home page 800-1,500 words; service/town pages 500-1,000; every town page uses at least 3 facts from its town sheet; no near-duplicate town pages
- `naming-rules.md` — service + area in the domain, .com first, no trademarks
- `site-design.md` — brand-first design, 10-15 pages per site, 3 template variants, mobile-first, Lighthouse 80+
- `ranking-playbook.md` — portfolio footprint rules (distinct brands, variant/palette uniqueness, cross-site similarity, no inter-site links, staggered launches), defensible town pages, one tool page per site, schema set, images, links, post-launch growth, and the portfolio-level audit checklist

- `template-architecture.md` — the `template/` spec: 4 shells, section variants, order sets, copy banks, `h2_variants`, seeded class map, extended `site.yaml` schema, `_audit.json`, acceptance criteria
- `niche-design-specs.md` — per niche: two token sets, imagery brief, tool definition, guide topics
- `sites/ASSIGNMENTS.md` — which site gets which shell/tokens/orders/copy, proposed brands (unverified), tool slugs, launch waves

Skills must reference these files, not hardcode standards inline. `rr-site-build`, `rr-content`, `rr-seo-audit`, `rr-links`, and `rr-weekly-review` all read `ranking-playbook.md`. Phase 4 work order lives in `docs/phase-4-build-plan.md`.

## Testing

Business logic follows TDD (RED-GREEN-REFACTOR) per the global CLAUDE.md. Unit tests use **vitest** (`npm test`). Test files live in `tests/` with 1:1 correspondence to `lib/` modules.

**Integration testing** uses the Phase 1 connectivity report (`docs/connectivity-report.md`): one sample query per API, pass/fail per row, under $0.10 of DataForSEO credit, nothing purchased.

## Git conventions

- **Branch naming**: `phase-<N>/<skill-name>` (e.g., `phase-2/rr-discover`)
- **Commits**: imperative mood, scope prefix when useful (e.g., `add rr-validate skill`, `fix teardown backlink scoring`)
- **Main branch**: `master`
- Do not commit `.env` files, service-account JSON keys, or `node_modules/`.
