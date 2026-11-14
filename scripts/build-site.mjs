#!/usr/bin/env node

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

const rootDir = resolve(import.meta.dirname, '..')
const slug = process.env.SITE || process.argv[2]

if (!slug) {
  console.error('Usage: SITE=<slug> node scripts/build-site.mjs')
  console.error('   or: node scripts/build-site.mjs <slug>')
  process.exit(1)
}

const siteYaml = resolve(rootDir, 'sites', slug, 'site.yaml')
if (!existsSync(siteYaml)) {
  console.error(`site.yaml not found: ${siteYaml}`)
  process.exit(1)
}

console.log(`Building site: ${slug}`)
execSync('npx astro build', {
  cwd: resolve(rootDir, 'template'),
  stdio: 'inherit',
  env: { ...process.env, SITE: slug },
})
console.log(`Output: dist/${slug}/`)
