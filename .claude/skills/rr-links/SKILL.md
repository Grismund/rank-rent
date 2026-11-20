# rr-links

**Purpose:** Discover backlink prospects for rank-rent sites using the copycat method — find competitors in nearby cities, extract their referring domains, classify and filter for self-serve outreach targets.

## Inputs

- `data/sites.csv` — site slugs, niches, domains
- `data/links.csv` — existing prospect/link rows (append-only)
- `sites/<slug>/site.yaml` — page plan (for outreach page selection)
- `sites/ASSIGNMENTS.md` — wave assignments for `--wave` filtering
- `reference/ranking-playbook.md` — portfolio footprint rules (no inter-site links)

## Outputs

- `data/links.csv` — new prospect rows appended (never overwrites existing status)

## Tools

- **DataForSEO SERP API** (`/v3/serp/google/organic/live/regular`) — competitor discovery
- **DataForSEO Backlinks API** (`/v3/backlinks/referring_domains/live`) — referring domain extraction

## Workflow

```
node scripts/links.mjs <slug>              # one site
node scripts/links.mjs --wave 1            # one wave
node scripts/links.mjs --all               # all sites
node scripts/links.mjs --dry-run <slug>    # cost estimate only
```

1. Load target sites from CLI args
2. For each site, build SERP queries for the niche in nearby cities (same state preferred)
3. Extract unique competitor domains from organic results (excluding platforms, directories, portfolio)
4. Query DataForSEO Backlinks for each competitor's referring domains
5. Filter by rank ≥ 100, spam score ≤ 50, and live backlinks
6. Classify each domain: editorial, directory_niche, directory_local, chamber, local_news, or other
7. Deduplicate by target_url, keeping highest-rank entry
8. Merge with existing links.csv (never regress status)
9. Print per-site and overall summary

## Guardrails

- **Cost gate:** Batch estimated > $1 → show breakdown → wait for operator approval before proceeding
- **No PBN/link schemes:** Only discover naturally-occurring backlinks for outreach; never build, buy, or exchange links
- **No inter-portfolio links:** Portfolio domains are excluded from prospects via `isPortfolioLink()`
- **Operator handles outreach:** This skill only discovers targets. The operator manually contacts prospects, submits directory listings, and writes guest posts
- **Append-only merging:** `mergeProspects()` never overwrites or regresses an existing row's status (e.g., `linked` → `prospect`)
