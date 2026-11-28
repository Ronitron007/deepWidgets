# deepWidgets remote access prototype

This folder is a self-contained prototype of a Cloudflare relay that lets a remote agent reach widgets on one PC. It is **not** part of the repository pnpm workspace or the root build. Install and test it from this directory with npm (Node 24+):

```sh
npm ci
npx tsc --noEmit
npx vitest run          # unit tests
npm run e2e             # local Worker + stub + bridge
```

Do not put secrets, `.dev.vars`, device credentials, or passcodes in this folder. `worker/.dev.vars.example` lists the names only.

The design writeup, product-direction gap map, real-app pilot report, and review outcomes are in [`docs/explore/remote-relay/WRITEUP.md`](../docs/explore/remote-relay/WRITEUP.md). Live preview (workers.dev, kyaloon account): https://dw-relay.round-mud-a9b3.workers.dev

---

Spec: `ARCHITECTURE.md` section 14. Facts about the real local server: `MAPPING.md` and `ref/` (read-only).

## Stub of the local deepWidgets server

```sh
DSH_HOME=/tmp/dsh STUB_PORT=0 npx tsx stub/src/server.ts
```

- Binds `127.0.0.1` (`STUB_PORT=0` picks a free port) and writes `$DSH_HOME/deepwidgets/mcp.json` `{ port, nonce, pid, started }` (0600 in a 0700 folder).
- `POST /mcp/token { agent, challenge }` returns `{ token, agentId, proof }`, where `proof` = hex HMAC-SHA256 keyed by the nonce over the challenge.
- `/mcp` is a stateless Streamable HTTP MCP server. It needs `Authorization: Bearer <token>` and registers the 11 real tool names. The fixture widget is `groceries` (actions `add {item}` and `list`). The tools refuse `main`.
- Test hooks (loopback only): `GET /__stub/calls`, `POST /__stub/restart` (new nonce and epoch, earlier tokens void).
- In tests: `startStub({ dshHome, port: 0 })` gives `{ port, close(), calls(), restart() }`.

## Bridge

```sh
DW_WORKER_URL=https://dw-relay.<subdomain>.workers.dev \
DW_DEVICE_CREDENTIAL_FILE=~/.deepwidgets-bridge/credential \
DW_ASSERTION_PUBLIC_KEY='{"kty":"OKP","crv":"Ed25519","x":"..."}' \
DSH_HOME=/tmp/dsh \
npx tsx bridge/src/main.ts
```

- Connects to `${DW_WORKER_URL}/device/connect` (http becomes ws, https becomes wss) with `Authorization: Bearer <credential>`. If the connection drops, it connects again after a jittered delay of 1 s to 30 s.
- Frames: the relay sends `{ type: 'hello', deviceId }` and `{ type: 'call', id, assertion, argsJson }`. The bridge answers `{ type: 'result', id, ok: true, result }` or `{ type: 'result', id, ok: false, error: { code, message } }`. The error codes are `assertion-rejected`, `killed-locally`, `local-unavailable` and `local-error`. The bridge sends a literal `ping` every 20 s; the relay answers `pong`.
- Clock: the bridge ignores any `serverTime` in `hello` and checks `iat` and `exp` on its own clock.
- Reads: `widget_list` and `widget_changes` results keep only the widgets in the signed `wid`; `widget_describe` outside `wid` is refused.
- Local timeout: 10 s, then `local-error` (the relay waits 30 s, then `device-timeout`).
- Time box: `DW_REMOTE_HOURS` (default 8). When it runs out, the bridge exits. This only stops an honest bridge: a stolen credential can run its own bridge, so rotate `DEVICE_CREDENTIAL_SHA256` if the credential leaks.
- Each call must have a valid Ed25519 assertion (`bridge/src/assertion.ts`). Only `widget_list`, `widget_describe`, `widget_call` and `widget_changes` can get through (`bridge/src/allowlist.ts`). The bridge takes the tool name from the assertion, never from the frame.
- Grant deny-list: `DW_DENIED_GRANTS_FILE` (default `denied-grants` beside the kill file), one grant id per line; a listed grant gets `grant-denied-locally`. A missing file is empty; an unreadable one denies everything. The verifier also requires `sub: owner` and a non-empty `gid`.
- Local failures leave the bridge only as a fixed message per code (`local-unavailable`, `local-error`); the detail stays in the local log.
- Kill switch: while `DW_KILL_FILE` exists, the bridge refuses every call. The default is `~/.deepwidgets-bridge/KILL`. The file must not be under `$DSH_HOME/deepwidgets` and must not be `settings.json`.
- Durable requestIds: `DW_JOURNAL_FILE` (unset: memory only). When set, `widget_call` runs with a `requestId` are at-most-once across a bridge restart: a pending row is written before the call is sent, and a retry gets the stored answer (or `outcome-unknown` when the call may have written) and is not applied again. It fails closed: if the file cannot be written, or it exists but is corrupt or over 8 MiB, the bridge does not send the call and answers `local-unavailable`. Results are stored in plaintext (mode 0600, atomic write) on the PC; an answer over 16 KiB is not kept and its replay says `resultLost`. The file must be outside `$DSH_HOME/deepwidgets`.
- The bridge never logs the device credential, the local bearer tokens or the nonce.

## Relay Worker (`worker/`)

`dw-relay`: OAuth 2.1 (`@cloudflare/workers-oauth-provider`) in front of a stateless remote MCP server at `/mcp` (`createMcpHandler` from `agents/mcp/server`), and the `DeviceRelay` Durable Object that holds the bridge WebSocket (hibernation API). One owner, one device.

- `/mcp` offers only `widget_list`, `widget_describe`, `widget_changes` (scope `widgets:read`) and `widget_call` (scope `widgets:call`). Each call signs an Ed25519 assertion (`worker/src/assertion.ts`) that the bridge verifies. Relay error codes: `remote-disabled`, `grant-revoked`, `device-offline`, `device-timeout`, `widget-not-granted`, `args-too-large`.
- `/authorize`: the consent page (client id and name, exact redirect URI, scopes, device, widget list). Allow needs the owner passcode. There is no dynamic client registration: create clients with `/admin/clients`.
- `/device/connect`: the bridge WebSocket. The Worker compares the SHA-256 of the bearer credential with `DEVICE_CREDENTIAL_SHA256` in constant time. When a bridge is already connected and answered a ping in the last 45 s, a new one gets 409; otherwise the new one replaces it (audit row `bridge-replaced`).
- Admin (header `x-owner-passcode`): `POST /admin/clients { client_name, redirect_uris }`, `GET /admin/grants`, `POST /admin/grants/<id>/revoke`, `POST /admin/kill { on }`, `GET /admin/audit`.
- Lockout: after 5 wrong passcodes from one key in 15 minutes (an IPv4 address, or an IPv6 /64), `/authorize` POST (and, separately, `/admin/*`) answers 429 for that key. Check and count are one atomic DO call. There is no global ceiling, so other addresses can never lock the owner out. `/admin/kill` is never lockout-gated (it still needs the passcode).
- `/admin/clients` refuses loopback redirect URIs (127.0.0.0/8, ::1, localhost) unless the body has `allowLoopback: true` (the OAuth library ignores the port for loopback); other redirect URIs must be https.
- Audit rows (newest 1000): time, client, grant, tool, slug, outcome, ms. Never args or results.

### Secrets and vars

| Name | Kind | Value |
|---|---|---|
| `OWNER_PASSCODE` | secret | at least 43 characters, e.g. `openssl rand -base64 48` |
| `ASSERTION_SIGNING_KEY` | secret | Ed25519 private JWK as JSON; the bridge pins the public half (`DW_ASSERTION_PUBLIC_KEY`) |
| `DEVICE_CREDENTIAL_SHA256` | secret | hex SHA-256 of the device credential in `DW_DEVICE_CREDENTIAL_FILE` |
| `PUBLIC_URL` | var | `https://dw-relay.<subdomain>.workers.dev` (no trailing slash) |
| `DEVICE_ID` | var | the device id, e.g. `dev_home` |

Make a key pair, a passcode and a credential. The commands write to files (mode 0600) and print nothing:

```sh
umask 077 && mkdir -p secrets && node -e "
const c=require('node:crypto'),fs=require('node:fs');
const k=c.generateKeyPairSync('ed25519');
fs.writeFileSync('secrets/ASSERTION_SIGNING_KEY',JSON.stringify(k.privateKey.export({format:'jwk'})));
fs.writeFileSync('secrets/assertion_public.jwk',JSON.stringify(k.publicKey.export({format:'jwk'})));
fs.writeFileSync('secrets/OWNER_PASSCODE',c.randomBytes(24).toString('hex'));
const cred='dwd_dev_home.'+c.randomBytes(32).toString('base64url');
fs.writeFileSync('secrets/DEVICE_CREDENTIAL',cred);
fs.writeFileSync('secrets/DEVICE_CREDENTIAL_SHA256',c.createHash('sha256').update(cred).digest('hex'));"
```

For `wrangler dev`, copy `worker/.dev.vars.example` to `worker/.dev.vars` (gitignored) and fill it in.

### Deploy

```sh
cd worker
npx wrangler kv namespace create OAUTH_KV        # put the id into wrangler.jsonc
# set PUBLIC_URL and DEVICE_ID in wrangler.jsonc "vars"
npx wrangler secret put OWNER_PASSCODE
npx wrangler secret put ASSERTION_SIGNING_KEY
npx wrangler secret put DEVICE_CREDENTIAL_SHA256
npx wrangler deploy
```

Then start the bridge with `DW_WORKER_URL=https://dw-relay.<subdomain>.workers.dev` and check the deployment:

```sh
DW_WORKER_URL=https://dw-relay.<subdomain>.workers.dev DW_OWNER_PASSCODE_FILE=/path/to/passcode npx tsx e2e/remote-smoke.ts
```

The smoke script creates a client (or uses `DW_CLIENT_ID`), runs the OAuth flow with the passcode, lists the tools and runs `widget_call groceries add`. It masks secrets in its output.

### Break-glass

An attacker can lock only their own address (or /64) out of `/admin/*` and `/authorize`; the cloud kill switch `/admin/kill` is never lockout-gated. The local kill file (`DW_KILL_FILE`) still works on the PC. If you cannot reach the PC: delete the Worker (`cd worker && npx wrangler delete`, or in the Cloudflare dashboard), or rotate `OWNER_PASSCODE` with `npx wrangler secret put OWNER_PASSCODE`. To cut off a stolen device credential, change `DEVICE_CREDENTIAL_SHA256`.

## Checks

```sh
npm run typecheck   # root and worker/
npx vitest run      # unit tests, no Cloudflare
npm run e2e         # wrangler dev + stub + bridge + OAuth client (about 20 s; results in E2E-RESULTS.md)
```

The e2e suite writes `.dev.vars` only into a temp copy of `worker/`, with a fresh key pair, passcode and credential for each run.

## Retries, device approval and kill (added after the product-direction pilot and the Codex reviews)

- **Retries:** a `widget_call` with a `requestId` runs once per grant at the bridge (`bridge/src/journal.ts`, in memory, one hour). The same id and args get the first answer back. The same id with other args gets `idempotency-conflict`. If the connection is lost after a call was sent, the caller gets `outcome-unknown` and should retry with the same `requestId`.
- **Device approval (opt-in):** `DW_APPROVED_GRANTS_FILE` points to `{ "grants": { "<gid>": { "scope": ["widgets:read"], "widgets": ["groceries"] } } }`. With it set, a call is refused unless its grant is listed and its tool and widget are inside the listed ones, so the relay operator cannot widen authority by signing. A missing or unreadable file refuses everything.
- **Kill:** the cloud kill also closes the bridge socket and refuses reconnects until turned off. The bridge checks the local kill file again just before it dispatches. The bridge needs `https` for a non-loopback `DW_WORKER_URL`.
- **Token scope:** an access token carries only the scopes it asked for, never more than its grant.
