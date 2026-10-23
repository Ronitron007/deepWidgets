# Task `fork.baseline`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `fork.baseline.goal`

Make the imported DSH tree install, build, and boot on this Mac, with three small changes and one new check. Do not change DSH code. The spec is `docs/specs/fork-trim.md`. The plan row is `fork.baseline` in `docs/plans/fork-trim.md`.

## Setup `fork.baseline.setup`

| Item | Value |
|---|---|
| Base | `origin/main`. It must contain commit `1968e927`. |
| Branch | `rohan/fork-baseline` |
| Worktree | `~/deepWidgets/.worktrees/rohan-fork-baseline` |
| Temporary files | `$TMPDIR/deepwidgets-fork-baseline/` |
| Machine | this Mac, with a display. The smoke check opens app windows. |

```bash
git -C ~/deepWidgets fetch origin
git -C ~/deepWidgets merge-base --is-ancestor 1968e927 origin/main
git -C ~/deepWidgets worktree add -b rohan/fork-baseline .worktrees/rohan-fork-baseline origin/main
```

If the second command exits with a code other than 0, stop.

## Read first `fork.baseline.read`

- `apps/desktop/scripts/dev.ts` is the launcher for `dev:desktop` and `start:desktop`.

- `apps/desktop/src/main.ts`, near `openInitialWindow` and `enterWorkspace`. These functions open the welcome window or the main window after the host is ready.

- `apps/desktop/src/host-process.ts` starts the child host.

- `apps/desktop/scripts/smoke-runtime.ts` is the upstream smoke check for a packaged runtime. It is prior art, not the check for this task.

## Steps `fork.baseline.steps`

### Change the root `CLAUDE.md` `fork.baseline.steps.claude_md`

The root `CLAUDE.md` is a symbolic link to `AGENTS.md`. Replace the link with a normal file. Keep `AGENTS.md` without change.

```bash
git rm CLAUDE.md
```

Then write `CLAUDE.md` with exactly this text. Fill in the `Commands` section in the last step.

````markdown
# deepWidgets

deepWidgets is an unofficial fork of DeepSeek Harness (DSH). `UPSTREAM.md` gives the source commit and the license.

## Goal

Trim DSH to two Cordis Contexts and one test widget. The spec is `docs/specs/fork-trim.md`. The plan is `docs/plans/fork-trim.md`. Tasks are in `docs/tasks/`.

## Rules for agents

- `AGENTS.md` and the nested `CLAUDE.md` and `AGENTS.md` files come from upstream DSH. Use their code conventions when you edit DSH code.

- Do not follow the upstream process rules. These include PR description templates, AI usage sections, labels, `gh stack`, CI gates, release steps, upgrade guides, Agent Notes, and translations.

- A task file in `docs/tasks/` is the authority for its unit. Read `docs/tasks/README.md` before you start a task.

- Do not delete code that the trim removes. Comment it out, and put the marker `deepwidgets-trim: <reason>` on the first commented line.

- Do not change the Electron version.

- Branch names start with `rohan/`. Branch from `origin/main` and open PRs against `main`. Never force-push.

- Never commit secrets.

## Commands

```bash
<filled in by fork.baseline>
```
````

### Remove the Git hook installer `fork.baseline.steps.hooks`

The root `postinstall` script installs DSH Git hooks. Remove it before the first install.

1. In the root `package.json`, delete the `"postinstall": "node scripts/install-lefthook.mjs"` entry. Change nothing else in that file.

2. Delete `lefthook.yml`.

Keep `scripts/install-lefthook.mjs` and the files that refer to it. Without the `postinstall` entry, nothing runs it. The unit `trim.tooling` deletes it with the other DSH scripts.

Keep the `lefthook` dev dependency. A change to it changes `pnpm-lock.yaml`, and this task must not change the lockfile.

### Install `fork.baseline.steps.install`

Use corepack. It runs the pnpm version that `packageManager` names, without a global change.

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack pnpm --version          # must print 11.28.5
corepack pnpm install --frozen-lockfile
```

Record the install time and each warning about Node, engines, or skipped build scripts.

Fallback for one case only: if `ls apps/desktop/node_modules/electron/dist` fails after the install, run `node apps/desktop/node_modules/electron/install.js` once. Record that you used this fallback.

After the install, make sure that no Git hook was installed:

```bash
git config --get core.hooksPath ; echo "hooksPath exit=$?"                     # must print exit=1
ls "$(git rev-parse --git-common-dir)/dsh-hooks" ; echo "common hooks exit=$?" # must print a non-zero exit
ls "$(git rev-parse --git-dir)/dsh-hooks" ; echo "worktree hooks exit=$?"      # must print a non-zero exit
```

### Build `fork.baseline.steps.build`

These are the two build commands that `dev.ts` runs.

```bash
corepack pnpm run build:artifacts
corepack pnpm --filter @deepseek-ai/dsh-desktop run build
```

Record the time of each command.

### Write the smoke check `fork.baseline.steps.smoke`

Write `tools/smoke-desktop.mjs`. Use only Node built-in modules. Node 22 has a global `WebSocket` and `fetch`.

The script must do these things:

1. Make a new temporary folder. Set `DSH_HOME` and `DSH_DESKTOP_USER_DATA_DIR` to subfolders of it, so that the run does not use the real profile.

2. Pick three free TCP ports. Set `DSH_DESKTOP_MAIN_INSPECT_PORT`, `DSH_DESKTOP_RENDERER_DEBUG_PORT`, and `DSH_DESKTOP_HOST_INSPECT_PORT` to them. Set `DSH_DESKTOP_OPEN_DEVTOOLS=0`.

3. Start `corepack pnpm run start:desktop` in its own process group. Write its output to a log file in the temporary folder.

4. Wait for the renderer. Poll `http://127.0.0.1:<renderer port>/json/list` until a target of type `page` has a URL that starts with `dsh-app://app/`. Connect to its `webSocketDebuggerUrl`. Send `Runtime.evaluate` for `document.readyState`. The value must be `complete`.

5. Wait for the host. List the processes of the app's process group with `pgrep -g <group id>`. The host is the one whose command line, from `ps -o command= -p <pid>`, contains `desktop-host`. Find its listening TCP port with `lsof -a -p <pid> -iTCP -sTCP:LISTEN -nP`. Send an HTTP GET to `http://127.0.0.1:<port>/`. Any HTTP status counts, because it shows that the host web server answers.

6. Stop the app. Send `SIGTERM` to the process group. After 20 seconds, send `SIGKILL` to any process that is still in the group. Then `pgrep -g <group id>` must find nothing, and the host process must be gone. If a process is still alive, the result is fail.

7. Print one result line, `smoke-desktop: pass` or `smoke-desktop: fail: <reason>`. Exit 0 on pass and 1 on fail.

8. Read the timeout from `DSH_SMOKE_TIMEOUT_MS`, with a default of 240000. The timeout covers steps 4 and 5.

The page in step 4 can be the welcome window, because a new `DSH_HOME` has no login and no API key. That is correct for this task. Do not log in, and do not add an API key.

### Run the checks `fork.baseline.steps.check`

```bash
node tools/smoke-desktop.mjs ; echo "smoke exit=$?"                              # must print pass and exit=0
DSH_SMOKE_TIMEOUT_MS=1000 node tools/smoke-desktop.mjs ; echo "short exit=$?"    # must print fail and exit=1
```

The second command proves that the check can fail. Step 6 of the script proves that no app process stays alive. Do not use `pgrep -f` with a path from your own command line, because it also finds your own shell.

### Fill in the commands `fork.baseline.steps.commands`

In `CLAUDE.md`, replace `<filled in by fork.baseline>` with the commands that you ran and that worked. Include the install, the two build commands, the launch command `corepack pnpm run start:desktop`, and the smoke check.

## Findings to record `fork.baseline.findings`

Put these in the `Findings` section of the PR body. Write "unknown" when you did not find out.

- The Node version that you used: `node -v`.

- The Node version inside Electron: `ELECTRON_RUN_AS_NODE=1 "$(node -p "require('./apps/desktop/node_modules/electron')")" -p process.versions.node`.

- The time of the install and of each build command.

- Each warning about Node, engines, or skipped build scripts.

- Whether you used the Electron fallback.

- Which window the smoke check found: welcome or main.

- At most five lines: what is the smallest way to reach the main window from a new `DSH_HOME`? Find out by reading code only. Do not test it. The unit `probe.round_trip` needs this answer.

## Files you may change `fork.baseline.files`

- `CLAUDE.md`

- `package.json` (only the `postinstall` entry)

- `lefthook.yml` (delete)

- `tools/smoke-desktop.mjs` (new)

After the build, `git status --short` must show only these paths. If build outputs show up as untracked files, stop and report them. Do not add them to `.gitignore`.

## Done when `fork.baseline.done`

- Both check commands give their expected output.

- `git status --short` shows only the paths in `fork.baseline.files`.

- The PR is open against `main`. Its title is `fork.baseline: install, build, and boot the DSH copy`.
