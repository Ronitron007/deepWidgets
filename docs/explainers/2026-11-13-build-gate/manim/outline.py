"""The one anchor diagram of the page build gate video (script scene `outline`).

Shared base file. Part modules do not edit it.

Layout, left to right and top to bottom:

    [widget_install(dir)] -> [ host gates: compile | lint | test run ] -> [page/ exists?]
                                                                              :
    [ page gates: page-files -> page-types -> page-build -> page-render ] <....:
        :                                                    |
    [refuse]                                   [profile folder] -> [live]

Node keys (`OutlineDiagram.KEYS`):
  install, host_gates, gate_compile, gate_lint, gate_test_run, page_q,
  page_gates, page_files, page_types, page_build, page_render, profile, live, refuse
Arrow keys (`OutlineDiagram.ARROWS`):
  arrow_install_gates, arrow_gates_q, branch_page,
  arrow_files_types, arrow_types_build, arrow_build_render,
  arrow_render_profile, arrow_profile_live, branch_refuse
A container key (`host_gates`, `page_gates`) lights its members and their inner arrows too.
"""
from __future__ import annotations

from manim import *  # noqa: F401,F403

from style import (BG, BUILD, CREATION, DIM, FILES, FRAME_W, ISOLATION, LABEL, MCP, MUTED, OPEN,
                   RENDER, SMALL, SOLVED, TEXT, TYPES, DISK, T)

NORMAL_SW, HIGH_SW = 2.5, 5
NORMAL_FILL, HIGH_FILL = 0.07, 0.2

ROW_L, ROW_R = -6.78, 6.78
PAD = 0.22


class _Node(VGroup):
    """One outline box: .box (rect) and .label (text group)."""

    def __init__(self, key, box, label, color, chip=False):
        super().__init__(box, label)
        self.key, self.box, self.label, self.concept_color, self.is_chip = key, box, label, color, chip
        self.underlay = None


class OutlineDiagram(VGroup):
    KEYS = ("install", "host_gates", "gate_compile", "gate_lint", "gate_test_run", "page_q",
            "page_gates", "page_files", "page_types", "page_build", "page_render",
            "profile", "live", "refuse")
    ARROWS = ("arrow_install_gates", "arrow_gates_q", "branch_page",
              "arrow_files_types", "arrow_types_build", "arrow_build_render",
              "arrow_render_profile", "arrow_profile_live", "branch_refuse")

    def __init__(self, **kw):
        super().__init__(**kw)
        self.nodes: dict[str, _Node] = {}
        self.arrows: dict[str, VMobject] = {}
        self.members: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {}
        self._build()
        assert set(self.nodes) == set(self.KEYS), set(self.nodes) ^ set(self.KEYS)
        assert set(self.arrows) == set(self.ARROWS), set(self.arrows) ^ set(self.ARROWS)

    # ------------------------------------------------------------ construction
    @staticmethod
    def _label(title, sub=None, sub_mono=False, title_mono=False):
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
            label.next_to(box.get_corner(UL), DR, buff=0.14)
        elif title_pos == "ur":
            label.next_to(box.get_corner(UR), DL, buff=0.14)
        for line in label[:getattr(label, "n_titles", 1)]:
            line.set_color(color)
        n = _Node(key, box, label, color)
        self.nodes[key] = n
        return n

    def _chip(self, key, text, color, mono=True, pad=0.16, h=0.52, solid=False):
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
                ar.add_tip(tip_length=0.16, tip_width=0.16)
        else:
            ar = Arrow(a, b, buff=0.04, color=color, stroke_width=4, tip_length=0.18,
                       max_tip_length_to_length_ratio=0.45, max_stroke_width_to_length_ratio=20)
        self.arrows[key] = ar
        return ar

    def _build(self):
        # ---------------- top row: the install call and the three host gates
        ay = 2.55
        install = self._node("install", self._label(("widget_install", "(dir)"), title_mono=True), MCP,
                             h=1.25)
        gl = self._label("host gates")
        gates = [self._node(k, self._label(t), CREATION, h=0.78) for k, t in
                 [("gate_compile", "compile"), ("gate_lint", "lint"), ("gate_test_run", "test run")]]
        grow = VGroup(*gates).arrange(RIGHT, buff=0.3)
        host = self._node("host_gates", gl, CREATION, w=grow.width + 0.6, h=1.72,
                          center=[0, ay, 0], title_pos="ul")
        q = self._node("page_q", self._label(("page/", "exists?"), title_mono=True), OPEN, h=1.25)
        self._spread([install, host, q], ROW_L + PAD, ROW_R - PAD, ay)
        gl.next_to(host.box.get_corner(UL), DR, buff=0.14)
        grow.move_to([host.box.get_x(), host.box.get_y() - 0.28, 0])

        # ---------------- middle row: the four page gates
        by = -0.45
        pf = self._node("page_files", self._label(("page-", "files"), title_mono=True), FILES, h=1.4)
        pt = self._node("page_types", self._label(("page-", "types"), title_mono=True), TYPES, h=1.4)
        pb = self._node("page_build", self._label(("page-", "build"), title_mono=True), BUILD, h=1.4)
        pr = self._node("page_render", self._label(("page-", "render"), title_mono=True), RENDER, h=1.4)
        prow = [pf, pt, pb, pr]
        pl = self._label("page gates")
        pages = self._node("page_gates", pl, CREATION, w=ROW_R - ROW_L, h=2.8,
                           center=[(ROW_L + ROW_R) / 2, by - 0.1, 0], title_pos="ur")
        self._spread(prow, ROW_L + 0.9, ROW_R - 0.9, by)
        pl.next_to(pages.box.get_corner(UR), DL, buff=0.14)

        # ---------------- bottom row: refuse on the left, the profile folder and live on the right
        cy = -2.95
        refuse = self._node("refuse", self._label("refuse", "nothing changes"), ISOLATION, h=1.05)
        refuse.move_to([ROW_L + PAD + refuse.box.width / 2, cy, 0])
        live = self._node("live", self._label("live"), SOLVED, h=1.05)
        live.move_to([ROW_R - PAD - live.box.width / 2, cy, 0])
        prof = self._node("profile", self._label("profile folder"), DISK, h=1.05)
        prof.move_to([live.box.get_left()[0] - 0.75 - prof.box.width / 2, cy, 0])

        # ---------------- arrows
        A = self._arrow
        a1 = A("arrow_install_gates", install.box.get_right(), host.box.get_left(), MCP)
        a2 = A("arrow_gates_q", host.box.get_right(), q.box.get_left(), CREATION)
        a3 = A("arrow_files_types", pf.box.get_right(), pt.box.get_left(), FILES)
        a4 = A("arrow_types_build", pt.box.get_right(), pb.box.get_left(), TYPES)
        a5 = A("arrow_build_render", pb.box.get_right(), pr.box.get_left(), BUILD)
        a6 = A("arrow_render_profile", [pr.box.get_x(), pages.box.get_bottom()[1], 0],
               [prof.box.get_x(), prof.box.get_top()[1], 0], RENDER)
        a7 = A("arrow_profile_live", prof.box.get_right(), live.box.get_left(), DISK)

        # the dashed branch: page/ exists? -> the page gates row
        qx, qb = q.box.get_x(), q.box.get_bottom()[1]
        band = (qb + pages.box.get_top()[1]) / 2
        branch = VMobject(stroke_color=OPEN, stroke_width=3.5)
        branch.set_points_as_corners([[qx, qb, 0], [qx, band, 0], [pf.box.get_x(), band, 0],
                                      [pf.box.get_x(), pf.box.get_top()[1] + 0.1, 0]])
        btip = Triangle(fill_color=OPEN, fill_opacity=1, stroke_width=0).scale(0.1)
        btip.rotate(PI).move_to([pf.box.get_x(), pf.box.get_top()[1] + 0.06, 0])
        branch_page = VGroup(DashedVMobject(branch, num_dashes=46, dashed_ratio=0.6), btip)
        branch_page[0].set_stroke(OPEN, 3.5)
        self.arrows["branch_page"] = branch_page
        bq = T("yes", SMALL, TEXT).next_to(branch_page, UP, buff=0.0)
        bq.move_to([qx - 1.3, band + 0.26, 0])
        branch_page.add(bq)

        a8 = A("branch_refuse", [pf.box.get_x() - 0.0, pages.box.get_bottom()[1], 0],
               [refuse.box.get_x(), refuse.box.get_top()[1], 0], ISOLATION, dashed=True)

        self.members = {
            "host_gates": (("gate_compile", "gate_lint", "gate_test_run"), ()),
            "page_gates": (("page_files", "page_types", "page_build", "page_render"),
                           ("arrow_files_types", "arrow_types_build", "arrow_build_render")),
        }

        self.add(host, pages,
                 install, *gates, q,
                 pf, pt, pb, pr, refuse, prof, live,
                 a1, a2, a3, a4, a5, a6, a7, a8, branch_page)

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
        """Light the given nodes (and arrows); dim every other node and arrow."""
        keys, arrows = self._expand(keys, arrows)
        anims = []
        for k, n in self.nodes.items():
            anims.append(self._node_state(n, "high" if k in keys else ("dim" if dim_others else "normal")))
        for k in self.arrows:
            anims.append(self._arrow_state(k, k in arrows or not dim_others))
        return AnimationGroup(*anims, group=self)

    def reset(self) -> Animation:
        return AnimationGroup(*[self._node_state(n, "normal") for n in self.nodes.values()],
                              *[self._arrow_state(k, True) for k in self.arrows], group=self)

    def set_highlight_now(self, *keys, arrows=()):
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
        w, c = self._zoom_width(key, margin)
        if w >= FRAME_W:
            c = ORIGIN
        return scene.camera.frame.animate.set(width=w).move_to(c)

    @staticmethod
    def camera_home(scene):
        return scene.camera.frame.animate.set(width=FRAME_W).move_to(ORIGIN)

    @staticmethod
    def _camera_home_now(scene):
        scene.camera.frame.set(width=FRAME_W).move_to(ORIGIN)

    @staticmethod
    def _schedule(scene, steps, run_time):
        t0 = scene.renderer.time
        total = sum(w for _, w in steps)
        acc = 0.0
        fr = 1.0 / config.frame_rate
        for step, w in steps:
            acc += w
            end = t0 + run_time * acc / total
            yield step, (lambda end=end: max(fr, end - scene.renderer.time))

    def open_part(self, scene, key, run_time=3.0, arrows=(), also=()):
        """(fade in) -> light `key` -> zoom into `key` -> fade the outline out. Camera ends home."""
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
        """(fade the scene out) -> the outline fades in zoomed on `key` -> zoom out -> light `next_key`."""
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
