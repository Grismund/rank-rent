import { describe, it, expect } from 'vitest'
import { buildGoogleJwt, buildTokenRequestBody } from '../lib/google-auth.js'

describe('buildGoogleJwt', () => {
  const clientEmail = 'test@project.iam.gserviceaccount.com'
  const scopes = ['https://www.googleapis.com/auth/webmasters']
  const now = 1700000000

  it('produces correct header with RS256 and JWT type', () => {
    const result = buildGoogleJwt(clientEmail, scopes, now)
    const decoded = JSON.parse(Buffer.from(result.header, 'base64url').toString())
    expect(decoded).toEqual({ alg: 'RS256', typ: 'JWT' })
  })

  it('produces claim set with iss, scope, aud, iat, exp', () => {
    const result = buildGoogleJwt(clientEmail, scopes, now)
    const decoded = JSON.parse(Buffer.from(result.claimSet, 'base64url').toString())
    expect(decoded.iss).toBe(clientEmail)
    expect(decoded.scope).toBe('https://www.googleapis.com/auth/webmasters')
    expect(decoded.aud).toBe('https://oauth2.googleapis.com/token')
    expect(decoded.iat).toBe(now)
    expect(decoded.exp).toBe(now + 3600)
  })

  it('sets exp to iat + 3600', () => {
    const result = buildGoogleJwt(clientEmail, scopes, now)
    const decoded = JSON.parse(Buffer.from(result.claimSet, 'base64url').toString())
    expect(decoded.exp - decoded.iat).toBe(3600)
  })

  it('joins multiple scopes with a space', () => {
    const multiScopes = [
      'https://www.googleapis.com/auth/webmasters',
      'https://www.googleapis.com/auth/siteverification',
    ]
    const result = buildGoogleJwt(clientEmail, multiScopes, now)
    const decoded = JSON.parse(Buffer.from(result.claimSet, 'base64url').toString())
    expect(decoded.scope).toBe(multiScopes.join(' '))
  })

  it('returns unsigned string as header.claimSet', () => {
    const result = buildGoogleJwt(clientEmail, scopes, now)
    expect(result.unsigned).toBe(`${result.header}.${result.claimSet}`)
  })
})

describe('buildTokenRequestBody', () => {
  it('sets grant_type to jwt-bearer', () => {
    const body = buildTokenRequestBody('signed.jwt.token')
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
  })

  it('includes the signed JWT as assertion', () => {
    const jwt = 'header.payload.signature'
    const body = buildTokenRequestBody(jwt)
    expect(body.get('assertion')).toBe(jwt)
  })
})
