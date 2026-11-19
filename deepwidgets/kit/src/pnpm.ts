/**
 * One pnpm run in a kit version, the way the DSH plugin manager runs pnpm in a profile
 * (`packages/boot/plugin-manager/src/operations.ts`): the command that the app gives the host, the parent environment
 * without credentials and `DSH_*` names, a time limit, and a kill of the whole process tree at the limit, so a stopped
 * run leaves no install script running.
 *
 * pnpm names each failure with a stable code in brackets, such as `[ERR_PNPM_FETCH_404]`, in any locale. The kit reads
 * the code and the package from the output; the message text is only for the operator.
 * @module @deepwidgets/kit/pnpm
 */
import { stripVTControlCharacters } from 'node:util'
import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'
import { execa } from 'execa'
import { REFUSED_CODE } from './folder.ts'

/** The pnpm command of the host: `profileContext.packageManager`, or `pnpm` on the `PATH`. */
export interface PnpmCommand {
  readonly command: string
  readonly args: readonly string[]
  readonly env: Readonly<Record<string, string>>
}

/** How one run ended. `output` is stdout and stderr in order, without color codes. */
export interface PnpmRun {
  /** The command line after the command, for the log. */
  argv: string[]
  exitCode: number | undefined
  output: string
  timedOut: boolean
  /** Set when the process did not start, such as a command that does not exist. */
  spawnError?: string
}

/**
 * Run `pnpm <args>` in `cwd`. It never rejects: a failure to start, a time limit, and an abort are facts of the result.
 * @param signal - Aborts the run; the process tree gets SIGKILL.
 */
export async function runPnpm(command: PnpmCommand, cwd: string, args: readonly string[], timeoutMs: number, signal: AbortSignal): Promise<PnpmRun> {
  const argv = [...args]
  const result = await execa(command.command, [...command.args, ...argv], {
    cwd,
    env: { ...scrubbedParentEnv(), ...command.env },
    extendEnv: false,
    reject: false,
    stdin: 'ignore',
    all: true,
    timeout: timeoutMs,
    cancelSignal: signal,
    killDescendants: true,
    killSignal: 'SIGKILL',
  })
  const output = stripVTControlCharacters(typeof result.all === 'string' ? result.all : '')
  const run: PnpmRun = { argv, exitCode: result.exitCode, output, timedOut: result.timedOut }
  // A process that never ran has no exit code and no output; the error names the reason, such as ENOENT.
  if (result.exitCode === undefined && !result.timedOut && !result.isCanceled) run.spawnError = result.shortMessage ?? 'pnpm did not start'
  return run
}

/** True when the run ended with exit code 0. */
export const passed = (run: PnpmRun): boolean => run.exitCode === 0 && !run.timedOut && run.spawnError === undefined

/** The first error code in brackets that pnpm printed, such as `ERR_PNPM_FETCH_404`. */
export function pnpmCode(output: string): string | undefined {
  return /\[(ERR_[A-Z0-9_]+)\]/.exec(output)?.[1]
}

/** The package `<name>@<version>` that the pnpmfile of the kit refused, from its error line. */
export function refusedPackage(output: string): string | undefined {
  return /deepwidgets-kit: the package (\S+) is refused by kit\.refuseBuilds/.exec(output)?.[1]
}

/** The package `<name>@<version>` that the release hold refused (`ERR_PNPM_NO_MATURE_MATCHING_VERSION`). */
export function immaturePackage(output: string): string | undefined {
  return /(\S+@\S+) was published at/.exec(output)?.[1]
}

/** The codes of a package or a version that npm does not have. */
export const NOT_FOUND_CODES: ReadonlySet<string> = new Set(['ERR_PNPM_FETCH_404', 'ERR_PNPM_NO_MATCHING_VERSION', 'ERR_PNPM_NO_VERSIONS'])

/** True when the pnpmfile of the kit refused a package (`kit.settings`). */
export const wasRefused = (output: string): boolean => pnpmCode(output) === REFUSED_CODE

/** The last lines of a run, for an error message. */
export function outputTail(run: PnpmRun, chars = 1_500): string {
  const lines = run.output.split('\n').filter((line) => !/^\s+at /.test(line) && !line.startsWith('Progress:'))
  return lines.join('\n').trim().slice(-chars)
}

/** One run as a block of the log file of a kit version. */
export function logBlock(run: PnpmRun): string {
  const end = run.spawnError ?? (run.timedOut ? 'the time limit stopped it' : `exit code ${String(run.exitCode)}`)
  return `$ pnpm ${run.argv.join(' ')}\n${run.output}\n# ${end}\n\n`
}
