# Plan for the modes skeleton `modes.plan`

This plan implements `docs/specs/modes.md`. The process is `widget_mvp.plan.process`.

## Units `modes.plan.units`

| Unit | Change | Check | Mutant that must fail the check | Needs |
|---|---|---|---|---|
| `modes.skeleton` | All of `modes` | `tools/widgets-mcp.mjs` and `tools/widgets-create.mjs` pass. `deepwidgets_modes` lists `interact` and `create` only. The check writes `{ "modes": { "create": false } }` to the settings file. Then `widget_install`, `widget_reload`, and `widget_remove` return `mode-off`, and no widget changes. The error names the mode, the setting, and the path. After the file goes back to `true`, `widget_install` works with no restart. A file that does not parse turns no mode off, and `deepwidgets_modes` reports the error. `widget_guide` gives a different guide for each mode. `widget_describe` gives `source` for an installed widget and no `source` for `sample`. | Remove the gate from `widget_install`: the install with `create` off succeeds, and the check fails. | none |
