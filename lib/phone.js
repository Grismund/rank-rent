/**
 * Pure functions for phone number provisioning workflow.
 * Used by scripts/phone.mjs and rr-phone skill.
 */

const STATE_ABBREVS = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY',
}

/**
 * Convert E.164 or raw digits to display format (XXX) XXX-XXXX.
 * @param {string} number - E.164, 11-digit, or 10-digit phone number
 * @returns {string}
 */
export function formatPhoneNumber(number) {
  const digits = number.replace(/\D/g, '')
  // Strip leading 1 if 11 digits
  const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6, 10)}`
}

/**
 * Convert display format or raw digits to E.164 (+1XXXXXXXXXX).
 * @param {string} number
 * @returns {string}
 */
export function formatE164(number) {
  const digits = number.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  return `+${digits}`
}

/**
 * Build Twilio AvailablePhoneNumbers search parameters.
 * @param {string} city
 * @param {string} state - full state name
 * @returns {{ InLocality: string, InRegion: string, Limit: number }}
 */
export function buildSearchParams(city, state) {
  const abbrev = STATE_ABBREVS[state.toLowerCase()] || state
  return {
    InLocality: city,
    InRegion: abbrev,
    Limit: 5,
  }
}

/**
 * Format available phone numbers as a markdown table.
 * Monthly cost is $1.15/number (Twilio local number rate).
 * @param {{ phoneNumber: string, friendlyName: string, locality: string, region: string }[]} numbers
 * @returns {string}
 */
export function formatNumberTable(numbers) {
  const lines = [
    '| Number | Location | Monthly Cost |',
    '|--------|----------|-------------|',
  ]
  for (const n of numbers) {
    const display = formatPhoneNumber(n.phoneNumber)
    lines.push(`| ${display} | ${n.locality}, ${n.region} | $1.15 |`)
  }
  return lines.join('\n')
}

/**
 * Format a phone purchase approval prompt.
 * @param {{ phoneNumber: string, friendlyName: string }[]} selected
 * @param {number} monthlyCost
 * @returns {string}
 */
export function formatPhoneApprovalPrompt(selected, monthlyCost) {
  const lines = [
    '',
    '--- PURCHASE APPROVAL REQUIRED ---',
    '',
    'Phone numbers to provision:',
  ]
  for (const n of selected) {
    lines.push(`  - ${n.friendlyName}  ($1.15/mo)`)
  }
  lines.push('')
  lines.push(`TOTAL: $${monthlyCost.toFixed(2)}/month`)
  lines.push('')
  lines.push('Type the exact phone number(s) to approve, or "cancel" to abort.')
  return lines.join('\n')
}

/**
 * Build TwiML for a basic voicemail greeting.
 * @param {string} brandName
 * @returns {string}
 */
export function buildVoicemailTwiml(brandName) {
  const escaped = brandName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Thank you for calling ${escaped}. We are unable to take your call right now. Please leave a message after the tone, and we will get back to you as soon as possible.</Say>
  <Record maxLength="120" transcribe="true" playBeep="true" />
  <Say voice="Polly.Matthew">We did not receive a recording. Goodbye.</Say>
</Response>`
}
