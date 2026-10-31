/**
 * Boot the unpackaged desktop app and check that the main renderer and host answer.
 * With DSH_SMOKE_PROBE=1, also check that the renderer shows the host process id.
 * With DSH_SMOKE_TRACE=1, also read /api/trace from the main window and check the trace test.
 * With DSH_SMOKE_HELLO=1, also check that the main window shows hello and that no welcome window opened.
 * With DSH_SMOKE_ROWS set to a folder, also compare the loaded rows with the row lists in that folder.
 * With DSH_SMOKE_ROWS_SAVE set to a path, also write the host row snapshot to that file.
 * With DSH_SMOKE_ROWS_SNAPSHOT set to a path, compare that host snapshot with rows.host.txt and do not start the app.
 * With DSH_SMOKE_INSTALL set to a local bundle path, also call pluginManager.installBundle over the host Loader.
 * With DSH_SMOKE_WIDGET set to a widget slug, the check finds the widget window dsh-app://app/widget/?slug=<slug>.
 * It finds the count in that page, posts add from the main window, and finds the new count in the page.
 * Then it writes a new program with ctx.widgets.setProgram over the host Loader and finds its text in the page.
 * Then it registers a second widget over the Loader, loads its page (with a bar chart of two bars), ends the
 * registration, and checks that the page shows the removed state and does not open its stream again.
 * With DSH_SMOKE_WINDOWS=1, the check finds one window at dsh-app://app/widget/?slug=sample.
 * It turns the sample row off through the host plugin manager and finds that window closed.
 * With DSH_SMOKE_HOST_RESTART=1, the check kills the host once. The sample widget page must be live again
 * (count readable, an add shows, its stream did not close), and the main window must load again for the new host.
 * Then it kills the host again and quits the app while the restart waits; the app must exit with no kill.
 * With DSH_SMOKE_HOST_RESTART=give-up, the check installs a widget bundle that is not built in, then kills the host 4 times.
 * The second restart must be in safe mode: sample stays live, the installed widget is off with reason safe-mode,
 * and a plugin-manager enable does not turn it on. The fourth crash must open the fatal dialog, with no restart.
 * With DSH_SMOKE_HOST_RESTART=boot, the check kills the host as soon as it is first ready, while the main window boots.
 * The host must restart, and the main window must show the probe pid of the new host.
 * Each run sets DEEPWIDGETS_LOGS_DIR, so the crash reports of the app stay in the temp folder of the run.
 * The trace test also needs the start-up steps of Electron main and a message for each client row.
 * Then it reads the rows of the trace window page dsh-app://app/trace.
 * Uses only Node built-in modules. Prints one result line.
 */

import { spawn, execFile } from 'node:child_process'
import { appendFileSync, existsSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { linuxGroupWatcherSource, linuxListenPorts } from './smoke-desktop-linux.mjs'

const root = join(import.meta.dirname, '..')
const timeoutMs = positiveInteger(process.env.DSH_SMOKE_TIMEOUT_MS, 240_000)
const groupWatcherSource = `
import ctypes, ctypes.util, os, select, sys, traceback
libc = ctypes.CDLL(ctypes.util.find_library("c"))
PROC_PIDT_SHORTBSDINFO = 13
class ShortInfo(ctypes.Structure):
    _fields_ = [
        ("pbsi_pid", ctypes.c_uint32), ("pbsi_ppid", ctypes.c_uint32), ("pbsi_pgid", ctypes.c_uint32),
        ("pbsi_status", ctypes.c_uint32), ("pbsi_comm", ctypes.c_char * 16), ("pbsi_flags", ctypes.c_uint32),
        ("pbsi_uid", ctypes.c_uint32), ("pbsi_gid", ctypes.c_uint32), ("pbsi_ruid", ctypes.c_uint32),
        ("pbsi_rgid", ctypes.c_uint32), ("pbsi_svuid", ctypes.c_uint32), ("pbsi_svgid", ctypes.c_uint32),
        ("pbsi_rfu", ctypes.c_uint32),
    ]
def child_pids(ppid):
    fn = libc.proc_listchildpids
    fn.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_int]
    fn.restype = ctypes.c_int
    buf = (ctypes.c_int * 512)()
    n = fn(int(ppid), ctypes.byref(buf), ctypes.sizeof(buf))
    if n < 0:
        return []
    return [int(buf[i]) for i in range(min(n, 512))]
def pgid_of(pid):
    fn = libc.proc_pidinfo
    fn.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_uint64, ctypes.c_void_p, ctypes.c_int]
    fn.restype = ctypes.c_int
    info = ShortInfo()
    size = fn(int(pid), PROC_PIDT_SHORTBSDINFO, 0, ctypes.byref(info), ctypes.sizeof(info))
    if size <= 0 or int(info.pbsi_pid) != int(pid):
        return 0
    return int(info.pbsi_pgid)
NOTE = select.KQ_NOTE_FORK | select.KQ_NOTE_EXEC | select.KQ_NOTE_EXIT
def attach(kq, pid):
    event = select.kevent(int(pid), filter=select.KQ_FILTER_PROC, flags=select.KQ_EV_ADD | select.KQ_EV_ENABLE | select.KQ_EV_CLEAR, fflags=NOTE)
    kq.control([event], 0)
def main():
    out = sys.argv[1]
    self_group = os.getpgrp()
    print("ready", flush=True)
    root_pid = int(sys.stdin.readline())
    kq = select.kqueue()
    watched = set()
    seen_groups = set()
    def emit(pgid):
        if pgid <= 0 or pgid == self_group or pgid in seen_groups:
            return
        seen_groups.add(pgid)
        with open(out, "a") as handle:
            handle.write(str(pgid) + "\\n")
            handle.flush()
    def watch(pid):
        pgid = pgid_of(pid)
        if pgid:
            emit(pgid)
        if pid in watched:
            return
        try:
            attach(kq, pid)
        except OSError:
            return
        watched.add(pid)
    def walk(pid, seen):
        if pid in seen:
            return
        seen.add(pid)
        watch(pid)
        for child in child_pids(pid):
            walk(child, seen)
    walk(root_pid, set())
    while True:
        events = kq.control(None, 64, 0.05)
        for event in events:
            pgid = pgid_of(event.ident)
            if pgid:
                emit(pgid)
            if event.fflags & select.KQ_NOTE_FORK:
                for child in child_pids(event.ident):
                    walk(child, set())
        walk(root_pid, set())
try:
    main()
except Exception:
    traceback.print_exc()
`

if ((process.env.DSH_SMOKE_ROWS_SNAPSHOT ?? '') !== '') {
  let reason
  try {
    reason = compareHostSnapshot(process.env.DSH_SMOKE_ROWS_SNAPSHOT, process.env.DSH_SMOKE_ROWS ?? '')
  } catch (error) {
    reason = error instanceof Error ? error.message : 'snapshot failed'
  }
  const line = reason === undefined ? 'smoke-desktop: pass' : `smoke-desktop: fail: ${reason}`
  console.log(line)
  process.exit(reason === undefined ? 0 : 1)
}

const temp = await mkdtemp(join(tmpdir(), 'deepwidgets-smoke-desktop-'))
const home = join(temp, 'home')
const userData = join(temp, 'user-data')
const logPath = join(temp, 'desktop.log')
const appLogs = join(temp, 'app-logs')
/** The slug and the Loader module name of the safe mode test widget (deepwidgets/widgets/fixtures/safe-mode-widget). */
const TEST_WIDGET = 'safe-mode-test'
const TEST_WIDGET_MODULE = 'deepwidgets-widget-safe-mode-test'
await mkdir(home)
await mkdir(userData)
openSync(logPath, 'a')

const mainInspectPort = await freePort()
const rendererPort = await freePort()
const hostInspectPort = await freePort()

function note(line) {
  appendFileSync(logPath, `${line}\n`)
}

function positiveInteger(value, fallback) {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback
  return parsed
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => { resolve(port) })
    })
  })
}

const commandPath = ['/usr/sbin', '/usr/bin', process.env.PATH ?? ''].filter((entry) => entry !== '').join(':')

function capture(command, args) {
  return new Promise((resolve) => {
    execFile(command, args, { encoding: 'utf8', env: { ...process.env, PATH: commandPath } }, (error, stdout, stderr) => {
      const status = error === null ? 0 : (typeof error.code === 'number' ? error.code : 1)
      resolve({ status, stdout: stdout ?? '', stderr: stderr ?? '' })
    })
  })
}

function lines(text) {
  return text.split('\n').map((line) => line.trim()).filter((line) => line !== '')
}

async function descendantPids(rootPid) {
  const seen = new Set([String(rootPid)])
  let frontier = [String(rootPid)]
  while (frontier.length > 0) {
    const next = []
    for (const pid of frontier) {
      const result = await capture('pgrep', ['-P', pid])
      if (result.status !== 0) continue
      for (const child of lines(result.stdout)) {
        if (seen.has(child)) continue
        seen.add(child)
        next.push(child)
      }
    }
    frontier = next
  }
  return [...seen]
}

function addGroup(pgid) {
  if (pgid === '' || pgid === '0' || pgid === selfGroup) return
  knownGroups.add(pgid)
}

function readWatchedGroups() {
  let text = ''
  try { text = readFileSync(groupFile, 'utf8') } catch { return }
  for (const line of lines(text)) addGroup(line)
}

async function rememberGroups() {
  readWatchedGroups()
  const pids = await descendantPids(groupId)
  for (const pid of pids) {
    const result = await capture('ps', ['-o', 'pgid=', '-p', pid])
    addGroup(result.stdout.trim())
  }
}

async function groupPids() {
  await rememberGroups()
  const pids = new Set()
  for (const id of knownGroups) {
    const result = await capture('pgrep', ['-g', id])
    if (result.status !== 0) continue
    for (const pid of lines(result.stdout)) pids.add(pid)
  }
  return [...pids]
}

async function commandOf(pid) {
  const result = await capture('ps', ['-o', 'command=', '-p', pid])
  if (result.status !== 0) return ''
  return result.stdout.trim()
}

function listenPorts(lsofOutput) {
  const ports = new Set()
  for (const match of lsofOutput.matchAll(/:(\d+)\s+\(LISTEN\)/g)) {
    ports.add(Number(match[1]))
  }
  return [...ports]
}

function signalGroups(signal) {
  for (const id of knownGroups) {
    try { process.kill(-Number(id), signal) } catch { /* already gone */ }
  }
}

async function stopGroup(hostPid) {
  await rememberGroups()
  note(`groups=${[...knownGroups].join(',')}`)
  signalGroups('SIGTERM')
  const deadline = Date.now() + 20_000
  let remaining = await groupPids()
  while (remaining.length > 0 && Date.now() < deadline) {
    await delay(200)
    remaining = await groupPids()
  }
  if (remaining.length > 0) {
    signalGroups('SIGKILL')
    for (const pid of remaining) {
      try { process.kill(Number(pid), 'SIGKILL') } catch { /* already gone */ }
    }
    await delay(500)
  }
  if (hostPid !== undefined) {
    const stillHost = await commandOf(hostPid)
    if (stillHost !== '') {
      try { process.kill(Number(hostPid), 'SIGKILL') } catch { /* already gone */ }
      await delay(300)
    }
  }
  const leftover = await groupPids()
  const hostGone = hostPid === undefined || (await commandOf(hostPid)) === ''
  return { leftover, hostGone }
}

function finish(ok, reason) {
  if (groupWatcher !== undefined && groupWatcher.exitCode === null) {
    try { groupWatcher.kill('SIGKILL') } catch { /* already gone */ }
  }
  const line = ok ? 'smoke-desktop: pass' : `smoke-desktop: fail: ${reason}`
  console.log(line)
  process.exit(ok ? 0 : 1)
}

function pythonBin() {
  const candidates = ['/opt/homebrew/bin/python3', '/usr/local/bin/python3', '/usr/bin/python3']
  return candidates.find((path) => existsSync(path))
}

function startGroupWatcher(file) {
  const python = pythonBin()
  if (python === undefined) return Promise.reject(new Error('python3 unavailable'))
  // deepwidgets-trim: linux-x64 development target; old line:
  // const watcher = spawn(python, ['-c', groupWatcherSource, file], {
  const watcher = spawn(python, ['-c', process.platform === 'linux' ? linuxGroupWatcherSource : groupWatcherSource, file], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PATH: commandPath },
  })
  watcher.stderr.on('data', (chunk) => { note(`group-watcher: ${chunk.toString().trim()}`) })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { watcher.kill('SIGKILL') } catch { /* already gone */ }
      reject(new Error('group watcher did not start'))
    }, 5000)
    let buffer = ''
    let settled = false
    watcher.stdout.on('data', (chunk) => {
      buffer += chunk.toString()
      if (settled || !buffer.includes('ready')) return
      settled = true
      clearTimeout(timer)
      resolve(watcher)
    })
    watcher.once('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    watcher.once('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`group watcher exited ${String(code)}`))
    })
  })
}

const selfGroup = (await capture('ps', ['-o', 'pgid=', '-p', String(process.pid)])).stdout.trim()
const groupFile = join(temp, 'process-groups')
let groupWatcher
try {
  groupWatcher = await startGroupWatcher(groupFile)
} catch (error) {
  note(`group-watcher: ${error instanceof Error ? error.message : 'failed'}`)
  finish(false, 'group watcher did not start')
}
if (groupWatcher === undefined) finish(false, 'group watcher did not start')

const logFd = openSync(logPath, 'a')
const child = spawn('corepack', ['pnpm', 'run', 'start:desktop'], {
  cwd: root,
  detached: true,
  stdio: ['ignore', logFd, logFd],
  env: {
    ...process.env,
    COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
    DSH_HOME: home,
    DSH_DESKTOP_USER_DATA_DIR: userData,
    DSH_DESKTOP_MAIN_INSPECT_PORT: String(mainInspectPort),
    DSH_DESKTOP_RENDERER_DEBUG_PORT: String(rendererPort),
    DSH_DESKTOP_HOST_INSPECT_PORT: String(hostInspectPort),
    DSH_DESKTOP_OPEN_DEVTOOLS: '0',
    // The fixed MCP port of a live app must not collide with the smoke run: let the OS pick one.
    DEEPWIDGETS_MCP_PORT: process.env.DEEPWIDGETS_MCP_PORT ?? '0',
    // Crash reports and crash dumps of the app go into the temp folder, not ~/Library/Logs.
    DEEPWIDGETS_LOGS_DIR: appLogs,
  },
})

const groupId = child.pid
if (groupId === undefined) finish(false, 'desktop process did not start')
const knownGroups = new Set()
addGroup(String(groupId))
if (groupWatcher !== undefined) groupWatcher.stdin.write(`${String(groupId)}\n`)
child.once('error', (error) => { note(`spawn error=${error.message}`) })
note(`group=${String(groupId)} renderer=${String(rendererPort)} hostInspect=${String(hostInspectPort)} mainInspect=${String(mainInspectPort)}`)
child.unref()

let hostPid
let failed
try {
  const deadline = Date.now() + timeoutMs
  if (process.env.DSH_SMOKE_HOST_RESTART === 'boot') {
    failed = await checkHostBootKill(deadline)
  } else {
    const page = await waitForRenderer(deadline)
    if (page === undefined) {
      failed = 'renderer timeout'
    } else {
      const ready = await waitUntilComplete(page, deadline)
      if (!ready) {
        failed = 'renderer readyState was not complete'
      } else {
        const host = await waitForHost(deadline)
        if (!host) failed = 'host timeout'
        else if (process.env.DSH_SMOKE_PROBE === '1') failed = await checkProbe(page, deadline)
        if (failed === undefined && process.env.DSH_SMOKE_TRACE === '1') failed = await checkTrace(page, deadline)
        if (failed === undefined && process.env.DSH_SMOKE_HELLO === '1') failed = await checkHello(page, deadline)
        if (failed === undefined && (process.env.DSH_SMOKE_ROWS ?? '') !== '') failed = await checkRows(page, deadline)
        if (failed === undefined && (process.env.DSH_SMOKE_INSTALL ?? '') !== '') failed = await checkInstall(deadline)
        if (failed === undefined && (process.env.DSH_SMOKE_WIDGET ?? '') !== '') failed = await checkWidget(page, deadline)
        if (failed === undefined && process.env.DSH_SMOKE_WINDOWS === '1') failed = await checkWindows(deadline)
        if (failed === undefined && process.env.DSH_SMOKE_HOST_RESTART === '1') failed = await checkHostRestart(page, deadline)
        if (failed === undefined && process.env.DSH_SMOKE_HOST_RESTART === 'give-up') failed = await checkHostGiveUp(deadline)
      }
    }
  }
} catch (error) {
  failed = error instanceof Error ? error.message : 'smoke check failed'
}

const stopped = await stopGroup(hostPid)
if (stopped.leftover.length > 0 || !stopped.hostGone) {
  finish(false, `processes still alive: ${stopped.leftover.join(',') || hostPid}`)
}
finish(failed === undefined, failed ?? 'unknown')

async function waitForRenderer(deadline) {
  while (Date.now() < deadline) {
    await rememberGroups()
    try {
      const response = await fetch(`http://127.0.0.1:${String(rendererPort)}/json/list`, { signal: AbortSignal.timeout(2000) })
      if (response.ok) {
        const targets = await response.json()
        if (Array.isArray(targets)) {
          const pages = targets.filter((target) => target?.type === 'page' && typeof target.url === 'string')
          note(`pages=${pages.map((target) => target.url).join(' | ')}`)
          const match = pages.find((target) => target.url === 'dsh-app://app/')
          if (match !== undefined && typeof match.webSocketDebuggerUrl === 'string') return match
        }
      }
    } catch {
      /* renderer debugger is not up yet */
    }
    await delay(250)
  }
  return undefined
}

async function waitUntilComplete(page, deadline) {
  while (Date.now() < deadline) {
    await rememberGroups()
    try {
      const value = await evaluate(page.webSocketDebuggerUrl, 'document.readyState', deadline)
      note(`connected=${page.url} readyState=${String(value)}`)
      if (value === 'complete') {
        try {
          const visibility = await evaluate(page.webSocketDebuggerUrl, 'document.visibilityState', deadline)
          note(`visibilityState=${String(visibility)}`)
        } catch (error) {
          note(`visibility error=${error instanceof Error ? error.message : 'unknown'}`)
        }
        return true
      }
    } catch (error) {
      note(`evaluate error=${error instanceof Error ? error.message : 'unknown'}`)
    }
    await delay(250)
  }
  return false
}

function evaluate(url, expression, deadline, awaitPromise = false) {
  const remaining = Math.max(1, deadline - Date.now())
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const timer = setTimeout(() => {
      socket.close()
      reject(new Error('debugger timeout'))
    }, remaining)
    const id = 1
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, returnByValue: true, awaitPromise },
      }))
    })
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id !== id) return
      clearTimeout(timer)
      socket.close()
      if (message.result?.exceptionDetails) {
        reject(new Error(message.result.exceptionDetails.text ?? 'evaluate failed'))
        return
      }
      resolve(message.result?.result?.value)
    })
    socket.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error('debugger connection failed'))
    })
  })
}

async function notePages() {
  try {
    const response = await fetch(`http://127.0.0.1:${String(rendererPort)}/json/list`, { signal: AbortSignal.timeout(2000) })
    if (!response.ok) return
    const targets = await response.json()
    if (!Array.isArray(targets)) return
    const pages = targets.filter((target) => target?.type === 'page' && typeof target.url === 'string')
    note(`pages=${pages.map((target) => target.url).join(' | ')}`)
    const match = pages.find((target) => target.url === 'dsh-app://app/' && typeof target.webSocketDebuggerUrl === 'string')
    if (match === undefined) return
    const visibility = await evaluate(match.webSocketDebuggerUrl, 'document.visibilityState', Date.now() + 3000)
    note(`visibilityState=${String(visibility)}`)
  } catch (error) {
    note(`pages error=${error instanceof Error ? error.message : 'unknown'}`)
  }
}

async function waitForHost(deadline) {
  while (Date.now() < deadline) {
    const pids = await groupPids()
    for (const pid of pids) {
      const command = await commandOf(pid)
      if (!command.includes('desktop-host')) continue
      hostPid = pid
      // deepwidgets-trim: linux-x64 development target; old lines:
      // const listeners = await capture('lsof', ['-a', '-p', pid, '-iTCP', '-sTCP:LISTEN', '-nP'])
      // const ports = listenPorts(listeners.stdout).filter((port) => port !== hostInspectPort)
      const listeners = process.platform === 'linux'
        ? { stdout: '', status: 'linux', ports: linuxListenPorts(Number(pid)) }
        : await capture('lsof', ['-a', '-p', pid, '-iTCP', '-sTCP:LISTEN', '-nP'])
      const ports = (listeners.ports ?? listenPorts(listeners.stdout)).filter((port) => port !== hostInspectPort)
      note(`groups=${[...knownGroups].join(',')} hostPid=${pid} ports=${ports.join(',')} lsofStatus=${String(listeners.status)}`)
      for (const port of ports) {
        try {
          const response = await fetch(`http://127.0.0.1:${String(port)}/`, { signal: AbortSignal.timeout(3000) })
          note(`hostHttp=${String(port)} status=${String(response.status)}`)
          await notePages()
          return true
        } catch {
          /* this listener is not the host web server yet */
        }
      }
    }
    await delay(250)
  }
  return false
}

async function checkProbe(page, deadline) {
  let text = ''
  while (Date.now() < deadline) {
    try {
      text = String(await evaluate(page.webSocketDebuggerUrl,
        "document.querySelector('[data-deepwidgets-probe]')?.textContent ?? ''", deadline) ?? '')
    } catch (error) {
      note(`probe evaluate error=${error instanceof Error ? error.message : 'unknown'}`)
    }
    const match = /^probe pid (\d+)$/u.exec(text)
    if (match !== null) {
      note(`probe text=${text} hostPid=${String(hostPid)}`)
      return match[1] === hostPid ? undefined : `probe pid ${match[1]} is not host pid ${String(hostPid)}`
    }
    await delay(250)
  }
  const shown = text === '' ? 'missing' : text
  note(`probe text=${shown} hostPid=${String(hostPid)}`)
  return `probe text: ${shown}`
}

/** Read the widget page: the shown count, and the shell diagnostics `window.__dw`. */
/** With `frameId`, read the page in that iframe of the evaluated page instead. */
function widgetReadExpression(frameId) {
  if (frameId !== undefined) {
    return `((frame) => {
  if (frame === null || frame.contentDocument === null || frame.contentDocument.body === null) throw new Error('no frame page');
  return ((window, document) => ${widgetReadExpression()})(frame.contentWindow, frame.contentDocument)
})(document.getElementById(${JSON.stringify(frameId)}))`
  }
  return `JSON.stringify({ count: document.querySelector('[data-dw=stat-value]')?.textContent ?? null,
  dw: window.__dw ?? null, state: document.querySelector('[data-dw^=state-]')?.getAttribute('data-dw') ?? null,
  text: document.body.innerText, chart: document.querySelectorAll('[data-chart] .recharts-bar-rectangle').length })`
}

/** Run `declaration(widgets, ...args)` in the host, with the service ctx.widgets of the Loader. */
async function hostWidgets(deadline, declaration, args) {
  return withHostLoader(deadline, async (session, loaderId) => {
    const call = await cdpCall(session, 'Runtime.callFunctionOn', {
      objectId: loaderId,
      awaitPromise: true,
      returnByValue: true,
      arguments: args.map((value) => ({ value })),
      functionDeclaration: `async function (...args) {
        if (this.length !== 1) throw new Error("Loader instances " + this.length);
        const widgets = this[0].ctx?.get?.("widgets");
        if (widgets === undefined) throw new Error("no widgets service on Loader ctx");
        return (${declaration})(widgets, ...args);
      }`,
    })
    if (call?.exceptionDetails) {
      throw new Error(String(call.exceptionDetails.exception?.description ?? call.exceptionDetails.text ?? 'host call failed'))
    }
    return call?.result?.value
  })
}

/** The sample program with a new header title. */
function widgetProgram(title) {
  return `root = Card([CardHeader("${title}", "A counter"), Stat("Count", s.count), Button("Add 1", Action([@Run(add), @Run(s)]))])
s = Query("get", {}, {count: 0})
add = Mutation("add", {by: 1})
`
}

async function findWidgetPage(slug, deadline) {
  const url = `dsh-app://app/widget/?slug=${encodeURIComponent(slug)}`
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${String(rendererPort)}/json/list`, { signal: AbortSignal.timeout(2000) })).json()
      const match = targets.find((target) => target?.type === 'page' && target.url === url && typeof target.webSocketDebuggerUrl === 'string')
      if (match !== undefined) return match
    } catch { /* the debugger list is not ready */ }
    await delay(250)
  }
  return undefined
}

/** Poll the widget page until `accept` takes the read value. Gives the last value, and whether it was accepted. */
async function pollWidget(widget, until, accept, frameId) {
  let last
  while (Date.now() < until) {
    try {
      last = JSON.parse(String(await evaluate(widget.webSocketDebuggerUrl, widgetReadExpression(frameId), until)))
      if (accept(last)) return { value: last, ok: true }
    } catch (error) {
      last = { error: error instanceof Error ? error.message : 'evaluate failed' }
    }
    await delay(250)
  }
  return { value: last, ok: false }
}

/** Count the renderer pages at one URL. Gives undefined while the debugger list is not ready. */
async function countPages(url) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${String(rendererPort)}/json/list`, { signal: AbortSignal.timeout(2000) })).json()
    return targets.filter((target) => target?.type === 'page' && target.url === url).length
  } catch {
    return undefined
  }
}

/** Turn one host plugin row on or off through pluginManager.setPluginEnabled on the host Loader. */
async function setHostPlugin(moduleName, enabled, deadline) {
  return withHostLoader(deadline, async (session, loaderId) => {
    const call = await cdpCall(session, 'Runtime.callFunctionOn', {
      objectId: loaderId,
      awaitPromise: true,
      returnByValue: true,
      arguments: [{ value: moduleName }, { value: enabled }],
      functionDeclaration: `async function (moduleName, enabled) {
        if (this.length !== 1) throw new Error("Loader instances " + this.length);
        const loader = this[0];
        const manager = loader.ctx?.get?.("pluginManager") ?? loader.ctx?.pluginManager;
        if (manager === undefined || typeof manager.setPluginEnabled !== "function") throw new Error("no pluginManager on Loader ctx");
        const rows = (await manager.listPlugins()).filter((row) => row.moduleName === moduleName);
        if (rows.length !== 1) throw new Error("plugin rows for " + moduleName + ": " + rows.length);
        return await manager.setPluginEnabled(rows[0].entryId, enabled);
      }`,
    })
    if (call?.exceptionDetails) {
      throw new Error(String(call.exceptionDetails.exception?.description ?? call.exceptionDetails.text ?? 'setPluginEnabled failed'))
    }
    return call?.result?.value
  })
}

/**
 * Run `declaration` with `this` set to the one DesktopWidgetWindows instance of Electron main, over the main inspector.
 * The check uses the public hostGone and hostReady to cut and reopen the events stream, and counts `hello` frames.
 */
async function withWidgetWindows(deadline, declaration) {
  const targets = await (await fetch(`http://127.0.0.1:${String(mainInspectPort)}/json/list`, { signal: AbortSignal.timeout(3000) })).json()
  if (!Array.isArray(targets) || typeof targets[0]?.webSocketDebuggerUrl !== 'string') throw new Error('main /json/list: no target')
  const session = await cdpSession(targets[0].webSocketDebuggerUrl, deadline)
  try {
    const proto = await cdpCall(session, 'Runtime.evaluate', { expression: 'Function.prototype' })
    const functions = await cdpCall(session, 'Runtime.queryObjects', { prototypeObjectId: proto?.result?.objectId })
    const classProto = await cdpCall(session, 'Runtime.callFunctionOn', {
      objectId: functions?.objects?.objectId,
      functionDeclaration: 'function () { const found = this.filter((fn) => fn.name === "DesktopWidgetWindows" && typeof fn.prototype?.hostReady === "function"); if (found.length !== 1) throw new Error("DesktopWidgetWindows classes " + found.length); return found[0].prototype }',
    })
    if (typeof classProto?.result?.objectId !== 'string') throw new Error('main: no DesktopWidgetWindows prototype')
    const instances = await cdpCall(session, 'Runtime.queryObjects', { prototypeObjectId: classProto.result.objectId })
    const call = await cdpCall(session, 'Runtime.callFunctionOn', {
      objectId: instances?.objects?.objectId,
      awaitPromise: true,
      returnByValue: true,
      functionDeclaration: `function () { if (this.length !== 1) throw new Error("DesktopWidgetWindows instances " + this.length); return (${declaration}).call(this[0]) }`,
    })
    if (call?.exceptionDetails) throw new Error(String(call.exceptionDetails.exception?.description ?? call.exceptionDetails.text ?? 'main call failed'))
    return call?.result?.value
  } finally {
    session.close()
  }
}

/** Count `hello` frames from now on: wrap the instance method sync, which only `hello` calls. Gives the count. */
function countHellos() {
  return `function () {
  if (this.__smokeHellos === undefined) {
    this.__smokeHellos = 0
    const sync = this.sync
    this.sync = function (slugs) { this.__smokeHellos += 1; return sync.call(this, slugs) }
  }
  return this.__smokeHellos
}`
}
/** Cut the events stream of main with its public hostGone, and keep the target. */
function pauseStream() {
  return 'function () { this.__smokeTarget = this.target; this.hostGone(); return this.__smokeTarget !== undefined }'
}
/** Open the events stream of main again with its public hostReady. */
function resumeStream() {
  return 'function () { this.hostReady(this.__smokeTarget.url, this.__smokeTarget.cookie); return true }'
}

/** Poll until the page count at `url` is `want`. Gives the failure text, or undefined. */
async function waitPages(url, want, until, what) {
  let count
  while (Date.now() < until) {
    count = await countPages(url)
    if (count === want) return undefined
    await delay(250)
  }
  return `windows: ${what}: want ${String(want)} window(s) at ${url}, got ${String(count)}`
}

/** Poll until main has counted more `hello` frames than `before`. */
async function waitHello(before, until) {
  let count
  while (Date.now() < until) {
    count = await withWidgetWindows(until, countHellos())
    if (count > before) return undefined
    await delay(250)
  }
  return `windows: no new hello frame (count ${String(count)})`
}

async function setSample(enabled, deadline) {
  const result = await setHostPlugin('@deepwidgets/widget-sample', enabled, deadline)
  note(`windows sample enabled=${String(enabled)} result=${JSON.stringify({ application: result?.application, changed: result?.changed })}`)
  return result?.application === 'applied' ? undefined : `windows: the sample row did not turn ${enabled ? 'on' : 'off'}: ${JSON.stringify(result)}`
}

async function checkWindows(deadline) {
  const url = 'dsh-app://app/widget/?slug=sample'
  const soon = () => Math.min(deadline, Date.now() + 15_000)
  let failed = await waitPages(url, 1, deadline, 'first open')
  if (failed !== undefined) return failed
  // Turn the row off and on again quickly, twice. One window must stay.
  for (const enabled of [false, true, false, true]) {
    failed = await setSample(enabled, deadline)
    if (failed !== undefined) return failed
  }
  failed = await waitPages(url, 1, soon(), 'after off and on twice')
  if (failed !== undefined) return failed
  // A resync while the sample window is open: `hello` lists sample again, and open must not add a second window.
  let hellos = await withWidgetWindows(deadline, countHellos())
  await withWidgetWindows(deadline, pauseStream())
  await withWidgetWindows(deadline, resumeStream())
  failed = await waitHello(hellos, soon())
  if (failed !== undefined) return failed
  // `removed` closes the window. A second window from the resync would stay open here.
  failed = await setSample(false, deadline)
  if (failed !== undefined) return failed
  failed = await waitPages(url, 0, soon(), 'after removed')
  if (failed !== undefined) return failed
  // `added` opens it again.
  failed = await setSample(true, deadline)
  if (failed !== undefined) return failed
  failed = await waitPages(url, 1, soon(), 'after added')
  if (failed !== undefined) return failed
  // The row goes off while main has no stream, so main misses `removed`. The next `hello` must close the extra window.
  hellos = await withWidgetWindows(deadline, countHellos())
  await withWidgetWindows(deadline, pauseStream())
  failed = await setSample(false, deadline)
  if (failed !== undefined) return failed
  failed = await waitPages(url, 1, deadline, 'while the stream is cut')
  if (failed !== undefined) return failed
  await withWidgetWindows(deadline, resumeStream())
  failed = await waitHello(hellos, soon())
  if (failed !== undefined) return failed
  return waitPages(url, 0, soon(), 'after hello without sample')
}

/** The `deepwidgets-supervisor {json}` lines of Electron main in the app log, from the time `since` on. */
function supervisorEvents(since) {
  let text = ''
  try { text = readFileSync(logPath, 'utf8') } catch { return [] }
  const events = []
  for (const match of text.matchAll(/deepwidgets-supervisor (\{.*\})/g)) {
    try {
      const event = JSON.parse(match[1])
      if (typeof event.at === 'number' && event.at >= since) events.push(event)
    } catch { /* a partial line */ }
  }
  return events
}

/** Wait for a supervisor event that `test` takes. Gives undefined at the deadline. */
async function waitForSupervisor(since, test, until) {
  while (Date.now() < until) {
    const found = supervisorEvents(since).find(test)
    if (found !== undefined) return found
    await delay(100)
  }
  return undefined
}

/** Kill the host with SIGKILL. Gives the kill time. */
async function killHost(label) {
  const pid = hostPid
  if (pid === undefined) throw new Error(`${label}: no host pid`)
  const at = Date.now()
  process.kill(Number(pid), 'SIGKILL')
  note(`${label}: killed host ${pid}`)
  return { pid, at }
}

/** Wait for a host web server in a new host process. Sets hostPid. */
async function waitForNewHost(oldPid, until) {
  while (Date.now() < until) {
    if (await waitForHost(Math.min(until, Date.now() + 5000)) && hostPid !== oldPid) return true
    await delay(250)
  }
  return false
}

/** Read the main window: a mark set before the restart, the probe text, and readyState. */
async function readMainWindow(until) {
  const main = await waitForRenderer(until)
  if (main === undefined) return undefined
  try {
    return JSON.parse(String(await evaluate(main.webSocketDebuggerUrl, `JSON.stringify({ mark: window.__smokeRestartMark === true,
  ready: document.readyState, probe: document.querySelector('[data-deepwidgets-probe]')?.textContent ?? '' })`, until)))
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'evaluate failed' }
  }
}

/** Quit Electron main through its inspector: app.quit() runs the normal quit path. */
async function quitApp(until) {
  const targets = await (await fetch(`http://127.0.0.1:${String(mainInspectPort)}/json/list`, { signal: AbortSignal.timeout(3000) })).json()
  const url = targets[0]?.webSocketDebuggerUrl
  if (typeof url !== 'string') throw new Error('main inspector: no target')
  const session = await cdpSession(url, until)
  try {
    await cdpCall(session, 'Runtime.evaluate', { expression: "require('electron').app.quit()", includeCommandLineAPI: true })
  } finally {
    session.close()
  }
}

async function checkHostRestart(page, deadline) {
  const url = 'dsh-app://app/widget/?slug=sample'
  const widget = await findWidgetPage('sample', deadline)
  if (widget === undefined) return 'restart: no sample widget page'
  const first = await pollWidget(widget, deadline, (value) => value.count !== null && value.dw?.stream === 'open')
  note(`restart first=${JSON.stringify(first.value)}`)
  if (!first.ok) return `restart: no count in the page: ${JSON.stringify(first.value)}`
  const opensBefore = first.value.dw.streamOpens
  const eventsBefore = first.value.dw.events.length
  await evaluate(page.webSocketDebuggerUrl, 'window.__smokeRestartMark = true', deadline)

  const kill = await killHost('restart')
  const until = Math.min(deadline, Date.now() + 60_000)
  const failedEvent = await waitForSupervisor(kill.at, (event) => event.event === 'host-failed', until)
  note(`restart host-failed=${JSON.stringify(failedEvent)}`)
  if (failedEvent === undefined) return 'restart: Electron main did not log host-failed'
  if (!await waitForNewHost(kill.pid, until)) return 'restart: no new host'
  note(`restart new host=${String(hostPid)} after ${String(Date.now() - kill.at)} ms`)

  // The same window, so the same renderer target: the window stayed open across the restart.
  const back = await pollWidget(widget, until, (value) => value.count !== null && value.dw?.stream === 'open' && value.dw.streamOpens > opensBefore)
  note(`restart widget back=${JSON.stringify(back.value)} after ${String(Date.now() - kill.at)} ms`)
  if (!back.ok) return `restart: the widget page did not come back: ${JSON.stringify(back.value)}`

  let mainState
  while (Date.now() < until) {
    mainState = await readMainWindow(until)
    if (mainState !== undefined && mainState.mark === false && mainState.ready === 'complete' && mainState.probe === `probe pid ${String(hostPid)}`) break
    await delay(250)
  }
  note(`restart main=${JSON.stringify(mainState)}`)
  if (mainState?.mark !== false || mainState.probe !== `probe pid ${String(hostPid)}`) return `restart: the main window did not come back: ${JSON.stringify(mainState)}`

  const main = await waitForRenderer(until)
  const posted = await evaluate(main.webSocketDebuggerUrl, `fetch('/api/widgets/sample/call', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', args: { by: 1 } }),
  }).then(async (response) => JSON.stringify({ status: response.status, body: await response.json() }))`, until, true)
  note(`restart add=${String(posted)}`)
  const expected = JSON.parse(String(posted)).body?.result?.count
  if (typeof expected !== 'number') return `restart: add failed: ${String(posted)}`
  const shown = await pollWidget(widget, Math.min(until, Date.now() + 10_000), (value) => value.count === String(expected))
  note(`restart after-add=${JSON.stringify(shown.value)}`)
  if (!shown.ok) return `restart: the page did not show count ${String(expected)}: ${JSON.stringify(shown.value)}`
  // A 503 in the gap closes the EventSource; a network error keeps it retrying (widget.shell_url).
  const gapEvents = shown.value.dw.events.slice(eventsBefore)
  if (gapEvents.includes('closed')) return `restart: the page stream closed in the gap: ${gapEvents.join(',')}`
  const windows = await countPages(url)
  if (windows !== 1) return `restart: want one sample window, got ${String(windows)}`

  // Quit while a restart waits: the app must exit by itself.
  const second = await killHost('quit')
  const waiting = await waitForSupervisor(second.at, (event) => event.event === 'host-failed', until)
  if (waiting === undefined) return 'restart: no host-failed before the quit'
  const quitAt = Date.now()
  await quitApp(until)
  const quitUntil = quitAt + 30_000
  let alive = await groupPids()
  let electron = []
  while (Date.now() < quitUntil) {
    alive = await groupPids()
    electron = []
    for (const pid of alive) if (/Electron|desktop-host/u.test(await commandOf(pid))) electron.push(pid)
    if (electron.length === 0) break
    await delay(250)
  }
  note(`restart quit: ${String(Date.now() - quitAt)} ms, left=${electron.join(',')} restarts=${JSON.stringify(supervisorEvents(second.at).map((event) => event.event))}`)
  if (electron.length > 0) return `restart: the app did not quit in 30 s: ${electron.join(',')}`
  if (supervisorEvents(second.at).some((event) => event.event === 'restart')) return 'restart: a restart ran after the quit'
  return undefined
}

async function checkHostGiveUp(deadline) {
  const url = 'dsh-app://app/widget/?slug=sample'
  const widget = await findWidgetPage('sample', deadline)
  if (widget === undefined) return 'give-up: no sample widget page'
  const until = Math.min(deadline, Date.now() + 120_000)
  const installed = await installBundle(join(root, 'deepwidgets', 'widgets', 'fixtures', 'safe-mode-widget'), deadline)
  note(`give-up install=${JSON.stringify(installed)}`)
  if (installed?.application !== 'applied') return `give-up: the test widget did not install: ${JSON.stringify(installed)}`
  const before = await pollList(widget, until, (list) => list.some((item) => item.slug === TEST_WIDGET && item.off === undefined))
  note(`give-up normal list=${JSON.stringify(before.value)}`)
  if (!before.ok) return `give-up: the test widget is not live before safe mode: ${JSON.stringify(before.value)}`
  const start = Date.now()
  for (let crash = 1; crash <= 3; crash += 1) {
    const kill = await killHost(`give-up ${String(crash)}`)
    const failedEvent = await waitForSupervisor(kill.at, (event) => event.event === 'host-failed', until)
    note(`give-up ${String(crash)} host-failed=${JSON.stringify(failedEvent)}`)
    if (failedEvent?.crashes !== crash) return `give-up: crash ${String(crash)}: ${JSON.stringify(failedEvent)}`
    const ready = await waitForSupervisor(kill.at, (event) => event.event === 'ready', until)
    if (ready === undefined) return `give-up: crash ${String(crash)}: the host did not come back`
    if (ready.safeMode !== (crash >= 2)) return `give-up: crash ${String(crash)}: safeMode ${String(ready.safeMode)}`
    if (!await waitForNewHost(kill.pid, until)) return `give-up: crash ${String(crash)}: no new host`
    if (crash === 2) {
      const reason = await checkSafeMode(widget, url, until)
      if (reason !== undefined) return `give-up: safe mode: ${reason}`
    }
  }
  const last = await killHost('give-up 4')
  const gaveUp = await waitForSupervisor(last.at, (event) => event.event === 'give-up', until)
  note(`give-up event=${JSON.stringify(gaveUp)} ${String(last.at - start)} ms after the first kill`)
  if (gaveUp?.crashes !== 4) return `give-up: no give-up after 4 crashes: ${JSON.stringify(gaveUp)}`
  // No restart follows the give-up; the DSH fatal dialog owns the next step. 10 s is longer than the longest backoff.
  await delay(10_000)
  const after = supervisorEvents(last.at).map((event) => event.event)
  note(`give-up events after the fourth kill=${after.join(',')}`)
  if (after.includes('restart') || after.includes('ready')) return `give-up: the host restarted after the give-up: ${after.join(',')}`
  // DesktopFatalRecovery writes the crash report, then shows the dialog. Its show() logs `deepwidgets-fatal-dialog`.
  const text = readFileSync(logPath, 'utf8')
  const dialog = /deepwidgets-fatal-dialog (\{.*\})/u.exec(text.slice(text.indexOf('deepwidgets-supervisor {"at":' + String(gaveUp.at))))
  note(`give-up dialog=${dialog?.[1] ?? 'none'}`)
  if (dialog === null) return 'give-up: the fatal dialog did not open after the give-up'
  let reports = []
  try { reports = readdirSync(join(appLogs, 'logs')).filter((file) => /^crash-.*-host\.log$/u.test(file)) } catch { /* no folder */ }
  note(`give-up crash reports=${reports.join(',')}`)
  if (reports.length !== 1) return `give-up: want one host crash report in the temp logs folder, got ${reports.join(',') || 'none'}`
  return undefined
}

/** Install a local bundle through pluginManager.installBundle on the host Loader. */
async function installBundle(folder, deadline) {
  return withHostLoader(deadline, async (session, loaderId) => {
    const call = await cdpCall(session, 'Runtime.callFunctionOn', {
      objectId: loaderId,
      awaitPromise: true,
      returnByValue: true,
      arguments: [{ value: `file:${folder}` }],
      functionDeclaration: `async function (spec) {
        if (this.length !== 1) throw new Error("Loader instances " + this.length);
        const manager = this[0].ctx?.get?.("pluginManager") ?? this[0].ctx?.pluginManager;
        if (manager === undefined || typeof manager.installBundle !== "function") throw new Error("no pluginManager on Loader ctx");
        return await manager.installBundle(spec);
      }`,
    })
    if (call?.exceptionDetails) throw new Error(String(call.exceptionDetails.exception?.description ?? call.exceptionDetails.text ?? 'install failed'))
    return call?.result?.value
  })
}

/** GET /api/widgets from the widget page until `accept` takes the list. */
async function pollList(widget, until, accept) {
  let last
  while (Date.now() < until) {
    try {
      const answer = JSON.parse(String(await evaluate(widget.webSocketDebuggerUrl,
        "fetch('/api/widgets').then(async (response) => JSON.stringify({ status: response.status, body: await response.json() }))", until, true)))
      last = answer.body?.widgets ?? answer
      if (Array.isArray(last) && accept(last)) return { value: last, ok: true }
    } catch (error) {
      last = { error: error instanceof Error ? error.message : 'evaluate failed' }
    }
    await delay(250)
  }
  return { value: last, ok: false }
}

/**
 * Safe mode: sample (built in) stays live in its window, the test widget is off with reason safe-mode,
 * and turning its row off and on through the plugin manager does not bring it back.
 */
async function checkSafeMode(widget, url, until) {
  const offIn = (list) => list.find((item) => item.slug === TEST_WIDGET)?.off?.reason === 'safe-mode'
  const sampleLive = (list) => list.some((item) => item.slug === 'sample' && item.off === undefined)
  const first = await pollList(widget, until, (list) => offIn(list) && sampleLive(list))
  note(`give-up safe mode list=${JSON.stringify(first.value)}`)
  if (!first.ok) return `the test widget is not off, or sample is not live: ${JSON.stringify(first.value)}`
  const page = await pollWidget(widget, until, (value) => value.count !== null && value.dw?.stream === 'open')
  const windows = await countPages(url)
  note(`give-up safe mode sample page=${JSON.stringify(page.value)} windows=${String(windows)}`)
  if (!page.ok || windows !== 1) return `sample is not live in its window: ${JSON.stringify(page.value)} windows=${String(windows)}`
  const offResult = await setHostPlugin(TEST_WIDGET_MODULE, false, until)
  const onResult = await setHostPlugin(TEST_WIDGET_MODULE, true, until)
  note(`give-up safe mode toggle off=${JSON.stringify(offResult)} on=${JSON.stringify(onResult)}`)
  const after = await pollList(widget, until, (list) => offIn(list))
  const program = JSON.parse(String(await evaluate(widget.webSocketDebuggerUrl,
    `fetch('/api/widgets/${TEST_WIDGET}/program').then((response) => JSON.stringify({ status: response.status }))`, until, true)))
  note(`give-up safe mode after enable list=${JSON.stringify(after.value)} program=${JSON.stringify(program)}`)
  if (!after.ok) return `a plugin-manager enable turned the test widget on: ${JSON.stringify(after.value)}`
  if (program.status !== 404) return `the test widget answers its program route after an enable: ${String(program.status)}`
  return undefined
}

/** Kill the host as soon as it is first ready, while the main window boots. The main window must come back. */
async function checkHostBootKill(deadline) {
  let pid
  let ready
  while (Date.now() < deadline) {
    if (pid === undefined) {
      for (const candidate of await groupPids()) {
        if ((await commandOf(candidate)).includes('desktop-host')) { pid = candidate; break }
      }
    }
    ready = supervisorEvents(0).find((event) => event.event === 'ready')
    if (ready !== undefined && pid !== undefined) break
    await delay(20)
  }
  if (ready === undefined || pid === undefined) return 'boot: the host was not ready'
  hostPid = pid
  const kill = await killHost('boot')
  note(`boot: killed ${String(kill.at - ready.at)} ms after ready`)
  const until = Math.min(deadline, Date.now() + 90_000)
  const restarted = await waitForSupervisor(ready.at, (event) => event.event === 'restarted', until)
  if (restarted === undefined) return 'boot: the host did not restart'
  if (!await waitForNewHost(kill.pid, until)) return 'boot: no new host'
  const page = await waitForRenderer(until)
  if (page === undefined) return 'boot: no main window'
  const probe = await checkProbe(page, until)
  if (probe !== undefined) return `boot: the main window did not come back: ${probe}`
  const text = readFileSync(logPath, 'utf8')
  const gated = text.includes('deepwidgets-supervisor: the main window boot failed during a Host restart')
  const dialog = text.includes('deepwidgets-fatal-dialog')
  note(`boot: gate line=${String(gated)} fatal dialog=${String(dialog)}`)
  if (dialog) return 'boot: the fatal dialog opened'
  if (!gated) return 'boot: the kill did not meet the main window boot (no gate line), so the check did not test the boot path'
  return undefined
}

async function checkWidget(page, deadline) {
  const slug = process.env.DSH_SMOKE_WIDGET
  const widget = await findWidgetPage(slug, deadline)
  if (widget === undefined) return `widget: no page for ${slug}`
  const first = await pollWidget(widget, deadline, (value) => value.count !== null && value.dw?.stream === 'open')
  note(`widget first=${JSON.stringify(first.value)}`)
  if (!first.ok) return `widget: no count in the page: ${JSON.stringify(first.value)}`
  // The main window posts add, so the widget page learns of it only from its stream.
  const posted = await evaluate(page.webSocketDebuggerUrl, `fetch('/api/widgets/${encodeURIComponent(slug)}/call', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', args: { by: 1 } }),
  }).then(async (response) => JSON.stringify({ status: response.status, body: await response.json() }))`, deadline, true)
  note(`widget add=${String(posted)}`)
  const answer = JSON.parse(String(posted))
  const expected = answer.body?.result?.count
  if (answer.status !== 200 || typeof expected !== 'number') return `widget: add failed: ${String(posted)}`
  const shown = await pollWidget(widget, Math.min(deadline, Date.now() + 10_000), (value) => value.count === String(expected))
  note(`widget after-add=${JSON.stringify(shown.value)}`)
  if (!shown.ok) return `widget: the page did not show count ${String(expected)}: ${JSON.stringify(shown.value)}`
  // A new program: the page must load it again on the `program` frame.
  const title = `smoke program ${Date.now().toString(36)}`
  const written = await hostWidgets(deadline, '(widgets, slug, text) => widgets.setProgram(slug, text, { by: "smoke" })', [slug, widgetProgram(title)])
  note(`widget setProgram=${JSON.stringify(written)}`)
  const reloaded = await pollWidget(widget, Math.min(deadline, Date.now() + 10_000), (value) => value.text.includes(title) && value.count === String(expected))
  note(`widget after-program=${JSON.stringify({ ...reloaded.value, text: reloaded.value?.text?.slice(0, 120) })}`)
  if (!reloaded.ok) return `widget: the page did not show the new program "${title}": ${JSON.stringify(reloaded.value?.dw ?? reloaded.value)}`
  return checkWidgetRemoved(page, deadline)
}

/**
 * Register a second widget, find the window that Electron main opens for it (with a bar chart of two bars),
 * end the registration, and check the removed state. Electron main closes the widget window on `removed`,
 * so the removed state is read from the same page in an iframe of the main window, which main does not own.
 */
async function checkWidgetRemoved(main, deadline) {
  const slug = `smoke-removed-${Date.now().toString(36)}`
  const title = `removable ${slug}`
  await hostWidgets(deadline, `(widgets, slug, title) => {
    globalThis.__deepwidgetsSmokeRemove = widgets.register({ slug, title, initialState: {},
      program: 'root = Card([CardHeader("' + title + '"), BarChart(["a", "b"], [Series("n", [1, 2])])])', actions: [] })
    return true
  }`, [slug, title])
  const url = `dsh-app://app/widget/?slug=${encodeURIComponent(slug)}`
  const page = await findWidgetPage(slug, deadline)
  if (page === undefined) return `widget removed: no window for ${slug}`
  const ready = await pollWidget(page, Math.min(deadline, Date.now() + 15_000), (value) => value.text.includes(title) && value.dw?.stream === 'open' && value.chart === 2)
  note(`widget second=${JSON.stringify({ ...ready.value, text: ready.value?.text?.slice(0, 120) })}`)
  if (!ready.ok) return `widget removed: the page of ${slug} did not load with its bar chart: ${JSON.stringify({ ...ready.value, text: undefined })}`
  const frameId = 'deepwidgets-smoke-removed'
  await evaluate(main.webSocketDebuggerUrl, `(() => { const frame = document.createElement('iframe'); frame.id = ${JSON.stringify(frameId)};
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:320px;height:300px;border:0'; frame.src = ${JSON.stringify(url)};
  document.body.append(frame); return true })()`, deadline)
  const framed = await pollWidget(main, Math.min(deadline, Date.now() + 15_000), (value) => value.text.includes(title) && value.dw?.stream === 'open', frameId)
  if (!framed.ok) return `widget removed: the iframe page of ${slug} did not load: ${JSON.stringify({ ...framed.value, text: undefined })}`
  await hostWidgets(deadline, 'async () => { await globalThis.__deepwidgetsSmokeRemove(); delete globalThis.__deepwidgetsSmokeRemove; return true }', [])
  const removed = await pollWidget(main, Math.min(deadline, Date.now() + 10_000), (value) => value.state === 'state-removed', frameId)
  if (!removed.ok) return `widget removed: no removed state: ${JSON.stringify(removed.value?.dw ?? removed.value)}`
  // A page that opens the stream again would log connect and closed after removed within this wait (backoff 250 ms).
  await delay(3000)
  const after = await pollWidget(main, Math.min(deadline, Date.now() + 5000), () => true, frameId)
  const events = after.value?.dw?.events ?? []
  const tail = events.slice(events.lastIndexOf('removed') + 1)
  note(`widget removed events=${JSON.stringify(events)} state=${String(after.value?.state)}`)
  await evaluate(main.webSocketDebuggerUrl, `document.getElementById(${JSON.stringify(frameId)})?.remove(), true`, deadline)
  if (after.value?.state !== 'state-removed') return `widget removed: the removed state did not stay: ${String(after.value?.state)}`
  if (tail.length > 0) return `widget removed: the page kept using the stream after removed: ${JSON.stringify(tail)}`
  return waitPages(url, 0, Math.min(deadline, Date.now() + 10_000), 'the window of the removed widget')
}

async function checkHello(page, deadline) {
  let text = ''
  while (Date.now() < deadline && text !== 'hello') {
    try {
      text = String(await evaluate(page.webSocketDebuggerUrl,
        "document.querySelector('[data-deepwidgets-hello]')?.textContent ?? ''", deadline) ?? '')
    } catch (error) {
      note(`hello evaluate error=${error instanceof Error ? error.message : 'unknown'}`)
    }
    if (text !== 'hello') await delay(250)
  }
  const targets = await (await fetch(`http://127.0.0.1:${String(rendererPort)}/json/list`)).json()
  const welcome = targets.map((target) => String(target?.url)).filter((url) => url.includes('welcome'))
  note(`hello text=${text || 'missing'} welcome=${welcome.join(',') || 'none'}`)
  if (text !== 'hello') return `hello text: ${text || 'missing'}`
  return welcome.length === 0 ? undefined : `hello: welcome window ${welcome.join(',')}`
}

function traceReadExpression() {
  return `(async () => {
  const id = \`\${Date.now().toString(36)}\${Math.random().toString(36).slice(2, 6)}\`
  const prefix = \`smoke-trace-\${id}-\`
  const T = Date.now()
  const messages = []
  const out = {}
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, 10000)
  let reader
  const decode = new TextDecoder()
  let buffer = ''
  const takeFrame = (frame) => {
    const line = frame.split('\\n').find((item) => item.startsWith('data: '))
    if (line === undefined) return
    messages.push(JSON.parse(line.slice(6)))
  }
  const STEPS = ['app-ready', 'host-started', 'host-ready', 'main-window-open', 'trace-window-open']
  const bootIds = () => (window.__DSH_BOOT__?.entries ?? []).map((entry) => entry.id)
  const hasStep = (name) => messages.some((message) => message.process === 'main' && message.kind === 'step' && message.name === name && message.state === 'done')
  const hasClientRow = (id) => messages.some((message) => message.process === 'client' && message.kind === 'plugin' && message.name === id)
  const hasClientLoader = () => messages.some((message) => message.process === 'client' && message.kind === 'service' && message.name === 'loader' && message.state === 'up')
  const hasSources = () => STEPS.every(hasStep) && bootIds().length > 0 && bootIds().every(hasClientRow) && hasClientLoader()
  const pull = async (done) => {
    while (!done()) {
      if (reader === undefined) return false
      let step
      try {
        step = await reader.read()
      } catch (error) {
        if (error && error.name === 'AbortError') return false
        throw error
      }
      if (step.done) return false
      buffer += decode.decode(step.value, { stream: true })
      let split = buffer.indexOf('\\n\\n')
      while (split !== -1) {
        takeFrame(buffer.slice(0, split))
        buffer = buffer.slice(split + 2)
        split = buffer.indexOf('\\n\\n')
      }
    }
    return true
  }
  try {
    const response = await fetch('api/trace', { signal: controller.signal })
    out.status = response.status
    out.type = response.headers.get('content-type')
    if (response.status === 200) {
      reader = response.body.getReader()
      const hasWeb = () => messages.some((message) => message.process === 'host' && message.kind === 'service' && message.name === 'webServer' && message.state === 'up')
      await pull(hasWeb)
      out.found = hasWeb()
      if (out.found === true) {
        const page = await fetch('trace')
        out.page = page.status
        out.pageType = page.headers.get('content-type')
        const mixed = { time: T, process: 'main', kind: 'step', name: prefix + 'mixed', state: 'done' }
        const main = { time: T, process: 'main', kind: 'step', name: prefix + 'main', state: 'done', detail: 'smoke' }
        const client = { time: T, process: 'client', window: 'main', kind: 'service', name: prefix + 'client', state: 'up' }
        const post = async (body) => fetch('api/trace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        const empty = await post([])
        out.postEmpty = empty.status
        const bad = await post([{ process: 'host' }])
        out.postBad = bad.status
        const mixedAnswer = await post([mixed, { process: 'host' }])
        out.postMixed = mixedAnswer.status
        const good = await post([{ seq: 0, ...main }, client])
        out.postGood = good.status
        if (good.status === 200) out.added = (await good.json()).added
        const hasClient = () => messages.some((message) => message.name === prefix + 'client')
        await pull(() => hasClient() && hasSources())
        const mainCopy = messages.find((message) => message.name === prefix + 'main')
        const clientCopy = messages.find((message) => message.name === prefix + 'client')
        const withoutSeq = (message) => {
          const copy = { ...message }
          delete copy.seq
          return JSON.stringify(copy)
        }
        out.leak = messages.some((message) => message.name === prefix + 'mixed')
        out.echoMain = mainCopy !== undefined && withoutSeq(mainCopy) === JSON.stringify(main)
        out.echoClient = clientCopy !== undefined && withoutSeq(clientCopy) === JSON.stringify(client)
        out.echoSeq = mainCopy !== undefined && clientCopy !== undefined && clientCopy.seq === mainCopy.seq + 1
      }
    }
  } catch (error) {
    if (!(error && error.name === 'AbortError')) out.error = error instanceof Error ? error.message : String(error)
  } finally {
    clearTimeout(timer)
    controller.abort()
    out.count = messages.length
    out.seqOk = messages.every((message, index) => message.seq === index + 1)
    const processes = []
    for (const message of messages) {
      if (typeof message.name === 'string' && message.name.startsWith('smoke-trace-')) continue
      if (!processes.includes(message.process)) processes.push(message.process)
    }
    out.processes = processes
    out.steps = STEPS.filter(hasStep)
    const windows = []
    for (const message of messages) {
      if (message.process !== 'client') continue
      if (typeof message.name === 'string' && message.name.startsWith('smoke-trace-')) continue
      if (!windows.includes(message.window)) windows.push(message.window)
    }
    out.clientWindows = windows
    const ids = bootIds()
    out.bootCount = ids.length
    out.clientMissing = ids.filter((id) => !hasClientRow(id))
    out.clientLoader = hasClientLoader()
    const web = messages.find((message) => message.process === 'host' && message.kind === 'service' && message.name === 'webServer' && message.state === 'up')
    out.webSeq = web ? web.seq : undefined
    out.snapshotPlugins = messages.filter((message) => message.snapshot === true && message.kind === 'plugin').length
    out.snapshotServices = messages.filter((message) => message.snapshot === true && message.kind === 'service').length
    if (reader !== undefined) {
      try { await reader.cancel() } catch { /* the stream is already closed */ }
    }
  }
  return JSON.stringify(out)
})()`
}

function traceReason(result) {
  const rules = [
    [result.status === 200, `status ${String(result.status)}`],
    [String(result.type ?? '').startsWith('text/event-stream'), `content type ${String(result.type)}`],
    [result.seqOk === true, 'seq out of order'],
    [result.found === true, `no host service webServer up in ${String(result.count)} messages`],
    [result.page === 200 && String(result.pageType ?? '').startsWith('text/html'), `page status ${String(result.page)}`],
    [result.postEmpty === 200 && result.postBad === 400, `post status ${String(result.postEmpty)},${String(result.postBad)}`],
    [result.postMixed === 400, `post mixed status ${String(result.postMixed)}`],
    [result.postGood === 200 && result.added === 2, `post good status ${String(result.postGood)} added ${String(result.added)}`],
    [result.leak === false, 'mixed batch added a message'],
    [result.echoMain === true && result.echoClient === true && result.echoSeq === true, `posted messages not in stream ${String(result.echoMain)},${String(result.echoClient)},${String(result.echoSeq)}`],
    [['host', 'main', 'client'].every((name) => Array.isArray(result.processes) && result.processes.includes(name)), `processes ${String(result.processes)}`],
    [Array.isArray(result.steps) && result.steps.length === 5, `main steps ${String(result.steps)}`],
    [Array.isArray(result.clientWindows) && result.clientWindows.length === 1 && result.clientWindows[0] === 'main', `client windows ${String(result.clientWindows)}`],
    [result.bootCount > 0 && Array.isArray(result.clientMissing) && result.clientMissing.length === 0, `client rows missing ${String(result.clientMissing?.length)} of ${String(result.bootCount)}: ${String(result.clientMissing?.[0])}`],
    [result.clientLoader === true, 'no client service loader up'],
  ]
  for (let index = 0; index < rules.length; index += 1) {
    if (rules[index][0]) continue
    if (typeof result.error === 'string' && result.error !== '' && index >= 3) return `error ${result.error}`
    return rules[index][1]
  }
  return undefined
}

async function checkTrace(page, deadline) {
  let reason = 'missing'
  while (Date.now() < deadline) {
    const tryDeadline = Math.min(deadline, Date.now() + 15_000)
    try {
      const value = await evaluate(page.webSocketDebuggerUrl, traceReadExpression(), tryDeadline, true)
      note(`trace try=${String(value)}`)
      if (typeof value === 'string') {
        const result = JSON.parse(value)
        const next = traceReason(result)
        if (next === undefined) return checkTracePage(deadline)
        reason = next
      }
    } catch (error) {
      note(`trace evaluate error=${error instanceof Error ? error.message : 'unknown'}`)
    }
    if (Date.now() >= deadline) break
    await delay(500)
  }
  return `trace: ${reason}`
}

function tracePageExpression() {
  return `JSON.stringify((() => {
  const rows = [...document.querySelectorAll('tr[data-trace-row]')].filter((row) => !row.dataset.name.startsWith('smoke-trace-'))
  const processes = [...new Set(rows.map((row) => row.dataset.process))]
  const opened = rows.some((row) => row.dataset.process === 'main' && row.dataset.kind === 'step'
    && row.dataset.name === 'trace-window-open' && row.textContent.includes('trace-window-open'))
  return { rows: rows.length, processes, opened }
})())`
}
async function checkTracePage(deadline) {
  let reason = 'no page dsh-app://app/trace'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${String(rendererPort)}/json/list`, { signal: AbortSignal.timeout(2000) })
      const targets = response.ok ? await response.json() : []
      const trace = Array.isArray(targets)
        ? targets.find((target) => target?.type === 'page' && target.url === 'dsh-app://app/trace' && typeof target.webSocketDebuggerUrl === 'string')
        : undefined
      if (trace !== undefined) {
        const result = JSON.parse(String(await evaluate(trace.webSocketDebuggerUrl, tracePageExpression(), Math.min(deadline, Date.now() + 5000))))
        note(`trace page=${JSON.stringify(result)}`)
        if (['main', 'host', 'client'].every((name) => result.processes.includes(name)) && result.opened === true) return undefined
        reason = `rows ${String(result.rows)} processes ${result.processes.join(',')} opened ${String(result.opened)}`
      }
    } catch (error) {
      note(`trace page error=${error instanceof Error ? error.message : 'unknown'}`)
    }
    await delay(500)
  }
  return `trace page: ${reason}`
}

function stripRowLine(line) {
  const hash = line.indexOf('#')
  return (hash === -1 ? line : line.slice(0, hash)).trim()
}

function readRowLists(folder) {
  const hostLines = readFileSync(join(folder, 'rows.host.txt'), 'utf8').split('\n').map(stripRowLine).filter((line) => line !== '')
  const client = new Set(readFileSync(join(folder, 'rows.client.txt'), 'utf8').split('\n').map(stripRowLine).filter((line) => line !== ''))
  const host = new Set()
  for (const line of hostLines) {
    const pending = /^(\S+) pending (\S+)$/.exec(line)
    if (pending !== null) {
      host.add(`${pending[1]}=pending(${pending[2]})`)
      continue
    }
    if (/^\S+$/.test(line)) {
      host.add(`${line}=active`)
      continue
    }
    return { bad: line, host, client }
  }
  return { host, client }
}

function isRootHostRow(row) {
  return row.id === 'include' && row.name === 'cordis:include'
}

function keptHostRows(rows) {
  return rows.filter((row) => !isRootHostRow(row) && row.disabled !== true)
}

function hostKey(row) {
  return typeof row.id === 'string' && row.id.startsWith('include:') ? row.optionsId : `name:${row.name}`
}

function stateWord(row) {
  const state = row.state
  if (state === 0) return `pending(${(row.missing ?? []).join(',')})`
  if (state === 1) return 'loading'
  if (state === 2) return 'active'
  if (state === 3) return 'failed'
  if (state === 4) return 'disposed'
  if (state === 5) return 'unloading'
  if (state === null) return 'nofiber'
  return `state${String(state)}`
}

function hostItem(row) {
  return `${hostKey(row)}=${stateWord(row)}`
}

function diffSets(actual, expected) {
  const extra = [...actual].filter((item) => !expected.has(item)).sort()
  const missing = [...expected].filter((item) => !actual.has(item)).sort()
  if (extra.length === 0 && missing.length === 0) return undefined
  const extraText = extra.length === 0 ? 'none' : extra.join(' ')
  const missingText = missing.length === 0 ? 'none' : missing.join(' ')
  return `extra ${extraText}, missing ${missingText}`
}

function compareHostSnapshot(file, folder) {
  const lists = readRowLists(folder)
  if (lists.bad !== undefined) return `rows list: bad line ${lists.bad}`
  const rows = JSON.parse(readFileSync(file, 'utf8'))
  if (!Array.isArray(rows)) return 'host rows: snapshot is not an array'
  const diff = diffSets(new Set(keptHostRows(rows).map((row) => hostItem(row))), lists.host)
  return diff === undefined ? undefined : `host rows: ${diff}`
}

function cdpSession(url, deadline) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const waiting = new Map()
    let next = 0
    const timer = setTimeout(() => {
      socket.close()
      for (const item of waiting.values()) item.reject(new Error('debugger timeout'))
      reject(new Error('debugger timeout'))
    }, Math.max(1, deadline - Date.now()))
    socket.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          next += 1
          const id = next
          socket.send(JSON.stringify({ id, method, params }))
          return new Promise((done, fail) => { waiting.set(id, { resolve: done, reject: fail }) })
        },
        close() {
          clearTimeout(timer)
          socket.close()
        },
      })
    })
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      const item = waiting.get(message.id)
      if (item === undefined) return
      waiting.delete(message.id)
      if (message.error) item.reject(new Error(message.error.message ?? 'cdp error'))
      else if (message.result?.exceptionDetails) {
        const details = message.result.exceptionDetails
        item.reject(new Error(details.exception?.description ?? details.text ?? 'evaluate failed'))
      }       else item.resolve(message.result)
    })
    socket.addEventListener('error', () => {
      clearTimeout(timer)
      for (const item of waiting.values()) item.reject(new Error('debugger connection failed'))
      reject(new Error('debugger connection failed'))
    })
  })
}

async function cdpCall(session, method, params) {
  try {
    return await session.send(method, params)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    throw new Error(`${method}: ${message}`)
  }
}

async function withHostLoader(deadline, run) {
  let targets
  try {
    const response = await fetch(`http://127.0.0.1:${String(hostInspectPort)}/json/list`, { signal: AbortSignal.timeout(3000) })
    if (!response.ok) throw new Error(`status ${String(response.status)}`)
    targets = await response.json()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    throw new Error(`GET /json/list: ${message}`)
  }
  if (!Array.isArray(targets) || typeof targets[0]?.webSocketDebuggerUrl !== 'string') {
    throw new Error('GET /json/list: no target')
  }
  const session = await cdpSession(targets[0].webSocketDebuggerUrl, deadline)
  try {
    const proto = await cdpCall(session, 'Runtime.evaluate', { expression: 'Function.prototype' })
    const protoId = proto?.result?.objectId
    if (typeof protoId !== 'string') throw new Error('Runtime.evaluate: no objectId')
    const functions = await cdpCall(session, 'Runtime.queryObjects', { prototypeObjectId: protoId })
    const functionId = functions?.objects?.objectId
    if (typeof functionId !== 'string') throw new Error('Runtime.queryObjects: no objectId')
    const loaderProto = await cdpCall(session, 'Runtime.callFunctionOn', {
      objectId: functionId,
      functionDeclaration: 'function () { const found = this.filter((fn) => fn.name === "Loader" && typeof fn.prototype?.showLog === "function" && typeof fn.prototype?.locate === "function"); if (found.length !== 1) throw new Error("Loader functions " + found.length); return found[0].prototype }',
    })
    const loaderProtoId = loaderProto?.result?.objectId
    if (typeof loaderProtoId !== 'string') throw new Error('Runtime.callFunctionOn: no Loader prototype')
    const loaders = await cdpCall(session, 'Runtime.queryObjects', { prototypeObjectId: loaderProtoId })
    const loaderId = loaders?.objects?.objectId
    if (typeof loaderId !== 'string') throw new Error('Runtime.queryObjects: no Loader objectId')
    return await run(session, loaderId)
  } finally {
    session.close()
  }
}

async function readHostSnapshot(deadline) {
  return withHostLoader(deadline, async (session, loaderId) => {
    const rows = await cdpCall(session, 'Runtime.callFunctionOn', {
      objectId: loaderId,
      returnByValue: true,
      functionDeclaration: 'function () { if (this.length !== 1) throw new Error("Loader instances " + this.length); const loader = this[0]; return [...loader.entries()].map((e) => { const state = e.fiber?.state ?? null; return { id: e.id, optionsId: e.options.id, name: e.options.name, disabled: e.disabled, state, missing: state === 0 ? Object.keys(e.fiber.inject).filter((service) => e.fiber.ctx.get(service) === undefined).sort() : [] } }) }',
    })
    if (!Array.isArray(rows?.result?.value)) throw new Error('Runtime.callFunctionOn: host rows are not an array')
    return rows.result.value
  })
}

async function checkInstall(deadline) {
  const fixture = process.env.DSH_SMOKE_INSTALL ?? ''
  if (fixture === '') return 'install: empty DSH_SMOKE_INSTALL'
  if (!existsSync(fixture)) return `install: missing fixture ${fixture}`
  const spec = fixture.startsWith('file:') || fixture.includes(':') ? fixture : `file:${fixture}`
  const started = Date.now()
  const result = await withHostLoader(deadline, async (session, loaderId) => {
    const call = await cdpCall(session, 'Runtime.callFunctionOn', {
      objectId: loaderId,
      awaitPromise: true,
      returnByValue: true,
      arguments: [{ value: spec }],
      functionDeclaration: `async function (spec) {
        if (this.length !== 1) throw new Error("Loader instances " + this.length);
        const loader = this[0];
        const manager = loader.ctx?.get?.("pluginManager") ?? loader.ctx?.pluginManager;
        if (manager === undefined || typeof manager.installBundle !== "function") {
          throw new Error("no pluginManager on Loader ctx");
        }
        const install = await manager.installBundle(spec);
        const marker = loader.ctx?.get?.("widgetRowsInstallMarker");
        return { install, marker: marker === undefined ? null : marker };
      }`,
    })
    if (call?.exceptionDetails) {
      const text = call.exceptionDetails.exception?.description
        ?? call.exceptionDetails.text
        ?? 'install call failed'
      throw new Error(String(text))
    }
    return call?.result?.value
  })
  note(`install ms=${String(Date.now() - started)} result=${JSON.stringify(result)}`)
  const install = result?.install
  if (install === undefined || typeof install !== 'object' || install === null) {
    return `install: bad result ${JSON.stringify(result)}`
  }
  if (install.application !== 'applied') {
    return `install: want applied got ${JSON.stringify(install)}`
  }
  if (result.marker !== 'ran') {
    return `install: plugin did not run marker=${JSON.stringify(result.marker)}`
  }
  return undefined
}

async function readClientRows(page, deadline) {
  let ids = []
  while (Date.now() < deadline) {
    try {
      const value = await evaluate(page.webSocketDebuggerUrl,
        'JSON.stringify((window.__DSH_BOOT__?.entries ?? []).map((entry) => entry.id))', deadline)
      const parsed = JSON.parse(String(value))
      if (Array.isArray(parsed)) {
        ids = parsed.map((id) => String(id))
        if (ids.length > 0) return ids
      }
    } catch (error) {
      note(`client rows error=${error instanceof Error ? error.message : 'unknown'}`)
    }
    if (Date.now() >= deadline) break
    await delay(250)
  }
  return ids
}

async function checkRows(page, deadline) {
  const lists = readRowLists(process.env.DSH_SMOKE_ROWS ?? '')
  if (lists.bad !== undefined) return `rows list: bad line ${lists.bad}`
  let rows
  let unsettled = []
  do {
    const started = Date.now()
    rows = await readHostSnapshot(deadline)
    note(`host rows read ms=${String(Date.now() - started)} count=${String(rows.length)}`)
    unsettled = keptHostRows(rows).filter((row) => row.state === 1 || row.state === 5)
    if (unsettled.length === 0 || Date.now() >= deadline) break
    await delay(500)
  } while (Date.now() < deadline)
  const save = process.env.DSH_SMOKE_ROWS_SAVE ?? ''
  if (save !== '') writeFileSync(save, JSON.stringify(rows))
  if (unsettled.length > 0) return `host rows: not settled ${unsettled.map((row) => hostItem(row)).sort().join(' ')}`
  const hostActual = new Set(keptHostRows(rows).map((row) => hostItem(row)))
  const client = await readClientRows(page, deadline)
  note(`host rows=${[...hostActual].sort().join(' ')}`)
  note(`client rows=${[...client].sort().join(' ')}`)
  const hostDiff = diffSets(hostActual, lists.host)
  if (hostDiff !== undefined) return `host rows: ${hostDiff}`
  const clientDiff = diffSets(new Set(client), lists.client)
  if (clientDiff !== undefined) return `client rows: ${clientDiff}`
  return undefined
}
