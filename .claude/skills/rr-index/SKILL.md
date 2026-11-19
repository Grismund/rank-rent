# rr-index

**Purpose:** Submit deployed sites to Google Search Console, Bing Webmaster Tools, and IndexNow for crawling and indexing.

## Inputs

- `sites/<slug>/site.yaml` — domain, page plan
- `sites/ASSIGNMENTS.md` — wave assignments
- `data/sites.csv` — must have `status=deployed` and `domain` set
- `~/.config/rank-rent/.env` — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT`, `BING_WEBMASTER_API_KEY`

## Outputs

- Google Search Console property added + sitemap submitted per site
- DNS TXT verification record added via Cloudflare
- Bing Webmaster property added + sitemap submitted per site
- IndexNow ping with all page URLs per site

## Tools

- Google Search Console API (`webmasters/v3`) — add property, submit sitemap
- Google Site Verification API (`siteVerification/v1`) — DNS TXT verification
- Cloudflare DNS API — add TXT records
- Bing Webmaster API — add site, submit sitemap
- IndexNow API (`api.indexnow.org`) — batch URL submission

## Workflow

```bash
node scripts/index-site.mjs <slug>                  # index one site
node scripts/index-site.mjs --wave 1                # index a wave
node scripts/index-site.mjs --all                   # index all deployed
node scripts/index-site.mjs --dry-run <slug>        # show what would submit
node scripts/index-site.mjs --indexnow-only <slug>  # re-ping IndexNow only
```

1. Discover targets — must have `status: deployed` and `domain` set in sites.csv
2. Per site — Google Search Console:
   - Get OAuth2 access token (service account JWT → token exchange)
   - Add property: `PUT /webmasters/v3/sites/{siteUrl}`
   - Get DNS TXT token: `POST /siteVerification/v1/token`
   - Add TXT record via Cloudflare DNS API
   - Verify: `POST /siteVerification/v1/webResource`
   - Submit sitemap: `PUT /webmasters/v3/sites/{siteUrl}/sitemaps/{sitemapUrl}`
3. Per site — Bing Webmaster:
   - Add site: `POST /webmaster/api.svc/json/AddSite`
   - Submit sitemap
4. Per site — IndexNow:
   - Build page URL list from site.yaml (excludes noindex)
   - Ping `POST https://api.indexnow.org/indexnow`
5. Print report per site

## Guardrails

- **Only deployed sites** — Refuses sites without `status=deployed` in sites.csv
- **Each site gets its own properties** — No shared verification tokens across sites
- **DNS verification may need retry** — Token propagation can be slow; operator retries later
- **Env secrets** — Never print or log API keys or service account credentials
- **IndexNow key** — Deterministic per slug; key file must exist at the deployed site
