# Modes skeleton `modes`

This spec is stage 2 of the build order. It gives the MCP server one frame for agent modes. Each later stage adds its mode to this frame and does not change the frame. The operator gave the direction on 2026-11-10. The research is in the modes spike, `~/.deepwidgets/spikes/modes/research.md`.

## Terms `modes.terms`

- **Mode:** one kind of job that an agent does through MCP. Each mode has a goal, a set of tools, and a guide.

- **Gated mode:** a mode that a setting can turn off.

- **Settings file:** the JSON file `$DSH_HOME/deepwidgets/settings.json`. Until a settings UI exists, the settings come from this file.

## The modes `modes.list`

The full list of modes is `interact`, `create`, `kit`, `library`, and `plugin`. This spec builds only `interact` and `create`. A later stage adds `kit`, `library`, or `plugin` when it ships. Until then, the server does not show that mode.

| Mode | Goal | Tools | Gated |
|---|---|---|---|
| `interact` | Use widgets that exist | `widget_describe`, `widget_call`, `widget_changes` | No |
| `create` | Write, change, or remove a widget | `widget_template`, `widget_install`, `widget_reload`, `widget_remove` | Yes, by the setting `modes.create` |

`widget_list` and `widget_guide` are shared tools. They belong to no single mode, and they always answer.

## The modes tool `modes.tool`

- The server has a tool `deepwidgets_modes`, with `readOnlyHint`. It takes no arguments.

- It returns each mode with these fields: the name, the goal, `on`, the setting that turns it off, the tools, and the guide to read.

- It also returns the path of the settings file. If the file does not parse, the answer includes the parse error.

- The server makes the answer at each call, so it shows the settings as they are at that call.

## Server instructions `modes.instructions`

- The server `instructions` text is one line: "Call deepwidgets_modes first."

- The text holds no facts about modes or settings. Claude Code reads the text once, when it connects, so a fact in the text can go stale.

## Guides `modes.guide`

- `widget_guide` takes the argument `mode`. It gives only the guide of that mode.

- The guide of `interact` is new and short. It holds the rules that the server `instructions` text holds today: pass a new `requestId` on each mutation, and call `widget_changes` with the last cursor.

- The guide of `create` is the guide that `widget_guide` gives today: the widget API types, the rules of the install gates, and the OpenUI guide.

- A guide is about a mode. It holds no facts about one widget.

## The source folder `modes.source`

- `widget_describe` gives the field `source` for a widget that `widget_install` installed. The field is the absolute path of the folder that the widget was installed from.

- A built-in widget, such as `sample`, has no `source` field.

- Thus an agent in a new chat can find the files of a widget that it must change.

## The settings file `modes.settings`

- The file holds this shape: `{ "modes": { "create": true } }`. The value `false` turns `create` off.

- The server reads the file at each call of a tool. An edit takes effect at the next call, with no restart.

- A missing file, or a missing key, means that each mode is on.

- A file that does not parse also means that each mode is on. `deepwidgets_modes` reports the parse error.

- `interact` has no setting. It is always on.

## The refusal `modes.refusal`

- Each tool of a gated mode stays in the tool list when its mode is off. Thus no `list_changed` notice is necessary, and a tool schema that the client loaded before stays valid.

- When the mode of a tool is off, the call does nothing. It returns the error code `mode-off`.

- The error names the mode, the setting, and the path of the settings file. Its next step tells the agent to ask the operator to turn the mode on.

- In this spec, `widget_install`, `widget_reload`, and `widget_remove` refuse when `create` is off. `widget_template` and `widget_guide` still answer, because they only read.

## Tool names `modes.names`

- Each tool name starts with the area of its mode: `widget_*`, `kit_*`, `library_*`, or `plugin_*`. Until a tool loads, Claude Code shows the model only the tool name. Thus the name must tell which area the tool is for.

- `deepwidgets_modes` is the one tool outside these areas, because it is about all modes.

- `widget_reload` stays. It runs the install again from the stored source folder, and it can not make a new widget by mistake.

## Not in this spec `modes.later`

- A push to Claude Code through channels. The operator set it for later.

- MCP prompts as `/` shortcuts for the operator. The operator said not now.

- A tool that switches modes. Claude Code defers the tools that the model does not use, so each unused tool costs about 8 tokens.

- A settings UI. The settings file stands in for it.
