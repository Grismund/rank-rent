# rr-deploy

**Purpose:** Build and deploy rank-rent sites to Cloudflare Pages with custom domains, env vars, and IndexNow key files.

## Inputs

- `sites/<slug>/site.yaml` — brand, domain, phone, page plan
- `sites/ASSIGNMENTS.md` — wave assignments
- `data/sites.csv` — site status, launch dates
- `reference/ranking-playbook.md` — cadence rules (3–4/week, no same-niche in a week)
- `~/.config/rank-rent/.env` — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `RESEND_API_KEY`

## Outputs

- Built site in `template/dist/<slug>/`
- Cloudflare Pages project with custom domain
- IndexNow key file at `dist/<slug>/<key>.txt`
- Updated `data/sites.csv` — `launch_date`, `status=deployed`

## Tools

- `scripts/build-site.mjs` — Astro build
- `wrangler pages project create` — create Pages project
- `wrangler pages deploy` — deploy to Pages
- Cloudflare API — set env vars, attach custom domain

## Workflow

```bash
node scripts/deploy.mjs <slug>              # deploy one site
node scripts/deploy.mjs --wave 1            # deploy Wave 1
node scripts/deploy.mjs --all               # deploy all eligible
node scripts/deploy.mjs --dry-run <slug>    # build + validate only
node scripts/deploy.mjs --skip-phone <slug> # deploy before phone provisioned
node scripts/deploy.mjs --force <slug>      # override wave order
```

1. Discover target sites (slug, wave, or all)
2. Pre-flight: brand set, domain registered, phone provisioned, SEO audit passed
3. Cadence check: ≤4 in 7 days, no same-niche in 7 days
4. Wave order check: wave N requires wave N-1 to have ≥1 deployed
5. Build site via `build-site.mjs`
6. Generate IndexNow key file into dist
7. Create Cloudflare Pages project (`--force` for legacy)
8. Set env vars: `RESEND_API_KEY`, `SITE_BRAND`, `LEAD_EMAIL`
9. Deploy with `wrangler pages deploy`
10. Attach custom domain via Cloudflare API
11. Verify HTTPS (retry up to 60s)
12. Update `sites.csv`: `launch_date` = today, `status` = `deployed`

## Guardrails

- **Gate 2 required** — Sites must have domain + phone before deploy (unless `--skip-phone`)
- **SEO audit must pass** — No deploy without passing audit
- **Launch cadence enforced** — Max 4 in 7 days, no same-niche in a week. `--force` overrides.
- **Wave order enforced** — Wave N blocked until wave N-1 has ≥1 deployed. `--force` overrides.
- **No auto-renew skip** — Domain auto-renew is set at registration time (rr-domains)
- **Env secrets** — Never print or log API keys
