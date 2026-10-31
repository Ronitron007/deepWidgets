# How the widget system copies DSH `mirror`

The operator asked that widget creation copy the DeepSeek Harness (DSH) architecture as closely as possible. This table shows each DSH idea and its widget form. Labels: "verified" (read or ran on 2026-10-27), "inferred", or "a guess".

## Architecture `mirror.architecture`

| DSH idea | Where DSH has it | Widget form |
|---|---|---|
| Everything is a Cordis plugin. No privileged core. | `docs/architecture.md`, "Cordis" | The runtime, the MCP server, the window manager, and each widget are plugins. |
| A bundle is config rows plus the code that they mount | `docs/architecture.md`, "Profiles and bundles" | Each widget is one bundle: `package.json` with `dsh.bundle`, one row in `cordis.patch.yml`, and `index.js`. Verified. |
| A profile stacks bundles in layers. Each row can be patched from above. | `docs/architecture.md` | The desktop profile holds the deepWidgets bundles and the installed widget bundles. A user patch can change a widget row. |
| A seam: Service Definition, Service Provider, Consumer | `docs/architecture.md`, "Capability seams" | `ctx.widgets` is the definition. Widget bundles are providers. Routes, MCP, and windows are consumers. |
| A registration is an effect that ends when its plugin stops | `ctx.tools.register`, `connection.fetch.register` | `ctx.widgets.register` removes the widget and its routes when the widget plugin stops. Verified. |
| "Where new behavior goes" table | `docs/architecture.md` | `mirror.placement` below |

## Creation `mirror.creation`

| DSH idea | Where DSH has it | Widget form |
|---|---|---|
| Skill `cordis-plugin-development` with a strict loop: resolve, discover, copy a template, install, read the result, verify, fix | `packages/preset/agent-preset/skills/cordis-plugin-development/SKILL.md:20-26` (verified) | Widget skill with the same loop: resolve the kind, slug, data, and actions; discover with `widget_list` and `widget_guide`; copy the template; save or install; call each action and render; fix in the same package. |
| Templates `decoration` and `mcp` | same skill, `templates/` | Templates `crud-widget` and `api-widget`. Both install live (verified, playground branch `rohan/playground-creation`). |
| `plugin_manager install_bundle` | `packages/boot/plugin-manager/src/index.ts:836` (verified) | `widget_install`. It runs remove and install when the slug exists, because a second install of one name is refused (verified). |
| Results `applied`, `restart-required`, `failed`, with a `nextStep` for the model | `plugin-manager/src/tools.ts:12-76` (verified) | Every `widget_*` error has a code and a `nextStep` (verified, MCP spike). |
| `cordis_inspect_list` and `cordis_inspect_query` | `cordis-host-runner`, `tool-cordis` | `widget_inspect` and `widget_guide`: live widgets, actions, components, and the OpenUI guide |
| Approval `danger-full-access` on each plugin manager action | `plugin-manager/src/tools.ts:103-109` (verified) | `agentCodePolicy` in user settings. Data widgets skip it. |
| Rule "one operation, two callers" | `references/user-actions.md` (verified) | One action, two doors: the window and the agent both call `ctx.widgets.call`. |
| Verification: only the connected page counts | `references/verification.md` | `widget_render`: a parse report and an optional page capture of the real window |
| Credentials: a config field names the key. `ctx.credentials.resolve(credentialRef(name))`. The user writes the value. `describe()` never returns it. | `settings-controller/src/credentials.ts:82-118` (verified) | The widget row declares the key name. The runtime resolves it only for that widget. The agent sees only "configured" or "not configured". |
| Never write profile files by hand, never run pnpm in the profile | `SKILL.md:8-10` | Same rules in the widget skill |

## Placement `mirror.placement`

DSH has a table "Where new behavior goes". This is the widget version.

| Goal | Mechanism |
|---|---|
| Add a widget with data and simple actions | `widget_save` (data widget), or a bundle with `crudActions` |
| Add a widget that calls an API or runs logic | A bundle from the template `api-widget`: `ctx.widgets.register` with handlers |
| Refresh data on a schedule | The runtime timer for the widget, not a raw `setTimeout` |
| Change how a widget looks | Change its stored program with `mergeStatements`. No code change. |
| Let the user tune a widget | Declare a `Config` schema in the widget. The settings window renders it. |
| Use a secret | Declare the key name in the row. Resolve it in the handler. |
| Add components | A component set in the shell catalog (`options.shell`) |
| Pair UI with plugins inside one widget | An advanced widget: page Cordis, slots, and client plugins |
| Tell agents about a user change | Nothing. Every write goes to the change feed. |
| Tell windows about any change | Nothing. Every write sends the SSE signal. |

## Where the widget system differs `mirror.differences`

| DSH | Widget system | Reason |
|---|---|---|
| The agent is inside the harness and uses `ctx.tools` | The agent is outside and uses MCP | Claude Code and other agents connect from outside. |
| UI is React code in client plugins | UI is an OpenUI program (data). Code only in advanced widgets. | An agent can change the look with no install and no approval. |
| One main window with slots | One window for each widget | Decision `widget.window` |
| WebSocket for live events | SSE for each slug | The WebSocket cookie goes only to the main window (verified). |
| `installFailLoud` stops the host on any uncaught error | The runtime must catch widget errors | One bad widget must not stop the others (`options.isolation`). |
