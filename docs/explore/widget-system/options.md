# Options for each open question `options`

Each section is a short decision record: the question, the options, the evidence, and a recommendation. The operator decides. Labels: "verified" (an agent ran or read it on 2026-10-27), "inferred", or "a guess".

## Runtime registry `options.registry`

Question: how does a widget tell the runtime that it exists?

| Option | For | Against |
|---|---|---|
| A. Service with `ctx.widgets.register(def)` inside the widget plugin | Same pattern as `ctx.tools.register` and `connection.fetch.register`. Cordis removes the widget when its plugin stops (verified). | Each widget is a plugin, also a pure data widget. |
| B. A widget is a config row that the runtime reads | No code for a data widget | An agent must write profile patch files. The DSH skill forbids this. |
| C. Widgets are data only, in storage | No plugin for each widget | A logic widget has no place for its code. |

Recommendation: A for logic widgets. Use storage records for data widgets that agents save with `widget_save` (see `options.creation`). Both end in the same `ctx.widgets` registry.

## Routes `options.routes`

Question: how does a window reach its widget?

| Option | For | Against |
|---|---|---|
| A. Three exact `connection.fetch` routes for each slug: `program`, `call`, `stream` | Cookie check and owner check from `connection`. A removed widget gives a clean 404 (verified). | Many routes. `connection.fetch` matches exact paths only (verified). |
| B. Fixed routes with the slug in the body | Few routes | A stream needs the slug in the URL. Errors are less clear. |
| C. One `webServer` prefix route | One route | It skips the cookie check and the Host and Origin check. Reject. |

Recommendation: A (built and verified in the runtime spike).

## Storage `options.storage`

Question: where do widget state and programs live, and how safe is a write?

| Option | For | Against |
|---|---|---|
| A. One `widgets` domain in `ctx.storageDomain`, json backend, whole state for each slug | Built. Atomic write: temp file, fsync, rename, directory fsync. 25 kills during writes gave no corrupt file (verified). | Each write rewrites the whole file in one queue: about 10 ms for each write, about 100 writes each second (verified). A corrupt file fails the whole domain. |
| B. One record for each slug (per-record layout) | A corrupt record reads as absent. The other widgets stay. | A corrupt record is a silent loss unless the runtime logs it and keeps a `.bad` copy. |
| C. sqlite backend of the storage domain | Faster small writes (inferred) | Not checked. |
| D. One domain for each widget | Writes in parallel (inferred) | More files. Not checked. |

Recommendation: A for v1. Add a sweep of the `.tmp` files at start: 9 were left after 25 kills (verified). Move to B or C when timers write often. Set a quota: state 256 KB, program 64 KB (a guess).

## Action contract `options.action_contract`

Question: what does a caller get when it runs an action?

The runtime spike, the MCP spike, and the reliability study agree on this contract (verified in parts, see each line):

- One queue for each slug. One action runs at a time. Different slugs run in parallel. In the MCP stub, 9 of 10 concurrent writes were lost without the queue (verified). The real runtime writes with an atomic `domain.update`, so the real risk is a handler that reads, waits, and then writes. A timer that calls `ctx.widgets.update` must also go through the queue.

- The runtime owns this contract, not the MCP layer. The window and the agent then get the same rules. The integration spike moves the queue into the runtime.

- Timeout: 5 to 10 s by default, 60 s at most. The handler gets an `AbortSignal`. A write after the timeout is refused (verified).

- A call that waits in the queue for more than 5 s gets `busy` and does not run (verified, MCP spike).

- At most once. An optional `requestId` from the agent makes a retry safe: the server replays the first result for 10 minutes (verified, MCP spike).

- The reply comes after the write is durable. Then the signal goes out.

- Errors have a code and a next step for the agent: `unknown_widget`, `unknown_action`, `invalid_args`, `handler_failed`, `timeout`, `busy`, `quota_exceeded`, `widget_unavailable`. Over HTTP, the status is 404, 422, 500, or 504 (verified, runtime spike).

Open choice: HTTP status codes plus a body (built), or always 200 with an `ok` field like the DSH RPC envelope. Recommendation: status codes for the window, `isError` with a code for MCP.

## Live updates `options.live_updates`

Decided: SSE signals and a refetch (`widget.live_updates`). The spikes add these rules (verified unless marked):

- The first frame of each stream is `hello` with `{rev, programRev}`. A window that opens after a write sees the new revision.

- On reconnect, the window always fetches again. No `Last-Event-ID`.

- A browser `EventSource` stops for good on an answer that is not 200, for example a 404 during boot (inferred from the spec). Thus the shell must open the stream again itself, with backoff.

- Ping every 15 s. The web server sets no timeout that closes a long stream (verified).

- The Chromium limit of 6 connections for each host is not a risk here. Electron main forwards each `dsh-app://` request with Node `fetch` (`web-document.ts:88`), not with the Chromium network stack (inferred by the reviewer).

- After the Mac sleeps, timers and streams can be dead. Electron `powerMonitor` sends `resume`. On `resume`, each window opens its stream again and fetches again, and each widget timer runs once (a proposal, not built).

## MCP server `options.mcp`

| Question | Options | Recommendation |
|---|---|---|
| SDK | The repo already pins the v2 split packages: `@modelcontextprotocol/server` 2.2.0, `node` 2.0.0, `client` 2.2.0 (verified, read). The 1.x monolith is the old line. | v2, as pinned |
| Transport mode | A. `createMcpHandler`, stateless (default). B. A plus a session leg for 2025-era clients. C. Reject old clients. | A. It survives a host restart with no client action (verified). Add B only for push to old clients. After a restart, an old session gets 404 and the v2 client does not start again by itself (verified). |
| Mount | A plain `(req, res)` handler on a `webServer` prefix route `/mcp` | Same wiring as the DSH test fixture `packages/mcp/mcp-client/tests/http-fixture.ts` (verified) |
| Argument check | The ajv validator bundled in the SDK | No new dependency (verified) |
| Identity | `POST /mcp/token`, bearer on `/mcp`, tokens saved to a file | Built (verified) |
| Browser guard | Copy the DSH fence `isTrustedApiRequest`, plus: any `Origin` or `Sec-Fetch-Site` header gets 403 | Built (verified). The fence is not exported from the package index. It resolves through the `./src/*` export (inferred). |

## MCP tools `options.mcp_tools`

Measured sizes, for widgets with four actions each (verified, estimated tokens):

| Shape | 1 widget | 10 widgets | 50 widgets |
|---|---|---|---|
| `tools/list`, 7 fixed tools | 769 | 769 | 769 |
| `widget_list`, action names only | 52 | 484 | 2404 |
| `widget_list` with schemas | 169 | 1663 | 8303 |
| `widget_describe`, one widget | 145 | 145 | 145 |
| One MCP tool for each action | 160 | 1582 | 7902 |

Recommendation: a short `widget_list` and `widget_describe(slug)`. The visible tool count stays fixed.

How the agent learns what the user changed:

| Option | For | Against |
|---|---|---|
| A. Pull only | Nothing to build | The agent gets no signal. |
| B. `widget_changes({since})` change feed | Works with each client. Hides the agent's own changes. Returns `reset` after a restart (verified). | The agent must ask. |
| C. MCP subscriptions (`resources/updated`, `listen`) | Correct by the spec (verified at protocol level) | Claude Code does not show them to the model today (inferred from docs and issue mirrors). |
| D. Claude Code channels | Real push into the session | Research preview, stdio only, Claude Code only |

Recommendation: B, and send C as well at no extra cost. A small extra: put a count of pending user changes in each tool result (a proposal, not built).

## Creation `options.creation`

The creation study mapped the DSH path and tested it (verified, 12 checks):

- A new bundle from a workspace folder installs as a `link:` dependency and applies live in about 0.8 s.

- An edit to an installed host file does not reload by itself. A no-op recompose (`setPluginEnabled('include:<id>', true)`) reloads it in about 0.4 s.

- A broken edit gives `failed` with the error text. The old code stops. The other plugins stay.

- An install of a name that is already installed is refused. Remove, then install, applies with no restart. The DSH reference that says "replace needs a restart" is out of date for profiles with HMR.

Options for the creation surface:

| Option | For | Against |
|---|---|---|
| A. One path: every widget is a bundle that the agent writes and installs | Same as DSH. One mechanism. | A CRUD widget needs agent code, so it needs approval. |
| B. Two paths: `widget_save` for data widgets (program plus CRUD actions as data, no code), bundles for logic widgets | Data widgets need no approval and apply at once (verified, MCP spike stub). Most widgets are CRUD. | Two mechanisms. `widget_save` supports only simple CRUD operations. |
| C. Only data widgets, logic in a sandbox | No host code from agents | Needs a sandbox process with fetch and state only. Large work. |

Recommendation: B for v1, and C as the later direction for logic widgets. Use one CRUD descriptor in both places: the data that `widget_save` takes and the `crudActions` helper of a bundle. The spikes used three different descriptors. The integration spike picks one.

A logic widget bundle still holds text that the agent wrote, also when it has no handler code (reviewer, verified):

- `cordis.patch.yml` can run code through `!!js`.

- `package.json` dependencies make pnpm download and build packages. DSH guards build scripts with `approvedBuilds` (`plugin-manager/src/index.ts:853`).

Thus `widget_install` lints each bundle first: no `!!js`, no new dependencies, no `approvedBuilds` over MCP, and a source folder only inside the agent workspace.

Replace must not lose the user's widget. Today a replace is remove, then install. If the install fails, the widget is gone. Options: check the new bundle before the remove, or keep the old bundle until the new one is `applied`. The integration spike tests this.

The stored program wins over the seed program in the package. After a reinstall, the stored program can name actions that no longer exist. Thus the runtime checks the stored program against the actions at each `register` and each save, and reports drift to the agent in `widget_inspect`.

Where an agent edit goes:

| Edit | Goes to | Applies |
|---|---|---|
| The look (program) | Stored program, after `mergeStatements` and a check against the declared actions | At once, no approval |
| Actions or API code | Package code, then `widget_reload` | After approval, about 0.4 s |
| Tunables | The widget's `Config` schema. The agent declares an option. Only the user sets it. | At once |

Approval for agent code, as a user setting (`agentCodePolicy`):

| Kind | Default |
|---|---|
| Data widget (no agent code) | allow |
| Logic widget (agent code in the host) | ask, as the DSH `danger-full-access` gate |
| Choices for the user | allow, ask, deny |

Credentials: a widget row names a key, for example `credentials: [STOCKS_API_KEY]`. The settings window shows a write-only field for it. The handler calls `api.credential(name)`. The runtime checks that the widget declared the name, then resolves it with `ctx.credentials`. If the key is not set, the result is `credential_missing` with the next step "ask the user to set it in Settings".

The MCP tools never return a key. But code in a logic widget runs in the host, so it can call `ctx.credentials` for any key or read files. The declared-name check is a guide, not a boundary. Only a sandbox (option C) makes it a boundary.

## Widget package shape `options.package_shape`

```
widget-<slug>/
  package.json      dsh.bundle.patch; exports ., locale, icon
  cordis.patch.yml  one row: slug, title, tunables, credentials: [NAME]
  index.js          inject ['widgets']; ctx.widgets.register({...})
  program.oui       seed program; the runtime copies it into storage
  locale/en.json, icon.svg
  client.js         only for an advanced widget
```

| Option | For | Against |
|---|---|---|
| A. One bundle for each widget | Same as DSH. One broken widget does not stop the others. Verified live. | Many small packages |
| B. One bundle for all user widgets | One package | One broken widget fails all of them. |
| C. CRUD widgets as rows of one shared plugin | No code | Agents must write profile patch files. Forbidden in DSH. |

Recommendation: A. Copy the package into a folder that the profile owns before the install. A `link:` install breaks when the agent moves its workspace folder (inferred).

## Shell and component set `options.shell`

Verified in Electron 44.7.0 through `dsh-app://` and forwarding:

| Part | Result |
|---|---|
| First content | 114 to 126 ms from navigation |
| Initial size | 159.6 KB gzip (145.4 JS and 14.2 CSS) |
| Charts chunk | 122.7 KB gzip, loaded only when a chart renders |
| Advanced chunk (Cordis, slots, loader) | 9.8 KB gzip, starts in 20 to 24 ms, loaded only for an advanced widget |
| Behaviors | external write refreshes and keeps typed text, stream drop and catch-up, size to content, catalog mismatch refused, empty state, query error with Retry, unknown component as a partial render with a banner |

Component set: the OpenUI shadcn example is chat-shaped and breaks on React 18 because its Button has no `forwardRef` (verified). Recommendation: fork it into our set `shadcn-widgets@1`, patch Button, keep 9 of its components, and add Stat, Row, List, Button with an action, a live Input, Checkbox with an action, and Empty.

Theming:

| Option | For | Against |
|---|---|---|
| A. Tailwind v4 `@theme inline` mapped to shadcn variables, mapped to `--dsw-alias-*` | Built. Light and dark work (verified). | Breaks the "no Tailwind" rule of `docs/web-styling.md`, which is for DSH client packages. |
| B. Plain CSS variables | No Tailwind | Rewrite of each shadcn class |
| C. CSS Modules | DSH style | Rewrite of the components |

Recommendation: A. Fix the gaps against DSH rules: literal colors in Alert, a border and a shadow together in Card, 1 px borders.

Component registry:

| Option | For | Against |
|---|---|---|
| A. All sets compiled into the pinned shell | Simple. Keeps `widget.runtime_pin`. | Each new set is a new shell version. |
| B. Each set as its own pinned chunk with a content hash. The shell gives it React, react-lang, and zod. It calls `library.extend`. | User sets without a new shell | `extend` exists in react-lang 1.0.1 (read, not run). |
| C. A set as a Cordis plugin of an advanced widget | Reuses the loader | Only for advanced widgets |

Recommendation: A now, B later. The program names its catalog as `<set>@<major>` only. A content hash in the name would make each shell patch refuse every stored program (reviewer). The shell refuses an unknown catalog (built).

Guide for create mode: the full guide is about 4,400 tokens. Components and rules only are about 1,600 tokens (verified, chars/4). Recommendation: components and rules in `widget_guide`, with functions and examples on request.

## Window manager `options.windows`

The window spike ran 45 jobs in Electron 44.7.0. 44 passed. The one failure was a quit hang, which the agent then fixed (4 of 4 runs passed).

### Bridge from the host to Electron main `options.windows.bridge`

| Option | Result | Verdict |
|---|---|---|
| A. Node IPC on the channel that the host and Electron main already use | Built and verified. The host sends `{type:'wm', seq, op}` with `sync`, `open`, `close`, `move`, or `set`. Main answers `wm-ack {seq, ok, error}` and sends `wm-event {slug, ev, by, bounds}`. After a host kill, the new host sends `sync` and main matches it with no duplicate windows. | Recommended. It matches the DSH control messages that carry a `requestId` and a deadline. |
| B. Main reads a host SSE route | Not built. Main needs a cookie and a reconnect loop. It adds a second channel. | Reject |

The host window manager owns the saved positions, as user config. Main reports a move only when the user moved the window (`by:'user'`). macOS sends `moved` also for a move from code, so main compares with the last bounds that it set (verified). For a widget that sizes to its content, save only x and y.

A panel window ignores `setVisibleOnAllWorkspaces(false)`: it still reads `true` (verified). A setting "main desktop only" may need a normal window, not a panel.

### Memory and open time `options.windows.memory`

Measured as macOS physical footprint (verified):

| Mode | Processes for N widgets | Total MB for 1 / 5 / 10 / 20 | Open time at N=20, median |
|---|---|---|---|
| A. One BrowserWindow for each widget | N | 92 / 196 / 321 / 583 (about 20.6 MB each) | 570 to 669 ms |
| B. `window.open` from one hidden opener | 1 | 97 / 114 / 145 / 198 (about 1.8 MB each) | 278 to 297 ms |
| C. WebContentsViews in one window | N+1 | 111 to 597 | 353 to 369 ms |
| D. Pool of warm hidden windows | N | same as A | 6 to 21 ms from assign to render |

- In B, one renderer crash kills every widget in that process (verified: 4 of 4 died).

- `--renderer-process-limit=1` had no effect. The V8 code cache gave no gain for a 147 KB bundle.

- Throttling: a window that was shown and then hidden ran 4 of 60 timer ticks with throttling on and 60 of 60 with it off.

Recommendation: A by default, because each widget is then its own fault domain. Offer B as a user setting "shared renderer" and say that one crash closes all widgets. Keep 1 or 2 warm windows (D) for fast opens. Keep throttling on, and turn it off only for a widget that needs timers in the page.

### Size to content `options.windows.sizing`

| Option | Result | Verdict |
|---|---|---|
| A. ResizeObserver, then IPC, then `setBounds`, kept between the user's min and max | Grows and stops at 420, shrinks and stops at 230. IPC takes 1 to 3 ms (verified). | Recommended |
| B. Electron `enablePreferredSizeMode` and `preferred-size-changed` | Same result, 2 to 4 ms. Needs `body{display:inline-block}`. | Fallback |
| C. A large transparent window with click-through | Not built. The window bounds are not the visible bounds. | Reject |

An option `anchor=bottom` makes a widget grow upward. A growing widget can be clipped for one frame (inferred).

### Crash and recovery `options.windows.crash`

| Case | Result (verified) |
|---|---|
| Renderer crash | `render-process-gone`. Reload after 500 ms. Rendered again in about 620 ms. The other widgets stay. After more than 3 crashes in 60 s, an error page. |
| Page busy for 25 s | `unresponsive` at 16.3 s. The app needs its own watchdog to reload a stuck widget faster. |
| Host killed | Windows stay and show "reconnecting". The host starts again with backoff and is back in 360 to 410 ms. The stream reopens about 620 ms after the kill. |
| Stream while the host is down | If the `dsh-app://` handler answers `Response.error()`, `EventSource` keeps trying (recommended). If it answers HTTP 502, `EventSource` stops for good. |

DSH does not restart a dead host today. It shows a fatal dialog (read `backend-controller.ts` and `fatal-recovery.ts`). The widget app needs a restart with backoff (`options.isolation`, option E).

### Accessory app `options.windows.accessory`

- `LSUIElement` in `Info.plist` makes the app an accessory app from launch. Recommended, plus a call to `setActivationPolicy('accessory')` as a guard. `app.dock.hide()` also works (verified with `lsappinfo`).

- The Tray menu works: a show or hide item for each widget, Settings, and Quit (verified by calling the handlers).

- Keyboard shortcuts: map Cmd+A, C, V, X, and Z in `before-input-event` to the `webContents` edit calls, and add a hidden Edit menu. A test with synthetic keys cannot tell the two apart. The operator must check with real keys.

### Drag and click-through `options.windows.click`

- Drag by hand: pointer capture and screen deltas, then main calls `setPosition`. It moved exactly 80 by 40 with synthetic events (verified). Recommended.

- `-webkit-app-region: drag` takes the clicks and does not work while the window ignores the mouse (inferred). Avoid it on panel windows.

- Click-through: `setIgnoreMouseEvents(true, {forward: true})`, and the page reports over IPC when the pointer is over content.

### Checks for the operator `options.windows.operator`

These need real hands and eyes: a real drag, real click-through, typing and copy and paste in a panel window, behavior over full-screen apps and Spaces, a flash of the Dock icon at launch, real clicks on the Tray menu, and flicker when a widget grows.

## Fault isolation `options.isolation`

The reliability study found the largest risk (verified, read and ran):

- DSH installs `installFailLoud` for each profile. An uncaught exception or an unhandled rejection makes the host exit with code 1.

- Cordis cannot catch an error that a `setTimeout` callback throws. Thus one bad timer in one widget stops every widget.

- Electron main does not start the host again by itself. It shows a dialog: Exit, Relaunch app, Disable plugins.

| Option | For | Against |
|---|---|---|
| A. The runtime owns scheduling. Widgets use `w.every(ms, fn)` and the runtime wraps each callback and each handler in try/catch. | Small. Catches most errors. | A widget can still call `setTimeout` itself. |
| B. A. plus a supervisor: an error card, restart with backoff 1, 4, 16 s, quarantine after 3 failures in 10 minutes | Recovers by itself | More code in the runtime |
| C. Change DSH boot so that an error from widget code does not stop the host | Catches the rest | Edits DSH boot, which is risky. Hard to tell widget code from other code. |
| D. Run logic widgets in a `utilityProcess` with only fetch and state | Real isolation. Also limits what agent code can do. | Large work. Each call crosses a process. |
| E. Electron main restarts a dead host with backoff 0.5, 2, 8 s. After 2 crashes in 60 s, safe mode with agent widgets off. | Recovers from a crash of the whole host | Windows wait during the restart. The fixed port binds again in 2 to 7 ms (verified). |

| F. In the host's uncaught-error handler, find the widget from the error stack (paths under the widget bundle). Quarantine that widget and keep the host up. For any other error, keep the fail-loud behavior. | Fixes the problem in one process. The desktop host is already a fork that the trim edits. | A change to DSH boot code, under the trim marker. A stack can miss the widget path, for example in a library callback. |

Options A and B cannot stop `installFailLoud`. Only C, D, E, or F can. E restarts the whole host: 360 to 410 ms on a fake host (verified, window spike), about 2 s on the real host with the runtime (verified, runtime spike). The full desktop profile is not measured.

Recommendation: A, B, E, and F for v1. D as the direction for agent code. The integration spike tests F.

Other findings (verified):

- A plugin that throws in `apply` goes to `failed`. Its siblings keep running. It does not try again.

- When a service provider fails, its consumers go to `pending` and come back when it recovers.

- An async `ctx.effect` that rejects is only logged. The plugin stays `active` and looks healthy. The runtime must mark such a widget `degraded`.

- A listener that throws in `ctx.emit` stops the later listeners.

## Security for v1 `options.security`

| Threat | Guard |
|---|---|
| Another machine calls `/mcp` | Bind to 127.0.0.1 only. DSH does this already. |
| A web page or DNS rebinding | The DSH Host, Origin, and `Sec-Fetch-Site` fence. Refuse each browser `Origin` on `/mcp`. Verified. |
| An agent acts as another agent | Not solved in v1. `/mcp/token` accepts any name, and each handshake gets a new id (verified, reviewer). Thus a list of allowed agents for each widget binds to nothing. Drop it from v1. Later: the user issues tokens in settings. |
| An agent removes or replaces a widget that the user needs | A `locked` flag that only the user sets, and a trash for removed widgets that the user can restore from |
| Text from an API or from another agent tricks an agent (prompt injection) | Mark widget data in `widget_call` and `widget_changes` results as untrusted data |
| `widget_install` reads any folder | Accept a source folder only inside the agent workspace |
| An agent change that nobody sees | An audit log for each widget: agent, action, `requestId`, revision, result. The settings window shows it. |
| Agent code runs freely | The approval gate `agentCodePolicy` |
| Another process holds the port | Not solved. On macOS, `127.0.0.1:P` and `0.0.0.0:P` can bind side by side (verified). A server nonce in the port file can help (inferred). |
| State or disk grows without limit | Quotas and combined writes |

## Edge cases from the review `options.edges`

| Name | Problem | Proposal |
|---|---|---|
| `options.edges.slug_reuse` | The runtime keeps state after a widget unregisters. A new widget with the same slug gets the old state (verified, runtime notes). | A removed widget moves its state to the trash. A new widget with that slug starts empty. |
| `options.edges.slug_clash` | A data widget and a bundle with the same slug register the same routes. The second route throws, so that plugin fails (verified, `rpc-host.ts`). | The runtime refuses a second widget with a used slug and gives the error `slug_taken`. |
| `options.edges.slug_rename` | There is no way to rename a slug. | v1: no rename. The title can change. |
| `options.edges.state_migration` | `initialState` applies only when no state exists. A new version of a widget can need a new state shape. | Each widget declares `stateVersion` and an optional `migrate(old, fromVersion)`. The runtime runs it once at `register`. |
| `options.edges.displays` | A window manager that saves only x and y can put a window on a display that is gone. | Clamp each window into the current displays at open and when a display changes. |
| `options.edges.main_desktop_only` | A panel window ignores `setVisibleOnAllWorkspaces(false)` (verified). This clashes with "main desktop only" in `widget.window_manager`. | A decision for the operator: drop the setting, or use a normal window for such a widget. |
| `options.edges.two_windows` | Two windows of one slug | Both get the same signals and fetch the same state. Allowed. The window manager opens one window for each slug by default. |
