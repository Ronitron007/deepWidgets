// Replays of the TLC bug paths of crash_lifecycle.tla on the real code. Since widget.crash_records they assert the fix.
// Each host is a real child process; Electron main is the real DesktopHostSupervisor with
// its real file readers; the next Host is the real createIsolation (ISO) in this process.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopHostSupervisor } from '../../../../../apps/desktop/src/deepwidgets-supervisor.ts'
import { createIsolation } from '../../../../../deepwidgets/widgets/src/isolation.ts'
import { fakeCtx } from './fake-ctx.ts'

/** This folder: it holds the host scripts. */
const HERE = dirname(fileURLToPath(import.meta.url))
/** The checkout that holds this skill: replay -> crash_lifecycle -> widget-state-models -> skills -> .agents -> root. */
const WT = resolve(HERE, '../../../../..')
/** A new work folder for each run: the DSH homes and the widget package folders. */
const R = mkdtempSync(join(tmpdir(), 'widget-state-models-crash-'))
for (const [name, files] of [['pkg-a1', { 'package.json': '{"name":"a1"}', 'index.js': 'v0' }], ['pkg-sample', { 'package.json': '{"name":"sample"}' }]] as const) {
  mkdirSync(join(R, name), { recursive: true })
  for (const [file, text] of Object.entries(files)) writeFileSync(join(R, name, file), text)
}
const A1 = 'deepwidgets-widget-a1'
const SAMPLE = 'deepwidgets-widget-sample'

function home(name: string): string {
  const dir = join(R, 'home', name)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(join(dir, 'deepwidgets'), { recursive: true })
  process.env.DSH_HOME = dir
  return dir
}
interface Exit { pid: number, code: number | null, signal: NodeJS.Signals | null, out: string }
function host(cmd: string, args: string[], onMessage?: (m: unknown, kill: () => void) => void): Promise<Exit> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: WT, env: { ...process.env, A1_ROOT: join(R, 'pkg-a1'), TSX_TSCONFIG_PATH: join(WT, 'tsconfig.base.json') }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
    let out = ''
    child.stdout.on('data', (d) => { out += String(d) })
    child.stderr.on('data', (d) => { out += String(d) })
    child.on('message', (m) => onMessage?.(m, () => child.kill('SIGKILL')))
    child.on('close', (code, signal) => { resolve({ pid: child.pid!, code, signal, out }) })
  })
}
const raceHost = (mode: string, onMessage?: (m: unknown, kill: () => void) => void) =>
  host(process.execPath, ['--disable-warning=ExperimentalWarning', join(HERE, 'host-race.mjs'), mode], onMessage)
const claimHost = (row: string, register: boolean, root = '') =>
  // node itself runs the host (tsx as a loader), so the child pid is the pid that writes crash.json
  host(process.execPath, ['--import', 'tsx', join(HERE, 'host-claim.ts'), row, register ? '1' : '0', root])
/** The failure that DesktopHostProcess gives for a child exit (HP, the `close` listener). */
const exitFailure = (e: Exit) => Object.assign(new Error('dsh desktop host stopped'), { hostPid: e.pid, hostCode: e.code, hostSignal: e.signal })
/** The failure that DesktopHostProcess gives for the IPC `fatal` event before the exit: it has the pid only (HP `fail`). */
const fatalFailure = (e: Exit) => Object.assign(new Error('startup failed'), { hostPid: e.pid })
const provisionalExists = () => existsSync(join(process.env.DSH_HOME!, 'deepwidgets', 'provisional.json'))
/** The next Host: the real isolation start, then the Loader loads each widget row. */
function nextHost(): { a1: string, sample: string, quarantine: unknown } {
  const { ctx, load } = fakeCtx({ [A1]: join(R, 'pkg-a1'), [SAMPLE]: join(R, 'pkg-sample') })
  createIsolation(ctx, { hold: () => async () => {}, failed: () => {} })
  const file = join(process.env.DSH_HOME!, 'deepwidgets', 'quarantine.json')
  return { a1: load(A1), sample: load(SAMPLE), quarantine: existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [] }
}
function supervisorWithLog() {
  const lines: string[] = []
  vi.spyOn(console, 'log').mockImplementation((line: string) => { lines.push(String(line)) })
  let restarted = 0
  const supervisor = new DesktopHostSupervisor(async () => { restarted += 1 })
  return { supervisor, lines, restarted: () => restarted }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

afterEach(() => { vi.restoreAllMocks() })

describe('crash_lifecycle replays', () => {
  // widget_fv.crash: these replays assert the fixed behavior. Each path is the TLC bug path of the code before the fix.
  // InnocentNeverQuarantined and the path where the boot fails right after a1 returns need the real inSlot. They run on
  // a real host: the case `innocent` of tools/widgets-crash-replay.mjs.
  it('ProvisionalOnlyOnAbort (all-rules path): Host never ready, OS kills it mid-stall, relaunch runs a1', async () => {
    home('prov-kill')
    const first = supervisorWithLog()                           // first app launch, never ready
    const end = await raceHost('stall-until-killed', (m, kill) => { if (m === 'stalled') kill() })  // the OS kills the Host
    expect(end.signal).toBe('SIGKILL')
    expect(provisionalExists()).toBe(true)
    expect(first.supervisor.failed(exitFailure(end), false)).toBe(false)   // fatal dialog
    expect(provisionalExists()).toBe(false)                    // the kill is no abort: the record is discarded
    supervisorWithLog()                                         // you start the app again
    expect(nextHost().a1).toBe('ran')
  })

  it('ProvisionalOnlyOnAbort (no exit code): boot fails during the a1 call; the fatal failure has the pid only', async () => {
    home('prov-bootfail-stall')
    const { supervisor, lines } = supervisorWithLog()
    supervisor.ready()
    const end = await raceHost('boot-fail-in-stall')
    expect(end.code).toBe(1)
    expect(provisionalExists()).toBe(true)
    // DesktopHostProcess reports the IPC 'fatal' event first, with the pid and no code or signal (HP `fail`)
    expect(supervisor.failed(fatalFailure(end), false)).toBe(true)
    expect(provisionalExists()).toBe(false)
    expect(lines.find((l) => l.includes('host-failed'))).toContain('"blamed":null')
    await sleep(700)
    expect(nextHost().a1).toBe('ran')
  })

  it('HashChangeLifts: a1 throws before it registers; the record has the root of its row; a new version runs', async () => {
    home('hash')
    const { supervisor, lines } = supervisorWithLog()
    supervisor.ready()
    const end = await claimHost(A1, false, join(R, 'pkg-a1'))   // a1 code starts, an uncaught error before track()
    expect(end.code).toBe(1)
    const record = JSON.parse(readFileSync(join(process.env.DSH_HOME!, 'deepwidgets', 'crash.json'), 'utf8')) as { root: unknown, hash: unknown, slugs: unknown }
    expect(record.root).toBe(realpathSync(join(R, 'pkg-a1')))  // the real path of the row folder
    expect(typeof record.hash).toBe('string')
    expect(record.slugs).toEqual(['a1'])
    expect(supervisor.failed(exitFailure(end), false)).toBe(true)
    expect(lines.find((l) => l.includes('host-failed'))).toContain('"blamed":"deepwidgets-widget-a1"')
    expect(nextHost().a1).toBe('held')                          // same files: held
    writeFileSync(join(R, 'pkg-a1', 'index.js'), `v${Date.now()}`)  // a new version is installed
    await sleep(700)
    expect(nextHost().a1).toBe('ran')
  })

  it('HashChangeLifts control: a1 throws after it registers; a new version runs again', async () => {
    home('hash-control')
    const { supervisor } = supervisorWithLog()
    supervisor.ready()
    const end = await claimHost(A1, true, join(R, 'pkg-a1'))
    expect(supervisor.failed(exitFailure(end), false)).toBe(true)
    expect(nextHost().a1).toBe('held')                          // same files: held
    writeFileSync(join(R, 'pkg-a1', 'index.js'), `v${Date.now()}`)
    expect(nextHost().a1).toBe('ran')                           // changed files: lifted
  })

  it('safe_host.crash: a1 throws in its plugin body before it registers; its slug shows as failed with the reason', () => {
    home('throw-first')
    const { ctx, load } = fakeCtx({ [A1]: join(R, 'pkg-a1') })
    const held: { slugs: string[], row: string, reason: string }[] = []
    createIsolation(ctx, {
      hold: (slugs, row, reason) => { held.push({ slugs, row, reason }); return async () => {} },
      failed: () => {},
    })
    expect(load(A1, () => { throw new Error('a1: the body threw') })).toBe('threw')
    expect(held).toEqual([{ slugs: ['a1'], row: A1, reason: expect.stringContaining('a1: the body threw') }])
  })

  it('SampleNeverQuarantined / SampleLiveInSafeMode: sample throws, then 2 aborts, safe-mode Host holds sample', async () => {
    home('sample')
    const { supervisor, lines } = supervisorWithLog()
    supervisor.ready()
    const end = await claimHost(SAMPLE, true, join(R, 'pkg-sample'))   // sample code starts, an uncaught error (a known break of widget_fv.open)
    expect(supervisor.failed(exitFailure(end), false)).toBe(true)
    expect(lines.find((l) => l.includes('host-failed'))).toContain('"blamed":"deepwidgets-widget-sample"')
    await sleep(700)                                            // restart
    for (let i = 0; i < 2; i += 1) {                            // the Host aborts, twice
      const abort = await host(process.execPath, ['-e', 'process.abort()'])
      expect(abort.signal).toBe('SIGABRT')
      expect(supervisor.failed(exitFailure(abort), false)).toBe(true)
      await sleep(i === 0 ? 700 : 2_200)
    }
    expect(supervisor.hostEnvironment()).toEqual({ DEEPWIDGETS_SAFE_MODE: '1' })
    process.env.DEEPWIDGETS_SAFE_MODE = '1'
    const next = nextHost()                                     // the safe-mode Host applies the records
    delete process.env.DEEPWIDGETS_SAFE_MODE
    expect(next.sample).toBe('held')
    console.warn('sample replay', JSON.stringify(next.quarantine))
  }, 20_000)
})
