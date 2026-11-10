# rr-local-facts

**Purpose:** Research verifiable, source-cited local facts for each city in the pipeline and write town research sheets consumed by `rr-content`.

## Inputs

- `data/candidates.csv` — filter to `status=briefed`, extract city-niche pairs
- `niches/<niche>/pack.yaml` — `local_variables` section for research questions per niche
- `reference/content-rules.md` — fact minimums and source requirements
- `lib/local-facts.js` — `buildCityNicheMatrix()` for city-niche grouping, `validateFactSheet()` for output validation

## Outputs

- `research/areas/<city-slug>.md` — one fact sheet per city (schema below)
- `data/candidates.csv` — update `status=briefed` → `status=facts_gathered` for researched candidates

## Procedure

1. Parse `candidates.csv` and all `pack.yaml` files
2. Call `buildCityNicheMatrix()` to group cities with their niches and research variables
3. Research one state group at a time (FL → TX → AZ)
4. For each city:
   - **Standard research** (shared across niches): neighborhoods, climate, nearby cities
   - **Niche-specific research** (per niche in city): permits, regulations, niche-specific variables from pack.yaml
   - **Source verification pass**: upgrade non-official sources to .gov/.org where possible via targeted `site:{city}.gov` searches
5. Present state batch for operator approval (summary table with fact counts and source quality)
6. After approval, write `research/areas/<city-slug>.md` files
7. Run `validateFactSheet()` on each file before writing — fix any errors
8. Update `candidates.csv`: `status=briefed` → `status=facts_gathered`

## Output Schema

```markdown
# Local Facts: {City}, {State}

**Researched:** YYYY-MM-DD
**Niches:** niche-1, niche-2, ...
**County:** {county name}
**Population:** {pop} ({year}) — [Source](url)

## City Overview

### Neighborhoods and Districts
- {Name}: {description}. [Source](url)
- ... (minimum 3)

### Climate
- {Fact}. [Source](url)
- ... (minimum 2)

### Nearby Cities
- {City} ({distance/direction})
- ...

## Niche: {niche-slug}

### Permit Requirements
- {Fact}. [Source](url)

### Local Regulations
- {Fact}. [Source](url)

### {Niche-Specific Var 1 Display Name}
- {Fact}. [Source](url)

### {Niche-Specific Var 2 Display Name}
- {Fact}. [Source](url)

### {Niche-Specific Var 3 Display Name}
- {Fact}. [Source](url)
```

## Minimum Fact Counts

- City Overview: 3+ neighborhoods, 2+ climate facts, 3+ nearby cities
- Per niche section: 5+ sourced facts total (permits + regulations + niche-specific vars)
- Grand total per niche-city pair: 10+ facts available (5 shared + 5 niche-specific)

## Source Citation Rules

- Every factual bullet MUST end with an inline hyperlinked source: `[Source Name](url)`
- **Source priority:** city .gov > county .gov > state .gov > .org (chamber, utilities) > census.gov/NOAA/BLS > named local news > national reference sites
- Facts without a findable source get marked `[source needed]` and flagged for operator review
- Never cite social media, forums, AI-generated content, or SEO spam as sources
- Government and official sources are strongly preferred — actively seek them via targeted `site:gov` searches

## Tools

- **WebSearch** — primary research tool for all fact gathering
- **WebFetch** — follow-up on .gov pages to extract precise facts
- Zero DataForSEO cost

## Guardrails

- Operator approval required before writing files (per state batch)
- No invented facts — every local detail must come from a search result
- Source links must be real, clickable URLs (not fabricated)
- Government/official sources preferred and actively sought
- Never commit API keys or credentials
- Cost: $0 DataForSEO spend (WebSearch/WebFetch only)
