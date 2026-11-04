import { describe, it, expect } from 'vitest'
import { aggregateWeeklyToMonthly } from '../lib/trends.js'

describe('aggregateWeeklyToMonthly', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateWeeklyToMonthly([], [])).toEqual([])
  })

  it('returns input unchanged if already 12 values with no dates', () => {
    const monthly = [80, 90, 100, 95, 85, 80, 75, 70, 65, 60, 65, 75]
    expect(aggregateWeeklyToMonthly(monthly, [])).toEqual(monthly)
  })

  it('aggregates 52 weekly values into 12 monthly by averaging weeks per month', () => {
    // Create 52 weekly data points with dates spanning 12 months
    const dates = []
    const values = []
    const start = new Date('2025-11-03')
    for (let i = 0; i < 52; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i * 7)
      dates.push(d.toISOString().split('T')[0])
      values.push(50 + i) // 50..101
    }
    const result = aggregateWeeklyToMonthly(values, dates)
    expect(result).toHaveLength(12)
    // Each value should be a rounded average of the weeks in that month
    result.forEach((v) => {
      expect(typeof v).toBe('number')
      expect(Number.isInteger(v)).toBe(true)
    })
  })

  it('handles weeks spanning month boundaries by assigning to the week start month', () => {
    // 4 weeks, 2 in Jan, 2 in Feb
    const dates = ['2026-01-05', '2026-01-12', '2026-02-02', '2026-02-09']
    const values = [10, 20, 30, 40]
    const result = aggregateWeeklyToMonthly(values, dates)
    // Should have entries for Jan and Feb
    expect(result.length).toBeGreaterThanOrEqual(2)
    // Jan avg = (10+20)/2 = 15, Feb avg = (30+40)/2 = 35
    expect(result[0]).toBe(15)
    expect(result[1]).toBe(35)
  })

  it('falls back to equal-chunk splitting when no dates provided and length > 12', () => {
    // 52 values, no dates — split into 12 chunks and average
    const values = Array(52).fill(100)
    const result = aggregateWeeklyToMonthly(values, [])
    expect(result).toHaveLength(12)
    result.forEach((v) => expect(v).toBe(100))
  })

  it('handles uneven chunk sizes in fallback mode', () => {
    // 53 values: first 5 chunks get 5 values, rest get 4
    const values = Array(53).fill(0).map((_, i) => i)
    const result = aggregateWeeklyToMonthly(values, [])
    expect(result).toHaveLength(12)
    result.forEach((v) => expect(typeof v).toBe('number'))
  })
})
