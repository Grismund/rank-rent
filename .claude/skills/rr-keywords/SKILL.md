# rr-keywords

**Purpose:** Build keyword-targeted page plans for each site and write `sites/<placeholder>/site.yaml` files.

## Inputs

- `data/candidates.csv` — rows with `status=facts_gathered`
- `niches/<niche>/pack.yaml` — sub_services, page_outlines, guide_topics
- `research/areas/<city>.md` — nearby cities for town pages (### Nearby Cities section)
- `reference/seo-standards.md`, `reference/site-design.md`, `reference/naming-rules.md`

## Procedure

1. Parse candidates with `status=facts_gathered` from `data/candidates.csv`
2. Load each candidate's pack.yaml from `niches/<niche>/pack.yaml`
3. Load each candidate's local facts from `research/areas/<city-slug>.md`
4. Extract nearby towns from the `### Nearby Cities` section (first 4–5 entries, excluding the main city and cities 30+ miles away)
5. For each candidate, call `buildPagePlan(candidate, pack, nearbyTowns)` from `lib/keywords.js`
6. Run `validateSiteYaml(siteYaml, pack)` on each — all must pass
7. Present a summary table showing: site dir, niche, city, page count, service count, town count
8. Wait for operator approval
9. Write `sites/<niche-slug>-<city-slug>/site.yaml` for each candidate
10. Update `data/candidates.csv`: set `status=keywords_mapped` for each processed row

## Output

Each `sites/<placeholder>/site.yaml` contains:

```yaml
niche: <niche-slug>
display_name: <from pack.yaml>
city: <candidate area>
state: <extracted from region>
brand: TBD
phone: null
domain: null
towns:
  - <nearby town 1>
  - <nearby town 2>
  - ...
pages:
  - slug: /
    type: home
    primary_keyword: "<display_name> <city>" (lowercased)
    h1: "<from pack outline template>"
    title: "<from pack outline template>"
    meta_description_intent: "<generated intent>"
    word_count: { min: N, max: N }
  # ... service pages, town pages, cost_guide, faq
```

## Tools

- `lib/keywords.js` — `buildPagePlan()`, `validateSiteYaml()`, `extractStateFromRegion()`, `slugify()`
- `lib/candidates.js` — `parseCandidatesCsv()`, `serializeCandidatesCsv()`
- No external APIs — pure computation from existing data

## Guardrails

- **$0 cost** — no API calls, no web searches, pure computation
- No duplicate `primary_keyword` within any site
- All titles under 60 characters
- 10–15 pages per site
- Required page types: home, faq (plus cost_guide, and at least one service or town)
- Town pages reference only towns from the local facts nearby cities list
- Operator must approve the summary table before files are written
