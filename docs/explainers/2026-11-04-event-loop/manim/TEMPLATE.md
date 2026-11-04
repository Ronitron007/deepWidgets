# Part template `animate.template`

This file tells a part agent how to animate one part of the event loop explainer. Each part agent works on one part. Many part agents work at the same time on the same shared base.

## Rules for part agents `animate.template.rules`

- Write only your module `part_<name>.py`. Do not write other files in the repository.

- Do not run git commands. The lead agent commits your module.

- Write scene lengths into `durations.json` only with `durations.py`. It holds a flock on `durations.json.lock` for each write.

- Render only with `render_all.py`. Then extract frames and look at each frame.

- Do not edit the shared base files. If you need a change in them, write the change and the reason in your report.

- Do not start background agents.

## Inputs `animate.template.inputs`

- `../script.md` gives each scene: the narration and the visuals. The visuals are the authority for what is on screen.

- `../glossary.md` defines each term.

- `/Users/rohanmalik/kyaloon-media/explainer-event-loop-2026-11-04/parts.json` lists the scenes of each part, in script order.

- `/Users/rohanmalik/kyaloon-media/explainer-event-loop-2026-11-04/durations.json` gives each scene length in seconds, from the final audio. If a scene has no entry, `timing.py` uses the word count of the scene at 140 words per minute.

## Shared base `animate.template.base`

These files are the shared base: `style.py`, `outline.py`, `loopviz.py`, `dwscene.py`, `timing.py`, `durations.py`, `render_all.py`, `mux_all.py`, `TEMPLATE.md`, `part_demo.py`.

| File | Content |
|---|---|
| `style.py` | Colors, fonts, sizes, layout lines, and shapes: `T`, `M`, `lines`, `fit`, `scene_title`, `caption`, `ProcessBox`, `chip`, `claim_tag`, `claim_legend`, `labeled_arrow`, `code_block`, `json_block`, `hide_lines`, `reveal_lines`, `mark_line`, `RevealTable`, `window_card`, `disk_icon`, `burst`, `source_tag`, `inferred` |
| `outline.py` | `OutlineDiagram`, the outline of the scenes `outline_map` and `outline_walk`. It has node keys, `node`, `box`, `highlight`, `reset`, `set_highlight_now`, `trace`, `zoom_target`, `open_part`, and `close_part`. It also has `PATH_A_KEYS` and `PATH_B_KEYS`. |
| `loopviz.py` | The event loop helpers: `CallStack`, `LoopQueue`, `PhaseRing`, and `run_next`. See `animate.template.loopviz`. |
| `dwscene.py` | `DWScene`, the base class of each scene. It gives beats, the source tag, the size lint, and the report. `from dwscene import *` also imports the outline and the loopviz helpers. |
| `timing.py` | Scene lengths and beat plans. Run `timing.py` to print each scene length and its source. |
| `durations.py` | Writes scene lengths into `durations.json` under the flock. |
| `render_all.py` | Renders scenes and checks them. |
| `mux_all.py` | Adds the audio to each scene and joins the scenes. The lead agent runs it. |
| `part_demo.py` | One working example scene, `DemoLoopviz`. It opens a part, runs the call stack and the microtask queue, and closes the part. Read it first. |

## Parts and outline keys `animate.template.parts`

Each part opens on the outline at its open key. The part closes on the outline at the same key. The close then lights the next key, which is the open key of the next part. Give the keys in the `also` column to `open_part(..., also=(...))`. Give the arrows in the `arrows` column to `arrows=(...)`.

| Part | Open key | also | arrows | Next key |
|---|---|---|---|---|
| `part_intro` | none, see `animate.template.intro` | | | `main_thread` |
| `part_stack` | `main_thread` | `call_stack` | | `microtask_queue` |
| `part_queues` | `microtask_queue` | `next_tick_queue` `loop_ring` | | `loop_ring` |
| `part_node_loop` | `loop_ring` | | | `call_stack` |
| `part_blocking` | `call_stack` | `loop_ring` | | `microtask_queue` |
| `part_promises` | `microtask_queue` | | | `process_handlers` |
| `part_listeners` | `process_handlers` | | | `blame_store` |
| `part_context` | `blame_store` | `widget_handlers` | | `shared_memory` |
| `part_threads` | `shared_memory` | `watchdog` | `link_watchdog_memory` | `claimer` |
| `part_blame` | `claimer` | `blame_store` `process_handlers` `crash_json` | `arrow_handlers_claimer` `arrow_claimer_crash` | `watchdog` |
| `part_watchdog` | `watchdog` | `shared_memory` `provisional_json` `crash_json` | `arrow_heartbeat` `arrow_slot` `link_watchdog_memory` `arrow_watchdog_provisional` | `supervisor` |
| `part_supervisor` | `supervisor` | `records` | `arrow_records_supervisor` `arrow_supervisor_host` | `widget_pinger` |
| `part_example_throw` | `widget_pinger` | `phase_timers` `blame_store` | | `widget_spinner` |
| `part_example_loop` | `widget_spinner` | `call_stack` `shared_memory` | `arrow_slot` | `host` |
| `part_limits` | `host` | | | `records` |
| `part_close` | `records` | | | none, see `animate.template.close` |

The open goes in the first scene of the part. The close goes in the last scene of the part. The node keys and the arrow keys are in the top comment of `outline.py`. A container key (`host`, `main_thread`, `loop_ring`, `shared_memory`, `process_handlers`, `records`) also lights its members. The group key `widget_handlers` lights the three widget chips.

### Intro `animate.template.intro`

- The scene `cold_open` does not show the outline. It shows the commit in its subtitle. It shows the claim legend with `claim_legend()`.

- The scene `outline_map` draws the outline at full size with `FadeIn(outline)`. Then it lights each part as the narration names it: `main_thread`, `call_stack`, `microtask_queue` with `next_tick_queue`, and `loop_ring`.

- The scene `outline_walk` lights the rest in narration order: `widget_handlers`, `blame_store`, `process_handlers`, `watchdog` with `shared_memory`, `records`, and `supervisor`.

- The outline always shows the box `claimer`. The scene `blame_overview` names it for the first time. Do not name it before that scene.

- The last scene `example_cast` closes with `close_part(self, "widget_handlers", next_key="main_thread")`.

### Close `animate.template.close`

The scene `closing` shows the outline at full size with every box lit: `outline.highlight("host", "records", "supervisor")`. Then it traces both paths, path A first:

```python
outline.trace(self, PATH_A_KEYS, PATH_A, run_time=b.t(0.4))
outline.trace(self, PATH_B_KEYS, PATH_B, run_time=b.t(0.4))
```

`PATH_A_KEYS` and `PATH_B_KEYS` (from `outline.py`) are the node keys of each path, in order. `PATH_A` (red) and `PATH_B` (amber) are the path colors from `style.py`. `from dwscene import *` imports all four names. `trace` plays by itself, so do not put it in `self.play`. The scene `closing` does not call `close_part`. The scenes `ex_throw_supervisor` and `ex_loop_variants` use `trace` in the same way.

## Module layout `animate.template.layout`

1. Make one module for your part: `part_<name>.py`. For example, the part `part_queues` gets `part_queues.py`.

2. Start the module with `from dwscene import *`.

3. Make one class for each scene of the part. The class name is the scene name in CamelCase. For example, the scene `order_example` gets the class `OrderExample`.

4. Write each class as `class OrderExample(DWScene):` on one line. `render_all.py` finds scenes with this exact form.

5. Keep helpers that only your part uses in your module. Give them names that start with `_`.

## Beats `animate.template.beats`

A beat is one step of a scene, for example one sentence group of the narration. The scene length comes from the audio. Thus you do not set seconds. You set weights.

```python
class Microtasks(DWScene):
    BEATS = [("open", 2), ("drain", 3), ("refill", 2)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "microtask_queue", run_time=b.left)
        with self.beat("drain") as b:
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

- When the script says "Outline: X lit" in a scene that is not the first scene of a part, put a `scene_title` in the color of X. Do not open the outline again.

- Do not move the camera in other ways. If you must, put it back with `OutlineDiagram.camera_home(self)` before the beat ends.

- Animate the outline only with `highlight`, `reset`, `trace`, `open_part`, and `close_part`. They animate the whole outline as one group. A separate `AnimationGroup` of outline parts makes Manim take the outline apart.

## Loop helpers `animate.template.loopviz`

`loopviz.py` draws the call stack, the queues, and the libuv ring. Each method returns one animation. Play it with a `run_time` from the beat. Add the object to the scene before you play its methods.

| Helper | Use |
|---|---|
| `CallStack(title="call stack", width=3.2, frame_h=0.5, max_frames=6)` | A column of frames on a base line. `push(label)` drops a frame on the top. `pop()` lifts the top frame off. `clear()` empties the stack. `mark_top(color)` recolors the top frame, for example `ISOLATION` for a frame that never returns. |
| `LoopQueue(title, color, width=6.0)` | A queue tray. Items join at the right and leave at the left. `enqueue(label, source=None)` adds an item. `dequeue(to=None)` removes the front item. Use `TASK` for the task queue and `MICROTASK` for the microtask queue and the next tick queue. `show_front()` adds the word `front` at the left. |
| `run_next(queue, stack)` | The loop runs the front item of the queue. The item moves to the top of the stack and becomes a frame. |
| `PhaseRing(radius=1.5)` | The six libuv phases as arcs, clockwise from `timers`, with a white marker and the title `event loop (libuv)`. `move_to_phase(name)` turns the marker clockwise to a phase. `light(*names)`, `dim(*names)`, and `normal()` restyle arcs. `point(name, out)` gives a point beside a phase, for a queue next to it. |

- The phase names are `timers`, `pending`, `idle`, `poll`, `check`, and `close`.

- A frame or an item that is too wide raises `ValueError`. Make the stack or the queue wider, or use a shorter label.

- Call the methods in play order. Each method changes the state at once: `push` adds the frame to `stack.frames` before the animation plays.

- Play two helper animations as two arguments: `self.play(stack.pop(), ring.move_to_phase("poll"))`. Do not put them in your own `AnimationGroup` without `group=`.

- `part_demo.py` shows push, pop, enqueue, `run_next`, and `move_to_phase`.

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
| Host process, main thread lane, host runtime | `HOST` |
| Widget action handlers and widget code | `WIDGET` |
| Call stack, frames, run to completion | `STACK` |
| Task queue and tasks | `TASK` |
| Microtask queue, next tick queue | `MICROTASK` |
| libuv phases, the ring | `PHASE` |
| Promises | `PROMISE` |
| EventEmitter, listeners, process handlers | `EMITTER` |
| Async context, `AsyncLocalStorage`, the blame store | `ASYNC_CTX` |
| Worker thread, the watchdog thread | `WORKER` |
| SharedArrayBuffer cells, heartbeat, running-widget slot, `Atomics` | `HEARTBEAT` |
| Records on disk: `provisional.json`, `crash.json` | `RECORDS` |
| Electron main, `DesktopHostSupervisor` | `SUPERVISOR` |
| Errors, crash, the claimer, path A | `ISOLATION` (`PATH_A`) |
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
