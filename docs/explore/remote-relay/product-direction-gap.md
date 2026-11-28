> Update, 29 Nov 2026 IST: the first pilot has now also been run against the real deepWidgets app (CLI host, built-in `sample` widget) through the live relay. See [pilot.md](pilot.md) and [WRITEUP.md](WRITEUP.md). The table below was written after the stub pilot and before those real-app runs; rule 8 (retry applies once) now holds across a bridge restart because of the durable journal (b5–b8). The other statuses are unchanged. The "Limits of the pilot as built" paragraph at the end still correctly describes the stub e2e; it does not describe the later real-app pilot.

# Product direction vs the relay prototype: gap map

Direction read: `rohan/deepwidgets-product-direction` at d3f7700d: `docs/specs/product-direction.md`, and `docs/explore/reviews/{architecture,decision-history,design-workarounds}.md` (copies in `work/pd/`). Code cited: `prototype/` on main (paths below are relative to it). Date 2026-11-28 IST.

Rules are quoted from `product-direction.md` ("What this means for development" and "First pilot proposal"). Status is for the relay prototype only. Anything that needs the real deepWidgets app is marked **needs app**.

## Summary

| # | Product rule | Status | One-line reason |
|---|---|---|---|
| 1 | Provider-neutral action contract | **Partial** | One MCP surface forwarding the app's own four tools; no per-provider adapters; `widget_call` still mixes read and write |
| 2 | Consent shows PC, connector, widget, actions | **Partial** | Shows client, redirect, device id, scopes, widget list; no per-action list; the page is on the Worker, not on the PC |
| 3 | Owner can see, pause, revoke inside deepWidgets | **Missing** (partial outside the app) | Admin API with a passcode, plus kill and deny files on the PC; no UI in deepWidgets (**needs app**) |
| 4 | Separate grants per provider on one widget | **Met** (relay) | One grant per OAuth client, own scope and widgets, enforced twice; e2e proves it |
| 5 | Capabilities kept distinct | **Partial** | Operate (read, call) is split; screenshots, window control and code/deps are not offered at all, so none can be granted by accident |
| 6 | Choices survive restart, replacement, loss; unknown outcomes reported | **Partial** | Revocations, kill flag and local files persist; host restart handled; `outcome-unknown` and a bridge journal added; the journal is memory-only |
| 7 | Relay operator cannot mint device authority | **Missing by default; partial with an opt-in** | The Worker holds the signing key and chooses the claims; `DW_APPROVED_GRANTS_FILE` adds a device-side ceiling |
| 8 | First pilot | **Built in the prototype, against a stub** | All three parts pass in e2e; not run with a hosted provider or the real app |

## Evidence per rule

### 1. Provider-neutral action contract: partial

- Met: the relay offers the app's own tools unchanged: `widget_list`, `widget_describe`, `widget_call`, `widget_changes` (`worker/src/tools.ts:17-37`, `bridge/src/allowlist.ts:5`). The bridge forwards them to the local MCP server as they are (`bridge/src/local.ts` `forward`). Standard OAuth 2.1 and Streamable HTTP, nothing provider-specific (`worker/src/index.ts:53-68`).
- Gap: no adapter layer and no verification against a hosted provider. The e2e client is the MCP SDK. `architecture.md` in the direction repo (line 141) says provider choice is a capability matrix to verify; we did not.
- Gap: `widget_call` carries reads and writes under one description (`worker/src/tools.ts:25-33`). The review asks for separate read, mutation and operation-status tools (`decision-history.md:69`, `architecture.md:139`). Provider-side approval prompts cannot tell what a call will do.
- Proposal (**needs app**): split mutation from query in the local contract; add an operation-status tool.

### 2. Consent shows PC, connector, widget and actions: partial

- Shown: client name (self-declared) and id, exact redirect URI with a loopback warning, device id, scopes in words, and the widget list the owner types (`worker/src/authorize.ts:52-60`, `SCOPE_WORDS` at `:11`).
- Gap: the PC is an opaque `DEVICE_ID`, not a name the owner recognises (`authorize.ts:55`).
- Gap: actions are not listed. `widgets:call` covers every action of a granted widget (`worker/src/core.ts:11-16`). The direction wants "permitted actions" and effect summaries (`architecture.md:137`).
- Gap: consent happens on a Worker web page gated by the owner passcode, not in deepWidgets on the PC. The direction wants the PC to show what is proposed (`architecture.md:137`).
- Small safe fix not done: show the action names from `widget_describe` on the consent page. It needs a device round trip at consent time, and I left it as a proposal.

### 3. Owner can see, pause and revoke inside deepWidgets: missing in the app

- What exists: `GET /admin/grants`, `POST /admin/grants/:id/revoke`, `POST /admin/kill`, `GET /admin/audit` (`worker/src/admin.ts:72-91`), all behind the passcode. On the PC: the kill file (`bridge/src/main.ts:104` `killed`) and the `denied-grants` file (`:72` `isGrantDenied`).
- Gap: no UI in deepWidgets; "pause" is all-remote (kill) or one grant by editing a file. Per-grant pause is only the deny-list.
- Proposal (**needs app**): a native grants pane in Electron main that reads the grants and writes the same two files; the bridge becomes a module of Electron main, per `architecture.md` section 4 of the direction repo.

### 4. Per-provider separate grants on the same widget: met in the relay

- Grant per OAuth client: `tokenExchangeCallback` puts `grantId` and `clientId` in the token props (`worker/src/index.ts:66-69`). Scope and widgets live in the grant props set at consent (`worker/src/authorize.ts:96-98`), enforced in the Worker (`worker/src/mcp.ts` `toolsForScope`) and again by the bridge from the signed claims (`bridge/src/assertion.ts`).
- Revoking one grant leaves the other working: `e2e/run.test.ts:195`.
- Caveat: identity is the OAuth client id. A provider does not attest which model or chat made a call (`architecture.md:137` says the same). Each provider needs its own pre-registered client, because open registration is off.

### 5. Capabilities kept distinct: partial

- Operate is split into `widgets:read` and `widgets:call` (`worker/src/core.ts:11-16`, `bridge/src/allowlist.ts:11-16`). The consent page lets the owner tick each separately (`authorize.ts:47-48`). The e2e pilot proves a read-only client cannot call (`e2e/run.test.ts:155`).
- Screenshots, window control, and installing code or dependencies are not registered at all (`worker/src/mcp.ts` registers only `toolsForScope`; the bridge allowlist has four tools), so agreeing to one capability cannot grant another. There are no scope names reserved for them, so adding one later needs a deliberate scope.
- Caveat from the direction repo: `widget_call` runs widget code with full Node rights (`where-we-stand.md`), so "operate" is wider than it sounds until the permission layer exists.

### 6. Preserve choices through restart, replacement and connector loss; report unknown outcomes: partial

- Persisted: revoked grants and the kill flag live in the DO's SQLite (`worker/src/relay.ts:60-61`, written at `:179`, `:192`); OAuth grants live in KV; the kill file and deny file live on the PC.
- Host restart: the bridge re-reads the port file and handshakes again (`bridge/src/local.ts:164`, `:178`). e2e: `e2e/run.test.ts:188`, `:195`.
- Replacement: a second bridge is refused while the first answered a ping within 45 s (`worker/src/relay.ts:26`, `:99`); otherwise it replaces it with an audit row.
- Cloud kill now also closes the bridge socket and refuses reconnects until turned off (`relay.ts:178-186`).
- Unknown outcomes: a `widget_call` already sent when the socket drops or the 30 s wait ends returns `outcome-unknown` (`relay.ts:43-46`, `:87`, `:167`) with a next step that says to retry with the same `requestId`.
- Gaps: (a) the operation journal is in memory (`bridge/src/journal.ts`), so a bridge restart forgets it and a retry may apply again; (b) the local server's own `requestId` cache is memory-only and keyed by a caller that changes at each handshake (`decision-history.md:67`, `where-we-stand.md` `standing.hard.memory_only`), which the journal works around but does not fix; (c) there is no outcome-lookup tool (`decision-history.md:69`); (d) a read that cannot reach the device says `device-offline`, not "state unknown since <time>". **needs app** for (b) and (c).

### 7. The relay operator must not mint device authority unilaterally: missing by default

Honest answer: today the operator can. The Worker holds `ASSERTION_SIGNING_KEY` (`worker/src/mcp.ts:40-45`, `worker/src/assertion.ts:76`) and chooses `gid`, `scope` and `wid` in every claim. Whoever controls the Cloudflare account or the Worker secret can sign assertions for any widget except `main`, within the four tools. Worker request bodies and results are also visible to the operator.

What limits it today:
- The bridge allowlist caps the tool set at four, so there is no install or code path (`bridge/src/allowlist.ts`).
- The kill file and the `denied-grants` file are local and the operator cannot write them.
- New in this round: `DW_APPROVED_GRANTS_FILE`. When set, the bridge refuses any grant not listed on the PC, any scope not listed, and any widget not listed, and it narrows list and changes results to the listed widgets (`bridge/src/main.ts:36`, `:54`, `:176-189`; tests `test/bridge-approval.test.ts`). The operator can then only replay what the owner approved on the PC.

Still open: the owner has to write that file by hand from `GET /admin/grants`; the key and the consent page still live in the cloud; the operator can still read traffic. Proposal (**needs app**): consent and the signing key on the PC (a local authorization server, as the direction repo prefers, `architecture.md:135`), with the Worker as a plain router.

### 8. First pilot: built in the prototype

| Pilot piece | What exists | Evidence |
|---|---|---|
| Two clients with different rights on one widget | Client A: read and call. Client B: read only. B has no `widget_call` tool and a forced call changes nothing | `e2e/run.test.ts:155` |
| A useful update visible on the desktop | A `groceries add` reaches the stub; not the real desktop | `e2e/run.test.ts:174`; live smoke on workers.dev |
| Retry after a lost response applies the write once | `requestId` runs once per grant at the bridge; same id with other args is refused (`idempotency-conflict`) | `bridge/src/journal.ts`, `bridge/src/main.ts:186-194`, `e2e/run.test.ts:174`, `:182`, `test/journal.test.ts`, `test/bridge-approval.test.ts` |
| Retry after a host restart still applies once | The journal is held by the bridge, not the local caller | `e2e/run.test.ts:188` |
| Revoke one client during a host restart | Revoke and restart run together; B is refused, A still works | `e2e/run.test.ts:195` |

Limits of the pilot as built: both clients are the same MCP SDK, not "one hosted provider and an independent MCP client"; the widget is the stub's `groceries`, which does not itself deduplicate `requestId`; the "lost response" is simulated by a repeated identical call, not by dropping a real response after commit; no real deepWidgets host was involved.

## Proposals that need the real deepWidgets app

1. Grants pane in Electron main: see, pause per grant, revoke; bridge as an Electron-main module.
2. Consent on the PC naming the PC, the connector, the widget and the actions.
3. A device-held signing key or local authorization server so the relay cannot mint authority.
4. Separate read and mutation tools plus an operation-status lookup; durable `requestId` storage keyed by a stable grant identity instead of a per-handshake caller.
5. Reserve scope names for screenshots, window control and code or dependencies before any of them is built.

## Open questions for Rohan

1. Is the opt-in device-side approval file (rule 7) the right interim, or should consent and the signing key move to the PC before any wider use?
2. Should consent list the actions of a widget (a device round trip at consent time), or is a per-widget grant enough for the first pilot?
3. For the pilot, which hosted provider and which independent client should be the two clients?
4. Where should "pause" live: all remote access (the kill), one grant (the deny-list), or both with a visible state?
