/**
 * The remote MCP endpoint: a stateless McpServer per request (createMcpHandler from agents/mcp/server) with only the
 * interact tools the grant's scope allows. Each tool signs an Ed25519 assertion and relays through the DeviceRelay DO.
 */
import { createMcpHandler, getMcpAuthContext } from 'agents/mcp/server'
import { McpServer } from '@modelcontextprotocol/server'
import { buildClaims, signAssertion, type InteractTool } from './assertion.ts'
import { parseGrantProps, toolsForScope, type GrantProps } from './core.ts'
import type { Env } from './index.ts'
import type { CallOutcome } from './relay.ts'
import { MAX_ARGS_BYTES, TOOL_SPECS } from './tools.ts'

const NEXT_STEP: Record<string, string> = {
  'remote-disabled': 'The owner turned remote access off. Tell the user.',
  'grant-revoked': 'This grant was revoked. Ask the user to connect again.',
  'device-offline': 'The device is not connected. Ask the user to start the deepWidgets bridge.',
  'device-timeout': 'The device did not answer in time. Try again.',
  'outcome-unknown': 'The action may or may not have run. Retry with the same requestId and the same args: the device applies a requestId once and returns the first answer. Without a requestId, check with widget_describe first.',
  'idempotency-conflict': 'This requestId was used for a different call. Use a new requestId for a new operation.',
  'grant-denied-locally': 'The owner refused this grant on the device. Tell the user.',
  'killed-locally': 'Remote access is turned off on the device. Tell the user.',
  'widget-not-granted': 'Call widget_list for the widgets this grant may use.',
  'args-too-large': 'Send smaller args (at most 64 KiB).',
}

type ToolResult = { content: { type: 'text'; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean }

function toolError(code: string, message: string): ToolResult {
  const error = { code, message, nextStep: NEXT_STEP[code] ?? 'Tell the user the message.' }
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error }) }], structuredContent: { error } }
}

async function runTool(env: Env, props: GrantProps, clientId: string, tool: InteractTool, input: Record<string, unknown>): Promise<ToolResult> {
  const slug = typeof input.slug === 'string' ? input.slug : ''
  if (slug !== '' && (slug === 'main' || (!props.widgets.includes('*') && !props.widgets.includes(slug)))) {
    return toolError('widget-not-granted', `this grant may not use the widget ${JSON.stringify(slug)}`)
  }
  const argsJson = JSON.stringify(input)
  if (new TextEncoder().encode(argsJson).length > MAX_ARGS_BYTES) return toolError('args-too-large', 'the args are larger than 64 KiB')
  if (env.ASSERTION_SIGNING_KEY === undefined || env.ASSERTION_SIGNING_KEY === '') return toolError('relay-misconfigured', 'the relay has no signing key')
  const claims = await buildClaims({
    deviceId: props.deviceId, clientId, grantId: props.grantId, scope: props.scope, widgets: props.widgets,
    tool, argsJson, nowSec: Math.floor(Date.now() / 1000),
  })
  const assertion = await signAssertion(env.ASSERTION_SIGNING_KEY, claims)
  const outcome = (await env.DEVICE.getByName(props.deviceId).call({ grantId: props.grantId, clientId, tool, slug, assertion, argsJson })) as CallOutcome
  if (!outcome.ok) return toolError(outcome.code, outcome.message)
  // The local server's tool result passes through as is (tool errors included).
  return outcome.result as ToolResult
}

/** One server per request. Props are checked at runtime: anything malformed gets a server with zero tools. */
export function buildServer(env: Env, rawProps: unknown): McpServer {
  const server = new McpServer({ name: 'deepwidgets-remote', version: '0.0.0' })
  const props = parseGrantProps(rawProps)
  if (props === null || props.deviceId !== env.DEVICE_ID) return server
  const rawClient = (rawProps as Record<string, unknown>).clientId
  const clientId = typeof rawClient === 'string' && rawClient !== '' ? rawClient : 'unknown'
  for (const tool of toolsForScope(props.scope)) {
    const spec = TOOL_SPECS[tool]
    server.registerTool(tool, { description: spec.description, inputSchema: spec.input }, async (input: Record<string, unknown>) =>
      await runTool(env, props, clientId, tool, input))
  }
  return server
}

/** The API handler behind the OAuth provider: exactly /mcp, Host and Origin pinned to PUBLIC_URL. */
export function mcpFetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | Response {
  if (new URL(request.url).pathname !== '/mcp') return new Response('Not Found', { status: 404 })
  const host = new URL(env.PUBLIC_URL).hostname
  const handler = createMcpHandler(() => buildServer(env, getMcpAuthContext()?.props), {
    route: '/mcp',
    allowedHostnames: [host],
    allowedOriginHostnames: [host],
  })
  return handler(request, env, ctx)
}
