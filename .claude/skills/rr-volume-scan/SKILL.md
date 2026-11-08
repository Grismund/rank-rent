# rr-volume-scan

**Purpose:** Discover high-value home service niches by querying national keyword volumes first, then checking local demand in target cities — inverting the usual "guess a niche, check volume" approach.

## Quick Start (City Mode)

```bash
node scripts/volume-scan.mjs "Houston" "Tulsa"                    # scan cities
node scripts/volume-scan.mjs "Abilene" --dry-run                  # preview without API calls
node scripts/volume-scan.mjs "Houston" --filter=junk\ removal     # specific niches only
node scripts/volume-scan.mjs "Midland" "Odessa" --region="Permian Basin"  # label region
```

Both modes are fully automated via scripts. Full mode uses `discover-niches.mjs` for seed expansion; city mode uses `volume-scan.mjs` for local volume checks.

## Mode Detection

Determine the mode from the user's message:

| Signal | Mode | What runs |
|--------|------|-----------|
| User provides cities only (no "full scan", no seed groups) | **City** | `node scripts/volume-scan.mjs` — fully automated |
| User says "full scan" or provides seed groups | **Full** | Pass 1 (`discover-niches.mjs`) + Pass 2 |
| Ambiguous | **City** (default) | `node scripts/volume-scan.mjs` |

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| Target cities | Yes | — | List of cities to check local volume |
| Mode | No | `city` | `full` to run Pass 1 seed expansion; `city` to use existing `DISCOVERED_NICHES` |
| Region label | No | — | Label for the region (e.g., "West Texas") used in summary output |
| Seed groups | No | `DISCOVERY_SEED_GROUPS` from `lib/constants.js` | Override the 5 default action-word seed arrays (Full mode only) |
| Niche filter | No | all | Subset of `DISCOVERED_NICHES` to check (City mode only, e.g., "just junk removal and pressure washing") |

Threshold defaults come from `VOLUME_SCAN_DEFAULTS` in `lib/constants.js`:

| Threshold | Constant key | Value |
|-----------|-------------|-------|
| National volume floor | `nationalVolumeFloor` | 1000 |
| National CPC floor | `nationalCpcFloor` | $10 |
| Local volume floor | `localVolumeFloor` | 200 |
| Local CPC floor | `localCpcFloor` | $6 |

Parse inputs from the user's message. If target cities are missing, ask for them.

## Procedure

### Pass 1 — National seed expansion (Full mode only)

Skip this entire section in City mode. Pass 1 is fully automated via the `discover-niches.mjs` script.

```bash
# Preview seed groups and estimated cost
node scripts/discover-niches.mjs --dry-run

# Run full discovery (all 8 seed groups, ~$0.72)
node scripts/discover-niches.mjs

# Run specific seed groups only
node scripts/discover-niches.mjs --groups=6,7

# Adjust thresholds
node scripts/discover-niches.mjs --min-vol=500 --min-cpc=8
```

The script:
1. Queries `keywords_for_keywords/live` for each seed group (full results, no truncation)
2. Clusters results via `clusterNiches()`, filters noise/licensed trades, normalizes synonyms
3. Filters to genuine home-service niches via `classifyHomeService()`
4. Removes niches already in `DISCOVERED_NICHES`
5. Writes results to `data/discovered-niches-YYYY-MM-DD.json`

**Approval gate:** Operator reviews the JSON output, then runs:
```bash
node scripts/discover-niches.mjs --apply
```
This updates `DISCOVERED_NICHES` in `lib/constants.js` and the test count in `tests/constants.test.js`.

**Pipeline:** `lib/discover.js` exports the pure logic functions (`buildSeedRequests`, `processRawResults`, `discoverNewNiches`, `formatNicheTable`), tested in `tests/discover.test.js`.

### Pass 2 — Local volume check (both modes)

5. **Load the niche list**
   - **City mode**: Import `DISCOVERED_NICHES` from `lib/constants.js`
   - **Full mode**: Use the approved list from Pass 1
   - If the user specified a niche filter, keep only matching niches

6. **Build keyword lists per niche**
   - For each niche, take the niche name as the primary keyword + generate 2 variants with the city name
   - Append each target city name to create localized phrases (e.g., "junk removal abilene", "junk removal abilene tx")

7. **Batch volume calls per city**
   - API: `POST /v3/keywords_data/google_ads/search_volume/live`
   - Group up to 700 keywords per task (DataForSEO `search_volume/live` limit). A typical city-mode run (~600 keywords) fits in a single task
   - Body per call:
     ```json
     [{
       "keywords": ["niche1 city", "niche2 city", ...],
       "location_code": 2840,
       "language_code": "en",
       "search_partners": false
     }]
     ```
   - Cost: ~$0.09 per task (up to 700 keywords each)

8. **Filter local results**
   - For each niche × city pair, sum volume across all phrase variants
   - Keep pairs where `total_volume >= 200` (`VOLUME_SCAN_DEFAULTS.localVolumeFloor`) AND `cpc >= 6` (`VOLUME_SCAN_DEFAULTS.localCpcFloor`)

9. **Write to candidates.csv**
   - Load existing `data/candidates.csv` if present (use `parseCandidatesCsv` from `lib/candidates.js`)
   - For each viable niche × city:
     - Generate slug via `generateSlug(niche, city)` from `lib/candidates.js`
     - Skip if slug already exists (idempotent)
     - Set `status=discovered`, `vol_total`, `vol_primary`, `cpc` from API results
     - Leave other score columns empty for `rr-validate` to fill
   - Write back with `serializeCandidatesCsv`
   - Create `data/` directory if it doesn't exist

10. **Print summary**
    - Mode used (Full or City)
    - Total niches checked
    - Total niche × city pairs tested
    - Total viable candidates written
    - Table: niche, city, volume, CPC, status
    - Total DataForSEO cost for this run

## Outputs

| Path | Description |
|------|-------------|
| `data/candidates.csv` | Appended with new `status=discovered` rows |
| `lib/constants.js` (`DISCOVERED_NICHES`) | Updated in Full mode only |
| Console summary | Top niches from Pass 1 (Full mode), viable candidates from Pass 2, total cost |

## Tools

- **`scripts/discover-niches.mjs`** — Automated Pass 1 seed expansion script
- **`scripts/volume-scan.mjs`** — Automated Pass 2 city-mode volume scanning
- **`lib/discover.js`** — `buildSeedRequests`, `processRawResults`, `discoverNewNiches`, `formatNicheTable`
- **`lib/candidates.js`** — `clusterNiches`, `classifyHomeService`, `extractNicheFromKeyword`, `normalizeNiche`, `isServiceKeyword`, `generateSlug`, `parseCandidatesCsv`, `serializeCandidatesCsv`
- **`lib/constants.js`** — `DISCOVERED_NICHES`, `DISCOVERY_SEED_GROUPS`, `VOLUME_SCAN_DEFAULTS`, `HOME_SERVICE_SIGNALS`, `STANDALONE_SERVICE_WORDS`, `SERVICE_NOISE_KEYWORDS`, `LICENSED_TRADES`
- **`lib/dataforseo-client.js`** — API client for direct DataForSEO REST calls

## Guardrails

- **Cost gate at Pass 1 → Pass 2 boundary** (Full mode): Show niche table + estimated cost, wait for approval
- **Batch to minimize calls**: Group up to 700 keywords per API task
- **Total budget**: ~$0.54 expected for Full mode ($0.45 Pass 1 + $0.09 Pass 2); City mode (~600 keywords) is ~$0.09 (single task)
- **No purchases**: This skill never buys domains, phone numbers, or anything else
- **Idempotent**: Existing slugs in candidates.csv are skipped
- **Key security**: Never print, log, or commit API credentials
