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

### 4b. Pull referring domain data

For each competitor domain, fetch detailed backlink source information:

- API: `POST /v3/backlinks/referring_domains/live`
- Payload:
  ```json
  [{
    "target": "competitor-domain.com",
    "backlinks_status_type": "live",
    "order_by": ["rank,desc"],
    "limit": 50
  }]
  ```
- Extract per referring domain: domain name, rank, backlinks count, first_seen date, backlink types

After fetching all competitors, compute:
- **Common sources**: domains that refer to 2+ competitors (high-priority outreach targets)
- **Link building targets**: all referring domains sorted by priority (common sources first, then by rank)

Write `research/<slug>/backlink-sources.json`:
```json
{
  "slug": "<slug>",
  "analyzed_at": "YYYY-MM-DD",
  "competitors": [
    {
      "domain": "competitor.com",
      "summary": { "backlinks": 154, "referring_domains": 99, "rank": 66 },
      "top_referring_domains": [
        {
          "domain": "referrer.com",
          "rank": 450,
          "backlinks": 3,
          "first_seen": "2023-05-12",
          "backlink_types": { "anchor": 2, "image": 1 }
        }
      ]
    }
  ],
  "common_sources": ["domains appearing in 2+ competitor profiles"],
  "link_building_targets": ["prioritized list for outreach"]
}
```

Cost: ~$0.02 per competitor × 50 referring domains. For 3 competitors this adds ~$0.06 per teardown.

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
| `research/<slug>/backlink-sources.json` | Referring domain details for link building strategy |

## Tools

- **DataForSEO MCP** (`mcp__dataforseo__api_request`) — backlink summaries
- **WebFetch** — on-page competitor audits

## Guardrails

- **Cost gate at $1**: Show breakdown and wait for approval if estimate exceeds $1
- **No purchases**: This skill never buys anything
- **Respect robots.txt**: If WebFetch fails on a competitor, note it and move on
- **Max 4 competitors per candidate**: Don't audit more than needed
