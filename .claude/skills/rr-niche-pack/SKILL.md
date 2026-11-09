# rr-niche-pack

**Purpose:** Generate a reusable niche content pack (sub-services, page outlines, guide topics, local variables) shared by all cities in a given niche.

## Inputs

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| Niche slug | Yes | — | Hyphenated niche name, e.g. `junk-removal` |

Reads:
- `data/candidates.csv` — filter to niche, list all cities covered
- `reference/seo-standards.md` — heading and keyword alignment rules
- `reference/content-rules.md` — word counts, local-fact minimums
- `reference/site-design.md` — brand-first design principles, page inventory
- `reference/niche-economics.md` — average job values and margins

## Procedure

### 1. Identify scope

- Read `data/candidates.csv` using `parseCandidatesCsv` from `lib/candidates.js`
- Filter to rows where `niche` matches the input slug (normalize: hyphenate, lowercase, match against candidates.csv niche values)
- List all cities the niche covers
- If no candidates match, report and stop

### 2. Research sub-services

- Use DataForSEO keyword suggestions API for the niche
- Find 3-5 sub-services with **distinct search intent** (each becomes a service page)
- For each sub-service: slug, display name, primary keyword template (`{city}` placeholder), one-sentence intent description
- Estimated cost: ~$0.02-0.05 per niche

### 3. Define page outlines

For each page type (home, service, town, cost guide, FAQ):
- H1 with keyword template variables (`{city}`, `{state}`, `{display_name}`, `{sub_service}`, `{brand}`)
- H2 sections with content guidance
- H3 sub-sections where appropriate — keywords in H2 and H3, not just H1
- Title tag template (under 60 chars per `seo-standards.md`)
- Word count range per `content-rules.md`
- Follow page inventory from `site-design.md`: 10-15 pages total

### 4. Compile guide topics

- 1-2 cost guides with target keywords
- 3-5 FAQ questions sourced from DataForSEO keyword suggestions (questions with search volume)
- FAQ page uses FAQPage schema markup

### 5. Define local variables

Two categories:

**Standard variables** (every niche):
- `neighborhoods` — main neighborhoods/districts in the city
- `permit_requirements` — local permit requirements for the niche
- `local_regulations` — city/county ordinances regulating the niche
- `climate_factors` — how local climate affects niche demand
- `nearby_cities` — neighboring cities a provider would also serve

**Niche-specific variables** (varies by niche):
- 2-4 additional variables unique to this niche
- Each has a `research_question` that `rr-local-facts` will answer per city
- Example for junk removal: `landfill_location`, `recycling_programs`, `hoa_rules`

### 6. Show pack for approval

- Display the complete pack to the operator in a readable format
- Show sub-services, page outlines (with heading structures), guide topics, and local variables
- Wait for explicit operator approval before writing

### 7. Write pack file

- Write `niches/<niche>/pack.yaml` only after operator approval
- Update `data/candidates.csv`: set `status=packed` for all candidates in this niche

## Outputs

| Path | Description |
|------|-------------|
| `niches/<niche>/pack.yaml` | Niche content pack (sub-services, outlines, variables) |
| `data/candidates.csv` | Updated with `status=packed` for niche candidates |

## pack.yaml schema

```yaml
niche: <slug>              # e.g. junk-removal
display_name: <string>     # e.g. Junk Removal
created: <YYYY-MM-DD>

sub_services:
  - slug: <string>
    display: <string>
    primary_keyword: "<service> {city}"
    intent: "<one sentence>"
  # 3-5 entries

page_outlines:
  home:
    h1: "<template>"
    title: "<template>"
    sections:
      - h2: "<heading>"
        content_guidance: "<instructions>"
        h3s: ["<optional sub-headings>"]
    word_count: { min: 800, max: 1500 }
  service:
    # per sub-service page
  town:
    # per town page
  cost_guide:
    # cost guide page
  faq:
    h1: "<template>"
    sections: []  # populated from guide_topics
    word_count: { min: 400, max: 1000 }
    schema: FAQPage

guide_topics:
  - type: cost_guide
    topic: "<question>"
    target_keyword: "<keyword> {city}"
  - type: faq
    questions: ["<q1>", "<q2>", ...]

local_variables:
  standard:
    - var: <name>
      research_question: "<question with {city}, {state}, {niche} placeholders>"
  niche_specific:
    - var: <name>
      research_question: "<question>"
```

## Tools

- **DataForSEO** — keyword suggestions API for sub-service discovery and FAQ questions

## Guardrails

- **Cost:** ~$0.05 DataForSEO per niche. If batch exceeds $0.10, show estimate and wait for approval.
- **Operator approval required:** Never write pack.yaml without explicit approval of the displayed pack.
- **No fake claims:** Sub-services and guide topics must reflect real search demand, not invented services.
- **Normalize niche slug:** Match against `data/candidates.csv` niche values. Use hyphenated lowercase form for directory name (e.g. `bathroom-remodel`, not `bathroom-remodeling`).
