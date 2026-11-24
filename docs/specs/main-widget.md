# Main widget `main_widget`

This spec moves the app from the Dock to the macOS menu bar. It adds the main widget, which opens in a panel under the menu bar icon. The main widget lists each widget with its data, and it holds the settings of the app. The operator gave the direction on 2026-11-11. The decisions are `widget.app_presence`, `widget.relaunch`, `widget.main_window`, and `widget.main_loading` in `docs/explore/widget-system/where-we-stand.md`.

## Terms `main_widget.terms`

- **Menu bar icon:** the icon of the app in the macOS menu bar. Electron calls it a `Tray`.

- **Panel:** the window that opens under the menu bar icon. It shows the page of the main widget.

- **Main widget:** the built-in widget with the slug `main`. The panel is its only window.

- **Widget window:** the floating window of one widget (`widget_mvp.windows`).

- **DSH window:** the main window of today. It shows the DSH client page with `hello` and the probe text.

- **Agent widget:** a widget that `widget_install` installed. A built-in widget, such as `sample`, is not an agent widget.

## The menu bar app `main_widget.menu_bar`

- The app is an accessory app on macOS. It has no Dock icon and no application menu in the menu bar.

- The Dock icon does not show at launch, also not for a short time. Thus the app sets `LSUIElement` in its `Info.plist` and does not call `app.dock.hide()`.

- The app shows one menu bar icon for the whole run. The icon is a template image, so macOS colors it for a light and a dark menu bar.

- A click on the icon opens the panel. A click when the panel is open closes it.

- A right click on the icon opens a menu with two items: "Open deepWidgets" and "Quit deepWidgets". "Quit deepWidgets" uses the quit path of today.

- A second launch of the app opens the panel (`widget.relaunch`).

- The app does not show the DSH window. `main_widget.provisional` tells what happens to it.

- On Windows and Linux, the app keeps the behavior of today.

## Parts from outside `main_widget.parts`

The research for this spec is in `main_widget.research`.

| Need | Part | Reason |
|---|---|---|
| The panel at the menu bar icon | `electron-menubar` 11.1.1, the maintained fork of `menubar` by Gitify | It puts the window at the icon, closes it on a loss of focus, and shows it over an app in full screen. It accepts our own `Tray`. Version 11.1.2 and later need Electron 44.9.1, and `head.rules` keeps Electron at 44.7.0. |
| No Dock icon | The key `LSUIElement` in `mac.extendInfo` of `apps/desktop/scripts/electron-builder-config.mjs`, and the same key in the dev app of `apps/desktop/scripts/development-app.ts` | `app.dock.hide()` and the accessory activation policy show the Dock icon for a short time at launch. |
| Launch at login | `app.setLoginItemSettings` of Electron | It uses `SMAppService` of macOS. The package `auto-launch` is old and does not use it. |
| The state viewer | `react-json-view-lite` 2.5.0 | It is 2.2 kB gzip, has no dependencies, and supports React 18. |
| The menu bar icon | `trayTemplate.png` and `trayTemplate@2x.png`, 16 and 32 pixels, black with alpha | macOS colors a template image. The script `render-tray-icon.ts` already renders the tray icon of Windows. |

## The panel `main_widget.panel`

- The panel is a normal `BrowserWindow` with no frame, not a window of `type: 'panel'`. It opens below the menu bar icon, on the display of the icon.

- The panel does not show in the window switcher.

- The panel opens on the active Space, also over an app in full screen.

- The panel closes when it loses focus.

- The panel takes keyboard focus when it opens. Copy, paste, select all, and undo work in its text fields.

- The panel loads the page of the main widget from disk, so it needs no host to load. While the host starts or restarts, the page shows the loading state of the core (`widget.main_loading`).

## The main widget `main_widget.widget`

- `main` is a built-in slug (`widget.builtin_slugs`). `widget_install` gives `slug-taken` for it.

- The main widget has no widget window. Electron main does not open a floating window for `main`.

- The main widget is for the operator only. The MCP server does not show it to agents:

  - `widget_list` does not list `main`.

  - `widget_describe`, `widget_call`, and `widget_changes` treat `main` as a slug that does not exist.

- The reason for this rule: the actions of `main` change the settings and other widgets. An agent call to them can turn on a mode that the operator turned off.

- The page of the main widget is a second entry of the shell build, `main.html`. It mounts the core of `@deepwidgets/widget-kit` with its own child (`agent_library.main_split`).

- The panel loads the page from the widget origin of `main`, at `dsh-app://w-main.widget/widget/main.html?slug=main`. The route `/widget/` of a widget origin serves the shared shell (`agent_library.serving.routes`).

- The child of `main` has its own component set, `deepwidgets-main@1`. The set holds the parts of the two tabs, such as the widget table and the state viewer.

- The page has two tabs: Widgets (`main_widget.widgets`) and Settings (`main_widget.settings`).

## The program of a built-in widget `main_widget.seed`

- Today the host stores the program of a built-in widget one time, at its first start. Later, nothing replaces it. Thus a new program of `main` never reaches a profile that ran an older `main`. A review of `main.page` found this.

- At each start, the host compares the seed hash of a built-in widget with the seed hash in its stored program record (`widget_fv.install`). When the two differ, the host stores the new seed program and its hash in one write.

- An agent widget keeps the rules of `widget_fv.install`.

## The catalog of a widget `main_widget.catalog`

- A widget definition gets the optional field `catalog`. The default value is `shadcn-widgets@1`.

- The answer of `GET program` gives `catalog`. The answer of `describe()` also gives it.

- The main widget sets `catalog` to `deepwidgets-main@1`. Thus the default shell page refuses the program of `main`, and the page of `main` refuses the program of each other widget.

## The Widgets tab `main_widget.widgets`

The Widgets tab shows one row for each widget. It also shows a widget that the operator turned off, and a widget that safe mode keeps off. The tab has no row for `main`.

Each row shows these fields:

| Field | Value |
|---|---|
| Slug and title | From `list()` |
| Status | Live, failed with the reason (`widget_phase2.isolation.blame`), off in safe mode, or turned off |
| Catalog | The `catalog` of `main_widget.catalog` |
| State | The state JSON and its rev, in a viewer that can fold and unfold each level |
| Program | The program rev. The program text shows when the operator opens it. |
| Actions | The name, the kind, the args schema, and the timeout of each action |
| Source | The source folder of an agent widget (`modes.source`) |
| Row | The plugin row id and the package name |
| Window | Shown or hidden |

Each row has these controls:

- **Show and Hide:** shows or hides the widget window. The host keeps the choice (`main_widget.window_state`).

- **Turn off and Turn on:** turns the plugin row of the widget off or on. It uses `setPluginEnabled` of the DSH plugin manager. A widget that is off has no window and no routes. Its state stays.

- **Remove:** removes an agent widget. It uses the same path as `widget_remove`, so the state stays. The page asks the operator to confirm first. A built-in widget has no Remove control.

The tab shows each change at once. A change can be a new widget, a removal, a state write, a program write, or a window change.

## The shown state of a window `main_widget.window_state`

- The host keeps the shown state of each widget window across restarts. A new widget starts as shown.

- Each frame of `GET /api/widgets/events` carries the shown state. Electron main obeys it: it shows or hides the widget window.

- This is the first part of the host half of the window manager (`widget.window_manager`).

## The Settings tab `main_widget.settings`

The Settings tab has these sections:

| Section | Control | The source of the value |
|---|---|---|
| MCP modes | One switch for each gated mode. `interact` shows as always on. | The settings file of `modes.settings` |
| Approved agents | One row for each agent, with its name, its approval time, its last use, and a Revoke button | `mcp_consent.agents`. Until `mcp.consent_server` ships, the section says that the consent server is not built yet. |
| MCP port | The port number and the path of `mcp.json`. Each one has a copy button. The operator can not change them. | `mcp.json`, which Electron main writes (`safe_host.port`) |
| Launch at login | One switch, and the status that macOS gives: `enabled`, `requires-approval`, `not-registered`, or `not-found` | Electron main |

- A change takes effect at once, with no restart.

- After each change of the launch-at-login switch, Electron main reads the status again. The set call of Electron gives no error, so the status is the only answer.

- In a dev run, the launch-at-login switch is off, and the section says that it needs a packaged app. A dev run registers no login item.

- The page talks only to the host (`widget.page_channel`). Thus the host passes the launch-at-login switch to Electron main. Electron main passes the status from macOS back to the host.

- A later section can come from another spec, for example the kit extras of `kit_spike`. Each section is one part of the component set `deepwidgets-main@1`.

## Provisional choices `main_widget.provisional`

The operator did not decide these items. A later decision can change each one.

| Item | Choice |
|---|---|
| Panel size | 420 by 600 pixels. The operator can not resize it. |
| The DSH window | It stays, but the app does not show it. The checks `DSH_SMOKE_HELLO`, `DSH_SMOKE_PROBE`, and `DSH_SMOKE_TRACE` keep their window. A later unit removes it with those checks. |
| A second launch | It opens the panel on the Widgets tab. |
| The program text | Read only in the panel |
| The MCP port | Read only. A change of the port is for later. |

## Risks `main_widget.risks`

- Electron issue 53889 is open for Electron 44 on macOS 27. A click in a panel window activates the app. This Mac runs macOS 27.0. The panel is a normal window, but the unit `app.menu_bar` must check the focus by hand.

- A call of `setVisibleOnAllWorkspaces` without `skipTransformProcessType: true` brings back the Dock icon. The widget windows and the trace window already pass that option.

- Electron says that a login item can fail when the app has no signature and no notarization. A build with an ad-hoc signature can give `not-found` after each rebuild.

- The page of another widget must not call the routes of `main`. `agent_library.serving.routes` covers this: each widget page has its own origin, and Electron main gives 403 for the path of another slug.

## Decisions of the reviews `main_widget.reviews`

The fresh reviews of the units found these points. The operator, or the lead session with the operator's rules, decided each one.

| Decision | Unit |
|---|---|
| A Turn off of the operator stays through a reinstall, a reload, and an agent `widget_remove`. Only Turn on and the Remove of `main` clear it. A reinstall of a turned-off slug installs the widget off, with the warning `turned-off`. | `main.runtime` |
| The same rule holds for Hide. Only Show and the Remove of `main` clear it. | `main.window_state` |
| `main` puts only its host calls in `widgetRecords.asHost`: the plugin manager, the installer, and the MCP settings. These calls get the 10 s limit of the host. The rest of each action of `main` keeps the 2 s limit of a widget (`widget.watchdog_rule`). Only a built-in row can call `asHost`. | `main.window_state` |
| The core of the widget page waits on `NoAnswerError` until the first `hello`, because the panel loads its page before the host is ready. The core shows each other error. | `app.menu_bar` |
| The host sends a change frame to `main` at most one time in 250 ms. The `widgets` query keeps the plugin rows until a plugin changes. | `main.page` |
| The Settings tab has one switch for each gated mode: `create` and `library`. | `main.settings` |

These limits are known, and nobody fixes them now:

- `as_host_split_hides_stall`: a loop that calls `asHost` in each turn never runs 2 s in one segment. The watchdog stops it only at 10 s, with no blame. Only built-in code can call `asHost`. The fix needs a change in the watchdog thread, which the model `crash_lifecycle` covers.

- `meta_hand_edit_stale_source`: a hand edit of the file `deepwidgets-widget.json` of a widget folder leaves the field `source` of the `widgets` query old. No operator or agent edits that file by hand.

## Research `main_widget.research`

The Look Before You Build record and the notes of the research agent are in the session scratchpad of 2026-11-11, `/private/tmp/claude-501/-Users-rohanmalik-deepWidgets/88230fd3-8317-47a0-ac44-7a6181fd4633/scratchpad/`. The files are `look-before-you-build.md` and `research-menubar/NOTES.md`.

## Not in this spec `main_widget.later`

- A change of the widget state by hand

- A change of the MCP port

- The window manager rule for all desktops or only the main desktop (`standing.waiting.main_desktop_only`)

- The removal of the DSH window and its checks. That unit also gives the DSH dialogs another parent window (`dsh_dialogs_on_hidden_window`).

- A restart state in the core of the widget page (`panel_restart_no_loading_state`). During a host restart, each window keeps its last view.

- A Turn off step in the model `widget_install` of the skill `widget-state-models`.

- The window manager plugin `@deepwidgets/windows`. Its session can move the shown state of `main_widget.window_state` into that plugin.
