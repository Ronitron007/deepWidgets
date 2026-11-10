#!/usr/bin/env node
/**
 * Check of the unit widget.crash_records (specs `widget_fv.crash`, `safe_host.crash`, and `safe_host.cleanup` in
 * docs/specs/widget-fv.md and docs/specs/safe-host.md).
 * - replays: the `crash_lifecycle` replays of the `widget-state-models` skill (vitest). They cover the innocent
 *   widget, the provisional record only on an abort (on the paths before the first ready and with no exit code), the
 *   hash that lifts the quarantine, and the slug of a row that throws before it registers.
 * - specs: the vitest specs `host-process.spec.ts`, `deepwidgets-supervisor.spec.ts`, and
 *   `deepwidgets-crash-policy.spec.ts` of apps/desktop/tests (`safe_host.crash`).
 * Then it boots the CLI host (web profile) on free loopback ports with the fixtures `throw-widget`, `crash-host`,
 * `watchdog-host`, and `watchdog-widget` of deepwidgets/widgets/fixtures:
 * - innocent (widget_fv.crash): a widget call stalls 800 ms, so the provisional record comes. The call returns, and
 *   host code aborts before the next heartbeat. The compiled `inSlot` must remove the record, so the real supervisor
 *   blames no widget and the next host runs the widget.
 * - throw-first: a widget whose plugin body throws before it registers shows as failed with the reason.
 * - throw-timer: a timer of that widget throws before it registers. The crash record has the root and the hash of
 *   its package, the next host holds it, and a changed file lifts the quarantine when the new code loads with success.
 * - cleanup-marker: at an uncaught error, the host disposes its plugins (a disposer writes a marker) and exits 1.
 * - cleanup-async and cleanup-sync: a disposer that never settles, or that loops, ends the host with SIGKILL about
 *   3 s after the crash. The crash record stays the record of the claimer, and the real supervisor counts one crash.
 * - cleanup-widget-loop: a disposer of a widget loops. The native stack of the stuck thread is in widget files, so
 *   only the crash slot keeps the watchdog from a stall record over the record of the claimer.
 * - cleanup-no-worker: the check stops the watchdog thread over the inspector. A disposer that never settles still
 *   ends the host after about 3 s, by the timer of the fail-loud release.
 * Environment: WIDGETS_CRASH_CASES (comma list) runs only those cases.
 * Prints `widgets-crash-replay: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm install` and `corepack pnpm run build:artifacts` first.
 */
import { spawn, spawnSync } from 'node:child_process'
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { pinnedFunction } from './lib/in-host.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const FIXTURES = join(ROOT, 'deepwidgets/widgets/fixtures')
const work = await mkdtemp(join(process.env.WIDGETS_CRASH_TMP ?? tmpdir(), 'widgets-crash-replay-'))
const home = join(work, 'home')
const state = join(home, 'deepwidgets')
const logPath = join(work, 'host.log')
const results = []
const children = new Set()
const WIDGET = 'deepwidgets-widget-throwfirst'
/** safe_host.cleanup: a dispose that does not end kills the host about 3 s after the crash, in this window. */
const CLEANUP_MIN_MS = 2_800
const CLEANUP_MAX_MS = 5_500
/** True when the Loader row id `row` (with the ids of its parent rows) ends in the row id `id`. */
const isRow = (row, id) => typeof row === 'string' && (row === id || row.endsWith(`:${id}`))
const HOST_CASES = ['innocent', 'throw-first', 'throw-timer', 'cleanup-marker', 'cleanup-async', 'cleanup-sync', 'cleanup-widget-loop', 'cleanup-no-worker']
const CASE_NAMES = ['replays', 'specs', ...HOST_CASES]
const CASES = process.env.WIDGETS_CRASH_CASES?.split(',').map((name) => name.trim()).filter((name) => name !== '')
const runs = (name) => CASES === undefined || CASES.length === 0 || CASES.includes(name)
const unknownCases = (CASES ?? []).filter((name) => !CASE_NAMES.includes(name))
if (unknownCases.length > 0) {
  console.log(`widgets-crash-replay: fail: unknown case in WIDGETS_CRASH_CASES: ${unknownCases.join(', ')} (known: ${CASE_NAMES.join(', ')})`)
  process.exit(1)
}

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : `: ${detail}`}`)
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

// ---- host process ----

async function startHost(port, inspectPort, nodeArgs = [], env = {}) {
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(logPath, { flags: 'a' })
  const child = spawn(process.execPath, [...nodeArgs, `--inspect=127.0.0.1:${String(inspectPort)}`, BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.add(child)
  const exited = new Promise((resolve) => {
    child.once('exit', (code, signal) => { children.delete(child); resolve({ code, signal, at: Date.now() }) })
  })
  child.stderr.pipe(out)
  const url = await new Promise((resolve, reject) => {
    let text = ''
    const timer = setTimeout(() => reject(new Error('the host did not print its URL in 90 s')), 90_000)
    child.stdout.on('data', (chunk) => {
      out.write(chunk)
      text += chunk
      const match = text.match(/(http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    })
    void exited.then(({ code }) => { clearTimeout(timer); reject(new Error(`the host exited with ${String(code)}`)) })
  })
  const login = await fetch(url, { redirect: 'manual' })
  const cookie = login.headers.getSetCookie().map((line) => line.split(';')[0]).join('; ')
  if (cookie === '') throw new Error(`the login gave no cookie (${String(login.status)})`)
  const base = `http://127.0.0.1:${String(port)}`
  const api = (path, init = {}) => fetch(base + path, { ...init, headers: { cookie, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...init.headers } })
  // A dead host gives status 0, so each case reports its failure and the next case still runs.
  const getJson = async (path) => {
    try {
      const r = await api(path)
      return { status: r.status, body: await r.json().catch(() => null) }
    } catch (error) {
      return { status: 0, body: null, error: String(error.cause?.code ?? error.message) }
    }
  }
  const post = async (path, body) => {
    try {
      const r = await api(path, { method: 'POST', body: JSON.stringify(body) })
      return { status: r.status, body: await r.json().catch(() => null) }
    } catch (error) {
      return { status: 0, body: null, error: String(error.cause?.code ?? error.message) }
    }
  }
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve()
    child.once('exit', () => resolve())
    child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), 10_000).unref()
  })
  return { child, exited, getJson, post, stop, inspectPort }
}

/** Install one local bundle over the host inspector with pluginManager.installBundle on the Loader. */
async function installBundle(inspectPort, folder) {
  const targets = await (await fetch(`http://127.0.0.1:${String(inspectPort)}/json/list`)).json()
  const url = targets[0]?.webSocketDebuggerUrl
  if (typeof url !== 'string') throw new Error('the inspector has no target')
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', () => reject(new Error('inspector connection failed'))) })
  let next = 0
  const waiting = new Map()
  // A host that dies during the install closes the socket: each waiting call fails.
  socket.addEventListener('close', () => {
    for (const item of waiting.values()) item.reject(new Error('the inspector connection closed'))
    waiting.clear()
  })
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    const item = waiting.get(message.id)
    if (item === undefined) return
    waiting.delete(message.id)
    if (message.error) item.reject(new Error(message.error.message))
    else if (message.result?.exceptionDetails) item.reject(new Error(message.result.exceptionDetails.exception?.description ?? 'evaluate failed'))
    else item.resolve(message.result)
  })
  const send = (method, params) => new Promise((resolve, reject) => { next += 1; waiting.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })) })
  try {
    const proto = await send('Runtime.evaluate', { expression: 'Function.prototype' })
    const functions = await send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId })
    const loaderProto = await send('Runtime.callFunctionOn', {
      objectId: functions.objects.objectId,
      functionDeclaration: 'function () { const found = this.filter((fn) => fn.name === "Loader" && typeof fn.prototype?.showLog === "function" && typeof fn.prototype?.locate === "function"); if (found.length !== 1) throw new Error("Loader functions " + found.length); return found[0].prototype }',
    })
    const loaders = await send('Runtime.queryObjects', { prototypeObjectId: loaderProto.result.objectId })
    const reply = await send('Runtime.callFunctionOn', {
      objectId: loaders.objects.objectId,
      awaitPromise: true,
      returnByValue: true,
      arguments: [{ value: `file:${folder}` }],
      functionDeclaration: pinnedFunction(`async function (spec) {
        if (this.length !== 1) throw new Error("Loader instances " + this.length);
        const manager = this[0].ctx?.get?.("pluginManager");
        if (manager === undefined) throw new Error("no pluginManager on the Loader ctx");
        // The inspector call can inherit the hmr transaction store of host work in flight; leave it, as hmr.watchConfig does.
        const hmr = this[0].ctx?.get?.("hmr");
        return await (hmr === undefined ? manager.installBundle(spec) : hmr.executing.exit(() => manager.installBundle(spec)));
      }`),
    })
    return reply.result.value
  } finally {
    socket.close()
  }
}

async function waitFor(test, ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await test().catch(() => false)) return true
    await sleep(100)
  }
  return false
}

const readState = (file) => {
  try { return JSON.parse(readFileSync(join(state, file), 'utf8')) } catch { return undefined }
}
const clearState = () => { for (const file of ['crash.json', 'provisional.json', 'quarantine.json']) rmSync(join(state, file), { force: true }) }
const widgetIn = async (host, slug, test) => {
  const list = await host.getJson('/api/widgets')
  return list.body?.widgets?.some((widget) => widget.slug === slug && test(widget)) === true
}
const alive = (host) => host.child.exitCode === null && host.child.signalCode === null

/** Stop each worker thread of the host over the inspector. Gives the number of workers. */
async function stopWorkers(inspectPort) {
  const targets = await (await fetch(`http://127.0.0.1:${String(inspectPort)}/json/list`)).json()
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
  const send = (method, params) => new Promise((resolve, reject) => { next += 1; waiting.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })) })
  try {
    const proto = await send('Runtime.evaluate', { expression: "require('node:worker_threads').Worker.prototype", includeCommandLineAPI: true })
    const workers = await send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId })
    const reply = await send('Runtime.callFunctionOn', {
      objectId: workers.objects.objectId,
      returnByValue: true,
      // The list also holds objects that only inherit from Worker.prototype, such as the prototype of a subclass.
      functionDeclaration: 'function () { let stopped = 0; for (const worker of this) { try { void worker.terminate(); stopped += 1 } catch { /* not a worker */ } } return stopped }',
    })
    return reply.result.value
  } finally {
    socket.close()
  }
}

/** The real supervisor of Electron main decides on the exit of `exit`. Gives its log lines. */
async function supervise(exit, pid) {
  process.env.DSH_HOME = home
  // tsx loads the TypeScript source, which has parameter properties that the type strip of Node does not take.
  const { tsImport } = await import('tsx/esm/api')
  const { DesktopHostSupervisor } = await tsImport('../apps/desktop/src/deepwidgets-supervisor.ts', import.meta.url)
  const lines = []
  const log = console.log
  console.log = (line) => { lines.push(String(line)) }
  try {
    const supervisor = new DesktopHostSupervisor(async () => {})
    supervisor.ready()
    supervisor.failed(Object.assign(new Error('dsh desktop host stopped'), { hostPid: pid, hostCode: exit.code, hostSignal: exit.signal }), false)
    supervisor.dispose()
  } finally {
    console.log = log
  }
  return lines.filter((line) => line.startsWith('deepwidgets-supervisor ')).map((line) => JSON.parse(line.slice('deepwidgets-supervisor '.length)))
}

/** Start a host that can die at boot. Gives the host, or the exit when it died before it printed its URL. */
async function startOrExit(port, inspectPort, env) {
  try {
    return { host: await startHost(port, inspectPort, [], env) }
  } catch (error) {
    return { error: String(error.message) }
  }
}

async function main() {
  if (runs('replays')) {
    const replay = spawnSync(join(ROOT, 'node_modules/.bin/vitest'), ['run', '--root', join(ROOT, '.agents/skills/widget-state-models/crash_lifecycle/replay')], { cwd: ROOT, encoding: 'utf8' })
    const summary = `${replay.stdout ?? ''}`.split('\n').filter((line) => /Tests|Test Files|FAIL|✓|×/.test(line)).slice(-12).join(' | ')
    check('replays: the crash_lifecycle replays pass', replay.status === 0, `exit ${String(replay.status)}: ${summary}`)
  }
  if (runs('specs')) {
    const specs = ['host-process', 'deepwidgets-supervisor', 'deepwidgets-crash-policy'].map((name) => `apps/desktop/tests/${name}.spec.ts`)
    const run = spawnSync(join(ROOT, 'node_modules/.bin/vitest'), ['run', ...specs], { cwd: ROOT, encoding: 'utf8' })
    const summary = `${run.stdout ?? ''}`.split('\n').filter((line) => /Tests|Test Files|FAIL/.test(line)).slice(-12).join(' | ')
    check('specs: the host process, supervisor, and crash policy specs pass', run.status === 0, `exit ${String(run.status)}: ${summary}`)
  }
  if (!HOST_CASES.some(runs)) return

  const port = await freePort()
  const inspectPort = await freePort()
  console.log(`widgets-crash-replay: work folder ${work}, port ${String(port)}, inspector ${String(inspectPort)}`)
  const fixtures = join(work, 'fixtures')
  cpSync(FIXTURES, fixtures, { recursive: true })
  const listed = async (host, slug) => (await host.getJson('/api/widgets')).body?.widgets?.find((widget) => widget.slug === slug)

  let host = await startHost(port, inspectPort)
  try {
    for (const name of ['crash-host', 'throw-widget', 'watchdog-host', 'watchdog-widget']) {
      const result = await installBundle(inspectPort, join(fixtures, name)).catch((error) => ({ error: String(error.message) }))
      // The plugin of throw-widget throws, so its install can report the failed start. Its row stays in the config.
      check(`install ${name}: the bundle is in the config`, result?.error === undefined || name === 'throw-widget', JSON.stringify(result?.error ?? result?.application))
    }
    // throw-first: safe_host.crash.
    if (runs('throw-first')) {
      const failed = await waitFor(async () => typeof (await listed(host, 'throwfirst'))?.failed === 'string', 20_000)
      const widget = await listed(host, 'throwfirst')
      check('throw-first: widget_list shows the widget as failed with the reason', failed && widget.failed.includes('plugin body threw before it registered'), JSON.stringify(widget))
      const call = await host.post('/api/widgets/throwfirst/call', { action: 'any', args: {} })
      check('throw-first: a call gives 503 widget-failed', call.status === 503 && call.body?.error?.code === 'widget-failed', JSON.stringify(call))
      const add = await host.post('/api/widgets/sample/call', { action: 'add', args: { by: 1 } })
      check('throw-first: sample stays live', add.status === 200, JSON.stringify(add))
    }
  } finally {
    await host.stop()
  }

  // innocent: widget_fv.crash, the main-thread half. The compiled inSlot removes the record when the call returns.
  if (runs('innocent')) {
    clearState()
    host = await startHost(port, inspectPort)
    const pid = host.child.pid
    let exit = null
    try {
      await waitFor(async () => (await listed(host, 'watchdog'))?.failed === undefined, 20_000)
      void host.post('/api/watchdoghost/innocent', {}).catch(() => undefined)
      exit = await Promise.race([host.exited, sleep(20_000).then(() => null)])
    } finally {
      await host.stop()
    }
    const provisional = readState('provisional.json')
    const detail = JSON.stringify({ exit: exit === null ? 'alive after 20 s' : exit.signal ?? exit.code, provisional: provisional === undefined ? null : { row: provisional.row, pid: provisional.pid === pid } })
    check('innocent: host code aborts after the widget call returned', exit?.signal === 'SIGABRT', detail)
    check('innocent: the call that returned left no provisional record', provisional?.pid !== pid, detail)
    const lines = exit === null ? [] : await supervise(exit, pid)
    const failed = lines.find((line) => line.event === 'host-failed')
    check('innocent: the real supervisor blames no widget', failed !== undefined && failed.blamed === null, JSON.stringify(failed))
    host = await startHost(port, inspectPort)
    try {
      const live = await waitFor(async () => {
        const widget = await listed(host, 'watchdog')
        return widget !== undefined && widget.failed === undefined
      }, 20_000)
      const quarantine = readState('quarantine.json')
      check('innocent: the next host runs the widget', live && !(Array.isArray(quarantine) && quarantine.some((item) => isRow(item?.row, 'deepwidgets-widget-watchdog'))),
        JSON.stringify({ widget: await listed(host, 'watchdog'), quarantine }))
    } finally {
      await host.stop()
    }
  }

  // throw-timer: widget_fv.crash, the root and the hash from the row.
  if (runs('throw-timer')) {
    clearState()
    const boot = await startOrExit(port, inspectPort, { DEEPWIDGETS_THROWFIRST: 'async' })
    if (boot.host !== undefined) {
      await Promise.race([boot.host.exited, sleep(20_000)])
      await boot.host.stop()
    }
    const record = readState('crash.json')
    const detail = JSON.stringify({ boot: boot.error ?? 'printed its URL', row: record?.row, root: record?.root, hash: record?.hash, slugs: record?.slugs, event: record?.event })
    check('throw-timer: the crash record blames the widget, with the root and the hash of its row', isRow(record?.row, WIDGET)
      && typeof record?.root === 'string' && existsSync(join(record.root, 'package.json')) && typeof record?.hash === 'string'
      && record?.slugs?.includes('throwfirst') && record?.event === 'uncaughtException', detail)
    host = await startHost(port, inspectPort, [], { DEEPWIDGETS_THROWFIRST: 'async' })
    try {
      const held = await waitFor(async () => (await listed(host, 'throwfirst'))?.failed?.includes('quarantined') === true, 20_000)
      check('throw-timer: the next host holds the widget, and it lists as failed', held && host.child.exitCode === null, JSON.stringify(await listed(host, 'throwfirst')))
    } finally {
      await host.stop()
    }
    if (typeof record?.root === 'string') writeFileSync(join(record.root, 'changed.txt'), `changed ${String(Date.now())}`)
    host = await startHost(port, inspectPort, [], { DEEPWIDGETS_THROWFIRST: 'ok' })
    try {
      const lifted = await waitFor(async () => {
        const widget = await listed(host, 'throwfirst')
        return widget !== undefined && widget.failed === undefined
      }, 20_000)
      const call = await host.post('/api/widgets/throwfirst/call', { action: 'ping', args: {} })
      const quarantine = readState('quarantine.json')
      check('throw-timer: a changed file lifts the quarantine, and the new code runs', lifted && call.status === 200 && Array.isArray(quarantine) && !quarantine.some((item) => isRow(item?.row, WIDGET)),
        JSON.stringify({ widget: await listed(host, 'throwfirst'), call: call.status, quarantine }))
    } finally {
      await host.stop()
    }
  }

  // cleanup: safe_host.cleanup.
  const crashModes = { marker: 'marker', async: 'async-hang', sync: 'sync-loop', 'widget-loop': 'none', 'no-worker': 'async-hang' }
  for (const mode of ['marker', 'async', 'sync', 'widget-loop', 'no-worker']) {
    if (!runs(`cleanup-${mode}`)) continue
    clearState()
    host = await startHost(port, inspectPort, [], mode === 'widget-loop' ? { DEEPWIDGETS_THROWFIRST: 'ok' } : {})
    const pid = host.child.pid
    const marker = join(work, `marker-${String(Date.now())}`)
    let exit = null
    let armed
    let setup
    try {
      if (mode === 'widget-loop') {
        await waitFor(async () => (await listed(host, 'throwfirst'))?.failed === undefined, 20_000)
        setup = await host.post('/api/widgets/throwfirst/call', { action: 'armDisposeLoop', args: {} })
        const record = readState('crash.json')
        if (record?.pid === pid) setup = { ...setup, early: record.event }
      }
      if (mode === 'no-worker') {
        setup = await stopWorkers(inspectPort).catch((error) => String(error.message))
        await sleep(500)
      }
      armed = await host.post('/api/crashhost/arm', { mode: crashModes[mode], marker })
      const sent = Date.now()
      exit = await Promise.race([host.exited, sleep(20_000).then(() => null)])
      if (exit !== null) exit = { ...exit, ms: exit.at - sent }
    } finally {
      await host.stop()
    }
    const record = readState('crash.json')
    const detail = JSON.stringify({ setup, armed: armed?.status, exit: exit === null ? 'alive after 20 s' : { code: exit.code, signal: exit.signal, ms: exit.ms }, row: record?.row, event: record?.event, pid: record?.pid === pid })
    const claimed = record?.pid === pid && record?.row === null && record?.event === 'uncaughtException' && record?.applied === false
    if (mode === 'marker') {
      check('cleanup-marker: the host runs the disposers and exits with code 1', exit?.code === 1 && existsSync(marker) && readFileSync(marker, 'utf8') === 'disposed', detail)
      check('cleanup-marker: the crash record is the record of the claimer', claimed, detail)
      continue
    }
    if (mode === 'no-worker') check('cleanup-no-worker: the check stopped the worker threads', typeof setup === 'number' && setup >= 1, detail)
    if (mode === 'widget-loop') check('cleanup-widget-loop: the widget armed its disposer', setup?.status === 200 && setup.early === undefined, detail)
    check(`cleanup-${mode}: a disposer that does not end gives SIGKILL after ${String(CLEANUP_MIN_MS)} to ${String(CLEANUP_MAX_MS)} ms`,
      exit?.signal === 'SIGKILL' && exit.ms >= CLEANUP_MIN_MS && exit.ms <= CLEANUP_MAX_MS, detail)
    check(`cleanup-${mode}: the crash record stays the record of the claimer, with no stall record over it`, claimed, detail)
    const lines = exit === null ? [] : await supervise(exit, pid)
    const failed = lines.filter((line) => line.event === 'host-failed')
    check(`cleanup-${mode}: the supervisor counts one crash`, failed.length === 1 && failed[0].crashes === 1 && failed[0].blamed === null, JSON.stringify(lines))
  }
}

let exitCode = 1
try {
  await main()
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('widgets-crash-replay: pass')
    exitCode = 0
  } else {
    console.log(`widgets-crash-replay: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`widgets-crash-replay: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  for (const child of children) child.kill('SIGKILL')
}
process.exit(exitCode)
