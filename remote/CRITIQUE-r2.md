# Round-2 critique of architecture.md (reviewer: Sonnet)

Scope: `architecture.md` round 2 (412 lines) against `critique-r1-sonnet.md` and the `.d.ts` files in
`/workspace/deepwidgets-remote-access/prototype/node_modules`. Library paths below are relative to it.

## Verdict

Much better: every round-1 blocker has a real fix in the text, and I re-checked the library facts it cites (they hold).
Not yet ready for a one-pass build: one API assumption is impossible (`grantId` in props), one input does not exist
(`timeoutMs`), and section 14 drops two things sections 5-7 promise (device revoke, audit rows). All are small edits.

## 1. Round-1 items

Blocking items. Verdicts are "was it fixed in the text".

1. **yes.** `createMcpHandler` from `agents/mcp/server` (`architecture.md:9`, `:324`, `:363`), `@modelcontextprotocol/server` 2.4.0
   pinned, `nodejs_compat` at `architecture.md:340`. Matches `agents/dist/mcp/server/index.d.ts:15`. Residual: see N5.
2. **yes.** `/mcp/token` is 401 without a token and 404 with one (`architecture.md:10`, `:132`, `:406`). Prefix match confirmed
   (`oauth-provider.js:3406` is `=== normalized || startsWith(normalized + "/")`); the handler's exact route is at `handler-stateless-B5hU3dxK.js:308`.
3. **yes.** `resourceMetadata` built from `env.PUBLIC_URL`, CIMD off (`architecture.md:11`, `:362`). `@cloudflare/workers-oauth-provider/dist/oauth-provider.d.ts:1153`
   and `:1133-1136` agree.
4. **yes.** `wid` filtering of `widget_list` / `widget_changes`, `widget_describe` refusal, and the `secret` fixture
   (`architecture.md:12`, `:178`, `:378`, `:387`, `:398`). Good: the e2e asserts all three reads.
5. **yes** for what I asked: `revokeExistingGrants: false`, two-argument `revokeGrant`, `new OAuthProvider` (`architecture.md:13`, `:365`).
   But the same line puts `grantId` in props, which cannot work (N1). That was in round 1 too; I missed it.
6. **yes.** Lockout, 128-bit passcode, fail-closed, constant-time on `/admin/*` (`architecture.md:14`, `:180`, `:366`, `:411`).
   The global lockout has a side effect (N6).
7. **yes.** Own-clock `iat`/`exp`, no `serverTime`, and a test with a skewed `hello` (`architecture.md:15`, `:195`, `:375`, `:397`).

Items Opus marked Partly or Rejected (`architecture.md:17-37`):

- **`/admin/audit` kept (`architecture.md:22`): accept, with one condition.** One read-only GET is cheap, and suite B needs it.
  But the owner cannot revoke without a `grantId`, and `/admin/grants` is gone. Either the consent writes an audit row with the
  `grantId` (it does not today, N3), or restore a 5-line `GET /admin/grants` over `listUserGrants`.
- **Bridge replacement stays newest-wins (`architecture.md:30`, `:230`, `:368`): push back.** Newest-wins makes credential theft
  work: the thief connects, the real bridge is dropped, the thief gets every call's args (`architecture.md:238`). Counting
  `bridge-replaced` only tells you afterwards. The half-open-socket worry is answerable cheaply: the DO can read the last auto-pong
  time with `getWebSocketAutoResponseTimestamp` (`@cloudflare/workers-types/index.d.ts:653`); refuse a new socket while the old one
  answered a ping in the last ~45 s (the bridge pings every 20 s, `architecture.md:376`). A dead socket loses within 45 s; a live one wins.
- **Default-off via `DW_REMOTE_HOURS` (`architecture.md:31`, `:374`): partly accept.** "Off unless the bridge runs" is true only
  because the Phase 0 bridge is a hand-started daemon; it says nothing about the product, which is Q6. The 8 h limit is enforced by the
  honest bridge only: a stolen credential can run a bridge forever, and grants live 30 days (`architecture.md:216`). Say so in the
  README, or add one DO field `enabledUntil` that `/admin/kill` sets (about 6 lines).
- **SDK 1.32.2 stub (`architecture.md:34`, `:311`, `:373`): partly accept.** Fine for the Worker side, which uses the v2 server.
  The seam that stays unproven is bridge (1.32.2 Client) to real deepWidgets (v2). The smoke run is placed "before Phase 1"
  (`architecture.md:34`, `:279`), yet Phase 0 is "done" when Claude Code edits a real widget on Rohan's PC (`architecture.md:278`), so
  the smoke run is already inside Phase 0 (N4). Say that, and consider the v2 `@modelcontextprotocol/client` in the bridge (round 1 found it installed; re-check).
- **DCR-only negative e2e rejected (`architecture.md:36`): accept.** With no `registration_endpoint` the `/register` check at
  `architecture.md:407` already proves it. What remains is not a test but a Phase 0 manual try: does Claude Code connect with a
  pre-registered client? The provider lets loopback redirect ports vary (`oauth-provider.js:5495-5501`), so that part is fine.

## 2. New problems

- **N1. `grantId` in props is impossible.** `architecture.md:143` and `:365` pass `grantId` to `completeAuthorization`, but
  `CompleteAuthorizationOptions` has no such field (`@cloudflare/workers-oauth-provider/dist/oauth-provider.d.ts:1535-1571`): the
  provider mints it inside. `grantId` is exposed only to `tokenExchangeCallback` (`@cloudflare/workers-oauth-provider/dist/oauth-provider.d.ts:824`,
  option at `:1084`), which can return `accessTokenProps` (`:744`). Without it the DO's revoked set, the assertion `gid`, and the
  e2e "revoke -> `grant-revoked` at once" (`architecture.md:409`) have nothing to key on. Gate 2 uses a test-only grant, so it hides this until gate 3.
  `architecture.md:332` ("all names checked") is therefore too strong.
- **N2. Where does `timeoutMs` come from?** `architecture.md:147`, `:369` (`min(timeoutMs + 5 s, 60 s)`), `:376`. It exists only in
  `widget_describe` output (`ref/deepwidgets/mcp/src/index.ts:913`); `widget_call` input has none, and `meta` is undefined in
  `architecture.md:369`. Simplest fix: DO waits a fixed 60 s; the bridge describes the widget once, caches the action's `timeoutMs`, and times out locally.
- **N3. Section 6 promises more audit than section 14 builds.** `architecture.md:231` audits consent, revocation, kill, lockout and
  bridge connect. Section 14 writes a row only per call and `bridge-replaced` (`architecture.md:368-369`); consent runs in the Worker
  (`architecture.md:365`) and lockout lives in a different DO (`architecture.md:341`). Cut the sentence to what exists, or name the RPC that writes each row.
- **N3b. Device revocation is promised but not specced.** `architecture.md:206` and `:238` say device revoke deletes the hash and re-pair rotates,
  but the admin list at `architecture.md:366` has only mint, and `provision` refuses a second mint (409). A lost credential cannot be replaced.
  Section 14 also omits the bridge-side 120/min ceiling and the 64 KiB args check from section 5 (`architecture.md:180`, `:373-378`).
- **N4. Contradiction on the real-server smoke run.** `architecture.md:34` and `:279` put it in Phase 1; `architecture.md:278` makes real-PC use the Phase 0 exit.
- **N5. `getMcpAuthContext()?.props` is untyped and may be undefined.** It is `Record<string, unknown>` under `McpAuthContext`
  (`agents/dist/handler-stateless-C90kD5_R.d.ts:10-13`). `architecture.md:363` passes it straight to `buildServer`; spec a runtime shape check and
  zero tools when it is missing. The handler also applies default `Host` / `Origin` allowlists (`agents/dist/handler-stateless-C90kD5_R.d.ts:25-37`);
  set `allowedHostnames` from `PUBLIC_URL` and add one suite B request with an `Origin` header.
- **N6. The lockout can be turned on the owner.** One global counter per surface (`architecture.md:180`, `:411`) means anyone who finds the URL can
  lock `/admin/*` for 15 minutes, repeatedly, which also locks the cloud kill switch and revoke (`architecture.md:366`) during an attack. Only the local kill file remains, and that needs the PC.
  Add a break-glass line to the README (`wrangler delete`, or rotate the signing key) and key the counter by IP with a global fallback.

## 3. MVP size

It is close to minimal for the must-haves (interact-only, `/mcp/token`, PKCE, CIMD or pre-registered, no open DCR, assertion,
kill switch, `settings.json`). Still over-built for one owner, one device, one agent:

- **Device MAC and `/admin/devices` mint (`architecture.md:158`, `:366`, `:412`).** For one device, put the credential hash and device id in Worker
  secrets: no mint endpoint, no `DEVICE_ID_KEY`, no `provision`, no forgery e2e. Not a must-have; return in Phase 1 with pairing. Biggest cut.
- **DO rate buckets and the 4-in-flight cap (`architecture.md:180`, `:369`).** DoS is not a must-have. Keep the one bridge ceiling.
- **`slow` action, stub requestId cache and the retry test (`architecture.md:387`, `:409`).** `outcome-unknown` is not a must-have. Keep `/__stub/fault` 502/503 (cheap).
- **Two grants on one client test (`architecture.md:410`).** Phase 0 has one device. Keep the one-line `revokeExistingGrants: false`.
- **Keep, because they carry a must-have:** Ed25519 and all assertion negatives, both kill switches, the literal allowlist, `wid` filter,
  the `settings.json` flip test, the cookie-jar PKCE flow, the `/mcp/token` 401/404 pair, the lockout (once N6 is fixed) and the hibernation idle test (auth must survive it).

## 4. Open questions

Edits to the eight at `architecture.md:296-303`:

1. Good and well framed. Reword the tail: "if no, Phase 0 stops at a local-only demo", so the cost of "no" is visible.
2. Split into (a) which account and subdomain, (b) may we deploy. Add a third part: use a fresh, dedicated Cloudflare account, because one account guards every device (`architecture.md:309`).
3. Reword as a request ("send the list of installed widgets"), and add "which of them render free text" (`architecture.md:241`).
4. Merge into Q3, or drop. Q3's empty grant list already covers it; "refuse to start" needs the bridge to tell who authored a widget, and nothing shows deepWidgets exposes that. Verify first.
5. Replace. The passcode-vs-hardware-key choice is mine to make (passcode for Phase 0). Ask instead: "if an attacker locks you out of `/admin`, is deleting the Worker from the dashboard an acceptable kill switch?" (N6).
6. Reword and split. The Phase 0 daemon is already decided (hand-started, 8 h). The real question is Phase 1: "ships remote access off until the owner turns it on, and for how long?"
7. Reword to a data question: "which widgets' data may pass through Cloudflare in plaintext?" Add: Worker logs and `wrangler tail` must not record args (`architecture.md:247`).
8. Drop from this list, or replace. It is a Phase 2 plan, not a decision. Put in its place the product question from `architecture.md:307`: is "agents drive widgets you already installed" worth shipping without a draw path?

## 5. Top residual risks (plain words, for Rohan)

1. Even "interact only" runs code. An agent can only use widgets you allow, but a widget that has a bug, or that an agent wrote, can still be abused by a stranger who gets a valid grant. Allow only widgets you wrote yourself.
2. One Cloudflare account and one passcode guard everything. If someone takes that account, they can send valid commands to every paired PC, though not install code. The lockout can also be used against you to block the kill switch, so write down a break-glass step.
3. A stolen device credential lets a thief take over the PC's connection, and today the newest connection wins. An 8-hour limit only stops the honest bridge, not a thief.
4. Our tests run against a copy of deepWidgets, not the real one, and the copy uses an older MCP library. All tests can pass and the first real run on your PC can still fail. Revoking a grant, the thing you would reach for in an incident, may not work as drawn (N1) until the OAuth gate is tested.
5. We do not know that Claude Code, claude.ai or ChatGPT will connect at all. Pre-registered clients only, no open registration, no CIMD yet: a vendor connector that needs one of those will simply fail. Phase 0 only promises Claude Code.
