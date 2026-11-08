#!/usr/bin/env node

/**
 * serve-dashboard.mjs
 * Minimal HTTP server that serves the research dashboard and exposes
 * a POST endpoint to persist bulk status changes to candidates.csv.
 *
 * Usage: node scripts/serve-dashboard.mjs
 *        PORT=8080 node scripts/serve-dashboard.mjs
 */

import { createServer } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { parseCandidatesCsv, serializeCandidatesCsv, updateCandidateStatuses } from '../lib/candidates.js'

const ROOT = new URL('..', import.meta.url).pathname
const PORT = parseInt(process.env.PORT || '3456', 10)

const VALID_STATUSES = new Set([
  'discovered', 'validated', 'torn_down', 'viable', 'shortlisted', 'walk_away',
])

const server = createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    try {
      const html = readFileSync(join(ROOT, 'research', 'dashboard.html'), 'utf8')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Failed to read dashboard.html' }))
    }
    return
  }

  if (req.method === 'POST' && req.url === '/api/status') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const { updates } = JSON.parse(body)
        if (!Array.isArray(updates) || updates.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'updates must be a non-empty array' }))
          return
        }

        // Validate all statuses
        for (const u of updates) {
          if (!u.slug || !u.status) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Each update must have slug and status' }))
            return
          }
          if (!VALID_STATUSES.has(u.status)) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: `Invalid status: ${u.status}` }))
            return
          }
        }

        // Read, update, write CSV
        const csvPath = join(ROOT, 'data', 'candidates.csv')
        const rows = parseCandidatesCsv(readFileSync(csvPath, 'utf8'))
        const updated = updateCandidateStatuses(rows, updates)
        writeFileSync(csvPath, serializeCandidatesCsv(updated) + '\n', 'utf8')

        // Rebuild dashboard
        execSync('node scripts/build-dashboard.mjs', { cwd: ROOT, stdio: 'pipe' })

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, updated: updates.length }))
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`Dashboard server listening on http://localhost:${PORT}`)
})
