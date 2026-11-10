# rr-renters

**Purpose:** Research potential renters for each candidate site via Google Maps Business Listings and Facebook business page searches, then enrich with contact data.

## Inputs

- `data/candidates.csv` — rows with `status=keywords_mapped`
- `data/buyers.csv` — existing buyers (for Phase 2 enrichment re-runs)
- `lib/renters.js` — pure functions for parsing, scoring, deduplication, contact enrichment
- `lib/constants.js` — `BUYERS_CSV_COLUMNS`, `DIRECTORY_DOMAINS`

## Outputs

- `data/buyers.csv` — scored renter prospects with contact data for all candidates
- `data/candidates.csv` — updated rows: `status=renters_found`

## Phase 1: Discovery

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
   - Parse each result with `parseBusinessListing()` — now includes `contact_info` array
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

## Phase 2: Contact Enrichment

Enrichment fills `owner_name`, `email`, `phone_source`, `website_source`, and `enriched_date` columns in `buyers.csv`. Each step is incremental — only proceed to the next if gaps remain.

**Idempotency:** Skip rows where `enriched_date` is already set on re-run.

### Step A — GBP Contact Info

Re-query DataForSEO Business Listings for each candidate (same queries as Phase 1). For each listing with a `contact_info` array:

1. Call `parseGbpContactInfo(item.contact_info)` to extract first email/phone
2. Call `mergeContactData(existingRow, gbpData)` — fills empty fields only (first source wins)
3. Set `enriched_date` to today's date

**Cost:** ~$0.18 (same queries as discovery). Show estimate before proceeding.

### Step B — Website Scraping (only if Step A leaves gaps)

For buyers with a `website` URL but missing `email` or `owner_name`:

1. WebFetch the site's homepage, `/contact`, and `/about` pages
2. Extract emails (filter out noreply@, info@ generic addresses) and owner names ("Owner:", "Founded by", "About the Owner" patterns)
3. Call `mergeContactData()` with `source: 'SITE'`

### Step C — Facebook Fallback (only if Steps A+B leave gaps)

For `hot` or `warm` buyers still missing contact data:

1. WebSearch `"business name" "city" site:facebook.com`
2. Extract contact info from search result snippets
3. Call `mergeContactData()` with `source: 'FB'`

### Enrichment Summary

After enrichment, call `buildEnrichmentSummary(buyers)` and show:
- Total buyers, count with email/phone/owner/website
- Breakdown by source (GBP/SITE/FB)
- Ask for approval before writing updated `data/buyers.csv`

## Tools

- **DataForSEO MCP** — `mcp__dataforseo__api_request` for Business Listings Search Live
- **WebSearch** — Facebook business page discovery
- **WebFetch** — Website contact page scraping (Phase 2 Step B)
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

## Contact Enrichment Columns

| Column | Values | Description |
|--------|--------|-------------|
| `owner_name` | text | Business owner's name |
| `owner_name_source` | `GBP`, `SITE`, `FB`, or empty | Where owner name was found |
| `email` | text | Contact email address |
| `email_source` | `GBP`, `SITE`, `FB`, or empty | Where email was found |
| `phone_source` | `GBP`, `SITE`, `FB`, or empty | Where phone was found |
| `website_source` | `GBP`, `SITE`, `FB`, or empty | Where website was found |
| `enriched_date` | `YYYY-MM-DD` | Date row was last enriched |

## Guardrails

- **Cost gate:** ~$0.18 per phase estimated. If over $1, show cost and wait for approval.
- **Cap:** 30 businesses max per candidate
- **No purchases** — research only
- **Key security** — API credentials handled by MCP server, never logged
- **Approval required** — show summary table before writing buyers.csv
- **First source wins** — `mergeContactData()` never overwrites existing non-empty fields (GBP > SITE > FB priority)
