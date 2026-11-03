# Part template `animate.template`

This file tells a part agent how to animate one part of the deepWidgets explainer. Each part agent works on one part. Many part agents work at the same time on the same shared base.

## Inputs `animate.template.inputs`

- `../script.md` gives each scene: the narration and the visuals. The visuals are the authority for what is on screen.

- `../glossary.md` defines each term.

- `/Users/rohanmalik/kyaloon-media/explainer-deepwidgets-2026-11-02/parts.json` lists the scenes of each part, in script order.

- `/Users/rohanmalik/kyaloon-media/explainer-deepwidgets-2026-11-02/durations.json` gives each scene length in seconds, from the final audio. If a scene has no entry, `timing.py` uses the word count of the scene at 140 words per minute.

## Shared base `animate.template.base`

Do not edit these files: `style.py`, `outline.py`, `dwscene.py`, `timing.py`, `render_all.py`, `mux_all.py`, `TEMPLATE.md`, `part_demo.py`. If you need a change in them, write the change and the reason in your report. Do not work around the base in your module.

| File | Content |
|---|---|
| `style.py` | Colors, fonts, sizes, layout lines, and shapes: `T`, `M`, `lines`, `scene_title`, `caption`, `ProcessBox`, `chip`, `status_chip`, `labeled_arrow`, `code_block`, `json_block`, `hide_lines`, `reveal_lines`, `mark_line`, `RevealTable`, `window_card`, `disk_icon`, `burst` |
| `outline.py` | `OutlineDiagram`, the outline from the scene `outline`. It has node keys, `highlight`, `reset`, `zoom_target`, `open_part`, and `close_part`. |
| `dwscene.py` | `DWScene`, the base class of each scene. It gives beats, the size lint, and the report. |
| `timing.py` | Scene lengths and beat plans. Run `timing.py` to print each scene length and its source. |
| `render_all.py` | Renders scenes and checks them. |
| `mux_all.py` | Adds the audio to each scene and joins the scenes. |
| `part_demo.py` | One working example scene, `DemoOutlineTable`. Read it first. |

## Module layout `animate.template.layout`

1. Make one module for your part: `part_<name>.py`, for example `part_runtime.py` for the part `part_runtime`.

2. Start the module with `from dwscene import *`.

3. Make one class for each scene of the part. The class name is the scene name in CamelCase. For example, the scene `queue_rule` gets the class `QueueRule`.

4. Write each class as `class QueueRule(DWScene):` on one line. `render_all.py` finds scenes with this exact form.

5. Keep helpers that only your part uses in your module. Give them names that start with `_`.

## Beats `animate.template.beats`

A beat is one step of a scene, for example one sentence group of the narration. The scene length comes from the audio. Thus you do not set seconds. You set weights.

```python
class QueueRule(DWScene):
    BEATS = [("lane", 2), ("jobs", 3), ("mutant", 3), ("caption", 1)]

    def construct(self):
        with self.beat("lane") as b:
            self.play(Create(lane), run_time=b.t(0.5))   # half of this beat
        with self.beat("jobs") as b:
            self.play(LaggedStart(*moves), run_time=b.left)  # the rest of this beat
        ...
```

- A beat gets the scene length times its weight, divided by the sum of the weights.

- Give a beat a weight that matches its share of the narration words.

- Use the beats in the order of `BEATS`. Use each beat one time.

- In a beat, give each `play` a `run_time` from `b.t(fraction)` or `b.left`. Do not use plain seconds.

- At the end of the `with` block, the scene waits until the beat ends. Thus the scene length matches the audio.

- If the animations of a beat take more time than the beat, the report shows an overrun. Make the animations shorter.

## Outline `animate.template.outline`

The first scene of a part opens on the outline. The last scene of a part closes on it.

- To open: `OutlineDiagram().open_part(self, "<key>", run_time=b.left)`. It lights the box, zooms into it, and removes the outline. After it, the camera is back at the full frame.

- To close: `outline.close_part(self, "<key>", next_key="<next key>", run_time=b.left)`. It removes the other objects, shows the outline zoomed into the box, zooms out, and lights the next box.

- Show the outline at full size only. A smaller outline breaks the text size rule. In the middle of a part, show the concept with `scene_title` in its concept color.

- Do not move the camera in other ways. If you must, put it back with `OutlineDiagram.camera_home(self)` before the beat ends.

- The node keys are in the top comment of `outline.py`.

## Screen rules `animate.template.screen`

- Use the color of the concept for each concept. Do not add new colors. The colors are in `style.py`.

- Do not use text smaller than `MIN_FONT_SIZE` (22). It gives a cap height of about 20 px at 720p.

- Keep content between `CONTENT_TOP` and `CONTENT_BOTTOM`. Put the scene title at `TITLE_Y` with `scene_title`.

- Captions are optional. A caption is a short label in the bottom strip, not a subtitle. Use `caption(text)` for it.

- Show a long table with `RevealTable`, one row at a time. Show long JSON or code with `hide_lines` and `reveal_lines`.

- Use `Text`, `MarkupText`, and `Code` only. LaTeX is not installed.

- Use only the values that the script shows. Label anything that a model would make as illustrative.

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

All outputs go to `/Users/rohanmalik/kyaloon-media/explainer-deepwidgets-2026-11-02/render/`. Do not put them in git.

| Path | Content |
|---|---|
| `scenes/<scene>.mp4` | The rendered scene. A new render moves the old file to `scenes/old/`. |
| `frames/<scene>_<pct>.png` | The extracted frames. |
| `reports/<scene>.json` | The beats, the warnings, and the lengths. |
| `logs/<scene>.log` | The Manim output. |
| `media/<module>/` | The Manim media folder of each module. Each module has its own folder, so parallel renders do not collide. |

The lead agent runs `mux_all.py`. Part agents do not run it.

## Commits `animate.template.commits`

- Add only your module: `git add docs/explainers/2026-11-02-deepwidgets/manim/part_<name>.py`.

- Do not edit the script files or the shared base files.
