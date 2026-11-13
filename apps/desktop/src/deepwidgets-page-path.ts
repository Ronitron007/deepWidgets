/**
 * deepWidgets page files (`agent_library.build_gate` in `docs/specs/agent-library.md`). A built page of a widget is a
 * folder in the folder of its slug: `<slug>/page-<hash>`, `<slug>/page-<hash>.tmp` while the install gates run, and
 * the link `<slug>/page` to the current build. The render check serves a `.tmp` folder; later serving serves the link.
 * This module finds the file of a request. It resolves each link and refuses a path outside the folder of the slug.
 * @module deepwidgets-page-path
 */
import { realpath } from 'node:fs/promises'
import { basename, dirname, relative, resolve, sep } from 'node:path'

/** The folder name of a build while the gates run. */
const BUILD_TMP = /^page-[0-9a-f]{16}\.tmp$/u

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
