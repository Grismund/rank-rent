import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient, locationName } from '../lib/dataforseo-client.js'

describe('locationName', () => {
  it('returns formatted location string for known city', () => {
    expect(locationName('Houston')).toBe('Houston,Texas,United States')
  })

  it('handles multi-word city names', () => {
    expect(locationName('Oklahoma City')).toBe('Oklahoma City,Oklahoma,United States')
    expect(locationName('El Paso')).toBe('El Paso,Texas,United States')
    expect(locationName('Big Spring')).toBe('Big Spring,Texas,United States')
  })

  it('throws for unknown area', () => {
    expect(() => locationName('Atlantis')).toThrow('Unknown area: Atlantis')
  })

  it('maps all known areas correctly', () => {
    const expected = {
      'Oklahoma City': 'Oklahoma',
      Tulsa: 'Oklahoma',
      Tucson: 'Arizona',
      Albuquerque: 'New Mexico',
      Midland: 'Texas',
      Houston: 'Texas',
      Abilene: 'Texas',
      'El Paso': 'Texas',
      Odessa: 'Texas',
      'Big Spring': 'Texas',
    }
    for (const [city, state] of Object.entries(expected)) {
      expect(locationName(city)).toBe(`${city},${state},United States`)
    }
  })
})

describe('createClient', () => {
  it('returns an object with apiPost function', () => {
    const client = createClient({ login: 'test', password: 'pass' })
    expect(typeof client.apiPost).toBe('function')
  })

  it('constructs correct auth header from login/password', () => {
    const client = createClient({ login: 'user@test.com', password: 's3cret' })
    const expectedAuth = 'Basic ' + Buffer.from('user@test.com:s3cret').toString('base64')
    expect(client.authHeader).toBe(expectedAuth)
  })

  it('provides a sleep utility', () => {
    const client = createClient({ login: 'a', password: 'b' })
    expect(typeof client.sleep).toBe('function')
  })
})

describe('createClient.fromEnv', () => {
  it('parses env content and creates client', () => {
    const envContent = [
      'DATAFORSEO_USERNAME=myuser',
      'DATAFORSEO_PASSWORD=mypass',
      '# a comment',
      '',
      'OTHER_KEY=other',
    ].join('\n')
    const client = createClient.fromEnvContent(envContent)
    const expectedAuth = 'Basic ' + Buffer.from('myuser:mypass').toString('base64')
    expect(client.authHeader).toBe(expectedAuth)
  })

  it('prefers DATAFORSEO_LOGIN over DATAFORSEO_USERNAME', () => {
    const envContent = [
      'DATAFORSEO_LOGIN=preferred',
      'DATAFORSEO_USERNAME=fallback',
      'DATAFORSEO_PASSWORD=pass',
    ].join('\n')
    const client = createClient.fromEnvContent(envContent)
    const expectedAuth = 'Basic ' + Buffer.from('preferred:pass').toString('base64')
    expect(client.authHeader).toBe(expectedAuth)
  })

  it('handles quoted env values', () => {
    const envContent = [
      'DATAFORSEO_USERNAME="quoted_user"',
      "DATAFORSEO_PASSWORD='quoted_pass'",
    ].join('\n')
    const client = createClient.fromEnvContent(envContent)
    const expectedAuth = 'Basic ' + Buffer.from('quoted_user:quoted_pass').toString('base64')
    expect(client.authHeader).toBe(expectedAuth)
  })
})

describe('parseEnv', () => {
  // Test the env parsing function that's shared across scripts
  it('is exported from the module', async () => {
    const { parseEnv } = await import('../lib/dataforseo-client.js')
    expect(typeof parseEnv).toBe('function')
  })

  it('parses key=value lines', async () => {
    const { parseEnv } = await import('../lib/dataforseo-client.js')
    const result = parseEnv('FOO=bar\nBAZ=qux')
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' })
  })

  it('skips comments and empty lines', async () => {
    const { parseEnv } = await import('../lib/dataforseo-client.js')
    const result = parseEnv('# comment\n\nKEY=val')
    expect(result).toEqual({ KEY: 'val' })
  })

  it('strips quotes from values', async () => {
    const { parseEnv } = await import('../lib/dataforseo-client.js')
    const result = parseEnv('A="hello"\nB=\'world\'')
    expect(result).toEqual({ A: 'hello', B: 'world' })
  })
})
