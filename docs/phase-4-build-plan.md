# Phase 4 Build Plan

Ordered work for Claude Code to build `template/` and the Phase 4 skills from the specs. Each task names its spec sections and acceptance criteria. Work top to bottom; tasks within a numbered group can run in parallel.

Specs: `reference/template-architecture.md` (TA), `reference/niche-design-specs.md` (NDS), `reference/data-viz.md` (DV), `sites/ASSIGNMENTS.md` (ASG), `reference/ranking-playbook.md` (RP), `reference/seo-standards.md`, `reference/site-design.md`, `reference/content-rules.md`.

Conventions: TDD for everything in `lib/` and `template/src/lib/` (vitest). Branch `phase-4/<task>`. No domain or phone purchases in this phase. Nothing deploys.

---

## 0. Pack and plan prerequisites

### 0.1 Extend `pack.yaml` for all 8 niches
- Add `h2_variants` (3 phrasings) to every section of every page outline (TA §4.6). The first variant is the existing string.
- Add `tool:` block from NDS (type, default slug, inputs summary, data source note).
- Add `guide_topics` entries of `type: guide` from NDS (≥ 2 per niche) with `target_keyword`.
- Add `design: { tokens: [<niche>-1, <niche>-2], image_set: <niche> }`.
- Add a `guide` page outline (h1 template, sections with `h2_variants`, word count 600–1,500).
- Add a `tool` page outline per `content-rules.md` "Tool page" and a `cost_guide` outline per its "Cost guide" section (figure slot after the headline range).
- Add a `figures:` block from DV §6: for each of `tool`, `cost_guide`, and `guide`, the figure `id`, `form` (range-bars | side-by-side | segmented | line | stat), `categories[]`, `unit`, and `brief_section` the data comes from.
- **Accept:** `npm test` passes a new `tests/pack-schema.test.js` validating all 8 packs against a JSON schema in `lib/pack-schema.js`; every pack has ≥ 3 figures and its `tool` figure form is set.

### 0.2 Extend `lib/keywords.js` and `rr-keywords`
- `buildPagePlan()` adds the tool page (slug from ASG, keyword derived as "<service> cost calculator <city>" or the law-checker variant for tinting) and 2 guide pages per site.
- Cannibalization check between `/cost/` and the tool page.
- Regenerate all 18 `site.yaml` page lists; preserve existing town lists.
- **Accept:** 18 site.yaml files with 12–16 pages each, zero duplicate `primary_keyword`, all titles < 60 chars; `tests/keywords.test.js` covers tool + guide insertion.

### 0.3 Local-facts gap check for town pages
- Script `scripts/town-page-readiness.mjs`: for each site's towns, check `research/areas/<town>.md` has permit info, HOA/land-use note, neighborhoods, and distance to hub. Report towns that fail `content-rules.md` town steps 5–8.
- Operator decides per flagged town: research more (`rr-local-facts`) or cut.
- **Accept:** `research/town-readiness-<date>.md` report; no site has fewer than 3 ready towns.

---

## 1. Template foundation (`template/`)

### 1.1 Scaffold
- Astro 5 static project, Preact integration, `astro:assets`, fontsource fonts (4 pairings per TA §4.1), ESLint + Prettier.
- `scripts/build-site.mjs` (`SITE=<slug>`), `scripts/build-all.mjs`, `scripts/resolve-site.mjs`.
- **Accept:** `SITE=epoxy-flooring-orlando npm run build` emits `dist/` with a placeholder home page.

### 1.2 Resolver and seed
- `src/lib/seed.ts` (sha256 → PRNG), `src/lib/resolve-site.ts` (site.yaml + pack.yaml + ASSIGNMENTS.md → `SiteConfig`), persistence of seed picks back into `site.yaml` and `classmap.json` (TA §5, §8).
- `src/config/section-orders.ts`, `copy-banks.ts`, `classmap-vocab.ts` with the entries in TA §4.3–4.7.
- **Accept:** unit tests — determinism (same slug → same picks), persistence (second run is a no-op), ASG override beats seed, every bank has ≥ 4 entries, every classmap key has ≥ 3 candidates.

### 1.3 Base components
- `Head.astro` (title, description, canonical, OG, robots per page), `Schema.astro` + `schema.ts` (TA §7.4), `StickyCallBar.astro`, `SkipLink.astro`, `Breadcrumbs/` (3 separator variants).
- `og-image.ts`: brand + H1 → 1200×630 PNG at build.
- **Accept:** schema output validates with `schema-dts` types in tests; `LocalBusiness` is impossible to emit (test asserts). OG image generated per page.

### 1.4 Tokens
- 16 token CSS files from NDS; `tokens/base.css` with type scale and spacing computed from token variables.
- Contrast check script (`scripts/check-contrast.mjs`) for every set.
- **Accept:** all sets pass AA for text/bg, accent-text/accent, muted/bg (≥ 3:1 for muted).

---

## 2. Shells and sections

### 2.1 Four shells (TA §4.1)
- `ShellA–D.astro` with distinct DOM for header, hero, body wrapper, footer; hero accepts image or no-image (D).
- Mobile nav per shell (A/B/C: collapsible under 768px; D: hamburger always).
- **Accept:** each shell renders every page type with placeholder sections; the four shells' header/footer/hero `<section>` subtrees are structurally different (test compares tag sequences).

### 2.2 Section variants (TA §4.4)
- All listed variants for ServicesList, AreasServed, Process, TrustBlock, FAQ, CostTable, CTABand, ToolShell. `SectionRenderer.astro` switches on resolved variant.
- Prose sections render markdown split by `## ` from `content.ts`.
- **Accept:** a fixture site built once per variant combination in a test matrix (sampled) renders without missing sections; `TrustBlock` never renders rating/testimonial markup (test).

### 2.3 Pages
- `[...slug].astro`, `404.astro`, `sitemap.xml.ts` (real `lastmod` from frontmatter `updated`, excludes noindex), `robots.txt.ts`, about, contact, privacy, thank-you.
- Draft pages excluded from production builds and sitemap.
- **Accept:** builds for all 18 site.yaml files with placeholder content succeed; `rr-seo-audit` structural checks (once built, task 4.3) pass on the empty template; Lighthouse mobile ≥ 90 on home for all four shells.

---

## 3. Tools and forms

### 3.1 Tool islands (NDS)
- Eight Preact components in `src/components/tools/`: `epoxy-cost-estimator`, `bath-budget-estimator`, `tint-law-and-cost`, `load-size-estimator`, `kitchen-budget-estimator`, `surface-cost-estimator`, `pool-cost-estimator`, `paver-sealing-estimator`.
- Data tables as typed JSON next to each component with a header comment citing the brief section used. Tinting law table keyed by state from local facts (`tint_laws`).
- Output screen: range, notes, **the result figure from DV §6 drawn with `src/lib/figures.ts`** (the user's range against the typical range, or the parts of the total), phone CTA with `cta.primary`, link to form.
- Output must explain itself: which input moved the range and why (condition multiplier, extra-cost items, permit flag). Snapshot test the full input matrix and assert the output is not constant.
- No-JS fallback: copy explains what the tool estimates and shows the phone CTA.
- **Accept:** unit tests per tool for boundary inputs; output varies across the input matrix; result figure present with `aria-label`; bundle per tool < 15 KB gzipped including the figure code; usable at 360px wide; keyboard accessible; respects `prefers-reduced-motion`.

### 3.1a Figure primitives and `DataFigure` section (DV §3–5)
- `src/lib/figures.ts`: pure functions that take a figure data object and return SVG markup for `range-bars`, `dot-range`, `columns`, `side-by-side`, `segmented`, `line`, and a `stat` tile. Colors are CSS variables from the token set only (`--accent`, `--surface`, `--border`, `--text`, `--muted`); no literal hex.
- `src/components/sections/DataFigure/{range-bars,dot-range,columns}.astro`: wraps the SVG in `<figure>` + `<figcaption>`, `role="img"` + `aria-label`, source line, and a `<details>` "See the numbers" `<table>`. Reads `sites/<slug>/figures/<id>.json`; placed by `figures[]` in page frontmatter.
- `lib/figure-schema.js` validates data files (`title, unit, series[], source{label,url?,brief_section?}, updated`); shared by `rr-content` and `rr-seo-audit`.
- **Accept:** unit tests render every form from a fixture and assert: no client script, no `<canvas>`, no `<img>`, fills only from token variables, ≤ 6 categories, table rows equal series length; contrast script (1.4) extended to check mark-vs-background ≥ 3:1 on all 16 token sets; a fixture page renders at 360px with no horizontal scroll.

### 3.2 Lead form
- `functions/api/lead.ts` → Resend; honeypot field; rate limit by IP (Cloudflare KV optional); redirect to `/thank-you/`.
- **Accept:** local `wrangler pages dev` test delivers an email; invalid submissions return 400 without sending.

---

## 4. Phase 4 skills

### 4.1 `rr-site-build`
- Reads ASG + packs + site.yaml; writes `design`, `copy`, `tool`, `images` blocks; runs resolver; scaffolds `sites/<slug>/content/` with one frontmatter-only markdown file per page (h1, title, meta intent, primary_keyword, chosen H2s, section order, word-count targets, status: draft).
- Refuses if `brand` is `TBD`.
- **Accept:** running it on all 18 sites yields 18 content scaffolds; re-running changes nothing.

### 4.2 `rr-content`
- For each scaffold page, writes the body from the niche brief, town facts, and the chosen H2s per `content-rules.md`; cites sources in frontmatter `sources[]`; fills `faqs[]` on FAQ and tool pages; sets `updated`.
- Writes to the chosen H2 strings exactly; never reuses a paragraph across sites (keeps a per-niche paragraph hash set in `data/content-hashes.json`).
- Tool page copy and 2 guides per site included.
- Writes the site's figure data files to `sites/<slug>/figures/<id>.json` from the pack `figures:` block, pulling every number from the brief / `niche-economics.md` / facts sheet and recording the source; references each figure in the page's frontmatter `figures[]`; re-expresses ranges per site (rounding, units, category labels) so no two sites in a niche have identical series.
- **Accept:** all pages hit word counts; banned-claims scan passes; within-site and cross-site similarity under RP thresholds on a 2-site sample before running the full batch; every site has ≥ 3 valid figure files and the tool page and cost guide each reference one.

### 4.3 `rr-seo-audit`
- Builds the site, reads `dist/<slug>/_audit.json` and the HTML; runs every check in `seo-standards.md`, `content-rules.md`, and the RP checklist (portfolio-aware checks read all built sites).
- Lighthouse CI (mobile) per site; schema validation; link graph checks; image hygiene; disclosure sentence match; phone in header + sticky bar; cross-site similarity; classmap overlap; shell/token/nav uniqueness; launch-wave sanity.
- Figure checks from DV §7 (minimum, provenance, fallback, form, palette, contrast, numbers-match-copy, duplication) and the tool decision-aid check (RP §3) read from `_audit.json` `figures[]` and `tool`.
- Output `sites/<slug>/audit-<date>.md` with pass/fail per check and a single verdict; failing sites are marked `status: audit_failed` in site.yaml.
- **Accept:** deliberately broken fixtures (duplicate H1, LocalBusiness schema, TBD brand, inter-site link, > 0.75 similarity, a site with 2 figures, a figure with no `source`, a figure with a literal hex fill, a tool whose output is constant) each fail with the right check named.

### 4.4 `rr-domains` and `rr-phone` (unchanged scope from master workflow)
- Run only after audit passes; purchases gated on explicit approval naming items and total; auto-renew on.

---

## 5. Gate 2 package
- `rr-site-build` → `rr-content` → `rr-seo-audit` on Wave 1 sites first (ASG). Operator reviews content drafts and audit reports, approves pages (`status: approved`), then `rr-domains` / `rr-phone` for Wave 1 only.
- Remaining waves follow the same loop one week apart.

---

## Definition of done for Phase 4
- `template/` meets TA §11 acceptance criteria, including 6a (figures).
- Every site has a working tool whose result is drawn as a figure, and ≥ 3 sourced data figures with table fallbacks (DV §1).
- All 18 sites have real brands, resolved design blocks, complete content, and a passing audit report.
- Wave 1 domains and numbers purchased and recorded in `data/sites.csv`.
- `CLAUDE.md` phase table updated: Phase 4 DONE.
