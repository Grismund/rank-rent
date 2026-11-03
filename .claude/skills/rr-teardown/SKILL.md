# rr-teardown

**Purpose:** Audit the top 3–4 organic competitors for validated candidates scoring 11+ to determine if the niche × area is beatable.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| Filter | No | `status=validated AND score_total >= 11` | Which candidates to tear down |

## Procedure

### 1. Load candidates

- Read `data/candidates.csv` using `parseCandidatesCsv` from `lib/candidates.js`
- Filter to `status=validated` and `score_total >= 11` (or user-specified filter)
- If no candidates match, report and stop

### 2. Cost gate

- Call `estimateTeardownCost(candidates)` from `lib/cost-estimator.js`
- If estimated cost > $1, display breakdown and **wait for user approval**
- Show: number of candidates, competitors per candidate, backlink calls, total estimated cost

### 3. Identify competitors

- Load `research/<slug>/validation-data.json` for each candidate
- Extract the top 3–4 non-directory organic results from the SERP data
- Use `isDirectoryDomain()` from `lib/candidates.js` to filter out directories
- If fewer than 3 non-directory results, include all available

### 4. Pull backlink data

For each competitor URL:
- API: `POST /v3/backlinks/summary/live`
- Payload:
  ```json
  [{
    "target": "competitor-domain.com",
    "internal_links_limit": 0,
    "backlinks_status_type": "live"
  }]
  ```
- Extract: total backlinks, referring domains, domain rank

### 5. On-page audit

For each competitor URL, fetch the page via **WebFetch** and check:

| Check | What to look for |
|-------|-----------------|
| Keyword in domain | Does the domain contain the niche or area keyword? |
| Keyword in title | Is the target phrase in the `<title>` tag? |
| Keyword in URL | Is the phrase in the URL path? |
| Keyword in H1 | Is there a keyword-relevant H1? |
| Heading hierarchy | Do headings follow H1 → H2 → H3 without skips? |
| Content length | Approximate word count of main content |
| HTTPS | Is the site served over HTTPS? |
| Phone visible | Is a phone number prominently displayed? |
| Mobile-friendly | Is there a viewport meta tag? |

Note weaknesses for each competitor.

### 6. Write teardown report

Write `research/<slug>/teardown.md` with:

```markdown
# Teardown: {niche} in {area}

## Competitor Summary

| # | Domain | Backlinks | Ref. Domains | Domain Rank | Keyword in Domain | Keyword in Title | HTTPS | Content Words | Weaknesses |
|---|--------|-----------|--------------|-------------|-------------------|------------------|-------|---------------|------------|

## Backlink Gap

- Median referring domains among competitors: N
- Estimated effort to match: [low/medium/high]

## Weaknesses Found

- [List specific weaknesses across competitors]

## Verdict: [BEATABLE / TOUGH / SKIP]

[1–2 sentence justification]
```

Verdict criteria:
- **BEATABLE**: Majority of competitors have < 50 referring domains, thin content, or poor on-page SEO
- **TOUGH**: Competitors are solid but have some exploitable gaps
- **SKIP**: All competitors are strong with 100+ referring domains and solid on-page SEO

### 7. Update CSV

- Set `status=torn_down`
- Set `teardown_date` to today (YYYY-MM-DD)
- If verdict is SKIP, set `status=walk_away`

## Outputs

| Path | Description |
|------|-------------|
| `data/candidates.csv` | Updated status and teardown_date |
| `research/<slug>/teardown.md` | Competitor audit report with verdict |

## Tools

- **DataForSEO MCP** (`mcp__dataforseo__api_request`) — backlink summaries
- **WebFetch** — on-page competitor audits

## Guardrails

- **Cost gate at $1**: Show breakdown and wait for approval if estimate exceeds $1
- **No purchases**: This skill never buys anything
- **Respect robots.txt**: If WebFetch fails on a competitor, note it and move on
- **Max 4 competitors per candidate**: Don't audit more than needed
