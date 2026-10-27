# Task `trim.startup`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `trim.startup.goal`

Make the desktop app open the main window at once, with no welcome window and no RPC to `llm`. Make the main window show only the text `hello` and the probe text. The trace window stays. The plan row is `trim.startup` in `docs/plans/fork-trim.md`. The method is `fork_trim.method` in `docs/specs/fork-trim.md`: comment out the old lines, with the marker `deepwidgets-trim`. This unit runs first. The unit `trim.profile` (`docs/tasks/trim-profile.md`) starts after this unit merges.

| Term | Meaning |
|---|---|
| hello test | A new step in the smoke check, `DSH_SMOKE_HELLO=1`. It reads the text `hello` in the main window and finds no welcome window. |
| boot test | `DSH_SMOKE_PROBE=1 DSH_SMOKE_TRACE=1 DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs`. One app boot runs the probe test, the trace test, and the hello test. |
| off run | The trace test with `DEEPWIDGETS_TRACE=off`, or the probe test with `DEEPWIDGETS_PROBE=off`. |

Operator decisions for this unit: the row `llm` will stay off after `trim.profile`. Thus the start must not call `llm`. The main window shows `hello`. The probe text and the trace window stay, because their tests need them. The parts that only the DSH workspace screen uses go off. This unit turns off the frame of the workspace screen. The unit `trim.profile` turns off the rows.

## Setup `trim.startup.setup`

| Item | Value |
|---|---|
| Base | `origin/main`, after the docs PR of this file. It must contain `0197f3297670c082d7af8e5f49043c8e14f8cd57`. |
| Branch | `rohan/trim-startup` |
| Worktree | `~/deepWidgets/.worktrees/rohan-trim-startup` |
| Temporary files | `$TMPDIR/deepwidgets-trim-startup/` |
| Machine | this Mac, with a display. The smoke check opens app windows. |

```bash
git -C ~/deepWidgets fetch origin
git -C ~/deepWidgets merge-base --is-ancestor 0197f329 origin/main ; echo "base exit=$?"                   # base exit=0
git -C ~/deepWidgets diff --name-only 0197f329 origin/main                                              # read the output
git -C ~/deepWidgets rev-parse --verify --quiet refs/heads/rohan/trim-startup ; echo "branch exit=$?"   # branch exit=1
git -C ~/deepWidgets worktree add -b rohan/trim-startup .worktrees/rohan-trim-startup origin/main ; echo "worktree exit=$?"   # worktree exit=0
cd ~/deepWidgets/.worktrees/rohan-trim-startup
git rev-parse --abbrev-ref HEAD                                                                         # rohan/trim-startup
mkdir -p "$TMPDIR/deepwidgets-trim-startup/logs"
```

- If a command does not give the output in its comment, stop.
- If the `diff` command prints a path that is not under `docs/`, stop and report the list.
- Do not use, read, or change the worktrees `.worktrees/rohan-trim-profile` and `.worktrees/rohan-trim-profile-v2`.

## Read first `trim.startup.read`

Read `apps/desktop/src/main.ts` lines 1160-1258, `apps/desktop/src/welcome-backend.ts`, `packages/client/ui-layout/src/client/index.ts`, and `tools/smoke-desktop.mjs`. The architect checked each fact below at `0197f329`, by code reading or by a spike. If a fact is false, stop and report.

| Fact | Evidence |
|---|---|
| At each start, `reconcileBackend` calls `openInitialWindow`. It calls `readWelcomeState`. The welcome `read` calls `settings/describe`, then `llm/listConfigurableProviders`, `credentials/describe`, and the account state. | `main.ts` lines 613 and 1244-1258. `welcome-backend.ts` lines 90-122. |
| With the row `llm` off, `POST /api/llm/listConfigurableProviders` answers 404, and the probe test fails. | The stop report of the first build round of `trim.profile`: `$TMPDIR/deepwidgets-handoff2/crusoe-stop-trim-profile.md`. |
| No switch skips the read. `needsWelcome` runs after the read. | `main.ts` line 1251. `apps/desktop/src/welcome-api.ts`. |
| The other callers of `readWelcomeState` run only on an account change, or for the onboarding of the workspace screen. The account callers catch the error. The handler of `DESKTOP_IPC.onboardingApiKey` sends the error back to the renderer that called it. | `main.ts` lines 506, 519, and 820-823. `apps/desktop/src/preload-app.ts` line 75. |
| `enterWorkspace` shows the main window. The trace window opens after `openInitialWindow`. | `main.ts` lines 614 and 1160-1181. |
| Only two test files import `main.ts`: `apps/desktop/tests/main-startup.spec.ts` and `apps/desktop/tests/welcome-startup.spec.ts`. With the change of `trim.startup.steps.startup` and no test change, three tests failed. | `git grep` for `src/main`. Spike. |
| The root slot of the client renders the component that `ui-layout` registers. `AppFrame` renders the slot `shell.overlay`, where the probe shows its text. | `packages/client/ui-layout/src/client/index.ts` lines 178-190. `deepwidgets/probe/client.js`. |
| A test that imports `@deepseek-ai/dsh-client-ui-layout/client` gets the built `lib/client.js`. Thus run the tests after the last `build:artifacts`. | `tsconfig.base.json` has a path only for the package root. Spike: the built file held `data-deepwidgets-hello`. |
| With the changes of this unit, the renderer pages are `dsh-app://app/trace` and `dsh-app://app/`. Without them, a page `welcome.html` also opens. | Spike. `tools/smoke-desktop.mjs` line 379 takes only `dsh-app://app/`. |

Look Before You Build: the architect searched the repository and npm. No switch skips the welcome read. No shipped row shows a text from config alone. No package fits a branch in Electron main or a one-line React text. Write this in one line of the PR body.

## Steps `trim.startup.steps`

### Install `trim.startup.steps.install`

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack pnpm --version                                                # 11.28.5
corepack pnpm install --frozen-lockfile ; echo "frozen exit=$?"        # frozen exit=0
ls apps/desktop/node_modules/electron/dist > /dev/null ; echo "electron exit=$?"   # read the exit code
```

- If `electron exit` is not 0, run `node apps/desktop/node_modules/electron/install.js` once. Record that you used this fallback.
- Then run the Git hook checks of `fork.baseline.steps.install` again. Each check must give its expected output.

### Open the main window at once `trim.startup.steps.startup`

1. In `apps/desktop/src/main.ts`, replace the body of `openInitialWindow` (lines 1245-1257) with these lines:

   ```ts
       if (quitting || recovery.active) return
       // deepwidgets-trim: trim.startup opens the main window at once. The welcome read calls llm, and the trim turns llm off.
       // const state = await readWelcomeState()
       // if (isQuitting() || backend.state.phase !== 'ready') return
       // locale = resolveDesktopStartupLocale(state.localePreference, systemLanguages)
       // windowsLanguage = locale.id
       // refreshApplicationMenu()
       // if (!enteredWorkspace && needsWelcome({ loggedIn: state.loggedIn, hasApiKey: state.hasApiKey })) {
       //   // A later login must retain its own activation policy instead of replaying startup focus.
       //   raiseAfterUpdate = false
       //   await showWelcome()
       // } else {
       //   await enterWorkspace()
       // }
       if (isQuitting() || backend.state.phase !== 'ready') return
       await enterWorkspace()
   ```

2. In `apps/desktop/tests/welcome-startup.spec.ts`, replace line 181 with these lines. The rest of the test stays.

   ```ts
   // deepwidgets-trim: trim.startup opens the main window at once. The start does not read the welcome state.
   // it.each([false, true])('starts welcome onboarding without carrying update focus into login or skip (Windows update=%s)', async (updated) => {
   it.skip.each([false, true])('starts welcome onboarding without carrying update focus into login or skip (Windows update=%s)', async (updated) => {
   ```

3. In `apps/desktop/tests/main-startup.spec.ts`, replace line 2457 with these lines:

   ```ts
     // deepwidgets-trim: trim.startup opens the main window at once. The start does not read the welcome state.
     // it('keeps recovery visible when the backend fails during the welcome preference read', async () => {
     it.skip('keeps recovery visible when the backend fails during the welcome preference read', async () => {
   ```

The three tests test the welcome read at the start, which this unit turns off. In the spike, the two files gave `Tests  133 passed | 3 skipped (136)` after steps 1, 2, and 3. At the base, they gave `Tests  136 passed (136)`.

### Add the hello test `trim.startup.steps.hello_test`

Change `tools/smoke-desktop.mjs`. Use only Node built-in modules. Without `DSH_SMOKE_HELLO`, the script must behave as before.

1. Add this line directly after the line that calls `checkTrace`:

   ```js
         if (failed === undefined && process.env.DSH_SMOKE_HELLO === '1') failed = await checkHello(page, deadline)
   ```

2. Add this function directly after the function `checkProbe`:

   ```js
   async function checkHello(page, deadline) {
     let text = ''
     while (Date.now() < deadline && text !== 'hello') {
       try {
         text = String(await evaluate(page.webSocketDebuggerUrl,
           "document.querySelector('[data-deepwidgets-hello]')?.textContent ?? ''", deadline) ?? '')
       } catch (error) {
         note(`hello evaluate error=${error instanceof Error ? error.message : 'unknown'}`)
       }
       if (text !== 'hello') await delay(250)
     }
     const targets = await (await fetch(`http://127.0.0.1:${String(rendererPort)}/json/list`)).json()
     const welcome = targets.map((target) => String(target?.url)).filter((url) => url.includes('welcome'))
     note(`hello text=${text || 'missing'} welcome=${welcome.join(',') || 'none'}`)
     if (text !== 'hello') return `hello text: ${text || 'missing'}`
     return welcome.length === 0 ? undefined : `hello: welcome window ${welcome.join(',')}`
   }
   ```

3. In the comment at the top of the script, add this line after the line about `DSH_SMOKE_TRACE=1`: ` * With DSH_SMOKE_HELLO=1, also check that the main window shows hello and that no welcome window opened.`

### Build and prove that the hello test can fail `trim.startup.steps.build`

```bash
corepack pnpm run build:artifacts ; echo "artifacts exit=$?"                                           # artifacts exit=0
corepack pnpm --filter @deepseek-ai/dsh-desktop run build ; echo "desktop exit=$?"                      # desktop exit=0
corepack pnpm --filter @deepseek-ai/dsh-desktop run prepare:primary-runtime ; echo "runtime exit=$?"   # runtime exit=0
DSH_SMOKE_HELLO=1 DSH_SMOKE_TIMEOUT_MS=120000 node tools/smoke-desktop.mjs ; echo "hello red exit=$?"   # smoke-desktop: fail: hello text: missing, hello red exit=1
```

Record the time of each command. The third command downloads the runtime of the app once. The last command must fail on purpose, because the main window does not show `hello` yet. If it passes, stop and report.

### Show hello in the main window `trim.startup.steps.hello`

Change `packages/client/ui-layout/src/client/index.ts` in three places. `AppFrame.tsx` stays without change. The new root component renders no sidebar, no main panel, no right column, no bottom row, and no session title. These are parts of the DSH workspace screen.

1. Replace the line `import { AppFrame } from './AppFrame.tsx'` with these lines:

   ```ts
   // deepwidgets-trim: trim.startup shows only hello and the shell.overlay seat. AppFrame needs ui-session, a part of the DSH workspace screen.
   // import { AppFrame } from './AppFrame.tsx'
   import { createElement } from 'react'
   import type { PropsRenderSlots } from '@deepseek-ai/dsh-client-ui-slots'
   import css from './AppFrame.module.css'
   ```

2. Add these lines directly before the line `/** Required services (cordis fiber inject — the loader passes all module exports as an object plugin). */`:

   ```ts
   /**
    * deepWidgets main window (trim.startup): the text hello and the shell.overlay seat that the probe uses.
    * @param props - the render share of the shell.overlay seat.
    * @returns the root content.
    */
   function HelloFrame({ renderSlot }: PropsRenderSlots<'shell.overlay'>) {
     return createElement('div', { className: css.frame },
       createElement('div', { 'data-deepwidgets-hello': '' }, 'hello'),
       createElement('div', { className: css.overlayLayer, 'data-shell-overlay': '' }, renderSlot('shell.overlay', {})))
   }

   ```

3. Replace the line `    }, AppFrame)` with these lines:

   ```ts
       // deepwidgets-trim: trim.startup registers HelloFrame in the root slot instead of AppFrame.
       // }, AppFrame)
       }, HelloFrame)
   ```

Then run `corepack pnpm run build:artifacts ; echo "artifacts exit=$?"`. It must print `artifacts exit=0`.

### Fill in `CLAUDE.md` `trim.startup.steps.head`

Change only these parts of the root `CLAUDE.md`.

| Part | Change |
|---|---|
| `head.commands` | Add `DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs` directly after the line `DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs`. |
| `head.status`, header | Change `State on 2026-10-24` to `State on <date>`. `<date>` is the output of `date +%F`. |
| `head.status`, new row after `Our packages` | `` \| Main window \| The app opens the main window at once, with no welcome window. The main window shows only `hello` and the probe text. \| `` |
| `head.status`, row `Checks` | After the sentence about `DSH_SMOKE_TRACE=1`, add `` With `DSH_SMOKE_HELLO=1`, it also runs the hello test. `` |

Then `git diff --numstat -- CLAUDE.md | tr '\t' ' '` must print `4 2 CLAUDE.md`. If it prints another line, stop and report it.

## Run the checks `trim.startup.check`

Run each command from the worktree root, one at a time. Each comment gives the expected output and exit code. Each off run takes about five minutes, because the test tries again until its deadline.

```bash
DSH_SMOKE_PROBE=1 DSH_SMOKE_TRACE=1 DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs ; echo "boot exit=$?"   # smoke-desktop: pass, boot exit=0
DSH_SMOKE_TRACE=1 DEEPWIDGETS_TRACE=off node tools/smoke-desktop.mjs ; echo "trace off exit=$?"   # smoke-desktop: fail: trace: status 404, trace off exit=1
grep -c "deepwidgets-trace: GET /trace answered 404" "$(ls -td "$TMPDIR"/deepwidgets-smoke-desktop-* | head -1)/desktop.log"   # 1
DSH_SMOKE_PROBE=1 DEEPWIDGETS_PROBE=off node tools/smoke-desktop.mjs ; echo "probe off exit=$?"   # smoke-desktop: fail: probe text: missing, probe off exit=1
node tools/smoke-desktop.mjs ; echo "smoke exit=$?"                                     # smoke-desktop: pass, smoke exit=0
DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs ; echo "probe exit=$?"                   # smoke-desktop: pass, probe exit=0
DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs ; echo "trace exit=$?"                   # smoke-desktop: pass, trace exit=0
DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs ; echo "hello exit=$?"                   # smoke-desktop: pass, hello exit=0
DSH_SMOKE_TIMEOUT_MS=1000 node tools/smoke-desktop.mjs ; echo "short exit=$?"           # smoke-desktop: fail: ..., short exit=1
node tools/trace-late-row.mjs ; echo "late row exit=$?"                                 # trace-late-row: pass, late row exit=0
node tools/trace-client-rows.mjs ; echo "client rows exit=$?"                           # trace-client-rows: pass, client rows exit=0
corepack pnpm exec vitest run apps/desktop/tests packages/client/ui-layout/tests packages/client/ui-open-in-app/tests/browser-plugin.client.spec.ts packages/client/ui-plugin-manager/tests/browser-plugin.client.spec.tsx packages/client/ui-sidebar-right/tests/seat.client.spec.tsx packages/client/ui-sidebar/tests/apply.client.spec.tsx packages/client/ui-sidebar/tests/panel-list.client.spec.tsx packages/client/ui-workspace/tests/shortcuts.client.spec.ts packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx packages/client/ui-workspace/tests/workspaces-service.client.spec.ts packages/test-support/client-runtime/tests/helpers.client.spec.tsx scripts/client-bundle-purity.spec.ts ; echo "tests exit=$?"   # see the table below
git grep -c deepwidgets-trim -- apps/desktop/src/main.ts apps/desktop/tests/welcome-startup.spec.ts apps/desktop/tests/main-startup.spec.ts packages/client/ui-layout/src/client/index.ts   # see the table below
```

The `tests` line runs the desktop tests and each test file that imports the client half of `ui-layout`. If a test that is not in the table fails, stop and report the test name and its error. Do not fix `desktop-publish-local-preflight.spec.ts`. It fails at the base, because the commit `ccd7e505` removed `.github/`.

| Output | Expected at the base | Expected at the head |
|---|---|---|
| `Test Files` line | `1 failed \| 177 passed \| 4 skipped (182)` | `1 failed \| 176 passed \| 5 skipped (182)` |
| `Tests` line | `1 failed \| 2354 passed \| 56 skipped (2411)` | `1 failed \| 2351 passed \| 59 skipped (2411)` |
| exit code | `tests exit=1` | `tests exit=1` |
| `git grep -c` lines | | `main.ts:1`, `main-startup.spec.ts:1`, `welcome-startup.spec.ts:1`, `index.ts:2`, each with its full path |

| Run | What it proves |
|---|---|
| `hello red` in `trim.startup.steps.build` | The hello test can fail. |
| `trace off` and `probe off` | The trace test and the probe test can fail. The `grep -c` count `1`, directly after the off run, proves that the trace window closed. |
| `short` | The smoke check can fail. |

The install and build lines of `head.commands` ran in `trim.startup.steps.install` and `trim.startup.steps.build`. The line `corepack pnpm run start:desktop` is not a check, because it runs the app until you quit it. If a check does not give its expected result, use `tasks.protocol.stop`.

## Run report `trim.startup.run_report`

The reviewer reviews each run result before the lead uses it. Thus write one run report for each run step: `trim.startup.steps.install`, `trim.startup.steps.build`, the build of `trim.startup.steps.hello`, and `trim.startup.check`. Keep the output of each command in a file in `$TMPDIR/deepwidgets-trim-startup/logs/`. For example, run `<command> > "$TMPDIR/deepwidgets-trim-startup/logs/<name>.log" 2>&1 ; echo "<name> exit=$?"`, and then read the log. Write the reports to `$TMPDIR/deepwidgets-trim-startup/run-report.md`.

| Item | Value |
|---|---|
| Worktree and commit | The absolute path of the worktree, and the output of `git rev-parse --abbrev-ref HEAD` and `git rev-parse HEAD`. |
| Uncommitted diff | The output of `git status --short` and `git diff --stat`. |
| Commands | Each command as you ran it, with its exit code and its log file. After each app run, also the smoke log folder: `ls -td "$TMPDIR"/deepwidgets-smoke-desktop-* \| head -1`. |
| Conclusion | One sentence: what the run proves, or why it failed. |

Post the run report as one PR comment, directly after the PR opens. When you stop, write the report of each run step that you ran. Give its path in your report to the lead.

## Findings to record `trim.startup.findings`

Put these items in the `Findings` section of the PR body. Write "unknown" when you did not find out.

- The time of the install and of each build command, and whether you used the Electron fallback.
- The text of the main window in the boot test log: the `hello text` line and the `probe text` line.
- Each case of `handoff2.reviewer.failure_cases` that the change can cause.

## Files you may change `trim.startup.files`

Change only these files, and only the parts that the steps name:

- `apps/desktop/src/main.ts` (only `openInitialWindow`)
- `apps/desktop/tests/welcome-startup.spec.ts` (only line 181) and `apps/desktop/tests/main-startup.spec.ts` (only line 2457)
- `packages/client/ui-layout/src/client/index.ts` (only the three places of `trim.startup.steps.hello`)
- `tools/smoke-desktop.mjs` (only `trim.startup.steps.hello_test`)
- `CLAUDE.md` (only the lines of `trim.startup.steps.head`)
- No file in `deepwidgets/`

After the build, `git status --short` must show only these paths. If build outputs show up as untracked files, stop and report them. Do not add them to `.gitignore`.

## Done when `trim.startup.done`

- Each check command gives its expected output.
- `git status --short` shows only the paths in `trim.startup.files`.
- The PR is open against `main`. Its title is `trim.startup: open the main window at once and show hello`. The run report is a PR comment.
