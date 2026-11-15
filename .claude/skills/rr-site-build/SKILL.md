# rr-site-build

**Purpose:** Scaffold content directories for all Gate-1 sites with frontmatter-only markdown files.

## Inputs

- `sites/ASSIGNMENTS.md` — proposed brands per site (operator must assign a brand in `site.yaml` before running)
- `niches/<niche>/pack.yaml` — page outlines with `h2_variants` and section structure
- `sites/<slug>/site.yaml` — pages array, brand, city, state, towns

## Outputs

- `sites/<slug>/site.yaml` — titles updated from `| TBD` to `| <brand>`
- `sites/<slug>/content/<filename>.md` — one per page, frontmatter only (no body prose), status: draft

Each scaffold file contains:
- Frontmatter: title, meta_description, h1, primary_keyword, type, status, updated, word_count_target, sections (h2s picked from h2_variants + h3s from pack), sources: [], faqs: [], town_facts: []
- Tool pages additionally get: schema, figures: []
- FAQ pages additionally get: schema
- Empty body (no prose — that is `rr-content`'s job)

## Tools

```bash
# One site
node scripts/site-build.mjs <slug>

# All 18 sites
node scripts/site-build.mjs --all

# Preview without writing
node scripts/site-build.mjs --dry-run [slug]
node scripts/site-build.mjs --dry-run --all
```

## Workflow

1. Check that the target site(s) have `brand` set in `site.yaml` (not `TBD`). If TBD, tell the operator to assign a brand from the proposed brands table in `sites/ASSIGNMENTS.md`.
2. Run `--dry-run` first to preview what will be created.
3. Run without `--dry-run` to scaffold.
4. Verify: correct file count, brand in titles, H2 variants used, no duplicate primary_keyword within a site.

## Guardrails

- **Refuses if brand is TBD** — the operator must assign a brand first from `sites/ASSIGNMENTS.md` proposed brands. Brand verification (domain availability, USPTO, state registry) is the operator's responsibility.
- **Never writes body prose** — scaffold produces frontmatter only. Body prose is `rr-content`'s job.
- **Never overwrites existing content files** — idempotent. Re-running skips files that already exist.
- **Never buys domains or phone numbers** — no purchases of any kind.
- **No fake claims** — titles and meta descriptions come from the page definitions in site.yaml, not invented.

## H2 Variant Selection

Each section's H2 is deterministically picked from `h2_variants` using a hash of `siteSlug:pageType:sectionIndex`. Same site always gets the same H2; different sites in the same niche get different variants. This avoids near-duplicate heading structures across the portfolio.

## File Naming Convention

`pageSlugToFilename()` converts page slugs to content filenames:
- `/` → `home`
- `/garage-floor-epoxy/` → `garage-floor-epoxy`
- `/areas/san-marcos/` → `areas-san-marcos`
- `/guides/topic-slug/` → `guides-topic-slug`

This matches `template/src/lib/content.ts` for template routing.
