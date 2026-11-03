import { describe, it, expect } from 'vitest'
import {
  scoreSearchVolume,
  scoreCPC,
  scoreMapPackWeakness,
  scoreOrganicWeakness,
  scoreRenterAvailability,
  scoreLicenseBarrier,
  scoreSeasonality,
  estimateRent,
  scoreRentPotential,
  totalScore,
} from '../lib/scoring.js'

describe('scoreSearchVolume', () => {
  it('returns 0 for volume under 200', () => {
    expect(scoreSearchVolume(199)).toBe(0)
    expect(scoreSearchVolume(0)).toBe(0)
  })

  it('returns 1 for volume 200–500', () => {
    expect(scoreSearchVolume(200)).toBe(1)
    expect(scoreSearchVolume(350)).toBe(1)
    expect(scoreSearchVolume(500)).toBe(1)
  })

  it('returns 2 for volume over 500', () => {
    expect(scoreSearchVolume(501)).toBe(2)
    expect(scoreSearchVolume(10000)).toBe(2)
  })
})

describe('scoreCPC', () => {
  it('returns 0 for CPC under $10', () => {
    expect(scoreCPC(9.99)).toBe(0)
    expect(scoreCPC(0)).toBe(0)
  })

  it('returns 1 for CPC $10–$40', () => {
    expect(scoreCPC(10)).toBe(1)
    expect(scoreCPC(25)).toBe(1)
    expect(scoreCPC(40)).toBe(1)
  })

  it('returns 2 for CPC over $40', () => {
    expect(scoreCPC(40.01)).toBe(2)
    expect(scoreCPC(100)).toBe(2)
  })
})

describe('scoreMapPackWeakness', () => {
  it('returns 0 when all 3 have 100+ reviews and 4.5+ rating', () => {
    const strong = [
      { reviews: 150, rating: 4.8 },
      { reviews: 200, rating: 4.5 },
      { reviews: 100, rating: 4.6 },
    ]
    expect(scoreMapPackWeakness(strong)).toBe(0)
  })

  it('returns 1 when 1–2 of the 3 are weak', () => {
    const mixed = [
      { reviews: 150, rating: 4.8 },
      { reviews: 30, rating: 3.5 },
      { reviews: 200, rating: 4.5 },
    ]
    expect(scoreMapPackWeakness(mixed)).toBe(1)
  })

  it('returns 2 when all 3 are weak', () => {
    const weak = [
      { reviews: 10, rating: 3.0 },
      { reviews: 25, rating: 3.8 },
      { reviews: 40, rating: 4.0 },
    ]
    expect(scoreMapPackWeakness(weak)).toBe(2)
  })

  it('returns 2 when fewer than 3 results appear', () => {
    expect(scoreMapPackWeakness([])).toBe(2)
    expect(scoreMapPackWeakness([{ reviews: 200, rating: 4.8 }])).toBe(2)
  })
})

describe('scoreOrganicWeakness', () => {
  const dirs = ['yelp.com', 'angi.com', 'homeadvisor.com', 'thumbtack.com', 'bbb.org']

  it('returns 0 when top 5 are strong local sites (0–1 directories)', () => {
    const topFive = [
      'localbiz.com',
      'yelp.com',
      'contractor.com',
      'townpros.com',
      'bestlocal.com',
    ]
    expect(scoreOrganicWeakness(topFive, dirs)).toBe(0)
  })

  it('returns 1 when 2–3 directories in top 5', () => {
    const topFive = [
      'yelp.com',
      'angi.com',
      'localbiz.com',
      'homeadvisor.com',
      'contractor.com',
    ]
    expect(scoreOrganicWeakness(topFive, dirs)).toBe(1)
  })

  it('returns 2 when 4+ directories in top 5', () => {
    const topFive = [
      'yelp.com',
      'angi.com',
      'homeadvisor.com',
      'thumbtack.com',
      'contractor.com',
    ]
    expect(scoreOrganicWeakness(topFive, dirs)).toBe(2)
  })

  it('handles subdomains of directory domains', () => {
    const topFive = [
      'www.yelp.com',
      'm.angi.com',
      'homeadvisor.com',
      'thumbtack.com',
      'bbb.org',
    ]
    expect(scoreOrganicWeakness(topFive, dirs)).toBe(2)
  })
})

describe('scoreRenterAvailability', () => {
  it('returns 0 for fewer than 5 businesses', () => {
    expect(scoreRenterAvailability(4)).toBe(0)
    expect(scoreRenterAvailability(0)).toBe(0)
  })

  it('returns 1 for 5–15 businesses', () => {
    expect(scoreRenterAvailability(5)).toBe(1)
    expect(scoreRenterAvailability(10)).toBe(1)
    expect(scoreRenterAvailability(15)).toBe(1)
  })

  it('returns 2 for over 15 businesses', () => {
    expect(scoreRenterAvailability(16)).toBe(2)
    expect(scoreRenterAvailability(100)).toBe(2)
  })
})

describe('scoreLicenseBarrier', () => {
  it('returns 0 for required license', () => {
    expect(scoreLicenseBarrier('required')).toBe(0)
  })

  it('returns 1 for partial license barrier', () => {
    expect(scoreLicenseBarrier('partial')).toBe(1)
  })

  it('returns 2 for no license barrier', () => {
    expect(scoreLicenseBarrier('none')).toBe(2)
  })
})

describe('scoreSeasonality', () => {
  it('returns 2 for year-round demand (min >= 60% of peak)', () => {
    const values = [80, 90, 100, 95, 85, 80, 75, 70, 65, 60, 65, 75]
    expect(scoreSeasonality(values)).toBe(2)
  })

  it('returns 1 for moderate seasonality (30–60% of peak for 2–3 months)', () => {
    const values = [100, 90, 80, 70, 50, 40, 35, 40, 60, 80, 90, 100]
    expect(scoreSeasonality(values)).toBe(1)
  })

  it('returns 0 for heavy seasonality (below 30% of peak for 4+ months)', () => {
    const values = [100, 90, 50, 20, 10, 10, 10, 15, 20, 50, 80, 100]
    expect(scoreSeasonality(values)).toBe(0)
  })

  it('returns 2 for empty or single-value input', () => {
    expect(scoreSeasonality([])).toBe(2)
    expect(scoreSeasonality([50])).toBe(2)
  })
})

describe('estimateRent', () => {
  it('calculates rent using formula: vol * 0.15 * 0.10 * cpc * 7.5 / 2', () => {
    // 500 * 0.15 * 0.10 * 20 * 7.5 / 2 = 562.50
    expect(estimateRent(500, 20)).toBeCloseTo(562.50)
  })

  it('returns 0 for zero volume', () => {
    expect(estimateRent(0, 30)).toBe(0)
  })

  it('returns 0 for zero CPC', () => {
    expect(estimateRent(500, 0)).toBe(0)
  })

  it('handles large values', () => {
    // 2000 * 0.15 * 0.10 * 50 * 7.5 / 2 = 5625.00
    expect(estimateRent(2000, 50)).toBeCloseTo(5625.00)
  })
})

describe('scoreRentPotential', () => {
  it('returns 0 for rent under $200', () => {
    expect(scoreRentPotential(199)).toBe(0)
    expect(scoreRentPotential(0)).toBe(0)
  })

  it('returns 1 for rent $200–$500', () => {
    expect(scoreRentPotential(200)).toBe(1)
    expect(scoreRentPotential(350)).toBe(1)
    expect(scoreRentPotential(500)).toBe(1)
  })

  it('returns 2 for rent over $500', () => {
    expect(scoreRentPotential(501)).toBe(2)
    expect(scoreRentPotential(1000)).toBe(2)
  })
})

describe('totalScore', () => {
  it('sums all 8 signals and returns pass for 11+', () => {
    const signals = {
      volume: 2, cpc: 2, mapPack: 2, organic: 2,
      renters: 1, license: 2, seasonality: 1, rent: 1,
    }
    const result = totalScore(signals)
    expect(result.total).toBe(13)
    expect(result.status).toBe('pass')
  })

  it('returns marginal for 8–10', () => {
    const signals = {
      volume: 1, cpc: 1, mapPack: 1, organic: 1,
      renters: 1, license: 2, seasonality: 1, rent: 1,
    }
    const result = totalScore(signals)
    expect(result.total).toBe(9)
    expect(result.status).toBe('marginal')
  })

  it('returns walk_away for 0–7', () => {
    const signals = {
      volume: 0, cpc: 1, mapPack: 0, organic: 1,
      renters: 0, license: 2, seasonality: 0, rent: 0,
    }
    const result = totalScore(signals)
    expect(result.total).toBe(4)
    expect(result.status).toBe('walk_away')
  })

  it('handles all zeros', () => {
    const signals = {
      volume: 0, cpc: 0, mapPack: 0, organic: 0,
      renters: 0, license: 0, seasonality: 0, rent: 0,
    }
    const result = totalScore(signals)
    expect(result.total).toBe(0)
    expect(result.status).toBe('walk_away')
  })

  it('handles perfect score', () => {
    const signals = {
      volume: 2, cpc: 2, mapPack: 2, organic: 2,
      renters: 2, license: 2, seasonality: 2, rent: 2,
    }
    const result = totalScore(signals)
    expect(result.total).toBe(16)
    expect(result.status).toBe('pass')
  })
})
