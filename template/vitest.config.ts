import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const root = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: {
      '@lib': resolve(root, 'src/lib'),
      '@components': resolve(root, 'src/components'),
      '@config': resolve(root, 'src/config'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
})
