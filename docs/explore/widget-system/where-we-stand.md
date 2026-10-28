# Widget system: where we stand `standing`

This is the one document for the widget system on 2026-10-27. It holds the decisions, the design, the evidence, the open questions, and the location of all work. The other files in this folder give more detail. You do not need them to read this file.

Labels on claims:

- "verified": an agent ran or read it on 2026-10-26 or 2026-10-27.

- "inferred": it follows from docs or code, but nobody ran it.

- "a guess": nobody checked it.

## Words in this document `standing.words`

| Word | Meaning |
|---|---|
| DSH | DeepSeek Harness. deepWidgets is a fork of DSH commit `22ddee3`. |
| host | The DSH Node process with one Cordis Context. All widget logic runs here. |
| Electron main | The Electron process that creates windows. It runs no Cordis. |
| shell | The pinned web page in each widget window. It renders the program of one widget. |
| program | The OpenUI Lang text that tells the shell what to show. It is data, not code. |
| slug | The human-readable id of a widget, given at creation, for example `groceries`. |
| action | A named operation of a widget, for example `add`. A query reads. A mutation writes. |
| widget bundle | The package of one widget. It holds the handler code that an agent writes. Each widget has one bundle. |
| agent | An outside MCP client, for example Claude Code. |
| operator | Rohan. The operator makes each decision. |

## The decisions so far `standing.decided`

The operator made these decisions. They outrank every other document.

| Name | Decision |
|---|---|
| `widget.plugins_only` | Every module is a Cordis plugin, as in DSH. Electron main is the one exception, because it runs no Cordis. |
| `widget.view` | A widget is a view: a host plugin and its own window. |
| `widget.window` | Each widget is a separate floating window. |
| `widget.floating` | Floating behavior is settled. The proof of concept with an Electron panel window, levels, all Spaces, and no focus steal passed the operator test. |
| `widget.window_manager` | A window manager plugin decides which widgets show on all desktops and which only on the main desktop. |
| `widget.main_window` | The main window is also a widget with a different config. |
| `widget.main_loading` | v1 shows a loading screen, then switches to the main widget. |
| `widget.app_presence` | The app is an accessory app with a status bar icon and no Dock icon. |
| `widget.relaunch` | A second launch opens the settings window, which is the main widget. |
| `widget.advanced` | An advanced widget has its own page Cordis and its own slots, so plugins can pair. |
| `widget.runtime_pin` | All widgets share one shell, pinned to one version. |
| `widget.no_server_html` | No widget shows HTML that the server makes. |
| `widget.framework` | React and OpenUI `react-lang`. Svelte is dropped. |
| `widget.components` | Components come through OpenUI Lang. |
| `widget.component_set` | A set based on shadcn comes with the app. Users can add their own sets later. |
| `widget.no_dsh_client_boot` | The shell does not use the DSH client boot. It is too large. |
| `widget.shell_url` | The shell loads from disk on the `dsh-app://app/` origin. |
| `widget.page_channel` | A page talks to the host only through `connection`, the cookie-checked `/api` routes. |
| `widget.mcp_server` | The host runs one MCP server plugin. Agents are MCP clients. A page never speaks MCP. |
| `widget.mcp_client` | Use the official MCP SDK. |
| `widget.mcp_v1` | One listener. The host web server binds a fixed port from settings. `/mcp` is a route on it. If the port is taken, the app fails loudly at start. |
| `widget.mcp_port` | The port is in the settings and in a known file for agents. |
| `widget.agent_identity` | No real auth in v1. Any local caller gets a bearer token from a handshake. The token gives the agent an identity. |
| `widget.slug` | Each widget gets a slug at creation. |
| `widget.mcp_tools` | Fixed tools: `widget_list`, `widget_call({slug, action, args})`, and more. The tool count does not grow with the widget count. |
| `widget.agent_modes` | Two agent modes. Interact mode calls actions and needs no OpenUI Lang. Create mode writes OpenUI Lang and needs the guide. |
| `widget.creation_v1` | Any agent can create both kinds of widgets, data and logic. Creation copies the DSH plugin creation path, with strict instructions. |
| `widget.live_updates` | Each slug has one SSE stream. Each write sends a signal. Each window then fetches again. |
| `widget.program_delivery` | The host stores the program. The package file seeds it. Routes: `GET program`, `POST call`, `GET stream` under `/api/widgets/<slug>/`. |
| `widget.refresh_hook` | The shell runs its queries again with the public OpenUI hook `useTriggerAction`. Pin `react-lang` 1.0.1 and keep a test for it. |
| `widget.code_always` | Each widget has code that an agent writes. No widget is only data. The design has no CRUD descriptor kind. A to-do widget is a bundle with plain handlers. |
| `widget.one_kind` | Each widget gets the same treatment, whatever Cordis features it uses. The design has no tiers of widgets, for isolation or for any other purpose. |
| `widget.isolation` | Crash-only host. The code of each widget runs in the host with full Cordis. On an uncaught error, the runtime blames a widget, writes a crash record, and the host exits. It does not resume. A watchdog thread kills a host that a CPU loop holds, and blames the running widget. Electron main restarts the host with backoff. The restarted host keeps the blamed widget off. After 2 crashes in 60 s, the host starts in safe mode with every agent widget off. After 4 crashes, Electron main shows the DSH fatal dialog. Evidence: `standing.checked.crash_only`. |
| `widget.agent_code_v1` | In v1, agent code in the host has no guard: no approval, no lint, and no sandbox. Later iterations add the items in `standing.later`. |

## The design `standing.design`

The overnight run found the smallest set that works: four packages, and one bundle for each widget (verified).

| Package | Process | Job |
|---|---|---|
| `@deepwidgets/widgets` | host | The runtime. It gives the service `ctx.widgets`. It stores state and programs, runs actions, serves the routes, and sends signals. |
| `@deepwidgets/mcp` | host | The MCP server, the token handshake, and the creation kit: skill text, templates, and the guide. |
| `@deepwidgets/shell` | widget window | The pinned page. It renders a program with the component set `shadcn-widgets@1`. |
| `@deepwidgets/windows` | host and Electron main | The window manager. The host half decides. The Electron main half obeys. |
| `widget-<slug>` | host | One bundle for each widget. An agent writes its code. |

```
                     ┌──────────── host process (one Cordis Context) ────────────┐
 agent ── /mcp ────▶ │ @deepwidgets/mcp ──▶ ctx.widgets ◀── widget-<slug> bundles  │
                     │                        │                                   │
                     │          storage "widgets" ── change ──▶ SSE signal        │
                     │ @deepwidgets/windows (host half) ── Node IPC ──┐          │
                     └────────────────────────────────────────────────│──────────┘
                              ▲ /api/widgets/<slug>/{program,call,stream}
                              │                                        ▼
 Electron main: dsh-app:// handler forwards with the cookie     windows half: open, place
                              ▲
 widget window: @deepwidgets/shell ── one window for each slug
```

### The seam `standing.design.seam`

The design copies the DSH seam pattern. `ctx.widgets` is the Service Definition. Each widget bundle is a Service Provider. The routes, the MCP server, and the window manager are the Consumers.

The rule "one action, two doors" comes from this seam. A user click and an agent call run the same action through `ctx.widgets.call`. DSH has the same rule for its plugins.

### A widget definition `standing.design.definition`

```js
ctx.widgets.register({
  slug: 'groceries', title: 'Groceries',
  program,                       // seed OpenUI Lang text
  initialState: { items: [] },
  actions: [
    { name: 'list', kind: 'query', handler: (args, w) => w.state.items },
    { name: 'add', kind: 'mutation', args: z.object({ text: z.string() }),
      handler: (args, w) => w.update((s) => ({ items: [...s.items, { text: args.text }] })) },
  ],
})
```

A to-do widget has the same shape: a few plain handlers. The overnight runtime also has a CRUD descriptor kind (`kind: 'crud'`). The decision `widget.code_always` drops it from the design.

The full service is `register`, `list`, `inspect`, `get`, `update`, `call`, `setProgram`, `save`, `removeData`, `changes`, `cursor`, and `guide` (verified).

### What the agent sees `standing.design.agent`

| Mode | Tools |
|---|---|
| interact | `widget_list`, `widget_describe`, `widget_call`, `widget_changes` |
| create or change a widget | `widget_guide`, `widget_inspect`, `widget_install`, `widget_reload`, `widget_remove` |

With seven tools, `tools/list` costs 769 tokens for 1, 10, or 50 widgets (verified).

The agent learns about user changes from `widget_changes({since})`. MCP clients do not show push messages to the model today (inferred from client docs).

## The flows `standing.flows`

### A window opens `standing.flows.open`

1. The window manager tells Electron main to open a window for the slug.

2. Electron main loads the shell from disk. This step needs no host.

3. The shell gets the program from the host. Electron main forwards the request with the host cookie.

4. The shell checks the catalog name of the program, then renders it. Each query calls the `call` route.

5. The shell opens the stream. The first frame is `hello` with the current revisions.

### Someone changes the data `standing.flows.change`

1. A user click, an agent call, or a timer runs an action.

2. The runtime writes the new state in one atomic update.

3. The storage sends a change event. The runtime sends `{type:"data", rev}` on each open stream of that slug.

4. Each window runs its queries again. Text that the user typed stays.

### An agent creates a widget `standing.flows.create`

The agent copies a template, writes the handlers, and calls `widget_install`. The DSH plugin manager installs the bundle. It is live in about 0.8 s with no restart (verified).

## The evidence `standing.evidence`

Seven spikes ran. An independent review found four blockers. The integration spike then joined the parts in the real DSH host. It closed the four blockers (verified, all checks exit 0).

| Result | Value |
|---|---|
| Agent `widget_call` to an updated open window | 20 of 20 runs, 18 to 19 ms at the median |
| A user click | Shows in `widget_changes` with `by:"user"` |
| A widget with a timer that throws | Goes into quarantine. The other widgets keep working. The host stays up. 14 of 14 checks. |
| Host restart | Same cookie and same MCP client keep working. The window connects again in about 2.1 s. |
| A program that names an action that does not exist | Refused with 422. The old program keeps serving. |
| Replace of a data widget (dropped by `widget.code_always`) | Checked first, then replaced in place. Its rows stay. |
| Replace of a package widget, in the runtime | A broken new version leaves the old one serving. A good one swaps in with 0 failed requests. |
| Query call and mutation call | 2.5 ms and 12.3 ms at the median |
| Shell first content | 114 to 126 ms. Size 160 KB gzip. |
| Memory | About 20.6 MB for each widget window. A shared renderer uses about 1.8 MB for each widget, but one crash closes all of them. |
| Window open | 6 to 21 ms from a warm hidden window. 570 to 669 ms for a new window at 20 widgets. |
| Crashed window | Renders again in about 620 ms. The other windows stay. |
| Storage write | About 10 ms each, about 100 writes each second in total. 25 kills during writes gave no corrupt file. |
| Contract tests | 31 of 31 |

## Decisions that wait for the operator `standing.waiting`

These choices change what gets built. The widget spec waits for them.

| Name | Question | Recommendation |
|---|---|---|
| `standing.waiting.renderer` | One process for each widget, or a shared renderer? | Separate by default. A shared renderer as a user setting. |
| `standing.waiting.main_desktop_only` | A panel window cannot stay on one desktop. Drop the setting "main desktop only", or use a normal window for such a widget? | Operator call |
| `standing.waiting.tailwind` | The shell uses Tailwind v4 to map shadcn onto the DSH color tokens. DSH rules forbid Tailwind in DSH client packages. Allow it in the shell only? | Yes, only in the shell |
| `standing.waiting.identity` | v1 tokens carry no identity that lasts. Drop the rules for each agent, and add a `locked` flag and a trash? | Yes |
| `standing.waiting.create_tools` | Five create tools, or one tool with an `op` field? | Measured: 815 against 697 to 778 tokens (`standing.checked.create_tools`). The choice stays open. |

## Later iterations `standing.later`

The operator set these items for iterations after v1 on 2026-10-27.

| Name | Item |
|---|---|
| `standing.later.permissions` | Permissioned plugins. A protected plugin needs a permission before a widget can use it. |
| `standing.later.lint` | Linters that refuse known bad practices in a widget bundle. |
| `standing.later.build_checks` | Checks at build time for each widget bundle. |
| `standing.later.metrics` | Performance metrics for each plugin. They show when to stop a plugin, or when to tell the user to change its code. |

## Hard problems that stay open `standing.hard`

| Name | Problem | Best option now |
|---|---|---|
| `standing.hard.agent_code` | Code that an agent writes runs in the host with full Node rights. It can read files, call any server, and block every widget with a CPU loop. | v1 has no guard (`widget.agent_code_v1`). Later: the items in `standing.later`. |
| `standing.hard.fail_loud` | The quarantine handler fixes most crashes. It can still swallow an error in host code that widget code called. A CPU loop is not isolated. | Decided: `widget.isolation`, a crash-only host. Each crash stops every widget for about 2 s. |
| `standing.hard.write_rate` | Each write rewrites one shared file. The limit is about 100 writes each second in total. | The sqlite backend: about 0.2 ms each write (`standing.checked.sqlite`). Or coalesce timer writes in the runtime (`standing.checked.coalesce`). |
| `standing.hard.replace` | The DSH plugin manager refuses a second install of one name. Thus a safe replace of a package widget needs the new version under a second package name. | Install under a second name, let the runtime promote it, then remove the old package. Not built through the real plugin manager. |
| `standing.hard.memory_only` | The `requestId` cache and the change log live in memory. A restart loses them. | Store the `requestId` cache in the `widgets` storage. Under `widget.isolation`, a crash makes a retried call run twice (`standing.checked.crash_only`). |
| `standing.hard.port_squat` | On macOS, another process can bind `0.0.0.0` on our fixed port. An agent can then talk to the wrong server. | A server nonce in the port file that the agent checks |
| `standing.hard.push_to_agent` | Agents do not see user changes until they ask. Claude Code and Codex drop pushed notifications (`standing.checked.mcp_push`). | `widget_changes`, plus a count of pending changes in each tool result |
| `standing.hard.openui_internals` | The refresh uses an action plan shape that OpenUI does not export. | Pin `react-lang` 1.0.1 and keep a test that fails when it changes. |
| `standing.hard.react18_shadcn` | The OpenUI shadcn example breaks on React 18. | Our own forked set with patched components |
| `standing.hard.quit_hang` | After a renderer crash, window teardown before `app.exit` hung Electron main in about 5 of 12 runs. | Call `app.exit` with no teardown first (4 of 4 clean). Test the DSH quit path. |
| `standing.hard.eventsource_stop` | A browser `EventSource` stops for good on an answer that is not 200. | The shell opens the stream again itself, with backoff. While the host is down, the `dsh-app://` handler must answer `Response.error()`, not 503 (`standing.checked.crash_only`). |
| `standing.hard.link_install` | A `link:` install breaks when the agent moves its folder (inferred). | Copy the package into a folder that the profile owns before the install. |

## Facts checked on 2026-10-27 `standing.checked`

Six agents checked the open facts on 2026-10-27. Each agent worked in its own detached worktree `.worktrees/rohan-facts-<name>` at `8c02df70`. Each wrote a `NOTES.md` with rerun commands in `/private/tmp/claude-501/-Users-rohanmalik-deepWidgets/fa304dae-13fc-42fa-a589-9447b230688d/scratchpad/facts/<name>/`. Each check below exits 0, unless the row says otherwise.

| Name | Answer | Evidence |
|---|---|---|
| `standing.checked.component_extend` | Yes. `library.extend` adds, overrides, and removes components at runtime. The prompt lists an added component. | Verified, 12 of 12 checks (`components`). A component set loads as its own ES chunk with `import()`. The parser accepts the new component and refuses unknown names. The parser does not check where a component sits, for example a component in a slot that does not allow it. A set that fails to load leaves the base library in use. A component that throws hides only itself. |
| `standing.checked.mcp_push` | No. Claude Code 2.1.311 refetches the tool list on `list_changed`. It drops `resources/updated`, logging messages, and custom notifications. | Verified, read the CLI bundle (`mcpfacts`). Claude Code issues #7252 and #3174 are closed as not planned. Codex does the same. Cursor is unknown. |
| `standing.checked.create_tools` | Measured. Five separate tools: 815 tokens for `tools/list`. One tool with an `op` enum: 697 tokens. One tool with a schema for each op: 778 tokens. | Verified, 82 of 82 checks (`mcpfacts`). Separate tools let the schema catch a missing field and mark only `widget_remove` destructive. Call accuracy needs a model and is not measured. |
| `standing.checked.sqlite` | Yes. The sqlite backend writes in about 0.2 ms, against about 10 ms for json. 20 slugs with one write each take 2 to 4 ms, against about 230 ms. | Verified (`storage`). The json per-record layout is not faster. A config patch alone fails: the `widgets` package must depend on `@deepseek-ai/dsh-storage-sqlite`. Sqlite as shipped does not use full fsync, so power loss is not proven safe. With full fsync, a write takes about 4 ms. 25 kills during writes gave no corrupt record on any backend. |
| `standing.checked.coalesce` | storage-domain has no coalesced write. | Verified (`storage`). A runtime option `update(slug, fn, {coalesce: ms})` removed the timer backlog on json: 553 writes in the queue became 0. |
| `standing.checked.pnpm_in_app` | Yes. The packaged app ships pnpm 11.28.5 and gives it to the host. | Verified, read `apps/desktop/src/main.ts:162-165` and ran the host command with no pnpm on PATH (`packaged`). A real packaged `.app` is not run, because the package build fails (`standing.checked.packaging`). |
| `standing.checked.fence_import` | No. The import breaks in the packaged host. | Verified (`packaged`). The published `dsh-client-connection` has no `src/` files. Electron 44 refuses TypeScript files under `node_modules`. Use `localhostHostValidation` from `@modelcontextprotocol/node` 2.0.0, or copy the 40 lines into `@deepwidgets/mcp`. |
| `standing.checked.message_port` | Yes. The host runs as an Electron `utilityProcess` with a shim and no host code change. A window and the host can then talk over a `MessagePort`. Electron main is not in the data path. | Verified (`msgport`). The smoke check passes with the host as a `utilityProcess`. Round trip p50: 0.1 ms on a `MessagePort`, 0.5 to 0.7 ms through main, and 2.2 to 2.8 ms through `dsh-app://` today. When the host stops, calls that wait for a reply never end, so the client must refuse them when the port closes. |
| `standing.checked.full_profile` | The premise was wrong. The `web` profile and the desktop profile both have 207 rows. The timings stay the same. | Verified (`profile`). The real difference is the runtime: Node 24 in Electron against Node 22 in the CLI. On the desktop host: query p50 2.5 ms, mutation p50 14 ms, write to SSE p50 13 to 16 ms. `run.mjs` 21 of 21, `contract.mjs` 31 of 31. |
| `standing.checked.sleep` | Partly. The host recovers. A real sleep and a real window are not tested. | Verified with SIGSTOP and SIGCONT, not a real sleep (`profile`). A late `ctx.interval` fires once, with no burst. After a stop of more than 300 s, the undici body timeout stops the SSE streams. `EventSource` opens them again. A reader with no retry stays closed. A stopped client gets all frames at once on resume, so the shell must merge the refetches. |
| `standing.checked.packaging` | No. The fork cannot build a packaged app since `1a59a4ec`. | Verified, ran on `main` (`packbuild`). The release packer does not pack the private `@deepwidgets/*` packages. A small fix packs them the same way as the private desktop host (`package-target.ts:495`). Nothing today needs a packaged build. |
| `standing.checked.lockfile` | The lockfile on `rohan/widget-exploration` has no entry for `deepwidgets/widgets-standin`. | Verified (`msgport`, `profile`). `pnpm install --frozen-lockfile` adds the entry. `main` is not affected. |
| `standing.checked.crash_only` | Yes. The crash-only host works in the real Electron app. | Verified, branch `rohan/spike-crash-only` at `19039136`, notes in the scratchpad folder `crash-only/`. Blame is right in all cases but one: a host timer first made during a widget call blames that widget. The watchdog kills a looping host in about 2 s at a 2 s threshold, with no false kills under load. At 500 ms, a 150 MB JSON parse caused a false kill. A window shows fresh data about 2.1 s after a widget crash. The blamed widget comes back off, the other widgets come back live, and safe mode works. Needed for the real build: `Response.error()` in the gap, a fast exit after the crash record (DSH fail-loud cleanup takes about 2.9 s on the desktop host), a stored `requestId` cache, and `@sentry/node-native-stacktrace` for loops in raw timers or after `await`. That addon has no Electron prebuild. The main DSH window reloads on each restart. |

## Things that nobody checked yet `standing.unchecked`

| Name | Question |
|---|---|
| `standing.unchecked.real_hands` | A real drag, real click-through, typing and copy and paste in a panel window, full-screen apps and Spaces, a Dock icon flash at launch, and real Tray clicks |
| `standing.unchecked.real_sleep` | A real sleep that stops the host, Electron main, and the windows together |
| `standing.unchecked.power_loss` | Does the sqlite backend lose acknowledged writes when the power fails? |
| `standing.unchecked.utility_control` | With the host as a `utilityProcess`: the graceful stop, the update and quit requests, and a signed packaged build |
| `standing.unchecked.tool_accuracy` | Which shape of the create tools does a model call more accurately? This check needs a paid model run. |

## Work in other sessions `standing.other_work`

| Item | State |
|---|---|
| `trim.profile` and `ts_move` | Another lead session runs them under `handoff-ts-trim.md` in the repository root. The handoff includes the rows that widget creation needs: plugin manager, `cordis_inspect`, credentials, and storage. |
| [Ronitron007/deepWidgets#28](https://github.com/Ronitron007/deepWidgets/pull/28) | Merged. It refreshed the task file. |
| Build round one | Stopped, because the welcome screen needs the `llm` row. A new unit `trim.startup` was in draft. |
| Message to session `buzz-22` | Held. It tells that session to use a WIP commit instead of `git stash`. The operator must approve it in that terminal. |

## Where the work is `standing.where`

The branch `rohan/widget-exploration` is on the remote. It merges the three branches below and holds this document. Nobody merged this work into `main`.

| Place | Content |
|---|---|
| Branch `rohan/widget-playground` | This folder, `docs/explore/widget-system/` |
| Branch `rohan/playground-runtime` | `@deepwidgets/widgets`, `@deepwidgets/mcp`, and the quarantine handler in `apps/cli/src/profile-boot.ts` |
| Branch `rohan/playground-creation` | The templates `crud-widget` and `api-widget` |
| `/private/tmp/claude-501/-Users-rohanmalik-deepWidgets/eb10eeb1-4988-4412-b535-dd45a936ce19/scratchpad/overnight/` | Each spike folder with its `NOTES.md` |
| `/private/tmp/claude-501/-Users-rohanmalik-deepWidgets/eb10eeb1-4988-4412-b535-dd45a936ce19/scratchpad/widget-spec/decisions.md` | The decisions record |
| `/private/tmp/claude-501/-Users-rohanmalik-deepWidgets/fa304dae-13fc-42fa-a589-9447b230688d/scratchpad/facts/` | Each fact check of `standing.checked`, with its `NOTES.md` |
| https://claude.ai/artifact/LHMQdAzMJ4qgksFP5GTK4r | The overnight summary page |

If these branches merge, the `head.map` and `head.status` tables in `CLAUDE.md` need the new packages and `docs/explore/`.

## Side effects of the overnight run `standing.side_effects`

- One spike started the host without `--no-open`. DSH tried once to open the default browser.

- An Electron crash can have left a macOS "reopen windows?" dialog on the screen.

- No spike called a paid API. Each OpenUI install used `OPENUI_TELEMETRY_DISABLED=1`.

## What comes next `standing.next`

1. The operator decides the items in `standing.waiting`.

2. Write the widget spec into `docs/specs/` from this document.

3. Write the plan, one PR for each unit, before any code.
