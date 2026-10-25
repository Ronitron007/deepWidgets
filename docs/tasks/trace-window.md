# Task `trace.window`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `trace.window.goal`

Electron main opens the trace window, and its page shows the trace messages as rows. The spec is `docs/specs/floating-widget.md` (spec `floating_widget`). The contract of this unit is `floating_widget.window` and the step `trace-window-open` of `floating_widget.sources.steps`. The plan row is `trace.window` in `docs/plans/floating-widget.md`.

- The host half serves a real page at `GET /trace`. The page reads `GET /api/trace` with `EventSource`.
- Electron main opens the trace window after the host is ready. It records `trace-window-open` when the page loads with status 200.
- The trace test also reads the rows of the page `dsh-app://app/trace`.

In this task, the "trace test" is the command `DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs`. The "off run" is the trace test with `DEEPWIDGETS_TRACE=off`.

## Setup `trace.window.setup`

| Item | Value |
|---|---|
| Base | `origin/main` at `2043342831c82c3b9c9db7fb33b5d9a01f762c10` |
| Branch | `rohan/trace-window` |
| Worktree | `~/deepWidgets/.worktrees/rohan-trace-window` |
| Temporary files | `$TMPDIR/deepwidgets-trace-window/` |

Use this Mac, with a display. The trace test opens app windows.

```bash
git -C ~/deepWidgets fetch origin
git -C ~/deepWidgets merge-base --is-ancestor 2043342 origin/main ; echo "base exit=$?"   # must print base exit=0
git -C ~/deepWidgets diff --name-only 2043342 origin/main                              # read the output
git -C ~/deepWidgets worktree add -b rohan/trace-window .worktrees/rohan-trace-window origin/main
mkdir -p "$TMPDIR/deepwidgets-trace-window"
```

If the `merge-base` command does not print `base exit=0`, stop. Then use these rules for the output of the `diff` command:

- If it prints nothing, continue.
- If each path is under `docs/` or `deepwidgets/trim/`, or is a file in `trace.window.trim`, continue. Then follow `trace.window.trim`.
- If it prints another path, stop and report the list.

## Read first `trace.window.read`

Read `floating_widget.window`, `floating_widget.sources.steps`, and `floating_widget.check` in the spec. Then read the code that these facts name. The architect read each fact at the base.

- `reconcileBackend` in `apps/desktop/src/main.ts` (lines 606 to 622) calls `openInitialWindow` after the host is ready. The trace window opens after that call.
- The new call does not wait for the page. Thus a page failure cannot get to `reportFatal` at line 618.
- The `protocol.handle` call (main.ts lines 705 to 721) sends `dsh-app://app/trace` to the host.
- With `DEEPWIDGETS_TRACE=off`, `GET /trace` gets to the fallback of `packages/host/frontend-static/src/index.ts`, which answers 404 with no body (line 122).

More facts:

- `waitForRenderer` in `tools/smoke-desktop.mjs` (line 378) takes only the page `dsh-app://app/`. Thus no check uses the trace page as the main page.
- `main-startup.spec.ts` (line 327) and `welcome-startup.spec.ts` (line 104) replace `../src/deepwidgets-trace.ts` with a stub that has no `openTraceWindow`.
- `tools/trace-late-row.mjs` and `tools/trace-client-rows.mjs` import `deepwidgets/trace/index.js`. Their fake `webServer` ignores each route.
- No code sets a Content Security Policy on `dsh-app://app/` answers, so the inline script of the page runs.

The architect ran this design as a spike on the base. In the off run, `loadURL` did not reject on the 404 answer. The event `did-navigate` gave the code 404. Thus the window code checks the code, not only the promise. Without the stub change of `trace.window.steps.stubs`, 64 tests failed with `No "openTraceWindow" export is defined`.

Look Before You Build: the architect searched the repository, npm, and GitHub. DSH has no floating window and no trace page. The package `dsh-orb` starts its own Electron runtime for its window, so it does not agree with `floating_widget.decisions`. Electron and the browser already give each part. Thus this unit adds no dependency. Write one line about this in the PR body.

## Steps `trace.window.steps`

### Write the page `trace.window.steps.page`

Make the new file `deepwidgets/trace/page.html` with this text:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>deepWidgets trace</title>
<style>
  html, body { margin: 0; height: 100%; }
  body { display: flex; flex-direction: column; background: #18181b; color: #e4e4e7; font: 11px/1.4 ui-monospace, Menlo, monospace; }
  header { -webkit-app-region: drag; app-region: drag; user-select: none; padding: 6px 8px; background: #27272a; font-weight: 600; }
  main { flex: 1; overflow-y: auto; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 4px; white-space: nowrap; vertical-align: top; }
  td.detail { white-space: normal; color: #a1a1aa; }
  tr[data-process="main"] td.process { color: #fbbf24; }
  tr[data-process="host"] td.process { color: #60a5fa; }
  tr[data-process="client"] td.process { color: #4ade80; }
  tr[data-snapshot="true"] { opacity: 0.6; font-style: italic; }
</style>
</head>
<body>
<header>deepWidgets trace <span data-trace-status>connecting</span></header>
<main><table><tbody data-trace-rows></tbody></table></main>
<script>
  const list = document.querySelector('main')
  const rows = document.querySelector('[data-trace-rows]')
  const status = document.querySelector('[data-trace-status]')
  function clock(time) {
    const date = new Date(time)
    return date.toTimeString().slice(0, 8) + '.' + String(date.getMilliseconds()).padStart(3, '0')
  }
  function addRow(message) {
    const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 4
    const row = document.createElement('tr')
    Object.assign(row.dataset, { traceRow: String(message.seq), process: message.process, kind: message.kind, name: message.name, snapshot: String(message.snapshot === true) })
    const cells = [['time', clock(message.time)], ['process', message.process], ['kind', message.kind], ['name', message.name], ['state', message.state], ['detail', message.detail ?? '']]
    for (const [name, text] of cells) {
      const item = document.createElement('td')
      item.className = name
      item.textContent = text
      row.append(item)
    }
    rows.append(row)
    if (atEnd) list.scrollTop = list.scrollHeight
  }
  function connect() {
    const source = new EventSource('api/trace')
    source.onopen = () => {
      rows.replaceChildren()
      status.textContent = 'live'
    }
    source.onmessage = (event) => {
      try {
        addRow(JSON.parse(event.data))
      } catch (error) {
        console.warn('deepwidgets-trace: bad trace frame', error)
      }
    }
    source.onerror = () => {
      status.textContent = 'reconnecting'
      if (source.readyState !== EventSource.CLOSED) return
      setTimeout(connect, 1000)
    }
  }
  connect()
</script>
</body>
</html>
```

These are the reasons for the design:

- Each stream sends all kept messages first. Thus `onopen` clears the rows, and a new stream after a host restart or a page reload shows no copies.
- After an answer that is not 200, `EventSource` stays closed. Thus `onerror` makes a new `EventSource` after one second (`floating_widget.transport`).

### Serve the page `trace.window.steps.route`

Make these changes in `deepwidgets/trace/index.js`. Change no other line.

1. Before the first line, insert the line `import { readFileSync } from 'node:fs'` and one empty line.

2. After the line `const STATES = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']`, insert this line:

   ```js
   const PAGE = readFileSync(new URL('./page.html', import.meta.url), 'utf8')
   ```

3. In the `GET /trace` route, replace the four lines from `resource: async () => new Response(` to the next line `),` with this line:

   ```js
       resource: async () => new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
   ```

The page holds no data. Thus the route stays a `ctx.webServer` route, as `floating_widget.transport` says.

### Open the window `trace.window.steps.window`

Make these changes in `apps/desktop/src/deepwidgets-trace.ts`. Change no other line.

1. After the line ` * @module deepwidgets-trace` and the line ` */` after it, insert the line `import { BrowserWindow, screen } from 'electron'`.

2. In the line `export type DesktopTraceStepName = ...`, change `| 'main-window-open'` to `| 'main-window-open' | 'trace-window-open'`.

3. At the end of the file, add one empty line. Then add these lines:

   ```ts
   /** Page of the trace window (`floating_widget.window`). */
   const TRACE_WINDOW_URL = 'dsh-app://app/trace'
   let traceWindow: BrowserWindow | undefined
   /**
    * Open the trace window once: no frame, always on top, on all Spaces, and shown without focus.
    * A page that fails or does not answer 200 writes one warning and destroys the window.
    * @param onOpen - called after the page loads and the window shows.
    */
   export function openTraceWindow(onOpen: () => void): void {
     if (traceWindow !== undefined && !traceWindow.isDestroyed()) return
     const area = screen.getPrimaryDisplay().workArea
     const window = new BrowserWindow({
       x: area.x + area.width - 360 - 16,
       y: area.y + 16,
       width: 360,
       height: 480,
       resizable: true,
       frame: false,
       alwaysOnTop: true,
       show: false,
       title: 'deepWidgets trace',
       backgroundColor: '#18181b',
       webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
     })
     traceWindow = window
     window.setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true })
     window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
     window.webContents.on('will-navigate', (event) => { event.preventDefault() })
     let status = 0
     window.webContents.once('did-navigate', (_event, _url, code) => { status = code })
     void window.loadURL(TRACE_WINDOW_URL).then(() => {
       if (window.isDestroyed()) return
       if (status !== 200) {
         console.warn(`deepwidgets-trace: GET /trace answered ${String(status)}`)
         window.destroy()
         return
       }
       window.showInactive()
       onOpen()
     }, (error: unknown) => {
       console.warn('deepwidgets-trace: the trace window did not load', error)
       if (!window.isDestroyed()) window.destroy()
     })
   }
   ```

These are the reasons for the design:

- On macOS, `setVisibleOnAllWorkspaces` makes the Dock icon jump without `skipTransformProcessType: true`.
- The default session serves `dsh-app://` with `protocol.handle`. Thus the window needs no preload script and no IPC channel.
- The window opens at the top right. Thus it does not cover the middle of the welcome window or of the main window.

### Change Electron main `trace.window.steps.main`

First run `git grep -c "await openInitialWindow()" -- apps/desktop/src/main.ts`. It must print `apps/desktop/src/main.ts:1`. If not, stop and report. Then make these changes in `apps/desktop/src/main.ts`. Change no other line.

1. In the line `import { DesktopTraceSteps } from './deepwidgets-trace.ts'`, change `{ DesktopTraceSteps }` to `{ DesktopTraceSteps, openTraceWindow }`.

2. In `reconcileBackend`, after the line `if (backend.host !== undefined) await openInitialWindow()`, insert this line. Use the same indentation.

   ```ts
         if (backend.host !== undefined && !isQuitting()) openTraceWindow(() => { traceSteps.step('trace-window-open') })
   ```

### Change the two test stubs `trace.window.steps.stubs`

The files `apps/desktop/tests/main-startup.spec.ts` and `apps/desktop/tests/welcome-startup.spec.ts` each have the block `vi.mock('../src/deepwidgets-trace.ts', ...`. In each file, change the last line of that block from `} }))` to `}, openTraceWindow() {} }))`.

The stub keeps the trace window out of these tests. The reason: the tests count the windows that `main.ts` makes, for example `harness.windows[0]`.

### Install and build `trace.window.steps.build`

This unit adds no dependency. Thus the lockfile does not change.

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack pnpm --version                                     # must print 11.28.5
corepack pnpm install --frozen-lockfile                     # must exit 0
corepack pnpm run build:artifacts                           # must exit 0
corepack pnpm --filter @deepseek-ai/dsh-desktop run build   # must exit 0
```

If the folder `apps/desktop/node_modules/electron/dist` does not exist, use the Electron fallback from `fork.baseline.steps.install`. Record that you used it. Then run the Git hook checks from `fork.baseline.steps.install`. Each check must give its expected output.

Record the time of each build command. The desktop build runs `tsc -b`, so it checks the types of `deepwidgets-trace.ts`.

### Extend the trace test `trace.window.steps.smoke`

Make these changes in `tools/smoke-desktop.mjs`. Change no other line.

1. In the comment at the top, after the line ` * The trace test also needs the start-up steps of Electron main and a message for each client row.`, insert the line ` * Then it reads the rows of the trace window page dsh-app://app/trace.`

2. In `traceReadExpression`, in the line `const STEPS = [...]`, change `'main-window-open']` to `'main-window-open', 'trace-window-open']`.

3. In `traceReason`, in the rule `main steps`, change `result.steps.length === 4` to `result.steps.length === 5`.

4. In `checkTrace`, change the line `if (next === undefined) return undefined` to `if (next === undefined) return checkTracePage(deadline)`.

5. At the end of the file, add one empty line. Then add these lines:

   ```js
   function tracePageExpression() {
     return `JSON.stringify((() => {
     const rows = [...document.querySelectorAll('tr[data-trace-row]')].filter((row) => !row.dataset.name.startsWith('smoke-trace-'))
     const processes = [...new Set(rows.map((row) => row.dataset.process))]
     const opened = rows.some((row) => row.dataset.process === 'main' && row.dataset.kind === 'step'
       && row.dataset.name === 'trace-window-open' && row.textContent.includes('trace-window-open'))
     return { rows: rows.length, processes, opened }
   })())`
   }
   async function checkTracePage(deadline) {
     let reason = 'no page dsh-app://app/trace'
     while (Date.now() < deadline) {
       try {
         const response = await fetch(`http://127.0.0.1:${String(rendererPort)}/json/list`, { signal: AbortSignal.timeout(2000) })
         const targets = response.ok ? await response.json() : []
         const trace = Array.isArray(targets)
           ? targets.find((target) => target?.type === 'page' && target.url === 'dsh-app://app/trace' && typeof target.webSocketDebuggerUrl === 'string')
           : undefined
         if (trace !== undefined) {
           const result = JSON.parse(String(await evaluate(trace.webSocketDebuggerUrl, tracePageExpression(), Math.min(deadline, Date.now() + 5000))))
           note(`trace page=${JSON.stringify(result)}`)
           if (['main', 'host', 'client'].every((name) => result.processes.includes(name)) && result.opened === true) return undefined
           reason = `rows ${String(result.rows)} processes ${result.processes.join(',')} opened ${String(result.opened)}`
         }
       } catch (error) {
         note(`trace page error=${error instanceof Error ? error.message : 'unknown'}`)
       }
       await delay(500)
     }
     return `trace page: ${reason}`
   }
   ```

These are the reasons for the design:

- The page expression is in a function, as in `traceReadExpression`. The script runs its checks before it gets to the end of the file. At that time, a `const` at the end has no value.
- The page check runs only after the stream check passes. The stream check needs `trace-window-open`, and Electron main records it only after the page loads. Thus the trace page exists when the page check starts.

### Fill in `CLAUDE.md` `trace.window.steps.head`

First count the composed host rows:

```bash
W=$(git rev-parse --show-toplevel) ; T=$TMPDIR/deepwidgets-trace-window ; mkdir -p "$T/home"
( cd "$T/home" && DSH_HOME="$T/home" node "$W/apps/cli/lib/bin.js" --profile web --dump-default-config ) > "$T/composed.yml"
grep -cE '^- id: ' "$T/composed.yml"             # prints 197 on the base
```

Then change only these two parts of the root `CLAUDE.md`:

1. In `head.why`, change `composes 196 plugin rows` to `composes <n> plugin rows`. `<n>` is the number that the `grep` command printed.

2. In `head.status`, in the row `Our packages`, change `(host half and client half merged)` to `(host half, client half, and trace window merged)`.

Then run `git diff --numstat 2043342 | tr '\t' ' '`. It must print these seven lines. Also run `wc -l < deepwidgets/trace/page.html | tr -d ' '`. It must print `67`. If an output is different, stop and report it.

```text
2 2 CLAUDE.md
47 1 apps/desktop/src/deepwidgets-trace.ts
2 1 apps/desktop/src/main.ts
1 1 apps/desktop/tests/main-startup.spec.ts
1 1 apps/desktop/tests/welcome-startup.spec.ts
4 4 deepwidgets/trace/index.js
36 3 tools/smoke-desktop.mjs
```

### Merge with `trim.profile` `trace.window.trim`

Use this section only when `trim.profile` is in `origin/main`, before you start or while your PR is open. Run `git merge origin/main`. Do not rebase. After the merge, the `numstat` lines of `trace.window.steps.head` can differ.

- `tools/smoke-desktop.mjs`: keep the rows check and each change of this unit.
- `CLAUDE.md`: keep each change of both units. Count the rows again with `trace.window.steps.head`, and write the new number.
- `deepwidgets/trim/rows.host.txt` and `deepwidgets/trim/rows.client.txt`: do not change them. This unit adds no row.
- `pnpm-lock.yaml`, `apps/cli/package.json`, and `packages/util/official-bundles/src/bundles.ts`: keep the `origin/main` text.

After the merge, run `trace.window.steps.build` again. Then run the rows check line from `head.commands`. It must print `smoke-desktop: pass`. If it fails, stop and report.

## Run the checks `trace.window.check`

Run each command from the worktree root. Each comment gives the expected output and the expected exit code. The off run takes about five minutes, because the trace test tries again until its deadline.

```bash
DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs ; echo "trace exit=$?"                             # smoke-desktop: pass, trace exit=0
DSH_SMOKE_TRACE=1 DEEPWIDGETS_TRACE=off node tools/smoke-desktop.mjs ; echo "trace off exit=$?"   # smoke-desktop: fail: trace: status 404, trace off exit=1
grep -c "deepwidgets-trace: GET /trace answered 404" "$(ls -td "$TMPDIR"/deepwidgets-smoke-desktop-* | head -1)/desktop.log"   # 1
node tools/smoke-desktop.mjs ; echo "smoke exit=$?"                                               # smoke-desktop: pass, smoke exit=0
DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs ; echo "probe exit=$?"                             # smoke-desktop: pass, probe exit=0
node tools/trace-late-row.mjs ; echo "late row exit=$?"                                           # trace-late-row: pass, late row exit=0
node tools/trace-client-rows.mjs ; echo "client rows exit=$?"                                     # trace-client-rows: pass, client rows exit=0
corepack pnpm exec vitest run apps/desktop/tests/main-startup.spec.ts apps/desktop/tests/welcome-startup.spec.ts ; echo "desktop tests exit=$?"   # Tests  136 passed (136), desktop tests exit=0
```

- The off run proves that the trace test can fail. The variable turns off the trace row, so `GET /api/trace` answers 404.
- Run the `grep -c` command directly after the off run. Its count `1` proves that the trace window closed when the trace routes did not exist.
- The install and build lines of `head.commands` ran in `trace.window.steps.build`. The line `corepack pnpm run start:desktop` is not a check, because it runs the app until you quit it.

If a check gives a result that is not its expected result, use `tasks.protocol.stop`.

## Findings to record `trace.window.findings`

Put these items in the `Findings` section of the PR body. Write "unknown" when you did not find out.

- The time of the install and of each build command, and whether you used the Electron fallback.
- The line `trace page=` from `desktop.log` in the newest folder `$TMPDIR/deepwidgets-smoke-desktop-*`, directly after the trace test.
- The result line of the off run, and the output of the `grep -c` command after it.
- The lines `Test Files` and `Tests` of the run `desktop tests`, and the number that the row count printed.
- Whether you used `trace.window.trim`, and each conflict that you resolved.

## Files you may change `trace.window.files`

Change only these files, and only the parts that the steps name:

- `deepwidgets/trace/page.html` (new) and `deepwidgets/trace/index.js` (`trace.window.steps.route`)
- `apps/desktop/src/deepwidgets-trace.ts` (`trace.window.steps.window`) and `apps/desktop/src/main.ts` (`trace.window.steps.main`)
- `apps/desktop/tests/main-startup.spec.ts` and `apps/desktop/tests/welcome-startup.spec.ts` (`trace.window.steps.stubs`)
- `tools/smoke-desktop.mjs` (`trace.window.steps.smoke`) and `CLAUDE.md` (`trace.window.steps.head`)

After the build, `git status --short` must show only these paths. If build outputs show up as untracked files, stop and report them. Do not add them to `.gitignore`.

## Done when `trace.window.done`

- Each check command gives its expected output.
- `git status --short` shows only the paths in `trace.window.files`.
- The PR is open against `main`. Its title is `trace.window: open the trace window and show the trace rows`.
