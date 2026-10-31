# Plan for the widget MVP `widget_mvp.plan`

This plan implements `docs/specs/widget-mvp.md`. Each unit is one branch and one PR against `main`. A unit merges only when its check passes and an independent review has no open finding. Each check names a mutant: a wrong change that must make the check fail.

## Units `widget_mvp.plan.units`

| Unit | Change | Check | Mutant that must fail the check | Needs |
|---|---|---|---|---|
| `widget.runtime_core` | Add `@deepwidgets/widgets` and `@deepwidgets/widget-sample` (`widget_mvp.runtime`, `widget_mvp.sample`). Add their rows to the trim keep lists. Add the host check `tools/widgets-runtime.mjs`. | `node tools/widgets-runtime.mjs` boots a host and checks each line of `widget_mvp.runtime.contract` and `widget_mvp.runtime.routes`: 10 parallel `add` calls give +10, a timed-out call writes nothing, a replayed `requestId` after a host restart gives `replayed: true` and runs once, each error code has its status, the streams send `hello`, `data`, `program`, and `removed`. It prints `widgets-runtime: pass`. The rows check passes with the new rows. | (1) No queue: the +10 check fails. (2) `requests` kept in memory only: the restart replay check fails. (3) Writes after a timeout allowed: the timeout check fails. | `trim.widget_rows` |
| `widget.shell` | Add `@deepwidgets/shell` and the Electron main branch that serves it (`widget_mvp.shell`). Answer `Response.error()` in the host gap. | A smoke flag `DSH_SMOKE_WIDGET=sample` opens `dsh-app://app/widget/?slug=sample`, finds the count in the page, posts `add`, and finds the new count in the page. A second run kills the host once and finds the page live again after the restart. | (1) No refresh on `data`: the new count never shows. (2) 503 in the gap: the page does not come back. | `widget.runtime_core`, `widget_mvp.spikes.shell_serving` |
| `widget.windows` | Add `apps/desktop/src/deepwidgets-windows.ts` (`widget_mvp.windows`). | A smoke flag `DSH_SMOKE_WINDOWS=1` finds one window at `dsh-app://app/widget/?slug=sample`. It turns the sample row off through the plugin manager and finds that window closed. | `removed` ignored: the close check fails. | `widget.shell` |
| `widget.mcp` | Add `@deepwidgets/mcp` (`widget_mvp.mcp`). | `node tools/widgets-mcp.mjs` uses the MCP SDK client against a booted host: `widget_list` names `sample`, `widget_call add` adds 1, `widget_changes` shows the change with `by` set to the agent, a request with an `Origin` header gets 403, a request with no token gets 401. It prints `widgets-mcp: pass`. | Origin fence removed: the 403 check fails. | `widget.runtime_core` |

`widget.shell` and `widget.mcp` can run at the same time after `widget.runtime_core` merges.

## Later units `widget_mvp.plan.later`

`widget.isolation`, `widget.creation` (with `widget.dev_gates`), and `widget.mcp_port` follow the MVP. Each gets its plan row when the MVP merges.

## Process `widget_mvp.plan.process`

- An Opus agent implements each unit. A fresh Opus agent reviews it, runs the check, and runs each mutant. The reviewer is never the implementer.

- Each agent works in `.worktrees/<branch>` and keeps temporary files in `$TMPDIR/deepwidgets-<unit>/`. One smoke run at a time on the machine.

- A unit that meets a structural choice that this spec does not settle stops. The planning session then runs a spike.
