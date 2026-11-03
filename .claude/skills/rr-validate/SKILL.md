# rr-validate

**Purpose:** Pull real search data from DataForSEO and score all 8 rubric signals for discovered candidates.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| Filter | No | `status=discovered` | Which candidates to validate (can pass specific slugs) |

## Procedure

### 1. Load candidates

- Read `data/candidates.csv` using `parseCandidatesCsv` from `lib/candidates.js`
- Filter to `status=discovered` (or user-specified filter)
- If no candidates match, report and stop

### 2. Cost gate

- Call `estimateValidationCost(candidates)` from `lib/cost-estimator.js`
- If estimated cost > $1, display the breakdown and **wait for user approval** before proceeding
- Show: number of candidates, keyword volume calls, SERP calls, maps calls, trends calls, total estimated cost

### 3. Pull keyword volume data

- Collect all phrases from all candidates
- Batch into calls of up to 1,000 keywords per request
- API: `POST /v3/keywords_data/google_ads/search_volume/live`
- Payload per batch:
  ```json
  [{
    "keywords": ["phrase1", "phrase2", ...],
    "location_name": "City,State,United States",
    "language_name": "English"
  }]
  ```
- Use location format `"City,State,United States"` (e.g., `"McKinney,Texas,United States"`) per proven smoke-test patterns
- Extract `search_volume` and `cpc` for each keyword
- Rate limit: max 12 requests per minute on this endpoint

### 4. Pull organic SERP

- For each candidate, take the top 2 phrases by volume
- API: `POST /v3/serp/google/organic/live/advanced`
- Payload:
  ```json
  [{
    "keyword": "house cleaning McKinney",
    "location_name": "McKinney,Texas,United States",
    "language_name": "English",
    "depth": 10
  }]
  ```
- Extract: top 5 organic domains, their titles, URLs

### 5. Pull Maps results

- For each candidate's primary phrase:
- API: `POST /v3/serp/google/maps/live/advanced`
- Payload:
  ```json
  [{
    "keyword": "house cleaning McKinney",
    "location_name": "McKinney,Texas,United States",
    "language_name": "English",
    "depth": 20
  }]
  ```
- Extract: top 3 map pack entries (business name, reviews, rating), total count of businesses

### 6. Pull Google Trends

- One call per **unique niche** (not per candidate)
- API: `POST /v3/keywords_data/google_trends/explore/live`
- Payload:
  ```json
  [{
    "keywords": ["house cleaning"],
    "location_name": "United States",
    "language_name": "English",
    "time_range": "past_12_months"
  }]
  ```
- Extract: 12 monthly interest values for seasonality scoring

### 7. Score all 8 signals

Using functions from `lib/scoring.js` and thresholds from `reference/rubric.md`:

| Signal | Function | Data source |
|--------|----------|-------------|
| Search volume | `scoreSearchVolume(vol_primary)` | Keyword volume API |
| CPC | `scoreCPC(cpc)` | Keyword volume API |
| Map pack weakness | `scoreMapPackWeakness(topThree)` | Maps SERP |
| Organic weakness | `scoreOrganicWeakness(topFive, DIRECTORY_DOMAINS)` | Organic SERP |
| Renter availability | `scoreRenterAvailability(totalMapCount)` | Maps SERP total |
| License barrier | `scoreLicenseBarrier(license_barrier)` | From discover |
| Seasonality | `scoreSeasonality(monthlyValues)` | Trends API |
| Rent potential | `scoreRentPotential(estimateRent(vol, cpc))` | Computed |

- Compute `totalScore(signals)` to get sum + status (pass/marginal/walk_away)

### 8. Save results

- Write raw JSON responses to `research/<slug>/validation-data.json`
- Update `data/candidates.csv`:
  - Fill all score columns
  - Fill `vol_total`, `vol_primary`, `cpc`, `rent_estimate`
  - Set `status=validated` (or `walk_away` if score < 8)
  - Set `validated_date` to today's date (YYYY-MM-DD)

### 9. Print summary

- Sorted table of all validated candidates: slug, score_total, status, vol_primary, cpc, rent_estimate
- Highlight pass (11+) and marginal (8–10) candidates
- Count: N pass, N marginal, N walk_away

## Outputs

| Path | Description |
|------|-------------|
| `data/candidates.csv` | Updated with scores, volumes, status |
| `research/<slug>/validation-data.json` | Raw API responses per candidate |

## Tools

- **DataForSEO MCP** (`mcp__dataforseo__api_request`) — keyword volume, organic SERP, maps SERP, trends

## Guardrails

- **Cost gate at $1**: Show breakdown and wait for approval if estimate exceeds $1
- **Batch to minimize calls**: Pack up to 1,000 keywords per volume request
- **Rate limit**: Max 12 requests/minute on keyword volume endpoint
- **No purchases**: This skill never buys anything
- **Location format**: Always use `"City,State,United States"` (e.g., `"McKinney,Texas,United States"`)
