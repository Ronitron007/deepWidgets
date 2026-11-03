"""Part `part_close`: checks_and_mutants limits_measured open_items closing.

Beat weights are seconds of the recorded take (sentence starts found with silencedetect), so each
beat starts with its sentence. The base scales them to the audio length.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content
_X1 = FRAME_W / 2 - MARGIN - 0.25    # right edge of content


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (no-op if already later)."""
    scene.wait_until(b.start + frac * b.length)


def _card(title, sub=None, color=SOLVED, size=LABEL, sub_size=SMALL, sub_colors=None, w=None, h=None,
          dashed=False, title_mono=False, sub_mono=False):
    """Box with a bold title line in the concept color and optional lines under it. .box .title .sub"""
    t = T(title, size, color, mono=title_mono, bold=not title_mono)
    subs = []
    for i, s in enumerate([sub] if isinstance(sub, str) else (sub or [])):
        c = (sub_colors or {}).get(i, TEXT)
        subs.append(T(s, sub_size, c, mono=sub_mono))
    txt = VGroup(t, *subs).arrange(DOWN, buff=0.1)
    box = rbox(w or txt.width + 0.5, h or txt.height + 0.4, color, fill=0.1, dashed=dashed)
    txt.move_to(box)
    g = VGroup(box, txt)
    g.box, g.title, g.sub = box, t, VGroup(*subs)
    return g


def _arr(a, b, color=MUTED, buff=0.08, sw=3, tip=0.18):
    return Arrow(a, b, buff=buff, color=color, stroke_width=sw, max_tip_length_to_length_ratio=0.35,
                 tip_length=tip)


def _cross(color=ISOLATION, s=0.18):
    return VGroup(Line([-s, -s, 0], [s, s, 0], stroke_color=color, stroke_width=6),
                  Line([-s, s, 0], [s, -s, 0], stroke_color=color, stroke_width=6))


def _cursor(color=USER):
    pts = [(0, 0, 0), (0, -0.55, 0), (0.14, -0.42, 0), (0.25, -0.65, 0), (0.33, -0.61, 0),
           (0.22, -0.38, 0), (0.4, -0.38, 0)]
    return Polygon(*pts, stroke_color=BG, stroke_width=2, fill_color=color, fill_opacity=1)


def _body(card):
    """Body center of a window_card at its current place (body_center is set at build time)."""
    return card.frame.get_center() + DOWN * 0.21


def _wrap(text, width, size=SMALL, color=TEXT, mono=False, buff=0.07):
    """Text wrapped into lines no wider than `width`."""
    rows, cur = [], ""
    for w in text.split():
        trial = (cur + " " + w).strip()
        if cur and T(trial, size, mono=mono).width > width:
            rows.append(cur)
            cur = w
        else:
            cur = trial
    rows.append(cur)
    return lines(*rows, size=size, color=color, mono=mono, buff=buff)


def _item(text, dot_color, width, size=SMALL, color=TEXT):
    """Bullet item: a dot in a concept color and wrapped text."""
    body = _wrap(text, width - 0.3, size, color)
    dot = Dot(radius=0.07, color=dot_color).next_to(body[0], LEFT, buff=0.16)
    return VGroup(dot, body)


def _badge(text, color, size=LABEL):
    """Bold number label with a background patch, to sit on the outline."""
    t = T(text, size, color, bold=True)
    bg = RoundedRectangle(corner_radius=0.08, width=t.width + 0.24, height=t.height + 0.14, stroke_width=0,
                          fill_color=BG, fill_opacity=0.92)
    bg.move_to(t)
    return VGroup(bg, t)


# ====================================================================== checks_and_mutants
class ChecksAndMutants(DWScene):
    BEATS = [("open", 3.33), ("unit", 6.44), ("review", 5.16), ("mutant_def", 5.12), ("queue", 6.25),
             ("fence", 5.21), ("rerun", 3.41), ("passes", 9.13), ("blame", 5.12), ("vitest", 3.28), ("smoke", 2.67)]

    ROWS = [
        ("widgets-runtime", "34 PASS", "host check"),
        ("widgets-mcp", "23 PASS", "host check"),
        ("widgets-create", "26 PASS", "desktop part off"),
        ("widgets-watchdog", "21 PASS", "host check"),
        ("widgets-blame", "24 PASS", "on the rerun"),
        ("vitest", "11/11", "supervisor + crash policy"),
    ]

    def construct(self):
        with self.beat("open") as b:
            o = OutlineDiagram()
            self.play(FadeIn(o), run_time=b.t(0.2))
            keys = ("ctx_widgets", "shell_page", "mcp_server", "creation", "isolation")
            self.play(o.highlight(*keys), run_time=b.t(0.2))
            o.open_part(self, "host", run_time=b.left)

        # process strip
        y_strip = 1.75
        with self.beat("unit") as b:
            title = scene_title("How each box is checked", SOLVED)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.08))
            specs = [("plan unit", ["one per box"], TEXT), ("implementer", ["Opus"], AGENT),
                     ("reviewer", ["fresh Opus"], AGENT), ("check + mutant", ["can fail"], SOLVED),
                     ("merge", ["merge commit"], SOLVED)]
            boxes = [_card(n, s, c, w=2.6 if n.startswith("check") else 2.2, h=1.15) for n, s, c in specs]
            strip = VGroup(*boxes).arrange(RIGHT, buff=0.42).move_to([0, y_strip, 0])
            arrows = [_arr(boxes[i].get_right(), boxes[i + 1].get_left()) for i in range(4)]
            self.play(FadeIn(boxes[0], shift=UP * 0.15), run_time=b.t(0.1))
            unit = M(f'one unit = one branch + one pull request + '
                     f'<span fgcolor="{SOLVED}">one check that can fail</span>', LABEL)
            unit.move_to([0, 0.32, 0])
            _at(self, b, 0.25)
            self.play(FadeIn(unit), run_time=b.t(0.12))
            _at(self, b, 0.5)
            self.play(GrowArrow(arrows[0]), FadeIn(boxes[1], shift=UP * 0.15), run_time=b.t(0.12))
            self.play(GrowArrow(arrows[2]), GrowArrow(arrows[3]), FadeIn(boxes[3], shift=UP * 0.15),
                      FadeIn(boxes[4], shift=UP * 0.15), run_time=b.t(0.14))

        with self.beat("review") as b:
            self.play(GrowArrow(arrows[1]), FadeIn(boxes[2], shift=UP * 0.15), run_time=b.t(0.2))
            self.play(Indicate(boxes[2].box, color=AGENT, scale_factor=1.05), run_time=b.t(0.15))
            _at(self, b, 0.45)
            loop = CurvedArrow(boxes[1].box.get_corner(UR) + LEFT * 0.4, boxes[1].box.get_corner(UL) + RIGHT * 0.4,
                               angle=TAU / 3, color=ISOLATION, stroke_width=3, tip_length=0.16)
            x = _cross().move_to(loop.point_from_proportion(0.5))
            nv = T("never reviews its own unit", SMALL, ISOLATION).next_to(boxes[1], DOWN, buff=0.12)
            self.play(Create(loop), run_time=b.t(0.2))
            self.play(Create(x), FadeIn(nv), run_time=b.t(0.15))

        # mutants
        with self.beat("mutant_def") as b:
            self.play(Indicate(boxes[3].box, color=SOLVED, scale_factor=1.06), run_time=b.t(0.2))
            dfn = M(f'<b>mutant</b> = a wrong change that the check <span fgcolor="{SOLVED}">must catch</span>',
                    LABEL, ISOLATION)
            dfn.move_to([0, -0.24, 0])
            self.play(FadeIn(dfn, shift=UP * 0.1), run_time=b.t(0.25))

        cy = -1.8
        with self.beat("queue") as b:
            q = _card("mutant: queue removed", ["10 parallel add calls", "expect +10", "check saw n=1"], ISOLATION,
                      sub_colors={1: SOLVED, 2: ISOLATION}, w=4.6, h=2.05)
            q.move_to([_X0 + q.width / 2, cy, 0])
            self.play(FadeIn(q.box), FadeIn(q.title), run_time=b.t(0.2))
            _at(self, b, 0.45)
            self.play(FadeIn(q.sub[0]), FadeIn(q.sub[1]), run_time=b.t(0.15))
            self.play(FadeIn(q.sub[2], scale=1.2), run_time=b.t(0.15))
            fail = chip("FAIL", ISOLATION, size=SMALL).next_to(q.sub[2], RIGHT, buff=0.15)
            self.play(FadeIn(fail), run_time=b.t(0.1))

        with self.beat("fence") as b:
            f = _card("mutant: origin rule removed", ["MCP fence", "3 of 23 checks failed", "PR #55 had 3 of 13"],
                      ISOLATION, sub_colors={0: MUTED, 1: ISOLATION, 2: MUTED}, w=4.6, h=2.05)
            f.next_to(q, RIGHT, buff=0.3)
            self.play(FadeIn(f.box), FadeIn(f.title), FadeIn(f.sub[0]), run_time=b.t(0.25))
            _at(self, b, 0.55)
            self.play(FadeIn(f.sub[1], scale=1.2), run_time=b.t(0.15))
            self.play(FadeIn(f.sub[2]), run_time=b.t(0.1))
            oth = VGroup(T("more mutants", SMALL, MUTED),
                         chip("503 in gap", ISOLATION, size=SMALL), chip("blame off", ISOLATION, size=SMALL))
            oth.arrange(DOWN, buff=0.18).next_to(f, RIGHT, buff=0.35)
            self.play(FadeIn(oth, lag_ratio=0.3), run_time=b.t(0.14))

        # reruns at 108d663f
        with self.beat("rerun") as b:
            keep = [m for m in self.mobjects if m is not title]
            self.play(*[FadeOut(m) for m in keep], run_time=b.t(0.2))
            sub = M(f'host checks ran again on the merged commit <span font_family="{MONO}" fgcolor="{SOLVED}">'
                    f'108d663f</span>', BODY)
            sub.move_to([0, 2.4, 0]).to_edge(LEFT, buff=MARGIN + 0.25)
            tbl = RevealTable(["check", "result", "note"], self.ROWS, mono_cols=[0, 1], size=LABEL, row_gap=0.16,
                              cell_colors={**{(i, 1): SOLVED for i in range(6)},
                                           **{(i, 2): MUTED for i in range(6)}})
            tbl.next_to(sub, DOWN, buff=0.4).set_x(-1.3)
            self.play(FadeIn(sub), run_time=b.t(0.3))
            self.add(tbl)
            self.play(FadeIn(tbl.header), run_time=b.t(0.2))

        with self.beat("passes") as b:
            self.play(tbl.reveal_row(0), run_time=b.t(0.18))
            _at(self, b, 0.3)
            self.play(tbl.reveal_rows(1, 4, lag=0.5), run_time=b.t(0.5))

        with self.beat("blame") as b:
            first = chip("first run: FAIL", ISOLATION, size=SMALL, mono=False)
            first.move_to([tbl.hlines[0].get_right()[0] + 0.3 + first.width / 2, tbl.body_rows[4].get_y(), 0])
            self.play(FadeIn(first), run_time=b.t(0.2))
            hmr = VGroup(T("flake:", SMALL, ISOLATION), T("HMR transactions cannot be nested", SMALL, TEXT, mono=True))
            hmr.arrange(RIGHT, buff=0.15)
            hmr.next_to(tbl, DOWN, buff=0.45).align_to(tbl, LEFT)
            self.play(FadeIn(hmr), run_time=b.t(0.2))
            _at(self, b, 0.5)
            self.play(tbl.reveal_row(4), run_time=b.t(0.2))
            self.play(Create(tbl.mark_row(4, SOLVED)), run_time=b.t(0.15))

        with self.beat("vitest") as b:
            self.play(tbl.reveal_row(5), run_time=b.t(0.5))

        with self.beat("smoke") as b:
            sm = VGroup(status_chip("app smoke checks: not run again for this video", solved=False))
            sm.next_to(hmr, DOWN, buff=0.4).align_to(tbl, LEFT)
            self.play(FadeIn(sm, shift=UP * 0.1), run_time=b.t(0.3))


# ====================================================================== limits_measured
class LimitsMeasured(DWScene):
    BEATS = [("intro", 3.11), ("run", 9.57), ("sources", 9.12), ("window", 5.47), ("json", 8.70), ("sqlite", 6.47)]

    ROWS = [
        ("agent widget_call", "35 to 73 ms", "this run, 3 runs"),
        ("user call (click)", "12 to 26 ms", "this run, 3 runs"),
        ("install with gates", "3.2 to 4.2 s", "this run, 3 runs"),
        ("loop to host kill", "2050 ms", "watchdog check, 108d663f"),
        ("restart to live window", "2073 ms", "PR #61"),
        ("window memory", "~20.6 MB each", "spike"),
        ("json write", "~10 ms; ~100 writes/s in all", "spike"),
        ("sqlite write", "~0.2 ms, not on", "spike"),
        ("gates per edit", "~1.8 s", "spike"),
    ]
    COLORS = [AGENT, USER, CREATION, ISOLATION, HOST, SHELL, RUNTIME, OPEN, CREATION]

    def construct(self):
        with self.beat("intro") as b:
            title = scene_title("Measured limits", SOLVED)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            tbl = RevealTable(["measure", "value", "source"], self.ROWS, mono_cols=[], size=LABEL, row_gap=0.18,
                              cell_colors={**{(i, 1): c for i, c in enumerate(self.COLORS)},
                                           **{(i, 2): MUTED for i in range(9)}})
            tbl.move_to([-0.6, 0, 0]).align_to([0, 2.75, 0], UP)
            self.add(tbl)
            self.play(FadeIn(tbl.header), run_time=b.t(0.3))
        self.tbl = tbl

        with self.beat("run") as b:
            for i, frac in zip(range(2), (0.04, 0.2)):
                _at(self, b, frac)
                self.play(tbl.reveal_row(i), run_time=b.t(0.1))
            fast = VGroup(tbl.body_rows[0], tbl.body_rows[1])
            br = Brace(fast, RIGHT, color=SOLVED, buff=0.15)
            lt = T("< 0.1 s", LABEL, SOLVED, bold=True).next_to(br, RIGHT, buff=0.1)
            _at(self, b, 0.38)
            self.play(GrowFromCenter(br), FadeIn(lt), run_time=b.t(0.1))
            _at(self, b, 0.56)
            self.play(tbl.reveal_row(2), run_time=b.t(0.1))
            m = tbl.mark_row(2, CREATION)
            self.play(Create(m), run_time=b.t(0.1))

        with self.beat("sources") as b:
            self.play(FadeOut(m), FadeOut(br), FadeOut(lt), run_time=b.t(0.08))
            self.play(tbl.reveal_row(3), run_time=b.t(0.15))
            _at(self, b, 0.35)
            self.play(tbl.reveal_row(4), run_time=b.t(0.15))
            m = tbl.mark_row(4, HOST)
            self.play(Create(m), run_time=b.t(0.12))

        with self.beat("window") as b:
            self.play(FadeOut(m), tbl.reveal_row(5), run_time=b.t(0.3))
            m = tbl.mark_row(5, SHELL)
            note = T("each window has its own renderer", SMALL, SHELL)
            note.next_to(tbl, DOWN, buff=0.3).align_to(tbl.cell(5, 1), LEFT)
            self.play(Create(m), FadeIn(note), run_time=b.t(0.2))

        with self.beat("json") as b:
            self.play(FadeOut(m), FadeOut(note), tbl.reveal_row(6), run_time=b.t(0.2))
            m = tbl.mark_row(6, RUNTIME)
            self.play(Create(m), run_time=b.t(0.15))
            _at(self, b, 0.45)
            al = T("for all widgets together", SMALL, RUNTIME)
            al.next_to(tbl, DOWN, buff=0.3).align_to(tbl.cell(6, 1), LEFT)
            self.play(FadeIn(al), run_time=b.t(0.15))

        with self.beat("sqlite") as b:
            self.play(FadeOut(m), FadeOut(al), tbl.reveal_row(7), run_time=b.t(0.2))
            off = status_chip("not on", solved=False)
            off.next_to(tbl, DOWN, buff=0.25).align_to(tbl.cell(7, 1), LEFT)
            m = tbl.mark_row(7, OPEN)
            self.play(Create(m), run_time=b.t(0.15))
            _at(self, b, 0.5)
            self.play(tbl.reveal_row(8), run_time=b.t(0.15))
            _at(self, b, 0.82)
            self.play(FadeIn(off), run_time=b.t(0.12))


# ====================================================================== open_items
def _flow(items, x0, width, top, hbuff=0.38, vbuff=0.24):
    """Place items left to right from (x0, top), wrapping to a new row at x0 + width."""
    rows, cur, cx = [], [], 0.0
    for it in items:
        if cur and cx + it.width > width:
            rows.append(cur)
            cur, cx = [], 0.0
        cur.append(it)
        cx += it.width + hbuff
    if cur:
        rows.append(cur)
    y = top
    for r in rows:
        h = max(m.height for m in r)
        x = x0
        for m in r:
            m.move_to([x + m.width / 2, y - h / 2, 0])
            x += m.width + hbuff
        y -= h + vbuff
    return VGroup(*items)


def _it(text, color, mono=False, size=SMALL, text_color=TEXT):
    """Flow item: a dot in a concept color, then the text."""
    t = T(text, size, text_color, mono=mono)
    d = Dot(radius=0.065, color=color).next_to(t, LEFT, buff=0.13)
    return VGroup(d, t)


class OpenItems(DWScene):
    BEATS = [("intro", 2.06), ("waiting", 15.98), ("not_built", 11.24), ("packaging", 8.94), ("units", 11.30),
             ("flake", 14.74), ("unchecked", 13.30)]

    HEAD_W = 2.3

    def _band(self, head, groups, top):
        """A dashed band: header at the left, then flowed groups of items (each group starts a new row)."""
        x0 = _X0 + 0.2 + self.HEAD_W + 0.2
        width = _X1 - 0.2 - x0
        y = top - 0.18
        laid = []
        for g in groups:
            fg = _flow(g, x0, width, y)
            laid.append(fg)
            y = fg.get_bottom()[1] - 0.26
        h = top - y + 0.06
        box = rbox(_X1 - _X0, h, OPEN, fill=0.04, dashed=True, sw=2)
        box.move_to([(_X0 + _X1) / 2, top - h / 2, 0])
        hd = _wrap(head, self.HEAD_W, LABEL, TEXT)
        hd.move_to([_X0 + 0.2 + hd.width / 2, top - 0.18 - hd.height / 2, 0])
        return box, hd, laid

    def construct(self):
        with self.beat("intro") as b:
            title = scene_title("Open items", OPEN)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        gap = 0.3
        wait_items = [_it("renderer per window, or one shared", SHELL), _it("Tailwind in the shell", SHELL),
                      _it("main desktop only", SHELL), _it("rules for each agent", AGENT),
                      _it("five create tools, or one", CREATION)]
        wait_note = [T("the build uses a provisional choice for each", SMALL, MUTED)]
        bA = self._band("waiting for the operator", [wait_items, wait_note], CONTENT_TOP)

        nb_items = [_it("window manager", SHELL), _it("saved positions", SHELL), _it("tray icon", SHELL),
                    _it("main window as a widget", SHELL), _it("program check before the host stores it", HOST)]
        x = _cross(s=0.12)
        pk = VGroup(x, T("packaged build failed on 2026-10-27, no fix since", SMALL, ISOLATION)).arrange(RIGHT,
                                                                                                    buff=0.15)
        dev = T("only the dev app is known to run", SMALL, SOLVED)
        bB = self._band("not built", [nb_items, [pk, dev]], bA[0].get_bottom()[1] - gap)

        u1 = [T("widget.agent_rows", SMALL, AGENT, mono=True), T("own row id: deepwidgets-agent-<slug>", SMALL,
                                                                 mono=True),
              status_chip("PR #67 open, not merged", solved=False)]
        u2 = [T("widget.harness_hmr", SMALL, ISOLATION, mono=True), T("changes only the checks", SMALL),
              T("stops the flake", SMALL)]
        u3 = [T("HMR transactions cannot be nested", SMALL, MUTED, mono=True), T("base rate ~12 % (plan)", SMALL, MUTED),
              T("seen once in these runs", SMALL, ISOLATION)]
        bC = self._band("planned units", [u1, u2, u3], CONTENT_TOP)

        nc_items = [_it("real drags and clicks in a widget window", USER), _it("a real sleep of the computer", HOST),
                    _it("SQLite power loss", RUNTIME), _it("which create-tool shape a model calls best", CREATION)]
        bD = self._band("not checked", [nc_items], bC[0].get_bottom()[1] - gap)
        assert bD[0].get_bottom()[1] > CONTENT_BOTTOM - 0.05, bD[0].get_bottom()[1]

        def show_band(bd, rt):
            self.play(FadeIn(bd[0]), FadeIn(bd[1], shift=RIGHT * 0.1), run_time=rt)

        def show(m, rt):
            self.play(FadeIn(m, shift=RIGHT * 0.1), run_time=rt)

        with self.beat("waiting") as b:
            show_band(bA, b.t(0.08))
            for it, frac in zip(wait_items, (0.15, 0.35, 0.57, 0.66, 0.74)):
                _at(self, b, frac)
                show(it, b.t(0.06))
            _at(self, b, 0.85)
            show(wait_note[0], b.t(0.08))

        with self.beat("not_built") as b:
            show_band(bB, b.t(0.12))
            self.play(LaggedStart(*[FadeIn(it, shift=RIGHT * 0.1) for it in nb_items[:4]], lag_ratio=0.4),
                      run_time=b.t(0.45))
            _at(self, b, 0.78)
            show(nb_items[4], b.t(0.12))

        with self.beat("packaging") as b:
            self.play(FadeIn(pk[1]), Create(pk[0]), run_time=b.t(0.25))
            _at(self, b, 0.75)
            show(dev, b.t(0.15))

        with self.beat("units") as b:
            page1 = VGroup(*bA[:2], *bA[2], *bB[:2], *bB[2])
            self.play(FadeOut(page1), run_time=b.t(0.1))
            show_band(bC, b.t(0.1))
            _at(self, b, 0.31)
            self.play(FadeIn(u1[0]), FadeIn(u1[1]), run_time=b.t(0.15))
            _at(self, b, 0.77)
            show(u1[2], b.t(0.15))

        with self.beat("flake") as b:
            self.play(FadeIn(VGroup(*u2), lag_ratio=0.3), run_time=b.t(0.15))
            _at(self, b, 0.25)
            dfn = caption("flake = a check that fails once, then passes on a rerun", size=26)
            self.play(FadeIn(u3[0]), FadeIn(dfn), run_time=b.t(0.12))
            _at(self, b, 0.55)
            self.play(FadeIn(u3[1]), FadeIn(u3[2]), run_time=b.t(0.12))

        with self.beat("unchecked") as b:
            self.play(FadeOut(dfn), run_time=b.t(0.05))
            show_band(bD, b.t(0.08))
            for it, frac in zip(nc_items, (0.14, 0.3, 0.52, 0.74)):
                _at(self, b, frac)
                show(it, b.t(0.07))


# ====================================================================== closing
class Closing(DWScene):
    BEATS = [("back", 2.15), ("trim", 2.89), ("doors", 4.88), ("gates", 3.03), ("isolation", 3.74),
             ("same", 4.51), ("final", 9.36)]

    def construct(self):
        o = OutlineDiagram()
        all_keys = OutlineDiagram.KEYS
        with self.beat("back") as b:
            o.set_highlight_now(*all_keys, arrows=tuple(o.arrows))
            self.play(FadeIn(o), run_time=b.t(0.6))

        with self.beat("trim") as b:
            bd = _badge("40 of 200 rows", RUNTIME).move_to([-1.35, 2.25, 0])
            self.play(FadeIn(bd, scale=1.2), Indicate(o.box("host"), color=HOST, scale_factor=1.02),
                      run_time=b.t(0.4))

        with self.beat("doors") as b:
            dd = _badge("2 doors", SHELL).move_to([2.2, 2.25, 0])
            self.play(FadeIn(dd, scale=1.2), Indicate(o.box("ctx_widgets"), color=RUNTIME, scale_factor=1.04),
                      run_time=b.t(0.3))
            _at(self, b, 0.55)
            self.play(Indicate(o.arrows["arrow_shell"], color=SHELL), Indicate(o.box("shell_page"), color=SHELL,
                                                                              scale_factor=1.03), run_time=b.t(0.2))
            self.play(Indicate(o.arrows["arrow_mcp"], color=MCP), Indicate(o.box("mcp_server"), color=MCP,
                                                                          scale_factor=1.03), run_time=b.t(0.2))

        with self.beat("gates") as b:
            gb = _badge("3 gates", CREATION).move_to([-4.0, -2.08, 0])
            self.play(FadeIn(gb, scale=1.2),
                      LaggedStart(*[Indicate(o.box(k), color=CREATION, scale_factor=1.12)
                                    for k in ("gate_compile", "gate_lint", "gate_test_run")], lag_ratio=0.4),
                      run_time=b.t(0.7))

        with self.beat("isolation") as b:
            words = [("blame", "blame"), ("quarantine", "quarantine"), ("restart", "supervisor"),
                     ("watchdog", "watchdog")]
            lst = VGroup(*[T(w, LABEL, ISOLATION, bold=True) for w, _ in words]).arrange(DOWN, buff=0.14,
                                                                                         aligned_edge=LEFT)
            lst.move_to([5.35, -1.15, 0])
            for i, (wd, key) in enumerate(words):
                _at(self, b, [0.0, 0.12, 0.24, 0.4][i])
                self.play(FadeIn(lst[i], shift=LEFT * 0.1), Indicate(o.box(key), color=ISOLATION, scale_factor=1.12),
                          run_time=b.t(0.13))
            _at(self, b, 0.66)
            self.play(Indicate(o.box("watchdog"), color=ISOLATION, scale_factor=1.15), run_time=b.t(0.18))

        # final: the two widgets of the cold open
        with self.beat("same") as b:
            self.play(*[FadeOut(m) for m in self.mobjects if m is not self.camera.frame], run_time=b.t(0.12))
            sample = window_card("sample", 3.0, 2.2).move_to([-2.0, 1.2, 0])
            count = T("Count 0", BODY).move_to(_body(sample) + UP * 0.32)
            add = chip("Add 1", USER, mono=False).move_to(_body(sample) + DOWN * 0.38)
            groc = window_card("groceries", 3.0, 2.2).move_to([2.0, 1.2, 0])
            items = lines("milk", "eggs", size=LABEL).move_to(_body(groc))
            rt = ProcessBox("ctx.widgets", "same data, same rules", RUNTIME, width=6.2, sub_mono=False)
            rt.move_to([0, -1.55, 0])
            self.play(FadeIn(VGroup(sample, count, add), shift=UP * 0.2), FadeIn(VGroup(groc, items), shift=UP * 0.2),
                      FadeIn(rt), run_time=b.t(0.18))
            you = chip("click", USER, mono=False, size=LABEL).move_to([-5.4, -1.55, 0])
            ag = chip("agent call", AGENT, mono=False, size=LABEL).move_to([5.3, -1.55, 0])
            a_you = _arr(you.get_right(), rt.box.get_left(), USER)
            a_ag = _arr(ag.get_left(), rt.box.get_right(), AGENT)
            cur = _cursor().move_to([-4.6, 0.3, 0])
            self.play(FadeIn(you), FadeIn(cur), run_time=b.t(0.1))
            self.play(cur.animate.move_to(add.get_center() + DR * 0.25), run_time=b.t(0.12))
            c1 = T("Count 1", BODY).move_to(count)
            self.play(Indicate(add, color=USER, scale_factor=1.15), GrowArrow(a_you), run_time=b.t(0.12))
            self.play(Transform(count, c1), run_time=b.t(0.08))
            self.play(FadeIn(ag), GrowArrow(a_ag), run_time=b.t(0.12))
            c2 = T("Count 2", BODY).move_to(count)
            self.play(Indicate(rt.box, color=RUNTIME, scale_factor=1.03), Transform(count, c2), run_time=b.t(0.12))

        with self.beat("final") as b:
            self.play(FadeOut(cur), run_time=b.t(0.04))
            newc = window_card("new widget", 2.6, 2.2, color=AGENT).move_to([5.2, 1.2, 0])
            mk = T("+", HEADING, AGENT).move_to(_body(newc))
            self.play(FadeIn(VGroup(newc, mk), shift=UP * 0.2), run_time=b.t(0.08))
            bs = burst(r=0.5).move_to(newc.frame.get_center())
            self.play(GrowFromCenter(bs), newc.animate.set_color(ISOLATION), run_time=b.t(0.08))
            hostline = T("host restarts without that widget", LABEL, HOST, bold=True).move_to([0, 2.85, 0])
            two = VGroup(sample, count, add, groc, items)
            veil = Rectangle(width=8.4, height=2.6, stroke_width=0, fill_color=BG, fill_opacity=0.8)
            veil.move_to([0, 1.2, 0])
            self.play(FadeOut(VGroup(newc, mk, bs)), FadeIn(veil), FadeIn(hostline), run_time=b.t(0.12))
            _at(self, b, 0.45)
            self.play(FadeOut(veil), run_time=b.t(0.12))
            self.play(Indicate(count, color=SOLVED), Indicate(items, color=SOLVED), run_time=b.t(0.1))
            stays = status_chip("the data stays", solved=True).move_to([0, -0.55, 0])
            self.play(FadeIn(stays), run_time=b.t(0.06))
            _at(self, b, 0.82)
            self.play(FadeOut(VGroup(rt, you, ag, a_you, a_ag, hostline)),
                      VGroup(two, stays).animate.scale(1.25).move_to([0, 0.1, 0]), run_time=b.t(0.1))
