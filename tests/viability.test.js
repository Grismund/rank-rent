import { describe, it, expect } from 'vitest'
import {
  lookupJobEconomics,
  flagInflatedCPC,
  computeBreakEven,
  assessViability,
  countPaidAds,
  detectBaitAndSwitch,
  assessOrganicFragmentation,
} from '../lib/viability.js'

describe('lookupJobEconomics', () => {
  const table = new Map([
    ['junk removal', { avgJobLow: 300, avgJobHigh: 500, marginLow: 0.60, marginHigh: 0.70, notes: 'test' }],
    ['foundation repair', { avgJobLow: 4000, avgJobHigh: 8000, marginLow: 0.30, marginHigh: 0.50, notes: 'test' }],
  ])

  it('returns economics for a known niche', () => {
    const result = lookupJobEconomics('junk removal', table)
    expect(result).toEqual({ avgJobLow: 300, avgJobHigh: 500, marginLow: 0.60, marginHigh: 0.70, notes: 'test' })
  })

  it('returns null for an unknown niche', () => {
    expect(lookupJobEconomics('underwater welding', table)).toBeNull()
  })

  it('is case-insensitive', () => {
    const result = lookupJobEconomics('Junk Removal', table)
    expect(result).not.toBeNull()
    expect(result.avgJobLow).toBe(300)
  })
})

describe('flagInflatedCPC', () => {
  it('returns true when local CPC exceeds threshold × national avg', () => {
    // National avg $20, local $82 → 4.1x → inflated at 2.5x threshold
    expect(flagInflatedCPC(82, 20)).toBe(true)
  })

  it('returns false when local CPC is within threshold', () => {
    // National avg $20, local $40 → 2.0x → not inflated at 2.5x threshold
    expect(flagInflatedCPC(40, 20)).toBe(false)
  })

  it('returns false at exactly the threshold', () => {
    // National avg $20, local $50 → exactly 2.5x → not inflated (must exceed)
    expect(flagInflatedCPC(50, 20)).toBe(false)
  })

  it('supports a custom threshold', () => {
    expect(flagInflatedCPC(40, 20, 1.5)).toBe(true)
    expect(flagInflatedCPC(40, 20, 2.0)).toBe(false)
  })
})

describe('computeBreakEven', () => {
  it('computes jobs needed to cover rent', () => {
    // rent $1200, avg job $400, margin 50% → net per job $200 → 6 jobs
    expect(computeBreakEven(1200, 400, 0.50)).toBe(6)
  })

  it('rounds up to whole jobs', () => {
    // rent $1000, avg job $400, margin 50% → net per job $200 → 5.0 exactly
    expect(computeBreakEven(1000, 400, 0.50)).toBe(5)
    // rent $1001, avg job $400, margin 50% → 5.005 → rounds up to 6
    expect(computeBreakEven(1001, 400, 0.50)).toBe(6)
  })

  it('returns Infinity for zero margin', () => {
    expect(computeBreakEven(1000, 400, 0)).toBe(Infinity)
  })

  it('returns Infinity for zero job value', () => {
    expect(computeBreakEven(1000, 0, 0.50)).toBe(Infinity)
  })
})

describe('assessViability', () => {
  it('returns viable when break-even is under 25% of leads', () => {
    // 4 jobs needed, 40 leads/month → 4/40 = 10% → viable
    expect(assessViability(4, 40)).toBe('viable')
  })

  it('returns marginal when break-even is between 25% and 50% of leads', () => {
    // 12 jobs needed, 40 leads/month → 12/40 = 30% → marginal
    expect(assessViability(12, 40)).toBe('marginal')
  })

  it('returns fail when break-even exceeds 50% of leads', () => {
    // 25 jobs needed, 40 leads/month → 25/40 = 62.5% → fail
    expect(assessViability(25, 40)).toBe('fail')
  })

  it('returns viable at exactly 25% boundary', () => {
    // 10 jobs, 40 leads → exactly 25% → still under (not <, but boundary)
    // Plan says "< 0.25" so at exactly 25% it should be marginal
    expect(assessViability(10, 40)).toBe('marginal')
  })

  it('returns marginal at exactly 50% boundary', () => {
    expect(assessViability(20, 40)).toBe('fail')
  })

  it('returns fail when leads are zero', () => {
    expect(assessViability(5, 0)).toBe('fail')
  })
})

describe('countPaidAds', () => {
  it('counts items with type paid', () => {
    const items = [
      { type: 'paid', title: 'Ad 1' },
      { type: 'organic', title: 'Result 1' },
      { type: 'paid', title: 'Ad 2' },
      { type: 'organic', title: 'Result 2' },
    ]
    expect(countPaidAds(items)).toBe(2)
  })

  it('returns 0 when no paid items', () => {
    const items = [
      { type: 'organic', title: 'Result 1' },
      { type: 'local_pack', title: 'Map result' },
    ]
    expect(countPaidAds(items)).toBe(0)
  })

  it('returns 0 for empty array', () => {
    expect(countPaidAds([])).toBe(0)
  })
})

describe('detectBaitAndSwitch', () => {
  it('flags ads with low-ball price patterns', () => {
    const paidItems = [
      { title: 'Air Duct Cleaning', description: '$85 Whole House Air Duct Cleaning Special!' },
      { title: 'Legit Service', description: 'Professional air duct cleaning starting at $350' },
    ]
    const flagged = detectBaitAndSwitch(paidItems)
    expect(flagged).toHaveLength(1)
    expect(flagged[0].description).toContain('$85')
  })

  it('detects multiple low-ball price points', () => {
    const paidItems = [
      { title: 'Ad 1', description: '$49 air duct cleaning today only' },
      { title: 'Ad 2', description: 'Get $99 whole house cleaning now' },
    ]
    const flagged = detectBaitAndSwitch(paidItems)
    expect(flagged).toHaveLength(2)
  })

  it('does not flag legitimate pricing', () => {
    const paidItems = [
      { title: 'Pro Cleaning', description: 'Air duct cleaning from $350' },
      { title: 'Trusted Service', description: 'Call for a free estimate' },
    ]
    const flagged = detectBaitAndSwitch(paidItems)
    expect(flagged).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(detectBaitAndSwitch([])).toEqual([])
  })
})

describe('assessOrganicFragmentation', () => {
  const platformDomains = [
    'facebook.com', 'instagram.com', 'reddit.com', 'nextdoor.com',
    'youtube.com', 'tiktok.com',
  ]

  it('counts social, dedicated site, and directory results', () => {
    const organicItems = [
      { domain: 'facebook.com' },
      { domain: 'www.facebook.com' },
      { domain: 'yelp.com' },
      { domain: 'localbiz.com' },
      { domain: 'reddit.com' },
      { domain: 'anotherbiz.com' },
    ]
    const directoryDomains = ['yelp.com', 'angi.com', 'thumbtack.com']
    const result = assessOrganicFragmentation(organicItems, platformDomains, directoryDomains)
    expect(result.socialCount).toBe(3) // 2 facebook + 1 reddit
    expect(result.dedicatedSiteCount).toBe(2) // localbiz + anotherbiz
    expect(result.directoryCount).toBe(1) // yelp
  })

  it('returns zeros for empty input', () => {
    const result = assessOrganicFragmentation([], platformDomains, [])
    expect(result.socialCount).toBe(0)
    expect(result.dedicatedSiteCount).toBe(0)
    expect(result.directoryCount).toBe(0)
  })

  it('matches subdomains of platform domains', () => {
    const organicItems = [
      { domain: 'www.reddit.com' },
      { domain: 'm.facebook.com' },
    ]
    const result = assessOrganicFragmentation(organicItems, platformDomains, [])
    expect(result.socialCount).toBe(2)
    expect(result.dedicatedSiteCount).toBe(0)
  })
})
