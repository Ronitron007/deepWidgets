/**
 * The agent-row gate (`safe_host.hmr` in `docs/specs/safe-host.md`).
 *
 * The profile boot (`apps/cli/src/profile-boot.ts`) installs the gate before any config-tree entry mounts. The gate
 * wraps `init` of each Loader entry whose row id is `deepwidgets-agent-*`. `init` imports the module of the row, which
 * runs its top-level code. The gate holds these loads until the widget runtime opens it, after the watchdog starts.
 * Then it loads the agent rows one at a time. A load runs in the blame store of the row, with the row in the running
 * slot of the watchdog, so a loop or a throw in the top-level code of the row is blamed on it.
 *
 * A quarantined agent row loads a stub in place of its module, so its code does not run, and it shows as failed.
 *
 * In safe mode, the gate does not load agent rows. Each other row loads as before.
 *
 * This module imports no other module of the package, so the profile boot can load it before the widget runtime. The
 * state is on `globalThis` under {@link GATE}, so two copies of this module share one gate.
 * @module @deepwidgets/widgets/gate
 */
import { AsyncResource } from 'node:async_hooks'

/** The Loader row ids of agent bundles (`widget_phase2.creation.rows`). */
const AGENT_ROW = /^deepwidgets-agent-/
/** The Host environment key of safe mode. It is `SAFE_MODE_ENV` of the runtime. */
const SAFE_MODE_ENV = 'DEEPWIDGETS_SAFE_MODE'
const GATE: unique symbol = Symbol.for('deepwidgets.agent.gate')
/** A load holds the next agent load for at most this time. The load itself goes on. */
export const AGENT_LOAD_LIMIT_MS = 5_000

/** The part of a Loader entry that the gate reads. */
export interface GateEntry {
  /** The entry id, with the ids of its groups in front. */
  readonly id: string
  readonly options: { readonly id?: unknown }
  readonly fiber?: unknown
  readonly disabled?: boolean
  readonly parent?: { readonly tree?: GateTree }
  init: (this: GateEntry) => Promise<void>
}

/** The part of a Loader entry tree that the gate wraps. */
interface GateTree {
  readonly store?: Record<string, unknown>
  import: (this: GateTree, name: string, getOuterStack?: () => string[]) => unknown
}

/** What the widget runtime gives the gate when it opens it. */
export interface GateOpener {
  /** The reason when the agent row `entry` is quarantined. Then it loads a stub in place of its module. */
  held(entry: GateEntry): string | undefined
  /** Run `load` as the load of the agent row `entry`: in its blame store, with the row in the running slot. */
  run(entry: GateEntry, load: () => Promise<void>): Promise<void>
  /** Safe mode refused the agent row `entry`. */
  refused(entry: GateEntry): void
}

interface GateState {
  opener: GateOpener | undefined
  /** The loads that wait for the gate to open. */
  held: Array<() => void>
  /** The agent rows that safe mode refused. */
  refused: Map<string, GateEntry>
  /** The end of the last agent load, so loads run one at a time. */
  chain: Promise<void>
  /** The module names of the agent rows that the gate did not load yet, with the reason. */
  blocked: Map<string, string>
  /** The module names of the quarantined agent rows that load now, with the stub that the tree gives in place. */
  stubs: Map<string, { default: { name: string, apply: () => void } }>
  /** The trees whose `import` the gate wraps. */
  trees: WeakSet<object>
}

function state(): GateState {
  const registry = globalThis as { [GATE]?: GateState }
  const found = registry[GATE]
  if (found !== undefined) return found
  const created: GateState = { opener: undefined, held: [], refused: new Map(), chain: Promise.resolve(), blocked: new Map(), stubs: new Map(), trees: new WeakSet() }
  registry[GATE] = created
  return created
}

/** Whether the entry id `id` (the row id, with no group ids) is the id of an agent row. */
const agentId = (id: unknown): boolean => typeof id === 'string' && AGENT_ROW.test(id)

/** Whether `entry` is still a live entry of its tree that is on and has no fiber. */
function loadable(entry: GateEntry): boolean {
  const id = entry.options.id
  const store = entry.parent?.tree?.store
  return entry.fiber === undefined && entry.disabled !== true && (store === undefined || typeof id !== 'string' || store[id] === entry)
}

/** Load `entry` after the loads before it. A load holds the next one for at most {@link AGENT_LOAD_LIMIT_MS}. */
function load(gate: GateState, entry: GateEntry, init: () => Promise<void>): Promise<void> {
  const opener = gate.opener
  if (opener === undefined) return init()
  const name = nameOf(entry)
  const task = gate.chain.then(async () => {
    if (!loadable(entry)) return
    if (name !== undefined) gate.blocked.delete(name)
    if (name === undefined || opener.held(entry) === undefined) return opener.run(entry, init)
    gate.stubs.set(name, { default: { name: `deepwidgets-quarantined:${name}`, apply: () => {} } })
    try {
      await init()
    } finally {
      gate.stubs.delete(name)
    }
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  gate.chain = Promise.race([
    task.then(() => undefined, () => undefined),
    new Promise<void>((resolve) => { timer = setTimeout(resolve, AGENT_LOAD_LIMIT_MS).unref() }),
  ]).finally(() => { clearTimeout(timer) })
  return task
}

const nameOf = (entry: GateEntry): string | undefined => {
  const name = (entry.options as { name?: unknown }).name
  return typeof name === 'string' ? name : undefined
}

/**
 * The startup audit of the Loader imports each entry with no fiber, to report its import error (packages/boot/app-boot).
 * That import would run the top-level code of an agent row that the gate holds. So the tree refuses it.
 */
function wrapTree(gate: GateState, tree: GateTree | undefined): void {
  if (tree === undefined || gate.trees.has(tree)) return
  gate.trees.add(tree)
  const original = tree.import
  tree.import = function (this: GateTree, name: string, getOuterStack?: () => string[]) {
    const stub = gate.stubs.get(name)
    if (stub !== undefined) return Promise.resolve(stub)
    const reason = gate.blocked.get(name)
    if (reason !== undefined) return Promise.reject(new Error(`the agent-row gate does not load ${name}: ${reason}`))
    return original.call(this, name, getOuterStack)
  }
}

/** The listener of `loader/entry-init`: wrap `init` of the entry. */
function wrapEntry(entry: GateEntry): void {
  const init = entry.init
  entry.init = function (this: GateEntry) {
    if (!agentId(this.options.id)) return init.call(this)
    const gate = state()
    wrapTree(gate, this.parent?.tree)
    const name = nameOf(this)
    if (process.env[SAFE_MODE_ENV] === '1') {
      if (name !== undefined) gate.blocked.set(name, 'safe mode')
      gate.refused.set(this.id, this)
      gate.opener?.refused(this)
      return Promise.resolve()
    }
    if (gate.opener !== undefined) return load(gate, this, () => init.call(this))
    if (name !== undefined) gate.blocked.set(name, 'it waits for the widget runtime')
    // Held: the Loader does not wait for the load, so a row that waits for the runtime does not stop the boot.
    // The load runs later in the async context of this call.
    gate.held.push(AsyncResource.bind(() => {
      load(gate, this, () => init.call(this)).catch((error: unknown) => {
        process.stderr.write(`deepwidgets: the agent row ${this.id} did not load: ${String(error)}\n`)
      })
    }))
    return Promise.resolve()
  }
}

/** The part of a Cordis context that the gate uses. */
interface GateContext {
  on(name: 'loader/entry-init', listener: (entry: GateEntry) => void): unknown
}

/** Install the gate on the host context. The profile boot calls it before any config-tree entry mounts. */
export function installAgentGate(ctx: GateContext): void {
  ctx.on('loader/entry-init', wrapEntry)
}

/**
 * Open the gate: the held agent rows load, one at a time. Later agent loads run at once, one at a time.
 * @returns the function that closes the gate again. Agent loads after it wait for the next open.
 */
export function openAgentGate(opener: GateOpener): () => void {
  const gate = state()
  gate.opener = opener
  for (const entry of gate.refused.values()) opener.refused(entry)
  for (const release of gate.held.splice(0)) release()
  return () => {
    if (gate.opener === opener) gate.opener = undefined
  }
}
