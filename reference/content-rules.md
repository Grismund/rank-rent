# Content Rules

All content generation and audits must follow these rules. Skills reference this file — do not hardcode these rules inline.

## Word counts

| Page type | Minimum | Maximum |
|-----------|---------|---------|
| Home page | 800 | 1,500 |
| Service page | 500 | 1,000 |
| Town/area page | 500 | 1,000 |
| FAQ page | 400 | 1,000 |
| Cost guide | 500 | 1,000 |
| Informational guide | 600 | 1,500 |
| Tool page (copy around the tool) | 300 | 800 |
| About / How It Works | 300 | 800 |

## Local facts requirement

- Every town page must use **at least 3 facts** from that town's research sheet (`research/areas/<town>.md`)
- Facts must be specific and verifiable: county name, population, neighborhoods, landmarks, local regulations, permit offices, etc.
- Generic filler ("conveniently located in the heart of town") does not count as a local fact
- Each fact should carry a source link when available

## Near-duplicate prevention

- No two town pages may share more than 40% of their non-boilerplate content
- Town pages must differ in: local facts used, neighborhoods mentioned, specific regulations, and at least one unique paragraph
- **Across sites in the same niche**, no page pair may exceed 0.75 similarity (fail) and pairs above 0.60 are flagged (warn). Pack outlines define structure, not sentences — never reuse a paragraph across sites; re-express cost ranges and process steps per site.
- The `rr-seo-audit` skill checks both within-site and cross-site near-duplicates before deploy (see `ranking-playbook.md` §1)

## Banned claims

These must never appear in any generated content:

- **No invented years in business** ("serving Dallas since 2015")
- **No fake licenses or certifications** ("licensed and insured", "certified technicians")
- **No invented crew sizes** ("our team of 20 professionals")
- **No fabricated reviews or testimonials**
- **No fake awards or rankings** ("voted #1 in Dallas")
- **No health or safety claims** without sourced evidence
- **No guarantees** ("100% satisfaction guaranteed") unless the renter explicitly provides one

## Allowed positioning

Sites position as lead-generation services connecting homeowners with local contractors. Acceptable language:

- "We connect homeowners with independent local contractors"
- "Get connected with experienced [service] professionals in [town]"
- "Request a quote from local [service] providers"

## Tone and style

- Professional, helpful, and straightforward
- No salesy superlatives ("the best", "amazing", "incredible")
- No urgency pressure ("call now before it's too late")
- Write for a homeowner who knows they need the service but wants to understand the process and cost
- Use active voice
- Short paragraphs (3–4 sentences max)

## Content structure per page type

### Home page
1. H1 with primary keyword
2. Brief intro (what service, where, who it's for)
3. List of services offered (links to service pages)
4. Areas served (links to town pages)
5. How it works (3-step process)
6. Call to action with phone number

### Service page
1. H1 with service + area keyword
2. What the service involves
3. Common problems it solves
4. Cost range (from niche brief, with "costs vary" disclaimer)
5. The process (what to expect)
6. Call to action

### Town page
1. H1 with service + town keyword
2. Brief intro tying service to town
3. Local facts (minimum 3)
4. Common local issues relevant to the service
5. Permits and rules: whether a permit is needed in this jurisdiction, the issuing office, HOA/land-use note — with source link (say so and cite it if no permit is required)
6. Which 1–2 sub-services this town skews toward and why, linking to those pages
7. Service logistics: distance/response from hub city, named neighborhoods and corridors
8. At least one paragraph that could not be moved to another town page and still be true
9. Call to action

If the town's facts sheet cannot support steps 5–8, cut the town from the page plan rather than pad it. See `ranking-playbook.md` §2.

### Tool page
1. H1 with tool keyword (e.g. "[Service] Cost Calculator — [City]")
2. One-paragraph explanation of what the tool estimates and its inputs
3. The tool (Astro island)
4. How the estimate was built (sources from the niche brief), "costs vary by contractor" note
5. 3–5 FAQs the tool raises (FAQPage schema)
6. Call to action
