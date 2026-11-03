"""The one outline diagram of the whole path (scene `outline`). Each part opens and closes on it.

Shared base file. Part agents do not edit it.

Node keys (use these names; `OutlineDiagram.KEYS` lists them):
  desktop_app, electron_main, host_node, renderer,
  host, cordis, ctx_widgets, bundles, bundle_sample, bundle_groceries,
  shell_page, agent, mcp_server,
  creation, gate_compile, gate_lint, gate_test_run, install,
  isolation, blame, quarantine, supervisor, watchdog
Arrow keys: arrow_shell, arrow_agent, arrow_mcp, arrow_creation, link_isolation
"""
from __future__ import annotations

from manim import *  # noqa: F401,F403

from style import (AGENT, CREATION, HOST, ISOLATION, LABEL, MCP, MUTED, RUNTIME, SHELL, SMALL, TEXT, DIM,
                   FRAME_W, T, rbox)

NORMAL_SW, HIGH_SW = 2.5, 5
NORMAL_FILL, HIGH_FILL = 0.07, 0.2


class _Node(VGroup):
    """One outline box: .box (rect) and .label (text group). Children boxes are separate nodes."""

    def __init__(self, key, box, label, color):
        super().__init__(box, label)
        self.key, self.box, self.label, self.concept_color = key, box, label, color
        # title in the concept color; a second line stays TEXT
        (label[0] if isinstance(label, VGroup) else label).set_color(color)


class OutlineDiagram(VGroup):
    KEYS = ("desktop_app", "electron_main", "host_node", "renderer", "host", "cordis", "ctx_widgets",
            "bundles", "bundle_sample", "bundle_groceries", "shell_page", "agent", "mcp_server",
            "creation", "gate_compile", "gate_lint", "gate_test_run", "install",
            "isolation", "blame", "quarantine", "supervisor", "watchdog")

    def __init__(self, **kw):
        super().__init__(**kw)
        self.nodes: dict[str, _Node] = {}
        self.arrows: dict[str, VMobject] = {}
        self._build()

    # ------------------------------------------------------------ construction
    def _node(self, key, w, h, center, color, title, sub=None, title_pos="center", sub_mono=True,
              title_size=LABEL, title_mono=False):
        box = RoundedRectangle(corner_radius=0.14, width=w, height=h, stroke_color=color,
                               stroke_width=NORMAL_SW, fill_color=color, fill_opacity=NORMAL_FILL)
        box.move_to(center)
        t = T(title, title_size, TEXT, bold=not title_mono, mono=title_mono)
        parts = [t]
        if sub:
            parts.append(T(sub, SMALL, TEXT, mono=sub_mono))
        label = VGroup(*parts).arrange(DOWN, buff=0.1)
        if title_pos == "center":
            label.move_to(box)
        elif title_pos == "left":
            label.next_to(box.get_left(), RIGHT, buff=0.2)
        else:  # top-left corner label for containers
            label.next_to(box.get_corner(UL), DR, buff=0.14)
        n = _Node(key, box, label, color)
        self.nodes[key] = n
        return n

    def _chip(self, key, text, center, color, mono=True):
        t = T(text, SMALL, TEXT, mono=mono)
        box = RoundedRectangle(corner_radius=0.1, width=t.width + 0.36, height=t.height + 0.3,
                               stroke_color=color, stroke_width=NORMAL_SW, fill_color=color,
                               fill_opacity=NORMAL_FILL * 2)
        box.move_to(center)
        t.move_to(box)
        n = _Node(key, box, t, color)
        self.nodes[key] = n
        return n

    def _group_box(self, key, title, chips, color, left=None, right=None, y=0.0, buff=0.14):
        """Container with a corner title and a row of chips under it, sized to fit."""
        row = VGroup(*[c for c in chips]).arrange(RIGHT, buff=buff)
        t = T(title, LABEL, TEXT, bold=True)
        w = max(t.width, row.width) + 0.4
        h = t.height + row.height + 0.55
        n = self._node(key, w, h, [0, y, 0], color, title, title_pos="corner")
        if left is not None:
            n.shift(RIGHT * (left - n.box.get_left()[0]))
        if right is not None:
            n.shift(RIGHT * (right - n.box.get_right()[0]))
        row.next_to(n.label, DOWN, buff=0.14).align_to(n.label, LEFT)
        return n

    def _build(self):
        L, Rt = -6.85, 6.85          # outer edges of the diagram
        # desktop app column (left)
        desk = self._node("desktop_app", 2.75, 4.45, [L + 1.375, 0.375, 0], MUTED, "desktop app",
                          title_pos="corner")
        cx = desk.box.get_x()
        em = self._node("electron_main", 2.4, 0.8, [cx, 1.35, 0], SHELL, "Electron main")
        hn = self._node("host_node", 2.4, 0.8, [cx, 0.3, 0], HOST, "host (Node)")
        rd = self._node("renderer", 2.4, 0.8, [cx, -0.75, 0], SHELL, "renderer × N")
        # agent + MCP (right column)
        mx = Rt - 1.35
        agent = self._node("agent", 2.7, 0.8, [mx, 3.35, 0], AGENT, "agent")
        mcp = self._node("mcp_server", 2.7, 1.25, [mx, 0.6, 0], MCP, "MCP server", sub="/mcp :47615")
        # host (middle)
        hl, hr = desk.box.get_right()[0] + 0.3, mcp.box.get_left()[0] - 0.45
        host = self._node("host", hr - hl, 4.45, [(hl + hr) / 2, 0.375, 0], HOST, "host", title_pos="corner")
        cordis = self._node("cordis", hr - hl - 0.4, 3.6, [(hl + hr) / 2, 0.1, 0], RUNTIME, "Cordis runtime",
                            title_pos="corner")
        ix = (hl + hr) / 2 + 0.55
        ctxw = self._node("ctx_widgets", 4.0, 1.2, [ix, 0.6, 0], RUNTIME, "ctx.widgets",
                          sub="@deepwidgets/widgets", title_mono=True)
        s = self._chip("bundle_sample", "sample", ORIGIN, RUNTIME)
        g = self._chip("bundle_groceries", "groceries", ORIGIN, RUNTIME)
        chips = VGroup(s, g).arrange(RIGHT, buff=0.2)
        bl = T("bundles", SMALL, TEXT, bold=True)
        bw = bl.width + chips.width + 0.75
        bundles = self._node("bundles", bw, 0.95, [ix, -1.0, 0], RUNTIME, "bundles", title_pos="left",
                             title_size=SMALL)
        chips.next_to(bundles.label, RIGHT, buff=0.3)
        # shell page (top)
        shell = self._node("shell_page", 6.2, 0.95, [ix, 3.35, 0], SHELL, "shell page",
                           sub="/api/widgets/<slug>/…")
        shell.label.arrange(RIGHT, buff=0.3).move_to(shell.box)
        # bottom: creation and isolation
        gate_nodes = [self._chip(k, txt, ORIGIN, CREATION, mono=False) for k, txt in
                      [("gate_compile", "compile"), ("gate_lint", "lint"), ("gate_test_run", "test run"),
                       ("install", "install")]]
        iso_nodes = [self._chip(k, k, ORIGIN, ISOLATION, mono=False) for k in
                     ("blame", "quarantine", "supervisor", "watchdog")]
        cre = self._group_box("creation", "creation", gate_nodes, CREATION, left=L, y=-3.0)
        iso = self._group_box("isolation", "isolation", iso_nodes, ISOLATION, right=Rt, y=-3.0)
        assert cre.box.get_right()[0] < iso.box.get_left()[0] - 0.15, "bottom row overlaps"

        # arrows
        def arrow(key, a, b, color, dashed=False):
            if dashed:
                ar = DashedLine(a, b, color=color, stroke_width=4, dash_length=0.07)
                ar.add_tip(tip_length=0.16, tip_width=0.16)
            else:
                ar = Arrow(a, b, buff=0.06, color=color, stroke_width=4, tip_length=0.2,
                           max_tip_length_to_length_ratio=0.25)
            self.arrows[key] = ar
            return ar

        a_shell = arrow("arrow_shell", shell.box.get_bottom(), ctxw.box.get_top(), SHELL)
        a_agent = arrow("arrow_agent", agent.box.get_bottom(), mcp.box.get_top(), AGENT)
        a_mcp = arrow("arrow_mcp", mcp.box.get_left(), ctxw.box.get_right(), MCP)
        a_cre = arrow("arrow_creation", [cre.box.get_right()[0] - 0.6, cre.box.get_top()[1], 0],
                      [bundles.box.get_left()[0] + 0.5, bundles.box.get_bottom()[1], 0], CREATION)
        a_iso = arrow("link_isolation", [iso.box.get_left()[0] + 0.8, iso.box.get_top()[1], 0],
                      [iso.box.get_left()[0] + 0.8, host.box.get_bottom()[1], 0], ISOLATION, dashed=True)

        # draw order: containers first, then inner boxes, then arrows on top
        self.add(desk, host, cordis, cre, iso, em, hn, rd, ctxw, bundles, s, g, shell, agent, mcp,
                 *gate_nodes, *iso_nodes, a_shell, a_agent, a_mcp, a_cre, a_iso)

    # ------------------------------------------------------------ access
    def node(self, key) -> _Node:
        return self.nodes[key]

    def box(self, key) -> VMobject:
        return self.nodes[key].box

    # ------------------------------------------------------------ styling
    def _node_state(self, n: _Node, state: str):
        """state: normal | high | dim. Returns an animation."""
        sw, fill, op = {"normal": (NORMAL_SW, NORMAL_FILL, 1.0), "high": (HIGH_SW, HIGH_FILL, 1.0),
                        "dim": (NORMAL_SW, 0.02, DIM)}[state]
        if n.key.startswith(("bundle_", "gate_")) or n.key in ("install", "blame", "quarantine",
                                                                 "supervisor", "watchdog"):
            fill = fill * 2
        return AnimationGroup(n.box.animate.set_stroke(width=sw, opacity=op).set_fill(opacity=fill),
                              n.label.animate.set_opacity(max(op, 0.3) if state == "dim" else 1.0))

    def _arrow_state(self, key, on: bool):
        return self.arrows[key].animate.set_opacity(1.0 if on else DIM)

    def highlight(self, *keys, arrows=(), dim_others=True) -> Animation:
        """Light the given nodes (and arrows); dim every other node and arrow."""
        anims = []
        for k, n in self.nodes.items():
            anims.append(self._node_state(n, "high" if k in keys else ("dim" if dim_others else "normal")))
        for k in self.arrows:
            anims.append(self._arrow_state(k, k in arrows or not dim_others))
        return AnimationGroup(*anims)

    def reset(self) -> Animation:
        """Every node and arrow back to normal."""
        return AnimationGroup(*[self._node_state(n, "normal") for n in self.nodes.values()],
                              *[self._arrow_state(k, True) for k in self.arrows])

    def set_highlight_now(self, *keys, arrows=()):
        """Same as highlight(), applied at once with no animation."""
        anim = self.highlight(*keys, arrows=arrows)
        anim.begin()
        anim.finish()
        return self

    # ------------------------------------------------------------ camera
    def zoom_target(self, scene, key, margin=1.3):
        """camera.frame animation that fills the screen with node `key`."""
        b = self.nodes[key].box
        aspect = FRAME_W / config.frame_height
        w = max(b.width * margin, b.height * margin * aspect)
        return scene.camera.frame.animate.set(width=w).move_to(b.get_center())

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

    def open_part(self, scene, key, run_time=3.0, arrows=()):
        """Part opener: (fade in) -> light `key` -> zoom into it -> fade the outline out.

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
                scene.play(self.highlight(key, arrows=arrows), run_time=rt())
            elif step == "zoom":
                scene.play(self.zoom_target(scene, key), run_time=rt())
            elif step == "out":
                scene.play(FadeOut(self), run_time=rt())
                self._camera_home_now(scene)
        return self

    def close_part(self, scene, key, next_key=None, run_time=3.0, clear=True):
        """Part closer: (fade out the scene) -> outline fades in zoomed on `key` -> zoom out
        -> light `next_key` (or reset). Leaves the outline on screen, camera home."""
        steps = [("clear", 0.18)] if clear else []
        steps += [("in", 0.22), ("zoom", 0.36), ("next", 0.24)]
        for step, rt in self._schedule(scene, steps, run_time):
            if step == "clear":
                others = [m for m in scene.mobjects if m is not self and m is not scene.camera.frame]
                if others:
                    scene.play(*[FadeOut(m) for m in others], run_time=rt())
                else:
                    scene.wait(rt())
            elif step == "in":
                self.set_highlight_now(key)
                b = self.nodes[key].box
                aspect = FRAME_W / config.frame_height
                scene.camera.frame.set(width=max(b.width * 1.3, b.height * 1.3 * aspect)).move_to(b)
                scene.play(FadeIn(self), run_time=rt())
            elif step == "zoom":
                scene.play(self.camera_home(scene), run_time=rt())
            elif step == "next":
                scene.play(self.highlight(next_key) if next_key else self.reset(), run_time=rt())
        return self
