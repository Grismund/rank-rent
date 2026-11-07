# rr-viability

**Purpose:** Verify that unit economics and live SERP patterns support the rent estimate for torn-down candidates before shortlisting.

## Quick Start

```bash
node scripts/viability.mjs                          # all torn-down candidates
node scripts/viability.mjs --dry-run                # preview without API calls
node scripts/viability.mjs --filter=slug1,slug2     # specific candidates only
```

The script handles everything: economics lookup, CPC inflation check, SERP analysis, break-even math, report writing, and CSV updates.

## SERP Cache

The script checks `research/<slug>/validation-data.json` for a `serp_items` field before making API calls. If present and < 30 days old, it uses cached data (zero cost). This field is populated by `validate-candidates.mjs` when using `live/regular` for the primary phrase.

## Inputs

| Source | Description |
|--------|-------------|
| `data/candidates.csv` | Filtered to `status=torn_down` |
| `reference/niche-economics.md` | Job value and margin reference table |
| `lib/constants.js` → `DISCOVERED_NICHES` | National avg CPC per niche |

## Procedure

### 1. Load candidates

- Read `data/candidates.csv`, filter to `status=torn_down`
- Apply `--filter` if specified

### 2. Cost gate

- Check SERP cache per candidate (uses `validation-data.json` → `serp_items` if < 30 days old)
- Estimate API cost: $0.01 per uncached candidate
- If total exceeds **$1**, abort

### 3. For each candidate

1. **Job economics** — `lookupJobEconomics(niche, econTable)` from parsed `niche-economics.md`
2. **CPC inflation** — `flagInflatedCPC(localCpc, nationalCpc)`, adjust rent if flagged
3. **SERP data** — load from cache or pull `serp/google/organic/live/regular` (depth 20)
4. **SERP analysis** — `countPaidAds()`, `detectBaitAndSwitch()`, `assessOrganicFragmentation()`
5. **Break-even** — `computeBreakEven(rent, avgJobMidpoint, marginMidpoint)` vs `vol_primary × 0.15`
6. **Verdict** — `assessViability()`: viable/marginal → `status=viable`, fail → `status=walk_away`

### 4. Outputs

| Path | Description |
|------|-------------|
| `data/candidates.csv` | Updated status and viability_date |
| `research/<slug>/viability.md` | Per-candidate viability report |
| `research/<slug>/viability-serp.json` | Raw SERP data (when API called) |

## Guardrails

- **Cost gate**: Estimate shown; aborts if batch exceeds $1
- **SERP cache**: Reuses validation SERP data when available (< 30 days)
- **No purchases**: Read-only analysis
- **Key security**: Never print, log, or commit API keys
