# rr-domains

**Purpose:** Check domain availability and register domains via Cloudflare Registrar for sites that pass SEO audit.

## Inputs

- `sites/<slug>/site.yaml` — brand name, domain field (must be null)
- `sites/<slug>/seo-audit-*.md` — audit report (must contain PASS)
- `sites/ASSIGNMENTS.md` — wave assignments for `--wave` filtering
- `reference/naming-rules.md` — domain naming conventions
- `lib/brand-check.js` — `brandToDomains()` for candidate generation
- `~/.config/rank-rent/.env` — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## Outputs

- `sites/<slug>/site.yaml` — updated `domain:` field
- `data/sites.csv` — updated `domain`, `registrar`, `renewal_date` columns
- Console output: availability table, approval prompt, registration results

## Tools

```bash
# Check availability only (dry run)
node scripts/domains.mjs --check-only <slug>
node scripts/domains.mjs --check-only --wave 1
node scripts/domains.mjs --check-only --all

# Register domains (interactive — requires operator approval)
node scripts/domains.mjs <slug>
node scripts/domains.mjs --wave 1
node scripts/domains.mjs --all
```

## Workflow

1. **Pre-flight** — Script verifies brand is set (not null/TBD) and SEO audit has PASS verdict. Refuses otherwise.
2. **Generate candidates** — Calls `brandToDomains()` to produce .com candidates, adds .net/.co fallbacks.
3. **Check availability** — Batch POST to Cloudflare `/registrar/domain-check` (max 20 per request).
4. **Present table** — Markdown table: domain, available (YES/no with reason), price.
5. **STOP for approval** — Operator must type the exact domain name(s) to approve, or "cancel".
6. **Register** — POST to Cloudflare `/registrar/domains` for each approved domain.
7. **Auto-renew** — PATCH to enable auto-renew immediately after each registration.
8. **Record** — Updates `site.yaml` domain field and `data/sites.csv` with domain, registrar, renewal date.

## Guardrails

- **Never registers without explicit approval** — Script stops and waits for operator to type exact domain names.
- **Brand must be set** — Refuses sites with brand: null or TBD.
- **SEO audit must pass** — Refuses sites without a passing audit report (Gate 2 blocker).
- **Auto-renew always enabled** — PATCH immediately after every registration. Warns if PATCH fails.
- **Domain not already set** — Skips sites that already have a domain in site.yaml.
- **Cost visible** — Total cost shown before approval prompt. Cloudflare .com is ~$8.57-11.17/domain.
- **No keys logged** — API tokens never printed or committed.
