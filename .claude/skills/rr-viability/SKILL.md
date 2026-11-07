# rr-viability

**Purpose:** Verify that unit economics and live SERP patterns support the rent estimate for torn-down candidates before shortlisting.

## Inputs

| Source | Description |
|--------|-------------|
| `data/candidates.csv` | Filtered to `status=torn_down` |
| `reference/niche-economics.md` | Job value and margin reference table |
| `lib/constants.js` → `DISCOVERED_NICHES` | National avg CPC per niche |

## Procedure

### 1. Load candidates

- Read `data/candidates.csv` using `parseCandidatesCsv` from `lib/candidates.js`
- Filter to `status=torn_down`
- If no candidates remain, report and stop

### 2. Cost gate

- Estimate SERP API costs: ~$0.01 per candidate (one `serp/google/organic/live/regular` call each)
- If total exceeds **$1**, show cost estimate and wait for approval

### 3. For each candidate

#### a. Look up job economics

- Parse `reference/niche-economics.md` using `parseNicheEconomics` from `lib/niche-economics-parser.js`
- Call `lookupJobEconomics(niche, table)` from `lib/viability.js`
- If niche not found, flag for manual review and skip

#### b. Check CPC inflation

- Find national avg CPC from `DISCOVERED_NICHES` in `lib/constants.js`
- Call `flagInflatedCPC(localCpc, nationalAvgCpc)` — flags if local > 2.5× national
- If flagged, compute an adjusted rent estimate using the national CPC instead

#### c. Pull live SERP

- Call DataForSEO `serp/google/organic/live/regular` for the primary phrase
  - Location: candidate's area
  - Depth: 20 results
  - This captures both paid and organic results

#### d. Analyze SERP

- `countPaidAds(serpItems)` — count paid placements
- `detectBaitAndSwitch(paidItems)` — scan for low-ball price patterns ($49, $59, $79, $85, $89, $99)
- `assessOrganicFragmentation(organicItems, PLATFORM_DOMAINS, DIRECTORY_DOMAINS)` — social vs dedicated vs directory

#### e. Compute break-even

- Use midpoint of job value range: `(avgJobLow + avgJobHigh) / 2`
- Use midpoint of margin range: `(marginLow + marginHigh) / 2`
- `computeBreakEven(rentEstimate, avgJobValue, marginPct)`
- Estimated monthly leads: `vol_primary × 0.15`
- `assessViability(breakEvenJobs, monthlyLeads)`

#### f. Render verdict

| Assessment | Action |
|-----------|--------|
| `viable` | Set `status=viable` |
| `marginal` | Set `status=viable` with a caution flag in the report |
| `fail` | Set `status=walk_away` |

### 4. Write per-candidate report

Write `research/<slug>/viability.md`:

```markdown
# Viability Report — {Niche} in {Area}

**Date:** YYYY-MM-DD
**Verdict:** {viable / marginal / walk_away}

## Job Economics

| Metric | Value |
|--------|-------|
| Avg job value | ${avgJobLow}–${avgJobHigh} |
| Gross margin | {marginLow}–{marginHigh}% |
| Source | {notes} |

## CPC Analysis

| Metric | Value |
|--------|-------|
| Local CPC | ${cpc} |
| National avg CPC | ${nationalCpc} |
| Inflation ratio | {ratio}× |
| Inflated? | {yes/no} |

{If inflated: adjusted rent estimate using national CPC}

## SERP Analysis

| Metric | Value |
|--------|-------|
| Paid ad count | {count} |
| Bait-and-switch flags | {count} — {details if any} |
| Social/platform results | {socialCount} |
| Dedicated business sites | {dedicatedSiteCount} |
| Directory results | {directoryCount} |

## Break-Even Math

| Metric | Value |
|--------|-------|
| Rent estimate | ${rentEstimate}/mo |
| Net revenue per job | ${avgJob × margin} |
| Jobs to break even | {breakEvenJobs}/mo |
| Estimated monthly leads | {vol_primary × 0.15} |
| Break-even ratio | {ratio}% of leads |
| Assessment | {viable / marginal / fail} |
```

### 5. Update CSV

- Set `status=viable` or `status=walk_away`
- Set `viability_date` to today's date (YYYY-MM-DD)

## Outputs

| Path | Description |
|------|-------------|
| `data/candidates.csv` | Updated status and viability_date |
| `research/<slug>/viability.md` | Per-candidate viability report |

## Tools

| Tool | Purpose | Est. cost |
|------|---------|-----------|
| DataForSEO `serp/google/organic/live/regular` | Live SERP data for paid/organic analysis | ~$0.01/call |

## Guardrails

- **Cost gate**: Estimate shown if batch exceeds $1
- **No purchases**: Read-only analysis
- **API choice**: Uses `live/regular` (cheaper than `live/advanced`)
- **Key security**: Never print, log, or commit API keys
