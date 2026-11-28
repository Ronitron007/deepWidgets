import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'stub/**/*.test.ts', 'bridge/**/*.test.ts', '**/*.mr.spec.ts'],
    exclude: ['worker/**', 'e2e/**', 'node_modules/**', 'ref/**'],
  },
})
