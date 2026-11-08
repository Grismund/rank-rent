# rank-rent

AI-powered rank-and-rent SEO system. Claude runs 19 skills across eight stages to research niches, buy domains, build sites, launch them, and prepare pitch materials — while the operator holds three gates: what to buy, what goes live, and who rents it.

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
  data/
    candidates.csv                  every niche × area scored
    counties.csv                    109 high-growth US counties (8%+ pop growth since 2020)
    sites.csv                       domain, registrar, renewal, number, status, client
    buyers.csv                      renters per niche and area
    links.csv                       backlink targets and status
  lib/                              shared business logic (scoring, candidates, trends, etc.)
  scripts/                          operational scripts (dashboard, validation, teardown, etc.)
  tests/                            vitest unit tests (1:1 with lib/)
  research/
    <niche>-<area>/                 validation data, teardown per candidate
    dashboard.html                  generated research dashboard
    shortlist-*.md                  generated shortlists
  template/                         shared Astro site template (Phase 4)
  sites/<domain>/site.yaml          niche, towns, phone, page plan (Phase 4)
  workers/call-router/              tracking-number Cloudflare Worker (Phase 5)
  docs/                             connectivity report, master workflow (original planning doc, may be stale)
```

## Skill conventions

Skills live at `.claude/skills/rr-<name>/SKILL.md`. The `rr-` prefix is mandatory.

### Naming

| Phase | Skills |
|-------|--------|
| 1 | `rr-smoke-test` |
| 2 | `rr-volume-scan`, `rr-validate`, `rr-teardown`, `rr-viability`, `rr-shortlist` [^1] |
| 3 | `rr-niche-brief`, `rr-local-facts`, `rr-keywords`, `rr-renters` |
| 4 | `rr-domains`, `rr-phone`, `rr-site-build`, `rr-content`, `rr-seo-audit` |
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

> **Current status:** Phase 2 skills built and tested. Volume scanning and validation run across southern cities. County-level scanning added (`scripts/county-scan.mjs`) targeting 109 high-growth US counties. Shortlist generated for Permian Basin (`research/shortlist-2026-11-02.md`). Awaiting Gate 1 decision and/or expanded research.

### Pipeline overview

```
  Volume Scan ──→ Validate ──→ Teardown ──→ Viability ──→ Shortlist ──→ ◆ GATE 1
  (discover)      (score 8)     (score 11+)  (economics)   (memo)       (operator picks winners)
       │               │             │             │             │
       ▼               ▼             ▼             ▼             ▼
  candidates.csv  validation-   teardown.md  viability.md   shortlist-
  status=          data.json    backlink-    status=         YYYY-MM-DD.md
  discovered                    sources.json viable

  ◆ GATE 1 ──→ Niche Brief ──→ Local Facts ──→ Keywords ──→ Renters
                    │               │              │            │
                    ▼               ▼              ▼            ▼
              niches/<n>.md    areas/<t>.md    site.yaml    buyers.csv

  ──→ Domains ──→ Phone ──→ Site Build ──→ Content ──→ SEO Audit ──→ ◆ GATE 2
       │            │           │             │            │
       ▼            ▼           ▼             ▼            ▼
   sites.csv    sites.csv   site files    page content  pass/fail

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
| 3 | `rr-niche-brief`, `rr-local-facts`, `rr-keywords`, `rr-renters` | NOT BUILT | Niche/town research, page plans, buyer lists |
| 4 | `rr-domains`, `rr-phone`, `rr-site-build`, `rr-content`, `rr-seo-audit` | NOT BUILT | Registered domains, sites, content, audit reports |
| 5 | `rr-deploy`, `rr-index`, `rr-links`, `rr-weekly-review`, `rr-pitch-prep`, `rr-route` | NOT BUILT | Live sites, backlinks, review reports, pitch materials |

### Gates

- **Gate 1** — Which candidates to buy domains/numbers for (after shortlist)
- **Gate 2** — Which sites to deploy (after SEO audit passes)
- **Gate 3** — Who rents each site (operator makes sales calls)

### Candidate status lifecycle

```
discovered → validated (score ≥8) → torn_down (score ≥11) → viable (economics pass) → shortlisted
                ↘ walk_away (score <8)    ↘ walk_away (SKIP)       ↘ walk_away (economics fail)
```

## Data model

- **CSV** files in `data/` are the source of truth for candidates, sites, buyers, and links. Currently `candidates.csv` and `counties.csv` exist; `sites.csv`, `buyers.csv`, and `links.csv` are defined for Phase 3+.
- **`counties.csv`** holds 109 high-growth US counties (8%+ population growth since 2020) used by `scripts/county-scan.mjs` for county-level volume scanning. Columns: `county, state, pop_2026, pop_2020, growth_pct`.
- **YAML** (`sites/<domain>/site.yaml`) holds per-site config: niche, towns served, phone number, and the page plan.
- **Markdown** in `research/` holds research output (niche briefs, town fact sheets, teardowns, shortlists).
- **Reference docs** in `reference/` hold shared scoring rubrics and content standards that skills import.

`data/sites.csv` columns: site, niche, area, domain, registrar, renewal date, tracking number, forwarding target, launch date, first impression, first call, monthly calls, client, price, start date, payment status.

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

Skills must reference these files, not hardcode standards inline.

## Testing

Business logic follows TDD (RED-GREEN-REFACTOR) per the global CLAUDE.md. Unit tests use **vitest** (`npm test`). Test files live in `tests/` with 1:1 correspondence to `lib/` modules.

**Integration testing** uses the Phase 1 connectivity report (`docs/connectivity-report.md`): one sample query per API, pass/fail per row, under $0.10 of DataForSEO credit, nothing purchased.

## Git conventions

- **Branch naming**: `phase-<N>/<skill-name>` (e.g., `phase-2/rr-discover`)
- **Commits**: imperative mood, scope prefix when useful (e.g., `add rr-validate skill`, `fix teardown backlink scoring`)
- **Main branch**: `master`
- Do not commit `.env` files, service-account JSON keys, or `node_modules/`.
