/**
 * Widget creation (`widget_phase2.creation`): the gates and the install through the plugin manager.
 *
 * `install(dir)` copies `dir/src` into a throwaway staging folder and runs the gates there:
 * compile (esbuild), lint with a type check (oxlint, type-aware, with the widget type file), and a
 * test run in a throwaway process. Code that fails a gate never reaches the host. A bundle that
 * passes is written into a folder that the profile owns, `<profile>/deepwidgets-widgets/<slug>`,
 * and the plugin manager installs that folder; `hmr` applies it at once. A second install of one
 * slug installs the new bundle under the other agent package name of the slug, in its own folder
 * (`widget_fv.replace`). The new version waits as the standby of the old one. The old bundle goes
 * only after the new one registers, so a failed reinstall keeps the old version live. The state of
 * a slug is in the runtime storage, so it stays across a replace and a remove.
 *
 * A bundle with a folder `page/` also runs the page gates after the host gates (`agent_library.build_gate`,
 * `page-gate.ts`). Each build is a folder `<profile>/deepwidgets-widgets/<slug>/page-<hash>`. Only after the install
 * applies, the link `<slug>/page` swaps to the new build in one rename, so a failed install keeps the old page. The
 * last builds of a slug stay across a replace (`PAGE_BUILDS_KEPT`).
 * @module @deepwidgets/mcp/creation
 */
import { execFile, spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { cp, lstat, mkdir, mkdtemp, readdir, readFile, readlink, realpath, rename, rm, rmdir, stat, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { BundleInfo, ChangeResult, PluginEntryId, PluginInfo } from '@deepseek-ai/dsh-plugin-manager/types'
import type { ProgramRecord } from '@deepwidgets/widgets'
import { endlessLoops } from './loop-check.ts'
import { hasPage, PAGE_BUILD, PAGE_BUILD_TMP, pageNextStep, runPageGates } from './page-gate.ts'
import type { PageGateName, RenderAnswer, RenderCheck } from './page-gate.ts'
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
/** The link to the current built page in the folder of a slug (`agent_library.build_gate.gates`). */
const PAGE_DIR = 'page'
/** The builds `page-<hash>` that each slug keeps, the current one with them. */
const PAGE_BUILDS_KEPT = 3
/** The folder of the staging copies of the page gates, under the widget root. The host start empties it. */
const PAGE_STAGING = '.page-staging'
/**
 * main_widget.widgets: the file under the widget root with the slugs that the operator turned off in the main widget.
 * It lasts across host starts. An install or a reload of such a slug installs its new row off.
 */
const TURNED_OFF_FILE = '.turned-off.json'
/** A link under a temporary name, before the rename over `page`. */
const PAGE_LINK_TMP = /^\.page-link-/
/** A slug folder under the widget root (the slug pattern of the widgets runtime). */
const SLUG_DIR = /^[a-z0-9][a-z0-9-]{0,62}$/

/**
 * The page state for Electron main (`agent_library.serving.changes`): the widget root, and for each slug with a page
 * link a stamp, the link target and the modify time of the link. Each write of a link gives a new stamp.
 */
export interface PageState {
  root: string
  pages: Record<string, string>
}

/** One gate of `widget_phase2.creation.gates`, in order, then the page gates of `agent_library.build_gate.gates`. */
export type GateName = 'compile' | 'lint' | 'test' | PageGateName

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
  /** A next step for this case, in place of the default next step of the code. */
  readonly nextStep: string | undefined

  constructor(code: CreationErrorCode, message: string, options: { gate?: GateName, diagnostics?: string[], nextStep?: string } = {}) {
    super(message)
    this.name = 'CreationError'
    this.code = code
    this.gate = options.gate
    this.diagnostics = options.diagnostics ?? []
    this.nextStep = options.nextStep
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
  /** The folder of the built page, `<profile>/deepwidgets-widgets/<slug>/page`, for a bundle with a page. */
  page?: string
  /**
   * main_widget.widgets: set when the operator turned the slug off in the main widget. The new version is installed with
   * its row off, so it does not run until the operator turns it on. Its state stays.
   */
  turnedOff?: { code: 'turned-off', message: string }
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
    /** main_widget.widgets: the rows of the Loader, to set the row of a new bundle to the choice of the operator. */
    listPlugins(): Promise<PluginInfo[]>
    setPluginEnabled(id: PluginEntryId, enabled: boolean): Promise<ChangeResult>
  }
  /** The folder of the current profile. */
  readonly profileDir: string
  readonly widgets: Context['widgets']
  /** The install records of the widget runtime (`widget_fv.install`). Widget code can not use them. */
  readonly records: Context['widgetRecords']
  /** The render check of a page in Electron main (`agent_library.build_gate.render`). Undefined in a CLI host. */
  readonly renderCheck?: RenderCheck | undefined
  /**
   * Gets the page state when the installer is ready and after each job that changed a page link
   * (`agent_library.serving.changes`). Undefined in a CLI host. It must not throw.
   */
  readonly onPages?: ((state: PageState) => void) | undefined
  /**
   * agent_library.guide.mode: runs when the bundle has `page/`, before the page gates. The same look at `page/` decides
   * both, so a `page/` that comes during the host gates can not pass a switch that is off. It throws to refuse the page.
   */
  readonly checkPageMode?: (() => Promise<void>) | undefined
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
  /** The page folder of the template: the fixed files, and the example child and library. */
  pageTemplate: string
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
    pageTemplate: join(root, 'widget', 'template', 'page'),
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

/**
 * widget_fv.replace: the second package name and row id of the agent bundle of `slug`. A replace installs the new
 * version under the agent name that is not installed, so the two names take turns. A slug has no `.`, so the name of
 * one slug is never the name of another.
 */
export const secondBundleName = (slug: string): string => `deepwidgets-agent-${slug}.b`

/** The package name and row id that an older install gave the agent bundle of `slug`. An install of the slug removes it. */
export const legacyBundleName = (slug: string): string => `deepwidgets-widget-${slug}`

/** The template files, with the slug and title filled in. */
export async function templateFiles(slug: string, title: string): Promise<{ path: string, text: string }[]> {
  const text = await readFile(tools().template, 'utf8')
  return [{ path: 'src/index.ts', text: text.replaceAll('__SLUG__', slug).replaceAll('__TITLE__', title) }]
}

/**
 * The files of the page folder for `slug` (`agent_library.guide.template`): the fixed files `index.html`, `main.tsx`,
 * and `styles.css`, and the example `child.tsx` and `library.tsx`. The child names the catalog `<slug>@1`.
 */
export async function pageTemplateFiles(slug: string): Promise<{ path: string, text: string }[]> {
  // The install compares the fixed files with the template by hash, so only the example files get the slug.
  const fixed = ['index.html', 'main.tsx', 'styles.css']
  const examples = ['child.tsx', 'library.tsx']
  const read = (name: string): Promise<string> => readFile(join(tools().pageTemplate, name), 'utf8')
  return Promise.all([
    ...fixed.map(async (name) => ({ path: `page/${name}`, text: await read(name) })),
    ...examples.map(async (name) => ({ path: `page/${name}`, text: (await read(name)).replaceAll('__SLUG__', slug) })),
  ])
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

/** The answer of each query action of `slug` in the test run, for the render check of the page. */
function queryAnswers(report: TestRunReport, slug: string): Record<string, RenderAnswer> {
  const answers: Record<string, RenderAnswer> = {}
  for (const action of report.actions) {
    if (action.slug !== slug || action.kind !== 'query') continue
    if (action.outcome === 'ok') answers[action.name] = { ok: true, result: action.result ?? null }
    else answers[action.name] = { ok: false, message: action.message ?? `the test run did not call ${action.name}` }
  }
  return answers
}

/** Run the compiled bundle in a throwaway process. Gives the report, the one registered widget, and its query answers. */
async function testGate(staging: string): Promise<{ report: GateReport, widget: TestRunWidget | undefined, answers: Record<string, RenderAnswer> }> {
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
  const widget = ok ? result?.widgets[0] : undefined
  const answers = result === undefined || widget === undefined ? {} : queryAnswers(result, widget.slug)
  return { report: { gate: 'test', ok, ms: elapsed(started), diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS), warnings }, widget, answers }
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
  /** The build `page-<hash>` of a bundle with `page/`, in the folder of the slug. */
  page?: { name: string, reused: boolean }
}

/** Where the page gates build: the folder of a slug, and the staging root. */
export interface PageRoots {
  slugDir: (slug: string) => string
  stagingRoot: string
}

/**
 * Run the three gates on `dir/src/index.ts`, then the page gates when `dir` has `page/`. The first failed gate stops
 * the run. `renderCheck` runs the render check of the page; without it, that check is skipped with a warning.
 * `checkPageMode` runs when `dir` has `page/`, before the page gates, and its error stops the run.
 * @throws {CreationError} `bad-source` when the folder has no `src/index.ts`.
 */
export async function runGates(dir: string, pages: PageRoots, renderCheck?: RenderCheck, checkPageMode?: () => Promise<void>): Promise<GatesOutcome> {
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
    const { report, widget, answers } = await testGate(staging)
    gates.push(relativize(report, staging))
    if (widget === undefined) return { gates }
    if (!await hasPage(dir)) return { gates, code, widget }
    // agent_library.guide.mode: the look above decides the switch and the page gates.
    await checkPageMode?.()
    const t = tools()
    const page = await runPageGates(dir, { slug: widget.slug, program: widget.program, catalog: widget.catalog, answers }, { oxlint: t.oxlint, tsgolint: t.tsgolint }, renderCheck,
      { slugDir: pages.slugDir(widget.slug), stagingRoot: pages.stagingRoot })
    gates.push(...page.gates)
    if (page.build === undefined) return { gates }
    return { gates, code, widget, page: page.build }
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}

/**
 * The patch file of a widget bundle: one row. Safe mode needs nothing here: the runtime refuses an
 * agent widget at `ctx.widgets.register` (`widget_phase2.isolation.supervisor`).
 */
function patchText(name: string, disabled: boolean): string {
  return ['- insert:', `    - id: ${name}`, `      name: ${name}`, ...(disabled ? ['      disabled: true'] : []), ''].join('\n')
}

/** True for an entry of the folder of a slug that belongs to its pages: the link `page` and the builds `page-<hash>`. */
const isPageEntry = (entry: string): boolean => entry === PAGE_DIR || PAGE_BUILD.test(entry)

/**
 * Empty `folder`, or remove it. With `keepPage`, the page link and the builds of the slug stay
 * (`agent_library.build_gate`): the link changes only when an install applies.
 */
async function clearFolder(folder: string, keepPage: boolean): Promise<void> {
  if (!keepPage) {
    await rm(folder, { recursive: true, force: true })
    return
  }
  const entries = await readdir(folder).catch((): string[] => [])
  for (const entry of entries) if (!isPageEntry(entry)) await rm(join(folder, entry), { recursive: true, force: true })
  // The folder goes when no page is in it.
  if (!entries.some(isPageEntry)) await rmdir(folder).catch(() => undefined)
}

/**
 * Write a complete bundle folder. With `keepPage`, the pages of the slug stay. With `disabled`, the row of the bundle
 * starts off (main_widget.widgets: the operator turned the slug off).
 */
async function writeBundle(folder: string, name: string, widget: TestRunWidget, code: string, source: string, keepPage: boolean, disabled: boolean): Promise<void> {
  await clearFolder(folder, keepPage)
  await mkdir(folder, { recursive: true })
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
  await writeFile(join(folder, 'cordis.patch.yml'), patchText(name, disabled))
  const meta: WidgetMeta = { slug: widget.slug, source, installedAt: new Date().toISOString() }
  await writeFile(join(folder, META_FILE), `${JSON.stringify(meta, null, 2)}\n`)
}

const isPageGate = (gate: GateName): gate is PageGateName => gate.startsWith('page-')

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
  /** The page state that `onPages` got last, as JSON. */
  private sentPages: string | undefined

  constructor(private readonly services: CreationServices) {
    this.root = join(services.profileDir, 'deepwidgets-widgets')
    // The first job of the queue: a host that stopped during the page gates left their folders.
    void this.serial(() => this.sweepPages())
  }

  /**
   * agent_library.build_gate: remove what a stopped host left of the page gates: the staging copies, the folders
   * `page-<hash>.tmp`, and a link under its temporary name. A failed removal stays for the next host start.
   */
  private async sweepPages(): Promise<void> {
    await rm(join(this.root, PAGE_STAGING), { recursive: true, force: true }).catch(() => undefined)
    for (const slug of await readdir(this.root).catch((): string[] => [])) {
      const folder = join(this.root, slug)
      for (const entry of await readdir(folder).catch((): string[] => [])) {
        if (PAGE_BUILD_TMP.test(entry) || PAGE_LINK_TMP.test(entry)) await rm(join(folder, entry), { recursive: true, force: true }).catch(() => undefined)
      }
    }
  }

  /**
   * agent_library.serving.changes: read the page link of each slug, and give the state to `onPages` when it changed
   * since the last call. A read error leaves out that slug. It never throws.
   */
  private async notifyPages(): Promise<void> {
    if (this.services.onPages === undefined) return
    const pages: Record<string, string> = {}
    for (const slug of (await readdir(this.root).catch((): string[] => [])).sort()) {
      if (!SLUG_DIR.test(slug)) continue
      const link = join(this.root, slug, PAGE_DIR)
      const info = await lstat(link).catch(() => undefined)
      if (info === undefined) continue
      const target = info.isSymbolicLink() ? await readlink(link).catch(() => undefined) : PAGE_DIR
      if (target !== undefined) pages[slug] = `${basename(target)}@${String(info.mtimeMs)}`
    }
    const state: PageState = { root: this.root, pages }
    const text = JSON.stringify(state)
    if (text === this.sentPages) return
    this.sentPages = text
    this.services.onPages(state)
  }

  /** Run one job after the jobs before it. After each job, Electron main gets the page state when it changed. */
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const job = async (): Promise<T> => {
      try {
        return await work()
      } finally {
        await this.notifyPages()
      }
    }
    const next = this.queue.then(job, job)
    this.queue = next.catch(() => undefined)
    return next
  }

  /** The folder of the agent bundle of `slug`: `<root>/<slug>`. The older name of the slug used it too. */
  private folderOf(slug: string): string {
    return join(this.root, slug)
  }

  /** The folder of the package `name` of `slug`. The second name has its own folder, `<root>/<slug>.b`. */
  private folderOfName(slug: string, name: string): string {
    return name === secondBundleName(slug) ? `${this.folderOf(slug)}.b` : this.folderOf(slug)
  }

  /** Remove the bundle folder of the package `name` of `slug`. The built page of the slug stays. */
  private clearBundle(slug: string, name: string): Promise<void> {
    const folder = this.folderOfName(slug, name)
    return clearFolder(folder, folder === this.folderOf(slug))
  }

  /**
   * agent_library.build_gate: point `<root>/<slug>/page` at the build of an applied install. The new link gets a
   * temporary name, then a rename puts it over `page`, so a reader sees the old page or the new page, never none.
   * A bundle with no page removes the link, and the builds stay. Gives the link, or undefined.
   */
  private async linkPage(slug: string, build: string | undefined): Promise<string | undefined> {
    const folder = this.folderOf(slug)
    const link = join(folder, PAGE_DIR)
    const current = await lstat(link).catch(() => undefined)
    if (build === undefined) {
      if (current !== undefined) await rm(link, { recursive: !current.isSymbolicLink(), force: true })
      return undefined
    }
    // A page folder of an older install is not a link, and a rename can not replace a folder with a link.
    if (current !== undefined && !current.isSymbolicLink()) await rm(link, { recursive: true, force: true })
    const temp = join(folder, `.page-link-${randomBytes(6).toString('hex')}`)
    await symlink(build, temp, 'dir')
    await rename(temp, link)
    await this.prunePages(slug, build)
    return link
  }

  /** Keep the current build and the newest other builds of `slug`, {@link PAGE_BUILDS_KEPT} in all. */
  private async prunePages(slug: string, current: string): Promise<void> {
    const folder = this.folderOf(slug)
    const builds: { name: string, at: number }[] = []
    for (const name of await readdir(folder)) {
      if (!PAGE_BUILD.test(name) || name === current) continue
      const info = await stat(join(folder, name)).catch(() => undefined)
      if (info !== undefined) builds.push({ name, at: info.mtimeMs })
    }
    builds.sort((a, b) => b.at - a.at)
    for (const { name } of builds.slice(PAGE_BUILDS_KEPT - 1)) await rm(join(folder, name), { recursive: true, force: true })
  }

  /** Remove a build that this install made, when the install did not apply and no link names it. */
  private async dropBuild(slug: string, build: string): Promise<void> {
    const folder = this.folderOf(slug)
    const target = await readlink(join(folder, PAGE_DIR)).catch(() => undefined)
    if (target === build) return
    await rm(join(folder, build), { recursive: true, force: true })
    await rmdir(folder).catch(() => undefined)
  }

  /**
   * The installed agent bundles of `slug`: the current name, the second name (`widget_fv.replace`), and the older name
   * when the profile dependency of that name is the agent folder of the slug. Another bundle with the older name is not
   * an agent bundle and stays. A built-in widget is not installed in the profile, so its row never shows here.
   */
  private async installedNames(slug: string, bundles?: BundleInfo[]): Promise<string[]> {
    const installed = new Map((bundles ?? await this.services.pluginManager.listBundles()).filter((bundle) => bundle.installed).map((bundle) => [bundle.name, bundle]))
    const names = [bundleName(slug), secondBundleName(slug)].filter((name) => installed.has(name))
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
   * widget_fv.replace: which of `names` registered `slug`, by the rows of `which` in this order: `live` (the live
   * entry), `failed` (the failed entry of a quarantined row), and `standby` (a registration that waits for the entry).
   */
  private registeredName(slug: string, names: string[], which: ('live' | 'failed' | 'standby')[]): string | undefined {
    const rows = this.services.records.rowsOf(slug)
    for (const kind of which) {
      const row = rows[kind]
      const name = row === undefined ? undefined : names.find((item) => row === item || row.endsWith(`:${item}`))
      if (name !== undefined) return name
    }
    return undefined
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

  /** The record of the installed agent bundle of `slug`: of the name that registered the slug, else of the first name. */
  private async meta(slug: string, names: string[]): Promise<WidgetMeta | undefined> {
    const first = this.registeredName(slug, names, ['live', 'failed', 'standby'])
    for (const name of first === undefined ? names : [first, ...names]) {
      try {
        return JSON.parse(await readFile(join(this.folderOfName(slug, name), META_FILE), 'utf8')) as WidgetMeta
      } catch {
        // No folder or no record for this name.
      }
    }
    return undefined
  }

  /** Wait until `test` is true, for at most {@link LIVE_WAIT_MS}. */
  private async waitFor(test: () => boolean): Promise<boolean> {
    const until = Date.now() + LIVE_WAIT_MS
    while (Date.now() < until) {
      if (test()) return true
      await new Promise((resolve) => { setTimeout(resolve, 100) })
    }
    return false
  }

  /**
   * main_widget.widgets: the slugs that the operator turned off in the main widget.
   * @throws {CreationError} `install-failed` when the file exists and is not a list of slugs. The installer does not guess
   * the choice of the operator.
   */
  private async turnedOffSlugs(): Promise<Set<string>> {
    const file = join(this.root, TURNED_OFF_FILE)
    let text: string
    try {
      text = await readFile(file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Set()
      throw error
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = undefined
    }
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new CreationError('install-failed', `the file ${file} is not a list of slugs, so the Turn off of the operator is not known`, {
        nextStep: `Tell the user that the file ${file} is broken. It lists the widgets that the user turned off in the main window. The user can delete it and turn those widgets off again.`,
      })
    }
    return new Set(parsed)
  }

  /** Store the Turn off (`off`) or the Turn on of `slug`. The file is replaced in one rename. */
  private async writeTurnedOff(slug: string, off: boolean): Promise<void> {
    const slugs = await this.turnedOffSlugs()
    if (slugs.has(slug) === off) return
    if (off) slugs.add(slug)
    else slugs.delete(slug)
    await mkdir(this.root, { recursive: true })
    const file = join(this.root, TURNED_OFF_FILE)
    const temp = `${file}.${randomBytes(4).toString('hex')}.tmp`
    await writeFile(temp, `${JSON.stringify([...slugs].sort())}\n`)
    await rename(temp, file)
  }

  /**
   * main_widget.widgets: Turn off (`off`) or Turn on `slug` for the operator. `change` turns the plugin rows of the slug
   * off or on. It runs in the queue, so it never runs during an install, a replace, or a remove. The choice is stored
   * only after `change` returns, and it lasts across host starts: while it is off, an install or a reload of the slug
   * installs the new row off. When `change` throws, for example a refusal with no row to change, nothing is stored.
   */
  turn<T>(slug: string, off: boolean, change: () => Promise<T>): Promise<T> {
    return this.serial(async () => {
      const result = await change()
      await this.writeTurnedOff(slug, off)
      return result
    })
  }

  /**
   * main_widget.widgets: set the Loader row of the new bundle `name` on or off, as the operator chose. A Turn off of an
   * earlier bundle with the same name can stay in the profile patch, so the row can start in the other state.
   * @returns `same` when the row was already in that state, `changed` when the installer changed it, or false, with a
   * diagnostic, when the row is not in the Loader or the plugin manager did not change it.
   */
  private async settleRow(name: string, enabled: boolean, diagnostics: string[]): Promise<'same' | 'changed' | false> {
    const row = await this.rowOfName(name)
    if (row === undefined) {
      diagnostics.push(`the row ${name} is not in the Loader after the install`)
      return false
    }
    if (row.enabled === enabled) return 'same'
    const change = await this.services.pluginManager.setPluginEnabled(row.entryId, enabled)
    if (change.application === 'applied') return 'changed'
    diagnostics.push(`the plugin manager did not turn the row ${name} ${enabled ? 'on' : 'off'}: ${resultDiagnostics(change).join('; ')}`)
    return false
  }

  /** The Loader row of the bundle `name`: its row id is the package name. */
  private async rowOfName(name: string): Promise<PluginInfo | undefined> {
    return (await this.services.pluginManager.listPlugins()).find((info) => info.entryId === name || info.entryId.endsWith(`:${name}`))
  }

  /**
   * main_widget.widgets: remove the bundle `name` of `slug`. First end a Turn on that the profile patch keeps for its row.
   * The bundle of a row that the installer installed off has `disabled: true`, so a Turn on of that row is an override in
   * the profile patch. The override would outlive the bundle and start a later bundle with the same name before its first
   * load, also while the operator keeps the slug off. Turning the row off again deletes the override, because off is what
   * its bundle patch says. A live row ends at this step, as at the removal.
   * @returns the result of the plugin manager: of the Turn off when it failed, else of the removal.
   */
  private async removeBundleOf(slug: string, name: string): Promise<ChangeResult> {
    const patch = await readFile(join(this.folderOfName(slug, name), 'cordis.patch.yml'), 'utf8').catch(() => '')
    if (name !== legacyBundleName(slug) && /^\s+disabled: true$/m.test(patch)) {
      const row = await this.rowOfName(name)
      if (row?.enabled === true) {
        const change = await this.services.pluginManager.setPluginEnabled(row.entryId, false)
        if (change.application !== 'applied') return change
      }
    }
    return this.services.pluginManager.removeBundle(name)
  }

  private waitLive(slug: string): Promise<boolean> {
    return this.waitFor(() => this.services.widgets.list().some((widget) => widget.slug === slug))
  }

  /** Run the gates and install `dir`. A bundle of the same slug is replaced. */
  install(dir: string): Promise<InstallOutcome> {
    return this.serial(() => this.installNow(dir, undefined))
  }

  /** Run the gates on the source folder of the installed `slug` again and replace its bundle. */
  reload(slug: string): Promise<InstallOutcome> {
    return this.serial(async () => {
      const names = await this.installedNames(slug)
      const meta = await this.meta(slug, names)
      if (meta === undefined || names.length === 0) throw new CreationError('not-installed', `no agent widget bundle has the slug ${JSON.stringify(slug)}`)
      return this.installNow(meta.source, slug)
    })
  }

  /**
   * Remove the bundle of `slug`. Its state stays in storage, and the shown state of its window goes. With `operator`, the Remove of the main widget, it also ends
   * a Turn off of the slug (main_widget.widgets). An agent `widget_remove` keeps it.
   */
  remove(slug: string, options: { operator?: boolean } = {}): Promise<{ slug: string, application: ChangeResult['application'] }> {
    return this.serial(async () => {
      const installed = await this.installedNames(slug)
      const names = await this.meta(slug, installed) === undefined ? [] : installed
      if (names.length === 0) throw new CreationError('not-installed', `no agent widget bundle has the slug ${JSON.stringify(slug)}`)
      let application: ChangeResult['application'] = 'applied'
      const removed: string[] = []
      for (const name of names) {
        const result = await this.removeBundleOf(slug, name)
        if (result.application !== 'applied') {
          const done = removed.length === 0 ? '' : `; ${removed.join(', ')} was removed`
          throw new CreationError('install-failed', `the plugin manager did not remove ${name}${done}`, { diagnostics: resultDiagnostics(result) })
        }
        removed.push(name)
        application = result.application
      }
      await rm(this.folderOf(slug), { recursive: true, force: true })
      await rm(this.folderOfName(slug, secondBundleName(slug)), { recursive: true, force: true })
      this.services.records.clearOff(slug)
      this.services.records.commit(slug, undefined)
      // main_widget.window_state: a later install of the slug is a new widget, so its window starts as shown.
      await this.services.records.forgetWindow(slug)
      // main_widget.widgets: only the operator ends a Turn off: Turn on, or Remove in the main widget. After an agent
      // `widget_remove`, a later `widget_install` of the slug installs it off.
      if (options.operator === true) await this.writeTurnedOff(slug, false)
      return { slug, application }
    })
  }

  /** Remove the leftover bundle `name` of `slug` before the install. `keep` stays. When it fails, the install stops. */
  private async removeFirst(slug: string, name: string, keep: string): Promise<void> {
    const removal = await this.removeBundleOf(slug, name)
    if (removal.application !== 'applied') {
      throw new CreationError('install-failed', `the plugin manager did not remove the leftover bundle ${name}; ${keep} stays, and nothing was installed`, { diagnostics: resultDiagnostics(removal) })
    }
    // The older name and the current name share a folder.
    if (this.folderOfName(slug, name) !== this.folderOfName(slug, keep)) await this.clearBundle(slug, name)
  }

  private async installNow(dir: string, expected: string | undefined): Promise<InstallOutcome> {
    const pages: PageRoots = { slugDir: (slug) => this.folderOf(slug), stagingRoot: join(this.root, PAGE_STAGING) }
    const outcome = await runGates(dir, pages, this.services.renderCheck, this.services.checkPageMode)
    try {
      return await this.installGated(dir, expected, outcome)
    } catch (error) {
      // A new build of an install that did not apply goes. An older build of the same sources stays.
      if (outcome.page !== undefined && !outcome.page.reused && outcome.widget !== undefined) await this.dropBuild(outcome.widget.slug, outcome.page.name)
      throw error
    }
  }

  private async installGated(dir: string, expected: string | undefined, outcome: GatesOutcome): Promise<InstallOutcome> {
    const failed = outcome.gates.find((gate) => !gate.ok)
    if (failed !== undefined || outcome.widget === undefined || outcome.code === undefined) {
      const gate = failed?.gate ?? 'test'
      const nextStep = isPageGate(gate) ? pageNextStep(gate, failed?.diagnostics ?? []) : undefined
      throw new CreationError('gate-failed', `the ${gate} gate refused the bundle; nothing was installed`, { gate, diagnostics: failed?.diagnostics ?? ['the test run found no widget'], ...(nextStep === undefined ? {} : { nextStep }) })
    }
    const { widget, code } = outcome
    const { slug } = widget
    if (expected !== undefined && slug !== expected) throw new CreationError('slug-changed', `the source now registers ${JSON.stringify(slug)}, not ${JSON.stringify(expected)}`)
    const warnings = outcome.gates.flatMap((gate) => gate.warnings)
    // widget_fv.install (widget.builtin_slugs): the slug of a built-in widget is reserved, also while it is off.
    if (await this.services.records.builtInSlug(slug)) {
      throw new CreationError('slug-taken', `the slug ${JSON.stringify(slug)} is the slug of a built-in widget`)
    }
    let previous = await this.installedNames(slug)
    const replaced = previous.length > 0
    // widget_fv.install: a widget that safe mode turned off is not live, so it does not take the slug.
    if (!replaced && this.services.widgets.list().some((item) => item.slug === slug && item.off === undefined)) {
      throw new CreationError('slug-taken', `a widget that is not an agent bundle has the slug ${JSON.stringify(slug)}`)
    }
    this.services.records.clearOff(slug)
    await this.migrateSeed(slug)
    await mkdir(this.root, { recursive: true })
    // widget_fv.replace: one installed name is the old version. A host crash during a replace can leave more names
    // installed. An install removes a bundle only when the version that stays registered with success in this Host
    // start: the name of the live entry of the slug stays. This can be the committed name, or the other name after a
    // fallback, when the committed row failed at the start. With no live entry, the install stops and removes nothing.
    // The other names go first. Each of them is at most a standby, so its removal starts no code and writes no seed.
    if (previous.length > 1) {
      const keep = this.registeredName(slug, previous, ['live'])
      if (keep === undefined) {
        throw new CreationError('install-failed', `the bundles ${previous.join(', ')} of ${slug} are installed, and none is live in this Host start; nothing was removed or installed`, {
          nextStep: `No installed version of ${slug} can start. Call widget_remove with the slug ${slug}: it removes both bundles and keeps the state. Then call widget_install again.`,
        })
      }
      for (const leftover of previous.filter((item) => item !== keep)) await this.removeFirst(slug, leftover, keep)
      // The kept version is the committed one now: a committed name that was removed does not stay in the record.
      if (this.services.records.committed(slug) !== keep) this.services.records.commit(slug, keep)
      previous = [keep]
    }
    const old = previous[0]
    // The new version goes under the agent name whose folder is not the folder of the old one. The older name
    // `deepwidgets-widget-<slug>` uses the folder of the current name.
    const name = old === undefined || old === secondBundleName(slug) ? bundleName(slug) : secondBundleName(slug)
    const folder = this.folderOfName(slug, name)
    // main_widget.widgets: the operator turned the slug off in the main widget. The new row starts off.
    const off = (await this.turnedOffSlugs()).has(slug)
    await writeBundle(folder, name, widget, code, dir, folder === this.folderOf(slug), off)

    // widget_fv.install: the program record before the load. A standby writes no seed, so only the load of a first
    // install, or a user edit through the live old version, can change it during the install.
    const before = await this.services.records.programRecord(slug)
    // widget_fv.install: a quarantine of the slug ends only when the whole install succeeds, not when the load does.
    this.services.records.holdLift(slug)
    try {
      const done = await this.loadNew({ slug, widget, folder, name, old, replaced, before, off, gates: outcome.gates, warnings })
      // The bundle is live from here, so a failed link is a warning, not a failed install.
      const page = await this.linkPage(slug, outcome.page?.name).catch((error: unknown) => {
        done.warnings.push(`the page link of the built page was not written into the profile: ${errorText(error)}`)
        return undefined
      })
      return page === undefined ? done : { ...done, page }
    } finally {
      // After a success the hold is already settled; this ends it after a throw.
      this.services.records.settleLift(slug, false)
    }
  }

  /**
   * The load of the new bundle of `installNow`, the removal of the old bundle, and the rollback (`widget_fv.replace`).
   * The old bundle goes only after the new one registered: live, or as the standby of the old one. When the old one
   * goes, its entry ends and the standby takes its place. A failure before that point removes only the new bundle.
   */
  private async loadNew(job: {
    slug: string
    widget: TestRunWidget
    folder: string
    name: string
    old: string | undefined
    replaced: boolean
    before: ProgramRecord | undefined
    /** main_widget.widgets: the operator turned the slug off. The new row stays off, so it does not register. */
    off: boolean
    gates: GateReport[]
    warnings: string[]
  }): Promise<InstallOutcome> {
    const { slug, widget, folder, name, old, replaced, before, off } = job
    const was = this.services.records.committed(slug)
    const result = await this.services.pluginManager.installBundle(folder)
    const diagnostics = resultDiagnostics(result)
    const warnings = [...job.warnings]
    // A new row that is off counts as registered when it is in the Loader and off: its code runs at the Turn on.
    const settled = result.application === 'applied' ? await this.settleRow(name, !off, diagnostics) : false
    let registered = settled !== false
    // The bundle patch starts the row off. Only an override in the profile patch that the installer did not remove can
    // start it: then its code ran once before the installer turned it off, and the answer says so.
    if (off && settled === 'changed') warnings.push(`the row ${name} started on, because the profile patch turned it on; the installer turned it off, but its code ran once`)
    if (registered && !off) {
      registered = await this.waitFor(() => this.registeredName(slug, [name], ['live', 'standby']) !== undefined)
      if (!registered) diagnostics.push(`the widget ${slug} of ${name} did not register within ${String(LIVE_WAIT_MS)} ms`)
    }
    // widget_fv.replace: the commit point. The new version registered, so from here a Host start loads it as the owner
    // of the slug, and the old version as its standby. A failure below puts back the committed name from before.
    if (registered) this.services.records.commit(slug, name)
    if (registered && old !== undefined) {
      const removal = await this.removeBundleOf(slug, old)
      if (removal.application === 'applied') {
        await this.clearBundle(slug, old)
      } else if (this.registeredName(slug, [name], ['live']) !== undefined) {
        // The new version is live: the plugin manager turned the old bundle off before `pnpm remove` failed, or the old
        // version was not live. The old bundle is a leftover, and the next install of the slug removes it.
        warnings.push(`the plugin manager did not remove the old bundle ${old}; the new version is live, and the next install of ${slug} removes the old bundle: ${resultDiagnostics(removal).join('; ')}`)
      } else {
        registered = false
        diagnostics.push(`the plugin manager did not remove the old bundle ${old}: ${resultDiagnostics(removal).join('; ')}`)
      }
    }
    if (registered && off) {
      // The new code did not run (unless a profile override started it), so it applied no seed. At the Turn on, its
      // registration applies its seed program.
      this.services.records.settleLift(slug, true)
      const ran = settled === 'changed' ? ', but its code ran once at the install' : ''
      const turnedOff = { code: 'turned-off' as const, message: `the user turned ${slug} off in the main window, so the new version is installed off and does not run until the user turns it on${ran}; its state stays` }
      return { slug, replaced, application: result.application, programUpdated: false, gates: job.gates, warnings, turnedOff }
    }
    if (registered && await this.waitLive(slug)) {
      this.services.records.settleLift(slug, true)
      // The stored program wins over the seed, and it stays across a remove. A new seed in the code is the newer
      // intent: the load set it, in the same write as its hash (`seed` in the widgets runtime).
      const after = await this.services.records.programRecord(slug)
      // A record of an older format with no hash: the stored program stays, and it takes the hash of this seed.
      if (after !== undefined && after.seed === undefined) await this.services.records.adoptSeed(slug, hashText(widget.program))
      const programUpdated = before?.seed !== undefined && after?.seed !== before.seed
      return { slug, replaced, application: result.application, programUpdated, gates: job.gates, warnings }
    }
    if (registered) diagnostics.push(`the widget ${slug} did not show in widget_list within ${String(LIVE_WAIT_MS)} ms`)
    if (this.services.records.committed(slug) !== was) this.services.records.commit(slug, was)

    if ((await this.installedNames(slug)).includes(name)) {
      const undo = await this.removeBundleOf(slug, name)
      if (undo.application !== 'applied') diagnostics.push(`the failed bundle was not removed: ${resultDiagnostics(undo).join('; ')}`)
    }
    this.services.records.clearOff(slug)
    await this.clearBundle(slug, name)
    // widget_fv.install: the failed load of a first install can have written the program record. Put back the record
    // and its seed hash. When a version still runs, the record stays: it is the record of that code. widget_fv.replace:
    // that version is the old one, whose user edits during the install stay, or a failed bundle that could not be removed.
    const stillLive = this.services.widgets.list().some((item) => item.slug === slug && item.off === undefined && item.failed === undefined)
    if (!stillLive) await this.services.records.restoreProgram(slug, before, { by: 'widget_install' })
    // The install failed: a load of other files during it does not end a quarantine.
    this.services.records.settleLift(slug, false)
    if (old !== undefined) diagnostics.push(`the previous bundle ${old} was not removed, and it stays`)
    throw new CreationError('install-failed', `the plugin manager did not apply ${name}`, { diagnostics })
  }

  /**
   * modes.source: the folder that the installed agent bundle of `slug` came from, the folder that `widget_reload` reads.
   * Undefined for a slug with no agent bundle, such as a built-in widget. It only reads, so it does not wait in the queue.
   */
  async source(slug: string): Promise<string | undefined> {
    const names = await this.installedNames(slug)
    if (names.length === 0) return undefined
    return (await this.meta(slug, names))?.source
  }

  /**
   * main_widget.widgets: the source folder of each agent widget of `slugs`, as {@link source} gives it, with one read of
   * the bundle list for all of them. A slug with no agent bundle has no item.
   */
  async sources(slugs: readonly string[]): Promise<Map<string, string>> {
    const bundles = await this.services.pluginManager.listBundles()
    const out = new Map<string, string>()
    for (const slug of slugs) {
      const names = await this.installedNames(slug, bundles)
      const source = names.length === 0 ? undefined : (await this.meta(slug, names))?.source
      if (source !== undefined) out.set(slug, source)
    }
    return out
  }
}
