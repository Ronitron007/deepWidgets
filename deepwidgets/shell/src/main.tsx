/**
 * The pinned widget shell (`widget_mvp.shell`): one page for each widget window.
 * URL: dsh-app://app/widget/?slug=<slug>. Electron main serves this page from disk and
 * forwards each /api/widgets request to the host with the host cookie.
 * Flow: GET program, check the catalog, render with the toolProvider (POST /call),
 * read the stream, run the queries again on `data`, load the program again on `program`.
 * All requests and the stream go through `channel.ts`. Ported from the overnight shell spike
 * (src/shell/main.jsx). The size report is left out.
 * @module @deepwidgets/shell
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { createRoot } from 'react-dom/client'
import { ACTION_STEPS, Renderer, useRendererQuery, useTriggerAction, type OpenUIError } from '@openuidev/react-lang'
import { openChannel, type StreamState } from './channel.ts'
import { CATALOG_ID, widgetLibrary } from './library.tsx'
import './styles.css'

/** The catalogs that this shell compiles in. A program that names another id is refused. */
const CATALOGS: Record<string, typeof widgetLibrary> = { [CATALOG_ID]: widgetLibrary }

/** Diagnostics for the smoke check and for DevTools. The page never reads them. */
interface ShellDiagnostics {
  catalogs: string[]
  state: 'boot' | 'loading' | 'ready' | 'empty' | 'error' | 'removed'
  stream: StreamState
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
const channel = slug === null ? undefined : openChannel(slug)

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

  // The highest program rev applied. An answer with a lower rev arrived late; the page drops it.
  const programRevRef = useRef(-1)

  const loadProgram = useCallback(async () => {
    if (channel === undefined) {
      dw.state = 'error'
      setLoad({ status: 'error', title: 'No widget slug', detail: 'The URL has no ?slug=.', retry: false })
      return
    }
    setLoad((current) => (current.status === 'loading' || current.status === 'error' ? { status: 'loading' } : current))
    try {
      const answer = await channel.program()
      dw.programLoads++
      if (answer.rev < programRevRef.current) { record(`program-stale:${String(answer.rev)}`); return }
      programRevRef.current = answer.rev
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
      setLoad((current) => (current.status === 'removed' ? current : { status: 'ready', text: answer.text, library }))
    } catch (error) {
      dw.state = 'error'
      dw.errors.push(`program: ${error instanceof Error ? error.message : String(error)}`)
      setLoad((current) => (current.status === 'removed' ? current
        : { status: 'error', title: 'Could not load the widget', detail: error instanceof Error ? error.message : String(error), retry: true }))
    }
  }, [])

  useEffect(() => { void loadProgram() }, [loadProgram])

  // The stream: `data` runs the queries again, `program` loads the program again, `removed` ends the page.
  // On each `hello` after the first, the page catches up with the revisions it missed while the stream was down.
  useEffect(() => {
    if (channel === undefined) return
    let seen: { rev: number, programRev: number } | undefined
    return channel.subscribe({
      state(state, event) {
        dw.stream = state
        if (event === 'open') dw.streamOpens++
        record(event)
      },
      hello(rev, programRev) {
        record('hello')
        const previous = seen
        seen = { rev, programRev }
        if (previous === undefined) return
        if (previous.programRev !== programRev) void loadProgram()
        else if (previous.rev !== rev) refreshRef.current()
      },
      data(rev) {
        record('data')
        if (seen !== undefined && rev !== undefined) seen.rev = rev
        refreshRef.current()
      },
      program(rev) {
        record('program')
        if (seen !== undefined && rev !== undefined) seen.programRev = rev
        void loadProgram()
      },
      removed() {
        dw.state = 'removed'
        setLoad({ status: 'removed' })
      },
    })
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
      toolProvider={channel?.tools ?? null}
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
