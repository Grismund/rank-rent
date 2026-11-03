# Domain Naming Rules

All domain proposals must follow these rules. The `rr-domains` skill references this file.

## Format

- **Service + area** in the domain name
- Examples: `dallasplumberpro.com`, `plumberdallastx.com`, `mckinneyroofers.com`

## TLD priority

1. `.com` — always try first
2. `.net` — acceptable fallback
3. `.co` — acceptable fallback
4. Other TLDs — avoid unless .com/.net/.co are all taken or overpriced

## Rules

- **No trademarks**: never include brand names, franchise names, or trademarked terms (e.g., no "roto-rooter", "home-depot")
- **No hyphens** if possible; one hyphen acceptable if the unhyphenated version is taken
- **Under 25 characters** (excluding TLD) — shorter is better for memorability and type-in traffic
- **Easy to spell**: avoid unusual spellings, double letters that confuse, or words that sound alike ("right" vs "write")
- **No numbers** unless they're part of the area identity (e.g., "972" for DFW area code)

## Proposal format

For each candidate, propose 3 names ranked by preference:

1. Best option (shortest, cleanest, .com)
2. Alternate phrasing
3. Fallback (different TLD or slight variation)

Check all 3 for availability before presenting to the operator. Show a table:

| # | Domain | Available | Price |
|---|--------|-----------|-------|

## Post-purchase

- **Enable auto-renew immediately** after every purchase (Cloudflare defaults it to off)
- Set DNS to Cloudflare (automatic if purchased through Cloudflare)
- Record in `data/sites.csv`: domain, registrar, renewal date
