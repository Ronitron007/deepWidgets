#!/usr/bin/env node
/**
 * Host check of the HMR guards (unit host.hmr_guards, spec safe_host.hmr in docs/specs/safe-host.md).
 * It ports the cases of the HMR safety spike (`plugins_spike.hmr`) that this unit closes. It boots the CLI host (web
 * profile) on free loopback ports, writes small agent bundles (`deepwidgets-agent-*`) into its work folder, and
 * installs and removes them over the host inspector with the plugin manager, as `widget_install` does after its gates.
 * - dispose-hang: a disposer that never ends. The remove ends after about 5 s, the row is quarantined, a no-op
 *   `hmr.runExclusive` and the install of another bundle run at once, and the same files show as failed.
 * - listener-blame: a `ctx.on` listener of a plain agent row (it registers no widget) starts a timer that throws a
 *   string. A host plugin that is not an agent row emits the event from its own timer. The string has no stack, so
 *   only the blame store of the row can blame it. At boot, the crash record blames the row with the method `store`,
 *   with its root and hash, and the next host quarantines the row.
 * - safe-mode: in safe mode, the top-level code and the plugin body of an agent row do not run, its slug shows as off,
 *   and `sample` is live. With no safe mode, both run again.
 * - boot-loop: the top-level code of an agent row loops at boot. The native stack module is refused, as on Electron,
 *   so only the running slot can blame. The watchdog kills the host, the record blames the row with `slot`, and the
 *   next host does not load the row and shows its slug as failed.
 * Environment: WIDGETS_HMR_GUARDS_CASES (comma list) runs only those cases.
 * Prints `widgets-hmr-guards: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` first.
 */
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const work = await mkdtemp(join(process.env.WIDGETS_HMR_GUARDS_TMP ?? tmpdir(), 'widgets-hmr-guards-'))
/** Each case has its own DSH_HOME, so the bundles of one case do not load in the next. */
let home = join(work, 'home')
let state = join(home, 'deepwidgets')
function newHome(name) {
  home = join(work, `home-${name}`)
  state = join(home, 'deepwidgets')
}
const logPath = join(work, 'host.log')
const results = []
const children = new Set()
/** safe_host.provisional: the disposer limit. */
const DISPOSER_LIMIT_MS = 5_000
const CASE_NAMES = ['dispose-hang', 'listener-blame', 'safe-mode', 'boot-loop']
const CASES = process.env.WIDGETS_HMR_GUARDS_CASES?.split(',').map((name) => name.trim()).filter((name) => name !== '')
const runs = (name) => CASES === undefined || CASES.length === 0 || CASES.includes(name)
const unknownCases = (CASES ?? []).filter((name) => !CASE_NAMES.includes(name))
if (unknownCases.length > 0) {
  console.log(`widgets-hmr-guards: fail: unknown case in WIDGETS_HMR_GUARDS_CASES: ${unknownCases.join(', ')} (known: ${CASE_NAMES.join(', ')})`)
  process.exit(1)
}
/** True when the Loader row id `row` (with the ids of its parent rows) ends in the row id `id`. */
const isRow = (row, id) => typeof row === 'string' && (row === id || row.endsWith(`:${id}`))

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : `: ${String(detail).slice(0, 800)}`}`)
}

/** A free loopback port, from the allocator of the kernel. */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

// ---- bundles ----

/** Write the agent bundle `deepwidgets-agent-<slug>` with the module text `code`. */
function bundle(slug, code) {
  const name = `deepwidgets-agent-${slug}`
  const dir = join(work, 'bundles', slug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', private: true, type: 'module', exports: './index.js', dsh: { bundle: { patch: './cordis.patch.yml' } } }, null, 2))
  writeFileSync(join(dir, 'cordis.patch.yml'), `- insert:\n    - id: ${name}\n      name: ${name}\n`)
  writeFileSync(join(dir, 'index.js'), code)
  return { name, dir, slug }
}

/** The module text of an agent widget `slug` that registers one widget, with `extra` at the end of apply. */
const widgetCode = (slug, extra = '') => `export const name = 'agent-${slug}'
export const inject = ['widgets']
export function apply(ctx) {
  ctx.widgets.register({ slug: '${slug}', title: '${slug}', program: 'root = Card([CardHeader("${slug}", "x")])\\n', initialState: {}, actions: [] })
  ${extra}
}
`

// ---- host process ----

async function startHost(port, inspectPort, { nodeArgs = [], env = {}, waitUrl = true } = {}) {
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(logPath, { flags: 'a' })
  const child = spawn(process.execPath, [...nodeArgs, `--inspect=127.0.0.1:${String(inspectPort)}`, BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home, OPENUI_TELEMETRY_DISABLED: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.add(child)
  const startedAt = Date.now()
  const exited = new Promise((resolve) => {
    child.once('exit', (code, signal) => { children.delete(child); resolve({ code, signal, at: Date.now() }) })
  })
  child.stderr.pipe(out)
  const host = { child, exited, startedAt, inspectPort }
  const url = new Promise((resolve, reject) => {
    let text = ''
    const timer = setTimeout(() => reject(new Error('the host did not print its URL in 90 s')), 90_000)
    child.stdout.on('data', (chunk) => {
      out.write(chunk)
      text += chunk
      const match = text.match(/(http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    })
    void exited.then(({ code, signal }) => { clearTimeout(timer); reject(new Error(`the host exited with ${String(code ?? signal)}`)) })
  })
  url.catch(() => {})
  host.stop = () => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve()
    child.once('exit', () => resolve())
    child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), 10_000).unref()
  })
  if (!waitUrl) return host
  const login = await fetch(await url, { redirect: 'manual' })
  const cookie = login.headers.getSetCookie().map((line) => line.split(';')[0]).join('; ')
  if (cookie === '') throw new Error(`the login gave no cookie (${String(login.status)})`)
  const base = `http://127.0.0.1:${String(port)}`
  host.widgets = async () => {
    const answer = await fetch(`${base}/api/widgets`, { headers: { cookie } })
    return (await answer.json().catch(() => null))?.widgets ?? []
  }
  return host
}

/** Connect to the host inspector. `run(body)` evaluates an async function body with `wc` = { loader, ctx }. */
async function inspector(host) {
  const targets = await (await fetch(`http://127.0.0.1:${String(host.inspectPort)}/json/list`)).json()
  const socket = new WebSocket(targets[0].webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', () => reject(new Error('inspector connection failed'))) })
  let next = 0
  const waiting = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    const item = waiting.get(message.id)
    if (item === undefined) return
    waiting.delete(message.id)
    if (message.error) item.reject(new Error(message.error.message))
    else if (message.result?.exceptionDetails) item.reject(new Error(message.result.exceptionDetails.exception?.description ?? 'evaluate failed'))
    else item.resolve(message.result)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => { next += 1; waiting.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })) })
  const proto = await send('Runtime.evaluate', { expression: 'Function.prototype' })
  const functions = await send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId })
  const loaderProto = await send('Runtime.callFunctionOn', {
    objectId: functions.objects.objectId,
    functionDeclaration: 'function () { const found = this.filter((fn) => fn.name === "Loader" && typeof fn.prototype?.showLog === "function" && typeof fn.prototype?.locate === "function"); if (found.length !== 1) throw new Error("Loader functions " + found.length); return found[0].prototype }',
  })
  const loaders = await send('Runtime.queryObjects', { prototypeObjectId: loaderProto.result.objectId })
  await send('Runtime.callFunctionOn', { objectId: loaders.objects.objectId, functionDeclaration: 'function () { globalThis.__hmrGuards = { loader: this[0], ctx: this[0].ctx } }' })
  const run = async (body) => (await send('Runtime.evaluate', { expression: `(async (wc) => { ${body} })(globalThis.__hmrGuards)`, awaitPromise: true, returnByValue: true })).result.value
  return { run, close: () => socket.close() }
}

/**
 * Run `body` in the host with a time limit, outside the hmr transaction of host work in flight.
 * @returns `{ ms, value }`, `{ ms, timeout: true }`, or `{ ms, threw }`.
 */
const timed = (ins, body, ms) => ins.run(`
  const t0 = Date.now()
  const hmr = wc.ctx.get('hmr')
  const job = (async () => { ${body} })
  const run = hmr === undefined ? job() : hmr.executing.exit(job)
  const limit = new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), ${String(ms)}))
  try { const value = await Promise.race([run, limit]); return value?.timeout === true ? { ms: Date.now() - t0, timeout: true } : { ms: Date.now() - t0, value } } catch (error) { return { ms: Date.now() - t0, threw: String(error?.message ?? error).slice(0, 300) } }
`)
const install = (ins, b, ms = 60_000) => timed(ins, `const r = await wc.ctx.get('pluginManager').installBundle(${JSON.stringify(b.dir)}); return r.application`, ms)
const remove = (ins, b, ms = 60_000) => timed(ins, `const r = await wc.ctx.get('pluginManager').removeBundle(${JSON.stringify(b.name)}); return r.application`, ms)

async function waitFor(test, ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await test().catch(() => false)) return true
    await sleep(100)
  }
  return false
}
const readState = (file) => { try { return JSON.parse(readFileSync(join(state, file), 'utf8')) } catch { return undefined } }
const clearState = () => { for (const file of ['crash.json', 'quarantine.json', 'provisional.json']) rmSync(join(state, file), { force: true }) }
const alive = (host) => host.child.exitCode === null && host.child.signalCode === null

async function main() {
  const port = await freePort()
  const inspectPort = await freePort()
  console.log(`widgets-hmr-guards: work folder ${work}, port ${String(port)}, inspector ${String(inspectPort)}`)

  if (runs('dispose-hang')) {
    newHome('dispose-hang')
    const hang = bundle('hang', widgetCode('hang', "ctx.effect(() => () => new Promise(() => {}), 'hang: a disposer that never ends')"))
    const other = bundle('other', "export const name = 'agent-other'\nexport function apply() { globalThis.__hmrGuardsOther = 'ran' }\n")
    const host = await startHost(port, inspectPort)
    try {
      const ins = await inspector(host)
      check('dispose-hang: the hang bundle installs', (await install(ins, hang)).value === 'applied')
      check('dispose-hang: the hang widget is live', await waitFor(async () => (await host.widgets()).some((w) => w.slug === 'hang' && w.failed === undefined), 20_000))
      const removed = await remove(ins, hang, 30_000)
      check(`dispose-hang: the remove ends after about ${String(DISPOSER_LIMIT_MS)} ms`, removed.value === 'applied' && removed.ms >= DISPOSER_LIMIT_MS - 500 && removed.ms <= DISPOSER_LIMIT_MS + 7_000, JSON.stringify(removed))
      const item = (readState('quarantine.json') ?? []).find((q) => isRow(q.row, hang.name))
      check('dispose-hang: the row is quarantined with the hash of its files', item !== undefined && /did not end/.test(item.reason) && typeof item.root === 'string' && typeof item.hash === 'string', JSON.stringify(item))
      const noop = await timed(ins, "return await wc.ctx.get('hmr').runExclusive(async () => 'ran')", 10_000)
      check('dispose-hang: hmr.runExclusive runs at once after the limit', noop.value === 'ran' && noop.ms < 3_000, JSON.stringify(noop))
      const next = await install(ins, other, 30_000)
      check('dispose-hang: the next install works', next.value === 'applied' && await waitFor(async () => await ins.run('return globalThis.__hmrGuardsOther') === 'ran', 10_000), JSON.stringify(next))
      // The same files again: the quarantine holds them, so the slug shows as failed and the module does not load.
      await install(ins, hang, 30_000)
      const failed = await waitFor(async () => (await host.widgets()).some((w) => w.slug === 'hang' && typeof w.failed === 'string' && w.failed.includes('did not end')), 20_000)
      check('dispose-hang: the same files show as failed', failed, JSON.stringify(await host.widgets()))
      ins.close()
    } finally {
      await host.stop()
    }
  }

  if (runs('listener-blame')) {
    newHome('listener-blame')
    const listen = bundle('listen', "export const name = 'agent-listen'\nexport function apply(ctx) {\n  ctx.on('hmr-guards/ping', () => { setTimeout(() => { throw 'listen threw a string' }, 10) })\n}\n")
    // A host plugin, not an agent row, emits the event from its own timer, so the listener runs outside the agent code.
    const pinger = bundle('pinger', "export const name = 'hmr-guards-pinger'\nexport const inject = ['timer']\nexport function apply(ctx) { ctx.interval(() => { ctx.emit('hmr-guards/ping') }, 500) }\n")
    const pingerId = 'hmr-guards-pinger'
    writeFileSync(join(pinger.dir, 'package.json'), JSON.stringify({ name: pingerId, version: '1.0.0', private: true, type: 'module', exports: './index.js', dsh: { bundle: { patch: './cordis.patch.yml' } } }, null, 2))
    writeFileSync(join(pinger.dir, 'cordis.patch.yml'), `- insert:\n    - id: ${pingerId}\n      name: ${pingerId}\n`)
    pinger.name = pingerId
    let host = await startHost(port, inspectPort)
    try {
      const ins = await inspector(host)
      check('listener-blame: the listen bundle installs', (await install(ins, listen)).value === 'applied')
      ins.close()
    } finally {
      await host.stop()
    }
    // The pinger goes in last, in a host that has no inspector session at the crash.
    host = await startHost(port, inspectPort)
    try {
      const ins = await inspector(host)
      void install(ins, pinger)
      const exit = await Promise.race([host.exited, sleep(30_000).then(() => null)])
      ins.close()
      check('listener-blame: the pinger crashes the host that installs it', exit !== null, JSON.stringify(exit))
    } finally {
      await host.stop()
    }
    clearState()
    host = await startHost(port, inspectPort, { waitUrl: false })
    const exit = await Promise.race([host.exited, sleep(30_000).then(() => null)])
    if (exit === null) await host.stop()
    const record = readState('crash.json')
    const detail = JSON.stringify({ exit, row: record?.row, method: record?.method, root: record?.root, hash: record?.hash, message: record?.error?.message })
    check('listener-blame: the host exits with code 1, and the record blames the row by its store', exit?.code === 1 && isRow(record?.row, listen.name) && record?.method === 'store', detail)
    check('listener-blame: the record has the root and the hash of the row', typeof record?.root === 'string' && typeof record?.hash === 'string', detail)
    host = await startHost(port, inspectPort)
    try {
      const item = (readState('quarantine.json') ?? []).find((q) => isRow(q.row, listen.name))
      await sleep(2_000)
      check('listener-blame: the next host quarantines the row and lives', item !== undefined && alive(host), JSON.stringify(readState('quarantine.json')))
      const ins = await inspector(host)
      await remove(ins, pinger, 30_000)
      await remove(ins, listen, 30_000)
      ins.close()
    } finally {
      await host.stop()
    }
  }

  if (runs('safe-mode')) {
    newHome('safe-mode')
    const marks = join(work, 'safe-marks')
    const safe = bundle('safe', `import { appendFileSync } from 'node:fs'
appendFileSync(${JSON.stringify(marks)}, 'top\\n')
export const name = 'agent-safe'
export function apply() { appendFileSync(${JSON.stringify(marks)}, 'apply\\n') }
`)
    const readMarks = () => existsSync(marks) ? readFileSync(marks, 'utf8').split('\n').filter((line) => line !== '') : []
    let host = await startHost(port, inspectPort)
    try {
      const ins = await inspector(host)
      check('safe-mode: the safe bundle installs and runs', (await install(ins, safe)).value === 'applied' && await waitFor(async () => readMarks().includes('apply'), 10_000), JSON.stringify(readMarks()))
      ins.close()
    } finally {
      await host.stop()
    }
    rmSync(marks, { force: true })
    host = await startHost(port, inspectPort, { env: { DEEPWIDGETS_SAFE_MODE: '1' } })
    try {
      const sample = await waitFor(async () => (await host.widgets()).some((w) => w.slug === 'sample' && w.failed === undefined && w.off === undefined), 20_000)
      const off = await waitFor(async () => (await host.widgets()).some((w) => w.slug === 'safe' && w.off?.reason === 'safe-mode'), 10_000)
      await sleep(2_000)
      check('safe-mode: the code of the agent row does not run', readMarks().length === 0, JSON.stringify(readMarks()))
      check('safe-mode: sample is live and the agent slug is off', sample && off, JSON.stringify(await host.widgets()))
    } finally {
      await host.stop()
    }
    host = await startHost(port, inspectPort)
    try {
      check('safe-mode: with no safe mode, the agent row runs again', await waitFor(async () => readMarks().includes('top') && readMarks().includes('apply'), 20_000), JSON.stringify(readMarks()))
      const ins = await inspector(host)
      await remove(ins, safe, 30_000)
      ins.close()
    } finally {
      await host.stop()
    }
  }

  if (runs('boot-loop')) {
    newHome('boot-loop')
    const flag = join(work, 'loop-flag')
    rmSync(flag, { force: true })
    const loop = bundle('loop', `import { existsSync } from 'node:fs'
if (existsSync(${JSON.stringify(flag)})) { for (;;) {} }
export const name = 'agent-loop'
export function apply() {}
`)
    // A module hook refuses the native stack module, as on Electron with no build for Electron.
    const block = join(work, 'block-native.mjs')
    writeFileSync(block, [
      "import { registerHooks } from 'node:module'",
      'registerHooks({ resolve(specifier, context, next) {',
      '  const result = next(specifier, context)',
      "  if (result.url.includes('/@sentry/node-native-stacktrace/')) throw new Error('the check refuses @sentry/node-native-stacktrace')",
      '  return result',
      '} })',
    ].join('\n'))
    const nodeArgs = ['--import', pathToFileURL(block).href]
    let host = await startHost(port, inspectPort, { nodeArgs })
    try {
      const ins = await inspector(host)
      check('boot-loop: the loop bundle installs', (await install(ins, loop)).value === 'applied')
      ins.close()
    } finally {
      await host.stop()
    }
    writeFileSync(flag, '1')
    host = await startHost(port, inspectPort, { nodeArgs, waitUrl: false })
    const exit = await Promise.race([host.exited, sleep(60_000).then(() => null)])
    if (exit === null) await host.stop()
    const record = readState('crash.json')
    const detail = JSON.stringify({ exit, ms: exit === null ? null : exit.at - host.startedAt, row: record?.row, method: record?.method, root: record?.root, hash: record?.hash })
    check('boot-loop: the watchdog kills the host at boot', exit !== null && exit.signal === 'SIGKILL', detail)
    check('boot-loop: the record blames the row by the running slot, with its root and hash', isRow(record?.row, loop.name) && record?.method === 'slot' && typeof record?.root === 'string' && typeof record?.hash === 'string', detail)
    host = await startHost(port, inspectPort, { nodeArgs })
    try {
      const failed = await waitFor(async () => (await host.widgets()).some((w) => w.slug === 'loop' && typeof w.failed === 'string'), 20_000)
      await sleep(3_000)
      check('boot-loop: the next host does not load the row and shows its slug as failed', failed && alive(host), JSON.stringify(await host.widgets().catch((error) => String(error))))
    } finally {
      await host.stop()
    }
  }
}

let exitCode = 1
try {
  await main()
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('widgets-hmr-guards: pass')
    exitCode = 0
  } else {
    console.log(`widgets-hmr-guards: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`widgets-hmr-guards: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  for (const child of children) child.kill('SIGKILL')
}
process.exit(exitCode)
