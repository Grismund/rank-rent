# Ranking Playbook

How a site goes from "passes the audit" to "actually ranks." `seo-standards.md` and `content-rules.md` define the floor every page must clear; this file defines what separates a site that ranks from one that merely validates. `rr-site-build`, `rr-content`, `rr-seo-audit`, `rr-links`, and `rr-weekly-review` reference this file — do not hardcode these rules inline.

Ordered by expected impact on rankings.

## 1. Portfolio footprint (highest risk, highest priority)

18 sites across 8 niches generated from shared packs, one template, one Cloudflare account is the exact pattern Google's scaled-content and site-reputation systems target. Every rule below is enforced by `rr-seo-audit` at the portfolio level, not per site.

### Brand
- Every site has a real, distinct brand name before any content is written. `brand: TBD` blocks `rr-content`.
- Brand names must not share a pattern across sites (no "X Pros", "Y Pros", "Z Pros" series). Mix forms: place-led, service-led, and invented names.
- Brand appears in titles, footer, Organization schema, and OG image.

### Template variation
- One Astro template, **four layout shells** (A–D) plus section-component variants, section-order sets, copy banks, heading variants, and a per-site class-name map. Full spec: `template-architecture.md`; per-site picks: `sites/ASSIGNMENTS.md`. `site.yaml` declares `design.shell: A|B|C|D`.
- Two per-niche token sets (`niche-design-specs.md`); per-site overrides allowed.
- Two sites in the same niche must not share shell **and** token set; same-city sites in different niches must not share a shell.
- Nav labels, CTA copy, and H2 phrasings vary per site — these come from `site.yaml` / pack `h2_variants`, not the template.

### Cross-site content independence
- `rr-seo-audit` compares every page against every page in the **same niche across all sites**. Flag any pair above **0.60** similarity (shingle or embedding); fail above **0.75**.
- Shared pack outlines define *structure*, not sentences. `rr-content` must never reuse a paragraph across sites; cost ranges and process steps are re-expressed per site.
- No reciprocal or one-way links between any two portfolio sites. Ever. Audit fails on any outbound link to another `sites.csv` domain.

### Launch cadence
- Deploy **3–4 sites per week**, never the full batch in one day.
- Stagger by niche: do not launch two sites in the same niche in the same week.
- Each site gets its own Search Console property and Bing property; no shared verification tokens.

## 2. Town pages that survive doorway-page review

Town pages carry the most ranking upside and the most classification risk. The 3-fact minimum in `content-rules.md` is a floor; this is the design.

Each town page must contain, in addition to the content-rules minimums:
- **Permit section**: whether the service needs a permit in that jurisdiction, the office that issues it, and a source link. If no permit is required, say so and cite it.
- **HOA / land-use note** where relevant (planned communities vs. unincorporated land, deed-restriction prevalence).
- **Sub-service emphasis**: which 1–2 sub-services the town skews toward and why (housing age, lot sizes, climate exposure, commercial density). Link to those sub-service pages.
- **Service logistics**: distance / typical response from the hub city; nearby neighborhoods and corridors by name.
- **Town-specific cost note** if the niche brief or local facts show a real difference (older housing stock, permit fees, access constraints). Otherwise omit; do not invent variance.
- At least one unique paragraph per town that could not be moved to another town page and still be true.

Town selection: if the local-facts sheet cannot support the above, **cut the town**. Four defensible town pages beat six thin ones. `rr-keywords` should prefer towns with measured volume *and* a complete facts sheet.

## 3. One interactive tool per site

Every site ships with one tool, built as an Astro island (client-side only, no backend, no third-party embed). Tools are the strongest differentiator against competitors' brochure sites and the most linkable page on the site.

Rules:
- The tool lives on its own page with its own target keyword (e.g. `/cost-calculator/` → "window tinting cost calculator conroe"). The tool page is in the sitemap and the page plan.
- Inputs are seeded from the niche brief's cost ranges and sub-service list; outputs are **ranges**, never a single price, with a "costs vary by contractor" note.
- Every result ends with the click-to-call CTA and the form.
- Tool types by niche are defined in `pack.yaml` under `tool:` — e.g. cost estimator, square-footage / volume estimator, permit-needed checker, legal-limit lookup (window tint VLT), job-size classifier (junk removal load estimator), material comparison.
- Tool pages carry `WebApplication` or `SoftwareApplication` schema plus `FAQPage` for the questions the tool answers.
- Tool must be fully usable on mobile with no horizontal scroll; Lighthouse 80+ still applies.
- The tool page is the primary target for outreach in `rr-links` (see §8).

## 4. Trust signals without fabricated claims

Banned claims stay banned (`content-rules.md`). Trust comes from transparency instead:
- **About / How It Works** page names the operating entity (Vantabox LLC), explains the lead-connection model plainly, and describes how contractors are matched.
- **Cost guides** cite sources (manufacturer pricing, permit fee schedules, published cost surveys) with links. Each guide has a visible "Last updated" date that `rr-weekly-review` can bump when data changes.
- **Editorial note** on guides and FAQ: how the content was researched; no fake author personas or stock headshots.
- Footer disclosure on every page: "We connect homeowners with independent local contractors."
- Privacy policy and contact page with a working form (Resend) and the tracking number.

## 5. Structured data

In addition to `Service` and `FAQPage` (per `seo-standards.md`):
- `Organization` (the site brand, with `parentOrganization` optional) on every page via the layout. **Never** `LocalBusiness`.
- `WebSite` with `name` and `url` on the home page.
- `BreadcrumbList` on every page below home, matching visible breadcrumbs.
- `WebApplication` on the tool page.
- `HowTo` on process-oriented guide pages where the content is actually step-by-step.
- All schema generated from `site.yaml` fields; validated in `rr-seo-audit` against Google's Rich Results Test or `schema-dts` type checks.

## 6. Images

Image search is real traffic in remodel, flooring, and tinting niches, and image-less pages read as thin.
- Each `pack.yaml` defines an image set per sub-service (licensed or generated), stored in `template/public/img/<niche>/`. Operator photos replace them when available but do not block launch.
- Every image: descriptive filename including service and town where relevant (`epoxy-garage-floor-new-braunfels-flake.avif`), alt text that describes the image and includes the page's target phrase once at most, AVIF with WebP fallback, `loading="lazy"` below the fold, explicit width/height.
- One generated OG image per page (brand + H1) at 1200×630.
- Hero image is the only above-the-fold image; preload it.
- No stock watermarks, no text-in-image for key content.

## 7. Technical additions to the standard

Enforced by `rr-seo-audit` on top of `seo-standards.md`:
- Visible breadcrumbs + `BreadcrumbList` on every non-home page.
- Sticky mobile call bar (`tel:` link) in addition to the header number.
- Sitemap `lastmod` reflects the page's real last content change (from git or `site.yaml`), not build time.
- IndexNow ping on **every** deploy for changed URLs, not only at launch.
- Lighthouse CI run in the audit: Performance, Accessibility, Best Practices, SEO all ≥ 80 on mobile. Numbers recorded in the audit report.
- 404 page with nav and the phone number; no soft-404s.
- `robots.txt` references the sitemap; `/thank-you/` and `/privacy/` are `noindex`.
- No third-party scripts other than call tracking; no cookie banners needed because no tracking cookies are set.

## 8. Links

Baseline is the copycat method in `rr-links` (backlinks of 10 sites ranking for the same service in other cities, sorted into self-serve targets). Layer on top:
- **Tool-page outreach**: pitch the tool page, not the home page, to local blogs, neighborhood groups, and news sites. It is the only page a third party has a reason to cite.
- **Niche directories** relevant to the service (not general web directories).
- **Local chambers of commerce** for the hub city: a membership is typically $100–300/yr and yields a real, local, editorially-controlled citation. Budget one per site once a site shows impressions.
- **Cost-guide citations**: guides with sourced numbers get picked up by local writers; include a short "cite this page" line.
- No PBNs, no paid link packages, no links from other portfolio sites.
- `data/links.csv` tracks target, type, status, date, and the page linked to.

## 9. Keyword targeting without a map pack

These sites have no address and no Google Business Profile, so they compete organically only.
- `rr-keywords` prefers phrases where validation data shows the map pack absent, below the fold, or dominated by out-of-area listings.
- Informational and commercial-investigation phrases (cost, "how long does", "is it worth it", "vs", "near me" variants that return organic) are first-class targets, not afterthoughts. They are where guides and the tool page rank.
- Each site's page plan includes at least **two** informational pages beyond the cost guide and FAQ at launch, drawn from `pack.yaml` `guide_topics`.

## 10. Growth after launch

Launch at 10–15 pages; rankings come from pages added in months 2–6 from real query data.
- Template reserves `/guides/` for new content.
- `rr-weekly-review` reads Search Console per site and proposes **one new page per site per week**, chosen from queries with impressions but no page targeting them (≥ 20 impressions, position > 15, no existing page with that primary keyword).
- Proposed pages go through `rr-content` and `rr-seo-audit` like any other page; the operator approves before publish.
- Existing pages get a refresh pass when their primary keyword drops more than 5 positions over 4 weeks: update facts, expand the weakest section, bump "Last updated."
- Kill rule stays: no impressions by month 6 → operator decides whether to kill.

## 11. Conversion

Ranking only matters if the call happens.
- Phone in header, sticky mobile bar, and a CTA block after every major section.
- Form: name, phone, town, short description. Nothing else. Submits via Resend; success page is `noindex`.
- Honest expectation-setting on the form and CTA ("a local contractor will call you") — this is both a trust signal and a complaint-prevention measure.
- Call tracking number per site; `rr-weekly-review` reports calls alongside impressions so page additions can be judged by leads, not just traffic.

## Audit checklist additions

`rr-seo-audit` gains these checks, each pass/fail, portfolio-aware where noted:

| Check | Scope | Fail condition |
|-------|-------|----------------|
| Brand set | site | `brand` missing or `TBD` |
| Shell + token uniqueness | niche | two sites share shell and token set |
| Shell uniqueness per city | portfolio | two sites in one city share a shell |
| Class-map overlap | portfolio | any two sites share > 20% of class-map values |
| H2 sequence uniqueness | niche | two sites share an identical H2 sequence on any page type |
| Cross-site similarity | niche | any page pair > 0.75 |
| Cross-site similarity warning | niche | any page pair > 0.60 (warn) |
| Portfolio links | portfolio | any link to another `sites.csv` domain |
| Town page completeness | page | missing permit section or unique paragraph |
| Tool page present | site | no page with `type: tool` |
| Schema set | page | missing Organization / BreadcrumbList; LocalBusiness present |
| Image hygiene | page | missing alt, missing dimensions, non-AVIF/WebP, generic filename |
| OG image | page | missing or wrong size |
| Lighthouse | site | any category < 80 mobile |
| Sitemap lastmod | site | all `lastmod` equal to build time |
| Informational pages | site | fewer than 2 beyond cost guide + FAQ |
| Sticky call bar | site | absent on mobile viewport |
| Launch cadence | portfolio | > 4 sites deployed in 7 days, or 2 same-niche in 7 days |
