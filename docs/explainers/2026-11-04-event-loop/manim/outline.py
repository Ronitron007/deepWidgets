"""The one outline diagram of the event loop video (scenes `outline_map`, `outline_walk`).
Each part opens and closes on it.

Shared base file. Part agents do not edit it.

Layout: the big `host process` box fills the top. Inside it, left to right: the `main thread`
lane (widget chips, call stack, next tick and microtask queues, the libuv ring, the blame store
ribbon), the SharedArrayBuffer strip over the watchdog thread, and the process handlers over
the claimer. Under the host: Electron main (supervisor) at the left, the records on disk at
the right. The bottom-right corner stays free for style.source_tag(DR).

Node keys (`OutlineDiagram.KEYS` lists them):
  host (container):        host
  main thread lane:        main_thread (container), call_stack, next_tick_queue, microtask_queue,
                           loop_ring (container of the six phases), phase_timers, phase_pending,
                           phase_idle, phase_poll, phase_check, phase_close,
                           widget_handlers (group), widget_sample, widget_pinger, widget_spinner,
                           blame_store (the ribbon)
  shared memory, worker:   shared_memory (container), heartbeat_cell, slot_cell, watchdog
  process handlers:        process_handlers (container), handler_uncaught, handler_unhandled, claimer
  under the host:          records (container), provisional_json, crash_json, supervisor
Arrow keys (`OutlineDiagram.ARROWS`):
  arrow_heartbeat (main lane -> heartbeat cell), arrow_slot (main lane -> running-widget cell),
  link_watchdog_memory (shared memory -> watchdog, reads), arrow_watchdog_provisional,
  arrow_handlers_claimer, arrow_claimer_crash, arrow_records_supervisor, arrow_supervisor_host
A container key (host, main_thread, loop_ring, shared_memory, process_handlers, records) and the
group key widget_handlers light their members and inner arrows too.
PATH_A_KEYS and PATH_B_KEYS are the node keys of the two failure paths, in order (for `trace`);
style.PATH_A and style.PATH_B are their colors.
"""
from __future__ import annotations

from manim import *  # noqa: F401,F403

from style import (ASYNC_CTX, BG, DIM, EMITTER, FRAME_W, HEARTBEAT, HOST, ISOLATION, LABEL, MICROTASK, MUTED,
                   PHASE, RECORDS, SMALL, STACK, SUPERVISOR, TEXT, WIDGET, WORKER, T, disk_icon, lines)

NORMAL_SW, HIGH_SW = 2.5, 5
NORMAL_FILL, HIGH_FILL = 0.07, 0.2
ARC_SW, ARC_HIGH_SW = 7, 12
RIBBON_SW, RIBBON_HIGH_SW, RIBBON_OP = 6, 10, 0.75
DECO_FILL, DECO_HIGH_FILL = 0.22, 0.4

# geometry (Manim units; frame 14.22 x 8)
HOST_L, HOST_R, HOST_B, HOST_T = -6.85, 6.85, -2.2, 3.85
LANE_L, LANE_R, LANE_B, LANE_T = -6.65, -0.85, -2.0, 3.3
B_L, B_R = -0.65, 2.65          # shared memory + watchdog column
A_L, A_R = 2.85, 6.65           # process handlers + claimer column
LOW_T, LOW_B = -2.55, -3.25     # records row (the corner tag sits below -3.38, right of 3.2)
RING_C, RING_R = np.array([-2.85, -0.55, 0.0]), 0.85
PHASES = ("timers", "pending", "idle", "poll", "check", "close")
PHASE_LABELS = {"timers": ("timers",), "pending": ("pending",), "idle": ("idle,", "prepare"),
                "poll": ("poll",), "check": ("check",), "close": ("close",)}

# the two failure paths, in order (script `example_cast`, `ex_throw_supervisor`, `ex_loop_variants`)
PATH_A_KEYS = ("widget_pinger", "phase_timers", "blame_store", "handler_uncaught", "claimer", "crash_json",
          "supervisor")
PATH_B_KEYS = ("widget_spinner", "call_stack", "slot_cell", "heartbeat_cell", "watchdog", "provisional_json",
          "supervisor")


class _Node(VGroup):
    """One outline box: .box (shape), .label (text group), .deco (drawings that dim with it).
    kind: box | chip | arc | ribbon | hub."""

    def __init__(self, key, box, label, color, kind="box", deco=None):
        deco = deco if deco is not None else VGroup()
        super().__init__(box, deco, label)
        self.key, self.box, self.label, self.deco, self.concept_color, self.kind = key, box, label, deco, color, kind
        self.is_chip = kind == "chip"
        self.underlay = None


class OutlineDiagram(VGroup):
    KEYS = ("host",
            "main_thread", "call_stack", "next_tick_queue", "microtask_queue",
            "loop_ring", "phase_timers", "phase_pending", "phase_idle", "phase_poll", "phase_check", "phase_close",
            "widget_sample", "widget_pinger", "widget_spinner", "blame_store",
            "shared_memory", "heartbeat_cell", "slot_cell", "watchdog",
            "process_handlers", "handler_uncaught", "handler_unhandled", "claimer",
            "records", "provisional_json", "crash_json", "supervisor")
    GROUPS = ("widget_handlers",)  # keys with members but no box of their own
    ARROWS = ("arrow_heartbeat", "arrow_slot", "link_watchdog_memory", "arrow_watchdog_provisional",
              "arrow_handlers_claimer", "arrow_claimer_crash", "arrow_records_supervisor", "arrow_supervisor_host")

    def __init__(self, **kw):
        super().__init__(**kw)
        self.nodes: dict[str, _Node] = {}
        self.arrows: dict[str, VMobject] = {}
        self.members: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {}  # container -> (nodes, arrows)
        self._build()
        assert set(self.nodes) == set(self.KEYS), set(self.nodes) ^ set(self.KEYS)
        assert set(self.arrows) == set(self.ARROWS), set(self.arrows) ^ set(self.ARROWS)

    # ------------------------------------------------------------ construction
    @staticmethod
    def _label(title, sub=None, sub_mono=False, title_mono=False, size=LABEL):
        """title (and sub): a string, or a tuple of strings for several lines."""
        titles = title if isinstance(title, tuple) else (title,)
        subs = sub if isinstance(sub, tuple) else ((sub,) if sub else ())
        parts = [T(t, size, TEXT, bold=not title_mono, mono=title_mono) for t in titles]
        parts += [T(x, SMALL, TEXT, mono=sub_mono) for x in subs]
        g = VGroup(*parts).arrange(DOWN, buff=0.08)
        g.n_titles = len(titles)
        return g

    def _rect(self, color, x0, x1, y0, y1, r=0.14):
        b = RoundedRectangle(corner_radius=r, width=x1 - x0, height=y1 - y0, stroke_color=color,
                             stroke_width=NORMAL_SW, fill_color=color, fill_opacity=NORMAL_FILL)
        return b.move_to([(x0 + x1) / 2, (y0 + y1) / 2, 0])

    def _node(self, key, label, color, box, title_pos="center", deco=None, kind="box", color_titles=True):
        """title_pos: center | ul | keep (the caller places the label)."""
        if title_pos == "center":
            label.move_to(box)
        elif title_pos == "ul":
            label.next_to(box.get_corner(UL), DR, buff=0.12)
        if color_titles:
            for line in label[:getattr(label, "n_titles", 1)]:
                line.set_color(color)  # title lines in the concept color, sub lines stay TEXT
        n = _Node(key, box, label, color, kind=kind, deco=deco)
        self.nodes[key] = n
        return n

    def _chip(self, key, text, color, center, mono=True, pad=0.12, h=0.44, w=None, bold=False, solid=False):
        t = T(text, SMALL if not bold else LABEL, color if bold else TEXT, mono=mono, bold=bold)
        box = RoundedRectangle(corner_radius=0.1, width=w or t.width + 2 * pad, height=h,
                               stroke_color=color, stroke_width=NORMAL_SW, fill_color=color,
                               fill_opacity=NORMAL_FILL * 2)
        box.move_to(center)
        t.move_to(box)
        n = _Node(key, box, t, color, kind="chip")
        if solid:
            n.underlay = box.copy().set_stroke(width=0).set_fill(BG, opacity=1)
            n.add_to_back(n.underlay)
        self.nodes[key] = n
        return n

    def _arrow(self, key, a, b, color, dashed=False):
        if dashed:
            ar = DashedLine(a, b, color=color, stroke_width=3.5, dash_length=0.07)
            ar.add_tip(tip_length=0.15, tip_width=0.15)
        else:
            ar = Arrow(a, b, buff=0.04, color=color, stroke_width=4, tip_length=0.16,
                       max_tip_length_to_length_ratio=0.45, max_stroke_width_to_length_ratio=20)
        self.arrows[key] = ar
        return ar

    def _elbow(self, key, pts, color):
        """A right-angle arrow through the points (last point gets the tip)."""
        line = VMobject(stroke_color=color, stroke_width=4)
        line.set_points_as_corners([np.array(p, dtype=float) for p in pts])
        a, b = np.array(pts[-2], dtype=float), np.array(pts[-1], dtype=float)
        tip = Arrow(a + (b - a) * 0.01, b, buff=0, color=color, stroke_width=0, tip_length=0.16,
                    max_tip_length_to_length_ratio=1).tip
        g = VGroup(line, tip)
        self.arrows[key] = g
        return g

    def _build(self):
        # ---------------- host box and main thread lane
        host = self._node("host", self._label("host process", "Node 24.21.0 in Electron 44.7.0"), HOST,
                          self._rect(HOST, HOST_L, HOST_R, HOST_B, HOST_T, r=0.18))
        host.label.arrange(RIGHT, buff=0.3, aligned_edge=DOWN)
        host.label.next_to(host.box.get_corner(UL), DR, buff=0.12)
        lane = self._node("main_thread", self._label("main thread"), HOST,
                          self._rect(HOST, LANE_L, LANE_R, LANE_B, LANE_T), title_pos="ul")

        # widget chips: one row under the lane title
        wy = 2.55
        x = LANE_L + 0.2
        wchips = []
        for k, t in (("widget_sample", "sample"), ("widget_pinger", "pinger"), ("widget_spinner", "spinner")):
            c = self._chip(k, t, WIDGET, ORIGIN)
            c.move_to([x + c.box.width / 2, wy, 0])
            x += c.box.width + 0.15
            wchips.append(c)

        # call stack column: title over four empty frames
        cs_l, cs_r = LANE_L + 0.1, LANE_L + 1.62
        cs_box = self._rect(STACK, cs_l, cs_r, 0.12, 2.15)
        frames = VGroup(*[Rectangle(width=1.1, height=0.3, stroke_color=STACK, stroke_width=2,
                                    fill_color=STACK, fill_opacity=DECO_FILL) for _ in range(4)])
        frames.arrange(DOWN, buff=0.07).move_to([(cs_l + cs_r) / 2, 0.88, 0])
        cs_lbl = self._label("call stack", size=SMALL)
        cstack = self._node("call_stack", cs_lbl, STACK, cs_box, deco=frames)
        cs_lbl.move_to([(cs_l + cs_r) / 2, 1.87, 0])

        # next tick and microtask queues: trays with slot ticks, labels under them
        ty0, ty1 = 1.42, 1.86

        def tray(key, x0, x1, text, n):
            box = self._rect(MICROTASK, x0, x1, ty0, ty1, r=0.08)
            ticks = VGroup(*[Line([x0 + (x1 - x0) * i / n, ty0 + 0.08, 0], [x0 + (x1 - x0) * i / n, ty1 - 0.08, 0],
                                  stroke_color=MICROTASK, stroke_width=1.5) for i in range(1, n)])
            lbl = self._label(text, size=SMALL)
            node = self._node(key, lbl, MICROTASK, box, deco=ticks)
            lbl.move_to([(x0 + x1) / 2, ty0 - 0.27, 0])
            return node

        qx0 = cs_r + 0.27
        ntq = tray("next_tick_queue", qx0, qx0 + 0.8, "next tick", 2)
        mtq = tray("microtask_queue", qx0 + 1.35, LANE_R - 0.2, "microtask queue", 5)

        # libuv ring: six arcs clockwise from timers (upper left), a hub arrow in the middle
        phase_nodes = []
        span = TAU / 6
        gap = 0.12
        for i, ph in enumerate(PHASES):
            mid = 150 * DEGREES - i * span
            arc = Arc(radius=RING_R, start_angle=mid + span / 2 - gap / 2, angle=-(span - gap), arc_center=RING_C,
                      stroke_color=PHASE, stroke_width=ARC_SW)
            lbl = lines(*PHASE_LABELS[ph], size=SMALL, color=PHASE, buff=0.04,
                        align=LEFT if np.cos(mid) > 0.3 else (RIGHT if np.cos(mid) < -0.3 else ORIGIN))
            d = np.array([np.cos(mid), np.sin(mid), 0.0])
            anchor = RING_C + d * (RING_R + 0.18)
            edge = LEFT if d[0] > 0.3 else (RIGHT if d[0] < -0.3 else (DOWN if d[1] > 0 else UP))
            lbl.move_to(anchor, aligned_edge=edge)
            phase_nodes.append(self._node(f"phase_{ph}", lbl, PHASE, arc, title_pos="keep", kind="arc",
                                          color_titles=False))
        hub = Arc(radius=0.3, start_angle=110 * DEGREES, angle=-320 * DEGREES, arc_center=RING_C,
                  stroke_color=PHASE, stroke_width=3)
        hub.add_tip(tip_length=0.14, tip_width=0.14)
        ring_lbl = self._label(("event loop", "(libuv)"), size=SMALL)
        ring = self._node("loop_ring", ring_lbl, PHASE, hub, kind="hub")
        ring_lbl.move_to([(cs_l + cs_r) / 2, -1.05, 0])

        # blame store ribbon: pinger -> between the trays -> timers arc; spinner -> microtask tray
        t_end = 128 * DEGREES  # upper end of the timers arc, clear of the timers and pending labels
        t_pt = RING_C + np.array([np.cos(t_end), np.sin(t_end), 0]) * RING_R
        gx = mtq.box.get_left()[0] - 0.2
        p_start = wchips[1].box.get_bottom() + DOWN * 0.02
        s1 = VMobject().set_points_smoothly([p_start, [gx, 1.9, 0], [gx, 1.0, 0], t_pt + UP * 0.06])
        s_start = wchips[2].box.get_bottom() + DOWN * 0.02
        s2 = VMobject().set_points_smoothly([s_start, s_start + DOWN * 0.18 + RIGHT * 0.12,
                                             [s_start[0] + 0.3, ty1 + 0.02, 0]])
        rib = VGroup(s1, s2).set_stroke(ASYNC_CTX, RIBBON_SW, opacity=RIBBON_OP).set_fill(opacity=0)
        rib_lbl = self._label(("blame", "store"), size=SMALL)
        blame = self._node("blame_store", rib_lbl, ASYNC_CTX, rib, kind="ribbon")
        rib_lbl.move_to([(cs_r + gx) / 2 - 0.05, 0.52, 0])

        # ---------------- shared memory strip and watchdog thread
        bx = (B_L + B_R) / 2
        sab_t = T("SharedArrayBuffer", SMALL, HEARTBEAT, mono=True)
        hb = self._chip("heartbeat_cell", "heartbeat", HEARTBEAT, [bx + 0.05, 2.48, 0], w=2.9)
        sl = self._chip("slot_cell", "running widget", HEARTBEAT, [bx + 0.05, 1.98, 0], w=2.9)
        sab_box = self._rect(HEARTBEAT, B_L, B_R, 1.66, LANE_T)
        sab = self._node("shared_memory", VGroup(sab_t), HEARTBEAT, sab_box, color_titles=False)
        sab_t.move_to([bx, 3.03, 0])
        wd = self._node("watchdog", self._label("watchdog thread", "worker_threads", sub_mono=True), WORKER,
                        self._rect(WORKER, B_L + 0.1, B_R - 0.1, -0.45, 0.85))

        # ---------------- process handlers and claimer
        ax = (A_L + A_R) / 2
        ph_box = self._rect(EMITTER, A_L, A_R, 1.66, LANE_T)
        ph_t = self._label("process handlers")
        phn = self._node("process_handlers", ph_t, EMITTER, ph_box, title_pos="ul")
        hu = self._chip("handler_uncaught", "'uncaughtException'", EMITTER, [ax, 2.48, 0], w=A_R - A_L - 0.2)
        hr = self._chip("handler_unhandled", "'unhandledRejection'", EMITTER, [ax, 1.98, 0], w=A_R - A_L - 0.2)
        cl = self._node("claimer", self._label("claimer"), ISOLATION, self._rect(ISOLATION, ax - 0.9, ax + 0.9, -0.1, 0.5))

        # ---------------- under the host: records on disk, Electron main
        rec_box = self._rect(RECORDS, -2.5, HOST_R, LOW_B, LOW_T)
        disk = disk_icon(RECORDS, 0.36).move_to([-2.2, (LOW_B + LOW_T) / 2, 0])
        rec_t = self._label("on disk", size=SMALL)
        rec = self._node("records", rec_t, RECORDS, rec_box, deco=VGroup(disk))
        rec_t.next_to(disk, RIGHT, buff=0.15)
        ry = (LOW_B + LOW_T) / 2
        pj = self._chip("provisional_json", "provisional.json", RECORDS, [bx + 0.05, ry, 0])
        cj = self._chip("crash_json", "crash.json", RECORDS, [ax, ry, 0])
        sup_lbl = self._label("Electron main", "DesktopHostSupervisor", sub_mono=True)
        sup = self._node("supervisor", sup_lbl, SUPERVISOR, self._rect(SUPERVISOR, HOST_L, -2.7, -3.92, LOW_T))

        # ---------------- arrows
        A = self._arrow
        a_hb = A("arrow_heartbeat", [LANE_R, hb.box.get_y(), 0], hb.box.get_left(), HEARTBEAT)
        a_sl = A("arrow_slot", [LANE_R, sl.box.get_y(), 0], sl.box.get_left(), HEARTBEAT)
        a_wm = A("link_watchdog_memory", [bx, sab_box.get_bottom()[1], 0], [bx, wd.box.get_top()[1], 0], WORKER,
                 dashed=True)
        a_wp = A("arrow_watchdog_provisional", [bx, wd.box.get_bottom()[1], 0], [bx, pj.box.get_top()[1], 0], WORKER)
        a_hc = A("arrow_handlers_claimer", [ax, ph_box.get_bottom()[1], 0], [ax, cl.box.get_top()[1], 0], EMITTER)
        a_cc = A("arrow_claimer_crash", [ax, cl.box.get_bottom()[1], 0], [ax, cj.box.get_top()[1], 0], ISOLATION)
        ex = -1.3
        a_rs = self._elbow("arrow_records_supervisor",
                           [[ex, LOW_B, 0], [ex, -3.62, 0], [sup.box.get_right()[0] + 0.02, -3.62, 0]], RECORDS)
        sx = (HOST_L + -2.7) / 2
        a_sh = A("arrow_supervisor_host", [sx, LOW_T, 0], [sx, HOST_B, 0], SUPERVISOR)

        # containers and their members
        lane_nodes = ("call_stack", "next_tick_queue", "microtask_queue", "loop_ring",
                      *[f"phase_{p}" for p in PHASES], "widget_sample", "widget_pinger", "widget_spinner",
                      "blame_store")
        self.members = {
            "main_thread": (lane_nodes, ()),
            "loop_ring": (tuple(f"phase_{p}" for p in PHASES), ()),
            "widget_handlers": (("widget_sample", "widget_pinger", "widget_spinner"), ()),
            "shared_memory": (("heartbeat_cell", "slot_cell"), ()),
            "process_handlers": (("handler_uncaught", "handler_unhandled"), ()),
            "records": (("provisional_json", "crash_json"), ()),
            "host": (("main_thread", *lane_nodes, "shared_memory", "heartbeat_cell", "slot_cell", "watchdog",
                      "process_handlers", "handler_uncaught", "handler_unhandled", "claimer"),
                     ("arrow_heartbeat", "arrow_slot", "link_watchdog_memory", "arrow_handlers_claimer")),
        }

        # draw order: containers first, then boxes, chips, arrows, the ribbon on top
        self.add(host, lane, sab, phn, rec, sup,
                 cstack, ntq, mtq, *phase_nodes, ring, *wchips,
                 hb, sl, wd, hu, hr, cl, pj, cj,
                 a_hb, a_sl, a_wm, a_wp, a_hc, a_cc, a_rs, a_sh,
                 blame)

    # ------------------------------------------------------------ access
    def node(self, key) -> _Node:
        return self.nodes[key]

    def box(self, key) -> VMobject:
        """The shape of node `key` (for a group key: the bounding area of its members)."""
        if key in self.nodes:
            return self.nodes[key].box
        return self._area(key)

    def _area(self, key) -> VMobject:
        """A plain rectangle around node `key` and its members (for zoom and placement)."""
        keys, _ = self._expand([key], [])
        mobs = [self.nodes[k] for k in keys if k in self.nodes]
        g = VGroup(*mobs)
        return Rectangle(width=g.width, height=g.height).move_to(g.get_center())

    def _expand(self, keys, arrows):
        keys, arrows = set(keys), set(arrows)
        for k in list(keys):
            if k in self.members:
                ns, ars = self.members[k]
                keys |= set(ns)
                arrows |= set(ars)
        for k in list(keys):  # nested containers (host -> main_thread -> ...)
            if k in self.members:
                ns, ars = self.members[k]
                keys |= set(ns)
                arrows |= set(ars)
        bad = keys - set(self.nodes) - set(self.GROUPS)
        if bad:
            raise KeyError(f"not an outline key: {sorted(bad)}")
        return keys & set(self.nodes), arrows

    # ------------------------------------------------------------ styling
    def _node_state(self, n: _Node, state: str):
        """state: normal | high | dim. Returns an animation."""
        op = DIM if state == "dim" else 1.0
        if n.kind == "arc":
            sw = ARC_HIGH_SW if state == "high" else ARC_SW
            anims = [n.box.animate.set_stroke(width=sw, opacity=op)]
        elif n.kind == "ribbon":
            sw = RIBBON_HIGH_SW if state == "high" else RIBBON_SW
            anims = [n.box.animate.set_stroke(width=sw, opacity=DIM if state == "dim" else
                                              (1.0 if state == "high" else RIBBON_OP))]
        elif n.kind == "hub":
            anims = [self._line_state(n.box, op, width=5 if state == "high" else 3)]
        else:
            sw, fill = {"normal": (NORMAL_SW, NORMAL_FILL), "high": (HIGH_SW, HIGH_FILL),
                        "dim": (NORMAL_SW, 0.02)}[state]
            if n.is_chip:
                fill = fill * 2
            anims = [n.box.animate.set_stroke(width=sw, opacity=op).set_fill(opacity=fill)]
        if len(n.deco):
            df = {"normal": DECO_FILL, "high": DECO_HIGH_FILL, "dim": DECO_FILL * DIM}[state]
            anims.append(n.deco.animate.set_stroke(opacity=op).set_fill(opacity=df))
        if len(n.label):
            anims.append(n.label.animate.set_opacity(max(op, 0.3) if state == "dim" else 1.0))
        return AnimationGroup(*anims, group=n)

    @staticmethod
    def _line_state(m, op, width=None):
        """Stroke opacity (and width) of a line or arrow, fill opacity of its tips only:
        set_opacity on an open path would fill the area that the path encloses."""
        tips = [x for x in m.get_family() if isinstance(x, ArrowTip)]
        lines_ = [x for x in m.get_family() if not isinstance(x, ArrowTip) and len(x.points)]
        anims = [x.animate.set_stroke(opacity=op, **({} if width is None else {"width": width})) for x in lines_]
        anims += [t.animate.set_fill(opacity=op).set_stroke(opacity=op) for t in tips]
        return AnimationGroup(*anims, group=m)

    def _arrow_state(self, key, on: bool):
        return self._line_state(self.arrows[key], 1.0 if on else DIM)

    def highlight(self, *keys, arrows=(), dim_others=True) -> Animation:
        """Light the given nodes (and arrows); dim every other node and arrow.
        A container or group key also lights its members (see the top comment)."""
        keys, arrows = self._expand(keys, arrows)
        anims = []
        for k, n in self.nodes.items():
            anims.append(self._node_state(n, "high" if k in keys else ("dim" if dim_others else "normal")))
        for k in self.arrows:
            anims.append(self._arrow_state(k, k in arrows or not dim_others))
        # group=self: without it Manim adds a new Group of the animated parts to the scene,
        # which takes the outline apart and redraws arrows over the boxes
        return AnimationGroup(*anims, group=self)

    def reset(self) -> Animation:
        """Every node and arrow back to normal."""
        return AnimationGroup(*[self._node_state(n, "normal") for n in self.nodes.values()],
                              *[self._arrow_state(k, True) for k in self.arrows], group=self)

    def set_highlight_now(self, *keys, arrows=()):
        """Same as highlight(), applied at once with no animation."""
        anim = self.highlight(*keys, arrows=arrows)
        anim.begin()
        anim.finish()
        return self

    def trace(self, scene, keys, color, run_time=3.0):
        """Play a flash that runs along the boxes of `keys` in order (PATH_A_KEYS, PATH_B_KEYS),
        in `run_time` seconds. It plays by itself (do not wrap it in self.play). The outline
        does not change; each flash is a top-level copy that the scene removes after it."""
        steps = [(k, 1.0) for k in keys]
        for k, rt in self._schedule(scene, steps, run_time):
            shape = self.nodes[k].box.copy()
            shape.set_fill(opacity=0).set_stroke(color, width=9, opacity=1)
            scene.play(ShowPassingFlash(shape, time_width=0.6), run_time=rt())
        return self

    # ------------------------------------------------------------ camera
    def _zoom_width(self, key, margin):
        b = self.nodes[key].box if key in self.nodes and key not in self.members else self._area(key)
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
        -> fade the outline out.

        After it the camera is home and the screen is empty except mobjects the scene added
        before. Spend the whole time of a beat: pass run_time=b.left.
        """
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
        -> light `next_key` (or reset). Leaves the outline on screen, camera home.
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
                self.set_highlight_now(key, *also, arrows=arrows)
                w, c = self._zoom_width(key, 1.3)
                scene.camera.frame.set(width=w).move_to(ORIGIN if w >= FRAME_W else c)
                scene.play(FadeIn(self), run_time=rt())
            elif step == "zoom":
                scene.play(self.camera_home(scene), run_time=rt())
            elif step == "next":
                scene.play(self.highlight(next_key) if next_key else self.reset(), run_time=rt())
        return self
