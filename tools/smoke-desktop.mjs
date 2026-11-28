/**
 * Boot the unpackaged desktop app and check that the main renderer and host answer.
 * With DSH_SMOKE_PROBE=1, also check that the renderer shows the host process id.
 * With DSH_SMOKE_TRACE=1, also read /api/trace from the main window and check the trace test.
 * With DSH_SMOKE_HELLO=1, also check that the main window shows hello and that no welcome window opened.
 * With DSH_SMOKE_ROWS set to a folder, also compare the loaded rows with the row lists in that folder.
 * With DSH_SMOKE_ROWS_SAVE set to a path, also write the host row snapshot to that file.
 * With DSH_SMOKE_ROWS_SNAPSHOT set to a path, compare that host snapshot with rows.host.txt and do not start the app.
 * With DSH_SMOKE_INSTALL set to a local bundle path, also call pluginManager.installBundle over the host Loader.
 * With DSH_SMOKE_WIDGET set to a widget slug, the check finds the widget window at the widget origin of the slug,
 * dsh-app://w-<slug>.widget/widget/?slug=<slug> (agent_library.serving).
 * It finds the count in that page, posts add from the main window, and finds the new count in the page.
 * Then it writes a new program with ctx.widgets.setProgram over the host Loader and finds its text in the page.
 * Then it registers a second widget over the Loader, loads its page (with a bar chart of two bars), ends the
 * registration, and checks that the page shows the removed state and does not open its stream again.
 * With DSH_SMOKE_CREATE set to a widget source folder (src/index.ts), an MCP client does the token
 * handshake with the proof of mcp.json, installs the folder with widget_install, finds the window of
 * its slug, removes it with widget_remove, and finds the window closed (widget.creation).
 * When the folder has page/, the install answer must have the render check gate (page-render) with no skipped warning,
 * and the built page in the profile (agent_library.build_gate). With DSH_SMOKE_CREATE_CASES set to a JSON file of
 * render cases [{ dir, refuse?: <code>, nextStep?: <text>, warnings?: [<text>], shows?: <text> }], each case installs
 * first, in order: a case with `refuse` must fail in the gate page-render with a diagnostic that starts with that code,
 * and with `nextStep` in its next step. A case with `warnings` must install with each text in its warnings. A case
 * with `shows` must install, and its window must show the page with that text in its `[data-dw=note]` element
 * (agent_library.guide). The check then removes an installed case.
 * With DSH_SMOKE_LOG=1, the check makes the folder $DSH_HOME/deepwidgets read-only and asks the MCP port for a token.
 * The answer must be 500, and the output of the app must have the ctx.logger line of @deepwidgets/mcp (safe_host.log).
 * With DSH_SMOKE_MAIN=1, the check reads the menu bar of Electron main (main_widget.menu_bar, main_widget.panel). The
 * Dock has no icon: lsappinfo lists Electron main as a UIElement app, and app.dock.isVisible() is false, at the start and
 * after the panel opened. The menu bar icon exists, and its menu has "Open deepWidgets" and "Quit deepWidgets". A
 * programmatic click on the icon opens the panel of 420 by 600 under the icon, on all Spaces, with focus, on the page
 * dsh-app://w-main.widget/widget/main.html?slug=main (main_widget.widget). In that page, the page checks of main.page
 * run: a row for sample with its state rev, and no row for main. A state write of sample over the host Loader must
 * change the rev in that row: the stream of main carries each change of another widget (main_widget.widgets). The row
 * of sample opens with its state viewer, Turn off, and no Remove. Turn off and Turn on in the page change its status.
 * Hide in the row hides the window of sample, and the row shows Hidden. Show shows the window again (main_widget.window_state).
 * Then a second click closes the panel, another app comes in front (lsappinfo front), and the window of sample still
 * shows. "Open deepWidgets" opens it, a new window that takes the focus closes it, and a
 * second launch of the dev app (its launcher HarnessDev) exits by itself and opens it. The check saves screenshots with
 * webContents.capturePage(): $TMPDIR/deepwidgets-main-page/main-page.png, main-page-state.png with the state of sample
 * open, and $TMPDIR/deepwidgets-app-menu-bar/panel.png.
 * With the page open, 100 writes of sample in a row take at most 3 times the time with no page of main (the panel shows
 * about:blank for that baseline), a burst of 100 parallel writes gives no failure, and the page refreshes at most once
 * for each 250 ms of writes (fanout_query_blocks_writes). A switch to Settings and back keeps the row of sample open.
 * Then the page loads again with a wrapper of EventSource: the check cuts the stream of main, writes sample while it is
 * down, and opens it again. The row must show the new rev from the `data` frame after the `hello` of main.
 * Then the Settings tab (main_widget.settings) shows the MCP modes with interact always on, the note of the approved
 * agents, the port and the path of mcp.json with copy buttons, and the launch-at-login switch off and disabled with its
 * note. A set of the login item through main refuses with dev-run, Electron main calls no setLoginItemSettings, and
 * macOS has no login item for the dev app. The switch of create turns create off: widget_install gives mode-off, and
 * settings.json has "create": false. On again, the install works. The check saves
 * $TMPDIR/deepwidgets-main-settings/settings.png. Another live process holds the lock of the kit when the app starts.
 * While the kit start waits for it, the section "Widget kit" (kit.pane.view) shows the status starting, and its controls
 * are off. Then the holder ends, and the page must show ready within 5 s after the start ends, with 8 core rows and a
 * lock mark on each. An add of date-fns@^4 through the page shows the change, then the row of date-fns. While an add
 * runs, the controls are off, also the Remove button of date-fns. Remove takes the row of date-fns away. These changes
 * run pnpm online. The check saves settings-kit.png in the same folder.
 * Before the second launch, the hidden panel shows the Settings tab, and the second launch must open it on the Widgets
 * tab.
 * During these page checks the panel does not hide on a loss of focus, so another app on the Mac can not close it.
 * With DSH_SMOKE_OLD_PROFILE=1, the run starts with the desktop profile of the web template before main.runtime, which
 * has no @deepwidgets/widget-main. The boot must add it in its template place and log the change. Run it with
 * DSH_SMOKE_MAIN=1, so the panel must also show the main widget.
 * With DSH_SMOKE_WINDOWS=1, the check finds one window at dsh-app://w-sample.widget/widget/?slug=sample, and no
 * floating window for main. The action hide of main hides the window of sample (main_widget.window_state). The check
 * kills the host, and after the hello of the new host the window is still hidden. Turn off and Turn on give sample a
 * new window, and it stays hidden. The action show shows it again.
 * It turns the sample row off through the host plugin manager and finds that window closed.
 * With DSH_SMOKE_WM=1, the check reads the bar of the window of sample (window_manager.bar, window_manager.move). The
 * window has a bar view over its page, in another renderer, and does not resize. The hover hook of the check replaces
 * the mouse reader of the bars in Electron main. With the hook point outside each window, the bar is hidden. With the
 * hook point in the window, the bar shows. Clicks in the bar view (mouse events of webContents.sendInputEvent) work
 * the buttons: the lock button makes isMovable() false, then true again. The layer button makes isAlwaysOnTop() and
 * isVisibleOnAllWorkspaces() false, then true again, and it does not move the window, also with the lock on. The Host
 * gets each choice: the next frame has it (wm.store). A drag on the handle (mouse down and up in the bar view, with the
 * hook point moved between them) moves the window by the move of the hook point, and the Host stores the position.
 * With the lock on, the same drag does not move it. A drag to the top edge of the display stores the position that
 * getPosition() gives, not the asked point. After a reset of the position through the route, a press and a release on
 * the handle with no move store no position. A position, the layer normal, and the lock from the bar stay through Turn
 * off and Turn on: the new window of sample has them. The check kills the host and clicks the layer button in the gap:
 * the choice waits in Electron main, reaches the next host, and the hello of that host does not undo it. A script in
 * the page of sample finds no bar element, and its call of /api/widget-windows/sample gets 404.
 * With DSH_SMOKE_HOST_RESTART=1, the check kills the host once. The sample widget page must be live again
 * (count readable, an add shows, its stream did not close), and the main window must load again for the new host.
 * Then it kills the host again and quits the app while the restart waits; the app must exit with no kill.
 * With DSH_SMOKE_HOST_RESTART=give-up, the check installs a widget bundle that is not built in, then kills the host 4 times.
 * The second restart must be in safe mode: sample stays live, the installed widget is off with reason safe-mode,
 * and a plugin-manager enable does not turn it on. Then it installs a bundle with the package name of the sample;
 * after the third restart (safe mode), that bundle's widget must be off with reason safe-mode.
 * The fourth crash must open the fatal dialog, with no restart.
 * With DSH_SMOKE_HOST_RESTART=boot, the check kills the host as soon as it is first ready, while the main window boots.
 * The host must restart, and the main window must show the probe pid of the new host.
 * Each run sets DEEPWIDGETS_LOGS_DIR, so the crash reports of the app stay in the temp folder of the run.
 * With DSH_SMOKE_HOST_RESTART=blame, the check installs the fixture deepwidgets/widgets/fixtures/blame-timer, whose
 * timer throws 1 s after it loads. The host must restart, the blame-timer window must show failed with the reason,
 * and the sample page must stay live, with no safe mode and no second crash. Then the check changes a file of the
 * installed fixture and kills the host: blame-timer must come back (`widget.isolation_blame`).
 * With DSH_SMOKE_HOST_RESTART=mcp-port, the check uses the MCP port of Electron main (`safe_host.port`). mcp.json has mode 0600. It names
 * the port of Electron main (DEEPWIDGETS_MCP_PORT when it is not 0) and the pid of Electron main, not the host. A bridge
 * (the handshake of deepwidgets/mcp/README.md, which reads mcp.json again at each handshake) lists the tools through
 * Electron main. A request with Origin, with Sec-Fetch-Site, or with a Host that is not loopback gets 403 from Electron
 * main, and a request straight to the host port gets 403 from the host. Then the check kills the host. In the gap, each
 * request gets 503 with Retry-After: 1 from Electron main, then 200. A 502 may come only for a request that started
 * before Electron main saw the host exit: its connect reached the dying host, so it may have run. After the restart, mcp.json has the same port and
 * pid and a new nonce, and the bridge reconnects with a new handshake.
 * With DSH_SMOKE_HOST_RESTART=watchdog, the check installs the fixtures deepwidgets/widgets/fixtures/watchdog-host and
 * watchdog-widget. A 150 MB JSON.parse in host code must not end the host. Then the watchdog widget loops in an
 * action: the host must die within 2.5 s and come back, the watchdog window must show failed with the reason, and the
 * sample page must stay live, with no safe mode and no second crash (`widget.isolation_watchdog`).
 * The trace test also needs the start-up steps of Electron main and a message for each client row.
 * Then it reads the rows of the trace window page dsh-app://app/trace.
 * Uses only Node built-in modules. Prints one result line.
 */

import { spawn, execFile } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { appendFileSync, chmodSync, cpSync, existsSync, openSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { linuxGroupWatcherSource, linuxListenPorts } from './smoke-desktop-linux.mjs'
import { pinnedExpression, pinnedFunction } from './in-host.mjs'

const root = join(import.meta.dirname, '..')
const timeoutMs = positiveInteger(process.env.DSH_SMOKE_TIMEOUT_MS, 240_000)
/** The error line of `issueToken` in deepwidgets/mcp/src/index.ts, as the console exporter prints it. Same pattern as tools/host-log.mjs. */
const TOKEN_LOG_LINE = /\[E\] .*mcp: the token file \S+mcp-tokens\.json was not written; no token was issued/u
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
/** The slug of the widget of deepwidgets/widgets/fixtures/built-in-name-widget, a bundle named @deepwidgets/widget-sample. */
const NAME_WIDGET = 'built-in-name-test'
/** The panel URL of the main widget (main_widget.widget): the second shell entry on the widget origin of main. */
const MAIN_PAGE_URL = 'dsh-app://w-main.widget/widget/main.html?slug=main'
/** The folder of the screenshots of DSH_SMOKE_MAIN. */
const MAIN_SHOTS = join(tmpdir(), 'deepwidgets-main-page')
/** The folder of the screenshot of the open panel of DSH_SMOKE_MAIN (main_widget.panel). */
const PANEL_SHOTS = join(tmpdir(), 'deepwidgets-app-menu-bar')
/** The folder of the screenshot of the Settings tab of DSH_SMOKE_MAIN (main_widget.settings). */
const SETTINGS_SHOTS = join(tmpdir(), 'deepwidgets-main-settings')
await mkdir(home)
await mkdir(userData)
openSync(logPath, 'a')
/** The web template before main.runtime: a desktop profile of that time has no @deepwidgets/widget-main. */
const OLD_PROFILE_BUNDLES = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepwidgets/probe', '@deepwidgets/trace', '@deepwidgets/widgets', '@deepwidgets/widget-sample', '@deepwidgets/mcp', '@deepwidgets/trim']
/** The web template of today, in its order (packages/util/official-bundles/src/bundles.ts). */
const PROFILE_BUNDLES = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepwidgets/probe', '@deepwidgets/trace', '@deepwidgets/widgets', '@deepwidgets/widget-sample', '@deepwidgets/widget-main', '@deepwidgets/kit', '@deepwidgets/mcp', '@deepwidgets/trim']
const desktopProfile = join(home, 'profiles', 'desktop')
if (process.env.DSH_SMOKE_OLD_PROFILE === '1') {
  // The manifest that createPluginProfile wrote for a profile made before main.runtime.
  await mkdir(desktopProfile, { recursive: true })
  writeFileSync(join(desktopProfile, 'package.json'), `${JSON.stringify({ name: 'dsh-profile-desktop', private: true, dependencies: {}, dsh: { profile: { bundles: OLD_PROFILE_BUNDLES } } }, undefined, 2)}\n`)
}

/**
 * kit.pane.actions: with DSH_SMOKE_MAIN=1, another live process holds the lock of the kit when the app starts. The kit
 * start of the host waits for it, so the panel page opens while the kit status is starting. checkMainKit ends the
 * holder, and the page must then read the end of the start by itself.
 */
let kitLockHolder
if (process.env.DSH_SMOKE_MAIN === '1') {
  const kitDir = join(home, 'deepwidgets', 'kit')
  await mkdir(kitDir, { recursive: true })
  kitLockHolder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 900_000)'], { stdio: 'ignore' })
  writeFileSync(join(kitDir, 'current.lock'), `${String(kitLockHolder.pid)}\n`)
}

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
  if (kitLockHolder !== undefined && kitLockHolder.exitCode === null) kitLockHolder.kill('SIGKILL')
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
/** The environment of the app, also of the second launch of DSH_SMOKE_MAIN. */
const appEnv = {
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
}
const child = spawn('corepack', ['pnpm', 'run', 'start:desktop'], {
  cwd: root,
  detached: true,
  stdio: ['ignore', logFd, logFd],
  env: appEnv,
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
/** The port of the host web server, as waitForHost found it. */
let hostHttpPort
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
        if (failed === undefined && process.env.DSH_SMOKE_OLD_PROFILE === '1') failed = checkOldProfile()
        if (failed === undefined && process.env.DSH_SMOKE_PROBE === '1') failed = await checkProbe(page, deadline)
        if (failed === undefined && process.env.DSH_SMOKE_TRACE === '1') failed = await checkTrace(page, deadline)
        if (failed === undefined && process.env.DSH_SMOKE_HELLO === '1') failed = await checkHello(page, deadline)
        if (failed === undefined && (process.env.DSH_SMOKE_ROWS ?? '') !== '') failed = await checkRows(page, deadline)
        if (failed === undefined && (process.env.DSH_SMOKE_INSTALL ?? '') !== '') failed = await checkInstall(deadline)
        if (failed === undefined && (process.env.DSH_SMOKE_WIDGET ?? '') !== '') failed = await checkWidget(page, deadline)
        if (failed === undefined && process.env.DSH_SMOKE_WM === '1') failed = await checkWm(deadline)
        // Before the windows check: that check ends with the sample row off, and this one needs the sample window.
        if (failed === undefined && process.env.DSH_SMOKE_MAIN === '1') failed = await checkMain(deadline)
        if (failed === undefined && process.env.DSH_SMOKE_WINDOWS === '1') failed = await checkWindows(deadline)
        if (failed === undefined && process.env.DSH_SMOKE_HOST_RESTART === '1') failed = await checkHostRestart(page, deadline)
        if (failed === undefined && process.env.DSH_SMOKE_HOST_RESTART === 'give-up') failed = await checkHostGiveUp(deadline)
        if (failed === undefined && process.env.DSH_SMOKE_HOST_RESTART === 'blame') failed = await checkHostBlame(deadline)
        if (failed === undefined && process.env.DSH_SMOKE_HOST_RESTART === 'watchdog') failed = await checkHostWatchdog(deadline)
        if (failed === undefined && process.env.DSH_SMOKE_HOST_RESTART === 'mcp-port') failed = await checkMcpPortOwner(deadline)
        if (failed === undefined && (process.env.DSH_SMOKE_CREATE ?? '') !== '') failed = await checkCreate(deadline)
        if (failed === undefined && process.env.DSH_SMOKE_LOG === '1') failed = await checkLog(deadline)
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
        params: { expression: awaitPromise ? pinnedExpression(expression) : expression, returnByValue: true, awaitPromise },
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
          hostHttpPort = port
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
      functionDeclaration: pinnedFunction(`async function (...args) {
        if (this.length !== 1) throw new Error("Loader instances " + this.length);
        const widgets = this[0].ctx?.get?.("widgets");
        if (widgets === undefined) throw new Error("no widgets service on Loader ctx");
        return (${declaration})(widgets, ...args);
      }`),
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

/**
 * The window URL of a slug on its widget origin (`agent_library.serving`, `apps/desktop/src/deepwidgets-origin.ts`):
 * `shell` for the shared shell, `page` for the built page of the slug, `failed` for the shell with the notice.
 */
function widgetUrl(slug, mode = 'shell') {
  const origin = `dsh-app://w-${slug}.widget`
  const query = `?slug=${encodeURIComponent(slug)}`
  if (mode === 'page') return `${origin}/widget/${slug}/${query}`
  return `${origin}/widget/${query}${mode === 'failed' ? '&page=failed' : ''}`
}

async function findWidgetPage(slug, deadline, mode = 'shell') {
  const url = widgetUrl(slug, mode)
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
      functionDeclaration: pinnedFunction(`async function (moduleName, enabled) {
        if (this.length !== 1) throw new Error("Loader instances " + this.length);
        const loader = this[0];
        const manager = loader.ctx?.get?.("pluginManager") ?? loader.ctx?.pluginManager;
        if (manager === undefined || typeof manager.setPluginEnabled !== "function") throw new Error("no pluginManager on Loader ctx");
        const rows = (await manager.listPlugins()).filter((row) => row.moduleName === moduleName);
        if (rows.length !== 1) throw new Error("plugin rows for " + moduleName + ": " + rows.length);
        // The inspector call can inherit the hmr transaction store of host work in flight; leave it, as hmr.watchConfig does.
        const hmr = loader.ctx?.get?.("hmr");
        const change = () => manager.setPluginEnabled(rows[0].entryId, enabled);
        return await (hmr === undefined ? change() : hmr.executing.exit(change));
      }`),
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
  return withMainInstance('DesktopWidgetWindows', 'hostReady', deadline, declaration)
}

/**
 * Run `declaration` with `this` set to the one DesktopMenuBar instance of Electron main (main_widget.menu_bar):
 * its `tray`, `contextMenu`, `panel`, and `open()`.
 */
async function withMenuBar(deadline, declaration) {
  return withMainInstance('DesktopMenuBar', 'open', deadline, declaration)
}

/**
 * Run `declaration` with `this` set to the one instance of the class `className` of Electron main, over the main
 * inspector. The class must have the prototype method `method`.
 */
async function withMainInstance(className, method, deadline, declaration) {
  const targets = await (await fetch(`http://127.0.0.1:${String(mainInspectPort)}/json/list`, { signal: AbortSignal.timeout(3000) })).json()
  if (!Array.isArray(targets) || typeof targets[0]?.webSocketDebuggerUrl !== 'string') throw new Error('main /json/list: no target')
  const session = await cdpSession(targets[0].webSocketDebuggerUrl, deadline)
  const name = JSON.stringify(className)
  try {
    const proto = await cdpCall(session, 'Runtime.evaluate', { expression: 'Function.prototype' })
    const functions = await cdpCall(session, 'Runtime.queryObjects', { prototypeObjectId: proto?.result?.objectId })
    const classProto = await cdpCall(session, 'Runtime.callFunctionOn', {
      objectId: functions?.objects?.objectId,
      functionDeclaration: `function () { const found = this.filter((fn) => fn.name === ${name} && typeof fn.prototype?.[${JSON.stringify(method)}] === "function"); if (found.length !== 1) throw new Error(${name} + " classes " + found.length); return found[0].prototype }`,
    })
    if (typeof classProto?.result?.objectId !== 'string') throw new Error(`main: no ${className} prototype`)
    const instances = await cdpCall(session, 'Runtime.queryObjects', { prototypeObjectId: classProto.result.objectId })
    const call = await cdpCall(session, 'Runtime.callFunctionOn', {
      objectId: instances?.objects?.objectId,
      awaitPromise: true,
      returnByValue: true,
      functionDeclaration: pinnedFunction(`function () { if (this.length !== 1) throw new Error(${name} + " instances " + this.length); return (${declaration}).call(this[0]) }`),
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

/** Call the action Show or Hide of main for `slug` in the host, as the row control of the page does. Gives the result. */
async function mainWindowAction(action, slug, deadline) {
  const out = await hostWidgets(deadline, `async (widgets, action, slug) => widgets.call('main', action, { slug }, { caller: 'smoke-windows' })`, [action, slug])
  note(`windows main ${action} ${slug}=${JSON.stringify(out?.result)}`)
  return out?.result
}

/**
 * main_widget.window_state: the action Hide of main hides the window of sample. After a kill of the host, the hello of
 * the new host keeps it hidden: the host stored the choice. Show brings it back.
 */
async function checkWindowState(deadline) {
  const soon = () => Math.min(deadline, Date.now() + 15_000)
  const hidden = await mainWindowAction('hide', 'sample', deadline)
  if (hidden?.ok !== true || hidden.window !== 'hidden') return `windows: the action hide of main did not hide sample: ${JSON.stringify(hidden)}`
  let shown = await waitWindowShown('sample', false, soon())
  if (shown !== false) return `windows: after hide, the window of sample ${shown === null ? 'is gone' : 'still shows'}`
  const hellos = await withWidgetWindows(deadline, countHellos())
  const kill = await killHost('windows')
  const until = Math.min(deadline, Date.now() + 60_000)
  if (!await waitForNewHost(kill.pid, until)) return 'windows: no new host after the kill'
  const failed = await waitHello(hellos, until)
  if (failed !== undefined) return failed
  // The hello of the new host gave the shown state. A host that did not store it says shown, and the window shows.
  shown = await windowShown('sample', deadline)
  await delay(1000)
  const later = await windowShown('sample', deadline)
  note(`windows after the host restart: new host=${String(hostPid)} sample shown=${String(shown)} 1 s later=${String(later)}`)
  if (shown !== false || later !== false) return `windows: after a host restart, the window of sample is not hidden (${String(shown)}, then ${String(later)})`
  // checks_miss_new_hidden_window: Turn off and Turn on give sample a new window. Its `added` frame says hidden, so the
  // new window loads and does not show.
  for (const enabled of [false, true]) {
    const turned = await setSample(enabled, deadline)
    if (turned !== undefined) return turned
  }
  let fresh = null
  for (const until = soon(); Date.now() < until && fresh === null; await delay(200)) fresh = await windowShown('sample', deadline)
  await delay(3000)
  const freshLater = await windowShown('sample', deadline)
  note(`windows after Turn off and Turn on: sample shown=${String(fresh)} 3 s later=${String(freshLater)}`)
  if (fresh !== false || freshLater !== false) return `windows: after Turn off and Turn on, the new window of hidden sample is not hidden (${String(fresh)}, then ${String(freshLater)})`
  const back = await mainWindowAction('show', 'sample', deadline)
  if (back?.ok !== true || back.window !== 'shown') return `windows: the action show of main did not show sample: ${JSON.stringify(back)}`
  shown = await waitWindowShown('sample', true, soon())
  return shown === true ? undefined : `windows: after show, the window of sample does not show (${String(shown)})`
}

async function checkWindows(deadline) {
  const url = widgetUrl('sample')
  const soon = () => Math.min(deadline, Date.now() + 15_000)
  let failed = await waitPages(url, 1, deadline, 'first open')
  if (failed !== undefined) return failed
  // main_widget.widget: Electron main opens no floating window for main. The panel is its only window, at main.html.
  const mainWindow = await withWidgetWindows(deadline, "function () { return this.windows.has('main') }")
  const mainPages = [await countPages(widgetUrl('main')), await countPages(widgetUrl('main', 'page'))]
  note(`windows main: window=${String(mainWindow)} pages=${JSON.stringify(mainPages)}`)
  if (mainWindow !== false || mainPages[0] !== 0 || mainPages[1] !== 0) return `windows: Electron main opened a floating window for main: ${JSON.stringify({ mainWindow, mainPages })}`
  failed = await checkWindowState(deadline)
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

/**
 * Run `body` in Electron main for the window of sample (window_manager.bar), in one inspector call: each call finds the
 * instance with Runtime.queryObjects, which is slow. The body gets these helpers:
 * `read()` gives the window and its bar; `home` is the default position for the row of the window, for both layers
 * (window_manager.provisional), and `dragging` is true while a drag of the handle lasts. `host` is the window data of
 * sample in the last frame of the Host, with `position: null` for none, and `pending` the choices that wait for the Host.
 * `until(test, ms)` polls `read()` every 50 ms. `hover(point)` is the hover hook: the mouse reader of the bars gives
 * `point`. `input(events)` sends mouse events to the bar view with webContents.sendInputEvent. `rect(name)` gives the
 * client rectangle of one control of the bar, from a script in the bar view. `click(name)` puts the hook point in the
 * window, waits for the bar, and sends a mouse down and up at the center of the control. `drag(delta)` puts the hook
 * point on the handle, sends a mouse down, moves the hook point by `delta`, and sends a mouse up. `post(change)` sends
 * one change to POST /api/widget-windows/sample with the Host cookie of Electron main, as the bar does.
 */
function wmMain(deadline, body) {
  return withWidgetWindows(deadline, `async function () {
    const entry = this.windows.get('sample')
    if (entry === undefined || entry.window.isDestroyed()) return { error: 'sample has no window' }
    const { window, bar } = entry
    const contents = bar.view.webContents
    const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })
    const read = () => {
      const data = this.data.get('sample')
      const host = this.host.get('sample')
      const children = window.contentView.children
      return {
        visible: window.isVisible(), loaded: entry.loaded === true,
        barView: children.includes(bar.view) && children.at(-1) === bar.view, barShown: bar.view.getVisible(),
        barLoaded: !contents.isLoading() && contents.getURL().startsWith('data:text/html'),
        ownRenderer: contents.getOSProcessId() !== window.webContents.getOSProcessId(),
        bounds: window.getBounds(), barBounds: bar.view.getBounds(),
        movable: window.isMovable(), top: window.isAlwaysOnTop(), resizable: window.isResizable(),
        allSpaces: window.isVisibleOnAllWorkspaces(),
        home: this.placeOf({ ...data, position: undefined }, entry.row),
        // The top of the work area of the primary display: the default position of row 0 is 16 points below it.
        areaTop: this.placeOf({ ...data, position: undefined, height: 1 }, 0).y - 16,
        dragging: this.bars.dragging('sample'),
        host: host === undefined ? null : { ...host, position: host.position ?? null },
        pending: this.pending.get('sample') ?? null,
      }
    }
    const post = async (change) => {
      const answer = await fetch(new URL('/api/widget-windows/sample', this.target.url), {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: this.target.cookie }, body: JSON.stringify(change),
      })
      return { status: answer.status, body: await answer.json().catch(() => null) }
    }
    const until = async (test, ms) => {
      const end = Date.now() + ms
      for (;;) {
        const value = read()
        if (test(value)) return { ok: true, value }
        if (Date.now() > end) return { ok: false, value }
        await sleep(50)
      }
    }
    const hover = (point) => {
      if (this.__smokeCursor === undefined) this.__smokeCursor = this.bars.cursorPoint
      this.bars.cursorPoint = () => point
    }
    const input = (events) => { for (const event of events) contents.sendInputEvent(event) }
    const rect = async (name) => JSON.parse(await contents.executeJavaScript('JSON.stringify(document.querySelector(\\'[data-bar="' + name + '"]\\')?.getBoundingClientRect() ?? null)'))
    const hoverWindow = async () => {
      const { bounds } = read()
      hover({ x: bounds.x + Math.round(bounds.width / 2), y: bounds.y + Math.round(bounds.height / 2) })
      return until((wm) => wm.barShown, 5000)
    }
    const click = async (name) => {
      if (!(await hoverWindow()).ok) return 'the bar does not show with the hook point in the window'
      const box = await rect(name)
      if (box === null) return 'the bar has no control ' + name
      const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) }
      input([{ type: 'mouseMove', ...point }, { type: 'mouseDown', ...point, button: 'left', clickCount: 1 }, { type: 'mouseUp', ...point, button: 'left', clickCount: 1 }])
      return undefined
    }
    const drag = async (delta) => {
      const hovered = await hoverWindow()
      if (!hovered.ok) return 'the bar does not show with the hook point in the window'
      const box = await rect('handle')
      if (box === null) return 'the bar has no handle'
      const local = { x: Math.round(box.x + 20), y: Math.round(box.y + box.height / 2) }
      const before = hovered.value.bounds
      const start = { x: before.x + local.x, y: before.y + local.y }
      hover(start)
      input([{ type: 'mouseMove', ...local }, { type: 'mouseDown', ...local, button: 'left', clickCount: 1 }])
      // Electron main reads the hook point when the drag starts. Move the point only after that, or after 1 s.
      const started = await until((wm) => wm.dragging, 1000)
      hover({ x: start.x + delta.x, y: start.y + delta.y })
      input([{ type: 'mouseMove', ...local, modifiers: ['leftButtonDown'] }])
      await sleep(300)
      input([{ type: 'mouseUp', ...local, button: 'left', clickCount: 1 }])
      const ended = await until((wm) => !wm.dragging, 3000)
      await sleep(200)
      return { before, after: read().bounds, started: started.ok, ended: ended.ok }
    }
    ${body}
  }`)
}

/** Put the real mouse reader of the bars back. */
function wmUnhover() {
  return 'function () { if (this.__smokeCursor !== undefined) this.bars.cursorPoint = this.__smokeCursor; delete this.__smokeCursor; return true }'
}

/** The checks of DSH_SMOKE_WM (window_manager.bar, window_manager.move). */
async function checkWm(deadline) {
  try {
    return await checkWmSteps(deadline)
  } finally {
    await withWidgetWindows(deadline, wmUnhover()).catch(() => undefined)
  }
}

async function checkWmSteps(deadline) {
  // The window of sample opens after the hello frame of the host, which can come after the host is ready.
  let ready
  for (const until = Math.min(deadline, Date.now() + 60_000); Date.now() < until; await delay(500)) {
    ready = await wmMain(deadline, 'return until((wm) => wm.visible && wm.loaded && wm.barLoaded, 10000)')
    if (ready?.ok === true) break
  }
  if (ready?.ok !== true) return `wm: the window of sample with its bar did not load: ${JSON.stringify(ready)}`
  // The hook point outside each window: the bar must be hidden. The real mouse can be anywhere.
  const start = await wmMain(deadline, 'hover({ x: -100000, y: -100000 }); await sleep(500); return read()')
  note(`wm start: ${JSON.stringify(start)}`)
  if (start?.barView !== true) return `wm: the window of sample has no bar view over its page: ${JSON.stringify(start)}`
  if (!start.ownRenderer) return 'wm: the bar view shares the renderer of the page'
  if (start.barShown) return 'wm: the bar shows with the mouse outside the window'
  if (start.barBounds.height !== 24 || start.barBounds.width !== start.bounds.width || start.barBounds.x !== 0 || start.barBounds.y !== 0) {
    return `wm: the bar is not 24 points high at the top of the window: ${JSON.stringify(start.barBounds)}`
  }
  if (start.resizable) return 'wm: the window of sample resizes, and its window data says resizable false'
  if (!start.movable || !start.top) return `wm: a new window must be movable and on top: ${JSON.stringify(start)}`
  if (start.bounds.x !== start.home.x || start.bounds.y !== start.home.y) return `wm: the window of sample is not at the default position: ${JSON.stringify(start)}`
  if (!start.allSpaces) return `wm: a new window of the layer top is not on all Spaces: ${JSON.stringify(start)}`
  const hovered = await wmMain(deadline, 'return hoverWindow()')
  note(`wm hover: ${JSON.stringify({ ok: hovered?.ok, barShown: hovered?.value?.barShown })}`)
  if (hovered?.ok !== true) return `wm: the bar does not show with the hook point in the window: ${JSON.stringify(hovered)}`
  const failed = await checkWmButtons(deadline)
    ?? await checkWmDrags(deadline)
    ?? await checkWmStoredPlace(deadline)
    ?? await checkWmPageMove(deadline)
    ?? await checkWmDisplayMove(deadline)
    ?? await checkWmTurnOn(deadline)
    ?? await checkWmHostDown(deadline)
  if (failed !== undefined) return failed
  // The page of sample is agent code. It must not reach the bar: the bar is in another view. It must not reach the
  // window route of the operator either (window_manager.route): its widget origin gives 404.
  const page = await findWidgetPage('sample', Math.min(deadline, Date.now() + 15_000))
  if (page === undefined) return 'wm: no renderer page for the window of sample'
  const reach = JSON.parse(String(await evaluate(page.webSocketDebuggerUrl, "JSON.stringify({ bar: document.querySelector('[data-deepwidgets-bar], [data-bar]') !== null, frames: window.frames.length })", deadline)))
  note(`wm page reach: ${JSON.stringify(reach)}`)
  if (reach.bar !== false) return `wm: a script in the page of sample finds a bar element: ${JSON.stringify(reach)}`
  const fromPage = JSON.parse(String(await evaluate(page.webSocketDebuggerUrl,
    "fetch('/api/widget-windows/sample', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ layer: 'normal' }) }).then((answer) => JSON.stringify({ status: answer.status }))",
    deadline, true)))
  const afterPage = await wmMain(deadline, 'await sleep(500); return read()')
  note(`wm page route: ${JSON.stringify({ fromPage, host: afterPage?.host })}`)
  if (fromPage.status !== 404 || afterPage?.host?.layer !== 'top') return `wm: a call of /api/widget-windows/sample from the page of sample did not get 404: ${JSON.stringify({ fromPage, host: afterPage?.host })}`
  return undefined
}

/**
 * The buttons of the bar (window_manager.bar, window_manager.move). Each click goes to the bar view as mouse events. The
 * lock button sets isMovable(), and the Host gets the lock. The layer button sets isAlwaysOnTop() and
 * isVisibleOnAllWorkspaces(): the layer normal stays on its one Space. A layer click does not move the window, also when
 * it is locked, and the Host gets the layer.
 */
async function checkWmButtons(deadline) {
  const buttons = await wmMain(deadline, `
    const steps = []
    for (const want of [false, true]) {
      const failed = await click('lock')
      if (failed !== undefined) return { failed }
      const polled = await until((wm) => wm.movable === want && wm.host?.locked === !want && wm.pending === null, 5000)
      steps.push({ control: 'lock', want, movable: polled.value.movable, host: polled.value.host?.locked, ok: polled.ok })
    }
    for (const locked of [false, true]) {
      if (locked) {
        const failed = await click('lock')
        if (failed !== undefined) return { failed }
        if (!(await until((wm) => !wm.movable, 5000)).ok) return { failed: 'the lock button did not lock the window before the locked layer clicks' }
      }
      for (const want of [false, true]) {
        const before = read().bounds
        const failed = await click('layer')
        if (failed !== undefined) return { failed }
        const polled = await until((wm) => wm.top === want && wm.allSpaces === want && wm.host?.layer === (want ? 'top' : 'normal') && wm.pending === null, 5000)
        await sleep(300)
        const after = read().bounds
        const kept = after.x === before.x && after.y === before.y
        steps.push({ control: 'layer', locked, want, top: polled.value.top, allSpaces: polled.value.allSpaces, host: polled.value.host?.layer, before, after, kept, ok: polled.ok && kept })
      }
      if (locked) {
        const failed = await click('lock')
        if (failed !== undefined) return { failed }
        if (!(await until((wm) => wm.movable, 5000)).ok) return { failed: 'the lock button did not unlock the window after the locked layer clicks' }
      }
    }
    return { steps }`)
  note(`wm buttons: ${JSON.stringify(buttons)}`)
  if (buttons?.failed !== undefined) return `wm: ${String(buttons.failed)}`
  const wrong = buttons?.steps?.find((step) => !step.ok)
  if (buttons?.steps?.length !== 6 || wrong !== undefined) {
    if (wrong?.control === 'lock') return `wm: after a click of the lock button, isMovable() is not ${String(wrong.want)}, or the Host does not have the lock: ${JSON.stringify(wrong)}`
    if (wrong?.kept === false) return `wm: a click of the layer button moved the ${wrong.locked ? 'locked' : 'unlocked'} window: ${JSON.stringify(wrong)}`
    return `wm: after a click of the layer button, isAlwaysOnTop() or isVisibleOnAllWorkspaces() is not ${String(wrong?.want)}, or the Host does not have the layer: ${JSON.stringify(buttons)}`
  }
  return undefined
}

/**
 * A drag on the handle moves the window by the move of the hook point, and the Host stores the position that the window
 * has. The same drag of a locked window does not move it.
 */
async function checkWmDrags(deadline) {
  const drags = await wmMain(deadline, `
    const free = await drag({ x: 60, y: 45 })
    if (typeof free === 'string') return { failed: free }
    const stored = await until((wm) => wm.pending === null && wm.host?.position?.x === wm.bounds.x && wm.host?.position?.y === wm.bounds.y, 5000)
    let failed = await click('lock')
    if (failed !== undefined) return { failed }
    const locked = await until((wm) => !wm.movable, 5000)
    if (!locked.ok) return { failed: 'the lock button did not lock the window before the locked drag' }
    const held = await drag({ x: 60, y: 45 })
    if (typeof held === 'string') return { failed: held }
    failed = await click('lock')
    if (failed !== undefined) return { failed }
    return { free, stored: stored.ok, host: stored.value.host?.position, held, unlocked: (await until((wm) => wm.movable, 5000)).ok }`)
  note(`wm drags: ${JSON.stringify(drags)}`)
  if (drags?.failed !== undefined) return `wm: ${String(drags.failed)}`
  const { free, held } = drags ?? {}
  if (free?.started !== true || free.ended !== true) return `wm: the drag on the handle did not start and end: ${JSON.stringify(free)}`
  if (free.after.x !== free.before.x + 60 || free.after.y !== free.before.y + 45) return `wm: the drag on the handle did not move the window by 60, 45: ${JSON.stringify(free)}`
  if (drags.stored !== true) return `wm: after the drag, the Host does not have the position of the window: ${JSON.stringify(drags)}`
  if (held?.started !== false || held.after.x !== held.before.x || held.after.y !== held.before.y) return `wm: a drag of the locked window moved it: ${JSON.stringify(held)}`
  if (drags.unlocked !== true) return 'wm: the lock button did not unlock the window after the locked drag'
  return undefined
}

/**
 * window_manager.move: a drag to the top edge of the display asks for a point above the work area. macOS puts the window
 * at another place, and the Host must store that place, the value of getPosition() (stored_position_not_window_position).
 * Then a reset deletes the position, and a press and a release on the handle with no move store no position
 * (handle_click_stores_position).
 */
async function checkWmStoredPlace(deadline) {
  const edge = await wmMain(deadline, `
    const before = read()
    const asked = { x: before.bounds.x, y: before.areaTop - 20 }
    const moved = await drag({ x: 0, y: asked.y - before.bounds.y })
    if (typeof moved === 'string') return { failed: moved }
    const stored = await until((wm) => wm.pending === null && wm.host?.position?.x === wm.bounds.x && wm.host?.position?.y === wm.bounds.y, 5000)
    const [x, y] = window.getPosition()
    return { asked, areaTop: before.areaTop, moved, position: { x, y }, host: stored.value.host?.position, ok: stored.ok }`)
  note(`wm top edge: ${JSON.stringify(edge)}`)
  if (edge?.failed !== undefined) return `wm: ${String(edge.failed)}`
  if (edge?.moved?.started !== true || edge.moved.ended !== true) return `wm: the drag to the top edge did not start and end: ${JSON.stringify(edge)}`
  if (edge.position.y === edge.asked.y) return `wm: macOS kept the window at the asked point above the work area, so the check can not tell the stored point from the asked one: ${JSON.stringify(edge)}`
  if (edge.ok !== true) return `wm: a drag to the top edge did not store the position that getPosition() gives: ${JSON.stringify(edge)}`
  const still = await wmMain(deadline, `
    const reset = await post({ reset: true })
    const cleared = await until((wm) => wm.host?.position === null && wm.bounds.x === wm.home.x && wm.bounds.y === wm.home.y, 5000)
    const before = read().bounds
    const pressed = await drag({ x: 0, y: 0 })
    if (typeof pressed === 'string') return { failed: pressed }
    await sleep(1000)
    const after = read()
    return { reset, cleared: cleared.ok, before, pressed, after: after.bounds, host: after.host?.position, pending: after.pending, data: this.data.get('sample')?.position ?? null }`)
  note(`wm no-move press: ${JSON.stringify(still)}`)
  if (still?.failed !== undefined) return `wm: ${String(still.failed)}`
  if (still?.reset?.status !== 200 || still.cleared !== true) return `wm: the reset of the route did not move the window to the default position: ${JSON.stringify(still)}`
  if (still.pressed?.started !== true || still.after.x !== still.before.x || still.after.y !== still.before.y) return `wm: the press on the handle did not start a drag, or it moved the window: ${JSON.stringify(still)}`
  if (still.host !== null || still.pending !== null || still.data !== null) return `wm: a press and a release on the handle with no move stored a position: ${JSON.stringify(still)}`
  return undefined
}

/**
 * window_manager.move (page_move_becomes_operator_choice): only the move that a `will-move` starts is an operator choice.
 * The check sets the mark of a `will-move`, as the review probe did, and moves the window with setPosition, which macOS
 * reports with `moved`. The Host stores that position. Then a script in the page of sample runs window.moveTo: the Host
 * keeps the position of the operator. After a reset, a second page move stores no position and no choice of x and y.
 */
async function checkWmPageMove(deadline) {
  const operator = await wmMain(deadline, `
    const reset = await post({ reset: true })
    const cleared = await until((wm) => wm.host?.position === null && wm.pending === null && wm.bounds.x === wm.home.x && wm.bounds.y === wm.home.y, 5000)
    const home = read().bounds
    entry.nativeMove = true
    window.setPosition(home.x + 30, home.y + 20)
    const stored = await until((wm) => wm.pending === null && wm.host?.position?.x === home.x + 30 && wm.host?.position?.y === home.y + 20, 5000)
    await sleep(300)
    return { reset: reset.status, cleared: cleared.ok, home, stored: stored.ok, host: stored.value.host?.position, mark: entry.nativeMove }`)
  note(`wm operator native move: ${JSON.stringify(operator)}`)
  if (operator?.reset !== 200 || operator.cleared !== true || operator.stored !== true) return `wm: the native move of the operator did not reach the Host: ${JSON.stringify(operator)}`
  if (operator.mark !== false) return `wm: the mark of the native move stays after its end: ${JSON.stringify(operator)}`
  const page = await findWidgetPage('sample', Math.min(deadline, Date.now() + 15_000))
  if (page === undefined) return 'wm: no renderer page for the window of sample'
  const pageMove = async (x, y) => {
    await evaluate(page.webSocketDebuggerUrl, `window.moveTo(${String(x)}, ${String(y)}); 'moved'`, deadline)
    return wmMain(deadline, `
      await sleep(1000)
      const answer = await post({ layer: 'top' })
      return { bounds: read().bounds, pending: read().pending, window: answer.body?.window ?? null }`)
  }
  const first = await pageMove(operator.home.x + 70, operator.home.y + 30)
  note(`wm page move after the operator move: ${JSON.stringify(first)}`)
  if (first?.window?.x !== operator.home.x + 30 || first.window.y !== operator.home.y + 20 || first.pending !== null) {
    return `wm: a window.moveTo of the page after a native move of the operator changed the stored position: ${JSON.stringify({ operator, first })}`
  }
  const second = await wmMain(deadline, `
    const reset = await post({ reset: true })
    const cleared = await until((wm) => wm.host?.position === null && wm.pending === null && wm.bounds.x === wm.home.x && wm.bounds.y === wm.home.y, 5000)
    return { reset: reset.status, cleared: cleared.ok }`)
  if (second?.reset !== 200 || second.cleared !== true) return `wm: the reset after the page move did not move the window home: ${JSON.stringify(second)}`
  const later = await pageMove(operator.home.x + 70, operator.home.y + 30)
  note(`wm page move with no operator move: ${JSON.stringify(later)}`)
  if (later?.window === null || 'x' in later.window || later.window.chosen.includes('x') || later.pending !== null) {
    return `wm: a window.moveTo of the page stored a position or a choice of x: ${JSON.stringify(later)}`
  }
  const home = await wmMain(deadline, 'this.moveTo(entry, read().home); return until((wm) => wm.bounds.x === wm.home.x && wm.bounds.y === wm.home.y, 5000)')
  if (home?.ok !== true) return `wm: the check could not put the window of sample home after the page moves: ${JSON.stringify(home)}`
  return undefined
}

/**
 * window_manager.move (native_move_fix_unchecked): a move that macOS makes at a change of the displays is not an operator
 * choice. The check sets the mark of a `will-move`, runs the display check of Electron main (`displaysChanged`, which
 * the screen events call), and moves the window with setPosition, which macOS reports with `moved`. The Host must store
 * no position. Then the window goes home again.
 */
async function checkWmDisplayMove(deadline) {
  const moved = await wmMain(deadline, `
    const before = read()
    if (before.host?.position !== null || before.pending !== null) return { failed: 'the window of sample has a stored position before the display change', before }
    entry.nativeMove = true
    this.displaysChanged()
    const mark = entry.nativeMove
    window.setPosition(before.bounds.x + 25, before.bounds.y + 15)
    await sleep(1000)
    const after = read()
    this.moveTo(entry, after.home)
    const home = await until((wm) => wm.bounds.x === wm.home.x && wm.bounds.y === wm.home.y, 5000)
    return { mark, bounds: after.bounds, host: after.host?.position, pending: after.pending, data: this.data.get('sample')?.position ?? null, home: home.ok }`)
  note(`wm display change: ${JSON.stringify(moved)}`)
  if (moved?.failed !== undefined) return `wm: ${String(moved.failed)}: ${JSON.stringify(moved)}`
  if (moved?.host !== null || moved.pending !== null || moved.data !== null) return `wm: a move after a change of the displays became an operator choice: ${JSON.stringify(moved)}`
  if (moved.home !== true) return `wm: the check could not put the window of sample home after the display change: ${JSON.stringify(moved)}`
  return undefined
}

/**
 * window_manager.data: a position, the layer normal, and the lock from the bar stay in the Host. After Turn off and
 * Turn on, the new window of sample has them. Then the check puts back the layer top, no lock, and no position.
 */
async function checkWmTurnOn(deadline) {
  const set = await wmMain(deadline, `
    const moved = await drag({ x: 40, y: 30 })
    if (typeof moved === 'string') return { failed: moved }
    for (const name of ['layer', 'lock']) {
      const failed = await click(name)
      if (failed !== undefined) return { failed }
    }
    const stored = await until((wm) => wm.pending === null && wm.host?.layer === 'normal' && wm.host.locked === true && wm.host.position?.x === wm.bounds.x && wm.host.position?.y === wm.bounds.y, 5000)
    return { ok: stored.ok, value: stored.value }`)
  note(`wm before Turn off: ${JSON.stringify({ ok: set?.ok, host: set?.value?.host, bounds: set?.value?.bounds })}`)
  if (set?.failed !== undefined) return `wm: ${String(set.failed)}`
  if (set?.ok !== true) return `wm: the Host does not have the position, the layer, and the lock from the bar: ${JSON.stringify(set)}`
  const place = set.value.host.position
  for (const enabled of [false, true]) {
    const turned = await setSample(enabled, deadline)
    if (turned !== undefined) return `wm: ${turned}`
  }
  let fresh
  for (const until = Math.min(deadline, Date.now() + 30_000); Date.now() < until; await delay(500)) {
    fresh = await wmMain(deadline, 'return until((wm) => wm.visible && wm.loaded && wm.barLoaded, 5000)')
    if (fresh?.ok === true) break
  }
  note(`wm after Turn on: ${JSON.stringify(fresh?.value)}`)
  const window = fresh?.value
  if (fresh?.ok !== true || window.bounds.x !== place.x || window.bounds.y !== place.y || window.top !== false || window.allSpaces !== false || window.movable !== false) {
    return `wm: after Turn off and Turn on, the new window of sample does not have the stored position ${JSON.stringify(place)}, the layer normal, and the lock: ${JSON.stringify(fresh)}`
  }
  const restored = await wmMain(deadline, `
    for (const name of ['lock', 'layer']) {
      const failed = await click(name)
      if (failed !== undefined) return { failed }
    }
    const reset = await post({ reset: true })
    const back = await until((wm) => wm.pending === null && wm.host?.layer === 'top' && wm.host.locked === false && wm.host.position === null && wm.bounds.x === wm.home.x && wm.bounds.y === wm.home.y, 5000)
    return { ok: back.ok, reset: reset.status, value: back.value }`)
  note(`wm restored: ${JSON.stringify({ ok: restored?.ok, host: restored?.value?.host })}`)
  if (restored?.ok !== true) return `wm: the check could not put back the layer top, no lock, and no position of sample: ${JSON.stringify(restored)}`
  return undefined
}

/**
 * window_manager.route: a layer click while the Host is down waits in Electron main. It goes to the route when the next
 * Host is ready, and the hello of that Host does not undo it: from that hello on, the window never shows the layer top
 * until the Host has the layer normal. Then the check puts back the layer top.
 */
async function checkWmHostDown(deadline) {
  const hellos = await withWidgetWindows(deadline, countHellos())
  // hello_undo_check_misses_short_flip: a flip back to `top` lasts one round trip to the host, shorter than a poll. So
  // the check records each layer that Electron main sets on the window from the next hello on.
  await withWidgetWindows(deadline, `function () {
    const original = Object.getPrototypeOf(this).setLayer
    this.__smokeLayers = []
    this.setLayer = function (window, layer) { this.__smokeLayers.push({ layer, hellos: this.__smokeHellos }); return original.call(this, window, layer) }
    return true
  }`)
  const kill = await killHost('wm')
  const gap = await wmMain(deadline, `
    let gone = false
    for (const end = Date.now() + 10000; Date.now() < end && !gone; await sleep(50)) gone = this.target === undefined
    const failed = await click('layer')
    if (failed !== undefined) return { failed }
    const changed = await until((wm) => !wm.top && !wm.allSpaces, 5000)
    await sleep(300)
    return { gone, changed: changed.ok, pending: read().pending, host: read().host }`)
  note(`wm host down: ${JSON.stringify(gap)}`)
  if (gap?.failed !== undefined) return `wm: ${String(gap.failed)}`
  if (gap?.gone !== true || gap.changed !== true || gap.pending?.layer !== 'normal') return `wm: a layer click while the Host is down does not wait in Electron main: ${JSON.stringify(gap)}`
  if (!await waitForNewHost(kill.pid, Math.min(deadline, Date.now() + 60_000))) return 'wm: no new host after the kill'
  const kept = await wmMain(deadline, `
    let result = { ok: false, timeout: true }
    for (const end = Date.now() + 45000; Date.now() < end; await sleep(20)) {
      const wm = read()
      if (this.__smokeHellos > ${String(hellos)} && wm.pending === null && wm.host?.layer === 'normal') {
        result = { ok: !wm.top, value: wm }
        break
      }
    }
    const layers = this.__smokeLayers
    delete this.setLayer
    delete this.__smokeLayers
    const flips = layers.filter((item) => item.hellos > ${String(hellos)} && item.layer === 'top').length
    return { ...result, ok: result.ok === true && flips === 0, flips, layers, hellos: this.__smokeHellos }`)
  note(`wm after the host restart: ${JSON.stringify({ ok: kept?.ok, flips: kept?.flips, layers: kept?.layers, timeout: kept?.timeout, host: kept?.value?.host, top: kept?.value?.top })}`)
  if (kept?.ok !== true) return `wm: after the host restart, the layer click of the gap did not reach the Host, or the hello undid it: ${JSON.stringify(kept)}`
  const back = await wmMain(deadline, `
    const failed = await click('layer')
    if (failed !== undefined) return { failed }
    return until((wm) => wm.top && wm.pending === null && wm.host?.layer === 'top', 5000)`)
  if (back?.ok !== true) return `wm: the check could not put back the layer top of sample after the host restart: ${JSON.stringify(back)}`
  return undefined
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
  const url = widgetUrl('sample')
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
  const url = widgetUrl('sample')
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
      // The plugin manager applies a bundle that replaces a workspace package at the next Host start (package-moved).
      const named = await installBundle(join(root, 'deepwidgets', 'widgets', 'fixtures', 'built-in-name-widget'), deadline)
      note(`give-up built-in name install=${JSON.stringify(named)}`)
      if (named?.application !== 'restart-required') return `give-up: the built-in name bundle did not install: ${JSON.stringify(named)}`
    }
    if (crash === 3) {
      // Safe mode decides built-in by the module file of the row, not by its name.
      const main = await waitForRenderer(until)
      if (main === undefined) return 'give-up: crash 3: no main window'
      const named = await pollList(main, Math.min(until, Date.now() + 30_000), (list) => list.some((item) => item.slug === NAME_WIDGET && item.off?.reason === 'safe-mode'))
      note(`give-up built-in name list=${JSON.stringify(named.value)}`)
      if (!named.ok) return `give-up: safe mode let a bundle with a built-in name register: ${JSON.stringify(named.value)}`
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
      functionDeclaration: pinnedFunction(`async function (spec) {
        if (this.length !== 1) throw new Error("Loader instances " + this.length);
        const manager = this[0].ctx?.get?.("pluginManager") ?? this[0].ctx?.pluginManager;
        if (manager === undefined || typeof manager.installBundle !== "function") throw new Error("no pluginManager on Loader ctx");
        // The inspector call can inherit the hmr transaction store of host work in flight; leave it, as hmr.watchConfig does.
        const hmr = this[0].ctx?.get?.("hmr");
        return await (hmr === undefined ? manager.installBundle(spec) : hmr.executing.exit(() => manager.installBundle(spec)));
      }`),
    })
    if (call?.exceptionDetails) throw new Error(String(call.exceptionDetails.exception?.description ?? call.exceptionDetails.text ?? 'install failed'))
    return call?.result?.value
  })
}

/**
 * GET /api/widgets until `accept` takes the list. The request goes from the main window: a widget page has the origin
 * of its slug, and that origin answers only the API of its slug (agent_library.serving.routes).
 */
async function pollList(_widget, until, accept) {
  let last
  while (Date.now() < until) {
    try {
      const main = await waitForRenderer(until)
      if (main === undefined) throw new Error('no main window')
      const answer = JSON.parse(String(await evaluate(main.webSocketDebuggerUrl,
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
  // From the main window: the sample page may not read the program of another slug (agent_library.serving.routes).
  const main = await waitForRenderer(until)
  if (main === undefined) return 'no main window'
  const program = JSON.parse(String(await evaluate(main.webSocketDebuggerUrl,
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

/** Gives the failure text when a supervisor event after `since` is a crash, else undefined. */
function noCrashSince(since, what) {
  const crashes = supervisorEvents(since).filter((event) => event.event === 'host-failed' || event.event === 'give-up')
  return crashes.length === 0 ? undefined : `blame: ${what}: another crash: ${JSON.stringify(crashes)}`
}

async function checkHostBlame(deadline) {
  const row = 'deepwidgets-widget-blame-timer'
  const sample = await findWidgetPage('sample', deadline)
  if (sample === undefined) return 'blame: no sample widget page'
  const first = await pollWidget(sample, deadline, (value) => value.count !== null && value.dw?.stream === 'open')
  if (!first.ok) return `blame: no count in the sample page: ${JSON.stringify(first.value)}`
  const until = Math.min(deadline, Date.now() + 120_000)

  // The fixture is a copy, so the change below does not touch the repository.
  const fixture = join(temp, 'blame-timer')
  cpSync(join(root, 'deepwidgets/widgets/fixtures/blame-timer'), fixture, { recursive: true })
  const start = Date.now()
  // The timer throws 1 s after the plugin loads; the install answer can be lost with the host.
  const install = await installBundle(fixture, until).catch((error) => ({ error: error instanceof Error ? error.message : 'install failed' }))
  note(`blame install=${JSON.stringify({ application: install?.application, error: install?.error })}`)
  const crash = await waitForSupervisor(start, (event) => event.event === 'host-failed', until)
  note(`blame host-failed=${JSON.stringify(crash)}`)
  if (crash === undefined) return 'blame: the timer throw did not end the host'
  const oldPid = hostPid
  if (!await waitForNewHost(oldPid, until)) return 'blame: no new host'
  const ready = await waitForSupervisor(crash.at, (event) => event.event === 'ready', until)
  note(`blame ready=${JSON.stringify(ready)}`)

  // The blamed widget shows failed with its reason; sample stays live.
  const blamed = await findWidgetPage('blame-timer', until)
  if (blamed === undefined) return 'blame: no blame-timer widget page'
  const shown = await pollWidget(blamed, until, (value) => value.state === 'state-error' && value.text.includes('the timer threw'))
  note(`blame failed page=${JSON.stringify(shown.value)}`)
  if (!shown.ok) return `blame: the blame-timer page does not show failed: ${JSON.stringify(shown.value)}`
  const live = await pollWidget(sample, until, (value) => value.count !== null && value.dw?.stream === 'open' && value.dw.streamOpens > first.value.dw.streamOpens)
  note(`blame sample=${JSON.stringify(live.value)}`)
  if (!live.ok) return `blame: the sample page is not live after the restart: ${JSON.stringify(live.value)}`
  // A blamed widget that ran again would throw within 1 s of the start.
  await delay(5_000)
  let failed = noCrashSince(crash.at + 1, 'after the restart')
  if (failed !== undefined) return failed
  if (await countPages(widgetUrl('sample')) !== 1) return 'blame: the sample window closed'
  if (ready?.safeMode !== false) return `blame: the restart is in safe mode: ${JSON.stringify(ready)}`
  if (!(crash.blamed === row || String(crash.blamed).endsWith(`:${row}`)) || crash.crashes !== 0) return `blame: the supervisor did not see a blamed crash: ${JSON.stringify(crash)}`

  // A changed file of the widget lifts the quarantine at the next start. THROW false keeps the widget alive.
  let quarantine
  try { quarantine = JSON.parse(readFileSync(join(home, 'deepwidgets', 'quarantine.json'), 'utf8')) } catch { quarantine = undefined }
  const item = Array.isArray(quarantine) ? quarantine.find((entry) => (entry.row === row || String(entry.row).endsWith(`:${row}`))) : undefined
  note(`blame quarantine=${JSON.stringify(item)}`)
  if (typeof item?.root !== 'string') return `blame: no quarantine entry: ${JSON.stringify(quarantine)}`
  const file = join(item.root, 'index.js')
  const text = readFileSync(file, 'utf8')
  if (!text.includes('const THROW = true')) return 'blame: the installed fixture has no THROW line'
  // A rename, so a hard link into a package store stays unchanged.
  writeFileSync(`${file}.tmp`, text.replace('const THROW = true', 'const THROW = false'))
  renameSync(`${file}.tmp`, file)
  const kill = await killHost('blame lift')
  const second = await waitForSupervisor(kill.at, (event) => event.event === 'host-failed', until)
  note(`blame lift host-failed=${JSON.stringify(second)}`)
  if (second?.blamed !== null || second.crashes !== 1 || second.safeMode !== false) return `blame: the kill is not one unblamed crash: ${JSON.stringify(second)}`
  if (!await waitForNewHost(kill.pid, until)) return 'blame: no host after the change'
  const back = await pollWidget(blamed, until, (value) => value.state === null && value.text.includes('Blame timer') && value.dw?.stream === 'open')
  note(`blame lifted page=${JSON.stringify(back.value)}`)
  if (!back.ok) return `blame: the changed widget did not come back: ${JSON.stringify(back.value)}`
  const sampleBack = await pollWidget(sample, until, (value) => value.count !== null && value.dw?.stream === 'open')
  if (!sampleBack.ok) return `blame: the sample page is not live after the lift: ${JSON.stringify(sampleBack.value)}`
  await delay(3_000)
  failed = noCrashSince(second.at + 1, 'after the lift')
  if (failed !== undefined) return failed
  return undefined
}

/**
 * A minimal MCP client over plain fetch: the token handshake of mcp_readme.handshake, then JSON-RPC
 * requests to the stateless /mcp route. Gives `call(method, params)` with the JSON-RPC result.
 */
/** POST JSON from a renderer page to the host. Gives the status and the body. */
async function postFrom(page, path, body, until) {
  return JSON.parse(String(await evaluate(page.webSocketDebuggerUrl,
    `fetch(${JSON.stringify(path)}, { method: 'POST', headers: { 'content-type': 'application/json' }, body: ${JSON.stringify(JSON.stringify(body))} })
      .then(async (response) => JSON.stringify({ status: response.status, body: await response.json().catch(() => null) }))`, until, true)))
}

async function checkHostWatchdog(deadline) {
  const row = 'deepwidgets-widget-watchdog'
  const sample = await findWidgetPage('sample', deadline)
  if (sample === undefined) return 'watchdog: no sample widget page'
  const first = await pollWidget(sample, deadline, (value) => value.count !== null && value.dw?.stream === 'open')
  if (!first.ok) return `watchdog: no count in the sample page: ${JSON.stringify(first.value)}`
  const until = Math.min(deadline, Date.now() + 150_000)
  for (const name of ['watchdog-host', 'watchdog-widget']) {
    const fixture = join(temp, name)
    cpSync(join(root, 'deepwidgets/widgets/fixtures', name), fixture, { recursive: true })
    const install = await installBundle(fixture, until)
    note(`watchdog install ${name}=${JSON.stringify({ application: install?.application })}`)
    if (install?.application !== 'applied') return `watchdog: the install of ${name} did not apply: ${JSON.stringify(install)}`
  }
  const widget = await findWidgetPage('watchdog', until)
  if (widget === undefined) return 'watchdog: no watchdog widget page'
  const ready = await pollWidget(widget, until, (value) => value.state === null && value.text.includes('Watchdog') && value.dw?.stream === 'open')
  if (!ready.ok) return `watchdog: the watchdog page is not live: ${JSON.stringify(ready.value)}`

  // parse: a long synchronous step of healthy host code. The host must live.
  const parseFrom = Date.now()
  const pid = hostPid
  // The host routes of the fixture are not widget routes, so the main window (origin app) posts them (agent_library.serving.routes).
  const main = await waitForRenderer(until)
  if (main === undefined) return 'watchdog: no main window'
  const prepared = await postFrom(main, '/api/watchdoghost/prepare', { mb: 150 }, until)
  const parsed = await postFrom(main, '/api/watchdoghost/parse', {}, until)
  await delay(3_000)
  note(`watchdog parse=${JSON.stringify({ prepared, parsed })}`)
  if (parsed.status !== 200 || prepared.body?.mb < 150) return `watchdog: the parse did not run: ${JSON.stringify({ prepared, parsed })}`
  let failed = noCrashSince(parseFrom, 'the 150 MB parse')
  if (failed !== undefined) return `watchdog: ${failed}`
  if (!await waitForHost(Math.min(until, Date.now() + 5_000)) || hostPid !== pid) return 'watchdog: the host changed during the parse'

  // spin: a loop in an action. The host must die within 2.5 s and come back.
  const sent = Date.now()
  void evaluate(widget.webSocketDebuggerUrl,
    `void fetch('/api/widgets/watchdog/call', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'spin' }) }).catch(() => {}); 'sent'`, until).catch(() => undefined)
  const crash = await waitForSupervisor(sent, (event) => event.event === 'host-failed', until)
  note(`watchdog host-failed=${JSON.stringify(crash)} after=${crash === undefined ? 'none' : String(crash.at - sent)} ms`)
  if (crash === undefined) return 'watchdog: the loop did not end the host'
  if (crash.at - sent > 2_500) return `watchdog: the host died ${String(crash.at - sent)} ms after the call, more than 2500 ms`
  if (!(crash.blamed === row || String(crash.blamed).endsWith(`:${row}`)) || crash.crashes !== 0) return `watchdog: the supervisor did not see a blamed crash: ${JSON.stringify(crash)}`
  if (!await waitForNewHost(pid, until)) return 'watchdog: no new host'
  const restarted = await waitForSupervisor(crash.at, (event) => event.event === 'ready', until)
  note(`watchdog ready=${JSON.stringify(restarted)}`)
  if (restarted?.safeMode !== false) return `watchdog: the restart is in safe mode: ${JSON.stringify(restarted)}`
  const shown = await pollWidget(widget, until, (value) => value.state === 'state-error' && value.text.includes('stall'))
  note(`watchdog failed page=${JSON.stringify(shown.value)}`)
  if (!shown.ok) return `watchdog: the watchdog page does not show failed: ${JSON.stringify(shown.value)}`
  const live = await pollWidget(sample, until, (value) => value.count !== null && value.dw?.stream === 'open' && value.dw.streamOpens > first.value.dw.streamOpens)
  note(`watchdog sample=${JSON.stringify(live.value)}`)
  if (!live.ok) return `watchdog: the sample page is not live after the restart: ${JSON.stringify(live.value)}`
  await delay(5_000)
  failed = noCrashSince(crash.at + 1, 'after the restart')
  if (failed !== undefined) return `watchdog: ${failed}`
  if (await countPages(widgetUrl('sample')) !== 1) return 'watchdog: the sample window closed'
  return undefined
}

async function mcpClient(deadline) {
  const portFile = join(home, 'deepwidgets', 'mcp.json')
  while (Date.now() < deadline) {
    let info
    try { info = JSON.parse(readFileSync(portFile, 'utf8')) } catch { info = undefined }
    if (typeof info?.port === 'number' && typeof info?.nonce === 'string') {
      const base = `http://127.0.0.1:${String(info.port)}`
      const challenge = randomBytes(16).toString('base64url')
      const answer = await fetch(`${base}/mcp/token`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'smoke create', challenge }),
      }).catch(() => undefined)
      if (answer?.status === 200) {
        const issued = await answer.json()
        if (createHmac('sha256', info.nonce).update(challenge).digest('hex') !== issued.proof) throw new Error('create: the MCP server did not prove the nonce')
        let id = 0
        const call = async (method, params) => {
          id += 1
          const response = await fetch(`${base}/mcp`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${String(issued.token)}`, 'mcp-protocol-version': '2025-06-18' },
            body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
            signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
          })
          const text = await response.text()
          const messages = (response.headers.get('content-type') ?? '').includes('text/event-stream')
            ? text.split('\n').filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5)))
            : [JSON.parse(text)]
          const reply = messages.find((message) => message?.id === id)
          if (reply === undefined) throw new Error(`create: ${method}: no reply (${String(response.status)} ${text.slice(0, 200)})`)
          if (reply.error !== undefined) throw new Error(`create: ${method}: ${JSON.stringify(reply.error)}`)
          return reply.result
        }
        await call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke-create', version: '0' } })
        return call
      }
    }
    await delay(250)
  }
  throw new Error('create: no MCP token before the deadline')
}

/** One HTTP request with any headers (fetch cannot set Host) on a new connection. Gives status, headers, and text. */
function rawRequest(port, path, { method = 'POST', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method, agent: false, timeout: 10_000, headers: { connection: 'close', ...headers } }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { text += chunk })
      res.on('end', () => { resolve({ status: res.statusCode, headers: res.headers, text }) })
    })
    req.once('timeout', () => { req.destroy(new Error(`${method} ${path} timed out`)) })
    req.once('error', reject)
    req.end(body)
  })
}

function tokenBody(agent) {
  return JSON.stringify({ agent, challenge: randomBytes(16).toString('base64url') })
}

/**
 * A stdio bridge as an agent runs it: each handshake reads mcp.json again and checks the nonce proof. After a 401
 * or a connection error it does a new handshake and one retry. After a 503 it waits for Retry-After and retries.
 */
function mcpBridge(portFile, until) {
  let session
  let id = 0
  const nonces = []
  const statuses = []
  const handshake = async () => {
    const { port, nonce } = JSON.parse(readFileSync(portFile, 'utf8'))
    const challenge = randomBytes(16).toString('base64url')
    const answer = await rawRequest(port, '/mcp/token', { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'smoke bridge', challenge }) })
    if (answer.status !== 200) throw new Error(`bridge: POST /mcp/token gave ${String(answer.status)}`)
    const { token, proof } = JSON.parse(answer.text)
    if (createHmac('sha256', nonce).update(challenge).digest('hex') !== proof) throw new Error('bridge: proof mismatch')
    nonces.push(nonce)
    return { port, token }
  }
  const post = async (body) => {
    session ??= await handshake()
    const answer = await rawRequest(session.port, '/mcp', {
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${session.token}`, 'mcp-protocol-version': '2025-06-18' },
      body,
    })
    statuses.push(answer.status)
    return answer
  }
  const rpc = async (method, params) => {
    id += 1
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params })
    let answer
    while (Date.now() < until) {
      try {
        answer = await post(body)
        if (answer.status === 401) throw new Error('401')
      } catch {
        session = undefined
        answer = await post(body)
      }
      if (answer.status !== 503) break
      await delay(Number(answer.headers['retry-after'] ?? '1') * 1000)
    }
    const messages = String(answer?.headers['content-type'] ?? '').includes('text/event-stream')
      ? answer.text.split('\n').filter((line) => line.startsWith('data:')).map((line) => JSON.parse(line.slice(5)))
      : [JSON.parse(answer?.text ?? 'null')]
    const reply = messages.find((message) => message?.id === id)
    if (reply?.result === undefined) throw new Error(`bridge: ${method}: ${String(answer?.status)} ${String(answer?.text).slice(0, 200)}`)
    return { result: reply.result, answer }
  }
  return {
    nonces,
    statuses,
    async tools() {
      await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke-bridge', version: '0' } })
      const listed = await rpc('tools/list', {})
      return { names: listed.result.tools.map((tool) => tool.name), answer: listed.answer }
    },
  }
}

async function checkMcpPortOwner(deadline) {
  const portFile = join(home, 'deepwidgets', 'mcp.json')
  const want = Number(process.env.DEEPWIDGETS_MCP_PORT ?? '0')
  const until = Math.min(deadline, Date.now() + 120_000)
  const readFile = () => { try { return JSON.parse(readFileSync(portFile, 'utf8')) } catch { return undefined } }
  let file
  while (Date.now() < until && typeof (file = readFile())?.port !== 'number') await delay(250)
  note(`mcp-port file=${JSON.stringify(file === undefined ? null : { ...file, nonce: '<set>' })} hostPid=${String(hostPid)} hostHttp=${String(hostHttpPort)}`)
  if (file === undefined) return 'mcp-port: no mcp.json'
  if (want !== 0 && file.port !== want) return `mcp-port: mcp.json names port ${String(file.port)}, not DEEPWIDGETS_MCP_PORT ${String(want)}`
  if (file.port === hostHttpPort) return `mcp-port: the host listens on the port of mcp.json ${String(file.port)}`
  if (String(file.pid) === String(hostPid)) return 'mcp-port: mcp.json names the host pid, not Electron main'
  const owner = await commandOf(String(file.pid))
  if (!/Electron/u.test(owner)) return `mcp-port: the pid of mcp.json is not Electron main: ${owner.slice(0, 120)}`
  const mode = statSync(portFile).mode & 0o777
  note(`mcp-port mode=${mode.toString(8)}`)
  if (mode !== 0o600) return `mcp-port: Electron main wrote mcp.json with mode ${mode.toString(8)}, not 600`

  const bridge = mcpBridge(portFile, until)
  const first = await bridge.tools()
  note(`mcp-port tools=${first.names.join(',')}`)
  if (!first.names.includes('widget_list')) return `mcp-port: tools/list through Electron main has no widget_list: ${first.names.join(',')}`
  if (first.answer.headers['x-deepwidgets-answer'] !== undefined) return 'mcp-port: the tools/list answer did not come from the host'

  const refused = [
    ['Origin', { origin: 'http://example.com' }],
    ['Sec-Fetch-Site', { 'sec-fetch-site': 'cross-site' }],
    ['a Host that is not loopback', { host: 'example.com' }],
  ]
  for (const [label, headers] of refused) {
    const answer = await rawRequest(file.port, '/mcp/token', { headers: { 'content-type': 'application/json', ...headers }, body: tokenBody('smoke fence') })
    note(`mcp-port fence ${label}: ${String(answer.status)} ${String(answer.headers['x-deepwidgets-answer'])}`)
    if (answer.status !== 403 || answer.headers['x-deepwidgets-answer'] !== 'electron-main') return `mcp-port: a request with ${label} got ${String(answer.status)}, not 403 from Electron main`
  }
  const direct = await rawRequest(hostHttpPort, '/mcp/token', { headers: { 'content-type': 'application/json' }, body: tokenBody('smoke direct') })
  note(`mcp-port direct: ${String(direct.status)} ${direct.text.slice(0, 120)}`)
  if (direct.status !== 403 || direct.headers['x-deepwidgets-answer'] !== undefined) return `mcp-port: a request straight to the host port got ${String(direct.status)}, not 403 from the host`

  const kill = await killHost('mcp-port')
  const gap = { unavailable: 0, other: [], badRetry: 0, fileChanged: false, mayHaveRun: [] }
  let back
  while (Date.now() < until) {
    let answer
    const sent = Date.now()
    try {
      answer = await rawRequest(file.port, '/mcp/token', { headers: { 'content-type': 'application/json' }, body: tokenBody('smoke gap') })
    } catch (error) {
      gap.other.push(error instanceof Error ? error.message : 'request failed')
      await delay(100)
      continue
    }
    if (answer.status === 200) { back = Date.now(); break }
    if (answer.status === 503) {
      gap.unavailable += 1
      if (answer.headers['retry-after'] !== '1' || answer.headers['x-deepwidgets-answer'] !== 'electron-main') gap.badRetry += 1
      const now = readFile()
      if (now?.port !== file.port || now?.pid !== file.pid) gap.fileChanged = true
    } else if (answer.status === 502 && answer.headers['retry-after'] === undefined) {
      gap.mayHaveRun.push(sent)
    } else {
      gap.other.push(String(answer.status))
    }
    await delay(50)
  }
  let gone
  for (const match of readFileSync(logPath, 'utf8').matchAll(/deepwidgets-mcp-port (\{.*\})/g)) {
    try {
      const event = JSON.parse(match[1])
      if (event.event === 'host-gone' && event.at >= kill.at) { gone = event.at; break }
    } catch { /* a partial line */ }
  }
  note(`mcp-port gap=${JSON.stringify(gap)} host-gone after ${String(gone === undefined ? 'never' : gone - kill.at)} ms, back after ${String(back === undefined ? 'never' : back - kill.at)} ms`)
  const late = gap.mayHaveRun.filter((at) => gone === undefined || at > gone)
  if (late.length > 0) return `mcp-port: ${String(late.length)} requests got 502 after Electron main saw the host exit`
  if (back === undefined) return 'mcp-port: no 200 after the host restart'
  if (gap.unavailable === 0) return 'mcp-port: no 503 in the gap'
  if (gap.badRetry > 0) return `mcp-port: ${String(gap.badRetry)} gap answers had no Retry-After: 1 from Electron main`
  if (gap.other.length > 0) return `mcp-port: the gap gave other answers: ${gap.other.slice(0, 5).join(', ')}`
  if (gap.fileChanged) return 'mcp-port: mcp.json changed its port or pid in the gap'
  if (!await waitForNewHost(kill.pid, until)) return 'mcp-port: no new host'

  const after = readFile()
  note(`mcp-port after=${JSON.stringify(after === undefined ? null : { port: after.port, pid: after.pid, newNonce: after.nonce !== file.nonce })} hostPid=${String(hostPid)} hostHttp=${String(hostHttpPort)}`)
  if (after?.port !== file.port || after?.pid !== file.pid) return `mcp-port: mcp.json changed across the restart: port ${String(after?.port)}, pid ${String(after?.pid)}`
  if (after.nonce === file.nonce) return 'mcp-port: the nonce did not change at the new host start'
  const again = await bridge.tools()
  note(`mcp-port bridge statuses=${bridge.statuses.join(',')} handshakes=${String(bridge.nonces.length)}`)
  if (!again.names.includes('widget_list')) return 'mcp-port: the bridge did not list the tools after the restart'
  if (bridge.nonces.length !== 2 || bridge.nonces[1] !== after.nonce) return `mcp-port: the bridge did not reconnect with the new nonce (${String(bridge.nonces.length)} handshakes)`
  return undefined
}

async function checkCreate(deadline) {
  const dir = process.env.DSH_SMOKE_CREATE ?? ''
  if (!existsSync(join(dir, 'src', 'index.ts'))) return `create: no src/index.ts in ${dir}`
  const call = await mcpClient(deadline)
  const tool = async (name, args) => {
    const result = await call('tools/call', { name, arguments: args })
    return { isError: result?.isError === true, body: result?.structuredContent ?? JSON.parse(result?.content?.[0]?.text ?? 'null') }
  }
  const casesFile = process.env.DSH_SMOKE_CREATE_CASES ?? ''
  for (const item of casesFile === '' ? [] : JSON.parse(readFileSync(casesFile, 'utf8'))) {
    const at = Date.now()
    const answer = await tool('widget_install', { dir: item.dir })
    const error = answer.body?.error
    note(`create case ${item.dir} ms=${String(Date.now() - at)} error=${JSON.stringify(error)} warnings=${JSON.stringify(answer.body?.warnings)}`)
    if (typeof item.refuse === 'string') {
      if (!answer.isError || error?.code !== 'gate-failed' || error?.gate !== 'page-render' || !error?.diagnostics?.some((line) => line.startsWith(item.refuse))) {
        return `create: the render check did not refuse ${item.dir} with ${item.refuse}: ${JSON.stringify(answer.body)}`
      }
      if (typeof item.nextStep === 'string' && error?.nextStep?.includes(item.nextStep) !== true) return `create: the next step of ${item.dir} has no ${JSON.stringify(item.nextStep)}: ${JSON.stringify(error?.nextStep)}`
    } else {
      if (answer.isError) return `create: the case ${item.dir} did not install: ${JSON.stringify(answer.body)}`
      const missing = (item.warnings ?? []).filter((text) => !answer.body?.warnings?.some((line) => line.includes(text)))
      if (missing.length > 0) return `create: the case ${item.dir} has no warning ${JSON.stringify(missing)}: ${JSON.stringify(answer.body?.warnings)}`
      if (typeof item.shows === 'string') {
        const slug = answer.body?.slug
        const read = await pollOrigin(slug, Math.min(deadline, Date.now() + 20_000), (value) => value.url === widgetUrl(slug, 'page') && value.note === item.shows && value.notice === null)
        note(`create case ${item.dir} shows=${JSON.stringify(read.value)}`)
        if (!read.ok) return `create: the window of the case ${item.dir} does not show ${JSON.stringify(item.shows)}: ${JSON.stringify(read.value)}`
      }
      await tool('widget_remove', { slug: answer.body?.slug })
    }
  }
  const started = Date.now()
  const installed = await tool('widget_install', { dir })
  note(`create install ms=${String(Date.now() - started)} result=${JSON.stringify({ isError: installed.isError, slug: installed.body?.slug, application: installed.body?.application, error: installed.body?.error })}`)
  const slug = installed.body?.slug
  if (installed.isError || typeof slug !== 'string') return `create: widget_install failed: ${JSON.stringify(installed.body)}`
  if (existsSync(join(dir, 'page'))) {
    const render = installed.body?.gates?.find((gate) => gate.gate === 'page-render')
    note(`create page=${JSON.stringify(installed.body?.page)} render=${JSON.stringify(render)} warnings=${JSON.stringify(installed.body?.warnings)}`)
    if (render?.ok !== true) return `create: no passed render check: ${JSON.stringify(installed.body?.gates)}`
    if (installed.body?.warnings?.some((line) => line.includes('skipped'))) return `create: the render check was skipped: ${JSON.stringify(installed.body?.warnings)}`
    const page = installed.body?.page
    if (typeof page !== 'string' || !existsSync(join(page, 'index.html'))) return `create: the built page is not in the profile: ${JSON.stringify(page)}`
  }
  const hasPage = existsSync(join(dir, 'page'))
  const url = widgetUrl(slug, hasPage ? 'page' : 'shell')
  const soon = () => Math.min(deadline, Date.now() + 15_000)
  let failed = await waitPages(url, 1, soon(), 'after widget_install')
  if (failed !== undefined) return `create: ${failed}`
  if (hasPage) {
    failed = await checkServing(slug, dir, tool, deadline)
    if (failed !== undefined) return `create: serving: ${failed}`
  }
  const added = await tool('widget_call', { slug, action: 'add', args: { by: 1 }, requestId: 'smoke-create-1' })
  if (added.isError || typeof added.body?.result?.count !== 'number') return `create: widget_call failed: ${JSON.stringify(added.body)}`
  const removed = await tool('widget_remove', { slug })
  note(`create remove result=${JSON.stringify(removed.body)}`)
  if (removed.isError) return `create: widget_remove failed: ${JSON.stringify(removed.body)}`
  failed = await waitPages(url, 0, soon(), 'after widget_remove')
  return failed === undefined ? undefined : `create: ${failed}`
}

/**
 * Read the one page on the widget origin of `slug`: its URL, origin, the note of the page fixture, and the notice.
 * A load gives the window a new renderer target, so the read finds the page by its origin.
 */
async function readOrigin(slug, until) {
  try {
    const prefix = `dsh-app://w-${slug}.widget/`
    const targets = (await (await fetch(`http://127.0.0.1:${String(rendererPort)}/json/list`, { signal: AbortSignal.timeout(2000) })).json())
      .filter((item) => item?.type === 'page' && String(item.url).startsWith(prefix) && typeof item.webSocketDebuggerUrl === 'string')
    if (targets.length !== 1) return { error: `${String(targets.length)} pages on ${prefix}` }
    const target = targets[0]
    return JSON.parse(String(await evaluate(target.webSocketDebuggerUrl, `JSON.stringify({ url: location.href, origin: location.origin,
  note: document.querySelector('[data-dw=note]')?.textContent ?? null, notice: document.querySelector('[data-dw=page-failed]')?.textContent ?? null,
  catalog: window.__dw?.catalog ?? null, state: window.__dw?.state ?? null })`, Math.min(until, Date.now() + 3000))))
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'evaluate failed' }
  }
}

/** Poll the page on the widget origin of `slug` until `accept` takes its read. Gives the last read, and whether it was accepted. */
async function pollOrigin(slug, until, accept) {
  let last
  while (Date.now() < until) {
    last = await readOrigin(slug, until)
    if (last.error === undefined && accept(last)) return { value: last, ok: true }
    await delay(250)
  }
  return { value: last, ok: false }
}

/**
 * agent_library.serving: the window of a bundle with a page, after its install. DSH_SMOKE_CREATE_NEXT is the same
 * bundle with new page sources (its Note starts with `next: `), and DSH_SMOKE_CREATE_PLAIN is the same bundle with no
 * page/. Each step reads the one page on the widget origin of the slug.
 * - The page shows its component at the widget origin of the slug.
 * - From the page, its own program gives 200, and the program of sample gives 403.
 * - An install with new page sources shows the new page; an install with no page/ shows the shared shell.
 * - A renderer that ends two times in 60 s leaves the shared shell with the notice. A new page link ends it.
 * The window ends on the page of `dir`.
 */
/**
 * agent_library.serving: each response of a widget origin, and of the /widget/ route of the origin app, has the CSP
 * header with `frame-ancestors 'none'`: the page document, a page file, the shell document, a shell file, and the
 * emitted `frame.html` of the page fixture (DSH_SMOKE_CREATE has `page/frame.html`). Then a hidden window loads that
 * `frame.html`, which has no `<meta>` CSP and frames the page of sample: the frame must be refused.
 */
async function checkCsp(slug, ws, deadline) {
  const read = (expression, url = ws) => evaluate(url, expression, deadline, true).then((text) => JSON.parse(String(text)))
  const heads = await read(`(async () => {
    const head = async (path) => path === null ? null : (await fetch(path)).headers.get('content-security-policy')
    const frame = document.documentElement.dataset.frame ?? null
    const shellText = await (await fetch('/widget/')).text()
    const shellFile = new DOMParser().parseFromString(shellText, 'text/html').querySelector('script[src]')?.getAttribute('src') ?? null
    const pageFile = document.querySelector('script[src]')?.getAttribute('src') ?? null
    return JSON.stringify({ frame, shellFile, pageFile, page: await head(location.pathname), pageAsset: await head(pageFile),
      shell: await head('/widget/'), shellAsset: await head(shellFile), html: await head(frame) })
  })()`)
  const main = await waitForRenderer(deadline)
  const app = main === undefined ? null : await read(`fetch('/widget/').then((answer) => JSON.stringify(answer.headers.get('content-security-policy')))`, main.webSocketDebuggerUrl)
  note(`serving csp=${JSON.stringify({ ...heads, app })}`)
  const strict = (value) => typeof value === 'string' && value.includes("frame-ancestors 'none'") && value.includes("default-src 'self'")
  if (typeof heads.frame !== 'string' || !heads.frame.startsWith(`dsh-app://w-${slug}.widget/widget/${slug}/`) || !heads.frame.endsWith('.html')) return `csp: the page emitted no frame.html: ${JSON.stringify(heads.frame)}`
  for (const name of ['page', 'pageAsset', 'shell', 'shellAsset', 'html']) {
    if (!strict(heads[name])) return `csp: the ${name} response has no CSP header with frame-ancestors 'none': ${JSON.stringify(heads)}`
  }
  if (!strict(app)) return `csp: the /widget/ route of the origin app has no CSP header: ${JSON.stringify(app)}`
  const framed = JSON.parse(String(await withWidgetWindows(deadline, `async function () {
    const BrowserWindow = this.windows.get(${JSON.stringify(slug)}).window.constructor
    const window = new BrowserWindow({ show: false, width: 320, height: 300, webPreferences: { sandbox: true, contextIsolation: true } })
    const logs = []
    window.webContents.on('console-message', (event) => { logs.push(String(event.message).slice(0, 160)) })
    try {
      await window.loadURL(${JSON.stringify(heads.frame)})
      await new Promise((done) => { setTimeout(done, 2000) })
      // A refused frame keeps the URL it asked for, so each frame reports what its document is.
      const frames = []
      for (const frame of window.webContents.mainFrame.framesInSubtree) {
        const inside = await frame.executeJavaScript('JSON.stringify({ href: location.href, widget: window.__dw !== undefined })').catch((error) => JSON.stringify({ error: String(error) }))
        frames.push({ url: frame.url, ...JSON.parse(inside) })
      }
      return JSON.stringify({ frames, logs: logs.slice(0, 3) })
    } finally {
      window.destroy()
    }
  }`)))
  note(`serving frame=${JSON.stringify(framed)}`)
  if (framed.frames[0]?.href !== heads.frame) return `csp: frame.html did not load: ${JSON.stringify(framed)}`
  if (framed.frames.length < 2) return `csp: frame.html made no frame: ${JSON.stringify(framed)}`
  if (framed.frames.some((frame) => frame.widget === true || String(frame.href).startsWith('dsh-app://w-sample.widget/'))) return `csp: frame.html framed the page of sample: ${JSON.stringify(framed)}`
  return undefined
}

async function checkServing(slug, dir, tool, deadline) {
  const next = process.env.DSH_SMOKE_CREATE_NEXT ?? ''
  const plain = process.env.DSH_SMOKE_CREATE_PLAIN ?? ''
  if (next === '' || plain === '') return 'DSH_SMOKE_CREATE_NEXT and DSH_SMOKE_CREATE_PLAIN must be set for a bundle with page/'
  const soon = () => Math.min(deadline, Date.now() + 20_000)
  const pageUrl = widgetUrl(slug, 'page')
  const origin = `dsh-app://w-${slug}.widget`
  const target = await findWidgetPage(slug, deadline, 'page')
  if (target === undefined) return `no window at ${pageUrl}`
  const onPage = (prefix) => (value) => value.url === pageUrl && value.origin === origin && typeof value.note === 'string'
    && (prefix === undefined ? !value.note.startsWith('next: ') : value.note.startsWith(prefix)) && value.notice === null
  // A replace ends the old entry and promotes the new one, so the runtime sends removed and added, and Electron main
  // opens a new window (widget_fv.replace). The note logs the BrowserWindow id of each step.
  const windowId = `function () { return this.windows.get(${JSON.stringify(slug)})?.window?.id ?? null }`
  const step = async (label, accept) => {
    const read = await pollOrigin(slug, soon(), accept)
    note(`serving ${label}=${JSON.stringify(read.value)} window=${String(await withWidgetWindows(deadline, windowId))}`)
    return read.ok ? undefined : `${label}: ${JSON.stringify(read.value)}`
  }
  const install = async (label, from) => {
    const answer = await tool('widget_install', { dir: from })
    note(`serving install ${label} error=${JSON.stringify(answer.body?.error)} page=${JSON.stringify(answer.body?.page)}`)
    return answer.isError ? `install ${label}: ${JSON.stringify(answer.body?.error)}` : undefined
  }
  let failed = await step('page', onPage())
  if (failed !== undefined) return failed

  const ws = (await findWidgetPage(slug, deadline, 'page'))?.webSocketDebuggerUrl
  const statuses = ws === undefined ? undefined : JSON.parse(String(await evaluate(ws, `Promise.all([
    fetch('/api/widgets/${slug}/program'), fetch('/api/widgets/sample/program'),
  ]).then((answers) => JSON.stringify(answers.map((answer) => answer.status)))`, deadline, true)))
  note(`serving scope own,other=${JSON.stringify(statuses)}`)
  if (statuses?.[0] !== 200 || statuses?.[1] !== 403) return `scope: the program of ${slug} and of sample gave ${JSON.stringify(statuses)}, want [200,403]`

  failed = await checkCsp(slug, ws, deadline)
  if (failed !== undefined) return failed

  failed = await install('next', next) ?? await step('next page', onPage('next: '))
  if (failed !== undefined) return failed
  const shellUrl = widgetUrl(slug, 'shell')
  failed = await install('plain', plain) ?? await step('shared shell', (value) => value.url === shellUrl && value.origin === origin && value.catalog === 'shadcn-widgets@1' && value.notice === null)
  if (failed !== undefined) return failed
  failed = await install('page again', dir) ?? await step('page again', onPage())
  if (failed !== undefined) return failed

  const crash = `function () { const entry = this.windows.get(${JSON.stringify(slug)}); entry.window.webContents.forcefullyCrashRenderer(); return true }`
  const failures = `function () { return this.windows.get(${JSON.stringify(slug)})?.failures?.length ?? -1 }`
  await withWidgetWindows(deadline, crash)
  // The count comes first: once it is 1, the dead renderer is gone and the window loads the page one more time.
  let count
  const counted = soon()
  while (Date.now() < counted && (count = await withWidgetWindows(deadline, failures)) !== 1) await delay(100)
  note(`serving failures after one crash=${String(count)}`)
  if (count !== 1) return `after one crash, Electron main counts ${String(count)} failures, want 1`
  failed = await step('after one crash', onPage())
  if (failed !== undefined) return failed
  await withWidgetWindows(deadline, crash)
  const failedUrl = widgetUrl(slug, 'failed')
  failed = await step('after two crashes', (value) => value.url === failedUrl && value.origin === origin && value.catalog === 'shadcn-widgets@1'
    && typeof value.notice === 'string' && value.notice.includes('failed'))
  if (failed !== undefined) return failed
  // The window keeps the notice until the page state changes. A new stamp of the slug, with no replace, must load the
  // page again in the same window. Main gets the stamp the way the IPC message gives it, with only the stamp changed.
  const before = await withWidgetWindows(deadline, windowId)
  await withWidgetWindows(deadline, `function () {
    const pages = new Map(this.pages.pages)
    pages.set(${JSON.stringify(slug)}, pages.get(${JSON.stringify(slug)}) + '-smoke')
    this.setPages({ root: this.pages.root, pages })
    return true
  }`)
  failed = await step('page in the same window after the notice', onPage())
  if (failed !== undefined) return failed
  const after = await withWidgetWindows(deadline, windowId)
  if (typeof before !== 'number' || after !== before) return `the page change after the notice used window ${String(after)}, not the window ${String(before)} that showed the notice`
  // A new link from an install (a replace opens a new window) also shows the page.
  failed = await install('next after the notice', next) ?? await step('next page after the notice', onPage('next: '))
  if (failed !== undefined) return failed
  return await install('page at the end', dir) ?? await step('page at the end', onPage())
}

async function checkLog(deadline) {
  const folder = join(home, 'deepwidgets')
  const tokenRequest = (port) => rawRequest(port, '/mcp/token', { headers: { 'content-type': 'application/json' }, body: tokenBody('smoke log') })
  let port
  while (port === undefined && Date.now() < deadline) {
    let named
    try { named = JSON.parse(readFileSync(join(folder, 'mcp.json'), 'utf8')).port } catch { named = undefined }
    const ready = typeof named === 'number' ? await tokenRequest(named).catch(() => undefined) : undefined
    if (ready?.status === 200) port = named
    else await delay(500)
  }
  if (port === undefined) return 'log: the MCP port gave no token'
  chmodSync(folder, 0o500)
  let refused
  try {
    refused = await tokenRequest(port)
  } finally {
    chmodSync(folder, 0o700)
  }
  if (refused.status !== 500) return `log: the token request with a read-only folder gave ${String(refused.status)}, not 500`
  const until = Math.min(deadline, Date.now() + 5_000)
  while (Date.now() < until) {
    const line = readFileSync(logPath, 'utf8').split('\n').find((text) => TOKEN_LOG_LINE.test(text))
    if (line !== undefined) {
      note(`log found=${JSON.stringify(line)}`)
      return undefined
    }
    await delay(100)
  }
  return 'log: the output of the app has no ctx.logger line of @deepwidgets/mcp'
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
 * end the registration, and check the removed state. Electron main closes the widget window on `removed`, so the
 * check cuts the events stream of main first: the window stays, and its page gets `removed` from its own stream.
 * (The page can not be read in an iframe of the main window: the widget routes answer with `frame-ancestors 'none'`.)
 * Then the stream of main opens again, and its `hello` closes the window.
 */
async function checkWidgetRemoved(_main, deadline) {
  const slug = `smoke-removed-${Date.now().toString(36)}`
  const title = `removable ${slug}`
  await hostWidgets(deadline, `(widgets, slug, title) => {
    globalThis.__deepwidgetsSmokeRemove = widgets.register({ slug, title, initialState: {},
      program: 'root = Card([CardHeader("' + title + '"), BarChart(["a", "b"], [Series("n", [1, 2])])])', actions: [] })
    return true
  }`, [slug, title])
  const page = await findWidgetPage(slug, deadline)
  if (page === undefined) return `widget removed: no window for ${slug}`
  const ready = await pollWidget(page, Math.min(deadline, Date.now() + 15_000), (value) => value.text.includes(title) && value.dw?.stream === 'open' && value.chart === 2)
  note(`widget second=${JSON.stringify({ ...ready.value, text: ready.value?.text?.slice(0, 120) })}`)
  if (!ready.ok) return `widget removed: the page of ${slug} did not load with its bar chart: ${JSON.stringify({ ...ready.value, text: undefined })}`
  const hellos = await withWidgetWindows(deadline, countHellos())
  await withWidgetWindows(deadline, pauseStream())
  try {
    await hostWidgets(deadline, 'async () => { await globalThis.__deepwidgetsSmokeRemove(); delete globalThis.__deepwidgetsSmokeRemove; return true }', [])
    const removed = await pollWidget(page, Math.min(deadline, Date.now() + 10_000), (value) => value.state === 'state-removed')
    if (!removed.ok) return `widget removed: no removed state: ${JSON.stringify(removed.value?.dw ?? removed.value)}`
    // A page that opens the stream again would log connect and closed after removed within this wait (backoff 250 ms).
    await delay(3000)
    const after = await pollWidget(page, Math.min(deadline, Date.now() + 5000), () => true)
    const events = after.value?.dw?.events ?? []
    const tail = events.slice(events.lastIndexOf('removed') + 1)
    note(`widget removed events=${JSON.stringify(events)} state=${String(after.value?.state)}`)
    if (after.value?.state !== 'state-removed') return `widget removed: the removed state did not stay: ${String(after.value?.state)}`
    if (tail.length > 0) return `widget removed: the page kept using the stream after removed: ${JSON.stringify(tail)}`
  } finally {
    await withWidgetWindows(deadline, resumeStream())
  }
  const hello = await waitHello(hellos, Math.min(deadline, Date.now() + 15_000))
  if (hello !== undefined) return `widget removed: ${hello}`
  const closed = await waitPages(widgetUrl(slug), 0, Math.min(deadline, Date.now() + 10_000), 'the window of the removed widget')
  return closed ?? checkSlugOrigins(deadline)
}

/**
 * agent_library.serving.origins: a slug that starts with `xn--`, a slug that ends with `-`, and a slug of 63 characters
 * each get a window that loads at the widget origin of the slug. The check registers each widget over the Loader,
 * finds its window, reads its program and its stream, and ends the registration.
 */
async function checkSlugOrigins(deadline) {
  for (const slug of ['xn--abc', 'a-', 'o'.repeat(63)]) {
    const title = `origin ${slug.slice(0, 12)}`
    await hostWidgets(deadline, `(widgets, slug, title) => {
      globalThis.__deepwidgetsSmokeOrigin = widgets.register({ slug, title, initialState: {}, program: 'root = Card([CardHeader("' + title + '")])', actions: [] })
      return true
    }`, [slug, title])
    const page = await findWidgetPage(slug, Math.min(deadline, Date.now() + 15_000))
    const read = page === undefined ? undefined : await pollWidget(page, Math.min(deadline, Date.now() + 15_000), (value) => value.text.includes(title) && value.dw?.stream === 'open')
    let origin
    if (page !== undefined) origin = await evaluate(page.webSocketDebuggerUrl, 'location.origin', deadline)
    note(`origins ${slug} page=${String(page?.url)} origin=${String(origin)} ok=${String(read?.ok)}`)
    await hostWidgets(deadline, 'async () => { await globalThis.__deepwidgetsSmokeOrigin(); delete globalThis.__deepwidgetsSmokeOrigin; return true }', [])
    if (page === undefined) return `origins: no window at ${widgetUrl(slug)}`
    if (read?.ok !== true) return `origins: the window of ${slug} did not load: ${JSON.stringify({ ...read?.value, text: read?.value?.text?.slice(0, 80) })}`
    if (origin !== `dsh-app://w-${slug}.widget`) return `origins: the page of ${slug} has the origin ${String(origin)}`
    const closed = await waitPages(widgetUrl(slug), 0, Math.min(deadline, Date.now() + 10_000), `the window of ${slug}`)
    if (closed !== undefined) return closed
  }
  return undefined
}

/** Read the page of main: the core diagnostics, the problems that it shows, and each widget row. */
function mainReadExpression() {
  return `JSON.stringify({
  dw: window.__dw === undefined ? null : { catalog: window.__dw.catalog, state: window.__dw.state, stream: window.__dw.stream, streamOpens: window.__dw.streamOpens, refreshes: window.__dw.refreshes, errors: window.__dw.errors },
  problems: [...document.querySelectorAll('[data-dw=state-error], [data-dw=query-error], [data-dw=main-problem], [data-dw=control-error]')].map((node) => node.textContent),
  tabs: [...document.querySelectorAll('[data-dw=tab]')].map((node) => node.textContent),
  rows: [...document.querySelectorAll('[data-dw=widget-row]')].map((row) => ({
    slug: row.dataset.slug,
    open: row.dataset.open,
    rev: row.querySelector('[data-dw=state-rev]')?.dataset.rev ?? null,
    status: row.querySelector('[data-dw=status]')?.dataset.kind ?? null,
    viewer: row.querySelector('[data-dw=state-viewer]') !== null,
    turnOff: row.querySelector('[data-dw=turn-off]') !== null,
    turnOn: row.querySelector('[data-dw=turn-on]') !== null,
    remove: row.querySelector('[data-dw=remove]') !== null,
    window: row.querySelector('[data-dw=window]')?.dataset.window ?? null,
    windowText: row.querySelector('[data-dw=window]')?.textContent ?? null,
    show: row.querySelector('[data-dw=show]') !== null,
    hide: row.querySelector('[data-dw=hide]') !== null,
  })),
})`
}

/** Whether the floating window of `slug` shows in Electron main, or null when it has no window. */
function windowShown(slug, deadline) {
  return withWidgetWindows(deadline, `function () {
    const entry = this.windows.get(${JSON.stringify(slug)})
    return entry === undefined || entry.window.isDestroyed() ? null : entry.window.isVisible()
  }`)
}

/** Poll until the floating window of `slug` shows (`want` true) or is hidden (false). Gives the last value. */
async function waitWindowShown(slug, want, until) {
  let shown
  while (Date.now() < until) {
    shown = await windowShown(slug, until)
    if (shown === want) return shown
    await delay(200)
  }
  return shown
}

/** Poll the page of main until `accept` takes the read value. */
async function pollMain(target, until, accept) {
  let last
  while (Date.now() < until) {
    try {
      last = JSON.parse(String(await evaluate(target.webSocketDebuggerUrl, mainReadExpression(), until)))
      if (accept(last)) return { value: last, ok: true }
    } catch (error) {
      last = { error: error instanceof Error ? error.message : 'evaluate failed' }
    }
    await delay(250)
  }
  return { value: last, ok: false }
}

/** Click the first element at `selector` in the page of main. Gives false when there is none. */
async function clickMain(target, selector, deadline) {
  return evaluate(target.webSocketDebuggerUrl, `(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (node === null) return false; node.click(); return true })()`, deadline)
}

/** Save a PNG of the open panel with webContents.capturePage(). Gives the path. */
async function shootMain(name, deadline, folder = MAIN_SHOTS) {
  const data = await withMenuBar(deadline, `async function () {
    const image = await this.panel.webContents.capturePage()
    return image.isEmpty() ? null : image.toPNG().toString('base64')
  }`)
  if (typeof data !== 'string') throw new Error(`main: the capture of ${name} is empty`)
  await mkdir(folder, { recursive: true })
  const path = join(folder, name)
  writeFileSync(path, Buffer.from(data, 'base64'))
  note(`main screenshot=${path} bytes=${String(Math.round(data.length * 3 / 4))}`)
  return path
}

/**
 * fanout_query_blocks_writes: 100 state writes of sample in a row, then a burst of 100 parallel writes, timed in the host.
 * Gives the time of the writes in a row, the failures of the burst, and the first failure text.
 */
function sampleWrites(deadline) {
  return hostWidgets(deadline, `async (widgets) => {
    const add = (by) => widgets.update('sample', (state) => ({ count: state.count + 1 }), { by })
    const started = Date.now()
    for (let i = 0; i < 100; i += 1) await add('smoke-main-row')
    const sequentialMs = Date.now() - started
    const burst = await Promise.allSettled(Array.from({ length: 100 }, () => add('smoke-main-burst')))
    const failed = burst.filter((result) => result.status === 'rejected').map((result) => String(result.reason?.message ?? result.reason))
    return { sequentialMs, burstMs: Date.now() - started - sequentialMs, failures: failed.length, first: failed[0] ?? null }
  }`, [])
}

/**
 * With the page of main open, the writes must stay fast: the writes in a row take at most 3 times the time with the page
 * closed (a floor of 200 ms keeps a tiny baseline from failing on noise), and the burst gives no failure. The frames to
 * main are merged (one in 250 ms), so the page refreshes at most once for each 250 ms of writes, plus the trailing frame.
 */
async function checkMainWrites(target, closed, deadline) {
  const refreshes = async () => JSON.parse(String(await evaluate(target.webSocketDebuggerUrl, mainReadExpression(), deadline))).dw?.refreshes ?? 0
  const before = await refreshes()
  const open = await sampleWrites(deadline)
  await delay(800)
  const counted = await refreshes() - before
  const limitMs = 3 * Math.max(closed.sequentialMs, 200)
  const maxRefreshes = Math.floor((open.sequentialMs + open.burstMs) / 250) + 3
  note(`main writes closed=${JSON.stringify(closed)} open=${JSON.stringify(open)} refreshes=${String(counted)} limitMs=${String(limitMs)} maxRefreshes=${String(maxRefreshes)}`)
  if (closed.failures > 0) return `main: with the page closed, ${String(closed.failures)} of 100 parallel writes failed: ${String(closed.first)}`
  if (open.failures > 0) return `main: with the page open, ${String(open.failures)} of 100 parallel writes failed: ${String(open.first)}`
  if (open.sequentialMs > limitMs) return `main: with the page open, 100 writes in a row took ${String(open.sequentialMs)} ms, more than ${String(limitMs)} ms (3 times ${String(closed.sequentialMs)} ms closed)`
  if (counted > maxRefreshes) return `main: the page refreshed ${String(counted)} times for 200 writes, more than ${String(maxRefreshes)}: the frames to main are not merged`
  return undefined
}

/**
 * A wrapper of EventSource for the page of main: `cut()` closes each stream as a drop of the connection does, and
 * `blocked` sends each new stream to a path that has no stream, so it fails and the page backs off and retries.
 */
function streamCutSource() {
  return `(() => {
  const Native = window.EventSource
  const control = { blocked: false, live: new Set() }
  control.cut = () => { for (const source of [...control.live]) { source.close(); source.dispatchEvent(new Event('error')) } }
  window.__dwSmokeStream = control
  window.EventSource = class extends Native {
    constructor(url, init) {
      const text = String(url)
      super(control.blocked ? text.replace(/\\/stream(?=$|\\?)/, '/smoke-blocked') : text, init)
      control.live.add(this)
    }
    close() { control.live.delete(this); super.close() }
  }
})()`
}

/**
 * hello_catchup_unchecked: the page of main loads again with streamCutSource(). The check cuts the stream of main and
 * keeps it down, writes sample, and checks that the row keeps the old rev: the frame of that write reached no stream.
 * Then the stream opens again. Its `hello` names only the rev of main, so only the `data` frame after the `hello` can
 * bring the new rev of sample into the row.
 */
async function checkMainCatchUp(target, deadline) {
  const soon = () => Math.min(deadline, Date.now() + 20_000)
  const sampleRow = (value) => value.rows?.find((row) => row.slug === 'sample')
  const session = await cdpSession(target.webSocketDebuggerUrl, deadline)
  let ready
  try {
    await cdpCall(session, 'Page.enable', {})
    await cdpCall(session, 'Page.addScriptToEvaluateOnNewDocument', { source: streamCutSource() })
    await cdpCall(session, 'Page.reload', {})
    // The session stays open until the new document runs the script.
    ready = await pollMain(target, soon(), (value) => value.dw?.stream === 'open' && /^\d+$/u.test(sampleRow(value)?.rev ?? ''))
  } finally {
    session.close()
  }
  const wrapped = await evaluate(target.webSocketDebuggerUrl, "typeof window.__dwSmokeStream?.cut === 'function'", deadline)
  note(`main catch-up ready=${JSON.stringify(sampleRow(ready.value ?? {}))} wrapped=${String(wrapped)}`)
  if (!ready.ok || wrapped !== true) return `main catch-up: the page did not load again with the stream wrapper: ${JSON.stringify(ready.value)}`
  const opensBefore = ready.value.dw.streamOpens ?? 0
  const revBefore = sampleRow(ready.value).rev
  await evaluate(target.webSocketDebuggerUrl, 'window.__dwSmokeStream.blocked = true; window.__dwSmokeStream.cut(); true', deadline)
  await delay(300)
  const written = await hostWidgets(deadline, `async (widgets) => {
    await widgets.update('sample', (state) => ({ count: state.count + 1 }), { by: 'smoke-main-catch-up' })
    return widgets.get('sample').rev
  }`, [])
  // The frame to main trails a change by 250 ms. With the stream down, it reaches no page.
  await delay(1000)
  const down = await pollMain(target, soon(), () => true)
  note(`main catch-up down=${JSON.stringify({ row: sampleRow(down.value), stream: down.value?.dw?.stream, written })}`)
  if (sampleRow(down.value)?.rev !== revBefore) return `main catch-up: the row changed while the stream was down, so the check proves nothing: ${JSON.stringify(sampleRow(down.value))}`
  await evaluate(target.webSocketDebuggerUrl, 'window.__dwSmokeStream.blocked = false; true', deadline)
  const back = await pollMain(target, soon(), (value) => sampleRow(value)?.rev === String(written))
  note(`main catch-up back=${JSON.stringify({ row: sampleRow(back.value), dw: back.value?.dw })}`)
  if (!back.ok) return `main catch-up: after the stream came back, the row of sample did not show rev ${String(written)}: ${JSON.stringify(sampleRow(back.value) ?? back.value)}`
  if ((back.value.dw?.streamOpens ?? 0) <= opensBefore) return `main catch-up: the row changed, but the stream did not open again: ${JSON.stringify(back.value.dw)}`
  return undefined
}

/** Read the menu bar of Electron main: its pid, the Dock state, the icon, the menu, and the panel. */
function menuBarReadDeclaration() {
  return `function () {
    const panel = this.panel
    return {
      pid: process.pid,
      execPath: process.execPath,
      dock: this.menubar.app.dock?.isVisible() ?? null,
      tray: { destroyed: this.tray.isDestroyed(), bounds: this.tray.getBounds() },
      items: this.contextMenu.items.filter((item) => item.type !== 'separator').map((item) => item.label),
      panel: panel === undefined || panel.isDestroyed() ? null : {
        visible: panel.isVisible(), focused: panel.isFocused(), bounds: panel.getBounds(), url: panel.webContents.getURL(),
        allSpaces: panel.isVisibleOnAllWorkspaces(), resizable: panel.isResizable(),
      },
    }
  }`
}

/** Poll the menu bar until `accept` takes the read value. */
async function pollMenuBar(until, accept) {
  let last
  while (Date.now() < until) {
    try {
      last = await withMenuBar(until, menuBarReadDeclaration())
      if (accept(last)) return { value: last, ok: true }
    } catch (error) {
      last = { error: error instanceof Error ? error.message : 'menu bar read failed' }
    }
    await delay(150)
  }
  return { value: last, ok: false }
}

/**
 * The Dock has no icon: macOS lists Electron main as a UIElement app (`lsappinfo`), and app.dock.isVisible() is false.
 * Gives the failure text, or undefined.
 */
async function checkNoDock(state, when) {
  const info = await capture('lsappinfo', ['info', String(state.pid)])
  const type = /type="(\w+)"/u.exec(info.stdout)?.[1]
  note(`main dock ${when}: lsappinfo type=${String(type)} app.dock.isVisible=${String(state.dock)}`)
  if (type !== 'UIElement' || state.dock !== false) return `main: the Dock has an icon ${when}: lsappinfo type ${String(type)}, app.dock.isVisible ${String(state.dock)}`
  return undefined
}

/** The pid of the app in front, from `lsappinfo front`, or undefined. */
async function frontPid() {
  const asn = (await capture('lsappinfo', ['front'])).stdout.trim()
  if (asn === '') return undefined
  return /pid = (\d+)/u.exec((await capture('lsappinfo', ['info', '-only', 'pid', asn])).stdout)?.[1]
}

/** A programmatic click on the menu bar icon: the click event of the Tray, with the bounds of the icon. */
function clickIconDeclaration() {
  return "function () { this.tray.emit('click', { altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, triggeredByAccessibility: false }, this.tray.getBounds()); return true }"
}

/**
 * Launch the app a second time with the launcher of the dev app, next to the executable of Electron main. The second
 * process finds the single-instance lock taken and quits; the first one gets `second-instance`.
 */
async function launchAgain(execPath, until) {
  const launcher = join(execPath, '..', 'HarnessDev')
  if (!existsSync(launcher)) return { error: `no launcher at ${launcher}` }
  const second = spawn(launcher, [], { cwd: root, detached: true, stdio: ['ignore', logFd, logFd], env: appEnv })
  if (second.pid !== undefined) {
    addGroup(String(second.pid))
    groupWatcher?.stdin.write(`${String(second.pid)}\n`)
  }
  const exit = await new Promise((resolve) => {
    const timer = setTimeout(() => { resolve({ timeout: true }) }, Math.max(1, until - Date.now()))
    second.once('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal }) })
    second.once('error', (error) => { clearTimeout(timer); resolve({ error: error.message }) })
  })
  note(`main second launch pid=${String(second.pid)} exit=${JSON.stringify(exit)}`)
  return exit
}

/**
 * The menu bar app and its panel (main_widget.menu_bar, main_widget.panel): no Dock icon, one icon, a click opens the
 * panel with the page of main, a click closes it, the menu opens it, a loss of focus closes it, and a second launch
 * opens it. The page checks of main.page run in the open panel.
 */
async function checkMain(deadline) {
  const soon = () => Math.min(deadline, Date.now() + 15_000)
  if (await findWidgetPage('sample', deadline) === undefined) return 'main: no window of sample'
  const start = await pollMenuBar(soon(), (value) => value.panel?.url === MAIN_PAGE_URL)
  note(`main menu bar start=${JSON.stringify(start.value)}`)
  if (!start.ok) return `main: no panel at ${MAIN_PAGE_URL}: ${JSON.stringify(start.value)}`
  const atStart = start.value
  const dockStart = await checkNoDock(atStart, 'at start')
  if (dockStart !== undefined) return dockStart
  if (atStart.tray.destroyed || !(atStart.tray.bounds.width > 0 && atStart.tray.bounds.height > 0)) return `main: no menu bar icon: ${JSON.stringify(atStart.tray)}`
  if (JSON.stringify(atStart.items) !== '["Open deepWidgets","Quit deepWidgets"]') return `main: the menu of the icon is ${JSON.stringify(atStart.items)}`
  if (atStart.panel.visible) return 'main: the panel shows before a click'

  // The baseline of the writes, with no page of main: the hidden panel shows about:blank for the time of the measure.
  await withMenuBar(deadline, "async function () { await this.panel.webContents.loadURL('about:blank'); return true }")
  const closed = await sampleWrites(deadline)
  await withMenuBar(deadline, `async function () { await this.panel.webContents.loadURL(${JSON.stringify(MAIN_PAGE_URL)}); return true }`)

  // A click on the icon opens the panel under the icon, with key focus.
  await withMenuBar(deadline, clickIconDeclaration())
  const opened = await pollMenuBar(soon(), (value) => value.panel?.visible === true)
  note(`main panel after click=${JSON.stringify(opened.value?.panel)}`)
  if (!opened.ok) return `main: a click on the icon did not open the panel: ${JSON.stringify(opened.value)}`
  const { panel, tray } = opened.value
  if (panel.bounds.width !== 420 || panel.bounds.height !== 600 || panel.resizable) return `main: the panel is not 420 by 600 and fixed: ${JSON.stringify(panel)}`
  // The panel top is the top of the work area, at the bottom of the menu bar; the icon button can be a few pixels taller.
  const iconCenter = tray.bounds.x + tray.bounds.width / 2
  if (Math.abs(panel.bounds.y - (tray.bounds.y + tray.bounds.height)) > 8 || iconCenter < panel.bounds.x || iconCenter > panel.bounds.x + panel.bounds.width) {
    return `main: the panel is not under the icon: panel ${JSON.stringify(panel.bounds)}, icon ${JSON.stringify(tray.bounds)}`
  }
  if (!panel.allSpaces) return 'main: the panel is not on all Spaces'
  const focused = await pollMenuBar(soon(), (value) => value.panel?.focused === true)
  if (!focused.ok) return `main: the open panel has no focus: ${JSON.stringify(focused.value?.panel)}`

  let target
  while (target === undefined && Date.now() < soon()) {
    const targets = await (await fetch(`http://127.0.0.1:${String(rendererPort)}/json/list`, { signal: AbortSignal.timeout(2000) })).json().catch(() => [])
    target = targets.find((item) => item?.type === 'page' && item.url === MAIN_PAGE_URL && typeof item.webSocketDebuggerUrl === 'string')
    if (target === undefined) await delay(250)
  }
  if (target === undefined) return `main: no page at ${MAIN_PAGE_URL}`
  // smoke_main_needs_focus: another app on this shared Mac can take the focus during the page checks, so the panel
  // keeps showing until they end. The check then sets the option back to the value of the app, so the mutant with no
  // hide on a loss of focus still fails at the focus step.
  const hideOnBlur = await withMenuBar(deadline, "function () { const value = this.menubar.getOption('hideOnBlur'); this.menubar.setOption('hideOnBlur', false); return value ?? null }")
  let page
  try {
    page = await checkMainPage(target, closed, deadline) ?? await checkMainSettings(target, deadline)
  } finally {
    await withMenuBar(deadline, `function () { this.menubar.setOption('hideOnBlur', ${JSON.stringify(hideOnBlur)} ?? undefined); return true }`)
  }
  if (page !== undefined) return page

  // A click when the panel is open closes it.
  await withMenuBar(deadline, clickIconDeclaration())
  const toggled = await pollMenuBar(soon(), (value) => value.panel?.visible === false)
  note(`main panel after second click=${JSON.stringify(toggled.value?.panel)}`)
  if (!toggled.ok) return `main: a click on the icon did not close the open panel: ${JSON.stringify(toggled.value)}`
  // panel_close_keeps_focus: the keys go back to another app, and the floating window of sample still shows.
  let front
  for (const until = Math.min(deadline, Date.now() + 5000); Date.now() < until; await delay(200)) {
    front = await frontPid()
    if (front !== undefined && front !== String(atStart.pid)) break
  }
  const sampleShown = await withWidgetWindows(deadline, "function () { return this.windows.get('sample')?.window?.isVisible() ?? null }")
  note(`main after the close: front pid=${String(front)} app pid=${String(atStart.pid)} sample window shown=${String(sampleShown)}`)
  if (front === undefined || front === String(atStart.pid)) return `main: after a click closed the panel, the app is still in front (pid ${String(front)})`
  if (sampleShown !== true) return `main: after a click closed the panel, the window of sample does not show (${String(sampleShown)})`

  // "Open deepWidgets" in the menu of the icon opens the panel.
  await withMenuBar(deadline, "function () { this.contextMenu.items.find((item) => item.label === 'Open deepWidgets').click(); return true }")
  const menuOpened = await pollMenuBar(soon(), (value) => value.panel?.visible === true && value.panel.focused === true)
  note(`main panel after Open deepWidgets=${JSON.stringify(menuOpened.value?.panel)}`)
  if (!menuOpened.ok) return `main: Open deepWidgets did not open the panel with focus: ${JSON.stringify(menuOpened.value)}`

  // A loss of focus closes it: another window takes the focus.
  try {
    const other = await withMenuBar(deadline, `async function () {
      const other = new (this.panel.constructor)({ width: 240, height: 120, show: false, title: 'deepWidgets smoke focus' })
      globalThis.__deepwidgetsSmokeFocus = other
      other.show()
      other.focus()
      await new Promise((done) => { setTimeout(done, 300) })
      return { otherFocused: other.isFocused() }
    }`)
    const blurred = await pollMenuBar(Math.min(deadline, Date.now() + 5000), (value) => value.panel?.visible === false)
    note(`main panel after loss of focus=${JSON.stringify({ other, panel: blurred.value?.panel })}`)
    if (!blurred.ok) return `main: the panel did not close when it lost focus: ${JSON.stringify({ other, panel: blurred.value?.panel })}`
  } finally {
    await withMenuBar(deadline, 'function () { globalThis.__deepwidgetsSmokeFocus?.destroy(); delete globalThis.__deepwidgetsSmokeFocus; return true }').catch(() => undefined)
  }

  // A second launch opens the panel (widget.relaunch), on the Widgets tab (main_widget.provisional,
  // second_launch_keeps_tab). The hidden panel shows the Settings tab before it.
  await pressMainTab(target, 1, deadline)
  const tabBefore = await activeMainTab(target, deadline)
  if (tabBefore !== 'Settings') return `main: the hidden panel did not switch to Settings before the second launch: ${String(tabBefore)}`
  const second = await launchAgain(atStart.execPath, Math.min(deadline, Date.now() + 60_000))
  if (second.code !== 0) return `main: the second launch did not exit by itself with 0: ${JSON.stringify(second)}`
  const relaunched = await pollMenuBar(soon(), (value) => value.panel?.visible === true)
  note(`main panel after second launch=${JSON.stringify(relaunched.value?.panel)}`)
  if (!relaunched.ok) return `main: a second launch did not open the panel: ${JSON.stringify(relaunched.value)}`
  let tabAfter
  for (const until = soon(); Date.now() < until; await delay(200)) {
    tabAfter = await activeMainTab(target, deadline)
    if (tabAfter === 'Widgets') break
  }
  note(`main tab after second launch=${String(tabAfter)}`)
  if (tabAfter !== 'Widgets') return `main: a second launch opened the panel on the tab ${String(tabAfter)}, not on Widgets`

  const dockEnd = await checkNoDock(relaunched.value, 'after the panel opened')
  if (dockEnd !== undefined) return dockEnd
  await withMenuBar(deadline, clickIconDeclaration())
  const closedAtEnd = await pollMenuBar(soon(), (value) => value.panel?.visible === false)
  if (!closedAtEnd.ok) return `main: the panel did not close at the end: ${JSON.stringify(closedAtEnd.value)}`
  return undefined
}

/** Press the tab `index` of the page of main. Radix activates a tab on mousedown. */
function pressMainTab(target, index, deadline) {
  return evaluate(target.webSocketDebuggerUrl, `(() => {
    document.querySelectorAll('[data-dw=tab]')[${String(index)}]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    return true
  })()`, deadline)
}

/** The title of the active tab of the page of main. */
function activeMainTab(target, deadline) {
  return evaluate(target.webSocketDebuggerUrl, "document.querySelector('[data-dw=tab][data-state=active]')?.textContent ?? null", deadline)
}

/** Read the Settings tab of the page of main (main_widget.settings). */
function settingsReadExpression() {
  return `JSON.stringify({
  active: document.querySelector('[data-dw=tab][data-state=active]')?.textContent ?? null,
  modes: [...document.querySelectorAll('[data-dw=mode]')].map((row) => {
    const control = row.querySelector('[data-dw=mode-switch]')
    return { mode: row.dataset.mode, checked: control?.getAttribute('aria-checked') ?? null, disabled: control?.disabled ?? null, always: row.querySelector('[data-dw=mode-always-on]') !== null }
  }),
  modesDone: Number(document.querySelector('[data-dw=settings-modes]')?.dataset.done ?? 'NaN'),
  modesBusy: document.querySelector('[data-dw=settings-modes]')?.dataset.busy ?? null,
  settingsFile: document.querySelector('[data-dw=settings-file]')?.textContent ?? null,
  settingsError: document.querySelector('[data-dw=settings-error]')?.textContent ?? null,
  agents: document.querySelector('[data-dw=agents-note]')?.textContent ?? null,
  port: document.querySelector('[data-dw=mcp-port]')?.textContent ?? null,
  portFile: document.querySelector('[data-dw=mcp-port-file]')?.textContent ?? null,
  copies: [...document.querySelectorAll('[data-dw=copy-port], [data-dw=copy-port-file]')].map((node) => node.dataset.dw),
  login: (() => { const node = document.querySelector('[data-dw=login-switch]'); return node === null ? null : { checked: node.getAttribute('aria-checked'), disabled: node.disabled } })(),
  loginNote: document.querySelector('[data-dw=login-note]')?.textContent ?? null,
  loginStatus: document.querySelector('[data-dw=login-status]')?.textContent ?? null,
  problems: [...document.querySelectorAll('[data-dw=main-problem], [data-dw=control-error], [data-dw=query-error], [data-dw=state-error]')].map((node) => node.textContent),
})`
}

/** Poll the Settings tab until `accept` takes the read value. */
async function pollSettings(target, until, accept) {
  let last
  while (Date.now() < until) {
    try {
      last = JSON.parse(String(await evaluate(target.webSocketDebuggerUrl, settingsReadExpression(), until)))
      if (accept(last)) return { value: last, ok: true }
    } catch (error) {
      last = { error: error instanceof Error ? error.message : 'evaluate failed' }
    }
    await delay(250)
  }
  return { value: last, ok: false }
}

/** Run `declaration` with `this` set to the one DesktopLoginItem instance of Electron main. Its `app` is the Electron app. */
function withLoginItem(deadline, declaration) {
  return withMainInstance('DesktopLoginItem', 'answer', deadline, declaration)
}

/** The settings file of the run, parsed, or the reason that it could not be read. */
function settingsFileValue() {
  try {
    return JSON.parse(readFileSync(join(home, 'deepwidgets', 'settings.json'), 'utf8'))
  } catch (error) {
    return { unreadable: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * The Settings tab of main in the open panel (main_widget.settings). It shows the MCP modes with interact always on, the
 * note of the approved agents, the port and the path of mcp.json with copy buttons, and, in this dev run, the
 * launch-at-login switch off and disabled with its note. A set of the login item through main refuses with dev-run,
 * Electron main calls no setLoginItemSettings (a recorder stands in for it during the check), and macOS has no login
 * item for the dev app. The switch of create turns create off: widget_install gives mode-off, and the settings file has
 * "create": false. The switch turns create on again, and the install works.
 */
async function checkMainSettings(target, deadline) {
  const soon = () => Math.min(deadline, Date.now() + 15_000)
  const settingsFile = join(home, 'deepwidgets', 'settings.json')
  const portFile = join(home, 'deepwidgets', 'mcp.json')
  const create = (value) => value.modes?.find((mode) => mode.mode === 'create')
  await pressMainTab(target, 1, deadline)
  const shown = await pollSettings(target, soon(), (value) => value.active === 'Settings' && create(value)?.checked === 'true' && value.port !== null && value.login !== null)
  note(`main settings first=${JSON.stringify(shown.value)}`)
  if (!shown.ok) return `main settings: the Settings tab did not show the modes, the port, and the login item: ${JSON.stringify(shown.value)}`
  const read = shown.value
  const mcpFile = JSON.parse(readFileSync(portFile, 'utf8'))
  if (read.problems.length > 0) return `main settings: the tab shows a problem: ${JSON.stringify(read.problems)}`
  const modes = read.modes.map((mode) => `${mode.mode}:${mode.always ? 'always' : String(mode.checked)}`)
  if (JSON.stringify(modes) !== '["interact:always","create:true","library:true"]') return `main settings: the modes are ${JSON.stringify(modes)}`
  if (read.settingsFile !== settingsFile) return `main settings: the settings file is ${String(read.settingsFile)}, not ${settingsFile}`
  if (read.agents === null || !read.agents.includes('not built yet')) return `main settings: no note of the approved agents: ${String(read.agents)}`
  if (read.port !== String(mcpFile.port) || read.portFile !== portFile) return `main settings: the tab shows the port ${String(read.port)} at ${String(read.portFile)}, mcp.json has ${String(mcpFile.port)} at ${portFile}`
  if (JSON.stringify(read.copies) !== '["copy-port","copy-port-file"]') return `main settings: the copy buttons are ${JSON.stringify(read.copies)}`
  if (read.login.checked !== 'false' || read.login.disabled !== true || read.loginNote === null || !read.loginNote.includes('packaged app')) {
    return `main settings: in a dev run, the launch-at-login switch must be off and disabled with its note: ${JSON.stringify({ login: read.login, note: read.loginNote })}`
  }

  // A dev run never registers a login item: a set through main refuses, and Electron main calls no setLoginItemSettings.
  await withLoginItem(deadline, `function () {
    const app = this.app
    globalThis.__deepwidgetsSmokeLogin = { calls: [], own: Object.getOwnPropertyDescriptor(app, 'setLoginItemSettings') }
    app.setLoginItemSettings = (...args) => { globalThis.__deepwidgetsSmokeLogin.calls.push(args) }
    return true
  }`)
  let login
  try {
    await clickMain(target, '[data-dw=login-switch]', deadline)
    const refused = JSON.parse(String(await evaluate(target.webSocketDebuggerUrl, `(async () => {
      const answer = await fetch('/api/widgets/main/call', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'setLoginItem', args: { open: true } }) })
      return JSON.stringify({ status: answer.status, body: await answer.json() })
    })()`, deadline, true)))
    await delay(300)
    login = await withLoginItem(deadline, `function () {
      const settings = this.app.getLoginItemSettings({ type: 'mainAppService' })
      return { calls: globalThis.__deepwidgetsSmokeLogin.calls.length, openAtLogin: settings.openAtLogin, status: settings.status ?? null }
    }`)
    note(`main settings login refused=${JSON.stringify(refused)} electron=${JSON.stringify(login)} shown=${String(read.loginStatus)}`)
    if (refused.body?.ok !== true || refused.body.result?.ok !== false || refused.body.result.code !== 'dev-run') return `main settings: a set of the login item in a dev run did not refuse with dev-run: ${JSON.stringify(refused)}`
  } finally {
    await withLoginItem(deadline, `function () {
      const saved = globalThis.__deepwidgetsSmokeLogin
      if (saved?.own === undefined) delete this.app.setLoginItemSettings
      else Object.defineProperty(this.app, 'setLoginItemSettings', saved.own)
      delete globalThis.__deepwidgetsSmokeLogin
      return true
    }`).catch(() => undefined)
  }
  if (login.calls !== 0) return `main settings: Electron main called setLoginItemSettings ${String(login.calls)} times in a dev run`
  if (login.openAtLogin !== false || login.status === 'enabled' || login.status === 'requires-approval') return `main settings: macOS has a login item for the dev app: ${JSON.stringify(login)}`
  if (read.loginStatus !== login.status) return `main settings: the tab shows the status ${String(read.loginStatus)}, macOS gives ${String(login.status)}`
  await shootMain('settings.png', deadline, SETTINGS_SHOTS)

  // The switch of create writes the settings file, and the next widget_install reads it.
  const call = await mcpClient(deadline)
  const tool = async (name, args) => {
    const result = await call('tools/call', { name, arguments: args })
    return { isError: result?.isError === true, body: result?.structuredContent ?? JSON.parse(result?.content?.[0]?.text ?? 'null') }
  }
  const template = await tool('widget_template', { slug: 'smoke-settings', title: 'Smoke Settings' })
  const dir = join(temp, 'smoke-settings')
  for (const file of template.body?.files ?? []) {
    await mkdir(join(dir, file.path, '..'), { recursive: true })
    writeFileSync(join(dir, file.path), file.text)
  }
  if (!existsSync(join(dir, 'src', 'index.ts'))) return `main settings: widget_template gave no src/index.ts: ${JSON.stringify(template.body).slice(0, 300)}`
  const turn = async () => {
    const before = (await pollSettings(target, soon(), () => true)).value?.modesDone
    if (await clickMain(target, '[data-dw=mode-switch][data-mode=create]', deadline) !== true) return 'no switch of create'
    const ended = await pollSettings(target, soon(), (value) => value.modesDone === before + 1 && value.modesBusy === 'false')
    return ended.ok ? undefined : `the call of the switch did not end: ${JSON.stringify(ended.value)}`
  }
  const off = await turn()
  if (off !== undefined) return `main settings: create off: ${off}`
  const refused = await tool('widget_install', { dir })
  const fileOff = settingsFileValue()
  note(`main settings create off install=${JSON.stringify(refused.body?.error ?? refused.body?.application)} file=${JSON.stringify(fileOff)}`)
  if (!refused.isError || refused.body?.error?.code !== 'mode-off') {
    if (!refused.isError) await tool('widget_remove', { slug: 'smoke-settings' }).catch(() => undefined)
    return `main settings: with create off in the Settings tab, widget_install still works: ${JSON.stringify(refused.body?.error ?? refused.body?.application)}`
  }
  if (fileOff?.modes?.create !== false) return `main settings: with create off, the settings file is ${JSON.stringify(fileOff)}`
  const offShown = await pollSettings(target, soon(), (value) => create(value)?.checked === 'false')
  if (!offShown.ok) return `main settings: the switch of create does not show off: ${JSON.stringify(offShown.value)}`
  const on = await turn()
  if (on !== undefined) return `main settings: create on: ${on}`
  const fileOn = settingsFileValue()
  const installed = await tool('widget_install', { dir })
  note(`main settings create on install=${JSON.stringify(installed.body?.error ?? installed.body?.application)} file=${JSON.stringify(fileOn)}`)
  if (fileOn?.modes?.create !== true) return `main settings: with create on, the settings file is ${JSON.stringify(fileOn)}`
  if (installed.isError || installed.body?.application !== 'applied') return `main settings: with create on again, widget_install failed: ${JSON.stringify(installed.body?.error ?? installed.body)}`
  const removed = await tool('widget_remove', { slug: 'smoke-settings' })
  if (removed.isError) return `main settings: widget_remove of smoke-settings failed: ${JSON.stringify(removed.body?.error)}`
  const onShown = await pollSettings(target, soon(), (value) => create(value)?.checked === 'true' && value.problems.length === 0)
  if (!onShown.ok) return `main settings: the switch of create does not show on, or the tab shows a problem: ${JSON.stringify(onShown.value)}`
  const kit = await checkMainKit(target, deadline)
  if (kit !== undefined) return kit
  await pressMainTab(target, 0, deadline)
  return undefined
}

/** Read the section "Widget kit" of the Settings tab (kit.pane.view), or null when the page has no such section. */
function kitReadExpression() {
  return `JSON.stringify((() => {
  const section = document.querySelector('[data-dw=settings-kit]')
  if (section === null) return null
  const last = section.querySelector('[data-dw=kit-last]')
  const off = (selector) => [...section.querySelectorAll(selector)].map((node) => node.disabled)
  return {
    status: section.querySelector('[data-dw=kit-status]')?.dataset.status ?? null,
    version: section.querySelector('[data-dw=kit-version]')?.textContent ?? null,
    core: [...section.querySelectorAll('[data-dw=kit-core]')].map((row) => ({ name: row.dataset.name, lock: row.querySelector('[data-dw=kit-lock]') !== null })),
    extras: [...section.querySelectorAll('[data-dw=kit-extra]')].map((row) => row.dataset.name),
    refuse: [...section.querySelectorAll('[data-dw=kit-refuse-row]')].map((row) => row.dataset.name),
    change: section.querySelector('[data-dw=kit-change]')?.textContent ?? null,
    last: last === null ? null : { kind: last.dataset.kind, ok: last.dataset.ok, code: last.dataset.code, text: last.textContent },
    refuseNote: section.querySelector('[data-dw=kit-refuse-note]')?.textContent ?? null,
    fields: { add: section.querySelector('[data-dw=kit-add-field]')?.value ?? null, refuse: section.querySelector('[data-dw=kit-refuse-add-field]')?.value ?? null },
    addOff: section.querySelector('[data-dw=kit-add]')?.disabled ?? null,
    refuseAddOff: section.querySelector('[data-dw=kit-refuse-add]')?.disabled ?? null,
    removeOff: off('[data-dw=kit-remove]'),
    refuseRemoveOff: off('[data-dw=kit-refuse-remove]'),
    problems: [...section.querySelectorAll('[data-dw=main-problem], [data-dw=control-error], [data-dw=kit-refuse-error], [data-dw=kit-unavailable]')].map((node) => node.textContent),
  }
})())`
}

/** Poll the section "Widget kit" until `accept` takes the read value. */
async function pollKit(target, until, accept) {
  let last
  while (Date.now() < until) {
    try {
      last = JSON.parse(String(await evaluate(target.webSocketDebuggerUrl, kitReadExpression(), until)))
      if (accept(last)) return { value: last, ok: true }
    } catch (error) {
      last = { error: error instanceof Error ? error.message : 'evaluate failed' }
    }
    await delay(250)
  }
  return { value: last, ok: false }
}

/** Type `text` into the field at `selector` of the kit section, as a key press does: React reads the input event. */
function typeKitField(target, selector, text, deadline) {
  return evaluate(target.webSocketDebuggerUrl, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)})
    if (input === null) return false
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(text)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`, deadline)
}

/** Call the action `action` of main from its page, as a control does. Gives the HTTP status and the body. */
async function callMain(target, action, args, deadline) {
  return JSON.parse(String(await evaluate(target.webSocketDebuggerUrl, `(async () => {
    const answer = await fetch('/api/widgets/main/call', { method: 'POST', headers: { 'content-type': 'application/json' }, body: ${JSON.stringify(JSON.stringify({ action, args }))} })
    return JSON.stringify({ status: answer.status, body: await answer.json() })
  })()`, deadline, true)))
}

/**
 * kit.pane.view: put text into the Add field and the refuse field, then read the section. A control that does nothing
 * keeps its button off also with text in its field.
 */
async function readKitControls(target, deadline) {
  await typeKitField(target, '[data-dw=kit-add-field]', 'ms@^2', deadline)
  await typeKitField(target, '[data-dw=kit-refuse-add-field]', 'core-js', deadline)
  await delay(150)
  return JSON.parse(String(await evaluate(target.webSocketDebuggerUrl, kitReadExpression(), deadline)))
}

/**
 * True when each control of the kit section is off, with text in both fields: Add, each Remove, and the refuse list. A
 * function declaration, because the checks run before the module reaches a const of this part.
 */
function kitControlsOff(kit) {
  return kit?.fields?.add === 'ms@^2' && kit.fields.refuse === 'core-js' && kit.addOff === true && kit.refuseAddOff === true
    && kit.removeOff.every(Boolean) && kit.refuseRemoveOff.every(Boolean)
}

/**
 * kit.pane.actions: the panel page opened while the kit start waits for the lock of kitLockHolder. The section shows
 * the status starting, and its controls do nothing, also the Remove button of a name in the refuse list. Then the
 * holder ends, and the page must show ready within 5 s after the start ends. No event tells the page about the end of
 * the start, so only its read of the query settings each second can show it.
 */
async function checkMainKitStart(target, deadline) {
  if (kitLockHolder === undefined) return 'main kit: no process holds the kit lock'
  // The action writes the refuse list also during the start. Only the controls of the page do nothing.
  const listed = await callMain(target, 'setRefuseBuilds', { names: ['left-pad'] }, deadline)
  if (listed.body?.result?.ok !== true) return `main kit: setRefuseBuilds during the kit start failed: ${JSON.stringify(listed)}`
  const starting = await pollKit(target, Math.min(deadline, Date.now() + 15_000), (kit) => kit?.status === 'starting' && kit.refuse.includes('left-pad'))
  if (!starting.ok) return `main kit: while the kit start waits for the lock, the section does not show starting with the refuse list: ${JSON.stringify(starting.value)}`
  const controls = await readKitControls(target, deadline)
  note(`main kit starting controls=${JSON.stringify(controls)}`)
  if (controls.status !== 'starting' || !kitControlsOff(controls) || controls.refuseRemoveOff.length === 0) return `main kit: while the kit starts, a control of the section is on: ${JSON.stringify(controls)}`
  const logFrom = readFileSync(logPath, 'utf8').length
  kitLockHolder.kill('SIGKILL')
  // The start takes the lock over and makes kit version 1. Its log line in the output of the app marks the end of the start.
  let endedAt
  for (const until = Math.min(deadline, Date.now() + 60_000); endedAt === undefined && Date.now() < until; await delay(100)) {
    if (/kit: (?:made kit version 1|kit version \d+ is ready)/u.test(readFileSync(logPath, 'utf8').slice(logFrom))) endedAt = Date.now()
  }
  if (endedAt === undefined) return 'main kit: the kit start did not end after the holder of the lock ended'
  const ready = await pollKit(target, Math.min(deadline, endedAt + 5_000), (kit) => kit?.status === 'ready' && kit.core.length === 8)
  note(`main kit ready ${String(Date.now() - endedAt)} ms after the start ended=${JSON.stringify(ready.value)}`)
  if (!ready.ok) return `main kit: the page does not show ready within 5 s after the kit start ended: ${JSON.stringify(ready.value)}`
  return undefined
}

/**
 * The section "Widget kit" of the Settings tab (kit.pane.view). After the start (checkMainKitStart), the section shows
 * the status ready, and 8 core rows, each with a lock mark. An add of date-fns@^4 through the page shows the status
 * changing, then its row. While a change runs, each control of the section is off: an add of ms@^2 runs while date-fns
 * has its Remove button. Remove in the row of date-fns takes it away, and the remove button of left-pad empties the
 * refuse list. Each change runs pnpm online. The check saves $TMPDIR/deepwidgets-main-settings/settings-kit.png with
 * the row of date-fns.
 */
async function checkMainKit(target, deadline) {
  const start = await checkMainKitStart(target, deadline)
  if (start !== undefined) return start
  const change = () => Math.min(deadline, Date.now() + 120_000)
  const first = await pollKit(target, change(), (kit) => kit?.status === 'ready' && kit.core.length === 8)
  note(`main kit first=${JSON.stringify(first.value)}`)
  if (!first.ok) return `main kit: the section Widget kit does not show the status ready with 8 core rows: ${JSON.stringify(first.value)}`
  if (!first.value.core.every((row) => row.lock)) return `main kit: a core row has no lock mark: ${JSON.stringify(first.value.core)}`
  if (first.value.extras.length > 0 || first.value.problems.length > 0) return `main kit: the section starts with an extra or a problem: ${JSON.stringify(first.value)}`
  if (first.value.refuseNote === null || !first.value.refuseNote.includes('whole package')) return `main kit: no note of the refuse list: ${String(first.value.refuseNote)}`

  // An add through the page. While it runs, the controls are off.
  const add = async (spec) => {
    if (await typeKitField(target, '[data-dw=kit-add-field]', spec, deadline) !== true) return { problem: 'no Add field' }
    await delay(200)
    if (await clickMain(target, '[data-dw=kit-add]', deadline) !== true) return { problem: 'no Add button' }
    const started = await pollKit(target, Math.min(deadline, Date.now() + 15_000), (kit) => kit?.status === 'changing' || kit?.extras?.includes(spec.split('@')[0]) === true)
    const controls = await readKitControls(target, deadline)
    const added = await pollKit(target, change(), (kit) => kit?.status === 'ready' && kit.extras.includes(spec.split('@')[0]))
    note(`main kit add ${spec} started=${JSON.stringify(started.value)} controls=${JSON.stringify(controls)} added=${JSON.stringify(added.value)}`)
    return { started, controls, added }
  }
  const dateFns = await add('date-fns@^4')
  if (dateFns.problem !== undefined) return `main kit: ${dateFns.problem}`
  if (!dateFns.started.ok || dateFns.started.value.status !== 'changing' || dateFns.started.value.change === null) return `main kit: after Add, the section does not show the change: ${JSON.stringify(dateFns.started.value)}`
  if (dateFns.controls.status !== 'changing' || !kitControlsOff(dateFns.controls)) return `main kit: while the add of date-fns runs, a control of the section is on: ${JSON.stringify(dateFns.controls)}`
  if (!dateFns.added.ok) return `main kit: after Add, the row of date-fns does not show with the status ready: ${JSON.stringify(dateFns.added.value)}`
  if (dateFns.added.value.last?.kind !== 'add' || dateFns.added.value.last.ok !== 'true' || dateFns.added.value.problems.length > 0) return `main kit: the last change of the add is not clean: ${JSON.stringify(dateFns.added.value)}`
  // The screenshot shows the fields empty, not the text of the control reads.
  await typeKitField(target, '[data-dw=kit-add-field]', '', deadline)
  await typeKitField(target, '[data-dw=kit-refuse-add-field]', '', deadline)
  await evaluate(target.webSocketDebuggerUrl, "(() => { document.querySelector('[data-dw=kit-extra][data-name=\"date-fns\"]')?.scrollIntoView({ block: 'center' }); return true })()", deadline)
  await delay(300)
  await shootMain('settings-kit.png', deadline, SETTINGS_SHOTS)

  // While a second add runs, the Remove button of date-fns is off too.
  const ms = await add('ms@^2')
  if (ms.problem !== undefined) return `main kit: ${ms.problem}`
  if (ms.controls.status !== 'changing' || !kitControlsOff(ms.controls) || ms.controls.removeOff.length === 0) return `main kit: while the add of ms runs, a control of the section is on: ${JSON.stringify(ms.controls)}`
  if (!ms.added.ok) return `main kit: after Add, the row of ms does not show with the status ready: ${JSON.stringify(ms.added.value)}`

  if (await clickMain(target, '[data-dw=kit-remove][data-name="date-fns"]', deadline) !== true) return 'main kit: no Remove in the row of date-fns'
  const removed = await pollKit(target, change(), (kit) => kit?.status === 'ready' && !kit.extras.includes('date-fns') && kit.last?.kind === 'remove')
  note(`main kit removed=${JSON.stringify(removed.value)}`)
  if (!removed.ok) return `main kit: after Remove, the row of date-fns is still there: ${JSON.stringify(removed.value)}`
  if (removed.value.last.ok !== 'true' || removed.value.problems.length > 0) return `main kit: the last change of the remove is not clean: ${JSON.stringify(removed.value)}`

  if (await clickMain(target, '[data-dw=kit-refuse-remove][data-name="left-pad"]', deadline) !== true) return 'main kit: no remove button in the row of left-pad'
  const cleared = await pollKit(target, Math.min(deadline, Date.now() + 15_000), (kit) => kit?.refuse?.length === 0 && kit.problems.length === 0)
  if (!cleared.ok) return `main kit: the remove button of left-pad did not empty the refuse list: ${JSON.stringify(cleared.value)}`
  await typeKitField(target, '[data-dw=kit-add-field]', '', deadline)
  await typeKitField(target, '[data-dw=kit-refuse-add-field]', '', deadline)
  await evaluate(target.webSocketDebuggerUrl, "(() => { window.scrollTo(0, 0); return true })()", deadline)
  return undefined
}

/**
 * The boot added @deepwidgets/widget-main to the profile of DSH_SMOKE_OLD_PROFILE, in its template place, and Electron
 * main logged the change. With DSH_SMOKE_MAIN=1, the panel then shows the main widget.
 */
function checkOldProfile() {
  const bundles = JSON.parse(readFileSync(join(desktopProfile, 'package.json'), 'utf8')).dsh?.profile?.bundles
  const logged = readFileSync(logPath, 'utf8').includes('deepwidgets-profile: added the template bundles @deepwidgets/widget-main to ')
  note(`old profile bundles=${JSON.stringify(bundles)} logged=${String(logged)}`)
  if (JSON.stringify(bundles) !== JSON.stringify(PROFILE_BUNDLES)) return `old profile: the bundles are ${JSON.stringify(bundles)}`
  return logged ? undefined : 'old profile: Electron main did not log the added bundle'
}

/** The page checks of main.page, in the open panel. `closed` is the baseline of the writes with no page of main. */
async function checkMainPage(target, closed, deadline) {
  const soon = () => Math.min(deadline, Date.now() + 15_000)
  const sampleRow = (value) => value.rows?.find((row) => row.slug === 'sample')
  const first = await pollMain(target, soon(), (value) => value.dw?.stream === 'open' && /^\d+$/u.test(sampleRow(value)?.rev ?? ''))
  note(`main first=${JSON.stringify(first.value)}`)
  if (!first.ok) return `main: no row of sample with a state rev: ${JSON.stringify(first.value)}`
  const read = first.value
  if (read.dw.catalog !== 'deepwidgets-main@1') return `main: the page has the catalog ${String(read.dw.catalog)}`
  if (read.rows.some((row) => row.slug === 'main')) return 'main: the page has a row for main'
  if (read.problems.length > 0) return `main: the page shows a problem: ${JSON.stringify(read.problems)}`
  if (JSON.stringify(read.tabs) !== '["Widgets","Settings"]') return `main: the tabs are ${JSON.stringify(read.tabs)}`
  await shootMain('main-page.png', deadline)
  await shootMain('panel.png', deadline, PANEL_SHOTS)

  // A state write of sample that does not come from the page: only the stream of main can tell the page.
  const before = Number(sampleRow(read).rev)
  const written = await hostWidgets(deadline, `async (widgets) => {
    await widgets.update('sample', (state) => ({ count: state.count + 1 }), { by: 'smoke-main' })
    return widgets.get('sample').rev
  }`, [])
  note(`main sample write rev=${String(written)} before=${String(before)}`)
  if (typeof written !== 'number' || written <= before) return `main: the state write of sample gave rev ${String(written)}`
  const shown = await pollMain(target, Math.min(deadline, Date.now() + 10_000), (value) => sampleRow(value)?.rev === String(written))
  note(`main after-write=${JSON.stringify(shown.value)}`)
  if (!shown.ok) return `main: the row of sample did not show rev ${String(written)}: ${JSON.stringify(sampleRow(shown.value) ?? shown.value)}`

  // The state viewer of sample, and its controls: a built-in widget has Turn off and no Remove.
  if (await clickMain(target, '[data-dw=widget-row][data-slug=sample] [data-dw=row-toggle]', deadline) !== true) return 'main: no toggle in the row of sample'
  const opened = await pollMain(target, soon(), (value) => sampleRow(value)?.open === 'true' && sampleRow(value)?.viewer === true)
  note(`main opened=${JSON.stringify(sampleRow(opened.value))}`)
  if (!opened.ok) return `main: the state of sample did not open: ${JSON.stringify(sampleRow(opened.value) ?? opened.value)}`
  if (!sampleRow(opened.value).turnOff || sampleRow(opened.value).remove) return `main: the controls of sample are wrong: ${JSON.stringify(sampleRow(opened.value))}`
  // control_state_lost_on_close: a switch to Settings and back keeps the row open (the tab panels stay mounted).
  // Radix activates a tab on mousedown.
  const pressTab = (index) => evaluate(target.webSocketDebuggerUrl, `(() => {
    document.querySelectorAll('[data-dw=tab]')[${String(index)}]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    return true
  })()`, deadline)
  const activeTab = () => evaluate(target.webSocketDebuggerUrl, "document.querySelector('[data-dw=tab][data-state=active]')?.textContent ?? null", deadline)
  await pressTab(1)
  await delay(300)
  const switched = await activeTab()
  await pressTab(0)
  await delay(300)
  if (switched !== 'Settings' || await activeTab() !== 'Widgets') return `main: the tabs did not switch: ${String(switched)}`
  const kept = await pollMain(target, soon(), (value) => sampleRow(value)?.open === 'true')
  note(`main tab switch tabs=${String(switched)} row=${JSON.stringify(sampleRow(kept.value))}`)
  if (!kept.ok) return `main: a switch of the tab closed the row of sample: ${JSON.stringify(sampleRow(kept.value))}`
  await shootMain('main-page-state.png', deadline)

  // Turn off and Turn on from the page: the status of the row follows, and the row stays open.
  for (const [button, status] of [['turn-off', 'turned-off'], ['turn-on', 'live']]) {
    if (await clickMain(target, `[data-dw=widget-row][data-slug=sample] [data-dw=${button}]`, deadline) !== true) {
      const now = await pollMain(target, Date.now() + 1000, () => true)
      const bar = await withMenuBar(deadline, menuBarReadDeclaration()).catch((error) => ({ error: String(error) }))
      return `main: no ${button} in the row of sample: ${JSON.stringify({ page: now.value, panel: bar.panel ?? bar })}`
    }
    const changed = await pollMain(target, soon(), (value) => sampleRow(value)?.status === status)
    note(`main ${button}=${JSON.stringify({ row: sampleRow(changed.value), problems: changed.value?.problems })}`)
    if (!changed.ok) return `main: after ${button}, the status of sample is not ${status}: ${JSON.stringify(changed.value)}`
  }

  // main_widget.window_state: Hide in the row of sample hides its floating window, and the row shows Hidden with Show.
  // Show shows the window again, and the row shows Shown with Hide.
  for (const [button, window, text, visible] of [['hide', 'hidden', 'Hidden', false], ['show', 'shown', 'Shown', true]]) {
    if (await clickMain(target, `[data-dw=widget-row][data-slug=sample] [data-dw=${button}]`, deadline) !== true) {
      return `main: no ${button} in the row of sample: ${JSON.stringify(sampleRow((await pollMain(target, Date.now() + 1000, () => true)).value))}`
    }
    const other = button === 'hide' ? 'show' : 'hide'
    const changed = await pollMain(target, soon(), (value) => sampleRow(value)?.window === window && sampleRow(value)?.windowText === text && sampleRow(value)?.[other] === true)
    const shown = await waitWindowShown('sample', visible, soon())
    note(`main ${button}=${JSON.stringify({ row: sampleRow(changed.value), problems: changed.value?.problems, windowShown: shown })}`)
    if (!changed.ok) return `main: after ${button}, the row of sample does not show ${text} with ${other}: ${JSON.stringify(sampleRow(changed.value) ?? changed.value)}`
    if (shown !== visible) return `main: after ${button}, the window of sample ${visible ? 'does not show' : 'still shows'} (${String(shown)})`
  }
  return await checkMainWrites(target, closed, deadline) ?? await checkMainCatchUp(target, deadline)
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
      functionDeclaration: pinnedFunction(`async function (spec) {
        if (this.length !== 1) throw new Error("Loader instances " + this.length);
        const loader = this[0];
        const manager = loader.ctx?.get?.("pluginManager") ?? loader.ctx?.pluginManager;
        if (manager === undefined || typeof manager.installBundle !== "function") {
          throw new Error("no pluginManager on Loader ctx");
        }
        // The inspector call can inherit the hmr transaction store of host work in flight; leave it, as hmr.watchConfig does.
        const hmr = loader.ctx?.get?.("hmr");
        const install = await (hmr === undefined ? manager.installBundle(spec) : hmr.executing.exit(() => manager.installBundle(spec)));
        const marker = loader.ctx?.get?.("widgetRowsInstallMarker");
        return { install, marker: marker === undefined ? null : marker };
      }`),
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
