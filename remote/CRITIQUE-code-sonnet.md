# Code critique (Sonnet): worker/src, bridge/src, e2e/run.test.ts

Scope: adversarial read before the public deploy to https://dw-relay.round-mud-a9b3.workers.dev. Provider facts (workers-oauth-provider 1.4.0) were read in node_modules, not assumed. Nothing was run against the live Worker.

### 1. Interact-only remote path: partial
- The relay offers `widget_changes`, which the must-have does not list: `worker/src/core.ts:11-16`, `worker/src/tools.ts:34`; the bridge allowlist passes it at `bridge/src/allowlist.ts:5` and `bridge/src/allowlist.ts:13`.
- `deepwidgets_modes`, which the must-have lists, is offered by no remote path. e2e/run.test.ts:22 puts it in NEVER_REMOTE, the opposite of the must-have, and `e2e/run.test.ts:21` makes `widget_changes` part of the expected tool set.
- The dangerous half holds. install/reload/remove/template/guide/library are in no registry (`worker/src/mcp.ts:56-60` registers only `toolsForScope` output). The bridge refuses them even with a valid signature: `bridge/src/assertion.ts:101` (allowlist) and `bridge/src/main.ts:109` (the tool comes only from verified claims).
- Verdict is partial because the surface is the wrong set of four, not because anything unsafe is reachable.

### 2. /mcp/token never exposed or relied on remotely: holds
- No Worker route serves it. `/mcp/token` falls under apiRoute `/mcp` (library `matchApiRoute` matches the prefix `/mcp/`), so it needs a valid token and is then 404'd by `worker/src/mcp.ts:66`. That 404 is the only guard. A refactor of `mcpFetch` to prefix matching would forward it.
- Only the bridge calls it, on loopback, with `remote:<cid>` (`bridge/src/local.ts:60-63`), and it checks the HMAC proof against the port-file nonce (`bridge/src/local.ts:78-79`), so a port squatter is refused.
- The minted bearer is a full local MCP bearer (create tools included); the bridge allowlist is the only thing narrowing it (`bridge/src/local.ts:121-126`).

### 3. OAuth 2.1 + PKCE, pre-registered clients, passcode consent: partial
- Holds: no `clientRegistrationEndpoint` is set at `worker/src/index.ts:53-68`, so discovery has no registration endpoint. Clients are created only behind the passcode (`worker/src/admin.ts:34-49`, auth method `none`). The library requires S256 PKCE for public clients and has no plain/implicit (library lines 193-208, 2828-2829).
- Holds: consent needs the passcode, compared in constant time and failing closed under 32 chars (`worker/src/authorize.ts:74-77`, `worker/src/core.ts:66-69`), behind a lockout (`worker/src/authorize.ts:71`).
- Partial: redirect URI matching is exact only for non-loopback URIs. For loopback URIs the library ignores the port (`isValidRedirectUri`, library line 5499-5509). A loopback client lets any local process on any port receive the code; PKCE limits the damage. The consent page warns about it (`worker/src/authorize.ts:54`) but nothing refuses it. Register only https redirect URIs.
- Partial: lockout is per-IP plus a global ceiling that is itself an attack (MUST-FIX 2).
- `requiredScopes` lists both scopes (`worker/src/index.ts:60`). Check on the deployed Worker that a `widgets:read`-only grant still reaches `/mcp`; if the library demands all of them, the read/call split in `worker/src/core.ts:11-16` is dead and every grant can call.

### 4. Per-request Ed25519 assertion: partial
- Holds: device `aud` (`bridge/src/assertion.ts:87`), tool and scope (`bridge/src/assertion.ts:101-102`), args hash (`bridge/src/assertion.ts:104`), widget (`bridge/src/assertion.ts:119`), exp with 60 s cap (`bridge/src/assertion.ts:93-94`; signer uses 30 s, `worker/src/assertion.ts:36`), jti replay cache (`bridge/src/assertion.ts:97-99`, `bridge/src/replay.ts:15-30`), and issued-before-start (`bridge/src/assertion.ts:96`).
- Own clock holds: the hello `serverTime` is ignored and the offset is 0 (`bridge/src/main.ts:129,138`, `bridge/src/remote.ts:12`).
- Broken for the grant binding: the worker signs `gid` (`worker/src/assertion.ts:14,58`) but the bridge never reads it. The `Claims` type has it (`bridge/src/assertion.ts:25`) while `bridge/src/assertion.ts:84-90` checks only cid, never gid or sub. Revocation exists only in the relay DO (`worker/src/relay.ts:138`), and the bridge cannot tell grants apart or refuse one.
- Wildcard `*` is honored by the verifier (`bridge/src/assertion.ts:119`, `worker/src/mcp.ts:32`) though consent can never mint it (`worker/src/authorize.ts:83`).

### 5. Kill switches: holds
- Cloud flag: the `flags` table in the DO's SQL, checked before every relay (`worker/src/relay.ts:57-59,137`), set by `setKill` (`worker/src/relay.ts:157-161`) via `worker/src/admin.ts:66-69`.
- Local kill file: checked before verification on every call, fail closed on any stat error other than ENOENT (`bridge/src/main.ts:49-56,101`). `checkKillFile` rejects settings.json and anything under `$DSH_HOME/deepwidgets` (`bridge/src/main.ts:40-46`).
- Neither lives in settings.json. Weakness: `resolve` is lexical, so a symlink inside `$DSH_HOME/deepwidgets` pointing out is not seen (`bridge/src/main.ts:41`); use `realpath`.
- The cloud flag is lockout-gated (MUST-FIX 2); the local file is not.

### 6. Secrets, audit rows, credential compare: partial
- Credential compare holds: SHA-256 of the presented value, then a padded constant-time compare (`worker/src/core.ts:51-63`), before the DO is addressed (`worker/src/index.ts:36`).
- Audit rows hold: fixed columns, no args, no results (`worker/src/relay.ts:46-51,132`). The bridge logs only the id, code and reason (`bridge/src/main.ts:146`). The credential travels only in the Authorization header (`bridge/src/main.ts:155`). No `console` call in worker/src.
- Partial: the local error text goes verbatim to the remote caller and the bridge log (`bridge/src/local.ts:175`, `worker/src/mcp.ts:44`, `bridge/src/main.ts:146`), so an exception can carry paths or widget data.
- Partial: calls refused before the DO leave no audit row (`worker/src/mcp.ts:32-37`).

## MUST-FIX before a public deploy
1. Fix the tool surface to match the must-have. Delete `widget_changes` from `TOOL_SCOPE` (`worker/src/core.ts:11-16`), `TOOL_SPECS` (`worker/src/tools.ts:34-37`), `InteractTool` (`worker/src/assertion.ts:6`), `ALLOWED_TOOLS`/`SCOPE_OF` (`bridge/src/allowlist.ts:5,13`) and the INTERACT list (`e2e/run.test.ts:21`), and offer `deepwidgets_modes` (scope `widgets:read`, no args) through the same four places. If the owner prefers `widget_changes`, amend the must-have instead; do not ship the mismatch.
2. Remove the global lockout ceiling from the owner path. `LOCKOUT_GLOBAL=50` is shared by all IPs (`worker/src/core.ts:73,86-88`), so about 10 sources, or a few IPv6 /64 hosts, lock the owner out of /authorize and /admin including `/admin/kill` for 15 minutes, repeatedly. Fix: drop the `live.length >= LOCKOUT_GLOBAL` term at `worker/src/core.ts:88`; key per IP (IPv6 by /64); do not count or enforce lockout on the kill path (`worker/src/admin.ts:24,66-69`), where the passcode is already 128-bit.
3. Make `gid` and `sub` enforced. In `bridge/src/assertion.ts:89` require `isString(c.gid) && c.gid !== ''` and `c.sub === 'owner'`; read an optional deny-list file beside the kill file and fail `grant denied locally` for a listed gid; log `gid` in the call event (`bridge/src/main.ts:146`). Otherwise remove `gid` from the claim set.
4. Pin that `/mcp/token` is never forwarded. Test `mcpFetch` for `/mcp/token` and `/mcp/x` directly (`worker/src/mcp.ts:66`) and check the deployed 404; today only the library's prefix match plus one line protects it.
5. Refuse loopback redirect URIs at client creation (`worker/src/admin.ts:38-48`) unless the owner passes an explicit flag; the library ignores the port for them.

## SHOULD-FIX
- Atomic lockout: `locked` then `fail` are two RPCs (`worker/src/authorize.ts:71-75`, `worker/src/lockout.ts:14-19`), so a parallel burst passes the check together. Add one `attempt(ip)` method that counts first and refunds on success.
- `clientIp` falls back to a shared `unknown` bucket (`worker/src/core.ts:92`); fail closed or use one bucket per surface.
- Audit denied calls (`worker/src/mcp.ts:32-37`) with the outcome code only.
- Replace local error text with a fixed message before it leaves the bridge (`bridge/src/local.ts:175`).
- Drop `*` handling in the verifier (`bridge/src/assertion.ts:119`).
- `realpath` the kill file (`bridge/src/main.ts:41`).
- Unauthenticated GET /authorize writes a consent handle per request (`worker/src/authorize.ts:45`); rate-limit it.

## What the e2e does not prove
- `e2e/run.test.ts:171`: only the relay's tool list is checked; no signed assertion for an install/reload tool is ever sent to the bridge, so the bridge-side refusal (`bridge/src/assertion.ts:101`) is unit-test only, and the stub is not the real server (`e2e/run.test.ts:75`).
- `e2e/run.test.ts:188`: shows the Worker 404s `/mcp/token`; says nothing about the bridge's own use of it or the proof check.
- `e2e/run.test.ts:235`: a 15 s sleep does not show the Durable Object actually hibernated.
- `e2e/run.test.ts:250`: settings.json flips are made against the stub, which does not read them the way the real server does, and the cloud flag's independence is not shown.
- `e2e/run.test.ts:264`: the no-args check only searches for one string; it neither scans bridge or wrangler logs (the bridge log is discarded at `e2e/run.test.ts:124`) nor covers denied calls.
- `e2e/run.test.ts:295`: accepts three different outcomes, so the DO `grant-revoked` path may never run; `e2e/run.test.ts:298` reads a row that `revokeGrant` writes itself (`worker/src/relay.ts:165`), proving nothing about refusals.
- `e2e/run.test.ts:301`: covers per-IP lockout only. The global ceiling, the window expiry, /authorize lockout and the owner-lockout attack are untested.
- Never exercised: replayed jti, expired or forged assertion, wrong args hash or `gid`, PKCE or redirect mismatch, scope-limited grants, and `widget_changes`.
