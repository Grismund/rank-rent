import { defineConfig } from 'astro/config'
import preact from '@astrojs/preact'

const site = process.env.SITE || 'default'

export default defineConfig({
  output: 'static',
  outDir: `../dist/${site}`,
  integrations: [preact()],
})
