# Explainer script: the widget kit `explainer_kit.script`

Source of truth: `origin/main` `e6af003f` and the spike record `docs/explore/widget-system/widget-kit-spike.md` (`kit_spike`, run at `1ca2967d`), plus the raw spike files in `~/.deepwidgets/kit-spike/`. The widget kit is a direction in progress, not a decided spec. Narration is in `narration.md` (STE, lint 0.00). Target length uses 140 spoken words per minute. Visuals give the written forms. Anything a model would produce is labeled illustrative. Each inferred number is labeled inferred on screen and in the voice.

Scenes: 85. Narration words: 7462. Total target: 53.3 min.

## Parts `explainer_kit.parts`

| Part | Scenes | Words | Target |
|---|---|---|---|
| `part_intro` | 5 | 594 | 4.2 min |
| `part_today` | 6 | 617 | 4.4 min |
| `part_library` | 6 | 570 | 4.1 min |
| `part_vite` | 8 | 597 | 4.3 min |
| `part_types` | 6 | 434 | 3.1 min |
| `part_packaging` | 10 | 967 | 6.9 min |
| `part_host` | 6 | 464 | 3.3 min |
| `part_pin` | 7 | 535 | 3.8 min |
| `part_describe` | 6 | 580 | 4.1 min |
| `part_config` | 8 | 622 | 4.4 min |
| `part_settings` | 4 | 395 | 2.8 min |
| `part_serving` | 4 | 204 | 1.5 min |
| `part_checks` | 3 | 304 | 2.2 min |
| `part_close` | 6 | 579 | 4.1 min |

## `cold_open`

- Part: `part_intro`
- Target length: 56 s (131 words)

**Narration**

This video explains the widget kit. The widget kit is a direction for how agents build widgets in deepWidgets. It is a direction in progress, not a decided spec. Some parts come from the operator direction so far. Other parts come from a spike on the third of November.

A spike is a short test that measures one question. When a number comes from a measurement, we say so. When we infer a number, we say that too.

Today, each widget window shows the same page. That page has one fixed set of components. The widget kit changes that. Each widget gets its own page, with components that an agent writes. The video walks through every front of that work. It ends with the points that the operator must still decide.

**Visuals**

Dark screen. Title: `widget kit`. Subtitle tag, amber, stays on screen in the corner for the whole video: `direction in progress, not a decided spec`. Two source cards fade in: `operator direction so far` and `kit_spike, 2026-11-03, origin/main 1ca2967d`. Legend at the bottom: `measured` (white number), `inferred` (amber number with the word inferred). Then two widget cards side by side: left `today: one shared page, shadcn-widgets@1`; right `kit: one page per widget, agent library`.

## `outline_today`

- Part: `part_intro`
- Target length: 43 s (100 words)

**Narration**

Here is the whole path on one diagram. The top row is the path of today. An agent writes a widget bundle. A widget bundle is a package with the code of one widget. The agent calls the MCP tool widget install. MCP is a protocol that lets an agent call tools.

Then three gates check the code: compile, lint, and test run. The host loads the bundle that passes. The host is the process that runs all widget code. Last, one shared page draws each widget. We call that page the shell. It has one fixed set of components.

**Visuals**

OUTLINE DIAGRAM (the anchor, reused at the start of each part). Top row, label `today`: `agent writes bundle (src/index.ts, imports zod only)` > `MCP widget_install` > `gates: compile (esbuild) > lint (oxlint + tsgolint) > test run` > `plugin manager + hmr: host loads bundle` > `shared shell @deepwidgets/shell, catalog shadcn-widgets@1` > three windows `shadcn`, `clock`, `meter`. Each box lights as named.

## `outline_kit`

- Part: `part_intro`
- Target length: 57 s (134 words)

**Narration**

The bottom row is the kit path. It starts at the kit project. The kit project is a folder with the packages that widgets can use. An agent writes its own component library and a child component. The child holds the OpenUI renderer. OpenUI is the library that turns a program text into React components.

Then a Vite build makes one page for each widget. The same kind of gates and a render check test that page. Electron main then serves the page of each slug. A slug is the id of a widget. On the host side, a widget can also use extra packages.

In the spike design, two doors lead into the kit: MCP tools for agents and a settings pane for the user. We return to this diagram between the parts.

**Visuals**

Bottom row, label `kit path (direction)`: `kit project $DSH_HOME/deepwidgets/kit/ (package.json, pnpm-lock.yaml, node_modules, kit.json; core + extras)` > `agent library + child holding <Renderer.Root>` > `type gate > Vite build per widget > render check` > `page per slug: dsh-app://app/widget/<slug>/`. Side box under the host: `host extras (bundle | external | native addon)`. Two doors into the kit box, tag `spike design`: left `MCP: kit_read, kit_describe, kit_add, kit_remove`, right `settings pane: /api/kit`. A tag on the line kit to pages: `pin or rebuild`. A tag on the agent arrow: `dynamic description`.

## `direction_list`

- Part: `part_intro`
- Target length: 52 s (122 words)

**Narration**

Here is the operator direction so far. It has seven points. An agent writes its own OpenUI component library and a child component that holds the renderer. Each widget gets its own Vite build at install time.

The package widget kit has a locked core and user extras. The core is what the shell entry file, main dot t s x, needs. The user adds extras in a settings pane. Widget code can import extras on the renderer side and on the host side.

When a setting allows it, an agent can add packages to the kit through MCP. The kit packages reach agents through a dynamic description. Pin or rebuild after a kit change is a choice to make from data.

**Visuals**

Card titled `operator direction so far` (`kit_spike.direction`). Seven bullets appear one by one: `agent writes its own OpenUI library + child that holds <Renderer>`; `own Vite build per widget at install (layout A)`; `@deepwidgets/widget-kit: locked core + user extras`; `core = what main.tsx needs; extras in a settings pane`; `extras on renderer side and host side`; `agent adds packages via MCP when a setting allows`; `kit packages described to agents dynamically`; `pin or rebuild: decide from data`.

## `example_cast`

- Part: `part_intro`
- Target length: 46 s (107 words)

**Narration**

One worked example runs through the whole video. The spike built three widgets with real code. Shad c n is a copy of our current component set. Clock shows a date with the package date f n s. Meter shows a labeled bar from a small test package, d w mini u i.

Each widget builds on three kit versions. Kit vee one is the start. Kit vee two A moves date f n s from four point zero to four point one. Kit vee two B changes the test package to a new major version with renamed props. A prop is one input of a component.

**Visuals**

Three widget cards: `shadcn` (copy of shadcn-widgets@1, with charts), `clock` (`DateLine` with `date-fns` `format`, `Tag` with `Pill`), `meter` (`Gauge` with `Meter` from `dw-mini-ui`). Below, a kit timeline: `kit v1` (`date-fns 4.0.0`, `dw-mini-ui 1.0.0`) > `kit v2a` (`date-fns 4.1.0`) and `kit v2b` (`dw-mini-ui 2.0.0`: `Meter { value, max, label }` becomes `Meter { percent, caption }`).

## `today_shell`

- Part: `part_today`
- Target length: 45 s (105 words)

**Narration**

Before the change, look at the code of today. On the diagram, this is the shell box. The shell is the package deepwidgets shell. Its entry file is main dot t s x. It opens a channel to the host, loads the program, and draws it.

A program is the text that tells the shell what to show. It is in OpenUI Lang. Main dot t s x holds the OpenUI renderer root directly. It also holds the stream, the refresh logic, and the diagnostics. Every widget window loads this same page. Vite builds it once into one folder, with the base path slash widget.

**Visuals**

Outline: the `shared shell` box glows. Code card `deepwidgets/shell/src/main.tsx`: `import { ACTION_STEPS, Renderer, ... } from '@openuidev/react-lang'`, `import { CATALOG_ID, widgetLibrary } from './library.tsx'`, and the block `<Renderer.Root response={load.text} library={load.library} toolProvider={channel?.tools ?? null} ...>`. Side card `deepwidgets/shell/vite.config.ts`: `base: '/widget/'`, `outDir: 'dist/widget'`.

## `today_component_set`

- Part: `part_today`
- Target length: 47 s (110 words)

**Narration**

The shell compiles in one component set, shad c n widgets at one. A component set is a list of components with names, props, and descriptions. The set lives in the file library dot t s x. A program names its set. The shell refuses a program that names another set, with the error unsupported component set.

Thus an agent today can use only these components. It cannot add a component of its own. The standing decision widget runtime pin says this on purpose: all widgets share one shell, pinned to one version. The kit direction conflicts with that decision. The operator has not decided if the kit replaces it.

**Visuals**

Card `library.tsx`: `export const CATALOG_ID = 'shadcn-widgets@1'` and component names `Stat, Button, Input, Checkbox, Empty, BarChart, LineChart, Row, List, Card, ...`. Error tile: `Unsupported component set` with detail `The widget needs "x". This shell has shadcn-widgets@1.` Decision card from `where-we-stand.md`: `widget.runtime_pin | All widgets share one shell, pinned to one version.` A dashed arrow from it labeled `kit direction conflicts (not decided)`.

## `today_creation`

- Part: `part_today`
- Target length: 47 s (109 words)

**Narration**

An agent creates a widget with the tool widget install. The tool copies the source folder into a throwaway staging folder. Three gates then run there. The compile gate bundles the code with e s build. E s build is a fast JavaScript bundler.

The lint gate runs ox lint with a type check. Ox lint is a fast linter. Its type check uses t s go lint, which runs on the Go port of the TypeScript compiler. The test run gate starts the widget in a throwaway process. Code that fails a gate never reaches the host. The plugin manager then installs the bundle while the app runs.

**Visuals**

Gate strip: `widget_install(dir)` > `staging: $TMPDIR/deepwidgets-gates-*` > `compile: esbuild bundle:true platform:node` > `lint: oxlint --type-aware --type-check (tsgolint)` > `test run: throwaway process` > `plugin manager installs <profile>/deepwidgets-widgets/<slug>`. A red cross on a failing gate with `nothing was installed`.

## `today_paths_map`

- Part: `part_today`
- Target length: 44 s (103 words)

**Narration**

One detail of the compile gate matters for the kit. The gate writes a tsconfig file with a paths map. A paths map tells the compiler where a bare import name resolves. Today that map has one entry, zod. Zod is a library that checks data shapes.

Thus the guide has a rule. A widget can import only zod and the widget types. E s build puts a copy of zod into each host half. The host half is the part of a widget that runs in the host. The spike measured zod alone at five hundred forty-five kilobytes in each host half.

**Visuals**

Code card from `creation.ts` `writeConfigs`: `paths: { zod: [t.zod] }`. Guide rule card: `Only zod and the types of deepwidgets:widget can be imported.` Bar: `zod in each host half: 545 KB` (measured). Bundle `package.json` card with no `dependencies` field.

## `today_serving`

- Part: `part_today`
- Target length: 45 s (105 words)

**Narration**

How does a widget window get its page? Electron main answers each request on the custom scheme d s h app. For a path under slash widget, it serves files from the shell build folder on disk. Every slug gets the same index page. The slug travels in the query string.

A few other paths, such as the root index page, come from the D S H web folder on disk. Every other path, such as an A P I path, goes to the host with the host cookie. The page talks to the host only through these routes, and the host checks the cookie.

**Visuals**

Outline: `Electron main` box glows. Request `dsh-app://app/widget/?slug=meter` > `Electron main protocol.handle` > folder `@deepwidgets/shell/dist/widget/index.html` (same file for `shadcn`, `clock`, `meter`). Second request `dsh-app://app/api/widgets/meter/program` > `+ host cookie` > `host 127.0.0.1:<port>`. Small third line: `/, /index.html, /assets/* > dsh-web-frontend/dist (disk)`.

## `today_agent_text`

- Part: `part_today`
- Target length: 36 s (85 words)

**Narration**

What does an agent read today? The MCP server sends one fixed text of server instructions. It also registers nine tools, each with a fixed description. The tool widget guide returns the guide as tool output.

The guide holds the widget types, the gate rules, and the OpenUI guide of the component set. The OpenUI part alone is about sixteen kilobytes. None of this text changes while a session runs. With a kit that changes, that becomes a problem. A later part shows the test.

**Visuals**

MCP card. Top: `instructions` (fixed): `deepWidgets: desktop widgets. Call widget_list, then widget_describe, then widget_call...`. Middle: nine tool chips `widget_list, widget_describe, widget_call, widget_changes, widget_template, widget_guide, widget_install, widget_reload, widget_remove`, each with a lock icon `description fixed`. Bottom: `widget_guide` output = `API types + gate rules + OpenUI guide (guide.md 16,195 bytes)`. Caption: `none of this changes during a session`.

## `library_why`

- Part: `part_library`
- Target length: 38 s (89 words)

**Narration**

On the diagram, we now move to the agent library box. We start with the agent library and the split of main dot t s x. Why split the file? Today the renderer root and the component set sit inside the shell. An agent cannot reach them.

In the kit direction, the agent owns the components. Our code keeps the parts that each widget needs, such as the channel and the stream. Thus the file splits into a part that we lock and a part that the agent writes.

**Visuals**

Outline: the `agent library + child` box glows. `main.tsx` today as one block; inside it two colored areas: blue `channel, stream, refresh, diagnostics` and orange `Renderer.Root + widgetLibrary`. The orange area slides out to an `agent` folder.

## `library_split`

- Part: `part_library`
- Target length: 38 s (88 words)

**Narration**

The split has two halves. The locked core holds the channel, the refresh bridge, the boot code, and the diagnostics. The refresh bridge runs the queries again when the stream reports new data.

The agent half is a child component. The child holds the renderer root and the library of the agent. In the spike, main dot t s x imports the child from the alias at agent. It reads the catalog id from the same file. The core then puts the child where the renderer root was.

**Visuals**

Split view. Left, locked (padlock): `@deepwidgets/widget-kit core: channel.ts, RefreshBridge, boot, diagnostics (window.__dw)`. Right, agent: `src/agent/child.tsx` + `src/agent/library.tsx`. Code line from the spike `main.tsx`: `import Child, { CATALOG_ID } from '@agent/child.tsx'`.

## `library_contract`

- Part: `part_library`
- Target length: 53 s (124 words)

**Narration**

The two halves meet at a small contract. The contract is a TypeScript type with the name child props. It has two fields, root and children. Root is every prop of the renderer root except library and children. The core fills root with the program, the tool provider, and the error handlers.

The tool provider is the object that sends each query and mutation to the call route. The child adds its own library and passes the rest through. But the contract is a type, not a guard. The child itself writes the renderer root, so agent code can change the tool provider. We infer that agent code can also call the host routes itself. The page policy allows requests to the same origin.

**Visuals**

Code card `core/src/contract.ts` (spike): `export type RootProps = Omit<ComponentProps<typeof Renderer.Root>, 'library' | 'children'>` and `export interface ChildProps { root: RootProps; children?: ReactNode }`. Arrow from core with `root = { response, toolProvider, queryLoader, onParseResult, onError, onAction }` into `Child`, which adds `library`. Red note: `a type, not a guard: the child can replace toolProvider`.

## `library_agent_code`

- Part: `part_library`
- Target length: 39 s (92 words)

**Narration**

Here is the real library of meter. It imports zod, the OpenUI functions, and the component meter from d w mini u i. It defines two components with define component. Gauge has the props value, max, and label. Stack is a vertical list of children.

Create library joins them, with stack as the root. The catalog id is meter at one. Clock has the same shape. Its date line component formats a date with date f n s. Each child file has seven lines. It wraps the renderer root around the library.

**Visuals**

Code card `widgets/meter/agent/library.tsx` (real spike file, 14 lines): `import { Meter } from 'dw-mini-ui'`, `export const CATALOG_ID = 'meter@1'`, `Gauge` props `z.object({ value: z.number(), max: z.number().optional(), label: z.string() })`, `component: ({ props }) => <Meter value={props.value} max={props.max ?? 100} label={props.label} />`, `createLibrary({ root: 'Stack', components: [Stack, Gauge] })`. Side card `child.tsx` (7 lines): `<Renderer.Root {...root} library={library}><Renderer.Content />{children}</Renderer.Root>`. Small tag: `clock@1: DateLine uses format() from date-fns`.

## `library_catalog`

- Part: `part_library`
- Target length: 34 s (80 words)

**Narration**

The catalog check stays. Each page now compiles in one catalog, the id that the child exports. The page still refuses a program that names another id.

This changes one thing. Today every widget shares the catalog shad c n widgets at one. With the kit, each widget can have its own catalog. The guide must then describe the catalog of each widget, not one shared set. We infer that from the code. The spike did not test the guide.

**Visuals**

Three pages, each with its own catalog chip: `shadcn` (copy of the shadcn set), `clock@1`, `meter@1`. Today strip above: all three windows show `shadcn-widgets@1`. Amber note: `guide per widget catalog (inferred, not tested)`.

## `library_work`

- Part: `part_library`
- Target length: 42 s (97 words)

**Narration**

What does this front read and write? It reads the current main dot t s x. It writes the locked core into the package widget kit. It also writes a child template for agents. The template tool must then give the library folder and the child file.

On failure, a missing child or a bad export stops the type gate or the build. We infer that from the spike setup. The work map sizes the split of main dot t s x as medium. It sizes the guide and the template as small. Both sizes are estimates.

**Visuals**

Work card. Reads: `deepwidgets/shell/src/main.tsx`. Writes: `@deepwidgets/widget-kit locked core`, `template: src/agent/library.tsx + child.tsx`. On failure: `type gate or build stops (inferred)`. Size chips: `split of main.tsx: M`, `guide and template: S`, both labeled `estimate`.

## `vite_gate`

- Part: `part_vite`
- Target length: 21 s (50 words)

**Narration**

On the diagram, we now move to the Vite build box. Vite is a build tool for web pages. In the kit direction, each widget gets its own Vite build at install time. The spike calls this layout A. One build makes one folder of static files for one slug.

**Visuals**

Outline: the `Vite build per widget` box glows. Text: `layout A: one Vite build per widget, at install time`. One build > one folder `dist/` for one slug.

## `vite_inputs_outputs`

- Part: `part_vite`
- Target length: 50 s (116 words)

**Narration**

What does the build read? It reads the core source, the agent folder, an index page, a Vite config, and a tsconfig file. It resolves packages from the node modules folder of the kit. The Vite config sets the base path to slash widget, then the slug. It uses the React plugin and the Tailwind plugin.

What does it write? It writes a dist folder with an index page, scripts, and one style sheet. The dist folder is the output folder. A Vite chunk is one script file of that output. Vite can split code into chunks that load later. The charts of shad c n load from a lazy chunk of three hundred eighty-eight kilobytes.

**Visuals**

Left, inputs: `core/src/*`, `src/agent/*`, `index.html`, `vite.config.ts`, `tsconfig.json`, `node_modules -> kit`. Config card: `base: /widget/${slug}/`, `plugins: [react(), tailwindcss()]`, `target: 'chrome140'`. Right, outputs: `dist/index.html`, `dist/assets/*.js`, `dist/assets/*.css`. A chunk chip: `shadcn charts chunk 388 KB (lazy)`.

## `vite_numbers`

- Part: `part_vite`
- Target length: 29 s (67 words)

**Narration**

Here are the numbers on kit vee one. Shad c n built in two point eight seconds, to seven hundred ninety-six kilobytes. Clock built in one point zero five seconds, to three hundred seventy-two kilobytes. Meter built in zero point nine seconds, to three hundred fifty-two kilobytes.

The build of shad c n with cold caches took four point three seconds. All three pages rendered in Electron.

**Visuals**

Table `kit v1` (from `results-v1.tsv`): `shadcn  vite 2.811 s  796 KB`, `clock  vite 1.047 s  372 KB`, `meter  vite 0.904 s  352 KB`. Extra row: `shadcn cold build 4.3 s`. Three small rendered windows with tick marks: `rendered in Electron`.

## `vite_cache`

- Part: `part_vite`
- Target length: 22 s (51 words)

**Narration**

Vite has no build cache that stays between builds. A warm build saves only about one point four seconds. Thus each install pays the full build time. For a small widget, that is about one second. For a large library, it is about two point eight to four point three seconds.

**Visuals**

Two bars: `cold 4.3 s`, `warm 2.8 to 2.9 s` for shadcn. Label: `no persistent build cache; warm saves about 1.4 s`. Range strip: `small widget about 1 s`, `large library about 2.8 to 4.3 s`.

## `tailwind_source`

- Part: `part_vite`
- Target length: 51 s (118 words)

**Narration**

Tailwind is the style tool of the shell. It writes only the classes that it finds in the source. The at source line tells Tailwind which folders to scan. Today the shell scans only its own folder.

The spike found a trap. Tailwind finds no classes in a package in node modules. The style sheet must name that package with its own at source line. Without that line, the classes of the extra were absent from the output.

The spike style sheet names the core, the agent folder, and d w mini u i. Thus each extra with its own classes needs a line in the style sheet. We infer that the build gate must write those lines.

**Visuals**

Code card, spike `core/src/styles.css`: `@source "./";`, `@source "./agent";`, `@source "../node_modules/dw-mini-ui";`. Today card, shell `styles.css`: `@source "./";` only. A box `node_modules/dw-mini-ui` with classes `rounded-full px-2 text-xs` greyed out when its `@source` line is removed: `extra classes missing`. Amber note: `gate writes @source lines (inferred)`.

## `render_check`

- Part: `part_vite`
- Target length: 32 s (74 words)

**Narration**

After the build, a render check loads the page in a hidden Electron window. It waits one and a half seconds. Then it reads the state, the errors, and the text of the page. It costs about one point six seconds for each widget.

The render check has a limit. It finds only errors that throw. The spike record says that a wrong prop of an untyped extra passes. We could not check this.

**Visuals**

Offscreen window icon. Steps: `loadURL /widget/<slug>/?slug=<slug>` > `wait 1500 ms` > `read window.__dw.state, __dw.errors, .dw-surface text`. Chip: `about 1.6 s per widget`. Limit card, red: `finds only errors that throw`; amber line `untyped extra, wrong prop passes (spike record, not checked)`.

## `vite_failures`

- Part: `part_vite`
- Target length: 27 s (64 words)

**Narration**

What happens on failure? A failed build stops the install, and the old page stays. That rule comes from the pin policy, which we infer from the data.

Vite does not check types. In the spike, the meter on kit vee two B built with no error, though its types were wrong. Thus the build gate needs a type gate in front of it.

**Visuals**

Flow: `build fails` > `install stops` > `old page stays` (amber `pin policy, inferred`). Evidence row from `results-v2b.tsv`: `meter  tsc_exit=2  vite_exit=0`. Caption: `Vite does not check types`.

## `vite_work`

- Part: `part_vite`
- Target length: 24 s (57 words)

**Narration**

This front reads the node modules of the kit and the agent folder. It writes a build folder for each slug. The spike work map also says that the gate refuses an import outside the core and the renderer extras. The work map gives the Vite build gate a size of large. That size is an estimate.

**Visuals**

Work card. Reads: `kit node_modules`, `src/agent`. Writes: `build folder per slug`. Rule: `work map design: refuse imports outside core + renderer extras`. Size chip: `Vite build gate: L (estimate)`.

## `types_why`

- Part: `part_types`
- Target length: 24 s (56 words)

**Narration**

On the diagram, the type gate sits in front of the Vite build. The type gate checks the TypeScript types before the build. It catches a prop that a component does not have. Vite and e s build only strip the types. Thus without this gate, a type error reaches the render check or the user.

**Visuals**

Outline: a small `type gate` box appears in front of `Vite build`. Text: `catches props a component does not have`. `Vite / esbuild: strip types only`.

## `types_tsc`

- Part: `part_types`
- Target length: 21 s (49 words)

**Narration**

The spike ran t s c, the TypeScript compiler, in check mode. The tsconfig file is strict, with exact optional property types. Shad c n took one point four to one point nine seconds. Clock took about zero point six seconds. Meter took about zero point five five seconds.

**Visuals**

Card `tsc -p .` with tsconfig flags `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Table (measured): `shadcn 1.4 to 1.9 s`, `clock 0.62 to 0.66 s`, `meter 0.53 to 0.58 s`.

## `types_config`

- Part: `part_types`
- Target length: 51 s (118 words)

**Narration**

The spike tsconfig file has two path aliases. At agent points to the agent folder. At core points to the core source, where the contract lives. The compiler resolves every other import from the node modules of the kit. Thus the type gate sees the real types of each extra.

Skip lib check is on, so the gate does not check the type files of the packages themselves. That keeps the gate fast. The type gate refuses an extra with no type file, with the error T S seven zero one six. The agent must then declare the module itself. After that, the gate accepts any prop of that extra, so the render check is the only guard.

**Visuals**

Code card spike `core/tsconfig.json`: `"paths": { "@agent/*": ["./src/agent/*"], "@core/*": ["./src/*"] }`, `"skipLibCheck": true`, `"types": []`. Arrow: other imports > `node_modules -> kit`. Amber note: `extra with no .d.ts: tsc refuses, TS7016 (ran)`; then `after declare module: no type help, render check only guard`.

## `types_tsgolint`

- Part: `part_types`
- Target length: 37 s (86 words)

**Narration**

The spike also ran ox lint with t s go lint. Today the lint gate already uses this pair. On shad c n and meter, it took zero point one one to zero point five five seconds. The spike did not run it on clock. We compute that it is about three to five times faster than t s c.

It found the same error on meter in kit vee two B. Thus either tool can run the gate. Which tool to use is not decided.

**Visuals**

Card `oxlint --type-aware (tsgolint)`; `today's lint gate uses it (creation.ts)`. Table (measured): `shadcn 0.29 to 0.55 s`, `meter 0.11 to 0.12 s`, `clock not run`. Chip: `about 3x to 5x faster than tsc (computed)`. Tick: `same v2b error found`. Tag: `tool not decided`.

## `types_error_path`

- Part: `part_types`
- Target length: 26 s (60 words)

**Narration**

How does a type error reach the agent? Today a failed gate gives the error code gate failed. The answer names the gate and lists each diagnostic with file, line, and column. The next step says: fix the code at each diagnostic, then install again. Nothing installs.

We infer that the type gate of the kit uses the same answer.

**Visuals**

Answer card (today, `deepwidgets/mcp/src/index.ts` NEXT_STEP): `code: gate-failed`, `gate: lint`, `diagnostics: ['src/index.ts:12:5: ...']`, `nextStep: Fix the code at each diagnostic, then call widget_install again with the same folder. Nothing was installed.` Amber tag: `same shape for the kit type gate (inferred)`. Example diagnostic slot filled with the real v2b line `src/agent/library.tsx(8,36): error TS2322 ...`.

## `types_work`

- Part: `part_types`
- Target length: 28 s (65 words)

**Narration**

The type gate reads the agent folder, the core contract, and the types of the kit packages. It writes diagnostics with file, line, and column, as the lint gate does today. On failure, nothing installs, and the agent gets the error text.

The work map has no row of its own for the type gate. We infer that it belongs to the Vite build gate.

**Visuals**

Work card. Reads: `src/agent`, `core contract.ts`, kit `.d.ts`. Writes: `diagnostics file:line:column`. On failure: `nothing installs`. Note: `no own row in the work map; inferred part of the Vite build gate`.

## `pnpm_terms`

- Part: `part_packaging`
- Target length: 57 s (132 words)

**Narration**

On the diagram, we now move to the kit project box. The kit is a p n p m project. P n p m is a package manager for Node. The p n p m store is a folder that holds each package file once, by its content hash.

A lockfile records the exact version of each package, also of the packages that others pull in. The command p n p m fetch fills the store from the lockfile alone. An install can then link packages from the store with no network.

On macOS, p n p m copies files with an A P F S clone. An A P F S clone shares the disk blocks until a file changes. The registry is the online server of n p m packages.

**Visuals**

Outline: the `kit project` box glows. Diagram: `pnpm store (content-addressable, each file once)` with arrows `hard link / APFS clone` to two `node_modules` folders. Card `pnpm-lock.yaml`: exact versions, also transitive. Command chips: `pnpm fetch` (lockfile only, fills store), `pnpm install --offline --frozen-lockfile` (no network). Glossary chips: `registry = registry.npmjs.org`.

## `kit_project`

- Part: `part_packaging`
- Target length: 51 s (119 words)

**Narration**

The spike kit has twenty-four packages in its package file. It holds React, OpenUI, zod, Vite, Tailwind, TypeScript, and e s build. It also holds the extras: date f n s, the test package, Radix parts, lucide icons, and recharts. All versions are exact.

The first resolve of kit vee one took six point nine seconds and thirty-five megabytes of network. The fetch took five seconds and thirty-eight megabytes. The store grew to two hundred nineteen megabytes. The metadata cache took one hundred thirteen megabytes.

All runs used the p n p m and the Node that ship in the app. These are p n p m eleven point two eight point five and Node twenty-four point two one.

**Visuals**

Card `kit/v1/package.json` (24 dependencies): core `react 18.3.1, react-dom 18.3.1, @openuidev/react-lang 1.0.1, @openuidev/lang-core 1.0.1, zod 4.4.3, vite 6.4.3, @vitejs/plugin-react 4.7.0, tailwindcss 4.3.3, @tailwindcss/vite 4.3.3, typescript 6.0.3, esbuild 0.28.2, @types/*`; extras `date-fns 4.0.0, dw-mini-ui file:...tgz, @radix-ui/* x4, class-variance-authority, clsx, lucide-react 0.575.0, recharts 3.10.1`. Numbers: `resolve 6.9 s, 35 MB net`, `fetch 5.0 s, 38 MB net`, `store 219 MB`, `metadata cache 113 MB`. Footer: `pnpm 11.28.5, Node 24.21.0 (bundled runtime)`.

## `strategy_fresh_install`

- Part: `part_packaging`
- Target length: 40 s (94 words)

**Narration**

The spike tested three packaging strategies. We name them fresh install, kit lockfile, and shared chunks. In the fresh install strategy, each widget gets its own install from the registry.

A cold install took fourteen seconds and seventy-four megabytes of network. A warm install took three seconds. To add a package took three point three seconds for each widget and eight hundred seventeen kilobytes.

Each build resolves the versions of the indirect packages again. Thus two widgets can get different versions. When the registry was down, the install failed after seventy point five seconds.

**Visuals**

Strategy card `S1: fresh install`. Numbers: `cold install 13.95 s, 74 MB net`, `warm 3.0 to 3.1 s`, `add a package 3.25 s per widget, 817 KB`. Determinism chip: `transitive versions resolved again per build`. Failure: `registry down: ERR_PNPM_META_FETCH_FAIL after 70.5 s`.

## `pnpm_strict_builds`

- Part: `part_packaging`
- Target length: 43 s (100 words)

**Narration**

The fresh install strategy also exited with an error. P n p m eleven blocks the build scripts of packages by default. A build script runs code at install time. The install refused the scripts of e s build and of the telemetry in OpenUI lang core.

The p n p m error code says ignored builds. The setting strict dep builds, with the value false, fixed it. The spike record also names the setting allow builds. We could not check that second fix. The kit lockfile installs skipped the same scripts, but they gave only a warning and finished.

**Visuals**

Log card (real, `s1/cold1/install.log`): `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @openuidev/lang-core@1.0.1, esbuild@0.25.12, esbuild@0.28.2`. Fix chips: `strict-dep-builds=false (spike, verified)`, `allowBuilds (spike record only, not checked)`. Second log line (real, `s2/w1/install.log`): `Ignored build scripts: ... Done in 3s` with tag `warning only`.

## `strategy_kit_lockfile`

- Part: `part_packaging`
- Target length: 50 s (117 words)

**Narration**

In the kit lockfile strategy, the kit has one lockfile, and p n p m fetch fills the store. A widget install then runs offline from that store. It took two point six to three point three seconds, with no network. Real disk use was about ten megabytes, because of A P F S clones. A link to the node modules of the kit takes zero seconds and zero disk.

A kit change makes a new kit version. It took about one second to resolve, three seconds to fetch, and half a second to install. Only the change uses the network. The lockfile does not move, so every widget of one kit version gets the same versions.

**Visuals**

Strategy card `S2: kit lockfile`. Flow: `kit lockfile` > `pnpm fetch` > `store` > `widget: install --offline` (`2.6 to 3.3 s, 0 net, about 10 MB disk via APFS clone`) or `link to kit node_modules` (`0 s, 0 disk`). Kit change row (measured): `v2a: resolve 0.95 s + fetch 3.15 s + install 0.53 s`, `v2b: 0.92 + 2.98 + 0.58 s`. Chip: `lockfile frozen`.

## `pnpm_trust_lockfile`

- Part: `part_packaging`
- Target length: 37 s (86 words)

**Narration**

The kit lockfile strategy needs one flag outside a workspace, trust lockfile, with the value true. Without it, p n p m eleven runs the check minimum release age. That check holds back a version that is younger than one day.

The check needs a metadata cache of one hundred thirteen megabytes. Offline, it fails with the error no offline meta. The same check has a cost for security. It holds a security fix for twenty-four hours, unless the kit excludes that package from the check.

**Visuals**

Card: `--config.trust-lockfile=true`. Without it: `minimumReleaseAge 1440 min` > `needs metadata cache 113 MB` > offline `NO_OFFLINE_META`. Red note: `holds a security fix 24 h unless excluded`.

## `kit_lockfile_failures`

- Part: `part_packaging`
- Target length: 30 s (71 words)

**Narration**

Each failure of the kit lockfile strategy is fast and clear. A store with a missing package fails in zero point eight seconds with the error no offline tarball. A package file that does not match the lockfile fails with the error outdated lockfile. The missing package case ran offline, against a dead registry address. We infer that the drift case also used no network, because the lockfile check fails first.

**Visuals**

Two log cards (real): `s2/miss/install.log`: `[ERR_PNPM_NO_OFFLINE_TARBALL] A package is missing from the store but cannot download it in offline mode.` with `0.8 s`. `s2/drift/install.log`: `[ERR_PNPM_OUTDATED_LOCKFILE] Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date` and `1 dependencies were added: left-pad@1.3.0`. Tags: miss `offline, dead registry 127.0.0.1:9`, drift `no network (inferred)`.

## `strategy_shared_chunks`

- Part: `part_packaging`
- Target length: 54 s (127 words)

**Narration**

The shared chunks strategy builds on the kit lockfile strategy. It builds the shared packages once for each kit version, as a runtime of script files. A widget build then marks those packages as external. Vite rewrites each import to the address of the runtime file.

The runtime took three point five to three point eight seconds to build, to two point one megabytes. Each widget build then took zero point three to zero point nine seconds. Each widget page shrank to forty-four to ninety-six kilobytes.

The runtime files cannot drop unused code. Lucide is nine hundred three kilobytes of the runtime, and recharts is five hundred seventy-eight. A kit change in place also broke an old widget. The part on pin or rebuild shows that case.

**Visuals**

Strategy card `S3: shared chunks`. `s3/kit-v1/shared.json`: 17 specifiers (`react`, `react-dom/client`, `@openuidev/react-lang`, `zod`, `date-fns`, `dw-mini-ui`, `lucide-react`, `recharts`, ...). Vite config line: `rollupOptions: { external: Object.keys(shared), output: { paths: ... kitUrl + file } }`. Numbers: `runtime build 3.5 to 3.8 s, 2.1 MB per kit version`, `widget build 0.29 to 0.93 s`, `page 44 to 96 KB`. Size bars: `lucide 903 KB`, `recharts 578 KB`. Red tag: `in-place kit change broke an old widget`.

## `strategy_compare`

- Part: `part_packaging`
- Target length: 31 s (72 words)

**Narration**

Here are the three strategies side by side. The fresh install strategy needs the network for each widget, and its versions can drift. The kit lockfile strategy works offline, with frozen versions and pages of three hundred fifty to eight hundred kilobytes.

The shared chunks strategy gives the smallest pages and the fastest builds. It ties each page to the runtime of one kit version. Which strategy to use is not decided.

**Visuals**

Table (`kit_spike.strategies`): columns `S1 fresh install | S2 kit lockfile | S3 shared chunks`. Rows: `add a package: 3.3 s per widget, 817 KB | new kit version 1.0 + 3.2 + 0.5 s | S2 + 3.5 to 3.8 s runtime`; `install per widget: 14.0 s cold, 3.0 s warm | 2.6 to 3.3 s offline, or 0 s link | 0 s link`; `build: 0.9 to 3.7 s | 0.9 to 3.7 s | 0.3 to 0.9 s`; `size: 352 to 796 KB | 352 to 796 KB | 44 to 96 KB + 2.1 MB runtime per kit version`; `determinism: resolves again | frozen | frozen`; `failure: registry down 70.5 s | NO_OFFLINE_TARBALL 0.8 s | in-place kit change broke old widget`. Footer tag: `not decided`.

## `packaging_work`

- Part: `part_packaging`
- Target length: 21 s (49 words)

**Narration**

This front is the kit service with p n p m. It reads the kit folder and the lockfile. It writes the store, the node modules folder, and a new kit version on each change. The work map gives it a size of large. That size is an estimate.

**Visuals**

Work card. Reads: `kit folder, pnpm-lock.yaml`. Writes: `store, node_modules, kitVersion`. Size chip: `kit service with pnpm: L (estimate)`.

## `host_today`

- Part: `part_host`
- Target length: 24 s (55 words)

**Narration**

On the diagram, we now move to the host extras box. Widget code can also import extras on the host side. Today the host half can import only zod. The spike tested three ways to give it more, with date f n s as the extra. We call the ways bundle, external, and native addon.

**Visuals**

Outline: the `host extras` box glows. Three way chips: `bundle`, `external`, `native addon`. Test extra: `date-fns`. Today line: `paths: { zod }`.

## `host_bundle`

- Part: `part_host`
- Target length: 21 s (49 words)

**Narration**

The bundle way puts the extra into the host half. E s build made a file of five hundred ninety-four kilobytes in three hundred seventy-seven milliseconds. It works with no change to the host. The cost is size. Each host half carries its own copy, as with zod today.

**Visuals**

Card `bundle`: `esbuild bundle:true` > `index.js 594 KB in 377 ms`. Compare bar: `zod alone 545 KB`. Tick: `no host change`.

## `host_external`

- Part: `part_host`
- Target length: 45 s (106 words)

**Narration**

The external way leaves the import in the output. The file was three hundred fifty bytes. But Node must then find date f n s at run time. The import failed with the error module not found. Only a link from the bundle folder to the node modules of the kit fixed it.

That link ties the widget to its kit. We infer that a kit change under the link changes the code that the widget runs. An external import that the kit does not have can also resolve from the node modules of the profile. We infer that risk. The spike did not test it.

**Visuals**

Card `external`: `external: ['date-fns', 'zod']` > `index.js 350 B in 16 ms`. Run: `ERR_MODULE_NOT_FOUND` > fix `<bundle>/node_modules -> kit/node_modules`. Amber notes: `link ties widget to its kit`, `fallback resolve from <profile>/node_modules (inferred, not tested)`.

## `host_native`

- Part: `part_host`
- Target length: 36 s (85 words)

**Narration**

A native addon is a package with compiled machine code, in a file that ends in dot node. E s build has no loader for such files, and the spike got that error.

An A B I is the binary interface that a native addon must match. Electron forty-four has the A B I one hundred forty-nine. The Node that ships in the app has the A B I one hundred thirty-seven. Thus one addon cannot load in both. Native addons failed in the spike.

**Visuals**

Card `native addon`: esbuild error `No loader is configured for ".node" files`. ABI strip: `Electron 44 (Node 24.21.0): ABI 149` vs `bundled Node 24.21.0: ABI 137`. Red cross: `failed`.

## `host_rules`

- Part: `part_host`
- Target length: 54 s (125 words)

**Narration**

Each way has a rule and a reason. The bundle way keeps each widget whole, so a kit change cannot break a built host half. The external way keeps files small, but it ties the widget to the kit folder. A native addon must match one A B I. Thus one file cannot run in both the app Node and Electron.

The gate reads the host source and the node modules of the kit. It writes one host half for each widget. On failure, the compile gate refuses the bundle, and nothing installs. The test run also loads the host half, so an import that fails at run time stops there.

We infer that last point from the code. The spike did not run it.

**Visuals**

Three columns `bundle | external | native addon` with rule and reason: `widget whole; kit change cannot break built host half` / `small file; tied to kit folder` / `needs one ABI; cannot serve both`. Flow below: `reads host src + kit node_modules` > `writes host half per widget` > fail: `compile gate refuses, nothing installs`; `test run loads host half (inferred, not run)`.

## `host_work`

- Part: `part_host`
- Target length: 19 s (44 words)

**Narration**

This front is the gate for host extras. Today the paths map has only zod. The work adds host extras to that map and to the guide rule. The work map sizes it as medium, an estimate. Which way to allow is not decided.

**Visuals**

Work card: `extend paths map beyond zod`, `update guide rule 'Only zod ... can be imported'`. Size chip: `gate for host extras: M (estimate)`. Tag: `which way: not decided`.

## `pin_question`

- Part: `part_pin`
- Target length: 37 s (87 words)

**Narration**

On the diagram, we now look at the line from the kit to the pages. A kit change can break a built widget. To pin a widget means to keep its page on the kit version that it built with. To rebuild means to build it again on the new kit.

The operator direction says to decide from data. The spike built the three widgets on kit vee one, then again on two new kits. A rebuild of all three took eight point three to nine seconds.

**Visuals**

Outline: the line `kit > pages` glows with tag `pin or rebuild`. Definitions: `pin = keep the page on the kit version it built with`, `rebuild = build again on the new kit`. Timeline `v1 > v2a`, `v1 > v2b`. Totals (measured): `first build v1 7.7 s; rebuild v2a 9.0 s, v2b 8.3 s`.

## `example_v2a`

- Part: `part_pin`
- Target length: 18 s (43 words)

**Narration**

Kit vee two A moves date f n s from four point zero to four point one. That is a minor version. The type gate passed on all three widgets. The build passed on all three. The render check passed on all three.

**Visuals**

Table `kit v2a: date-fns 4.0.0 > 4.1.0` (from `results-v2a.tsv`): `shadcn tsc 0 vite 0 796 KB`, `clock tsc 0 vite 0 372 KB`, `meter tsc 0 vite 0 352 KB`. Three ticks under `type`, `build`, `render`: `0 of 3 broke`.

## `example_v2b_types`

- Part: `part_pin`
- Target length: 42 s (97 words)

**Narration**

Kit vee two B changes the test package to version two. Its meter component renamed its props. Value, max, and label became percent and caption. Shad c n does not use the test package. Clock uses only the pill component, which did not change. Both passed.

Meter failed the type gate. The error is T S two three two two, in library dot t s x, at line eight, column thirty-six. The props value, max, and label do not fit the type meter props. The message says that the property value does not exist on that type.

**Visuals**

Diff card `dw-mini-ui` `index.d.ts`: `- interface MeterProps { value: number; max?: number; label: string }` / `+ interface MeterProps { percent: number; caption: string }`. `Pill` unchanged. Table (`results-v2b.tsv`): `shadcn tsc_exit=0`, `clock tsc_exit=0`, `meter tsc_exit=2`. Error card (real): `src/agent/library.tsx(8,36): error TS2322: Type '{ value: number; max: number; label: string; }' is not assignable to type 'IntrinsicAttributes & MeterProps'. Property 'value' does not exist on type 'IntrinsicAttributes & MeterProps'.`

## `example_v2b_render`

- Part: `part_pin`
- Target length: 29 s (67 words)

**Narration**

The build of meter still passed, because Vite does not check types. Then the render check loaded the page. The new meter throws an error when percent is absent. OpenUI caught the error and gave the code render error.

So the data says this. A minor version broke nothing. A changed library broke one widget of three. The type gate and the render check both caught it.

**Visuals**

Row: `meter vite_exit=0 (0.918 s, 352 KB)`. Code card (`dw-mini-ui` 2.0.0 `index.js`): `if (typeof percent !== 'number') throw new Error('Meter: percent is required')`. Render result chip: `render-error`. Summary table `kit_spike.pin`: `v2a: type 0/3, build 0/3, render 0/3 broke`; `v2b: type 1/3 (TS2322), build 0/3, render 1/3 (render-error)`.

## `shared_chunks_swap`

- Part: `part_pin`
- Target length: 27 s (64 words)

**Narration**

The shared chunks strategy adds one more case. Its pages load the runtime of a kit version by address. The spike changed that runtime in place, from kit vee one to kit vee two B. The old meter page then broke with render error. Thus that strategy needs one runtime folder for each kit version. Each such folder is about two point one megabytes.

**Visuals**

S3 diagram: old page `meter (built on v1)` imports `/kit/v1/dw-mini-ui.js`. The runtime folder swaps in place to v2b content: red `render-error`. Fix picture: folders `kit-v1/`, `kit-v2a/`, `kit-v2b/`, each `2.1 MB`.

## `pin_policy`

- Part: `part_pin`
- Target length: 58 s (135 words)

**Narration**

Here is the policy that the data supports. We infer it, and it is not a decision. Pin each widget to its kit version by default. With fresh install or kit lockfile, a built page holds its own copy of each package. A kit change then does not affect it. With shared chunks, a page needs the runtime of its own kit version.

Rebuild a widget only on request. The rebuild runs the type gate, the build, and a render check. If a gate fails, the old page and the old lockfile stay.

Rebuild by force only for a security fix in a patch or a minor version, with the same gates. If a gate fails, keep the old page and flag the widget. Never rebuild automatically across a major version or a changed library.

**Visuals**

Card titled `the policy that the data supports (inferred)`. Four lines: `pin to kit version by default (fresh install, kit lockfile; shared chunks needs its runtime folder)`; `rebuild on request: type gate + build + render check; fail keeps old page and old lockfile`; `forced rebuild only for a security fix in a patch or minor version; fail keeps old page and flags the widget`; `never auto-rebuild across a major version or a changed library`. Corner tag: `not a decision`.

## `pin_work`

- Part: `part_pin`
- Target length: 18 s (42 words)

**Narration**

This front records the kit version and the lockfile hash of each build. It checks if a widget uses a package before a remove. It also gives a rebuild path. The work map sizes kit versions and pins as medium, an estimate.

**Visuals**

Work card. Records per build: `kitVersion`, `lockfile hash`. Check: `in-use before kit_remove`. Path: `rebuild`. Size chip: `kit versions and pins: M (estimate)`.

## `describe_problem`

- Part: `part_describe`
- Target length: 34 s (79 words)

**Narration**

On the diagram, we now move to the agent door. The kit changes while an agent works. An agent must learn the new package list. But which parts of the MCP text does the agent read again?

An MCP resource is a named piece of data that a client reads on request. Server instructions are a fixed text that the server sends at connect time. A tool description is the text that tells the agent what one tool does.

**Visuals**

Outline: the `MCP` door glows with tag `dynamic description`. Four text sources around an agent: `server instructions`, `tool description`, `tool output`, `resource deepwidgets://kit/manifest`. Each gets a `?`.

## `describe_test`

- Part: `part_describe`
- Target length: 40 s (94 words)

**Narration**

The spike tested this with Claude Code version two point one point three one seven. A small MCP server had two tools, one resource, and instructions, each with a version marker. A third tool came only after the change. A fake model A P I on the same machine recorded what the model would get. Thus no paid run took place.

Between two turns, the server raised the kit version. It sent list changed for tools and for resources. List changed is an MCP signal that says a list of tools or resources changed.

**Visuals**

Setup diagram: `claude (interactive, PTY)` > `MCP server kitspike 127.0.0.1:48931 (createMcpHandler, legacy: 'stateless')` and `fake model API 127.0.0.1:48932 (records /v1/messages)`. Tools: `kit_read`, `kit_probe`, then `kit_added_v2` after the bump. Markers: `KIT_INSTR_V1`, `KIT_TOOL_V1`, `KIT_PROBE_V1`, `KIT_RES_V1`. Action `GET /ctl/bump` > `notify.toolsChanged(), resourcesChanged(), resourceUpdated()`. Caption: `Claude Code 2.1.317, no paid run`.

## `describe_results`

- Part: `part_describe`
- Target length: 47 s (109 words)

**Narration**

Here are the results. Tool output and resources: yes. Claude Code read live data on each call, with kit version two after the change. List changed: yes. In all three runs, Claude Code read the tool and resource lists again within sixty-three milliseconds. A new tool showed on the next turn, as a deferred tool.

A tool that the client already loaded, with a new description: no. The old text stayed for the whole session. The server instructions: no. Claude Code never read them again. The model also gets no push of a change. It learns of a change only from a new tool name or from a call.

**Visuals**

Table `kit_spike.mcp`: `tool output and resources | yes, live each call (kitVersion 2 after bump)`; `notifications/tools/list_changed | yes, tools/list again in 14 to 63 ms (three runs); new tool next turn (deferred)`; `description of a loaded tool | no: KIT_TOOL_V1 in messages 05 to 08`; `server instructions | no: KIT_INSTR_V1 in every request`. Timeline from `run-stateless2/server.log`: `12:53:13.040 bump` > `13.052 resources/templates/list` > `13.058 tools/list` > `13.061 resources/list`.

## `describe_rule`

- Part: `part_describe`
- Target length: 39 s (92 words)

**Narration**

Thus the kit facts go in tool output and in a resource. They do not go in a tool description or in the instructions. The instructions can stay fixed and say: call kit read for the packages. List changed only refreshes the resource list and announces a new tool name.

For the same reason, the spike design keeps kit add and kit remove on the tool list at all times. In that design, the call checks the setting. A description that said off would lie after the user turns the setting on.

**Visuals**

Rule card: `kit facts > tool output (widget_guide, kit_read) + resource`, crossed out: `tool description`, `instructions`. Fixed instruction line: `call kit_read for packages`. Tool list with `kit_add`, `kit_remove` always present, and `setting checked in the call`. Tag on the tool list: `spike design`.

## `describe_cost`

- Part: `part_describe`
- Target length: 69 s (160 words)

**Narration**

How much text does a package list cost? The spike measured twenty real packages. One index line for each package came to one thousand six hundred sixty-seven characters in all. We estimate that at about five hundred tokens. A card for each package came to about nineteen thousand characters, about five thousand nine hundred tokens.

A card holds the index line, the types entry, an import line, the top exports, and a short readme part. The raw type files came to about two point five five million characters, about seven hundred seventy thousand tokens. Lucide alone was two point one seven million characters. The token numbers are estimates, the characters divided by three point three.

Thus the spike design gives one index line for each package in the guide. A tool gives a card on request. In that design, the types never go inline. The agent gets the path of the type file and reads it with its own tools.

**Visuals**

Table (`measure-out.md`, 20 packages): `index line: 1,667 chars, about 505 tokens`; `card: 19,447 chars, about 5,893 tokens`; `raw types entries: 2,554,817 chars, about 774,187 tokens`; `lucide-react types alone: 2,173,743 chars`. Footnote: `tokens = chars / 3.3 (estimate)`. Sample index line: `zod@4.4.3 (both): TypeScript-first schema declaration and validation library with static type inference`. Arrows, tag `spike design`: `index > guide`, `card > kit_describe on request`, `types > path only`.

## `describe_work`

- Part: `part_describe`
- Target length: 20 s (46 words)

**Narration**

This front adds the kit index to the output of widget guide and of kit read. It adds one resource for each package. It sends resources changed on each kit change. The work map sizes the MCP kit tools and the index as medium, an estimate.

**Visuals**

Work card: `kit index into widget_guide and kit_read output`, `resource per package deepwidgets://kit/pkg/<name>`, `notify.resourcesChanged() on change`. Size chip: `MCP kit tools and index: M (estimate)`.

## `config_place`

- Part: `part_config`
- Target length: 47 s (110 words)

**Narration**

Now the kit config. This is a design from the spike, not a decision. The kit is a p n p m project in the D S H home folder, under deepwidgets slash kit. It holds the package file, the lockfile, node modules, and kit dot json.

Kit dot json holds the kit version. For each extra, it holds its side, who added it, when, and its stored card. Why not the package file of the profile? The plugin manager owns that file, and it treats each package there as a plugin. Why not host storage? Vite and e s build need a real node modules folder to resolve from.

**Visuals**

Banner: `a design from the spike, not a decision`. Folder tree `$DSH_HOME/deepwidgets/kit/`: `package.json`, `pnpm-lock.yaml`, `node_modules/`, `kit.json { kitVersion, extras: { side, addedBy, addedAt, card } }`. Two crossed options: `profile package.json (plugin manager owns it)`, `host storage (no real node_modules)`.

## `config_setting`

- Part: `part_config`
- Target length: 18 s (43 words)

**Narration**

The setting agents may add packages lives in the host settings. The settings pane shows it like other settings. When it is off, an agent can read the kit but cannot change it. The user can always change the kit from the pane.

**Visuals**

Settings row: toggle `agentsMayAddPackages` (host settings). Two lines: `off: agent can read, not change`, `user: can always change`.

## `kit_read_describe`

- Part: `part_config`
- Target length: 44 s (103 words)

**Narration**

One kit service, with the name context dot widget kit, has two doors. MCP is the door for agents, and H T T P is the door for the pane.

Kit read takes no input. It returns the kit version, the setting, the core list, the extras list, and the index text. Each package entry has a name, a version, a side, and its types. The side is renderer, host, or both.

Kit describe takes a package name. It returns the card: name, version, side, import line, and exports. The card also gives the absolute path of the types and a usage example.

**Visuals**

Service box `ctx.widgetKit` with two doors: `MCP` and `HTTP`. Card `kit_read: {} -> { kitVersion, agentsMayAdd, core: Pkg[], extras: Pkg[], index }`, `Pkg = { name, version, side: 'renderer' | 'host' | 'both', types, addedBy? }`. Card `kit_describe: { name } -> { name, version, side, import, exports[], typesPath (absolute), usage }`.

## `kit_add_remove`

- Part: `part_config`
- Target length: 21 s (50 words)

**Narration**

Kit add takes a name, an optional version, a side, and a request id. It returns the new kit version and the card. Kit remove takes a name and a request id. It returns the new kit version. The request id makes a retry safe, as with widget call today.

**Visuals**

Cards: `kit_add: { name, version?, side, requestId } -> { kitVersion, card }`; `kit_remove: { name, requestId } -> { kitVersion }`. Note: `requestId: retry safe, as widget_call`.

## `kit_errors`

- Part: `part_config`
- Target length: 42 s (99 words)

**Narration**

Each error has a code and a next step. Kit locked means that the setting is off. The next step says: ask the user to turn the setting on. In core means that the package belongs to the locked core, so no tool can change it.

In use means that a widget build still imports the package. The error lists those slugs. Not found means that the registry has no such package or version. Install failed means that p n p m failed, and the kit stays as it was. The design also lists bad name and idempotency conflict.

**Visuals**

Error table: `kit-locked | setting off | nextStep: ask the user to turn on the setting`; `in-core | package is in the locked core`; `in-use | lists slugs whose last build imports it`; `not-found | no such package or version`; `install-failed | pnpm failed, kit unchanged`; also `bad-name`, `idempotency-conflict` (from `mcp/research.md`).

## `add_steps`

- Part: `part_config`
- Target length: 48 s (111 words)

**Narration**

One addition does these steps, in order. The service checks the name, the setting, and that the package is not in the core. It copies the kit folder and runs p n p m add with save exact in the copy. If that fails, the old folder stays. Then it swaps the folders.

It reads the installed version, the types entry, and the exports, and writes the card. It raises the kit version and records the lockfile hash. It sends a signal to the change feed and to the kit stream. The guide shows the change at the next call.

Built widgets do not change. A rebuild uses the new kit.

**Visuals**

Step strip, no numbers on screen, named chips: `check (name, setting, not core)` > `copy folder + pnpm add --save-exact <name>@<version>` > `swap folders` > `read version, types entry, exports; write card to kit.json` > `kitVersion += 1, record lock hash` > `signal: change feed, /api/kit/stream, notify.resourcesChanged()`. Side note: `built widgets unchanged; rebuild uses new kit`.

## `add_example`

- Part: `part_config`
- Target length: 30 s (70 words)

**Narration**

Here is one addition from the spike, with real times. The package nanoid went into the kit. The resolve took one point two seconds. The fetch took three point three seconds. The kit install took half a second. The network moved forty-seven kilobytes.

The answer that kit add would give is illustrative only. It would hold kit version two and the card of nanoid. No kit add tool exists yet.

**Visuals**

Measured row (`measurements.tsv`): `kit_add_package(nanoid): resolve 1.2 s + fetch 3.3 s + kit install 0.5 s = 5.0 s, net 47 KB`. Illustrative card, grey frame labeled `illustrative, no such tool yet`: `{ kitVersion: 2, card: { name: 'nanoid', version: '<installed>', side: 'renderer', ... } }`.

## `config_work`

- Part: `part_config`
- Target length: 15 s (36 words)

**Narration**

The work map sizes the MCP kit tools as medium and the kit service as large. Both are estimates. The place, the tools, and the errors are all a design from the spike, not a decision.

**Visuals**

Size chips: `MCP kit tools: M`, `kit service with pnpm: L`, both `estimate`. Banner again: `a design from the spike, not a decision`.

## `kit_routes`

- Part: `part_settings`
- Target length: 68 s (159 words)

**Narration**

On the diagram, we now move to the user door. In the spike design, the user door is a set of H T T P routes on the host. No route exists yet. Get slash a p i slash kit returns the same body as kit read. Put slash a p i slash kit slash settings sets agents may add packages. Post slash a p i slash kit slash extras adds an extra.

Delete slash a p i slash kit slash extras slash, then a name, removes one extra. Get slash a p i slash kit slash stream sends a signal on each kit change. The user door ignores kit locked.

These routes copy the shape of the widget routes of today. Those are program, call, and stream under slash a p i slash widgets, and one events stream. The host checks the host cookie on each of them. The work map sizes the routes as small, an estimate.

**Visuals**

Outline: the `settings pane` door glows. Route table, tag `spike design, no route exists`: `GET /api/kit` (same body as kit_read), `PUT /api/kit/settings { agentsMayAddPackages }`, `POST /api/kit/extras { name, version?, side }` (ignores kit-locked), `DELETE /api/kit/extras/<name>`, `GET /api/kit/stream` (SSE). Today table beside it: `/api/widgets/<slug>/program`, `/call`, `/stream`, `/api/widgets/events`, all `guarded`, host cookie. Size chip: `routes: S (estimate)`.

## `settings_rules`

- Part: `part_settings`
- Target length: 44 s (102 words)

**Narration**

In the spike design, the user door ignores kit locked. We infer the reason: the setting limits agents, not the person who owns the machine. In the design, the pane and the tools use one service. We infer that the other errors are the same at both doors.

The spike design also says what a failure does. For example, install failed leaves the kit and its old folder in place. In use lists the slugs that still import the package. We infer that the pane shows the error. The pane listens to the kit stream, so a change from an agent shows at once.

**Visuals**

Two doors into one box `ctx.widgetKit`: `MCP (agent): kit-locked applies`, `HTTP (user): kit-locked ignored`. Reason tag: `the setting limits agents, not the machine owner (inferred)`. Error toasts in the pane (inferred, illustrative): `install-failed: kit unchanged`, `in-use: meter, clock`. Stream line: `GET /api/kit/stream` > pane refreshes.

## `kit_feed`

- Part: `part_settings`
- Target length: 29 s (68 words)

**Narration**

The change feed is the list of recent changes that agents read with widget changes. Today each entry has a slug, a kind, and who made the change. The kinds are state, program, added, and removed. A kit change needs a new kind or a new feed. We infer that from the code. The spike design names only a change feed entry from an agent or a user.

**Visuals**

Code card `WidgetChange { seq, at, slug, kind: 'state' | 'program' | 'added' | 'removed', by, action?, rev? }`. Amber chip: `kit change: new kind or new feed (inferred)`.

## `settings_pane`

- Part: `part_settings`
- Target length: 28 s (66 words)

**Narration**

In the spike design, the settings pane is a page for the user. No pane exists yet. It shows the setting as a switch.

It lists the core packages, which the user cannot remove. It lists the extras, each with its side and who added it. A form adds or removes an extra through the routes. The work map sizes the pane as medium, an estimate.

**Visuals**

Mock pane: switch `Agents may add packages`; list `core` (locked rows: react, @openuidev/react-lang, zod, vite, ...); list `extras` (`date-fns 4.0.0 renderer, added by user`; `dw-mini-ui 1.0.0 renderer`); form `name, version, side [renderer | host | both]`, buttons `Add`, `Remove`. Size chip: `settings pane: M (estimate)`. Grey label: `mock, illustrative, spike design`.

## `serving_today`

- Part: `part_serving`
- Target length: 15 s (34 words)

**Narration**

On the diagram, we now move to Electron main. Today Electron main serves one shell for every slug, from one folder. The window address is slash widget, with the slug in the query string.

**Visuals**

Outline: `Electron main` glows. Code card `apps/desktop/src/main.ts`: `shellRoot = join(resources.dsh, 'node_modules', '@deepwidgets', 'shell', 'dist')`, and the window URL `${SCHEME}://app/widget/?slug=<slug>`.

## `serving_slug`

- Part: `part_serving`
- Target length: 24 s (56 words)

**Narration**

With the kit, each slug has its own build folder. The spike Vite config sets the base path to slash widget, then the slug. Electron main must map that path to the build folder of that slug. The window code must open that address. We infer these changes from the spike config and the current code.

**Visuals**

Spike `vite.config.ts`: `base: /widget/${slug}/`. Map: `dsh-app://app/widget/meter/` > `<build folder of meter>/index.html`. Amber: `Electron main and window URL changes (inferred)`.

## `serving_rebuild`

- Part: `part_serving`
- Target length: 27 s (62 words)

**Narration**

A rebuild writes a new build folder for the slug. The old folder stays until every gate passes. Then the service swaps the folders, and the window loads the new page. If a gate fails, the window keeps the old page.

Old folders of removed widgets need a cleanup. We infer all of this from the pin policy and the spike config.

**Visuals**

Folders `widget/meter/` (live, v1) and `widget/meter.next/` (building, v2b). Gates pass: swap, window reloads. Gate fails (v2b meter TS2322): `.next` deleted, window keeps v1 page. Grey bin: `builds of removed widgets: cleanup`. Amber tag: `inferred from pin policy and spike config`. Folder names illustrative.

## `serving_csp`

- Part: `part_serving`
- Target length: 22 s (52 words)

**Narration**

The page keeps its content security policy. Scripts can load only from the same origin. We infer that each strategy can keep its files on that origin, so the policy holds. A fallback page must show when a slug has no build. The work map sizes this front as medium, an estimate.

**Visuals**

CSP card (`index.html`): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:`. Chips: `same origin for S1, S2, S3 (inferred)`, `fallback page when a slug has no build`. Size chip: `Electron main serves each slug: M (estimate)`.

## `checks_list`

- Part: `part_checks`
- Target length: 39 s (91 words)

**Narration**

On the diagram, the checks touch every box. Each unit of work needs a check that can fail. The spike work map names these checks. A smoke check adds an extra, builds a widget, and renders it.

An MCP test calls kit add with the setting off and expects kit locked. It also removes a package in use and expects in use. Another test sends list changed to the modern MCP client and checks that the client reads the lists again. The work map sizes the checks as medium, an estimate.

**Visuals**

Outline: all boxes get a check mark outline. Check list: `smoke: add extra > build > render`; `MCP test: kit_add with setting off -> kit-locked`; `MCP test: kit_remove of a used package -> in-use`; `list_changed test with @modelcontextprotocol/client 2.2.0`. Size chip: `checks: M (estimate)`.

## `checks_today`

- Part: `part_checks`
- Target length: 45 s (104 words)

**Narration**

Some checks exist today and must change. The MCP check, widgets m c p, checks that the server lists the nine tools. It calls only the four interact tools. It must also test the four kit tools.

The creation check, widgets create, runs the three gates. It must also run the type gate, the Vite build, and the render check. The smoke check of one widget must load the page of that slug.

Each new check must fail on a broken build. A check that cannot fail proves nothing. We infer the list of changes from the work map and the current tools folder.

**Visuals**

Table of today's tools and the change: `tools/widgets-mcp.mjs: lists nine tools, calls four > plus kit_read, kit_describe, kit_add, kit_remove`; `tools/widgets-create.mjs: compile, lint, test run > plus type gate, Vite build, render check`; `DSH_SMOKE_WIDGET=<slug> node tools/smoke-desktop.mjs > page of that slug`. Footer: `each check must fail on a broken build (inferred list)`.

## `tla_models`

- Part: `part_checks`
- Target length: 47 s (109 words)

**Narration**

TLA plus is a language for models of systems that change state. A model checker walks every order of steps and checks the rules. The repository has three widget models. One of them is widget install. It models install, reload, and remove, with crashes between steps.

The spike work map plans a build step and a kit version in that model. It also plans a race, a kit remove during an install, which must give in use. A new small model would cover kit add and kit remove against builds. We infer that the two other models need no change. The work map sizes this as medium, an estimate.

**Visuals**

Folder `.agents/skills/widget-state-models/`: `action_contract`, `crash_lifecycle`, `widget_install/WidgetInstall.tla` (654 lines). Planned in the work map (inferred), additions to `WidgetInstall.tla`: `build step`, `kitVersion`, `kit_remove racing an install -> in-use`. New box: `small kit model: kit_add / kit_remove vs builds`. Amber: `ActionContract.tla, crash_lifecycle.tla: no change (inferred)`. Size chip: `TLA+: M (estimate)`.

## `prior_art`

- Part: `part_close`
- Target length: 46 s (107 words)

**Narration**

Other projects solve parts of this. Context seven gives agents two tools. One finds a library, and one returns its documents on request. That matches the index and the card. The llms dot t x t format also has an index file and a full file.

Raycast and VS Code put the packages of each extension into its own build. Val Town names the version inside each import. Observable and Deno import maps resolve and pin each import at build time. All of these, except Context seven, come from memory, not from a test. No project does the whole path, so the work builds from the parts.

**Visuals**

Table `kit_spike.prior_art`: `Context7 | two tools: find a library, docs on request (verified)`; `llms.txt | index + full file (from memory)`; `Raycast, VS Code | each extension build includes its own packages (from memory)`; `Val Town | npm:pkg@ver per import (from memory)`; `Observable, Deno import maps | build resolves and pins each import (from memory)`.

## `risks_build`

- Part: `part_close`
- Target length: 51 s (119 words)

**Narration**

Now the risks, stated plainly. The render check finds only errors that throw. The type gate refuses an untyped extra until the agent declares the module. After that, the spike record says that a wrong prop passes. We could not check that.

The shared chunks strategy cannot drop unused code. Lucide adds nine hundred three kilobytes and recharts five hundred seventy-eight.

The node modules folder of kit vee one is about two hundred twenty-eight megabytes. Lucide alone is about forty-five megabytes, and date f n s about thirty-eight. The spike record also says that about eighty-five megabytes is build tooling. We measured the build tools at seventy-five to ninety megabytes. The range depends on which helper packages we count.

**Visuals**

Risk cards, red: `render check finds only throws`; amber `untyped extra: TS7016 until declare module, then wrong prop passes (spike record, not checked)`; `S3 cannot tree-shake: lucide 903 KB, recharts 578 KB`; `kit v1 node_modules 228 MB (du)`; `lucide-react 45 MB, date-fns 38 MB (du)`. Amber card: `spike record: "about 85 MB of the kit is build tooling"`; under it `our du sum: 75 to 90 MB, by tool list (ran)`.

## `risks_supply`

- Part: `part_close`
- Target length: 33 s (78 words)

**Narration**

Minimum release age holds a security fix for one day, unless the kit excludes that package. The lockfile records a local file extra as a path relative to the project. Thus the layout of the kit folder must stay fixed.

An external host import that the kit does not have can resolve from the node modules of the profile. We infer that risk. Native addons fail, because Electron and the app Node have different A B I numbers.

**Visuals**

Risk cards: `minimumReleaseAge: security fix held 24 h unless excluded`; `file: extra recorded as a path relative to the project: kit layout must stay fixed`; `external host import can resolve from <profile>/node_modules (inferred)`; `native addon: ABI 149 vs 137`.

## `work_map`

- Part: `part_close`
- Target length: 39 s (92 words)

**Narration**

Here is the whole work map. Each size is an estimate. Large: the kit service with p n p m, and the Vite build gate. Medium: the MCP kit tools and the index, the settings pane, and the gate for host extras.

Also medium: kit versions and pins, the split of main dot t s x, and Electron main for each slug. Also medium: the checks and the TLA plus work. Small: the kit routes, and the guide and the template. Two fronts are large, eight are medium, and two are small.

**Visuals**

Table `kit_spike.work` with all twelve rows and sizes: `MCP kit tools and index M`, `kit service with pnpm L`, `settings pane M`, `/api/kit routes S`, `Vite build gate L`, `gate for host extras M`, `kit versions and pins M`, `guide and template S`, `split of main.tsx M`, `Electron main serves each slug M`, `checks M`, `TLA+ M`. Header tag: `sizes inferred`.

## `open_items`

- Part: `part_close`
- Target length: 52 s (122 words)

**Narration**

Here is what is still open for the operator to decide. Which packaging strategy: fresh install, kit lockfile, or shared chunks? Pin or rebuild: does the inferred policy become the rule? Which host extras to allow: bundle, external, or none? Do native addons stay out?

Which tool runs the type gate: t s c or t s go lint? Where does the kit live, and which tools and errors does it have? What goes in a package card: a readme part, or a curated usage field? How does the kit handle minimum release age for a security fix?

The standing decision widget runtime pin still says one shared shell. Does the kit direction replace it? This video recommends none of these choices.

**Visuals**

Card titled `open for the operator`, no ranking, no highlight: `packaging: S1 fresh install / S2 kit lockfile / S3 shared chunks`; `pin or rebuild: adopt the inferred policy?`; `host extras: bundle / external / none`; `native addons: out?`; `type gate: tsc / oxlint + tsgolint`; `kit config: place, tools, errors`; `package card: readme excerpt / curated usage`; `minimumReleaseAge and security fixes`; `widget.runtime_pin still says one shared shell`.

## `closing`

- Part: `part_close`
- Target length: 26 s (61 words)

**Narration**

To close. The widget kit is a direction in progress, not a decided spec. Each widget would get its own page, with a library that an agent writes. The spike measured the build, the packaging, the host extras, pin or rebuild, and the agent text. Twelve fronts of work follow from it. The operator decides the open points before any spec.

**Visuals**

Outline diagram again, both rows lit. Corner tag stays: `direction in progress, not a decided spec`. Final text: `12 fronts of work`, `operator decides before any spec`.
