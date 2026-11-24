#!/usr/bin/env node
/**
 * A second process that uses the same kit as a host, for the lock steps of tools/kit-service.mjs (`kit.service.lock`).
 * It makes the service `kit` of `deepwidgets/kit/lib/index.js` with a minimal context: the Service base class needs only
 * `reflect.provide`, and the service needs only `logger`. Thus its start and its changes are the code of the host, with
 * the same file lock, in another process.
 *
 * Usage: `node tools/fixtures/kit-process.mjs <kit dir> <settings file> start|add|remove [arg]`. It prints one line
 * `RESULT <json>`: `{ ok: true, value }` with the value of read(), add(), or remove(), or `{ ok: false, code, message }`.
 * With `KIT_PROCESS_PNPM`, the service runs that pnpm entry in place of the pnpm of the app.
 */
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PNPM_ENTRY } from './kit-host.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const [dir, settingsFile, op, arg] = process.argv.slice(2)
const { KitService } = await import(pathToFileURL(join(ROOT, 'deepwidgets/kit/lib/index.js')).href)
const line = (level) => (...parts) => { process.stderr.write(`[${level}] ${parts.map(String).join(' ')}\n`) }
const ctx = { reflect: { provide: () => () => {} }, logger: { info: line('I'), warn: line('W'), error: line('E') } }
const pnpm = { command: process.execPath, args: [process.env.KIT_PROCESS_PNPM ?? PNPM_ENTRY], env: { OPENUI_TELEMETRY_DISABLED: '1' } }
const kit = new KitService(ctx, { dir, settingsFile, pnpm })
let result
try {
  result = { ok: true, value: op === 'start' ? await kit.read() : await kit[op](arg) }
} catch (error) {
  result = { ok: false, code: error?.code, message: error instanceof Error ? error.message : String(error) }
}
await kit.stop()
process.stdout.write(`RESULT ${JSON.stringify(result)}\n`)
