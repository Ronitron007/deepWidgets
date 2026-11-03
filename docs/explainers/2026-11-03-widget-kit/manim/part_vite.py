"""Part `part_vite`: vite_gate vite_inputs_outputs vite_numbers vite_cache tailwind_source
render_check vite_failures vite_work. The Vite build per widget, its numbers, and its limits.

Beat weights are seconds of the final audio: each beat starts at the pause before its sentence
(ffmpeg silencedetect, checked sentence by sentence). The base scales them to the audio length.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content
_X1 = FRAME_W / 2 - MARGIN - 0.1     # right edge of content


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (no-op if already later)."""
    scene.wait_until(b.start + frac * b.length)


def _arr(a, b, color=TEXT, buff=0.08, sw=3, tip=0.18):
    return Arrow(a, b, buff=buff, color=color, stroke_width=sw, max_tip_length_to_length_ratio=0.35,
                 tip_length=tip)


def _tick(color=SOLVED, s=0.2):
    return VMobject(stroke_color=color, stroke_width=6).set_points_as_corners(
        [[-s, 0, 0], [-s * 0.3, -s * 0.7, 0], [s, s * 0.8, 0]])


def _cross(color=ISOLATION, s=0.2):
    return VGroup(Line([-s, -s, 0], [s, s, 0], stroke_color=color, stroke_width=6),
                  Line([-s, s, 0], [s, -s, 0], stroke_color=color, stroke_width=6))


def _strike(m, color=ISOLATION, sw=4):
    return Line(m.get_left() + LEFT * 0.08, m.get_right() + RIGHT * 0.08, stroke_color=color, stroke_width=sw)


def _mono(s, color=None):
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    c = f' fgcolor="{color}"' if color else ""
    return f'<span font_family="{MONO}"{c}>{s}</span>'


def _folder(color=VITE, w=0.75, h=0.55):
    """A folder icon: tab and body."""
    tab = Polygon([0, 0, 0], [w * 0.38, 0, 0], [w * 0.46, h * 0.18, 0], [0, h * 0.18, 0],
                  stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.35)
    body = Rectangle(width=w, height=h, stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.15)
    body.next_to(tab, DOWN, buff=0).align_to(tab, LEFT)
    return VGroup(tab, body)


def _panel(head, items, color, w, head_color=MUTED, size=LABEL, pitch=0.42):
    """Box with a bold head word and a column of mono items. .box .head .items"""
    h = T(head, size, head_color, bold=True)
    its = VGroup(*[T(s, size, c, mono=True) for s, c in items])
    for i, m in enumerate(its):
        m.move_to([0, -(i + 1) * pitch, 0], aligned_edge=LEFT)
    h.move_to([0, 0, 0], aligned_edge=LEFT)
    txt = VGroup(h, its)
    box = rbox(w, txt.height + 0.45, color, fill=0.05)
    txt.move_to(box).align_to(box, LEFT).shift(RIGHT * 0.28)
    g = VGroup(box, txt)
    g.box, g.head, g.items = box, h, its
    return g


def _hidden_window(color=SHELL, w=1.6, h=1.25):
    """A dashed window frame with a title bar line: a window that is not on screen."""
    frame = rbox(w, h, color, fill=0.05, sw=2.5, r=0.1, dashed=True)
    y = frame.get_top()[1] - 0.3
    bar = DashedLine([frame.get_left()[0], y, 0], [frame.get_right()[0], y, 0], color=color,
                     stroke_width=2, dash_length=0.08)
    return VGroup(frame, bar)


# ====================================================================== vite_gate
class ViteGate(DWScene):
    BEATS = [("open", 3.82), ("define", 2.12), ("layout", 6.79), ("folder", 3.87)]

    SLUGS = ("shadcn", "clock", "meter")

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "vite_build", run_time=b.left)

        with self.beat("define") as b:
            title = scene_title("Vite build per widget", VITE)
            d = M(f'<b>Vite</b>: a build tool for web pages', BODY)
            d.move_to([_X0, 2.45, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(d, shift=UP * 0.1), run_time=b.t(0.3))

        ys = (0.35, -0.85, -2.05)
        with self.beat("layout") as b:
            lay = T("layout A: one Vite build per widget, at install time", HEADING, VITE)
            lay.move_to([_X0, 1.6, 0], aligned_edge=LEFT)
            self.play(FadeIn(lay, shift=UP * 0.1), run_time=b.t(0.2))
            rows = []
            for slug, y in zip(self.SLUGS, ys):
                c = chip(slug, SHELL, size=LABEL).move_to([-4.6, y, 0])
                vb = ProcessBox("Vite build", color=VITE, width=2.7, height=0.85).move_to([-0.6, y, 0])
                a = _arr(c.get_right(), vb.get_left(), VITE)
                rows.append((c, a, vb))
            self.play(LaggedStart(*[FadeIn(VGroup(*r), shift=RIGHT * 0.15) for r in rows], lag_ratio=0.35),
                      run_time=b.t(0.45))

        with self.beat("folder") as b:
            outs = []
            for (c, a, vb), y in zip(rows, ys):
                f = _folder(VITE).move_to([3.0, y, 0])
                lab = T("dist/", LABEL, TEXT, mono=True).next_to(f, RIGHT, buff=0.2)
                arr = _arr(vb.get_right(), f.get_left(), VITE)
                outs.append(VGroup(arr, f, lab))
            self.play(LaggedStart(*[FadeIn(o, shift=RIGHT * 0.15) for o in outs], lag_ratio=0.3),
                      run_time=b.t(0.45))
            cap = caption("one build makes one folder of static files for one slug", color=VITE)
            self.play(FadeIn(cap), run_time=b.t(0.2))


# ====================================================================== vite_inputs_outputs
class ViteInputsOutputs(DWScene):
    BEATS = [("ask", 1.8), ("inputs", 7.77), ("kit", 3.7), ("config", 8.0), ("write", 8.83), ("chunk", 5.91),
             ("lazy", 4.39)]

    INPUTS = (("core/src/*", KIT), ("src/agent/*", AGENT), ("index.html", TEXT), ("vite.config.ts", VITE),
              ("tsconfig.json", TEXT), ("node_modules -> kit", KIT))
    OUTPUTS = (("dist/index.html", VITE), ("dist/assets/*.js", VITE), ("dist/assets/*.css", VITE))
    CONFIG = "base: `/widget/${slug}/`,\nplugins: [react(), tailwindcss()],\ntarget: 'chrome140',"

    def construct(self):
        with self.beat("ask") as b:
            title = scene_title("What one build reads and writes", VITE)
            vite = ProcessBox("Vite build", color=VITE, width=2.5, height=1.0).move_to([-0.45, 1.25, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.4))
            self.play(FadeIn(vite), run_time=b.t(0.4))

        with self.beat("inputs") as b:
            inp = _panel("reads", self.INPUTS, VITE, 4.25)
            inp.move_to([_X0, 1.25, 0], aligned_edge=LEFT)
            for it in inp.items:
                it.set_opacity(0)
            self.play(Create(inp.box), FadeIn(inp.head), run_time=b.t(0.15))
            self.play(LaggedStart(*[it.animate.set_opacity(1) for it in inp.items[:5]], lag_ratio=0.5),
                      run_time=b.t(0.7))
            a_in = _arr(inp.box.get_right(), vite.get_left(), VITE)
            self.play(GrowArrow(a_in), run_time=b.t(0.12))

        with self.beat("kit") as b:
            nm = inp.items[5]
            self.play(nm.animate.set_opacity(1), run_time=b.t(0.25))
            self.play(Indicate(nm, color=KIT, scale_factor=1.08), run_time=b.t(0.35))

        with self.beat("config") as b:
            cfg = code_block(self.CONFIG, "typescript", color=VITE)
            cfg.move_to([-2.4, -2.0, 0])
            cfg_lab = T("vite.config.ts", LABEL, VITE, mono=True).next_to(cfg, UP, buff=0.14).align_to(cfg, LEFT)
            hide_lines(cfg, 1)
            self.play(Indicate(inp.items[3], color=VITE, scale_factor=1.08), FadeIn(cfg_lab), FadeIn(cfg),
                      run_time=b.t(0.3))
            _at(self, b, 0.58)
            self.play(reveal_lines(cfg, 1, 3, lag=0.4), run_time=b.t(0.3))

        with self.beat("write") as b:
            out = _panel("writes", self.OUTPUTS, VITE, 3.95)
            out.move_to([_X1, 1.25, 0], aligned_edge=RIGHT)
            for it in out.items:
                it.set_opacity(0)
            a_out = _arr(vite.get_right(), out.box.get_left(), VITE)
            self.play(GrowArrow(a_out), Create(out.box), FadeIn(out.head), run_time=b.t(0.18))
            self.play(LaggedStart(*[it.animate.set_opacity(1) for it in out.items], lag_ratio=0.5),
                      run_time=b.t(0.4))
            cap = caption("dist/: the output folder", color=VITE)
            _at(self, b, 0.7)
            self.play(FadeIn(cap), run_time=b.t(0.15))

        with self.beat("chunk") as b:
            js = out.items[1]
            box = SurroundingRectangle(js, color=VITE, buff=0.07, stroke_width=2.5, corner_radius=0.05)
            cap2 = caption("chunk: one script file of the output; Vite can split code into chunks that load later",
                           color=VITE)
            self.play(Create(box), FadeOut(cap), run_time=b.t(0.25))
            self.play(FadeIn(cap2), run_time=b.t(0.2))

        with self.beat("lazy") as b:
            ch = VGroup(T("shadcn charts chunk", LABEL, TEXT, bold=True),
                        T("388 KB (lazy)", LABEL, MEASURED, mono=True)).arrange(DOWN, buff=0.12)
            frame = rbox(ch.width + 0.5, ch.height + 0.4, VITE, fill=0.12, sw=2.5, dashed=True)
            ch.move_to(frame)
            chunk = VGroup(frame, ch).move_to([out.box.get_x(), -1.15, 0])
            a = _arr(out.box.get_bottom(), chunk.get_top(), VITE)
            self.play(GrowArrow(a), FadeIn(chunk, shift=DOWN * 0.15), run_time=b.t(0.35))


# ====================================================================== vite_numbers
class ViteNumbers(DWScene):
    BEATS = [("head", 2.51), ("shadcn", 5.48), ("clock", 5.42), ("meter", 5.31), ("cold", 4.45), ("rendered", 2.31)]

    ROWS = [("shadcn", "2.811 s", "796 KB"), ("clock", "1.047 s", "372 KB"), ("meter", "0.904 s", "352 KB")]

    def construct(self):
        with self.beat("head") as b:
            title = scene_title("Build numbers on kit v1", VITE)
            src = VGroup(chip("kit v1", KIT, size=LABEL), T("results-v1.tsv", LABEL, MUTED, mono=True))
            src.arrange(RIGHT, buff=0.3).move_to([_X0, 2.35, 0], aligned_edge=LEFT)
            tbl = RevealTable(["widget", "vite build", "dist/ size"], self.ROWS, mono_cols=[0, 1, 2], size=BODY,
                              header_color=VITE, col_gap=0.9)
            tbl.move_to([_X0, 1.55, 0], aligned_edge=UL)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(src), run_time=b.t(0.4))
            self.play(FadeIn(tbl), run_time=b.t(0.3))

        for i, name in enumerate(("shadcn", "clock", "meter")):
            with self.beat(name) as b:
                self.play(tbl.reveal_row(i), run_time=b.t(0.3))

        with self.beat("cold") as b:
            cold = VGroup(T("shadcn", BODY, TEXT, mono=True), T("cold build", BODY, VITE),
                          T("4.3 s", BODY, MEASURED, mono=True)).arrange(RIGHT, buff=0.4)
            frame = rbox(cold.width + 0.5, cold.height + 0.4, VITE, fill=0.08, sw=2.5)
            cold.move_to(frame)
            cg = VGroup(frame, cold).next_to(tbl, DOWN, buff=0.45).align_to(tbl, LEFT)
            self.play(FadeIn(cg, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("rendered") as b:
            wins = VGroup()
            for slug in ("shadcn", "clock", "meter"):
                w = window_card(slug, w=2.5, h=1.15)
                t = _tick().move_to(w.body_center)
                t.set_opacity(0)
                w.add(t)
                w.tick = t
                wins.add(w)
            wins.arrange(DOWN, buff=0.22).move_to([4.6, 0.75, 0])
            lab = T("rendered in Electron", LABEL, SOLVED).next_to(wins, DOWN, buff=0.22)
            self.play(LaggedStart(*[FadeIn(w, shift=LEFT * 0.15) for w in wins], lag_ratio=0.25),
                      run_time=b.t(0.35))
            self.play(LaggedStart(*[w.tick.animate.set_opacity(1) for w in wins], lag_ratio=0.3),
                      FadeIn(lab), run_time=b.t(0.3))


# ====================================================================== vite_cache
class ViteCache(DWScene):
    BEATS = [("nocache", 3.35), ("warm", 3.34), ("pays", 3.31), ("range", 7.08)]

    X0 = -4.4   # x of 0 s
    S = 2.2     # units per second

    def _x(self, sec):
        return self.X0 + self.S * sec

    def _bar(self, a, b, y, opacity=0.75, h=0.48):
        r = Rectangle(width=self.S * (b - a), height=h, stroke_width=0, fill_color=VITE, fill_opacity=opacity)
        return r.move_to([(self._x(a) + self._x(b)) / 2, y, 0])

    def construct(self):
        yc, yw = 1.65, 0.85
        with self.beat("nocache") as b:
            title = scene_title("No build cache that stays", VITE)
            note = VGroup(T("no persistent build cache;", BODY), T("warm saves about 1.4 s", BODY))
            note.arrange(RIGHT, buff=0.18, aligned_edge=UP).move_to([_X0, 0.0, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(note[0], shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("warm") as b:
            who = T("shadcn", LABEL, MUTED, mono=True).move_to([_X0, 2.4, 0], aligned_edge=LEFT)
            cl = T("cold", BODY, TEXT).move_to([self.X0 - 0.25, yc, 0], aligned_edge=RIGHT)
            wl = T("warm", BODY, TEXT).move_to([self.X0 - 0.25, yw, 0], aligned_edge=RIGHT)
            cold = self._bar(0, 4.3, yc)
            warm = VGroup(self._bar(0, 2.8, yw), self._bar(2.8, 2.9, yw, opacity=0.4))
            cv = T("4.3 s", LABEL, MEASURED, mono=True).next_to(cold, RIGHT, buff=0.15)
            wv = T("2.8 to 2.9 s", LABEL, BG, mono=True, bold=True)
            wv.move_to(warm[0]).align_to(warm[0], RIGHT).shift(LEFT * 0.15)
            gap = rbox(self.S * 1.4, 0.48, MUTED, fill=0.0, sw=2, r=0.04, dashed=True)
            gap.move_to([(self._x(2.9) + self._x(4.3)) / 2, yw, 0])
            self.play(FadeIn(who), FadeIn(cl), FadeIn(wl),
                      GrowFromEdge(cold, LEFT), GrowFromEdge(warm, LEFT), run_time=b.t(0.35))
            self.play(FadeIn(cv), FadeIn(wv), run_time=b.t(0.15))
            self.play(Create(gap), FadeIn(note[1]), run_time=b.t(0.3))

        with self.beat("pays") as b:
            cap = caption("each install pays the full build time", color=VITE)
            self.play(FadeIn(cap), Indicate(cold, color=VITE, scale_factor=1.04), run_time=b.t(0.5))

        with self.beat("range") as b:
            ya = -1.75
            axis = Line([self._x(0), ya, 0], [self._x(5), ya, 0], stroke_color=MUTED, stroke_width=2.5)
            ticks = VGroup()
            for s in range(6):
                tk = Line([self._x(s), ya - 0.08, 0], [self._x(s), ya + 0.08, 0], stroke_color=MUTED,
                          stroke_width=2.5)
                tl = T(f"{s} s", SMALL, MUTED, mono=True).next_to(tk, DOWN, buff=0.3)
                ticks.add(tk, tl)
            small = Rectangle(width=max(0.12, self.S * 0.15), height=0.32, stroke_width=0, fill_color=VITE,
                              fill_opacity=0.85).move_to([self._x(0.975), ya, 0])
            large = Rectangle(width=self.S * 1.5, height=0.32, stroke_width=0, fill_color=VITE,
                              fill_opacity=0.85).move_to([(self._x(2.8) + self._x(4.3)) / 2, ya, 0])
            sl = T("small widget about 1 s", LABEL).next_to(small, UP, buff=0.22)
            ll = T("large library about 2.8 to 4.3 s", LABEL).next_to(large, UP, buff=0.22)
            self.play(FadeOut(cap), Create(axis), FadeIn(ticks), run_time=b.t(0.12))
            self.play(FadeIn(small, scale=0.5), FadeIn(sl, shift=UP * 0.1), run_time=b.t(0.15))
            _at(self, b, 0.42)
            self.play(GrowFromEdge(large, LEFT), FadeIn(ll, shift=UP * 0.1), run_time=b.t(0.2))


# ====================================================================== tailwind_source
class TailwindSource(DWScene):
    BEATS = [("define", 5.71), ("today", 7.22), ("trap", 5.92), ("line", 7.91), ("spike", 5.67), ("each", 4.18),
             ("infer", 2.87)]

    SPIKE = '@source "./";\n@source "./agent";\n@source "../node_modules/dw-mini-ui";'

    def construct(self):
        with self.beat("define") as b:
            title = scene_title("Tailwind and its @source lines", VITE)
            d1 = T("Tailwind: the style tool of the shell", BODY)
            d2 = T("It writes only the classes that it finds in the source.", BODY)
            dd = VGroup(d1, d2).arrange(DOWN, buff=0.3, aligned_edge=LEFT).move_to([_X0, 1.4, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.2))
            self.play(FadeIn(d1, shift=UP * 0.1), run_time=b.t(0.2))
            _at(self, b, 0.45)
            self.play(FadeIn(d2, shift=UP * 0.1), run_time=b.t(0.2))

        with self.beat("today") as b:
            tl = T("today: shell styles.css", LABEL, SHELL)
            tc = code_block('@source "./";', "css", color=SHELL)
            today = VGroup(tl, tc).arrange(DOWN, buff=0.14, aligned_edge=LEFT).move_to([_X0, 2.05, 0],
                                                                                        aligned_edge=LEFT)
            cap = caption("@source: the folders that Tailwind scans", color=VITE)
            self.play(FadeOut(dd), run_time=b.t(0.12))
            self.play(FadeIn(today, shift=UP * 0.1), FadeIn(cap), run_time=b.t(0.25))
            _at(self, b, 0.6)
            self.play(Indicate(tc.code_lines[0], color=SHELL, scale_factor=1.1), run_time=b.t(0.25))

        with self.beat("trap") as b:
            head = T("node_modules/dw-mini-ui", LABEL, KIT, mono=True)
            classes = VGroup(*[chip(c, KIT, size=LABEL) for c in ("rounded-full", "px-2", "text-xs")])
            classes.arrange(RIGHT, buff=0.25)
            inner = VGroup(head, classes).arrange(DOWN, buff=0.25)
            pbox = rbox(inner.width + 0.6, inner.height + 0.5, KIT, fill=0.06)
            inner.move_to(pbox)
            pkg = VGroup(pbox, inner).move_to([0.9, -1.35, 0])
            a = DashedLine(tc.get_bottom() + DOWN * 0.05, pbox.get_left() + LEFT * 0.08, color=SHELL,
                           stroke_width=3, dash_length=0.1)
            a.add_tip(tip_length=0.18, tip_width=0.18)
            x = _cross().move_to(a.get_center())
            ns = T("not scanned", SMALL, ISOLATION).next_to(x, LEFT, buff=0.2)
            self.play(FadeOut(cap), FadeIn(pkg, shift=UP * 0.15), run_time=b.t(0.3))
            self.play(Create(a), run_time=b.t(0.2))
            self.play(Create(x), FadeIn(ns), run_time=b.t(0.2))

        with self.beat("line") as b:
            sl = T("spike: core/src/styles.css", LABEL, VITE)
            sc = code_block(self.SPIKE, "css", color=VITE)
            spike = VGroup(sl, sc).arrange(DOWN, buff=0.14, aligned_edge=LEFT)
            spike.move_to([_X1, 2.05, 0], aligned_edge=RIGHT).align_to(today, UP)
            hide_lines(sc, 0, 2)
            third = sc.code_lines[2]
            link = _arr(third.get_bottom() + DOWN * 0.05, [pbox.get_right()[0] - 0.9, pbox.get_top()[1], 0], VITE)
            ok = _tick(SOLVED, 0.16).next_to(classes, RIGHT, buff=0.25)
            self.play(FadeIn(spike, shift=UP * 0.1), run_time=b.t(0.2))
            self.play(GrowArrow(link), FadeIn(ok), run_time=b.t(0.18))
            classes.save_state()
            _at(self, b, 0.5)
            st = _strike(third)
            miss = T("extra classes missing", LABEL, ISOLATION).next_to(pbox, DOWN, buff=0.2)
            self.play(third.animate.set_opacity(0.25), Create(st), FadeOut(link), FadeOut(ok),
                      classes.animate.set_opacity(DIM), run_time=b.t(0.2))
            self.play(FadeIn(miss, shift=LEFT * 0.1), run_time=b.t(0.12))

        with self.beat("spike") as b:
            link2 = link.copy()
            self.play(FadeOut(st), FadeOut(miss), third.animate.set_opacity(1), run_time=b.t(0.2))
            self.play(reveal_lines(sc, 0, 2, lag=0.5), GrowArrow(link2), Restore(classes),
                      FadeIn(ok), run_time=b.t(0.4))

        with self.beat("each") as b:
            mk = mark_line(sc, 2, VITE)
            cap2 = caption("each extra with its own classes needs its own @source line", color=VITE)
            self.play(Create(mk), FadeIn(cap2), run_time=b.t(0.35))

        with self.beat("infer") as b:
            nt = T("gate writes @source lines (inferred)", LABEL, INFERRED)
            nb = rbox(nt.width + 0.45, nt.height + 0.35, INFERRED, fill=0.1, sw=2, r=0.1)
            nt.move_to(nb)
            note = VGroup(nb, nt).move_to([_X0, -2.45, 0], aligned_edge=LEFT)
            self.play(FadeOut(cap2), FadeIn(note, shift=UP * 0.1), run_time=b.t(0.4))


# ====================================================================== render_check
class RenderCheck(DWScene):
    BEATS = [("load", 5.07), ("wait", 2.1), ("read", 4.07), ("cost", 3.79), ("limit", 4.67), ("record", 5.74)]

    def construct(self):
        sx = -4.35  # left edge of the steps
        with self.beat("load") as b:
            title = scene_title("Render check", CREATION)
            win = _hidden_window().move_to([-5.75, 1.75, 0])
            wl = lines("hidden", "Electron", "window", size=SMALL, color=SHELL, align=ORIGIN, buff=0.08)
            wl.next_to(win, DOWN, buff=0.15)
            s1 = chip("loadURL /widget/<slug>/?slug=<slug>", CREATION).move_to([sx, 2.4, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.2))
            self.play(Create(win), FadeIn(wl), run_time=b.t(0.25))
            self.play(FadeIn(s1, shift=RIGHT * 0.15), run_time=b.t(0.25))

        with self.beat("wait") as b:
            s2 = chip("wait 1500 ms", CREATION).move_to([sx, 1.35, 0], aligned_edge=LEFT)
            a1 = _arr([sx + 0.4, s1.get_bottom()[1], 0], [sx + 0.4, s2.get_top()[1], 0], CREATION, buff=0.04)
            self.play(GrowArrow(a1), FadeIn(s2, shift=DOWN * 0.1), run_time=b.t(0.4))

        with self.beat("read") as b:
            s3 = chip("read window.__dw.state, __dw.errors, .dw-surface text", CREATION)
            s3.move_to([sx, 0.3, 0], aligned_edge=LEFT)
            a2 = _arr([sx + 0.4, s2.get_bottom()[1], 0], [sx + 0.4, s3.get_top()[1], 0], CREATION, buff=0.04)
            self.play(GrowArrow(a2), FadeIn(s3, shift=DOWN * 0.1), run_time=b.t(0.35))

        with self.beat("cost") as b:
            cost = chip("about 1.6 s per widget", CREATION, mono=False, size=LABEL)
            cost.move_to([sx, -0.6, 0], aligned_edge=LEFT)
            self.play(FadeIn(cost, shift=UP * 0.1), run_time=b.t(0.35))

        with self.beat("limit") as b:
            l1 = T("finds only errors that throw", BODY, ISOLATION, bold=True)
            card = rbox(9.4, 1.55, ISOLATION, fill=0.08)
            card.move_to([_X0, -2.0, 0], aligned_edge=LEFT)
            l1.move_to(card).align_to(card, LEFT).shift(RIGHT * 0.3 + UP * 0.3)
            self.play(Create(card), run_time=b.t(0.25))
            _at(self, b, 0.46)
            self.play(FadeIn(l1, shift=UP * 0.1), run_time=b.t(0.2))

        with self.beat("record") as b:
            l2 = T("untyped extra, wrong prop passes (spike record, not checked)", SMALL, INFERRED)
            l2.next_to(l1, DOWN, buff=0.22).align_to(l1, LEFT)
            self.play(FadeIn(l2, shift=UP * 0.1), run_time=b.t(0.3))


# ====================================================================== vite_failures
class ViteFailures(DWScene):
    BEATS = [("flow", 5.9), ("pin", 4.35), ("notypes", 2.6), ("evidence", 5.9), ("typegate", 3.73)]

    def construct(self):
        with self.beat("flow") as b:
            title = scene_title("When the build fails", VITE)
            c1 = chip("build fails", ISOLATION, mono=False, size=BODY)
            c2 = chip("install stops", ISOLATION, mono=False, size=BODY)
            c3 = chip("old page stays", SHELL, mono=False, size=BODY)
            flow = VGroup(c1, c2, c3).arrange(RIGHT, buff=1.0).move_to([0, 2.0, 0])
            a1 = _arr(c1.get_right(), c2.get_left(), TEXT)
            a2 = _arr(c2.get_right(), c3.get_left(), TEXT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.15))
            _at(self, b, 0.3)
            self.play(FadeIn(c1, shift=RIGHT * 0.1), run_time=b.t(0.15))
            self.play(GrowArrow(a1), FadeIn(c2, shift=RIGHT * 0.1), run_time=b.t(0.15))
            self.play(GrowArrow(a2), FadeIn(c3, shift=RIGHT * 0.1), run_time=b.t(0.15))

        with self.beat("pin") as b:
            pt = T("pin policy, inferred", LABEL, INFERRED)
            pb = rbox(pt.width + 0.45, pt.height + 0.35, INFERRED, fill=0.1, sw=2, r=0.1)
            pt.move_to(pb)
            pin = VGroup(pb, pt).next_to(c3, DOWN, buff=0.3)
            self.play(FadeIn(pin, shift=UP * 0.1), run_time=b.t(0.35))

        with self.beat("notypes") as b:
            cap = caption("Vite does not check types", color=VITE)
            self.play(FadeIn(cap), run_time=b.t(0.5))

        with self.beat("evidence") as b:
            src = VGroup(chip("kit v2b", KIT, size=LABEL), T("results-v2b.tsv", LABEL, MUTED, mono=True))
            src.arrange(RIGHT, buff=0.3)
            row = M(f'{_mono("meter")}   {_mono("tsc_exit=2", ISOLATION)}   {_mono("vite_exit=0", SOLVED)}',
                    BODY)
            rb = rbox(row.width + 0.7, row.height + 0.5, MUTED, fill=0.0, sw=2)
            rb.set_fill(PANEL, 1)
            row.move_to(rb)
            ev = VGroup(src, VGroup(rb, row)).arrange(DOWN, buff=0.2, aligned_edge=LEFT)
            ev.move_to([_X0, -0.1, 0], aligned_edge=LEFT)
            n1 = T("types wrong", LABEL, ISOLATION).next_to(rb, RIGHT, buff=0.4).shift(UP * 0.2)
            n2 = T("built with no error", LABEL, SOLVED).next_to(n1, DOWN, buff=0.12).align_to(n1, LEFT)
            self.play(FadeIn(src), run_time=b.t(0.2))
            self.play(FadeIn(VGroup(rb, row), shift=UP * 0.1), run_time=b.t(0.2))
            _at(self, b, 0.55)
            self.play(FadeIn(n2), FadeIn(n1), run_time=b.t(0.2))

        with self.beat("typegate") as b:
            tg = ProcessBox("type gate", color=CREATION, width=2.6, height=0.85)
            vb = ProcessBox("Vite build", color=VITE, width=2.6, height=0.85)
            pair = VGroup(tg, vb).arrange(RIGHT, buff=1.2).move_to([0, -2.05, 0])
            a = _arr(tg.get_right(), vb.get_left(), TEXT)
            self.play(FadeOut(cap), FadeIn(vb), run_time=b.t(0.2))
            self.play(FadeIn(tg, shift=RIGHT * 0.2), GrowArrow(a), run_time=b.t(0.3))


# ====================================================================== vite_work
class ViteWork(DWScene):
    BEATS = [("reads", 4.78), ("writes", 2.83), ("rule", 6.86), ("size", 2.75), ("close", 3.1)]

    def construct(self):
        outline = OutlineDiagram()
        lx, vx = _X0 + 0.3, _X0 + 2.6

        def label(t, y):
            return T(t, LABEL, MUTED, bold=True).move_to([lx, y, 0], aligned_edge=LEFT)

        def val(m, y):
            return m.move_to([vx, y, 0], aligned_edge=LEFT)

        with self.beat("reads") as b:
            title = scene_title("What the Vite build front reads and writes", VITE)
            card = rbox(_X1 - _X0, 3.0, VITE, fill=0.05)
            card.move_to([(_X0 + _X1) / 2, 1.2, 0])
            r_l = label("Reads", 2.25)
            r_v = VGroup(T("kit node_modules", LABEL, KIT, mono=True), T("src/agent", LABEL, AGENT, mono=True))
            r_v = val(r_v.arrange(RIGHT, buff=0.6), 2.25)
            self.play(FadeIn(title, shift=RIGHT * 0.2), Create(card), run_time=b.t(0.35))
            self.play(FadeIn(r_l), FadeIn(r_v, shift=RIGHT * 0.1), run_time=b.t(0.35))

        with self.beat("writes") as b:
            w_l = label("Writes", 1.5)
            w_v = val(T("build folder per slug", LABEL, VITE), 1.5)
            self.play(FadeIn(w_l), FadeIn(w_v, shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("rule") as b:
            u_l = label("Rule", 0.75)
            u1 = val(T("work map design:", LABEL, MUTED), 0.75)
            u2 = val(T("refuse imports outside core + renderer extras", LABEL, TEXT), 0.28)
            self.play(FadeIn(u_l), FadeIn(u1, shift=RIGHT * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(u2, shift=RIGHT * 0.1), run_time=b.t(0.25))

        with self.beat("size") as b:
            sz = chip("Vite build gate: L (estimate)", INFERRED, mono=False, size=LABEL)
            sz.next_to(card, DOWN, buff=0.35).align_to(card, LEFT)
            self.play(FadeIn(sz, shift=UP * 0.1), run_time=b.t(0.4))

        with self.beat("close") as b:
            outline.close_part(self, "vite_build", next_key="type_gate", run_time=b.left)
