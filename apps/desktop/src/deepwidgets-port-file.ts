/**
 * deepWidgets: cleanup of the MCP port file `$DSH_HOME/deepwidgets/mcp.json` (`widget_phase2.mcp_port`).
 * The Host writes the file and removes it on a clean stop. A Host that crashes, or one that fails to
 * start, cannot; the shell removes the file here so that agents do not trust a dead port.
 */
import { readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * Remove the port file when the exited Host owned it or its owner is dead. A file of another live
 * Host stays, for example when this Host failed to start because that Host holds the port.
 * @param exitedPid - The process id of the Host that exited, or undefined when it never started.
 * @param environment - The Host environment; its `DSH_HOME` names the file.
 */
export function removeDeadMcpPortFile(exitedPid: number | undefined, environment: NodeJS.ProcessEnv): void {
  const file = join(resolveDshHome(undefined, environment), 'deepwidgets', 'mcp.json')
  try {
    let pid: unknown
    try {
      pid = (JSON.parse(readFileSync(file, 'utf8')) as { pid?: unknown } | null)?.pid
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      // An unreadable file names no live Host; agents must not trust it.
      pid = undefined
    }
    const owner = typeof pid === 'number' && Number.isSafeInteger(pid) && pid > 0 ? pid : undefined
    if (owner !== undefined && owner !== exitedPid && alive(owner)) return
    unlinkSync(file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    console.warn(`deepwidgets: the MCP port file ${file} was not removed`, error)
  }
}
