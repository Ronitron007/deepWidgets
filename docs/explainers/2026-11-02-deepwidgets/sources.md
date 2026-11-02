# Sources of the explainer `explainer.sources`

Each claim of `narration.md` and of the visuals in `script.md` has one row here. The label is one of these:

- verified (read): the file and line at `8b9c8672`.

- verified (ran): a command that ran on 2026-11-02 in the worktree `.worktrees/rohan-explainer-deepwidgets-2026-11-02` at `8b9c8672`. Its log is in `~/kyaloon-media/explainer-deepwidgets-2026-11-02/notes/`.

- verified (PR): the body of a merged or open PR, read with `gh pr view <n>`. Copies are in `notes/pr-bodies-a.txt`, `notes/pr-bodies-b.txt`, and `notes/pr-65-body.txt`. These numbers come from the PR author. This session did not run them again.

- inferred: it follows from the code or the docs, but nothing ran it.

Paths are relative to the repository root. `WR` is `deepwidgets/widgets/src/index.ts`. `ISO` is `deepwidgets/widgets/src/isolation.ts`. `MCP` is `deepwidgets/mcp/src/index.ts`. `CRE` is `deepwidgets/mcp/src/creation.ts`. `WE` is `notes/worked-example/run.log` (the worked example run).

## Runs of this session `sources.runs`

| Run | Command | Result |
|---|---|---|
| install | `OPENUI_TELEMETRY_DISABLED=1 corepack pnpm install --frozen-lockfile` | exit 0 (`notes/run-install.log`) |
| build | `corepack pnpm run build:artifacts` | exit 0, `run-gates: 8 passed, 0 failed` (`notes/run-build.log`) |
| runtime check | `node tools/widgets-runtime.mjs` | exit 0, 34 PASS, `widgets-runtime: pass` (`notes/run-widgets-runtime.log`) |
| MCP check | `node tools/widgets-mcp.mjs` | exit 0, 23 PASS, `widgets-mcp: pass` (`notes/run-widgets-mcp.log`) |
| creation check | `WIDGETS_CREATE_DESKTOP=0 node tools/widgets-create.mjs` | exit 0, 26 PASS, `widgets-create: pass`. The desktop part did not run. (`notes/run-widgets-create.log`) |
| blame check | `node tools/widgets-blame.mjs` | exit 0, 24 PASS, `widgets-blame: pass` (`notes/run-widgets-blame.log`) |
| supervisor tests | `corepack pnpm exec vitest run apps/desktop/tests/deepwidgets-crash-policy.spec.ts apps/desktop/tests/deepwidgets-supervisor.spec.ts` | exit 0, 8 of 8 tests (`notes/run-vitest-supervisor.log`) |
| worked example | `node notes/worked-example/run.mjs <worktree> notes/worked-example/out` | exit 0, 38 recorded steps, 16,657 ms (`notes/worked-example/run.log`, `out/steps.json`) |
| program parse | `corepack pnpm exec tsx notes/worked-example/parse.tsx` (from `deepwidgets/shell`) | exit 0 (`notes/worked-example/parse.log`) |
| crash policy | `corepack pnpm exec tsx notes/worked-example/policy.ts` | exit 0 (`notes/worked-example/policy.log`) |

Not run: the desktop app, `tools/smoke-desktop.mjs` in any mode, and `tools/widgets-mcp-port.mjs` (it boots the app). PR #65 was not checked out.

## Claims by scene `sources.claims`

| Scene | Claim | Label and evidence |
|---|---|---|
| `cold_open` | An agent can write a widget and install it while the app runs | verified (ran): WE `install_good` gives `application: applied` with no restart |
| `outline` | Isolation has blame, quarantine, supervisor, watchdog; the watchdog is not merged | verified (read): `docs/plans/widget-phase2.md:9-11`; verified (ran): `gh pr view 65` gives state OPEN |
| `dsh_fork` | Fork of DSH commit `22ddee3`, one squashed commit, MIT, DeepSeek | verified (read): `UPSTREAM.md:9-11`, `CLAUDE.md:7` |
| `dsh_fork` | 387 workspace packages | verified (read): `CLAUDE.md:13`. Not counted again. |
| `dsh_fork` | DSH already has the host, the client, and the Electron app | verified (read): `CLAUDE.md:9` |
| `cordis_context` | apply, ctx, inject, fiber, effect; the effect cleanup runs when the fiber ends | verified (read): `WR:333` (`ctx.effect` returns the disposer of register), `deepwidgets/widget-sample/src/index.ts:24,35`; the Cordis semantics are from the `cordis` skill (`.agents/skills/cordis/`), inferred for this video |
| `plugin_rows` | A row has an id, a package name, a config | verified (read): `deepwidgets/widget-sample/cordis.patch.yml:1-5` |
| `plugin_rows` | The desktop host composes 200 rows | verified (read): `CLAUDE.md:13`. Not counted again. |
| `trim_method` | 160 of 200 rows off, each with a comment | verified (ran): `grep -c '^\s*disabled: true' deepwidgets/trim/cordis.patch.yml` gives 160; `CLAUDE.md:33` |
| `trim_method` | Kept files keep old lines as comments with `deepwidgets-trim` | verified (read): `CLAUDE.md:23`, for example `apps/desktop/src/main.ts:772-774` |
| `trim_method` | The operator reads the dead code | verified (read): `CLAUDE.md:15` |
| `trim_method` | 40 rows stay on, 8 are pending | verified (ran): `grep -v '^#' deepwidgets/trim/rows.host.txt` gives 40 rows, 8 with `pending`; WE install warnings list the same 8 pending rows (`notes/run-widgets-blame.log`) |
| `trim_method` | A `!!js` condition can turn a row off | verified (read): `deepwidgets/probe/cordis.patch.yml:4`, `CLAUDE.md:27` |
| `widget_rows_on` | hmr and timer on again; hmr is needed for an applied install, else `restart-required` with `no-hmr` | verified (read): `deepwidgets/trim/cordis.patch.yml:663-667`, `docs/specs/widget-rows.md:11-12` |
| `widget_rows_on` | Install measured at 1,673 ms | verified (PR): #50, Findings, `install ms=1673` |
| `widget_rows_on` | Cordis timers stop with the plugin; raw timers do not | verified (read): `CRE:204` (lint message), `deepwidgets/mcp/widget/widget.d.ts:61-64` |
| `three_processes` | Electron main makes windows, starts the host, runs no Cordis | verified (read): `docs/specs/fork-trim.md:25-29`, `docs/explore/widget-system/where-we-stand.md:19` |
| `three_processes` | Host started with `--expose-internals` for the loader and hmr | verified (read): `docs/specs/fork-trim.md:31` |
| `three_processes` | Electron main forwards `/api` with the host cookie | verified (read): `apps/desktop/src/main.ts:771-775` (`forwardWebRequest(request, hostUrl, hostCookie)`) |
| `three_processes` | The host checks the cookie on connection routes | verified (ran): WE `program_route_without_cookie` gives 401 |
| `probe_and_trace` | `GET /api/probe` gives `{ ok, pid }`; the main window shows it | verified (read): `deepwidgets/probe/src/index.ts:12-18`, `docs/specs/fork-trim.md:61-67`, `CLAUDE.md:36` |
| `probe_and_trace` | The trace records host rows and boot steps; serves `/api/trace` and `/trace`; trace window opens at start | verified (read): `deepwidgets/trace/src/index.ts:1,60-63,282-291`, `apps/desktop/src/main.ts:655-660` |
| `runtime_overview` | Row gives `widgets`; injects connection and storageDomain | verified (read): `WR:489-490`, `WR:20-25` |
| `runtime_overview` | Nine methods | verified (read): `WR:320-395` |
| `runtime_overview` | Failures are WidgetError, except a malformed definition throws TypeError | verified (read): `WR:121-133`, `WR:275-293`, `WR:976` |
| `widget_definition` | Slug pattern, up to 63 characters | verified (read): `WR:27` |
| `widget_definition` | Five parts; action kinds; zod args; timeoutMs | verified (read): `WR:146-164` |
| `widget_definition` | `w.state`, `w.update`, `w.signal` | verified (read): `WR:136-143`, `WR:683-690` |
| `widget_definition` | A bad slug, action name, or repeated action throws TypeError | verified (read): `WR:276-289` |
| `register_ownership` | The caller fiber owns the registration | verified (read): `WR:311-334` |
| `register_ownership` | On end: routes go, streams get `removed`, the window closes | verified (read): `WR:901-912`; verified (PR): #59 window close check |
| `register_ownership` | Stored state stays | verified (read): `WR:313` comment; verified (ran): `notes/run-widgets-create.log` "a new install after the remove gets the stored state back" |
| `register_ownership` | Second live register gives `conflict` | verified (read): `WR:882`; verified (ran): runtime check "conflict 409 on a second live register" |
| `storage_tables` | Domain `widgets` v1, three tables | verified (read): `WR:231-239` |
| `storage_tables` | JSON backend in this profile | inferred: `docs/specs/widget-mvp.md:56`, kept row `storage-json` in `deepwidgets/trim/rows.host.txt`. Backend routing not read. |
| `storage_tables` | Seed written on first register; stored records win | verified (read): `WR:863-871` |
| `storage_tables` | Each domain write sends a change event that becomes a frame | verified (read): `WR:593-598` |
| `queue_rule` | One FIFO queue per slug for mutations and updates | verified (read): `WR:621-642`, `WR:667-677`, `WR:726` |
| `queue_rule` | 10 parallel read-wait-write calls: +10 with the queue; +1 with the mutant | verified (ran): runtime check "queue: 10 parallel read-wait-write add calls give +10"; verified (PR): #54 mutant `n=1` |
| `queue_rule` | A query skips the queue | verified (read): `WR:724-725` |
| `queue_rule` | Waiting longer than the timeout gives `busy`, no run | verified (read): `WR:625-629`; verified (ran): runtime check "busy: 503 busy and the job did not run" |
| `timeout_rule` | Action, then widget, then 5 s | verified (read): `WR:612-613`, `WR:29` |
| `timeout_rule` | At the limit: `timeout`, signal aborted, later writes refused, also `ctx.widgets.update` | verified (read): `WR:691-697`, `WR:648-652`, `WR:670`; verified (ran): runtime checks "timeout: w.signal aborted ..." and "a later ctx.widgets.update of the call is refused" |
| `timeout_rule` | The reason: a call that the caller saw fail must not change data later | inferred: from `MCP:57` (next step text) and the spec rule `docs/specs/widget-mvp.md:70`. The spec gives no reason. |
| `timeout_rule` | The timeout cannot end a synchronous loop | inferred: the timeout is `setTimeout` in `WR:692-697`; a loop holds the event loop |
| `args_and_errors` | zod check before the queue | verified (read): `WR:733-741` (parse before `runAction`) |
| `args_and_errors` | The 11 codes and statuses | verified (read): `WR:102-115` |
| `args_and_errors` | A query that writes gets `handler-error` | verified (read): `WR:672`, `WR:686` |
| `idempotency` | One run per (caller, requestId); hash of slug, action, args; replayed; conflict | verified (read): `WR:744-759`, `WR:763-771`; verified (ran): WE `agent_retry_same_requestId`, `agent_reuse_requestId_other_args` |
| `idempotency` | Three parallel retries share one run | verified (ran): runtime check "3 parallel calls with one requestId run once; two are replayed" |
| `idempotency` | Replay after a host restart runs once | verified (ran): runtime check "restart: a replayed requestId gives replayed: true and runs once" |
| `idempotency` | TTL 10 minutes | verified (read): `WR:31`, `WR:767`; verified (ran): runtime check "requests TTL" |
| `idempotency` | A failed call is stored only when it wrote | verified (read): `WR:776-783` |
| `idempotency` | Crash between the two writes can run a retry twice | inferred: `WR:773-774` (two writes); same finding in PR #54 |
| `change_feed` | Fields of a change; `by` values | verified (read): `WR:209-217`, `WR:373`; verified (ran): WE `changes_since_first_cursor` |
| `change_feed` | Last 1,000 in memory; cursor `epoch:seq`; reset | verified (read): `WR:30`, `WR:561-580` |
| `routes` | Five routes, each through `connection` | verified (read): `WR:807-860`, `WR:952-964` |
| `routes` | SSE frames hello, data, program, removed; ping 15 s; `retry: 1000` | verified (read): `WR:98`, `WR:464-472`, `WR:596-597`, `WR:851-856`, `WR:904`; verified (ran): WE `slug_stream_frames` |
| `routes` | A slug that is not live gets a plain 404 | verified (read): `docs/specs/widget-mvp.md:78`; verified (ran): runtime check "unknown-widget 404" (route part) |
| `drain_on_stop` | Refuse new work with busy, close event streams, wait, close domain; bound `2 x longest + 1 s` | verified (read): `WR:522-558`; verified (ran): runtime check "drain: a running call ends with its write" |
| `sample_widget` | Counter, get and add, program, `tickMs` default 0, interval catches its errors | verified (read): `deepwidgets/widget-sample/src/index.ts:18-58`, `deepwidgets/widget-sample/cordis.patch.yml:4-5` |
| `openui_lang` | OpenUI Lang 1.0.1; statements; the sample program | verified (read): `deepwidgets/shell/package.json` (`@openuidev/react-lang` 1.0.1), `deepwidgets/widget-sample/src/index.ts:18-21`; verified (ran): `notes/worked-example/parse.log` (sample: 3 statements, query `s` runs `get`, mutation `add`) |
| `openui_lang` | Component set `shadcn-widgets@1`, 19 components | verified (read): `deepwidgets/shell/src/library.tsx:27`, `145-148` |
| `shell_page` | React page built by Vite; React 18.3.1 | verified (read): `deepwidgets/shell/package.json` (react 18.3.1, vite 6.4.3) |
| `shell_page` | One shell for all widgets; no server HTML | verified (read): `docs/explore/widget-system/where-we-stand.md:44-45` (`widget.runtime_pin`, `widget.no_server_html`) |
| `shell_page` | Slug from the address, program route, catalog check, empty text | verified (read): `deepwidgets/shell/src/main.tsx:44-45`, `101-125` |
| `shell_page` | Tool provider sends each Query and Mutation to the call route; no retry | verified (read): `deepwidgets/shell/src/channel.ts:76-91`, `main.tsx:181` |
| `shell_page` | One channel module for a later transport | verified (read): `channel.ts:1-5` |
| `shell_refresh` | data reruns queries with `useTriggerAction`; program reloads; removed; hello catch-up | verified (read): `main.tsx:48-61`, `138-169` |
| `shell_refresh` | Typed text stays | verified (read): `docs/explore/widget-system/where-we-stand.md:155` (spike result). Not checked in this build. |
| `shell_refresh` | The refresh uses an action plan shape that OpenUI does not export; pin | verified (read): `where-we-stand.md:216` |
| `shell_reconnect` | EventSource stops on a non-200 answer; shell backoff 250 ms doubling to 8 s | verified (read): `where-we-stand.md:219`, `channel.ts:10-11`, `119-127` |
| `shell_reconnect` | Electron main answers `Response.error()` while the host is down | verified (read): `apps/desktop/src/main.ts:770-775` |
| `shell_reconnect` | Program fetch: 4 tries, 5 s each | verified (read): `channel.ts:59-74` |
| `shell_serving` | Served from disk at `dsh-app://app/widget/` | verified (read): `apps/desktop/src/main.ts:762-769` |
| `shell_serving` | Count 0, add rev 1, count 1 after one refresh | verified (PR): #57, "Widget smoke notes" |
| `windows_manager` | Reads events with the cookie; hello sync, added, removed; backoff 0.5 s doubling to 10 s | verified (read): `apps/desktop/src/deepwidgets-windows.ts:23-24`, `108-153` |
| `windows_manager` | Window flags, 320 x 300, stacked at the left, sandbox | verified (read): `deepwidgets-windows.ts:20-22`, `159-187` |
| `windows_manager` | Windows stay while the host is down; failed load closes, reopens at hello | verified (read): `deepwidgets-windows.ts:58-61`, `87-91`, `184-187`; verified (PR): #59 Findings |
| `windows_manager` | Positions, window manager, tray not built | verified (read): `docs/specs/widget-mvp.md:163` (`widget_mvp.later`); nothing in `apps/desktop/src` saves positions (inferred from `deepwidgets-windows.ts`) |
| `mcp_server` | `/mcp` route on the host web server; official SDK, stateless | verified (read): `MCP:459-462`, `MCP:563-571`; verified (PR): #55 versions 2.2.0 and 2.0.0 |
| `mcp_server` | Nine tools | verified (read): `MCP:376-440`; verified (ran): WE `tools_list` |
| `mcp_server` | Each tool calls `ctx.widgets` | verified (read): `MCP:380-410` |
| `mcp_port` | Default 47615, setting, 0, bad value error | verified (read): `apps/desktop-host/src/mcp-port.ts:7`, `16-24`; `apps/desktop-host/src/index.ts:27-38` |
| `mcp_port` | Port taken: fails at start with EADDRINUSE | verified (PR): #60, check 3 |
| `mcp_port` | Reason: a surprise port leaves agents with no way to find the host | inferred: decision `widget.mcp_v1` (`where-we-stand.md:54`) states the rule, not the reason |
| `mcp_port` | Port file fields, mode 0600, written after the route is live, not over a live owner | verified (read): `MCP:202-208`, `266-272`, `573-592`, `252-263`; verified (ran): WE `port_file` |
| `mcp_port` | Electron main removes the file of a dead host | verified (read): `apps/desktop/src/host-process.ts:241-242`, `apps/desktop/src/deepwidgets-port-file.ts:1-7`. The CLI host run left the file (WE `port_file_after_crash`), as expected with no Electron main. |
| `mcp_handshake` | Challenge of at least 16 random bytes; answer token, agentId, proof; HMAC-SHA256 with the nonce | verified (read): `MCP:44`, `MCP:214-216`, `MCP:489-540`; `deepwidgets/mcp/README.md` (`mcp_readme.handshake`); verified (ran): WE `token_handshake` |
| `mcp_handshake` | Only the token hash is stored; 64 newest; epoch voids old tokens | verified (read): `MCP:126-131`, `MCP:39`, `MCP:316-319`, `MCP:330-335`; verified (ran): WE `token_file`, `old_token_after_restart` (401) |
| `mcp_fence` | Loopback peer; Origin or Sec-Fetch-Site gives 403; exact loopback Host; 401 with no token | verified (read): `MCP:473-487`, `MCP:553-556`; verified (ran): WE `fence`, MCP check |
| `mcp_fence` | Reason: a web page must not drive the widgets | inferred: the code comment says an MCP client is never a browser (`MCP:469`) |
| `mcp_fence` | A process of the same user can read the port file | verified (read): `deepwidgets/mcp/README.md` (`mcp_readme.limits`) |
| `mcp_interact` | Tool results; caller is the agentId | verified (read): `MCP:376-410`, `MCP:398`; verified (ran): WE `changes_since_first_cursor` (`by: claude-code-c1e6b7`) |
| `mcp_interact` | 20 error codes with a next step | verified (read): `MCP:52-73` |
| `mcp_interact` | Claude Code 2.1.311 drops pushed notifications | verified (read): `where-we-stand.md:229` (`standing.checked.mcp_push`). Not checked again. |
| `creation_overview` | Template, guide, files, install; three gates; first failure stops | verified (read): `MCP:412-430`, `CRE:363-382`, `CRE:506-512` |
| `creation_overview` | Profile folder, plugin manager, hmr applies | verified (read): `CRE:430`, `CRE:540`; verified (ran): WE `install_good` |
| `creation_overview` | 40 edits: 14 crashes without gates, 0 with gates | verified (read): `where-we-stand.md:241` (spike `standing.checked.dev_gates`) |
| `gate_compile` | Staging copy; esbuild bundle for Node | verified (read): `CRE:171-180`, `CRE:227-251` |
| `gate_lint` | oxlint type-aware, type check, widget type file, zod only | verified (read): `CRE:183-224`, `CRE:254-279`, `MCP:103` |
| `gate_lint` | Four raw timers, also as properties; floating and misused promises | verified (read): `CRE:204-221`; verified (ran): creation check lines for `setTimeout`, `globalThis.setTimeout`, `window.setInterval`, `self.setTimeout` |
| `gate_lint` | Endless loop rule in own code; oxlint JS plugins crash under Electron | verified (read): `deepwidgets/mcp/src/loop-check.ts:1-54`; verified (PR): #63 Findings (exit 133) |
| `gate_test_run` | 256 MB heap; bare Context with TimerService and stand-in; apply 1 s; each action once with `{}`, 1 s each; timers 1.5 s; exactly one widget; faults fail | verified (read): `CRE:27-35`, `CRE:282-344`, `deepwidgets/mcp/src/testrun-child.ts:43-44`, `120-190` |
| `gate_test_run` | Heartbeat every 100 ms, kill at 750 ms silence | verified (read): `testrun-child.ts:156`, `CRE:31`, `CRE:312-319` |
| `gate_test_run` | Two holes: timers after 1.5 s; actions whose schema refuses `{}` | verified (read): `testrun-child.ts:123-126`, `186-187`; verified (ran): WE `install_good` warning, WE `example_crash` sequence |
| `install_replace` | `.next` and `.previous`; remove, install, restore on failure; one at a time | verified (read): `CRE:433-437`, `CRE:523-573`; verified (ran): creation check "a reinstall that fails in the host is rolled back" |
| `install_replace` | State stays across replace and remove | verified (ran): creation check "a second install ... the state stays", "a new install after the remove gets the stored state back" |
| `install_replace` | Seed hash and `setProgram` on a changed seed | verified (read): `CRE:543-555`; verified (ran): creation check "the replace sets the new seed program" |
| `install_replace` | Built-in slug cannot be taken | verified (read): `CRE:520-522`, `MCP:68` |
| `isolation_why` | Agent code runs in the host with full rights; can call any server | verified (read): `where-we-stand.md:209` (`standing.hard.agent_code`), `MCP:104` (fetch works); verified (ran): creation check "a bundle that calls fetch and console.log passes the gates" |
| `isolation_why` | The gates are not a sandbox | inferred: no sandbox code exists in `CRE` or `WR`; decision `widget.agent_code_v1` (`where-we-stand.md:69`) |
| `isolation_why` | Crash-only: name the widget, write a record, exit; new host keeps it off | verified (read): `where-we-stand.md:67`, `ISO:306-333`, `ISO:239-251` |
| `isolation_why` | Cordis timers and listeners do not contain errors | verified (read): `where-we-stand.md:242` (`standing.checked.cordis_containment`) |
| `isolation_why` | An earlier catch-and-go-on handler could swallow host errors | verified (read): `where-we-stand.md:210` (`standing.hard.fail_loud`) |
| `isolation_why` | Each crash stops every widget for about 2 s; new host answered 1,560 ms after a kill | verified (read): `where-we-stand.md:210`; verified (PR): #61 restart mode |
| `blame_store` | AsyncLocalStorage store with the row id; wrap of each widget row body; handlers in the store | verified (read): `ISO:65`, `ISO:273-293`, `ISO:97-99`, `WR:700` |
| `blame_store` | Widget row id pattern | verified (read): `ISO:25`; the Loader row id in practice is `include:deepwidgets-widget-<slug>` (verified (ran): WE `crash_record`) |
| `blame_store` | Key is the Loader row, not the plugin name; reason | verified (read): `ISO:11-12`; verified (ran): blame check "spoof" lines |
| `blame_store` | `fiber._runner` is undocumented | verified (read): `ISO:267-270`; verified (PR): #62 Findings |
| `blame_store` | Known misblame of a host timer made in a widget call | verified (read): `where-we-stand.md:240`; verified (PR): #62 Findings (not tested) |
| `claimer` | Hook into the DSH fail-loud release, after its diagnostic, in the async context of the error | verified (read): `apps/cli/src/profile-boot.ts:311-319`, `365-400`; `ISO:334-339` |
| `claimer` | Store, then stack, then none; synchronous write with rename; record fields; exit 1 | verified (read): `ISO:296-333`, `ISO:114-119`, `ISO:35-51` |
| `claimer` | Skips the cleanup of about 2.9 s | verified (read): `docs/specs/widget-phase2.md:22` |
| `claimer` | 9 fault kinds: 8 blamed the widget, the host error none; 18 to 100 ms | verified (ran): `notes/run-widgets-blame.log` |
| `quarantine` | Apply the record at start; mark applied | verified (read): `ISO:239-251`; verified (ran): WE `crash_record_after_restart`, `quarantine_file` |
| `quarantine` | Held row loads with no code; failed in list; 503 `widget-failed`; hello `programRev: -1` | verified (read): `ISO:279-284`, `WR:966-974`, `WR:601-606`, `WR:855`; verified (ran): WE `widget_list_quarantined`, `call_quarantined`, `program_route_quarantined`, `slug_stream_hello_quarantined` |
| `quarantine` | Lift on a changed SHA-256 of the package files | verified (read): `ISO:144-156`, `ISO:254-264`; verified (ran): WE `install_fixed`, `quarantine_file_after_fix` (`[]`) |
| `quarantine` | A crash before register has no package folder and cannot lift by hash | verified (PR): #62 Findings; inferred from `ISO:312-322` (root from `known`, filled at register) |
| `supervisor` | Owns exits only after the first ready host | verified (read): `apps/desktop/src/deepwidgets-supervisor.ts:83-95` |
| `supervisor` | Blamed only when the record pid is the dead host and not applied | verified (read): `deepwidgets-supervisor.ts:42-47`, `99` |
| `supervisor` | Blamed: 500 ms, not counted. Unblamed in 60 s: 500, 2,000, 8,000 ms | verified (read): `apps/desktop/src/deepwidgets-crash-policy.ts:10-51`; verified (ran): `notes/worked-example/policy.log` |
| `supervisor` | Restart starts a host and loads the main window; widget windows stay | verified (read): `apps/desktop/src/main.ts:636-654`; verified (PR): #61 |
| `safe_mode` | 2 unblamed in 60 s: safe mode by env flag; runtime refuses non-built-in widgets; off in the list, no routes, no window | verified (read): `deepwidgets-crash-policy.ts:14`, `deepwidgets-supervisor.ts:79-81`, `WR:504`, `WR:874-881`, `WR:187-188`, `WR:933-936` |
| `safe_mode` | Built-in by real module path; only `widget-sample` | verified (read): `WR:39-48`, `WR:62-97` |
| `safe_mode` | 4 unblamed in 60 s: give-up and fatal dialog; the dialog blocks Electron main on macOS | verified (read): `deepwidgets-crash-policy.ts:16`, `apps/desktop/src/main.ts:576`; verified (PR): #61 Findings |
| `watchdog_open` | PR #65 is open, not merged | verified (ran): `gh pr view 65` (state OPEN, head `806865e2`) |
| `watchdog_open` | A loop freezes the host and nothing kills it today | inferred: no watchdog code at `8b9c8672` (`git ls-files deepwidgets/widgets/src` has no `watchdog.ts`); a loop never reaches the claimer |
| `watchdog_open` | Worker thread, heartbeat 100 ms, poll 50 ms, provisional at 500 ms, kill at 2 s | verified (read): `notes/pr-65.diff` (`watchdog.ts` `WATCHDOG_THRESHOLD_MS = 2_000`, `BEAT_MS`, `POLL_MS`; `watchdog-worker.ts` quarter threshold and SIGKILL); `notes/pr-65-body.txt` |
| `watchdog_open` | 150 MB parse 757 ms, host lives; loop killed 2,041 ms after the call; desktop blames by slot only | verified (PR): #65 Check and Look Before You Build tables |
| `example_*` | Every value in the example scenes | verified (ran): WE, step names as in the visuals. The widget source `groceries` is illustrative agent code (`notes/worked-example/out/groceries*.index.ts`). |
| `example_user_door` | Parser result: 4 statements, query `list`, mutation `add`, 0 errors; typo `Buton` gives unknown component | verified (ran): `notes/worked-example/parse.log` |
| `example_quarantine` | In the app, the supervisor restarts the host | verified (read): `deepwidgets-supervisor.ts:94-123`. The script restarted it by hand. |
| `checks_and_mutants` | One unit per PR, fresh reviewer, mutants | verified (read): `docs/plans/widget-mvp.md:3`, `22-23` |
| `checks_and_mutants` | Queue mutant `n=1`; fence mutant 3 of 13 failed | verified (PR): #54, #55 |
| `checks_and_mutants` | 34, 23, 26, 24 PASS lines; 8 of 8 tests | verified (ran): `sources.runs` |
| `limits_measured` | 35 ms agent call, 12 ms click, install 3.2 to 3.6 s | verified (ran): WE |
| `limits_measured` | Live window 2,073 ms after a kill | verified (PR): #61 |
| `limits_measured` | About 20.6 MB per window; json about 10 ms per write, about 100 writes each second; sqlite about 0.2 ms, not on | verified (read): `where-we-stand.md:176`, `179`, `211`, `231` (spike results); `docs/specs/widget-mvp.md:144` (json in MVP) |
| `open_items` | Waiting decisions and the MVP choices | verified (read): `where-we-stand.md:186-192`, `docs/specs/widget-mvp.md:138-145`, `docs/specs/widget-phase2.md:76` |
| `open_items` | Not built: window manager, positions, tray, main window as widget | verified (read): `docs/specs/widget-mvp.md:163`, decisions `widget.window_manager`, `widget.main_window`, `widget.app_presence` (`where-we-stand.md:38-41`) |
| `open_items` | The host does not check a program before it stores it | verified (read): `WR:795-804` (only a non-empty check) |
| `open_items` | Packaged build failed on 2026-10-27, not checked since | verified (read): `where-we-stand.md:238`. Not run again. |
| `open_items` | Unchecked facts | verified (read): `where-we-stand.md:244-252` |
| `open_items` | Flake `HMR transactions cannot be nested` | verified (PR): #65 Exit codes |
| `closing` | 40 of 200 rows kept | verified (read): `CLAUDE.md:33`; verified (ran): row count above |

## Doc and code differences found `sources.drift`

These are not errors of the video. The video follows the code.

| Doc | Says | Code at `8b9c8672` |
|---|---|---|
| PR #60 body | The token answer has `nonce` | The answer has `proof` = HMAC of the challenge; the nonce never leaves the file (`MCP:539`) |
| PR #61 and #62 bodies | Safe mode uses a `!!js` condition on the sample row | Safe mode is in the runtime by module path (`WR:874-881`); the sample row has no condition (`deepwidgets/widget-sample/cordis.patch.yml`) |
| `docs/specs/widget-mvp.md:116` | A "panel" window | A `BrowserWindow` with `frame: false` and `alwaysOnTop`, not `type: 'panel'` (`deepwidgets-windows.ts:165-176`) |
| `where-we-stand.md:171` | A program that names a missing action is refused with 422 (overnight runtime) | `setProgram` checks only for non-empty text (`WR:797`) |
| `docs/specs/widget-phase2.md:80` | A failed reinstall can leave no version | The installer restores the previous bundle (`CRE:566-572`); only a failed restore leaves none (inferred) |
