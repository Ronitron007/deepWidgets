# Glossary `explainer_kit.glossary`

Each term is defined in the narration at its first use. The scene name in brackets is the scene of that first use. The terms of the earlier video (`docs/explainers/2026-11-02-deepwidgets/glossary.md`) keep their meaning here.

| Term | Meaning |
|---|---|
| widget kit | The direction in which each widget gets its own page, built from a component library that an agent writes, against a kit of packages. A direction in progress, not a decided spec. [`cold_open`] |
| spike | A short test that measures one question. Here, `kit_spike` on 2026-11-03 at `origin/main` `1ca2967d`. [`cold_open`] |
| operator | Rohan, the person who makes each project decision. [`cold_open`] |
| operator direction so far | The seven points of `kit_spike.direction`. They are direction, not decisions of `where-we-stand.md`. [`direction_list`] |
| widget bundle | A package with the code of one widget: a host half and, today, a program for the shared shell. [`outline_today`] |
| MCP | Model Context Protocol. A protocol that lets an agent call tools of a server. [`outline_today`] |
| host | The Node child process that runs all widget code. [`outline_today`] |
| shell | The page that draws a widget in its window. Today one shared page, `@deepwidgets/shell`. [`outline_today`] |
| kit project | A pnpm project folder with the packages that widgets can use: a locked core and user extras. Design place: `$DSH_HOME/deepwidgets/kit/`. [`outline_kit`] |
| OpenUI | The library (`@openuidev/react-lang`) that turns a program text into React components. [`outline_kit`] |
| child component (child) | The agent file that holds `<Renderer.Root>` and passes the agent library to it. [`outline_kit`] |
| slug | The id of a widget, for example `meter`. [`outline_kit`] |
| Electron main | The Electron process that makes windows and answers each `dsh-app://` request. [`outline_kit`] |
| core | The packages and code that `main.tsx` needs. Locked: no tool can remove them. [`direction_list`] |
| extra | A package that the user, or an agent when the setting allows it, adds to the kit. [`direction_list`] |
| `main.tsx` | The entry file of the shell page. [`direction_list`] |
| prop | One input of a React component, for example `value` of `Meter`. [`example_cast`] |
| kit v1, v2a, v2b | The three kit versions of the spike. v2a moves `date-fns` 4.0.0 to 4.1.0. v2b moves `dw-mini-ui` 1.0.0 to 2.0.0, with renamed props. [`example_cast`] |
| `dw-mini-ui` | A small local test package of the spike with `Meter` and `Pill`. [`example_cast`] |
| program | The OpenUI Lang text that tells the shell what to show. [`today_shell`] |
| OpenUI Lang | The text language of a program. [`today_shell`] |
| renderer root (`Renderer.Root`) | The OpenUI component that parses a program and draws it with a library. [`today_shell`] |
| component set (catalog) | A list of components with names, props, and descriptions, under one id, for example `shadcn-widgets@1` or `meter@1`. [`today_component_set`] |
| `widget.runtime_pin` | The standing decision that all widgets share one shell, pinned to one version. [`today_component_set`] |
| staging folder | The throwaway folder where the creation gates run. [`today_creation`] |
| esbuild | A fast JavaScript bundler. The compile gate uses it. [`today_creation`] |
| oxlint | A fast linter. The lint gate uses it with `--type-aware --type-check`. [`today_creation`] |
| tsgolint | The type checker of oxlint, built on the Go port of the TypeScript compiler. [`today_creation`] |
| plugin manager | The DSH plugin that installs a bundle while the app runs. [`today_creation`] |
| tsconfig file | The TypeScript config file that the gates write. [`today_paths_map`] |
| paths map | The `paths` field of a tsconfig file. It tells the compiler where a bare import name resolves. Today only `zod`. [`today_paths_map`] |
| zod | A library that checks data shapes. [`today_paths_map`] |
| host half | The part of a widget that runs in the host. [`today_paths_map`] |
| host cookie | The secret cookie that Electron main adds when it forwards a request to the host. [`today_serving`] |
| server instructions | A fixed text that an MCP server sends at connect time. Claude Code 2.1.317 never reads it again in a session. [`today_agent_text`] |
| tool description | The text that tells the agent what one tool does. A loaded description does not change in a session. [`today_agent_text`] |
| tool output | The answer of one tool call. Read live on each call. [`today_agent_text`] |
| refresh bridge (`RefreshBridge`) | The core component that runs the queries again when the stream reports new data. [`library_split`] |
| catalog id (`CATALOG_ID`) | The id that a library exports and that a program names. [`library_split`] |
| contract (`ChildProps`) | The TypeScript type where core and child meet: `{ root: RootProps; children?: ReactNode }`. [`library_contract`] |
| tool provider | The object that sends each query and mutation of a program to the call route. [`library_contract`] |
| work map | The table `kit_spike.work` of fronts and sizes S, M, L. All sizes are estimates. [`library_work`] |
| Vite | A build tool for web pages. [`vite_gate`] |
| layout A | One Vite build for each widget at install time. [`vite_gate`] |
| dist folder | The output folder of a Vite build. [`vite_inputs_outputs`] |
| Vite chunk | One script file of a Vite output. Vite can split code into chunks that load later. [`vite_inputs_outputs`] |
| Tailwind | The CSS tool of the shell. It writes only the classes that it finds in scanned files. [`tailwind_source`] |
| Tailwind `@source` | A style sheet line that tells Tailwind which folder to scan. A package in `node_modules` needs its own line. [`tailwind_source`] |
| render check | A load of the built page in a hidden Electron window, then a read of its state and errors. About 1.6 s for each widget. [`render_check`] |
| type gate | A TypeScript check of the agent code before the build. [`vite_failures`] |
| tsc | The TypeScript compiler, run in check mode. [`types_tsc`] |
| skip lib check (`skipLibCheck`) | A tsconfig option that skips the type files of packages. [`types_config`] |
| `gate-failed` | Today's error code of a failed creation gate, with diagnostics and a next step. [`types_error_path`] |
| pnpm | A package manager for Node. The app ships pnpm 11.28.5. [`pnpm_terms`] |
| pnpm store | A folder that holds each package file once, by its content hash. [`pnpm_terms`] |
| lockfile | `pnpm-lock.yaml`. It records the exact version of each package, also of indirect packages. [`pnpm_terms`] |
| pnpm fetch | A pnpm command that fills the store from the lockfile alone. [`pnpm_terms`] |
| APFS clone | A macOS file copy that shares the disk blocks until a file changes. [`pnpm_terms`] |
| registry | The online server of npm packages. [`pnpm_terms`] |
| metadata cache | The pnpm cache of package metadata. 113 MB for the spike kit. [`kit_project`] |
| fresh install (S1) | The packaging strategy where each widget gets its own install from the registry. [`strategy_fresh_install`] |
| build script | A package script that runs code at install time. pnpm 11 blocks them by default (`ERR_PNPM_IGNORED_BUILDS`). [`pnpm_strict_builds`] |
| kit lockfile (S2) | The packaging strategy with one kit lockfile and a store filled by `pnpm fetch`. Widget installs run offline or link to the kit `node_modules`. [`strategy_kit_lockfile`] |
| trust lockfile (`trust-lockfile`) | A pnpm setting that trusts the lockfile and skips the release age check. S2 needs it outside a workspace. [`pnpm_trust_lockfile`] |
| minimum release age (`minimumReleaseAge`) | A pnpm 11 check that holds back a version younger than 1440 minutes. [`pnpm_trust_lockfile`] |
| `NO_OFFLINE_META`, `NO_OFFLINE_TARBALL`, `OUTDATED_LOCKFILE` | pnpm errors: no metadata offline, a package missing from the store offline, a package file that does not match the lockfile. [`pnpm_trust_lockfile`] |
| shared chunks (S3) | The packaging strategy that builds the shared packages once for each kit version, as a runtime of script files. Widget builds mark them external. [`strategy_shared_chunks`] |
| kit runtime | The S3 script files of one kit version (2.1 MB). [`strategy_shared_chunks`] |
| external import | An import that a bundler leaves in the output, for Node or the page to resolve at run time. [`host_external`] |
| `ERR_MODULE_NOT_FOUND` | The Node error when an external import has no package to resolve. [`host_external`] |
| native addon | A package with compiled machine code in a `.node` file. [`host_native`] |
| ABI | Application binary interface. A native addon must match it. Electron 44 has ABI 149. The app Node has ABI 137. [`host_native`] |
| pin | Keep a widget page on the kit version that it built with. [`pin_question`] |
| rebuild | Build a widget again on a new kit. [`pin_question`] |
| minor version, major version | Parts of a version number. A minor version adds without breaking. A major version can break. [`example_v2a`] |
| TS2322 | The TypeScript error "Type X is not assignable to type Y". [`example_v2b_types`] |
| `render-error` | The OpenUI error code when a component throws while it draws. [`example_v2b_render`] |
| dynamic description | The kit facts that reach agents while the kit changes: tool output and a resource. [`describe_problem`] |
| MCP resource | A named piece of data that a client reads on request, for example `deepwidgets://kit/manifest`. [`describe_problem`] |
| list_changed | The MCP signal `notifications/tools/list_changed` (also for resources) that says a list changed. [`describe_test`] |
| deferred tool | A tool whose name only is in context until the agent loads it with tool search. [`describe_results`] |
| index line | One line for each package: `name@version (side): description`. About 25 tokens (estimate). [`describe_cost`] |
| card | The detail of one package: index line, types entry, import line, top exports, short usage. About 300 tokens (estimate). [`describe_cost`] |
| token | The unit of model text. Here estimated as characters divided by 3.3. [`describe_cost`] |
| `kit.json` | The kit file with the kit version and, for each extra, its side, `addedBy`, `addedAt`, and card. [`config_place`] |
| `agentsMayAddPackages` | The host setting that lets agents change the kit. [`config_setting`] |
| `ctx.widgetKit` | The kit service of the design, with an MCP door and an HTTP door. [`kit_read_describe`] |
| side | Where an extra runs: `renderer`, `host`, or `both`. [`kit_read_describe`] |
| `kit_read`, `kit_describe`, `kit_add`, `kit_remove` | The MCP kit tools of the design. [`kit_read_describe`] |
| request id | A caller id that makes a retry of a write safe. [`kit_add_remove`] |
| `kit-locked`, `in-core`, `in-use`, `not-found`, `install-failed` | The kit errors of the design. Also `bad-name` and `idempotency-conflict`. [`kit_errors`] |
| kit version (`kitVersion`) | A number that goes up by one on each kit change. [`add_steps`] |
| change feed | The list of recent changes that agents read with `widget_changes`. [`add_steps`] |
| `/api/kit` routes | The HTTP routes of the user door: `GET /api/kit`, `PUT /api/kit/settings`, `POST /api/kit/extras`, `DELETE /api/kit/extras/<name>`, `GET /api/kit/stream`. [`kit_routes`] |
| settings pane | The page where the user sees the setting, the core, and the extras. [`settings_pane`] |
| content security policy (CSP) | The page rule that lets scripts load only from the same origin. [`serving_csp`] |
| fallback page | The page that shows when a slug has no build. [`serving_csp`] |
| TLA+ | A language for models of systems that change state. [`tla_models`] |
| model checker | A tool that walks every order of steps of a model and checks its rules. [`tla_models`] |
| `WidgetInstall.tla` | The TLA+ model of `widget_install`, `widget_reload`, and `widget_remove`. [`tla_models`] |
| Context7 | An MCP server with two tools: one finds a library, one gives its documents on request. [`prior_art`] |
| `llms.txt` | A format with an index file and a full file for model readers. [`prior_art`] |
