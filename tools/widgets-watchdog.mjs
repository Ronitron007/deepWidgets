#!/usr/bin/env node
/**
 * Host check of the watchdog (unit widget.isolation_watchdog, spec widget_phase2.isolation.watchdog).
 * It boots the CLI host (web profile) on free loopback ports and installs two fixture bundles from
 * deepwidgets/widgets/fixtures: the widget `deepwidgets-widget-watchdog` and the host plugin `deepwidgets-watchdoghost`.
 * - parse: a 150 MB JSON.parse in host code does not kill the host, and writes no record.
 * - suspend: SIGSTOP for 4 s, then SIGCONT, 10 times. The host lives each time. In every second cycle, the stop
 *   comes during CPU work in a widget action, so the watchdog thread runs before the heartbeat after the SIGCONT.
 * - stall: a 900 ms stall in a widget action writes the provisional record, which goes when the heartbeat comes back.
 * - spin: a loop in a widget action kills the host within 2.5 s. The crash record blames the widget, and the next
 *   host shows the widget as failed while `sample` stays live.
 * - idle (widget.crash_records, safe_host.watchdog): with no widget in the running slot, a 4 s stall in host code
 *   does not kill the host, and a longer stall kills it after about 10 s. The crash record blames no widget.
 * - native (safe_host.watchdog): a widget action loops after an `await`, so the running slot holds 0. With
 *   `@sentry/node-native-stacktrace`, which loads on this host, the host dies in about 2 s, and the record blames the
 *   widget with `native-stack`.
 * - native-off: the same loop on a host where a module hook refuses to load the module. The host dies after about
 *   10 s, and the record blames no widget.
 * - host-await: a widget awaits host work that holds the event loop for 3 s. That work has the store of the widget,
 *   but its frames are host code. The host lives, and no record blames the widget.
 * - oom: a stall, then fast allocation. The out-of-memory abort (provisional record) and the stall kill (crash record)
 *   both blame the widget. The case checks the result: the host died, a record blames the widget, and the next host
 *   has the widget quarantined.
 * Environment: WIDGETS_WATCHDOG_CASES (comma list, such as `oom`) runs only those cases after the install.
 * WIDGETS_WATCHDOG_OOM_HEAP_MB sets --max-old-space-size of the oom host (default 768). A large value, such as 6144,
 * forces the stall-kill path.
 * Prints `widgets-watchdog: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` first.
 */
import { spawn } from 'node:child_process'
import { cpSync, createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const FIXTURES = join(ROOT, 'deepwidgets/widgets/fixtures')
const work = await mkdtemp(join(process.env.WIDGETS_WATCHDOG_TMP ?? tmpdir(), 'widgets-watchdog-'))
const home = join(work, 'home')
const state = join(home, 'deepwidgets')
const logPath = join(work, 'host.log')
const results = []
const children = new Set()
const WIDGET = 'deepwidgets-widget-watchdog'
/** The spec bound: a loop in an action ends the host within this time. */
const KILL_WITHIN_MS = 2_500
/** True when the Loader row id `row` (with the ids of its parent rows) ends in the row id `id`. */
const isRow = (row, id) => typeof row === 'string' && (row === id || row.endsWith(`:${id}`))
/** The cases to run. All cases when WIDGETS_WATCHDOG_CASES is not set. */
const CASES = process.env.WIDGETS_WATCHDOG_CASES?.split(',').map((name) => name.trim()).filter((name) => name !== '')
const runs = (name) => CASES === undefined || CASES.length === 0 || CASES.includes(name)
const CASE_NAMES = ['parse', 'suspend', 'stall', 'spin', 'idle', 'native', 'native-off', 'host-await', 'oom']
/** safe_host.watchdog: a widget stall that the native stack finds kills the host in this time after the call. */
const NATIVE_KILL_MAX_MS = 3_500
/** safe_host.watchdog: a stall with no widget in the running slot kills the host after 10 s, in this window. */
const IDLE_KILL_MIN_MS = 9_500
const IDLE_KILL_MAX_MS = 12_500
const unknownCases = (CASES ?? []).filter((name) => !CASE_NAMES.includes(name))
if (unknownCases.length > 0) {
  console.log(`widgets-watchdog: fail: unknown case in WIDGETS_WATCHDOG_CASES: ${unknownCases.join(', ')} (known: ${CASE_NAMES.join(', ')})`)
  process.exit(1)
}
/** The heap limit of the oom host, in MB. */
const OOM_HEAP_MB = process.env.WIDGETS_WATCHDOG_OOM_HEAP_MB ?? '768'

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

async function startHost(port, inspectPort, nodeArgs = []) {
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(logPath, { flags: 'a' })
  const child = spawn(process.execPath, [...nodeArgs, `--inspect=127.0.0.1:${String(inspectPort)}`, BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home },
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
      functionDeclaration: `async function (spec) {
        if (this.length !== 1) throw new Error("Loader instances " + this.length);
        const manager = this[0].ctx?.get?.("pluginManager");
        if (manager === undefined) throw new Error("no pluginManager on the Loader ctx");
        // The inspector call can inherit the hmr transaction store of host work in flight; leave it, as hmr.watchConfig does.
        const hmr = this[0].ctx?.get?.("hmr");
        return await (hmr === undefined ? manager.installBundle(spec) : hmr.executing.exit(() => manager.installBundle(spec)));
      }`,
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
const live = (host) => waitFor(() => widgetIn(host, 'watchdog', (widget) => widget.failed === undefined), 20_000)
const alive = (host) => host.child.exitCode === null && host.child.signalCode === null

async function main() {
  const port = await freePort()
  const inspectPort = await freePort()
  console.log(`widgets-watchdog: work folder ${work}, port ${String(port)}, inspector ${String(inspectPort)}`)
  const fixtures = join(work, 'fixtures')
  cpSync(FIXTURES, fixtures, { recursive: true })

  let host = await startHost(port, inspectPort)
  try {
    for (const name of ['watchdog-host', 'watchdog-widget']) {
      const result = await installBundle(inspectPort, join(fixtures, name)).catch((error) => ({ error: String(error.message) }))
      check(`install ${name}: applied`, result?.application === 'applied', JSON.stringify(result?.error ?? result?.application))
    }
    check('the watchdog widget is live', await live(host))
  } finally {
    await host.stop()
  }

  // parse: one long synchronous step of healthy host code.
  if (runs('parse')) {
    clearState()
    host = await startHost(port, inspectPort)
    try {
      await live(host)
      const prepared = await host.post('/api/watchdoghost/prepare', { mb: 150 })
      check('parse: the host built a 150 MB text', prepared.status === 200 && prepared.body?.mb >= 150, JSON.stringify(prepared.body))
      const parsed = await host.post('/api/watchdoghost/parse', {})
      await sleep(2_500)
      const crash = readState('crash.json')
      check('parse: a 150 MB JSON.parse does not kill the host', parsed.status === 200 && alive(host) && crash?.pid !== host.child.pid,
        JSON.stringify({ parse: parsed.body, alive: alive(host), crash: crash === undefined ? null : { pid: crash.pid, event: crash.event } }))
      check('parse: host code writes no provisional record', readState('provisional.json') === undefined)
    } finally {
      await host.stop()
    }
  }

  // suspend: the whole process does not run, so no stall is proven. The watchdog must not kill.
  if (runs('suspend')) {
    clearState()
    host = await startHost(port, inspectPort)
    try {
      await live(host)
      const pid = host.child.pid
      const probe = await host.post('/api/widgets/watchdog/call', { action: 'work', args: { n: 5_000_000 } })
      const perMs = 5_000_000 / Math.max(1, probe.body?.result?.ms ?? 1)
      // About 1 s of work: 0.3 s before the stop, and about 0.7 s after the SIGCONT.
      const n = Math.round(perMs * 1_000)
      const cycles = []
      for (let cycle = 1; cycle <= 10 && alive(host); cycle += 1) {
        const busy = cycle % 2 === 0
        const call = busy ? host.post('/api/widgets/watchdog/call', { action: 'work', args: { n } }) : undefined
        if (busy) await sleep(300)
        process.kill(pid, 'SIGSTOP')
        await sleep(4_000)
        process.kill(pid, 'SIGCONT')
        const answer = await call
        await sleep(1_000)
        cycles.push({ cycle, busy, alive: alive(host), status: answer?.status })
      }
      await sleep(2_500)
      const crash = readState('crash.json')
      check('suspend: 10 cycles of SIGSTOP for 4 s, then SIGCONT, do not kill the host',
        cycles.length === 10 && cycles.every((item) => item.alive && (!item.busy || item.status === 200)) && alive(host) && crash?.pid !== pid,
        JSON.stringify({ workMs: probe.body?.result?.ms, cycles, crash: crash === undefined ? null : { pid: crash.pid, message: crash.error?.message } }))
      check('suspend: no provisional record is left', readState('provisional.json') === undefined)
    } finally {
      await host.stop()
    }
  }

  // stall: shorter than the threshold. The provisional record comes, then goes.
  if (runs('stall')) {
    clearState()
    host = await startHost(port, inspectPort)
    try {
      await live(host)
      const call = host.post('/api/widgets/watchdog/call', { action: 'stall', args: { ms: 900 } })
      let seen
      const end = Date.now() + 5_000
      while (Date.now() < end && seen === undefined) {
        const record = readState('provisional.json')
        if (record?.pid === host.child.pid) seen = record
        else await sleep(20)
      }
      const answer = await call
      await sleep(500)
      check('stall: the provisional record blames the widget', isRow(seen?.row, WIDGET) && seen?.event === 'provisional-stall' && seen?.slugs?.includes('watchdog'),
        JSON.stringify({ row: seen?.row, method: seen?.method, event: seen?.event }))
      check('stall: the record goes when the heartbeat comes back, and the host lives',
        answer.status === 200 && alive(host) && readState('provisional.json') === undefined && readState('crash.json') === undefined, JSON.stringify(answer.body))
    } finally {
      await host.stop()
    }
  }

  // spin: a loop in an action.
  if (runs('spin')) {
    clearState()
    host = await startHost(port, inspectPort)
    try {
      await live(host)
      const sent = Date.now()
      void host.post('/api/widgets/watchdog/call', { action: 'spin' }).catch(() => undefined)
      const exit = await Promise.race([host.exited, sleep(20_000).then(() => null)])
      const record = readState('crash.json')
      const detail = JSON.stringify({ exit: exit === null ? 'alive after 20 s' : exit.signal ?? exit.code, ms: exit === null ? null : exit.at - sent, row: record?.row, method: record?.method, event: record?.event, message: record?.error?.message })
      check(`spin: the host dies within ${String(KILL_WITHIN_MS)} ms of the call`, exit !== null && exit.signal === 'SIGKILL' && exit.at >= sent && exit.at - sent <= KILL_WITHIN_MS, detail)
      check('spin: the crash record blames the widget', isRow(record?.row, WIDGET) && record?.event === 'stall' && record?.pid === host.child.pid
        && record?.applied === false && typeof record?.hash === 'string' && record?.slugs?.includes('watchdog'), detail)
      check('spin: no provisional record is left', readState('provisional.json') === undefined)
    } finally {
      await host.stop()
    }
    host = await startHost(port, inspectPort)
    try {
      const failed = await waitFor(() => widgetIn(host, 'watchdog', (widget) => typeof widget.failed === 'string' && widget.failed.includes('stall')), 20_000)
      const list = await host.getJson('/api/widgets')
      check('spin: the next host lists the widget as failed with the reason', failed, JSON.stringify(list.body?.widgets?.find((w) => w.slug === 'watchdog')))
      const call = await host.post('/api/widgets/watchdog/call', { action: 'stall', args: { ms: 1 } })
      check('spin: a call gives 503 widget-failed', call.status === 503 && call.body?.error?.code === 'widget-failed', JSON.stringify(call))
      const add = await host.post('/api/widgets/sample/call', { action: 'add', args: { by: 1 } })
      check('spin: sample stays live', add.status === 200 && await widgetIn(host, 'sample', (widget) => widget.failed === undefined), JSON.stringify(add))
      check('spin: the record is applied', readState('crash.json')?.applied === true)
    } finally {
      await host.stop()
    }
  }

  // idle: host code holds the event loop with slot 0 (safe_host.watchdog).
  if (runs('idle')) {
    clearState()
    host = await startHost(port, inspectPort)
    try {
      await live(host)
      const pid = host.child.pid
      const healthy = await host.post('/api/watchdoghost/block', { ms: 4_000 })
      await sleep(500)
      const crash = readState('crash.json')
      check('idle: a healthy 4 s stall with no widget does not kill the host', healthy.status === 200 && alive(host) && crash?.pid !== pid,
        JSON.stringify({ status: healthy.status, alive: alive(host), crash: crash === undefined ? null : { pid: crash.pid, message: crash.error?.message } }))
      check('idle: host code writes no provisional record', readState('provisional.json') === undefined)
      const sent = Date.now()
      void host.post('/api/watchdoghost/block', { ms: 30_000 }).catch(() => undefined)
      const exit = await Promise.race([host.exited, sleep(25_000).then(() => null)])
      const record = readState('crash.json')
      const ms = exit === null ? null : exit.at - sent
      const detail = JSON.stringify({ exit: exit === null ? 'alive after 25 s' : exit.signal ?? exit.code, ms, row: record?.row, method: record?.method, event: record?.event, message: record?.error?.message })
      check(`idle: a longer stall with no widget kills the host after ${String(IDLE_KILL_MIN_MS)} to ${String(IDLE_KILL_MAX_MS)} ms`,
        exit !== null && exit.signal === 'SIGKILL' && ms !== null && ms >= IDLE_KILL_MIN_MS && ms <= IDLE_KILL_MAX_MS, detail)
      check('idle: the crash record blames no widget', record?.row === null && record?.event === 'stall' && record?.pid === pid && record?.method === null, detail)
    } finally {
      await host.stop()
    }
  }

  // native and native-off: a loop after an await, with the slot at 0 (safe_host.watchdog).
  for (const name of ['native', 'native-off']) {
    if (!runs(name)) continue
    clearState()
    // A module hook of the host process refuses to load the native module, as on Electron with no build for Electron.
    const block = join(work, 'block-native.mjs')
    writeFileSync(block, [
      "import { registerHooks } from 'node:module'",
      'registerHooks({ resolve(specifier, context, next) {',
      '  const result = next(specifier, context)',
      "  if (result.url.includes('/@sentry/node-native-stacktrace/')) throw new Error('the check refuses @sentry/node-native-stacktrace')",
      '  return result',
      '} })',
    ].join('\n'))
    host = await startHost(port, inspectPort, name === 'native' ? [] : ['--import', pathToFileURL(block).href])
    try {
      await live(host)
      const pid = host.child.pid
      const sent = Date.now()
      void host.post('/api/widgets/watchdog/call', { action: 'spinAfterAwait' }).catch(() => undefined)
      const exit = await Promise.race([host.exited, sleep(25_000).then(() => null)])
      const record = readState('crash.json')
      const ms = exit === null ? null : exit.at - sent
      const detail = JSON.stringify({ exit: exit === null ? 'alive after 25 s' : exit.signal ?? exit.code, ms, row: record?.row, method: record?.method, message: record?.error?.message, stack: record?.error?.stack?.split('\n').slice(0, 3) })
      if (name === 'native') {
        check(`native: the host dies within ${String(NATIVE_KILL_MAX_MS)} ms of the call`, exit?.signal === 'SIGKILL' && ms !== null && ms <= NATIVE_KILL_MAX_MS, detail)
        check('native: the crash record blames the widget with native-stack', isRow(record?.row, WIDGET) && record?.method === 'native-stack' && record?.pid === pid
          && typeof record?.hash === 'string', detail)
      } else {
        check(`native-off: the host dies after ${String(IDLE_KILL_MIN_MS)} to ${String(IDLE_KILL_MAX_MS)} ms`, exit?.signal === 'SIGKILL' && ms !== null && ms >= IDLE_KILL_MIN_MS && ms <= IDLE_KILL_MAX_MS, detail)
        // An empty stack: the watchdog thread had no native module to read the stack with.
        check('native-off: the crash record blames no widget, and the watchdog read no native stack', record?.row === null && record?.method === null && record?.pid === pid && record?.error?.stack === '', detail)
      }
    } finally {
      await host.stop()
    }
  }

  // host-await: host work that a widget awaits has the store of the widget. It must not blame the widget.
  if (runs('host-await')) {
    clearState()
    host = await startHost(port, inspectPort)
    try {
      await live(host)
      const pid = host.child.pid
      const answer = await host.post('/api/widgets/watchdog/call', { action: 'awaitHost', args: { ms: 3_000 } })
      await sleep(500)
      const crash = readState('crash.json')
      check('host-await: 3 s of host work that the widget awaits does not kill the host', answer.status === 200 && alive(host) && crash?.pid !== pid,
        JSON.stringify({ status: answer.status, alive: alive(host), crash: crash === undefined ? null : { row: crash.row, method: crash.method, message: crash.error?.message } }))
    } finally {
      await host.stop()
    }
  }

  // oom: a stall, then fast allocation. Two paths end the host, and both are correct (spec widget_fv.watchdog_check):
  // - the out-of-memory abort. It runs no JavaScript, so only the provisional record blames the widget.
  // - the stall kill at the threshold, when the allocation is slow (a busy machine or a large heap). The crash record
  //   blames the widget.
  // The case checks the result: the host died, a record of the dead host blames the widget, and the next host has
  // the widget quarantined.
  if (runs('oom')) {
    clearState()
    host = await startHost(port, inspectPort, [`--max-old-space-size=${OOM_HEAP_MB}`])
    /** The file of the record that blames the widget, or undefined. */
    let blamed
    try {
      await live(host)
      const pid = host.child.pid
      void host.post('/api/widgets/watchdog/call', { action: 'alloc' }).catch(() => undefined)
      const exit = await Promise.race([host.exited, sleep(30_000).then(() => null)])
      const provisional = readState('provisional.json')
      const crash = readState('crash.json')
      const crashBlames = isRow(crash?.row, WIDGET) && crash?.event === 'stall' && crash?.pid === pid && crash?.applied === false
      const provisionalBlames = isRow(provisional?.row, WIDGET) && provisional?.event === 'provisional-stall' && provisional?.pid === pid && provisional?.applied === false
      blamed = crashBlames ? 'crash.json' : provisionalBlames ? 'provisional.json' : undefined
      const detail = JSON.stringify({
        exit: exit === null ? 'alive after 30 s' : exit.signal ?? exit.code,
        // The path from the observed end: the stall kill gives SIGKILL and a crash record, the out-of-memory abort
        // gives SIGABRT and a provisional record. Any other end is `unknown`.
        path: exit?.signal === 'SIGKILL' && crash !== undefined ? 'stall-kill'
          : exit?.signal === 'SIGABRT' && provisional !== undefined ? 'out-of-memory'
            : 'unknown',
        heapMb: OOM_HEAP_MB,
        crash: crash === undefined ? null : { row: crash.row, event: crash.event },
        provisional: provisional === undefined ? null : { row: provisional.row, event: provisional.event },
      })
      check('oom: the host dies', exit !== null, detail)
      check('oom: a provisional record or a crash record of the dead host blames the widget', blamed !== undefined, detail)
    } finally {
      await host.stop()
    }
    host = await startHost(port, inspectPort)
    try {
      const failed = await waitFor(() => widgetIn(host, 'watchdog', (widget) => typeof widget.failed === 'string' && widget.failed.includes('stall')), 20_000)
      const list = await host.getJson('/api/widgets')
      check('oom: the next host lists the widget as failed', failed, JSON.stringify(list.body?.widgets?.find((w) => w.slug === 'watchdog')))
      const quarantine = readState('quarantine.json')
      check('oom: the next host has the widget in the quarantine', Array.isArray(quarantine) && quarantine.some((item) => isRow(item?.row, WIDGET)), JSON.stringify(quarantine))
      check('oom: the record that blames the widget is applied', blamed !== undefined && readState(blamed)?.applied === true, String(blamed))
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
    console.log('widgets-watchdog: pass')
    exitCode = 0
  } else {
    console.log(`widgets-watchdog: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`widgets-watchdog: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  for (const child of children) child.kill('SIGKILL')
}
process.exit(exitCode)
