import { describe, it, expect } from 'vitest'
import {
  ROUTE_MODES,
  buildRouteConfig,
  validateRouteConfig,
  buildVoicemailResponse,
  buildForwardResponse,
  buildWhisperTwiml,
  selectTwimlResponse,
  buildVoiceUrlUpdate,
  formatRouteStatus,
  buildWelcomeEmail,
  parseTwilioWebhook,
} from '../lib/call-router.js'

describe('ROUTE_MODES', () => {
  it('has voicemail, trial, and paid', () => {
    expect(ROUTE_MODES).toEqual(['voicemail', 'trial', 'paid'])
  })
})

describe('buildRouteConfig', () => {
  it('builds config with all fields', () => {
    const config = buildRouteConfig({
      slug: 'epoxy-flooring-fort-myers',
      mode: 'trial',
      brand: 'Fort Myers Floor Coatings',
      forwardTo: '+18135550199',
      clientName: 'Joe Smith',
      operatorEmail: 'seth@example.com',
    })
    expect(config.slug).toBe('epoxy-flooring-fort-myers')
    expect(config.mode).toBe('trial')
    expect(config.brand).toBe('Fort Myers Floor Coatings')
    expect(config.forwardTo).toBe('+18135550199')
    expect(config.clientName).toBe('Joe Smith')
    expect(config.operatorEmail).toBe('seth@example.com')
  })

  it('defaults forwardTo to empty string', () => {
    const config = buildRouteConfig({
      slug: 'test',
      mode: 'voicemail',
      brand: 'Test Brand',
      operatorEmail: 'x@x.com',
    })
    expect(config.forwardTo).toBe('')
  })
})

describe('validateRouteConfig', () => {
  const valid = {
    slug: 'test', mode: 'voicemail', brand: 'Test',
    forwardTo: '', operatorEmail: 'x@x.com',
  }

  it('passes valid voicemail config', () => {
    const result = validateRouteConfig(valid)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails when slug is missing', () => {
    const result = validateRouteConfig({ ...valid, slug: '' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('slug'))).toBe(true)
  })

  it('fails when forward mode has no forwardTo', () => {
    const result = validateRouteConfig({ ...valid, mode: 'trial', forwardTo: '' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('forwardTo'))).toBe(true)
  })

  it('fails for invalid mode', () => {
    const result = validateRouteConfig({ ...valid, mode: 'invalid' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('mode'))).toBe(true)
  })
})

describe('buildVoicemailResponse', () => {
  it('returns valid TwiML with Response and Say', () => {
    const twiml = buildVoicemailResponse('Fort Myers Floor Coatings')
    expect(twiml).toContain('<?xml version="1.0"')
    expect(twiml).toContain('<Response>')
    expect(twiml).toContain('Fort Myers Floor Coatings')
    expect(twiml).toContain('<Record')
  })

  it('escapes HTML entities in brand name', () => {
    const twiml = buildVoicemailResponse('A & B <Floors>')
    expect(twiml).toContain('A &amp; B &lt;Floors&gt;')
    expect(twiml).not.toContain('A & B <Floors>')
  })
})

describe('buildForwardResponse', () => {
  it('includes Dial and Number elements', () => {
    const twiml = buildForwardResponse({
      brandName: 'Test Brand',
      forwardTo: '+18135550199',
    })
    expect(twiml).toContain('<Dial')
    expect(twiml).toContain('<Number')
    expect(twiml).toContain('+18135550199')
  })

  it('includes whisper announcement by default', () => {
    const twiml = buildForwardResponse({
      brandName: 'Test Brand',
      forwardTo: '+18135550199',
    })
    expect(twiml).toContain('Test Brand')
    expect(twiml).toContain('url=')
  })

  it('respects whisper=false', () => {
    const twiml = buildForwardResponse({
      brandName: 'Test Brand',
      forwardTo: '+18135550199',
      whisper: false,
    })
    expect(twiml).not.toContain('url=')
  })
})

describe('buildWhisperTwiml', () => {
  it('includes brand name in Say element', () => {
    const twiml = buildWhisperTwiml('Fort Myers Floor Coatings')
    expect(twiml).toContain('<Say')
    expect(twiml).toContain('Fort Myers Floor Coatings')
  })
})

describe('selectTwimlResponse', () => {
  it('returns voicemail TwiML for voicemail mode', () => {
    const config = { mode: 'voicemail', brand: 'Test Brand', forwardTo: '' }
    const twiml = selectTwimlResponse(config)
    expect(twiml).toContain('<Record')
  })

  it('returns forward TwiML for trial mode', () => {
    const config = { mode: 'trial', brand: 'Test Brand', forwardTo: '+18135550199' }
    const twiml = selectTwimlResponse(config)
    expect(twiml).toContain('<Dial')
    expect(twiml).toContain('+18135550199')
  })

  it('returns forward TwiML for paid mode', () => {
    const config = { mode: 'paid', brand: 'Test Brand', forwardTo: '+18135550199' }
    const twiml = selectTwimlResponse(config)
    expect(twiml).toContain('<Dial')
  })
})

describe('buildVoiceUrlUpdate', () => {
  it('returns correct VoiceUrl and VoiceMethod', () => {
    const result = buildVoiceUrlUpdate('https://call-router.example.workers.dev')
    expect(result.VoiceUrl).toBe('https://call-router.example.workers.dev/voice')
    expect(result.VoiceMethod).toBe('POST')
  })
})

describe('formatRouteStatus', () => {
  it('formats routes as a markdown table', () => {
    const routes = [
      { slug: 'site-a', mode: 'voicemail', brand: 'Brand A', forwardTo: '' },
      { slug: 'site-b', mode: 'trial', brand: 'Brand B', forwardTo: '+18135550199' },
    ]
    const output = formatRouteStatus(routes)
    expect(output).toContain('site-a')
    expect(output).toContain('site-b')
    expect(output).toContain('voicemail')
    expect(output).toContain('trial')
  })

  it('handles empty routes list', () => {
    const output = formatRouteStatus([])
    expect(output).toContain('No routes')
  })
})

describe('buildWelcomeEmail', () => {
  it('includes client name and domain', () => {
    const result = buildWelcomeEmail({
      brandName: 'Fort Myers Floor Coatings',
      clientName: 'Joe Smith',
      siteDomain: 'fortmyersfloorcoatings.com',
      niche: 'epoxy-flooring',
      city: 'Fort Myers',
    })
    expect(result.subject).toContain('Fort Myers Floor Coatings')
    expect(result.html).toContain('Joe Smith')
    expect(result.html).toContain('fortmyersfloorcoatings.com')
  })

  it('includes relevant details in body', () => {
    const result = buildWelcomeEmail({
      brandName: 'Test Brand',
      clientName: 'Jane',
      siteDomain: 'test.com',
      niche: 'test',
      city: 'Tampa',
    })
    expect(result.html).toContain('Jane')
    expect(result.html).toContain('test.com')
  })
})

describe('parseTwilioWebhook', () => {
  it('parses URL-encoded webhook body', () => {
    const body = 'From=%2B18135550100&To=%2B18135550199&CallSid=CA12345&CallStatus=ringing'
    const result = parseTwilioWebhook(body)
    expect(result.From).toBe('+18135550100')
    expect(result.To).toBe('+18135550199')
    expect(result.CallSid).toBe('CA12345')
    expect(result.CallStatus).toBe('ringing')
  })
})
