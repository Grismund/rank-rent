/**
 * Pure functions for site deployment via Cloudflare Pages.
 */

/**
 * Convert a site slug to a Cloudflare Pages project name.
 * @param {string} slug
 * @returns {string}
 */
export function slugToProjectName(slug) {
  return slug.toLowerCase()
}

/**
 * Build the env vars object for Cloudflare Pages Functions.
 * @param {object} opts
 * @param {string} opts.resendApiKey
 * @param {string} opts.siteBrand
 * @param {string} opts.leadEmail
 * @returns {object}
 */
export function buildPagesEnvVars({ resendApiKey, siteBrand, leadEmail }) {
  return {
    RESEND_API_KEY: resendApiKey,
    SITE_BRAND: siteBrand,
    LEAD_EMAIL: leadEmail,
  }
}

/**
 * Check whether a site is ready to deploy.
 * @param {object} config - Parsed site.yaml
 * @param {string} slug
 * @param {boolean} hasPassingAudit
 * @param {object} [opts]
 * @param {boolean} [opts.skipPhone] - Skip phone check
 * @returns {{ ready: boolean, reasons: string[] }}
 */
export function checkDeployReadiness(config, slug, hasPassingAudit, opts = {}) {
  const reasons = []

  if (!config.brand || config.brand === 'TBD') {
    reasons.push('no brand set')
  }
  if (!config.domain || config.domain === 'null') {
    reasons.push('no domain registered')
  }
  if (!opts.skipPhone && (!config.phone || config.phone === 'null')) {
    reasons.push('no phone provisioned')
  }
  if (!hasPassingAudit) {
    reasons.push('SEO audit not passed')
  }

  return { ready: reasons.length === 0, reasons }
}

/**
 * Check launch cadence: max 4 in 7 days, no same-niche in 7 days.
 * @param {object[]} deployedSites - rows with { niche, launch_date }
 * @param {string} niche - niche of site being deployed
 * @param {string} today - YYYY-MM-DD
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkLaunchCadence(deployedSites, niche, today) {
  const todayMs = new Date(today).getTime()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

  const recent = deployedSites.filter(s => {
    if (!s.launch_date) return false
    const launchMs = new Date(s.launch_date).getTime()
    return (todayMs - launchMs) < sevenDaysMs
  })

  if (recent.length >= 4) {
    return { allowed: false, reason: `4 sites already deployed in the last 7 days` }
  }

  const sameNiche = recent.find(s => s.niche === niche)
  if (sameNiche) {
    return { allowed: false, reason: `same niche (${niche}) deployed in the last 7 days` }
  }

  return { allowed: true }
}

/**
 * Check wave ordering: wave N requires wave N-1 to have ≥1 deployed site.
 * @param {number} siteWave - wave number of the site being deployed
 * @param {Map<string, number>} waveMap - slug → wave
 * @param {object[]} sitesCsvRows - rows with { slug, status }
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function checkWaveOrder(siteWave, waveMap, sitesCsvRows) {
  if (siteWave <= 1) return { allowed: true }

  const prevWave = siteWave - 1
  const prevWaveSlugs = []
  for (const [slug, wave] of waveMap) {
    if (wave === prevWave) prevWaveSlugs.push(slug)
  }

  const hasDeployed = prevWaveSlugs.some(slug => {
    const row = sitesCsvRows.find(r => r.slug === slug)
    return row && row.status === 'deployed'
  })

  if (!hasDeployed) {
    return { allowed: false, reason: `wave ${prevWave} has no deployed sites yet` }
  }

  return { allowed: true }
}

/**
 * Format a deploy summary report.
 * @param {object[]} results - { slug, domain, url, success, error? }
 * @returns {string}
 */
export function formatDeploySummary(results) {
  const succeeded = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)

  let out = `\n=== DEPLOY SUMMARY ===\n\n`
  out += `Deployed: ${succeeded.length} / ${results.length}\n\n`

  for (const r of succeeded) {
    out += `  ✓ ${r.slug} → ${r.domain} (${r.url})\n`
  }

  for (const r of failed) {
    out += `  ✗ ${r.slug} → ${r.domain || '?'}: ${r.error}\n`
  }

  return out
}

/**
 * Extract the deployment URL from wrangler pages deploy stdout.
 * @param {string} stdout
 * @returns {string|null}
 */
export function parseWranglerDeployUrl(stdout) {
  const match = stdout.match(/https:\/\/[^\s]+\.pages\.dev/)
  return match ? match[0] : null
}
