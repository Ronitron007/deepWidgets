/**
 * deepWidgets: cleanup of the MCP port file `$DSH_HOME/deepwidgets/mcp.json` (`widget_phase2.mcp_port`).
 * In the desktop app, Electron main owns the port and the file (`safe_host.port`, `deepwidgets-mcp-port.ts`).
 * At its start, Electron main removes a file whose owner is dead here, so that agents do not trust a dead port.
 * The owner check matches `@deepwidgets/mcp` (`ownerAlive`): the pid must be alive and its start time
 * must match `started`, so a reused pid does not keep a dead Host's file.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** `ps` gives whole seconds and rounds the elapsed time down. */
const START_TOLERANCE_MS = 3_000

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** The start of process `pid` in ms since the epoch, from `ps -o etime=`; undefined when `ps` cannot tell. */
function startMs(pid: number): number | undefined {
  try {
    const out = execFileSync('ps', ['-o', 'etime=', '-p', String(pid)], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'ignore'] })
    const match = /^\s*(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)\s*$/u.exec(out)
    if (match === null) return undefined
    const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = match
    return Date.now() - (((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000
  } catch {
    // ps is missing or the process ended; the pid check decides.
    return undefined
  }
}

/** `$DSH_HOME/deepwidgets/mcp.json`, with the `DSH_HOME` of `environment`. */
export function mcpPortFilePath(environment: NodeJS.ProcessEnv): string {
  return join(resolveDshHome(undefined, environment), 'deepwidgets', 'mcp.json')
}

/**
 * True when process `pid` is alive and is the process that wrote the file: its start time matches `started`.
 * @param pid - The `pid` of the port file.
 * @param started - The `started` of the port file.
 */
export function mcpPortFileOwnerAlive(pid: number, started: unknown): boolean {
  if (!alive(pid)) return false
  if (typeof started !== 'number') return true
  const actual = startMs(pid)
  return actual === undefined || Math.abs(actual - started) <= START_TOLERANCE_MS
}

/**
 * Remove the port file when the exited Host owned it or its owner is dead. A file of another live
 * Host stays, for example when this Host failed to start because that Host holds the port.
 * @param exitedPid - The process id of the Host that exited, or undefined when it never started.
 * @param environment - The Host environment; its `DSH_HOME` names the file.
 */
export function removeDeadMcpPortFile(exitedPid: number | undefined, environment: NodeJS.ProcessEnv): void {
  const file = mcpPortFilePath(environment)
  try {
    let current: { pid?: unknown; started?: unknown } | null
    try {
      current = JSON.parse(readFileSync(file, 'utf8')) as { pid?: unknown; started?: unknown } | null
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      // An unreadable file names no live Host; agents must not trust it.
      current = null
    }
    const pid = current?.pid
    const owner = typeof pid === 'number' && Number.isSafeInteger(pid) && pid > 0 ? pid : undefined
    if (owner !== undefined && owner !== exitedPid && mcpPortFileOwnerAlive(owner, current?.started)) return
    unlinkSync(file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    console.warn(`deepwidgets: the MCP port file ${file} was not removed`, error)
  }
}
