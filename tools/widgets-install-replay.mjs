#!/usr/bin/env node
/**
 * Check of the install records (unit widget.install_records, spec widget_fv.install) and of the replace (unit
 * widget.install_replace, spec widget_fv.replace).
 *
 * It runs the `widget_install` replays of the skill widget-state-models on the CLI host of this checkout. Each replay
 * asserts the rule of `widget_fv.install`:
 * - newseed: a first install that throws in the host is rolled back with its program record, and the next new seed is stored;
 * - sameseed: a host crash after the new bundle is live does not make a reinstall of the same code overwrite an edit;
 * - rollback: a reinstall that throws after it registers leaves the user edit and the seed hash of the old version;
 * - quarantine: a failed reinstall, a live-wait timeout, and their rollbacks keep the quarantine, and files with another
 *   hash that install with success end it;
 * - safe: in safe mode, remove and install clear the off entry of an agent slug, and only a live widget that is not an
 *   agent bundle gives slug-taken;
 * - reserved: the slug of a built-in widget gives slug-taken, also while the built-in is off;
 * - guard: widget code can not use the install records;
 * - replace: a failed reinstall keeps the old version live, with its state and its program, and a good reinstall moves
 *   the slug to the other agent package name;
 * - putback: a failed reinstall keeps the old version live also when the old code can not start again.
 *
 * Usage: node tools/widgets-install-replay.mjs [newseed|sameseed|rollback|quarantine|safe|reserved|guard|replace|putback ...]. With no name, it runs all of them.
 * Prints `widgets-install-replay: pass` and exits 0 only when each replay passes.
 * Needs `corepack pnpm run build:artifacts` first. It does not use port 47615.
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const REPLAYS = join(ROOT, '.agents/skills/widget-state-models/widget_install/replay')
const ALL = ['newseed', 'sameseed', 'rollback', 'quarantine', 'safe', 'reserved', 'guard', 'replace', 'putback']

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
