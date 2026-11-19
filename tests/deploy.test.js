import { describe, it, expect } from 'vitest'
import {
  slugToProjectName,
  buildPagesEnvVars,
  checkDeployReadiness,
  checkLaunchCadence,
  checkWaveOrder,
  formatDeploySummary,
  parseWranglerDeployUrl,
} from '../lib/deploy.js'

describe('slugToProjectName', () => {
  it('returns the slug as-is for a valid slug', () => {
    expect(slugToProjectName('epoxy-flooring-fort-myers')).toBe('epoxy-flooring-fort-myers')
  })

  it('handles slugs with numbers', () => {
    expect(slugToProjectName('site-123-test')).toBe('site-123-test')
  })

  it('lowercases uppercase input', () => {
    expect(slugToProjectName('Epoxy-Flooring')).toBe('epoxy-flooring')
  })
})

describe('buildPagesEnvVars', () => {
  it('returns correct env var keys and values', () => {
    const vars = buildPagesEnvVars({
      resendApiKey: 'rk_test_123',
      siteBrand: 'Fort Myers Floor Coatings',
      leadEmail: 'leads@example.com',
    })
    expect(vars.RESEND_API_KEY).toBe('rk_test_123')
    expect(vars.SITE_BRAND).toBe('Fort Myers Floor Coatings')
    expect(vars.LEAD_EMAIL).toBe('leads@example.com')
  })

  it('includes all three required keys', () => {
    const vars = buildPagesEnvVars({
      resendApiKey: 'x',
      siteBrand: 'y',
      leadEmail: 'z',
    })
    expect(Object.keys(vars)).toHaveLength(3)
    expect(vars).toHaveProperty('RESEND_API_KEY')
    expect(vars).toHaveProperty('SITE_BRAND')
    expect(vars).toHaveProperty('LEAD_EMAIL')
  })
})

describe('checkDeployReadiness', () => {
  const readyConfig = {
    brand: 'Fort Myers Floor Coatings',
    domain: 'fortmyersfloorcoatings.com',
    phone: '+12395550123',
  }

  it('returns ready when all checks pass', () => {
    const result = checkDeployReadiness(readyConfig, 'test-slug', true)
    expect(result.ready).toBe(true)
    expect(result.reasons).toHaveLength(0)
  })

  it('reports missing brand', () => {
    const result = checkDeployReadiness({ ...readyConfig, brand: null }, 'test', true)
    expect(result.ready).toBe(false)
    expect(result.reasons).toContain('no brand set')
  })

  it('reports TBD brand', () => {
    const result = checkDeployReadiness({ ...readyConfig, brand: 'TBD' }, 'test', true)
    expect(result.ready).toBe(false)
    expect(result.reasons).toContain('no brand set')
  })

  it('reports missing domain', () => {
    const result = checkDeployReadiness({ ...readyConfig, domain: null }, 'test', true)
    expect(result.ready).toBe(false)
    expect(result.reasons).toContain('no domain registered')
  })

  it('reports missing phone', () => {
    const result = checkDeployReadiness({ ...readyConfig, phone: null }, 'test', true)
    expect(result.ready).toBe(false)
    expect(result.reasons).toContain('no phone provisioned')
  })

  it('reports failing audit', () => {
    const result = checkDeployReadiness(readyConfig, 'test', false)
    expect(result.ready).toBe(false)
    expect(result.reasons).toContain('SEO audit not passed')
  })

  it('collects multiple reasons', () => {
    const result = checkDeployReadiness({ brand: null, domain: null, phone: null }, 'test', false)
    expect(result.ready).toBe(false)
    expect(result.reasons.length).toBeGreaterThanOrEqual(4)
  })

  it('allows missing phone when skipPhone is true', () => {
    const result = checkDeployReadiness({ ...readyConfig, phone: null }, 'test', true, { skipPhone: true })
    expect(result.ready).toBe(true)
    expect(result.reasons).toHaveLength(0)
  })
})

describe('checkLaunchCadence', () => {
  it('allows when fewer than 4 deployed in last 7 days', () => {
    const deployed = [
      { niche: 'niche-a', launch_date: '2026-11-15' },
      { niche: 'niche-b', launch_date: '2026-11-16' },
    ]
    const result = checkLaunchCadence(deployed, 'niche-c', '2026-11-19')
    expect(result.allowed).toBe(true)
  })

  it('blocks when 4 already deployed in last 7 days', () => {
    const deployed = [
      { niche: 'a', launch_date: '2026-11-14' },
      { niche: 'b', launch_date: '2026-11-15' },
      { niche: 'c', launch_date: '2026-11-16' },
      { niche: 'd', launch_date: '2026-11-17' },
    ]
    const result = checkLaunchCadence(deployed, 'e', '2026-11-19')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('4')
  })

  it('blocks same niche deployed in last 7 days', () => {
    const deployed = [
      { niche: 'epoxy-flooring', launch_date: '2026-11-15' },
    ]
    const result = checkLaunchCadence(deployed, 'epoxy-flooring', '2026-11-19')
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('same niche')
  })

  it('ignores deployments older than 7 days', () => {
    const deployed = [
      { niche: 'epoxy-flooring', launch_date: '2026-11-01' },
      { niche: 'a', launch_date: '2026-11-01' },
      { niche: 'b', launch_date: '2026-11-02' },
      { niche: 'c', launch_date: '2026-11-03' },
      { niche: 'd', launch_date: '2026-11-04' },
    ]
    const result = checkLaunchCadence(deployed, 'epoxy-flooring', '2026-11-19')
    expect(result.allowed).toBe(true)
  })

  it('allows when no sites deployed yet', () => {
    const result = checkLaunchCadence([], 'any-niche', '2026-11-19')
    expect(result.allowed).toBe(true)
  })
})

describe('checkWaveOrder', () => {
  const waveMap = new Map([
    ['site-a', 1],
    ['site-b', 1],
    ['site-c', 2],
    ['site-d', 3],
  ])

  it('always allows wave 1', () => {
    const rows = [{ slug: 'site-a', status: 'audited' }]
    const result = checkWaveOrder(1, waveMap, rows)
    expect(result.allowed).toBe(true)
  })

  it('allows wave 2 when wave 1 has a deployed site', () => {
    const rows = [
      { slug: 'site-a', status: 'deployed' },
      { slug: 'site-b', status: 'audited' },
    ]
    const result = checkWaveOrder(2, waveMap, rows)
    expect(result.allowed).toBe(true)
  })

  it('blocks wave 2 when wave 1 has no deployed site', () => {
    const rows = [
      { slug: 'site-a', status: 'audited' },
      { slug: 'site-b', status: 'audited' },
    ]
    const result = checkWaveOrder(2, waveMap, rows)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('wave 1')
  })

  it('blocks wave 3 when wave 2 has no deployed site', () => {
    const rows = [
      { slug: 'site-a', status: 'deployed' },
      { slug: 'site-c', status: 'audited' },
    ]
    const result = checkWaveOrder(3, waveMap, rows)
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('wave 2')
  })
})

describe('formatDeploySummary', () => {
  it('includes domain and URL in output', () => {
    const results = [{
      slug: 'test-site',
      domain: 'test.com',
      url: 'https://test-site.pages.dev',
      success: true,
    }]
    const summary = formatDeploySummary(results)
    expect(summary).toContain('test.com')
    expect(summary).toContain('test-site.pages.dev')
  })

  it('handles empty results', () => {
    const summary = formatDeploySummary([])
    expect(summary).toContain('0')
  })

  it('shows failed deployments', () => {
    const results = [{
      slug: 'fail-site',
      domain: 'fail.com',
      success: false,
      error: 'build failed',
    }]
    const summary = formatDeploySummary(results)
    expect(summary).toContain('fail-site')
    expect(summary).toContain('build failed')
  })
})

describe('parseWranglerDeployUrl', () => {
  it('extracts URL from wrangler deploy output', () => {
    const stdout = `Uploading... (12/12)
✨ Success! Uploaded 12 files (1.23 sec)

✨ Deployment complete! Take a peek over at https://abc123.epoxy-flooring-fort-myers.pages.dev`
    const url = parseWranglerDeployUrl(stdout)
    expect(url).toBe('https://abc123.epoxy-flooring-fort-myers.pages.dev')
  })

  it('returns null for output without URL', () => {
    const url = parseWranglerDeployUrl('Some random output')
    expect(url).toBeNull()
  })

  it('extracts .pages.dev URL from varied output formats', () => {
    const stdout = `Published to https://my-project.pages.dev (3.5s)`
    const url = parseWranglerDeployUrl(stdout)
    expect(url).toBe('https://my-project.pages.dev')
  })
})
