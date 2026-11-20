# rr-route

**Purpose:** Manage call routing for rank-rent tracking numbers — switch between voicemail, trial forwarding, and paid forwarding modes via a Cloudflare Worker and KV store.

## Inputs

- `data/sites.csv` — tracking numbers, tracking_number_sid, domains, client info
- `sites/<slug>/site.yaml` — brand name, niche, city
- `~/.config/rank-rent/.env` — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `RESEND_API_KEY`

## Outputs

- `workers/call-router/` — Cloudflare Worker (deployed)
- Cloudflare KV store — route configs keyed by phone number
- `data/sites.csv` — `forwarding_target`, `client` fields updated on mode change

## Tools

- **Cloudflare Workers** — Worker deployment (`wrangler deploy`)
- **Cloudflare KV** — Route config storage (REST API)
- **Twilio** — `IncomingPhoneNumbers` update (VoiceUrl pointing to Worker)
- **Resend** — Welcome email for trial clients

## Workflow

```bash
node scripts/route.mjs status                          # show all routes
node scripts/route.mjs status <slug>                   # show one route
node scripts/route.mjs set <slug> voicemail            # switch to voicemail
node scripts/route.mjs set <slug> trial --forward +1XXXXXXXXXX --client "Name"
node scripts/route.mjs set <slug> paid  --forward +1XXXXXXXXXX --client "Name"
node scripts/route.mjs deploy                          # deploy/update Worker
node scripts/route.mjs init                            # create KV namespace + seed configs
```

### Mode lifecycle

```
voicemail → trial → paid
    ↑         ↓       ↓
    └─────────┴───────┘  (can revert to voicemail at any time)
```

1. **voicemail** (default) — Records caller message, transcribes it
2. **trial** — Forwards calls to client's phone with whisper announcement ("Incoming lead from [Brand]")
3. **paid** — Same as trial, used after client agrees to monthly rental

### `set` command flow

1. Load sites.csv, verify tracking_number_sid exists
2. Build route config with brand from site.yaml
3. Validate config (mode, forwardTo for trial/paid)
4. Show before/after transition → operator confirms
5. Update KV with new config
6. Update Twilio VoiceUrl to point to Worker
7. Update sites.csv (forwarding_target, client)
8. If trial mode: generate welcome email template

### `init` command flow

1. Create Cloudflare KV namespace (`call-router-ROUTES`)
2. Write namespace ID to `wrangler.toml`
3. Seed all deployed sites with voicemail configs

## Guardrails

- **No auto-transition** — Every mode change requires explicit operator confirmation
- **SID required** — Cannot update Twilio VoiceUrl without `tracking_number_sid` in sites.csv
- **Worker is read-only** — The Worker only reads KV and returns TwiML; it never modifies state
- **No keys in Worker source** — All secrets are environment variables or KV data
- **Welcome email only on trial** — Welcome email template is generated only when switching to trial mode
- **Operator handles sales** — This skill manages routing infrastructure only; sales calls and negotiations are manual (Gate 3)
