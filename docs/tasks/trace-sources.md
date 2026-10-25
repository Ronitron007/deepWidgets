# Task `trace.sources`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `trace.sources.goal`

Add the client half of the bundle `@deepwidgets/trace`. Make Electron main send its start-up steps. The spec is `docs/specs/floating-widget.md` (spec `floating_widget`). The plan row is `trace.sources` in `docs/plans/floating-widget.md`. The board `docs/canvas/floating-widget-processes.canvas` shows the processes and the message paths.

The client half runs in the main window page, in the Cordis `client` Context. It does these things:

- It makes one snapshot message for each client row and each service that already exists.

- It listens to the Cordis events `internal/status` and `internal/service`, and makes one message for each change.

- It rescans the Loader rows to find each row that stays `pending` after the snapshot.

- It sends its messages to `POST /api/trace`, one `POST` at a time.

Electron main records four steps of `floating_widget.sources.steps`: `app-ready`, `main-window-open`, `host-started`, and `host-ready`. It posts them to `POST /api/trace` of the host. The step `trace-window-open` comes in `trace.window`. Do not add it here.

In this task, the "trace test" is the command `DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs`. The unit `trace.host` added it. This unit adds rules to it. Then the trace test also needs messages from `main` and `client`. It also needs each step of this unit, and a `client` message for each client row.

The "client row check" is the new command `node tools/trace-client-rows.mjs`. It runs the client half in a small Cordis tree, with no app. It is the client copy of the late row check `node tools/trace-late-row.mjs`.

The host half does not change in this unit. Do not change `deepwidgets/trace/index.js`.

## Setup `trace.sources.setup`

| Item | Value |
|---|---|
| Base | `origin/main` at `5ff963e95df758015eaf946761128b2c331925dd` |
| Branch | `rohan/trace-sources` |
| Worktree | `~/deepWidgets/.worktrees/rohan-trace-sources` |
| Temporary files | `$TMPDIR/deepwidgets-trace-sources/` |
| Machine | This Mac, with a display. The trace test opens app windows. |

```bash
git -C ~/deepWidgets fetch origin
git -C ~/deepWidgets merge-base --is-ancestor 5ff963e9 origin/main ; echo "base exit=$?"   # must print base exit=0
git -C ~/deepWidgets diff --name-only 5ff963e9 origin/main                              # read the output
git -C ~/deepWidgets worktree add -b rohan/trace-sources .worktrees/rohan-trace-sources origin/main
mkdir -p "$TMPDIR/deepwidgets-trace-sources"
```

If the `merge-base` command does not print `base exit=0`, stop.

The `diff` command lists the files that changed after the base. Use these rules:

- If it prints nothing, continue.

- If each path is under `docs/` or `deepwidgets/trim/`, or is a file in `trace.sources.trim`, continue. Then follow `trace.sources.trim`.

- If it prints another path, stop and report the list.

## Read first `trace.sources.read`

Read the spec `docs/specs/floating-widget.md`, all of it. The sections `floating_widget.sources`, `floating_widget.sources.steps`, `floating_widget.sources.late_rows`, `floating_widget.message`, and `floating_widget.names` are the contract of this unit.

Then read the code in this table. Each row gives a fact that this task uses. The architect read each row at the base `5ff963e9`.

| Code | Fact |
|---|---|
| `deepwidgets/trace/index.js` | The host half. The client half copies its state words, `pluginDetail`, snapshot, listeners, rescan, and error handling. The function `receive` rejects a whole batch when one item is bad. It needs a `window` that is a string and not empty for each `client` item. |
| `deepwidgets/probe/client.js` and `deepwidgets/probe/package.json` | The form of a client half: `window.__ModuleLoader__.load({ id, factory })`, the `./client` export, and `dsh.client`. |
| `packages/client/modules/src/index.ts`, `resolveMeta` and `reconcilePackage` | `resolveMeta` reads `dsh.client` and `exports["./client"]` from the package file. `reconcilePackage` reads the `./client` file with `readFileSync` when the host makes the boot graph. Thus a change to `client.js` needs no build. The next app start reads the new text. |
| `vendor/cordis/src/events.ts`, `on` and `register` | `ctx.on` adds the listener as an effect of the current fiber. Thus Cordis removes the listener when the plugin stops. |
| `packages/client/modules/src/index.ts`, `processOne` | A disabled host row, or a host row with no fiber, gives no client row. Thus `DEEPWIDGETS_TRACE=off` also turns off the client half. |
| `packages/client/modules/src/index.ts`, the row `name: '__DSH_BOOT__'` | The page gets the boot graph as `window.__DSH_BOOT__`. Each `entries` item has an `id`, which is a package name (`WebBootEntry` in `packages/client/modules/src/client/manifest.ts`). |
| `packages/client/modules/src/client/entries.ts`, `ClientEntries.create` | The page makes one Loader row for each boot entry with `loader.create({ name: id })`. Thus the row key of a client row is `entry.options.name`. The ids of these rows are random. |
| `packages/client/web/src/boot-client.ts`, `bootClient` | The `client` Context is `ctx.plugin(Loader)` on a new root Context. It has no `cordis:include` row. |
| `vendor/cordis/src/context.ts` and `vendor/cordis/src/logger.ts` | Each Context has `ctx.logger`, also in the page. `ctx.logger.warn` exists on the service. |
| `apps/desktop/src/main.ts`, `main` | `app.whenReady().then(main)` calls `main`. |
| `apps/desktop/src/main.ts`, the host factory in `new DesktopBackendController` | `start` calls `host.start()`. `DesktopHostProcess.start()` in `apps/desktop/src/host-process.ts` spawns the host at once, before its first `await`. Then `start` sets `hostCookie` and `hostUrl`. |
| `apps/desktop/src/main.ts`, the state callback that `new DesktopBackendController` gets | This callback gets each backend state: `starting`, `ready`, or `error`. `DesktopBackendController.start` in `apps/desktop/src/backend-controller.ts` publishes `ready` after the factory `start` returns. |
| `apps/desktop/src/main.ts`, `reconcileBackend` | It runs `await navigateMain(applicationUrl)`, then `backend.start(...)`. Thus the main window page loads before the host starts. |
| `apps/desktop/src/main.ts`, the `DESKTOP_IPC.boot` handler | It awaits `startup`. Thus the page starts its `client` Context only after the host is ready. |
| `apps/desktop/src/web-document.ts`, `authenticateWebHost` and `forwardWebRequest` | Electron main already sends requests to the host with Node `fetch` and the host cookie. |
| `packages/client/connection/src/api-request-trust.ts`, `isTrustedApiRequest` | A request with a loopback `Host` header and no `Origin` header passes the fence. Node `fetch` sends such a request. |
| `tools/trace-late-row.mjs` | The model of the client row check. |
| `tools/smoke-desktop.mjs`, `traceReadExpression`, `traceReason`, and `checkTrace` | The trace test of `trace.host`. |

## Steps `trace.sources.steps`

Copy each code block in this file exactly. Do not change its comments or its line breaks. The steps in `trace.sources.check` find lines by their text.

### Change the package file `trace.sources.steps.package`

Replace all of `deepwidgets/trace/package.json` with this text. The changes are the `./client` export and `dsh.client`. They are the same as in `deepwidgets/probe/package.json`, but with no `inject`, because the client half needs no client package.

```json
{
  "name": "@deepwidgets/trace",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "immediately": true
    }
  }
}
```

### Write the client half `trace.sources.steps.client_half`

Write `deepwidgets/trace/client.js` with this text.

```js
window.__ModuleLoader__.load({
  id: '@deepwidgets/trace',
  factory() {
    const STATES = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']

    function apply(ctx) {
      const windowName = new URLSearchParams(location.search).get('window') || 'main'
      const queue = []
      const seen = new WeakSet()
      const serviceState = new Map()
      let stopped = false
      let scheduled = false
      let sending = false

      function rowKey(entry) {
        return entry.options.name
      }

      function pluginDetail(entry, fiber) {
        const name = entry.options.name ?? ''
        if (fiber.state !== 0) return name
        const missing = Object.keys(fiber.inject).filter((service) => fiber.ctx.get(service) === undefined).sort()
        if (missing.length === 0) return name
        return `${name} waits for ${missing.join(',')}`
      }

      function flush() {
        if (stopped || sending || queue.length === 0) return
        const batch = queue.splice(0, queue.length)
        sending = true
        fetch('api/trace', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(batch),
        }).then((response) => {
          if (!stopped && !response.ok) ctx.logger.warn(`deepwidgets-trace: POST api/trace answered ${response.status}`)
        }, (error) => {
          if (!stopped) ctx.logger.warn('deepwidgets-trace: POST api/trace failed', error)
        }).finally(() => {
          sending = false
          flush()
        })
      }

      function sendLater() {
        scheduled = false
        flush()
      }

      function addMessage(fields) {
        const message = { time: Date.now(), process: 'client', window: windowName, kind: fields.kind, name: fields.name, state: fields.state }
        if (typeof fields.detail === 'string' && fields.detail !== '') message.detail = fields.detail
        if (fields.snapshot === true) message.snapshot = true
        queue.push(message)
        if (scheduled) return
        scheduled = true
        queueMicrotask(sendLater)
      }

      function addPlugin(entry, fiber, snapshot) {
        const name = rowKey(entry)
        if (typeof name !== 'string' || name === '') return
        addMessage({
          kind: 'plugin',
          name,
          state: STATES[fiber.state],
          detail: pluginDetail(entry, fiber),
          snapshot: snapshot === true,
        })
        seen.add(fiber)
      }

      function addService(name, state, snapshot) {
        addMessage({ kind: 'service', name, state, snapshot: snapshot === true })
      }

      function rescan() {
        for (const entry of ctx.loader.entries()) {
          if (entry.options.name === 'cordis:include') continue
          if (!entry.fiber) continue
          if (seen.has(entry.fiber)) continue
          addPlugin(entry, entry.fiber, false)
        }
      }

      ctx.effect(() => () => {
        stopped = true
      }, 'deepwidgets-trace: client sender')

      for (const entry of ctx.loader.entries()) {
        if (entry.options.name === 'cordis:include') continue
        if (!entry.fiber) continue
        addPlugin(entry, entry.fiber, true)
      }

      for (const name of Object.keys(ctx.reflect.props)) {
        if (ctx.reflect.props[name]?.type !== 'service') continue
        const state = ctx.reflect.get(name) !== undefined ? 'up' : 'down'
        serviceState.set(name, state)
        addService(name, state, true)
      }

      ctx.on('internal/status', (fiber) => {
        try {
          if (fiber.entry === undefined) return
          if (fiber.parent?.fiber?.entry === fiber.entry) return
          if (fiber.entry.options.name === 'cordis:include') return
          addPlugin(fiber.entry, fiber, false)
        } catch (error) {
          ctx.logger.warn('deepwidgets-trace: internal/status failed', error)
        }
      })

      ctx.on('internal/service', function (name, value) {
        try {
          if (name === 'loader') rescan()
          const state = value !== undefined ? 'up' : 'down'
          if (serviceState.get(name) === state) return
          serviceState.set(name, state)
          addService(name, state, false)
        } catch (error) {
          ctx.logger.warn('deepwidgets-trace: internal/service failed', error)
        }
      })

      ctx.loader.await().then(() => {
        try {
          if (stopped) return
          rescan()
        } catch (error) {
          ctx.logger.warn('deepwidgets-trace: loader.await failed', error)
        }
      })
    }

    return { inject: ['loader'], apply }
  },
})
```

The client half differs from the host half only in these parts:

- `rowKey` returns `entry.options.name`. The reason is in `floating_widget.names`.

- `addPlugin` skips a row whose key is not a string with text. The reason: the host rejects the whole batch for one bad item.

- Each message has `process` `client` and the field `window`. The value comes from the query parameter `window` of the page URL, read one time. When the parameter is absent or empty, the value is `main`. The reason is in `floating_widget.sources`.

- The client half keeps no message list and serves no route. It puts each message in `queue`. A microtask sends all messages that wait in one `POST`. Only one `POST` runs at a time. When it ends, `flush` sends the messages that came while it ran. Thus the host gets the messages in their order.

- When a `POST` fails, the client half writes a warning and drops that batch. It does not try again. A `POST` fails when the host stops. For a new host, Electron main loads the page again (`publishUpdate` in `apps/desktop/src/main.ts`), and the new page sends a new snapshot. When the host fails, Electron main shows the recovery dialog (`reportFatal`).

- `inject` is only `['loader']`. The page has no `webServer` and no `connection` service for this plugin.

The code keeps the skip test for `cordis:include` of the host half. The `client` Context has no such row, so the test has no effect. It keeps the two halves the same.

When the plugin stops, Cordis disposes the two `ctx.on` listeners with the fiber. The `ctx.effect` sets `stopped`, so `flush` sends no new `POST` and no warning comes after the stop. The code has no timer. A `POST` that runs at the stop ends by itself.

Look Before You Build: the client half copies code from the host half. It cannot import it. The client half is a browser script with no build step, and its `factory` gets only the module table. Write this reason in one line in the PR body.

### Write the Electron main module `trace.sources.steps.main_module`

Write `apps/desktop/src/deepwidgets-trace.ts` with this text.

```ts
/**
 * deepWidgets trace: the start-up steps of Electron main for `POST /api/trace`.
 * The spec is `floating_widget.sources` in `docs/specs/floating-widget.md`.
 * @module deepwidgets-trace
 */

/** Names of the start-up steps that Electron main sends. */
export type DesktopTraceStepName = 'app-ready' | 'host-started' | 'host-ready' | 'main-window-open'

/** One `step` message of `floating_widget.message`, before the Host sets its `seq`. */
interface DesktopTraceStep {
  readonly time: number
  readonly process: 'main'
  readonly kind: 'step'
  readonly name: DesktopTraceStepName
  readonly state: 'done'
}

/** The ready Host that receives the steps. */
interface DesktopTraceTarget {
  readonly url: string
  readonly cookie: string
}

/**
 * Post one batch to `POST /api/trace` of the Host. A failure writes one warning and never rejects.
 * @param target - Host URL and Host cookie.
 * @param batch - steps in record order.
 */
async function sendSteps(target: DesktopTraceTarget, batch: readonly DesktopTraceStep[]): Promise<void> {
  try {
    const response = await fetch(new URL('/api/trace', target.url), {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: target.cookie },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(5000),
    })
    await response.body?.cancel()
    if (!response.ok) console.warn(`deepwidgets-trace: POST /api/trace answered ${String(response.status)}`)
  } catch (error) {
    console.warn('deepwidgets-trace: POST /api/trace failed', error)
  }
}

/**
 * Keep each start-up step, and post the steps to the ready Host in record order.
 * Each Host that becomes ready gets all kept steps, so a restarted Host also gets them.
 */
export class DesktopTraceSteps {
  private readonly steps: DesktopTraceStep[] = []
  private target: DesktopTraceTarget | undefined
  private queue: Promise<void> = Promise.resolve()

  /**
   * Record one step. Post it at once when a Host is ready.
   * @param name - step name.
   */
  step(name: DesktopTraceStepName): void {
    const step: DesktopTraceStep = { time: Date.now(), process: 'main', kind: 'step', name, state: 'done' }
    this.steps.push(step)
    if (this.target !== undefined) this.post(this.target, [step])
  }

  /**
   * Record `host-ready`, then post every kept step to this Host.
   * @param url - Host URL from the ready event.
   * @param cookie - Host cookie from `authenticateWebHost`.
   */
  hostReady(url: string, cookie: string): void {
    this.target = undefined
    this.step('host-ready')
    this.target = { url, cookie }
    this.post(this.target, [...this.steps])
  }

  /** Stop posting until the next Host is ready. */
  hostGone(): void {
    this.target = undefined
  }

  private post(target: DesktopTraceTarget, batch: readonly DesktopTraceStep[]): void {
    this.queue = this.queue.then(() => sendSteps(target, batch))
  }
}
```

These are the reasons for the design:

- The host URL has the launch token in its query. `new URL('/api/trace', target.url)` drops the query. Thus no step sends the token.

- Node `fetch` sets the `Host` header to the loopback address and sends no `Origin` header. Thus the request passes the fence of `client-connection`. The host cookie passes its cookie check.

- `sendSteps` never rejects. The reason: an unhandled rejection in Electron main shows an error dialog (`floating_widget.sources.steps`). Each `POST` stops after 5 seconds, so a host that does not answer cannot stop the queue.

- The `queue` chain sends one batch at a time. Thus the host gets the steps in their record order.

- When the trace row is off, each `POST` answers 404. Electron main writes one warning for each batch, and the app keeps working.

### Change Electron main `trace.sources.steps.main`

Make these five insertions in `apps/desktop/src/main.ts`. Do not change or delete a line that is there.

1. After the line `import { DesktopBackgroundNotice } from './background-notice.ts'`, insert these four lines:

   ```ts
   import { DesktopTraceSteps } from './deepwidgets-trace.ts'

   /** deepWidgets trace: the start-up steps for `POST /api/trace` (`floating_widget.sources`). */
   const traceSteps = new DesktopTraceSteps()
   ```

2. After the line `async function main(): Promise<void> {`, insert this line:

   ```ts
     traceSteps.step('app-ready')
   ```

3. In the host factory, the object has `start: async () => {`. Before its first line `const ready = await host.start()`, insert this line:

   ```ts
           traceSteps.step('host-started')
   ```

4. Find the backend state callback. It starts with the line `}, (state) => {`, and its next line is `if (state.phase === 'error') reportFatal(state.failure, 'host')`. Before that next line, insert these two lines:

   ```ts
       if (state.phase === 'ready' && hostUrl !== undefined && hostCookie !== undefined) traceSteps.hostReady(hostUrl, hostCookie)
       if (state.phase !== 'ready') traceSteps.hostGone()
   ```

5. In `reconcileBackend`, after the line `await navigateMain(applicationUrl)` that follows `startup ??= (async () => {`, insert this line:

   ```ts
         traceSteps.step('main-window-open')
   ```

Each insertion has the same indentation as the line after it. Then run these commands:

```bash
git diff --numstat 5ff963e9 -- apps/desktop/src/main.ts | tr '\t' ' '   # must print "9 0 apps/desktop/src/main.ts"
git grep -c traceSteps -- apps/desktop/src/main.ts                       # must print "apps/desktop/src/main.ts:6"
```

If an output is different, stop and report it.

Each `traceSteps.step` call has its own line. `trace.sources.check` turns off the line of `main-window-open`, to prove that the trace test needs each step.

### Install `trace.sources.steps.install`

This unit adds no dependency. Thus the lockfile does not change.

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack pnpm --version                          # must print 11.28.5
corepack pnpm install --frozen-lockfile          # must exit 0
git status --short pnpm-lock.yaml                # must print nothing
```

If the folder `apps/desktop/node_modules/electron/dist` does not exist, use the Electron fallback from `fork.baseline.steps.install`. Record that you used it. Then run the Git hook checks from `fork.baseline.steps.install`. Each check must give its expected output.

### Build `trace.sources.steps.build`

```bash
corepack pnpm run build:artifacts
corepack pnpm --filter @deepseek-ai/dsh-desktop run build
```

Record the time of each command. The desktop build runs `tsc -b` before it bundles. Thus it also checks the types of `apps/desktop/src/deepwidgets-trace.ts`.

### Add the client row check `trace.sources.steps.client_check`

Write `tools/trace-client-rows.mjs` with this text.

```js
import { Context } from '../vendor/cordis/lib/index.js'
import Loader from '../vendor/loader/lib/index.js'
import * as trace from '../deepwidgets/trace/index.js'

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

let finished = false
const timeout = setTimeout(() => {
  if (finished) return
  console.log('trace-client-rows: fail: timeout')
  process.exit(1)
}, 10_000)

function finish(line, code) {
  finished = true
  clearTimeout(timeout)
  console.log(line)
  process.exit(code)
}

function seqOk(list) {
  return list.every((message, index) => message.seq === index + 1)
}

function clientOnly(list) {
  return list.filter((message) => message.process === 'client')
}

function goodPending(list, id) {
  return list.some((message) => message.kind === 'plugin'
    && message.name === `cordis:${id}`
    && message.state === 'pending'
    && message.detail === `cordis:${id} waits for deepwidgets-missing`
    && !Object.hasOwn(message, 'snapshot'))
}

function snapshotLoader(list) {
  return list.some((message) => message.kind === 'service'
    && message.name === 'loader'
    && message.state === 'up'
    && message.snapshot === true)
}

function liveService(list, name) {
  return list.some((message) => message.kind === 'service'
    && message.name === name
    && message.state === 'up'
    && !Object.hasOwn(message, 'snapshot'))
}

function liveActive(list, id) {
  return list.some((message) => message.kind === 'plugin'
    && message.name === `cordis:${id}`
    && message.state === 'active'
    && message.detail === `cordis:${id}`
    && !Object.hasOwn(message, 'snapshot'))
}

async function readStream(route) {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, 200)
  const messages = []
  try {
    const response = await route.fetch(new Request('http://127.0.0.1/api/trace', { signal: controller.signal }))
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      let step
      try {
        step = await reader.read()
      } catch (error) {
        if (error?.name === 'AbortError') break
        throw error
      }
      if (step.done) break
      buffer += decoder.decode(step.value, { stream: true })
      let split = buffer.indexOf('\n\n')
      while (split !== -1) {
        const frame = buffer.slice(0, split)
        buffer = buffer.slice(split + 2)
        const line = frame.split('\n').find((item) => item.startsWith('data: '))
        if (line !== undefined) messages.push(JSON.parse(line.slice(6)))
        split = buffer.indexOf('\n\n')
      }
    }
  } finally {
    clearTimeout(timer)
  }
  return messages
}

try {
  const host = new Context()
  const routes = []
  host.provide('webServer', { register: () => () => {} })
  host.provide('connection', { fetch: { register: (route) => { routes.push(route); return async () => {} } } })
  await host.plugin(Loader).await()
  await host.plugin(trace).await()
  if (routes.length !== 1) finish('trace-client-rows: fail: no trace route', 1)

  const statuses = []
  let loaded
  globalThis.window = { __ModuleLoader__: { load: (definition) => { loaded = definition } } }
  globalThis.location = { search: '?window=check' }
  globalThis.fetch = async (input, init) => {
    if (input !== 'api/trace') throw new Error(`trace-client-rows: unexpected fetch ${String(input)}`)
    const response = await routes[0].fetch(new Request('http://127.0.0.1/api/trace', init))
    statuses.push(response.status)
    return response
  }
  await import('../deepwidgets/trace/client.js')
  if (loaded?.id !== '@deepwidgets/trace') finish('trace-client-rows: fail: no client module', 1)

  const ctx = new Context()
  await ctx.plugin(Loader).await()
  const loader = ctx.get('loader')
  const late = Promise.withResolvers()
  const broken = Promise.withResolvers()
  const late2 = Promise.withResolvers()
  loader.builtins.trace = loaded.factory()
  loader.builtins.late = late.promise
  loader.builtins.broken = broken.promise
  loader.builtins.late2 = late2.promise
  const boot = loader.root.update([
    { id: 'trace', name: 'cordis:trace' },
    { id: 'late', name: 'cordis:late' },
    { id: 'broken', name: 'cordis:broken' },
  ])
  const postWait = Date.now()
  while (statuses.length < 1) {
    if (Date.now() - postWait > 1000) finish('trace-client-rows: fail: no post', 1)
    await wait(10)
  }
  await wait(10)
  late.resolve({ inject: ['deepwidgets-missing'], apply() {} })
  await wait(10)
  broken.reject(new Error('trace-client-rows import failed'))
  await boot
  await loader.await()
  await wait(10)
  const first = await readStream(routes[0])
  const created = loader.create({ id: 'late2', name: 'cordis:late2' })
  await wait(10)
  late2.resolve({ inject: ['deepwidgets-missing'], apply() {} })
  await created
  await loader.await()
  await wait(10)
  const second = await readStream(routes[0])
  ctx.provide('deepwidgets-missing', {})
  await loader.await()
  await wait(10)
  const third = await readStream(routes[0])

  const bad = statuses.find((status) => status !== 200)
  const firstClient = clientOnly(first)
  const secondClient = clientOnly(second)
  const thirdClient = clientOnly(third)
  const wrongWindow = clientOnly(third).find((message) => message.window !== 'check')
  const lateCount = secondClient.filter((message) => message.kind === 'plugin' && message.name === 'cordis:late').length
  if (bad !== undefined) finish(`trace-client-rows: fail: post status ${String(bad)}`, 1)
  if (!seqOk(first) || !seqOk(second) || !seqOk(third)) finish('trace-client-rows: fail: seq out of order', 1)
  if (wrongWindow !== undefined) finish(`trace-client-rows: fail: client window ${String(wrongWindow.window)}`, 1)
  if (!snapshotLoader(firstClient)) finish('trace-client-rows: fail: no snapshot message for service loader', 1)
  if (!goodPending(firstClient, 'late')) finish('trace-client-rows: fail: no pending message for cordis:late', 1)
  if (!goodPending(secondClient, 'late2')) finish('trace-client-rows: fail: no pending message for cordis:late2', 1)
  if (lateCount !== 1) finish('trace-client-rows: fail: more than one message for cordis:late', 1)
  if (!liveService(thirdClient, 'deepwidgets-missing')) finish('trace-client-rows: fail: no live service message for deepwidgets-missing', 1)
  if (!liveActive(thirdClient, 'late')) finish('trace-client-rows: fail: no live active message for cordis:late', 1)
  finish('trace-client-rows: pass', 0)
} catch (error) {
  console.error(error)
  finished = true
  clearTimeout(timeout)
  process.exit(1)
}
```

The script makes two Cordis trees. The host tree runs the real host half with stub services, like the late row check. The client tree runs the client half with a Loader. The stub `fetch` sends each `POST` of the client half to the route of the host half. Thus each client message passes the real check of `POST /api/trace` and gets a `seq`. The script reads the stream of the host half, and it checks only the messages with `process` `client`.

The stub `location` has the query `?window=check`. Thus the script proves that the client half reads the parameter. The trace test proves the value `main` when the URL has no parameter.

The rows `late`, `broken`, and `late2` are the rows of the late row check. The row keys have no `name:` prefix, because a client row key is `entry.options.name`.

The script prints one result line on stdout. Then it exits with `process.exit`, because the ping timers of the host half keep the process alive. The first false rule in the code gives the result. When each rule is true, the result is `trace-client-rows: pass`, with exit code 0. Each fail line has exit code 1.

### Extend the trace test `trace.sources.steps.smoke`

Change `tools/smoke-desktop.mjs` in these five places. Change nothing else.

1. In the comment at the top, after the line about `DSH_SMOKE_TRACE=1`, insert this line:

   ```js
    * The trace test also needs the start-up steps of Electron main and a message for each client row.
   ```

2. In `traceReadExpression`, before the line `const pull = async (done) => {`, insert these six lines. They have no backtick and no `${`, so they need no escape in the template text.

   ```js
     const STEPS = ['app-ready', 'host-started', 'host-ready', 'main-window-open']
     const bootIds = () => (window.__DSH_BOOT__?.entries ?? []).map((entry) => entry.id)
     const hasStep = (name) => messages.some((message) => message.process === 'main' && message.kind === 'step' && message.name === name && message.state === 'done')
     const hasClientRow = (id) => messages.some((message) => message.process === 'client' && message.kind === 'plugin' && message.name === id)
     const hasClientLoader = () => messages.some((message) => message.process === 'client' && message.kind === 'service' && message.name === 'loader' && message.state === 'up')
     const hasSources = () => STEPS.every(hasStep) && bootIds().length > 0 && bootIds().every(hasClientRow) && hasClientLoader()
   ```

3. In `traceReadExpression`, change the line `await pull(hasClient)` to this line:

   ```js
           await pull(() => hasClient() && hasSources())
   ```

4. In the `finally` block of `traceReadExpression`, after the line `out.processes = processes`, insert these lines:

   ```js
       out.steps = STEPS.filter(hasStep)
       const windows = []
       for (const message of messages) {
         if (message.process !== 'client') continue
         if (typeof message.name === 'string' && message.name.startsWith('smoke-trace-')) continue
         if (!windows.includes(message.window)) windows.push(message.window)
       }
       out.clientWindows = windows
       const ids = bootIds()
       out.bootCount = ids.length
       out.clientMissing = ids.filter((id) => !hasClientRow(id))
       out.clientLoader = hasClientLoader()
   ```

5. In `traceReason`, after the rule that ends with `posted messages not in stream ...`, insert these five rules:

   ```js
       [['host', 'main', 'client'].every((name) => Array.isArray(result.processes) && result.processes.includes(name)), `processes ${String(result.processes)}`],
       [Array.isArray(result.steps) && result.steps.length === 4, `main steps ${String(result.steps)}`],
       [Array.isArray(result.clientWindows) && result.clientWindows.length === 1 && result.clientWindows[0] === 'main', `client windows ${String(result.clientWindows)}`],
       [result.bootCount > 0 && Array.isArray(result.clientMissing) && result.clientMissing.length === 0, `client rows missing ${String(result.clientMissing?.length)} of ${String(result.bootCount)}: ${String(result.clientMissing?.[0])}`],
       [result.clientLoader === true, 'no client service loader up'],
   ```

After the `POST` requests, the read now waits until the stream has these messages:

- A `step` message for each of the four steps.

- A `client` plugin message for each id in `window.__DSH_BOOT__.entries`.

- The `client` service `loader` in the state `up`.

The abort of the try after 10 seconds stops the wait. Then the rules give the reason, and `checkTrace` tries again until the deadline.

The new rules come after the rules of `trace.host`. Thus a run with `DEEPWIDGETS_TRACE=off` still fails with `status 404`. The `processes` rule gives the first reason when one source sends nothing. The rule for client rows also checks the row key. A client half with another key leaves each id without a message.

The rule `bootCount > 0` makes sure that the rule for client rows cannot pass with an empty list.

### Fill in `CLAUDE.md` `trace.sources.steps.head`

Change only these parts of the root `CLAUDE.md`:

1. In `head.status`, in the value of the row `Our packages`, change the text `(host half merged)` to `(host half and client half merged)`.

2. In `head.status`, add this sentence at the end of the value of the row `Checks`:

   ```markdown
   `tools/trace-client-rows.mjs` checks the client half with no app.
   ```

3. In `head.commands`, add `node tools/trace-client-rows.mjs` after the line `node tools/trace-late-row.mjs`.

### Merge with `trim.profile` `trace.sources.trim`

The unit `trim.profile` changes some of the same files. Use this section only when `trim.profile` is in `origin/main`, before you start or while your PR is open. To get its changes, run `git merge origin/main`. Do not rebase.

| File | Rule |
|---|---|
| `tools/smoke-desktop.mjs` | Keep the rows check and the trace test with the rules of this unit. The rows check must use the exact main page URL `dsh-app://app/`. |
| `CLAUDE.md` | Keep each line of both units in `head.commands`, and each change of both units in `head.status`. |
| `deepwidgets/trim/rows.client.txt` | Add the line `@deepwidgets/trace # trace.sources: the client half of the trace window`. The reason: the rows check compares this list with `window.__DSH_BOOT__.entries`, and the trace now has a client row. |
| `deepwidgets/trim/rows.host.txt` | Do not change it. It must have a line for `deepwidgets-trace`. If it has none, stop and report. |
| `pnpm-lock.yaml` | This unit does not change it. If Git shows a conflict, stop and report. |
| `apps/cli/package.json` | This unit does not change it. Keep the `origin/main` text. |
| `packages/util/official-bundles/src/bundles.ts` | This unit does not change it. Keep the `origin/main` text. |
| `docs/tasks/trim-profile.md` | Do not change it. |

After the merge, run `trace.sources.steps.install` and `trace.sources.steps.build` again.

The client half injects only `loader`. Thus a row that the trim turns off cannot keep the client half `pending`.

### Run the checks `trace.sources.check`

Run each command in the worktree. Capture each exit code.

```bash
node tools/trace-client-rows.mjs ; echo "client rows exit=$?"                                          # must print "trace-client-rows: pass" and exit=0
node tools/trace-late-row.mjs ; echo "late row exit=$?"                                                # must print "trace-late-row: pass" and exit=0
DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs ; echo "trace exit=$?"                                  # must print "smoke-desktop: pass" and exit=0
DSH_SMOKE_TRACE=1 DEEPWIDGETS_TRACE=off node tools/smoke-desktop.mjs ; echo "trace off exit=$?"        # must print "smoke-desktop: fail: trace: status 404" and exit=1
DEEPWIDGETS_TRACE=off node tools/smoke-desktop.mjs ; echo "smoke trace off exit=$?"                    # must print "smoke-desktop: pass" and exit=0
grep deepwidgets-trace: "$(ls -dt "$TMPDIR"/deepwidgets-smoke-desktop-* | head -1)/desktop.log" ; echo "warning exit=$?"   # must print "deepwidgets-trace: POST /api/trace answered 404" and exit=0
DSH_SMOKE_PROBE=1 DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs ; echo "probe trace exit=$?"          # must print "smoke-desktop: pass" and exit=0
DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs ; echo "probe exit=$?"                                  # must print "smoke-desktop: pass" and exit=0
node tools/smoke-desktop.mjs ; echo "smoke exit=$?"                                                    # must print "smoke-desktop: pass" and exit=0
DSH_SMOKE_TIMEOUT_MS=1000 node tools/smoke-desktop.mjs ; echo "short exit=$?"                         # must print "smoke-desktop: fail: renderer timeout" and exit=1
git diff --quiet 5ff963e9 -- deepwidgets/trace/index.js ; echo "host half exit=$?"                     # must print "host half exit=0"
git grep -c deepwidgets-trim -- packages/util/official-bundles/src/bundles.ts                          # must print packages/util/official-bundles/src/bundles.ts:1
```

The run `trace off` proves that the trace test can fail. `DEEPWIDGETS_TRACE=off` disables the trace host row. Thus `/api/trace` falls to the `/api` prefix of `client-connection`, which answers 404. The client half is also off (`trace.sources.read`, `processOne`).

The run `smoke trace off` proves that the app still works without the trace row. Electron main gets 404 for its `POST` and writes a warning. The `warning` command reads that warning in the log of this run. Thus run it directly after `smoke trace off`.

Each run of the trace test that must fail waits until the deadline, so it takes about 4 minutes.

If `trim.profile` is in your base, also run each line of `head.commands` in `CLAUDE.md` that sets `DSH_SMOKE_ROWS`. Each must print `smoke-desktop: pass` and exit 0.

Then prove that the client row check can fail. Do these steps in the worktree. After each `sed` command, run the `grep` command under it. It must print `1`. If it prints another number, stop and report.

1. Run `cp deepwidgets/trace/client.js "$TMPDIR/deepwidgets-trace-sources/client.js.keep"`.

2. Turn off the rescan call in the `internal/service` listener:

   ```bash
   sed -i '' "s|if (name === 'loader') rescan()|// &|" deepwidgets/trace/client.js
   grep -c "// if (name === 'loader') rescan()" deepwidgets/trace/client.js
   node tools/trace-client-rows.mjs ; echo "client rows no event exit=$?"     # must print "trace-client-rows: fail: no pending message for cordis:late2" and exit=1
   cp "$TMPDIR/deepwidgets-trace-sources/client.js.keep" deepwidgets/trace/client.js
   ```

3. Turn off the rescan call in the callback of `ctx.loader.await()`:

   ```bash
   sed -i '' 's|^          rescan()$|          // rescan()|' deepwidgets/trace/client.js
   grep -c '^          // rescan()$' deepwidgets/trace/client.js
   node tools/trace-client-rows.mjs ; echo "client rows no await exit=$?"     # must print "trace-client-rows: fail: no pending message for cordis:late" and exit=1
   cp "$TMPDIR/deepwidgets-trace-sources/client.js.keep" deepwidgets/trace/client.js
   ```

4. Turn off the add call in the `internal/status` listener:

   ```bash
   sed -i '' "s|addPlugin(fiber.entry, fiber, false)|// &|" deepwidgets/trace/client.js
   grep -c "// addPlugin(fiber.entry, fiber, false)" deepwidgets/trace/client.js
   node tools/trace-client-rows.mjs ; echo "client rows no status exit=$?"    # must print "trace-client-rows: fail: no live active message for cordis:late" and exit=1
   cp "$TMPDIR/deepwidgets-trace-sources/client.js.keep" deepwidgets/trace/client.js
   ```

5. Turn off the add call in the `internal/service` listener:

   ```bash
   sed -i '' "s|addService(name, state, false)|// &|" deepwidgets/trace/client.js
   grep -c "// addService(name, state, false)" deepwidgets/trace/client.js
   node tools/trace-client-rows.mjs ; echo "client rows no service exit=$?"   # must print "trace-client-rows: fail: no live service message for deepwidgets-missing" and exit=1
   cp "$TMPDIR/deepwidgets-trace-sources/client.js.keep" deepwidgets/trace/client.js
   ```

6. Read the wrong query parameter:

   ```bash
   sed -i '' "s|get('window')|get('window-off')|" deepwidgets/trace/client.js
   grep -c "get('window-off')" deepwidgets/trace/client.js
   node tools/trace-client-rows.mjs ; echo "client rows no window exit=$?"    # must print "trace-client-rows: fail: client window main" and exit=1
   cp "$TMPDIR/deepwidgets-trace-sources/client.js.keep" deepwidgets/trace/client.js
   ```

7. Turn off the send of the client half. Then run the client row check and the trace test. The node half reads `client.js` when it serves the bundle, so this step needs no build.

   ```bash
   sed -i '' "s|queueMicrotask(sendLater)|// &|" deepwidgets/trace/client.js
   grep -c "// queueMicrotask(sendLater)" deepwidgets/trace/client.js
   node tools/trace-client-rows.mjs ; echo "client rows no send exit=$?"                # must print "trace-client-rows: fail: no post" and exit=1
   DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs ; echo "trace no client exit=$?"      # must print "smoke-desktop: fail: trace: processes host,main" and exit=1
   cp "$TMPDIR/deepwidgets-trace-sources/client.js.keep" deepwidgets/trace/client.js
   ```

8. Run `cmp deepwidgets/trace/client.js "$TMPDIR/deepwidgets-trace-sources/client.js.keep" ; echo "client restore exit=$?"`. It must print `client restore exit=0`.

Then prove that the trace test needs each step of Electron main:

1. Run `cp apps/desktop/src/main.ts "$TMPDIR/deepwidgets-trace-sources/main.ts.keep"`.

2. Turn off the step `main-window-open`, then build and run the trace test:

   ```bash
   sed -i '' "s|traceSteps.step('main-window-open')|// &|" apps/desktop/src/main.ts
   grep -c "// traceSteps.step('main-window-open')" apps/desktop/src/main.ts
   corepack pnpm --filter @deepseek-ai/dsh-desktop run build ; echo "build no step exit=$?"   # must print "build no step exit=0"
   DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs ; echo "trace no step exit=$?"            # must print "smoke-desktop: fail: trace: main steps app-ready,host-started,host-ready" and exit=1
   ```

3. Copy the kept file back, and build again:

   ```bash
   cp "$TMPDIR/deepwidgets-trace-sources/main.ts.keep" apps/desktop/src/main.ts
   cmp apps/desktop/src/main.ts "$TMPDIR/deepwidgets-trace-sources/main.ts.keep" ; echo "main restore exit=$?"   # must print "main restore exit=0"
   corepack pnpm --filter @deepseek-ai/dsh-desktop run build ; echo "build exit=$?"                              # must print "build exit=0"
   ```

4. Run `node tools/trace-client-rows.mjs` and `DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs` again. Each must print its pass line and exit 0.

If a check gives a result that is not its expected result, use `tasks.protocol.stop`.

## Findings to record `trace.sources.findings`

Put these items in the `Findings` section of the PR body. Write "unknown" when you did not find out.

- The time of the install and of each build command.

- Whether you used the Electron fallback.

- The output of `git status --short pnpm-lock.yaml`.

- From the log of the trace test that passed: the fields `count`, `processes`, `steps`, `bootCount`, and `clientMissing`. The log is `desktop.log` in the newest folder `$TMPDIR/deepwidgets-smoke-desktop-*`, directly after the run `trace`. Its line `trace try=` holds the fields.

- The result line of each run that must fail.

- The output of the `warning` command in `trace.sources.check`.

- Whether you used `trace.sources.trim`, and each conflict that you resolved.

## Files you may change `trace.sources.files`

- `deepwidgets/trace/package.json` (only the text of `trace.sources.steps.package`)

- `deepwidgets/trace/client.js` (new)

- `apps/desktop/src/deepwidgets-trace.ts` (new)

- `apps/desktop/src/main.ts` (only the insertions of `trace.sources.steps.main`)

- `tools/trace-client-rows.mjs` (new)

- `tools/smoke-desktop.mjs` (only the parts in `trace.sources.steps.smoke`)

- `CLAUDE.md` (only the parts in `trace.sources.steps.head`)

- `deepwidgets/trim/rows.client.txt` (only when you use `trace.sources.trim`)

After the build, `git status --short` must show only these paths. If build outputs show up as untracked files, stop and report them. Do not add them to `.gitignore`.

## Done when `trace.sources.done`

- Each check command gives its expected output.

- `git status --short` shows only the paths in `trace.sources.files`.

- The PR is open against `main`. Its title is `trace.sources: add the trace client half and the start-up steps`.
