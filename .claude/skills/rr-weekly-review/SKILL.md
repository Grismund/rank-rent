# rr-weekly-review

**Purpose:** Monitor deployed site performance via GSC Search Analytics and Twilio call logs, detect milestones, propose new pages and content refreshes, and flag kill candidates.

## Inputs

- `data/sites.csv` — deployed site status, tracking numbers, launch dates, milestones
- `sites/<slug>/site.yaml` — domain, page plan (for page URL construction)
- `sites/ASSIGNMENTS.md` — wave assignments for `--wave` filtering
- `reference/ranking-playbook.md` — portfolio footprint rules, growth expectations
- `~/.config/rank-rent/.env` — `GOOGLE_APPLICATION_CREDENTIALS`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`

## Outputs

- `data/reviews/<slug>-YYYY-MM-DD.json` — per-site review data (impressions, clicks, calls, proposals, candidates)
- `data/sites.csv` — milestone updates (`first_impression`, `first_call`, `monthly_calls`)

## Tools

- **Google Search Console** Search Analytics API (`webmasters.readonly` scope) — query impressions, clicks, positions
- **Twilio Calls API** — inbound call logs (read-only)
- **lib/google-auth.js** — service account JWT auth
- **lib/weekly-review.js** — all data transformation (pure functions)

## Workflow

```bash
node scripts/weekly-review.mjs <slug>              # one site
node scripts/weekly-review.mjs --wave 1            # one wave
node scripts/weekly-review.mjs --all               # all deployed
node scripts/weekly-review.mjs --dry-run <slug>    # show what would query
```

1. Discover target sites (slug, wave, or all deployed)
2. Filter to deployed sites only (status=deployed, has domain)
3. Build 4-week review window: current 14 days + prior 14 days
4. Authenticate with Google using service account JWT
5. Per site:
   - Query GSC Search Analytics for current and prior windows
   - Query Twilio Calls API for call logs (if tracking number set)
   - Find new page candidates: queries with ≥20 impressions, position >15, no existing page
   - Select top page proposal (highest impressions)
   - Find refresh candidates: pages whose primary keyword dropped >5 positions
   - Check kill candidate: 0 impressions + ≥6 months since launch
   - Detect milestones: first impression, first call, monthly calls
   - Update sites.csv with milestone changes
   - Write review JSON to `data/reviews/`
6. Print portfolio summary to stdout

## Guardrails

- **Read-only on GSC** — Only queries Search Analytics; never modifies properties or sitemaps
- **Read-only on Twilio** — Only reads call logs; never modifies numbers or routing
- **No auto-publish proposals** — New page and refresh suggestions are recorded in review JSON only; operator decides
- **No auto-kill** — Kill candidate flag is advisory; operator makes the final call
- **Graceful degradation** — Missing GSC credentials or no Twilio auth = skip that data source, continue with what's available
- **Cost: $0** — GSC Search Analytics and Twilio read APIs are free
