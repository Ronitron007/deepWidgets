# Sources: the page build gate

Every claim of the narration, with where it comes from. The code is PR #107, branch `rohan/library-build-gate`, head `e32b7f2e`, read on 2026-11-13. A line marked `verified` comes from reading that file. A line marked `measured` comes from a command that the implementer or a reviewer ran and reported. A line marked `inferred` is a judgement.

## cold_open, outline, from_the_plan

| Claim | Source |
|---|---|
| Until this change every widget window showed the same page | `deepwidgets/shell/src/main.tsx` at `aef39271`, one page for every slug. verified |
| The host gates are compile, lint, test run | `deepwidgets/mcp/src/creation.ts`, gate order. verified |
| The page gates run only when the folder holds `page/` | `page-gate.ts:139` `hasPage`. verified |
| The first gate that refuses stops the install | `page-gate.ts:365` `runPageGates`, each gate returns early. verified |
| The widget kit video is forty-three minutes long | `ffprobe` of `explainer-widget-kit-2026-11-03-v1.mp4`, 43.8 minutes. measured |

## core_and_child, page_folder, fixed_files, dw_core_block

| Claim | Source |
|---|---|
| The core loads the program, sends queries and mutations, reads the stream, shows the states | `deepwidgets/widget-kit/src/index.tsx` module header. verified |
| `ChildProps` has `root` and `children` | `widget-kit/src/index.tsx`, the interface. verified |
| The core now lives in its own package; the shell keeps the default child | PR #103, merged `aef39271`. verified |
| The page folder holds five files, three fixed | `deepwidgets/mcp/widget/template/page/` holds three; `child.tsx` and `library.tsx` come from the agent. verified |
| `index.html` is twelve lines and carries the CSP | the template file. verified |
| `main.tsx` is six lines of code | the template file, eleven lines with its comment. verified |
| The block holds six rules in `@layer dw-core`, each declaration important | `template/page/styles.css`. verified |
| An important rule in a layer beats an unlayered important rule | CSS cascade: for important declarations the layer order reverses. Known to the viewer, 2026-11-13. verified by his answer |

## hash_idea, gate_files, symlink_teach, gate_files_links

| Claim | Source |
|---|---|
| The build name is the first sixteen characters of a hash over each file path and its bytes, sorted | `page-gate.ts:170` `sourceHash`. verified |
| The gate compares three things by hash | `page-gate.ts:186` `filesGate`. verified |
| A missing file, a changed file, a stylesheet with no single block each fail | `filesGate`, the three branches. verified |
| The next step says to restore from the template and install again | `PAGE_NEXT_STEP['page-files']`, `page-gate.ts:123`. verified |
| A page may hold no symbolic link, at any depth | `page-gate.ts:159` `pageLinks`, called from `filesGate`. verified |
| The check plants `leak.ts` and expects the gate `page-files` | `tools/widgets-create.mjs:622`. verified |
| A check on the link target would have a race | inferred. The code comment at `page-gate.ts:198` gives the reason as the target naming a file outside. |

## staging_copy, linked_modules, one_copy_rule, gate_types

| Claim | Source |
|---|---|
| The copy goes under `.page-staging` in the profile folder, with a fresh name | `page-gate.ts:238` `stagePage` with `mkdtemp`. verified |
| The copy skips a `node_modules` folder inside the page | the `filter` of `cp`, `page-gate.ts:242`. verified |
| Three small files go next to the copy | `stagePage` writes `page-env.d.ts`, `tsconfig.json`, `oxlintrc.json`. verified |
| The copy goes at the end, pass or fail | the `finally` of `runPageGates`, `page-gate.ts:399`. verified |
| The folder holds eight links | `packageFolders`, `page-gate.ts:211`, eight entries. verified |
| An off-list package gives a missing module error | `tools/widgets-create.mjs:600`, which expects TS2307. verified |
| react and react-dom resolve through the widget kit | `packageFolders` uses `kitRequire`. verified |
| zod resolves from the folder of `@openuidev/react-lang` | `page-gate.ts:226`. verified |
| Zod is a peer dependency of that package | its `package.json` peer range. The reviewer verified one zod in the store, `zod@4.4.3`. measured |
| The type gate runs oxlint with the type aware and type check flags | `typesGate`, `page-gate.ts:278`. verified |
| Its limit is sixty seconds and it reports at most twenty problems | `LINT_LIMIT_MS`, `MAX_DIAGNOSTICS`. verified |
| The staging path is stripped from each diagnostic | the `strip` of `typesGate`. verified |

## plugin_hook_teach to build_child

| Claim | Source |
|---|---|
| `resolveId` runs for every import with its importer; `generateBundle` runs at the end | Rollup and Vite plugin interface. verified by the two plugins in `page-build-child.ts` |
| The fence asks to run early with `enforce: 'pre'` | `importFence`, `page-build-child.ts:78`. verified |
| The fence checks only imports from page files | `inPage(from)` guard, `:82`. verified |
| A bare import must be on the list, exactly or under a prefix | `allow`, `:68`. verified |
| A path import must resolve inside the page folder | `:87-92`. verified |
| It refuses a subpath with `..`, `.` or an empty segment | `:72`. verified |
| Four forms got past the syntax checks | the reviewer reproduced each with a secret file outside the page: `@import` with no space, `@import` with a comment, a bare `image-set()` string, and `new URL`. measured |
| The bundler keeps a module graph, watch files, and emitted assets with their source names | `outputFence` reads `getModuleIds`, `getWatchFiles`, `originalFileNames`. verified |
| A bundler embeds a small file as a data URL | Vite's asset inline limit. The reviewer saw a secret file inlined as base64, including a `.txt` file. measured |
| The recorder wraps five functions of `node:fs` and two of its promise form | `recordReads`, `page-build-child.ts:204`. verified |
| `syncBuiltinESMExports` makes the wrapped versions visible to named imports | the call at `:206` and its comment. verified |
| A native module's own reads are invisible; Tailwind reports those as watch files | the comment at `:185`. inferred from that comment, not measured |
| The output fence resolves each path and compares against three places | `:238-247`. verified |
| PostCSS looks for a config file and runs what it lists | the reason the build passes `css: { postcss: {} }`, `:290`. verified |
| A page may hold no PostCSS or Tailwind config file, and no `@plugin` or `@config` | `stylesheetProblems`, `:121`. verified |
| The syntax checks stayed for the error message | the comment at `:118`. verified |
| The build runs in a child process with a ninety second limit and a `RESULT` line | `buildGate`, `page-gate.ts:300`, `BUILD_LIMIT_MS`, and the `RESULT` protocol. verified |
| A build inside the host would look like a frozen host | the module header of `page-build-child.ts`. verified |
| One page build takes about one and a quarter seconds | the reviewer timed twelve runs with and without the recorder, median about 1.25 s each. measured |

## ipc_teach to cli_skip

| Claim | Source |
|---|---|
| The host asks Electron main over the IPC channel, with a number per question | `mainRenderCheck`, `deepwidgets/mcp/src/index.ts:336`, and the `checkId` match at `:323`. verified |
| The check gets its own host name, `widget-check` | `RENDER_CHECK_HOST`, `deepwidgets-render-check.ts:17`. verified |
| It serves only the build under check and refuses a path outside the slug folder | `handle` with `pageFile(..., true)`, and `deepwidgets-page-path.ts:25`. verified |
| The page channel is faked from the test run: program, call, stream | the `api` method, `:200-217`. verified |
| The test run now records each query answer | `testrun-child.ts`, the `result` field and its comment. verified |
| The window is three hundred twenty by three hundred, hidden, sandboxed | `:222-230`. verified |
| Navigation and new windows are refused | `:238-239`. verified |
| One check runs at a time | the `queue` of `DesktopRenderCheck`, `:161`. verified |
| The old limit started only after the load, so a looping page held the queue and every later check failed at forty-five seconds | the round one finding. The reviewer reproduced it: a looping page gave `load-failed` at 45000 ms. measured |
| One deadline of fifteen seconds now holds load and judge | `CHECK_LIMIT_MS` and the `Promise.race`, `:244-251`. verified |
| On the deadline the check crashes the renderer and destroys the window | the `finally`, `:260`. verified |
| A shadow root keeps page styles out, but inherited and custom properties pass in | web platform behaviour. The probe depends on it. verified by the probe design, not measured |
| The probe builds two hidden boxes and compares six boxes and their properties | `probeScript`, `:102-144`. verified |
| Every compared property is one that the block itself sets | compare the `props` arrays with the six rules of the template block. verified |
| Three refusals and three warnings | `judge`, `:286-299`. verified |
| A CLI host has no Electron main, so the gate passes with a warning | `renderGate`, `page-gate.ts:349`. verified |

## rename_teach to sweep

| Claim | Source |
|---|---|
| A rename either happened or did not | `rename(2)`. The research recorded the guarantee from the manual page. verified |
| The crash record already uses write then rename | the deepWidgets video, `claimer`, 30:48. verified |
| The first version deleted the old page and copied the new one, after the code was live | the round one finding on `creation.ts:530-538`. verified |
| Vite now builds into `page-<hash>.tmp` and one rename drops the suffix | `runPageGates`, `page-gate.ts:375-396`. verified |
| A failed gate removes the folder and leaves the current page | the `finally` of `runPageGates`. verified |
| The link swaps after the install applies, through a temporary name and a rename | `linkPage`, `creation.ts:564`. verified |
| Each slug keeps three builds | `PAGE_BUILDS_KEPT`, and `prunePages`. verified |
| A reinstall of the same sources reuses the build | the `reused` branch, `page-gate.ts:390`. verified |
| Each build is about three hundred sixty to eight hundred kilobytes | the widget kit spike measured 352 KB to 796 KB per widget page. measured |
| A reinstall with no page removes the link and keeps the builds | `linkPage` with no build, and the check at `widgets-create.mjs:637`. verified |
| The host start removes the staging folder, every `.tmp` build, and every temporary link | `sweepPages`, `creation.ts:527`, as the first job of the queue. verified |
| The serving code refuses a `.tmp` name | `pageFile` with `allowTmp` false, `deepwidgets-page-path.ts:39`. verified |

## example_setup to example_loop

| Claim | Source |
|---|---|
| The fixture slug is `create-page` and its library uses a zod schema | `widgets-create.mjs:540` and the check at `:566`. verified |
| Page render passed in six hundred forty-eight milliseconds | the implementer's run. measured |
| The built index page names the base path of the slug | the check at `:570`. verified |
| The `new URL` line is refused at page build | the refusal case at `widgets-create.mjs:608`. verified |
| Page files and page types pass for that page | inferred: no fixed file changed and `new URL` is valid TypeScript with no import. |
| The old bundle and link stay with no leftover folder | the check at `:626`. verified |
| The loop fixture writes the document title, because the bundler removed a loop with no effect | the implementer reported it. measured |
| The loop case took eighteen seconds, and a good page passed right after at six hundred fifty-four milliseconds | the reviewer's run. measured |

## twelve_cases to closing

| Claim | Source |
|---|---|
| Twelve refusals, each with its gate | the `refused` table, `widgets-create.mjs:598`, plus the symbolic link case at `:622`. verified |
| Three mutants, each failing its check | the implementer and the reviewer ran them. measured |
| The four bypasses stay refused with the syntax checks off | the reviewer repeated the scratch mutant. measured |
| The config exemption lets a page embed such a file under four kilobytes, or read one of any size in a worker | the reviewer reproduced both. measured |
| A test worker pulled in a charting library of seven hundred twenty kilobytes | the reviewer's run. measured |
| The allowed set reached one thousand one hundred fifty-two folders, three hundred thirteen of them workspace packages | the reviewer counted. measured |
| A scan found no secret files in them | the reviewer scanned by name. measured |
| The fix for the first two is about two lines | the reviewer wrote and ran it in a scratch build. measured |
| `library.serving` is the next unit | `docs/specs/agent-library.md`, `agent_library.later`. verified |
| Nothing serves the built page yet | `agent_library.build_gate.not`. verified |

## To check again before the recording

- The timestamps of the earlier videos in `glossary.md` and in the narration. They come from the part order of `parts.json` and the per-scene `durations.json`. The part sums match the real part files within 0.11 seconds. The within-part order is the order of `parts.json`, which is the render order. Confirm two of them against a frame.
- The claim that the probe is sound because each compared property is one the block sets. A research agent inferred that a shadow-root copy inherits `color` and `font-family` from its host, which would weaken the claim.
- The line "the host waits forty-five seconds" is a comment in the render check, not the host code. Confirm it against `index.ts`.
