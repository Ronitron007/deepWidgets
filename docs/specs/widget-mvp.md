# Widget MVP `widget_mvp`

This spec turns the widget decisions into a first working product. The decisions are in `docs/explore/widget-system/where-we-stand.md` (`standing.decided`). This spec does not repeat their reasons.

## Goal `widget_mvp.goal`

The MVP is done when these are true in the desktop app:

- A widget bundle registers a widget with `ctx.widgets.register`.

- The app opens a floating panel window for each registered widget. The window renders the widget program with the pinned shell.

- A click in the window, an agent call over MCP, and a timer in the widget each change the widget state. Each open window shows the change.

The MVP leaves out the items in `widget_mvp.later`.

## Parts `widget_mvp.parts`

| Part | Package or file | Process | Job |
|---|---|---|---|
| runtime | `deepwidgets/widgets` (`@deepwidgets/widgets`) | host | The service `ctx.widgets`, the storage, the action contract, and the routes |
| sample | `deepwidgets/widget-sample` (`@deepwidgets/widget-sample`) | host | One widget for the checks: a counter with a timer |
| shell | `deepwidgets/shell` (`@deepwidgets/shell`) | widget window | The pinned page that renders a program |
| windows | `apps/desktop/src/deepwidgets-windows.ts` | Electron main | Opens and closes one panel window for each widget |
| mcp | `deepwidgets/mcp` (`@deepwidgets/mcp`) | host | The MCP server for agents |

All new packages are in TypeScript with the layout of `ts_move.layout` in `docs/specs/ts-move.md`. Each DSH file that changes follows `head.trim` in `CLAUDE.md`.

## Runtime `widget_mvp.runtime`

### API `widget_mvp.runtime.api`

The runtime row `deepwidgets-widgets` provides the service `widgets`. It injects `connection` and `storageDomain`.

| Method | Contract |
|---|---|
| `register(def)` | Registers one widget. The caller fiber owns the registration. The registration ends when the fiber ends. A second live registration of one slug throws `conflict`. |
| `list()` | Gives `{ slug, title, rev, programRev }` for each live widget. |
| `get(slug)` | Gives the state and its revision. |
| `call(slug, action, args, { caller, requestId? })` | Runs one action through the action contract. Gives `{ result, rev, replayed? }`. |
| `update(slug, fn, { by })` | Writes the state from a timer or a plugin. It uses the same queue as a mutation. |
| `setProgram(slug, text, { by })` | Stores new program text. |
| `changes(since)` and `cursor()` | The change feed for agents. |

A widget definition `def` has these fields:

- `slug`: matches `^[a-z0-9][a-z0-9-]{0,62}$`.

- `title`, `program` (the seed OpenUI Lang text), and `initialState`.

- `actions`: a list of `{ name, kind: 'query' | 'mutation', args?, timeoutMs?, handler(args, w) }`. `args` is a zod schema. `w` gives `state`, `update(fn)`, and `signal`.

### Storage `widget_mvp.runtime.storage`

The runtime opens the storage domain `widgets`, version 1, with the json backend. It has three tables:

- `state`: one record for each slug: `{ rev, data }`.

- `program`: one record for each slug: `{ rev, text, updatedAt }`. A stored program wins over the seed.

- `requests`: one record for each `(caller, requestId)`: the hash of the call, the result, and the time. A record older than 10 minutes is void. This table makes a retried call idempotent after a host restart (`standing.checked.crash_only`).

### Action contract `widget_mvp.runtime.contract`

- Each slug has one FIFO queue for mutations and `update`. A query does not wait in the queue.

- A job that waits in the queue longer than its timeout fails with `busy` and does not run.

- Each action has a timeout: the action value, else the widget value, else 5 s. At the timeout, the runtime aborts `w.signal` and refuses each later write of that call.

- The runtime checks `args` with zod before the queue.

- Each error has a code and an HTTP status: `unknown-widget` 404, `unknown-action` 404, `invalid-args` 422, `handler-error` 500, `timeout` 504, `busy` 503, `idempotency-conflict` 409, `conflict` 409, `bad-request` 400.

### Routes `widget_mvp.runtime.routes`

The runtime registers each route with `ctx.connection.fetch.register`, so each route has the cookie check of `connection`.

| Route | Answer |
|---|---|
| `GET /api/widgets` | `{ widgets: list() }` |
| `GET /api/widgets/events` | Server-sent events: `{ type: 'added' \| 'removed', slug }`. The first frame is `{ type: 'hello', slugs }`. |
| `GET /api/widgets/<slug>/program` | `{ rev, text }` |
| `POST /api/widgets/<slug>/call` | Body `{ action, args, requestId? }`. Answer `{ ok: true, result, rev }` or `{ ok: false, error: { code, message } }`. |
| `GET /api/widgets/<slug>/stream` | Server-sent events: `hello { rev, programRev }`, then `data { rev }`, `program { rev }`, and `removed`. A ping every 15 s. |

Prior art: `deepwidgets/widgets/index.js` on the branch `rohan/widget-exploration` implements most of this in plain JavaScript. Port it. Do not port the data widgets, the CRUD descriptor, the drift check, or the fail-loud claimer (decisions `widget.code_always` and `widget.isolation`).

## Sample widget `widget_mvp.sample`

The row `deepwidgets-widget-sample` registers the slug `sample`, a counter:

- The actions are `get` (query) and `add` (mutation, args `{ by: number }`).

- With the config `tickMs` greater than 0, a `ctx.interval` adds 1 at that interval.

- Its program shows the count and a button that runs `add` with `{ by: 1 }`.

## Shell `widget_mvp.shell`

- The shell is a page built with Vite, as `apps/web` is. It uses React 18 (the repository version), `@openuidev/react-lang` 1.0.1, and `@openuidev/lang-core` 1.0.1, each pinned to an exact version.

- The component set is `shadcn-widgets@1`. Port it from the shell spike: `overnight/shell/src/widget/` in the scratchpad that `docs/explore/widget-system/spikes.md` names. It includes the `forwardRef` patch of `Button` for React 18.

- The page URL is `dsh-app://app/widget/?slug=<slug>`. Electron main serves the built files from disk. It does not forward them to the host (`widget.shell_url`). The spike `widget_mvp.spikes.shell_serving` decides the exact path.

- The page reads the program, renders it, and runs each `Query` and `Mutation` through `POST /api/widgets/<slug>/call`. On `data`, it runs its queries again with `useTriggerAction` (`widget.refresh_hook`). On `program`, it loads the program again. When the stream closes, the page opens it again with backoff.

- While the host is down, Electron main answers `Response.error()` for a forwarded request, not 503. A 503 closes an `EventSource` for good (`standing.checked.crash_only`).

## Windows `widget_mvp.windows`

- After the host is ready, Electron main reads `GET /api/widgets/events` with the host cookie.

- For each slug, it opens one panel window: no frame, always on top, on all Spaces, and shown without focus, as the trace window does. The window loads `dsh-app://app/widget/?slug=<slug>`.

- On `removed`, it closes the window of that slug. When the stream ends, it opens the stream again and syncs the windows with `hello`.

- Each window has its own renderer (`standing.waiting.renderer`, the recommended choice).

## MCP `widget_mvp.mcp`

- The row `deepwidgets-mcp` mounts a `webServer` prefix route on `/mcp`. It uses the official MCP SDK in stateless mode (`widget.mcp_client`). Prior art: `deepwidgets/mcp/index.js` on `rohan/widget-exploration`.

- `POST /mcp/token` with `{ agent }` gives a bearer token. The tokens persist in `$DSH_HOME/deepwidgets/mcp-tokens.json` with mode 0600.

- The fence refuses a request with an `Origin` header or a `Sec-Fetch-Site` header, and a request whose `Host` is not loopback. Use `localhostHostValidation` from `@modelcontextprotocol/node`. Do not import DSH TypeScript source (`standing.checked.fence_import`).

- The tools are `widget_list`, `widget_describe`, `widget_call` (with an optional `requestId`), and `widget_changes({ since })`. Each tool calls `ctx.widgets` in the host process. Each error gives `code`, `message`, and `nextStep`.

- In the MVP, MCP uses the web port of the host. The fixed port is in `widget_mvp.later`.

## Provisional choices `widget_mvp.provisional`

The operator has not decided these items yet (`standing.waiting`). The MVP uses the recommended choice. A later decision can change each one inside one package.

| Item | MVP choice |
|---|---|
| `standing.waiting.renderer` | One renderer for each widget window |
| `standing.waiting.tailwind` | Tailwind v4 in the shell only |
| `standing.waiting.identity` | No rules for each agent. Tokens only name the caller. |
| `standing.waiting.main_desktop_only` | Not built. Each window shows on all Spaces. |
| storage backend | json. The sqlite backend is faster (`standing.checked.sqlite`) and comes later. |
| page channel | `fetch` and server-sent events, behind one client module in the shell (`standing.checked.message_port` shows the faster option) |

## Spikes `widget_mvp.spikes`

| Name | Question | Blocks |
|---|---|---|
| `widget_mvp.spikes.shell_serving` | How does Electron main serve a Vite build from a `deepwidgets/*` package at `dsh-app://app/widget/` in the development app and the smoke check? Does react-lang 1.0.1 render a program there with the ported component set? | `widget.shell` |

## Later `widget_mvp.later`

These items are decided but not in the MVP. Each one is a later plan unit.

- `widget.isolation`: the crash-only host, the watchdog, and the supervisor.

- `widget.dev_gates` and creation: `widget_install` with the gates, `widget_reload`, `widget_remove`, templates, and the guide.

- `widget.mcp_port`: the fixed port and the port file.

- The window manager settings, window positions, the tray, and the main widget.
