/**
 * Lead form Cloudflare Pages Function.
 * POST /api/lead — validates, checks honeypot, sends email via Resend, redirects.
 */
import { validateLeadForm, formatLeadEmail } from '../../src/lib/lead-form'

interface Env {
  RESEND_API_KEY: string
  SITE_BRAND?: string
  LEAD_EMAIL?: string
}

// Basic IP rate limiting: 5 requests/minute per IP
const rateMap = new Map<string, number[]>()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateMap.get(ip) ?? []
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_LIMIT) return true
  recent.push(now)
  rateMap.set(ip, recent)
  return false
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'

  if (isRateLimited(ip)) {
    return new Response('Too many requests. Please try again in a minute.', { status: 429 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return new Response('Invalid form data', { status: 400 })
  }

  const input = {
    name: formData.get('name')?.toString() ?? '',
    phone: formData.get('phone')?.toString() ?? '',
    town: formData.get('town')?.toString() ?? '',
    details: formData.get('details')?.toString() ?? '',
    honeypot: formData.get('_gotcha')?.toString() ?? '',
  }

  const validation = validateLeadForm(input)
  if (!validation.valid) {
    return new Response(JSON.stringify({ errors: validation.errors }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const brand = env.SITE_BRAND ?? 'Our Company'
  const html = formatLeadEmail({
    name: input.name.trim(),
    phone: input.phone.trim(),
    town: input.town.trim(),
    details: input.details.trim(),
    siteBrand: brand,
  })

  const toEmail = env.LEAD_EMAIL ?? 'leads@example.com'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${brand} <noreply@resend.dev>`,
        to: [toEmail],
        subject: `New Lead: ${input.name.trim()} — ${brand}`,
        html,
      }),
    })

    if (!res.ok) {
      console.error('Resend API error:', await res.text())
      return new Response('Failed to send. Please call us directly.', { status: 500 })
    }
  } catch (err) {
    console.error('Email send failed:', err)
    return new Response('Failed to send. Please call us directly.', { status: 500 })
  }

  // Redirect to thank-you page
  return new Response(null, {
    status: 303,
    headers: { Location: '/thank-you/' },
  })
}
