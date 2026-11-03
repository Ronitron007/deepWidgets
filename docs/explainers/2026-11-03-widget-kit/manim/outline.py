"""The one outline diagram of the widget kit video (scenes `outline_today`, `outline_kit`).
Each part opens and closes on it.

Shared base file. Part agents do not edit it.

Layout: top row `today` (the path of today), bottom row `kit path (direction)`, the
Electron main column on the right, the doors and side boxes between and under the rows,
the checks strip at the bottom. The bottom-right corner stays free for style.spec_tag(DR).

Node keys (`OutlineDiagram.KEYS` lists them):
  rows (containers):  today_row, kit_row
  today row:          agent, mcp_install, gates, gate_compile, gate_lint, gate_test_run, host, shell
  kit row:            kit_project, kit_config, agent_library, type_gate, vite_build, render_check,
                      pinned_pages
  right column:       electron_main, windows, win_shadcn, win_clock, win_meter
  doors and sides:    mcp_door, describe, settings_pane, host_extras, pin, checks
Arrow keys (`OutlineDiagram.ARROWS`):
  today: arrow_agent_mcp, arrow_mcp_gates, arrow_gates_host, arrow_host_shell, arrow_shell_em
  kit:   arrow_kit_library, arrow_library_type, arrow_type_vite, arrow_vite_render,
         arrow_render_pinned, arrow_pinned_em
  other: arrow_em_windows, arrow_describe (agent -> MCP door), arrow_door_kit,
         arrow_settings_kit, link_host_extras, line_pin (kit project -> pinned pages)
A container key (today_row, kit_row, gates, windows) lights its members and inner arrows too.
"""
from __future__ import annotations

from manim import *  # noqa: F401,F403

from style import (AGENT, BG, CHECKS, CONFIG, CREATION, DESCRIBE, DIM, FRAME_W, HOST, HOST_EXTRAS, KIT, LABEL,
                   MCP, MUTED, PIN, SERVING, SETTINGS, SHELL, SMALL, TEXT, VITE, T)

NORMAL_SW, HIGH_SW = 2.5, 5
NORMAL_FILL, HIGH_FILL = 0.07, 0.2

# x range of the two rows; the Electron main column is right of it
ROW_L, ROW_R = -6.76, 4.9
EM_L, EM_R = 5.15, 6.76
PAD = 0.2


class _Node(VGroup):
    """One outline box: .box (rect) and .label (text group)."""

    def __init__(self, key, box, label, color, chip=False):
        super().__init__(box, label)
        self.key, self.box, self.label, self.concept_color, self.is_chip = key, box, label, color, chip
        self.underlay = None  # opaque backing of a tag on a line


class OutlineDiagram(VGroup):
    KEYS = ("today_row", "kit_row",
            "agent", "mcp_install", "gates", "gate_compile", "gate_lint", "gate_test_run", "host", "shell",
            "kit_project", "kit_config", "agent_library", "type_gate", "vite_build", "render_check",
            "pinned_pages",
            "electron_main", "windows", "win_shadcn", "win_clock", "win_meter",
            "mcp_door", "describe", "settings_pane", "host_extras", "pin", "checks")
    ARROWS = ("arrow_agent_mcp", "arrow_mcp_gates", "arrow_gates_host", "arrow_host_shell", "arrow_shell_em",
              "arrow_kit_library", "arrow_library_type", "arrow_type_vite", "arrow_vite_render",
              "arrow_render_pinned", "arrow_pinned_em",
              "arrow_em_windows", "arrow_describe", "arrow_door_kit", "arrow_settings_kit",
              "link_host_extras", "line_pin")

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
    def _label(title, sub=None, sub_mono=False, title_mono=False):
        """title (and sub): a string, or a tuple of strings for several lines."""
        titles = title if isinstance(title, tuple) else (title,)
        subs = sub if isinstance(sub, tuple) else ((sub,) if sub else ())
        parts = [T(t, LABEL, TEXT, bold=not title_mono, mono=title_mono) for t in titles]
        parts += [T(x, SMALL, TEXT, mono=sub_mono) for x in subs]
        g = VGroup(*parts).arrange(DOWN, buff=0.08)
        g.n_titles = len(titles)
        return g

    def _node(self, key, label, color, w=None, h=None, center=ORIGIN, pad=0.25, title_pos="center"):
        w = w if w is not None else label.width + 2 * pad
        h = h if h is not None else label.height + 2 * pad
        box = RoundedRectangle(corner_radius=0.14, width=w, height=h, stroke_color=color,
                               stroke_width=NORMAL_SW, fill_color=color, fill_opacity=NORMAL_FILL)
        box.move_to(center)
        if title_pos == "center":
            label.move_to(box)
        elif title_pos == "ul":
            label.next_to(box.get_corner(UL), DR, buff=0.12)
        elif title_pos == "ur":
            label.next_to(box.get_corner(UR), DL, buff=0.12)
        for line in label[:getattr(label, "n_titles", 1)]:
            line.set_color(color)  # title lines in the concept color, sub lines stay TEXT
        n = _Node(key, box, label, color)
        self.nodes[key] = n
        return n

    def _chip(self, key, text, color, mono=True, pad=0.15, h=0.5, solid=False):
        """A small box. solid=True puts an opaque backing under it, for a tag that sits on a line."""
        t = T(text, SMALL, TEXT, mono=mono)
        box = RoundedRectangle(corner_radius=0.1, width=t.width + 2 * pad, height=h,
                               stroke_color=color, stroke_width=NORMAL_SW, fill_color=color,
                               fill_opacity=NORMAL_FILL * 2)
        t.move_to(box)
        n = _Node(key, box, t, color, chip=True)
        if solid:
            n.underlay = box.copy().set_stroke(width=0).set_fill(BG, opacity=1)
            n.add_to_back(n.underlay)
        self.nodes[key] = n
        return n

    @staticmethod
    def _spread(nodes, x0, x1, y):
        """Place nodes left to right between x0 and x1 with equal gaps, centered on y."""
        free = (x1 - x0) - sum(n.box.width for n in nodes)
        gap = free / (len(nodes) - 1)
        x = x0
        for n in nodes:
            n.move_to([x + n.box.width / 2, y, 0], coor_mask=[1, 1, 0])
            n.shift(UP * (y - n.box.get_y()))
            x += n.box.width + gap
        return gap

    def _arrow(self, key, a, b, color, dashed=False, tip=True):
        if dashed:
            ar = DashedLine(a, b, color=color, stroke_width=3.5, dash_length=0.07)
            if tip:
                ar.add_tip(tip_length=0.15, tip_width=0.15)
        else:
            ar = Arrow(a, b, buff=0.04, color=color, stroke_width=4, tip_length=0.16,
                       max_tip_length_to_length_ratio=0.45, max_stroke_width_to_length_ratio=20)
        self.arrows[key] = ar
        return ar

    def _build(self):
        x0, x1 = ROW_L + PAD, ROW_R - PAD

        # ---------------- today row
        today = self._node("today_row", self._label("today"), MUTED, w=ROW_R - ROW_L, h=1.8,
                           center=[(ROW_L + ROW_R) / 2, 3.02, 0], title_pos="ul")
        ty = 2.85
        agent = self._node("agent", self._label("agent", "bundle"), AGENT, h=1.15)
        mcp_i = self._node("mcp_install", self._label("MCP", "install"), MCP, h=1.15)
        chips = [self._chip(k, t, CREATION, mono=False) for k, t in
                 [("gate_compile", "compile"), ("gate_lint", "lint"), ("gate_test_run", "test run")]]
        crow = VGroup(*chips).arrange(RIGHT, buff=0.1)
        gl = self._label("gates")
        gates = self._node("gates", gl, CREATION, w=crow.width + 0.3, h=1.15)
        host = self._node("host", self._label("host", ("loads", "bundle")), HOST, h=1.15)
        shell = self._node("shell", self._label(("shared", "shell")), SHELL, h=1.15)
        row_t = [agent, mcp_i, gates, host, shell]
        self._spread(row_t, x0, x1, ty)
        VGroup(gl, crow).arrange(DOWN, buff=0.1).move_to(gates.box)

        # ---------------- kit row
        kit = self._node("kit_row", self._label("kit path (direction)"), KIT, w=ROW_R - ROW_L, h=2.35,
                         center=[(ROW_L + ROW_R) / 2, -0.925, 0], title_pos="ur")
        ky = -1.05
        cfg = self._chip("kit_config", "kit.json", CONFIG)
        kl = self._label("kit project")
        kp = self._node("kit_project", kl, KIT, w=max(kl.width, cfg.width) + 0.3, h=1.6)
        lib = self._node("agent_library", self._label(("agent", "library"), "+ child"), AGENT, h=1.6)
        tg = self._node("type_gate", self._label(("type", "gate")), CREATION, h=1.6)
        vb = self._node("vite_build", self._label(("Vite", "build")), VITE, h=1.6)
        rc = self._node("render_check", self._label(("render", "check")), CREATION, h=1.6)
        pp = self._node("pinned_pages", self._label(("page",), "per slug"), SHELL, h=1.6)
        row_k = [kp, lib, tg, vb, rc, pp]
        self._spread(row_k, x0, x1, ky)
        VGroup(kl, cfg).arrange(DOWN, buff=0.18).move_to(kp.box)

        # ---------------- Electron main column: from the top of the today boxes to the bottom of the kit boxes
        top, bot = agent.box.get_top()[1], kp.box.get_bottom()[1]
        em = self._node("electron_main", self._label(("Electron", "main")), SERVING, w=EM_R - EM_L,
                        h=top - bot, center=[(EM_L + EM_R) / 2, (top + bot) / 2, 0])

        # ---------------- middle band: MCP door, describe tag, host extras, windows
        door = self._node("mcp_door", self._label("MCP", "kit tools"), MCP)
        door.move_to([x0 + door.box.width / 2, 0.875, 0])
        ax = agent.box.get_x()
        desc = self._chip("describe", "dynamic description", DESCRIBE, mono=False, solid=True)
        desc.move_to([ax + 0.18 + desc.box.width / 2, 1.67, 0])
        hx = self._node("host_extras", self._label("host extras"), HOST_EXTRAS)
        hx.move_to([host.box.get_x(), 1.1, 0])
        wins = [self._chip(k, t, SHELL, h=0.46) for k, t in
                [("win_shadcn", "shadcn"), ("win_clock", "clock"), ("win_meter", "meter")]]
        wcol = VGroup(*wins).arrange(DOWN, buff=0.05)
        wbox = RoundedRectangle(corner_radius=0.14, width=wcol.width + 0.2, height=wcol.height + 0.16,
                                stroke_color=SHELL, stroke_width=NORMAL_SW, fill_color=SHELL,
                                fill_opacity=NORMAL_FILL)
        wn = _Node("windows", wbox, VGroup(), SHELL)
        self.nodes["windows"] = wn
        wbox.move_to([shell.box.get_x(), 1.19, 0])
        wcol.move_to(wbox)

        # ---------------- under the kit row: settings door, pin line, checks strip
        sp = self._node("settings_pane", self._label("settings pane"), SETTINGS)
        sp.move_to([x0 + sp.box.width / 2, -2.95, 0])
        pin = self._chip("pin", "pin or rebuild", PIN, mono=False, solid=True)
        pin_y = -2.42
        pin.move_to([(kp.box.get_right()[0] + pp.box.get_x()) / 2, pin_y, 0])
        ck_l = self._label("checks", "smoke, MCP tests, TLA+")
        ck_l.arrange(RIGHT, buff=0.3)
        ck = self._node("checks", ck_l, CHECKS, h=0.6)
        ck.move_to([sp.box.get_right()[0] + 0.35 + ck.box.width / 2, -3.6, 0])

        # ---------------- arrows
        def mid_r(n, dy=0.0):
            return n.box.get_right() + UP * dy

        def mid_l(n, dy=0.0):
            return n.box.get_left() + UP * dy

        A = self._arrow
        a_today = [A("arrow_agent_mcp", mid_r(agent), mid_l(mcp_i), AGENT),
                   A("arrow_mcp_gates", mid_r(mcp_i), mid_l(gates), MCP),
                   A("arrow_gates_host", mid_r(gates), mid_l(host), CREATION),
                   A("arrow_host_shell", mid_r(host), mid_l(shell), HOST)]
        a_shell_em = A("arrow_shell_em", mid_r(shell), [EM_L, shell.box.get_y(), 0], SHELL)
        a_kit = [A("arrow_kit_library", mid_r(kp), mid_l(lib), KIT),
                 A("arrow_library_type", mid_r(lib), mid_l(tg), AGENT),
                 A("arrow_type_vite", mid_r(tg), mid_l(vb), CREATION),
                 A("arrow_vite_render", mid_r(vb), mid_l(rc), VITE),
                 A("arrow_render_pinned", mid_r(rc), mid_l(pp), CREATION)]
        a_pin_em = A("arrow_pinned_em", mid_r(pp), [EM_L, pp.box.get_y(), 0], SHELL)
        a_em_w = A("arrow_em_windows", [EM_L, wbox.get_y(), 0], wbox.get_right(), SERVING)
        a_desc = A("arrow_describe", [ax, agent.box.get_bottom()[1], 0], [ax, door.box.get_top()[1], 0], AGENT)
        a_door = A("arrow_door_kit", [ax, door.box.get_bottom()[1], 0], [ax, kp.box.get_top()[1], 0], MCP)
        a_set = A("arrow_settings_kit", [ax, sp.box.get_top()[1], 0], [ax, kp.box.get_bottom()[1], 0], SETTINGS)
        a_hx = A("link_host_extras", host.box.get_bottom(), hx.box.get_top(), HOST_EXTRAS, dashed=True, tip=False)
        lx0 = kp.box.get_right()[0] - 0.35
        lx1 = pp.box.get_x()
        pin_line = VMobject(stroke_color=PIN, stroke_width=3.5)
        pin_line.set_points_as_corners([[lx0, kp.box.get_bottom()[1], 0], [lx0, pin_y, 0],
                                        [lx1, pin_y, 0], [lx1, pp.box.get_bottom()[1] - 0.04, 0]])
        tip = Triangle(fill_color=PIN, fill_opacity=1, stroke_width=0).scale(0.09)
        tip.move_to([lx1, pp.box.get_bottom()[1] - 0.1, 0])
        line_pin = VGroup(DashedVMobject(pin_line, num_dashes=70, dashed_ratio=0.6), tip)
        line_pin[0].set_stroke(PIN, 3.5)
        self.arrows["line_pin"] = line_pin

        # containers and their members
        self.members = {
            "today_row": (("agent", "mcp_install", "gates", "gate_compile", "gate_lint", "gate_test_run",
                           "host", "shell"),
                          ("arrow_agent_mcp", "arrow_mcp_gates", "arrow_gates_host", "arrow_host_shell")),
            "kit_row": (("kit_project", "kit_config", "agent_library", "type_gate", "vite_build",
                         "render_check", "pinned_pages"),
                        ("arrow_kit_library", "arrow_library_type", "arrow_type_vite", "arrow_vite_render",
                         "arrow_render_pinned")),
            "gates": (("gate_compile", "gate_lint", "gate_test_run"), ()),
            "windows": (("win_shadcn", "win_clock", "win_meter"), ()),
        }

        # draw order: containers first, then boxes, chips, arrows on top
        self.add(today, kit, em, wbox,
                 agent, mcp_i, gates, host, shell, *chips,
                 kp, lib, tg, vb, rc, pp, cfg,
                 door, hx, *wins, sp, ck,
                 *a_today, a_shell_em, *a_kit, a_pin_em, a_em_w, a_desc, a_door, a_set, a_hx, line_pin,
                 desc, pin)

    # ------------------------------------------------------------ access
    def node(self, key) -> _Node:
        return self.nodes[key]

    def box(self, key) -> VMobject:
        return self.nodes[key].box

    def _expand(self, keys, arrows):
        keys, arrows = set(keys), set(arrows)
        for k in list(keys):
            if k in self.members:
                ns, ars = self.members[k]
                keys |= set(ns)
                arrows |= set(ars)
        return keys, arrows

    # ------------------------------------------------------------ styling
    def _node_state(self, n: _Node, state: str):
        """state: normal | high | dim. Returns an animation."""
        sw, fill, op = {"normal": (NORMAL_SW, NORMAL_FILL, 1.0), "high": (HIGH_SW, HIGH_FILL, 1.0),
                        "dim": (NORMAL_SW, 0.02, DIM)}[state]
        if n.is_chip:
            fill = fill * 2
        anims = [n.box.animate.set_stroke(width=sw, opacity=op).set_fill(opacity=fill)]
        if len(n.label):
            anims.append(n.label.animate.set_opacity(max(op, 0.3) if state == "dim" else 1.0))
        return AnimationGroup(*anims, group=n)

    def _arrow_state(self, key, on: bool):
        return self.arrows[key].animate.set_opacity(1.0 if on else DIM)

    def highlight(self, *keys, arrows=(), dim_others=True) -> Animation:
        """Light the given nodes (and arrows); dim every other node and arrow.
        A container key (today_row, kit_row, gates, windows) also lights its members."""
        keys, arrows = self._expand(keys, arrows)
        anims = []
        for k, n in self.nodes.items():
            anims.append(self._node_state(n, "high" if k in keys else ("dim" if dim_others else "normal")))
        for k in self.arrows:
            anims.append(self._arrow_state(k, k in arrows or not dim_others))
        # group=self: without it Manim adds a new Group of the animated parts to the scene,
        # which takes the outline apart and redraws arrows over the tags that sit on them
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

    # ------------------------------------------------------------ camera
    def _zoom_width(self, key, margin):
        b = self.nodes[key].box
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

    def close_part(self, scene, key, next_key=None, run_time=3.0, clear=True):
        """Part closer: (fade out the scene) -> outline fades in zoomed on `key` -> zoom out
        -> light `next_key` (or reset). Leaves the outline on screen, camera home.
        The clear step keeps mobjects with `_dw_keep = True` (style.spec_tag sets it)."""
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
                self.set_highlight_now(key)
                w, c = self._zoom_width(key, 1.3)
                scene.camera.frame.set(width=w).move_to(ORIGIN if w >= FRAME_W else c)
                scene.play(FadeIn(self), run_time=rt())
            elif step == "zoom":
                scene.play(self.camera_home(scene), run_time=rt())
            elif step == "next":
                scene.play(self.highlight(next_key) if next_key else self.reset(), run_time=rt())
        return self
