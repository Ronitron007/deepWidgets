# deepWidgets today: how it runs locally

This is a factual map for an architect who designs remote (cloud) agent access. Every claim cites `ref/<path>:<line>`. `ref/` is a read-only snapshot of deepWidgets main (`ref/SNAPSHOT.txt:1`, commit `8809c327`). I say "not found" where the snapshot has no evidence.

The snapshot is partial. It holds `apps/desktop`, `apps/desktop-host`, `deepwidgets/{kit,mcp,shell,widget-main}`, and docs. It does not hold the widget runtime `deepwidgets/widgets`, `docs/specs/`, `packages/api/`, `packages/experimental/liveshare`, or the DSH web server package. Docs name these paths (`ref/docs/explore/widget-system/where-we-stand.md:82`, `ref/docs/api-gateway.md:166`), but the code is not in `ref/`.

## 1. Processes and what starts what

deepWidgets is an unofficial fork of DeepSeek Harness (DSH) that turns most DSH plugins off (`ref/README.md:29`). One desktop app runs these parts:

| Part | What it is | Evidence |
|---|---|---|
| Electron main | The Electron process. It owns windows, the MCP port, and the port file. It runs no Cordis. | `ref/apps/desktop/src/main.ts:76`, `ref/docs/explore/widget-system/where-we-stand.md:19` |
| Host | A Node child process with one Cordis Context. All widget logic, the web server and the MCP route run here. | `ref/apps/desktop-host/src/index.ts:41-47`, `ref/docs/explore/widget-system/where-we-stand.md:18` |
| Widget windows | One frameless BrowserWindow (renderer) per widget, except `main`. | `ref/apps/desktop/src/deepwidgets-windows.ts:266-279`, `ref/README.md:17` |
| Shell | A pinned React page that every widget window loads. It renders an OpenUI Lang program. | `ref/deepwidgets/shell/src/main.tsx:7-18` |
| widget-main | The built-in Host plugin for the slug `main`. It backs the menu-bar panel. | `ref/deepwidgets/widget-main/src/index.ts:1-3`, `ref/deepwidgets/widget-main/src/index.ts:41-42` |
| Kit | A Host plugin. It keeps one pnpm project of packages that agent-written pages may import. | `ref/deepwidgets/kit/src/index.ts:2-4`, `ref/deepwidgets/kit/src/index.ts:58` |

What starts what:

- Electron main takes a single-instance lock first (`ref/apps/desktop/src/main.ts:1638`).
- Electron main spawns the Host with `child_process.spawn` and an `ipc` channel in stdio (`ref/apps/desktop/src/host-process.ts:266-278`). The Host entry is `@deepseek-ai/dsh-desktop-host`'s `lib/index.js` (`ref/apps/desktop/src/host-process.ts:265`). Electron main sets `DEEPWIDGETS_MCP_FORWARDED=1` in the Host environment (`ref/apps/desktop/src/main.ts:575`).
- A `DesktopHostSupervisor` restarts a Host that exits, with backoff and a safe mode (`ref/apps/desktop/src/deepwidgets-supervisor.ts:1-6`, `ref/apps/desktop/src/main.ts:561`).
- The Host runs the DSH `desktop` profile through `runProfile` (`ref/apps/desktop-host/src/index.ts:42-47`). The profile loads Cordis plugin rows. `widget-main`, `mcp` and `kit` each insert one row (`ref/deepwidgets/widget-main/cordis.patch.yml:1-3`, `ref/deepwidgets/mcp/cordis.patch.yml:1-3`, `ref/deepwidgets/kit/cordis.patch.yml:1-3`).
- Electron main opens one widget window per slug when the Host reports it. It reads the Host stream `GET /api/widgets/events` and retries with backoff (`ref/apps/desktop/src/deepwidgets-windows.ts:20`, `ref/apps/desktop/src/deepwidgets-windows.ts:196-215`).
- Each widget window loads `dsh-app://w-<slug>.widget/widget/...`, either the built page of the slug or the shared shell (`ref/apps/desktop/src/deepwidgets-origin.ts:3-4`, `ref/apps/desktop/src/deepwidgets-origin.ts:57-63`).
- Electron main also opens hidden windows for the render check of an agent page (`ref/apps/desktop/src/deepwidgets-render-check.ts:216-223`).
- Widget bundles that agents install load as Cordis plugins inside the Host (see section 5).
- The test gate of an install starts one more throwaway Node process (`ref/deepwidgets/mcp/src/creation.ts:402-405`).

The window flags are `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` for the main window (`ref/apps/desktop/src/main.ts:319-324`) and for widget windows (`ref/apps/desktop/src/deepwidgets-windows.ts:279`).

## 2. Ports, sockets and protocols

There are two listeners and one IPC channel.

### The MCP port (Electron main)

- Electron main listens on `DEEPWIDGETS_MCP_PORT`. The default is 47615 (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:3`, `ref/apps/desktop/src/deepwidgets-mcp-port.ts:26`).
- `0` lets the OS pick a port. A value that is not an integer from 0 to 65535 stops the app (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:40-54`). The value may come from the environment or from `.env` files (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:62-71`).
- The listener binds `127.0.0.1` only (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:219`). If the port is taken, the app fails at start (`ref/deepwidgets/mcp/README.md:17`).
- A CLI Host without Electron main binds the same setting itself (`ref/apps/desktop-host/src/mcp-port.ts:6-10`, `ref/apps/desktop-host/src/index.ts:41`).
- The port is plain HTTP. A WebSocket upgrade gets `400` (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:154-162`, `ref/apps/desktop/src/deepwidgets-mcp-port.ts:201-204`).

### The fence: loopback peer, Host header, no browsers

Electron main checks each request before it forwards it (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:91-102`):

1. The peer address must be loopback (127.0.0.0/8, `::1`, or mapped IPv4) (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:83-89`).
2. A request with an `Origin` or `Sec-Fetch-Site` header is refused as a browser request.
3. The `Host` header must be `127.0.0.1`, `localhost` or `[::1]`, with an optional port (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:73-81`).

The MCP route in the Host repeats the same checks (`ref/deepwidgets/mcp/src/index.ts:1073-1091`, `ref/deepwidgets/mcp/src/index.ts:321-334`). It then runs the MCP SDK `localhostHostValidation` (`ref/deepwidgets/mcp/src/index.ts:1063`). A refusal gives `403`.

### Forwarding and the forward secret

- The Host web server listens on a port the OS picks when `DEEPWIDGETS_MCP_FORWARDED=1` (`ref/apps/desktop-host/src/index.ts:41`). It binds `127.0.0.1` (`ref/apps/desktop-host/src/index.ts:47`).
- The MCP row sends `{ port, nonce, secret }` to Electron main over Node IPC (`ref/deepwidgets/mcp/src/index.ts:392-396`, `ref/deepwidgets/mcp/src/index.ts:1183`).
- Electron main adds the forward secret in the header `x-deepwidgets-forward` to each forwarded request (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:31-32`, `ref/apps/desktop/src/deepwidgets-mcp-port.ts:279-281`).
- The Host refuses a request without the secret. It compares in constant time (`ref/deepwidgets/mcp/src/index.ts:469-475`, `ref/deepwidgets/mcp/src/index.ts:1074-1077`). The secret is 32 random bytes made at each Host start (`ref/deepwidgets/mcp/src/index.ts:804`).
- If no Host is ready, the answer is `503` with `Retry-After: 1`. If the Host fails after it was reached, a GET gets `503` and another method gets `502` (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:7-9`, `ref/apps/desktop/src/deepwidgets-mcp-port.ts:293-300`).

### IPC (Electron main and Host)

The Host and Electron main talk over the Node `ipc` channel of the spawned child. The message types are:

- `deepwidgets-mcp` (route live or gone),
- `deepwidgets-render-check` (ask Electron main to render an agent page),
- `deepwidgets-pages` (the page state of each slug),
- `deepwidgets-login-item`,
- plus DSH types: `starting`, `ready`, `fatal`, `platform-session`.

See `ref/apps/desktop/src/host-process.ts:50-58` and `ref/apps/desktop/src/host-process.ts:300-316`. The Host sends `ready` with its URL (`ref/apps/desktop-host/src/index.ts:153-154`).

Electron main also uses Electron IPC (`ipcMain.handle`) with the app renderers. It checks the sender against the `dsh-app://app/` frame (`ref/apps/desktop/src/main.ts:918-964`). Widget windows set no preload (`ref/apps/desktop/src/deepwidgets-windows.ts:279`).

### The Host web server and `dsh-app://`

- Renderers do not call the Host port directly. Electron main answers `dsh-app://` URLs with `protocol.handle` (`ref/apps/desktop/src/main.ts:860-909`).
- Requests under `/api/` are forwarded to the Host with a Host cookie that Electron main got from the launch URL (`ref/apps/desktop/src/web-document.ts:43-50`, `ref/apps/desktop/src/web-document.ts:80-99`). Electron main refuses any `Origin` that is not the window origin (`ref/apps/desktop/src/web-document.ts:85`).
- A widget origin may reach only `/api/widgets/<its-own-slug>/`. Another slug gets 403 or 404 (`ref/apps/desktop/src/deepwidgets-origin.ts:86-97`).
- Responses of a widget origin carry a CSP with `connect-src 'self'` (`ref/apps/desktop/src/deepwidgets-origin.ts:137`).

### WebSockets

- The MCP port refuses WebSocket upgrades (see above).
- The main DSH window uses a WebSocket to the Host. Electron main rewrites its `Origin` and `Cookie` headers (`ref/apps/desktop/src/main.ts:947-958`). Electron main also opens one with the `ws` package for account state (`ref/apps/desktop/src/account-backend.ts:95-105`).
- Widget pages use an SSE stream per slug, not a WebSocket (`ref/docs/explore/widget-system/where-we-stand.md:61`).
- The code of the Host web server (`dsh-host-webserver`) is not in the snapshot, so its own Host and Origin checks are not found here.

## 3. How agents connect today

- **Transport.** Agents use MCP over HTTP at `/mcp` on the port above. The server uses `createMcpHandler` from the MCP SDK in `legacy: 'stateless'` mode (`ref/deepwidgets/mcp/src/index.ts:1058-1062`). Each request builds a fresh `McpServer` (`ref/deepwidgets/mcp/src/index.ts:879`).
- **stdio.** A stdio MCP transport is not found. The only `stdio` uses in scope are for spawning child processes (`ref/apps/desktop/src/host-process.ts:277`, `ref/deepwidgets/mcp/src/creation.ts:405`).
- **Port file.** `$DSH_HOME/deepwidgets/mcp.json` holds `{ port, nonce, pid, started }`. It has mode 0600 in a 0700 folder (`ref/deepwidgets/mcp/README.md:21`, `ref/deepwidgets/mcp/src/index.ts:541-548`). In the desktop app, Electron main writes it with its own port and the Host nonce, and only Electron main removes it (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:241-245`, `ref/apps/desktop/src/deepwidgets-mcp-port.ts:315-337`). A CLI Host writes it itself unless a live owner holds it (`ref/deepwidgets/mcp/src/index.ts:1192-1199`).
- **Challenge and nonce.** The agent reads the nonce from the file. It sends `POST /mcp/token` with `{ agent, challenge }` (`ref/deepwidgets/mcp/README.md:41-45`). The challenge is 16 or more random bytes as base64url or hex (`ref/deepwidgets/mcp/src/index.ts:78-79`, `ref/deepwidgets/mcp/src/index.ts:1115-1118`).
- **HMAC proof.** The server answers `{ token, agentId, proof }` with `proof = HMAC-SHA256(nonce, challenge)` in hex (`ref/deepwidgets/mcp/src/index.ts:489-492`, `ref/deepwidgets/mcp/src/index.ts:1143`). The agent checks the proof before it sends data. This is the guard against a squatter on the port (`ref/deepwidgets/mcp/src/index.ts:7-9`). The nonce is new at each Host start (`ref/deepwidgets/mcp/src/index.ts:801`).
- **Bearer token.** The token is 24 random bytes (`ref/deepwidgets/mcp/src/index.ts:1119`). The agent sends it as `Authorization: Bearer ...` on `/mcp`. A missing or unknown token gets `401` (`ref/deepwidgets/mcp/src/index.ts:1157-1161`).
- **Token file.** `$DSH_HOME/deepwidgets/mcp-tokens.json` maps the SHA-256 hash of each token to a row. It never holds a token (`ref/deepwidgets/mcp/src/index.ts:306-311`, `ref/deepwidgets/mcp/src/index.ts:797`). It keeps the 64 newest rows (`ref/deepwidgets/mcp/src/index.ts:74`, `ref/deepwidgets/mcp/src/index.ts:1126-1130`).
- **Agent identity.** The `agent` name is any 1 to 64 printable ASCII characters (`ref/deepwidgets/mcp/src/index.ts:77`). The server makes `agentId = <slugged-name>-<6 hex>` anew at each handshake (`ref/deepwidgets/mcp/src/index.ts:1120-1121`). It passes `agentId` as `caller` into `widgets.call` (`ref/deepwidgets/mcp/src/index.ts:933`), so each change names its author in `by` (`ref/deepwidgets/mcp/src/index.ts:259`). The code comment says tokens only name the caller (`ref/deepwidgets/mcp/src/index.ts:73`).
- **Epochs.** Each Host start makes an `epoch` id. Token rows carry it, and rows of an earlier epoch are deleted at load or rejected (`ref/deepwidgets/mcp/src/index.ts:305-306`, `ref/deepwidgets/mcp/src/index.ts:806-809`, `ref/deepwidgets/mcp/src/index.ts:820-825`). After a Host restart every agent must do a new handshake (`ref/deepwidgets/mcp/README.md:67-73`).
- **Limits stated by the code owner.** The server takes only loopback requests and refuses browsers. The handshake does not protect against a process of the same user, which can read `mcp.json`. The proof is checked only at the handshake (`ref/deepwidgets/mcp/README.md:161-165`).

### Remote, cloud, liveshare, gateway: what exists

- **"Always-on service for cloud agents":** not found. The docs say "always-on" only for always-on-top windows (`ref/README.md:17`). A search of `apps/` and `deepwidgets/` source finds no such service.
- **Remote access in deepWidgets code:** not found. The MCP port is loopback only, by bind address and by checks. The only related item in the docs is a deferred push of changes to the agent (`ref/docs/explore/widget-system/where-we-stand.md:224`, `ref/docs/explore/widget-system/where-we-stand.md:268`).
- **LiveShare** (`ref/docs/subsystems/liveshare.md:5`): a DSH experimental bundle that shares one DSH chat Session with a viewer through a separate Liveshare server. It is about DSH Sessions, not widgets. Its code (`packages/experimental/liveshare`) is not in the snapshot, and no code under `apps/` or `deepwidgets/` uses it. It is also off by default, because a profile must enable it (`ref/docs/subsystems/liveshare.md:11-13`). It is useful as a design reference: viewer principals, `view` and `write` tiers, and revocation (`ref/docs/subsystems/liveshare.md:17-19`, `ref/docs/subsystems/liveshare.md:29-33`).
- **API gateway doc** (`ref/docs/api-gateway.md:5`): the DSH Typert gateway. It exposes `@Remote` Host methods to the DSH web client through `POST /api/<namespace>/<method>` and a multiplexed `/api/remote.mux` WebSocket (`ref/docs/api-gateway.md:60`, `ref/docs/api-gateway.md:126`). It has a remote-access policy for non-owner peers (`ref/docs/api-gateway.md:93`). It is not the MCP path, and the widget MCP server does not use it. The package code is not in the snapshot. Whether the trimmed deepWidgets app turns it on is not found; the only use I found is the account client's stream protocol import (`ref/apps/desktop/src/account-backend.ts:3-4`).
- **Consent (`widget.mcp_consent`):** decided on 2026-11-03 and deferred. Its server and dialog are not built (`ref/docs/explore/widget-system/where-we-stand.md:71`, `ref/docs/explore/widget-system/where-we-stand.md:220`). No code mentions it (searched `apps/` and `deepwidgets/`).

## 4. Existing auth, pairing and permissions

What the code does today:

- **No pairing and no operator approval.** Any local process of the same user can read `mcp.json`, run the handshake, and get a token. The decision `widget.agent_identity` says: no real auth in v1, any local caller gets a bearer token, and the token gives the agent an identity (`ref/docs/explore/widget-system/where-we-stand.md:56`). The handshake accepts any name and gives a new id each time, so an agent can act as another agent (`ref/docs/explore/widget-system/options.md:355`).
- **`widget.mcp_consent` replaces `widget.agent_identity` on paper** (`ref/docs/explore/widget-system/where-we-stand.md:71`), but it is deferred and not in code (`ref/docs/explore/widget-system/where-we-stand.md:220`). `gap.token` records that each local process can get a token (`ref/docs/explore/widget-system/where-we-stand.md:244`).
- **Token scopes are empty.** The server sets `scopes: []` on the auth info, and the only use of the token is to name the caller (`ref/deepwidgets/mcp/src/index.ts:1163`).
- **Modes are the only agent permission.** `interact` is always on. `create` and `library` can be turned off by `$DSH_HOME/deepwidgets/settings.json` (`ref/deepwidgets/mcp/src/index.ts:153-157`). The server rereads the file on each gated call (`ref/deepwidgets/mcp/src/index.ts:855-859`). A mode switch applies to all agents, not to one agent or one widget.
- **`main` is hidden from agents.** The tools treat the slug `main` as unknown (`ref/deepwidgets/mcp/src/index.ts:20-21`, `ref/deepwidgets/mcp/src/index.ts:917`, `ref/deepwidgets/mcp/src/index.ts:932`).
- **Install gates are lint, not security.** `widget_install` compiles, lints, type-checks and test-runs the code (`ref/deepwidgets/mcp/README.md:133-139`).

The known gaps live in `standing.permission_gaps`. On 2026-11-28 the operator deferred them all to one future permission layer, with no partial guards (`ref/docs/explore/widget-system/where-we-stand.md:228`, `ref/docs/explore/widget-system/where-we-stand.md:232`):

| Gap | What agent code can do | Line |
|---|---|---|
| `gap.services` | Reach all 32 Host services through `ctx.get(name)` or `ctx.root[name]`. The narrow `WidgetContext` is only a TypeScript type. | `ref/docs/explore/widget-system/where-we-stand.md:236` |
| `gap.node` | Import Node builtins past the gates, so it can run commands and read or write any file as the operator. | `ref/docs/explore/widget-system/where-we-stand.md:237` |
| `gap.test_gate` | A refused install still runs the top-level code of the bundle in the test gate. | `ref/docs/explore/widget-system/where-we-stand.md:238` |
| `gap.main_actions` | Call actions of `main` with `ctx.widgets.call('main', ...)`, so it can change modes, remove widgets, and change the kit. | `ref/docs/explore/widget-system/where-we-stand.md:239` |
| `gap.mcp_settings` | Turn on a mode that the operator turned off. | `ref/docs/explore/widget-system/where-we-stand.md:240` |
| `gap.kit` | Call `kit.add`, which can run package install scripts. | `ref/docs/explore/widget-system/where-we-stand.md:241` |
| `gap.root_listener` | Keep a `ctx.root` listener that survives `widget_remove`. | `ref/docs/explore/widget-system/where-we-stand.md:242` |
| `gap.host_parts` | Reach the plugin manager, the loader and the web server, and add HTTP routes. | `ref/docs/explore/widget-system/where-we-stand.md:243` |
| `gap.token` | Any local process can get an MCP token. `create` is on by default. | `ref/docs/explore/widget-system/where-we-stand.md:244` |

The docs accept full Node rights for agent code in v1 (`widget.agent_code_v1`, `standing.hard.agent_code`) (`ref/docs/explore/widget-system/where-we-stand.md:69`, `ref/docs/explore/widget-system/where-we-stand.md:256`). The mode rules, the `main` hiding, and the kit rule hold only at the MCP server. Agent code can break each of them (`ref/docs/explore/widget-system/where-we-stand.md:246-254`).

`ref/SAFETY.md` says the project is experimental, has had no security audit, can run model-generated code and load third-party plugins, and that sandboxing and permission controls do not guarantee isolation (`ref/SAFETY.md:5-13`). `ref/README.md:121` adds that an MCP agent can install code that runs in the Host.

## 5. What a widget can access

There are three kinds of code, with very different reach.

1. **Program text.** An OpenUI Lang program is data, not code. The shell renders it (`ref/docs/explore/widget-system/where-we-stand.md:21`, `ref/deepwidgets/mcp/src/index.ts:292-295`).
2. **The page (renderer side).** A widget window is a sandboxed renderer: no Node, context isolation, `sandbox: true` (`ref/apps/desktop/src/deepwidgets-windows.ts:279`). It cannot open windows or navigate (`ref/apps/desktop/src/deepwidgets-windows.ts:299-300`). The CSP allows only same-origin script and connect, and `self` or `data:` images (`ref/apps/desktop/src/deepwidgets-origin.ts:137`), so a page cannot fetch other hosts. A page talks to the Host only through `/api/widgets/<own slug>/` (`ref/apps/desktop/src/deepwidgets-origin.ts:86-97`). The page guide tells agents that data comes from the program and not from fetch (`ref/deepwidgets/mcp/src/library-guide.ts:75`). Page imports are limited to the shell library, a few packages, and the kit extras. The gates only warn on a page that reads a file outside `page/` (`ref/deepwidgets/mcp/README.md:141-157`). These are build-time fences with warnings, not a runtime sandbox.
3. **The bundle (Host side).** The code an agent writes in `src/index.ts` runs in the Host as a Cordis plugin with full Node rights. The docs say it can read files, call any server, and block every widget with a CPU loop (`ref/docs/explore/widget-system/where-we-stand.md:262`). It installs through the DSH plugin manager (`ref/deepwidgets/mcp/src/creation.ts:1081`) from `<profile>/deepwidgets-widgets/<slug>` (`ref/deepwidgets/mcp/README.md:139`). The type file offers only `widgets` and timers, and `fetch` and the web globals are typed (`ref/deepwidgets/mcp/widget/widget.d.ts:63-70`, `ref/deepwidgets/mcp/src/index.ts:283-284`). The type file is not a sandbox (`gap.services` and `gap.node` above). File access and network access are therefore unrestricted at run time.

Isolation facts that exist:

- The Host is crash-only. A watchdog stops a stall of 2 s while a widget runs, blames a widget, and the supervisor restarts the Host (`ref/docs/explore/widget-system/where-we-stand.md:67`, `ref/docs/explore/widget-system/where-we-stand.md:72`, `ref/apps/desktop/src/deepwidgets-supervisor.ts:1-6`).
- The test gate runs in a separate process with a 256 MB heap and an env that has only `PATH` (`ref/deepwidgets/mcp/src/creation.ts:402-405`).

Data an agent can read back:

- `widget_describe` returns the actions, their args schema, the full state `data`, the revision, and the `source` folder of an installed widget (`ref/deepwidgets/mcp/src/index.ts:912-926`).
- `widget_changes` returns the change feed, with the author in `by` (`ref/deepwidgets/mcp/src/index.ts:939-948`).
- `widget_call` returns the action result (`ref/deepwidgets/mcp/src/index.ts:928-937`).
- The `requestId` cache and the change log are in memory only, so a restart loses them (`ref/docs/explore/widget-system/where-we-stand.md:266`).
- `widget_install` takes any absolute folder path (`ref/deepwidgets/mcp/src/index.ts:893`). The options doc lists "reads any folder" as a threat with a proposed limit (`ref/docs/explore/widget-system/options.md:358`). I did not verify whether the code applies that limit.

The kit installs `node_modules` for pages with pnpm. Only a kit change uses the network (`ref/deepwidgets/kit/src/index.ts:20`). The kit runs only pnpm 11 (`ref/deepwidgets/kit/src/index.ts:30-31`).

## 6. MCP tool surface

The server is named `deepwidgets`, with the instruction "Call deepwidgets_modes first" (`ref/deepwidgets/mcp/src/index.ts:895-898`). It registers 11 tools with `mcp.registerTool`:

| Tool | Mode | One line |
|---|---|---|
| `deepwidgets_modes` | all | Lists each mode, its on/off state, its tools, and the settings file path (`ref/deepwidgets/mcp/src/index.ts:900-904`). |
| `widget_list` | shared | Lists live widgets (not `main`) and gives a cursor (`ref/deepwidgets/mcp/src/index.ts:906-910`). |
| `widget_describe` | interact | Gives one widget's actions, schemas, state, and install source (`ref/deepwidgets/mcp/src/index.ts:912-926`). |
| `widget_call` | interact | Runs one action. Mutations take a `requestId` (`ref/deepwidgets/mcp/src/index.ts:928-937`). |
| `widget_changes` | interact | Gives changes after a cursor, with `by` (`ref/deepwidgets/mcp/src/index.ts:939-948`). |
| `widget_template` | create | Gives the TypeScript widget template files (`ref/deepwidgets/mcp/src/index.ts:950-957`). |
| `widget_guide` | shared | Gives the guide text of one mode (`ref/deepwidgets/mcp/src/index.ts:959-965`). |
| `widget_install` | create | Runs the gates on a folder and installs the widget (`ref/deepwidgets/mcp/src/index.ts:967-970`). |
| `widget_reload` | create | Runs the gates again on the install folder and replaces the bundle (`ref/deepwidgets/mcp/src/index.ts:972-975`). |
| `widget_remove` | create | Removes the bundle. The state stays (`ref/deepwidgets/mcp/src/index.ts:977-980`). |
| `library_template` | library | Gives the page folder template files (`ref/deepwidgets/mcp/src/index.ts:982-992`). |

Errors carry `code`, `message` and `nextStep` (`ref/deepwidgets/mcp/src/index.ts:96-123`). A tool call has no per-widget or per-agent permission check beyond the mode switch and the `main` slug rule.

## 7. Implications for remote access

- **The MCP port is local by construction.** It binds `127.0.0.1`, refuses non-loopback peers, refuses an `Origin`, and refuses any `Host` that is not loopback (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:98-100`, `ref/apps/desktop/src/deepwidgets-mcp-port.ts:219`). A cloud agent cannot reach it. A relay on the machine would have to look like a loopback client with a loopback `Host`, or these checks must change.
- **There is no WebSocket or push path.** The port refuses upgrades, and agents must poll `widget_changes` (`ref/apps/desktop/src/deepwidgets-mcp-port.ts:154-162`, `ref/docs/explore/widget-system/where-we-stand.md:268`). Every call is stateless HTTP, so a remote design can pick its own transport.
- **The handshake proves the server, not the agent.** The nonce lives in a user-readable file (`ref/deepwidgets/mcp/README.md:21`). A cloud agent cannot read it. Any process of the same user can mint a token with any name (`ref/deepwidgets/mcp/README.md:163`).
- **A token names the caller and grants nothing.** `scopes` is empty, `agentId` is new at each handshake, and there is no per-agent or per-widget permission (`ref/deepwidgets/mcp/src/index.ts:1163`, `ref/deepwidgets/mcp/src/index.ts:1120-1121`).
- **Tokens die at each Host restart.** The epoch voids them, and the Host also restarts after crashes. A remote agent must handshake again and expect `401` or `503` often (`ref/deepwidgets/mcp/src/index.ts:806-809`, `ref/apps/desktop/src/deepwidgets-mcp-port.ts:151`).
- **`create` mode gives the agent the user's machine.** Installed code runs in the Host with full Node rights, and the only switch is a global mode flag (`ref/docs/explore/widget-system/where-we-stand.md:237`, `ref/docs/explore/widget-system/where-we-stand.md:256`). A remote agent with `create` is remote code execution. The operator has deferred all guards to a later permission layer (`ref/docs/explore/widget-system/where-we-stand.md:228`).
- **The consent and approval path is not built.** Pairing, an agents list and operator approval are specified and deferred (`ref/docs/explore/widget-system/where-we-stand.md:220`). A remote design must supply them, since a remote agent cannot be vouched for by a local file.
- **Nothing remote exists to reuse in deepWidgets.** LiveShare and the API gateway are DSH docs whose code is not in `ref/` (`ref/docs/subsystems/liveshare.md:5`, `ref/docs/api-gateway.md:93`). They can inform a permission model, but no deepWidgets code connects to them.
