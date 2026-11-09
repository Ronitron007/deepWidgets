/**
 * The agent-row gate (`safe_host.hmr` in `docs/specs/safe-host.md`).
 *
 * The profile boot (`apps/cli/src/profile-boot.ts`) installs the gate before any config-tree entry mounts. The gate
 * wraps `init` of each Loader entry whose row id is `deepwidgets-agent-*`. `init` imports the module of the row, which
 * runs its top-level code. The gate holds these loads until the widget runtime opens it, after the watchdog starts.
 * Then each agent row loads in the blame store of the row. The running slot does not hold the row during the load,
 * because the slot never stays across an await. The native stack blames a loop in the top-level code, when it loads.
 *
 * A quarantined agent row loads a stub in place of its module, so its code does not run, and it shows as failed.
 * In safe mode, each agent row loads a stub too, and its slugs show as off. Each other row loads as before.
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

/** The part of a Loader entry that the gate reads. */
export interface GateEntry {
  /** The entry id, with the ids of its groups in front. */
  readonly id: string
  readonly options: { readonly id?: unknown, readonly name?: unknown }
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
  /** Run `load`, the load of the agent row `entry`. */
  run(entry: GateEntry, load: () => Promise<void>): Promise<void>
  /** Safe mode loaded a stub in place of these agent rows. The gate gives the rows of one turn together. */
  refused(entries: GateEntry[]): void
}

/** The module namespace that the tree gives in place of the module of a row. */
type StubModule = { default: { name: string, apply: () => void } }

interface GateState {
  opener: GateOpener | undefined
  /** The loads that wait for the gate to open. */
  held: Array<() => void>
  /** The agent rows that safe mode refused in this turn, for one call of `refused`. */
  refusing: GateEntry[]
  /** The module names of the agent rows that wait for the gate. The tree refuses to import them. */
  waiting: Set<string>
  /** The module names of the agent rows that load a stub now, with the stub. */
  stubs: Map<string, StubModule>
  /** The plugin functions of the stubs. */
  stubFns: WeakSet<object>
  /** The trees whose `import` the gate wraps. */
  trees: WeakSet<object>
}

function state(): GateState {
  const registry = globalThis as { [GATE]?: GateState }
  const found = registry[GATE]
  if (found !== undefined) return found
  const created: GateState = { opener: undefined, held: [], refusing: [], waiting: new Set(), stubs: new Map(), stubFns: new WeakSet(), trees: new WeakSet() }
  registry[GATE] = created
  return created
}

/** Whether the plugin function `fn` is the function of a stub of the gate. */
export function isGateStub(fn: unknown): boolean {
  return typeof fn === 'function' && state().stubFns.has(fn)
}

/** Whether the entry id `id` (the row id, with no group ids) is the id of an agent row. */
const agentId = (id: unknown): boolean => typeof id === 'string' && AGENT_ROW.test(id)

const nameOf = (entry: GateEntry): string | undefined => typeof entry.options.name === 'string' ? entry.options.name : undefined

/** Whether `entry` is still a live entry of its tree that is on and has no fiber. */
function loadable(entry: GateEntry): boolean {
  const id = entry.options.id
  const store = entry.parent?.tree?.store
  return entry.fiber === undefined && entry.disabled !== true && (store === undefined || typeof id !== 'string' || store[id] === entry)
}

/** Load a stub in place of the module of `entry`: the Loader gives the row a fiber, and no code of the row runs. */
async function loadStub(gate: GateState, name: string, init: () => Promise<void>): Promise<void> {
  const apply = (): void => {}
  gate.stubFns.add(apply)
  gate.stubs.set(name, { default: { name: `deepwidgets-stub:${name}`, apply } })
  try {
    await init()
  } finally {
    gate.stubs.delete(name)
  }
}

/** Safe mode refused `entry`. The rows of one turn go to the runtime in one call, so it logs them once. */
function refuse(gate: GateState, opener: GateOpener, entry: GateEntry): void {
  gate.refusing.push(entry)
  if (gate.refusing.length > 1) return
  queueMicrotask(() => {
    opener.refused(gate.refusing.splice(0))
  })
}

/** Load the agent row `entry` while the gate is open. */
async function load(gate: GateState, opener: GateOpener, entry: GateEntry, init: () => Promise<void>): Promise<void> {
  const name = nameOf(entry)
  if (name !== undefined) gate.waiting.delete(name)
  if (!loadable(entry)) return
  if (name !== undefined && process.env[SAFE_MODE_ENV] === '1') {
    refuse(gate, opener, entry)
    return loadStub(gate, name, init)
  }
  if (name !== undefined && opener.held(entry) !== undefined) return loadStub(gate, name, init)
  return opener.run(entry, init)
}

/**
 * The startup audit of the Loader imports each entry with no fiber, to report its import error (packages/boot/app-boot).
 * That import would run the top-level code of an agent row that waits for the gate. So the tree refuses it. While a
 * row loads a stub, the tree gives the stub.
 */
function wrapTree(gate: GateState, tree: GateTree | undefined): void {
  if (tree === undefined || gate.trees.has(tree)) return
  gate.trees.add(tree)
  const original = tree.import
  tree.import = function (this: GateTree, name: string, getOuterStack?: () => string[]) {
    const stub = gate.stubs.get(name)
    if (stub !== undefined) return Promise.resolve(stub)
    if (gate.waiting.has(name)) return Promise.reject(new Error(`the agent row ${name} waits for the widget runtime (the agent-row gate)`))
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
    const opener = gate.opener
    if (opener !== undefined) return load(gate, opener, this, () => init.call(this))
    const name = nameOf(this)
    if (name !== undefined) gate.waiting.add(name)
    // Held: the Loader does not wait for the load, so a row that waits for the runtime does not stop the boot.
    // The load runs later in the async context of this call.
    gate.held.push(AsyncResource.bind(() => {
      const current = gate.opener
      if (current === undefined) return
      load(gate, current, this, () => init.call(this)).catch((error: unknown) => {
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
 * Open the gate: the held agent rows load. Later agent loads run at once.
 * @returns the function that closes the gate again. Agent loads after it wait for the next open.
 */
export function openAgentGate(opener: GateOpener): () => void {
  const gate = state()
  gate.opener = opener
  for (const release of gate.held.splice(0)) release()
  return () => {
    if (gate.opener === opener) gate.opener = undefined
  }
}
