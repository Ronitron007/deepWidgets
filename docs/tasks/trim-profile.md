# Task `trim.profile`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `trim.profile.goal`

Add the deepWidgets trim layer. This layer turns off each Cordis row that the app does not need. The spec sections are `fork_trim.method` and `fork_trim.keep_list` in `docs/specs/fork-trim.md`. The plan row is `trim.profile` in `docs/plans/fork-trim.md`. This file replaces the version that the first build round used. That round stopped, because the start screen needed the row `llm`. The unit `trim.startup` (`docs/tasks/trim-startup.md`) removes that need. Start this unit only after `trim.startup` merges.

| Term | Meaning |
|---|---|
| row | One top-level entry in the composed Cordis config of the `host` Context. Each row has an `id`. |
| trim layer | The new bundle `@deepwidgets/trim`. Its `cordis.patch.yml` sets `disabled: true` on each row to turn off. |
| keep set | The rows that stay enabled. The start keep set has 38 rows (`trim.profile.steps.keep`). `trim.profile.steps.settle` can make it smaller. |
| creation row | A kept row that gives a service of `decisions.trim_creation` in `handoff-ts-trim.md`: the plugin install path, the inspect tools, credentials, or plugin state storage. |
| pending row | A kept host row in the Cordis state `pending`. It waits for a service of a row that is off, and its code does not run. |
| row lists | The committed files `deepwidgets/trim/rows.host.txt` and `deepwidgets/trim/rows.client.txt`. |
| rows check | A new step in the smoke check. It compares the rows that loaded in each Context with the row lists. |
| boot test | `DSH_SMOKE_PROBE=1 DSH_SMOKE_TRACE=1 DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs`. One app boot runs the probe test, the trace test, and the hello test of `trim.startup`. |
| `<spike>` | The folder `$TMPDIR/deepwidgets-prep-trim-creation/spike`. It holds the spike results of the architect. |

Operator decisions for this unit: the row `llm` stays off. The row `mcp-resources` stays on. The rows that only the DSH workspace screen uses go off. The trim keeps each creation row. A creation row that needs an agent row stays pending.

## Setup `trim.profile.setup`

| Item | Value |
|---|---|
| Base | `origin/main`, after the merge of `trim.startup`. It must contain `0197f3297670c082d7af8e5f49043c8e14f8cd57`. |
| Branch | `rohan/trim-profile-v2`. It exists only in the local repository, at `0197f329`. The side branch `rohan/trim-profile-v2-wip` keeps the work of the first build round. It stays local. |
| Worktree | `~/deepWidgets/.worktrees/rohan-trim-profile-v2`. It holds the work of the first build round, not committed. |
| Temporary files | `$TMPDIR/deepwidgets-trim-profile-v2/` |
| Machine | this Mac, with a display. The smoke check opens app windows. |

Do not use `git stash` (`handoff2.rules`). Commit the work of the first round to the side branch:

```bash
cd ~/deepWidgets/.worktrees/rohan-trim-profile-v2
git rev-parse --abbrev-ref HEAD                                   # rohan/trim-profile-v2
git rev-parse --short=8 HEAD                                      # 0197f329
git status --short                                                # read the output: the work of the first round
git rev-parse --verify --quiet refs/heads/rohan/trim-profile-v2-wip ; echo "wip exit=$?"   # wip exit=1
git switch -c rohan/trim-profile-v2-wip ; echo "switch exit=$?"   # switch exit=0
git add -A
git commit -m "trim.profile build round 1, local only" ; echo "wip commit exit=$?"   # wip commit exit=0
git switch rohan/trim-profile-v2 ; echo "back exit=$?"            # back exit=0
git status --short | wc -l | tr -d ' '                            # 0
git fetch origin
git merge-base --is-ancestor 0197f329 origin/main ; echo "base exit=$?"   # base exit=0
git diff --name-only 0197f329 origin/main                         # read the output
git merge --ff-only origin/main ; echo "merge exit=$?"            # merge exit=0
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ; echo "head exit=$?"   # head exit=0
git grep -c deepwidgets-trim -- apps/desktop/src/main.ts          # apps/desktop/src/main.ts:1
mkdir -p "$TMPDIR/deepwidgets-trim-profile-v2/logs"
```

- If a command does not give the output in its comment, stop. The last `git grep` proves that `trim.startup` merged.
- If the first `git status` lists a path that is not in `trim.profile.files`, stop before the commit and report the list.
- If `git commit` exits 128 because it cannot find `git-sign-nostr`, run `PATH="$(dirname "$(git config --get nostr.keyfile)"):$PATH" git commit -m "trim.profile build round 1, local only"`. If it fails again, stop.
- If the `diff` command prints a path that is not under `docs/` and not in `trim.startup.files` of `docs/tasks/trim-startup.md`, stop and report the list.
- Do not push, merge, or delete the side branch. The operator decides what happens to it.
- Do not use, read, or change the worktree `.worktrees/rohan-trim-profile` or the branch `rohan/trim-profile`.

## Read first `trim.profile.read`

Read `packages/bundle/web-app/cordis.patch.yml`, `packages/util/official-bundles/src/bundles.ts`, `tools/smoke-desktop.mjs`, and `deepwidgets/trace/index.js`. The architect checked each fact below at `0197f329` with the changes of `trim.startup`, by code reading or by a spike. If a fact is false, stop and report.

| Fact | Evidence |
|---|---|
| The layer order of the host rows is `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, `@deepwidgets/probe`, `@deepwidgets/trace`, the profile layer, the home layer, and the `--patch` overlays. | `bundles.ts` lines 14-18. The `# ==` headings in the dump of `trim.profile.steps.partition`. |
| A patch entry `- id: <row id>` with only `disabled: true` keeps the `name` and the config of the row. An entry with an unknown id writes `dsh: [@deepwidgets/trim] patch: entry "<id>" not found` and does not stop the boot. | `packages/bundle/web-app/cordis.patch.yml`. Spike. |
| The dump composes 197 rows. With the trim layer and the start keep set, it still composes 197 rows and writes no `not found` line. The dump reads the `web` template from the built `@deepseek-ai/dsh-official-bundles`. Thus a change to `bundles.ts` needs `build:artifacts`. The app reads `cordis.patch.yml` from the workspace at each boot. | Spike: `$TMPDIR/deepwidgets-prep-trim-creation/part/composed.yml` and `dump.err`. |
| The client row `@deepseek-ai/dsh-client-locale` calls `__DSH_LOCALE__.read()`. Electron main answers it with `settings/describe`. | `packages/client/locale/src/client/index.ts` line 573. `apps/desktop/src/main.ts` lines 793-800. |
| The renderer root always renders the scope `session-maybe`. That scope needs the adapter of `ui-session`. | `packages/client/ui-renderer/src/client/scoped-slots.tsx` line 1324. Console line `scope 'session-maybe' rendered without an installed adapter` in the log of `<spike>/run5.out`. |
| The host row `modules` gives the client rows, in `window.__DSH_BOOT__.entries`. A pending host row with a client half also gives a client row. The renderer shows the UI only after each client row is active. | `packages/client/modules/src/index.ts` line 1035. `packages/client/web/src/boot-client.ts` lines 51-87. Spike: 19 client rows. |
| The client half of `cordis-client-runner` becomes active while `cordis-host-runner` is pending. Its console writes `syncInspectManifest ... HTTP 404`. This is not a failure. | Spike `<spike>/run2.out` and its desktop log. |
| The trace host row injects `webServer`, `connection`, and `loader`. With `DEEPWIDGETS_TRACE=off`, the row is off, `GET /api/trace` answers 404, and the trace window closes. `waitForRenderer` takes only the page `dsh-app://app/`, not `dsh-app://app/trace`. | `deepwidgets/trace/index.js` line 7. `trace.window.check` in `docs/tasks/trace-window.md`. `tools/smoke-desktop.mjs` line 379. |
| The tests `apps/cli/tests/profile-mcp.spec.ts` and `apps/desktop/tests/profile-mcp.spec.ts` need the row `mcp-resources` on. | Spike of the architect for `0197f329`. |
| The boot test passes with the start keep set. The procedure of `trim.profile.steps.host_rows` gives 198 Loader entries, with the root entry. 30 kept host rows are active and 8 are pending. The client has 19 rows. | `<spike>/final-profile-boot.out`: `smoke-desktop: pass`. `<spike>/run6.json`. |

Look Before You Build: the architect searched the repository and npm. The route `GET /api/trace` keeps the missing services of the last state change of a row (`vendor/cordis/src/fiber.ts` lines 579-586). It also answers 404 in the off run. The npm package `chrome-remote-interface` adds a dependency to a script that uses only Node built-in modules. Thus the rows check uses the host inspector. No tool in the repository turns rows off in a loop. Thus `trim.profile.steps.settle` uses a short script. Write this in one line of the PR body.

## Steps `trim.profile.steps`

### Keep set `trim.profile.steps.keep`

Start with these 38 rows enabled. Turn off each other row. To ablate a row means to turn the row off and run the boot test. Ablate only the rows with `yes`, in `trim.profile.steps.settle`.

| Row ids | Why they stay on at the start | Ablate |
|---|---|---|
| `deepwidgets-probe`, `deepwidgets-trace` | the probe test and the trace test (`loop.task` in `handoff-ts-trim.md`) | no |
| `mcp-resources` | the two `profile-mcp.spec.ts` tests (operator decision) | no |
| `settings`, `config-editor`, `settings-controller` | the start: the locale read. Off: `<spike>/ablate-settings.out`, `<spike>/ablate-config-editor.out`, `<spike>/run8.out` | no |
| `web-startup`, `web-runtime` | Off: `host timeout` in `<spike>/ablate-web-startup.out` and `<spike>/run7.out` | no |
| `typert`, `ui-settings`, `file-upload` | Off: `probe text: missing` in `<spike>/ablate-typert.out`, `ablate-ui-settings.out`, `ablate-file-upload.out` | no |
| `plugin-manager`, `credentials`, `storage`, `storage-json`, `storage-domain`, `cordis-host-runner`, `cordis-inspect-providers`, `cordis-client-runner`, `preset-cordis`, `preset-standard`, `preset-ptc` | widget creation may reuse it (`decisions.trim_creation`) | no |
| `timer`, `hmr`, `webserver`, `client-hmr`, `modules`, `connection`, `ui-layout` | a first guess (`fork_trim.keep_list`). No spike turned it off. | yes |
| `session-controller`, `ui-session`, `remote-access`, `typert-gateway`, `api-remotes`, `ui-renderer`, `ui-theme`, `locale`, `shortcuts` | a first guess: a kept row injects a service of it. No spike turned it off alone. | yes |

The creation rows come from `prep.trim.creation`. The skill `packages/preset/agent-preset/skills/cordis-plugin-development/SKILL.md` names the services.

| Row | Package | Gives | Injects | With the agent rows off |
|---|---|---|---|---|
| `plugin-manager` | `@deepseek-ai/dsh-plugin-manager` | `pluginManager`, the work under the tool `plugin_manager` | `loader`, `profileContext` | active |
| `credentials` | `@deepseek-ai/dsh-credentials-local` | `credentials` | none | active |
| `storage`, `storage-json`, `storage-domain` | `@deepseek-ai/dsh-storage`, `-storage-json`, `-storage-domain` | `storage`, the `json` backend, `storageDomain` | `storage` | active |
| `cordis-host-runner` | `@deepseek-ai/dsh-cordis-host-runner` | `dynamicCordisRunner`, `cordisInspect` | `tools` (row `tools`, off) | pending |
| `cordis-inspect-providers` | `@deepseek-ai/dsh-tool-cordis/host` | the host inspect providers | `cordisInspect`, `tools` | pending |
| `cordis-client-runner` | `@deepseek-ai/dsh-cordis-client-runner` | the client inspect providers (`Slots`, `Theme`) | host half: none | active |
| `preset-cordis` | `@deepseek-ai/dsh-agent-preset` | the agent tools `cordis_inspect_*` and `plugin_manager` | `agentPresets` (row `agent-preset-registry`, off) | pending |
| `preset-standard`, `preset-ptc` | `@deepseek-ai/dsh-agent-preset` | the agent tool `plugin_manager` | `agentPresets` | pending |

Evidence: `packages/boot/plugin-manager/src/index.ts` lines 287-333, `packages/extensions/cordis-host-runner/src/index.ts` lines 141-162, `packages/extensions/tool-cordis/src/host.ts` line 7, `packages/extensions/cordis-client-runner/src/index.ts`, `packages/preset/agent-preset/src/index.ts` line 13, and `packages/bundle/web-app/presets/cordis.patch.yml` lines 119-131. The host row `tool-plugin-manager` is off in DSH already (`packages/bundle/web-app/cordis.patch.yml` line 483). Its patch entry gets the reason `DSH turns it off. The presets give the tool to agents (decisions.trim_creation).`

### Add the trim bundle `trim.profile.steps.bundle`

Make the folder `deepwidgets/trim/`. Write `deepwidgets/trim/package.json` with this text:

```json
{
  "name": "@deepwidgets/trim",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { "./cordis.patch.yml": "./cordis.patch.yml", "./package.json": "./package.json" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
}
```

### Write the patch file `trim.profile.steps.patch_file`

Write `deepwidgets/trim/cordis.patch.yml`. Start it with these comment lines:

```yaml
# deepWidgets trim layer. It applies after dsh-base, dsh-web-app, @deepwidgets/probe, and @deepwidgets/trace.
# Each entry turns off one DSH row. The row and its package stay in the tree.
# Spec: fork_trim.method in docs/specs/fork-trim.md.
```

Then add one entry for each of the 159 rows that are not in the start keep set. This includes rows that DSH already disables. Write each entry as exactly these three lines, with a blank line between entries:

```yaml
# deepwidgets-trim: <reason>
- id: <row id>
  disabled: true
```

- Group the entries by area, with one comment heading per area.
- The areas are `cordis-boot`, `host-web-transport`, `client-ui`, `api-controllers`, `session-storage-workspace`, `sandbox-shell-fs`, `telemetry-account-credentials`, `agent-llm-tools`, and `settle`. Put the heading of the area `settle` last, with no entry under it. The script of `trim.profile.steps.settle` adds its entries at the end of the file.
- Give each entry a short reason, for example `agent plane, out of scope (fork_trim.out_of_scope)`. Use `DSH workspace screen` for a client UI row of the workspace screen.
- You can write a script in the temporary folder to make the first draft. Do not commit the script.

### Register the package `trim.profile.steps.register`

1. In `apps/cli/package.json`, add `"@deepwidgets/trim": "workspace:*",` to `dependencies`. Put it directly after the line `"@deepwidgets/trace": "workspace:*",`. Change nothing else in that file.

2. In `packages/util/official-bundles/src/bundles.ts`, change the `web` entry to this text. Keep the commented DSH line. Keep one marker in the file.

   ```ts
     web: {
       // deepwidgets-trim: probe.round_trip, trace.host, and trim.profile add the @deepwidgets bundles to the web profile.
       // bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
       bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepwidgets/probe', '@deepwidgets/trace', '@deepwidgets/trim'],
     },
   ```

### Install and build `trim.profile.steps.install`

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack pnpm --version                                                # 11.28.5
corepack pnpm install ; echo "install exit=$?"                         # install exit=0
git diff --numstat pnpm-lock.yaml | tr '\t' ' '                        # 5 0 pnpm-lock.yaml
corepack pnpm install --frozen-lockfile ; echo "frozen exit=$?"        # frozen exit=0
ls apps/desktop/node_modules/electron/dist > /dev/null ; echo "electron exit=$?"   # read the exit code
corepack pnpm run build:artifacts ; echo "artifacts exit=$?"                                           # artifacts exit=0
corepack pnpm --filter @deepseek-ai/dsh-desktop run build ; echo "desktop exit=$?"                      # desktop exit=0
corepack pnpm --filter @deepseek-ai/dsh-desktop run prepare:primary-runtime ; echo "runtime exit=$?"   # runtime exit=0
```

- If the `numstat` line is not `5 0 pnpm-lock.yaml`, stop and report the lockfile diff.
- If `electron exit` is not 0, run `node apps/desktop/node_modules/electron/install.js` once, before the build. Record that you used this fallback. Then run the Git hook checks of `fork.baseline.steps.install` again. Each check must give its expected output.
- Record the time of each command. A later change to the patch file or to the row lists needs no new build.

### Add the rows check to the smoke check `trim.profile.steps.rows_check`

Change `tools/smoke-desktop.mjs`. Use only Node built-in modules. Do not add a dependency. Without `DSH_SMOKE_ROWS`, the script must behave as before. Add this line directly after the line that calls `checkHello`:

```js
      if (failed === undefined && (process.env.DSH_SMOKE_ROWS ?? '') !== '') failed = await checkRows(page, deadline)
```

Thus the rows check runs last, after each earlier step that runs has passed. Write `checkRows` and its helpers to these rules:

| Part | Rule |
|---|---|
| Row lists | `DSH_SMOKE_ROWS` is the path of a folder with `rows.host.txt` and `rows.client.txt`. In each line, ignore the text after `#`, and ignore blank lines. |
| Host rows | Read them over the host inspector on `hostInspectPort` (`trim.profile.steps.host_rows`). The `evaluate` helper sends only one message. Add one small helper on the built-in `WebSocket` that sends several messages on one socket, with the deadline behavior of `evaluate`. |
| Client rows | Use `evaluate` on `page`, the main window, not the trace window. Evaluate `JSON.stringify((window.__DSH_BOOT__?.entries ?? []).map((entry) => entry.id))`. If the list has no entry, read it again after 250 ms, until the deadline. |
| Compare | Compare the client keys with `rows.client.txt` as sets. Compare the host items with the expected host items of `rows.host.txt` as sets (`trim.profile.steps.host_state`). |
| Result | When a pair of sets is not equal, the result is `smoke-desktop: fail: host rows: extra <items>, missing <items>`. Use `client rows` for the client list, and `none` for an empty part. A host row in the wrong state shows in both parts. |
| Log | Write both live lists to the log file with `note`. |
| `DSH_SMOKE_ROWS_SAVE` | When it has a value, write the host snapshot to that file as JSON. The host snapshot is the array that the last CDP call of `trim.profile.steps.host_rows` returns. |
| `DSH_SMOKE_ROWS_SNAPSHOT` | When it has a value, do not start the app. Put this branch before the line that makes `temp` with `mkdtemp`. Make the host items from the snapshot in that file, and compare them with `rows.host.txt`. Print the result line with `console.log`. Exit 0 on pass and 1 on fail. Do not check the client rows. |
| Header comment | Add one sentence about each of `DSH_SMOKE_ROWS`, `DSH_SMOKE_ROWS_SAVE`, and `DSH_SMOKE_ROWS_SNAPSHOT`. |

### Read the host rows `trim.profile.steps.host_rows`

The host has no route that lists its rows. Do not add one. Send these Chrome DevTools Protocol (CDP) calls in this order on one socket. If a call fails, stop and report the call and its error.

| Call | What to do |
|---|---|
| `GET http://127.0.0.1:<hostInspectPort>/json/list` | Open the `webSocketDebuggerUrl` of the first target. |
| `Runtime.evaluate` | Use the expression `Function.prototype`. Keep the `objectId` of the result. |
| `Runtime.queryObjects` | Use that `objectId` as `prototypeObjectId`. |
| `Runtime.callFunctionOn` | On the result, keep only the functions with the name `Loader` that have the prototype methods `showLog` and `locate`. Exactly one function must stay. |
| `Runtime.queryObjects` | Use the prototype of that function. Exactly one Loader instance must come back. |
| `Runtime.callFunctionOn` | Use `returnByValue: true`. Return an array with one object for each entry `e` of `loader.entries()`. |

The fields are `id` (`e.id`), `optionsId` (`e.options.id`), `name` (`e.options.name`), `disabled` (`e.disabled`), and `state` (`e.fiber?.state ?? null`). The field `missing` is `Object.keys(e.fiber.inject).filter((service) => e.fiber.ctx.get(service) === undefined).sort()` when `state` is `0`, else `[]`. This is the expression of `inactiveEntries` in `packages/boot/app-boot/src/index.ts`.

Then make the host items from that array. Skip the root entry, with the `id` `include` and the `name` `cordis:include`. Skip each entry where `disabled` is `true`. When `id` starts with `include:`, the key is `optionsId`. Else the key is `name:<name>`, for a row that a plugin makes at run time. Make the host item from the key and the state (`trim.profile.steps.host_state`).

If an enabled entry has the state `1` or `5`, read the host rows again after 500 ms. If an entry still has one of these states at the smoke deadline, the result is `smoke-desktop: fail: host rows: not settled <items>`.

### Host states `trim.profile.steps.host_state`

Cordis gives each fiber one state (`vendor/cordis/src/fiber.ts`). The host item is `<key>=<word>`. The word is `pending(<services>)` for the state `0`, `loading` for `1`, `active` for `2`, `failed` for `3`, `disposed` for `4`, `unloading` for `5`, and `nofiber` for `null`. The state `null` means that the import of the row failed. For `1` and `5`, the rows check reads the host rows again (`trim.profile.steps.host_rows`).

A kept row may have only the word `active`, or `pending(<services>)` on a pending line of `rows.host.txt`. The host only writes a warning when an optional row fails. Thus the rows check must fail on each other word, even when the probe test passes.

In `pending(<services>)`, `<services>` is the `missing` array, joined with commas and no spaces. Each line of `rows.host.txt` has one of these two forms. Another form gives the result `smoke-desktop: fail: rows list: bad line <line>`.

- `<key>`. The expected host item is `<key>=active`.
- `<key> pending <services>`, with the services in sort order, joined with commas and no spaces. The expected host item is `<key>=pending(<services>)`.

### Write the start row lists `trim.profile.steps.lists`

1. Write `deepwidgets/trim/rows.host.txt` with one line for each of the 38 rows of the start keep set, and a reason after `#`. Use these eight pending lines. Each other line is the row id alone.

   ```text
   mcp-resources pending tools   # tools: row tools, off
   session-controller pending agentDefaultModel,agents,attachments,fileUploads,fs,llm,sessionProjections,sessionQuery,sessions,workspaceRegistry   # agent rows off. fileUploads: file-upload, pending
   file-upload pending agents,attachments,commands   # agent rows off
   cordis-host-runner pending tools   # creation row. tools: row tools, off
   cordis-inspect-providers pending cordisInspect,tools   # creation row. cordisInspect: cordis-host-runner, pending on tools
   preset-cordis pending agentPresets   # creation row. agentPresets: row agent-preset-registry, off
   preset-standard pending agentPresets   # creation row. agentPresets: row agent-preset-registry, off
   preset-ptc pending agentPresets   # creation row. agentPresets: row agent-preset-registry, off
   ```

2. Write `deepwidgets/trim/rows.client.txt` with one package name on each line. The 19 names are `@deepwidgets/probe`, `@deepwidgets/trace`, and these names with the prefix `@deepseek-ai/dsh-`: `api-gateway`, `client-hmr`, `client-modules`, `cordis-client-runner`, `client-ui-theme`, `client-locale`, `client-shortcuts`, `client-ui-layout`, `client-ui-renderer`, `client-ui-session`, `client-ui-settings`, `api-remote-access`, `client-file-upload`, `api-remotes`, `typert-registry`, `client-connection`, and `api-session-controller`.

Start each file with a comment line that tells what the file holds. A missing service must come from a row that is off, or from a kept pending row. The reason names the row that is off at the end of that chain.

### Settle the keep set `trim.profile.steps.settle`

Write this script to `$TMPDIR/deepwidgets-trim-profile-v2/ablate.sh`. Do not commit it. It turns off one row and removes the row from the row lists. Then it runs the boot test with the rows check. When the run fails, it puts back the three files. It writes one line to the ablation log `$TMPDIR/deepwidgets-trim-profile-v2/ablate-results.tsv`.

```bash
#!/usr/bin/env bash
# Usage, from the worktree root: bash "$TMPDIR/deepwidgets-trim-profile-v2/ablate.sh" <row id> <client name without @deepseek-ai/dsh-, or ->
set -u
row=$1 client=$2 T=$TMPDIR/deepwidgets-trim-profile-v2 D=deepwidgets/trim
mkdir -p "$T/ablate/$row" && cp "$D/cordis.patch.yml" "$D/rows.host.txt" "$D/rows.client.txt" "$T/ablate/$row/"
drop() { awk -v k="$1" '{ split($0, a, "#"); n = split(a[1], f, " "); if (n > 0 && f[1] == k) next; print }' "$2" > "$2.tmp" && mv "$2.tmp" "$2"; }
printf '\n# deepwidgets-trim: not needed: the boot test passes without it\n- id: %s\n  disabled: true\n' "$row" >> "$D/cordis.patch.yml"
drop "$row" "$D/rows.host.txt"
if [ "$client" != "-" ]; then drop "@deepseek-ai/dsh-$client" "$D/rows.client.txt"; fi
DSH_SMOKE_PROBE=1 DSH_SMOKE_TRACE=1 DSH_SMOKE_HELLO=1 DSH_SMOKE_ROWS="$D" DSH_SMOKE_TIMEOUT_MS=120000 node tools/smoke-desktop.mjs > "$T/ablate/$row/boot.out" 2>&1 ; code=$?
log=$(ls -td "$TMPDIR"/deepwidgets-smoke-desktop-* | head -1) ; action=off
if [ "$code" -ne 0 ]; then action=on; cp "$T/ablate/$row/cordis.patch.yml" "$T/ablate/$row/rows.host.txt" "$T/ablate/$row/rows.client.txt" "$D/"; fi
printf '%s\t%s\t%s\t%s\t%s\n' "$row" "$code" "$(grep '^smoke-desktop:' "$T/ablate/$row/boot.out" | tail -1)" "$action" "$log" | tee -a "$T/ablate-results.tsv"
```

1. Run the boot test with the start keep set and the rows check: `DSH_SMOKE_PROBE=1 DSH_SMOKE_TRACE=1 DSH_SMOKE_HELLO=1 DSH_SMOKE_ROWS=deepwidgets/trim DSH_SMOKE_TIMEOUT_MS=120000 node tools/smoke-desktop.mjs ; echo "start exit=$?"`. It must print `smoke-desktop: pass` and `start exit=0`. If it fails, stop and report the result line and the renderer console lines of the log. Do not turn on a row to fix it.

2. Run `bash -n "$TMPDIR/deepwidgets-trim-profile-v2/ablate.sh" ; echo "syntax exit=$?"`. It must print `syntax exit=0`.

3. Set `A=$TMPDIR/deepwidgets-trim-profile-v2/ablate.sh`. Run `bash "$A" <row> <client>` once for each pair below, one pair at a time, in this order. The run of a pair that fails takes about two minutes. The pairs are `ui-layout client-ui-layout`, `ui-session client-ui-session`, `session-controller api-session-controller`, `ui-theme client-ui-theme`, `locale client-locale`, `shortcuts client-shortcuts`, `ui-renderer client-ui-renderer`, `api-remotes api-remotes`, `typert-gateway api-gateway`, `remote-access api-remote-access`, `client-hmr client-hmr`, `hmr -`, `timer -`, `connection client-connection`, `modules client-modules`, and `webserver -`.

4. Read each line that the script prints. The columns are the row, the exit code, the result line, the action, and the smoke log folder. With the exit code 0, the row stays off. With another exit code, the row stays on. After the last pair, `wc -l < "$TMPDIR/deepwidgets-trim-profile-v2/ablate-results.tsv" | tr -d ' '` must print `16`. Then run the command of item 1 again. It must print `smoke-desktop: pass`.

In this order, a row comes before the rows that give its services, where the architect knows them. For example, `ui-layout` injects `slots`, `theme`, `locale`, and `shortcuts`. Thus a row that gives a service can go off after each row that uses it went off. The rows check makes a round fail when a kept row changes its state, for example to `pending`. The agent, LLM providers, MCP, and the plugin manager stay out of scope (`fork_trim.out_of_scope`). That rule does not apply to the creation rows and `mcp-resources` (`loop.task` in `handoff-ts-trim.md`). They stay on.

### Check the partition `trim.profile.steps.partition`

Each composed row must be in exactly one place: the patch file or `rows.host.txt`. Run these commands:

```bash
W=$(git rev-parse --show-toplevel) ; T=$TMPDIR/deepwidgets-trim-profile-v2 ; mkdir -p "$T/home"
( cd "$T/home" && DSH_HOME="$T/home" node "$W/apps/cli/lib/bin.js" --profile web --dump-default-config ) > "$T/composed.yml" 2> "$T/dump.err" ; echo "dump exit=$?"   # dump exit=0
grep -c "not found" "$T/dump.err"                                                  # 0
grep -E '^- id: ' "$T/composed.yml" | sed 's/^- id: //' | sort > "$T/all.txt"
grep -E '^- id: ' deepwidgets/trim/cordis.patch.yml | sed 's/^- id: //' | sort > "$T/off.txt"
sed 's/#.*//' deepwidgets/trim/rows.host.txt | awk 'NF { print $1 }' | grep -v '^name:' | sort > "$T/on.txt"
wc -l < "$T/all.txt" | tr -d ' '                                                   # 197
wc -l < "$T/off.txt" | tr -d ' '                                                   # 159 plus the count of off lines in ablate-results.tsv
comm -12 "$T/off.txt" "$T/on.txt" | wc -l | tr -d ' '                              # 0
sort "$T/off.txt" "$T/on.txt" | diff - "$T/all.txt" ; echo "partition exit=$?"     # partition exit=0
awk '/^- id: /{ if (prev !~ /^# deepwidgets-trim: /) bad++ } { prev = $0 } END { print bad + 0 }' deepwidgets/trim/cordis.patch.yml   # 0
```

The last command proves that each patch entry has its marker comment on the line above it.

### Fill in `CLAUDE.md` `trim.profile.steps.head`

Change only these parts of the root `CLAUDE.md`.

| Part | Change |
|---|---|
| `head.commands` | Add `DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim node tools/smoke-desktop.mjs` directly after the line `DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs`. |
| `head.status`, header | If the date is not the output of `date +%F`, change it to that output. |
| `head.status`, row `Rows that deepWidgets turns off` | Make the second cell `` `deepwidgets/trim/cordis.patch.yml` turns off <n> of the 197 rows. Some kept rows stay pending, because the agent rows are off. ``. `<n>` is the output of `wc -l < "$T/off.txt" \| tr -d ' '`. |
| `head.status`, row `Our packages` | Change `` `deepwidgets/trim` (planned) `` to `` `deepwidgets/trim` (merged) ``. |
| `head.status`, row `Checks` | After the sentence about `DSH_SMOKE_HELLO=1`, add `` With `DSH_SMOKE_ROWS=<folder>`, it also compares the loaded rows with the row lists in that folder. `` |

Then `git diff --numstat -- CLAUDE.md | tr '\t' ' '` must print `5 4 CLAUDE.md` when the header changed, or `4 3 CLAUDE.md` when it did not. If it prints another line, stop and report it.

## Run the checks `trim.profile.check`

Run each command from the worktree root, one at a time. Each comment gives the expected output and exit code. Each off run takes about five minutes, because the test tries again until its deadline.

```bash
T=$TMPDIR/deepwidgets-trim-profile-v2
DSH_SMOKE_PROBE=1 DSH_SMOKE_TRACE=1 DSH_SMOKE_HELLO=1 DSH_SMOKE_ROWS=deepwidgets/trim DSH_SMOKE_ROWS_SAVE="$T/host-rows.json" node tools/smoke-desktop.mjs ; echo "rows exit=$?"   # smoke-desktop: pass, rows exit=0
mkdir -p "$T/minus-one" && cp deepwidgets/trim/rows.client.txt "$T/minus-one/"
grep -vE '^[[:space:]]*(#|$)' deepwidgets/trim/rows.host.txt | sed '$d' > "$T/minus-one/rows.host.txt"
DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS="$T/minus-one" node tools/smoke-desktop.mjs ; echo "rows minus one exit=$?"   # smoke-desktop: fail: host rows: ..., rows minus one exit=1
DSH_SMOKE_ROWS=deepwidgets/trim DSH_SMOKE_ROWS_SNAPSHOT="$T/host-rows.json" node tools/smoke-desktop.mjs ; echo "snapshot exit=$?"   # smoke-desktop: pass, snapshot exit=0
node -e 'const fs = require("node:fs"); const rows = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); const kept = rows.filter((r) => r.name !== "cordis:include" && r.disabled !== true); const row = kept.find((r) => r.state === 0) ?? kept.find((r) => r.state === 2); row.state = 3; row.missing = []; console.log(JSON.stringify(rows))' "$T/host-rows.json" > "$T/host-rows.failed.json"
DSH_SMOKE_ROWS=deepwidgets/trim DSH_SMOKE_ROWS_SNAPSHOT="$T/host-rows.failed.json" node tools/smoke-desktop.mjs ; echo "failed snapshot exit=$?"   # smoke-desktop: fail: host rows: ..., failed snapshot exit=1
DSH_SMOKE_TRACE=1 DEEPWIDGETS_TRACE=off node tools/smoke-desktop.mjs ; echo "trace off exit=$?"   # smoke-desktop: fail: trace: status 404, trace off exit=1
grep -c "deepwidgets-trace: GET /trace answered 404" "$(ls -td "$TMPDIR"/deepwidgets-smoke-desktop-* | head -1)/desktop.log"   # 1
DSH_SMOKE_PROBE=1 DEEPWIDGETS_PROBE=off node tools/smoke-desktop.mjs ; echo "probe off exit=$?"   # smoke-desktop: fail: probe text: missing, probe off exit=1
node tools/smoke-desktop.mjs ; echo "smoke exit=$?"                                     # smoke-desktop: pass, smoke exit=0
DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs ; echo "probe exit=$?"                   # smoke-desktop: pass, probe exit=0
DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs ; echo "trace exit=$?"                   # smoke-desktop: pass, trace exit=0
DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs ; echo "hello exit=$?"                   # smoke-desktop: pass, hello exit=0
DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim node tools/smoke-desktop.mjs ; echo "head rows exit=$?"   # smoke-desktop: pass, head rows exit=0
DSH_SMOKE_TIMEOUT_MS=1000 node tools/smoke-desktop.mjs ; echo "short exit=$?"           # smoke-desktop: fail: ..., short exit=1
node tools/trace-late-row.mjs ; echo "late row exit=$?"                                 # trace-late-row: pass, late row exit=0
node tools/trace-client-rows.mjs ; echo "client rows exit=$?"                           # trace-client-rows: pass, client rows exit=0
corepack pnpm exec vitest run apps/cli/tests apps/desktop/tests packages/util/official-bundles/tests packages/boot/app-boot/tests scripts/optional-bundles.spec.ts scripts/local-bundle-registry.spec.ts scripts/release/families.spec.ts packages/boot/plugin-manager/tests/bundle-detail.spec.ts packages/boot/plugin-manager/tests/manager.spec.ts packages/experimental/webworker-packer/tests/profile-image.spec.ts packages/experimental/inspector/tests/workspace-prefetch.host.spec.ts ; echo "bundle tests exit=$?"   # see the table below
git grep -c deepwidgets-trim -- packages/util/official-bundles/src/bundles.ts            # packages/util/official-bundles/src/bundles.ts:1
```

The `bundle tests` line runs each test file that imports `bundles.ts`, `apps/cli/package.json`, or the `web` template. It must give the same result as at the base. If another test fails, stop and report the test name and its error. Do not fix the four files that fail at the base.

| Output | Expected at the base and at the head |
|---|---|
| `Test Files` line | `4 failed \| 196 passed \| 6 skipped (206)` |
| `Tests` line | `7 failed \| 7910 passed \| 61 skipped (7978)` |
| exit code | `bundle tests exit=1` |
| Files that fail | `official-bundles.spec.ts`, `optional-bundles.spec.ts`, `workspace-prefetch.host.spec.ts`, `desktop-publish-local-preflight.spec.ts` |

The runs `rows minus one`, `failed snapshot`, `trace off`, and `probe off` must fail on purpose. `rows minus one` has one host line fewer than the live host rows. The `node -e` command changes the first pending row to failed, or the first active row when no row has the state `0`. Thus the state is part of the comparison. The `grep -c` count `1`, directly after the trace off run, proves that the trace window closed.

Also run the commands in `trim.profile.steps.partition`. The install and build lines of `head.commands` ran in `trim.profile.steps.install`. The line `corepack pnpm run start:desktop` is not a check, because it runs the app until you quit it. If a check does not give its expected result, use `tasks.protocol.stop`.

## Run report `trim.profile.run_report`

The reviewer reviews each run result before the lead uses it. Thus write one run report for each run step: `trim.profile.steps.install`, each item of `trim.profile.steps.settle`, `trim.profile.steps.partition`, and `trim.profile.check`. Keep the output of each command in a file in `$TMPDIR/deepwidgets-trim-profile-v2/logs/`. For example, run `<command> > "$T/logs/<name>.log" 2>&1 ; echo "<name> exit=$?"`, and then read the log. Write the reports to `$TMPDIR/deepwidgets-trim-profile-v2/run-report.md`.

| Item | Value |
|---|---|
| Worktree and commit | The absolute path of the worktree, and the output of `git rev-parse --abbrev-ref HEAD` and `git rev-parse HEAD`. |
| Uncommitted diff | The output of `git status --short` and `git diff --stat`. |
| Commands | Each command as you ran it, with its exit code and its log file. After each app run, also the smoke log folder: `ls -td "$TMPDIR"/deepwidgets-smoke-desktop-* \| head -1`. |
| Conclusion | One sentence: what the run proves, or why it failed. |

Post the run report as one PR comment, directly after the PR opens. When you stop, write the report of each run step that you ran. Give its path in your report to the lead.

## Findings to record `trim.profile.findings`

Put these items in the `Findings` section of the PR body. Write "unknown" when you did not find out.

- The time of the install and of each build command, and whether you used the Electron fallback.
- The final counts: rows off, host rows kept, host rows kept but pending, and client rows.
- Each line of `ablate-results.tsv`.
- Each pending host row, with its missing services and the row that is off for each service.
- The host rows read time, and the limit that the `web` template reaches only new profiles.
- Each case of `handoff2.reviewer.failure_cases` that the change can cause.

## Files you may change `trim.profile.files`

Change only these files, and only the parts that the steps name:

- `deepwidgets/trim/package.json`, `cordis.patch.yml`, `rows.host.txt`, and `rows.client.txt` (all new)
- `apps/cli/package.json` and `packages/util/official-bundles/src/bundles.ts` (`trim.profile.steps.register`)
- `pnpm-lock.yaml` (only the five lines of `trim.profile.steps.install`)
- `tools/smoke-desktop.mjs` (`trim.profile.steps.rows_check` and `trim.profile.steps.host_rows`)
- `CLAUDE.md` (only the lines of `trim.profile.steps.head`)
- No file in `deepwidgets/probe/` or `deepwidgets/trace/`

After the build, `git status --short` must show only these paths. If build outputs show up as untracked files, stop and report them. Do not add them to `.gitignore`.

## Done when `trim.profile.done`

- Each check command gives its expected output.
- `git status --short` shows only the paths in `trim.profile.files`.
- The PR is open against `main`. Its title is `trim.profile: turn off the rows the app does not need`. The run report is a PR comment.
