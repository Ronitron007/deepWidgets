# Plan for the safe host base `safe_host.plan`

This plan implements `docs/specs/safe-host.md`. The process is `widget_mvp.plan.process`. The unit `widget.crash_records` moves here from `docs/plans/widget-fv.md`.

## Units `safe_host.plan.units`

| Unit | Change | Check | Mutant that must fail the check | Needs |
|---|---|---|---|---|
| `widget.crash_records` | `widget_fv.crash`, `safe_host.crash`, `safe_host.watchdog`, `safe_host.cleanup` | The `crash_lifecycle` replays for the innocent widget, the abort rule, and the hash lift pass. A loop in a widget call stops the host in about 2 s. A stall with slot 0 stops it after 10 s, and a healthy 4 s stall does not. A dispose that hangs at a crash ends in 3 s with `SIGKILL`, and the supervisor counts one crash. `host-process.spec.ts` passes. The model rules hold. | The 2 s limit for slot 0: the healthy 4 s stall stops the host. | none |
| `host.hmr_guards` | `safe_host.hmr` | A disposer that never ends is quarantined after 5 s, and the next install works. A throw in a `ctx.on` listener of an agent row blames that row. In safe mode, an agent plugin does not load. A loop in the top-level code of an agent row at boot is blamed on that row. | No time limit on disposers: the next install waits. | `widget.crash_records` |
| `host.port_owner` | `safe_host.port` | `widgets-mcp` and `widgets-mcp-port` pass through Electron main. After a host restart, the port and `mcp.json` stay the same, and a client gets 503 with `Retry-After` during the gap, then 200. A request with an `Origin` header gets 403 from Electron main. | The host still binds 47615: the second host fails with `EADDRINUSE` during the restart test. | none |
| `host.log` | `safe_host.log` | `host-log` passes. A CLI host that can not write the token file answers 500, and its stdout has the error line of `@deepwidgets/mcp`. The smoke flag `DSH_SMOKE_LOG=1` finds the same line in the output of `start:desktop`. The rows smoke passes with `logger-console` in `rows.host.txt`. `widgets-mcp` passes. | The row `logger-console` is off: the stdout has no line, and `host-log` fails. | none |

`widget.crash_records` and `host.port_owner` can run at the same time. Both change `apps/desktop/src/host-process.ts`, so the second unit to finish merges the first one in.

## Notes for `host.log` `safe_host.plan.host_log`

- The unit adds no exporter code. It uses the package `@deepseek-ai/cordis-plugin-logger-console`, which the repository has in `vendor/logger-console`.

- A row name resolves through the dependencies of the installed host. Thus `deepwidgets/trim/package.json` lists the package as a dependency.

- The unit adds the check `tools/host-log.mjs` and the smoke flag `DSH_SMOKE_LOG=1`.

- The unit changes the row counts in `head.why` and `head.status` of `CLAUDE.md`, and the list `deepwidgets/trim/rows.host.txt`.

- The check of the fence line in `tools/widgets-create.mjs` (`library.fence_warn`) reads `ctx.logger.buffer`. The unit that merges second changes that check to read the stdout of the host.
