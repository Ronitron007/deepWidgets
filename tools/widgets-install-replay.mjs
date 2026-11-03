#!/usr/bin/env node
/**
 * Check of the install records (unit widget.install_records, spec widget_fv.install).
 *
 * It runs the `widget_install` replays of the skill widget-state-models on the CLI host of this checkout. Each replay
 * asserts the rule of `widget_fv.install`:
 * - newseed: a first install that throws in the host is rolled back with its program record, and the next new seed is stored;
 * - sameseed: a host crash after the new bundle is live does not make a reinstall of the same code overwrite an edit;
 * - quarantine: a failed reinstall and its rollback keep the quarantine, and files with another hash that load end it;
 * - safe: in safe mode, remove and install clear the off entry of an agent slug, and only a live widget that is not an
 *   agent bundle gives slug-taken.
 *
 * Usage: node tools/widgets-install-replay.mjs [newseed|sameseed|quarantine|safe ...]. With no name, it runs all four.
 * Prints `widgets-install-replay: pass` and exits 0 only when each replay passes.
 * Needs `corepack pnpm run build:artifacts` first. It does not use port 47615.
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const REPLAYS = join(ROOT, '.agents/skills/widget-state-models/widget_install/replay')
const ALL = ['newseed', 'sameseed', 'quarantine', 'safe']

const names = process.argv.slice(2)
const unknown = names.filter((name) => !ALL.includes(name))
if (unknown.length > 0) {
  console.error(`widgets-install-replay: unknown replay ${unknown.join(', ')}; use ${ALL.join(', ')}`)
  process.exit(2)
}
const failed = []
for (const name of names.length === 0 ? ALL : names) {
  console.log(`widgets-install-replay: ${name}`)
  const run = spawnSync(process.execPath, [join(REPLAYS, `replay-${name}.mjs`)], { stdio: 'inherit', env: { ...process.env, OPENUI_TELEMETRY_DISABLED: '1' } })
  if (run.status !== 0) failed.push(`${name} (exit ${String(run.status ?? run.signal)})`)
}
console.log(failed.length === 0 ? 'widgets-install-replay: pass' : `widgets-install-replay: fail: ${failed.join(', ')}`)
process.exit(failed.length === 0 ? 0 : 1)
