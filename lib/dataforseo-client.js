import { AREA_STATE } from './constants.js'

/**
 * Parse a .env file string into a key-value object.
 * Handles comments, empty lines, and quoted values.
 * @param {string} envString
 * @returns {Object<string, string>}
 */
export function parseEnv(envString) {
  const env = {}
  for (const line of envString.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return env
}

/**
 * Build a location name string for DataForSEO API calls.
 * @param {string} area - City name
 * @returns {string} "City,State,United States"
 */
export function locationName(area) {
  const state = AREA_STATE[area]
  if (!state) throw new Error(`Unknown area: ${area}`)
  return `${area},${state},United States`
}

/**
 * Create a DataForSEO API client.
 * @param {{ login: string, password: string }} credentials
 * @returns {{ apiPost: function, authHeader: string, sleep: function }}
 */
export function createClient({ login, password }) {
  const authHeader = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64')

  async function apiPost(path, data) {
    const resp = await fetch(`https://api.dataforseo.com${path}`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`)
    return resp.json()
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  return { apiPost, authHeader, sleep }
}

/**
 * Create a client from raw .env file content.
 * @param {string} envContent
 * @returns {{ apiPost: function, authHeader: string, sleep: function }}
 */
createClient.fromEnvContent = function (envContent) {
  const env = parseEnv(envContent)
  const login = env.DATAFORSEO_LOGIN || env.DATAFORSEO_USERNAME
  const password = env.DATAFORSEO_PASSWORD
  return createClient({ login, password })
}
