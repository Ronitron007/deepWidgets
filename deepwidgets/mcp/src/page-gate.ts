/**
 * The page gates of a widget bundle (`agent_library.build_gate`). A bundle can hold a folder `page/` next to `src/`.
 * After the host gates pass, these gates run in order, and the first one that fails stops the install:
 *
 * 1. `page-files`: `page/index.html`, `page/main.tsx`, and the `dw-core` block of `page/styles.css` have the hash
 *    of the template files.
 * 2. `page-types`: the type check of oxlint (the type gate of the host gates) on a staging copy of `page/`. The copy
 *    has a `node_modules` folder with links to the allowed packages only, so an import of another package does not
 *    resolve.
 * 3. `page-build`: Vite builds the copy in a child process (`page-build-child.ts`). Its import fence refuses each
 *    import of a page file that is not on the allowed list.
 * 4. `page-render`: Electron main loads the built page in a hidden window, with the program and the query answers
 *    of the test run. A CLI host has no Electron main, so the check does not run there, and the gate gives a warning.
 *
 * The built page stays in a staging folder until the install applies. Then the installer moves it into the profile.
 * @module @deepwidgets/mcp/page-gate
 */
import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import type { GateReport } from './creation.ts'
import type { PageBuildJob, PageBuildReport } from './page-build-child.ts'

const require = createRequire(import.meta.url)

/** The page gates, in order. */
export type PageGateName = 'page-files' | 'page-types' | 'page-build' | 'page-render'

/** The fixed files of the template, by their path under `page/`. `styles.css` is fixed only in its `dw-core` block. */
const FIXED_FILES = ['index.html', 'main.tsx'] as const
const CORE_BEGIN = '/* dw-core:begin'
const CORE_END = '/* dw-core:end */'

/** The packages that a page file may import, exactly (`agent_library.build_gate.gates`). */
const ALLOWED = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
  '@openuidev/react-lang',
  '@deepwidgets/widget-kit',
  // Vite adds this import to the entry of the page itself.
  'vite/modulepreload-polyfill',
]
/** The shadcn pieces of the shell: `@deepwidgets/shell/ui/<file>` and `@deepwidgets/shell/components/<file>`. */
const ALLOWED_PREFIXES = ['@deepwidgets/shell/ui/', '@deepwidgets/shell/components/']

const LINT_LIMIT_MS = 60_000
const BUILD_LIMIT_MS = 90_000
const MAX_DIAGNOSTICS = 20

/** The list of allowed imports, for the next step of a refused page. */
export const ALLOWED_TEXT = `${ALLOWED.filter((name) => !name.startsWith('vite/')).join(', ')}, ${ALLOWED_PREFIXES.map((prefix) => `${prefix}*`).join(', ')}`

/** What Electron main gets for the render check (`agent_library.build_gate.render`). */
export interface RenderCheckRequest {
  slug: string
  /** The folder of the built page. */
  pageDir: string
  /** The program of the test run. */
  program: string
  /** The answer of each query action of the test run, by action name. */
  answers: Record<string, RenderAnswer>
  /** The `dw-core` block of the template, for the style check of the page-state boxes. */
  coreCss: string
}

/** One query answer of the test run. */
export type RenderAnswer = { ok: true, result: unknown } | { ok: false, message: string }

/** What Electron main answers. `diagnostics` lines start with a code: `render-error`, `not-ready`, `lost-core-styles`, or `load-failed`. */
export interface RenderCheckResult {
  ok: boolean
  diagnostics: string[]
  warnings: string[]
}

/** Runs the render check in Electron main. Undefined in a CLI host. */
export type RenderCheck = (request: RenderCheckRequest) => Promise<RenderCheckResult>

/** The test run facts that the page gates use. */
export interface PageInput {
  slug: string
  program: string
  answers: Record<string, RenderAnswer>
}

/** The tools of the type gate: the same oxlint and tsgolint as the lint gate of the host gates. */
export interface PageTools {
  oxlint: string
  tsgolint: string
}

/** The outcome of the page gates. `built` is the folder of the built page when every gate passed. */
export interface PageOutcome {
  gates: GateReport[]
  built?: string
  /** Removes the staging folder, with the built page. The installer calls it after it moved the page. */
  cleanup: () => Promise<void>
}

/** The next step of each page gate. */
export const PAGE_NEXT_STEP: Record<PageGateName, string> = {
  'page-files': 'Restore page/index.html, page/main.tsx, and the dw-core block of page/styles.css from the template. Write your styles below the block. Then call widget_install again. Nothing was installed.',
  'page-types': `Fix the type error at each diagnostic, then call widget_install again. A page may import only: ${ALLOWED_TEXT}, and files in page/. Nothing was installed.`,
  'page-build': `Fix the build error at each diagnostic, then call widget_install again. A page may import only: ${ALLOWED_TEXT}, and files in page/. Nothing was installed.`,
  'page-render': 'The page failed in the render check with the program and the query answers of the test run. Fix the component or the styles at each diagnostic, then call widget_install again. Nothing was installed.',
}

const elapsed = (started: number): number => Math.round(performance.now() - started)
const hashText = (text: string): string => createHash('sha256').update(text).digest('hex')
const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error)

/** The folder of the template page, and of this package. */
function packageRoot(): string {
  return dirname(require.resolve('@deepwidgets/mcp/package.json'))
}

/** True when `dir` has a folder `page/`. A bundle without it installs with the host gates only. */
export async function hasPage(dir: string): Promise<boolean> {
  return (await stat(join(dir, 'page')).catch(() => undefined))?.isDirectory() === true
}

/** The `dw-core` block of a stylesheet, from its begin marker to the end of its end marker. */
export function coreBlock(text: string): string | undefined {
  const begin = text.indexOf(CORE_BEGIN)
  const end = text.indexOf(CORE_END)
  if (begin === -1 || end === -1 || end < begin || text.indexOf(CORE_BEGIN, begin + 1) !== -1) return undefined
  return text.slice(begin, end + CORE_END.length)
}

/** The CSS inside the `dw-core` block of the template, for the render check. */
async function templateCore(): Promise<string> {
  const block = coreBlock(await readFile(join(packageRoot(), 'widget', 'template', 'page', 'styles.css'), 'utf8'))
  if (block === undefined) throw new Error('the template page/styles.css has no dw-core block')
  return block
}

/** Gate `page-files`. */
async function filesGate(page: string): Promise<GateReport> {
  const started = performance.now()
  const template = join(packageRoot(), 'widget', 'template', 'page')
  const diagnostics: string[] = []
  const read = (file: string): Promise<string | undefined> => readFile(file, 'utf8').catch(() => undefined)
  for (const name of FIXED_FILES) {
    const want = await read(join(template, name))
    if (want === undefined) throw new Error(`the template has no page/${name}`)
    const have = await read(join(page, name))
    if (have === undefined) diagnostics.push(`page/${name}: the file is missing. Copy it from the template.`)
    else if (hashText(have) !== hashText(want)) diagnostics.push(`page/${name}: the file differs from the template. It is fixed: restore it from the template.`)
  }
  const styles = await read(join(page, 'styles.css'))
  if (styles === undefined) diagnostics.push('page/styles.css: the file is missing. Copy it from the template.')
  else {
    const have = coreBlock(styles)
    if (have === undefined) diagnostics.push('page/styles.css: the file has no single dw-core block. Copy the block from the template.')
    else if (hashText(have) !== hashText(await templateCore())) diagnostics.push('page/styles.css: the dw-core block differs from the template. It is fixed: restore it, and write your styles below it.')
  }
  return { gate: 'page-files', ok: diagnostics.length === 0, ms: elapsed(started), diagnostics, warnings: [] }
}

/** The real folder of an allowed package, as `@deepwidgets/widget-kit` resolves it, so the page and the core share one copy. */
function packageFolders(): Record<string, string> {
  const kit = dirname(require.resolve('@deepwidgets/widget-kit/package.json'))
  const kitRequire = createRequire(join(kit, 'package.json'))
  // A package can leave `package.json` out of its exports, so the folder comes from the node_modules lookup paths.
  const folder = (from: NodeJS.Require, name: string): string => {
    const found = (from.resolve.paths(name) ?? []).map((base) => join(base, name)).find((path) => existsSync(join(path, 'package.json')))
    if (found === undefined) throw new Error(`the page gates did not find the package ${name}`)
    return found
  }
  return {
    'react': folder(kitRequire, 'react'),
    'react-dom': folder(kitRequire, 'react-dom'),
    '@openuidev/react-lang': folder(kitRequire, '@openuidev/react-lang'),
    '@types/react': folder(kitRequire, '@types/react'),
    '@types/react-dom': folder(kitRequire, '@types/react-dom'),
    '@deepwidgets/widget-kit': kit,
    '@deepwidgets/shell': dirname(require.resolve('@deepwidgets/shell/package.json')),
  }
}

/**
 * Copy `dir/page` into a new staging folder: `<staging>/page`, next to `<staging>/node_modules` with links to the allowed packages only,
 * and the configs of the type gate.
 */
async function stagePage(dir: string): Promise<{ staging: string, page: string }> {
  const staging = await realpath(await mkdtemp(join(tmpdir(), 'deepwidgets-page-')))
  const page = join(staging, 'page')
  await cp(join(dir, 'page'), page, { recursive: true, filter: (source) => !relative(dir, source).split(/[\\/]/).includes('node_modules') })
  for (const [name, target] of Object.entries(packageFolders())) {
    const link = join(staging, 'node_modules', name)
    await mkdir(dirname(link), { recursive: true })
    await symlink(await realpath(target), link, 'dir')
  }
  await writeFile(join(staging, 'page-env.d.ts'), "// A stylesheet import has no value.\ndeclare module '*.css' {}\n")
  await writeFile(join(staging, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'es2024',
      module: 'esnext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      allowImportingTsExtensions: true,
      types: [],
      lib: ['es2024', 'dom', 'dom.iterable'],
    },
    files: [join(staging, 'page-env.d.ts')],
    include: ['page/**/*'],
  }, null, 2))
  await writeFile(join(staging, 'oxlintrc.json'), JSON.stringify({
    plugins: ['typescript'],
    categories: { correctness: 'off' },
    options: { typeAware: true },
    // The type gate reports the type errors. A rule keeps tsgolint running.
    rules: { 'typescript/no-floating-promises': 'error' },
  }, null, 2))
  return { staging, page }
}

/** Gate `page-types`: the type check of oxlint, as the lint gate of the host gates runs it. */
async function typesGate(staging: string, tools: PageTools): Promise<GateReport> {
  const started = performance.now()
  const args = [tools.oxlint, '-c', join(staging, 'oxlintrc.json'), '--type-aware', '--type-check', '--tsconfig', join(staging, 'tsconfig.json'), '--format', 'unix', 'page']
  const { code, output } = await new Promise<{ code: number, output: string }>((resolve) => {
    execFile(process.execPath, args, {
      cwd: staging,
      encoding: 'utf8',
      timeout: LINT_LIMIT_MS,
      maxBuffer: 1 << 24,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', OXLINT_TSGOLINT_PATH: tools.tsgolint },
    }, (error, stdout, stderr) => {
      const exit = error === null ? 0 : typeof error.code === 'number' ? error.code : 1
      const reason = error !== null && typeof error.code !== 'number' ? `${error.message}\n` : ''
      resolve({ code: exit, output: `${reason}${stdout}${stderr}` })
    })
  })
  if (code === 0) return { gate: 'page-types', ok: true, ms: elapsed(started), diagnostics: [], warnings: [] }
  const strip = (line: string): string => line.replaceAll(`${staging}/`, '')
  const diagnostics = output.split('\n').map((line) => strip(line.trim())).filter((line) => /^[^\s:]+:\d+:\d+: /.test(line))
  if (diagnostics.length === 0) diagnostics.push(`oxlint exited with ${String(code)}: ${strip(output.trim()).slice(-600)}`)
  return { gate: 'page-types', ok: false, ms: elapsed(started), diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS), warnings: [] }
}

/** Gate `page-build`: Vite in a child process. */
async function buildGate(staging: string, slug: string): Promise<{ report: GateReport, built?: string }> {
  const started = performance.now()
  const outDir = join(staging, 'out')
  const emptyDir = join(staging, 'env')
  await mkdir(emptyDir, { recursive: true })
  const job: PageBuildJob = {
    root: join(staging, 'page'),
    outDir,
    base: `/widget/${slug}/`,
    emptyDir,
    cacheDir: join(staging, 'vite-cache'),
    allowed: ALLOWED,
    allowedPrefixes: ALLOWED_PREFIXES,
  }
  const jobFile = join(staging, 'build-job.json')
  await writeFile(jobFile, JSON.stringify(job))
  const child = spawn(process.execPath, [join(packageRoot(), 'lib', 'page-build-child.js'), jobFile], {
    cwd: staging,
    env: { PATH: process.env.PATH ?? '', ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => { stdout += chunk })
  child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-4_000) })
  let killed = false as boolean
  const timer = setTimeout(() => { killed = true; child.kill('SIGKILL') }, BUILD_LIMIT_MS)
  const code = await new Promise<number | null>((resolve) => { child.once('close', (exit) => { resolve(exit) }) })
  clearTimeout(timer)
  const line = stdout.split('\n').find((item) => item.startsWith('RESULT '))
  let result: PageBuildReport | undefined
  try {
    result = line === undefined ? undefined : JSON.parse(line.slice(7)) as PageBuildReport
  } catch {
    result = undefined
  }
  const report = (ok: boolean, diagnostics: string[]): GateReport => ({ gate: 'page-build', ok, ms: elapsed(started), diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS), warnings: [] })
  if (killed) return { report: report(false, [`the build took longer than ${String(BUILD_LIMIT_MS)} ms`]) }
  if (result === undefined) return { report: report(false, [`the build process ended with ${String(code)}: ${stderr.trim().split('\n').slice(0, 3).join(' | ').slice(0, 400)}`]) }
  if (!result.ok) return { report: report(false, result.diagnostics) }
  if ((await stat(join(outDir, 'index.html')).catch(() => undefined))?.isFile() !== true) return { report: report(false, ['the build wrote no index.html']) }
  return { report: report(true, []), built: outDir }
}

/** Gate `page-render`. With no Electron main, the gate passes with the warning that the check was skipped. */
async function renderGate(built: string, input: PageInput, renderCheck: RenderCheck | undefined): Promise<GateReport> {
  const started = performance.now()
  if (renderCheck === undefined) {
    return { gate: 'page-render', ok: true, ms: elapsed(started), diagnostics: [], warnings: ['the render check of the page was skipped: this host has no Electron main (a CLI host)'] }
  }
  try {
    const result = await renderCheck({ slug: input.slug, pageDir: built, program: input.program, answers: input.answers, coreCss: await templateCore() })
    return { gate: 'page-render', ok: result.ok, ms: elapsed(started), diagnostics: result.diagnostics.slice(0, MAX_DIAGNOSTICS), warnings: result.warnings }
  } catch (error) {
    return { gate: 'page-render', ok: false, ms: elapsed(started), diagnostics: [`load-failed: the render check did not run: ${errorText(error)}`], warnings: [] }
  }
}

/**
 * Run the page gates on `dir/page`. The first failed gate stops the run. When each gate passes, `built` is the folder
 * of the built page; it stays until the caller calls `cleanup`.
 */
export async function runPageGates(dir: string, input: PageInput, tools: PageTools, renderCheck: RenderCheck | undefined): Promise<PageOutcome> {
  const gates: GateReport[] = []
  const files = await filesGate(join(dir, 'page'))
  gates.push(files)
  if (!files.ok) return { gates, cleanup: () => Promise.resolve() }
  const { staging } = await stagePage(dir)
  const cleanup = (): Promise<void> => rm(staging, { recursive: true, force: true })
  try {
    const types = await typesGate(staging, tools)
    gates.push(types)
    if (!types.ok) { await cleanup(); return { gates, cleanup } }
    const { report, built } = await buildGate(staging, input.slug)
    gates.push(report)
    if (built === undefined) { await cleanup(); return { gates, cleanup } }
    const render = await renderGate(built, input, renderCheck)
    gates.push(render)
    if (!render.ok) { await cleanup(); return { gates, cleanup } }
    return { gates, built, cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}
