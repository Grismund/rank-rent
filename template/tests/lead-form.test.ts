import { describe, it, expect } from 'vitest'
import { validateLeadForm, formatLeadEmail } from '../src/lib/lead-form'

describe('validateLeadForm', () => {
  const validInput = {
    name: 'John Smith',
    phone: '555-123-4567',
    town: 'New Braunfels',
    details: 'I need my garage floor coated.',
    honeypot: '',
  }

  it('accepts valid input', () => {
    const result = validateLeadForm(validInput)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects missing name', () => {
    const result = validateLeadForm({ ...validInput, name: '' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Name is required')
  })

  it('rejects missing phone', () => {
    const result = validateLeadForm({ ...validInput, phone: '' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Phone is required')
  })

  it('rejects invalid phone format', () => {
    const result = validateLeadForm({ ...validInput, phone: 'abc' })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('phone'))).toBe(true)
  })

  it('accepts phone with various formats', () => {
    const formats = ['5551234567', '(555) 123-4567', '555.123.4567', '+15551234567']
    for (const phone of formats) {
      const result = validateLeadForm({ ...validInput, phone })
      expect(result.valid, `Should accept phone: ${phone}`).toBe(true)
    }
  })

  it('rejects non-empty honeypot (spam)', () => {
    const result = validateLeadForm({ ...validInput, honeypot: 'bot-filled' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Spam detected')
  })

  it('rejects name > 200 chars', () => {
    const result = validateLeadForm({ ...validInput, name: 'A'.repeat(201) })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Name'))).toBe(true)
  })

  it('rejects details > 2000 chars', () => {
    const result = validateLeadForm({ ...validInput, details: 'A'.repeat(2001) })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('details'))).toBe(true)
  })

  it('allows empty details', () => {
    const result = validateLeadForm({ ...validInput, details: '' })
    expect(result.valid).toBe(true)
  })

  it('allows empty town', () => {
    const result = validateLeadForm({ ...validInput, town: '' })
    expect(result.valid).toBe(true)
  })

  it('trims whitespace from inputs', () => {
    const result = validateLeadForm({ ...validInput, name: '  John  ', phone: ' 555-123-4567 ' })
    expect(result.valid).toBe(true)
  })
})

describe('formatLeadEmail', () => {
  const input = {
    name: 'John Smith',
    phone: '555-123-4567',
    town: 'New Braunfels',
    details: 'I need my garage floor coated.',
    siteBrand: 'Comal Epoxy Floors',
  }

  it('returns HTML string', () => {
    const html = formatLeadEmail(input)
    expect(html).toContain('<')
    expect(html).toContain('>')
  })

  it('includes all fields', () => {
    const html = formatLeadEmail(input)
    expect(html).toContain('John Smith')
    expect(html).toContain('555-123-4567')
    expect(html).toContain('New Braunfels')
    expect(html).toContain('garage floor coated')
    expect(html).toContain('Comal Epoxy Floors')
  })

  it('escapes HTML in user input', () => {
    const html = formatLeadEmail({ ...input, name: '<script>alert("xss")</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('handles empty optional fields', () => {
    const html = formatLeadEmail({ ...input, town: '', details: '' })
    expect(html).toContain('John Smith')
    expect(html).toContain('Comal Epoxy Floors')
  })
})
