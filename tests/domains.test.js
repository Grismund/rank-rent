import { describe, it, expect } from 'vitest'
import {
  generateCandidateDomains,
  formatAvailabilityTable,
  formatApprovalPrompt,
  buildRegistrationPayload,
  parseDomainCheckResponse,
  calculateRenewalDate,
} from '../lib/domains.js'

describe('generateCandidateDomains', () => {
  it('includes .com domains from brandToDomains plus .net/.co fallbacks', () => {
    const result = generateCandidateDomains('Fort Myers Floor Coatings', 'epoxy-flooring-fort-myers')
    expect(result).toContain('fortmyersfloorcoatings.com')
    expect(result).toContain('fort-myers-floor-coatings.com')
    expect(result).toContain('fortmyersfloorcoatings.net')
    expect(result).toContain('fortmyersfloorcoatings.co')
  })

  it('deduplicates domains', () => {
    const result = generateCandidateDomains('PSL', 'some-slug')
    const unique = new Set(result)
    expect(result.length).toBe(unique.size)
  })

  it('returns all lowercase domains', () => {
    const result = generateCandidateDomains('Orlando Epoxy Works', 'epoxy-flooring-orlando')
    for (const d of result) {
      expect(d).toBe(d.toLowerCase())
    }
  })
})

describe('parseDomainCheckResponse', () => {
  it('parses Cloudflare domain check response into structured array', () => {
    const apiResponse = {
      success: true,
      result: {
        domains: [
          {
            name: 'fortmyersfloorcoatings.com',
            registrable: true,
            pricing: { registration_cost: 8.99 },
            reason: null,
          },
          {
            name: 'fort-myers-floor-coatings.com',
            registrable: false,
            pricing: null,
            reason: 'REGISTERED',
          },
        ],
      },
    }
    const result = parseDomainCheckResponse(apiResponse)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      domain: 'fortmyersfloorcoatings.com',
      available: true,
      price: 8.99,
      reason: null,
    })
    expect(result[1]).toEqual({
      domain: 'fort-myers-floor-coatings.com',
      available: false,
      price: null,
      reason: 'REGISTERED',
    })
  })

  it('returns empty array for missing result.domains', () => {
    expect(parseDomainCheckResponse({ success: true, result: {} })).toEqual([])
    expect(parseDomainCheckResponse({ success: true, result: { domains: [] } })).toEqual([])
  })
})

describe('formatAvailabilityTable', () => {
  it('produces a markdown table with domain, available, and price columns', () => {
    const results = [
      { domain: 'example.com', available: true, price: 8.99, reason: null },
      { domain: 'example.net', available: false, price: null, reason: 'REGISTERED' },
    ]
    const table = formatAvailabilityTable(results)
    expect(table).toContain('| Domain |')
    expect(table).toContain('| example.com |')
    expect(table).toContain('YES')
    expect(table).toContain('$8.99')
    expect(table).toContain('no (REGISTERED)')
  })

  it('shows dash for null price', () => {
    const results = [
      { domain: 'taken.com', available: false, price: null, reason: 'REGISTERED' },
    ]
    const table = formatAvailabilityTable(results)
    expect(table).toContain('| - |')
  })
})

describe('formatApprovalPrompt', () => {
  it('lists selected domains and total cost', () => {
    const selected = [
      { domain: 'example.com', price: 8.99 },
      { domain: 'example2.com', price: 8.99 },
    ]
    const prompt = formatApprovalPrompt(selected, 17.98)
    expect(prompt).toContain('example.com')
    expect(prompt).toContain('example2.com')
    expect(prompt).toContain('$17.98')
    expect(prompt).toContain('TOTAL')
  })

  it('includes a warning that this is a purchase', () => {
    const prompt = formatApprovalPrompt([{ domain: 'x.com', price: 8.99 }], 8.99)
    expect(prompt.toLowerCase()).toContain('approve')
  })
})

describe('buildRegistrationPayload', () => {
  it('builds Cloudflare registration API body', () => {
    const payload = buildRegistrationPayload('example.com')
    expect(payload).toEqual({
      name: 'example.com',
      auto_renew: true,
    })
  })

  it('always sets auto_renew to true', () => {
    const payload = buildRegistrationPayload('anything.net')
    expect(payload.auto_renew).toBe(true)
  })
})

describe('calculateRenewalDate', () => {
  it('returns date one year from registration', () => {
    const result = calculateRenewalDate('2026-11-19')
    expect(result).toBe('2027-11-19')
  })

  it('handles leap year edge case', () => {
    const result = calculateRenewalDate('2024-02-29')
    // 2025 has no Feb 29, JS Date rolls to March 1
    expect(result).toBe('2025-03-01')
  })

  it('returns ISO date string format YYYY-MM-DD', () => {
    const result = calculateRenewalDate('2026-01-15')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
