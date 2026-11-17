/**
 * The action calls of the row controls of the Widgets tab. The child of main gives its components the tool provider
 * that the core made (`ChildProps.root.toolProvider`), so each control calls one action of main with the slug of its
 * row, and shows its own wait and its own refusal. A Mutation statement of the program keeps one result for all rows.
 * @module @deepwidgets/shell/main-widget/call
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { McpClientLike } from '@openuidev/react-lang'
import type { RootProps } from '@deepwidgets/widget-kit'

/** The answer of one call. `message` is the refusal text of the host, for example `built-in: sample is a built-in widget`. */
export type CallResult = { ok: true, result: unknown } | { ok: false, message: string }

/** Call the action `name` of main with `args`. The answer never throws. */
export type CallAction = (name: string, args: Record<string, unknown>) => Promise<CallResult>

const CallContext = createContext<CallAction | undefined>(undefined)

function isMcpClient(tools: NonNullable<RootProps['toolProvider']>): tools is McpClientLike {
  return typeof (tools as Partial<McpClientLike>).callTool === 'function'
}

function makeCall(tools: RootProps['toolProvider']): CallAction {
  return async (name, args) => {
    if (tools === null) return { ok: false, message: 'The page has no connection to the host.' }
    try {
      if (isMcpClient(tools)) {
        const answer = await tools.callTool({ name, arguments: args })
        if (answer.isError !== true) return { ok: true, result: answer.structuredContent }
        const text = answer.content.map((item) => item.text ?? '').join(' ').trim()
        return { ok: false, message: text === '' ? `The host refused ${name}.` : text }
      }
      const handler = tools[name]
      if (handler === undefined) return { ok: false, message: `The page has no action ${name}.` }
      return { ok: true, result: await handler(args) }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }
}

/** Give the components inside the call function of `tools`. */
export function CallProvider({ tools, children }: { tools: RootProps['toolProvider'], children: ReactNode }) {
  const call = useMemo(() => makeCall(tools), [tools])
  return <CallContext.Provider value={call}>{children}</CallContext.Provider>
}

/** The call function of the nearest {@link CallProvider}. */
export function useCall(): CallAction {
  const call = useContext(CallContext)
  if (call === undefined) throw new Error('main widget: a row control is outside CallProvider')
  return call
}
