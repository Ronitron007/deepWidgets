/**
 * deepWidgets widget origins (`agent_library.serving` in `docs/specs/agent-library.md`). Each widget window loads its
 * page from the origin of its slug, `dsh-app://w-<slug>.widget`. The browser keeps the pages of two origins apart.
 * This module maps a slug to its host name and back, gives the window URL of a slug, and decides the route of one
 * request path on a widget origin. It also parses the page state that the Host sends over its IPC channel.
 * @module deepwidgets-origin
 */
import { isAbsolute } from 'node:path'

/** The slug pattern of the Host runtime (`deepwidgets/widgets/src/index.ts`). */
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/u
/**
 * The host name of a widget origin. The prefix `w-` keeps each label away from the Punycode prefix `xn--`, and the
 * suffix `.widget` keeps each name away from the host names `app`, `shell`, and `widget-check`.
 */
const WIDGET_HOST = /^w-([a-z0-9][a-z0-9-]{0,62})\.widget$/u
/** The longest stamp of one page link. A stamp is the link target and its time, for example `page-<hash>@<ms>`. */
const STAMP_MAX = 256

/** The scheme of the app documents. */
const SCHEME = 'dsh-app'

/**
 * True for a slug of the Host pattern.
 * @param value - a value from a frame or a message.
 */
export function isWidgetSlug(value: unknown): value is string {
  return typeof value === 'string' && SLUG.test(value)
}

/**
 * The host name of the widget origin of one slug.
 * @param slug - a valid slug.
 */
export function widgetHost(slug: string): string {
  return `w-${slug}.widget`
}

/**
 * The slug of a widget origin host name.
 * @param host - the host name of a request URL.
 * @returns the slug, or undefined when the host name is not exactly `w-<slug>.widget` with a valid slug.
 */
export function slugOfHost(host: string): string | undefined {
  return WIDGET_HOST.exec(host)?.[1]
}

/** Which page a widget window shows. */
export type WidgetPageMode = 'page' | 'shell' | 'failed'

/**
 * The window URL of one slug.
 * @param slug - a valid slug.
 * @param mode - `page` for the built page of the slug, `shell` for the shared shell, and `failed` for the shared
 *   shell with the notice that the page of the widget failed (`agent_library.serving.failures`).
 */
export function widgetUrl(slug: string, mode: WidgetPageMode): string {
  const origin = `${SCHEME}://${widgetHost(slug)}`
  const query = `?slug=${encodeURIComponent(slug)}`
  if (mode === 'page') return `${origin}/widget/${slug}/${query}`
  return `${origin}/widget/${query}${mode === 'failed' ? '&page=failed' : ''}`
}

/**
 * The answer of one path on the widget origin of a slug (`agent_library.serving.routes`).
 * - `page`: the file `path` below the page link of the slug. With `orShell`, a missing page file falls back to the
 *   shell file of the same request path.
 * - `shell`: the shared shell. `index` is true for the shell document.
 * - `api`: forward to the Host.
 * - `status`: refuse.
 */
export type WidgetRoute =
  | { readonly kind: 'page'; readonly path: string; readonly orShell: boolean }
  | { readonly kind: 'shell'; readonly index: boolean }
  | { readonly kind: 'api' }
  | { readonly kind: 'status'; readonly status: 400 | 403 | 404 }

/**
 * Decide the route of one request path on the widget origin of `slug`.
 * The slug `assets` shares `/widget/assets/` with the files of the shell: its page files come first, and a path that
 * the page does not have goes to the shell. Thus the shell with the notice still loads on the origin of `assets`.
 * @param slug - the slug of the origin.
 * @param pathname - the path of the request URL, as the URL parser gives it (still percent-encoded).
 * @param hasPage - true when the slug has a page link.
 */
export function widgetRoute(slug: string, pathname: string, hasPage: boolean): WidgetRoute {
  const api = '/api/widgets/'
  if (pathname.startsWith(api)) {
    // The URL parser removes dot segments. An encoded slash or backslash could make one at the Host, so it is refused.
    if (/%2f|%5c/iu.test(pathname)) return { kind: 'status', status: 400 }
    if (pathname.startsWith(`${api}${slug}/`)) return { kind: 'api' }
    const other = pathname.slice(api.length)
    // A page of one slug can not reach the program, the stream, or an action of another slug.
    return other.includes('/') ? { kind: 'status', status: 403 } : { kind: 'status', status: 404 }
  }
  if (pathname === '/widget' || pathname === '/widget/') return { kind: 'shell', index: true }
  const base = `/widget/${slug}/`
  if (hasPage && pathname.startsWith(base)) {
    let path: string
    try { path = decodeURIComponent(pathname.slice(base.length)) } catch { return { kind: 'status', status: 400 } }
    return { kind: 'page', path, orShell: slug === 'assets' && path !== '' }
  }
  if (pathname.startsWith('/widget/')) return { kind: 'shell', index: false }
  return { kind: 'status', status: 404 }
}

/** The page state of the Host: the widget root folder, and the stamp of the page link of each slug that has one. */
export interface WidgetPages {
  /** The absolute folder `<profile>/deepwidgets-widgets`. */
  readonly root: string
  /** The slugs with a page link. A stamp changes each time the Host writes the link. */
  readonly pages: ReadonlyMap<string, string>
}

/**
 * Parse the page state of a `deepwidgets-pages` message at the boundary.
 * @param value - the message.
 * @returns the state, or undefined when the shape is wrong.
 */
export function parseWidgetPages(value: unknown): WidgetPages | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { root, pages } = value as Record<string, unknown>
  if (typeof root !== 'string' || !isAbsolute(root) || typeof pages !== 'object' || pages === null || Array.isArray(pages)) return undefined
  const parsed = new Map<string, string>()
  for (const [slug, stamp] of Object.entries(pages)) {
    if (!isWidgetSlug(slug) || typeof stamp !== 'string' || stamp === '' || stamp.length > STAMP_MAX) return undefined
    parsed.set(slug, stamp)
  }
  return { root, pages: parsed }
}
