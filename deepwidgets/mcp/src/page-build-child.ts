/**
 * The child of the build gate of a widget page (`agent_library.build_gate.gates`). It builds the staging copy of
 * `page/` with one Vite config: React, Tailwind, the target of the shell, and the `base` of the slug. The plugin
 * `importFence` refuses each import of a page file that is not on the allowed list. Before the build,
 * `stylesheetProblems` keeps the stylesheets of the page inside `page/`, and the inline PostCSS config means that
 * Vite loads no PostCSS config file of the page. The build runs in its own process, so a long synchronous step of
 * Rollup or Tailwind does not hold the host.
 *
 * Protocol on stdout: one line `RESULT <json>` ({@link PageBuildReport}) at the end.
 *
 * Usage: `<node> page-build-child.js <job.json>` with a {@link PageBuildJob}.
 * @module @deepwidgets/mcp/page-build-child
 */
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { build, type Plugin } from 'vite'

/** The job file of the child. */
export interface PageBuildJob {
  /** The staging copy of `page/`. Its `node_modules` holds only the allowed packages. */
  root: string
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
  /** The bare `@import` names that a page stylesheet may use, such as `@deepwidgets/shell/page.css`. */
  allowedStyles: string[]
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

/** A config file that PostCSS or Tailwind would load. The build has its own config, so a page may not have one. */
const CONFIG_FILE = /^(?:\.postcssrc|postcss\.config|tailwind\.config)(?:\.[^/]*)?$/i
/** The stylesheet kinds that Vite or Tailwind reads. */
const STYLE_FILE = /\.(?:css|pcss|postcss|scss|sass|less|styl|stylus)$/i
/** A URL with a scheme, such as `https:` or `file:`. */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i

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
 * The stylesheet fence of `agent_library.build_gate.gates`: CSS stays inside `page/`. It refuses a PostCSS or
 * Tailwind config file, `@plugin` and `@config`, and each `@import`, `@reference`, `url()`, `@source`, and `source()`
 * whose path resolves outside the page folder. A bare `@import` must be on `allowedStyles`. A `url()` may be a
 * `data:` URL or a `#` fragment. The check reads the text without comments, and it runs before Vite.
 */
export async function stylesheetProblems(job: Pick<PageBuildJob, 'root' | 'allowedStyles'>): Promise<string[]> {
  const root = resolve(job.root)
  const inside = (path: string): boolean => path === root || path.startsWith(root + sep)
  const name = (file: string): string => `page/${relative(root, file)}`
  const problems: string[] = []
  for (const file of await pageFiles(root)) {
    if (CONFIG_FILE.test(basename(file))) {
      problems.push(`${name(file)}: a page may not have a PostCSS or Tailwind config file. The build uses its own config.`)
      continue
    }
    if (!STYLE_FILE.test(file)) continue
    const text = (await readFile(file, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '')
    const at = (path: string): boolean => inside(resolve(dirname(file), path))
    for (const match of text.matchAll(/@(plugin|config)\b/gi)) {
      problems.push(`${name(file)}: @${match[1] ?? ''} is not allowed in a page stylesheet. The build loads no plugin or config of the page.`)
    }
    for (const match of text.matchAll(/@(import|reference)\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\2/gi)) {
      const path = match[3] ?? ''
      if (job.allowedStyles.includes(path)) continue
      if (!(path.startsWith('./') || path.startsWith('../')) || !at(path)) {
        problems.push(`${name(file)}: the @${match[1] ?? ''} "${path}" is outside the page folder. A page stylesheet may import ${job.allowedStyles.join(', ')}, and files in page/.`)
      }
    }
    for (const match of text.matchAll(/url\(\s*(["']?)([^"')]*?)\1\s*\)/gi)) {
      const path = (match[2] ?? '').trim()
      if (path === '' || path.startsWith('#') || path.toLowerCase().startsWith('data:')) continue
      if (SCHEME.test(path) || path.startsWith('/') || !at(path.split(/[?#]/)[0] ?? path)) {
        problems.push(`${name(file)}: the url(${path}) is outside the page folder. Put the file in page/ and use a relative path.`)
      }
    }
    // `@source "<glob>"`, `@source not "<glob>"`, and `source("<path>")` of `@import` and `@tailwind`. `@source inline()` names no file.
    const sources = [...text.matchAll(/@source\s+(?:not\s+)?(["'])(.*?)\1/gi), ...text.matchAll(/source\(\s*(["'])(.*?)\1\s*\)/gi)]
    for (const match of sources) {
      const path = match[2] ?? ''
      // The part before the first glob character is a folder.
      const base = path.split(/[*?{[]/)[0] ?? ''
      if (SCHEME.test(path) || isAbsolute(base) || !at(base === '' ? '.' : base)) {
        problems.push(`${name(file)}: the source "${path}" is outside the page folder. Tailwind may read only files in page/.`)
      }
    }
  }
  return problems
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
      plugins: [importFence(job), react(), tailwindcss()],
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
