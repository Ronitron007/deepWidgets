# Review outcomes (Sonnet and Codex)

Reviews ran in two waves: Sonnet critiques of the architecture and of the first hardening pass, then Codex (`gpt-6.2-sol`, high effort, read-only) on design and code snapshots. Claude's 5-hour budget was often too high for mr to start implementers, so several Codex passes ran as direct `codex exec` rather than through mr. Findings that were accepted were fixed in `remote/` unless noted as still open.

The raw mr logs are not in this repository. Sonnet write-ups that lived with the prototype are also in `remote/CRITIQUE-r2.md`, `remote/CRITIQUE-code-sonnet.md`, and `remote/REVIEW-hardening-sonnet.md`.

## Sonnet

### Architecture, rounds 1 and 2 (`CRITIQUE-r2.md` and the earlier r1 note)

Round 1 blocked a one-pass build on library-API mistakes. Round 2 confirmed those blockers were fixed in the text, and asked for smaller corrections (a `grantId` that the OAuth library does not put in props, a `timeoutMs` input that does not exist, device revoke and audit rows dropped from the build spec). Those landed in the final architecture (round 3) and in the Worker.

### Code critique before the first public deploy (`CRITIQUE-code-sonnet.md`)

The dangerous half of interact-only held: install, reload, remove, template, guide and library tools are not registered remotely, and the bridge refuses them even with a valid assertion. `/mcp/token` is not exposed remotely. The critique called the remote surface "the wrong set of four" because early must-have notes listed `deepwidgets_modes` and omitted `widget_changes`. The shipped surface is the four interact tools (`list`, `describe`, `call`, `changes`). That is intentional: modes is not an interact tool, and `widget_changes` is how an agent watches state.

### Hardening review (chain-b4, `REVIEW-hardening-sonnet.md`, merged)

Must-fixes that landed:

- Lockout entries are capped at 1000, and a storage error fails closed.
- The deny-list path is guarded by the same kill-file checks (including `..` names, later tightened again after Codex).
- Owner passcodes must be at least 43 characters.
- `/mcp/%2e` and `/mcp/token` are pinned to 404, including in live authenticated checks.
- A call that throws returns a fixed failure frame and is cleaned up (no leaked `gidOf` state).

One must-fix is only partly done: the 404 pins are in, but there is still no direct unit test of the bridge's internal `mcpFetch`. That remains open.

## Codex (`gpt-6.2-sol`)

### Design and early code (`codex-review-architecture`, `part1`, `b2`, `hardening`)

Codex agreed with the relay shape and with interact-only. Early must-fixes that were accepted and fixed:

- Access tokens now carry only the scope they asked for, capped by the grant.
- The cloud kill switch drops the bridge socket and blocks reconnects until it is turned off.
- Relay error messages no longer leak bridge details.
- The bridge requires https for any non-local relay URL.
- The smoke test no longer prints any part of a secret.
- The lockout holds up when one address is flooded; there is no global ceiling that can lock the owner out from every address.

Turned down, with a written reason: scrubbing widget output at the bridge. That output is the product's data, and the bridge cannot tell a secret apart from a grocery item or a counter value. Encryption in transit is already TLS; encryption at rest of journaled results is still open (see below).

### Real-app pilot runner and Sonnet follow-up (`codex-review-real-pilot.md`)

Request changes. Accepted and fixed: incorrect error-code reads, the pilot not in the TypeScript project, weak pass conditions (the runner now checks new PIDs, change-feed attribution, the exact tool set, live authenticated 404 pins, and grant cleanup), `..` names slipping the control-file guard, a bridge timeout on `widget_call` reported as `local-error` (now `outcome-unknown`, and the relay allowlists that code), and the README passcode minimum.

Accepted as a proposal, not a prototype patch: dedupe at the app's commit with a stable operation namespace. That needs an app change. See [WRITEUP.md](WRITEUP.md).

### Durable journal (`codex-review-real-journal.md`, `real-final.md`, `real-b7.md`)

Request changes on b5, which led to b6 and b7:

- Reserve the request id in the file before the call is sent.
- Do not evict in-flight entries.
- Bound and fsync the file (8 MiB cap). Fail closed if the file cannot be written, or if it exists but is corrupt or oversized.
- After an ambiguous end, keep the reservation so a retry gets `outcome-unknown` instead of running again. Only the real app's pre-write error codes release it.
- One local session per `(client, grant)`.

### b8 and the follow-up fix (`codex-review-real-b8.md`, `codex-review-real-b8fix.md`)

b8 removes `timeout` from the pre-write release list, because a timeout can arrive after another widget's write has already committed. In file mode a row is kept unless `release()` says the operation certainly did not write.

Codex found one must-fix: a truthy non-boolean return from `release` could drop the row. Fixed in prototype commit `b2ed230` by requiring `release(...) === true`, plus a neutral `outcome-unknown` message ("The outcome of this requestId is unknown.") and tests for truthy non-booleans, thrown callbacks, and an exact `true`. The follow-up review approved that commit with no must-fix.

Should-fix, documented and not done (it would need a Worker redeploy): qualify the Worker's "applied once" tool text with the journal's retention limits and the need for file mode across bridge restarts.

## Still open (documented, not fixed in this PR)

These are the leftover Codex and Sonnet items I agree are real, and that I chose not to expand this prototype for:

- OS file lock and directory fsync for the journal; full snapshot validation; duplicate-key, retention, tombstone and admission limits.
- Journaled results are stored in plaintext (mode 0600) on the PC.
- An owner-only control directory, with link and permission checks, for the default deny-list and approvals.
- Per-key lockout storage (today the lockout Durable Object is shared).
- Auditing `outcome-unknown` through the relay error path; coalescing two bridge handshakes that start at once.
- A pilot that drops a real response after commit, and a bridge-level test of a cross-widget write followed by `timeout`, then a retry before and after a restart.
- A direct `mcpFetch` 404 pin.
- A Durable Object-level revoke while a bearer is still valid.
- Single-use refresh tokens and per-grant rate limits (written up earlier in `architecture.md` for later).

## Tests at the last review

170 unit tests and 22 end-to-end tests pass, and both the prototype and Worker TypeScript projects typecheck. Those counts are from the box after `b2ed230`.
