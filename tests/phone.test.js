import { describe, it, expect } from 'vitest'
import {
  formatPhoneNumber,
  formatE164,
  buildSearchParams,
  formatNumberTable,
  formatPhoneApprovalPrompt,
  buildVoicemailTwiml,
} from '../lib/phone.js'

describe('formatPhoneNumber', () => {
  it('converts E.164 to display format', () => {
    expect(formatPhoneNumber('+12395550123')).toBe('(239) 555-0123')
  })

  it('handles 11-digit number without plus', () => {
    expect(formatPhoneNumber('12395550123')).toBe('(239) 555-0123')
  })

  it('handles 10-digit number without country code', () => {
    expect(formatPhoneNumber('2395550123')).toBe('(239) 555-0123')
  })
})

describe('formatE164', () => {
  it('converts display format to E.164', () => {
    expect(formatE164('(239) 555-0123')).toBe('+12395550123')
  })

  it('handles already E.164 format', () => {
    expect(formatE164('+12395550123')).toBe('+12395550123')
  })

  it('handles digits-only input', () => {
    expect(formatE164('2395550123')).toBe('+12395550123')
  })

  it('handles digits-only with country code', () => {
    expect(formatE164('12395550123')).toBe('+12395550123')
  })
})

describe('buildSearchParams', () => {
  it('builds params for a Florida city', () => {
    const params = buildSearchParams('Fort Myers', 'Florida')
    expect(params.InLocality).toBe('Fort Myers')
    expect(params.InRegion).toBe('FL')
    expect(params.Limit).toBeDefined()
  })

  it('builds params for a Texas city', () => {
    const params = buildSearchParams('Conroe', 'Texas')
    expect(params.InLocality).toBe('Conroe')
    expect(params.InRegion).toBe('TX')
  })

  it('builds params for an Arizona city', () => {
    const params = buildSearchParams('Goodyear', 'Arizona')
    expect(params.InRegion).toBe('AZ')
  })

  it('defaults limit to 5', () => {
    const params = buildSearchParams('Miami', 'Florida')
    expect(params.Limit).toBe(5)
  })
})

describe('formatNumberTable', () => {
  it('produces markdown table with number and cost columns', () => {
    const numbers = [
      { phoneNumber: '+12395551234', friendlyName: '(239) 555-1234', locality: 'Fort Myers', region: 'FL' },
    ]
    const table = formatNumberTable(numbers)
    expect(table).toContain('| Number |')
    expect(table).toContain('239')
    expect(table).toContain('$1.15')
  })

  it('handles multiple numbers', () => {
    const numbers = [
      { phoneNumber: '+12395551234', friendlyName: '(239) 555-1234', locality: 'Fort Myers', region: 'FL' },
      { phoneNumber: '+12395555678', friendlyName: '(239) 555-5678', locality: 'Fort Myers', region: 'FL' },
    ]
    const table = formatNumberTable(numbers)
    const rows = table.split('\n').filter(l => l.startsWith('|') && !l.startsWith('|---') && !l.startsWith('| Number'))
    expect(rows).toHaveLength(2)
  })
})

describe('formatPhoneApprovalPrompt', () => {
  it('shows selected numbers and monthly cost', () => {
    const selected = [
      { phoneNumber: '+12395551234', friendlyName: '(239) 555-1234' },
    ]
    const prompt = formatPhoneApprovalPrompt(selected, 1.15)
    expect(prompt).toContain('(239) 555-1234')
    expect(prompt).toContain('$1.15')
    expect(prompt.toLowerCase()).toContain('approve')
  })

  it('shows total for multiple numbers', () => {
    const selected = [
      { phoneNumber: '+12395551234', friendlyName: '(239) 555-1234' },
      { phoneNumber: '+12395555678', friendlyName: '(239) 555-5678' },
    ]
    const prompt = formatPhoneApprovalPrompt(selected, 2.30)
    expect(prompt).toContain('$2.30')
  })
})

describe('buildVoicemailTwiml', () => {
  it('produces valid TwiML XML', () => {
    const twiml = buildVoicemailTwiml('Fort Myers Floor Coatings')
    expect(twiml).toContain('<?xml')
    expect(twiml).toContain('<Response>')
    expect(twiml).toContain('</Response>')
    expect(twiml).toContain('<Say')
    expect(twiml).toContain('</Say>')
  })

  it('includes the brand name in the greeting', () => {
    const twiml = buildVoicemailTwiml('Fort Myers Floor Coatings')
    expect(twiml).toContain('Fort Myers Floor Coatings')
  })

  it('includes Record element for voicemail', () => {
    const twiml = buildVoicemailTwiml('Test Brand')
    expect(twiml).toContain('<Record')
  })

  it('XML-escapes ampersands in brand names', () => {
    const twiml = buildVoicemailTwiml('Lake Conroe Bath & Tile')
    expect(twiml).not.toContain('& ')
    expect(twiml).toContain('&amp;')
  })
})
