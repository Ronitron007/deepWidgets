# b7: fail closed in the durable journal, and one local session per grant (Codex review mr-logs/codex-review-real-final.md)

Code: `bridge/src/journal.ts`, `bridge/src/main.ts`, `bridge/src/local.ts`. Memory-only mode (no `file`) keeps today's behaviour.

## Changes

1. **No durable reservation, no dispatch (file mode).** `persist()` returns true/false. In `run`, if writing the pending row
   fails, do not call `exec`; remove the in-memory entry and return a new result `{ status: 'unavailable' }` (add it to `Ran<T>`).
   `main.ts` maps it to a bridge rejection with code `local-unavailable` and message
   `the bridge could not record this operation durably, so it did not send it`. Also: a journal file that exists but is
   corrupt or over 8 MiB at load sets a `healthy = false` flag; while unhealthy, every `run` in file mode returns
   `unavailable` (fail closed). A missing file is healthy (empty). Expose `healthy(): boolean` on `Journal`.
2. **Keep the reservation after an ambiguous end (file mode).** Today any not-kept end drops the row. Instead, `run` takes the
   release decision from a new optional callback `release?: (value: T | undefined, error: unknown) => boolean` passed by the
   caller: true = the operation certainly did not write, so drop the row (as today); false = keep the pending row, mark the
   in-memory entry so later retries with the same args get `opts.unknown` without calling exec. Default when the callback is
   absent: today's behaviour (drop).
   In `main.ts` pass a release callback that returns true only when the local result is an MCP tool error whose
   `structuredContent.error.code` is one of: `unknown-widget`, `unknown-action`, `invalid-args`, `bad-request`, `busy`,
   `safe-mode`, `widget-failed`, `mode-off`, `idempotency-conflict`, `conflict`, `timeout` (the real app's pre-write codes; see
   real-app/deepwidgets/widgets/src/index.ts WIDGET_ERROR_STATUS and mcp/src/index.ts NEXT_STEP). Everything else that is not
   kept (`timeout-after-write`, `handler-error`, `local-unavailable`/`local-error` results, thrown errors) keeps the row.
3. **One local session per grant.** In `local.ts`, key the session cache by `${cid}\u0000${gid}` (take `gid` from the claims;
   `Local.call` claims type becomes `Pick<Claims, 'cid' | 'gid' | 'tool'>`), keep `agentName(cid)` for the agent name, so two
   grants of one OAuth client never share a host caller. Update callers (`main.ts`, `real/*.ts` pass a gid, tests).
4. README Bridge bullet for `DW_JOURNAL_FILE`: say at-most-once, fail closed when the file cannot be written, and that
   results are stored in plaintext (mode 0600) on the PC.

## Tests (`journal-failclosed.mr.spec.ts`; update `journal-durable.mr.spec.ts` where it asserted dispatch after a failed write)

- Failed pending write -> `unavailable`, exec never called. Corrupt existing file -> `healthy()` false and runs return `unavailable`; missing file -> healthy.
- release() false after a tool error with `timeout-after-write` -> retry in the same process gets `unknown`, exec called once; and after a restart (second journal on the file) also `unknown`.
- release() true (`invalid-args`) -> row dropped; retry runs exec again.
- Two grants of one cid get two handshakes (a fake local server counting `/mcp/token` calls, or a unit seam in local.ts).

Gates: `npm run typecheck`, `npx vitest run`. Do not touch worker/ or e2e/.
