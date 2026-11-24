#!/usr/bin/env node
/**
 * The CLI host of tools/kit-service.mjs, with the pnpm of the app (`standing.checked.pnpm_in_app`). It runs the dsh CLI
 * as `apps/desktop-host/src/cli.ts` does: `runCli` gets a `packageManager`, so the host has
 * `profileContext.packageManager`, and the kit and the plugin manager run that pnpm. The pnpm is the entry that the dev
 * desktop app gives its host (`apps/desktop/src/host-process.ts`). A plain `apps/cli/lib/bin.js` host has no such
 * command, and runs `pnpm` on the PATH, whose version depends on the machine.
 *
 * Usage: `node [--inspect=...] tools/fixtures/kit-host.mjs --profile web ...` (the arguments of the dsh CLI).
 */
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
export const PNPM_ENTRY = join(ROOT, 'apps/desktop/node_modules/pnpm/bin/pnpm.mjs')

if (import.meta.main) {
  const { runCli } = await import(pathToFileURL(join(ROOT, 'apps/cli/lib/bin.js')).href)
  // KIT_HOST_PNPM replaces the pnpm entry, for the step of tools/kit-service.mjs with another pnpm version.
  await runCli({ packageManager: { command: process.execPath, args: [process.env.KIT_HOST_PNPM ?? PNPM_ENTRY], env: {} } })
}
