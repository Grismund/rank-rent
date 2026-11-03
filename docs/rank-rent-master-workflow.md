# Rank & Rent Master Workflow

Nov 1, 2026 · @Seth Faerber

## How this works

Claude runs 19 skills across eight stages; you set things up once and then hold three gates: what to buy, what goes live, and who rents it. Research and building are the slow parts today, and both become one command each.

The Phase sections below describe each skill. Weekly review feeds the next research batch, so the loop repeats with each new set of niches.

## Integration map

Yes, Claude can connect to everything the research and build need. The only steps it can't do are creating accounts, solving CAPTCHAs, and making sales calls. DataForSEO is the one paid data source to start with: it covers search volume, live Google results, Google Maps listings, and backlinks, all pay-per-call.

| Tool | What Claude gets from it | How Claude connects | Cost | Verdict |
| --- | --- | --- | --- | --- |
| [DataForSEO](https://dataforseo.com/keyword-planner-api) | Keyword volumes (Google Ads data), live organic results, Google Maps listings, backlinks | Official MCP server, or its REST API from a script | $50 first deposit; volumes $0.09 per call (up to 1,000 keywords); live results and Maps ~$0.002 each; backlinks ~$0.02 per call plus rows | **Primary research engine** |
| [Cloudflare Registrar API](https://developers.cloudflare.com/registrar/registrar-api/) | Name ideas, availability and price checks, registration | REST API (beta) from a script the skill runs | At cost, about $10-11 per .com; privacy free | **Primary domain buyer** |
| Cloudflare Pages + Workers | Hosting, deploys, DNS, a small call-routing worker | `wrangler` CLI + an API token | Free tier | **Hosting** |
| [Porkbun API](https://porkbun.com/llms/guides/register-a-domain) | Same as Cloudflare, plus a dry-run and a monthly spend cap | Official MCP server or REST | About $10-11 per .com | Backup registrar |
| Twilio | Buy local numbers, set forwarding and recording, read call logs | REST API or CLI (the Twilio connector in the claude.ai directory only searches docs) | $1.15 per number per month plus minutes | **Phone numbers** |
| [Google Search Console](https://www.enrichlabs.ai/blog/google-search-console-mcp-2026) | Impressions, queries, indexing status, sitemap submission | Community MCP server using a read-only service account; Google has no official one | Free | **Rank tracking** |
| Bing Webmaster Tools + IndexNow | Indexing in Bing, which ChatGPT and Copilot search draw on | API key; IndexNow through Cloudflare | Free | Set up once |
| [Mangools](https://apidocs.mangools.com/) | The same kinds of data, in a friendlier interface | REST API; quotas tied to your plan | About $29-49 a month | Optional, for eyeballing |
| Ahrefs or Semrush | Deeper keyword and backlink data | Connectors in the claude.ai directory | Ahrefs MCP access starts around [$129 a month](https://contextbolt.com/blog/ahrefs-mcp-pricing/) | Skip for now |
| GoDaddy connector | Quick availability checks inside chat | claude.ai connector, no login | Free | Convenience only |
| Web search and fetch | Town facts, local regulations, permit offices, link prospects | Built in | Free | **Local research** |

DataForSEO [dropped its old $100 monthly minimum for backlinks](https://dataforseo.com/update/pricing-update-in-dataforseo-apis) in 2026, so all of it is pay-as-you-go. My estimate from the per-call prices: scoring 30 candidates costs about $3-5.

**Where the skills run.** The skills live in a git repo and run in Claude Code on your laptop, not in this chat. They need to call these APIs, run `wrangler`, and write files, and this chat's sandbox can't reach most outside sites. This Project chat stays the place for planning and reviewing, and can run research too if DataForSEO's hosted server works as a custom connector (Phase 1 tests that).

## Phase 0 — Your setup checklist

About two hours, done once. Claude can't create accounts or enter payment details, so this part is yours. Put every key in one env file on your laptop, never in the repo or in chat.

**Accounts and keys**

- [x] Make a dedicated Gmail for the business. Lead forms, call-recording emails, and tool sign-ups go there.
- [x] **DataForSEO:** sign up, verify email, deposit $50, leave auto top-up off. Copy the API login and API password from the dashboard's API access page.
- [ ] **Cloudflare:** create the account and add a card. In Registrar, set a default registrant contact (the API uses it for every purchase). Note your Account ID.
- [x] **Cloudflare API token** with these permissions: Registrar edit, Zone edit, DNS edit, Cloudflare Pages edit, Workers Scripts edit.
- [x] **Twilio:** sign up and upgrade out of trial (trial numbers play a trial message). Add about $20. Copy the Account SID and Auth Token.
- [x] **Google Cloud:** create a project named `rank-rent`. Enable the Search Console API and the Site Verification API. Create a service account and download its JSON key.
- [ ] **Google Search Console:** sign in with the business Gmail. Nothing to add yet.
- [x] **Bing Webmaster Tools:** sign in, then create an API key under Settings, API access.
- [x] **Resend** (free tier): sign up and create an API key. Site contact forms email you through it.
- [x] **GitHub:** create a private repo named `rank-rent`.
- [ ] Optional: Porkbun account with API access and a monthly spend cap, as a backup registrar.

**On your laptop (the Claude Code environment)**

- [x] Node 20 or newer, git, and the GitHub CLI.
- [x] `npm i -g wrangler`, then `wrangler login`.
- [x] Create `~/.config/rank-rent/.env` with the keys above.
- [x] Add `.env` and `.json` keys to the repo's `.gitignore`.
- [x] Clone the repo and open Claude Code in it.
- [x] Add the DataForSEO MCP server to Claude Code: `claude mcp add dataforseo -e DATAFORSEO_USERNAME=… -e DATAFORSEO_PASSWORD=… -- npx -y dataforseo-mcp-server`
- [x] Tell me when it's done. I'll write the smoke-test script for Phase 1.

## Phase 1 — Claude's connectivity smoke tests

One Claude Code session, under $0.10 of DataForSEO credit, and nothing is bought. Each test runs one sample query with a placeholder service and town; it proves the connection works and says nothing about any niche. Claude writes the findings to `docs/connectivity-report.md` with a pass or fail per row.

| # | Test | Pass looks like | If it fails |
| --- | --- | --- | --- |
| 1 | DataForSEO volumes for 10 sample phrases in one metro area | Monthly volume and CPC for each phrase | Check login; try Mangools as the fallback |
| 2 | Live Google results for one service + town phrase | Top 10 URLs, plus whether ads and a map pack appear | Switch from live to queued mode |
| 3 | Google Maps listings for one service + town phrase | Business names, phones, websites, review counts | Use web search plus manual counts |
| 4 | Backlink summary for one ranking competitor | Rank score and referring-domain count | Use Ahrefs' free checker by hand |
| 5 | Cloudflare availability check on 3 names | Available or not, with price. **No purchase.** | Check token permissions; fall back to Porkbun |
| 6 | Deploy a hello-world page to a `pages.dev` address | Page loads over HTTPS | Re-run `wrangler login` |
| 7 | Twilio search for available 469 and 972 numbers | A list of numbers. **No purchase.** | Check SID and token |
| 8 | Search Console via the service account | Lists properties (empty is fine) | Re-share the property or re-download the key |
| 9 | Site Verification API dry run | Returns a DNS verification token | You verify each site by hand (one minute each) |
| 10 | Bing Webmaster API | Returns your site list | Submit sitemaps by hand |
| 11 | DataForSEO as a custom connector in this Project | Research runs from chat too | Research stays in Claude Code only |

Test 9 decides how much of indexing is automatic. If Claude's service account can verify sites itself, launch is hands-off; if not, you click Verify once per site.

## Phase 2 — Opportunity research skills

Four skills turn a seed list into a ranked shortlist you approve at Gate 1. They all score against one shared file, `reference/rubric.md`, which holds the playbook's 8-signal rubric (pass at 11 of 16, walk away under 8) so the scoring never drifts between runs.

| Skill | What it does | Writes | Tools |
| --- | --- | --- | --- |
| `rr-discover` | Builds candidates from data, not hunches: a broad catalog of home-service sub-niches crossed with every town over a population floor in the target region. Generates 5-10 search phrases per combo. Drops licensed trades and franchise-dominated niches up front. | New rows in `data/candidates.csv` | Seed lists, web search |
| `rr-validate` | Pulls volume for every phrase in one batched call. Checks live results and the map pack for the top 2 phrases. Counts directories in the top 5, ads, and renters on Maps. Scores all 8 signals and estimates monthly calls. Shows the cost first if a batch would exceed $1. | Scores and evidence per candidate; raw results in `research/<candidate>/` | DataForSEO |
| `rr-teardown` | For candidates scoring 11+: audits the top 3-4 organic results. Records rank score, links to the ranking page, pages indexed, whether the phrase is in the domain, title, URL, and H1, heading quality, and mistakes like thin copy or no HTTPS. | `research/<candidate>/teardown.md` | DataForSEO, page fetch |
| `rr-shortlist` | Ranks the survivors and writes a one-page decision memo: why each one wins, estimated calls, estimated rent, renter count, proposed domain names, and total spend. Ends with the Gate 1 question. | `research/shortlist-<date>.md` | None |

You run it as one command that names a region, plus any service categories to exclude. Claude chains discover, validate, teardown, and shortlist, and stops at the memo.

## Phase 3 — Niche and local-area research skills

These skills produce the real local facts that keep location pages out of Google's doorway-page and scaled-content spam categories. Town and niche research is cached and reused, so the tenth site in a region is much cheaper to research than the first.

| Skill | What it does | Writes | Reused by |
| --- | --- | --- | --- |
| `rr-niche-brief` | Sub-services, materials, cost ranges with sources, the job process, common questions (from Google's People Also Ask), regulations, seasonality. | `research/niches/<niche>.md` | Every site in that niche |
| `rr-local-facts` | Per town: county, population, growth, main roads and landmarks, neighborhoods, city rules and permits that apply to the niche, with the permit office, HOA versus unincorporated land, soil and weather notes, distance to the main city. Every fact carries a source link. | `research/areas/<town>.md` | Every site serving that town |
| `rr-keywords` | Maps search phrases to pages: home, one page per sub-service, one per town, FAQ, cost guide. Assigns each page its title, H1, URL slug, and target phrase, and flags two pages chasing the same phrase. | The page plan in `sites/<domain>/site.yaml` | `rr-site-build`, `rr-content` |
| `rr-renters` | Pulls every business on Google Maps doing the work in the service area: name, phone, website, rating, review count, and a note on how weak their website is. | `data/buyers.csv` | `rr-pitch-prep` |

`rr-renters` runs early, inside validation, as a quick count. The full list is built here, after Gate 1, so you only pay for it on sites you're actually building.

## Phase 4 — Batch domain buying and site building

After you approve a shortlist, one command buys the domains and numbers and builds every site to the same SEO standard. No site deploys until it passes the automated audit.

| Skill | What it does | Guardrail |
| --- | --- | --- |
| `rr-domains` | Proposes 3 names per winner using the naming rules (service plus area, .com first, no trademarks). Checks them all in one batch and shows a table of name, price, and total. Registers only the names you approve, then **turns auto-renew on**, because the Cloudflare API defaults it to off. | Never buys without your yes naming the exact domains and total |
| `rr-phone` | Finds a local number in the site's area code, buys it on your yes, and points it at the call router in voicemail mode. | Same approval rule |
| `rr-site-build` | Generates the site from the shared Astro template and the site's `site.yaml`. Includes sitemap, robots file, Service and FAQ schema, click-to-call header, contact form, privacy page, and the footer line "We connect homeowners with independent local contractors." | No LocalBusiness schema with a fake address |
| `rr-content` | Writes each page from the niche brief, town fact sheets, and page plan. Home page 800-1,500 words; service and town pages 500-1,000. Every town page must use at least 3 facts from that town's sheet. | No invented years in business, licenses, crews, or reviews |
| `rr-seo-audit` | The pass/fail gate. Checks titles under 60 characters, exactly one H1, phrase alignment, word counts, internal links, near-duplicate town pages, valid schema, robots not blocking crawlers, mobile speed, phone in the header, and banned claims. | A failing site cannot deploy |

**One-time build: the call router.** A small Cloudflare Worker answers every tracking number. Each number is in voicemail mode (recording notice, neutral greeting, recording emailed to you) or forward mode (whisper "Lead from <site>", connect to the client, email the recording to both of you). Switching a site to a client is one config change, never a site edit.

Batch mode chains it: approve 5 winners, and Claude buys 5 domains and 5 numbers, builds 5 sites, audits them, and hands you Gate 2 with a report per site.

## Phase 5 — Launch, grow, and sell

After Gate 2, launch is automatic. Growth runs as one weekly session where Claude prepares the work and you do the parts that need a human account or a phone call.

| Skill | What it does | Your part |
| --- | --- | --- |
| `rr-deploy` | Deploys to Cloudflare Pages, attaches the domain, confirms HTTPS and a mobile speed check. | None |
| `rr-index` | Adds the verification record in DNS, submits the sitemap to Search Console and Bing, turns on IndexNow. | Click Verify if Phase 1 test 9 failed |
| `rr-links` | The copycat method: pulls backlinks of 10 sites ranking for the same service in other cities, sorts them into free self-serve links you can copy, and builds the week's worklist of 5-10 targets with URLs. Tracks what's done in `data/links.csv`. | Submit them; directory sign-ups and CAPTCHAs are yours |
| `rr-weekly-review` | Per site: impressions, phrases, and position from Search Console; calls from Twilio. Suggests one page to add or improve per site. Flags any site with no impressions by month 6 for you to kill. | Read a one-screen summary |
| `rr-pitch-prep` | When a site has a call log worth pitching, builds the call sheet: the 10 best renters, their weak spots, last month's call count, and the script with the numbers filled in. | Make the calls |
| `rr-route` | Moves a number between voicemail, trial, and paid client, and sends the trial client a welcome email explaining the whisper and recordings. | Approve each switch |

Billing, contracts, and the trial-close conversation stay with you. Add a Stripe skill later, once the first client pays.

## Repo layout and data model

One repo holds the skills, the shared rules, the research, and every site. Each site is a `site.yaml` plus generated pages, built from one template and deployed as its own Pages project. Plain CSV and YAML files are the source of truth because skills read and write them reliably; a dashboard view can come later.

```txt
rank-rent/
  .claude/skills/rr-*/SKILL.md     one folder per skill
  reference/
    rubric.md                      8-signal scoring, thresholds
    seo-standards.md               page list, headings, keyword alignment
    content-rules.md               word counts, local facts, banned claims
    naming-rules.md                domain naming
  data/
    candidates.csv                 every niche x area scored
    sites.csv                      domain, registrar, renewal, number, status, client
    buyers.csv                     renters per niche and area
    links.csv                      backlink targets and status
  research/
    niches/<niche>.md
    areas/<town>.md
    <candidate>/                   raw results, teardown
  template/                        the Astro site
  sites/<domain>/site.yaml         niche, towns, phone, page plan
  workers/call-router/             tracking-number Worker
  docs/connectivity-report.md
```

`data/sites.csv` uses the playbook's tracker columns: site, niche, area, domain, registrar, renewal date, tracking number, forwarding target, launch date, first impression, first call, monthly calls, client, price, start date, payment status.

## Costs, guardrails, and order of operations

Running 5 sites should cost about $25 a month plus about $55 a year in domains, after a one-time $50 DataForSEO deposit. These are my estimates from the published per-unit prices.

| Item | Cost for 5 sites |
| --- | --- |
| DataForSEO research and weekly link pulls | About $5-10 a month |
| Twilio: 5 numbers plus minutes | About $10-15 a month |
| Domains at Cloudflare | About $55 a year |
| Hosting, Search Console, Bing, Resend | Free tiers |

**Guardrails built into the skills**

- No domain or phone number is bought without your yes naming the exact items and total.
- Any research batch over $1 shows its cost and waits for you.
- Auto-renew is set on explicitly after every domain purchase.
- `rr-seo-audit` blocks deploys with near-duplicate town pages or invented claims.
- Keys live only in your env file; skills never print them.
- Human-only: creating accounts, CAPTCHAs, directory sign-ups, calls to businesses, billing.

**Order of operations**

1. **This week, you:** Phase 0 checklist, about two hours.
2. **Next session, Claude:** Phase 1 smoke tests, then the four `reference/` files from your playbook.
3. **Claude:** build the Phase 2 skills and run the first research batch of about 30 candidates in a region you choose. You get the shortlist memo.
4. **You:** Gate 1 on 3-5 winners.
5. **Claude:** build the Phase 3 and 4 skills using those real winners as the test cases, plus the call router. You get Gate 2.
6. **Claude:** launch, then build the Phase 5 skills while the sites wait to be indexed.
7. **Weekly:** one 2-hour session for review and links. Start the next research batch once the first sites show impressions.

Each skill gets built against real data, never in the abstract, so the first batch of sites is also the test suite.

## Sources

- [DataForSEO Keyword Planner API pricing](https://dataforseo.com/keyword-planner-api)
- [DataForSEO Google Maps SERP pricing](https://dataforseo.com/pricing/google-serp/google-maps-serp-api)
- [DataForSEO pricing update removing the backlinks minimum](https://dataforseo.com/update/pricing-update-in-dataforseo-apis)
- [Cloudflare Registrar API docs](https://developers.cloudflare.com/registrar/registrar-api/)
- [Cloudflare Registrar API beta announcement](https://blog.cloudflare.com/registrar-api-beta)
- [Porkbun agent registration guide](https://porkbun.com/llms/guides/register-a-domain)
- [Mangools API docs](https://apidocs.mangools.com/)
- [Google Search Console MCP options, 2026](https://www.enrichlabs.ai/blog/google-search-console-mcp-2026)
- [Ahrefs MCP pricing](https://contextbolt.com/blog/ahrefs-mcp-pricing/)
- Rank & Rent Playbook and the two Kyle interview transcripts (provided)
