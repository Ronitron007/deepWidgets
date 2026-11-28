import { defineConfig } from 'vitest/config'

// `npm run e2e`: the wrangler dev suite. Not part of `npx vitest run` (vitest.config.ts excludes e2e/).
export default defineConfig({
  test: {
    include: ['e2e/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
})
