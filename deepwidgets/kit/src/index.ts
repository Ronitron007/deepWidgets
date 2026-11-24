/**
 * The widget kit (spec `kit`): the set of packages that the page of a widget can import. The row gives the service
 * `kit`. The kit is one pnpm project for each DSH home, at `$DSH_HOME/deepwidgets/kit/` (`kit.folder`):
 *
 * ```
 * current -> versions/<n>
 * versions/<n>/   package.json, pnpm-lock.yaml, pnpm-workspace.yaml, .pnpmfile.cjs, pnpm.log, core/<name>, node_modules/
 * store/          the pnpm store
 * cache/          the pnpm metadata cache
 * ```
 *
 * At host start (`kit.service.start`) the service makes version 1 with the core only and no network, points each link
 * in `core/` at the folder of the core package in the app, and installs a missing `node_modules` offline from the store
 * with the frozen lockfile and `trust-lockfile`. When that fails, the kit is unavailable and the host goes on:
 * `folders()` then refuses with `kit-unavailable`, and the page gates of `@deepwidgets/mcp` refuse each page. The start
 * runs after the service is registered, and each call waits for it.
 *
 * A change (`add`, `remove`) copies the current version to the next number, at the same depth, runs pnpm there, and
 * then points `current` at the copy (`kit.service.calls`). The copy goes when a step fails, so the current version does
 * not change. One change runs at a time. Only a change uses the network.
 *
 * Two processes can use one DSH home, such as the dev app and a CLI host. Each change and each start holds the file lock
 * of the kit (`kit.service.lock`), so a change of one process never meets a change or a start of another.
 *
 * The kit runs pnpm with the command that the app gives the host (`profileContext.packageManager`), as the plugin
 * manager does. A host with no such command runs the pnpm of the repository, 11.28.5. The kit runs only pnpm 11: at
 * start it checks the major version, and with another version the kit is unavailable (`kit.service.start`).
 * @module @deepwidgets/kit
 */
import { lstat, mkdir, readdir, readFile, readlink, realpath, rename, rm, symlink, writeFile, appendFile, copyFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-app-boot'
import { withFileLock } from '@deepseek-ai/dsh-atomic-write'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { z } from 'zod'
import { appCoreFolders, CORE, firstManifestText, isCore, pnpmfileText, repositoryPnpm, workspaceText } from './folder.ts'
import type { CoreName } from './folder.ts'
import { immaturePackage, logBlock, NOT_FOUND_CODES, outputTail, passed, pnpmCode, refusedPackage, runPnpm, wasRefused } from './pnpm.ts'
import type { PnpmCommand, PnpmRun } from './pnpm.ts'

export { CORE } from './folder.ts'
export type { CoreName } from './folder.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The widget kit. It is there while its row is, also while the kit is unavailable. */
    kit: KitService
  }
}

export const name = 'deepwidgets-kit'

export interface Config {
  /** The kit folder. Defaults to `$DSH_HOME/deepwidgets/kit`. */
  dir?: string
  /** The settings file of `kit.settings`. Defaults to `$DSH_HOME/deepwidgets/settings.json`. */
  settingsFile?: string
}

/** The kit versions that stay: the current one and the newest older ones. */
const KEPT_VERSIONS = 3
/** The time limit of the offline install at host start. */
const OFFLINE_LIMIT_MS = 120_000
/** The time limit of one pnpm run of a change. It is the silence limit of the plugin manager. */
const CHANGE_LIMIT_MS = 600_000
/** How long a start or a change waits for the lock of the kit: one change of another process has two pnpm runs. */
const LOCK_WAIT_MS = 2 * CHANGE_LIMIT_MS + 60_000
/** A name of an npm package. */
const NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/
/** A spec of `add`: a package name, then an optional version, range, or tag. */
const SPEC = /^((?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*)(?:@([0-9A-Za-z.^~<>=|*+ -]+))?$/
/** An exact version, as `pnpm add --save-exact` writes it. */
const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
/** The time limit of `pnpm --version`. */
const VERSION_LIMIT_MS = 30_000
/** The major version of pnpm that the kit runs (`kit.folder`). */
const PNPM_MAJOR = 11
/** A kit version folder under `versions/`. */
const VERSION_DIR = /^[1-9]\d{0,8}$/
/**
 * The file that the kit writes into `node_modules` after pnpm exits with 0. pnpm writes no `.modules.yaml` for a project
 * of links only, and a stopped install can leave a `node_modules` folder, so the kit keeps its own mark.
 */
const WHOLE_MARK = '.deepwidgets-kit-whole'

/** The error codes of `kit.service.errors`. */
export type KitErrorCode = 'in-core' | 'not-found' | 'install-failed' | 'kit-unavailable'

/** A refusal of the kit. A refused change left the current version as it was. */
export class KitError extends Error {
  readonly code: KitErrorCode
  /** The pnpm code of a failed run, such as `ERR_PNPM_NO_MATURE_MATCHING_VERSION`, or `ERR_DEEPWIDGETS_KIT_REFUSED`. */
  readonly pnpmCode: string | undefined
  /** The package that the failure names: `<name>@<version>` when pnpm names the version, else the name. */
  readonly package: string | undefined

  constructor(code: KitErrorCode, message: string, options: { pnpmCode?: string | undefined, package?: string | undefined } = {}) {
    super(message)
    this.name = 'KitError'
    this.code = code
    this.pnpmCode = options.pnpmCode
    this.package = options.package
  }
}

/** One package of the kit, with its version. */
export interface KitPackage {
  name: string
  version: string
}

/** What `read()` gives. */
export interface KitState {
  /** The current kit version, or undefined when the kit has no version. */
  version: number | undefined
  /** False when the current version can not be made whole offline (`kit.service.start`). `reason` then tells why. */
  available: boolean
  reason?: string
  /** The core, with the version of the copy in the app. */
  core: KitPackage[]
  /** The extras, with their exact versions. */
  extras: KitPackage[]
}

/** What `folders()` gives: the real folder of each core package and of each extra of the current version. */
export interface KitFolders {
  version: number
  core: Record<string, string>
  extras: Record<string, string>
}

type Availability = { available: true } | { available: false, reason: string }

/** The settings file (`kit.settings`). Other keys belong to other readers, so the schema is not strict. */
const settingsSchema = z.object({ kit: z.object({ refuseBuilds: z.array(z.string()).optional() }).optional() })

const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error)

/** The dependencies of the `package.json` of a kit version. */
async function manifestDependencies(dir: string): Promise<Record<string, string>> {
  const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> }
  return manifest.dependencies ?? {}
}

/** The service `kit`. */
export class KitService extends Service {
  // A private field (#) does not work: the caller context reads the service through a proxy.
  private readonly dir: string
  private readonly settingsFile: string
  /** The pnpm command, or the reason that the host has none. */
  private readonly pnpm: PnpmCommand | Error
  /** The version of pnpm, after the start checked that its major version is {@link PNPM_MAJOR}. */
  private pnpmVersion: string | undefined
  private readonly abort = new AbortController()
  private availability: Availability = { available: false, reason: 'the kit has not started' }
  /** The real folders of the core in the app; undefined when they do not resolve. */
  private core: Record<CoreName, string> | undefined
  private readonly started: Promise<void>
  /** The changes, one at a time. */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(ctx: Context, options: { dir: string, settingsFile: string, pnpm: PnpmCommand | Error }) {
    super(ctx, 'kit')
    this.dir = options.dir
    this.settingsFile = options.settingsFile
    this.pnpm = options.pnpm
    this.started = this.start()
  }

  /** The folder of kit version `n`. */
  private versionDir(n: number): string {
    return join(this.dir, 'versions', String(n))
  }

  /**
   * Run `work` while this process holds the file lock of the kit (`kit.service.lock`): `<kit>/current.lock`. The lock of
   * a process that ended is taken over. The kit folder must exist.
   */
  private locked<T>(work: () => Promise<T>): Promise<T> {
    return withFileLock(join(this.dir, 'current'), work, { waitMs: LOCK_WAIT_MS, signal: this.abort.signal })
  }

  /**
   * kit.service.start. It never rejects: a failure makes the kit unavailable, with the reason in the host log.
   */
  private async start(): Promise<void> {
    try {
      this.core = appCoreFolders()
      await mkdir(join(this.dir, 'versions'), { recursive: true })
      this.pnpmVersion = await this.checkPnpm()
      // kit.service.lock: the start waits for a change of another process, so it never removes a version in work.
      const message = await this.locked(() => this.startLocked())
      this.availability = { available: true }
      this.ctx.logger.info(`${message} (pnpm ${this.pnpmVersion})`)
    } catch (error) {
      const reason = errorText(error)
      this.availability = { available: false, reason }
      this.ctx.logger.warn(`kit: the widget kit is unavailable, so a widget with page/ does not install: ${reason}`)
    }
  }

  /**
   * The version of pnpm (`kit.service.start`). pnpm 10 prints its error codes in another form and uses another store
   * folder, so a kit that pnpm 11 made is not whole under it.
   * @throws {Error} that names the version when its major version is not {@link PNPM_MAJOR}, or when pnpm gives none.
   */
  private async checkPnpm(): Promise<string> {
    const run = await this.pnpmIn(undefined, ['--version'], VERSION_LIMIT_MS)
    const version = run.output.split('\n').map((line) => line.trim()).find((line) => /^\d+\.\d+\.\d+/.test(line))
    if (!passed(run) || version === undefined) throw new Error(`pnpm gave no version${this.codeText(run)}: ${outputTail(run, 300)}`)
    if (Number(version.split('.')[0]) !== PNPM_MAJOR) throw new Error(`the kit runs only pnpm ${String(PNPM_MAJOR)}, and the pnpm of this host is ${version}`)
    return version
  }

  /** The steps of the start that change the kit folder. Gives the log line of the start. */
  private async startLocked(): Promise<string> {
    // A host that stopped between a link and its rename left the link under its temporary name.
    for (const entry of await readdir(this.dir)) if (entry.startsWith('.current-')) await rm(join(this.dir, entry), { force: true })
    const current = await this.currentVersion()
    if (current === undefined) {
      await this.makeFirst()
      return 'kit: made kit version 1 with the core only'
    }
    await this.dropNewer(current)
    const dir = this.versionDir(current)
    await this.linkCore(dir)
    if (!await this.whole(dir)) {
      // kit.checked.offline: the 24-hour wait ran when a change wrote this lockfile. Without trust-lockfile, pnpm
      // checks it again offline, and that check fails for a lockfile that `pnpm remove` wrote. Only this step trusts
      // the lockfile; each change runs pnpm online with the wait.
      const run = await this.pnpmIn(dir, ['install', '--offline', '--frozen-lockfile', '--config.trust-lockfile=true'], OFFLINE_LIMIT_MS)
      if (!passed(run)) throw new Error(`the offline install of kit version ${String(current)} failed${this.codeText(run)}: ${outputTail(run, 600)}`)
      await this.markWhole(dir)
    }
    return `kit: kit version ${String(current)} is ready`
  }

  private codeText(run: PnpmRun): string {
    const code = pnpmCode(run.output)
    if (code !== undefined) return ` with ${code}`
    if (run.spawnError !== undefined) return `: pnpm did not start (${run.spawnError})`
    return run.timedOut ? ': the time limit stopped pnpm' : ` with exit code ${String(run.exitCode)}`
  }

  /** Run pnpm in the kit version `dir` and append the run to its `pnpm.log`. With no `dir`, it runs in the kit folder with no log. */
  private async pnpmIn(dir: string | undefined, args: readonly string[], timeoutMs: number): Promise<PnpmRun> {
    if (this.pnpm instanceof Error) throw this.pnpm
    const run = await runPnpm(this.pnpm, dir ?? this.dir, args, timeoutMs, this.abort.signal)
    if (dir === undefined) return run
    await appendFile(join(dir, 'pnpm.log'), logBlock(run)).catch((error: unknown) => {
      this.ctx.logger.warn(`kit: the log of the pnpm run in ${dir} was not written`, error)
    })
    return run
  }

  /** True when a pnpm run that made the `node_modules` of `dir` exited with 0 ({@link WHOLE_MARK}). */
  private async whole(dir: string): Promise<boolean> {
    return (await lstat(join(dir, 'node_modules', WHOLE_MARK)).catch(() => undefined))?.isFile() === true
  }

  private async markWhole(dir: string): Promise<void> {
    await mkdir(join(dir, 'node_modules'), { recursive: true })
    await writeFile(join(dir, 'node_modules', WHOLE_MARK), '')
  }

  /**
   * The number of the version that `current` names, or undefined when the kit has no `current`.
   * @throws {Error} when `current` names no kit version.
   */
  private async currentVersion(): Promise<number | undefined> {
    const link = join(this.dir, 'current')
    let target: string
    try {
      target = await readlink(link)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
    const match = /^versions\/([1-9]\d{0,8})$/.exec(target)
    if (match?.[1] === undefined || (await lstat(join(this.dir, target, 'package.json')).catch(() => undefined)) === undefined) {
      throw new Error(`the link ${link} names ${JSON.stringify(target)}, which is not a kit version. Remove the link to make kit version 1 again`)
    }
    return Number(match[1])
  }

  /** Version 1: the core links only, installed offline. A failed attempt leaves no version. */
  private async makeFirst(): Promise<void> {
    const dir = this.versionDir(1)
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    try {
      await writeFile(join(dir, 'package.json'), firstManifestText())
      await writeFile(join(dir, 'pnpm-workspace.yaml'), workspaceText())
      // Each change writes the list of the settings file; version 1 has no package from npm to refuse.
      await writeFile(join(dir, '.pnpmfile.cjs'), pnpmfileText([]))
      await this.linkCore(dir)
      const run = await this.pnpmIn(dir, ['install', '--offline'], OFFLINE_LIMIT_MS)
      if (!passed(run)) throw new Error(`the install of kit version 1 failed${this.codeText(run)}: ${outputTail(run, 600)}`)
      await this.markWhole(dir)
      await this.pointCurrent(1)
    } catch (error) {
      await rm(dir, { recursive: true, force: true })
      throw error
    }
  }

  /** Remove each version newer than `current`: a change that a stopped host did not finish. */
  private async dropNewer(current: number): Promise<void> {
    for (const entry of await readdir(join(this.dir, 'versions'))) {
      if (VERSION_DIR.test(entry) && Number(entry) > current) await rm(join(this.dir, 'versions', entry), { recursive: true, force: true })
    }
  }

  /**
   * Point each link `core/<name>` of the version `dir` at the folder of the core package in the app. The lockfile holds
   * only the relative links, so an app update changes the core and not the lockfile. Each link in `node_modules` goes
   * through `core/`, so no install is needed after it.
   */
  private async linkCore(dir: string): Promise<void> {
    const core = this.core
    if (core === undefined) throw new Error('the core folders of the app are not known')
    for (const name of CORE) {
      const link = join(dir, 'core', name)
      const target = core[name]
      if (await readlink(link).catch(() => undefined) === target) continue
      await mkdir(dirname(link), { recursive: true })
      const temp = `${link}.${randomBytes(6).toString('hex')}.tmp`
      await symlink(target, temp, 'dir')
      await rename(temp, link)
    }
  }

  /** Point `current` at version `n`, in one rename, so a reader sees the old version or the new one. */
  private async pointCurrent(n: number): Promise<void> {
    const temp = join(this.dir, `.current-${randomBytes(6).toString('hex')}`)
    await symlink(`versions/${String(n)}`, temp, 'dir')
    await rename(temp, join(this.dir, 'current'))
  }

  /** Keep the newest {@link KEPT_VERSIONS} versions. A failed removal stays until the next change. */
  private async prune(): Promise<void> {
    const versions = (await readdir(join(this.dir, 'versions'))).filter((entry) => VERSION_DIR.test(entry)).map(Number).sort((a, b) => b - a)
    for (const n of versions.slice(KEPT_VERSIONS)) {
      await rm(this.versionDir(n), { recursive: true, force: true }).catch((error: unknown) => {
        this.ctx.logger.warn(`kit: the old kit version ${String(n)} was not removed`, error)
      })
    }
  }

  /**
   * `kit.refuseBuilds` of the settings file, read at each change as `@deepwidgets/mcp` reads the modes. A missing file
   * or key is an empty list.
   * @throws {KitError} `install-failed` when the file exists and can not be used: the kit does not guess the refusals
   * of the operator.
   */
  private async refusedBuilds(): Promise<string[]> {
    let text: string
    try {
      text = await readFile(this.settingsFile, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw new KitError('install-failed', `the settings file ${this.settingsFile} could not be read, so the refused packages are not known and the kit did not change: ${errorText(error)}`)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      throw new KitError('install-failed', `the settings file ${this.settingsFile} is not JSON, so the refused packages are not known and the kit did not change: ${errorText(error)}`)
    }
    const checked = settingsSchema.safeParse(parsed)
    if (!checked.success) {
      throw new KitError('install-failed', `the settings file ${this.settingsFile} does not match { "kit": { "refuseBuilds": ["<package name>"] } }, so the kit did not change: ${z.prettifyError(checked.error)}`)
    }
    return checked.data.kit?.refuseBuilds ?? []
  }

  /** Run `work` after the changes before it. */
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work)
    this.queue = next.catch(() => undefined)
    return next
  }

  /** The error of a failed pnpm run of a change for the package `name`. */
  private changeError(run: PnpmRun, name: string): KitError {
    const code = pnpmCode(run.output)
    const tail = outputTail(run)
    if (code !== undefined && NOT_FOUND_CODES.has(code)) return new KitError('not-found', `npm has no package or version for ${name}: ${tail}`, { pnpmCode: code, package: name })
    if (wasRefused(run.output)) {
      const refused = refusedPackage(run.output)
      return new KitError('install-failed', `kit.refuseBuilds refuses ${refused ?? 'a package'}, which the change needs, so the kit did not change: ${tail}`, { pnpmCode: code, package: refused })
    }
    if (code === 'ERR_PNPM_NO_MATURE_MATCHING_VERSION') {
      const young = immaturePackage(run.output)
      return new KitError('install-failed', `the version of ${young ?? name} is newer than 24 hours (minimumReleaseAge), so the kit did not change: ${tail}`, { pnpmCode: code, package: young ?? name })
    }
    return new KitError('install-failed', `pnpm failed for ${name}${this.codeText(run)}, so the kit did not change: ${tail}`, { pnpmCode: code, package: name })
  }

  /**
   * One change (`kit.service.calls`): copy the current version to the next number, run `edit` there, and point
   * `current` at the copy. When a step fails, the copy goes and the current version stays.
   */
  private change(edit: (dir: string) => Promise<string>): Promise<KitState> {
    return this.serial(async () => {
      await this.started
      // A start that found no pnpm 11 or no core leaves the kit as it is: no change runs.
      if (this.core === undefined || this.pnpmVersion === undefined) throw new KitError('kit-unavailable', `the widget kit is unavailable: ${this.unavailableReason()}`)
      // kit.service.lock: another process can change the kit too, so `current` is read under the lock.
      return this.locked(() => this.changeLocked(edit))
    })
  }

  private async changeLocked(edit: (dir: string) => Promise<string>): Promise<KitState> {
    const current = await this.currentVersion().catch(() => undefined)
    if (current === undefined) throw new KitError('kit-unavailable', `the widget kit has no version: ${this.unavailableReason()}`)
    const refused = await this.refusedBuilds()
    const next = current + 1
    const from = this.versionDir(current)
    const dir = this.versionDir(next)
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    let done: string
    try {
      await copyFile(join(from, 'package.json'), join(dir, 'package.json'))
      await copyFile(join(from, 'pnpm-lock.yaml'), join(dir, 'pnpm-lock.yaml'))
      await writeFile(join(dir, 'pnpm-workspace.yaml'), workspaceText())
      // kit.settings: a change of the list changes the pnpmfile, so this version does not use a frozen lockfile.
      await writeFile(join(dir, '.pnpmfile.cjs'), pnpmfileText(refused))
      await this.linkCore(dir)
      done = await edit(dir)
      await this.markWhole(dir)
      await this.pointCurrent(next)
    } catch (error) {
      await rm(dir, { recursive: true, force: true })
      throw error
    }
    // A copy that pnpm made whole online also ends an unavailable start.
    this.availability = { available: true }
    this.ctx.logger.info(`kit: kit version ${String(next)} ${done}`)
    // The change is committed: a failed prune does not undo it.
    await this.prune().catch((error: unknown) => { this.ctx.logger.warn('kit: the old kit versions were not pruned', error) })
    return this.readNow()
  }

  private unavailableReason(): string {
    return this.availability.available ? 'the kit has no current version' : this.availability.reason
  }

  /**
   * Add one extra. `spec` is a package name with an optional version or range, such as `date-fns@^4`. The kit saves the
   * exact version that pnpm picked, the newest one that is older than 24 hours.
   * @returns the kit after the change.
   * @throws {KitError} `in-core` for a core package, `not-found` for a spec that is not an npm package name with an
   * optional version or range and for a package or version that npm does not have, `install-failed` with the pnpm code
   * and the package, or `kit-unavailable` when the kit has no version. A refusal leaves the current version as it was.
   */
  add(spec: string): Promise<KitState> {
    const match = SPEC.exec(spec)
    const name = match?.[1]
    if (name === undefined || spec.length > 300) return Promise.reject(new KitError('not-found', `${JSON.stringify(spec)} is not an npm package name with an optional version or range`, { package: spec }))
    if (isCore(name)) return Promise.reject(new KitError('in-core', `${name} is in the core of the kit, which only an app update changes`, { package: name }))
    return this.change(async (dir) => {
      const run = await this.pnpmIn(dir, ['add', '--save-exact', spec], CHANGE_LIMIT_MS)
      if (!passed(run)) throw this.changeError(run, name)
      // pnpm keeps a range of the spec in package.json, also with --save-exact. A second run saves the exact
      // version that it installed. It runs online with the 24-hour wait, as each run of a change. It is the run with
      // node_modules, where pnpm puts React from npm in place of the core when the overrides are missing
      // (kit.checked.core_link).
      const saved = (await manifestDependencies(dir))[name]
      if (saved !== undefined && EXACT.test(saved)) return `added ${name}@${saved}`
      const installed = (JSON.parse(await readFile(join(dir, 'node_modules', name, 'package.json'), 'utf8')) as { version?: unknown }).version
      if (typeof installed !== 'string' || !EXACT.test(installed)) throw new KitError('install-failed', `pnpm installed no exact version of ${name}, so the kit did not change`, { package: name })
      const pin = await this.pnpmIn(dir, ['add', '--save-exact', `${name}@${installed}`], CHANGE_LIMIT_MS)
      if (!passed(pin)) throw this.changeError(pin, name)
      return `added ${name}@${installed}`
    })
  }

  /**
   * Remove one extra.
   * @returns the kit after the change.
   * @throws {KitError} `in-core` for a core package, `not-found` when the kit has no such extra, `install-failed`, or
   * `kit-unavailable`. A refusal leaves the current version as it was.
   */
  remove(name: string): Promise<KitState> {
    if (isCore(name)) return Promise.reject(new KitError('in-core', `${name} is in the core of the kit, which only an app update changes`, { package: name }))
    if (!NAME.test(name)) return Promise.reject(new KitError('not-found', `${JSON.stringify(name)} is not an npm package name`, { package: name }))
    return this.change(async (dir) => {
      if ((await manifestDependencies(dir))[name] === undefined) throw new KitError('not-found', `the kit has no extra ${name}`, { package: name })
      const run = await this.pnpmIn(dir, ['remove', name], CHANGE_LIMIT_MS)
      if (!passed(run)) throw this.changeError(run, name)
      return `removed ${name}`
    })
  }

  /** The kit version, the core with the versions of the app, and the extras with their versions. */
  async read(): Promise<KitState> {
    await this.started
    return this.readNow()
  }

  private async readNow(): Promise<KitState> {
    const status = this.availability.available ? { available: true } : { available: false, reason: this.availability.reason }
    const version = await this.currentVersion().catch(() => undefined)
    const core: KitPackage[] = []
    for (const name of CORE) {
      const folder = this.core?.[name]
      const found = folder === undefined ? undefined : await readFile(join(folder, 'package.json'), 'utf8').then((text) => (JSON.parse(text) as { version?: unknown }).version, () => undefined)
      core.push({ name, version: typeof found === 'string' ? found : 'unknown' })
    }
    const extras: KitPackage[] = []
    if (version !== undefined) {
      for (const [name, spec] of Object.entries(await manifestDependencies(this.versionDir(version)))) {
        if (!isCore(name)) extras.push({ name, version: spec })
      }
    }
    return { version, ...status, core, extras }
  }

  /**
   * The real folder of each core package and of each extra of the current version, for the page gates (`kit.gates`).
   * @throws {KitError} `kit-unavailable` when the kit can not be made whole offline.
   */
  async folders(): Promise<KitFolders> {
    await this.started
    if (!this.availability.available) throw new KitError('kit-unavailable', `the widget kit is unavailable: ${this.availability.reason}`)
    const version = await this.currentVersion()
    if (version === undefined || this.core === undefined) throw new KitError('kit-unavailable', 'the widget kit has no version')
    const dir = this.versionDir(version)
    const extras: Record<string, string> = {}
    for (const name of Object.keys(await manifestDependencies(dir))) {
      if (!isCore(name)) extras[name] = await realpath(join(dir, 'node_modules', name))
    }
    return { version, core: { ...this.core }, extras }
  }

  /** Stop the pnpm runs and wait for the start and the changes to end. */
  async stop(): Promise<void> {
    this.abort.abort()
    await this.started
    await this.queue
  }
}

export function apply(ctx: Context, config: Config = {}): void {
  let pnpm: PnpmCommand | Error
  try {
    pnpm = ctx.get('profileContext')?.packageManager ?? repositoryPnpm()
  } catch (error) {
    pnpm = error instanceof Error ? error : new Error(String(error))
  }
  const kit = new KitService(ctx, {
    dir: config.dir ?? dshHomePath('deepwidgets', 'kit'),
    settingsFile: config.settingsFile ?? dshHomePath('deepwidgets', 'settings.json'),
    pnpm,
  })
  ctx.effect(() => () => kit.stop(), 'kit: the pnpm runs of the widget kit')
}
