# Part template `animate.template`

This file tells a part agent how to animate one part of the widget kit explainer. Each part agent works on one part. Many part agents work at the same time on the same shared base.

## Rules for part agents `animate.template.rules`

- Write only your module `part_<name>.py`. Do not write other files in the repository.

- Do not run git commands. The lead agent commits your module.

- Update `durations.json` only with `durations.py`. It holds a flock on `durations.json.lock` for each write.

- Render only with `render_all.py`. Then extract frames and look at each frame.

- Do not edit the shared base files. If you need a change in them, write the change and the reason in your report.

- Do not start background agents.

## Inputs `animate.template.inputs`

- `../script.md` gives each scene: the narration and the visuals. The visuals are the authority for what is on screen.

- `../glossary.md` defines each term.

- `/Users/rohanmalik/kyaloon-media/explainer-widget-kit-2026-11-03/parts.json` lists the scenes of each part, in script order.

- `/Users/rohanmalik/kyaloon-media/explainer-widget-kit-2026-11-03/durations.json` gives each scene length in seconds, from the final audio. If a scene has no entry, `timing.py` uses the word count of the scene at 140 words per minute.

## Shared base `animate.template.base`

These files are the shared base: `style.py`, `outline.py`, `dwscene.py`, `timing.py`, `durations.py`, `render_all.py`, `mux_all.py`, `TEMPLATE.md`, `part_demo.py`.

| File | Content |
|---|---|
| `style.py` | Colors, fonts, sizes, layout lines, and shapes: `T`, `M`, `lines`, `scene_title`, `caption`, `ProcessBox`, `chip`, `status_chip`, `labeled_arrow`, `code_block`, `json_block`, `hide_lines`, `reveal_lines`, `mark_line`, `RevealTable`, `window_card`, `disk_icon`, `burst`, `spec_tag`, `inferred` |
| `outline.py` | `OutlineDiagram`, the outline of the scenes `outline_today` and `outline_kit`. It has node keys, `node`, `box`, `highlight`, `reset`, `zoom_target`, `open_part`, and `close_part`. |
| `dwscene.py` | `DWScene`, the base class of each scene. It gives beats, the spec tag, the size lint, and the report. |
| `timing.py` | Scene lengths and beat plans. Run `timing.py` to print each scene length and its source. |
| `durations.py` | Writes scene lengths into `durations.json` under the flock. |
| `render_all.py` | Renders scenes and checks them. |
| `mux_all.py` | Adds the audio to each scene and joins the scenes. The lead agent runs it. |
| `part_demo.py` | One working example scene, `DemoOutlineTable`. Read it first. |

## Parts and outline keys `animate.template.parts`

Each part opens on the outline at its key and closes on the outline at the same key. The close then lights the key of the next part. Pass the keys in the `also` column to `open_part(..., also=(...))`, and the arrows in the `arrows` column to `arrows=(...)`.

| Part | Scenes | Open key | also | arrows | Next key |
|---|---|---|---|---|---|
| `part_intro` | `cold_open` `outline_today` `outline_kit` `direction_list` `example_cast` | none, see `animate.template.intro` | | | `shell` |
| `part_today` | `today_shell` `today_component_set` `today_creation` `today_paths_map` `today_serving` `today_agent_text` | `shell` | | | `agent_library` |
| `part_library` | `library_why` `library_split` `library_contract` `library_agent_code` `library_catalog` `library_work` | `agent_library` | | | `vite_build` |
| `part_vite` | `vite_gate` `vite_inputs_outputs` `vite_numbers` `vite_cache` `tailwind_source` `render_check` `vite_failures` `vite_work` | `vite_build` | | | `type_gate` |
| `part_types` | `types_why` `types_tsc` `types_config` `types_tsgolint` `types_error_path` `types_work` | `type_gate` | `vite_build` | `arrow_type_vite` | `kit_project` |
| `part_packaging` | `pnpm_terms` `kit_project` `strategy_fresh_install` `pnpm_strict_builds` `strategy_kit_lockfile` `pnpm_trust_lockfile` `kit_lockfile_failures` `strategy_shared_chunks` `strategy_compare` `packaging_work` | `kit_project` | | | `host_extras` |
| `part_host` | `host_today` `host_bundle` `host_external` `host_native` `host_rules` `host_work` | `host_extras` | `host` | `link_host_extras` | `pin` |
| `part_pin` | `pin_question` `example_v2a` `example_v2b_types` `example_v2b_render` `shared_chunks_swap` `pin_policy` `pin_work` | `pin` | `kit_project` `pinned_pages` | `line_pin` | `describe` |
| `part_describe` | `describe_problem` `describe_test` `describe_results` `describe_rule` `describe_cost` `describe_work` | `describe` | `mcp_door` `agent` | `arrow_describe` | `kit_config` |
| `part_config` | `config_place` `config_setting` `kit_read_describe` `kit_add_remove` `kit_errors` `add_steps` `add_example` `config_work` | `kit_config` | `kit_project` `mcp_door` | `arrow_door_kit` | `settings_pane` |
| `part_settings` | `kit_routes` `settings_rules` `kit_feed` `settings_pane` | `settings_pane` | | `arrow_settings_kit` | `electron_main` |
| `part_serving` | `serving_today` `serving_slug` `serving_rebuild` `serving_csp` | `electron_main` | `pinned_pages` | `arrow_pinned_em` | `checks` |
| `part_checks` | `checks_list` `checks_today` `tla_models` | `checks` | | | `kit_row` |
| `part_close` | `prior_art` `risks_build` `risks_supply` `work_map` `open_items` `closing` | `kit_row` | `today_row` | | none, see `animate.template.close` |

The open key goes in the first scene of the part. The close goes in the last scene of the part. The node keys and the arrow keys are in the top comment of `outline.py`. A container key (`today_row`, `kit_row`, `gates`, `windows`) also lights its members.

### Intro `animate.template.intro`

The scene `cold_open` does not show the outline. It sets `SPEC_TAG = False`, because it shows the spec tag for the first time. It adds `self.spec_tag` with an animation.

The scenes `outline_today` and `outline_kit` draw the outline at full size. Use `FadeIn(outline)`, then `outline.highlight(...)` on each box as the narration names it. Light the members of `today_row` in path order, then the members of `kit_row`, then the doors and the side boxes.

The last scene `example_cast` closes with `close_part(self, "kit_row", next_key="shell")`.

### Close `animate.template.close`

The scene `closing` shows the outline at full size with both rows lit: `outline.highlight("today_row", "kit_row")`. It does not call `close_part`.

## Module layout `animate.template.layout`

1. Make one module for your part: `part_<name>.py`, for example `part_vite.py` for the part `part_vite`.

2. Start the module with `from dwscene import *`.

3. Make one class for each scene of the part. The class name is the scene name in CamelCase. For example, the scene `vite_gate` gets the class `ViteGate`.

4. Write each class as `class ViteGate(DWScene):` on one line. `render_all.py` finds scenes with this exact form.

5. Keep helpers that only your part uses in your module. Give them names that start with `_`.

## Beats `animate.template.beats`

A beat is one step of a scene, for example one sentence group of the narration. The scene length comes from the audio. Thus you do not set seconds. You set weights.

```python
class ViteGate(DWScene):
    BEATS = [("open", 2), ("layout", 3), ("folder", 2)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "vite_build", run_time=b.left)
        with self.beat("layout") as b:
            self.play(FadeIn(card), run_time=b.t(0.5))   # half of this beat
        ...
```

- A beat gets the scene length times its weight, divided by the sum of the weights.

- Give a beat a weight that matches its share of the narration words.

- Use the beats in the order of `BEATS`. Use each beat one time.

- In a beat, give each `play` a `run_time` from `b.t(fraction)` or `b.left`. Do not use plain seconds.

- At the end of the `with` block, the scene waits until the beat ends. Thus the scene length matches the audio.

- If the animations of a beat take more time than the beat, the report shows an overrun. Make the animations shorter.

## Outline `animate.template.outline`

- To open: `OutlineDiagram().open_part(self, "<key>", run_time=b.left, also=(...), arrows=(...))`. It lights the boxes, zooms into the key, and removes the outline. After it, the camera is back at the full frame.

- To close: `outline.close_part(self, "<key>", next_key="<next key>", run_time=b.left)`. It removes the other objects, shows the outline zoomed into the key, zooms out, and lights the next key.

- Show the outline at full size only. A smaller outline breaks the text size rule. In the middle of a part, show the concept with `scene_title` in its concept color.

- Do not move the camera in other ways. If you must, put it back with `OutlineDiagram.camera_home(self)` before the beat ends.

- Animate the outline only with `highlight`, `reset`, `open_part`, and `close_part`. They animate the whole outline as one group. A separate `AnimationGroup` of outline parts makes Manim draw the arrows over the tags.

## Spec tag `animate.template.spec_tag`

The script keeps the amber tag `direction in progress, not a decided spec` on screen for the whole video.

- `DWScene` adds the tag to each scene in the bottom-right corner. The tag stays in place when the camera zooms.

- `close_part` does not remove the tag. Do not remove it yourself.

- Keep the bottom-right corner free, right of `TAG_LEFT` and below `CONTENT_BOTTOM`. `caption` already stays left of the tag.

## Screen rules `animate.template.screen`

- Use the color of the concept for each concept. Do not add new colors. The colors are in `style.py`, and the `CONCEPT` table maps a concept name to its color.

- Show an inferred number in amber with the word inferred. Use `inferred(value)`. Show a measured number in white.

- Do not use text smaller than `MIN_FONT_SIZE` (22). It gives a cap height of about 20 px at 720p.

- Keep content between `CONTENT_TOP` and `CONTENT_BOTTOM`. Put the scene title at `TITLE_Y` with `scene_title`.

- Captions are optional. A caption is a short label in the bottom strip, not a subtitle. Use `caption(text)` for it.

- Show a long table with `RevealTable`, one row at a time. Show long JSON or code with `hide_lines` and `reveal_lines`.

- Use `Text`, `MarkupText`, and `Code` only. LaTeX is not installed.

- Use only the values that the script shows. Label anything that a model would make as illustrative.

| Concept | Name in `style.py` |
|---|---|
| The widget kit, the kit project, kit versions | `KIT` |
| Vite build per widget | `VITE` |
| pnpm: store, lockfile, fetch, install, registry | `PNPM` |
| Host extras: bundle, external, native addon | `HOST_EXTRAS` |
| Pin or rebuild | `PIN` |
| MCP description: instructions, tool descriptions, kit manifest | `DESCRIBE` |
| Kit config: `kit.json`, the setting, kit errors | `CONFIG` |
| Settings pane and `/api/kit` routes | `SETTINGS` |
| Serving: Electron main, `dsh-app://`, page per slug, CSP | `SERVING` |
| Checks: smoke, MCP tests, TLA+ models | `CHECKS` |
| Gates: compile, lint, test run, type gate, render check | `CREATION` |
| Host process | `HOST` |
| MCP server and tools | `MCP` |
| Shell page, widget windows, pages | `SHELL` |
| Agent and agent-written code | `AGENT` |
| Errors and risks | `ISOLATION` |
| Inferred number, spec tag | `INFERRED` |

## Durations `animate.template.durations`

Write a scene length only with `durations.py`. Use the Manim venv Python.

- If `audio-final/<scene>.wav` exists, run `durations.py set <scene> ...`. It reads the length of each file.

- If you cut the audio yourself, run `durations.py set-value <scene> <seconds>`.

- Run `durations.py show` to see each entry.

## Check `animate.template.check`

Run this check for each scene before you report. Use the Manim venv Python.

1. Render the part and extract frames:

   ```bash
   /Users/rohanmalik/.venvs/kyaloon-manim/bin/python render_all.py part_<name> --frames 0.2 0.5 0.8
   ```

2. Make sure that the exit code is 0. Exit code 1 is a failed render. Exit code 2 is a length that is off by more than 0.1 s. Exit code 3 is a warning from the size lint, the frame lint, or a beat overrun.

3. Open each frame in `render/frames/<scene>_<pct>.png` and look at it.

4. Look for text that overlaps and for text outside the frame. Also look for small text and for wrong concept colors.

5. If you find a problem, fix your module and run the check again.

6. In your report, give the exit code and the frame paths that you looked at.

The lint checks text only at the end of each beat. Thus the frames are necessary.

## Outputs `animate.template.outputs`

All outputs go to `/Users/rohanmalik/kyaloon-media/explainer-widget-kit-2026-11-03/render/`. Do not put them in git.

| Path | Content |
|---|---|
| `scenes/<scene>.mp4` | The rendered scene. A new render moves the old file to `scenes/old/`. |
| `frames/<scene>_<pct>.png` | The extracted frames. |
| `reports/<scene>.json` | The beats, the warnings, and the lengths. |
| `logs/<scene>.log` | The Manim output. |
| `media/<module>/` | The Manim media folder of each module. Each module has its own folder, so parallel renders do not collide. |
