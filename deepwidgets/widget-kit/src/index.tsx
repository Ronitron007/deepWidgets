/**
 * The core of the widget page (`agent_library.main_split`): the part that no agent changes.
 * URL: dsh-app://app/widget/?slug=<slug>. Electron main serves the page from disk and
 * forwards each /api/widgets request to the host with the host cookie.
 * Flow: GET program, check the catalog, give the child the props of `<Renderer.Root>` with the
 * toolProvider (POST /call), read the stream, run the queries again on `data`, load the program
 * again on `program`. All requests and the stream go through `channel.ts`.
 * The core imports no component library: the child brings its own (`agent_library.rules`).
 * @module @deepwidgets/widget-kit
 */
import { useCallback, useEffect, useRef, useState, type ComponentType, type MutableRefObject, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ACTION_STEPS, Renderer, useRendererQuery, useTriggerAction, type OpenUIError, type RendererProps } from '@openuidev/react-lang'
import { openChannel, type StreamState, type WidgetChannel } from './channel.ts'

/** The props of `<Renderer.Root>` that the core makes. The child adds `library` and puts `children` inside. */
export type RootProps = Required<Pick<RendererProps, 'response' | 'toolProvider' | 'queryLoader' | 'onParseResult' | 'onError' | 'onAction'>>

/**
 * The contract between the core and the child. The child renders `<Renderer.Root {...root} library={...}>`
 * with its own library, and puts `children` inside it. `children` holds the content, the refresh bridge,
 * and the program errors. The contract is a type, not a guard.
 */
export interface ChildProps {
  root: RootProps
  children?: ReactNode
}

/** What the page mounts. */
export interface WidgetPage {
  /** The id of the one component set that the child renders. It is the default. A program that names another id is refused. */
  catalog: string
  /** The child: one component that holds `<Renderer.Root>` and a component library. */
  child: ComponentType<ChildProps>
}

/** Diagnostics for the smoke check and for DevTools. The page never reads them. */
interface ShellDiagnostics {
  catalog: string
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

/** The values of one mounted page, made once in `mountWidget`. */
interface Env {
  dw: ShellDiagnostics
  record: (event: string) => void
  channel: WidgetChannel | undefined
  catalog: string
  Child: ComponentType<ChildProps>
}

/** Lives inside Renderer.Root to reach the OpenUI context. `refreshRef` runs each query again. */
function RefreshBridge({ dw, queryIdsRef, refreshRef }: {
  dw: ShellDiagnostics
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
  }, [dw, trigger, queryIdsRef, refreshRef])
  useEffect(() => { if (!query.isLoading) dw.state = 'ready' }, [dw, query.isLoading])
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
  | { status: 'ready', text: string }

function Core({ env }: { env: Env }) {
  const { dw, record, channel, catalog: shellCatalog, Child } = env
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
      const catalog = answer.catalog ?? shellCatalog
      if (catalog !== shellCatalog) {
        dw.state = 'error'
        setLoad({ status: 'error', title: 'Unsupported component set', detail: `The widget needs "${catalog}". This shell has ${shellCatalog}.`, retry: false })
        return
      }
      if (answer.text.trim() === '') {
        dw.state = 'empty'
        setLoad({ status: 'empty' })
        return
      }
      setLoad((current) => (current.status === 'removed' ? current : { status: 'ready', text: answer.text }))
    } catch (error) {
      dw.state = 'error'
      dw.errors.push(`program: ${error instanceof Error ? error.message : String(error)}`)
      setLoad((current) => (current.status === 'removed' ? current
        : { status: 'error', title: 'Could not load the widget', detail: error instanceof Error ? error.message : String(error), retry: true }))
    }
  }, [dw, record, channel, shellCatalog])

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
  }, [dw, record, channel, loadProgram])

  let body
  if (load.status === 'loading') body = <div className="dw-state" aria-busy="true"><div className="dw-skeleton" /><div className="dw-skeleton" /></div>
  else if (load.status === 'error') body = <StateView kind="error" title={load.title} detail={load.detail} {...(load.retry ? { onRetry: () => { void loadProgram() } } : {})} />
  else if (load.status === 'empty') body = <StateView kind="empty" title="This widget is empty" detail="Ask an agent to build it." />
  else if (load.status === 'removed') body = <StateView kind="removed" title="This widget was removed" />
  else {
    const root: RootProps = {
      response: load.text,
      toolProvider: channel?.tools ?? null,
      queryLoader: null,
      onParseResult: (result) => { queryIdsRef.current = (result?.queryStatements ?? []).map((statement) => statement.statementId) },
      onError: (errors) => {
        dw.errors = errors.map((error) => `${error.source}: ${error.code}`)
        setProgramErrors(errors.filter((error) => error.severity !== 'warning' && error.source !== 'query' && error.source !== 'mutation'))
      },
      onAction: (event) => { record(`action:${event.type}`) },
    }
    body = (
      <Child root={root}>
        <Renderer.Content />
        <RefreshBridge dw={dw} queryIdsRef={queryIdsRef} refreshRef={refreshRef} />
        {programErrors.length === 0 ? null : <StateView kind="error" title="The program has errors" detail={programErrors.map((error) => error.message).join(', ')} />}
      </Child>
    )
  }
  return <div className="dw-surface">{body}</div>
}

/** Mount the widget page in `#root`: read the slug, open the channel, and render the core around `page.child`. */
export function mountWidget(page: WidgetPage): void {
  const dw: ShellDiagnostics = {
    catalog: page.catalog, state: 'boot', stream: 'connecting', streamOpens: 0,
    refreshes: 0, programLoads: 0, events: [], errors: [],
  }
  window.__dw = dw
  const record = (event: string): void => { dw.events.push(event); if (dw.events.length > 200) dw.events.shift() }
  const slug = new URLSearchParams(location.search).get('slug')
  const channel = slug === null ? undefined : openChannel(slug)
  const root = document.getElementById('root')
  if (root === null) throw new Error('widget shell: the page has no #root')
  createRoot(root).render(<Core env={{ dw, record, channel, catalog: page.catalog, Child: page.child }} />)
}
