/**
 * Pure functions for call routing — route config, TwiML generation,
 * Twilio number updates, welcome emails, and webhook parsing.
 * Used by workers/call-router/ and scripts/route.mjs.
 */

import { buildVoicemailTwiml } from './phone.js'

export const ROUTE_MODES = ['voicemail', 'trial', 'paid']

/**
 * Build a KV route config object for a tracking number.
 * @param {object} opts
 * @returns {object}
 */
export function buildRouteConfig({ slug, mode, brand, forwardTo, clientName, operatorEmail }) {
  return {
    slug,
    mode,
    brand,
    forwardTo: forwardTo || '',
    clientName: clientName || '',
    operatorEmail: operatorEmail || '',
  }
}

/**
 * Validate a route config object.
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRouteConfig(config) {
  const errors = []
  if (!config.slug) errors.push('slug is required')
  if (!ROUTE_MODES.includes(config.mode)) errors.push(`mode must be one of: ${ROUTE_MODES.join(', ')}`)
  if ((config.mode === 'trial' || config.mode === 'paid') && !config.forwardTo) {
    errors.push('forwardTo is required for trial/paid modes')
  }
  return { valid: errors.length === 0, errors }
}

/**
 * Build TwiML for voicemail mode.
 * Delegates to buildVoicemailTwiml from lib/phone.js.
 * @param {string} brandName
 * @returns {string}
 */
export function buildVoicemailResponse(brandName) {
  return buildVoicemailTwiml(brandName)
}

/**
 * Build TwiML for call forwarding (trial/paid mode).
 * @param {object} opts
 * @returns {string}
 */
export function buildForwardResponse({ brandName, forwardTo, whisper }) {
  const escaped = brandName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const whisperEnabled = whisper !== false

  let numberAttrs = ''
  if (whisperEnabled) {
    numberAttrs = ' url="/whisper" method="POST"'
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Please hold while we connect you to ${escaped}.</Say>
  <Dial callerId="{{From}}">
    <Number${numberAttrs}>${forwardTo}</Number>
  </Dial>
</Response>`
}

/**
 * Build TwiML for the whisper announcement to the contractor.
 * @param {string} brandName
 * @returns {string}
 */
export function buildWhisperTwiml(brandName) {
  const escaped = brandName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Incoming lead from ${escaped}.</Say>
</Response>`
}

/**
 * Select TwiML response based on route config mode.
 * @param {{ mode: string, brand: string, forwardTo: string }} config
 * @returns {string}
 */
export function selectTwimlResponse(config) {
  if (config.mode === 'voicemail') {
    return buildVoicemailResponse(config.brand)
  }
  return buildForwardResponse({
    brandName: config.brand,
    forwardTo: config.forwardTo,
  })
}

/**
 * Build Twilio IncomingPhoneNumber update params for VoiceUrl.
 * @param {string} workerUrl - e.g. 'https://call-router.example.workers.dev'
 * @returns {{ VoiceUrl: string, VoiceMethod: string }}
 */
export function buildVoiceUrlUpdate(workerUrl) {
  return {
    VoiceUrl: `${workerUrl}/voice`,
    VoiceMethod: 'POST',
  }
}

/**
 * Format all routes as a markdown table.
 * @param {{ slug: string, mode: string, brand: string, forwardTo: string }[]} routes
 * @returns {string}
 */
export function formatRouteStatus(routes) {
  if (routes.length === 0) return 'No routes configured.'

  const lines = [
    '| Site | Brand | Mode | Forward To |',
    '|------|-------|------|-----------|',
  ]
  for (const r of routes) {
    lines.push(`| ${r.slug} | ${r.brand} | ${r.mode} | ${r.forwardTo || '—'} |`)
  }
  return lines.join('\n')
}

/**
 * Format a before/after summary for operator confirmation.
 * @param {string} current - current mode
 * @param {string} newMode - new mode
 * @param {object} [newOpts] - new options
 * @returns {string}
 */
export function formatModeTransition(current, newMode, newOpts = {}) {
  const lines = [`Mode: ${current} → ${newMode}`]
  if (newOpts.forwardTo) lines.push(`Forward to: ${newOpts.forwardTo}`)
  if (newOpts.clientName) lines.push(`Client: ${newOpts.clientName}`)
  return lines.join('\n')
}

/**
 * Build a welcome email for trial clients.
 * @param {object} opts
 * @returns {{ subject: string, html: string }}
 */
export function buildWelcomeEmail({ brandName, clientName, siteDomain, niche, city }) {
  const subject = `Welcome to ${brandName} — Your trial has started`
  const html = `<p>Hi ${clientName},</p>
<p>Thanks for trying <strong>${brandName}</strong>. Your leads from <a href="https://${siteDomain}">${siteDomain}</a> are now being forwarded to you.</p>
<p>This site ranks for ${niche.replace(/-/g, ' ')} services in ${city} and surrounding areas. You'll receive calls from potential customers looking for exactly what you offer.</p>
<p>We'll check in after your first week to see how things are going.</p>
<p>Best,<br>The ${brandName} Team</p>`

  return { subject, html }
}

/**
 * Parse a URL-encoded Twilio webhook body.
 * @param {string} body - URL-encoded string
 * @returns {object}
 */
export function parseTwilioWebhook(body) {
  const params = new URLSearchParams(body)
  const result = {}
  for (const [key, value] of params) {
    result[key] = value
  }
  return result
}
