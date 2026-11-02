"""Part `part_creation`: creation_overview gate_compile gate_lint gate_test_run install_replace.

Beat weights are seconds of the recorded take (sentence ends found with silencedetect), so each
beat starts with its sentence. The base scales them to the audio length.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content
_X1 = FRAME_W / 2 - MARGIN - 0.25    # right edge of content


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (no-op if already later)."""
    scene.wait_until(b.start + frac * b.length)


def _card(title, sub=None, color=CREATION, mono_title=True, size=SMALL, sub_size=SMALL, sub_mono=False,
          sub_color=TEXT, w=None, h=None, dashed=False, fill=0.1):
    """Box with a title line (concept color) and optional second lines. .box .title .sub"""
    t = T(title, size, color, mono=mono_title, bold=not mono_title)
    subs = []
    if sub:
        for s in ([sub] if isinstance(sub, str) else sub):
            subs.append(T(s, sub_size, sub_color, mono=sub_mono))
    txt = VGroup(t, *subs).arrange(DOWN, buff=0.1)
    bw = w or txt.width + 0.5
    bh = h or txt.height + 0.4
    box = rbox(bw, bh, color, fill=fill, dashed=dashed)
    txt.move_to(box)
    g = VGroup(box, txt)
    g.box, g.title, g.txt = box, t, txt
    g.sub = VGroup(*subs)
    return g


def _arr(a, b, color=TEXT, buff=0.08, sw=3, tip=0.18):
    return Arrow(a, b, buff=buff, color=color, stroke_width=sw, max_tip_length_to_length_ratio=0.35,
                 tip_length=tip)


def _tick(color=SOLVED, s=0.22):
    return VMobject(stroke_color=color, stroke_width=6).set_points_as_corners(
        [[-s, 0, 0], [-s * 0.3, -s * 0.7, 0], [s, s * 0.8, 0]])


def _cross(color=ISOLATION, s=0.2):
    return VGroup(Line([-s, -s, 0], [s, s, 0], stroke_color=color, stroke_width=6),
                  Line([-s, s, 0], [s, -s, 0], stroke_color=color, stroke_width=6))


def _strike(m, color=ISOLATION, sw=4):
    return Line(m.get_left() + LEFT * 0.08, m.get_right() + RIGHT * 0.08, stroke_color=color, stroke_width=sw)


def _note(markup, size=SMALL, color=TEXT):
    return M(markup, size, color)


def _mono(s, color=None):
    c = f' fgcolor="{color}"' if color else ""
    return f'<span font_family="{MONO}"{c}>{s}</span>'


def _doc_icon(color, s=0.42):
    r = Rectangle(width=s * 0.8, height=s, stroke_color=color, stroke_width=2.5)
    ls = VGroup(*[Line(r.get_left() + RIGHT * 0.08 + UP * (s * 0.25 - i * s * 0.22),
                       r.get_right() + LEFT * 0.08 + UP * (s * 0.25 - i * s * 0.22),
                       stroke_color=color, stroke_width=2) for i in range(3)])
    return VGroup(r, ls)


def _book_icon(color, s=0.42):
    l = Polygon([0, 0, 0], [-s * 0.6, s * 0.12, 0], [-s * 0.6, s * 0.92, 0], [0, s * 0.8, 0],
                stroke_color=color, stroke_width=2.5)
    r = l.copy().flip(UP, about_point=ORIGIN)
    return VGroup(l, r).move_to(ORIGIN)


def _folder_icon(color, s=0.42):
    pts = [[0, 0, 0], [s * 1.2, 0, 0], [s * 1.2, s * 0.75, 0], [s * 0.55, s * 0.75, 0], [s * 0.45, s * 0.9, 0],
           [0, s * 0.9, 0]]
    return Polygon(*pts, stroke_color=color, stroke_width=2.5).move_to(ORIGIN)


def _install_icon(color, s=0.42):
    tray = VMobject(stroke_color=color, stroke_width=2.5).set_points_as_corners(
        [[-s * 0.6, s * 0.3, 0], [-s * 0.6, -s * 0.3, 0], [s * 0.6, -s * 0.3, 0], [s * 0.6, s * 0.3, 0]])
    a = Arrow([0, s * 0.75, 0], [0, -s * 0.15, 0], buff=0, color=color, stroke_width=3, tip_length=0.14)
    return VGroup(tray, a)


# ====================================================================== creation_overview
class CreationOverview(DWScene):
    # sentence starts (s): moves 2.3, gates 18.5, fail 27.4, pass 37.3, spike 44.9
    BEATS = [("open", 2.3), ("moves", 16.2), ("gates", 8.9), ("fail", 9.9), ("pass", 7.6), ("spike", 10.06)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "creation", run_time=b.left)

        with self.beat("moves") as b:
            title = scene_title("Creating a widget", CREATION)
            head = T("an agent creates a widget in four moves", LABEL, MUTED).move_to([0, 2.55, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(head), run_time=b.t(0.1))
            specs = [
                ("widget_template", ["starter file", "in TypeScript"], CREATION, _doc_icon),
                ("widget_guide", ["rules and the", "program language"], CREATION, _book_icon),
                ("write files", ["into a folder"], AGENT, _folder_icon),
                ("widget_install(dir)", ["with that folder"], CREATION, _install_icon),
            ]
            cards = []
            for name, sub, col, icon in specs:
                c = _card(name, sub, col, mono_title=name != "write files", h=1.95)
                ic = icon(col).move_to(c.box.get_top() + DOWN * 0.42)
                c.txt.move_to(c.box.get_center() + DOWN * 0.27)
                c.add(ic)
                cards.append(c)
            row = VGroup(*cards).arrange(RIGHT, buff=0.42).move_to([0, 0.3, 0])
            head.next_to(row, UP, buff=0.5)
            arrows = VGroup(*[_arr(cards[i].get_right(), cards[i + 1].get_left(), MUTED, buff=0.05)
                              for i in range(3)])
            # each move appears with its sentence: 5.2, 9.0, 12.9, 14.9 s
            for i, frac in enumerate([0.18, 0.41, 0.65, 0.78]):
                _at(self, b, frac)
                anims = [FadeIn(cards[i], shift=UP * 0.15)]
                if i:
                    anims.append(GrowArrow(arrows[i - 1]))
                self.play(*anims, run_time=b.t(0.1))
            self.play(Indicate(cards[3].box, color=CREATION, scale_factor=1.04), run_time=b.t(0.08))

        with self.beat("gates") as b:
            inst = cards[3]
            gates = [_card(n, None, CREATION, mono_title=False, size=LABEL, w=2.25, h=1.0)
                     for n in ("compile", "lint", "test run")]
            self.play(FadeOut(VGroup(*cards[:3], arrows, head)), run_time=b.t(0.08))
            self.play(inst.animate.move_to([_X0 + inst.width / 2, 1.6, 0]), run_time=b.t(0.1))
            x = inst.get_right()[0] + 0.62
            for g in gates:
                g.move_to([x + g.width / 2, 1.6, 0])
                x = g.get_right()[0] + 0.62
            garr = VGroup(_arr(inst.get_right(), gates[0].get_left(), CREATION),
                          _arr(gates[0].get_right(), gates[1].get_left(), CREATION),
                          _arr(gates[1].get_right(), gates[2].get_left(), CREATION))
            lab = T("three gates, in order", SMALL, MUTED).next_to(VGroup(*gates), UP, buff=0.4)
            self.play(LaggedStart(*[AnimationGroup(GrowArrow(a), FadeIn(g, shift=RIGHT * 0.15))
                                    for a, g in zip(garr, gates)], lag_ratio=0.45),
                      FadeIn(lab), run_time=b.t(0.32))
            _at(self, b, 0.55)
            cap = caption("gate: a check that new code must pass before it reaches the host", color=CREATION)
            self.play(FadeIn(cap, shift=UP * 0.1), run_time=b.t(0.15))

        with self.beat("fail") as b:
            lint = gates[1]
            x_l = _cross().move_to(lint.box.get_corner(UR) + DL * 0.05)
            self.play(lint.box.animate.set_stroke(ISOLATION).set_fill(ISOLATION, opacity=0.18),
                      lint.title.animate.set_color(ISOLATION), FadeIn(x_l, scale=1.4),
                      gates[2].box.animate.set_stroke(opacity=0.3).set_fill(opacity=0.03),
                      gates[2].txt.animate.set_opacity(0.3), garr[2].animate.set_opacity(0.3), run_time=b.t(0.12))
            stop = T("first failure stops the install", SMALL, ISOLATION).next_to(VGroup(gates[1], gates[2]),
                                                                                    DOWN, buff=0.25)
            self.play(FadeIn(stop), run_time=b.t(0.1))
            _at(self, b, 0.27)
            ans_t = T("answer", LABEL, CREATION, bold=True)
            r1 = _note(f'names the gate:  {_mono("lint", ISOLATION)}', LABEL)
            r2 = _note('lists each problem:', LABEL)
            r3 = T("file:line:column: text", BODY, TEXT, mono=True)
            r4 = T("file, line, and column when the gate knows them", SMALL, MUTED)
            body = VGroup(ans_t, r1, r2, r3, r4).arrange(DOWN, buff=0.16, aligned_edge=LEFT)
            panel = rbox(body.width + 0.7, body.height + 0.5, CREATION, fill=0.06)
            ans = VGroup(panel, body)
            body.move_to(panel)
            ans.move_to([0, -1.05, 0]).align_to([_X0 + 1.2, 0, 0], LEFT)
            link = _arr(lint.box.get_bottom(), [lint.get_x(), panel.get_top()[1], 0], ISOLATION, buff=0.06)
            self.play(Create(panel), GrowArrow(link), FadeIn(ans_t), run_time=b.t(0.12))
            self.play(FadeIn(r1, shift=RIGHT * 0.1), run_time=b.t(0.1))
            self.play(FadeIn(r2, shift=RIGHT * 0.1), run_time=b.t(0.08))
            _at(self, b, 0.58)
            self.play(Write(r3), run_time=b.t(0.15))
            self.play(FadeIn(r4), run_time=b.t(0.1))

        with self.beat("pass") as b:
            ticks = VGroup(*[_tick().move_to(g.box.get_corner(UR) + DL * 0.05) for g in gates])
            self.play(FadeOut(VGroup(ans, link, stop, x_l, cap, lab)),
                      lint.box.animate.set_stroke(CREATION).set_fill(CREATION, opacity=0.1),
                      lint.title.animate.set_color(CREATION),
                      gates[2].box.animate.set_stroke(opacity=1).set_fill(opacity=0.1),
                      gates[2].txt.animate.set_opacity(1), garr[2].animate.set_opacity(1), run_time=b.t(0.1))
            self.play(LaggedStart(*[FadeIn(t, scale=1.4) for t in ticks], lag_ratio=0.3), run_time=b.t(0.12))
            fold = _card("<profile>/", ["deepwidgets-widgets/<slug>"], CREATION, sub_mono=True)
            fold.move_to([_X1 - fold.width / 2, -1.1, 0])
            fl = T("folder the profile owns", SMALL, MUTED).next_to(fold, DOWN, buff=0.15)
            pm = _card("plugin manager", ["installBundle"], RUNTIME, mono_title=False,
                       size=LABEL, sub_mono=True)
            hmr = _card("hmr", ["applied"], RUNTIME, mono_title=False, size=LABEL, sub_mono=True)
            pm.next_to(fold, LEFT, buff=0.75)
            hmr.next_to(pm, LEFT, buff=0.75)
            a1 = _arr(gates[2].box.get_bottom(), [gates[2].get_x(), fold.box.get_top()[1], 0], CREATION)
            a2 = _arr(fold.get_left(), pm.get_right(), RUNTIME)
            a3 = _arr(pm.get_left(), hmr.get_right(), RUNTIME)
            self.play(GrowArrow(a1), FadeIn(fold, shift=DOWN * 0.15), FadeIn(fl), run_time=b.t(0.15))
            _at(self, b, 0.43)
            self.play(GrowArrow(a2), FadeIn(pm, shift=LEFT * 0.15), run_time=b.t(0.15))
            self.play(GrowArrow(a3), FadeIn(hmr, shift=LEFT * 0.15), run_time=b.t(0.15))
            now = T("at once", SMALL, RUNTIME).next_to(hmr, DOWN, buff=0.15)
            self.play(FadeIn(now), Indicate(hmr.box, color=RUNTIME, scale_factor=1.06), run_time=b.t(0.13))

        with self.beat("spike") as b:
            keep = [title]
            self.play(*[FadeOut(m) for m in self.mobjects if m not in keep and m is not self.camera.frame],
                      run_time=b.t(0.07))
            why = T("Why three gates?", HEADING, CREATION, bold=True).move_to([0, 2.2, 0])
            self.play(FadeIn(why, shift=DOWN * 0.1), run_time=b.t(0.08))
            _at(self, b, 0.17)
            sp = _note(f'<b>spike</b>: a short experiment.  One agent made <b>40 edits</b>.', LABEL)
            sp.move_to([0, 1.3, 0])
            self.play(FadeIn(sp), run_time=b.t(0.1))
            W = 8.4
            x0 = -2.6

            def bar_row(label, n, color, y):
                lab = T(label, LABEL, TEXT, bold=True)
                lab.move_to([x0 - 0.35, y, 0], aligned_edge=RIGHT)
                track = Rectangle(width=W, height=0.55, stroke_color=MUTED, stroke_width=1.5,
                                  stroke_opacity=0.6, fill_opacity=0).move_to([x0 + W / 2, y, 0])
                fillw = max(0.001, W * n / 40)
                bar = Rectangle(width=fillw, height=0.55, stroke_width=0, fill_color=color, fill_opacity=0.85)
                bar.move_to([x0 + fillw / 2, y, 0])
                num = T(f"{n} of 40 crashed the host", LABEL, color)
                num.next_to([x0 + max(fillw, 0.05), y, 0], RIGHT, buff=0.25)
                return lab, track, bar, num

            lab1, tr1, bar1, num1 = bar_row("without gates", 14, ISOLATION, 0.05)
            lab2, tr2, bar2, num2 = bar_row("with gates", 0, SOLVED, -1.05)
            scale = VGroup(*[T(str(v), SMALL, MUTED).move_to([x0 + W * v / 40, -1.75, 0]) for v in (0, 10, 20, 30, 40)])
            ax = T("edits", SMALL, MUTED).next_to(scale, DOWN, buff=0.12)
            self.play(FadeIn(VGroup(lab1, tr1, lab2, tr2, scale, ax)), run_time=b.t(0.1))
            _at(self, b, 0.47)
            bar1.stretch(0.001, 0, about_edge=LEFT)
            self.add(bar1)
            self.play(bar1.animate.stretch(1000, 0, about_edge=LEFT), run_time=b.t(0.15))
            self.play(FadeIn(num1), run_time=b.t(0.08))
            _at(self, b, 0.77)
            self.add(bar2)
            self.play(FadeIn(num2), Indicate(lab2, color=SOLVED), run_time=b.t(0.15))
            src = T("standing.checked.dev_gates", SMALL, MUTED, mono=True).move_to([0, -2.6, 0])
            self.play(FadeIn(src), run_time=b.t(0.05))


# ====================================================================== gate_compile
class GateCompile(DWScene):
    # sentence starts (s): copy 0.3, never 4.3, esbuild 6.4, syntax 12.6
    BEATS = [("copy", 4.3), ("never", 2.1), ("bundle", 6.2), ("stop", 1.68)]

    def construct(self):
        with self.beat("copy") as b:
            title = scene_title("The compile gate", CREATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.12))
            ag = _card("agent folder", ["src/"], AGENT, mono_title=False, size=LABEL, sub_mono=True, sub_size=LABEL)
            ag.move_to([_X0 + ag.width / 2, 1.45, 0])
            tmp = _card("new temporary folder", ["<os.tmpdir()>/deepwidgets-gates-XXXX/src"], CREATION,
                        mono_title=False, size=LABEL, sub_mono=True)
            tmp.move_to([_X1 - tmp.width / 2, 1.45, 0])
            cp = _arr(ag.get_right(), tmp.get_left(), CREATION)
            cpl = T("copy", SMALL, CREATION).next_to(cp, UP, buff=0.08)
            self.play(FadeIn(ag), run_time=b.t(0.15))
            self.play(GrowArrow(cp), FadeIn(cpl), FadeIn(tmp, shift=RIGHT * 0.15), run_time=b.t(0.3))
            mac = T("on macOS: under /var/folders", SMALL, MUTED).next_to(tmp, DOWN, buff=0.15)
            self.play(FadeIn(mac), run_time=b.t(0.15))

        with self.beat("never") as b:
            nv = T("the gate never works here", SMALL, AGENT).next_to(ag, DOWN, buff=0.15)
            self.play(FadeIn(nv), Indicate(ag.box, color=AGENT, scale_factor=1.04), run_time=b.t(0.5))

        with self.beat("bundle") as b:
            hdr = _note(f'<b>esbuild</b>, a fast bundler', LABEL, CREATION)
            opts = code_block("bundle: true,\nplatform: 'node',\nformat: 'esm',\ntarget: 'node22',",
                              "typescript", color=CREATION, size=BODY - 2)
            opts.move_to([0, -1.25, 0])
            hdr.next_to(opts, UP, buff=0.15)
            src = chip("src", AGENT, size=LABEL)
            zod = chip("zod", RUNTIME, size=LABEL)
            ins = VGroup(src, zod).arrange(DOWN, buff=0.35).move_to([_X0 + 0.9, opts.get_y(), 0])
            out = _card("out/index.js", ["one JavaScript file", "for Node"], CREATION, size=LABEL)
            out.move_to([_X1 - out.width / 2, opts.get_y(), 0])
            down = _arr(tmp.box.get_bottom(), [tmp.get_x(), opts.get_top()[1] + 0.5, 0], CREATION)
            a_in = VGroup(*[_arr(c.get_right(), opts.get_left() + UP * (0.3 if c is src else -0.3), MUTED)
                            for c in (src, zod)])
            a_out = _arr(opts.get_right(), out.get_left(), CREATION)
            self.play(FadeIn(hdr), FadeIn(opts), run_time=b.t(0.2))
            self.play(LaggedStart(FadeIn(src), FadeIn(zod), lag_ratio=0.4), Create(a_in), run_time=b.t(0.25))
            _at(self, b, 0.6)
            self.play(GrowArrow(a_out), FadeIn(out, shift=RIGHT * 0.15), run_time=b.t(0.3))

        with self.beat("stop") as b:
            err = chip("syntax error: the install stops here", ISOLATION, size=LABEL, mono=False, fill=0.25)
            err.move_to(opts.get_center())
            self.play(FadeIn(err, scale=1.1), opts.animate.set_opacity(0.3), run_time=b.t(0.35))


# ====================================================================== gate_lint
class GateLint(DWScene):
    # sentence starts (s): types 4.6, imports 8.6, nonode 13.1, timers 15.7, props 24.2, why 27.5,
    # cordis 33.7, promise 36.7, rejection 42.3, loop 46.3, blocks 52.4, own 54.8, pr 59.0
    BEATS = [("oxlint", 4.4), ("typecheck", 3.9), ("imports", 4.5), ("nonode", 2.9), ("timers", 8.3),
             ("props", 3.5), ("rawwhy", 6.2), ("cordis", 2.8), ("promise", 5.8), ("rejection", 3.7),
             ("loop", 6.4), ("blocks", 2.1), ("own", 4.1), ("pr63", 4.84)]

    OXLINT = """typescript/no-floating-promises
typescript/no-misused-promises
no-restricted-globals:
  setTimeout, setInterval,
  setImmediate, queueMicrotask
no-restricted-properties:
  (the same names)"""

    TSCONFIG = """lib:   ['es2024', 'dom']
types: []
paths: { zod }"""

    def construct(self):
        RX = 0.55   # left edge of the right column

        with self.beat("oxlint") as b:
            title = scene_title("The lint gate", CREATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.12))
            h1 = _note('<b>oxlint</b>, a fast linter, with the types', LABEL, CREATION)
            h1.move_to([0, 2.55, 0]).align_to([_X0, 0, 0], LEFT)
            ox = code_block(self.OXLINT, "yaml", color=CREATION, size=24)
            ox.next_to(h1, DOWN, buff=0.2).align_to(h1, LEFT)
            for ln in ox.code_lines:      # all rules shown dim; each lights up when the narration reaches it
                ln.set_opacity(0.25)
            ta = T("type-aware lint: it also reads the types", SMALL, MUTED)
            ta.next_to(ox, DOWN, buff=0.2).align_to(ox, LEFT)
            self.play(FadeIn(h1), FadeIn(ox), run_time=b.t(0.25))
            self.play(FadeIn(ta), run_time=b.t(0.2))

        with self.beat("typecheck") as b:
            h2 = _note('full <b>type check</b>: the widget type file', LABEL, TEXT)
            h2.move_to([0, 1.75, 0]).align_to([RX, 0, 0], LEFT)
            ts = code_block(self.TSCONFIG, "typescript", color=MUTED, size=BODY)
            ts.next_to(h2, DOWN, buff=0.2).align_to(h2, LEFT)
            hide_lines(ts)
            self.play(FadeIn(h2), FadeIn(ts), run_time=b.t(0.3))
            self.play(reveal_lines(ts, 0, 1), run_time=b.t(0.25))

        with self.beat("imports") as b:
            self.play(reveal_lines(ts, 2, 3), run_time=b.t(0.15))
            allow = _note('two imports only', LABEL, TEXT)
            c1 = chip("zod", RUNTIME, size=LABEL)
            c2 = chip("widget types", RUNTIME, size=LABEL)
            arow = VGroup(allow, VGroup(c1, c2).arrange(RIGHT, buff=0.3)).arrange(DOWN, buff=0.15,
                                                                                    aligned_edge=LEFT)
            arow.next_to(ts, DOWN, buff=0.35).align_to(ts, LEFT)
            mk = mark_line(ts, 2, RUNTIME)
            self.play(Create(mk), FadeIn(arow, shift=UP * 0.1), run_time=b.t(0.35))

        with self.beat("nonode") as b:
            mk2 = mark_line(ts, 1, ISOLATION)
            self.play(reveal_lines(ts, 1, 2), ReplacementTransform(mk, mk2), run_time=b.t(0.25))
            mk = mk2
            nn = _note('Node modules: not in the types', LABEL, ISOLATION)
            nn.next_to(arow, DOWN, buff=0.3).align_to(arow, LEFT)
            self.play(FadeIn(nn, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("timers") as b:
            self.play(FadeOut(VGroup(h2, ts, arow, nn, mk)), run_time=b.t(0.08))
            self.play(reveal_lines(ox, 2, 5, lag=0.5), run_time=b.t(0.45))
            m_g = SurroundingRectangle(ox.code_lines[2:5], color=CREATION, buff=0.06, stroke_width=2.5,
                                       corner_radius=0.05)
            rt = _note('four <b>raw timers</b>: refused', LABEL, CREATION)
            rt.move_to([0, 2.55, 0]).align_to([RX, 0, 0], LEFT)
            self.play(Create(m_g), FadeIn(rt), run_time=b.t(0.2))

        with self.beat("props") as b:
            self.play(reveal_lines(ox, 5, 7, lag=0.5), run_time=b.t(0.3))
            m_p = SurroundingRectangle(ox.code_lines[5:7], color=CREATION, buff=0.06, stroke_width=2.5,
                                       corner_radius=0.05)
            ex = T("globalThis.setTimeout(…)", LABEL, TEXT, mono=True)
            ex.next_to(rt, DOWN, buff=0.35).align_to(rt, LEFT)
            st = _strike(ex)
            self.play(ReplacementTransform(m_g, m_p), FadeIn(ex), run_time=b.t(0.3))
            self.play(Create(st), run_time=b.t(0.2))

        with self.beat("rawwhy") as b:
            # two timelines: a raw timer runs on after the widget stops; a Cordis timer stops with it
            wy = T("Why?", BODY, CREATION, bold=True).next_to(ex, DOWN, buff=0.35).align_to(rt, LEFT)
            self.play(FadeIn(wy), run_time=b.t(0.1))
            L, R = RX + 0.1, _X1 - 0.1
            y1, y2 = -0.85, -2.05
            stop_x = L + (R - L) * 0.55
            raw_l = T("raw timer", LABEL, ISOLATION).move_to([L, y1 + 0.42, 0], aligned_edge=LEFT)
            cor_l = T("Cordis timer", LABEL, SOLVED).move_to([L, y2 + 0.42, 0], aligned_edge=LEFT)
            ax1 = Line([L, y1, 0], [R, y1, 0], stroke_color=MUTED, stroke_width=2)
            ax2 = Line([L, y2, 0], [R, y2, 0], stroke_color=MUTED, stroke_width=2)
            stop = DashedLine([stop_x, y1 + 0.55, 0], [stop_x, y2 - 0.3, 0], color=TEXT, stroke_width=2.5,
                              dash_length=0.08)
            stop_l = T("widget stops", SMALL, TEXT).next_to(stop, DOWN, buff=0.08)
            xs = np.linspace(L + 0.3, R - 0.15, 9)
            t1 = VGroup(*[Dot([x, y1, 0], radius=0.08, color=ISOLATION if x > stop_x else TEXT) for x in xs])
            t2 = VGroup(*[Dot([x, y2, 0], radius=0.08, color=SOLVED) for x in xs if x < stop_x])
            self.play(FadeIn(VGroup(raw_l, cor_l, ax1, ax2)), Create(stop), FadeIn(stop_l), run_time=b.t(0.2))
            _at(self, b, 0.4)
            self.play(LaggedStart(*[FadeIn(d, scale=1.6) for d in t1], lag_ratio=0.3), run_time=b.t(0.45))
            runs = T("runs on", SMALL, ISOLATION).next_to(t1[-3:], UP, buff=0.12)
            self.play(FadeIn(runs), run_time=b.t(0.1))

        with self.beat("cordis") as b:
            self.play(LaggedStart(*[FadeIn(d, scale=1.6) for d in t2], lag_ratio=0.3), run_time=b.t(0.5))
            sw = T("stops with it", SMALL, SOLVED).move_to([stop_x + 0.25, y2 + 0.32, 0], aligned_edge=LEFT)
            self.play(FadeIn(sw), run_time=b.t(0.2))
            timeline = VGroup(raw_l, cor_l, ax1, ax2, stop, stop_l, t1, t2, runs, sw, wy, ex, st, rt)

        with self.beat("promise") as b:
            m_f = mark_line(ox, 0)
            self.play(FadeOut(timeline), reveal_lines(ox, 0, 1), ReplacementTransform(m_p, m_f),
                      run_time=b.t(0.2))
            self.play(reveal_lines(ox, 1, 2), run_time=b.t(0.12))
            fp = _note('<b>floating promise</b>: a promise', LABEL, CREATION)
            fp2 = _note('that nobody awaits or catches', LABEL, CREATION)
            fpg = VGroup(fp, fp2).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            fpg.move_to([0, 2.4, 0]).align_to([RX, 0, 0], LEFT)
            exc = code_block("save(state)  // not awaited", "typescript", color=ISOLATION, size=24)
            exc.next_to(fpg, DOWN, buff=0.3).align_to(fpg, LEFT)
            il = T("illustrative", SMALL, MUTED).next_to(exc, DOWN, buff=0.1).align_to(exc, LEFT)
            self.play(FadeIn(fpg), run_time=b.t(0.2))
            self.play(FadeIn(exc), FadeIn(il), run_time=b.t(0.2))

        with self.beat("rejection") as b:
            wy2 = T("Why?", BODY, CREATION, bold=True).next_to(il, DOWN, buff=0.3).align_to(il, LEFT)
            rj = _card("rejection", ["no handler"], ISOLATION, mono_title=False, size=LABEL)
            host = _card("host", ["ends"], HOST, mono_title=False, size=LABEL)
            rr = VGroup(rj, host).arrange(RIGHT, buff=1.2).next_to(wy2, DOWN, buff=0.35).align_to(wy2, LEFT)
            ra = _arr(rj.get_right(), host.get_left(), ISOLATION)
            bx = burst(ISOLATION, 0.26).move_to(host.box.get_corner(UR))
            self.play(FadeIn(wy2), FadeIn(rj), run_time=b.t(0.25))
            self.play(GrowArrow(ra), FadeIn(host), run_time=b.t(0.25))
            self.play(FadeIn(bx, scale=1.5), host.box.animate.set_stroke(ISOLATION), run_time=b.t(0.2))
            prom = VGroup(fpg, exc, il, wy2, rj, host, ra, bx)

        with self.beat("loop") as b:
            self.play(FadeOut(prom), FadeOut(m_f), run_time=b.t(0.08))
            lh = _note('a last rule: <b>a loop with no exit</b>', LABEL, CREATION)
            lh.move_to([0, 2.55, 0]).align_to([RX, 0, 0], LEFT)
            rule = _card("deepwidgets(no-endless-loop)", ["from loop-check.ts"], CREATION, sub_mono=True)
            rule.next_to(lh, DOWN, buff=0.25).align_to(lh, LEFT)
            lp = code_block("while (true) { ... }", "typescript", color=ISOLATION, size=BODY - 2)
            lp.next_to(rule, DOWN, buff=0.3).align_to(rule, LEFT)
            nb = T("no break", SMALL, ISOLATION).next_to(lp, RIGHT, buff=0.25)
            self.play(FadeIn(lh), FadeIn(rule), run_time=b.t(0.25))
            self.play(FadeIn(lp), run_time=b.t(0.15))
            _at(self, b, 0.55)
            st2 = _strike(lp.code_lines[0], ISOLATION, 5)
            self.play(Create(st2), FadeIn(nb), run_time=b.t(0.25))

        with self.beat("blocks") as b:
            hb = rbox(5.9, 0.9, HOST, fill=0.06).next_to(lp, DOWN, buff=0.4).align_to(lp, LEFT)
            ws = VGroup(*[chip(n, RUNTIME, size=SMALL) for n in ("sample", "groceries", "w3", "w4")])
            ws.arrange(RIGHT, buff=0.2).move_to(hb)
            hl = T("blocks every widget", SMALL, ISOLATION).next_to(hb, DOWN, buff=0.1).align_to(hb, LEFT)
            self.play(FadeIn(hb), FadeIn(ws), run_time=b.t(0.3))
            self.play(ws.animate.set_opacity(0.25), FadeIn(hl), run_time=b.t(0.35))

        with self.beat("own") as b:
            own = _note('deepWidgets own code:', SMALL, TEXT)
            own2 = _note(f'{_mono("loop-check.ts")} walks the', SMALL, TEXT)
            own3 = _note('TypeScript syntax tree', SMALL, TEXT)
            og = VGroup(own, own2, own3).arrange(DOWN, buff=0.08, aligned_edge=LEFT)
            og.next_to(ta, DOWN, buff=0.4).align_to(ta, LEFT)
            # a small syntax tree under the note
            n0 = Dot(radius=0.07, color=CREATION)
            kids = VGroup(*[Dot(radius=0.07, color=CREATION) for _ in range(3)]).arrange(RIGHT, buff=0.6)
            kids.next_to(n0, DOWN, buff=0.35)
            gk = VGroup(*[Dot(radius=0.07, color=ISOLATION) for _ in range(2)]).arrange(RIGHT, buff=0.4)
            gk.next_to(kids[1], DOWN, buff=0.35)
            edges = VGroup(*[Line(n0.get_center(), k.get_center(), stroke_color=MUTED, stroke_width=2) for k in kids],
                           *[Line(kids[1].get_center(), g.get_center(), stroke_color=MUTED, stroke_width=2) for g in gk])
            tree = VGroup(edges, n0, kids, gk).next_to(og, RIGHT, buff=0.35)
            wl = T("while", SMALL, ISOLATION, mono=True)
            wl.next_to(gk, RIGHT, buff=0.25)
            self.play(FadeIn(og), run_time=b.t(0.25))
            self.play(Create(edges), FadeIn(VGroup(n0, kids, gk)), FadeIn(wl), run_time=b.t(0.35))

        with self.beat("pr63") as b:
            fn1 = _note(f'oxlint JS plugins exit {_mono("133", ISOLATION)}', SMALL, MUTED)
            fn2 = _note('under Electron (PR #63)', SMALL, MUTED)
            fn = VGroup(fn1, fn2).arrange(DOWN, buff=0.08, aligned_edge=LEFT)
            fn.next_to(hl, DOWN, buff=0.35).align_to([RX, 0, 0], LEFT)
            self.play(FadeIn(fn, shift=UP * 0.1), run_time=b.t(0.3))


# ====================================================================== gate_test_run
class GateTestRun(DWScene):
    # sentence starts (s): heap 5.8, loads 8.6, apply 15.6, actions 18.7, throws 24.0, timers 27.6,
    # one 31.4, uncaught 34.4, hb 38.9, kill 42.0, loop 46.1, holes 50.0, hole1 51.7, hole2 55.9, example 62.3
    BEATS = [("spawn", 5.5), ("heap", 2.5), ("context", 7.0), ("apply", 3.3), ("actions", 5.1),
             ("throws", 3.5), ("timers", 3.9), ("one", 3.1), ("uncaught", 4.3), ("hb", 3.4), ("kill", 4.0),
             ("loop", 3.6), ("holes", 2.2), ("hole1", 3.8), ("hole2", 6.6), ("example", 3.4)]

    CMD = "node --max-old-space-size=256 testrun-child.js out/index.js 1500"
    ROWS = [("STEP apply", "1 s"), ("STEP action <slug>.<name>", "1 s each, args {}"),
            ("STEP timers", "1.5 s"), ("RESULT {...}", "exactly one widget")]

    def construct(self):
        with self.beat("spawn") as b:
            title = scene_title("The test run gate", CREATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.1))
            cmd = T(self.CMD, SMALL, TEXT, mono=True)
            proc = rbox(FRAME_W - 2 * MARGIN, 3.65, CREATION, fill=0.04)
            proc.move_to([0, 1.03, 0])
            cmd.move_to([0, proc.get_top()[1] - 0.35, 0])
            pl = T("new process", SMALL, CREATION, bold=True).next_to(proc, UP, buff=0.06).align_to(proc, RIGHT)
            self.play(Create(proc), FadeIn(pl), run_time=b.t(0.2))
            self.play(Write(cmd), run_time=b.t(0.3))
            # characters of '--max-old-space-size=256' (Text drops spaces): after 'node'
            hp = cmd[4:4 + len("--max-old-space-size=256")]
            m_h = SurroundingRectangle(hp, color=CREATION, buff=0.06, stroke_width=2.5, corner_radius=0.05)
            hl = T("heap limit: 256 MB", SMALL, CREATION).next_to(m_h, DOWN, buff=0.12).align_to(m_h, LEFT)
            self.play(Create(m_h), FadeIn(hl), run_time=b.t(0.2))

        with self.beat("heap") as b:
            hd = T("heap: the memory for objects", SMALL, MUTED).next_to(hl, RIGHT, buff=0.5)
            self.play(FadeIn(hd), run_time=b.t(0.4))

        with self.beat("context") as b:
            ctxb = _card("new Context()", None, RUNTIME, size=LABEL, w=4.5, h=2.35)
            ctxb.move_to([proc.get_left()[0] + 0.25 + 2.25, 0.4, 0])
            ctxb.title.move_to(ctxb.box.get_top() + DOWN * 0.28)
            bare = T("bare Cordis context", SMALL, MUTED).next_to(ctxb.title, DOWN, buff=0.1)
            c1 = chip("TimerService", RUNTIME, size=SMALL)
            c1l = T("real", SMALL, SOLVED)
            c2 = chip("StandInWidgets", RUNTIME, size=SMALL, fill=0.04)
            c2l = T("stand-in", SMALL, MUTED)
            r1 = VGroup(c1, c1l).arrange(RIGHT, buff=0.15)
            r2 = VGroup(c2, c2l).arrange(RIGHT, buff=0.15)
            rows = VGroup(r1, r2).arrange(DOWN, buff=0.15, aligned_edge=LEFT).next_to(bare, DOWN, buff=0.18)
            rows.set_x(ctxb.box.get_x())
            bun = chip("out/index.js", CREATION, size=SMALL)
            bun_l = T("loads", SMALL, MUTED)
            VGroup(bun_l, bun).arrange(RIGHT, buff=0.15)
            bun.move_to([proc.get_right()[0] - 0.25 - bun.width / 2, hl.get_y() - 0.03, 0])
            bun_l.next_to(bun, LEFT, buff=0.15)
            bun = VGroup(bun_l, bun)
            self.play(FadeOut(hd), FadeIn(ctxb), FadeIn(bare), run_time=b.t(0.2))
            self.play(FadeIn(bun, shift=DOWN * 0.15), Indicate(ctxb.box, color=RUNTIME, scale_factor=1.03),
                      run_time=b.t(0.2))
            _at(self, b, 0.5)
            self.play(FadeIn(r1, shift=RIGHT * 0.1), run_time=b.t(0.15))
            self.play(FadeIn(r2, shift=RIGHT * 0.1), run_time=b.t(0.15))

        with self.beat("apply") as b:
            tbl = RevealTable(["child prints", "limit"], self.ROWS, mono_cols=[0],
                              cell_colors={(i, 1): CREATION for i in range(len(self.ROWS))})
            tbl.move_to([0, 0, 0]).align_to([ctxb.get_right()[0] + 0.45, 0, 0], LEFT)
            tbl.align_to([0, ctxb.box.get_top()[1] + 0.05, 0], UP)
            self.add(tbl)
            self.play(tbl.reveal_row(0), run_time=b.t(0.35))

        with self.beat("actions") as b:
            self.play(tbl.reveal_row(1), run_time=b.t(0.35))
            m1 = tbl.mark_row(1)
            self.play(Create(m1), run_time=b.t(0.2))

        with self.beat("throws") as b:
            wn = chip("an action throws: a warning only", CREATION, size=SMALL, mono=False, fill=0.2)
            wn.move_to([0, proc.get_bottom()[1] - 0.4, 0]).align_to(proc, LEFT)
            self.play(FadeIn(wn, shift=UP * 0.1), run_time=b.t(0.35))

        with self.beat("timers") as b:
            self.play(FadeOut(m1), tbl.reveal_row(2), run_time=b.t(0.35))

        with self.beat("one") as b:
            self.play(tbl.reveal_row(3), run_time=b.t(0.35))
            m3 = tbl.mark_row(3)
            self.play(Create(m3), run_time=b.t(0.2))

        with self.beat("uncaught") as b:
            fl = chip("uncaught error or unhandled rejection: gate fails", ISOLATION, size=SMALL, mono=False,
                      fill=0.2)
            fl.move_to([0, wn.get_y(), 0]).align_to(proc, RIGHT)
            self.play(FadeOut(m3), FadeIn(fl, shift=UP * 0.1), run_time=b.t(0.35))

        # heartbeat strip under the process box
        y_hb = -1.98
        L = _X0 + 2.2
        px = 0.62   # 100 ms
        with self.beat("hb") as b:
            parent = _card("parent", None, CREATION, mono_title=False, size=LABEL)
            parent.move_to([_X0 + parent.width / 2, y_hb, 0])
            ax = Line([L - 0.2, y_hb - 0.3, 0], [_X1, y_hb - 0.3, 0], stroke_color=MUTED, stroke_width=2)
            hbs = VGroup(*[T("HB", SMALL, SOLVED, mono=True).move_to([L + i * px, y_hb + 0.05, 0]) for i in range(7)])
            ms = T("every 100 ms", SMALL, MUTED).next_to(hbs[0:2], DOWN, buff=0.4).align_to(hbs[0], LEFT)
            self.play(FadeIn(parent), Create(ax), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(h, shift=DOWN * 0.1) for h in hbs], lag_ratio=0.5), FadeIn(ms),
                      run_time=b.t(0.6))

        with self.beat("kill") as b:
            s0 = L + 6 * px          # last heartbeat
            s1 = s0 + 7.5 * px       # 750 ms later, to scale
            gap = DashedLine([s0 + 0.3, y_hb + 0.05, 0], [s1, y_hb + 0.05, 0], color=ISOLATION, stroke_width=3,
                             dash_length=0.1)
            gl = T("750 ms silent", SMALL, ISOLATION).next_to(gap, UP, buff=0.1)
            kill = chip("kill", ISOLATION, size=SMALL, mono=False, fill=0.3)
            kill.move_to([s1 + 0.1 + kill.width / 2, y_hb + 0.05, 0])
            self.play(Create(gap), FadeIn(gl), run_time=b.t(0.4))
            self.play(FadeIn(kill, scale=1.3), run_time=b.t(0.2))
            lim = T("also: 10 s to start, 15 s in all", SMALL, MUTED).next_to(ax, DOWN, buff=0.08)
            lim.align_to([_X1, 0, 0], RIGHT)
            self.play(FadeIn(lim), run_time=b.t(0.2))

        with self.beat("loop") as b:
            lp = T("catches a loop that the lint missed", SMALL, ISOLATION).next_to(ms, RIGHT, buff=0.5)
            lp.set_y(ms.get_y())
            self.play(FadeIn(lp), Indicate(kill, color=ISOLATION), run_time=b.t(0.5))

        with self.beat("holes") as b:
            self.play(FadeOut(VGroup(wn, fl, parent, ax, hbs, ms, gap, gl, kill, lim, lp)),
                      run_time=b.t(0.2))
            hh = T("two known holes", BODY, ISOLATION, bold=True).move_to([0, -1.05, 0]).align_to([_X0, 0, 0], LEFT)
            self.play(FadeIn(hh), run_time=b.t(0.3))

        with self.beat("hole1") as b:
            h1 = _card("a timer that fires after 1.5 s", ["is not tested"], ISOLATION, mono_title=False, size=LABEL,
                       dashed=True)
            h1.next_to(hh, DOWN, buff=0.25).align_to(hh, LEFT)
            self.play(FadeIn(h1, shift=UP * 0.1), Create(tbl.mark_row(2, ISOLATION)), run_time=b.t(0.3))

        with self.beat("hole2") as b:
            h2 = _card("an action whose schema refuses {}", ["is not called: a warning"], ISOLATION,
                       mono_title=False, size=LABEL, dashed=True)
            h2.next_to(h1, RIGHT, buff=0.4).align_to(h1, UP)
            self.play(FadeIn(h2, shift=UP * 0.1), Create(tbl.mark_row(1, ISOLATION)), run_time=b.t(0.25))

        with self.beat("example") as b:
            ex = T("the example at the end goes through this hole", SMALL, MUTED).next_to(h1, DOWN, buff=0.12)
            ex.align_to(h1, LEFT)
            self.play(FadeIn(ex), Indicate(h1.box, color=ISOLATION, scale_factor=1.04), run_time=b.t(0.45))


# ====================================================================== install_replace
class InstallReplace(DWScene):
    # sentence starts (s): next 4.0, swap 6.8, fail 10.0, one 12.9, state 15.5, remove 19.7, back 23.5,
    # program 26.6, wins 28.5, seed 30.7, hash 36.1, builtin 38.7, slug-taken 41.6
    BEATS = [("replace", 3.65), ("next", 2.95), ("swap", 3.05), ("fail", 2.9), ("one", 2.45), ("state", 4.25),
             ("remove", 4.0), ("back", 2.85), ("program", 1.9), ("wins", 2.5), ("seed", 5.25), ("hash", 2.45),
             ("builtin", 2.9), ("close", 2.28)]

    def construct(self):
        outline = OutlineDiagram()
        PX0, PX1 = _X0, -0.35        # folder panel
        ys = [1.45, 0.65, -0.15]     # folder slots

        def folder(name, color=RUNTIME):
            return chip(name + "/", color, size=LABEL)

        with self.beat("replace") as b:
            title = scene_title("A second install replaces", CREATION)
            panel = rbox(PX1 - PX0, 3.6, RUNTIME, fill=0.03).move_to([(PX0 + PX1) / 2, 0.75, 0])
            ph = T("<profile>/deepwidgets-widgets/", SMALL, RUNTIME, mono=True)
            ph.move_to(panel.get_top() + DOWN * 0.32).align_to(panel, LEFT).shift(RIGHT * 0.25)
            old = folder("groceries").move_to([PX0 + 0.3, ys[0], 0], aligned_edge=LEFT)
            ol = T("installed", SMALL, SOLVED).next_to(old, RIGHT, buff=0.25)
            self.play(FadeIn(title, shift=RIGHT * 0.2), Create(panel), FadeIn(ph), run_time=b.t(0.2))
            self.play(FadeIn(old), FadeIn(ol), run_time=b.t(0.15))
            call = chip("widget_install  slug: groceries", CREATION, size=SMALL)
            call.move_to([3.3, 2.45, 0])
            pm = _card("plugin manager", ["installBundle"], RUNTIME, mono_title=False, size=LABEL, sub_mono=True)
            pm.move_to([3.3, 1.2, 0])
            ib = pm.sub
            ib.set_opacity(0)
            self.play(FadeIn(call, shift=LEFT * 0.2), FadeIn(pm.box), FadeIn(pm.title), run_time=b.t(0.25))

        with self.beat("next") as b:
            nxt = folder("groceries.next", CREATION).move_to([PX0 + 0.3, ys[1], 0], aligned_edge=LEFT)
            nl = T("new bundle", SMALL, CREATION).next_to(nxt, RIGHT, buff=0.25)
            self.play(FadeIn(nxt, shift=DOWN * 0.15), FadeIn(nl), run_time=b.t(0.4))

        with self.beat("swap") as b:
            un = T("uninstall old", SMALL, MUTED).next_to(pm, DOWN, buff=0.12)
            self.play(FadeOut(ol), FadeIn(un), old.animate.set_opacity(0.35), run_time=b.t(0.2))
            prev = folder("groceries.previous").set_opacity(0.35).move_to([PX0 + 0.3, ys[2], 0], aligned_edge=LEFT)
            self.play(ReplacementTransform(old, prev), run_time=b.t(0.2))
            new = folder("groceries", RUNTIME).move_to([PX0 + 0.3, ys[0], 0], aligned_edge=LEFT)
            self.play(ReplacementTransform(nxt, new), FadeOut(nl), run_time=b.t(0.2))
            pm_arr = _arr([PX1, new.get_y(), 0], pm.get_left(), RUNTIME, buff=0.05)
            self.play(FadeOut(un), GrowArrow(pm_arr), ib.animate.set_opacity(1), run_time=b.t(0.2))
            ok = T("applied", SMALL, SOLVED).next_to(pm, DOWN, buff=0.12)
            self.play(FadeIn(ok), run_time=b.t(0.12))

        with self.beat("fail") as b:
            fc_t = T("if the new one fails:", SMALL, ISOLATION, bold=True)
            a = chip("groceries.previous/", RUNTIME, size=SMALL)
            arr = Arrow(LEFT, RIGHT, buff=0, color=ISOLATION, stroke_width=3, tip_length=0.16).scale(0.45)
            c = chip("groceries/", RUNTIME, size=SMALL)
            rl = T("restored", SMALL, ISOLATION)
            frow = VGroup(a, arr, c, rl).arrange(RIGHT, buff=0.2)
            fc = VGroup(fc_t, frow).arrange(DOWN, buff=0.15, aligned_edge=LEFT)
            fbox = rbox(fc.width + 0.5, fc.height + 0.4, ISOLATION, fill=0.05, dashed=True)
            fc.move_to(fbox)
            failg = VGroup(fbox, fc).move_to([0, -2.0, 0]).align_to([PX0, 0, 0], LEFT)
            self.play(FadeIn(failg, shift=UP * 0.1), Indicate(prev, color=ISOLATION), run_time=b.t(0.45))

        with self.beat("one") as b:
            one = chip("one install at a time", CREATION, size=SMALL, mono=False, fill=0.2)
            one.move_to(failg).align_to([PX0, 0, 0], LEFT)
            self.play(FadeOut(failg), FadeIn(one, shift=UP * 0.1), FadeOut(prev), run_time=b.t(0.35))

        with self.beat("state") as b:
            disk = disk_icon(RUNTIME, 0.8)
            st = T("storage", LABEL, RUNTIME, bold=True)
            sl = T("state of groceries", SMALL, TEXT)
            dg = VGroup(disk, VGroup(st, sl).arrange(DOWN, buff=0.08, aligned_edge=LEFT)).arrange(RIGHT, buff=0.3)
            dg.move_to([3.3, -0.65, 0])
            nb = T("state: in storage, not in the bundle", SMALL, MUTED).next_to(dg, DOWN, buff=0.2)
            self.play(FadeIn(dg), run_time=b.t(0.25))
            self.play(FadeIn(nb), Indicate(disk, color=RUNTIME), run_time=b.t(0.3))

        with self.beat("remove") as b:
            rm = chip("widget_remove", CREATION, size=SMALL)
            rm.move_to(call)
            self.play(FadeOut(call), FadeIn(rm), run_time=b.t(0.15))
            gone = T("removed", SMALL, ISOLATION).next_to(new, RIGHT, buff=0.25)
            self.play(new[0].animate.set_stroke(opacity=0.25).set_fill(opacity=0.03), new[1].animate.set_opacity(0.25),
                      FadeOut(ok), FadeIn(gone), FadeOut(pm_arr), ib.animate.set_opacity(0),
                      run_time=b.t(0.25))
            stay = T("still stays", SMALL, SOLVED).next_to(sl, RIGHT, buff=0.2)
            self.play(FadeIn(stay), Indicate(disk, color=SOLVED), run_time=b.t(0.3))

        with self.beat("back") as b:
            call2 = chip("widget_install  slug: groceries", CREATION, size=SMALL).move_to(rm)
            self.play(FadeOut(rm), FadeIn(call2), FadeOut(gone),
                      new[0].animate.set_stroke(opacity=1).set_fill(opacity=0.15), new[1].animate.set_opacity(1),
                      run_time=b.t(0.2))
            da = CurvedArrow(dg.get_left() + LEFT * 0.1, new.get_bottom() + DOWN * 0.08 + RIGHT * 0.6,
                             color=SOLVED, stroke_width=3, tip_length=0.18, angle=-TAU / 8)
            dl = T("data back", SMALL, SOLVED).move_to(da.point_from_proportion(0.5) + DOWN * 0.3)
            self.play(Create(da), FadeIn(dl), run_time=b.t(0.4))

        with self.beat("program") as b:
            left = VGroup(panel, ph, new, da, dl, stay, nb)
            self.play(FadeOut(left), FadeOut(call2), FadeOut(pm), FadeOut(dg), FadeOut(one), run_time=b.t(0.2))
            q = T("What about the program?", BODY, CREATION, bold=True).move_to([0, 2.45, 0]).align_to([_X0, 0, 0], LEFT)
            self.play(FadeIn(q), run_time=b.t(0.3))

        with self.beat("wins") as b:
            sp = _card("stored program", ["in storage"], RUNTIME, mono_title=False, size=LABEL, w=3.6)
            sd = _card("seed program", ["in the widget code"], AGENT, mono_title=False, size=LABEL, w=3.6)
            sp.move_to([_X0 + 1.8, 1.25, 0])
            sd.next_to(sp, RIGHT, buff=1.8)
            wins = T("wins over", SMALL, RUNTIME).move_to((sp.get_right() + sd.get_left()) / 2 + UP * 0.25)
            gt = T(">", HEADING, RUNTIME, bold=True).next_to(wins, DOWN, buff=0.05)
            self.play(FadeIn(sp), FadeIn(sd), run_time=b.t(0.3))
            self.play(FadeIn(wins), FadeIn(gt), run_time=b.t(0.25))

        with self.beat("seed") as b:
            ch = T("seed changed", SMALL, AGENT).next_to(sd, UP, buff=0.12)
            self.play(FadeIn(ch), Indicate(sd.box, color=AGENT, scale_factor=1.05), run_time=b.t(0.2))
            sc = code_block("setProgram(..., { by: 'widget_install' })", "typescript", color=CREATION, size=CODE)
            sc.move_to([0, -0.55, 0]).align_to([_X0, 0, 0], LEFT)
            il = T("the installer writes the new seed", SMALL, CREATION).next_to(sc, DOWN, buff=0.12)
            il.align_to(sc, LEFT)
            a1 = _arr(sd.box.get_bottom(), [sd.get_x(), sc.get_top()[1], 0], CREATION)
            self.play(GrowArrow(a1), FadeIn(sc), FadeIn(il), run_time=b.t(0.35))
            a2 = _arr([sp.get_x(), sc.get_top()[1], 0], sp.box.get_bottom(), RUNTIME)
            self.play(GrowArrow(a2), Indicate(sp.box, color=RUNTIME, scale_factor=1.05), run_time=b.t(0.25))

        with self.beat("hash") as b:
            hs = _card(".seeds/groceries", ["sha256 of the last seed"], CREATION, size=LABEL)
            hs.move_to([0, 1.25, 0]).align_to([_X1, 0, 0], RIGHT)
            hl = T("how it knows the seed changed", SMALL, MUTED).next_to(hs, DOWN, buff=0.12)
            self.play(FadeIn(hs, shift=LEFT * 0.15), FadeIn(hl), run_time=b.t(0.45))

        with self.beat("builtin") as b:
            bi = chip("widget_install  slug: sample", CREATION, size=SMALL)
            bl = T("sample: a built-in widget", SMALL, MUTED)
            err = chip("slug-taken", ISOLATION, size=LABEL, fill=0.3)
            brow = VGroup(bi, _arr(LEFT, RIGHT * 0.2, ISOLATION), err).arrange(RIGHT, buff=0.25)
            brow.move_to([0, -2.4, 0]).align_to([_X0, 0, 0], LEFT)
            bl.next_to(bi, UP, buff=0.1).align_to(bi, LEFT)
            self.play(FadeIn(bi), FadeIn(bl), run_time=b.t(0.3))
            self.play(GrowArrow(brow[1]), FadeIn(err, scale=1.2), run_time=b.t(0.3))

        with self.beat("close") as b:
            outline.close_part(self, "creation", next_key="isolation", run_time=b.left)
