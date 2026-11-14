import { resolve } from 'node:path'
import { resolveSite, persistSite } from '../template/src/lib/resolve-site'

const rootDir = resolve(import.meta.dirname, '..')
const slug = process.argv[2]

if (!slug) {
  console.error('Usage: npx tsx scripts/resolve-site-runner.ts <slug>')
  process.exit(1)
}

const config = resolveSite(slug, rootDir)
persistSite(config, rootDir)

console.log(
  JSON.stringify(
    {
      shell: config.design.shell,
      tokens: config.design.tokens,
      orders: config.design.orders,
      variants: Object.keys(config.design.variants).length + ' variants',
      classmap: Object.keys(config.design.classmap).length + ' keys',
      nav: config.copy.nav,
      cta: config.copy.cta,
      disclosure: config.copy.disclosure,
    },
    null,
    2
  )
)
