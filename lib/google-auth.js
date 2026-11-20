/**
 * Google service-account JWT auth helpers.
 * Extracted from scripts/index-site.mjs for reuse by weekly-review and other scripts.
 */

import { readFileSync } from 'node:fs'
import { createSign } from 'node:crypto'

/**
 * Build base64url-encoded JWT parts (before signing).
 * @param {string} clientEmail - Service account email
 * @param {string[]} scopes - OAuth scopes
 * @param {number} nowSeconds - Current time in seconds since epoch
 * @returns {{ header: string, claimSet: string, unsigned: string }}
 */
export function buildGoogleJwt(clientEmail, scopes, nowSeconds) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const claimSet = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  })).toString('base64url')
  return { header, claimSet, unsigned: `${header}.${claimSet}` }
}

/**
 * Build URLSearchParams for the Google token exchange request.
 * @param {string} signedJwt - Complete signed JWT string
 * @returns {URLSearchParams}
 */
export function buildTokenRequestBody(signedJwt) {
  return new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: signedJwt,
  })
}

/**
 * Get a Google access token using service account credentials.
 * @param {string} credentialsPath - Path to service account JSON
 * @param {string[]} scopes - OAuth scopes
 * @returns {Promise<string>} access_token
 */
export async function getGoogleAccessToken(credentialsPath, scopes) {
  const creds = JSON.parse(readFileSync(credentialsPath, 'utf-8'))
  const now = Math.floor(Date.now() / 1000)

  const { unsigned } = buildGoogleJwt(creds.client_email, scopes, now)

  const sign = createSign('RSA-SHA256')
  sign.update(unsigned)
  const signature = sign.sign(creds.private_key, 'base64url')

  const jwt = `${unsigned}.${signature}`
  const body = buildTokenRequestBody(jwt)

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Google token exchange failed: ${resp.status} ${text}`)
  }

  const data = await resp.json()
  return data.access_token
}
