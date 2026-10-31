/**
 * The pinned widget shell (`widget_mvp.shell`): one page for each widget window.
 * URL: dsh-app://app/widget/?slug=<slug>. Electron main serves this page from disk and
 * forwards each /api/widgets request to the host with the host cookie.
 * Flow: GET program, check the catalog, render with the toolProvider (POST /call),
 * read the stream, run the queries again on `data`, load the program again on `program`.
 * Ported from the overnight shell spike (src/shell/main.jsx). The size report is left out.
 * @module @deepwidgets/shell
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { createRoot } from 'react-dom/client'
import { ACTION_STEPS, Renderer, useRendererQuery, useTriggerAction, type McpClientLike, type OpenUIError } from '@openuidev/react-lang'
import { CATALOG_ID, widgetLibrary } from './library.tsx'
import './styles.css'

/** The catalogs that this shell compiles in. A program that names another id is refused. */
const CATALOGS: Record<string, typeof widgetLibrary> = { [CATALOG_ID]: widgetLibrary }

/** The first reopen delay of the stream. Each failed attempt doubles it up to the cap. */
const STREAM_BACKOFF_MS = 250
const STREAM_BACKOFF_CAP_MS = 8000

/** Diagnostics for the smoke check and for DevTools. The page never reads them. */
interface ShellDiagnostics {
  catalogs: string[]
  state: 'boot' | 'loading' | 'ready' | 'empty' | 'error' | 'removed'
  stream: 'connecting' | 'open' | 'closed'
  streamOpens: number
  refreshes: number
  programLoads: number
  events: string[]
  errors: string[]
}

declare global {
  interface Window { __dw?: ShellDiagnostics }
}

const dw: ShellDiagnostics = {
  catalogs: Object.keys(CATALOGS), state: 'boot', stream: 'connecting', streamOpens: 0,
  refreshes: 0, programLoads: 0, events: [], errors: [],
}
window.__dw = dw
const record = (event: string): void => { dw.events.push(event); if (dw.events.length > 200) dw.events.shift() }

const slug = new URLSearchParams(location.search).get('slug')
const api = (path: string): string => `/api/widgets/${encodeURIComponent(slug ?? '')}${path}`

/** The program answer of `GET /api/widgets/<slug>/program`. `catalog` is optional; the default is this shell's set. */
interface ProgramAnswer { rev: number, text: string, catalog?: string }

/** A failed HTTP answer. `status` is absent for a network error. */
class FetchError extends Error {
  constructor(message: string, readonly status?: number) { super(message) }
}

function errorMessage(body: unknown, status: number): string {
  const error = (body as { error?: { message?: unknown } } | null)?.error
  return typeof error?.message === 'string' ? error.message : `HTTP ${String(status)}`
}

/** GET JSON with a bounded retry. A 4xx answer is final; a network error or a 5xx answer is retried. */
async function getJson(url: string, tries = 4, timeoutMs = 5000): Promise<unknown> {
  let last: unknown
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new FetchError(errorMessage(body, response.status), response.status)
      return body
    } catch (error) {
      last = error
      if (error instanceof FetchError && error.status !== undefined && error.status < 500) break
      await new Promise((resolve) => setTimeout(resolve, STREAM_BACKOFF_MS * 2 ** attempt))
    }
  }
  throw last
}

/**
 * The toolProvider in the MCP client shape: each Query and Mutation is one POST /call.
 * No retry here: a mutation must not run twice. The next `data` frame or Retry runs a query again.
 */
const toolProvider: McpClientLike = {
  async callTool({ name, arguments: args }) {
    let response: Response
    try {
      response = await fetch(api('/call'), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: name, args: args ?? {} }),
      })
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: `the host did not answer: ${error instanceof Error ? error.message : String(error)}` }] }
    }
    const body = await response.json().catch(() => null) as { ok?: boolean, result?: unknown } | null
    if (!response.ok || body?.ok !== true) return { isError: true, content: [{ type: 'text', text: errorMessage(body, response.status) }] }
    return { content: [], structuredContent: body.result }
  },
}

/** Lives inside Renderer.Root to reach the OpenUI context. `refreshRef` runs each query again. */
function RefreshBridge({ queryIdsRef, refreshRef }: {
  queryIdsRef: MutableRefObject<string[]>
  refreshRef: MutableRefObject<() => void>
}) {
  const trigger = useTriggerAction()
  const query = useRendererQuery()
  useEffect(() => {
    refreshRef.current = () => {
      const ids = queryIdsRef.current
      if (ids.length === 0) return
      dw.refreshes++
      void trigger('', undefined, { steps: ids.map((statementId) => ({ type: ACTION_STEPS.Run, refType: 'query' as const, statementId })) })
    }
  }, [trigger, queryIdsRef, refreshRef])
  useEffect(() => { if (!query.isLoading) dw.state = 'ready' }, [query.isLoading])
  if (query.errors.length === 0) return null
  return (
    <div className="dw-state dw-state--error" role="alert" data-dw="query-error">
      <strong>Could not load data</strong>
      <span>{query.errors.map((error) => error.message).join(', ')}</span>
      <button className="text-xs underline" onClick={() => { query.retry() }} disabled={query.isRetrying}>
        {query.isRetrying ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  )
}

function StateView({ kind, title, detail, onRetry }: { kind: 'error' | 'empty' | 'removed', title: string, detail?: string, onRetry?: () => void }) {
  return (
    <div className={`dw-state dw-state--${kind}`} role={kind === 'error' ? 'alert' : undefined} data-dw={`state-${kind}`}>
      <strong>{title}</strong>
      {detail === undefined ? null : <span>{detail}</span>}
      {onRetry === undefined ? null : <button className="text-xs underline" onClick={onRetry}>Retry</button>}
    </div>
  )
}

type Load =
  | { status: 'loading' }
  | { status: 'error', title: string, detail: string, retry: boolean }
  | { status: 'empty' }
  | { status: 'removed' }
  | { status: 'ready', text: string, library: typeof widgetLibrary }

function Shell() {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [programErrors, setProgramErrors] = useState<OpenUIError[]>([])
  const queryIdsRef = useRef<string[]>([])
  const refreshRef = useRef<() => void>(() => {})

  const loadProgram = useCallback(async () => {
    if (slug === null) {
      dw.state = 'error'
      setLoad({ status: 'error', title: 'No widget slug', detail: 'The URL has no ?slug=.', retry: false })
      return
    }
    setLoad((current) => (current.status === 'ready' ? current : { status: 'loading' }))
    try {
      const answer = await getJson(api('/program')) as ProgramAnswer
      dw.programLoads++
      const catalog = answer.catalog ?? CATALOG_ID
      const library = CATALOGS[catalog]
      if (library === undefined) {
        dw.state = 'error'
        setLoad({ status: 'error', title: 'Unsupported component set', detail: `The widget needs "${catalog}". This shell has ${Object.keys(CATALOGS).join(', ')}.`, retry: false })
        return
      }
      if (answer.text.trim() === '') {
        dw.state = 'empty'
        setLoad({ status: 'empty' })
        return
      }
      setLoad({ status: 'ready', text: answer.text, library })
    } catch (error) {
      dw.state = 'error'
      dw.errors.push(`program: ${error instanceof Error ? error.message : String(error)}`)
      setLoad({ status: 'error', title: 'Could not load the widget', detail: error instanceof Error ? error.message : String(error), retry: true })
    }
  }, [])

  useEffect(() => { void loadProgram() }, [loadProgram])

  // The stream: `data` runs the queries again, `program` loads the program again.
  // EventSource retries a network error by itself. When the stream closes (an HTTP error answer),
  // the page opens a new one with backoff. On each `hello`, it catches up with the revisions it missed.
  useEffect(() => {
    if (slug === null) return
    let source: EventSource | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    let stopped = false
    let seen: { rev: number, programRev: number } | undefined
    const open = (): void => {
      dw.stream = 'connecting'
      const next = new EventSource(api('/stream'))
      source = next
      next.onopen = () => { attempt = 0; dw.stream = 'open'; dw.streamOpens++; record('open') }
      next.onmessage = (event: MessageEvent<string>) => {
        let message: { type?: unknown, rev?: unknown, programRev?: unknown }
        try { message = JSON.parse(event.data) as typeof message } catch { return }
        record(String(message.type))
        if (message.type === 'hello' && typeof message.rev === 'number' && typeof message.programRev === 'number') {
          const previous = seen
          seen = { rev: message.rev, programRev: message.programRev }
          if (previous === undefined) return
          if (previous.programRev !== message.programRev) void loadProgram()
          else if (previous.rev !== message.rev) refreshRef.current()
        } else if (message.type === 'data') {
          if (seen !== undefined && typeof message.rev === 'number') seen.rev = message.rev
          refreshRef.current()
        } else if (message.type === 'program') {
          if (seen !== undefined && typeof message.rev === 'number') seen.programRev = message.rev
          void loadProgram()
        } else if (message.type === 'removed') {
          dw.state = 'removed'
          setLoad({ status: 'removed' })
        }
      }
      next.onerror = () => {
        if (next.readyState !== EventSource.CLOSED) { dw.stream = 'connecting'; record('retry'); return }
        dw.stream = 'closed'
        record('closed')
        next.close()
        if (stopped) return
        const delay = Math.min(STREAM_BACKOFF_MS * 2 ** attempt, STREAM_BACKOFF_CAP_MS)
        attempt++
        timer = setTimeout(open, delay)
      }
    }
    open()
    return () => { stopped = true; clearTimeout(timer); source?.close() }
  }, [loadProgram])

  let body
  if (load.status === 'loading') body = <div className="dw-state" aria-busy="true"><div className="dw-skeleton" /><div className="dw-skeleton" /></div>
  else if (load.status === 'error') body = <StateView kind="error" title={load.title} detail={load.detail} {...(load.retry ? { onRetry: () => { void loadProgram() } } : {})} />
  else if (load.status === 'empty') body = <StateView kind="empty" title="This widget is empty" detail="Ask an agent to build it." />
  else if (load.status === 'removed') body = <StateView kind="removed" title="This widget was removed" />
  else body = (
    <Renderer.Root
      response={load.text}
      library={load.library}
      toolProvider={toolProvider}
      queryLoader={null}
      onParseResult={(result) => { queryIdsRef.current = (result?.queryStatements ?? []).map((statement) => statement.statementId) }}
      onError={(errors) => {
        dw.errors = errors.map((error) => `${error.source}: ${error.code}`)
        setProgramErrors(errors.filter((error) => error.severity !== 'warning' && error.source !== 'query' && error.source !== 'mutation'))
      }}
      onAction={(event) => { record(`action:${event.type}`) }}
    >
      <Renderer.Content />
      <RefreshBridge queryIdsRef={queryIdsRef} refreshRef={refreshRef} />
      {programErrors.length === 0 ? null : <StateView kind="error" title="The program has errors" detail={programErrors.map((error) => error.message).join(', ')} />}
    </Renderer.Root>
  )
  return <div className="dw-surface">{body}</div>
}

const root = document.getElementById('root')
if (root === null) throw new Error('widget shell: the page has no #root')
createRoot(root).render(<Shell />)
