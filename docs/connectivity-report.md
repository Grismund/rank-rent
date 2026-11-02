# Connectivity Report — Phase 1 Smoke Test

Date: 2026-11-02

## Results

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | DataForSEO keyword volumes (10 phrases, Dallas metro) | **PASS** | All 10 keywords returned monthly volumes and CPC. "plumber dallas" = 1,600/mo, $51.49 CPC. |
| 2 | Live Google organic results (1 phrase) | **PASS** | Top 8 organic results returned for "plumber dallas". Baker Brothers, Roto-Rooter, Yelp, D Magazine all present. |
| 3 | Google Maps listings (1 phrase) | **PASS** | 10 Maps results with business names, phones, websites, ratings, review counts, addresses. Endpoint is `live/advanced` (not `live/regular`). |
| 4 | Backlink summary for a competitor | **PASS** | benjaminfranklinplumbing.com: rank 407, 4,280 referring domains, 68,558 backlinks. |
| 5 | Cloudflare domain availability check | **PARTIAL** | Registrar API token works (list domains returns empty as expected). The domain availability check endpoint (`/registrar/domains/check`) is not available — the Registrar API beta does not expose this route. Domain availability will need an alternative method. |
| 6 | Deploy hello-world to `pages.dev` | **PASS** | Project created, 1 file uploaded, deployed to `4c5e2c26.rr-smoke-test.pages.dev`. Project cleaned up after test. Note: `--force` flag needed for `pages project create` to use legacy Pages (new wrangler delegates to Workers by default). |
| 7 | Twilio available number search (469, 972) | **PASS** | 469 area code: numbers available (e.g., (469) 871-7459, (469) 689-4814). 972 area code: 0 numbers in initial search — may need broader search or different sub-area. |
| 8 | Google Search Console — list properties | **PASS** | Service account OAuth token acquired; list properties returned empty (expected — no sites added yet). Key file: `rank-rent-513504-9da2b33a7595.json`. |
| 9 | Google Site Verification — dry run | **PASS** | Returned DNS TXT verification token for test domain. Claude can retrieve tokens; operator clicks Verify once per site. |
| 10 | Bing Webmaster API — list sites | **PASS** | API key accepted, returned empty site list (expected — no sites added yet). |
| 11 | DataForSEO MCP connectivity | **PASS** | Tests 1–4 all used the MCP `api_request` tool directly, confirming the DataForSEO MCP server is configured and working. |

## Summary

- **10 of 11 tests passed** (including 1 partial)
- **DataForSEO spend**: ~$0.12 (balance went from $51.00 to $50.88)
- **Nothing purchased**: no domains, no phone numbers

## Action items

1. **Cloudflare domain availability** — The Registrar API beta doesn't support availability checks. Options:
   - Use the WHOIS API or a third-party checker (DataForSEO has domain analytics)
   - Use Porkbun API as the availability checker, Cloudflare for purchase
   - Check via `whois` CLI as a simple fallback
2. **Twilio 972 area code** — No numbers found in initial search. Try searching without area code filter using `InRegion=TX` and `InLocality=Dallas`, or use `NearNumber` parameter.
3. **Wrangler Pages** — Use `--force` flag on `pages project create` to avoid the Workers delegation issue, or migrate to the new Workers-based Pages flow.

## Env file fixes applied

- Fixed `GOOGLE_APPLICATION_CREDENTIALS` double-assignment (`VAR=VAR=value` → `VAR=value`)
- Updated filename from `gsc-service-account.json` to `rank-rent-513504-9da2b33a7595.json`
