/**
 * Lead form validation and email formatting — pure functions.
 * Used by both the Cloudflare Pages Function and tests.
 */

// At least 7 digits, allowing common separators and optional country code
const PHONE_RE = /^\+?[\d\s().\\-]{7,20}$/

export interface LeadFormInput {
  name: string
  phone: string
  town?: string
  details?: string
  honeypot?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateLeadForm(input: LeadFormInput): ValidationResult {
  const errors: string[] = []
  const name = (input.name ?? '').trim()
  const phone = (input.phone ?? '').trim()
  const details = (input.details ?? '').trim()
  const honeypot = (input.honeypot ?? '').trim()

  if (honeypot) {
    errors.push('Spam detected')
    return { valid: false, errors }
  }

  if (!name) {
    errors.push('Name is required')
  } else if (name.length > 200) {
    errors.push('Name must be 200 characters or fewer')
  }

  if (!phone) {
    errors.push('Phone is required')
  } else if (!PHONE_RE.test(phone)) {
    errors.push('Please enter a valid phone number')
  }

  if (details.length > 2000) {
    errors.push('Project details must be 2000 characters or fewer')
  }

  return { valid: errors.length === 0, errors }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export interface LeadEmailInput {
  name: string
  phone: string
  town?: string
  details?: string
  siteBrand: string
}

export function formatLeadEmail(input: LeadEmailInput): string {
  const name = escapeHtml(input.name)
  const phone = escapeHtml(input.phone)
  const town = input.town ? escapeHtml(input.town) : ''
  const details = input.details ? escapeHtml(input.details) : ''
  const brand = escapeHtml(input.siteBrand)

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; color: #333; max-width: 480px;">
  <h2>New Lead from ${brand}</h2>
  <table style="border-collapse: collapse; width: 100%;">
    <tr>
      <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Name</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${name}</td>
    </tr>
    <tr>
      <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Phone</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="tel:${phone}">${phone}</a></td>
    </tr>
    ${town ? `<tr>
      <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Town</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${town}</td>
    </tr>` : ''}
    ${details ? `<tr>
      <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Details</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${details}</td>
    </tr>` : ''}
  </table>
  <p style="color: #999; font-size: 12px; margin-top: 16px;">Sent via ${brand} contact form</p>
</body>
</html>`
}
