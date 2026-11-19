# rr-phone

**Purpose:** Search and provision Twilio local tracking numbers for sites that pass SEO audit.

## Inputs

- `sites/<slug>/site.yaml` — city, state, brand, phone field (must be null)
- `sites/<slug>/seo-audit-*.md` — audit report (must contain PASS)
- `sites/ASSIGNMENTS.md` — wave assignments for `--wave` filtering
- `~/.config/rank-rent/.env` — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`

## Outputs

- `sites/<slug>/site.yaml` — updated `phone:` field (E.164 format)
- `data/sites.csv` — updated `tracking_number` column
- Console output: available numbers table, approval prompt, provisioning results

## Tools

```bash
# Search available numbers only (dry run)
node scripts/phone.mjs --check-only <slug>
node scripts/phone.mjs --check-only --wave 1
node scripts/phone.mjs --check-only --all

# Provision numbers (interactive — requires operator approval)
node scripts/phone.mjs <slug>
node scripts/phone.mjs --wave 1
node scripts/phone.mjs --all
```

## Workflow

1. **Pre-flight** — Script verifies brand is set and SEO audit has PASS verdict. Refuses otherwise.
2. **Search numbers** — Twilio AvailablePhoneNumbers API, filtered by city + state. Falls back to state-wide if no local matches.
3. **Present table** — Markdown table: number, location, monthly cost ($1.15/number).
4. **STOP for approval** — Operator must type the exact phone number(s) to approve, or "cancel".
5. **Provision** — POST to Twilio IncomingPhoneNumbers to purchase each number. Sets FriendlyName to brand.
6. **Voicemail** — Generates TwiML for basic voicemail greeting. Operator configures TwiML Bin manually, or Phase 5 `rr-route` replaces with Cloudflare Worker.
7. **Record** — Updates `site.yaml` phone field (E.164) and `data/sites.csv` tracking_number column.

## Cost

- $1.15/month per local number + per-minute charges
- Wave 1 (4 numbers) = ~$4.60/month
- All 18 sites = ~$20.70/month

## Guardrails

- **Never provisions without explicit approval** — Script stops and waits for operator to type exact numbers.
- **Brand must be set** — Refuses sites with brand: null or TBD.
- **SEO audit must pass** — Refuses sites without a passing audit report (Gate 2 blocker).
- **Phone not already set** — Skips sites that already have a phone in site.yaml.
- **Monthly cost visible** — Total monthly cost shown before approval prompt.
- **No keys logged** — Twilio credentials never printed or committed.
- **Voicemail deferred** — Full call routing is Phase 5 (`rr-route`). This skill only provisions the number.
