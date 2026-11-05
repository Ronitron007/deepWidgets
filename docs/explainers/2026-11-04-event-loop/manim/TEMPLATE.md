# Part template `animate.template`

This file tells a part agent how to animate one part of the event loop explainer. Each part agent works on one part. Many part agents work at the same time on the same shared base.

## Rules for part agents `animate.template.rules`

- Write only your module `part_<name>.py`. Do not write other files in the repository.

- Do not run git commands. The lead agent commits your module.

- Write scene lengths into `durations.json` only with `durations.py`. It holds a flock on `durations.json.lock` for each write.

- Render only with `render_all.py`. Then extract frames and look at each frame.

- Do not edit the shared base files. If you need a change in them, write the change and the reason in your report.

- Do not start background agents.

- Show only the words that the viewer knows. On-screen text uses only two kinds of terms. The first kind is a term that `../terms.md` marks `known`. The second kind is a term that an earlier scene or the same scene teaches. The "Taught in" column of `terms.md` names the scene that teaches each term. This rule applies to titles, labels, captions, and chips. It does not apply to the text of a real code card or a real output that the script shows.

## Inputs `animate.template.inputs`

- `../script.md` gives each scene: the narration and the visuals. The visuals are the authority for what is on screen.

- `../terms.md` lists each term that the voice says. It gives the status of the term and the scene that teaches it.

- `../glossary.md` defines each term.

- `/Users/rohanmalik/kyaloon-media/explainer-event-loop-2026-11-04/parts.json` lists the scenes of each part, in script order.

- `/Users/rohanmalik/kyaloon-media/explainer-event-loop-2026-11-04/durations.json` gives each scene length in seconds, from the final audio. If a scene has no entry, `timing.py` uses the word count of the scene at 140 words per minute.

## Shared base `animate.template.base`

These files are the shared base: `style.py`, `outline.py`, `loopviz.py`, `dwscene.py`, `timing.py`, `durations.py`, `render_all.py`, `mux_all.py`, `TEMPLATE.md`, `part_demo.py`.

| File | Content |
|---|---|
| `style.py` | Colors, fonts, sizes, layout lines, and shapes: `T`, `M`, `lines`, `fit`, `scene_title`, `caption`, `ProcessBox`, `chip`, `claim_tag`, `claim_legend`, `labeled_arrow`, `code_block`, `json_block`, `hide_lines`, `reveal_lines`, `mark_line`, `RevealTable`, `window_card`, `disk_icon`, `burst`, `source_tag`, `inferred` |
| `outline.py` | `OutlineDiagram`, the outline of the scene `outline_map`. It has node keys, `node`, `box`, `highlight`, `reset`, `set_highlight_now`, `fill_in`, `fill_in_now`, `trace`, `zoom_target`, `open_part`, and `close_part`. It also has `PATH_A_KEYS`, `PATH_B_KEYS`, and `TEACH`. |
| `loopviz.py` | The event loop helpers: `CallStack`, `LoopQueue`, `LoopArrow`, and `run_next`. See `animate.template.loopviz`. |
| `dwscene.py` | `DWScene`, the base class of each scene. It gives beats, the source tag, the size lint, and the report. `from dwscene import *` also imports the outline and the loopviz helpers. |
| `timing.py` | Scene lengths and beat plans. Run `timing.py` to print each scene length and its source. |
| `durations.py` | Writes scene lengths into `durations.json` under the flock. |
| `render_all.py` | Renders scenes and checks them. |
| `mux_all.py` | Adds the audio to each scene and joins the scenes. The lead agent runs it. |
| `part_demo.py` | One working example scene, `DemoLoopviz`. It opens a part, runs the call stack, the task queue, and the loop arrow, and closes the part. Read it first. |

## Parts and outline keys `animate.template.parts`

The outline has six boxes from left to right: `widget code runs`, `notice`, `find who`, `write it down`, `start again`, and `keep it off`. Two red arrows go into `notice`: `late error` and `endless loop`. Under each of the five right boxes, a grey `?` waits for the code name of the box. A strip of the foundations is under the boxes.

Each part opens on the outline at its open key. The part closes on the outline at the same key. The close then lights the next key. Give the keys in the `also` column to `open_part(..., also=(...))`.

| Part | Open key | also | Next key |
|---|---|---|---|
| `part_intro` | none, see `animate.template.intro` | | `widget_code` |
| `part_memory` | `f_call_stack` | `widget_code` | `start_again` |
| `part_processes` | `start_again` | | `widget_code` |
| `part_loop` | `widget_code` | | `notice` |
| `part_errors` | `notice` | `late_error` | `late_error` |
| `part_context` | `late_error` | `find_who` | `endless_loop` |
| `part_threads` | `endless_loop` | `notice` | `find_who` |
| `part_boxes` | `find_who` | | `widget_pinger` |
| `part_example_throw` | `widget_pinger` | `late_error` | `widget_spinner` |
| `part_example_loop` | `widget_spinner` | `endless_loop` | `write_down` |
| `part_limits` | `write_down` | `find_who` | `all` |
| `part_close` | `all` | | none, see `animate.template.close` |

The open goes in the first scene of the part. The close goes in the last scene of the part. The next key is the open key of the next part. The one exception is `part_intro`: its next key is `widget_code`, because the chip `f_call_stack` shows only from the scene `call_stack`.

### Outline keys `animate.template.keys`

| Kind | Keys |
|---|---|
| Boxes | `widget_code`, `notice`, `find_who`, `write_down`, `start_again`, `keep_off` |
| Red arrows | `late_error`, `endless_loop` |
| Widget chips, in `widget_code` | `widget_sample`, `widget_pinger`, `widget_spinner` |
| Code names, under the boxes | `name_process_handlers` and `name_watchdog` (`notice`), `name_blame_store` (`find_who`), `name_crash_json` and `name_provisional_json` (`write_down`), `name_supervisor` (`start_again`), `name_quarantine` (`keep_off`) |
| Foundation strip | `f_call_stack`, `f_heap`, `f_task_queue`, `f_microtask_queue`, `f_event_loop`, `f_worker_thread`, `f_shared_memory` |
| Groups | `widget_chips`, `names`, `foundations`, `all` |
| Grey steps between the boxes (`arrows=`) | `arrow_notice_find_who`, `arrow_find_who_write_down`, `arrow_write_down_start_again`, `arrow_start_again_keep_off` |

A box key also lights its code names. The key `widget_code` also lights its chips. A group key lights its members.

### Term rule in the outline `animate.template.outline_terms`

The outline obeys the term rule by itself. `OutlineDiagram(self)` shows only the items that the viewer knows at the start of your scene. `TEACH` in `outline.py` gives the scene that teaches each hidden item.

- An item that a later scene teaches stays hidden. You cannot show it. `fill_in` and `trace` raise `ValueError` for it.

- An item that your scene teaches stays hidden until you bring it in. Use `self.play(outline.fill_in())` at the moment that the voice teaches it. A code name replaces the grey `?` of its box.

- `open_part` brings in a lit item that your scene teaches. `close_part` brings in every item that your scene teaches.

| Scene | Items that it brings in |
|---|---|
| `two_failures` | `widget_pinger`, `widget_spinner` |
| `call_stack` | `f_call_stack` |
| `heap_vs_stack` | `f_heap` |
| `task_queue` | `f_task_queue` |
| `event_loop` | `f_event_loop` |
| `microtasks` | `f_microtask_queue` |
| `worker_thread` | `f_worker_thread` |
| `shared_memory` | `f_shared_memory` |
| `blame_store` | `name_blame_store` |
| `crash_record` | `name_process_handlers`, `name_crash_json` |
| `watchdog` | `name_watchdog` |
| `provisional_record` | `name_provisional_json` |
| `supervisor` | `name_supervisor` |
| `quarantine` | `name_quarantine` |

### Intro `animate.template.intro`

- The scene `cold_open` does not show the outline. It shows the claim legend with `claim_legend()`.

- The scene `outline_map` draws the outline at full size with `FadeIn(outline)`. Then it lights each box when the voice names its job. The order is `widget_code`, `late_error` with `endless_loop`, `notice`, `find_who`, `write_down`, `start_again`, and `keep_off`.

- The scene `two_failures` brings in the chips `pinger` and `spinner` with `fill_in()`. It closes with `close_part(self, "widget_code", also=("late_error", "endless_loop"), next_key="widget_code")`.

### Outline in the middle of a part `animate.template.outline_mid`

Some scenes in the middle of a part start their visuals with "OUTLINE". Examples are the scenes of `part_boxes` and of the two worked examples.

1. Make the outline with `OutlineDiagram(self)`.

2. Show it at full size with `FadeIn(outline)`.

3. Light the box that the scene names with `highlight`.

4. If the scene gives a box its code name, play `outline.fill_in()`.

5. Fade the outline out before the rest of the scene, or zoom into the box with `zoom_target`.

In other scenes in the middle of a part, do not show the outline. Put a `scene_title` in the concept color.

### Close `animate.template.close`

The scene `closing` shows the outline at full size with every item lit: `outline.highlight("all")`. Every code name and every foundation chip shows, because the scenes before `closing` teach them. The scene `closing` does not call `close_part`.

To follow a failure along the boxes, use `trace`:

```python
outline.trace(self, PATH_A_KEYS, PATH_A, run_time=b.t(0.4))
```

`PATH_A_KEYS` (pinger, the late error) and `PATH_B_KEYS` (spinner, the endless loop) are the node keys of each failure, in order. `PATH_A` (red) and `PATH_B` (amber) are the colors from `style.py`. `trace` plays by itself, so do not put it in `self.play`.

## Module layout `animate.template.layout`

1. Make one module for your part: `part_<name>.py`. For example, the part `part_loop` gets `part_loop.py`.

2. Start the module with `from dwscene import *`.

3. Make one class for each scene of the part. The class name is the scene name in CamelCase. For example, the scene `one_thread` gets the class `OneThread`.

4. Write each class as `class OneThread(DWScene):` on one line. `render_all.py` finds scenes with this exact form.

5. Keep helpers that only your part uses in your module. Give them names that start with `_`.

## Beats `animate.template.beats`

A beat is one step of a scene, for example one sentence group of the narration. The scene length comes from the audio. Thus you do not set seconds. You set weights.

```python
class OneThread(DWScene):
    BEATS = [("open", 2), ("rule", 3), ("todo", 2)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram(self).open_part(self, "widget_code", run_time=b.left)
        with self.beat("rule") as b:
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

- To make the outline, use `OutlineDiagram(self)`. The argument is your scene. The outline needs it for the term rule.

- To open: `OutlineDiagram(self).open_part(self, "<key>", run_time=b.left, also=(...))`. It lights the boxes, zooms into the key, and removes the outline. After it, the camera is back at the full frame.

- To close: `outline.close_part(self, "<key>", next_key="<next key>", run_time=b.left)`. It removes the other objects, shows the outline zoomed into the key, zooms out, and lights the next key.

- Show the outline at full size only. A smaller outline breaks the text size rule.

- Do not move the camera in other ways. If you must, put it back with `OutlineDiagram.camera_home(self)` before the beat ends.

- Animate the outline only with `highlight`, `reset`, `fill_in`, `trace`, `open_part`, and `close_part`. They animate the whole outline as one group. A separate `AnimationGroup` of outline parts makes Manim take the outline apart.

## Loop helpers `animate.template.loopviz`

`loopviz.py` draws the call stack, the queues, and the event loop. Each method returns one animation. Play it with a `run_time` from the beat. Add the object to the scene before you play its methods.

The script sets fixed shapes for the whole video (scene `task_queue`):

- A pancake is one call on the call stack.

- A white cube is sync code that runs.

- A big ball is a task.

- A small ball is a microtask.

| Helper | Use |
|---|---|
| `CallStack(title="call stack", width=3.2, frame_h=0.5, max_frames=6)` | A column of pancakes on a base line. `push(label)` drops a pancake on the top. `push_cube(label=None, slots=None)` drops a white cube. With no `slots`, the cube fills the column. `pop()` lifts the top item off. `clear()` empties the stack. `mark_top(color)` recolors the top pancake, for example `ISOLATION` for a call that never returns. |
| `LoopQueue(title, color, width=6.0, shape="box")` | A queue tray. Items join at the right and leave at the left. `shape="ball"` draws big balls (tasks). `shape="small_ball"` draws small balls (microtasks). A ball label is under the ball. `enqueue(label)` adds an item. `dequeue(to=None)` removes the front item. Use `TASK` for the task queue and `MICROTASK` for the microtask queue. `show_front()` adds the word `front` at the left. |
| `run_next(queue, stack)` | The loop runs the front item of the queue. The ball moves to the top of the stack and becomes a pancake. |
| `LoopArrow(radius=0.6, title="event loop")` | The event loop as one circular arrow. `turn()` spins it one time. `sleep()` dims it and `wake()` lights it again. `freeze()` makes it grey, for a loop that cannot turn. `thaw()` gives back its color. |

- The script shows no phase ring. Thus `loopviz.py` has no phase ring.

- A pancake or an item that is too wide raises `ValueError`. Make the stack or the queue wider, or use a shorter label.

- Call the methods in play order. Each method changes the state at once: `push` adds the pancake to `stack.frames` before the animation plays.

- Play two helper animations as two arguments: `self.play(stack.pop(), loop.turn())`. Do not put them in your own `AnimationGroup` without `group=`.

- `part_demo.py` shows `push`, `push_cube`, `pop`, `enqueue`, `run_next`, `turn`, `freeze`, and `sleep`.

## Source tag `animate.template.source_tag`

The grey tag `origin/main 68aabd9a` stays in the bottom-right corner for the whole video. It names the commit that the video explains.

- `DWScene` adds the tag to each scene. The tag stays in place when the camera zooms.

- `close_part` does not remove the tag. Do not remove it yourself.

- Keep the bottom-right corner free, right of `TAG_LEFT` and below `CONTENT_BOTTOM`. `caption` already stays left of the tag.

## Screen rules `animate.template.screen`

- Use the color of the concept for each concept. Do not add new colors. The colors are in `style.py`. The `CONCEPT` table maps a concept name to its color.

- Show the claim type of a claim when the script gives it. Use `claim_tag("ran")`, `claim_tag("read")`, or `claim_tag("inferred")`.

- Show an inferred value in amber with the word inferred. Use `inferred(value)`. Show a measured number in white.

- Do not use text smaller than `MIN_FONT_SIZE` (22). It gives a cap height of about 20 px at 720p.

- Keep content between `CONTENT_TOP` and `CONTENT_BOTTOM`. Put the scene title at `TITLE_Y` with `scene_title`.

- Captions are optional. A caption is a short label in the bottom strip, not a subtitle. Use `caption(text)` for it.

- Show a long table with `RevealTable`, one row at a time. Show long JSON or code with `hide_lines` and `reveal_lines`.

- Use `Text`, `MarkupText`, and `Code` only. LaTeX is not installed.

- Use only the values that the script shows. Label illustrative values as illustrative, as the script does.

| Concept | Name in `style.py` |
|---|---|
| The host, the main thread | `HOST` |
| Widgets and widget code | `WIDGET` |
| Call stack, pancakes | `STACK` |
| Heap | `HEAP` |
| Task queue and tasks | `TASK` |
| Microtask queue and microtasks | `MICROTASK` |
| Event loop, the loop arrow | `LOOP` |
| Promises | `PROMISE` |
| Emitter, handlers, process handlers | `EMITTER` |
| Async chain, async local storage, the blame store, the wrap | `ASYNC_CTX` |
| Worker thread, the watchdog | `WORKER` |
| Shared memory, heartbeat, widget number | `HEARTBEAT` |
| Crash record, provisional record, fingerprint, files on disk | `RECORDS` |
| App process, supervisor | `SUPERVISOR` |
| Errors, crash, the crash hook, quarantine, the two red arrows | `ISOLATION` (`PATH_A`) |
| Inferred values, path B | `INFERRED` (`PATH_B`) |
| Not built or not covered | `OPEN` |

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

All outputs go to `/Users/rohanmalik/kyaloon-media/explainer-event-loop-2026-11-04/render/`. Do not put them in git.

| Path | Content |
|---|---|
| `scenes/<scene>.mp4` | The rendered scene. A new render moves the old file to `scenes/old/`. |
| `frames/<scene>_<pct>.png` | The extracted frames. |
| `reports/<scene>.json` | The beats, the warnings, and the lengths. |
| `logs/<scene>.log` | The Manim output. |
| `media/<module>-<scene>/` | The Manim media folder of each scene. Each scene has its own folder, so parallel renders do not collide. |
