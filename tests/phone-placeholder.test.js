import { describe, it, expect } from 'vitest'
import { insertPhonePlaceholder } from '../lib/phone-placeholder.js'

describe('insertPhonePlaceholder', () => {
  it('inserts [PHONE] before "Request a free estimate" in last H2 section', () => {
    const body = [
      '## Epoxy Flooring Services in Bonita Springs',
      '',
      'Some intro text about services.',
      '',
      '## Get Epoxy Flooring in Bonita Springs',
      '',
      'Fort Myers Floor Coatings serves Bonita Springs. Request a free estimate and we will connect you with a contractor.',
    ].join('\n')

    const result = insertPhonePlaceholder(body)
    expect(result.inserted).toBe(true)
    expect(result.modified).toContain('Call [PHONE] or request a free estimate')
    expect(result.modified).not.toContain('Request a free estimate')
  })

  it('returns inserted=false when [PHONE] already present', () => {
    const body = [
      '## Get a Quote',
      '',
      'Call [PHONE] or fill out the form below for a free estimate.',
    ].join('\n')

    const result = insertPhonePlaceholder(body)
    expect(result.inserted).toBe(false)
    expect(result.modified).toBe(body)
  })

  it('returns inserted=false when no CTA section found', () => {
    const body = [
      '## About Our Services',
      '',
      'We provide quality work in the area.',
    ].join('\n')

    const result = insertPhonePlaceholder(body)
    expect(result.inserted).toBe(false)
    expect(result.modified).toBe(body)
  })

  it('handles "request a free estimate" with lowercase r', () => {
    const body = [
      '## Schedule Your Service',
      '',
      'Fill out the form to request a free estimate from a local contractor.',
    ].join('\n')

    const result = insertPhonePlaceholder(body)
    expect(result.inserted).toBe(true)
    expect(result.modified).toContain('Call [PHONE] or request a free estimate')
  })

  it('targets only the last H2 section', () => {
    const body = [
      '## Why Choose Us',
      '',
      'Request a free estimate to see our work.',
      '',
      '## Get Started Today',
      '',
      'Request a free estimate and we will match you with a contractor.',
    ].join('\n')

    const result = insertPhonePlaceholder(body)
    expect(result.inserted).toBe(true)
    // Only the last section should be modified
    const sections = result.modified.split('## ')
    expect(sections[1]).toContain('Request a free estimate')
    expect(sections[2]).toContain('Call [PHONE] or request a free estimate')
  })

  it('handles "Request a quote" variant', () => {
    const body = [
      '## Get a Quote',
      '',
      'Request a quote and we will connect you with a local contractor.',
    ].join('\n')

    const result = insertPhonePlaceholder(body)
    expect(result.inserted).toBe(true)
    expect(result.modified).toContain('Call [PHONE] or request a quote')
  })
})
