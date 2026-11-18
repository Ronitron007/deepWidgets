#!/usr/bin/env node
/**
 * Host check of the seed program of a built-in widget (unit main.seed_refresh, spec main_widget.seed).
 *
 * It starts the CLI host (web profile) of this checkout four times with one profile. Through the host inspector, it
 * writes program records into storage as an older app wrote them, and reads them back with the service
 * `widgetRecords`. It reads the program of a widget with GET /api/widgets/<slug>/program, as a page does.
 * - First start: the record of `sample` has the seed program of `@deepwidgets/widget-sample` and its seed hash, and the
 *   record of `main` has the hash of its text. The check installs an agent widget over MCP, then writes an older
 *   program of `sample` with an older seed hash, and a record of the agent widget without a seed hash.
 * - Second start: GET program of `sample` gives the new seed program with the next rev, and the record has the new seed
 *   hash. The agent widget keeps its stored program, without a seed hash (`widget_fv.install`). Then the check writes
 *   an older program of `sample` without a seed hash, as the records of built-in widgets were before this unit.
 * - Third start: `sample` has the new seed program and hash again. Then a plugin edits its program, which keeps the hash.
 * - Fourth start, with the same seed: the record of `sample` does not change. The rev and the edit stay.
 * Prints `widgets-seed-refresh: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` first. A run starts a host: take the machine lock of the smoke checks.
 * It does not use port 47615.
 */
import { createHash } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Host, checks, outside, program, recordOf, short, writeWidget } from '../.agents/skills/widget-state-models/widget_install/replay/lib.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
/** The seed program in the code of this checkout. The host must store it. */
const { PROGRAM: SEED } = await import(pathToFileURL(join(ROOT, 'deepwidgets/widget-sample/lib/index.js')).href)
const AGENT = 'seed-agent'
const OLDER_HASHED = 'root = Card([CardHeader("Sample", "OLDER SEED WITH A HASH")])'
const OLDER_PLAIN = 'root = Card([CardHeader("Sample", "OLDER SEED WITHOUT A HASH")])'
const EDIT = 'root = Card([CardHeader("Sample", "EDITED BY A PLUGIN")])'
const AGENT_STORED = 'root = Card([CardHeader("Seed agent", "STORED WITHOUT A HASH")])'

/** The seed hash as the runtime computes it (`seedHash` of @deepwidgets/widgets). */
const hashOf = (text) => createHash('sha256').update(text).digest('hex')
const work = mkdtempSync(join(process.env.WIDGETS_SEED_REFRESH_TMP ?? tmpdir(), 'widgets-seed-refresh-'))
const host = new Host(work)
const { check, done } = checks('widgets-seed-refresh')
const put = (ins, slug, record) => outside(ins, `await wc.ctx.get('widgetRecords').restoreProgram(${JSON.stringify(slug)}, ${JSON.stringify(record)}, { by: 'widgets-seed-refresh' })`)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

try {
  check('the seed program of @deepwidgets/widget-sample is a string', typeof SEED === 'string' && SEED.length > 0, short(SEED))

  // First start: a new profile.
  await host.start()
  let ins = await host.inspector()
  const first = await recordOf(ins, 'sample')
  check('first start: the record of sample has the seed program and its seed hash',
    first?.text === SEED && first.seed === hashOf(SEED) && first.rev === 1, short(first))
  const main = await recordOf(ins, 'main')
  check('first start: the record of main has the seed hash of its text', typeof main?.text === 'string' && main.seed === hashOf(main.text), short(main))
  const tpl = (await host.call('widget_template', { slug: AGENT, title: 'Seed agent' })).body?.files?.[0]?.text
  const installed = await host.call('widget_install', { dir: writeWidget(work, AGENT, tpl, program('AGENT SEED')) })
  check('first start: the agent widget installs', !installed.isError && installed.body?.application === 'applied', short(installed.body?.error ?? installed.body))
  const agentRecord = { rev: 4, text: AGENT_STORED, updatedAt: 2000 }
  await put(ins, 'sample', { rev: 7, text: OLDER_HASHED, updatedAt: 1000, seed: hashOf(OLDER_HASHED) })
  await put(ins, AGENT, agentRecord)
  const older = await recordOf(ins, 'sample')
  const agentBefore = await recordOf(ins, AGENT)
  check('first start: the profile stores an older program of sample with an older seed hash',
    older?.text === OLDER_HASHED && older.rev === 7 && older.seed === hashOf(OLDER_HASHED), short(older))
  check('first start: the profile stores a program of the agent widget without a seed hash',
    agentBefore?.text === AGENT_STORED && agentBefore.rev === 4 && agentBefore.seed === null, short(agentBefore))
  await host.stop()

  // Second start: the seed hash in the record of sample is older than the seed of the code.
  await host.start()
  ins = await host.inspector()
  let page = await host.programText('sample')
  let record = await recordOf(ins, 'sample')
  check('second start: GET program of sample gives the new seed program with the next rev',
    page.status === 200 && page.text === SEED && page.rev === 8, short(page))
  check('second start: the record of sample has the new seed hash', record?.text === SEED && record.seed === hashOf(SEED) && record.rev === 8, short(record))
  const agentPage = await host.programText(AGENT)
  const agentAfter = await recordOf(ins, AGENT)
  check('second start: the agent widget keeps its stored program without a seed hash',
    same(agentAfter, agentBefore) && agentPage.text === AGENT_STORED && agentPage.rev === 4, short({ agentAfter, agentPage }))
  await put(ins, 'sample', { rev: 20, text: OLDER_PLAIN, updatedAt: 3000 })
  const plain = await recordOf(ins, 'sample')
  check('second start: the profile stores an older program of sample without a seed hash',
    plain?.text === OLDER_PLAIN && plain.rev === 20 && plain.seed === null, short(plain))
  await host.stop()

  // Third start: the record of sample has no seed hash.
  await host.start()
  ins = await host.inspector()
  page = await host.programText('sample')
  record = await recordOf(ins, 'sample')
  check('third start: GET program of sample gives the new seed program with the next rev',
    page.status === 200 && page.text === SEED && page.rev === 21, short(page))
  check('third start: the record of sample has the new seed hash', record?.text === SEED && record.seed === hashOf(SEED) && record.rev === 21, short(record))
  const edited = await outside(ins, `return await wc.ctx.get('widgets').setProgram('sample', ${JSON.stringify(EDIT)}, { by: 'widgets-seed-refresh' })`)
  const before = await ins.run(`const r = await wc.ctx.get('widgetRecords').programRecord('sample'); return r ?? null`)
  check('third start: a plugin edit of sample keeps the seed hash', edited?.rev === 22 && before?.text === EDIT && before.seed === hashOf(SEED), short({ edited, before }))
  await host.stop()

  // Fourth start: the same seed. Nothing changes.
  await host.start()
  ins = await host.inspector()
  const after = await ins.run(`const r = await wc.ctx.get('widgetRecords').programRecord('sample'); return r ?? null`)
  page = await host.programText('sample')
  check('fourth start: the record of sample does not change, so the rev and the edit stay', same(after, before), short({ after, before }))
  check('fourth start: GET program of sample gives the edit with the same rev', page.status === 200 && page.text === EDIT && page.rev === 22, short(page))
  check('fourth start: the agent widget keeps its stored program', same(await recordOf(ins, AGENT), agentBefore), short(await recordOf(ins, AGENT)))
} catch (error) {
  check('the check runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally {
  await host.stop()
}
done(work)
console.log(process.exitCode === 0 ? 'widgets-seed-refresh: pass' : 'widgets-seed-refresh: fail')
