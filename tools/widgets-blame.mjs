#!/usr/bin/env node
/**
 * Host check of blame at exit (unit widget.isolation_blame, spec widget_phase2.isolation.blame).
 * It boots the CLI host (web profile) on free loopback ports and installs two fixture bundles from
 * deepwidgets/widgets/fixtures: the widget `deepwidgets-widget-blame` and the host plugin `deepwidgets-blamehost`.
 * For each error source of the spike blame table, it starts the host, arms the fault, waits for the exit, and reads
 * $DSH_HOME/deepwidgets/crash.json. A widget fault must name the widget; a host fault must name no widget.
 * Then it checks the quarantine: the next host shows the blamed widget as failed, and a changed file brings it back.
 * Prints `widgets-blame: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` first.
 */
import { spawn } from 'node:child_process'
import { cpSync, createWriteStream, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const FIXTURES = join(ROOT, 'deepwidgets/widgets/fixtures')
const work = await mkdtemp(join(process.env.WIDGETS_BLAME_TMP ?? tmpdir(), 'widgets-blame-'))
const home = join(work, 'home')
const state = join(home, 'deepwidgets')
const logPath = join(work, 'host.log')
const results = []
const children = new Set()
const WIDGET = 'deepwidgets-widget-blame'

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

async function startHost(port, inspectPort) {
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(logPath, { flags: 'a' })
  const child = spawn(process.execPath, [`--inspect=127.0.0.1:${String(inspectPort)}`, BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
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
  const getJson = async (path) => { const r = await api(path); return { status: r.status, body: await r.json().catch(() => null) } }
  const post = async (path, body) => {
    const r = await api(path, { method: 'POST', body: JSON.stringify(body) })
    return { status: r.status, body: await r.json().catch(() => null) }
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
        return await manager.installBundle(spec);
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

const readRecord = () => {
  try { return JSON.parse(readFileSync(join(state, 'crash.json'), 'utf8')) } catch { return undefined }
}
const widgetIn = async (host, test) => {
  const list = await host.getJson('/api/widgets')
  return list.body?.widgets?.some((widget) => widget.slug === 'blame' && test(widget)) === true
}

// [case, how to arm, expected blamed plugin]
const CASES = [
  ['timer-throw', 'widget', WIDGET],
  ['interval-throw', 'widget', WIDGET],
  ['promise-reject', 'widget', WIDGET],
  ['fetch-reject', 'widget', WIDGET],
  ['listener-throw', 'widget', WIDGET],
  ['service-throw', 'widget', WIDGET],
  ['service-reject', 'widget', WIDGET],
  ['string-throw', 'widget', WIDGET],
  ['host-throw', 'host', null],
]

async function main() {
  const port = await freePort()
  const inspectPort = await freePort()
  console.log(`widgets-blame: work folder ${work}, port ${String(port)}, inspector ${String(inspectPort)}`)
  // A stub that accepts a connection and destroys it, so a fetch to it rejects.
  const stub = createServer((socket) => { socket.destroy() })
  await new Promise((resolve) => { stub.listen(0, '127.0.0.1', resolve) })
  const stubUrl = `http://127.0.0.1:${String(stub.address().port)}/`
  // Copies, so the lift check can change a file without touching the repository.
  const fixtures = join(work, 'fixtures')
  cpSync(FIXTURES, fixtures, { recursive: true })
  try {
    let host = await startHost(port, inspectPort)
    try {
      for (const name of ['blame-host', 'blame-widget']) {
        const result = await installBundle(inspectPort, join(fixtures, name))
        check(`install ${name}: applied`, result?.application === 'applied', JSON.stringify(result))
      }
      check('the blame widget is live', await waitFor(() => widgetIn(host, (widget) => widget.failed === undefined), 20_000))
    } finally {
      await host.stop()
    }

    for (const [name, how, expected] of CASES) {
      rmSync(join(state, 'crash.json'), { force: true })
      rmSync(join(state, 'quarantine.json'), { force: true })
      host = await startHost(port, inspectPort)
      try {
        if (!await waitFor(() => widgetIn(host, (widget) => widget.failed === undefined), 20_000)) {
          check(`${name}: the blame widget is live before the fault`, false)
          continue
        }
        const armedAt = Date.now()
        if (how === 'widget') void host.post('/api/widgets/blame/call', { action: 'arm', args: { case: name, url: stubUrl } }).catch(() => undefined)
        else void host.post('/api/blamehost/arm', {}).catch(() => undefined)
        const exit = await Promise.race([host.exited, sleep(20_000).then(() => null)])
        const record = readRecord()
        const detail = JSON.stringify({ exit: exit === null ? 'alive after 20 s' : exit.code ?? exit.signal, ms: exit === null ? null : exit.at - armedAt, plugin: record?.plugin, method: record?.method, event: record?.event, message: record?.error?.message })
        check(`${name}: the host exits and blames ${expected ?? 'no widget'}`, exit !== null && exit.code === 1 && record !== undefined && record.plugin === expected && record.applied === false
          && (expected === null || (typeof record.hash === 'string' && record.slugs.includes('blame'))), detail)
      } finally {
        await host.stop()
      }
    }

    // Quarantine and lift: the next host does not run the blamed widget; a changed file brings it back.
    const blamed = readRecord()
    if (blamed?.plugin !== null) throw new Error('the last case must leave an unblamed record')
    rmSync(join(state, 'crash.json'), { force: true })
    rmSync(join(state, 'quarantine.json'), { force: true })
    host = await startHost(port, inspectPort)
    try {
      await waitFor(() => widgetIn(host, (widget) => widget.failed === undefined), 20_000)
      void host.post('/api/widgets/blame/call', { action: 'arm', args: { case: 'timer-throw' } }).catch(() => undefined)
      await Promise.race([host.exited, sleep(20_000)])
    } finally {
      await host.stop()
    }
    const record = readRecord()
    check('quarantine: a timer throw is blamed', record?.plugin === WIDGET, JSON.stringify(record?.plugin))

    host = await startHost(port, inspectPort)
    let root
    try {
      const failed = await waitFor(() => widgetIn(host, (widget) => typeof widget.failed === 'string' && widget.failed.includes('blame: timer throw')), 20_000)
      const list = await host.getJson('/api/widgets')
      check('quarantine: the next host lists blame as failed with the reason', failed, JSON.stringify(list.body))
      const call = await host.post('/api/widgets/blame/call', { action: 'arm', args: { case: 'timer-throw' } })
      check('quarantine: a call gives 503 widget-failed', call.status === 503 && call.body?.error?.code === 'widget-failed', JSON.stringify(call))
      const program = await host.getJson('/api/widgets/blame/program')
      check('quarantine: the program gives 503 widget-failed', program.status === 503 && program.body?.error?.code === 'widget-failed', JSON.stringify(program))
      const quarantine = JSON.parse(readFileSync(join(state, 'quarantine.json'), 'utf8'))
      root = quarantine.find((item) => item.plugin === WIDGET)?.root
      check('quarantine: the record is applied', readRecord()?.applied === true)
    } finally {
      await host.stop()
    }

    host = await startHost(port, inspectPort)
    try {
      const failed = await waitFor(() => widgetIn(host, (widget) => typeof widget.failed === 'string'), 20_000)
      check('quarantine: an unchanged widget stays failed after one more start', failed)
    } finally {
      await host.stop()
    }

    // Change one file of the installed widget with a rename, so a hard link to a package store stays unchanged.
    if (typeof root !== 'string') throw new Error('the quarantine has no package folder')
    const file = join(root, 'index.js')
    writeFileSync(`${file}.tmp`, `${readFileSync(file, 'utf8')}\n// changed by widgets-blame\n`)
    renameSync(`${file}.tmp`, file)
    host = await startHost(port, inspectPort)
    try {
      const live = await waitFor(() => widgetIn(host, (widget) => widget.failed === undefined), 20_000)
      const call = await host.post('/api/widgets/blame/call', { action: 'arm', args: { case: 'listener-throw-not' } })
      check('lift: a changed file brings the widget back', live && call.status === 500 && call.body?.error?.code === 'handler-error', JSON.stringify(call))
      const quarantine = JSON.parse(readFileSync(join(state, 'quarantine.json'), 'utf8'))
      check('lift: the quarantine is empty', Array.isArray(quarantine) && quarantine.length === 0, JSON.stringify(quarantine))
    } finally {
      await host.stop()
    }
  } finally {
    stub.close()
  }
}

let exitCode = 1
try {
  await main()
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('widgets-blame: pass')
    exitCode = 0
  } else {
    console.log(`widgets-blame: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`widgets-blame: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  for (const child of children) child.kill('SIGKILL')
}
process.exit(exitCode)
