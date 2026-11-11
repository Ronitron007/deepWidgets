/**
 * The child of the build gate of a widget page (`agent_library.build_gate.gates`). It builds the staging copy of
 * `page/` with one Vite config: React, Tailwind, the target of the shell, and the `base` of the slug. The plugin
 * `importFence` refuses each import of a page file that is not on the allowed list. `outputFence` refuses the build
 * when any file that went into the page is outside `page/` and outside the allowed packages. Before the build,
 * `stylesheetProblems` refuses config files, `@plugin`, and `@config`, and the inline PostCSS config means that Vite
 * loads no PostCSS config file of the page. The build runs in its own process, so a long synchronous step of
 * Rollup or Tailwind does not hold the host.
 *
 * Protocol on stdout: one line `RESULT <json>` ({@link PageBuildReport}) at the end.
 *
 * Usage: `<node> page-build-child.js <job.json>` with a {@link PageBuildJob}.
 * @module @deepwidgets/mcp/page-build-child
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { readdir, readFile, realpath } from 'node:fs/promises'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { build, type Plugin } from 'vite'

const require = createRequire(import.meta.url)

/** The job file of the child. */
export interface PageBuildJob {
  /** The staging copy of `page/`. */
  root: string
  /** The staging `node_modules` next to it, with links to the allowed packages only. */
  modules: string
  outDir: string
  /** The URL path of the slug, `/widget/<slug>/`. */
  base: string
  /** A folder with no files, so Vite reads no `.env` file of the page. */
  emptyDir: string
  cacheDir: string
  /** The bare imports that a page file may use, exactly. */
  allowed: string[]
  /** The bare import prefixes that a page file may use, such as `@deepwidgets/shell/ui/`. */
  allowedPrefixes: string[]
}

/** The `RESULT` line. */
export interface PageBuildReport {
  ok: boolean
  diagnostics: string[]
}

const MAX_DIAGNOSTICS = 20

const out = (report: PageBuildReport): void => { process.stdout.write(`RESULT ${JSON.stringify(report)}\n`) }

/** True for a bare import: not a relative path, not an absolute path. A URL or a `node:` name is bare too. */
const isBare = (source: string): boolean => !source.startsWith('.') && !source.startsWith('/') && !isAbsolute(source)

/**
 * The import fence of `agent_library.build_gate.gates`. It checks only the imports of the files of the page.
 * A page file may import an allowed package, or a file in the page folder. A package that the page imports
 * imports its own files and packages, and the fence does not check those.
 */
export function importFence(job: Pick<PageBuildJob, 'root' | 'allowed' | 'allowedPrefixes'>): Plugin {
  const root = job.root.endsWith(sep) ? job.root : job.root + sep
  const modules = join(root, 'node_modules') + sep
  const inPage = (file: string): boolean => file.startsWith(root) && !file.startsWith(modules)
  const allowed = new Set(job.allowed)
  const list = [...job.allowed.filter((name) => !name.startsWith('vite/')), ...job.allowedPrefixes.map((prefix) => `${prefix}*`)].join(', ')
  const allow = (source: string): boolean => {
    if (allowed.has(source)) return true
    // A subpath with `..` or an empty segment could reach a file outside the exported folder.
    const segments = source.split('/')
    if (segments.some((segment) => segment === '..' || segment === '.' || segment === '')) return false
    return job.allowedPrefixes.some((prefix) => source.startsWith(prefix) && source.length > prefix.length)
  }
  const name = (file: string): string => `page/${relative(root, file)}`
  return {
    name: 'deepwidgets-import-fence',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (importer === undefined || source.startsWith('\0')) return null
      const from = importer.split('?')[0] ?? importer
      if (!inPage(from)) return null
      if (isBare(source)) {
        if (allow(source)) return null
        this.error(`${name(from)}: the import "${source}" is not on the list of allowed imports. A page may import only: ${list}, and files in page/.`)
      }
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (resolved === null) return null
      const file = resolved.id.split('?')[0] ?? resolved.id
      if (resolved.external !== false || !inPage(file)) {
        this.error(`${name(from)}: the import "${source}" is outside the page folder. A page may import only: ${list}, and files in page/.`)
      }
      return resolved
    },
  }
}

/** The config files that the resolver and the TypeScript transform read on their own: allowed as plain reads. */
const CONFIG_READ = /^(?:package|tsconfig[^/]*|jsconfig[^/]*)\.json$/
/** A config file that PostCSS or Tailwind would load. The build has its own config, so a page may not have one. */
const CONFIG_FILE = /^(?:\.postcssrc|postcss\.config|tailwind\.config)(?:\.[^/]*)?$/i
/** The stylesheet kinds that Vite or Tailwind reads. */
const STYLE_FILE = /\.(?:css|pcss|postcss|scss|sass|less|styl|stylus)$/i

/** Each file in the page folder, at any depth. */
async function pageFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await pageFiles(path))
    else files.push(path)
  }
  return files
}

/**
 * The stylesheet rules of `agent_library.build_gate.gates` that give a clearer error than the output fence: a page has
 * no PostCSS or Tailwind config file, and its stylesheets have no `@plugin` and no `@config`. The output fence guards
 * the files that a stylesheet reads. The check reads the text without comments, and it runs before Vite.
 */
export async function stylesheetProblems(job: Pick<PageBuildJob, 'root'>): Promise<string[]> {
  const root = resolve(job.root)
  const name = (file: string): string => `page/${relative(root, file)}`
  const problems: string[] = []
  for (const file of await pageFiles(root)) {
    if (CONFIG_FILE.test(basename(file))) {
      problems.push(`${name(file)}: a page may not have a PostCSS or Tailwind config file. The build uses its own config.`)
      continue
    }
    if (!STYLE_FILE.test(file)) continue
    const text = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '')
    for (const match of text.matchAll(/@(plugin|config)\b/gi)) {
      problems.push(`${name(file)}: @${match[1] ?? ''} is not allowed in a page stylesheet. The build loads no plugin or config of the page.`)
    }
  }
  return problems
}

/** The real folder of a package that `from` resolves by `name`, or undefined. */
function packageFolder(from: string, name: string): string | undefined {
  const paths = createRequire(join(from, 'package.json')).resolve.paths(name) ?? []
  const found = paths.map((base) => join(base, name)).find((path) => existsSync(join(path, 'package.json')))
  return found === undefined ? undefined : realpathSync(found)
}

/**
 * The folders that a built page may read: the allowed packages, which the staging `node_modules` links, and the
 * packages that they depend on, at any depth. A workspace package (not in a `node_modules` folder) adds its
 * development dependencies too, because its stylesheets import Tailwind and the DSH token sheets.
 */
export function allowedFolders(modules: string): string[] {
  const roots: string[] = []
  for (const entry of readdirSync(modules)) {
    if (entry.startsWith('@')) for (const scoped of readdirSync(join(modules, entry))) roots.push(realpathSync(join(modules, entry, scoped)))
    else roots.push(realpathSync(join(modules, entry)))
  }
  const seen = new Set<string>()
  const walk = (folder: string): void => {
    if (seen.has(folder)) return
    seen.add(folder)
    let manifest: Record<string, unknown>
    try {
      manifest = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8')) as Record<string, unknown>
    } catch {
      return
    }
    const fields = ['dependencies', 'peerDependencies', 'optionalDependencies', ...folder.split(sep).includes('node_modules') ? [] : ['devDependencies']]
    for (const field of fields) {
      const deps = manifest[field]
      if (typeof deps !== 'object' || deps === null) continue
      for (const name of Object.keys(deps)) {
        const found = packageFolder(folder, name)
        if (found !== undefined) walk(found)
      }
    }
  }
  for (const root of roots) walk(root)
  return [...seen]
}

/**
 * Record each file that this process reads while the build runs. A plugin can read a file with no module and no
 * emitted asset: Vite inlines a small asset of `new URL(..., import.meta.url)` or of `image-set()` as a data URL.
 * The recorder wraps the file reads of `node:fs` and `node:fs/promises`, and `syncBuiltinESMExports` makes the
 * wrapped functions the named exports too. A read by a native module (the Tailwind scanner) is not seen here; Tailwind
 * reports those files as watch files.
 */
export function recordReads(): Set<string> {
  const reads = new Set<string>()
  const keep = (path: unknown): void => {
    if (typeof path === 'string') reads.add(resolve(path))
    else if (path instanceof URL && path.protocol === 'file:') reads.add(fileURLToPath(path))
    else if (Buffer.isBuffer(path)) reads.add(resolve(path.toString()))
  }
  const fs = require('node:fs') as typeof import('node:fs')
  const wrap = (target: object, name: string): void => {
    const slots = target as Record<string, unknown>
    const original = slots[name] as (...args: unknown[]) => unknown
    slots[name] = (...args: unknown[]) => {
      keep(args[0])
      return original.apply(target, args)
    }
  }
  for (const name of ['readFile', 'readFileSync', 'createReadStream', 'open', 'openSync']) wrap(fs, name)
  for (const name of ['readFile', 'open']) wrap(fs.promises, name)
  syncBuiltinESMExports()
  return reads
}

/**
 * The output fence of `agent_library.build_gate.gates`, the guard of the build. At the end of the build it collects
 * each file that went into the page: each module, each file that a plugin read (the stylesheet imports and the
 * inlined assets of Vite and Tailwind), and the source of each emitted asset. The build fails when the real path of a
 * file is outside `page/` and outside the folders of `allowedFolders`. A virtual module of Vite has no path.
 */
export function outputFence(job: Pick<PageBuildJob, 'root'>, allowed: () => string[], reads: Set<string>): Plugin {
  const root = realpathSync(job.root)
  // The staging folder holds the configs of the gates, such as the tsconfig that Vite reads for the page files.
  const staging = dirname(root)
  const inside = (path: string, folder: string): boolean => path === folder || path.startsWith(folder + sep)
  return {
    name: 'deepwidgets-output-fence',
    async generateBundle(_options, bundle) {
      const files = new Set<string>()
      const add = (raw: string): void => {
        const id = (raw.startsWith('\0') ? raw.slice(1) : raw).split('?')[0] ?? raw
        if (isAbsolute(id)) files.add(id)
      }
      for (const id of this.getModuleIds()) add(id)
      for (const id of this.getWatchFiles()) add(id)
      for (const item of Object.values(bundle)) {
        if (item.type === 'asset') for (const name of item.originalFileNames) add(isAbsolute(name) ? name : resolve(root, name))
      }
      const used = new Set(files)
      for (const file of reads) add(file)
      const folders = allowed()
      const outside: string[] = []
      for (const file of files) {
        // A missing file put nothing into the page.
        const real = await realpath(file).catch(() => undefined)
        if (real === undefined || inside(real, staging) || folders.some((folder) => inside(real, folder))) continue
        // A resolver reads each package.json on the way up from a file, and the TypeScript transform reads the tsconfig
        // files of the shell pieces, so a plain read of one is allowed. A module or an asset that is such a file outside
        // the page is refused. A limit: a page can inline such a file of a folder above it with `new URL`.
        if (CONFIG_READ.test(basename(real)) && !used.has(file)) continue
        outside.push(real)
      }
      if (outside.length > 0) {
        this.error(`the page reads ${String(outside.length)} file(s) outside the page folder: ${outside.slice(0, 5).join(', ')}. A page may use only files in page/ and the allowed packages.`)
      }
    },
  }
}

/** The place and the text of a Rollup or Vite error. */
function errorLines(error: unknown, root: string): string[] {
  const value = error as { message?: unknown, id?: unknown, loc?: { file?: string, line?: number, column?: number } | undefined, errors?: unknown[] }
  const message = typeof value.message === 'string' ? value.message : String(error)
  // The message of a plugin error names the plugin; the text after the name is enough.
  const text = message.replace(/\[plugin [^\]]+\]\s*/, '').replaceAll(root, 'page/')
  const file = value.loc?.file ?? (typeof value.id === 'string' ? value.id : undefined)
  const place = file === undefined ? '' : `${file.replaceAll(root, 'page/')}${value.loc?.line === undefined ? '' : `:${String(value.loc.line)}:${String((value.loc.column ?? 0) + 1)}`}: `
  return [`${place}${text.split('\n')[0] ?? text}`]
}

async function main(): Promise<void> {
  const file = process.argv[2]
  if (file === undefined) throw new Error('usage: page-build-child.js <job.json>')
  const job = JSON.parse(await readFile(file, 'utf8')) as PageBuildJob
  const root = job.root.endsWith(sep) ? job.root : job.root + sep
  const problems = await stylesheetProblems(job)
  if (problems.length > 0) {
    out({ ok: false, diagnostics: problems.slice(0, MAX_DIAGNOSTICS) })
    return
  }
  const reads = recordReads()
  try {
    await build({
      configFile: false,
      root: job.root,
      base: job.base,
      mode: 'production',
      logLevel: 'silent',
      envDir: job.emptyDir,
      publicDir: false,
      cacheDir: job.cacheDir,
      plugins: [importFence(job), react(), tailwindcss(), outputFence(job, () => allowedFolders(job.modules), reads)],
      resolve: { dedupe: ['react', 'react-dom'] },
      // An inline config: Vite does not look for a PostCSS config file of the page.
      css: { postcss: {} },
      build: { outDir: job.outDir, emptyOutDir: true, target: 'chrome140', reportCompressedSize: false },
    })
    out({ ok: true, diagnostics: [] })
  } catch (error) {
    out({ ok: false, diagnostics: errorLines(error, root).slice(0, MAX_DIAGNOSTICS) })
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`page-build-child: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exit(2)
})
