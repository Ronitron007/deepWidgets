# Script: the page build gate `build_gate_video`

Source: PR #107, branch `rohan/library-build-gate`, head `e32b7f2e`. Spec `agent_library.build_gate`.

The narration of each scene is in `narration.md`, under the same name. The target length is the narration at about one hundred fifty words per minute.


## part_intro

### `cold_open`

- Target: 39 s (99 words).
- Visuals: Two widget windows side by side. Left, labelled TODAY: the same shell page drawing a program. Right, labelled AFTER: a page of the agent's own components. Then the right window gets a red border and the caption `nobody reviews it first`.

### `outline`

- Target: 49 s (123 words).
- Visuals: THE ANCHOR DIAGRAM. A left-to-right chain of boxes: `widget_install(dir)` -> [compile] [lint] [test run] -> a dashed branch `page/ exists?` -> [page-files] [page-types] [page-build] [page-render] -> [profile folder] [live]. Host gates in one colour, page gates in another. Every later part re-opens this diagram and highlights its box.

### `from_the_plan`

- Target: 32 s (80 words).
- Visuals: Two video cards: `widget kit, 2026-11-03, 43:50` and `this video`. Three red pins drop on the first card, labelled `deadline`, `copy`, `allowed set`.


## part_foundation

### `core_and_child`

- Target: 51 s (129 words).
- Visuals: Box `page` split in two: `core (widget-kit)` and `child (agent)`, meeting at a narrow seam labelled `ChildProps { root, children }`. A citation line under it: `widget kit video 07:29 and 08:00`.

### `page_folder`

- Target: 50 s (126 words).
- Visuals: A file tree of the bundle: `src/index.ts` (host half) and `page/` with its five files. index.html, main.tsx and styles.css carry a lock icon; child.tsx and library.tsx carry a pencil icon. styles.css carries a half lock.

### `fixed_files`

- Target: 46 s (116 words).
- Visuals: The real index.html, twelve lines, with the CSP meta line highlighted. Beside it main.tsx, six lines, each import labelled.

### `dw_core_block`

- Target: 63 s (158 words).
- Visuals: The four page states drawn as four small widget windows: two grey bars, a red title with Retry, an empty note, a removed note. Below, the real dw-core block, with `@layer dw-core` and one `!important` highlighted. Then a diagram of the important cascade: unlayered important LOSES to layered important, with the arrow pointing the unexpected way. Then the hole: a SECOND `@layer dw-core` block from the agent, lower in the sheet, winning by order. Show the real fixture line `@layer dw-core { .dw-surface { padding: 0 !important; } }` and mark it `only the render check catches this`.


## part_files

### `hash_idea`

- Target: 46 s (116 words).
- Visuals: One file, an arrow through a box marked sha256, out to `3f9c2a...`. Then the same file with one byte changed and a different hash. Then the build-name form: `page-` + first 16 hex.

### `gate_files`

- Target: 49 s (124 words).
- Visuals: The anchor with page-files lit. Three comparison rows: index.html, main.tsx, dw-core block, each `page hash` vs `template hash` with a tick. Then a failing row in red with its real diagnostic line.

### `symlink_teach`

- Target: 49 s (123 words).
- Visuals: A folder with a file `link` whose contents is the text `/etc/secret`. An arrow leaving the folder boundary. The street-sign analogy drawn once. Then `ln -s target name` as a one-line command.

### `gate_files_links`

- Target: 46 s (116 words).
- Visuals: The page folder with a red link `leak.ts` pointing outside. Then the race drawn as a timeline: gate reads target (ok) -> agent repoints link -> build reads a different file. Then the refusal stamp.


## part_types

### `staging_copy`

- Target: 50 s (125 words).
- Visuals: Left, the agent folder. An arrow `copy` to the right: `<profile>/deepwidgets-widgets/.page-staging/stage-XXXX/` holding `page/`, `node_modules/`, `tsconfig.json`, `oxlintrc.json`, `page-env.d.ts`. A bin icon on the staging box, labelled `removed at the end, pass or fail`.

### `linked_modules`

- Target: 45 s (114 words).
- Visuals: The staging node_modules opened: eight entries, each drawn as a link arrow to a real folder elsewhere. A ninth entry `recharts` drawn greyed out and absent, with the resulting TS2307 line below.

### `one_copy_rule`

- Target: 47 s (119 words).
- Visuals: Two resolution arrows: `react` resolved through widget-kit, `zod` resolved through @openuidev/react-lang. Beside them the failure case: two zod copies and a schema that will not type-check against itself.

### `gate_types`

- Target: 46 s (116 words).
- Visuals: The anchor with page-types lit. The real oxlint command line, wrapped. Then two example diagnostics: a TS2322 and a TS2307, each with file, line and column, and the path shown under `page/`.


## part_build

### `plugin_hook_teach`

- Target: 55 s (138 words).
- Visuals: A build pipeline as a corridor with two doors. Door one, early, labelled `resolveId(source, importer)`. Door two, at the end, labelled `generateBundle(bundle)`. The inspector figure stands at both. A badge `enforce: pre` on the first door.

### `import_fence`

- Target: 58 s (147 words).
- Visuals: A decision tree from one import: importer in page/? no -> let through. yes -> bare? -> on the list? Then the real ALLOWED array of nine names and the two prefixes. A refused subpath example with `..` in it.

### `fence_hole`

- Target: 56 s (141 words).
- Visuals: The same corridor, with four side doors that bypass it: `@import`, `image-set()`, `new URL`, `a plugin reads a file`. Each labelled `no import statement`. Then four red tick marks appear, captioned `found by a reviewer`.

### `module_graph_teach`

- Target: 45 s (113 words).
- Visuals: A graph of modules with real file names, then a side list `watch files`, then a row of emitted files with `originalFileNames` arrows back to their sources. One question under it: `which files on this disk went into this page?`

### `data_url_teach`

- Target: 48 s (121 words).
- Visuals: A small PNG next to a size threshold. Below the threshold it becomes `data:image/png;base64,iVBOR...` inside the CSS. The output folder shown empty, with the caption `the bytes are in the page all the same`.

### `monkey_patch_teach`

- Target: 59 s (149 words).
- Visuals: node:fs drawn as a box of functions. One function swapped for a wrapper that writes to a set, then calls the original. The five wrapped names listed. A greyed box `native addon` with its own arrow straight to the disk, captioned `not seen`.

### `output_fence`

- Target: 60 s (151 words).
- Visuals: The four lists flowing into one set, each path through `realpath`, then a three-way test: inside page/, inside staging, inside an allowed folder. Anything else drops into a red bucket with the real error message.

### `postcss_teach`

- Target: 43 s (109 words).
- Visuals: A stylesheet going through PostCSS with a plugin list. Then the config lookup drawn as a search up the folder tree, with a red stop sign, and `css: { postcss: {} }` shown as the inline config.

### `stylesheet_checks`

- Target: 41 s (103 words).
- Visuals: Three refused things with their real diagnostic lines: a postcss.config.mjs file, an `@plugin` line, an `@config` line. A caption: the output fence would catch the file, these exist for the message.

### `build_child`

- Target: 52 s (132 words).
- Visuals: The host process with a heartbeat line. Beside it a child process doing the build, with the heartbeat unbroken. The `RESULT {json}` line on its stdout. A 90 s limit bar with a SIGKILL at the end.


## part_render

### `ipc_teach`

- Target: 52 s (132 words).
- Visuals: Three process boxes from the deepWidgets video, re-drawn: Electron main, host (its child), renderer. One arrow host -> main carrying `{checkId: 7, check: {...}}`, one back carrying `{checkId: 7, result: {...}}`. Two questions in flight drawn with different numbers.

### `check_route`

- Target: 41 s (104 words).
- Visuals: Two origins as two doors: `dsh-app://app` (live) and `dsh-app://widget-check` (check only). The check door serves one folder. A refused path with `..` gets a 403.

### `test_run_fixture`

- Target: 48 s (121 words).
- Visuals: The test run (callback card, deepWidgets 26:55) recording `program` and each query answer. Then three faked routes: program, call, stream, each with its real response shape. A cut line between the page and the live host.

### `hidden_window`

- Target: 42 s (106 words).
- Visuals: A 320x300 window outline with `show: false` and the webPreferences list. Three listeners drawn as antennae: console errors, renderer gone, navigation denied. A queue of checks waiting.

### `deadline`

- Target: 57 s (143 words).
- Visuals: A timeline. OLD: load (never finishes) ... ready limit never starts ... 45 s host timeout, queue stuck, every later check fails. NEW: one 15 s deadline over load+judge, then crash renderer, destroy window, queue free. Red pin one of three.

### `shadow_dom_teach`

- Target: 50 s (125 words).
- Visuals: An element with a shadow root drawn as a sealed case. Page CSS arrows bounce off. Inherited properties and custom properties drawn as the two arrows that DO pass through. The sealed display case analogy.

### `style_probe`

- Target: 58 s (146 words).
- Visuals: Two hidden boxes side by side with identical markup. Left: page styles apply. Right: a shadow root with only the dw-core block. Six rows of property comparisons with values, one row mismatched and highlighted, and the real lost-core-styles line.

### `render_verdicts`

- Target: 47 s (119 words).
- Visuals: A table: three refusals (render-error, not-ready, lost-core-styles) and three warnings (no height, too wide, program errors), each with what it means and whether the install stops.

### `cli_skip`

- Target: 45 s (113 words).
- Visuals: Two host boxes. Desktop host with Electron main beside it. CLI host alone, with the request arrow going nowhere. The warning text shown in the install answer.


## part_place

### `rename_teach`

- Target: 45 s (114 words).
- Visuals: A copy drawn as a progress bar with a reader seeing a half file. A rename drawn as a single switch, either-or. Callback card: deepWidgets 30:48, one line, no reason given.

### `tmp_build`

- Target: 49 s (123 words).
- Visuals: OLD: live -> delete old page -> copy new, with a crash marker in the gap. NEW: build into page-<hash>.tmp -> render check reads it -> one rename drops .tmp. Red pin two of three.

### `page_link`

- Target: 46 s (116 words).
- Visuals: The slug folder with three build folders and the `page` link. The swap in two steps: make `.page-link-ab12cd`, then rename it over `page`. A reader arrow that always lands on a complete build.

### `keep_three`

- Target: 42 s (106 words).
- Visuals: Four build folders with timestamps, the oldest fading out. Two reasons listed: a reinstall of the same sources keeps the build that is there; a later pin can point the link back with one rename. Sizes 360 to 800 KB each.

### `sweep`

- Target: 47 s (119 words).
- Visuals: Three leftovers from a stopped host: a staging folder, a .tmp build, a .page-link- entry. The host start sweeping all three. A caption on the naming: inert and easy to find.


## part_example

### `example_setup`

- Target: 33 s (84 words).
- Visuals: The real fixture folder for slug `create-page`, with its library declaring a component through a zod schema. The host gates listed with ticks.

### `example_pass`

- Target: 50 s (127 words).
- Visuals: The anchor diagram with all four page gates ticked, each carrying its real number: 3 hashes matched, 8 links, about 1.25 s build, 648 ms render (each number verified). The built index.html line with the base path highlighted.

### `example_refuse`

- Target: 52 s (130 words).
- Visuals: The same page with one added line of `new URL`. Each gate in turn: page-files tick, page-types tick, import fence sees nothing (greyed), then page-build red with the real message. The old page link untouched.

### `example_loop`

- Target: 50 s (125 words).
- Visuals: The loop fixture, including the detail that it writes document.title so the bundler keeps it. A clock to 15 s, the renderer crashed, then the next check passing at 654 ms.


## part_close

### `twelve_cases`

- Target: 52 s (132 words).
- Visuals: A table of the thirteen refusals: case, gate, and the diagnostic each one asserts. Grouped by gate: page-files 3, page-types 2, page-build 8.

### `mutants`

- Target: 40 s (102 words).
- Visuals: Three mutant rows: what was removed, which check failed, and the message. Then a fourth row: the four bypasses with the syntax checks off, all still refused.

### `limits_open`

- Target: 62 s (157 words).
- Visuals: Three open items with their numbers: the config-file exemption with the 4 KB line, the worker with 720 KB, the allowed set at 1152 folders and 313 workspace packages. Fix sizes beside each.

### `not_served`

- Target: 32 s (81 words).
- Visuals: The anchor diagram one more time, with a grey box after it labelled `library.serving`, and the widget window still showing the shared shell.

### `closing`

- Target: 52 s (132 words).
- Visuals: The four gates as four stamps. Then one line centred: `check the result, not the syntax`. Then the three red pins recalled: a limit that started too late, a copy where a rename belongs, a set wider than its specification.


## Total

48 scenes, 5845 words, about 38 minutes.
