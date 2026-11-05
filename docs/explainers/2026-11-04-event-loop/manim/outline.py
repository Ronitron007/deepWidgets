"""The one outline diagram of the event loop video (script v2, scene `outline_map`).
Each part opens and closes on it.

Shared base file. Part agents do not edit it.

Layout (script `outline_map`): six boxes from left to right, `widget code runs` > `notice` >
`find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from
the left: `late error` and `endless loop`. Under each of the five right boxes, a grey `?` until
its code name fills in (during `part_boxes`). The `widget code runs` box holds the widget chips.
Under the outline, the strip of the foundations (script `closing`); each chip shows only from the
scene that teaches it. The bottom-right corner stays free for style.source_tag.

The term rule is built in. OutlineDiagram(scene) shows only what the viewer knows at the start
of that scene: an item whose teaching scene (TEACH) comes later stays hidden, and an item that
this scene teaches stays hidden until fill_in() (or open_part / close_part) brings it in.

Node keys (`OutlineDiagram.KEYS`):
  boxes:        widget_code, notice, find_who, write_down, start_again, keep_off
  red arrows:   late_error, endless_loop
  widget chips: widget_sample, widget_pinger, widget_spinner      (inside widget_code)
  names:        name_process_handlers, name_watchdog (notice); name_blame_store (find_who);
                name_crash_json, name_provisional_json (write_down); name_supervisor (start_again);
                name_quarantine (keep_off)
  foundations:  f_call_stack, f_heap, f_task_queue, f_microtask_queue, f_event_loop,
                f_worker_thread, f_shared_memory
  internal:     q_notice, q_find_who, q_write_down, q_start_again, q_keep_off (the grey `?`)
Group keys (no shape of their own): widget_chips, names, foundations, all.
A box key also lights its names (or, for widget_code, its chips).
Arrow keys (`OutlineDiagram.ARROWS`), the grey steps between the boxes:
  arrow_notice_find_who, arrow_find_who_write_down, arrow_write_down_start_again,
  arrow_start_again_keep_off
PATH_A_KEYS and PATH_B_KEYS are the node keys of the two failures, in order (for `trace`).
"""
from __future__ import annotations

from manim import *  # noqa: F401,F403

import timing
from style import (ASYNC_CTX, DIM, EMITTER, FRAME_W, HEAP, HEARTBEAT, ISOLATION, LABEL, LOOP, MICROTASK, MUTED,
                   RECORDS, SMALL, STACK, SUPERVISOR, TASK, TEXT, WIDGET, WORKER, T)

NORMAL_SW, HIGH_SW = 2.5, 5
NORMAL_FILL, HIGH_FILL = 0.07, 0.2
FLOW_SW, FLOW_HIGH_SW = 4, 7
LABEL_DIM = 0.3

# geometry (Manim units; frame 14.22 x 8)
LEFT_X, RIGHT_X = -6.9, 6.9
BOX_T, BOX_B = 2.35, 0.95           # the five right boxes
BOX_W = 1.6
WIDGET_W, WIDGET_B = 1.72, -0.3     # the widget_code box (same top as the others)
LATE_Y, LOOP_Y = 1.9, 1.28          # the two red arrows
NAME_Y0, NAME_STEP = 0.55, 0.42     # rows of code names under the boxes
NAME_GAP = 0.18                     # least space between two names on one row
STEP_MIN = 0.35                     # least length of a grey step arrow
STRIP_Y = (-1.45, -2.05)             # the two rows of the foundation strip

# (key, title lines, color)
BOX_SPECS = (
    ("notice", ("notice",), EMITTER),
    ("find_who", ("find who",), ASYNC_CTX),
    ("write_down", ("write it", "down"), RECORDS),
    ("start_again", ("start", "again"), SUPERVISOR),
    ("keep_off", ("keep", "it off"), ISOLATION),
)
# box -> ((key, lines, color, mono, first row), ...). Rows count down from NAME_Y0.
# provisional.json sits on row 2, so that it does not meet "(app process)" on row 1.
NAME_SPECS = {
    "notice": (("name_process_handlers", ("process handlers",), EMITTER, False, 0),
               ("name_watchdog", ("watchdog +", "heartbeat"), WORKER, False, 1)),
    "find_who": (("name_blame_store", ("blame store",), ASYNC_CTX, False, 0),),
    "write_down": (("name_crash_json", ("crash.json",), RECORDS, True, 0),
                   ("name_provisional_json", ("provisional.json",), RECORDS, True, 2)),
    "start_again": (("name_supervisor", ("supervisor", "(app process)"), SUPERVISOR, False, 0),),
    "keep_off": (("name_quarantine", ("quarantine",), ISOLATION, False, 0),),
}
WIDGET_CHIPS = (("widget_sample", "sample"), ("widget_pinger", "pinger"), ("widget_spinner", "spinner"))
FOUNDATIONS = ((("f_call_stack", "call stack", STACK), ("f_heap", "heap", HEAP), ("f_task_queue", "task queue", TASK),
                ("f_microtask_queue", "microtask queue", MICROTASK)),
               (("f_event_loop", "event loop", LOOP), ("f_worker_thread", "worker thread", WORKER),
                ("f_shared_memory", "shared memory", HEARTBEAT)))

# key -> the scene that teaches it (terms.md, script.md). Keys not listed are known from the start.
TEACH = {
    "widget_pinger": "two_failures", "widget_spinner": "two_failures",
    "f_call_stack": "call_stack", "f_heap": "heap_vs_stack", "f_task_queue": "task_queue",
    "f_event_loop": "event_loop", "f_microtask_queue": "microtasks", "f_worker_thread": "worker_thread",
    "f_shared_memory": "shared_memory",
    "name_blame_store": "blame_store", "name_process_handlers": "crash_record", "name_crash_json": "crash_record",
    "name_watchdog": "watchdog", "name_provisional_json": "provisional_record", "name_supervisor": "supervisor",
    "name_quarantine": "quarantine",
}

# the two failures, in order (script `two_failures`, `ex_throw_path`, `ex_loop_stall`)
PATH_A_KEYS = ("widget_pinger", "late_error", "notice", "find_who", "write_down", "start_again", "keep_off")
PATH_B_KEYS = ("widget_spinner", "endless_loop", "notice", "find_who", "write_down", "start_again", "keep_off")


class _Node(VGroup):
    """One outline item: .box (shape), .label (text group).
    kind: box | chip | flow (red arrow) | name (text only; .box is an invisible frame)."""

    def __init__(self, key, box, label, color, kind="box"):
        super().__init__(box, label)
        self.key, self.box, self.label, self.concept_color, self.kind = key, box, label, color, kind


def _style(n: _Node, state: str) -> _Node:
    """Set node n to state: normal | high | dim | hidden. Returns n (for ApplyFunction)."""
    op = 0.0 if state == "hidden" else (DIM if state == "dim" else 1.0)
    lop = 0.0 if state == "hidden" else (LABEL_DIM if state == "dim" else 1.0)
    if n.kind == "flow":
        sw = FLOW_HIGH_SW if state == "high" else FLOW_SW
        for m in n.box.get_family():
            if isinstance(m, ArrowTip):
                m.set_fill(opacity=op).set_stroke(opacity=op)
            elif len(m.points):
                m.set_stroke(width=sw, opacity=op)
    elif n.kind in ("box", "chip"):
        sw, fill = {"normal": (NORMAL_SW, NORMAL_FILL), "high": (HIGH_SW, HIGH_FILL),
                    "dim": (NORMAL_SW, 0.02), "hidden": (NORMAL_SW, 0.0)}[state]
        if n.kind == "chip":
            fill *= 2
        n.box.set_stroke(width=sw, opacity=op).set_fill(opacity=fill)
    n.label.set_opacity(lop)
    return n


class OutlineDiagram(VGroup):
    KEYS = ("widget_code", "notice", "find_who", "write_down", "start_again", "keep_off",
            "late_error", "endless_loop",
            "widget_sample", "widget_pinger", "widget_spinner",
            "name_process_handlers", "name_watchdog", "name_blame_store", "name_crash_json",
            "name_provisional_json", "name_supervisor", "name_quarantine",
            "f_call_stack", "f_heap", "f_task_queue", "f_microtask_queue", "f_event_loop",
            "f_worker_thread", "f_shared_memory",
            "q_notice", "q_find_who", "q_write_down", "q_start_again", "q_keep_off")
    GROUPS = ("widget_chips", "names", "foundations", "all")
    ARROWS = ("arrow_notice_find_who", "arrow_find_who_write_down", "arrow_write_down_start_again",
              "arrow_start_again_keep_off")

    def __init__(self, scene, **kw):
        """scene: the DWScene (or a scene name of script.md). The outline shows what the viewer
        knows at the start of that scene."""
        super().__init__(**kw)
        name = scene if isinstance(scene, str) else getattr(scene, "scene_name", None)
        order = timing.script_order()
        if name not in order:
            raise ValueError(f"OutlineDiagram needs a script scene, got {name!r}")
        missing = sorted(set(TEACH.values()) - set(order))
        if missing:
            raise ValueError(f"outline.TEACH names scenes that script.md does not have: {missing}")
        self.at = name
        pos = order.index(name)
        self.teach_here = tuple(k for k, s in TEACH.items() if s == name)
        self.hidden = {k for k, s in TEACH.items() if order.index(s) >= pos}

        self.nodes: dict[str, _Node] = {}
        self.arrows: dict[str, VMobject] = {}
        self.members: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {}
        self._build()
        assert set(self.nodes) == set(self.KEYS), set(self.nodes) ^ set(self.KEYS)
        assert set(self.arrows) == set(self.ARROWS), set(self.arrows) ^ set(self.ARROWS)
        self._state = {k: "normal" for k in self.nodes}
        self._sync_unknown()
        for k, n in self.nodes.items():
            _style(n, "hidden" if k in self.hidden else "normal")

    # ------------------------------------------------------------ construction
    def _add(self, key, box, label, color, kind):
        n = _Node(key, box, label, color, kind)
        self.nodes[key] = n
        return n

    @staticmethod
    def _rect(color, x0, x1, y0, y1, r=0.14):
        b = RoundedRectangle(corner_radius=r, width=x1 - x0, height=y1 - y0, stroke_color=color,
                             stroke_width=NORMAL_SW, fill_color=color, fill_opacity=NORMAL_FILL)
        return b.move_to([(x0 + x1) / 2, (y0 + y1) / 2, 0])

    @staticmethod
    def _lines(ls, color, size=SMALL, mono=False, bold=False):
        return VGroup(*[T(x, size, color, mono=mono, bold=bold) for x in ls]).arrange(DOWN, buff=0.08)

    def _chip(self, key, text, color, center, w=None, mono=True):
        t = T(text, SMALL, TEXT, mono=mono)
        box = RoundedRectangle(corner_radius=0.1, width=w or t.width + 0.3, height=0.44, stroke_color=color,
                               stroke_width=NORMAL_SW, fill_color=color, fill_opacity=NORMAL_FILL * 2)
        box.move_to(center)
        t.move_to(box)
        return self._add(key, box, VGroup(t), color, "chip")

    def _name(self, key, label, color):
        frame = Rectangle(width=label.width + 0.16, height=label.height + 0.12, stroke_width=0, fill_opacity=0)
        frame.move_to(label)
        return self._add(key, frame, label, color, "name")

    def _layout_columns(self):
        """Centers of the five right boxes, one even pitch: the least pitch at which no two names
        on one row meet, right-aligned."""
        rows = []  # per box: {row: width of the name line on that row}
        for key, _, _ in BOX_SPECS:
            ws = {}
            for _, ls, _, mono, r0 in NAME_SPECS[key]:
                for i, x in enumerate(ls):
                    ws[r0 + i] = T(x, SMALL, mono=mono).width
            rows.append(ws)
        pitch = BOX_W + STEP_MIN
        for a, b in zip(rows, rows[1:]):
            for r in set(a) & set(b):
                pitch = max(pitch, (a[r] + b[r]) / 2 + NAME_GAP)
        last = RIGHT_X - max(BOX_W, *rows[-1].values()) / 2
        n = len(BOX_SPECS)
        return [last - (n - 1 - i) * pitch for i in range(n)], rows

    def _build(self):
        cs, rows = self._layout_columns()

        # ---------------- widget_code box with its chips
        wx0, wx1 = LEFT_X, LEFT_X + WIDGET_W
        wbox = self._rect(WIDGET, wx0, wx1, WIDGET_B, BOX_T)
        wt = self._lines(("widget", "code runs"), WIDGET, size=LABEL, bold=True)
        wt.next_to(wbox.get_top(), DOWN, buff=0.14)
        wcode = self._add("widget_code", wbox, wt, WIDGET, "box")
        chips = []
        y = wt.get_bottom()[1] - 0.4
        for key, text in WIDGET_CHIPS:
            chips.append(self._chip(key, text, WIDGET, [(wx0 + wx1) / 2, y, 0], w=WIDGET_W - 0.3))
            y -= 0.54
        assert chips[-1].box.get_bottom()[1] > WIDGET_B + 0.05, "widget chips do not fit their box"

        # ---------------- the five boxes, their names, the grey `?`
        boxes, steps = [], []
        for (key, title, color), cx in zip(BOX_SPECS, cs):
            b = self._rect(color, cx - BOX_W / 2, cx + BOX_W / 2, BOX_B, BOX_T)
            t = self._lines(title, color, size=LABEL, bold=True).move_to(b)
            boxes.append(self._add(key, b, t, color, "box"))
            names = []
            for nkey, ls, ncolor, mono, r0 in NAME_SPECS[key]:
                g = VGroup(*[T(x, SMALL, ncolor, mono=mono) for x in ls])
                for i, line in enumerate(g):
                    line.move_to([cx, NAME_Y0 - (r0 + i) * NAME_STEP, 0])
                names.append(self._name(nkey, g, ncolor))
            q = self._name(f"q_{key}", VGroup(T("?", LABEL, MUTED, bold=True).move_to([cx, NAME_Y0, 0])), MUTED)
            self.members[key] = (tuple(n.key for n in names) + (q.key,), ())

        notice_l = boxes[0].box.get_left()[0]
        assert notice_l - wx1 >= 1.78, f"red arrows get only {notice_l - wx1:.2f} units"

        # ---------------- grey steps between the boxes
        for a, b in zip(boxes, boxes[1:]):
            key = f"arrow_{a.key}_{b.key}"
            y = (BOX_T + BOX_B) / 2
            ar = Arrow([a.box.get_right()[0], y, 0], [b.box.get_left()[0], y, 0], buff=0.04, color=MUTED,
                       stroke_width=4, tip_length=0.16, max_tip_length_to_length_ratio=0.45,
                       max_stroke_width_to_length_ratio=20)
            self.arrows[key] = ar
            steps.append(ar)

        # ---------------- the two red arrows into `notice`
        flows = []
        for key, text, y, side in (("late_error", "late error", LATE_Y, UP), ("endless_loop", "endless loop", LOOP_Y, DOWN)):
            ar = Arrow([wx1, y, 0], [notice_l, y, 0], buff=0.04, color=ISOLATION, stroke_width=FLOW_SW,
                       tip_length=0.2, max_tip_length_to_length_ratio=0.3, max_stroke_width_to_length_ratio=20)
            lbl = VGroup(T(text, SMALL, ISOLATION)).next_to(ar, side, buff=0.08)
            flows.append(self._add(key, VGroup(ar), lbl, ISOLATION, "flow"))

        # ---------------- foundation strip
        fchips = []
        for row, y in zip(FOUNDATIONS, STRIP_Y):
            made = [self._chip(k, text, color, ORIGIN, mono=False) for k, text, color in row]
            VGroup(*made).arrange(RIGHT, buff=0.25).move_to([0, y, 0])
            fchips += made

        # ---------------- groups
        chip_keys = tuple(k for k, _ in WIDGET_CHIPS)
        self.members["widget_code"] = (chip_keys, ())
        self.members["widget_chips"] = (chip_keys, ())
        self.members["names"] = (tuple(k for v in NAME_SPECS.values() for k, *_ in v), ())
        self.members["foundations"] = (tuple(k for row in FOUNDATIONS for k, *_ in row), ())
        self.members["all"] = (self.KEYS, self.ARROWS)

        self.add(wcode, *boxes, *steps, *flows, *chips,
                 *[self.nodes[k] for v in NAME_SPECS.values() for k, *_ in v],
                 *[self.nodes[f"q_{k}"] for k, *_ in BOX_SPECS], *fchips)

    # ------------------------------------------------------------ term rule
    def _sync_unknown(self):
        """A box shows its grey `?` while none of its names shows."""
        for key, *_ in BOX_SPECS:
            names_shown = any(k not in self.hidden for k, *_ in NAME_SPECS[key])
            q = f"q_{key}"
            (self.hidden.add if names_shown else self.hidden.discard)(q)

    def _unhide(self, keys):
        """Show the hidden keys in `keys`. A key that a later scene teaches raises ValueError."""
        order = timing.script_order()
        for k in keys:
            if k in TEACH and order.index(TEACH[k]) > order.index(self.at):
                raise ValueError(f"{k!r} is taught in {TEACH[k]!r}, after {self.at!r}: the term rule keeps it hidden")
        before = set(self.hidden)
        self.hidden -= set(k for k in keys if k in TEACH)
        self._sync_unknown()
        return before ^ self.hidden

    def fill_in(self, *keys) -> Animation:
        """Bring in the items that this scene teaches (all of them, or only `keys`): names replace
        the grey `?`, chips fade in. Each one takes the state of the last highlight."""
        changed = self._unhide(keys or self.teach_here)
        anims = [self._anim(k) for k in sorted(changed)]
        return AnimationGroup(*anims, group=self) if anims else Wait(1 / config.frame_rate)

    def fill_in_now(self, *keys):
        """Same as fill_in(), at once with no animation."""
        for k in self._unhide(keys or self.teach_here):
            _style(self.nodes[k], self._shown_state(k))
        return self

    # ------------------------------------------------------------ access
    def node(self, key) -> _Node:
        return self.nodes[key]

    def box(self, key) -> VMobject:
        """The shape of node `key` (for a group key: the bounding area of its members)."""
        if key in self.nodes and key not in self.members:
            return self.nodes[key].box
        return self._area(key)

    def _area(self, key) -> VMobject:
        keys, _ = self._expand([key], [])
        g = VGroup(*[self.nodes[k] for k in keys])
        return Rectangle(width=g.width, height=g.height).move_to(g.get_center())

    def _expand(self, keys, arrows):
        keys, arrows = set(keys), set(arrows)
        for k in list(keys):
            if k in self.members:
                ns, ars = self.members[k]
                keys |= set(ns)
                arrows |= set(ars)
        bad = (keys - set(self.nodes) - set(self.GROUPS)) | (arrows - set(self.ARROWS))
        if bad:
            raise KeyError(f"not an outline key: {sorted(bad)}")
        return keys & set(self.nodes), arrows

    # ------------------------------------------------------------ styling
    def _shown_state(self, k):
        return "hidden" if k in self.hidden else self._state[k]

    def _anim(self, k) -> Animation:
        state = self._shown_state(k)
        return ApplyFunction(lambda m, s=state: _style(m, s), self.nodes[k])

    @staticmethod
    def _line_state(m, op):
        """Stroke opacity of a line or arrow, fill opacity of its tip only."""
        tips = [x for x in m.get_family() if isinstance(x, ArrowTip)]
        lines_ = [x for x in m.get_family() if not isinstance(x, ArrowTip) and len(x.points)]
        anims = [x.animate.set_stroke(opacity=op) for x in lines_]
        anims += [t.animate.set_fill(opacity=op).set_stroke(opacity=op) for t in tips]
        return AnimationGroup(*anims, group=m)

    def highlight(self, *keys, arrows=(), dim_others=True) -> Animation:
        """Light the given nodes (and arrows); dim every other node and arrow.
        A box key also lights its names or chips; a group key lights its members.
        Hidden items stay hidden (fill_in brings them in)."""
        keys, arrows = self._expand(keys, arrows)
        for k in self.nodes:
            self._state[k] = "high" if k in keys else ("dim" if dim_others else "normal")
        anims = [self._anim(k) for k in self.nodes]
        anims += [self._line_state(self.arrows[k], 1.0 if (k in arrows or not dim_others) else DIM)
                  for k in self.arrows]
        # group=self: without it Manim adds a new Group of the animated parts to the scene,
        # which takes the outline apart and redraws arrows over the boxes
        return AnimationGroup(*anims, group=self)

    def reset(self) -> Animation:
        """Every shown node and arrow back to normal."""
        for k in self.nodes:
            self._state[k] = "normal"
        return AnimationGroup(*[self._anim(k) for k in self.nodes],
                              *[self._line_state(self.arrows[k], 1.0) for k in self.arrows], group=self)

    def set_highlight_now(self, *keys, arrows=()):
        """Same as highlight(), applied at once with no animation."""
        keys, arrows = self._expand(keys, arrows)
        for k, n in self.nodes.items():
            self._state[k] = "high" if k in keys else "dim"
            _style(n, self._shown_state(k))
        for k, ar in self.arrows.items():
            op = 1.0 if k in arrows else DIM
            for m in ar.get_family():
                if isinstance(m, ArrowTip):
                    m.set_fill(opacity=op).set_stroke(opacity=op)
                elif len(m.points):
                    m.set_stroke(opacity=op)
        return self

    def trace(self, scene, keys, color, run_time=3.0):
        """Play a flash that runs along the shapes of `keys` in order (PATH_A_KEYS, PATH_B_KEYS),
        in `run_time` seconds. It plays by itself (do not wrap it in self.play). The outline
        does not change; each flash is a top-level copy that the scene removes after it."""
        for k in keys:
            if k in self.hidden:
                raise ValueError(f"trace: {k!r} is hidden in scene {self.at!r}")
        for k, rt in self._schedule(scene, [(k, 1.0) for k in keys], run_time):
            n = self.nodes[k]
            src = n.box[0] if n.kind == "flow" else n.box
            shape = src.copy()
            shape.set_fill(opacity=0).set_stroke(color, width=9, opacity=1)
            scene.play(ShowPassingFlash(shape, time_width=0.6), run_time=rt())
        return self

    # ------------------------------------------------------------ camera
    def _zoom_width(self, key, margin):
        b = self.box(key)
        aspect = FRAME_W / config.frame_height
        return min(FRAME_W, max(b.width * margin, b.height * margin * aspect, 3.2)), b.get_center()

    def zoom_target(self, scene, key, margin=1.3):
        """camera.frame animation that fills the screen with node `key` (never wider than the frame)."""
        w, c = self._zoom_width(key, margin)
        if w >= FRAME_W:
            c = ORIGIN
        return scene.camera.frame.animate.set(width=w).move_to(c)

    @staticmethod
    def camera_home(scene):
        """camera.frame animation back to the full frame."""
        return scene.camera.frame.animate.set(width=FRAME_W).move_to(ORIGIN)

    @staticmethod
    def _camera_home_now(scene):
        scene.camera.frame.set(width=FRAME_W).move_to(ORIGIN)

    @staticmethod
    def _schedule(scene, steps, run_time):
        """Yield (step, run_time_fn). Each step ends on its own deadline, so frame rounding
        does not add up: the whole sequence takes run_time."""
        t0 = scene.renderer.time
        total = sum(w for _, w in steps)
        acc = 0.0
        fr = 1.0 / config.frame_rate
        for step, w in steps:
            acc += w
            end = t0 + run_time * acc / total
            yield step, (lambda end=end: max(fr, end - scene.renderer.time))

    def open_part(self, scene, key, run_time=3.0, arrows=(), also=()):
        """Part opener: (fade in) -> light `key` (and the keys in `also`) -> zoom into `key`
        -> fade the outline out. A lit item that this scene teaches comes in with the light.

        After it the camera is home and the screen is empty except mobjects the scene added
        before. Spend the whole time of a beat: pass run_time=b.left.
        """
        lit, _ = self._expand((key, *also), ())
        self._unhide([k for k in lit if k in self.teach_here])
        steps = []
        if self not in scene.mobjects:
            steps.append(("fade", 0.22))
        steps += [("light", 0.22), ("zoom", 0.36), ("out", 0.2)]
        for step, rt in self._schedule(scene, steps, run_time):
            if step == "fade":
                scene.play(FadeIn(self), run_time=rt())
            elif step == "light":
                scene.play(self.highlight(key, *also, arrows=arrows), run_time=rt())
            elif step == "zoom":
                scene.play(self.zoom_target(scene, key), run_time=rt())
            elif step == "out":
                scene.play(FadeOut(self), run_time=rt())
                self._camera_home_now(scene)
        return self

    def close_part(self, scene, key, next_key=None, run_time=3.0, clear=True, also=(), arrows=()):
        """Part closer: (fade out the scene) -> outline fades in zoomed on `key` -> zoom out
        -> light `next_key` (or reset). Everything this scene teaches is filled in.
        Leaves the outline on screen, camera home.
        The clear step keeps mobjects with `_dw_keep = True` (style.source_tag sets it)."""
        steps = [("clear", 0.18)] if clear else []
        steps += [("in", 0.22), ("zoom", 0.36), ("next", 0.24)]
        for step, rt in self._schedule(scene, steps, run_time):
            if step == "clear":
                others = [m for m in scene.mobjects if m is not self and m is not scene.camera.frame
                          and not getattr(m, "_dw_keep", False)]
                if others:
                    scene.play(*[FadeOut(m) for m in others], run_time=rt())
                else:
                    scene.wait(rt())
            elif step == "in":
                self._unhide(self.teach_here)
                self.set_highlight_now(key, *also, arrows=arrows)
                w, c = self._zoom_width(key, 1.3)
                scene.camera.frame.set(width=w).move_to(ORIGIN if w >= FRAME_W else c)
                scene.play(FadeIn(self), run_time=rt())
            elif step == "zoom":
                scene.play(self.camera_home(scene), run_time=rt())
            elif step == "next":
                scene.play(self.highlight(next_key) if next_key else self.reset(), run_time=rt())
        return self
