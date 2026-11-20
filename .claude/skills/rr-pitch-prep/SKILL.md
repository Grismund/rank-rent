# rr-pitch-prep

**Purpose:** Match buyers from `buyers.csv` to their corresponding sites and generate pitch materials (match list, email templates, phone scripts) for the operator to use in Gate 3 sales outreach.

## Inputs

- `data/buyers.csv` — 540 enriched buyer records with contact info
- `data/sites.csv` — 18 site rows with niche, area, domain
- `sites/<slug>/site.yaml` — per-site config (brand, niche, city, pages)
- `sites/ASSIGNMENTS.md` — wave assignments for `--wave` filtering
- `reference/niche-economics.md` — average job values and margins per niche

## Outputs

- `data/matches.csv` — buyer-to-site match rows with fit scores
- Pitch templates to stdout (email subjects/bodies, phone scripts) when `--with-templates`

## Tools

None. Pure local data transformation — no API calls, no cost gates.

## Workflow

```
node scripts/pitch-prep.mjs                    # all sites
node scripts/pitch-prep.mjs <slug>             # one site
node scripts/pitch-prep.mjs --wave 1           # wave 1 sites
node scripts/pitch-prep.mjs --hot-only         # only hot-priority buyers
node scripts/pitch-prep.mjs --with-templates   # generate email + phone templates
```

1. Load buyers.csv, sites.csv, site.yaml configs, and niche-economics.md
2. Match each buyer to its site by `candidate_slug` → `site.slug` (with dot-normalization)
3. Score fit by pitch_priority (hot=3, warm=2, cold=1) + contact completeness (+1 each for email, phone, owner_name)
4. If `--hot-only`, filter to hot-priority buyers only
5. Group by site, sort by fit score descending
6. Write `data/matches.csv`
7. Print per-site summaries with match counts and projected rent values
8. If `--with-templates`, generate email and phone script for each hot/warm match

## Guardrails

- **No auto-outreach:** This skill generates materials only. The operator makes all sales calls and sends all emails manually
- **No fake claims:** Rent projections are labeled as estimates based on average job values, not guaranteed income
- **Projections labeled:** All dollar figures in templates use phrases like "estimate" or "projected" — never "guaranteed" or "you will earn"
- **No contact without data:** Templates use owner_name when available, fall back to business_name — never fabricate names
