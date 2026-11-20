/**
 * Call Router — Cloudflare Worker
 *
 * Handles Twilio voice webhooks. Looks up the called number in KV to determine
 * the routing mode (voicemail, trial, paid) and returns appropriate TwiML.
 *
 * Routes:
 *   POST /voice   — Twilio webhook: parse body → KV lookup → TwiML response
 *   POST /whisper  — Twilio whisper webhook: announce brand to contractor
 *   GET  /health  — Health check
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(
        JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (url.pathname === '/voice' && request.method === 'POST') {
      return handleVoice(request, env)
    }

    if (url.pathname === '/whisper' && request.method === 'POST') {
      return handleWhisper(request, env)
    }

    return new Response('Not Found', { status: 404 })
  },
}

async function handleVoice(request, env) {
  const body = await request.text()
  const params = new URLSearchParams(body)
  const calledNumber = params.get('To') || ''

  if (!calledNumber) {
    return twimlResponse(buildErrorTwiml('No destination number received.'))
  }

  // Look up route config by phone number
  const configJson = await env.ROUTES.get(calledNumber)

  if (!configJson) {
    // No config — default to voicemail with generic greeting
    return twimlResponse(buildGenericVoicemailTwiml())
  }

  const config = JSON.parse(configJson)

  if (config.mode === 'voicemail') {
    return twimlResponse(buildVoicemailTwiml(config.brand))
  }

  // trial or paid — forward the call
  return twimlResponse(buildForwardTwiml(config.brand, config.forwardTo))
}

async function handleWhisper(request, env) {
  const body = await request.text()
  const params = new URLSearchParams(body)
  // The ForwardedFrom or original To number tells us which route this is for
  const calledNumber = params.get('ForwardedFrom') || params.get('To') || ''

  const configJson = calledNumber ? await env.ROUTES.get(calledNumber) : null
  const brand = configJson ? JSON.parse(configJson).brand : 'your website'
  const escaped = brand.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Incoming lead from ${escaped}.</Say>
</Response>`)
}

function twimlResponse(twiml) {
  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

function buildVoicemailTwiml(brandName) {
  const escaped = brandName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Thank you for calling ${escaped}. We are unable to take your call right now. Please leave a message after the tone, and we will get back to you as soon as possible.</Say>
  <Record maxLength="120" transcribe="true" playBeep="true" />
  <Say voice="Polly.Matthew">We did not receive a recording. Goodbye.</Say>
</Response>`
}

function buildGenericVoicemailTwiml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Thank you for calling. We are unable to take your call right now. Please leave a message after the tone.</Say>
  <Record maxLength="120" transcribe="true" playBeep="true" />
  <Say voice="Polly.Matthew">We did not receive a recording. Goodbye.</Say>
</Response>`
}

function buildForwardTwiml(brandName, forwardTo) {
  const escaped = brandName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Please hold while we connect you to ${escaped}.</Say>
  <Dial>
    <Number url="/whisper" method="POST">${forwardTo}</Number>
  </Dial>
</Response>`
}

function buildErrorTwiml(message) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">${message}</Say>
</Response>`
}
