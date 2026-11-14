#!/usr/bin/env node

import { readdirSync, readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'

const rootDir = resolve(import.meta.dirname, '..')
const sitesDir = resolve(rootDir, 'sites')

const slugs = readdirSync(sitesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .filter((d) => existsSync(resolve(sitesDir, d.name, 'site.yaml')))
  .map((d) => d.name)

console.log(`Found ${slugs.length} sites`)

for (const slug of slugs) {
  console.log(`\n--- Building ${slug} ---`)
  try {
    execSync(`node ${resolve(rootDir, 'scripts', 'build-site.mjs')} ${slug}`, {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, SITE: slug },
    })
  } catch {
    console.error(`FAILED: ${slug}`)
    process.exit(1)
  }
}

console.log(`\nAll ${slugs.length} sites built.`)
