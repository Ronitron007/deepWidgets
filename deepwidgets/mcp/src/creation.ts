/**
 * Widget creation (`widget_phase2.creation`): the gates and the install through the plugin manager.
 *
 * `install(dir)` copies `dir/src` into a throwaway staging folder and runs the gates there:
 * compile (esbuild), lint with a type check (oxlint, type-aware, with the widget type file), and a
 * test run in a throwaway process. Code that fails a gate never reaches the host. A bundle that
 * passes is written into a folder that the profile owns, `<profile>/deepwidgets-widgets/<slug>`,
 * and the plugin manager installs that folder; `hmr` applies it at once. A second install of one
 * slug removes the old bundle first and puts it back when the new one fails. The state of a slug
 * is in the runtime storage, so it stays across a replace and a remove.
 * @module @deepwidgets/mcp/creation
 */
import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, realpath, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { BundleInfo, ChangeResult } from '@deepseek-ai/dsh-plugin-manager/types'
import type { ProgramRecord } from '@deepwidgets/widgets'
import { endlessLoops } from './loop-check.ts'
import type { TestRunReport, TestRunWidget } from './testrun-child.ts'

const require = createRequire(import.meta.url)

/** The heap limit of the test run process in MB. */
const TEST_HEAP_MB = 256
/** How long timers run after `apply` and the action calls. */
const TEST_WINDOW_MS = 1_500
/** The test run fails when the child prints nothing for this long after its first line: a loop holds it. */
const TEST_STALL_MS = 750
/** The child must print its first line within this time. A cold start of the executable is slow. */
const TEST_START_MS = 10_000
/** The hard limit of one test run, also when the child keeps printing. */
const TEST_LIMIT_MS = 15_000
const LINT_LIMIT_MS = 60_000
const MAX_DIAGNOSTICS = 20
/** The live registration shows in `ctx.widgets.list()` within this time after an applied install. */
const LIVE_WAIT_MS = 5_000
const META_FILE = 'deepwidgets-widget.json'
/**
 * The folder under the widget root where an older install kept the hash of the last applied seed program of each
 * slug. widget_fv.install moved the hash into the program record. An install moves the file of its slug once.
 */
const LEGACY_SEEDS_DIR = '.seeds'
/** The source files that the loop rule reads: each kind that esbuild bundles. */
const SOURCE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/

/** One gate of `widget_phase2.creation.gates`, in order. */
export type GateName = 'compile' | 'lint' | 'test'

/** The report of one gate. */
export interface GateReport {
  gate: GateName
  ok: boolean
  ms: number
  /** Why the gate failed: `file:line:column: text` where a place is known. */
  diagnostics: string[]
  /** Findings that do not stop the install. */
  warnings: string[]
}

/** The error codes of the creation tools. */
export type CreationErrorCode =
  | 'bad-source'
  | 'gate-failed'
  | 'slug-taken'
  | 'slug-changed'
  | 'install-failed'
  | 'not-installed'
  | 'creation-unavailable'

/** A creation failure. `gate` names the gate that refused the code. */
export class CreationError extends Error {
  readonly code: CreationErrorCode
  readonly gate: GateName | undefined
  readonly diagnostics: string[]

  constructor(code: CreationErrorCode, message: string, options: { gate?: GateName, diagnostics?: string[] } = {}) {
    super(message)
    this.name = 'CreationError'
    this.code = code
    this.gate = options.gate
    this.diagnostics = options.diagnostics ?? []
  }
}

/** The outcome of `install` and `reload`. */
export interface InstallOutcome {
  slug: string
  /** True when an earlier bundle of the slug was replaced. */
  replaced: boolean
  /** The plugin manager result. */
  application: ChangeResult['application']
  /** True when the seed program changed and the stored program was set to it. */
  programUpdated: boolean
  gates: GateReport[]
  warnings: string[]
}

/** The record that a profile-owned widget folder keeps. */
interface WidgetMeta {
  slug: string
  /** The folder that the agent installed from; `widget_reload` reads it again. */
  source: string
  installedAt: string
}

/** The services that an install needs. */
export interface CreationServices {
  readonly pluginManager: {
    installBundle(spec: string): Promise<ChangeResult>
    removeBundle(name: string): Promise<ChangeResult>
    listBundles(): Promise<BundleInfo[]>
  }
  /** The folder of the current profile. */
  readonly profileDir: string
  readonly widgets: Context['widgets']
  /** The install records of the widget runtime (`widget_fv.install`). Widget code can not use them. */
  readonly records: Context['widgetRecords']
}

/** Where the tools of the gates are. They resolve from this package, not from a working folder. */
interface Toolchain {
  esbuild: typeof import('esbuild')
  oxlint: string
  tsgolint: string
  zod: string
  child: string
  widgetTypes: string
  template: string
}

let toolchain: Toolchain | undefined

/** Resolve the gate tools once. Throws when this package is not built or a tool is missing. */
function tools(): Toolchain {
  if (toolchain !== undefined) return toolchain
  const root = dirname(require.resolve('@deepwidgets/mcp/package.json'))
  const tsgolintRequire = createRequire(require.resolve('oxlint-tsgolint/package.json'))
  const binary = `tsgolint${process.platform === 'win32' ? '.exe' : ''}`
  toolchain = {
    esbuild: require('esbuild') as typeof import('esbuild'),
    oxlint: join(dirname(require.resolve('oxlint/package.json')), 'bin', 'oxlint'),
    tsgolint: tsgolintRequire.resolve(`@oxlint-tsgolint/${process.platform}-${process.arch}/${binary}`),
    zod: dirname(require.resolve('zod/package.json')),
    child: join(root, 'lib', 'testrun-child.js'),
    widgetTypes: join(root, 'widget', 'widget.d.ts'),
    template: join(root, 'widget', 'template', 'src', 'index.ts'),
  }
  return toolchain
}

const elapsed = (started: number): number => Math.round(performance.now() - started)
/** The hash of a seed program. It is the same hash as `seedHash` of `@deepwidgets/widgets`. */
const hashText = (text: string): string => createHash('sha256').update(text).digest('hex')
const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error)

/**
 * The package name of the bundle of `slug`, which is also its row id (`widget_phase2.creation.rows`).
 * A built-in widget row is `deepwidgets-widget-<name>`, so an agent bundle cannot take its row id.
 */
export const bundleName = (slug: string): string => `deepwidgets-agent-${slug}`

/** The package name and row id that an older install gave the agent bundle of `slug`. An install of the slug removes it. */
export const legacyBundleName = (slug: string): string => `deepwidgets-widget-${slug}`

/** The template files, with the slug and title filled in. */
export async function templateFiles(slug: string, title: string): Promise<{ path: string, text: string }[]> {
  const text = await readFile(tools().template, 'utf8')
  return [{ path: 'src/index.ts', text: text.replaceAll('__SLUG__', slug).replaceAll('__TITLE__', title) }]
}

/** The widget type file text, for the guide. */
export function widgetTypesText(): Promise<string> {
  return readFile(tools().widgetTypes, 'utf8')
}

/** Copy `dir/src` into a new staging folder. */
async function stage(dir: string): Promise<string> {
  if (!isAbsolute(dir)) throw new CreationError('bad-source', `the folder ${JSON.stringify(dir)} is not an absolute path`)
  const entry = join(dir, 'src', 'index.ts')
  const found = await stat(entry).catch(() => undefined)
  if (found?.isFile() !== true) throw new CreationError('bad-source', `the folder ${dir} has no src/index.ts`)
  // tsgolint prints real paths. On macOS the temporary folder is behind a link (/var is /private/var).
  const staging = await realpath(await mkdtemp(join(tmpdir(), 'deepwidgets-gates-')))
  await cp(join(dir, 'src'), join(staging, 'src'), { recursive: true, filter: (source) => !relative(dir, source).split(/[\\/]/).includes('node_modules') })
  return staging
}

/** Write the tsconfig and the oxlint config of the staging folder. tsgolint reads the nearest tsconfig. */
async function writeConfigs(staging: string): Promise<{ tsconfig: string, oxlintrc: string }> {
  const t = tools()
  const tsconfig = join(staging, 'tsconfig.json')
  await writeFile(tsconfig, JSON.stringify({
    compilerOptions: {
      target: 'es2024',
      module: 'esnext',
      moduleResolution: 'bundler',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
      // The `dom` lib types fetch, URL, console, and the other web globals. It also types
      // `globalThis.setTimeout`; the rule `no-restricted-properties` refuses that.
      lib: ['es2024', 'dom'],
      paths: { zod: [t.zod] },
    },
    files: [t.widgetTypes],
    include: ['src/**/*'],
  }, null, 2))
  const oxlintrc = join(staging, 'oxlintrc.json')
  const timer = (name: string, use: string): { name: string, message: string } => ({ name, message: `a raw ${name} is not owned by the widget, so it runs on after the widget stops. Use ${use}.` })
  const timers = [
    timer('setTimeout', 'ctx.timeout(callback, ms)'),
    timer('setInterval', 'ctx.interval(callback, ms)'),
    timer('setImmediate', 'ctx.timeout(callback, 0)'),
    timer('queueMicrotask', 'ctx.timeout(callback, 0)'),
  ]
  await writeFile(oxlintrc, JSON.stringify({
    plugins: ['typescript'],
    categories: { correctness: 'off' },
    options: { typeAware: true },
    rules: {
      'typescript/no-floating-promises': 'error',
      'typescript/no-misused-promises': 'error',
      'no-restricted-globals': ['error', ...timers],
      // A property of any object: `globalThis.setTimeout`, `window.setTimeout`, `self.setTimeout`, an alias, and destructuring.
      'no-restricted-properties': ['error', ...timers.map(({ name, message }) => ({ property: name, message }))],
    },
  }, null, 2))
  return { tsconfig, oxlintrc }
}

/** The compile gate. `inputs` are the source files of the bundle, relative to the staging folder. */
async function compileGate(staging: string): Promise<{ report: GateReport, inputs: string[] }> {
  const started = performance.now()
  try {
    const built = await tools().esbuild.build({
      absWorkingDir: staging,
      entryPoints: [join(staging, 'src', 'index.ts')],
      outfile: join(staging, 'out', 'index.js'),
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node22',
      tsconfig: join(staging, 'tsconfig.json'),
      logLevel: 'silent',
      metafile: true,
    })
    const inputs = Object.keys(built.metafile.inputs).filter((file) => file.startsWith('src/') && SOURCE_FILE.test(file))
    return { report: { gate: 'compile', ok: true, ms: elapsed(started), diagnostics: [], warnings: [] }, inputs }
  } catch (error) {
    const errors = (error as { errors?: { text: string, location?: { file: string, line: number, column: number } | null }[] }).errors
    const diagnostics = errors === undefined
      ? [errorText(error)]
      : errors.map(({ text, location }) => location == null ? text : `${location.file}:${String(location.line)}:${String(location.column + 1)}: ${text}`)
    return { report: { gate: 'compile', ok: false, ms: elapsed(started), diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS), warnings: [] }, inputs: [] }
  }
}

/** The lint gate. `inputs` are the bundled source files that the loop rule reads. */
async function lintGate(staging: string, configs: { tsconfig: string, oxlintrc: string }, inputs: string[]): Promise<GateReport> {
  const started = performance.now()
  const t = tools()
  const args = [t.oxlint, '-c', configs.oxlintrc, '--type-aware', '--type-check', '--tsconfig', configs.tsconfig, '--format', 'unix', 'src']
  const { code, output } = await new Promise<{ code: number, output: string }>((resolve) => {
    execFile(process.execPath, args, {
      cwd: staging,
      encoding: 'utf8',
      timeout: LINT_LIMIT_MS,
      maxBuffer: 1 << 24,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', OXLINT_TSGOLINT_PATH: t.tsgolint },
    }, (error, stdout, stderr) => {
      // A spawn failure or a kill has no exit number; its message says why.
      const exit = error === null ? 0 : typeof error.code === 'number' ? error.code : 1
      const reason = error !== null && typeof error.code !== 'number' ? `${error.message}\n` : ''
      resolve({ code: exit, output: `${reason}${stdout}${stderr}` })
    })
  })
  const loops: string[] = []
  for (const file of inputs) loops.push(...endlessLoops(file, await readFile(join(staging, file), 'utf8')))
  if (code === 0 && loops.length === 0) return { gate: 'lint', ok: true, ms: elapsed(started), diagnostics: [], warnings: [] }
  const lines = output.split('\n').map((line) => line.trim()).filter((line) => /^[^\s:]+:\d+:\d+: /.test(line))
  const diagnostics = [...loops, ...lines]
  if (code !== 0 && lines.length === 0) diagnostics.push(`oxlint exited with ${String(code)}: ${output.trim().slice(-600)}`)
  return { gate: 'lint', ok: false, ms: elapsed(started), diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS), warnings: [] }
}

/** Run the compiled bundle in a throwaway process. Gives the report and the one registered widget. */
async function testGate(staging: string): Promise<{ report: GateReport, widget: TestRunWidget | undefined }> {
  const started = performance.now()
  const t = tools()
  const child = spawn(process.execPath, [`--max-old-space-size=${String(TEST_HEAP_MB)}`, t.child, join(staging, 'out', 'index.js'), String(TEST_WINDOW_MS)], {
    cwd: staging,
    env: { PATH: process.env.PATH ?? '', ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  // The stall clock starts at the first line, so the start of the child is not a stall.
  let last: number | undefined
  let step = 'load'
  let result: TestRunReport | undefined
  let stderr = ''
  let buffer = ''
  let killed: string | undefined
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    last = performance.now()
    buffer += chunk
    let end = buffer.indexOf('\n')
    while (end !== -1) {
      const line = buffer.slice(0, end)
      buffer = buffer.slice(end + 1)
      if (line.startsWith('STEP ')) step = line.slice(5)
      else if (line.startsWith('RESULT ')) result = JSON.parse(line.slice(7)) as TestRunReport
      end = buffer.indexOf('\n')
    }
  })
  child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-4_000) })
  const watch = setInterval(() => {
    const now = performance.now()
    if (last === undefined) {
      if (now - started > TEST_START_MS) killed = `the test process printed nothing in ${String(TEST_START_MS)} ms after its start`
    } else if (now - last > TEST_STALL_MS) killed = `stall: the widget held the process for more than ${String(TEST_STALL_MS)} ms during ${step}. A loop or a long synchronous job blocks the host.`
    else if (now - started > TEST_LIMIT_MS) killed = `the test run took longer than ${String(TEST_LIMIT_MS)} ms (during ${step})`
    if (killed !== undefined) child.kill('SIGKILL')
  }, 50)
  const [code, signal] = await new Promise<[number | null, NodeJS.Signals | null]>((resolve) => {
    child.once('close', (exit, sig) => { resolve([exit, sig]) })
  })
  clearInterval(watch)
  const diagnostics: string[] = []
  const warnings: string[] = []
  if (killed !== undefined) diagnostics.push(killed)
  else if (result === undefined) {
    const memory = /heap|out of memory/i.test(stderr) ? ` (out of memory: the limit is ${String(TEST_HEAP_MB)} MB)` : ''
    diagnostics.push(`the test process ended during ${step} with ${String(code ?? signal)}${memory}: ${stderr.trim().split('\n').slice(0, 3).join(' | ').slice(0, 400)}`)
  }
  if (result !== undefined) {
    if (result.applyError !== null) diagnostics.push(`apply failed: ${result.applyError}`)
    for (const fault of result.faults) diagnostics.push(`${fault.kind}: ${fault.message}. This ends the host. Catch it in the widget.`)
    if (result.applyError === null && result.widgets.length !== 1) {
      diagnostics.push(`the bundle registered ${String(result.widgets.length)} widgets; it must register exactly one with ctx.widgets.register`)
    }
    for (const action of result.actions) {
      if (action.outcome === 'threw') warnings.push(`action ${action.name} threw: ${action.message ?? ''}`)
      else if (action.outcome === 'skipped') warnings.push(`action ${action.name}: ${action.message ?? 'not called'}`)
    }
  }
  const ok = diagnostics.length === 0
  return { report: { gate: 'test', ok, ms: elapsed(started), diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS), warnings }, widget: ok ? result?.widgets[0] : undefined }
}

/** Write the paths of the diagnostics relative to the source folder of the agent. */
function relativize(report: GateReport, staging: string): GateReport {
  const strip = (line: string): string => line.replaceAll(`${staging}/`, '')
  return { ...report, diagnostics: report.diagnostics.map(strip), warnings: report.warnings.map(strip) }
}

/** The outcome of the gates: the compiled bundle text and its widget, or the gate that refused it. */
export interface GatesOutcome {
  gates: GateReport[]
  code?: string
  widget?: TestRunWidget
}

/**
 * Run the three gates on `dir/src/index.ts`. The first failed gate stops the run.
 * @throws {CreationError} `bad-source` when the folder has no `src/index.ts`.
 */
export async function runGates(dir: string): Promise<GatesOutcome> {
  const staging = await stage(dir)
  try {
    const configs = await writeConfigs(staging)
    const gates: GateReport[] = []
    const { report: compileReport, inputs } = await compileGate(staging)
    const compiled = relativize(compileReport, staging)
    gates.push(compiled)
    if (!compiled.ok) return { gates }
    const linted = relativize(await lintGate(staging, configs, inputs), staging)
    gates.push(linted)
    if (!linted.ok) return { gates }
    const code = await readFile(join(staging, 'out', 'index.js'), 'utf8')
    const { report, widget } = await testGate(staging)
    gates.push(relativize(report, staging))
    return widget === undefined ? { gates } : { gates, code, widget }
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

/**
 * The patch file of a widget bundle: one row. Safe mode needs nothing here: the runtime refuses an
 * agent widget at `ctx.widgets.register` (`widget_phase2.isolation.supervisor`).
 */
function patchText(slug: string): string {
  const name = bundleName(slug)
  return ['- insert:', `    - id: ${name}`, `      name: ${name}`, ''].join('\n')
}

/** Write a complete bundle folder. */
async function writeBundle(folder: string, widget: TestRunWidget, code: string, source: string): Promise<void> {
  await rm(folder, { recursive: true, force: true })
  await mkdir(folder, { recursive: true })
  const name = bundleName(widget.slug)
  await writeFile(join(folder, 'package.json'), `${JSON.stringify({
    name,
    version: '1.0.0',
    private: true,
    description: `deepWidgets widget ${widget.title}`,
    type: 'module',
    exports: './index.js',
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  }, null, 2)}\n`)
  await writeFile(join(folder, 'index.js'), code)
  await writeFile(join(folder, 'cordis.patch.yml'), patchText(widget.slug))
  const meta: WidgetMeta = { slug: widget.slug, source, installedAt: new Date().toISOString() }
  await writeFile(join(folder, META_FILE), `${JSON.stringify(meta, null, 2)}\n`)
}

/** The diagnostics of a plugin manager result. */
function resultDiagnostics(result: ChangeResult): string[] {
  const out: string[] = [`application: ${result.application} at ${result.stage}`]
  if (result.error !== undefined) out.push(`error: ${JSON.stringify(result.error).slice(0, 1_500)}`)
  if (result.restartReason !== undefined) out.push(`restartReason: ${result.restartReason}`)
  const pnpm = result.packageResult?.output
  if (result.application === 'failed' && typeof pnpm === 'string' && pnpm !== '') out.push(`pnpm: ${pnpm.trim().slice(-800)}`)
  for (const warning of result.warnings ?? []) out.push(`warning: ${warning}`)
  return out
}

/** Installs, replaces, reloads, and removes widget bundles. One operation runs at a time. */
export class WidgetInstaller {
  private queue: Promise<unknown> = Promise.resolve()
  private readonly root: string

  constructor(private readonly services: CreationServices) {
    this.root = join(services.profileDir, 'deepwidgets-widgets')
  }

  private serial<T>(job: () => Promise<T>): Promise<T> {
    const next = this.queue.then(job, job)
    this.queue = next.catch(() => undefined)
    return next
  }

  private folderOf(slug: string): string {
    return join(this.root, slug)
  }

  /**
   * The installed agent bundles of `slug`: the current name, and the older name when the profile dependency of that
   * name is the agent folder of the slug. Another bundle with the older name is not an agent bundle and stays.
   * A built-in widget is not installed in the profile, so its row never shows here.
   */
  private async installedNames(slug: string): Promise<string[]> {
    const installed = new Map((await this.services.pluginManager.listBundles()).filter((bundle) => bundle.installed).map((bundle) => [bundle.name, bundle]))
    const names = installed.has(bundleName(slug)) ? [bundleName(slug)] : []
    const legacy = installed.get(legacyBundleName(slug))
    if (legacy !== undefined && await this.isAgentFolder(legacy.source, slug)) names.push(legacyBundleName(slug))
    return names
  }

  /** Whether the dependency spec `source` (`link:<path>` or `file:<path>`) is the agent folder of `slug`. */
  private async isAgentFolder(source: string | undefined, slug: string): Promise<boolean> {
    const local = source === undefined ? null : /^(?:file|link):(.+)$/s.exec(source)
    if (local?.[1] === undefined) return false
    // The profile can record the folder behind a link (on macOS /var is /private/var), so the real paths are compared.
    const real = (path: string): Promise<string> => realpath(path).catch(() => resolve(path))
    return await real(local[1]) === await real(this.folderOf(slug))
  }

  /**
   * widget_fv.install: move the hash of the older file `.seeds/<slug>` into the program record of `slug`, once.
   * A record that has a hash keeps it. The file goes after the move.
   */
  private async migrateSeed(slug: string): Promise<void> {
    const file = join(this.root, LEGACY_SEEDS_DIR, slug)
    let legacy: string
    try {
      legacy = (await readFile(file, 'utf8')).trim()
    } catch {
      // No file: an install of this version wrote the hash into the program record, or no install applied a seed.
      return
    }
    if (legacy !== '') await this.services.records.adoptSeed(slug, legacy)
    await rm(file, { force: true })
    // The folder goes with its last file. Another slug can still have a file in it.
    await rmdir(join(this.root, LEGACY_SEEDS_DIR)).catch(() => undefined)
  }

  private async meta(slug: string): Promise<WidgetMeta | undefined> {
    try {
      return JSON.parse(await readFile(join(this.folderOf(slug), META_FILE), 'utf8')) as WidgetMeta
    } catch {
      // No folder or no record: the slug has no agent bundle.
      return undefined
    }
  }

  private async waitLive(slug: string): Promise<boolean> {
    const until = Date.now() + LIVE_WAIT_MS
    while (Date.now() < until) {
      if (this.services.widgets.list().some((widget) => widget.slug === slug)) return true
      await new Promise((resolve) => { setTimeout(resolve, 100) })
    }
    return false
  }

  /** Run the gates and install `dir`. A bundle of the same slug is replaced. */
  install(dir: string): Promise<InstallOutcome> {
    return this.serial(() => this.installNow(dir, undefined))
  }

  /** Run the gates on the source folder of the installed `slug` again and replace its bundle. */
  reload(slug: string): Promise<InstallOutcome> {
    return this.serial(async () => {
      const meta = await this.meta(slug)
      if (meta === undefined || (await this.installedNames(slug)).length === 0) throw new CreationError('not-installed', `no agent widget bundle has the slug ${JSON.stringify(slug)}`)
      return this.installNow(meta.source, slug)
    })
  }

  /** Remove the bundle of `slug`. Its state stays in storage. */
  remove(slug: string): Promise<{ slug: string, application: ChangeResult['application'] }> {
    return this.serial(async () => {
      const meta = await this.meta(slug)
      const names = meta === undefined ? [] : await this.installedNames(slug)
      if (names.length === 0) throw new CreationError('not-installed', `no agent widget bundle has the slug ${JSON.stringify(slug)}`)
      let application: ChangeResult['application'] = 'applied'
      const removed: string[] = []
      for (const name of names) {
        const result = await this.services.pluginManager.removeBundle(name)
        if (result.application !== 'applied') {
          const done = removed.length === 0 ? '' : `; ${removed.join(', ')} was removed`
          throw new CreationError('install-failed', `the plugin manager did not remove ${name}${done}`, { diagnostics: resultDiagnostics(result) })
        }
        removed.push(name)
        application = result.application
      }
      await rm(this.folderOf(slug), { recursive: true, force: true })
      this.services.records.clearOff(slug)
      return { slug, application }
    })
  }

  private async installNow(dir: string, expected: string | undefined): Promise<InstallOutcome> {
    const outcome = await runGates(dir)
    const failed = outcome.gates.find((gate) => !gate.ok)
    if (failed !== undefined || outcome.widget === undefined || outcome.code === undefined) {
      const gate = failed?.gate ?? 'test'
      throw new CreationError('gate-failed', `the ${gate} gate refused the bundle; nothing was installed`, { gate, diagnostics: failed?.diagnostics ?? ['the test run found no widget'] })
    }
    const { widget, code } = outcome
    const { slug } = widget
    if (expected !== undefined && slug !== expected) throw new CreationError('slug-changed', `the source now registers ${JSON.stringify(slug)}, not ${JSON.stringify(expected)}`)
    const warnings = outcome.gates.flatMap((gate) => gate.warnings)
    const folder = this.folderOf(slug)
    const name = bundleName(slug)
    // widget_fv.install (widget.builtin_slugs): the slug of a built-in widget is reserved, also while it is off.
    if (await this.services.records.builtInSlug(slug)) {
      throw new CreationError('slug-taken', `the slug ${JSON.stringify(slug)} is the slug of a built-in widget`)
    }
    // An older install named the bundle with the row id of a built-in widget. This install removes it.
    const previous = await this.installedNames(slug)
    const replaced = previous.length > 0
    // widget_fv.install: a widget that safe mode turned off is not live, so it does not take the slug.
    if (!replaced && this.services.widgets.list().some((item) => item.slug === slug && item.off === undefined)) {
      throw new CreationError('slug-taken', `a widget that is not an agent bundle has the slug ${JSON.stringify(slug)}`)
    }
    this.services.records.clearOff(slug)
    await this.migrateSeed(slug)
    await mkdir(this.root, { recursive: true })
    const next = `${folder}.next`
    const backup = `${folder}.previous`
    await writeBundle(next, widget, code, dir)
    if (replaced) {
      const removed: string[] = []
      for (const old of previous) {
        const removal = await this.services.pluginManager.removeBundle(old)
        if (removal.application !== 'applied') {
          await rm(next, { recursive: true, force: true })
          const state = removed.length === 0 ? 'the old bundle stays' : `${removed.join(', ')} was removed, and ${old} stays`
          throw new CreationError('install-failed', `the plugin manager did not remove the old bundle ${old}; ${state}`, { diagnostics: resultDiagnostics(removal) })
        }
        removed.push(old)
      }
      await rm(backup, { recursive: true, force: true })
      await rename(folder, backup)
    } else {
      await rm(folder, { recursive: true, force: true })
    }
    await rename(next, folder)

    // widget_fv.install: the program record before the load. The slug is not live here, so no edit can change it.
    const before = await this.services.records.programRecord(slug)
    // widget_fv.install: a quarantine of the slug ends only when the whole install succeeds, not when the load does.
    this.services.records.holdLift(slug)
    try {
      return await this.loadNew({ slug, widget, folder, backup, name, replaced, before, gates: outcome.gates, warnings })
    } finally {
      // After a success the hold is already settled; this ends it after a throw.
      this.services.records.settleLift(slug, false)
    }
  }

  /** The load of the new bundle of `installNow`, its success, and its rollback. */
  private async loadNew(job: {
    slug: string
    widget: TestRunWidget
    folder: string
    backup: string
    name: string
    replaced: boolean
    before: ProgramRecord | undefined
    gates: GateReport[]
    warnings: string[]
  }): Promise<InstallOutcome> {
    const { slug, widget, folder, backup, name, replaced, before } = job
    const result = await this.services.pluginManager.installBundle(folder)
    if (result.application === 'applied' && await this.waitLive(slug)) {
      this.services.records.settleLift(slug, true)
      await rm(backup, { recursive: true, force: true })
      // The stored program wins over the seed, and it stays across a remove. A new seed in the code is the newer
      // intent: the load set it, in the same write as its hash (`seed` in the widgets runtime).
      const after = await this.services.records.programRecord(slug)
      // A record of an older format with no hash: the stored program stays, and it takes the hash of this seed.
      if (after !== undefined && after.seed === undefined) await this.services.records.adoptSeed(slug, hashText(widget.program))
      const programUpdated = before?.seed !== undefined && after?.seed !== before.seed
      return { slug, replaced, application: result.application, programUpdated, gates: job.gates, warnings: job.warnings }
    }

    const diagnostics = resultDiagnostics(result)
    if (result.application === 'applied') diagnostics.push(`the widget ${slug} did not show in widget_list within ${String(LIVE_WAIT_MS)} ms`)
    if ((await this.installedNames(slug)).includes(name)) {
      const undo = await this.services.pluginManager.removeBundle(name)
      if (undo.application !== 'applied') diagnostics.push(`the failed bundle was not removed: ${resultDiagnostics(undo).join('; ')}`)
    }
    this.services.records.clearOff(slug)
    await rm(folder, { recursive: true, force: true })
    // widget_fv.install: the failed load can have written the program record. Put back the record and its seed hash.
    // When the failed bundle could not be removed and still runs, the record stays: it is the record of that code.
    const stillLive = this.services.widgets.list().some((item) => item.slug === slug && item.off === undefined && item.failed === undefined)
    if (!stillLive) await this.services.records.restoreProgram(slug, before, { by: 'widget_install' })
    // The install failed: a load of other files during it does not end a quarantine. The old files load after this.
    this.services.records.settleLift(slug, false)
    if (replaced) {
      await rename(backup, folder)
      const restore = await this.services.pluginManager.installBundle(folder)
      diagnostics.push(restore.application === 'applied'
        ? 'the previous bundle was installed again'
        : `the previous bundle was not installed again: ${resultDiagnostics(restore).join('; ')}`)
    }
    throw new CreationError('install-failed', `the plugin manager did not apply ${name}`, { diagnostics })
  }
}
