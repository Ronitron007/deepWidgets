# Adversarial review of hardening commit b746154 (Sonnet)

Scope: `git show b746154` (MUST-FIX 2-5 of CRITIQUE-code-sonnet.md), read against HEAD daf9398; line numbers are HEAD.
Later commits 7d0e354 and 8bf872e already patched several gaps of b746154; where so, it is said. Nothing was run
against https://dw-relay.round-mud-a9b3.workers.dev; every claim below is from reading code and tests.
MUST-FIX 1 (the tool set) was rejected on purpose: the four tools match the architecture, so it is not reviewed here.

## Verdicts

- Per-key lockout (MUST-FIX 2): partly. Four asked points hold; the new state cap is a risk (see NEW).
  - Global ceiling: fixed correctly. `LOCKOUT_GLOBAL` is gone; `isLocked` counts only the caller's key (`worker/src/core.ts:107-109`).
  - IPv6 /64 keying: fixed correctly. `lockoutKey` expands `::`, keeps 4 groups, folds IPv4-mapped (`worker/src/core.ts:119-128`);
    both surfaces use it (`worker/src/admin.ts:29`, `worker/src/authorize.ts:69`). Cost: a shared /64 shares one bucket.
  - Atomic attempt: fixed correctly. One `attempt()` call checks and counts in the Durable Object (`worker/src/lockout.ts:14-19`,
    `worker/src/core.ts:112-116`); the old `locked` then `fail` pair is gone (`worker/src/authorize.ts:74`).
  - /admin/kill not lockout-gated: partly. It is exempt (`worker/src/admin.ts:24-27`), so nobody can lock the owner out of the
    off switch, but wrong guesses there are never counted: a free, unlimited guessing oracle for the passcode.
    Only a 32-character length is enforced, not entropy (`worker/src/core.ts:73`).
- Bridge sub/gid enforcement and denied-grants file (MUST-FIX 3): fixed correctly. `sub === 'owner'` and a non-empty `gid` are
  required (`bridge/src/assertion.ts:88-89`; the Worker signs `sub: 'owner'` at `worker/src/assertion.ts:56`). A listed gid is
  refused (`bridge/src/main.ts:173`); a missing file is an empty list, any other read error denies (`bridge/src/main.ts:72-80`);
  gid is logged (`bridge/src/main.ts:230-232`). Limit: a deny-list only stops a grant you can name.
- Fixed local error text: fixed correctly for bridge errors. Only `LOCAL_ERROR_MESSAGES` leaves the bridge (`bridge/src/local.ts:146-155`).
  At b746154 the log still held the raw `error.message`; 7d0e354 cut it to the error name (`bridge/src/local.ts:187-190`).
  Residual by design: an `isError` result from the local server passes through verbatim (`bridge/src/local.ts:184`, `worker/src/mcp.ts:48-49`).
- Loopback redirect refusal (MUST-FIX 5): fixed correctly. Every URI is checked before `createClient` and the whole list is
  refused (`worker/src/admin.ts:44-48`); the policy covers localhost, `.localhost`, 127/8, `::1`, mapped forms (`worker/src/core.ts:134-142`) and is
  wider than the library's (`::ffff:` forms and a trailing dot are not loopback to the library, so no gap). `allowLoopback` must be exactly `true`.
- The /mcp/* 404 e2e pins (MUST-FIX 4): partly. `/mcp/anything`, `/mcp/`, `/mcp/token/x` and `/mcp/token` are pinned 404
  with a valid token and no stub call (`e2e/run.test.ts:257-277`). The ask to test `mcpFetch` directly was not done:
  its only guard, the exact-path check at `worker/src/mcp.ts:69`, has no unit test, and the pins run on wrangler dev only.

## NEW problems introduced

- Lockout state cap is likely too big: `LOCKOUT_MAX_ENTRIES = 5000` (`worker/src/core.ts:80`) is one array rewritten whole at
  `worker/src/lockout.ts:17`. About 2,300 entries of ~55 bytes pass the 128 KiB Durable Object value limit (from the docs, not tested). Then `put`
  throws: wrong passcodes give a 500 and are not counted, so lockout fails open until entries age out. An attacker needs only ~2,300 failures from many /64s.
- `/admin/kill` has no throttle at all (above); the old design at least counted it.
- `gidOf` (`bridge/src/main.ts:172`) is set before the deny check and freed only in `.then` (`bridge/src/main.ts:230-231`); a `handleCall` that throws leaks the entry.
- `DW_DENIED_GRANTS_FILE` is not guarded: only the kill file goes through `checkKillFile` (`bridge/src/main.ts:135-136`), so the
  deny-list may sit under `$DSH_HOME/deepwidgets`, where deepWidgets itself could edit it.
- `clientIp` still falls back to one shared `unknown` bucket (`worker/src/core.ts:130-132`); wrangler dev has no `CF-Connecting-IP`, so the
  e2e lockout test (`e2e/run.test.ts:393-399`) only ever uses that bucket.
- A correct passcode is refused while the key is locked (`worker/src/core.ts:113`), and success does not clear earlier failures.

## MUST-FIX

1. Lockout state can outgrow the Durable Object value limit and fail open. Fix: lower `LOCKOUT_MAX_ENTRIES` to 1000 at `worker/src/core.ts:80`, and in `worker/src/lockout.ts:17` wrap the `put` in try/catch and return `'locked'` when it throws.
2. The denied-grants override is unguarded. Fix: at `bridge/src/main.ts:136` call `checkKillFile(opts.deniedGrantsFile, opts.dshHome)` on the override before use, so it cannot sit under `$DSH_HOME/deepwidgets`.
3. `mcpFetch` has no direct test, and the 404 pins never ran against the deployed Worker. Fix: add a spec that calls `mcpFetch` with `/mcp/token`, `/mcp/x`, `/mcp/` and `/mcp/%2e` and expects 404 before any server is built; add the same four POSTs to `e2e/remote-smoke.ts` with a real token.
4. The kill oracle: keep the exemption, but make the passcode strong. Fix: have the README and setup generate it with `openssl rand -base64 48`, and raise the length check at `worker/src/core.ts:73` to 43 characters.

## Untested

- A parallel burst against the real Lockout Durable Object (the specs use a fake `attempt`; the e2e is sequential).
- A real IPv6 or `CF-Connecting-IP` request end to end; only `lockoutKey` unit cases exist.
- The 5,000-entry state size and a `put` failure (MUST-FIX 1); no test floods keys.
- The deny-list file at runtime with CRLF, a directory in its place, or a swap mid-call.
- Tool-level `isError` text leaving the bridge unfiltered; nothing pins what it may carry.
- The deployed Worker: the 404 pins, the loopback refusal and the lockout are verified only on wrangler dev.
