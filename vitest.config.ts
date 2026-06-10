import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['tests/unit/setup.ts'],
    // Unit tests only. Playwright specs live in e2e/, tests/security, tests/smoke,
    // tests/contract, tests/performance and use *.spec.ts — they must NOT run here.
    include: ['lib/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/services/**/*.ts'],
    },
  },
})
