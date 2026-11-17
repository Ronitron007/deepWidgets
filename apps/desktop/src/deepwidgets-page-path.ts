/**
 * deepWidgets page files (`agent_library.build_gate` in `docs/specs/agent-library.md`). A built page of a widget is a
 * folder in the folder of its slug: `<slug>/page-<hash>`, `<slug>/page-<hash>.tmp` while the install gates run, and
 * the link `<slug>/page` to the current build. The render check serves a `.tmp` folder; the widget origin of the slug
 * serves the link (`agent_library.serving`).
 * This module finds the file of a request. It resolves each link and refuses a path outside the folder of the slug.
 * @module deepwidgets-page-path
 */
import { readFile, realpath } from 'node:fs/promises'
import { basename, dirname, extname, relative, resolve, sep } from 'node:path'

/** The folder name of a build while the gates run. */
const BUILD_TMP = /^page-[0-9a-f]{16}\.tmp$/u

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png',
}

/** The file to serve, or the status of a refused request. */
export type PageFile = { readonly file: string } | { readonly status: 403 | 404 }

/**
 * Find the file of one request path in a built page.
 * @param pageDir - the page folder in the folder of its slug: a build, or the link `page`.
 * @param path - the decoded request path below the page folder. An empty path is `index.html`.
 * @param allowTmp - true only for the render check: a build that the gates still run on may be served.
 * @returns the real path of the file, 403 for a path that resolves outside the folder of the slug or into a `.tmp`
 *   build without `allowTmp`, and 404 for a missing file.
 */
export async function pageFile(pageDir: string, path: string, allowTmp: boolean): Promise<PageFile> {
  const root = resolve(pageDir)
  const target = resolve(root, path === '' ? 'index.html' : path)
  if (!target.startsWith(root + sep)) return { status: 403 }
  let real: string
  let slugDir: string
  try {
    real = await realpath(target)
    slugDir = await realpath(dirname(root))
  } catch {
    return { status: 404 }
  }
  if (!real.startsWith(slugDir + sep)) return { status: 403 }
  const build = relative(slugDir, real).split(sep)[0] ?? ''
  if (!allowTmp && BUILD_TMP.test(build)) return { status: 403 }
  return { file: real }
}

/**
 * True when `pageDir` is a build of `slug` that the gates still run on: `<...>/<slug>/page-<hash>.tmp`.
 * @param pageDir - the absolute folder from the Host.
 * @param slug - the slug of the check.
 */
export function isCheckBuild(pageDir: string, slug: string): boolean {
  return BUILD_TMP.test(basename(pageDir)) && basename(dirname(pageDir)) === slug
}

/**
 * Answer one request for a file of a built page: {@link pageFile}, then the file with its type and `no-store`.
 * @param request - the request, GET or HEAD.
 * @param pageDir - the page folder in the folder of its slug.
 * @param path - the decoded request path below the page folder.
 * @param allowTmp - true only for the render check.
 */
export async function servePageFile(request: Request, pageDir: string, path: string, allowTmp: boolean): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 })
  const found = await pageFile(pageDir, path, allowTmp)
  if ('status' in found) return new Response(null, { status: found.status })
  let body: Buffer
  try { body = await readFile(found.file) } catch { return new Response(null, { status: 404 }) }
  return new Response(request.method === 'HEAD' ? null : new Uint8Array(body), {
    headers: { 'content-type': MIME[extname(found.file)] ?? 'application/octet-stream', 'cache-control': 'no-store' },
  })
}
