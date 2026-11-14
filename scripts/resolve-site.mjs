#!/usr/bin/env node

import { execSync } from 'child_process'
import { resolve } from 'path'
import { existsSync } from 'fs'

const rootDir = resolve(import.meta.dirname, '..')
const slug = process.argv[2]

if (!slug) {
  console.error('Usage: node scripts/resolve-site.mjs <slug>')
  process.exit(1)
}

const siteYaml = resolve(rootDir, 'sites', slug, 'site.yaml')
if (!existsSync(siteYaml)) {
  console.error(`site.yaml not found: ${siteYaml}`)
  process.exit(1)
}

execSync(`npx tsx scripts/resolve-site-runner.ts ${slug}`, {
  cwd: rootDir,
  stdio: 'inherit',
})
console.log(`\nResolved and persisted: sites/${slug}/site.yaml`)
