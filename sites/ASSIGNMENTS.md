# Site Assignments

Explicit design assignments for the 18 Gate-1 sites so uniqueness constraints hold by construction. `rr-site-build` reads this file and writes the `design:` block into each `site.yaml`. Seed-driven picks (component variants, copy banks, heading variants, class map) fill the rest and are persisted on first resolve.

Shells, token sets, section-order sets and copy banks are defined in `reference/template-architecture.md` and `reference/niche-design-specs.md`. Nav sets N1–N4 and CTA sets C1–C4 are the entries of each copy bank in listed order.

## Constraints satisfied by this table

- Within a niche: no two sites share shell + token set.
- Within a city: no two sites share a shell (Conroe ×3, Goodyear ×3, New Braunfels ×2, Cape Coral ×2, Port St. Lucie ×2).
- Portfolio-wide: shell + token + nav set unique; no shell used more than 5 times.
- Launch waves: ≤ 4 sites per week; never two sites of the same niche in the same wave.

## Assignments

| Site dir | Niche | City, ST | Shell | Tokens | Home / Service / Town order | Nav | CTA | Disclosure | Wave |
|---|---|---|---|---|---|---|---|---|---|
| epoxy-flooring-fort-myers | epoxy-flooring | Fort Myers, FL | A | epoxy-flooring-1 | O1 / O1 / O2 | N1 | C1 | 1 | 1 |
| epoxy-flooring-orlando | epoxy-flooring | Orlando, FL | B | epoxy-flooring-2 | O2 / O2 / O1 | N2 | C2 | 2 | 2 |
| epoxy-flooring-miami | epoxy-flooring | Miami, FL | C | epoxy-flooring-1 | O3 / O1 / O3 | N3 | C3 | 3 | 3 |
| epoxy-flooring-san-antonio | epoxy-flooring | San Antonio, TX | D | epoxy-flooring-2 | O1 / O3 / O1 | N4 | C4 | 4 | 4 |
| epoxy-flooring-new-braunfels | epoxy-flooring | New Braunfels, TX | A | epoxy-flooring-2 | O2 / O2 / O3 | N3 | C2 | 2 | 5 |
| bathroom-remodel-conroe | bathroom-remodel | Conroe, TX | A | bathroom-remodel-1 | O3 / O1 / O1 | N2 | C3 | 3 | 1 |
| bathroom-remodel-palm-bay | bathroom-remodel | Palm Bay, FL | B | bathroom-remodel-1 | O1 / O2 / O2 | N4 | C1 | 1 | 2 |
| bathroom-remodel-new-braunfels | bathroom-remodel | New Braunfels, TX | C | bathroom-remodel-2 | O2 / O3 / O3 | N1 | C4 | 4 | 3 |
| bathroom-remodel-goodyear | bathroom-remodel | Goodyear, AZ | D | bathroom-remodel-2 | O3 / O2 / O1 | N3 | C2 | 2 | 4 |
| window-tinting-goodyear | window-tinting | Goodyear, AZ | B | window-tinting-2 | O3 / O3 / O2 | N1 | C4 | 4 | 1 |
| window-tinting-cape-coral | window-tinting | Cape Coral, FL | D | window-tinting-1 | O2 / O1 / O3 | N2 | C1 | 1 | 2 |
| window-tinting-conroe | window-tinting | Conroe, TX | C | window-tinting-1 | O1 / O2 / O1 | N4 | C2 | 2 | 3 |
| junk-removal-port-st-lucie | junk-removal | Port St. Lucie, FL | B | junk-removal-1 | O1 / O1 / O3 | N3 | C3 | 3 | 1 |
| junk-removal-georgetown | junk-removal | Georgetown, TX | D | junk-removal-2 | O2 / O3 / O2 | N1 | C1 | 1 | 4 |
| kitchen-remodel-goodyear | kitchen-remodel | Goodyear, AZ | A | kitchen-remodel-1 | O2 / O3 / O2 | N4 | C4 | 4 | 2 |
| pool-builders-port-st-lucie | pool-builders | Port St. Lucie, FL | C | pool-builders-1 | O2 / O2 / O2 | N2 | C1 | 1 | 4 |
| paver-sealing-cape-coral | paver-sealing | Cape Coral, FL | A | paver-sealing-2 | O3 / O3 / O1 | N1 | C3 | 3 | 5 |
| pressure-washing-conroe | pressure-washing | Conroe, TX | D | pressure-washing-1 | O1 / O1 / O2 | N3 | C4 | 4 | 5 |

Order sets for `guide`, `cost_guide`, `faq`, `tool` are seed-picked.

## Proposed brands

Three per site, in order of preference. **Proposals only** — before any is set in `site.yaml` the operator must (a) run `rr-domains` for availability under `naming-rules.md`, (b) check USPTO TESS and the state business registry for conflicts, (c) confirm no existing local business uses the name. Names deliberately avoid a shared pattern; do not "fix" them into a series.

| Site dir | 1 | 2 | 3 |
|---|---|---|---|
| epoxy-flooring-fort-myers | Fort Myers Floor Coatings | Southwest Florida Epoxy | Gulf Coast Garage Floors |
| epoxy-flooring-orlando | Orlando Epoxy Works | Central Florida Floor Coating | Orange County Garage Floors |
| epoxy-flooring-miami | Miami Garage Floor Co. | Magic City Epoxy | South Florida Floor Coatings |
| epoxy-flooring-san-antonio | Alamo City Epoxy | San Antonio Floor Coatings | Bexar Garage Floors |
| epoxy-flooring-new-braunfels | Comal Epoxy Floors | New Braunfels Floor Coatings | Hill Country Garage Floors |
| bathroom-remodel-conroe | Conroe Bath Remodeling | Montgomery County Bath Design | Lake Conroe Bath & Tile |
| bathroom-remodel-palm-bay | Palm Bay Bath Renovations | Space Coast Bathroom Remodel | Brevard Bath Works |
| bathroom-remodel-new-braunfels | New Braunfels Bath Works | Hill Country Bathroom Remodel | Comal Bath & Shower |
| bathroom-remodel-goodyear | Goodyear Bath Remodel Co. | West Valley Bathroom Renovations | Estrella Bath & Tile |
| window-tinting-goodyear | West Valley Window Tinting | Goodyear Tint Co. | Estrella Tint |
| window-tinting-cape-coral | Cape Coral Window Tinting | Gulf Shore Tint | Lee County Tint Co. |
| window-tinting-conroe | Conroe Tint Works | Montgomery County Window Tint | North Houston Tint |
| junk-removal-port-st-lucie | Port St. Lucie Junk Haulers | Treasure Coast Junk Removal | PSL Hauling |
| junk-removal-georgetown | Georgetown Junk Removal | Williamson County Haul Away | Georgetown Haul & Clear |
| kitchen-remodel-goodyear | Goodyear Kitchen Remodeling | West Valley Kitchen Design | Litchfield Kitchen Works |
| pool-builders-port-st-lucie | Port St. Lucie Pool Builders | Treasure Coast Pools | St. Lucie Custom Pools |
| paver-sealing-cape-coral | Cape Coral Paver Sealing | Gulf Coast Paver Care | Lee County Paver Sealing |
| pressure-washing-conroe | Conroe Pressure Washing | Lake Conroe Power Wash | Montgomery County Exterior Cleaning |

Note: "Space Coast" and "Treasure Coast" are regional names in common use, not marks, but verify. Avoid "Sun City" (Del Webb mark) anywhere near Georgetown.

## Tool slugs and hero picks

| Site dir | Tool type | Tool slug | Hero |
|---|---|---|---|
| epoxy-flooring-fort-myers | epoxy-cost-estimator | /garage-floor-cost-calculator/ | two-car flake wide |
| epoxy-flooring-orlando | epoxy-cost-estimator | /epoxy-floor-cost-estimator/ | metallic close-up |
| epoxy-flooring-miami | epoxy-cost-estimator | /garage-floor-coating-calculator/ | two-car flake wide |
| epoxy-flooring-san-antonio | epoxy-cost-estimator | /epoxy-garage-floor-estimator/ | metallic close-up |
| epoxy-flooring-new-braunfels | epoxy-cost-estimator | /floor-coating-cost-calculator/ | commercial floor |
| bathroom-remodel-conroe | bath-budget-estimator | /bathroom-remodel-cost-calculator/ | walk-in shower |
| bathroom-remodel-palm-bay | bath-budget-estimator | /bath-remodel-budget-estimator/ | vanity wide |
| bathroom-remodel-new-braunfels | bath-budget-estimator | /bathroom-renovation-cost-estimator/ | walk-in shower |
| bathroom-remodel-goodyear | bath-budget-estimator | /bathroom-remodel-budget-calculator/ | vanity wide |
| window-tinting-goodyear | tint-law-and-cost | /arizona-tint-law-and-cost-calculator/ | installer squeegee |
| window-tinting-cape-coral | tint-law-and-cost | /florida-window-tint-calculator/ | SUV rear three-quarter |
| window-tinting-conroe | tint-law-and-cost | /texas-tint-law-checker/ | SUV rear three-quarter |
| junk-removal-port-st-lucie | load-size-estimator | /junk-removal-cost-estimator/ | cleared garage |
| junk-removal-georgetown | load-size-estimator | /how-much-junk-do-i-have/ | loaded truck bed |
| kitchen-remodel-goodyear | kitchen-budget-estimator | /kitchen-remodel-cost-calculator/ | island wide |
| pool-builders-port-st-lucie | pool-cost-estimator | /pool-cost-calculator/ | dusk shot |
| paver-sealing-cape-coral | paver-sealing-estimator | /paver-sealing-cost-calculator/ | half-sealed driveway |
| pressure-washing-conroe | surface-cost-estimator | /pressure-washing-cost-calculator/ | half-cleaned driveway |

Tool page `primary_keyword` is derived by `rr-keywords` from the slug + city and checked for cannibalization against the cost guide (`/cost/`): the tool targets the "calculator / estimator" phrase, the cost guide targets "cost / price" without the calculator modifier.

## Launch waves

| Wave | Sites |
|---|---|
| 1 | epoxy-flooring-fort-myers, bathroom-remodel-conroe, window-tinting-goodyear, junk-removal-port-st-lucie |
| 2 | epoxy-flooring-orlando, bathroom-remodel-palm-bay, window-tinting-cape-coral, kitchen-remodel-goodyear |
| 3 | epoxy-flooring-miami, bathroom-remodel-new-braunfels, window-tinting-conroe |
| 4 | epoxy-flooring-san-antonio, bathroom-remodel-goodyear, junk-removal-georgetown, pool-builders-port-st-lucie |
| 5 | epoxy-flooring-new-braunfels, paver-sealing-cape-coral, pressure-washing-conroe |

One wave per week after Gate 2. `rr-deploy` refuses a site whose wave is ahead of the current week unless the operator overrides.
