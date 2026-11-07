# rr-shortlist

**Purpose:** Rank surviving candidates and produce a Gate 1 decision memo for operator approval.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| Filter | No | `status=viable` | Which candidates to include in the shortlist |

## Procedure

### 1. Load candidates

- Read `data/candidates.csv` using `parseCandidatesCsv` from `lib/candidates.js`
- Filter to `status=viable`
- Exclude any with SKIP verdict (check `research/<slug>/teardown.md` for the verdict line)
- If no candidates remain, report and stop

### 2. Rank candidates

Sort by:
1. `score_total` descending
2. `rent_estimate` descending
3. Teardown verdict (BEATABLE > TOUGH)

### 3. Per-candidate analysis

For each candidate:
- Read `research/<slug>/teardown.md` for verdict and competitor data
- Calculate estimated monthly calls: `vol_primary × 0.15` (15% CTR estimate)
- Calculate estimated rent using `estimateRent(vol_primary, cpc)` from `lib/scoring.js`
- Propose 3 domain names per `reference/naming-rules.md`:
  1. Best option: shortest, cleanest, .com — format `{niche}{area}.com` or `{area}{niche}.com`
  2. Alternate phrasing: different word order or synonym
  3. Fallback: .net or slight variation
- Domain names must follow all naming rules: service + area, no trademarks, no hyphens if possible, under 25 characters, easy to spell

### 4. Calculate total spend

- Domains: ~$11 each (Cloudflare registration)
- Phone numbers: ~$1.15/month each (Twilio)
- Show total upfront cost and monthly recurring

### 5. Write shortlist memo

Write `research/shortlist-YYYY-MM-DD.md`:

```markdown
# Shortlist — Gate 1 Decision Memo

**Date:** YYYY-MM-DD
**Region:** {region}
**Candidates evaluated:** N discovered → N validated → N torn down → N shortlisted

## Executive Summary

[2–3 sentences: how many candidates survive, combined rent potential, total investment needed]

## Recommended Candidates

### 1. {Niche} in {Area} — Score: {score_total}/16

| Metric | Value |
|--------|-------|
| Monthly search volume | {vol_primary} |
| CPC | ${cpc} |
| Estimated monthly calls | {calls} |
| Estimated monthly rent | ${rent_estimate} |
| Teardown verdict | {verdict} |
| Competitor weakness | {key weakness from teardown} |

**Proposed domains:**

| # | Domain | Notes |
|---|--------|-------|
| 1 | {domain1}.com | Best option |
| 2 | {domain2}.com | Alternate |
| 3 | {domain3}.net | Fallback |

---

[Repeat for each candidate]

## Marginal Candidates

[List any with score 8–10 that might be worth revisiting]

## Investment Summary

| Item | Count | Unit Cost | Total |
|------|-------|-----------|-------|
| Domain registrations | N | ~$11 | $X |
| Twilio phone numbers | N | ~$1.15/mo | $X/mo |
| **Total upfront** | | | **$X** |
| **Monthly recurring** | | | **$X/mo** |

## Gate 1 Question

**Which candidates should we purchase domains and phone numbers for?**

Please reply with the candidate numbers to proceed, or "none" to pass.
```

### 6. Update CSV

- Set `status=shortlisted` for all included candidates

## Outputs

| Path | Description |
|------|-------------|
| `data/candidates.csv` | Updated with `status=shortlisted` |
| `research/shortlist-YYYY-MM-DD.md` | Gate 1 decision memo |

## Tools

- None. This skill reads existing data only — zero API calls, zero cost.

## Guardrails

- **No purchases**: This skill proposes domain names but never buys them
- **No fabrication**: All numbers come from validated data, not estimates
- **Domain names only proposed**: Availability check happens in `rr-domains` after Gate 1 approval
- **Cost**: $0 — reads existing data only
