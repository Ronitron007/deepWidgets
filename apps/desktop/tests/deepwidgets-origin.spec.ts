import { describe, expect, it } from 'vitest'
import { parseWidgetPages, slugOfHost, WIDGET_CSP, widgetHost, widgetRoute, widgetUrl, withWidgetCsp } from '../src/deepwidgets-origin.ts'

const LONG = 'a'.repeat(63)

describe('widget origins (agent_library.serving.origins)', () => {
  it('maps each slug to w-<slug>.widget and back', () => {
    for (const slug of ['sample', 'xn--abc', 'a-', LONG, 'check', 'assets', '9lives', 'a']) {
      expect(widgetHost(slug)).toBe(`w-${slug}.widget`)
      expect(slugOfHost(widgetHost(slug))).toBe(slug)
    }
  })

  it('gives no slug for a host name of another job or of another form', () => {
    for (const host of ['app', 'shell', 'widget-check', 'sample.widget', 'w-.widget', 'w--a.widget', 'w-A.widget',
      'w-a.widget.evil', 'x.w-a.widget', 'w-a_b.widget', `w-${LONG}a.widget`, 'w-a.widgets', '']) {
      expect(slugOfHost(host)).toBeUndefined()
    }
  })

  it('keeps the host names of other jobs and of two slugs apart', () => {
    const hosts = ['check', 'app', 'shell', 'widget', 'a', 'a-', 'xn--abc'].map(widgetHost)
    expect(new Set(hosts).size).toBe(hosts.length)
    for (const host of hosts) expect(['app', 'shell', 'widget-check']).not.toContain(host)
  })

  it('parses each URL of a slug with the WHATWG parser, the host name unchanged', () => {
    for (const slug of ['xn--abc', 'a-', LONG]) {
      for (const mode of ['page', 'shell', 'failed'] as const) {
        const url = new URL(widgetUrl(slug, mode).replace('dsh-app:', 'http:'))
        expect(url.hostname).toBe(`w-${slug}.widget`)
        expect(url.searchParams.get('slug')).toBe(slug)
      }
    }
    expect(widgetUrl('demo', 'page')).toBe('dsh-app://w-demo.widget/widget/demo/?slug=demo')
    expect(widgetUrl('demo', 'shell')).toBe('dsh-app://w-demo.widget/widget/?slug=demo')
    expect(widgetUrl('demo', 'failed')).toBe('dsh-app://w-demo.widget/widget/?slug=demo&page=failed')
  })
})

describe('widgetRoute (agent_library.serving.routes)', () => {
  it('serves the page of the slug only when it has a page link', () => {
    expect(widgetRoute('demo', '/widget/demo/', true)).toEqual({ kind: 'page', path: '', orShell: false })
    expect(widgetRoute('demo', '/widget/demo/assets/index-1.js', true)).toEqual({ kind: 'page', path: 'assets/index-1.js', orShell: false })
    expect(widgetRoute('demo', '/widget/demo/a%20b.js', true)).toEqual({ kind: 'page', path: 'a b.js', orShell: false })
    expect(widgetRoute('demo', '/widget/demo/%E0', true)).toEqual({ kind: 'status', status: 400 })
    expect(widgetRoute('demo', '/widget/demo/', false)).toEqual({ kind: 'shell', index: false })
    expect(widgetRoute('demo', '/widget/other/', true)).toEqual({ kind: 'shell', index: false })
  })

  it('serves the shared shell below /widget/', () => {
    expect(widgetRoute('demo', '/widget/', true)).toEqual({ kind: 'shell', index: true })
    expect(widgetRoute('demo', '/widget', false)).toEqual({ kind: 'shell', index: true })
    expect(widgetRoute('demo', '/widget/assets/index-1.js', true)).toEqual({ kind: 'shell', index: false })
  })

  it('lets the shell files below /widget/assets/ load on the origin of the slug assets', () => {
    expect(widgetRoute('assets', '/widget/assets/', true)).toEqual({ kind: 'page', path: '', orShell: false })
    expect(widgetRoute('assets', '/widget/assets/index-1.js', true)).toEqual({ kind: 'page', path: 'index-1.js', orShell: true })
    expect(widgetRoute('assets', '/widget/assets/index-1.js', false)).toEqual({ kind: 'shell', index: false })
  })

  it('forwards only the API of the slug; another slug gets 403, each other path 404', () => {
    expect(widgetRoute('demo', '/api/widgets/demo/program', true)).toEqual({ kind: 'api' })
    expect(widgetRoute('demo', '/api/widgets/demo/stream', false)).toEqual({ kind: 'api' })
    expect(widgetRoute('demo', '/api/widgets/sample/program', true)).toEqual({ kind: 'status', status: 403 })
    expect(widgetRoute('demo', '/api/widgets/demo-2/call', true)).toEqual({ kind: 'status', status: 403 })
    expect(widgetRoute('demo', '/api/widgets/demo%2F..%2Fsample/call', true)).toEqual({ kind: 'status', status: 400 })
    expect(widgetRoute('demo', '/api/widgets/demo/..%5Csample/call', true)).toEqual({ kind: 'status', status: 400 })
    expect(widgetRoute('demo', '/api/widgets/events', true)).toEqual({ kind: 'status', status: 404 })
    expect(widgetRoute('demo', '/api/widgets/demo', true)).toEqual({ kind: 'status', status: 404 })
    // window_manager.route: the window route of the operator is not under /api/widgets/<slug>/, so a page can not reach it.
    for (const path of ['/', '/index.html', '/assets/index.js', '/api/trace', '/plugins/x.js', '/widgetx', '/api/widget-windows/demo']) {
      expect(widgetRoute('demo', path, true)).toEqual({ kind: 'status', status: 404 })
    }
  })
})

describe('parseWidgetPages (agent_library.serving.changes)', () => {
  it('takes an absolute root and a stamp for each valid slug', () => {
    const parsed = parseWidgetPages({ type: 'deepwidgets-pages', root: '/p/deepwidgets-widgets', pages: { demo: 'page-0123456789abcdef@1' } })
    expect(parsed?.root).toBe('/p/deepwidgets-widgets')
    expect([...parsed?.pages ?? []]).toEqual([['demo', 'page-0123456789abcdef@1']])
  })

  it('refuses a wrong shape', () => {
    for (const value of [null, 'x', { root: 'relative', pages: {} }, { root: '/p', pages: [] }, { root: '/p' },
      { root: '/p', pages: { '../x': 's' } }, { root: '/p', pages: { Demo: 's' } }, { root: '/p', pages: { demo: '' } },
      { root: '/p', pages: { demo: 1 } }, { root: '/p', pages: { demo: 'x'.repeat(257) } }]) {
      expect(parseWidgetPages(value)).toBeUndefined()
    }
  })
})

describe('withWidgetCsp (agent_library.serving)', () => {
  it('sets the CSP header with frame-ancestors none and keeps the status, the body, and the other headers', async () => {
    const answer = await withWidgetCsp(new Response('x', { status: 404, headers: { 'content-type': 'text/html' } }))
    expect(answer.status).toBe(404)
    expect(await answer.text()).toBe('x')
    expect(answer.headers.get('content-type')).toBe('text/html')
    expect(answer.headers.get('content-security-policy')).toBe(WIDGET_CSP)
    expect(WIDGET_CSP).toContain("frame-ancestors 'none'")
  })

  it('keeps a network error', async () => {
    expect((await withWidgetCsp(Response.error())).type).toBe('error')
  })
})
