# Safe host base `safe_host`

This spec is stage 1 of the build order. It makes the single host process safe before later stages put more agent code into it. The decisions are `widget.watchdog_rule`, `widget.host_cleanup`, and `widget.port_owner` in `docs/explore/widget-system/where-we-stand.md`. The ideas for a later handover are in `docs/explore/widget-system/host-handover.md`.

## Crash records `safe_host.crash`

- The rules of `widget_fv.crash` apply.

- A widget that throws before it registers shows as failed in `widget_list` and in its window, with the reason. It does not disappear.

- The test `apps/desktop/tests/host-process.spec.ts` passes, and the checks of this unit run it.

## Watchdog rule `safe_host.watchdog`

- When the running slot holds a widget, a heartbeat stall of 2 s stops the host. The crash record blames that widget.

- When the running slot holds 0, a heartbeat stall of 10 s stops the host. The crash record blames no widget.

- When the running slot holds 0 and the module `@sentry/node-native-stacktrace` loads, the watchdog reads the innermost frame of the stuck thread. If that frame is in the files of a widget row, the stall is a widget stall: 2 s, and the crash record blames that row with the method `native-stack`.

- The blame store alone does not blame a widget. Host work that a widget waits for gets the store of that widget, so the store can name a widget that did nothing wrong.

- The time that the watchdog takes to read the stack does not count as a poll gap.

- The watchdog writes the provisional record at a quarter of 2 s. It does this only when the running slot holds a widget.

- A poll gap of 1 s or more of the watchdog thread means that the process did not run. The stall clock starts again.

The spike `plugins_spike.hmr` and the watchdog spike measured healthy work of 2.7 s to 5.0 s on a busy machine. No healthy run took 10 s.

## Cleanup at a crash `safe_host.cleanup`

When the claimer catches an uncaught error, it does these steps:

1. Write the crash record with a synchronous write.

2. Dispose the plugin tree, with a time limit of 3 s.

3. Exit with code 1.

If the dispose does not end in 3 s, the host stops itself with `SIGKILL`. The supervisor counts this exit as the same crash, not as a second crash. A stall of the watchdog and an abort for lack of memory run no dispose, as today.

## Port owner `safe_host.port`

- Electron main listens on the port `DEEPWIDGETS_MCP_PORT` (default 47615). It forwards each request to the current host.

- The host listens on a free loopback port that the operating system selects. It tells Electron main its port when it is ready.

- The fence of `widget_mvp.mcp` moves to Electron main. Electron main refuses these requests:

  - a request with an `Origin` header or a `Sec-Fetch-Site` header

  - a request whose `Host` is not loopback

  - a request from a socket peer that is not loopback

- The host trusts only requests that Electron main forwards.

- Electron main writes `$DSH_HOME/deepwidgets/mcp.json`. The port in the file is the port of Electron main. The host gives the nonce to Electron main. The proof of `widget_phase2.mcp_port` stays as it is.

- While no host is ready, Electron main answers each forwarded request with status 503 and `Retry-After: 1`. A client then retries.

- If the port is taken, the app fails loudly at start, as today.

## HMR guards `safe_host.hmr`

- Each disposer of an agent row or a widget row, and `runExclusive` of `hmr`, has a time limit of 5 s. When the limit passes, the host quarantines the row, and the row shows as failed.

- After the limit passes, the host refuses each later write of that row. Thus a disposer that runs late can not change state after the next install.

- Built-in rows that are not widgets have no disposer limit. They are trusted code, and the drain of the widget runtime can take 11 s.

- Blame covers each agent row, not only widgets. Each `ctx.on` listener of an agent row runs in the blame store of that row. The crash record gets the root and the hash from the row.

- In safe mode, the host does not load agent rows. Built-in rows load as before.

- The watchdog starts before the host loads agent rows.

- The running slot holds an agent row only while the host runs synchronous code of that row. The slot does not stay across an `await`, so a stall of other code is never blamed on the agent row.

- A loop in the top-level code of an agent row is blamed by the native stack, when the module `@sentry/node-native-stacktrace` loads. Without the module, the loop is a stall with no blame. After two such crashes, safe mode does not load agent rows, so the host recovers.

## Later `safe_host.later`

These items are designed, but this spec does not build them. Code of this stage must not block them.

- A handover of `handover.order`: a new host starts while the old host disposes.

- Fencing tokens of `handover.fencing`.

- Record names with the generation and the time, of `handover.names`.

## Provisional values `safe_host.provisional`

| Item | Value |
|---|---|
| Stall limit with no widget | 10 s |
| Dispose limit at a crash | 3 s |
| Disposer limit and `runExclusive` limit | 5 s |
| Retry-After during the gap | 1 s |
