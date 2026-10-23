/**
 * Boot the unpackaged desktop app and check that the main renderer and host answer.
 * Uses only Node built-in modules. Prints one result line.
 */

import { spawn, execFile } from 'node:child_process'
import { appendFileSync, existsSync, openSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

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

const temp = await mkdtemp(join(tmpdir(), 'deepwidgets-smoke-desktop-'))
const home = join(temp, 'home')
const userData = join(temp, 'user-data')
const logPath = join(temp, 'desktop.log')
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
  const watcher = spawn(python, ['-c', groupWatcherSource, file], {
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
          const match = pages.find((target) => target.url.startsWith('dsh-app://app/'))
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

function evaluate(url, expression, deadline) {
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
        params: { expression, returnByValue: true },
      }))
    })
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      if (message.id !== id) return
      clearTimeout(timer)
      socket.close()
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
    const match = pages.find((target) => target.url.startsWith('dsh-app://app/') && typeof target.webSocketDebuggerUrl === 'string')
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
      const listeners = await capture('lsof', ['-a', '-p', pid, '-iTCP', '-sTCP:LISTEN', '-nP'])
      const ports = listenPorts(listeners.stdout).filter((port) => port !== hostInspectPort)
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
