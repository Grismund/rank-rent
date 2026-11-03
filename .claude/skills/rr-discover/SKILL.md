# rr-discover

> **DEPRECATED:** Superseded by `rr-volume-scan` (city mode). This skill wrote candidates without volume data, causing artificial walk_away rates in rr-validate. Use `rr-volume-scan` with target cities instead.

**Purpose:** Generate niche × town candidate pairs for a target metro region and write them to `data/candidates.csv`.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| Region | Yes | — | Metro area or region name (e.g., "DFW Metroplex", "Austin metro") |
| Exclusions | No | `[]` | Niches to exclude beyond the default licensed-trades filter |
| Population floor | No | `15000` | Minimum town population to include |

Parse these from the user's message. If the region is missing, ask for it.

## Procedure

1. **Identify towns in the region**
   - Web-search for cities/towns in the target region above the population floor
   - Record each town's name, approximate population, and county
   - Do not fabricate population figures — use census data or reliable sources

2. **Build the niche list**
   - Start from `HOME_SERVICE_NICHES` in `lib/constants.js`
   - Remove any niche where `isLicensedTrade(niche)` returns `true` (from `lib/candidates.js`)
   - Remove any user-specified exclusions

3. **Cross niche × town**
   - For each niche × town pair:
     - Generate slug via `generateSlug(niche, town)` from `lib/candidates.js`
     - Generate 5–10 search phrases via `generatePhrases(niche, town, state)` from `lib/candidates.js`
     - Set `license_barrier` to `none` (licensed trades already removed)
     - Check if the niche is franchise-dominated using `FRANCHISE_BRANDS` from `lib/constants.js` — if so, set `franchise_dominated=true`

4. **Filter**
   - Drop any candidate where `license_barrier=required`
   - Flag candidates with `franchise_dominated=true` as `status=walk_away`
   - All others get `status=discovered`

5. **Write to CSV**
   - Load existing `data/candidates.csv` if it exists (use `parseCandidatesCsv` from `lib/candidates.js`)
   - Skip any slug that already exists (idempotent)
   - Append new rows using `serializeCandidatesCsv` from `lib/candidates.js`
   - Score columns remain empty — `rr-validate` fills those
   - Create `data/` directory if it doesn't exist

6. **Create research directories**
   - For each new candidate, create `research/<slug>/` directory

7. **Print summary**
   - Total candidates generated
   - Total after filtering (excluding walk_away)
   - Breakdown by niche (count per niche)
   - Breakdown by town (count per town)

## Outputs

| Path | Description |
|------|-------------|
| `data/candidates.csv` | Appended with new rows, `status=discovered` |
| `research/<slug>/` | Empty directory per candidate |

## Tools

- **Web search** — to find towns in the region and their populations
- No paid API calls. This skill uses zero DataForSEO credit.

## Guardrails

- **Idempotent**: If a slug already exists in `candidates.csv`, skip it silently
- **No fabrication**: Never invent population numbers. If a town's population can't be confirmed, note it and use the best available estimate
- **No purchases**: This skill never buys anything
- **Cost**: $0 — web search only
