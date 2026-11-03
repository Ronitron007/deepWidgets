# Sources of the explainer `explainer_kit.sources`

Each claim of `narration.md` and of the visuals in `script.md` has a row here. The label is one of these:

- verified (read): the file and line at `origin/main` `e6af003f`, or the raw spike file named in the row.

- verified (ran): a read-only command that ran on 2026-11-03 in this session. The command is in the row.

- verified (spike): a number of the spike record or of the raw spike files. The spike ran it, and this session read the result. This session did not run it again.

- inferred: it follows from the code, the spike design, or the docs, but nothing ran it.

Abbreviations. `KS` is `docs/explore/widget-system/widget-kit-spike.md`. `B` is `~/.deepwidgets/kit-spike/build/`. `M` is `~/.deepwidgets/kit-spike/mcp/`. `MEAS` is `B/measurements.tsv`. `R1`, `R2A`, `R2B` are `B/results-v1.tsv`, `B/results-v2a.tsv`, `B/results-v2b.tsv`. `MR` is `M/research.md`. `MO` is `M/measure-out.md`. `SH` is `deepwidgets/shell/src/main.tsx`. `CRE` is `deepwidgets/mcp/src/creation.ts`. `MCP` is `deepwidgets/mcp/src/index.ts`. `WR` is `deepwidgets/widgets/src/index.ts`. `WWS` is `docs/explore/widget-system/where-we-stand.md`. The raw spike files are not in git. They are on the operator's Mac (`KS:149-151`).

## Corrections to the spike record `sources.corrections`

| Spike record says | What the raw files say | What the video says |
|---|---|---|
| `KS:94`: "about 500 characters ... about 5,900 characters ... about 770,000 characters" | `MO:24-28`: 20 packages are 1,667 characters (505 tokens), 19,447 characters (5,893 tokens), and 2,554,817 characters (774,187 tokens). The 500, 5,900, and 770,000 are token estimates (characters / 3.3, `MR:33`), not characters. | Characters and token estimates, each labeled (`describe_cost`). |
| `KS:147`: "About 85 MB of the kit is build tooling. lucide is 46 MB and date-fns is 39 MB." | 46 + 39 = 85, so the 85 MB looks like lucide plus date-fns, not build tooling. `du -sh` gave `node_modules` 228M, `lucide-react@0.575.0_react@18.3.1` 45M, `date-fns@4.0.0` 38M (verified, ran, in the spike temp folder `kit/v1/node_modules/.pnpm`). | The `du` numbers, and "we could not check that sentence" (`risks_build`). |

## Claims by scene `sources.claims`

| Scene | Claim | Label and evidence |
|---|---|---|
| `cold_open` | Not a spec; spike on 2026-11-03 at `1ca2967d`; numbers measured unless "inferred" | verified (read): `KS:1-3` |
| `cold_open` | Today each window shows the same page with one fixed component set | verified (read): `SH:1-3,15-18`; `WWS:44` |
| `outline_today` | Path: bundle, `widget_install`, three gates, plugin manager and hmr, shared shell | verified (read): `CRE:1-11`, `MCP:433-436`, `SH:1-9` |
| `outline_kit` | Kit path: kit project, agent library and child, Vite build per widget, render check, page per slug, host extras, two doors | verified (read): `KS:7-17,100-104`; `B/core/vite.config.ts:7`; render check `B/render/main.cjs:1-21`. The type gate in front is from `KS:71`. |
| `direction_list` | Seven points of the operator direction | verified (read): `KS:5-19` |
| `example_cast` | Three widgets shadcn, clock, meter; clock uses `date-fns` `format`; meter uses `Meter` from `dw-mini-ui` | verified (read): `B/widgets/clock/agent/library.tsx:2-9`, `B/widgets/meter/agent/library.tsx:3-8`, `B/widgets/shadcn/agent/` |
| `example_cast` | v2a: `date-fns` 4.0.0 to 4.1.0; v2b: `dw-mini-ui` 1.0.0 to 2.0.0 with renamed props | verified (read): `B/kit/v1/package.json:20-21`, `B/kit/v2a/package.json:20`, `B/kit/v2b/package.json:21`; `B/local-pkgs/src1/index.d.ts`, `B/local-pkgs/src2/index.d.ts` |
| `today_shell` | `main.tsx` holds `Renderer.Root` directly, plus stream, refresh, diagnostics; one page for each window | verified (read): `SH:1-10,47-74,141-170,178-193` |
| `today_shell` | Vite builds the shell once with base `/widget/` into `dist/widget` | verified (read): `deepwidgets/shell/vite.config.ts:8-10` |
| `today_component_set` | One set `shadcn-widgets@1` in `library.tsx`; refusal "Unsupported component set" | verified (read): `deepwidgets/shell/src/library.tsx:27,145`; `SH:18,113-117` |
| `today_component_set` | `widget.runtime_pin`: all widgets share one shell, pinned to one version; no change recorded | verified (read): `WWS:44`. "Would replace" is inferred from `KS:9` (own Vite build per widget). |
| `today_creation` | Staging folder, compile with esbuild, lint with oxlint `--type-aware --type-check` and tsgolint, test run in a throwaway process, plugin manager install | verified (read): `CRE:1-11,184-189,236-261,264-288,373-392` |
| `today_creation` | tsgolint runs on the Go port of the TypeScript compiler | inferred (general knowledge of `oxlint-tsgolint`; not checked in this session) |
| `today_paths_map` | The tsconfig paths map has only `zod` | verified (read): `CRE:208` |
| `today_paths_map` | Guide rule: only zod and the widget types can be imported | verified (read): `MCP:106` |
| `today_paths_map` | zod alone is 545 KB in each host half | verified (spike): `KS:52`, `MEAS:28` |
| `today_paths_map` | The installed bundle `package.json` has no dependencies | verified (read): `CRE:404-416` |
| `today_serving` | Electron main serves `/widget/` from `@deepwidgets/shell/dist`; same index for every slug; slug in the query string | verified (read): `apps/desktop/src/main.ts:79,827-836` |
| `today_serving` | Other paths go to the host with the host cookie | verified (read): `apps/desktop/src/main.ts:837-842`; `WWS:51` |
| `today_agent_text` | Fixed instructions; nine tools with fixed descriptions; `widget_guide` returns the guide as tool output | verified (read): `MCP:376-446` (`grep -c registerTool(` gives 9) |
| `today_agent_text` | The OpenUI part of the guide is about 16 KB | verified (ran): `ls -la /Users/rohanmalik/deepWidgets/deepwidgets/shell/dist/guide.md` gives 16,195 bytes. This is the main checkout build, not this worktree. `MR:41` says about 16 kB for the whole guide. |
| `library_why`, `library_split` | Core: channel, refresh bridge, boot, diagnostics; agent child holds the renderer and library | verified (read): `MR:100`; spike `B/core/src/main.tsx:15-16,48-74,178-190` |
| `library_split` | `main.tsx` imports the child and the catalog id from `@agent/child.tsx` | verified (read): `B/core/src/main.tsx:16` |
| `library_contract` | `RootProps` = renderer root props without `library` and `children`; `ChildProps { root; children? }` | verified (read): `B/core/src/contract.ts:1-5` |
| `library_contract` | Core fills root with response, tool provider, error handlers | verified (read): `B/core/src/main.tsx:178-190` |
| `library_agent_code` | Meter library content; `meter@1`; child file of 7 lines | verified (read): `B/widgets/meter/agent/library.tsx:1-14`, `B/widgets/meter/agent/child.tsx:1-7` |
| `library_catalog` | Each page compiles in the id that the child exports | verified (read): `B/core/src/main.tsx:16,20` |
| `library_catalog` | The guide must describe the catalog of each widget | inferred (from `MCP:120-125`: the guide reads the shell's generated `guide.md`) |
| `library_work` | Reads and writes of the split; failure stops type gate or build | inferred (from `MR:99-100`) |
| `library_work` | Sizes: split M, guide and template S | verified (read): `KS:129-130`; the sizes are inferred in the record |
| `vite_gate` | Own Vite build per widget at install time, layout A | verified (read): `KS:9` |
| `vite_inputs_outputs` | Inputs core src, agent folder, index page, Vite config, tsconfig; resolves from kit `node_modules` | verified (read): `B/bin/prepare:5-9` |
| `vite_inputs_outputs` | Base `/widget/<slug>/`, React and Tailwind plugins, `chrome140` | verified (read): `B/core/vite.config.ts:7-10` |
| `vite_inputs_outputs` | Charts chunk 388 KB, lazy | verified (spike): `MEAS:20` |
| `vite_numbers` | shadcn 2.811 s 796 KB, clock 1.047 s 372 KB, meter 0.904 s 352 KB; cold shadcn 4.3 s | verified (spike): `R1:1-3`, `MEAS:20-21`, `KS:40` |
| `vite_numbers` | All three rendered in Electron | verified (spike): `KS:42` |
| `vite_cache` | No persistent build cache; warm saves about 1.4 s | verified (spike): `KS:44`; 4.3 s cold vs 2.8 to 2.9 s warm in `MEAS:20` |
| `vite_cache` | Large library about three to four seconds | verified (spike): shadcn vite 2.811 to 3.753 s in `R1`, `R2A`, `R2B` |
| `tailwind_source` | No classes from a `node_modules` package without its own `@source` | verified (spike): `KS:46`, `MEAS:32` |
| `tailwind_source` | Today the shell has only `@source "./"`; spike adds `./agent` and `../node_modules/dw-mini-ui` | verified (read): `deepwidgets/shell/src/styles.css:13`; `B/core/src/styles.css:13-15` |
| `tailwind_source` | The build gate must write the `@source` lines | inferred |
| `render_check` | Hidden window, 1.5 s wait, reads state, errors, text | verified (read): `B/render/main.cjs:11-17` |
| `render_check` | About 1.6 s for each widget | verified (spike): `KS:65`, `MEAS:24` |
| `render_check` | Finds only errors that throw; a wrong prop of an untyped extra passes | verified (read): `KS:137` (risk, not a run) |
| `vite_failures` | Old page stays on failure | inferred: `KS:67-71` (labeled inferred there) |
| `vite_failures` | Vite does not check types: meter v2b `tsc_exit=2`, `vite_exit=0` | verified (spike): `R2B:3` |
| `vite_work` | Refuse imports outside core and renderer extras; size L | verified (read): `MR:96`; `KS:126` (size inferred) |
| `types_why` | esbuild and Vite strip types only | inferred (general tool knowledge), consistent with `R2B:3` |
| `types_tsc` | Strict tsconfig with exact optional property types | verified (read): `B/core/tsconfig.json:3-4` |
| `types_tsc` | shadcn 1.4 to 1.9 s, clock 0.62 to 0.66 s, meter 0.53 to 0.58 s | verified (spike): `MEAS:22`, `R1`, `R2A`, `R2B` |
| `types_config` | Aliases `@agent`, `@core`; `skipLibCheck` on | verified (read): `B/core/tsconfig.json:5,7` |
| `types_config` | An extra with no type file gives no type help | inferred |
| `types_tsgolint` | Today's lint gate uses oxlint with tsgolint | verified (read): `CRE:141-146,267-274` |
| `types_tsgolint` | 0.11 to 0.55 s; found the same v2b error | verified (spike): `KS:79`, `MEAS:23` |
| `types_tsgolint` | About three to five times faster | verified (ran, arithmetic): shadcn 1.4 to 1.9 / 0.29 to 0.55, meter 0.53 to 0.58 / 0.11 to 0.12 give 2.5x to 6.6x at the extremes, about 3x to 5x for matched runs. Labeled "computed". |
| `types_tsgolint` | Tool not decided | verified (read): `KS:79` gives no choice |
| `types_error_path` | `gate-failed` answer with gate, diagnostics, next step | verified (read): `CRE:551-554`, `MCP:68` |
| `types_error_path` | Kit type gate uses the same answer | inferred |
| `types_work` | No row of its own in the work map | verified (read): `KS:118-133`; part of the Vite gate is inferred |
| `pnpm_terms` | Store, lockfile, fetch, offline install, APFS clone | verified (read): `B/research.md:17-19`; clone message in `B/s2/miss/install.log` ("Packages are cloned from the content-addressable store") |
| `kit_project` | 24 packages, exact versions | verified (read): `B/kit/v1/package.json:5-30` (24 entries) |
| `kit_project` | Resolve 6.9 s 35 MB; fetch 5.0 s 38 MB; store 219 MB; metadata cache 113 MB | verified (spike): `MEAS:2-3` |
| `kit_project` | pnpm 11.28.5, Node 24.21.0, bundled runtime | verified (read): `KS:23`, `B/bin/rtpnpm:3-4` |
| `strategy_fresh_install` | Cold 13.95 s 74 MB; warm 3.0 to 3.1 s; add 3.25 s 817 KB; registry down fails after 70.5 s | verified (spike): `MEAS:7-10`, `KS:27-32`; log `B/s1/down/install.log` ends with `ERR_PNPM_META_FETCH_FAIL` |
| `strategy_fresh_install` | Each build resolves transitive versions again | verified (read): `KS:31` |
| `pnpm_strict_builds` | `ERR_PNPM_IGNORED_BUILDS` on esbuild and lang-core; fix `allowBuilds` or `strict-dep-builds=false` | verified (read): `B/s1/cold1/install.log` (last lines), `MEAS:11`, `KS:34` |
| `strategy_kit_lockfile` | Offline install 2.6 to 3.3 s, 0 net, about 10 MB disk; link 0 s | verified (spike): `MEAS:12-13` |
| `strategy_kit_lockfile` | New kit version: about 1.0 s resolve, 3.2 s fetch, 0.5 s install | verified (spike): `MEAS:5-6`, `KS:27`; logs `B/kit/v2b/resolve.log` ("Done in 855ms"), `B/kit/v2b/install.log` ("Done in 524ms") |
| `pnpm_trust_lockfile` | `trust-lockfile=true` needed; else `minimumReleaseAge` 1440 min, 113 MB metadata, `NO_OFFLINE_META` | verified (spike): `KS:34`, `MEAS:14` |
| `pnpm_trust_lockfile` | Holds a security fix 24 hours unless excluded | verified (read): `KS:139` (risk) |
| `kit_lockfile_failures` | `NO_OFFLINE_TARBALL` in 0.8 s; `OUTDATED_LOCKFILE` on drift | verified (spike): `MEAS:15-16`; logs `B/s2/miss/install.log`, `B/s2/drift/install.log` |
| `kit_lockfile_failures` | Neither failure touches the network | verified (read): the miss log names `http://127.0.0.1:9` (a dead port) and offline mode. The drift failure is a lockfile check before fetch (inferred). |
| `strategy_shared_chunks` | 17 shared specifiers; external plus `output.paths` | verified (read): `B/s3/build-kit-runtime.mjs:8-10`, `B/s3/kit-v1/shared.json`, `B/core/vite.config.s3.ts:13-14` |
| `strategy_shared_chunks` | Runtime 3.5 to 3.8 s, 2.1 MB; widget 0.29 to 0.93 s; 44 to 96 KB; lucide 903 KB, recharts 578 KB | verified (spike): `MEAS:17-18` |
| `strategy_compare` | Table values | verified (read): `KS:25-32` |
| `strategy_compare` | Strategy not decided | verified (read): `KS:5-19` has no choice |
| `packaging_work` | Kit service with pnpm, size L | verified (read): `KS:123` (size inferred) |
| `host_bundle` | 594 KB in 377 ms | verified (spike): `MEAS:28`, `KS:52` |
| `host_external` | 350 B in 16 ms; `ERR_MODULE_NOT_FOUND` unless the bundle links to kit `node_modules` | verified (spike): `MEAS:29`, `KS:53` |
| `host_external` | A kit change under the link changes the code that the widget runs | inferred |
| `host_external` | Resolve from `<profile>/node_modules` | inferred: `KS:143` (labeled inferred there) |
| `host_native` | esbuild has no loader for `.node`; ABI 149 vs 137 | verified (spike): `MEAS:30-31`, `KS:54` |
| `host_rules` | Gate reads host source and kit `node_modules`; test run stops a failing import | inferred (from `CRE:236-353` and `B/host/build.mjs:7-8`) |
| `host_work` | Paths map only zod; size M | verified (read): `CRE:208`, `KS:127` (size inferred) |
| `pin_question` | Rebuild of all three 8.3 to 9.0 s | verified (spike): `R2A:4` (9.018 s), `R2B:6` (8.265 s), `MEAS:27` |
| `example_v2a` | 0 of 3 broke at type, build, render | verified (spike): `R2A:1-3`, `MEAS:25`, `KS:62` |
| `example_v2b_types` | `Meter` props `value, max, label` became `percent, caption`; `Pill` unchanged | verified (read): `B/local-pkgs/src1/index.d.ts`, `B/local-pkgs/src2/index.d.ts` |
| `example_v2b_types` | shadcn does not use `dw-mini-ui`; clock uses only `Pill` | verified (read): `B/widgets/clock/agent/library.tsx:4`; `grep -rl dw-mini-ui B/widgets/shadcn/` finds no file (verified, ran) |
| `example_v2b_types` | TS2322 at `src/agent/library.tsx(8,36)` with the message text | verified (spike): `R2B:4-5` |
| `example_v2b_render` | Build passed; render failed with `render-error` | verified (spike): `R2B:3`, `MEAS:26`, `KS:63` |
| `example_v2b_render` | The new meter throws when `percent` is absent | verified (read): `B/local-pkgs/src2/index.js:3` |
| `example_v2b_render` | OpenUI gave the code `render-error` | verified (spike): `KS:63`. The render log is not saved; this session did not see the raw render output. |
| `shared_chunks_swap` | In-place kit change broke the old v1 meter with `render-error` | verified (spike): `MEAS:19`, `KS:32` |
| `shared_chunks_swap` | One runtime folder per kit version, about 2.1 MB | verified (read): `KS:30`; folders `B/s3/kit-v1`, `kit-v2a`, `kit-v2b` |
| `pin_policy` | The four policy lines | inferred: `KS:67-75` (labeled inferred there) |
| `pin_work` | Record kit version and lock hash; in-use check; rebuild path; size M | verified (read): `MR:98`, `KS:128` (size inferred) |
| `describe_test` | Claude Code 2.1.317, fake model API, no paid run, markers, bump with notifies | verified (read): `MR:3-10`, `M/server.mjs:21-38,64-81` |
| `describe_results` | Tool output and resources live; `list_changed` refetch; new tool deferred; loaded description stays; instructions never re-read | verified (read): `MR:14-25`, `KS:85-92` |
| `describe_results` | Refetch within 12 to 63 ms | verified (ran): parse of `M/run-stateless2/server.log` (bump 12:53:13.040, next fetches at .052, .058, .061) and `M/run-stateless3/server.log` (bump 12:54:50.178, fetches at .235, .239, .241) |
| `describe_results` | `KIT_TOOL_V1` and `KIT_INSTR_V1` stay in requests 05 to 08; `kitVersion 2` in tool output | verified (ran): regex count of markers in `M/run-stateless2/messages-0*.json` and `M/run-stateless3/messages-0*.json` |
| `describe_rule` | Kit facts in tool output and resource; `kit_add` and `kit_remove` always registered | verified (read): `KS:92`, `MR:29,77` |
| `describe_cost` | 1,667 / 19,447 / 2,554,817 characters; tokens 505 / 5,893 / 774,187; lucide types 2,173,743 characters | verified (spike): `MO:6,24-28`; token method inferred (`MR:33`) |
| `describe_cost` | Card content; types never inline, path only | verified (read): `MR:38-44` |
| `describe_work` | Index into guide and `kit_read`; per-package resource; `resourcesChanged`; size M | verified (read): `MR:92`, `KS:122` (size inferred) |
| `config_place` | Kit folder, files, `kit.json` fields; why not the profile `package.json` or host storage | verified (read): `KS:98-100`, `MR:61`. A design, not a decision. |
| `config_setting` | `agentsMayAddPackages` in host settings | verified (read): `KS:100`, `MR:61` |
| `config_setting` | User can always change the kit | verified (read): `MR:73` ("the user door ignores kit-locked") |
| `kit_read_describe` | `ctx.widgetKit`, two doors; `kit_read` and `kit_describe` shapes | verified (read): `MR:63-68` |
| `kit_add_remove` | `kit_add` and `kit_remove` shapes | verified (read): `MR:69-70` |
| `kit_add_remove` | Request id makes a retry safe, as `widget_call` | verified (read): `MCP:398-401`; for kit tools inferred |
| `kit_errors` | Errors and the `kit-locked` next step; `in-use` lists slugs | verified (read): `KS:102`, `MR:69-70` |
| `kit_errors` | Meaning of `not-found` and `install-failed` | inferred from the names and `MR:82` |
| `add_steps` | The steps of one addition | verified (read): `KS:106`, `MR:79-86` |
| `add_example` | nanoid add: 1.2 + 3.3 + 0.5 = 5.0 s, 47 KB | verified (spike): `MEAS:4` |
| `add_example` | The `kit_add` answer | illustrative |
| `config_work` | Sizes M and L | verified (read): `KS:122-123` (sizes inferred) |
| `kit_routes` | Five routes; user door ignores `kit-locked` | verified (read): `KS:104`, `MR:71-75` |
| `kit_routes` | Today's routes program, call, stream, events; cookie check | verified (read): `WR:1081-1135,1255-1258`; `WWS:51` |
| `kit_routes` | Size S | verified (read): `KS:125` (size inferred) |
| `settings_rules` | Reason: the setting limits agents | inferred (from `MR:73,77`) |
| `settings_rules` | Pane errors and stream refresh | inferred |
| `kit_feed` | `WidgetChange` kinds | verified (read): `WR:261-269` |
| `kit_feed` | A kit change needs a new kind or feed | inferred |
| `settings_pane` | Pane content: toggle, extras list, add and remove form; size M | verified (read): `MR:94`, `KS:124` (size inferred). The mock is illustrative. |
| `serving_today` | One shell from one folder; URL `/widget/?slug=` | verified (read): `apps/desktop/src/main.ts:79,827-836` |
| `serving_slug` | Spike base `/widget/<slug>/`; Electron main and window URL changes | verified (read): `B/core/vite.config.ts:7`; the changes are inferred (`MR:101`) |
| `serving_rebuild` | Swap after gates; old page on failure; cleanup | inferred |
| `serving_csp` | CSP `script-src 'self'` | verified (read): `deepwidgets/shell/index.html:5`, `B/core/index.html:5` |
| `serving_csp` | Each strategy can keep files on the same origin; fallback page; size M | inferred (`MR:101`); size from `KS:131` (inferred) |
| `checks_list` | Smoke, MCP `kit-locked` and `in-use`, list_changed test with the modern client; size M | verified (read): `MR:102`, `KS:132` (size inferred) |
| `checks_today` | `tools/widgets-mcp.mjs`, `tools/widgets-create.mjs`, smoke widget check exist | verified (ran): `ls tools`; `CLAUDE.md` `head.status` |
| `checks_today` | The list of changes | inferred |
| `tla_models` | Three models; `WidgetInstall.tla` models install, reload, remove with crashes | verified (read): `ls .agents/skills/widget-state-models/`; `WidgetInstall.tla:1-11` |
| `tla_models` | Build step, kit version, remove race, new kit model; others unchanged | inferred: `MR:103`, `KS:133` |
| `prior_art` | Context7 two tools | verified (read): `MR:50` (the spike read the GitHub README) |
| `prior_art` | llms.txt, Raycast, VS Code, Val Town, Observable, Deno | from memory of the spike: `KS:108-116`, `MR:51-56` |
| `prior_art` | No project does the whole path | verified (read): `B/research.md:32-33` |
| `risks_build` | Render check, S3 cannot drop unused code | verified (read): `KS:137,145` |
| `risks_build` | `node_modules` 228 MB, lucide 45 MB, date-fns 38 MB | verified (ran): `du -sh` in the spike temp folder (see `sources.corrections`) |
| `risks_supply` | Release age, `file:` path, profile resolve, ABI | verified (read): `KS:139-143`, `MEAS:31`; profile resolve inferred (`KS:143`) |
| `work_map` | Twelve rows and sizes | verified (read): `KS:118-133`; all sizes inferred there |
| `open_items` | Each open point | verified (read): `KS:5-19,67-79,96-106`, `MR:44`, `WWS:44`. No recommendation. |
| `closing` | Twelve fronts | verified (read): `KS:120-133` (12 rows) |
