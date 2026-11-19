# rr-seo-audit

**Purpose**: Build sites, validate HTML output, check figures, run portfolio-level uniqueness checks, and produce pass/fail reports. Gate 2 blocker — sites must pass before domain/phone purchase.

## Inputs

- `sites/<slug>/site.yaml` — niche, brand, design (shell, tokens, wave), pages, phone, domain
- `sites/<slug>/content/*.md` — page content (pre-audit layer)
- `sites/<slug>/figures/*.json` — data files backing inline SVG charts
- `template/` — Astro site template (built with `SITE=<slug> npm run build`)
- `sites/ASSIGNMENTS.md` — shell/token/wave assignments for portfolio checks
- `reference/ranking-playbook.md` — portfolio footprint rules, disclosure requirements, figure minimums

## Outputs

- `sites/<slug>/seo-audit-YYYY-MM-DD.md` — per-site audit report
- Console summary with PASS/FAIL per site and portfolio-level results
- Exit code 0 (all pass) or 1 (any fail)

## Tools

- `lib/seo-audit.js` — pure check functions (HTML extraction, per-page checks, per-site checks, portfolio checks)
- `lib/figure-schema.js` — figure JSON validation (reused)
- `lib/content-validator.js` — `detectNearDuplicateContent()` for cross-site similarity (reused)
- `scripts/seo-audit.mjs` — orchestration script

## Usage

```bash
node scripts/seo-audit.mjs <slug>              # audit one site
node scripts/seo-audit.mjs --all               # audit all 18 sites + portfolio checks
node scripts/seo-audit.mjs --portfolio-only    # portfolio checks on existing builds (no rebuild)
```

## Audit layers

| Layer | What it checks | Source |
|-------|---------------|--------|
| 1 | Content pre-audit (run separately via `content-audit.mjs`) | `lib/content-audit.js` |
| 2 | Astro build succeeds | `SITE=<slug> npm run build` |
| 3 | HTML: single H1, internal links resolve, JSON-LD valid (no LocalBusiness), disclosure present, phone in HTML, no inter-site links, canonical tag (when domain set) | `lib/seo-audit.js` |
| 4 | Figures: ≥3 per site, source.label non-empty, CSS variables only (no hex fills), schema valid | `lib/seo-audit.js` + `lib/figure-schema.js` |
| 5 | Portfolio: shell+token unique within niche, ≤4 per wave, no same-niche per wave, no identical figure series within niche, cross-site similarity < 0.75 | `lib/seo-audit.js` |
| 6 | Lighthouse (deferred — optional `--lighthouse` flag, not yet implemented) | — |
| 7 | Report generation + console output | `scripts/seo-audit.mjs` |

## Check functions in `lib/seo-audit.js`

### HTML extraction helpers
- `extractHrefs(html)` — all `<a href>` values
- `extractJsonLd(html)` — parsed JSON-LD blocks
- `extractVisibleText(html)` — stripped text (for similarity comparison)
- `extractSvgContent(html)` — SVG blocks
- `countH1Tags(html)` — count `<h1>` tags

### Per-page checks (each returns `{ pass, issues }`)
- `checkHtmlLinks(hrefs, distPaths)` — internal links resolve (normalizes double slashes)
- `checkSchemaJsonLd(jsonLd, pageType, brand)` — valid types, no LocalBusiness
- `checkDisclosure(html)` — disclosure with independent + contractor + Vantabox LLC
- `checkPhoneInHtml(html, phone)` — phone present (skips when null)
- `checkNoInterSiteLinks(hrefs, portfolioDomains)` — no cross-portfolio links
- `checkCanonicalTag(html)` — canonical present (skipped when domain is null)
- `checkSingleH1(html)` — exactly one H1

### Per-site checks
- `checkFigureMinimum(figures, pageTypes)` — ≥3 figures
- `checkFigureProvenance(figure)` — source.label non-empty
- `checkFigurePalette(svgText)` — no literal hex fills
- `checkToolConstancy(outputs)` — output varies across input matrix
- `checkBrandSet(brand)` — not null/TBD
- `checkToolPagePresent(pageTypes)` — tool page exists
- `checkInformationalPages(pages)` — ≥2 guide pages

### Portfolio checks
- `checkCrossSiteSimilarity(siteTexts)` — FAIL >0.75, WARN >0.60
- `checkShellTokenUniqueness(configs)` — no duplicate shell+token within niche
- `checkLaunchCadence(sites)` — ≤4 per wave, no same-niche per wave
- `checkClassmapOverlap(classmaps)` — overlap <20%
- `checkFigureDuplication(figureSeries)` — no identical series within niche

## Guardrails

1. **Gate 2 blocker** — Sites that fail cannot proceed to `rr-domains` or `rr-phone`.
2. **No LocalBusiness schema** — Fails any site with LocalBusiness JSON-LD.
3. **No inter-site links** — Fails any link to another portfolio domain.
4. **Figure provenance** — Every figure must cite a source. Numbers without sources are fake claims.
5. **Canonical tag deferred** — Canonical check runs only when `domain` is set in site.yaml (post-purchase).
6. **Lighthouse deferred** — Requires Chrome. Implement later with `--lighthouse` flag.
