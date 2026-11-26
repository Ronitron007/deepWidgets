# Window manager: the design talk `wm_design`

This document records the design talk about the window manager. It is not the spec. The operator decided the calls `wm_design.owner` and `wm_design.operations`. The other calls are open. The spec comes after the operator gives the whole direction.

The facts are true on `main` at commit `938c8629b3`, on 2026-11-25.

## Labels `wm_design.labels`

Each fact has one of these labels:

- **verified:** I read the code or the document, or I ran a command. The row names the source.

- **inferred:** I reasoned from verified facts. No test ran.

- **not checked:** Nobody looked yet.

## Terms `wm_design.terms`

- **Host:** the Node process that runs Cordis and the deepWidgets plugins.

- **Electron main:** the main process of the desktop app. Only Electron main can open, move, or hide a window.

- **Runtime:** the plugin `@deepwidgets/widgets` in the host. It keeps the state, the program, and the actions of each widget. It also serves the routes and the events stream.

- **Windows plugin:** the plugin `@deepwidgets/windows` in the host. It does not exist yet. Option A of `wm_design.owner` makes it.

- **Widget window:** the floating `BrowserWindow` of one widget.

- **Panel:** the window under the menu bar icon. It shows the page of the built-in widget `main`.

- **Window data:** the shown state, the position, the size, and the options of each widget window.

- **Slug:** the name of a widget. The slug is the identity of the widget and of its window.

## The task `wm_design.task`

The Master session gave this task. The window manager comes in three stages, in this order:

- **user:** the operator controls each widget window.

- **settings:** the same controls show in the settings of each widget, in the panel.

- **agents:** agents get the same controls through MCP tools.

## What exists today `wm_design.today`

| Fact | Source | Label |
|---|---|---|
| A widget window is 320 by 300 pixels, with no frame. It is always on top and resizable. It shows on all Spaces, and it shows with no focus. | `apps/desktop/src/deepwidgets-windows.ts`, `open()` | verified |
| A new window goes in a column at the left edge of the primary display. When the column is full, the next windows go on top of the last place. | `deepwidgets-windows.ts`, `open()` | verified |
| The operator can not move a widget window. No widget page has a drag area. Only the trace page has one. | `git grep app-region` | verified |
| The operator can resize a widget window at its edges. | | not checked |
| Nothing saves the position or the size of a window. A reinstall opens the window at the default place. | `git grep` for `getBounds` and `setBounds`, `deferred.window_position` | verified |
| The runtime keeps the shown state in the table `windows` of the storage domain `widgets`. PR #137 added it. | `deepwidgets/widgets/src/index.ts` | verified |
| The frames `hello`, `added`, and `window` of the events stream carry the shown state. Electron main shows or hides each window to match. | `deepwidgets-windows.ts` | verified |
| Only Show and the Remove of `main` clear a Hide. An agent remove and a reinstall keep it. | `main_widget.reviews` | verified |
| `main_widget.reviews` says that the operator, or the lead session with the rules of the operator, decided the Hide rule. Which of the two decided it is not in the record. | `main_widget.reviews` | verified |
| Electron main reads the events stream of the runtime over HTTP. The host sends other messages to Electron main over Node IPC, such as `deepwidgets-pages` and `deepwidgets-login-item`. | `deepwidgets-windows.ts`, `host-process.ts` | verified |
| The windows stay open while the host is down. The `hello` frame of the next host syncs them. | `deepwidgets-windows.ts` | verified |
| The panel can call only the actions of `main`. A widget page can call only the routes under its own slug. | `head.status` in `CLAUDE.md` | verified |
| An action of `main` has a watchdog limit of 2 s. A host call inside the helper `host(...)` has the limit of the host, 10 s. | `deepwidgets/widget-main/src/index.ts`, `main_widget.reviews` | verified |
| The main file of the runtime, `deepwidgets/widgets/src/index.ts`, has 1746 lines. | `wc -l` | verified |

## Constraints `wm_design.constraints`

A constraint limits each design. The rows marked with a star bear on `wm_design.owner`.

### Electron and macOS `wm_design.constraints.platform`

| Constraint | Effect | Label |
|---|---|---|
| Electron stays at 44.7.0. | The design can use only the API of 44.7.0. The window API that the design needs is in 44.7.0. | verified (`head.rules`, `electron.d.ts`) |
| Each call of `setVisibleOnAllWorkspaces` needs `skipTransformProcessType: true`. | Without it, the Dock icon comes back. | verified (`main_widget.risks`) |
| A window with no frame moves only through a drag area in its page. | Agents write the pages. Thus a drag area must come from the kit, the shell, or Electron main. | verified (no drag area today) |
| Electron main can add CSS to a page with `insertCSS`. | This can give each page a drag area. The widget CSP can block it. | not checked |
| Click-through makes the window ignore each click. | The operator can not click the window to turn click-through off. The way back must be in another place. | verified (`electron.d.ts`) |
| Opacity works only on macOS and Windows. | | verified (`electron.d.ts`) |
| A widget window shows with no focus. | A key press goes to another app. Thus a shortcut for a widget window must be a global shortcut. | inferred |
| On macOS, the event `moved` also comes for a move from code. The event `will-move` comes only for a move by the operator. | Electron main can tell a move by the operator from its own move. | verified (`electron.d.ts`, `options.windows`) |
| A window of the type `panel` ignores `setVisibleOnAllWorkspaces(false)`. | Our widget windows are not of the type `panel`. Thus "one desktop only" can work for them. | verified for `panel` (spike of 2026-10-27). Not checked for our windows. |
| The operator can remove a display. | A saved position can then be off the screen. The design must move the window back onto a display. | inferred |

### Architecture `wm_design.constraints.architecture`

| Constraint | Effect | Label |
|---|---|---|
| ★ Only Electron main can touch a window. | Each change from the host goes to Electron main as a message. | verified (the host is a separate process, `host-process.ts`) |
| Electron main runs no Cordis today. | This is a choice of DSH, not a limit. Electron main runs Node, so it can load Cordis. | verified (`git grep cordis` in `apps/desktop/src`). The load is not checked. |
| Electron main makes some window choices today: the default place and the fallback after page failures. The host makes other choices: the shown state. | Where each choice lives is open. | verified (`deepwidgets-windows.ts`) |
| ★ The windows stay open while the host restarts. | The owner of the window data must send all of it again after each host start. | verified (`deepwidgets-windows.ts`) |
| ★ The panel can call only the actions of `main`. | A control in the panel is an action of `main`, which calls the owner of the window data. | verified (`head.status`) |
| An action of `main` has a limit of 2 s. | Heavy host work goes through `host(...)`. | verified (`main_widget.reviews`) |
| A storage write takes about 10 ms. | The design saves a position at the end of a drag, not during the drag. | verified (`standing.evidence`). I inferred the save rule. |

### Authority `wm_design.constraints.authority`

| Constraint | Effect | Label |
|---|---|---|
| ★ A choice of the operator beats a choice of an agent. A Hide stays through an agent remove and a reinstall. | The owner of the window data must know who removed a widget. | verified (`main_widget.reviews`) |
| The slug is the identity. | A reinstall with the same slug gets the same window data. | verified (`main_widget.reviews`) |
| Agents can not see `main`. | Window tools for agents must be MCP tools that call the owner. They can not be actions of `main`. | verified (`main_widget.widget`) |
| MCP tools belong to modes. A gated mode has a key in `settings.json`. `interact` is always on. A tool name starts with the area of its mode. | Window tools for agents need a mode. In a new mode, the tools need a new area name, for example `window_*`. | verified (`modes.list`, `modes.settings`, `modes.names`). I inferred the area name. |
| An early draft says "MCP tools cannot write settings". | It conflicts with the agents stage. Nobody decided it. | verified (`explore.widget.settings`) |

### Process `wm_design.constraints.process`

| Constraint | Effect | Label |
|---|---|---|
| Only one app run or smoke run can occur at a time, under the lock. | The checks run one after the other. | verified (`head.commands`) |
| Another session builds the kit. This session does not change `deepwidgets/kit/` or `deepwidgets/mcp/src/page-gate.ts`. | A drag area in the kit needs the kit session. | verified (the brief) |
| A unit that touches `deepwidgets/widgets` or `deepwidgets/mcp` runs the install, action, and crash replays. | | verified (the brief) |
| A unit that changes a file under model coverage gets the review of the skill `widget-state-models`. These files include `deepwidgets/widgets/src/index.ts`, `deepwidgets/mcp/src/creation.ts`, `apps/desktop/src/main.ts`, and `apps/desktop/src/host-process.ts`. | | verified (`.agents/skills/widget-state-models/SKILL.md`) |

## Parts we can use `wm_design.parts`

### Electron API `wm_design.parts.electron`

All these calls are in Electron 44.7.0 (verified, `electron.d.ts`):

- `setBounds` and `getBounds`, for the position and the size.

- The events `moved`, `will-move`, `resized`, and `will-resize`, on macOS and Windows.

- `setOpacity`, on macOS and Windows.

- `setIgnoreMouseEvents`, for click-through.

- `setAlwaysOnTop` with a level.

- `setVisibleOnAllWorkspaces`, on macOS and Linux.

- The `screen` events `display-removed` and `display-metrics-changed`.

### Packages `wm_design.parts.packages`

| Package | Last release | Fit | Label |
|---|---|---|---|
| `electron-window-state` 5.0.3 | 2018-11-25 | It keeps the bounds of one window in a file of Electron main. Nobody maintains it. It gives one useful rule: when saved bounds touch no display, use the default place. | verified (`npm view`) |
| `@elarcis/electron-window-state` 5.1.1 | 2025-03-20 | A fork of the package above, with the same model | verified (`npm search`) |
| `electron-win-state` 1.1.22 | 2021-11-15 | A store of Electron main | verified (`npm view`) |
| `electron-positioner` 4.1.0 | 2018-08-24 | Named places on a display, such as `topRight`. It can help a snap to a corner. | verified (`npm view`) |
| `electron-store` 12.0.0 | 2026-10 | A maintained store of Electron main. The host already has a storage domain. | verified (`npm view`) |

Each package keeps the data in Electron main. No package fits a design that keeps the data in the host. The bounds code is small, about 30 lines (inferred).

### Prior art `wm_design.parts.prior_art`

These facts come from web search results: guides, forums, and change logs. Nobody checked them in the apps.

| App | Window controls |
|---|---|
| Rainmeter | Layer (topmost, normal, bottom, desktop), display, draggable, snap to edges, keep on screen, click-through, transparency. One setting turns off the drag of all skins. |
| Übersicht | Widgets in front of or behind the desktop items. Version 0.7 used a held key to click a widget. Later versions make widgets always clickable. |
| macOS desktop widgets | Drag to any place, with an alignment grid during the drag. A right click edits a widget. Fixed sizes. |
| Deskulpt | A manager window sets the position, the size, the z-index, and the opacity of each widget. A mode makes the widgets or the desktop take the clicks, with a global shortcut. |

## Call: who keeps the window data `wm_design.owner`

**Status: decided.** On 2026-11-25 the operator chose option C. The runtime keeps the window data. On 2026-11-23 the operator leaned to a plugin and asked which data must decide the call. The sections below keep the facts of that talk.

### The options `wm_design.owner.options`

| Option | Who keeps the window data | Note |
|---|---|---|
| A | The windows plugin | The shown state of #137 moves out of the runtime. The runtime gives the windows plugin the list of widgets and the name of who removed a widget. |
| B | Split | The runtime keeps the shown state. The windows plugin keeps the position and the options. One window then has two owners. |
| C | The runtime | The table `windows` gets more fields. No new plugin. |

I set two more options aside. The operator did not decide on them.

- **D, each widget keeps its own window data:** Agents write widget code and change widget state. Thus an agent could undo a Hide of the operator. This breaks the authority rule (`wm_design.constraints.authority`, inferred).

- **E, Electron main keeps the window data:** The rules of authority live in the host. The MCP tools and the actions of `main` run there. Thus E puts the data and the rules in two processes. E also goes against the decision `widget.window_manager`, which says that a plugin decides (verified, read).

### A against C `wm_design.owner.compare`

| Point | A | C | Label |
|---|---|---|---|
| A bug at the start of the window code | Only the windows plugin fails. The runtime and the MCP server keep running. | The runtime fails, and each widget stops. | verified: Cordis unloads only the plugins that depend on a failed plugin (skill `cordis`). I inferred the effect on the widgets. |
| A bug in the runtime | The windows plugin also stops, because it needs the list of widgets. | The window code stops with the runtime. | inferred |
| The decision `widget.window_manager` | Matches. It says "a window manager plugin". | Goes against it | verified (read) |
| Turn off or reload the window code alone | Yes. The plugin has its own row. | No | inferred |
| A hidden window opens with no flash | The windows plugin must build this again. | Built in #137. A hidden window never calls `showInactive`. | verified (`deepwidgets-windows.ts`, #137 checks) |
| Who removed a widget | Needs one new event from the runtime. `creation.ts` changes one time. | Built in #137 | verified (#137 code) |
| Storage load from drags | Its own storage | The same write queue as the widget state. One write for each drag gives no real load. | verified (`standing.evidence`). I inferred the load. |
| Cost before the user stage | About one more unit. It holds the new package, the move of the Hide records, the no-flash open, and a channel to Electron main. | Add fields to the table | inferred |

### Which files each stage changes `wm_design.owner.files`

I inferred all rows. No plan exists yet.

| Stage | A | C |
|---|---|---|
| Move to the new owner (A only) | `deepwidgets/widgets` (remove the table), `deepwidgets/mcp/src/creation.ts` (who removed), the new `deepwidgets/windows`. Replays and model review apply. | none |
| user | `deepwidgets/windows`, `apps/desktop/src/deepwidgets-windows.ts`. No replays. No model review, unless the channel uses `host-process.ts`. | `deepwidgets/widgets` and `deepwidgets-windows.ts`. Replays apply. Model review applies when the change touches `index.ts`. Window code in a new file of the runtime package avoids most model review. |
| settings | `deepwidgets/widget-main`, `deepwidgets/shell/src/main-widget/` | The same |
| agents | `deepwidgets/mcp`. Replays apply. | The same |

### The question that decides `wm_design.owner.question`

The two options differ in when the cost comes:

- A pays one time, at the start, and then keeps window units out of the runtime.

- C pays at each window unit that touches the runtime package.

Thus the deciding question is how much the window code changes after the user stage. A lot of change favors A. Little change favors C. This is a call for the operator, because it depends on the roadmap.

## Call: the operations `wm_design.operations`

**Status: decided, with two open points.** The operator gave these answers on 2026-11-25 and 2026-11-26.

| Operation | Decision |
|---|---|
| Show and Hide | They exist (`main_widget.window_state`). |
| Move | Yes. |
| Resize | Yes. The agent decides at build time if a widget is resizable. The default is not resizable. |
| Size | The agent can set the size at build time. Without it, the widget gets the default size, 320 by 300 pixels today. |
| Layer | Two layers: always on top, and normal. Each layer has its own default position. |
| Reset position | It moves the window to the default position of its layer. |
| Display | One default place for now. |
| Snap to edges or a grid | Deferred. |
| Opacity | Deferred. |
| Desktop level | Not needed. |
| Click-through | Not needed. |

The two open points:

- **Lock:** a locked window can not move, but it still takes clicks. The operator did not answer yet.

- **Who chooses the layer:** the agent at build time, the operator, or both.

These facts helped the call:

- A normal window lets other app windows cover it. A click brings it to the front (inferred).

- A window of the type `desktop` gets no focus, no key events, and no mouse events (verified, Electron docs, `BaseWindowOptions`).

### A screenshot for the agent `wm_design.operations.screenshot`

The operator asked if a tool can send a screenshot of a widget window to the agent.

- No such tool exists today. Only the smoke check calls `webContents.capturePage()` (verified, `git grep capturePage`).

- Electron main can capture the page of a widget window with `webContents.capturePage()`. The image holds only the page, not the screen around it (inferred from the API).

- An MCP tool result can carry an image. The MCP core 2.2.0 of the server has `ImageContentSchema` (verified, read the package).

- A capture of a hidden window can give an empty image (not checked).

- The host must ask Electron main for the capture, as it asks for the render check today (verified, `deepwidgets-render-check.ts`).

## Other open calls `wm_design.open`

The operator did not answer these calls yet:

- **How the operator operates a window:** a drag area or a title bar, a right-click menu, or keyboard shortcuts.

- **Persistence:** does a position stay through a restart and through a reinstall.

- **The rule after a reinstall:** the operator wants to talk about the Hide rule again. The same question applies to a position.

- **Agents:** what an agent can do with no question to the operator. Do the window tools get their own gated mode.

- **One desktop only:** the decision `widget.window_manager` says that the window manager chooses all desktops or the main desktop only. Is this in scope now.

- **The screenshot tool:** is it in the agents stage, and in which mode.

- **A line in `CLAUDE.md`:** the session of `main_widget` asked for one line in `head.status` about the shown state. The line goes in only after the operator says yes.

## Corrections in this talk `wm_design.corrections`

I made these mistakes in the talk. This section keeps them on record.

- I wrote "Electron main runs no Cordis and only obeys", and I labeled it verified. I verified only "runs no Cordis", and only for the code of today. "Only obeys" is a design line from `standing.design`. It is false today.

- On 2026-11-24 I recorded option A as a decision of the operator. The operator did not decide it. On 2026-11-25 the operator chose C.

- I wrote that the operator decided the Hide rule. The session of `main_widget` told me so. The record says that the operator or the lead session decided it.

- I wrote that under A, the window units do not touch the runtime. The agents stage changes `deepwidgets/mcp` under A and under C. Thus the replays apply to it in both options.

## Sources `wm_design.sources`

- The research record of this session: `/Users/rohanmalik/Library/Application Support/Claude/side-session-notes/local_f0dc181e-b35b-4d2a-813d-576c9e19f0b4/window-manager-research.md`.

- The window spike of 2026-10-27: `options.windows` and `explore.widget.windows` in `docs/explore/widget-system/`.

- Rainmeter: forum.rainmeter.net and the Rainmeter docs repository on GitHub.

- Übersicht: the change log on Softpedia.

- macOS desktop widgets: iMore, Digital Trends, and MacMost.

- Deskulpt: deskulpt-apps.github.io, the page `guide/manager.html`.
