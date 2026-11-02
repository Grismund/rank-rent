# rr-smoke-test

## Purpose

Prove every API integration works with one sample call each, before any real research or purchases begin.

## Inputs

- `~/.config/rank-rent/.env` — API keys for all services
- Placeholder search terms (e.g., "plumber dallas") that reveal nothing about real niche plans

## Outputs

- `docs/connectivity-report.md` — table with pass/fail per test plus notes and action items

## Tools

- DataForSEO MCP server (`api_request`) — keyword volumes, organic SERP, Maps, backlinks
- Cloudflare Registrar API — domain availability check (no purchase)
- Cloudflare Pages via `wrangler` CLI — hello-world deploy
- Twilio REST API — available number search (no purchase)
- Google Search Console API — list properties via service account
- Google Site Verification API — dry-run token retrieval
- Bing Webmaster API — list sites

## Guardrails

- **Budget**: under $0.10 DataForSEO credit for the entire run
- **No purchases**: never buy a domain or phone number; availability checks only
- **No secrets in output**: never print, log, or commit API keys
- **Placeholder terms only**: use generic service+city pairs that reveal nothing about real targets
