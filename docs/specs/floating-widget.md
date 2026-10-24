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

The trace plugins start after other plugins. Thus each trace plugin first sends one snapshot message for each plugin and each service that already exists. `packages/host/plugin-inventory/src/index.ts` reads the plugin rows from `ctx.loader.entries()`. Cordis keeps the services in `ReflectService.store` in `vendor/cordis/src/reflect.ts`.

After the snapshot, the trace plugins listen to the Cordis events `internal/status` and `internal/service`. The file `vendor/cordis/src/events.ts` declares these events.

## Message `floating_widget.message`

| Field | Value |
|---|---|
| `seq` | The order number in the host, from 1. The host half sets it. |
| `time` | Milliseconds since 1970, from the process that saw the event. |
| `process` | `main`, `host`, or `client`. |
| `kind` | `step`, `plugin`, or `service`. |
| `name` | The step name, the row id, or the service name. |
| `state` | For `plugin`, the name of the Cordis fiber state in `vendor/cordis/src/fiber.ts`. For `service`, `up` or `down`. For `step`, `done`. |
| `detail` | Optional text, for example the package name, the plugin that provides a service, the services that a pending plugin waits for, or an error message. |
| `snapshot` | `true` when the message comes from the snapshot. |

## Transport `floating_widget.transport`

A new bundle `@deepwidgets/trace` at `deepwidgets/trace/` holds the trace plugins. It has a host half and a client half, like `deepwidgets/probe/`.

- The host half keeps all messages since the host started, in memory and in order.

- `GET /api/trace` returns a server-sent event (SSE) stream. The stream sends all kept messages, then each new message.

- `POST /api/trace` takes a JSON array of messages from Electron main or from the client half.

- `GET /trace` returns the page of the trace window.

Electron main sends each request from a `dsh-app://app/` page to the host, with the host cookie. The code is the `protocol.handle` call in `apps/desktop/src/main.ts`. Thus the trace window needs no preload script and no new IPC channel.

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
