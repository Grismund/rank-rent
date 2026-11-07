# Scoring Rubric — 8-Signal Niche Evaluation

## How to use

Score each candidate niche × area on the 8 signals below. Each signal is worth 0, 1, or 2 points (max 16). Skills that score candidates must reference this file, not hardcode thresholds.

## Thresholds

| Score | Decision |
|-------|----------|
| 11–16 | **Pass** — proceed to teardown and shortlist |
| 8–10 | **Marginal** — flag for review, may pass with strong signals elsewhere |
| 0–7 | **Walk away** — do not pursue |

## Signals

### 1. Search volume (0–2)

Monthly search volume for the primary phrase (service + city) from Google Ads data.

| Points | Criteria |
|--------|----------|
| 0 | Under 200/mo |
| 1 | 200–500/mo |
| 2 | Over 500/mo |

### 2. CPC / commercial intent (0–2)

Cost per click indicates advertiser willingness to pay, a proxy for lead value.

| Points | Criteria |
|--------|----------|
| 0 | Under $10 CPC |
| 1 | $10–$40 CPC |
| 2 | Over $40 CPC |

### 3. Map pack weakness (0–2)

How beatable are the businesses in the Google Maps 3-pack?

| Points | Criteria |
|--------|----------|
| 0 | All 3 have 100+ reviews and 4.5+ rating |
| 1 | 1–2 of the 3 are weak (under 50 reviews or under 4.0) |
| 2 | All 3 are weak, or fewer than 3 results appear |

### 4. Organic weakness (0–2)

Quality of the top 5 organic results for the primary phrase.

| Points | Criteria |
|--------|----------|
| 0 | Top 5 are strong local sites with good SEO |
| 1 | 2–3 directories (Yelp, Angi, HomeAdvisor) in top 5 |
| 2 | 4+ directories in top 5, or thin/outdated local sites dominate |

### 5. Renter availability (0–2)

Number of businesses doing the work in the area (potential renters).

| Points | Criteria |
|--------|----------|
| 0 | Fewer than 5 businesses on Maps |
| 1 | 5–15 businesses |
| 2 | Over 15 businesses |

### 6. No licensing barrier (0–2)

Whether the trade requires state or local licensing that a lead-gen site cannot represent.

| Points | Criteria |
|--------|----------|
| 0 | Requires a specific trade license to advertise (e.g., electrical, HVAC in some states) |
| 1 | License required but commonly subcontracted or easy to obtain |
| 2 | No licensing barrier — general handyman, cleaning, lawn care, etc. |

### 7. Seasonality (0–2)

How consistent is demand across the year?

| Points | Criteria |
|--------|----------|
| 0 | Demand drops below 30% of peak for 4+ months |
| 1 | Moderate seasonality — demand drops 30–60% of peak for 2–3 months |
| 2 | Year-round demand within 60% of peak |

### 8. Rent potential (0–2)

Estimated monthly rent based on lead value and volume.

| Points | Criteria |
|--------|----------|
| 0 | Estimated rent under $200/mo |
| 1 | $200–$500/mo |
| 2 | Over $500/mo |

Estimated rent = (monthly search volume × estimated CTR × lead conversion rate × lead value) ÷ markup factor. Use conservative estimates: 15% CTR, 10% conversion, lead value from CPC × 5–10.

## Viability gate (post-teardown)

Candidates passing teardown undergo a unit-economics check before shortlisting. This verifies that the niche's average job value and margins can support the estimated rent, and that CPC isn't artificially inflated by bait-and-switch operators. See `rr-viability` skill and `reference/niche-economics.md`.
