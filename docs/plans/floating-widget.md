# Plan for the floating widget, first draft `floating_widget.plan`

This plan implements the spec `docs/specs/floating-widget.md`. Each unit is one branch and one PR. Each unit has a check that can fail. The task files are `docs/tasks/trace-host.md`, `docs/tasks/trace-sources.md`, and `docs/tasks/trace-window.md`. The process rules are in `fork_trim.plan.process` in `docs/plans/fork-trim.md`.

## Units `floating_widget.plan.units`

| Unit | Task file | Change | Check | Needs |
|---|---|---|---|---|
| `trace.host` | `docs/tasks/trace-host.md` | Add the bundle `@deepwidgets/trace` with its host half. The host half makes the snapshot, listens to the Cordis events, and rescans for late rows. It keeps the messages, and serves `GET /api/trace`, `POST /api/trace`, and `GET /trace`. | The trace test reads `/api/trace` from the main window. It must find the host service `webServer` in the state `up`. The test messages that it posts must come back in the stream. A run with `DEEPWIDGETS_TRACE=off` must fail. The late row check `node tools/trace-late-row.mjs` must find each row that stays `pending` after the snapshot. It must also find a live message for a service that comes up, and for a row that then becomes `active`. | `probe.round_trip` |
| `trace.sources` | `docs/tasks/trace-sources.md` | Add the client half. Make Electron main send its start-up steps. | The trace test must find messages from each of `main`, `host`, and `client`. It must find each start-up step of `trace.sources`, and a `client` message for each client row. A run with `DEEPWIDGETS_TRACE=off` must fail. The client row check `node tools/trace-client-rows.mjs` runs the client half with no app. It must find each row that stays `pending` after the snapshot, and the live messages of the client half. | `trace.host` |
| `trace.window` | `docs/tasks/trace-window.md` | Electron main opens the trace window. The page shows the messages. | The trace test reads the rows on the page `dsh-app://app/trace`. It must find rows from each of `main`, `host`, and `client`. A run with `DEEPWIDGETS_TRACE=off` must fail. | `trace.sources` |

The trace units do not need `trim.profile`. Either one can merge first.
