# Window manager `window_manager`

This spec builds the window manager of each widget window. The operator gave the direction from 2026-11-23 to 2026-11-26. The design talk and its facts are in `docs/explore/window-manager.md` (`wm_design`). This spec uses those decisions, and it does not repeat their reasons.

The work has three stages, in this order:

- **user:** the operator controls each widget window on the window itself.

- **settings:** the same controls show in the row of each widget, in the panel.

- **agents:** agents get the same controls through MCP tools.

## Terms `window_manager.terms`

- **Window data:** the shown state, the layer, the lock, the position, the size, and the resize flag of one widget window. The slug is its key.

- **Layer:** `top` or `normal`. A window of the layer `top` shows above each app window. A window of the layer `normal` behaves as an app window, so another app window can cover it.

- **Lock:** a locked window can not move. It still takes clicks.

- **Bar:** the strip that shows at the top of a widget window when the mouse is over the window.

- **Operator choice:** a value of the window data that the operator set, on the bar or in the panel.

- **Agent default:** a value of the window data that the widget definition gives. Only a new widget gets it.

- **New widget:** a slug that has no window record.

- **Default position:** the place of a window that has no stored position. Each layer has its own default position.

## The decisions `window_manager.decisions`

| Decision | Source |
|---|---|
| The runtime `@deepwidgets/widgets` keeps the window data. No new plugin. | `wm_design.owner` |
| Move, resize, size, layer, lock, reset position, and one display place. No snap, no opacity, no desktop level, no click-through. | `wm_design.operations` |
| A bar on hover, with a drag handle, a layer button, and a lock button. No Hide button. | `wm_design.controls` |
| An operator choice stays through each event, except the Remove of `main`. An agent default applies only to a new widget. | `wm_design.persistence` |
| The reset goes in the panel. One desktop only is not in scope. The screenshot tool goes in `interact`. The tools that change a window go in a new gated mode `window`. An agent can change only a field with no operator choice. | `wm_design.derived` |
| The first code unit adds the shown-state line to `head.status` in `CLAUDE.md`. | The operator, 2026-11-26 |

## The window data `window_manager.data`

The table `windows` of the storage domain `widgets` keeps one record for each slug (`main_widget.window_state`). This spec adds fields to that record.

| Field | Values | Default | Who can change it |
|---|---|---|---|
| `shown` | `true`, `false` | `true` | The operator, in the panel (`main_widget.window_state`) |
| `layer` | `top`, `normal` | The agent default, else `top` | The operator, and an agent |
| `locked` | `true`, `false` | `false` | The operator, and an agent |
| `x`, `y` | Screen points | None. The window uses the default position of its layer. | The operator by a drag, and an agent |
| `width`, `height` | Screen points | The agent default, else 320 by 300 | The operator at the window edges, and an agent. Only when `resizable` is true. |
| `resizable` | `true`, `false` | The agent default, else `false` | Nobody after the first record |
| `chosen` | The names of the fields with an operator choice | None | The runtime, at each operator change |

- A write of the window data is one job on the domain write chain, as a Show or a Hide is today. The last request wins.

- The frames `hello`, `added`, and `window` of `GET /api/widgets/events` carry the whole window data of the slug. A missing field means its default.

- The frames never name `main`. Electron main opens no window for `main`.

## The agent defaults `window_manager.defaults`

- A widget definition gets the optional field `window`, with the optional fields `layer`, `width`, `height`, and `resizable`.

- The runtime checks the field at registration. A bad value fails the registration with a `TypeError`, as a bad `catalog` does.

- When a slug has no window record, the runtime writes one record with the agent defaults. Thus a new widget gets the agent defaults.

- A reinstall, a reload, and a Turn on of a slug with a record change nothing in the record. This also holds for a field with no operator choice.

- The Remove of `main` deletes the record (`main_widget.window_state`). The next install of the slug is a new widget.

- An agent `widget_remove` keeps the record, as it keeps a Hide today.

- The template and the guide of `deepwidgets/mcp` tell the agent about the field `window`.

## The bar `window_manager.bar`

- Electron main adds the bar to each widget window. The bar is a separate view over the page, not a part of the page. Thus the page of an agent can not hide, change, or click the bar.

- The bar is 24 points high, at the top of the window, over the page. It shows only while the mouse is over the window.

- The bar has three controls:

  - **Drag handle:** a drag moves the window. A locked window shows the handle as off, and the handle does not move the window.

  - **Layer button:** it changes the layer from `top` to `normal`, and back.

  - **Lock button:** it locks or unlocks the window.

- The bar has no Hide button.

- The bar talks only to Electron main, over its own IPC channel. It never calls a route of the widget origin. A route under `/api/widgets/<slug>/` is open to the page of the slug (`agent_library.serving.routes`). Thus a bar call through the widget origin would let an agent page act as the operator.

- Electron main writes each operator choice to the host route `window_manager.route`.

- Electron main finds the mouse with `screen.getCursorScreenPoint()`. It does not use the page for this, because the page is agent code.

## Move and resize `window_manager.move`

- After a drag, Electron main sends the new position to the host one time. It does not send the position during the drag.

- Electron main tells a move by the operator from its own move. On macOS, `moved` also comes for a move from code.

- A window with `resizable` true resizes from its edges. Electron main sends the new size to the host one time, after the resize.

- A window with `resizable` false does not resize.

- At each open, and at each change of the displays, Electron main checks the position of each window. When the window touches no display, it moves to the default position of its layer. This move is not an operator choice.

- The default position of each layer is on the primary display. `window_manager.provisional` gives the two places.

- A window of the layer `top` has `alwaysOnTop` true. A window of the layer `normal` has `alwaysOnTop` false. Both layers stay visible on all Spaces, with `skipTransformProcessType: true`.

## The host route `window_manager.route`

- `POST /api/widget-windows/<slug>` takes a part of the window data: `layer`, `locked`, `x` and `y`, `width` and `height`, or `reset`. Each value in it is an operator choice.

- The route is not under `/api/widgets/<slug>/`. Thus a widget origin does not forward it, and an agent page can not call it (`widgetRoute` in `apps/desktop/src/deepwidgets-origin.ts`).

- `reset` deletes `x`, `y`, and their operator choice. The window then moves to the default position of its layer.

- A size for a slug with `resizable` false gives the error `not-resizable`.

- The route refuses `main` and a slug with no live or failed entry, as the actions `show` and `hide` of `main` do.

## The panel `window_manager.panel`

- The row of each widget in the Widgets tab shows the layer, the lock, and the position.

- The row gets three controls: the layer, the lock, and Reset position.

- Each control is an action of `main`, as Show and Hide are. The MCP server hides these actions, as each action of `main`.

- An action of `main` puts only its host call in `host(...)` (`main_widget.reviews`).

- Each change on the bar shows in the row at once, and each change in the row shows on the window at once.

## The agent tools `window_manager.tools`

- A new gated mode `window` has the tools `window_get` and `window_set`. The setting is `modes.window` in `$DSH_HOME/deepwidgets/settings.json` (`modes.settings`).

- The Settings tab of `main` gets one switch for `window` (`main_widget.settings`).

- `window_get` gives the window data of a slug, with `chosen`.

- `window_set` changes `layer`, `locked`, `x` and `y`, or `width` and `height`. A field with an operator choice gives the error `operator-choice`. Its next step tells the agent to ask the operator. A value that an agent sets is not an operator choice.

- `window_set` does nothing for a field that it refuses. A call with one refused field changes no field.

- Both tools treat `main` as a slug that does not exist (`main_widget.widget`).

- The tool `widget_screenshot` belongs to the mode `interact`. It gives a PNG of the page of one widget window, as an MCP image.

- Electron main makes the image with `webContents.capturePage()`. The host asks for it over IPC, as it asks for the render check (`apps/desktop/src/deepwidgets-render-check.ts`).

- The image holds the page only, without the bar and without the screen around the window.

- A hidden window gives the error `window-hidden`. Its next step tells the agent to ask the operator to show the widget.

## Errors `window_manager.errors`

| Code | When |
|---|---|
| `not-resizable` | A size for a slug with `resizable` false |
| `operator-choice` | `window_set` names a field with an operator choice |
| `window-hidden` | `widget_screenshot` names a hidden window |
| `no-window` | The slug has no live or failed entry |
| `mode-off` | The mode `window` is off (`modes.refusal`) |

## Provisional choices `window_manager.provisional`

The operator did not decide these items. A later decision can change each one.

| Item | Choice |
|---|---|
| The default position of `top` | The column at the left edge of the primary display, as today |
| The default position of `normal` | A column at the right edge of the primary display |
| The lock and the size | A lock stops a move. It does not stop a resize. |
| The hover check | Electron main reads the mouse position 10 times each second, while a widget window shows. |
| The bar height | 24 points |

## Checked facts `window_manager.checked`

| Fact | Label |
|---|---|
| A widget origin forwards only `/api/widgets/<slug>/`. Another path under `/api/widgets/` gets 403 or 404. Any other path gets 404. | verified (read `widgetRoute`) |
| Widget windows have no preload. | verified (read `deepwidgets-windows.ts`) |
| No widget page has a drag area today. | verified (`git grep app-region`) |
| Electron 44.7.0 has `setBounds`, `setAlwaysOnTop`, `setMovable`, `setResizable`, `will-move`, `moved`, `resized`, the `screen` display events, and `webContents.capturePage`. | verified (`electron.d.ts`) |
| A window of the type `desktop` gets no focus, no key events, and no mouse events. | verified (Electron docs) |
| The MCP core 2.2.0 has `ImageContentSchema`. | verified (read the package) |

## Open points `window_manager.open`

- **A drag area in a child view:** nobody checked if `app-region: drag` in a separate view moves the parent window in Electron 44.7.0. The unit `wm.bar` checks it first. If it does not work, the bar sends the pointer moves to Electron main, and Electron main moves the window.

- **The layer `normal` in a menu bar app:** nobody checked what a click on a window of the layer `normal` does to the app in front. The unit `wm.bar` records the result.

- **A capture of a window behind other windows:** nobody checked if `capturePage` gives the page of a window that another window covers. The unit `wm.screenshot` checks it.

## Not in this spec `window_manager.later`

- Snap to edges or to a grid

- Opacity

- A choice of display

- One desktop only (`standing.waiting.main_desktop_only`)

- The desktop level and click-through. The operator does not need them.
