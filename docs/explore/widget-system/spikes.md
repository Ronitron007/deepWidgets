# Spikes of 2026-10-27 `spikes`

Each spike ran on the operator's Mac on the night of 2026-10-27. The spikes live in the session scratchpad and in two local branches. They are not in `main`. In the commands, `$S` is `/private/tmp/claude-501/-Users-rohanmalik-deepWidgets/eb10eeb1-4988-4412-b535-dd45a936ce19/scratchpad`.

| Name | Question | Result | Run it again |
|---|---|---|---|
| `spikes.runtime` | Does a widget runtime work in the real DSH host? | 21 of 21 checks, restart 8 of 8, bench exit 0 | In `.worktrees/rohan-playground-runtime/deepwidgets/widgets/test`: `WIDGETS_NOTES=$N/ node run.mjs 47921 $N/home-run`, with `N=$S/overnight/runtime` and a new home folder each time. Also `restart.mjs` and `bench.mjs`. Branch `rohan/playground-runtime`, commits `795cb5ac` and `4671cd69`. |
| `spikes.mcp` | Does an MCP server with `widget_*` tools, a token, and a browser guard work? | 46 of 46 checks, on the pinned SDK and on the latest SDK | `cd $S/overnight/mcp-server && npm install && npm run spike` (exit code = number of failures). `npm run spike:latest` for the latest SDK. |
| `spikes.creation` | Can an agent install, reload, replace, and remove a widget bundle with the DSH plugin manager? | 12 of 12 checks | `bash $S/overnight/creation/spike/run.sh`. Templates on branch `rohan/playground-creation`, commit `2a277b87`. |
| `spikes.shell` | Does the shell render OpenUI with a shadcn set in Electron through `dsh-app://`? | 19 of 19 scenarios | `cd $S/overnight/shell && OPENUI_TELEMETRY_DISABLED=1 node scripts/all.mjs` |
| `spikes.reliability` | What breaks, and how? | All Node spikes exit 0 | `node` on each file in `$S/overnight/reliability/spikes/`: `cordis-isolation.mjs`, `port-reuse.mjs`, `storage-durability.mjs`, `sse-timeouts.mjs`, `v8-compile.cjs` |
| `spikes.windows` | Window manager, memory, sizing, crash recovery, accessory app | 44 of 45 jobs, then the quit hang fixed (4 of 4) | `cd $S/overnight/windows && npm run spike` (about 8 minutes, windows show on the screen). One scenario: `npm run spike -- --scenario=crash --sse=direct`. |
| `spikes.integration` | Do the parts work together in the real DSH host: runtime, MCP, shell, and fault isolation? | Yes. Contract 31 of 31, Electron end to end 5 of 5, quarantine 14 of 14, old checks 21 of 21 and 8 of 8. Agent call to updated window: 18 to 19 ms at the median. | `sh .worktrees/rohan-playground-runtime/deepwidgets/widgets/test/all.sh <notes folder>` (exit 0 = all pass). Electron: `sh $S/overnight/integration/electron/run.sh 47976`. Branch `rohan/playground-runtime`, commits `f8e97bef`, `1b88217d`, `dd98e83b`. |
| `spikes.review` | An independent review of these documents | 4 blockers and 14 other findings, now in `options.md` and `challenges.md` | none (a review) |
| `spikes.query_refresh` | Can the shell make OpenUI run its queries again from outside? | Pass with the public `useTriggerAction` | `cd $S/spike-query-refresh && OPENUI_TELEMETRY_DISABLED=1 npm install && npm run spike` |
| `spikes.openui_interact` | Can one OpenUI Lang tool replace many tools? | Works, but a poor fit for writes | `cd $S/research-openui-interact && OPENUI_TELEMETRY_DISABLED=1 npm install && npm run spike` |

Each spike folder has a `NOTES.md` with the full findings, the sources, and the Look Before You Build record.

## Side effects `spikes.side_effects`

- The creation spike started the DSH host once without `--no-open`. Thus DSH tried once to open the default browser.

- After an Electron crash, later launches stopped at a macOS "reopen windows?" dialog. The dialog can still be on the screen. Later launches used `-ApplePersistenceIgnoreState YES`.

- Each installation of OpenUI packages used `OPENUI_TELEMETRY_DISABLED=1`.

- No spike called a paid API. The weather spikes called open-meteo.com, which needs no key.
