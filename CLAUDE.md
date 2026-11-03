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
  data/
    candidates.csv                  every niche × area scored
    sites.csv                       domain, registrar, renewal, number, status, client
    buyers.csv                      renters per niche and area
    links.csv                       backlink targets and status
  research/
    niches/<niche>.md
    areas/<town>.md
    <candidate>/                    raw results, teardown
  template/                         shared Astro site template
  sites/<domain>/site.yaml          niche, towns, phone, page plan
  workers/call-router/              tracking-number Cloudflare Worker
  docs/                             connectivity report, workflow doc
```

## Skill conventions

Skills live at `.claude/skills/rr-<name>/SKILL.md`. The `rr-` prefix is mandatory.

### Naming

| Phase | Skills |
|-------|--------|
| 1 | `rr-smoke-test` |
| 2 | `rr-volume-scan`, ~~`rr-discover`~~ (deprecated), `rr-validate`, `rr-teardown`, `rr-shortlist` |
| 3 | `rr-niche-brief`, `rr-local-facts`, `rr-keywords`, `rr-renters` |
| 4 | `rr-domains`, `rr-phone`, `rr-site-build`, `rr-content`, `rr-seo-audit` |
| 5 | `rr-deploy`, `rr-index`, `rr-links`, `rr-weekly-review`, `rr-pitch-prep`, `rr-route` |

### Structure

Each SKILL.md should specify:
- **Purpose** — one sentence
- **Inputs** — files or arguments it reads
- **Outputs** — files it writes or modifies
- **Tools** — APIs or CLIs it calls
- **Guardrails** — cost gates, approval requirements, forbidden actions

## Data model

- **CSV** files in `data/` are the source of truth for candidates, sites, buyers, and links.
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

Business logic follows TDD (RED-GREEN-REFACTOR) per the global CLAUDE.md.

**Integration testing** uses the Phase 1 connectivity report (`docs/connectivity-report.md`): one sample query per API, pass/fail per row, under $0.10 of DataForSEO credit, nothing purchased.

## Git conventions

- **Branch naming**: `phase-<N>/<skill-name>` (e.g., `phase-2/rr-discover`)
- **Commits**: imperative mood, scope prefix when useful (e.g., `add rr-validate skill`, `fix teardown backlink scoring`)
- **Main branch**: `master`
- Do not commit `.env` files, service-account JSON keys, or `node_modules/`.
