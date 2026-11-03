# Sources of the explainer `explainer.sources`

Each claim of `narration.md` and of the visuals in `script.md` has one row here. The label is one of these:

- verified (read): the file and line at `108d663f` (origin/main after the merge of PR #65). Files that the merge did not change have the same lines as at `8b9c8672`.

- verified (ran): a command that ran on 2026-11-02 in the worktree `.worktrees/rohan-explainer-deepwidgets-2026-11-02`. The first runs used `8b9c8672` (logs in `notes/`). The correction runs used `108d663f` (logs in `notes/corrections-runs/`). The fact-check runs used `47b515dc` (logs in `factcheck-runs/`). Each row names its run.

- verified (PR): the body of a merged or open PR, read with `gh pr view <n>`. Copies are in `notes/pr-bodies-a.txt`, `notes/pr-bodies-b.txt`, and `notes/pr-65-body.txt`. These numbers come from the PR author. This session did not run them again.

- inferred: it follows from the code or the docs, but nothing ran it.

Paths are relative to the repository root. `WR` is `deepwidgets/widgets/src/index.ts`. `ISO` is `deepwidgets/widgets/src/isolation.ts`. `REC` is `deepwidgets/widgets/src/records.ts`. `WD` is `deepwidgets/widgets/src/watchdog.ts`. `WDW` is `deepwidgets/widgets/src/watchdog-worker.ts`. `SUP` is `apps/desktop/src/deepwidgets-supervisor.ts`. `MCP` is `deepwidgets/mcp/src/index.ts`. `CRE` is `deepwidgets/mcp/src/creation.ts`. `WE` is `notes/worked-example/run.log` (the run of record, `8b9c8672`). `WE2` is `notes/corrections-runs/worked-example-108d663f/` (the rerun). `WE-F` is `factcheck-runs/worked-example-steps.json` (the fact-check run).

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

| install (108d663f) | `OPENUI_TELEMETRY_DISABLED=1 corepack pnpm install --frozen-lockfile` | exit 0 (`notes/corrections-runs/install.log`) |
| build (108d663f) | `corepack pnpm run build:artifacts` | exit 0, `run-gates: 8 passed, 0 failed` (`notes/corrections-runs/build.log`) |
| watchdog check (108d663f) | `node tools/widgets-watchdog.mjs` | exit 0, 21 PASS, `widgets-watchdog: pass` (`widgets-watchdog.log`) |
| runtime, MCP, creation checks (108d663f) | the same commands as above | exit 0 each; 34, 23, 26 PASS (`widgets-runtime.log`, `widgets-mcp.log`, `widgets-create.log`) |
| blame check (108d663f) | `node tools/widgets-blame.mjs`, twice | first run exit 1, 1 PASS 11 FAIL, `HMR transactions cannot be nested` (`widgets-blame.log`); rerun exit 0, 24 PASS, 19 to 103 ms (`widgets-blame-rerun.log`) |
| supervisor tests (108d663f) | the same vitest command | exit 0, 11 of 11 tests (`vitest.log`) |
| worked example rerun (108d663f) | `node notes/worked-example/run.mjs <worktree> notes/corrections-runs/worked-example-108d663f` | exit 0, the same 38 steps and outcomes as `WE`, 19,523 ms. The script writes the label `8b9c8672` into `steps.json` (`run.mjs:287`); the tree was `108d663f`. |

The rows marked (108d663f) ran with the machine lock `/tmp/deepwidgets-smoke.lock`. Not run: the desktop app, `tools/smoke-desktop.mjs` in any mode, and `tools/widgets-mcp-port.mjs` (it boots the app).

## Claims by scene `sources.claims`

| Scene | Claim | Label and evidence |
|---|---|---|
| `cold_open` | An agent can write a widget and install it while the app runs | verified (ran): WE `install_good` gives `application: applied` with no restart |
| `cold_open` | The example is one run on a host with no windows, through MCP, runtime, creation, blame, quarantine | verified (read): `notes/worked-example/run.mjs:3-8` |
| `outline` | Isolation has blame, quarantine, supervisor, watchdog; the watchdog is merged | verified (read): `docs/plans/widget-phase2.md:9-11`; verified (ran): `gh pr view 65` gives state MERGED, `2026-11-02T08:11:01Z`, merge `7503af6c` |
| `outline` | Isolation cannot stop a crash of the host; it restarts the host without the bad widget, and the others come back | verified (read): `docs/explore/widget-system/where-we-stand.md:210`, `ISO:172-196`; verified (ran): `widgets-watchdog.log` (108d663f) `spin: sample stays live` |
| `dsh_fork` | Fork of DSH commit `22ddee3`, one squashed commit, MIT, DeepSeek | verified (read): `UPSTREAM.md:9-11`, `CLAUDE.md:7` |
| `dsh_fork` | DSH runs AI agents; it has a command-line app, a web app, and a desktop app | verified (read): `README.md:7` ("open-source agent harness"); package names in `apps/cli`, `apps/web`, `apps/desktop`; agent rows off in `deepwidgets/trim/rows.host.txt:15,33` |
| `dsh_fork` | 394 workspace packages, 387 of them from DSH | verified (ran, fact-check at 47b515dc): `factcheck-runs/workspace-packages.txt` lists 394 projects with the root, 7 under `deepwidgets/`. verified (read): `pnpm-workspace.yaml:5` (`deepwidgets/*`); the merge adds `package.json` only under `deepwidgets/widgets/fixtures/`, which no glob matches. `CLAUDE.md:13` (387) is stale. |
| `dsh_fork` | DSH already has the host, the client, and the Electron app | verified (read): `CLAUDE.md:9` |
| `cordis_context` | apply gets the context first and the row config second | verified (read): `deepwidgets/widget-sample/src/index.ts:35`, `WR:501` |
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
| `three_processes` | Electron main serves built page files from disk and forwards each other path with the host cookie | verified (read): `apps/desktop/src/main.ts:757-776` (`forwardWebRequest(request, hostUrl, hostCookie)` for each `dsh-app://app` path that is not a page file) |
| `three_processes` | The host checks the cookie on connection routes | verified (ran): WE `program_route_without_cookie` gives 401 |
| `probe_and_trace` | `GET /api/probe` gives `{ ok, pid }`; the main window shows it | verified (read): `deepwidgets/probe/src/index.ts:12-18`, `docs/specs/fork-trim.md:61-67`, `CLAUDE.md:36` |
| `probe_and_trace` | The trace records host rows and boot steps; serves `/api/trace` and `/trace`; trace window opens at start | verified (read): `deepwidgets/trace/src/index.ts:1,60-63,282-291`, `apps/desktop/src/main.ts:655-660` |
| `runtime_overview` | Row gives `widgets`; injects connection and storageDomain | verified (read): `WR:489-490`, `WR:20-25` |
| `runtime_overview` | Nine methods | verified (read): `WR:320-395` |
| `runtime_overview` | Most failures are WidgetError; a malformed definition or an async update function throws TypeError | verified (read): `WR:121-133`, `WR:275-293`, `WR:654`, `WR:976`; a closed domain gives a plain Error (`WR:608`) |
| `widget_definition` | Slug pattern, up to 63 characters | verified (read): `WR:27` |
| `widget_definition` | Five required parts and one optional widget timeout; action kinds; zod args; action timeoutMs | verified (read): `WR:146-164` (`timeoutMs?` at `WR:161-162`) |
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
| `timeout_rule` | The reason: a call that failed for the caller must not change data later (the narration says "we infer") | inferred: from `MCP:57` (next step text) and the spec rule `docs/specs/widget-mvp.md:70`. The spec gives no reason. |
| `timeout_rule` | Only the watchdog ends a loop; a later scene shows it | verified (read): `WDW:181-199`; verified (ran): `widgets-watchdog.log` (108d663f) `spin` |
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
| `change_feed` | The epoch is new at each start of the runtime | verified (read): `WR:560-561` (`randomUUID()` inside `apply`, `WR:501`) |
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
| `shell_refresh` | data reruns queries with `useTriggerAction`; program reloads; removed shows `This widget was removed`; hello catch-up | verified (read): `main.tsx:48-61`, `138-169`, `176` |
| `shell_refresh` | The spike showed that typed text stays; nobody checked it in the current shell | verified (read): `docs/explore/widget-system/where-we-stand.md:155` (spike result). No check in the repository tests it. |
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
| `mcp_server` | Each interact tool calls `ctx.widgets` | verified (read): `MCP:380-410`; `widget_template` and `widget_guide` do not (`MCP:412-425`) |
| `mcp_port` | Default 47615, setting, 0, bad value error | verified (read): `apps/desktop-host/src/mcp-port.ts:7`, `16-24`; `apps/desktop-host/src/index.ts:27-38` |
| `mcp_port` | Port taken: fails at start with EADDRINUSE; the narration names PR #60 | verified (PR): #60, check 3 |
| `mcp_port` | The operator decided the rule; the documents give no reason | verified (read): decision `widget.mcp_v1` (`where-we-stand.md:54`) states the rule only; the port file gives the port (`MCP:583`), so the old reason did not hold |
| `mcp_port` | The port file is `$DSH_HOME/deepwidgets/mcp.json` | verified (read): `MCP:312` |
| `mcp_port` | Port file fields, mode 0600, written after the route is live, not over a live owner | verified (read): `MCP:202-208`, `266-272`, `573-592`, `252-263`; verified (ran): WE `port_file` |
| `mcp_port` | Electron main removes the file of a dead host | verified (read): `apps/desktop/src/host-process.ts:241-242`, `apps/desktop/src/deepwidgets-port-file.ts:1-7`. The CLI host run left the file (WE `port_file_after_crash`), as expected with no Electron main. |
| `mcp_handshake` | Challenge of at least 16 random bytes; answer token, agentId, proof; HMAC-SHA256 with the nonce | verified (read): `MCP:44`, `MCP:214-216`, `MCP:489-540`; `deepwidgets/mcp/README.md` (`mcp_readme.handshake`); verified (ran): WE `token_handshake` |
| `mcp_handshake` | Only the token hash is stored; 64 newest; epoch voids old tokens | verified (read): `MCP:126-131`, `MCP:39`, `MCP:316-319`, `MCP:330-335`; verified (ran): WE `token_file`, `old_token_after_restart` (401) |
| `mcp_fence` | Loopback peer; Origin or Sec-Fetch-Site gives 403; exact loopback Host; 401 with no token | verified (read): `MCP:473-487`, `MCP:553-556`; verified (ran): WE `fence`, MCP check |
| `mcp_fence` | Reason: a web page must not drive the widgets | inferred: the code comment says an MCP client is never a browser (`MCP:469`) |
| `mcp_fence` | A process of the same user can read the port file | verified (read): `deepwidgets/mcp/README.md` (`mcp_readme.limits`) |
| `mcp_interact` | Tool results; caller is the agentId | verified (read): `MCP:376-410`, `MCP:398`; verified (ran): WE `changes_since_first_cursor` (`by: claude-code-c1e6b7`) |
| `mcp_interact` | 20 error codes with a next step | verified (read): `MCP:52-73` |
| `mcp_interact` | In a project check, Claude Code 2.1.311 dropped pushed notices; the exception is `list_changed` for tools | verified (read): `where-we-stand.md:229` (`standing.checked.mcp_push`). Not checked again. |
| `creation_overview` | Template, guide, files, install; three gates; first failure stops | verified (read): `MCP:412-430`, `CRE:363-382`, `CRE:506-512` |
| `creation_overview` | Each problem has a file, line, and column when the gate knows them | verified (read): `CRE:57`, `CRE:315-335` |
| `creation_overview` | Profile folder, plugin manager, hmr applies | verified (read): `CRE:430`, `CRE:540`; verified (ran): WE `install_good` |
| `creation_overview` | 40 edits: 14 crashes without gates, 0 with gates | verified (read): `where-we-stand.md:241` (spike `standing.checked.dev_gates`) |
| `gate_compile` | Staging copy under `os.tmpdir()`; esbuild bundle for Node | verified (read): `CRE:171-180` (`tmpdir()` at `CRE:177`), `CRE:227-251` |
| `gate_lint` | oxlint type-aware, type check, widget type file, zod only | verified (read): `CRE:183-224`, `CRE:254-279`, `MCP:103` |
| `gate_lint` | Four raw timers, also as properties; floating and misused promises | verified (read): `CRE:204-221`; verified (ran): creation check lines for `setTimeout`, `globalThis.setTimeout`, `window.setInterval`, `self.setTimeout` |
| `gate_lint` | Endless loop rule in own code; oxlint JS plugins crash under Electron (the narration names PR #63) | verified (read): `deepwidgets/mcp/src/loop-check.ts:1-54`; verified (PR): #63 Findings (exit 133) |
| `gate_test_run` | 256 MB heap; bare Context with TimerService and stand-in; apply 1 s; each action once with `{}`, 1 s each; timers 1.5 s; exactly one widget; faults fail | verified (read): `CRE:27-35`, `CRE:282-344`, `deepwidgets/mcp/src/testrun-child.ts:43-44`, `120-190` |
| `gate_test_run` | Heartbeat every 100 ms, kill at 750 ms silence | verified (read): `testrun-child.ts:156`, `CRE:31`, `CRE:312-319` |
| `gate_test_run` | An action that throws in the test run gives only a warning | verified (read): `CRE:337-339` |
| `gate_test_run` | Two holes: timers after 1.5 s; actions whose schema refuses `{}` | verified (read): `testrun-child.ts:123-126`, `186-187`; verified (ran): WE `install_good` warning, WE `example_crash` sequence |
| `install_replace` | `.next` and `.previous`; remove, install, restore on failure; one at a time | verified (read): `CRE:433-437`, `CRE:523-573`; verified (ran): creation check "a reinstall that fails in the host is rolled back" |
| `install_replace` | State stays across replace and remove | verified (ran): creation check "a second install ... the state stays", "a new install after the remove gets the stored state back" |
| `install_replace` | Seed hash and `setProgram` on a changed seed | verified (read): `CRE:543-555`; verified (ran): creation check "the replace sets the new seed program" |
| `install_replace` | Built-in slug cannot be taken; the code is `slug-taken` | verified (read): `CRE:520-522`, `MCP:68` |
| `isolation_why` | Agent code runs in the host with full rights; can call any server | verified (read): `where-we-stand.md:209` (`standing.hard.agent_code`), `MCP:104` (fetch works); verified (ran): creation check "a bundle that calls fetch and console.log passes the gates" |
| `isolation_why` | The gates are not a sandbox | inferred: no sandbox code exists in `CRE` or `WR`; decision `widget.agent_code_v1` (`where-we-stand.md:69`) |
| `isolation_why` | Crash-only: name the widget, write a record, exit; new host keeps it off | verified (read): `where-we-stand.md:67`, `ISO:251-277`, `ISO:172-185` |
| `isolation_why` | Cordis timers and listeners do not contain errors | verified (read): `where-we-stand.md:242` (`standing.checked.cordis_containment`) |
| `isolation_why` | An earlier catch-and-go-on handler could swallow host errors | verified (read): `where-we-stand.md:210` (`standing.hard.fail_loud`) |
| `isolation_why` | By the project notes, each crash stops every widget for about 2 s; new host answered 1,560 ms after a kill (the narration names the merged supervisor check) | verified (read): `where-we-stand.md:210`. Not measured again. verified (PR): #61 restart mode |
| `blame_store` | AsyncLocalStorage store with the row id; wrap of each widget row body; handlers in the store; a widget timer carries the row id | verified (read): `ISO:46`, `ISO:218-231`, `ISO:81-83`, `WR:700` |
| `blame_store` | Widget row id pattern | verified (read): `ISO:31`; the Loader row id in practice is `include:deepwidgets-widget-<slug>` (verified (ran): WE `crash_record`) |
| `blame_store` | Spec gives agent bundles the row id `deepwidgets-agent-<slug>`; PR #67 is not merged | verified (read): `docs/specs/widget-phase2.md:68-74`, `docs/plans/widget-phase2.md:14`; `CRE:157` (code still `deepwidgets-widget-<slug>`); verified (ran): `gh pr view 67` state OPEN |
| `blame_store` | Key is the Loader row, not the plugin name; reason | verified (read): `ISO:14-15`; verified (ran): blame check "spoof" lines |
| `blame_store` | `fiber._runner` is undocumented | verified (read): `ISO:218-220`; verified (PR): #62 Findings |
| `blame_store` | Known misblame of a host timer made in a widget call | verified (read): `where-we-stand.md:240`; verified (PR): #62 Findings (not tested) |
| `claimer` | Hook into the DSH fail-loud release, after its diagnostic, in the async context of the error | verified (read): `apps/cli/src/profile-boot.ts:311-319`, `365-400`; `ISO:279-284` |
| `claimer` | Store, then stack, then none; synchronous write with rename; record fields; exit 1 | verified (read): `ISO:251-277`, `REC:82-87`, `REC:25-41` |
| `claimer` | Skips the cleanup; the spike measured about 2.9 s | verified (read): `docs/specs/widget-phase2.md:22`, `where-we-stand.md:240`. Not measured again. |
| `claimer` | 9 fault kinds: 8 blamed the widget, the host error none; in three runs about 20 to 100 ms | verified (ran): `notes/run-widgets-blame.log` (18 to 100 ms, 8b9c8672), `factcheck-runs/run-blame.log` (19 to 98 ms, 47b515dc), `notes/corrections-runs/widgets-blame-rerun.log` (19 to 103 ms, 108d663f) |
| `quarantine` | Apply the record at start; mark applied | verified (read): `ISO:172-185`; verified (ran): WE `crash_record_after_restart`, `quarantine_file` |
| `quarantine` | Held row loads with no code; failed in list; 503 `widget-failed`; hello `programRev: -1` | verified (read): `ISO:226-228`, `WR:966-974`, `WR:601-606`, `WR:855`; verified (ran): WE `widget_list_quarantined`, `call_quarantined`, `program_route_quarantined`, `slug_stream_hello_quarantined` |
| `quarantine` | Lift on a changed SHA-256 of the package files | verified (read): `REC:112-124`, `ISO:199-210`; verified (ran): WE `install_fixed`, `quarantine_file_after_fix` (`[]`) |
| `quarantine` | A crash before register has no package folder and cannot lift by hash | verified (PR): #62 Findings; inferred from `ISO:257-267` (root from `known`, filled at register) |
| `supervisor` | Owns exits only after the first ready host | verified (read): `SUP:106`, `SUP:141-150` |
| `supervisor` | Blamed only when the record pid is the dead host and not applied | verified (read): `SUP:58-63`, `SUP:157-160` |
| `supervisor` | Blamed: 500 ms, not counted. Unblamed in 60 s: 500, 2,000, 8,000 ms | verified (read): `apps/desktop/src/deepwidgets-crash-policy.ts:10-51`; verified (ran): `notes/worked-example/policy.log` |
| `supervisor` | Restart starts a host and loads the main window; widget windows stay | verified (read): `apps/desktop/src/main.ts:636-654`; verified (PR): #61 |
| `safe_mode` | 2 unblamed in 60 s: safe mode by env flag; runtime refuses non-built-in widgets; off in the list, no routes, no window | verified (read): `deepwidgets-crash-policy.ts:14`, `SUP:138`, `WR:504`, `WR:874-881`, `WR:187-188`, `WR:933-936` |
| `safe_mode` | Built-in by real module path; only `widget-sample` | verified (read): `WR:39-48`, `WR:62-97` |
| `safe_mode` | 4 unblamed in 60 s: give-up and fatal dialog; the dialog blocks Electron main on macOS (the narration names PR #61) | verified (read): `deepwidgets-crash-policy.ts:16`, `apps/desktop/src/main.ts:576`; verified (PR): #61 Findings. Not run. |
| `watchdog` | PR #65 merged on 2 November | verified (ran): `gh pr view 65` (state MERGED, `2026-11-02T08:11:01Z`, merge `7503af6c`); `git log origin/main` has `7503af6c Merge #65` |
| `watchdog` | Without the watchdog, a loop freezes the host and nothing kills it | verified (read): the claimer runs only on a fatal event (`ISO:279-284`); no other kill path in `ISO` or `SUP` (inferred from a read) |
| `watchdog` | Worker thread, heartbeat 100 ms, slot written before widget code, poll 50 ms | verified (read): `WD:25-29`, `WD:39-49`, `WD:105`, `WD:123`, `ISO:81-83` |
| `watchdog` | A poll gap of one second (half the threshold) restarts the stall clock | verified (read): `WDW:136`, `WDW:159-164`; verified (ran): `widgets-watchdog.log` (108d663f) `suspend: 10 cycles ... do not kill the host` |
| `watchdog` | Provisional record at 500 ms by slot; removed when the beat returns; crash record and SIGKILL at 2 s | verified (read): `WDW:4-7`, `WDW:150-157`, `WDW:166-180`, `WDW:181-199`; verified (ran): `widgets-watchdog.log` `stall` and `spin` lines |
| `watchdog` | Electron main uses the provisional record only for an abort exit; else it removes it | verified (read): `SUP:71-79` (SIGABRT, SIGTRAP, SIGILL, code 134), `SUP:81-98`, `SUP:157-159`, `apps/desktop/src/host-process.ts:240-252` (exit carries code and signal); verified (ran): `notes/corrections-runs/vitest.log` 11 of 11 |
| `watchdog` | 150 MB parse 868 ms, host lives; loop killed 2,050 ms after the call | verified (ran): `notes/corrections-runs/widgets-watchdog.log` (108d663f) `parseMs 868`, `alive true`; `spin` `exit SIGKILL`, `ms 2050`. PR #65 reported 757 ms and 2,041 ms. |
| `watchdog` | The CLI host loads the native stack module; the desktop host has no Electron build, so it blames by slot only | verified (read): `WD:10-12`, `WD:56-74`; verified (PR): #65 Look Before You Build and Findings |
| `example_*` | Every outcome in the example scenes; times rounded to cover three runs | verified (ran): WE, WE-F, WE2, step names as in the visuals. The rounded times hold in all three runs (`corrections.md`). The widget source `groceries` is illustrative agent code (`notes/worked-example/out/groceries*.index.ts`). |
| `example_user_door` | Parser result: 4 statements, query `list`, mutation `add`, 0 errors; typo `Buton` gives unknown component | verified (ran): `notes/worked-example/parse.log` |
| `example_quarantine` | In the app, the supervisor restarts the host | verified (read): `SUP:150-180`. The script restarted it by hand. |
| `checks_and_mutants` | One unit per PR for each widget-system box, fresh reviewer, mutants | verified (read): `docs/plans/widget-mvp.md:3`, `22-23` |
| `checks_and_mutants` | Queue mutant `n=1`; fence mutant: three checks failed | verified (PR): #54, #55 (3 of 13); verified (ran, fact-check at 47b515dc): `factcheck-runs/mutant-queue.log`, `mutant-fence.log` (3 of 23). `WR` and `MCP` did not change in the merge. |
| `checks_and_mutants` | At 108d663f: 34, 23, 26, 21 PASS lines; blame failed once with the flake, then 24; 11 of 11 tests | verified (ran): `sources.runs` rows marked (108d663f) |
| `limits_measured` | Agent call and click under 0.1 s; install about 3 to 4 s | verified (ran): WE, WE-F, WE2 (35, 73, 54 ms; 12, 23, 26 ms; 3.2 to 4.2 s) |
| `limits_measured` | Live window 2,073 ms after a kill | verified (PR): #61 |
| `limits_measured` | About 20.6 MB per window; json about 10 ms per write, about 100 writes each second; sqlite about 0.2 ms, not on | verified (read): `where-we-stand.md:176`, `179`, `211`, `231` (spike results); `docs/specs/widget-mvp.md:144` (json in MVP) |
| `open_items` | Waiting decisions; the build uses provisional choices | verified (read): `where-we-stand.md:186-192`, `docs/specs/widget-mvp.md:134-145`, `docs/specs/widget-phase2.md:76` |
| `open_items` | Not built: window manager, positions, tray, main window as widget | verified (read): `docs/specs/widget-mvp.md:163`, decisions `widget.window_manager`, `widget.main_window`, `widget.app_presence` (`where-we-stand.md:38-41`) |
| `open_items` | The host does not check a program before it stores it | verified (read): `WR:795-804` (only a non-empty check) |
| `open_items` | Packaged build failed on 2026-10-27; nobody fixed it since; so only the development app is known to run | verified (read): `where-we-stand.md:238`. inferred: no packaging fix after 2026-10-27 in `git log origin/main`. Not run again. |
| `open_items` | Two new plan units: agent row ids (PR #67 open) and the check-only fix of the flake | verified (read): `docs/plans/widget-phase2.md:14-15` at 108d663f; verified (ran): `gh pr view 67` OPEN |
| `open_items` | Unchecked facts | verified (read): `where-we-stand.md:244-252` |
| `open_items` | Flake `HMR transactions cannot be nested`; it failed once in the runs for this video | verified (PR): #65 Exit codes; verified (ran): `notes/corrections-runs/widgets-blame.log` exit 1 with that text, rerun exit 0 |
| `closing` | 40 of 200 rows kept | verified (read): `CLAUDE.md:33`; verified (ran): row count above |
| `closing` | The watchdog ends a host that a loop holds; after a crash the others come back and the data stays | verified (ran): `widgets-watchdog.log` (108d663f) `spin`; WE `sample_still_live`, `state_after_fix` |

## Doc and code differences found `sources.drift`

These are not errors of the video. The video follows the code.

| Doc | Says | Code at `108d663f` |
|---|---|---|
| PR #60 body | The token answer has `nonce` | The answer has `proof` = HMAC of the challenge; the nonce never leaves the file (`MCP:539`) |
| PR #61 and #62 bodies | Safe mode uses a `!!js` condition on the sample row | Safe mode is in the runtime by module path (`WR:874-881`); the sample row has no condition (`deepwidgets/widget-sample/cordis.patch.yml`) |
| `docs/specs/widget-mvp.md:116` | A "panel" window | A `BrowserWindow` with `frame: false` and `alwaysOnTop`, not `type: 'panel'` (`deepwidgets-windows.ts:165-176`) |
| `where-we-stand.md:171` | A program that names a missing action is refused with 422 (overnight runtime) | `setProgram` checks only for non-empty text (`WR:797`) |
| `docs/specs/widget-phase2.md:80` | A failed reinstall can leave no version | The installer restores the previous bundle (`CRE:566-572`); only a failed restore leaves none (inferred) |
| `CLAUDE.md:13` | 387 workspace packages | 394 with the root; 387 come from DSH (`factcheck-runs/workspace-packages.txt`) |
| PR #65 body | A provisional record of the dead host makes the crash blamed | Only for an abort exit; else Electron main removes it (`SUP:81-98`, commit `4eacf7c0`) |
| `docs/specs/widget-phase2.md:68-74` | Agent bundles get the row id `deepwidgets-agent-<slug>` | Not in the code yet: `CRE:157` gives `deepwidgets-widget-<slug>`. PR #67 is open. |
