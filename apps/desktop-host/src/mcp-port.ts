/**
 * The fixed port of the desktop Host web server (deepWidgets `widget_phase2.mcp_port`). The web
 * server and the widget MCP route share this listener, so agents find `/mcp` at a known port.
 */

/** The default port, when `DEEPWIDGETS_MCP_PORT` is not set. */
export const DEFAULT_MCP_PORT = 47615

/**
 * Read the port setting `DEEPWIDGETS_MCP_PORT`. The user sets it in `$DSH_HOME/.env` or in the
 * launching environment. `0` lets the OS pick a port; checks use it to run beside a live app.
 * @param env - The environment after the layered `.env` files are applied.
 * @returns The port to bind.
 * @throws {Error} when the value is not an integer from 0 to 65535. The Host then does not start.
 */
export function resolveMcpPort(env: NodeJS.ProcessEnv): number {
  const raw = env.DEEPWIDGETS_MCP_PORT
  if (raw === undefined || raw.trim() === '') return DEFAULT_MCP_PORT
  const port = Number(raw)
  if (!/^\d+$/u.test(raw.trim()) || !Number.isSafeInteger(port) || port > 65535) {
    throw new Error(`deepwidgets: DEEPWIDGETS_MCP_PORT=${JSON.stringify(raw)} is not a port; set an integer from 0 to 65535, or remove it to use ${String(DEFAULT_MCP_PORT)}`)
  }
  return port
}
