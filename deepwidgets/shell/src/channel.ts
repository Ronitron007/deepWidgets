/**
 * The page channel of the shell (`widget_mvp.provisional`, page channel): every request and the
 * stream go through this module. The MVP transport is `fetch` and server-sent events through
 * Electron main. A later transport (for example a MessagePort) replaces this module only.
 * @module @deepwidgets/shell/channel
 */
import type { McpClientLike } from '@openuidev/react-lang'

/** The first reopen delay of the stream. Each failed attempt doubles it up to the cap. */
const BACKOFF_MS = 250
const BACKOFF_CAP_MS = 8000

/** The answer of the program route. `catalog` is optional; the default is the shell's own set. */
export interface ProgramAnswer {
  rev: number
  text: string
  catalog?: string
}

/** The state of the stream, for diagnostics. */
export type StreamState = 'connecting' | 'open' | 'closed' | 'stopped'

/** What the stream reports. `hello` comes first on each new connection. */
export interface StreamHandlers {
  hello(rev: number, programRev: number): void
  data(rev: number | undefined): void
  program(rev: number | undefined): void
  /** The widget is gone. The channel stops the stream and does not open it again. */
  removed(): void
  state(state: StreamState, event: string): void
}

/** A failed HTTP answer. `status` is absent for a network error. */
class FetchError extends Error {
  constructor(message: string, readonly status?: number) { super(message) }
}

function errorMessage(body: unknown, status: number): string {
  const error = (body as { error?: { message?: unknown } } | null)?.error
  return typeof error?.message === 'string' ? error.message : `HTTP ${String(status)}`
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** The channel of one widget slug. */
export interface WidgetChannel {
  /** GET the program with a bounded retry. A 4xx answer is final; a network error or a 5xx answer is retried. */
  program(): Promise<ProgramAnswer>
  /** The toolProvider in the MCP client shape: each Query and Mutation is one call. */
  readonly tools: McpClientLike
  /** Open the stream. The result stops it. */
  subscribe(handlers: StreamHandlers): () => void
}

/** Open the channel of `slug` over fetch and server-sent events. */
export function openChannel(slug: string): WidgetChannel {
  const api = (path: string): string => `/api/widgets/${encodeURIComponent(slug)}${path}`

  async function program(tries = 4, timeoutMs = 5000): Promise<ProgramAnswer> {
    let last: unknown
    for (let attempt = 0; attempt < tries; attempt++) {
      try {
        const response = await fetch(api('/program'), { signal: AbortSignal.timeout(timeoutMs) })
        const body: unknown = await response.json().catch(() => null)
        if (!response.ok) throw new FetchError(errorMessage(body, response.status), response.status)
        return body as ProgramAnswer
      } catch (error) {
        last = error
        if (error instanceof FetchError && error.status !== undefined && error.status < 500) break
        await delay(BACKOFF_MS * 2 ** attempt)
      }
    }
    throw last
  }

  // No retry here: a mutation must not run twice. The next `data` frame or Retry runs a query again.
  const tools: McpClientLike = {
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

  // EventSource retries a network error by itself. When the stream closes (an HTTP error answer),
  // the channel opens a new one with backoff. After `removed`, it stops for good.
  function subscribe(handlers: StreamHandlers): () => void {
    let source: EventSource | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    let stopped = false
    const stop = (): void => { stopped = true; clearTimeout(timer); source?.close() }
    const open = (): void => {
      handlers.state('connecting', 'connect')
      const next = new EventSource(api('/stream'))
      source = next
      next.onopen = () => { attempt = 0; handlers.state('open', 'open') }
      next.onmessage = (event: MessageEvent<string>) => {
        let message: { type?: unknown, rev?: unknown, programRev?: unknown }
        try { message = JSON.parse(event.data) as typeof message } catch { return }
        const rev = typeof message.rev === 'number' ? message.rev : undefined
        if (message.type === 'hello' && rev !== undefined && typeof message.programRev === 'number') handlers.hello(rev, message.programRev)
        else if (message.type === 'data') handlers.data(rev)
        else if (message.type === 'program') handlers.program(rev)
        else if (message.type === 'removed') {
          stop()
          handlers.state('stopped', 'removed')
          handlers.removed()
        }
      }
      next.onerror = () => {
        if (stopped) return
        if (next.readyState !== EventSource.CLOSED) { handlers.state('connecting', 'retry'); return }
        next.close()
        handlers.state('closed', 'closed')
        const wait = Math.min(BACKOFF_MS * 2 ** attempt, BACKOFF_CAP_MS)
        attempt++
        timer = setTimeout(open, wait)
      }
    }
    open()
    return stop
  }

  return { program, tools, subscribe }
}
