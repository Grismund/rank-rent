# rr-renters

**Purpose:** Research potential renters for each candidate site via Google Maps Business Listings and Facebook business page searches.

## Inputs

- `data/candidates.csv` — rows with `status=keywords_mapped`
- `lib/renters.js` — pure functions for parsing, scoring, deduplication
- `lib/constants.js` — `BUYERS_CSV_COLUMNS`, `DIRECTORY_DOMAINS`

## Outputs

- `data/buyers.csv` — scored renter prospects for all candidates
- `data/candidates.csv` — updated rows: `status=renters_found`

## Procedure

1. **Load candidates** — parse `data/candidates.csv`, filter to `status=keywords_mapped`
2. **Estimate cost** — 1 DataForSEO Business Listings Search Live call per candidate × ~$0.01 = ~$0.18 total. Show estimate, proceed if under $1.
3. **For each candidate**, query DataForSEO Business Listings Search Live:
   - **API path:** `/v3/business_data/business_listings/search/live`
   - **Parameters:**
     - `categories`: array with single category from `NICHE_CATEGORY_MAP[niche]`
     - `location_coordinate`: `{ latitude, longitude, radius: 30000 }` (city GPS coords, 30km radius)
     - `limit`: 100
     - `order_by`: `["rating.votes_count,desc"]`
     - `filters`: `["rating.votes_count", ">", 0]` (skip zero-review ghosts)
   - Parse each result with `parseBusinessListing()`
   - Run `assessWebsiteWeakness()` on each listing
4. **For each candidate**, run a WebSearch query from `buildFacebookSearchQuery(niche, city, state)`:
   - Extract Facebook business page matches
   - Cross-reference with Google Maps results by business name similarity
   - Mark existing listings with `fb_presence: 'found'` or `'advertising'` (if page shows active ads)
   - Add Facebook-only businesses as new rows with `source: 'facebook'`
5. **Score all businesses** with `scorePitchPriority()`
6. **Deduplicate** within each candidate using `deduplicateListings()`
7. **Cap** at 30 businesses per candidate (prioritize `hot` > `warm` > `cold`)
8. **Generate pitch notes** with `generatePitchNote()`
9. **Present summary table** to operator:
   - Per-candidate: total prospects, hot/warm/cold counts
   - Total across all candidates
   - Ask for approval before writing
10. **Write `data/buyers.csv`** with `serializeBuyersCsv()`
11. **Update `data/candidates.csv`** — set `status=renters_found` for all processed candidates

## Tools

- **DataForSEO MCP** — `mcp__dataforseo__api_request` for Business Listings Search Live
- **WebSearch** — Facebook business page discovery
- **Read/Write** — CSV file I/O

## Category Mapping

| Niche | DataForSEO Category |
|-------|---------------------|
| epoxy flooring | `flooring_contractor` |
| bathroom remodel | `bathroom_remodeler` |
| kitchen remodel | `kitchen_remodeler` |
| junk removal | `junk_removal_service` |
| pool builders | `swimming_pool_contractor` |
| pressure washing | `pressure_washing_service` |
| window tinting | `window_tinting_service` |
| paver sealing | `concrete_contractor` |

## City GPS Coordinates

Look up city coordinates from the candidate's area + state. Use approximate city center coordinates.

## Guardrails

- **Cost gate:** ~$0.18 total estimated. If over $1, show cost and wait for approval.
- **Cap:** 30 businesses max per candidate
- **No purchases** — research only
- **Key security** — API credentials handled by MCP server, never logged
- **Approval required** — show summary table before writing buyers.csv
