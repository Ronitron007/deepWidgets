# Remote relay: why this exists, what was built, and where I think the product should go

29 Nov 2026, Asia/Calcutta (IST). Written by the agent that designed and built this prototype for Rohan, after the first pilot against the real deepWidgets app. Start here. The design itself is in [architecture.md](architecture.md). The rule-by-rule map to [docs/specs/product-direction.md](https://github.com/Ronitron007/deepWidgets/blob/rohan/deepwidgets-product-direction/docs/specs/product-direction.md) on branch `rohan/deepwidgets-product-direction` at `d3f7700d` (that file is not on `main` yet) is in [product-direction-gap.md](product-direction-gap.md). The real-app pilot is in [pilot.md](pilot.md). Reviews are in [reviews.md](reviews.md). The code is the self-contained tree at [`remote/`](../../../remote/).

Live preview, on the kyaloon Cloudflare account, workers.dev only, no DNS change: https://dw-relay.round-mud-a9b3.workers.dev

This pull request is a proposal and a working prototype. **Do not merge it without Rohan.** It does not change the deepWidgets app, the root build, or the pnpm workspace. The documents under this folder, and the prototype README in `remote/`, are English-only for this proposal; they are listed as pairing exclusions in `scripts/translation-pairing.manifest.json` so they do not fail the bilingual doc gate. If this work is adopted into standing docs, it should be paired then.

## Why this work happened

Rohan asked how any agent could reach the widgets on his PC if deepWidgets is already running locally, and wanted a cloud architecture for that: auth, permission, no casual tunneling of the loopback server, using Cloudflare. He pointed at `rohan/deepwidgets-product-direction` as the general direction and said to build without his supervision.

The product direction is short and I think it is right. deepWidgets is a desktop of widgets that live on a person's PC. A compatible agent, from somewhere else, should be able to reach a selected PC through MCP. The person who controls that PC chooses which widgets the connection may see and what it may do. The same widget can serve several providers under separate grants, which the owner can inspect and revoke in deepWidgets. Widgets keep working locally when the PC is offline.

The first proposed pilot in that document is also the right test: two clients, different rights on one trusted widget, a useful update visible on the desktop, revoke one client during a host restart, and a retried operation after a lost response that applies the write once.

I built a working path all the way through a live Worker, rather than only a design, because the interesting failures (the loopback token endpoint, grant lag, retry across a bridge restart) only show up when something is actually running.

## What I built

A small **bridge** on the PC opens an outbound WebSocket to a **Cloudflare Worker**. Each device has one **Durable Object** that holds that socket (hibernation API). Remote agents never talk to the PC. They talk standard remote MCP to the Worker, sign in with OAuth 2.1 and PKCE, and may only use four tools: `widget_list`, `widget_describe`, `widget_call`, and `widget_changes`.

Every allowed call carries a short-lived **Ed25519 assertion** that the Worker signs and that the bridge verifies again on its own clock, with the tool name taken from the assertion, not from the frame. There is a **cloud kill switch** (it also drops the socket) and a **local kill file**, both outside deepWidgets' agent-writable `settings.json`. A local deny-list can block a grant even if the cloud still thinks it is valid.

A **stub** of the local MCP server, unit tests, and an end-to-end path (MCP client → OAuth → Worker → Durable Object → bridge → stub) were built first. Then the same bridge was pointed at a **real deepWidgets CLI host** and the first pilot was run through the live relay. The real app needed no changes. 170 unit tests and 22 end-to-end tests pass.

The prototype lives in `remote/` and has its own `package.json`. It is not wired into the repository workspace, so `pnpm` at the repo root should not start building or testing it.

## The decisions, and why

### A relay, not a tunnel

A per-device `cloudflared` tunnel, with Access in front, looks like the obvious Cloudflare answer. I rejected it.

The local MCP server binds `127.0.0.1` and hands an unscoped bearer to any loopback caller at `POST /mcp/token`. A tunnel makes `cloudflared` a loopback peer. Anyone who got past Access would be able to mint local tokens, unless a second interact-only gateway sat on the PC anyway. Access also cannot see MCP tool names, so it cannot do per-widget or per-tool permission.

The ops and cost story is worse. Named tunnels need DNS and a domain, which Rohan did not want for this preview (`workers.dev` is enough). At 100k devices, unused tunnels still bill: on the order of $445k/month. The relay design is about $5/month for one owner, and a few hundred dollars a month at 100k devices.

So the PC dials out. There is no inbound port, no tunnel, and no DNS change. The Worker is a normal remote MCP server. The price is a stateful hop (the Durable Object) and the need for the PC to be online; I do not queue work while it is away. Offline-queued mutations against a desktop you cannot see felt like the wrong first product.

### Interact-only

Widget host code runs unsandboxed, with full Node rights. A remote `widget_install` would be remote code execution. The product direction already treats "introducing code or dependencies" as a different capability from operating a widget. The remote path therefore does not register install, reload, remove, template, or guide tools, and the bridge will refuse them even if a buggy or compromised Worker asks.

That is a narrower product than "agents draw widgets on people's computers." I still think it is the right first ship. Driving widgets the owner already installed is useful on its own (the grocery example in the product direction is exactly that), and it does not require solving remote authoring or a sandbox. A later "draw" path should be a separate capability, probably a data-only canvas, not a remote install of host code.

`widget_call` is still a blunt tool: it can read or write, depending on the action. That is a real gap against "keep capabilities distinct." I would split read and mutation, and add an operation-status lookup, in a later pass.

### Signed assertions, checked again on the PC

Permission has to be enforced twice. If only the Worker enforces it, a bug or a compromised Cloudflare account can widen access to the PC. If only the PC enforces it, a stale or confused client might be let through by a local path that was built for trusted loopback tools.

So the Worker signs a short-lived assertion (tool, args hash, scope, widgets, client, grant, expiry, one-time id) and the bridge verifies the signature, the time, the tool, and the grant before it touches deepWidgets. The bridge ignores the Worker's clock and uses its own.

This is necessary, and it is not sufficient. Today the Worker holds the signing key, so whoever runs the Worker can still mint a valid assertion. That is the most important honest gap in this design. See below.

### Kill switches outside `settings.json`

A local agent can write deepWidgets settings. A kill switch that lives only there can be turned off by the same class of caller the switch is meant to stop. The cloud flag and the local file sit outside that tree. The cloud kill also drops the socket so a connected bridge cannot keep serving. This matches the direction's "the PC owner can pause and revoke," but only as infrastructure. The owner still cannot do it from inside the app.

### OAuth 2.1, pre-registered clients, no open sign-up

Remote agents are ordinary OAuth clients: authorization code, PKCE, no dynamic client registration. Open registration would let anyone create a client and start an authorize flow against the owner's relay. Clients are created with `/admin/clients`. Loopback redirect URIs are refused unless they are explicitly allowed, which is what the local e2e tests use.

There is one owner passcode on the consent page. That is fine for a preview with one operator. It does not scale to a product where each PC owner is a different person, and it is a single secret that guards admin as well. Moving consent onto the PC removes most of that pressure.

### A durable journal on the bridge

The product direction says a retried operation after a lost response must apply once, and that the owner should be told when an outcome is unknown. The real app already dedupes `(caller, requestId)` and persists it. That almost works, except the caller id is the per-handshake `agentId`. Every time the bridge reconnects, it is a new caller. In the memory-only journal run, a retry after a bridge restart applied twice (count 28→32). That is run-2 in [pilot.md](pilot.md).

I did not change the app (the brief for the pilot was to leave it alone unless a tiny, documented proposal was required). So the bridge now records each `widget_call` in an opt-in file (`DW_JOURNAL_FILE`) before it dispatches: at most once, fail closed if the file cannot be written, keep the reservation when the outcome is ambiguous, and do not treat a `timeout` as "this certainly did not write." A retry then gets the stored answer, or `outcome-unknown`, and is not applied again. Final pilot run-7 passed, including across a real host restart and a bridge restart.

I still think the **app** should be the authority, with a stable device-and-grant identity over the authenticated loopback. The journal is a correct cache and a necessary belt for this prototype. It should not stay the source of truth.

## How this maps to the product direction

The full table is in [product-direction-gap.md](product-direction-gap.md). In short:

- **Met, at the relay:** separate grants per client on one widget, enforced on the Worker and again on the bridge; the first pilot's rights, update, revoke-during-restart, and retry-applies-once steps, now also against the real app; preserve a "I do not know what happened" outcome (`outcome-unknown`, and the app's own `resultLost`).
- **Partial:** the action contract is the app's own four tools, with no per-provider adapters, and `widget_call` still mixes read and write. Consent shows client, redirect, device id, scopes, and the widget list, but not per-action names, and the page is on the Worker, not on the PC. Screenshots, window control, and code or dependencies are simply not offered, so they cannot be granted by accident, but they are not yet modeled as named capabilities.
- **Missing, and it needs the app:** the owner cannot see, pause, or revoke grants *inside deepWidgets*. There is an admin API with a passcode, plus kill and deny files on the PC. That is not what the direction describes. Consent does not name the PC in the way a person would recognize it. And the relay, as operator of the signing key, can in principle grant itself access.

The direction's line about "the current loopback MCP endpoint… serve[s] local development. Remote permissions… belong in the complete permission-layer design" is the one I have come closest to stretching. I built a remote permission layer *beside* the app, not in it, so the pilot could run now. I think that was the right order for a preview. I do not think it is the right place for those controls to stay.

## How I see the product's direction

I would keep the product direction's core almost word for word. The thing worth protecting is this: **the PC is the home of the widgets, and the owner of that PC is the only person who can hand out, pause, or take back a remote grant.** Providers are guests with separate, narrow agreements. Compatibility with ChatGPT, Claude, Gemini, or some future MCP client is an adapter problem, not a reason to change the widget action contract. Local use must keep working when the network is gone.

If I were steering the next six months, I would sequence it like this.

1. **Operate what is already installed,** through a relay like this one, with the four interact tools, for one owner and a small number of clients. That is this prototype, cleaned up and with the app-side grants pane and device-held signing described below. This is the grocery-list-from-the-phone product.
2. **Make the PC the authority.** Consent happens on the PC. The signing key never leaves it, or the PC is the authorization server and the Worker is only a relay and a presence front. Grants are visible in deepWidgets, next to the widgets they refer to. Retry identity is stable across bridge restarts and token renewals, in the app's own store.
3. **Only then** consider a "draw" path, screenshots, or window control, each as its own capability, each with its own consent. I would not let a grant to add a grocery item grow into a grant to install code or look at the screen.

I would not build a per-user Cloudflare tunnel product. I would not put open dynamic client registration on a personal relay. I would not queue mutations for a desktop that is asleep. I would not treat "the Worker is on my account, so the signing key is fine" as a long-term answer, even though it is an acceptable risk for this preview.

## Where I disagree, or would slow down

A few candid points, including where I would not follow a reading of the direction all the way, or where I think the prototype overreaches.

- **The Worker must not remain the issuer of authority.** The direction's reviews are clear that the relay operator should not be able to grant itself access to the PC. This prototype fails that test. I shipped it anyway, with a local deny-list and a local kill file as a stopgap, because otherwise there was no way to run the pilot on a real host. I would not call this production-ready for anyone who does not also operate the Worker, and I would not open it to a second operator's Cloudflare account until signing moves to the PC.
- **A grants pane in the app is not optional polish.** An admin passcode on a Worker URL is not "the PC owner can inspect and revoke those grants in deepWidgets." I would not expand the cloud admin UI further. I would put the time into the app.
- **The pilot clients are not yet "one hosted provider and an independent MCP client."** They are two pre-registered OAuth clients using the same SDK, with different scopes. That proves grants and rights. It does not prove ChatGPT or Claude can actually complete this OAuth flow. That is the next compatibility test, not something I would hide behind a green pilot report.
- **"Lost response" in the pilot is still simulated.** The runner waits for the first reply, then retries. The journal and the app's dedupe should make a real drop safe; we have not demonstrated it. I would rather say that plainly than claim the product rule is fully proven.
- **Interact-only will feel thin to anyone who wanted agents to create widgets.** I would still not relax it. The direction already separates that capability. The temptation will be to "just allow install for the owner's own agent." I would treat that as a new, explicitly named capability with a louder consent, or not at all until there is a sandbox.
- **I would not wait for a perfect journal.** OS locks, directory fsync, tombstones, and encrypting results on disk are real improvements (Codex listed them). They are not the reason to hold the preview, and they are not a substitute for moving dedupe into the app.

## What is not done

- App changes: none. The three proposals below are write-ups only.
- Device-held signing, or a local authorization server.
- Consent on the PC that names the PC, the connector, the widget, and the actions.
- Per-provider adapters; a hosted-provider client in the pilot.
- Split of `widget_call` into read vs mutation, and an operation-status lookup.
- iPhone / PWA path (sketched in the architecture, not built).
- Multi-device and multi-owner product surfaces. The Worker is one owner, one device.
- The leftover hardening items in [reviews.md](reviews.md): journal file-safety and plaintext results, control-directory permissions, a real dropped-response pilot, a still-valid-bearer revoke test, qualifying the Worker's "applied once" text (needs a redeploy), single-use refresh tokens, per-grant rate limits.
- Redeploy after b7, b8, and the `=== true` fix: not done, and not needed for those patches, which are bridge-only. The live Worker is the earlier `outcome-unknown` deploy.

## Proposed changes to the deepWidgets app

I have not made these changes, and this pull request does not contain them. If they are worth doing, they should be their own briefs against the product direction.

1. **A stable operation namespace (device + grant) over the authenticated loopback.** The app already persists `(caller, requestId)` and returns `resultLost` when it must. If the caller id were the remote grant (or a device-and-grant pair) instead of a fresh handshake `agentId`, retries would dedupe across bridge restarts in the place the write actually happens. The bridge journal becomes a cache.
2. **Keep that caller id across token renewal.** Today a token refresh is, or can be, a new handshake and a new caller. A loopback-only bind, held by the bridge, should keep the operation identity stable and still let `agentId` be used for attribution in the change feed.
3. **A grants pane in the app, with pause and revoke,** and consent that names the PC, the connector, the widget, and the actions. The signing key, or the authorization server, should live on the PC. The Worker then relays and forgets how to mint authority. This is the change that actually matches the product direction.

## Open questions

These are for Rohan. They are the same questions I would want answered before this is more than a preview on one account.

1. Is the local deny-list and kill file enough of a stopgap to keep using a Worker-held signing key for a personal preview, or should consent and signing move to the PC before anyone else is invited to connect?
2. For the next compatibility test, which hosted provider and which independent client should be the two clients?
3. Should consent list the actions of a widget (that needs a device round trip at consent time), or is a per-widget grant enough for a first real user?
4. Where should "pause" live in the UI: all remote access, one grant, or both, with both kill states visible in one place?
5. Is "agents drive widgets you already installed" enough to show people, or does the first external demo need a draw path?
6. Should the three app changes above be written up as a formal unit brief on a later branch?

The preview relay will stay up until you say otherwise. It is a development Worker on workers.dev, not a production service.
