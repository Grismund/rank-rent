# rr-niche-brief

**Purpose:** Synthesize existing research into a niche-level editorial brief covering service context, job economics, competitor patterns, and content positioning guidance.

## Inputs

- `niches/<niche>/pack.yaml` — sub-services, page outlines, local variables
- `data/candidates.csv` — filter to `status=packed` for this niche; extract vol_primary, cpc, rent_estimate
- `reference/niche-economics.md` — job values, margins
- `reference/content-rules.md` — allowed positioning, banned claims, tone
- `research/<slug>/teardown.md` — competitor weaknesses per candidate
- `research/<slug>/viability.md` — CPC, break-even math, SERP analysis

## Procedure

1. Identify scope — read candidates.csv, filter to niche + status=packed, list cities
2. Read pack.yaml for sub-service list and local variable definitions
3. Read all teardown.md and viability.md files for the niche's candidates
4. Read niche-economics.md for the niche's row and content-rules.md for positioning guidance
5. Synthesize into brief sections (see output schema below)
6. Show brief to operator for approval
7. Write `niches/<niche>/brief.md`
8. Update candidates.csv: status → `briefed`

## Output

File: `niches/<niche>/brief.md`

```markdown
# Niche Brief: {Display Name}
**Date:** YYYY-MM-DD | **Cities:** city1, city2, ...

## Service Overview
What the service is, who the customer is, typical job triggers.

## Job Economics
Table: avg job value, margin, source (from niche-economics.md)

## Market Snapshot
Table per city: vol_primary, cpc, rent_estimate, competitor count, backlink gap
Summary of which cities are strongest/weakest.

## Competitor Patterns
Cross-city synthesis of teardown findings:
- What types of competitors dominate (franchise, local, lead-gen)
- Common weaknesses (thin content, low backlinks, no local signals)
- Backlink effort estimate

## Content Positioning
- How to frame the service (from content-rules.md allowed positioning)
- Angle for service pages (cost-focused, process-focused, etc.)
- Trust signals that resonate for this niche
- Banned claims reminder

## Sub-Service Editorial Notes
Per sub-service from pack.yaml:
- What the customer needs to know
- How it differs from other sub-services
- Cross-linking guidance

## Keyword Intent Notes
Primary keyword pattern and searcher intent.
Secondary patterns (near me, cost, how-to).
```

## Tools

None — reads existing data only. Zero DataForSEO cost.

## Guardrails

- Operator approval required before writing brief.md
- No fake claims or invented statistics
- All data must trace back to existing research files or reference docs
