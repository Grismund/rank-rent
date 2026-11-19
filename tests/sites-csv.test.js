import { describe, it, expect } from 'vitest'
import { readSitesCsv, writeSitesCsv, updateSiteRow, initSitesCsv, SITES_CSV_COLUMNS } from '../lib/sites-csv.js'

describe('SITES_CSV_COLUMNS', () => {
  it('has the expected columns in order', () => {
    expect(SITES_CSV_COLUMNS[0]).toBe('slug')
    expect(SITES_CSV_COLUMNS[1]).toBe('niche')
    expect(SITES_CSV_COLUMNS[2]).toBe('area')
    expect(SITES_CSV_COLUMNS).toContain('domain')
    expect(SITES_CSV_COLUMNS).toContain('registrar')
    expect(SITES_CSV_COLUMNS).toContain('renewal_date')
    expect(SITES_CSV_COLUMNS).toContain('tracking_number')
    expect(SITES_CSV_COLUMNS).toContain('forwarding_target')
    expect(SITES_CSV_COLUMNS).toContain('launch_date')
    expect(SITES_CSV_COLUMNS).toContain('status')
  })
})

describe('readSitesCsv', () => {
  it('parses CSV string into array of row objects', () => {
    const csv = 'slug,niche,area,domain,registrar,renewal_date,tracking_number,forwarding_target,launch_date,first_impression,first_call,monthly_calls,client,price,start_date,payment_status,status\nepoxy-flooring-fort-myers,epoxy-flooring,Fort Myers,,,,,,,,,,,,,,audited'
    const rows = readSitesCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].slug).toBe('epoxy-flooring-fort-myers')
    expect(rows[0].niche).toBe('epoxy-flooring')
    expect(rows[0].area).toBe('Fort Myers')
    expect(rows[0].domain).toBe('')
    expect(rows[0].status).toBe('audited')
  })

  it('returns empty array for header-only CSV', () => {
    const csv = 'slug,niche,area'
    const rows = readSitesCsv(csv)
    expect(rows).toHaveLength(0)
  })

  it('returns empty array for empty string', () => {
    const rows = readSitesCsv('')
    expect(rows).toHaveLength(0)
  })

  it('handles quoted fields with commas', () => {
    const csv = 'slug,niche,area,domain,registrar,renewal_date,tracking_number,forwarding_target,launch_date,first_impression,first_call,monthly_calls,client,price,start_date,payment_status,status\ntest-site,niche,"Fort Myers, FL",,,,,,,,,,,,,,audited'
    const rows = readSitesCsv(csv)
    expect(rows[0].area).toBe('Fort Myers, FL')
  })

  it('parses multiple rows', () => {
    const csv = 'slug,niche,area,domain,registrar,renewal_date,tracking_number,forwarding_target,launch_date,first_impression,first_call,monthly_calls,client,price,start_date,payment_status,status\nsite-a,n1,A1,,,,,,,,,,,,,,audited\nsite-b,n2,A2,,,,,,,,,,,,,,audited'
    const rows = readSitesCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].slug).toBe('site-a')
    expect(rows[1].slug).toBe('site-b')
  })
})

describe('writeSitesCsv', () => {
  it('serializes rows to CSV with header', () => {
    const rows = [{
      slug: 'epoxy-flooring-fort-myers',
      niche: 'epoxy-flooring',
      area: 'Fort Myers',
      domain: '',
      registrar: '',
      renewal_date: '',
      tracking_number: '',
      forwarding_target: '',
      launch_date: '',
      first_impression: '',
      first_call: '',
      monthly_calls: '',
      client: '',
      price: '',
      start_date: '',
      payment_status: '',
      status: 'audited',
    }]
    const csv = writeSitesCsv(rows)
    const lines = csv.split('\n')
    expect(lines[0]).toBe(SITES_CSV_COLUMNS.join(','))
    expect(lines[1]).toContain('epoxy-flooring-fort-myers')
    expect(lines[1]).toContain('epoxy-flooring')
  })

  it('quotes fields that contain commas', () => {
    const rows = [{
      slug: 'test',
      niche: 'niche',
      area: 'Fort Myers, FL',
      domain: '', registrar: '', renewal_date: '', tracking_number: '',
      forwarding_target: '', launch_date: '', first_impression: '',
      first_call: '', monthly_calls: '', client: '', price: '',
      start_date: '', payment_status: '', status: 'audited',
    }]
    const csv = writeSitesCsv(rows)
    expect(csv).toContain('"Fort Myers, FL"')
  })

  it('roundtrips through read and write', () => {
    const rows = [{
      slug: 'site-a', niche: 'n1', area: 'A1', domain: 'example.com',
      registrar: 'cloudflare', renewal_date: '2027-11-19',
      tracking_number: '+12395550123', forwarding_target: '',
      launch_date: '', first_impression: '', first_call: '',
      monthly_calls: '', client: '', price: '', start_date: '',
      payment_status: '', status: 'purchased',
    }]
    const csv = writeSitesCsv(rows)
    const parsed = readSitesCsv(csv)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].slug).toBe('site-a')
    expect(parsed[0].domain).toBe('example.com')
    expect(parsed[0].tracking_number).toBe('+12395550123')
  })
})

describe('updateSiteRow', () => {
  it('merges fields into the matching row by slug', () => {
    const rows = [
      { slug: 'site-a', niche: 'n1', domain: '', status: 'audited' },
      { slug: 'site-b', niche: 'n2', domain: '', status: 'audited' },
    ]
    const updated = updateSiteRow(rows, 'site-a', { domain: 'example.com', status: 'purchased' })
    expect(updated[0].domain).toBe('example.com')
    expect(updated[0].status).toBe('purchased')
    // Other row unchanged
    expect(updated[1].domain).toBe('')
  })

  it('returns rows unchanged when slug not found', () => {
    const rows = [{ slug: 'site-a', domain: '' }]
    const updated = updateSiteRow(rows, 'nonexistent', { domain: 'x.com' })
    expect(updated[0].domain).toBe('')
  })

  it('does not mutate the original rows array', () => {
    const rows = [{ slug: 'site-a', domain: '' }]
    const updated = updateSiteRow(rows, 'site-a', { domain: 'x.com' })
    expect(rows[0].domain).toBe('')
    expect(updated[0].domain).toBe('x.com')
  })
})

describe('initSitesCsv', () => {
  it('creates rows from slugs and site.yaml data', () => {
    const slugs = ['epoxy-flooring-fort-myers']
    const yamls = {
      'epoxy-flooring-fort-myers': {
        niche: 'epoxy-flooring',
        city: 'Fort Myers',
        state: 'Florida',
        brand: 'Fort Myers Floor Coatings',
      },
    }
    const rows = initSitesCsv(slugs, yamls)
    expect(rows).toHaveLength(1)
    expect(rows[0].slug).toBe('epoxy-flooring-fort-myers')
    expect(rows[0].niche).toBe('epoxy-flooring')
    expect(rows[0].area).toBe('Fort Myers')
    expect(rows[0].status).toBe('audited')
    expect(rows[0].domain).toBe('')
    expect(rows[0].tracking_number).toBe('')
  })

  it('creates multiple rows preserving order', () => {
    const slugs = ['site-a', 'site-b']
    const yamls = {
      'site-a': { niche: 'n1', city: 'A1', state: 'S1', brand: 'B1' },
      'site-b': { niche: 'n2', city: 'A2', state: 'S2', brand: 'B2' },
    }
    const rows = initSitesCsv(slugs, yamls)
    expect(rows).toHaveLength(2)
    expect(rows[0].slug).toBe('site-a')
    expect(rows[1].slug).toBe('site-b')
  })

  it('fills all SITES_CSV_COLUMNS with empty strings for missing fields', () => {
    const slugs = ['site-a']
    const yamls = {
      'site-a': { niche: 'n1', city: 'A1', state: 'S1', brand: 'B1' },
    }
    const rows = initSitesCsv(slugs, yamls)
    for (const col of SITES_CSV_COLUMNS) {
      expect(rows[0]).toHaveProperty(col)
    }
  })
})
