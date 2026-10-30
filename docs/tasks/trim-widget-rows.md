# Task `trim.widget_rows`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `trim.widget_rows.goal`

Turn the Cordis rows `hmr` and `timer` on again, and add a live install check. The design is `fork_trim.widget_rows.design` in `docs/specs/fork-trim.md`. The plan row is `trim.widget_rows` in `docs/plans/fork-trim.md`. The handoff is `handoff3` in `docs/handoffs/trim-widget-rows.md`. The unit is complete when each item of `fork_trim.widget_rows.proof` has a good record. The points in `fork_trim.widget_rows.open` stay out of this task.

| Term | Meaning |
|---|---|
| install check | `DSH_SMOKE_INSTALL=<absolute fixture folder> node tools/smoke-desktop.mjs`. It boots the app and calls `pluginManager.installBundle` on the host `Loader`. It passes only when the result is `applied` and the fixture plugin runs. |
| fixture | The bundle in `deepwidgets/trim/fixtures/widget-rows-install`. Its plugin gives the service `widgetRowsInstallMarker` with the value `ran`. |
| off run | The install check with the `hmr` entry turned off again. It must fail with `restart-required` and `no-hmr`. |
| spike | The spike of this unit at `f4fa60ef`. Its records are in `~/.buzz/RESEARCH/DEEPWIDGETS_TRIM_WIDGET_ROWS_SPIKE_20261029/`. Its review is `REVIEW.md` and `REREVIEW.md` in `~/.buzz/RESEARCH/DEEPWIDGETS_TRIM_WIDGET_ROWS_RUN_REVIEW_20261029/`. |
| record | One line `<name> exit=<code> <last log line>` in `$L/exits.txt`. The shell function `rec` writes it. |

## Check form `trim.widget_rows.check_form`

This task decides `fork_trim.widget_rows.open.check_form`. The install check uses form A of the spike:

- `tools/smoke-desktop.mjs` gets the flag `DSH_SMOKE_INSTALL`. The new function `withHostLoader` holds the `Loader` lookup of `readHostSnapshot`. The new function `checkInstall` uses it to call `installBundle` over the host inspector.

- The fixture lives in the trim package, in `deepwidgets/trim/fixtures/widget-rows-install`. It has the files `package.json`, `cordis.patch.yml`, and `index.js`. Its patch inserts the row `deepwidgets-widget-rows-install`.

- Give the fixture folder as an absolute path. The plugin manager resolves a relative path from the smoke temporary folder. Thus the spike discarded its relative-path run.

- The flag `DSH_SMOKE_INSTALL_EXPECT=restart-required` comes with the spike code. No check of this task uses it.

## Setup `trim.widget_rows.setup`

| Item | Value |
|---|---|
| Base | `origin/main`. It must contain `8319ffe3e094d831c5ffaa37950feae806b82d4c`. After that commit, only files under `docs/` can change. |
| Branch | `rohan/trim-widget-rows` (new) |
| Worktree | `~/deepWidgets/.worktrees/rohan-trim-widget-rows` |
| Temporary files | `$TMPDIR/deepwidgets-trim-widget-rows/`, with the logs in its folder `logs/` |
| Machine | this Mac, with a display. The smoke runs open app windows. Run one smoke run on the machine at a time. |

At the start of `trim.widget_rows.part.base`, run this block once. It writes the file `env.sh`. The function `rec <name> <command>` runs the command and writes its output to `$L/<name>.log`. It also adds the command to `$L/commands.txt` and the record to `$L/exits.txt`.

```bash
mkdir -p "$TMPDIR/deepwidgets-trim-widget-rows/logs" && cat > "$TMPDIR/deepwidgets-trim-widget-rows/env.sh" <<'EOF'
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 BASE=8319ffe3e094d831c5ffaa37950feae806b82d4c R="$HOME/deepWidgets"
export W="$R/.worktrees/rohan-trim-widget-rows" T="$TMPDIR/deepwidgets-trim-widget-rows" L="$TMPDIR/deepwidgets-trim-widget-rows/logs"
rec() { n=$1; shift; printf '%s: %s\n' "$n" "$*" >> "$L/commands.txt"; "$@" > "$L/$n.log" 2>&1; c=$?; echo "$n exit=$c $(tail -n 1 "$L/$n.log")" | tee -a "$L/exits.txt"; }
if [ -d "$W" ]; then cd "$W"; fi
EOF
```

Start each new shell with `. "$TMPDIR/deepwidgets-trim-widget-rows/env.sh"`. Run each command from the worktree root, one at a time. If a record is different and the task gives no other action, use `tasks.protocol.stop`.

The comment after a command gives its expected record. When the comment has no text after `exit=<code>`, each last log line is correct. A word in angle brackets stands for the value that it names, and `<empty>` is an empty log. A comment that starts with `if` gives a condition. Run that command only when the condition is true.

## Read first `trim.widget_rows.read`

Read `fork_trim.widget_rows` in the spec, `handoff3.decisions`, and `handoff3.stop`. Read `readHostSnapshot` in `tools/smoke-desktop.mjs`. The architect checked each fact below. If a fact is false, stop and report.

| Fact | Evidence |
|---|---|
| The `files` script of `trim.widget_rows.steps.files` writes the six files of the spike, byte for byte. On a copy of the base, `git diff` then gives the spike patch, sha256 `b24b58f89d92f554d89c475fc839d2327857fb858b805b1d3efb6152cc6152a8`. | verified (ran the script, `shasum -c`, and `git diff`) |
| The spike base `f4fa60ef` differs from `8319ffe3` only in the `ts.lint` files and `docs/`. The spike patch applies to `8319ffe3`. | verified (ran `git diff --name-only` and `git apply --check`) |
| The plugin manager returns `applied` only when the service `hmr` exists. Otherwise it returns `restart-required` with `no-hmr`. | verified (read `packages/boot/plugin-manager/src/index.ts` line 1221) |
| The base row `timer` has no condition. The base row `hmr` loads only when `profileContext` exists, with `root: []`. | verified (read `packages/bundle/base/cordis.patch.yml` lines 24-32) |
| The app reads the trim patch at each boot. Thus the off run needs no new build. | verified (spike `logs/commands.txt`: no build between the off edit and the off run) |
| The workspace glob `deepwidgets/*` has one level. Thus the fixture is not a workspace package, and `pnpm-lock.yaml` does not change. | verified (read `pnpm-workspace.yaml`). The architect inferred the lockfile part. |
| No test imports `tools/smoke-desktop.mjs` or `rows.host.txt`. The trim patch gets to tests only through the `web` template in `packages/util/official-bundles/src/bundles.ts`. Thus the test list is the `bundle tests` list of `trim.profile.check`. | verified (ran `git grep`). The architect inferred the list choice. |

Look Before You Build: the spike searched the repository (`SEARCH.md` in the spike folder). Form A reuses the `Loader` lookup of `tools/smoke-desktop.mjs` and the `installBundle` method of the host. It adds no package. Write this in one line of the PR body.

## Parts `trim.widget_rows.parts`

Run one part in one wake, and start it at the start of the wake. The spike times come from `logs/exits.txt` of the spike. The spike did not run `pnpm install`, the builds, or the tests. Thus their times are a guess.

| Part | Blocks | Time |
|---|---|---|
| `trim.widget_rows.part.base` | `trim.widget_rows.setup`, `trim.widget_rows.steps.base` | a guess: 5 min |
| `trim.widget_rows.part.change` | `trim.widget_rows.steps.files` to `trim.widget_rows.check.build` | a guess: 5 min |
| `trim.widget_rows.part.checks` | `trim.widget_rows.check.install` to `trim.widget_rows.check.pass` | 6.5 min (seven smoke runs, 376 s in the spike). A smoke run that fails adds about 4 min. |
| `trim.widget_rows.part.pr` | `trim.widget_rows.done` | a guess: 2 min |

The first and the last record of each part are `<part>_start` and `<part>_end`. If a wake stops in a part, run that part again in the next wake. In `trim.widget_rows.part.checks`, run each command again from the start of the part. In the other parts, run each command that has no record. Skip a command when its `if` condition is false.

## Steps `trim.widget_rows.steps`

### Base state `trim.widget_rows.steps.base`

```bash
rec base_start date -u +%T
rec fetch git -C "$R" fetch origin                                                       # fetch exit=0
rec base git -C "$R" merge-base --is-ancestor "$BASE" origin/main                        # base exit=0
rec docs_only sh -c 'git -C "$R" diff --name-only "$BASE" origin/main | grep -cv "^docs/"'   # docs_only exit=1 0
rec branch git -C "$R" rev-parse --verify --quiet refs/heads/rohan/trim-widget-rows      # branch exit=1
rec remote git -C "$R" ls-remote --exit-code --heads origin rohan/trim-widget-rows       # remote exit=2
rec worktree git -C "$R" worktree add -b rohan/trim-widget-rows .worktrees/rohan-trim-widget-rows origin/main   # worktree exit=0 HEAD is now at <sha> <subject>
cd "$W"
rec node node --version                                                                  # node exit=0 v22.23.0
rec pnpm corepack pnpm --version                                                         # pnpm exit=0 11.28.5
rec base_install corepack pnpm install --frozen-lockfile                                 # base_install exit=0 Done in <time> using pnpm v11.28.5
rec electron ls apps/desktop/node_modules/electron/dist                                  # electron exit=<any>
rec electron_install node apps/desktop/node_modules/electron/install.js                  # if electron exit is not 0: electron_install exit=0
rec electron_again ls apps/desktop/node_modules/electron/dist                            # if electron exit is not 0: electron_again exit=0
rec base_artifacts corepack pnpm run build:artifacts                                     # base_artifacts exit=0 build: recorded 358 client artifact(s) with 2 public value(s)
rec base_tests corepack pnpm exec vitest run apps/cli/tests apps/desktop/tests packages/util/official-bundles/tests packages/boot/app-boot/tests scripts/optional-bundles.spec.ts scripts/local-bundle-registry.spec.ts scripts/release/families.spec.ts packages/boot/plugin-manager/tests/bundle-detail.spec.ts packages/boot/plugin-manager/tests/manager.spec.ts packages/experimental/webworker-packer/tests/profile-image.spec.ts packages/experimental/inspector/tests/workspace-prefetch.host.spec.ts --reporter=default --reporter=json --outputFile.json="$T/base-tests.json"   # base_tests exit=<any>
rec base_names python3 -I -c 'import json, sys; r = json.load(open(sys.argv[1])); open(sys.argv[2], "w").write("".join(line + "\n" for line in sorted(a["status"] + " " + f["name"] + " > " + a["fullName"] for f in r["testResults"] for a in f["assertionResults"])))' "$T/base-tests.json" "$T/base-tests.txt"   # base_names exit=0
rec base_passed grep -c '^passed ' "$T/base-tests.txt"                                   # base_passed exit=0 <count>
rec base_end date -u +%T
```

The records `base` and `docs_only` stop the task on a wrong base. If one of them is different, stop and report. Do not branch from another commit.

The spike did not run this block. The expected lines of `node`, `pnpm`, `base_install`, `electron`, and `base_artifacts` come from `ts.trace.steps.base`. The lines `electron_install` and `electron_again` are the Electron fallback of that step. If a fallback record is different, stop. For `node`, write the version under `Findings`. Write the `base_tests` exit and the `base_passed` count under `Findings`. If the count is `0`, stop and report the last 40 lines of `$L/base_tests.log`.

### Write the files `trim.widget_rows.steps.files`

Start `trim.widget_rows.part.change` here. The `files` script changes three files and writes the three fixture files. Each `edit` replaces one text that occurs exactly once, and each new text is literal. The script follows `fork_trim.widget_rows.design`:

- It comments out the entries `id: hmr` and `id: timer` at the end of `deepwidgets/trim/cordis.patch.yml`, with the marker line `# deepwidgets-trim: on again for the widget system (fork_trim.widget_rows)`. It deletes no entry. It adds no config, so the DSH base config stays.

- It adds `hmr` and `timer` to `deepwidgets/trim/rows.host.txt` as active rows, after `plugin-manager`, with the reason `on again (fork_trim.widget_rows)`.

- It adds the install check of `trim.widget_rows.check_form` to `tools/smoke-desktop.mjs`, and it writes the fixture.

The rows `client-hmr`, `tools`, `system-prompt`, and `tool-plugin-manager` stay off (`handoff3.decisions.scope`). The task uses the plugin manager only to prove the install (`fork_trim.out_of_scope`).

```bash
rec change_start date -u +%T
rec files python3 -I - <<'EOF'                                                           # files exit=0
import pathlib
def edit(name, pairs):  # each old text occurs exactly once
    path = pathlib.Path(name); s = path.read_text()
    for old, new in pairs:
        assert s.count(old) == 1, old
        s = s.replace(old, new)
    path.write_text(s)
OFF = '# deepwidgets-trim: not needed: the boot test passes without it\n- id: {}\n  disabled: true\n'
edit('deepwidgets/trim/cordis.patch.yml', [(OFF.format('hmr') + '\n' + OFF.format('timer'),
     '# deepwidgets-trim: on again for the widget system (fork_trim.widget_rows)\n'
     '# - id: hmr\n#   disabled: true\n# - id: timer\n#   disabled: true\n')])
KEEP = 'plugin-manager   # start keep set\n'
edit('deepwidgets/trim/rows.host.txt', [(KEEP, KEEP + 'hmr   # on again (fork_trim.widget_rows)\ntimer   # on again (fork_trim.widget_rows)\n')])
SNAP = ' * With DSH_SMOKE_ROWS_SNAPSHOT set to a path, compare that host snapshot with rows.host.txt and do not start the app.\n'
ROWS = "      if (failed === undefined && (process.env.DSH_SMOKE_ROWS ?? '') !== '') failed = await checkRows(page, deadline)\n"
LOADER = "    if (typeof loaderId !== 'string') throw new Error('Runtime.queryObjects: no Loader objectId')\n"
edit('tools/smoke-desktop.mjs', [
    (SNAP, SNAP + ' * With DSH_SMOKE_INSTALL set to a local bundle path, also call pluginManager.installBundle over the host Loader.\n'
     ' * With DSH_SMOKE_INSTALL_EXPECT=restart-required, the install must return restart-required with restartReason no-hmr.\n'),
    (ROWS, ROWS + "      if (failed === undefined && (process.env.DSH_SMOKE_INSTALL ?? '') !== '') failed = await checkInstall(deadline)\n"),
    ('async function readHostSnapshot(deadline) {\n  let targets\n', 'async function withHostLoader(deadline, run) {\n  let targets\n'),
    (LOADER, LOADER + '''    return await run(session, loaderId)
  } finally {
    session.close()
  }
}

async function readHostSnapshot(deadline) {
  return withHostLoader(deadline, async (session, loaderId) => {
'''),
    ('    return rows.result.value\n  } finally {\n    session.close()\n  }\n}\n', '''    return rows.result.value
  })
}

async function checkInstall(deadline) {
  const fixture = process.env.DSH_SMOKE_INSTALL ?? ''
  if (fixture === '') return 'install: empty DSH_SMOKE_INSTALL'
  if (!existsSync(fixture)) return `install: missing fixture ${fixture}`
  const expect = process.env.DSH_SMOKE_INSTALL_EXPECT ?? 'applied'
  const spec = fixture.startsWith('file:') || fixture.includes(':') ? fixture : `file:${fixture}`
  const started = Date.now()
  const result = await withHostLoader(deadline, async (session, loaderId) => {
    const call = await cdpCall(session, 'Runtime.callFunctionOn', {
      objectId: loaderId,
      awaitPromise: true,
      returnByValue: true,
      arguments: [{ value: spec }],
      functionDeclaration: `async function (spec) {
        if (this.length !== 1) throw new Error("Loader instances " + this.length);
        const loader = this[0];
        const manager = loader.ctx?.get?.("pluginManager") ?? loader.ctx?.pluginManager;
        if (manager === undefined || typeof manager.installBundle !== "function") {
          throw new Error("no pluginManager on Loader ctx");
        }
        const install = await manager.installBundle(spec);
        const marker = loader.ctx?.get?.("widgetRowsInstallMarker");
        return { install, marker: marker === undefined ? null : marker };
      }`,
    })
    if (call?.exceptionDetails) {
      const text = call.exceptionDetails.exception?.description
        ?? call.exceptionDetails.text
        ?? 'install call failed'
      throw new Error(String(text))
    }
    return call?.result?.value
  })
  note(`install ms=${String(Date.now() - started)} result=${JSON.stringify(result)}`)
  const install = result?.install
  if (install === undefined || typeof install !== 'object' || install === null) {
    return `install: bad result ${JSON.stringify(result)}`
  }
  if (expect === 'restart-required') {
    if (install.application !== 'restart-required') {
      return `install: want restart-required got ${JSON.stringify(install)}`
    }
    if (install.restartReason !== 'no-hmr') {
      return `install: want restartReason no-hmr got ${JSON.stringify(install)}`
    }
    return undefined
  }
  if (install.application !== 'applied') {
    return `install: want applied got ${JSON.stringify(install)}`
  }
  if (result.marker !== 'ran') {
    return `install: plugin did not run marker=${JSON.stringify(result.marker)}`
  }
  return undefined
}
'''),
])
fix = pathlib.Path('deepwidgets/trim/fixtures/widget-rows-install')
fix.mkdir(parents=True)
(fix / 'cordis.patch.yml').write_text('- insert:\n    - id: deepwidgets-widget-rows-install\n      name: deepwidgets-widget-rows-install\n')
(fix / 'index.js').write_text('''/** Spike fixture: proves a live install applied and the plugin ran. */
export function apply(ctx) {
  ctx.provide('widgetRowsInstallMarker', 'ran')
}
''')
(fix / 'package.json').write_text('''{
  "name": "deepwidgets-widget-rows-install",
  "version": "1.0.0",
  "type": "module",
  "exports": "./index.js",
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
''')
EOF
rec sums tee "$T/widget-rows.sha256" <<'EOF'                                             # sums exit=0 814154b5f387fa15d89b94f7e282bdb324df2264e7b2e368ed4aeb9a674d973d  tools/smoke-desktop.mjs
72b21b6167ca877996c41de4e61db900bdbc8311c2fc5b6edab7b79eb00db69f  deepwidgets/trim/fixtures/widget-rows-install/cordis.patch.yml
734a059b4c9b5034ca6506be7ca24ec5519c3545d04fa05f608a79ed792ff531  deepwidgets/trim/fixtures/widget-rows-install/index.js
171a72db7ee31b3523f4a6f9e101b945bfab974b4b6e0b1d55d3f25493934af4  deepwidgets/trim/fixtures/widget-rows-install/package.json
cd2eebf7cefcdd9b610de08dbec55ee69c97911e644dd2b2105e566d0cf109cd  deepwidgets/trim/cordis.patch.yml
59d1a1ba01f2778fc3d7e2878d02e5d4a8bfc37eab8eb06c929c0d806c3f36df  deepwidgets/trim/rows.host.txt
814154b5f387fa15d89b94f7e282bdb324df2264e7b2e368ed4aeb9a674d973d  tools/smoke-desktop.mjs
EOF
rec hash shasum -a 256 -c "$T/widget-rows.sha256"                                        # hash exit=0 tools/smoke-desktop.mjs: OK
rec untracked_new sh -c 'git status --short --untracked-files=all | grep -c "^??"'       # untracked_new exit=0 3
```

If `files` exit is not 0, the last line of `$L/files.log` names the edit that did not match. If `hash` exit is not 0, `$L/hash.log` names each bad file with `FAILED`. In each case, stop and report.

### Fill in `CLAUDE.md` `trim.widget_rows.steps.head`

The unit makes three `head.status` rows wrong or incomplete, and it adds a check (`head.rules`). The `head` script changes the date in the `head.status` header and the rows `Rows that deepWidgets turns off`, `Our packages`, and `Checks`. It adds the install check to `head.commands`. It changes nothing else.

```bash
rec head python3 -I - <<'EOF'                                                            # head exit=0
import datetime, pathlib
p = pathlib.Path('CLAUDE.md'); s = p.read_text()
HELLO = 'DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs\n'
ROWS = 'it also compares the loaded rows with the row lists in that folder.'
for old, new in (
    ('| Item | State on 2026-10-28 |', '| Item | State on ' + datetime.date.today().isoformat() + ' |'),
    ('turns off 162 of the 197 rows.', 'turns off 160 of the 197 rows. The rows `hmr` and `timer` are on again for the widget system (`fork_trim.widget_rows`).'),
    ('`deepwidgets/trim` (merged, no code).', '`deepwidgets/trim` (merged). It holds the trim patch, the row lists, and the test bundle `fixtures/widget-rows-install` of the install check.'),
    (ROWS, ROWS + ' With `DSH_SMOKE_INSTALL=<absolute bundle folder>`, it also installs that bundle into the running host. The bundle must apply at once, and its plugin must run.'),
    (HELLO, HELLO + 'DSH_SMOKE_INSTALL="$PWD/deepwidgets/trim/fixtures/widget-rows-install" node tools/smoke-desktop.mjs\n'),
):
    assert s.count(old) == 1, old
    s = s.replace(old, new)
p.write_text(s)
EOF
rec head_numstat sh -c 'git diff --numstat -- CLAUDE.md | tr "\t" " "'                   # head_numstat exit=0 5 4 CLAUDE.md
rec add git add CLAUDE.md deepwidgets/trim tools/smoke-desktop.mjs                       # add exit=0
rec paths sh -c 'git diff --cached --name-only | wc -l | tr -d " "'                      # paths exit=0 7
```

The `paths` record proves that the task changes only the seven files of `trim.widget_rows.files`. The records `hash` and `head_numstat` prove their content.

## Run the checks `trim.widget_rows.check`

### Build and tests `trim.widget_rows.check.build`

```bash
rec artifacts corepack pnpm run build:artifacts                                          # artifacts exit=0 build: recorded 358 client artifact(s) with 3 public value(s)
rec desktop corepack pnpm --filter @deepseek-ai/dsh-desktop run build                    # desktop exit=0 ✓ built in <time>
rec tests corepack pnpm exec vitest run apps/cli/tests apps/desktop/tests packages/util/official-bundles/tests packages/boot/app-boot/tests scripts/optional-bundles.spec.ts scripts/local-bundle-registry.spec.ts scripts/release/families.spec.ts packages/boot/plugin-manager/tests/bundle-detail.spec.ts packages/boot/plugin-manager/tests/manager.spec.ts packages/experimental/webworker-packer/tests/profile-image.spec.ts packages/experimental/inspector/tests/workspace-prefetch.host.spec.ts --reporter=default --reporter=json --outputFile.json="$T/tests.json" # tests exit=<the exit of base_tests>
rec names python3 -I -c 'import json, sys; r = json.load(open(sys.argv[1])); open(sys.argv[2], "w").write("".join(line + "\n" for line in sorted(a["status"] + " " + f["name"] + " > " + a["fullName"] for f in r["testResults"] for a in f["assertionResults"])))' "$T/tests.json" "$T/tests.txt" # names exit=0
rec lost sh -c 'grep "^passed " "$T/base-tests.txt" | LC_ALL=C sort > "$T/base-passed.txt"; grep "^passed " "$T/tests.txt" | LC_ALL=C sort > "$T/passed.txt"; LC_ALL=C comm -23 "$T/base-passed.txt" "$T/passed.txt" > "$T/lost-tests.txt"; wc -l < "$T/lost-tests.txt" | tr -d " "' # lost exit=0 0
rec untracked sh -c 'git status --short --untracked-files=all | grep -c "^??"'           # untracked exit=1 0
rec change_end date -u +%T
```

The spike did not run this block. The expected lines of `artifacts` and `desktop` come from `ts.lint.check.gates`. A worktree with changes gives 3 public values (`ts.trace.read`). The file `lost-tests.txt` lists each test that passed on the base and did not pass on the head. If `lost` is not `0`, stop, and report each test in that file with its failure text.

### Install check `trim.widget_rows.check.install`

Start `trim.widget_rows.part.checks` here. An earlier wake can stop in the off run. Thus the records `checks_reset` and `checks_clean` copy the trim patch back from the index.

```bash
rec checks_start date -u +%T
rec checks_idle pgrep -fl 'rohan-trim-widget-row[s]/.*Electron'                          # checks_idle exit=1
rec checks_reset git checkout -- deepwidgets/trim/cordis.patch.yml                       # checks_reset exit=0
rec checks_clean git diff --exit-code --stat                                             # checks_clean exit=0 <empty>
rec install env DSH_SMOKE_INSTALL="$PWD/deepwidgets/trim/fixtures/widget-rows-install" node tools/smoke-desktop.mjs # install exit=0 smoke-desktop: pass
rec install_folder sh -c 'ls -td "$TMPDIR"/deepwidgets-smoke-desktop-* | head -1'        # install_folder exit=0
rec install_note sh -c 'grep -c "\"application\":\"applied\".*\"marker\":\"ran\"}$" "$(ls -td "$TMPDIR"/deepwidgets-smoke-desktop-* | head -1)/desktop.log"' # install_note exit=0 1
```

`checks_idle` exits 1 when no app of this worktree runs. If it exits 0, stop and report. Do not stop a process. The record `install_note` reads the `install ms=` line of the smoke log. It proves that the result is `applied` and that the fixture plugin ran.

### Off run `trim.widget_rows.check.off`

The off run turns the `hmr` entry off again. `off_edit` uncomments only the two `hmr` lines, and the row `timer` stays on. The off run uses the same install command, with no `DSH_SMOKE_INSTALL_EXPECT`.

```bash
rec off_edit python3 -I -c 'import pathlib; p = pathlib.Path("deepwidgets/trim/cordis.patch.yml"); s = p.read_text(); old = "# - id: hmr\n#   disabled: true\n"; assert s.count(old) == 1, old; p.write_text(s.replace(old, "- id: hmr\n  disabled: true\n"))' # off_edit exit=0
rec off_numstat sh -c 'git diff --numstat -- deepwidgets/trim/cordis.patch.yml | tr "\t" " "' # off_numstat exit=0 2 2 deepwidgets/trim/cordis.patch.yml
rec install_off env DSH_SMOKE_INSTALL="$PWD/deepwidgets/trim/fixtures/widget-rows-install" node tools/smoke-desktop.mjs # install_off exit=1 smoke-desktop: fail: install: want applied got {<install result>}
rec off_reason sh -c 'tail -n 1 "$L/install_off.log" | grep -c "\"application\":\"restart-required\",\"restartReason\":\"no-hmr\""' # off_reason exit=0 1
rec off_restore git checkout -- deepwidgets/trim/cordis.patch.yml                        # off_restore exit=0
rec restore_hash shasum -a 256 -c "$T/widget-rows.sha256"                                # restore_hash exit=0 tools/smoke-desktop.mjs: OK
rec restore_clean git diff --exit-code --stat                                            # restore_clean exit=0 <empty>
```

If `install_off` exits 0, stop and report it, because the install check cannot fail. The record `off_restore` copies the staged trim patch back from the index. Do not commit the off state.

### Checks that must pass `trim.widget_rows.check.pass`

```bash
rec rows env DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim node tools/smoke-desktop.mjs # rows exit=0 smoke-desktop: pass
rec smoke node tools/smoke-desktop.mjs                                                   # smoke exit=0 smoke-desktop: pass
rec probe env DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs                             # probe exit=0 smoke-desktop: pass
rec trace env DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs                             # trace exit=0 smoke-desktop: pass
rec hello env DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs                             # hello exit=0 smoke-desktop: pass
rec late_row node tools/trace-late-row.mjs                                               # late_row exit=0 trace-late-row: pass
rec client_rows node tools/trace-client-rows.mjs                                         # client_rows exit=0 trace-client-rows: pass
rec untracked_end sh -c 'git status --short --untracked-files=all | grep -c "^??"'       # untracked_end exit=1 0
rec checks_end date -u +%T
```

Source of each expected line:

- The spike recorded `install`, `install_off`, `rows`, `smoke`, `probe`, `trace`, and `hello` with these lines. The patterns of `install_note` and `off_reason` match the spike logs.

- The spike did not run `late_row` and `client_rows`. Their lines come from `ts.trace.check.pass`.

- The spike did not run the records of the index, the edit, and the hash. The architect ran them on a copy of the base.

Stop at the first smoke run that fails. Report the last 40 lines of its log and the newest smoke folder. If a check with both rows on fails, use `handoff3.stop`. Do not turn off more rows. The install and build lines of `head.commands` ran in the earlier parts. The line `corepack pnpm run start:desktop` is not a check, because it runs the app until you quit it. The record `untracked_end` proves that the install wrote no file into the worktree.

## Findings to record `trim.widget_rows.findings`

Put these items in the `Findings` section of the PR body. Write "unknown" when you did not find out.

| Item | Source |
|---|---|
| Node version, and the use of the Electron fallback | the records `node` and `electron` |
| The time of each part | the `<part>_start` and `<part>_end` records |
| The `base_tests` exit, the `base_passed` count, and each base test that did not pass | `$L/exits.txt`, and `grep -v '^passed ' "$T/base-tests.txt"` |
| The install time and the smoke folder of the install check | the `install ms=` line in `desktop.log` of the folder of the record `install_folder` |
| One line for `tasks.protocol.look_before_you_build` | `trim.widget_rows.read` |

## Files you may change `trim.widget_rows.files`

| File | Part |
|---|---|
| `deepwidgets/trim/cordis.patch.yml` | only the `hmr` and `timer` entries at the end |
| `deepwidgets/trim/rows.host.txt` | only two new lines after `plugin-manager` |
| `deepwidgets/trim/fixtures/widget-rows-install/package.json`, `cordis.patch.yml`, `index.js` | new |
| `tools/smoke-desktop.mjs` | only two header lines, one line in the check chain, `withHostLoader`, `readHostSnapshot`, and `checkInstall` |
| `CLAUDE.md` | only the `head.status` header date, the `head.status` rows `Rows that deepWidgets turns off`, `Our packages`, and `Checks`, and one new line in `head.commands` |

The scripts of this task make each change. Do not change another file. This includes `deepwidgets/trim/rows.client.txt`, `deepwidgets/trim/package.json`, `deepwidgets/probe/`, `deepwidgets/trace/`, `packages/`, and `pnpm-lock.yaml`. Write each other change to `CLAUDE.md` under `Findings` (`head.rules`).

## Done when `trim.widget_rows.done`

Run `trim.widget_rows.part.pr` in a new wake, after the other parts.

```bash
rec pr_start date -u +%T
rec base_sha git rev-parse HEAD                                                          # base_sha exit=0 <full SHA of the worktree base>
rec staged sh -c 'git diff --cached --name-only | wc -l | tr -d " "'                     # staged exit=0 7
rec unstaged git diff --exit-code --stat                                                 # unstaged exit=0 <empty>
rec pr_end date -u +%T
```

Commit only when each record in `$L/exits.txt` agrees with its comment. Use the commit message `trim.widget_rows: turn hmr and timer on again, add the install check`. If `git commit` exits 128 because it cannot find `git-sign-nostr`, run `PATH="$(dirname "$(git config --get nostr.keyfile)"):$PATH" git commit` with the same message. Then push, and open the PR as `tasks.protocol.pull_request` says, with the same title. In its `Check` section, put the full `$L/commands.txt` and `$L/exits.txt`. In its `Base` section, put the SHA of the record `base_sha`.
