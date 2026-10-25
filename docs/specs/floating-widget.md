# Floating widget, first draft `floating_widget`

## Goal `floating_widget.goal`

deepWidgets gets its first floating window, the trace window. The trace window shows a live list of messages. Each message tells about one event in one process of the app.

The trace window has two jobs. It proves that a floating window can get data from the Cordis Contexts. It also shows which plugins and services start, and this list helps the trim.

## Decisions `floating_widget.decisions`

The operator made these decisions on 2026-10-24.

| Decision | Choice |
|---|---|
| Electron main | Electron main runs no Cordis Context. It sends its start-up steps as messages. |
| Message kinds | Plugin state changes and service changes. No log lines. No other Cordis events. |
| Window | The trace window floats from the first unit that opens it. |
| Trim | The trace units do not need `trim.profile`. The trace window shows the rows that load, before or after the trim. |

## Sources `floating_widget.sources`

| Process | What it sends | How the message gets to the host |
|---|---|---|
| Electron main | Its start-up steps: app ready, host started, host ready, main window open, trace window open. | `POST /api/trace` with the host cookie. Steps from before host ready wait in a list in Electron main. |
| host | Each plugin state change and each service change in the `host` Context. | In the same process. |
| renderer of the main window | Each plugin state change and each service change in the `client` Context. | `POST /api/trace` with `fetch`. |

The Loader starts its rows in parallel (`EntryGroup.update` in `vendor/loader/src/config/group.ts`). Thus other plugins can start before a trace plugin. Each trace plugin first sends one snapshot message for each plugin and each service that already exists. `packages/host/plugin-inventory/src/index.ts` reads the plugin rows from `ctx.loader.entries()`. Cordis keeps the services in `ReflectService.store` in `vendor/cordis/src/reflect.ts`.

After the snapshot, the trace plugins listen to the Cordis events `internal/status` and `internal/service`. The file `vendor/cordis/src/events.ts` declares these events.

- Each listener gets `internal/status` for each fiber. The event has no filter.

- A listener gets `internal/service` only for the services of its own isolate scope. The trace listens without `{ global: true }`. Thus it sends the services of the `host` Context and of the `client` Context, not of isolated scopes.

- The Loader fires `internal/service` for `loader` many times. After a row starts, `Entry.init` in `vendor/loader/src/config/entry.ts` fires it when no import and no state change is in progress. At this event, a trace plugin first does the rescan of `floating_widget.sources.late_rows`. Then it sends a service message only when the state of a service changes between `up` and `down`.

- A listener that throws breaks the state change of the fiber (`vendor/cordis/src/fiber.ts`). Each trace listener catches its own errors.

The client half sets the field `window`. When it starts, it reads the query parameter `window` of the page URL once. When the URL has no such parameter, the value is `main`. In this draft, no window URL has this parameter. Thus the only value is `main`.

The reason for the query parameter: Electron main sends each request with the same host cookie. Thus the host cannot tell two pages apart. A later widget window can load `dsh-app://app/?window=widget`, and the host needs no change.

### Late rows `floating_widget.sources.late_rows`

A row can make its fiber after the snapshot. A new fiber starts in the state `pending` (`vendor/cordis/src/fiber.ts`). When a service that it needs does not exist, the fiber stays `pending`. Cordis emits `internal/status` only when the state changes (`_updateState` in the same file). Thus the listeners alone do not show this row.

Each trace plugin finds these rows with a rescan:

- The rescan reads `ctx.loader.entries()`. For each row root fiber that has no message yet, it sends one `plugin` message with the current state. This message has no `snapshot` field.

- A trace plugin keeps a set of the fibers that have a message. The snapshot, the `internal/status` listener, and the rescan put fibers in this set. The set holds fibers, not row keys, because a row that starts again gets a new fiber.

- A trace plugin rescans at each `internal/service` event for `loader`.

- A trace plugin also rescans once when `ctx.loader.await()` resolves. The reason: when the last task to end is an import that fails, `Entry.init` fires no `loader` event.

A row whose import fails has no fiber. The trace sends no message for it. After boot, one gap stays open. When a new row stays `pending` and an import fails last, the row gets its message only at the next `loader` event.

A spike on `cbe90c51` ran a model of the host half with the vendored Cordis and Loader. Without the `loader` rescan, a pending row that the spike added after boot had no message. Without the `ctx.loader.await()` rescan, a late pending row had no message when the last import failed.

## Message `floating_widget.message`

| Field | Value |
|---|---|
| `seq` | The order number in the host, from 1. The host half sets it. |
| `time` | Milliseconds since 1970, from the process that saw the event. |
| `process` | `main`, `host`, or `client`. |
| `window` | Only in a message from `client`. The name of the window whose page sent the message. In this draft, the only value is `main`. `floating_widget.sources` tells which code sets it. |
| `kind` | `step`, `plugin`, or `service`. |
| `name` | The step name, the row key, or the service name. `floating_widget.names` defines the row key. |
| `state` | For `plugin`, the word for the Cordis fiber state: `pending`, `loading`, `active`, `failed`, `disposed`, or `unloading`. The words are the names of the values 0 to 5 of `FiberState` in `vendor/cordis/src/fiber.ts`. `FiberState` is a `const enum`. Thus a trace plugin keeps its own copy of these words. For `service`, `up` or `down`. For `step`, `done`. |
| `detail` | Optional text, for example the package name, the plugin that provides a service, the services that a pending plugin waits for, or an error message. |
| `snapshot` | `true` when the message comes from the snapshot. |

## Names `floating_widget.names`

A `plugin` message is only for the root fiber of a Loader row. A fiber is a row root when `fiber.entry` has a value and `fiber.parent.fiber.entry` is a different entry (`vendor/loader/src/index.ts`). The trace sends no message for a sub-plugin fiber. The reason: a sub-plugin has no row key of its own. Its message would repeat the key of its row with a different state.

Use `fiber.entry`, not `entry.fiber`. The Loader sets `fiber.entry` before the first state change. It sets `entry.fiber` only after `ctx.plugin` returns (`vendor/loader/src/config/entry.ts`).

The row key is the key of the rows check in `trim.profile.steps.host_rows` (`docs/tasks/trim-profile.md`):

- For a host row, when `entry.id` starts with `include:`, the key is `entry.options.id`. Else the key is the text `name:` and then `entry.options.name`.

- For a client row, the key is `entry.options.name`. This is the form of `deepwidgets/trim/rows.client.txt`.

The reason: client rows and rows that a plugin makes at run time get a random id at each boot. With the same key, the trace list and the trim row lists use one name for one row.

## Transport `floating_widget.transport`

A new bundle `@deepwidgets/trace` at `deepwidgets/trace/` holds the trace plugins. It has a host half and a client half, like `deepwidgets/probe/`.

- The host half keeps all messages since the host started, in memory and in order.

- `GET /api/trace` returns a server-sent event (SSE) stream. The stream sends all kept messages, then each new message.

- `POST /api/trace` takes a JSON array of messages from Electron main or from the client half.

- `GET /trace` returns the page of the trace window.

Electron main sends each request from a `dsh-app://app/` page to the host, with the host cookie. The code is the `protocol.handle` call in `apps/desktop/src/main.ts` and `forwardWebRequest` in `apps/desktop/src/web-document.ts`. Thus the trace window needs no preload script and no new IPC channel. The board [`docs/canvas/floating-widget-processes.canvas`](../canvas/floating-widget-processes.canvas) shows each process and each message path.

The host half registers the routes in this way:

| Route | Registration | Reason |
|---|---|---|
| `GET /api/trace` and `POST /api/trace` | One exact route of `ctx.connection.fetch.register`, with `methods: ['GET', 'POST']` and `requestBody: 'buffered'`. | The route gets the cookie check and the Host and Origin check of `client-connection`. A `ctx.webServer` route on this path skips both checks. A `ctx.webServer` resource route also answers 405 to `POST`. |
| `GET /trace` | One exact route of `ctx.webServer.register`, with a `resource`. | The page holds no data. Its data comes from `GET /api/trace`, which has the checks. |

The stream follows these rules:

- The stream closes when `request.signal` aborts. The reason: after a client closes, the bridge in `packages/client/connection/src/http-bridge.ts` reads the body until the body ends.

- The stream sends the comment line `: ping` every 15 seconds. The reason: `forwardWebRequest` uses the Node `fetch`. It stops a body after 300 seconds with no data (inferred from the `undici` default `bodyTimeout`).

- Before the host is ready, Electron main answers 503. `EventSource` does not connect again after an answer that is not 200. Thus the trace page makes a new `EventSource` after an error.

A spike on `74de914b` read an SSE stream from a `ctx.connection.fetch` route through `protocol.handle`. Each event came to the page in 17 ms or less. Each stream closed on abort.

## Trace window `floating_widget.window`

Electron main opens the trace window after it opens the main window. The main DSH window stays as it is.

| Property | Value |
|---|---|
| URL | `dsh-app://app/trace` |
| Size | 360 by 480 pixels. The user can resize it. |
| Frame | None. |
| Level | Always on top, on all Spaces. |
| Focus | It does not take focus when it opens. |
| Move | The header of the page is the drag area. |

The page shows one row for each message, with the time, process, kind, name, state, and detail. Each new row goes at the bottom. Each process has its own color. Snapshot rows look different from live rows.

In this draft, the page has no Cordis Context. It reads the stream with `EventSource`. This keeps the first window small. A later draft can give the window its own `client` Context.

## Check `floating_widget.check`

The trace test is `DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs`.

- The trace test passes only when it finds messages from each of the processes `main`, `host`, and `client`.

- The trace test passes only when it finds the host service `webServer` in the state `up`.

- A run with `DEEPWIDGETS_TRACE=off` must fail. This value disables the trace rows.

## Out of scope `floating_widget.out_of_scope`

- Log lines and other Cordis events.

- A Cordis Context in Electron main.

- A `client` Context in the trace window.

- Messages that stay after the host stops.

- Filters, search, and widget content other than the message list.

- The pet sprite, MCP, app packaging, Windows, and Linux.
