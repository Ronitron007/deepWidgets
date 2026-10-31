# Plan for widget phase 2 `widget_phase2.plan`

This plan implements `docs/specs/widget-phase2.md`. The process is `widget_mvp.plan.process`.

## Units `widget_phase2.plan.units`

| Unit | Change | Check | Mutant that must fail the check | Needs |
|---|---|---|---|---|
| `widget.isolation_supervisor` | Electron main restarts the host with backoff, with safe mode and the give-up (`widget_phase2.isolation.supervisor`, without blame). | A smoke flag kills the host once. The widget page is live again after the restart, and the main window comes back. Four kills in 60 s show the fatal dialog. | 503 in the gap: the page does not come back. No restart: the page does not come back. | MVP |
| `widget.isolation_blame` | Blame at exit, the crash record, the fast exit, quarantine at start, and the lift on a changed hash (`widget_phase2.isolation.blame`). | A test widget throws from a timer. The host restarts, the test widget shows failed, and `sample` stays live. A changed file of the test widget brings it back. | Blame off: the crash counts as unblamed, and a second crash starts safe mode. | `widget.isolation_supervisor` |
| `widget.isolation_watchdog` | The watchdog and the provisional record (`widget_phase2.isolation.watchdog`). | A test widget loops in an action. The host dies within 2.5 s and comes back with the test widget failed. A 150 MB `JSON.parse` in the host does not kill it. | Heartbeat not bumped: a false kill in the parse case. | `widget.isolation_blame` |
| `widget.creation` | The gates and the five tools (`widget_phase2.creation`), with the TypeScript template and the guide. | An MCP client installs the template: it shows in `widget_list`, its window opens, and `widget_call` works. A bundle with a raw `setTimeout` is refused by the lint gate. A bundle whose `apply` throws is refused by the test run. | The test run gate off: the throwing bundle installs. | `widget.isolation_blame` |
| `widget.mcp_port` | The fixed port, the port file, and the nonce (`widget_phase2.mcp_port`). | A second app instance on the same port fails loudly. An agent reads `mcp.json` and gets a token that carries the nonce. | Nonce not checked: a fake server on the port gets a token. | MVP |
