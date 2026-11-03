// Runs the crash_lifecycle replays on the code of this checkout. The paths map of the root
// tsconfig.base.json resolves the workspace packages, as in the root vitest.config.ts.
import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('../../../../../', import.meta.url))

export default defineConfig({
  plugins: [tsconfigPaths({ projects: [`${root}tsconfig.base.json`] })],
  test: { include: ['crash-lifecycle.replay.spec.ts'], testTimeout: 30_000 },
})
