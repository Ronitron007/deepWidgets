# First pilot against the real deepWidgets app

Date: 28–29 Nov 2026, Asia/Calcutta (IST). Relay: https://dw-relay.round-mud-a9b3.workers.dev (live, kyaloon account, workers.dev only). Real app: a fresh clone of `Ronitron007/deepWidgets` main at `2f924ccc`, local branch only, **no changes to the app**. Prototype at commit `b2ed230`.

Raw runner logs and evidence JSON are not in this repository (they can contain client identifiers and local paths). This file is the sanitized summary.

## What ran

- `pnpm install --frozen-lockfile`, then `pnpm run build:artifacts` (8 gates pass). The native addon build on the box needed official Node v24.22.1 headers, installed only on that machine, not in this repo.
- The real host in CLI mode, the way this repo's `tools/host-log.mjs` boots it: `node apps/cli/lib/bin.js --profile web --host 127.0.0.1 --port 47701 --no-open` with a temporary `DSH_HOME`. No Electron, no windows. It bound loopback only, wrote `$DSH_HOME/deepwidgets/mcp.json`, and loaded the built-in `sample` counter widget (`get` query, `add {by}` mutation). There is no `groceries` widget in the real app.
- The prototype bridge, pointed at that `DSH_HOME` and the live relay, with `DW_JOURNAL_FILE` set for the final runs.
- `remote/real/pilot.ts` drives the steps: two OAuth clients through the live Worker, and an owner view straight from the loopback server to read real state and the change feed. It restarts the real host by SIGTERM and relaunch, and the bridge the same way.
- The host, the bridge, and port 47701 were stopped afterwards. The loopback MCP and `/mcp/token` were never exposed beyond localhost.

## Results (final run-7, all required steps pass)

| Step | Result | What the final run showed |
|---|---|---|
| 1. Two clients, different rights on `sample` | PASS | A saw 4 tools; B saw 3 (no `widget_call`). B's forced call was refused and the count stayed 102. The two grants were separate. |
| 2. Interact-only vs the real tool list | PASS | The real local server has the same 11 tool names as the stub. The remote side offers exactly `widget_list`, `widget_describe`, `widget_call`, `widget_changes`. All 7 other tools failed when A forced them. Authenticated requests to `/mcp/token`, `/mcp/x`, `/mcp/`, and `/mcp/token/x` on the live Worker all returned 404. |
| 3. Useful update in the real app's state | PASS | `add {by:5}` moved the real count 102→107 at revision 43. The real change feed recorded one `sample.add` attributed to client A (`by` = `remote-<clientA>-…`). |
| 4. Retry after a lost response applies once | PASS (simulated loss) | An identical retry returned the same answer (count 109, rev 44) and the count did not move. The same request id with other arguments was rejected as `idempotency-conflict`. The first reply was awaited, so a reply that is truly dropped after the write is still untested. |
| 4b. Same retry across a real host restart | PASS | Host pid changed (downtime 1.6 s). State was kept (count 112). The retry replayed and the count stayed 112. |
| 5. Revoke B during a real host restart | PASS | Revoke returned 200 while the host was down (downtime 2.1 s). B then failed with `InvalidGrantError` (its tokens were gone). A still wrote after restart (112→113). This shows client-visible revocation, not a still-valid bearer being refused at the Durable Object. |
| 5b. Retry across a bridge restart | PASS with `DW_JOURNAL_FILE` | Restart exited 0, new bridge pid, same host pid, count and revision unchanged (117, rev 47). |
| 6. Real app's own dedupe (info) | per caller | Two loopback callers with the same request id and arguments applied twice (118→119). |

Earlier runs, kept as history:

- Run-1: the five core steps passed; there was no 5b yet.
- Run-2, memory-only journal: **5b FAIL**. After a bridge restart the retry applied again (count 28→32). That is why the durable journal (b5–b8) was built.
- Run-3 flaked because `GET /admin/grants` is an eventually consistent KV list (lag of 14.6 s was measured in run-4). The runner now polls.
- Runs 4, 5, 6, and 7 all passed with the file journal.

## Real app vs the stub

| Topic | Stub | Real app |
|---|---|---|
| Widget | `groceries` (`add {item}`, `list`) | `sample` counter (`get`, `add {by}`); no groceries |
| MCP SDK | server 1.32 | `@modelcontextprotocol/server` 2.2.0 + `node` 2.0.0 (not 2.4.0). The bridge's 1.32.2 client works unchanged. |
| Tool names | the same 11 | the same 11 |
| Result shape | `{ result, rev }` | `{ result, rev, replayed?, resultLost? }`; describe also returns a catalog, `programRev`, action kinds, args JSON Schema, and `timeoutMs` |
| requestId | not deduplicated | deduplicated per **(caller, requestId)**, persisted, with `resultLost` after a restart. The caller is the per-handshake `agentId`, so a new bridge handshake is a new caller. |
| Change feed | `{ seq, slug, rev, by }` | `{ seq, at, slug, kind, by, action, rev }`. `by` names the remote client. |
| State across restart | in memory | persisted (the count survived every restart) |
| Restart | instant | about 1.6–3.1 s down; new pid and epoch; the bridge re-handshakes by itself |

## Changes in this work

- **Real app:** none. The pilot ran against an unmodified checkout.
- **Prototype (`remote/`):** the durable journal (b5–b8), Sonnet and Codex hardening fixes, and the `real/` pilot runner. Details are in [WRITEUP.md](WRITEUP.md) and [reviews.md](reviews.md).

## Proposed app changes (not made)

These are proposals only. Nothing in this pull request edits the deepWidgets app.

1. A stable operation namespace for remote callers (device + grant), passed over the authenticated loopback, so the app's own persisted `(caller, requestId)` store dedupes across bridge restarts and the bridge journal becomes a cache, not the authority.
2. A loopback-only way to keep the caller id across token renewal, while still using `agentId` for attribution.
3. A grants pane inside the app, with pause and revoke. Consent that names the PC, the connector, the widget, and the actions, with the signing key held on the PC, belongs with that pane.

## Open gaps in the pilot itself

- A reply that is truly dropped after the write has already happened is untested, as is a host `timeout` after another widget's write has committed, retried before and after a bridge restart.
- Revoking at the relay while a client's bearer is still valid is unproven. The run showed B being refused after its tokens were gone.
- The relay's grant list can lag up to about 15 seconds after a change.
- The attribution check does not cover client ids that start with `-` or `_`.
