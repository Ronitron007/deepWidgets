"""Part `part_pin`: pin_question example_v2a example_v2b_types example_v2b_render shared_chunks_swap
pin_policy pin_work. Pin or rebuild: what the spike kits v2a and v2b broke, and the inferred policy.

Beat weights are seconds of the final audio: each beat starts at the pause before its sentence
(ffmpeg silencedetect). The base scales them to the audio length.
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


def _mono(s, color=None):
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    c = f' fgcolor="{color}"' if color else ""
    return f'<span font_family="{MONO}"{c}>{s}</span>'


def _folder(color=KIT, w=0.75, h=0.55):
    """A folder icon: tab and body."""
    tab = Polygon([0, 0, 0], [w * 0.38, 0, 0], [w * 0.46, h * 0.18, 0], [0, h * 0.18, 0],
                  stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.35)
    body = Rectangle(width=w, height=h, stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.15)
    body.next_to(tab, DOWN, buff=0).align_to(tab, LEFT)
    return VGroup(tab, body)


def _boxed(rows, color, size=SMALL, mono=True, text_color=TEXT, pad=0.3):
    """Lines of text in a box. .box .rows"""
    ms = VGroup(*[T(r, size, text_color, mono=mono) for r in rows]).arrange(DOWN, buff=0.12, aligned_edge=LEFT)
    box = rbox(ms.width + 2 * pad, ms.height + 1.4 * pad, color, fill=0.08, sw=2.5, r=0.12)
    ms.move_to(box)
    g = VGroup(box, ms)
    g.box, g.rows = box, ms
    return g


# ====================================================================== pin_question
class PinQuestion(DWScene):
    # beat starts at sentence pauses of the final audio (s): risk 3.97, pin 6.91, rebuild 11.65, data 15.06,
    # spike 18.75, totals 24.63
    BEATS = [("open", 3.97), ("risk", 2.94), ("pin", 4.74), ("rebuild", 3.41), ("data", 3.69), ("spike", 5.88),
             ("totals", 4.61)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "pin", also=("kit_project", "pinned_pages"), arrows=("line_pin",),
                                       run_time=b.left)

        with self.beat("risk") as b:
            title = scene_title("Pin or rebuild", PIN)
            kit = chip("kit change", KIT, mono=False, size=LABEL)
            page = chip("built widget", SHELL, mono=False, size=LABEL)
            row = VGroup(kit, page).arrange(RIGHT, buff=1.6).move_to([_X0, 2.3, 0], aligned_edge=LEFT)
            a = _arr(kit.get_right(), page.get_left(), ISOLATION)
            brk = T("can break", SMALL, ISOLATION).next_to(a, UP, buff=0.08)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(kit), run_time=b.t(0.3))
            self.play(GrowArrow(a), FadeIn(brk), FadeIn(page), run_time=b.t(0.35))

        dx = _X0 + 1.9
        with self.beat("pin") as b:
            c_pin = chip("pin", PIN, mono=False, size=LABEL)
            d_pin = T("keep the page on the kit version it built with", BODY)
            c_pin.move_to([_X0, 1.3, 0], aligned_edge=LEFT)
            d_pin.move_to([dx, 1.3, 0], aligned_edge=LEFT)
            self.play(FadeIn(c_pin), FadeIn(d_pin, shift=RIGHT * 0.1), run_time=b.t(0.35))

        with self.beat("rebuild") as b:
            c_reb = chip("rebuild", PIN, mono=False, size=LABEL)
            d_reb = T("build again on the new kit", BODY)
            c_reb.move_to([_X0, 0.6, 0], aligned_edge=LEFT)
            d_reb.move_to([dx, 0.6, 0], aligned_edge=LEFT)
            self.play(FadeIn(c_reb), FadeIn(d_reb, shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("data") as b:
            data = chip("operator direction: decide from data", PIN, mono=False, size=LABEL)
            data.move_to([_X0, -0.35, 0], aligned_edge=LEFT)
            self.play(FadeIn(data, shift=UP * 0.1), run_time=b.t(0.45))

        v1 = chip("kit v1", KIT, size=LABEL)
        v2a = chip("kit v2a", KIT, size=LABEL)
        v2b = chip("kit v2b", KIT, size=LABEL)
        v1.move_to([_X0 + 0.9, -1.75, 0])
        v2a.move_to([_X0 + 4.6, -1.3, 0])
        v2b.move_to([_X0 + 4.6, -2.3, 0])
        a1 = _arr(v1.get_right(), v2a.get_left(), KIT)
        a2 = _arr(v1.get_right(), v2b.get_left(), KIT)
        with self.beat("spike") as b:
            w3 = T("spike: three widgets", LABEL, MUTED).next_to(data, RIGHT, buff=0.6)
            self.play(FadeIn(w3), FadeIn(v1, shift=RIGHT * 0.1), run_time=b.t(0.3))
            _at(self, b, 0.6)
            self.play(GrowArrow(a1), GrowArrow(a2), FadeIn(v2a), FadeIn(v2b), run_time=b.t(0.35))

        with self.beat("totals") as b:
            tx = v2a.get_right()[0] + 0.5
            t_v1 = T("first build 7.7 s", LABEL).next_to(v1, DOWN, buff=0.18)
            t_a = T("rebuild 9.0 s", LABEL).move_to([tx, v2a.get_y(), 0], aligned_edge=LEFT)
            t_b = T("rebuild 8.3 s", LABEL).move_to([tx, v2b.get_y(), 0], aligned_edge=LEFT)
            meas = T("all three widgets, measured", SMALL, MUTED)
            meas.move_to([t_a.get_right()[0] + 0.6, -1.8, 0], aligned_edge=LEFT)
            brace = Brace(VGroup(t_a, t_b), RIGHT, buff=0.15, color=MUTED)
            meas.next_to(brace, RIGHT, buff=0.15)
            self.play(FadeIn(t_v1, shift=UP * 0.1), run_time=b.t(0.2))
            self.play(FadeIn(t_a, shift=RIGHT * 0.1), FadeIn(t_b, shift=RIGHT * 0.1), run_time=b.t(0.3))
            self.play(GrowFromCenter(brace), FadeIn(meas), run_time=b.t(0.2))


# ====================================================================== example_v2a
class ExampleV2a(DWScene):
    # beat starts (s): minor 4.81, type 6.24, build 9.04, render 10.77
    BEATS = [("bump", 4.81), ("minor", 1.43), ("type", 2.8), ("build", 1.73), ("render", 2.43)]

    ROWS = [("shadcn", "0", "0", "796 KB"), ("clock", "0", "0", "372 KB"), ("meter", "0", "0", "352 KB")]

    def construct(self):
        with self.beat("bump") as b:
            title = scene_title("Kit v2a: a minor version", KIT)
            head = M(_mono("kit v2a:", KIT) + "  " + _mono("date-fns 4.0.0 > 4.1.0"), BODY)
            head.move_to([_X0, 2.35, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(head, shift=RIGHT * 0.1), run_time=b.t(0.35))

        tbl = RevealTable(["widget", "tsc exit", "vite exit", "dist"], self.ROWS, mono_cols=[0, 1, 2, 3], size=LABEL,
                          row_gap=0.24, col_gap=1.0)
        tbl.move_to([_X0 + tbl.width / 2, 0.55, 0])
        src = T("results-v2a.tsv", SMALL, MUTED, mono=True).next_to(tbl, RIGHT, buff=0.6).align_to(tbl, UP)
        with self.beat("minor") as b:
            mn = chip("minor version", KIT, mono=False, size=LABEL).next_to(head, RIGHT, buff=0.5)
            self.add(tbl)
            self.play(FadeIn(mn), FadeIn(tbl.header), FadeIn(src), run_time=b.t(0.3))
            self.play(tbl.reveal_rows(0, 3), run_time=b.t(0.6))

        checks = []
        for name in ("type", "build", "render"):
            g = VGroup(_tick(SOLVED), T(name, BODY, TEXT)).arrange(RIGHT, buff=0.22)
            checks.append(g)
        cg = VGroup(*checks).arrange(RIGHT, buff=1.0).move_to([_X0, -1.7, 0], aligned_edge=LEFT)
        cols = {"type": 1, "build": 2}
        for name, g in zip(("type", "build", "render"), checks):
            with self.beat(name) as b:
                anims = [Create(g[0]), FadeIn(g[1], shift=UP * 0.1)]
                if name in cols:
                    c = cols[name]
                    anims.append(LaggedStart(*[Indicate(tbl.cell(i, c), color=SOLVED, scale_factor=1.15)
                                               for i in range(3)], lag_ratio=0.2))
                self.play(*anims, run_time=b.t(0.45))
                if name == "render":
                    ok = chip("0 of 3 broke", SOLVED, mono=False, size=LABEL).next_to(cg, RIGHT, buff=0.9)
                    self.play(FadeIn(ok, shift=LEFT * 0.1), run_time=b.t(0.3))


# ====================================================================== example_v2b_types
class ExampleV2bTypes(DWScene):
    # beat starts (s): rename 3.25, props 5.87, shadcn 9.6, clock 12.8, pass 16.31, fail 17.27, error 19.85,
    # fit 26.65, msg 31.72
    BEATS = [("bump", 3.25), ("rename", 2.62), ("props", 3.73), ("shadcn", 3.2), ("clock", 3.51), ("pass", 0.96),
             ("fail", 2.58), ("error", 6.8), ("fit", 5.07), ("msg", 4.2)]

    DIFF = """\
- interface MeterProps { value: number; max?: number; label: string }
+ interface MeterProps { percent: number; caption: string }"""

    ROWS = [("shadcn", "not used", "tsc_exit=0"), ("clock", "Pill only", "tsc_exit=0"),
            ("meter", "Meter", "tsc_exit=2")]

    ERR = ["src/agent/library.tsx(8,36): error TS2322:",
           "Type '{ value: number; max: number; label: string; }'",
           "  is not assignable to type 'IntrinsicAttributes & MeterProps'.",
           "Property 'value' does not exist on type",
           "  'IntrinsicAttributes & MeterProps'."]

    def construct(self):
        with self.beat("bump") as b:
            title = scene_title("Kit v2b: a changed library", KIT)
            head = M(_mono("kit v2b:", KIT) + "  " + _mono("dw-mini-ui 1.0.0 > 2.0.0") + "  test package", BODY)
            head.move_to([_X0, 2.4, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(head, shift=RIGHT * 0.1), run_time=b.t(0.35))

        lab = M(_mono("dw-mini-ui", KIT) + "  " + _mono("index.d.ts"), LABEL, MUTED)
        lab.move_to([_X0, 1.85, 0], aligned_edge=LEFT)
        diff = code_block(self.DIFF, "diff", color=KIT)
        diff.next_to(lab, DOWN, buff=0.3).align_to(lab, LEFT)
        hide_lines(diff)
        with self.beat("rename") as b:
            self.play(FadeIn(lab), FadeIn(diff.background), run_time=b.t(0.3))
            self.play(reveal_lines(diff, 0), run_time=b.t(0.35))

        with self.beat("props") as b:
            self.play(reveal_lines(diff, 1), run_time=b.t(0.35))
            pill = chip("Pill: unchanged", SOLVED, mono=False, size=SMALL).next_to(lab, RIGHT, buff=0.5)
            _at(self, b, 0.55)
            self.play(FadeIn(pill), run_time=b.t(0.3))

        tbl = RevealTable(["widget", "uses dw-mini-ui", "type gate"], self.ROWS, mono_cols=[0, 2], size=LABEL,
                          row_gap=0.24, col_gap=1.0, cell_colors={(2, 2): ISOLATION})
        tbl.next_to(diff, DOWN, buff=0.5).align_to(diff, LEFT)
        src = T("results-v2b.tsv", SMALL, MUTED, mono=True).next_to(tbl, RIGHT, buff=0.6).align_to(tbl, UP)
        ticks = VGroup(*[_tick(SOLVED, 0.15).next_to(tbl.cell(i, 2), RIGHT, buff=0.3) for i in range(2)])
        with self.beat("shadcn") as b:
            self.add(tbl)
            self.play(FadeIn(tbl.header), FadeIn(src), run_time=b.t(0.3))
            self.play(tbl.reveal_row(0), run_time=b.t(0.35))
        with self.beat("clock") as b:
            self.play(tbl.reveal_row(1), run_time=b.t(0.3))
        with self.beat("pass") as b:
            self.play(Create(ticks), run_time=b.t(0.7))

        with self.beat("fail") as b:
            self.play(tbl.reveal_row(2), run_time=b.t(0.35))
            fr = tbl.mark_row(2, ISOLATION)
            self.play(Create(fr), run_time=b.t(0.3))

        err = _boxed(self.ERR, ISOLATION, size=SMALL)
        err.next_to(diff, DOWN, buff=0.45).align_to(diff, LEFT)
        for r in err.rows:
            r.set_opacity(0)
        real = T("tsc output, real", SMALL, MUTED).next_to(err, UP, buff=0.1).align_to(err, RIGHT)
        with self.beat("error") as b:
            self.play(FadeOut(VGroup(tbl, src, ticks, fr)), run_time=b.t(0.15))
            self.play(FadeIn(err.box), FadeIn(real), err.rows[0].animate.set_opacity(1), run_time=b.t(0.25))
            m_loc = SurroundingRectangle(err.rows[0], color=ISOLATION, buff=0.06, stroke_width=2.5,
                                         corner_radius=0.05)
            _at(self, b, 0.5)
            self.play(Create(m_loc), run_time=b.t(0.25))

        with self.beat("fit") as b:
            self.play(FadeOut(m_loc), LaggedStart(*[err.rows[i].animate.set_opacity(1) for i in (1, 2)],
                                                  lag_ratio=0.4), run_time=b.t(0.35))
            self.play(Indicate(diff.code_lines[0], color=ISOLATION, scale_factor=1.03), run_time=b.t(0.3))

        with self.beat("msg") as b:
            self.play(LaggedStart(*[err.rows[i].animate.set_opacity(1) for i in (3, 4)], lag_ratio=0.4),
                      run_time=b.t(0.3))
            m_msg = SurroundingRectangle(VGroup(err.rows[3], err.rows[4]), color=ISOLATION, buff=0.06,
                                         stroke_width=2.5, corner_radius=0.05)
            self.play(Create(m_msg), Indicate(diff.code_lines[1], color=KIT, scale_factor=1.03), run_time=b.t(0.3))


# ====================================================================== example_v2b_render
class ExampleV2bRender(DWScene):
    # beat starts (s): load 4.27, throw 6.56, caught 9.88, says 14.08, minor 15.96, changed 18.19, both 21.14
    BEATS = [("build", 4.27), ("load", 2.29), ("throw", 3.32), ("caught", 4.2), ("says", 1.88), ("minor", 2.23),
             ("changed", 2.95), ("both", 3.34)]

    THROW = "if (typeof percent !== 'number') throw new Error('Meter: percent is required')"

    def construct(self):
        with self.beat("build") as b:
            title = scene_title("Kit v2b: the render check", CREATION)
            row = M(_mono("meter", TEXT) + "  " + _mono("vite_exit=0", VITE) + "  " + _mono("(0.918 s, 352 KB)"),
                    BODY)
            row.move_to([_X0, 2.35, 0], aligned_edge=LEFT)
            ok = _tick(SOLVED, 0.17).next_to(row, RIGHT, buff=0.35)
            why = T("Vite does not check types", LABEL, MUTED).next_to(ok, RIGHT, buff=0.4)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(row, shift=RIGHT * 0.1), run_time=b.t(0.3))
            self.play(Create(ok), run_time=b.t(0.15))
            _at(self, b, 0.5)
            self.play(FadeIn(why), run_time=b.t(0.25))

        with self.beat("load") as b:
            rc = chip("render check loads the page", CREATION, mono=False, size=LABEL)
            rc.move_to([_X0, 1.55, 0], aligned_edge=LEFT)
            self.play(FadeIn(rc, shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("throw") as b:
            lab = M(_mono("dw-mini-ui", KIT) + " " + _mono("2.0.0") + "  " + _mono("index.js"), LABEL, MUTED)
            lab.move_to([_X0, 0.85, 0], aligned_edge=LEFT)
            code = code_block(self.THROW, "javascript", color=KIT)
            fit(code, w=_X1 - _X0)
            code.next_to(lab, DOWN, buff=0.15).align_to(lab, LEFT)
            self.play(FadeIn(lab), FadeIn(code), run_time=b.t(0.4))

        with self.beat("caught") as b:
            err = chip("render-error", ISOLATION, size=LABEL)
            err.next_to(code, DOWN, buff=0.45).align_to(code, LEFT).shift(RIGHT * 3.2)
            by = T("OpenUI caught the throw", LABEL, TEXT).next_to(err, RIGHT, buff=0.4)
            a = _arr(code.get_bottom() + LEFT * (code.width / 2 - 1.5), err.get_left(), ISOLATION)
            self.play(GrowArrow(a), FadeIn(err), run_time=b.t(0.35))
            self.play(FadeIn(by, shift=RIGHT * 0.1), run_time=b.t(0.3))

        top = VGroup(row, ok, why, rc, lab, code, err, by, a)
        rows = [("v2a", "0/3", "0/3", "0/3"), ("v2b", "1/3 (TS2322)", "0/3", "1/3 (render-error)")]
        tbl = RevealTable(["kit", "type broke", "build broke", "render broke"], rows, mono_cols=[0, 1, 2, 3],
                          size=BODY, row_gap=0.3, col_gap=0.9,
                          cell_colors={(0, 0): KIT, (1, 0): KIT, (1, 1): ISOLATION, (1, 3): ISOLATION})
        name = T("kit_spike.pin", LABEL, PIN, mono=True)
        name.move_to([_X0, 1.4, 0], aligned_edge=LEFT)
        tbl.next_to(name, DOWN, buff=0.4).align_to(name, LEFT)
        with self.beat("says") as b:
            self.play(FadeOut(top), run_time=b.t(0.3))
            self.add(tbl)
            self.play(FadeIn(name), FadeIn(tbl.header), run_time=b.t(0.4))

        with self.beat("minor") as b:
            self.play(tbl.reveal_row(0), run_time=b.t(0.4))
            nm = T("minor version: nothing broke", LABEL, SOLVED)
            nm.next_to(tbl, DOWN, buff=0.5).align_to(tbl, LEFT)
            self.play(FadeIn(nm, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("changed") as b:
            self.play(tbl.reveal_row(1), run_time=b.t(0.35))
            ch = T("changed library: one widget of three broke", LABEL, ISOLATION)
            ch.next_to(nm, DOWN, buff=0.2).align_to(nm, LEFT)
            self.play(FadeIn(ch, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("both") as b:
            f1 = SurroundingRectangle(tbl.cell(1, 1), color=CREATION, buff=0.1, stroke_width=3, corner_radius=0.06)
            f2 = SurroundingRectangle(tbl.cell(1, 3), color=CREATION, buff=0.1, stroke_width=3, corner_radius=0.06)
            both = T("type gate and render check both caught it", LABEL, CREATION)
            both.next_to(ch, DOWN, buff=0.2).align_to(ch, LEFT)
            self.play(Create(f1), Create(f2), run_time=b.t(0.35))
            self.play(FadeIn(both, shift=UP * 0.1), run_time=b.t(0.3))


# ====================================================================== shared_chunks_swap
class SharedChunksSwap(DWScene):
    # beat starts (s): address 2.97, swap 6.62, broke 12.21, fix 15.53, size 20.1
    BEATS = [("case", 2.97), ("address", 3.65), ("swap", 5.59), ("broke", 3.32), ("fix", 4.57), ("size", 3.54)]

    def construct(self):
        with self.beat("case") as b:
            title = scene_title("Shared chunks: the runtime swapped in place", KIT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.35))

        y = 1.55
        with self.beat("address") as b:
            page = window_card("meter", w=3.0, h=1.6, color=SHELL)
            page.move_to([_X0 + 1.5, y, 0])
            body_y = (page.title.get_bottom()[1] - 0.15 + page.frame.get_bottom()[1]) / 2
            built = T("built on v1", LABEL, MUTED).move_to([page.get_x(), body_y, 0])
            fld = _folder(KIT, w=1.0, h=0.75)
            rt = VGroup(fld, T("runtime folder", LABEL, KIT)).arrange(DOWN, buff=0.15)
            rt.move_to([_X1 - 1.7, 0, 0])
            rt.shift(UP * (y - fld.get_y()))
            ver = chip("v1", KIT, size=LABEL).next_to(rt, DOWN, buff=0.2)
            a = _arr([page.get_right()[0], y, 0], [fld.get_left()[0] - 0.1, y, 0], KIT)
            imp = T("/kit/v1/dw-mini-ui.js", LABEL, TEXT, mono=True).next_to(a, UP, buff=0.12)
            self.play(FadeIn(page), FadeIn(built), run_time=b.t(0.25))
            self.play(GrowArrow(a), FadeIn(imp), FadeIn(rt), FadeIn(ver), run_time=b.t(0.35))

        with self.beat("swap") as b:
            new = chip("v2b content", ISOLATION, size=LABEL).move_to(ver)
            inplace = T("changed in place", LABEL, ISOLATION).next_to(new, DOWN, buff=0.18)
            self.play(Indicate(fld, color=ISOLATION), run_time=b.t(0.2))
            _at(self, b, 0.4)
            self.play(Transform(ver, new), FadeIn(inplace), run_time=b.t(0.35))

        with self.beat("broke") as b:
            err = chip("render-error", ISOLATION, size=LABEL).next_to(page, DOWN, buff=0.2)
            self.play(page.animate.set_stroke(ISOLATION), FadeIn(err, shift=UP * 0.1), run_time=b.t(0.4))

        top = VGroup(page, built, rt, ver, a, imp, inplace, err)
        names = ("kit-v1/", "kit-v2a/", "kit-v2b/")
        folders = VGroup()
        for n in names:
            f = _folder(KIT, w=0.9, h=0.65)
            t = T(n, LABEL, KIT, mono=True)
            folders.add(VGroup(f, t).arrange(DOWN, buff=0.15))
        folders.arrange(RIGHT, buff=1.6).move_to([0.6, -1.8, 0])
        fix = T("fix: one runtime folder for each kit version", LABEL, TEXT)
        fix.move_to([_X0, -0.95, 0], aligned_edge=LEFT)
        with self.beat("fix") as b:
            self.play(top.animate.set_opacity(0.45), FadeIn(fix), run_time=b.t(0.25))
            self.play(LaggedStart(*[FadeIn(f, shift=UP * 0.1) for f in folders], lag_ratio=0.3), run_time=b.t(0.45))

        with self.beat("size") as b:
            sizes = VGroup(*[T("2.1 MB", LABEL, TEXT, mono=True).next_to(f, DOWN, buff=0.15) for f in folders])
            self.play(LaggedStart(*[FadeIn(s) for s in sizes], lag_ratio=0.25), run_time=b.t(0.4))


# ====================================================================== pin_policy
class PinPolicy(DWScene):
    # beat starts (s): infer 2.65, pin 5.39, own 8.84, safe 14.57, shared 16.64, request 21.36, gates 24.11,
    # keep 27.85, force 31.53, flag 36.75, never 41.54
    BEATS = [("card", 2.65), ("infer", 2.74), ("pin", 3.45), ("own", 5.73), ("safe", 2.07), ("shared", 4.72),
             ("request", 2.75), ("gates", 3.74), ("keep", 3.68), ("force", 5.22), ("flag", 4.79), ("never", 5.06)]

    def construct(self):
        title = scene_title("The policy that the data supports", PIN)
        inf = T("(inferred)", HEADING, INFERRED).next_to(title, RIGHT, buff=0.3)
        tag = chip("not a decision", INFERRED, mono=False, size=LABEL)
        tag.move_to([_X1 - tag.width / 2, TITLE_Y, 0])
        with self.beat("card") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.35))
        with self.beat("infer") as b:
            self.play(FadeIn(inf), run_time=b.t(0.25))
            _at(self, b, 0.5)
            self.play(FadeIn(tag, shift=LEFT * 0.1), run_time=b.t(0.25))

        x_main = _X0 + 0.45
        x_sub = x_main + 0.35
        ys = (2.35, 1.0, -0.35, -1.7)

        def main(text, y):
            bar = Rectangle(width=0.1, height=0.42, stroke_width=0, fill_color=PIN, fill_opacity=1)
            t = T(text, BODY, TEXT, bold=True)
            bar.move_to([_X0 + 0.1, y, 0])
            t.move_to([x_main, y, 0], aligned_edge=LEFT)
            return VGroup(bar, t)

        def sub(markup, y):
            return M(markup, LABEL, MUTED).move_to([x_sub, y - 0.5, 0], aligned_edge=LEFT)

        with self.beat("pin") as b:
            l1 = main("pin to kit version by default", ys[0])
            self.play(FadeIn(l1, shift=RIGHT * 0.1), run_time=b.t(0.35))
        with self.beat("own") as b:
            s1a = sub('(<span fgcolor="%s">fresh install</span>, <span fgcolor="%s">kit lockfile</span>;' % (PNPM, PNPM), ys[0])
            self.play(FadeIn(s1a), run_time=b.t(0.3))
        with self.beat("safe") as b:
            self.play(Indicate(l1[1], color=PIN, scale_factor=1.03), run_time=b.t(0.4))
        with self.beat("shared") as b:
            s1b = M('<span fgcolor="%s">shared chunks</span> needs its runtime folder)' % KIT, LABEL, MUTED)
            s1b.next_to(s1a, RIGHT, buff=0.15).align_to(s1a, DOWN)
            self.play(FadeIn(s1b), run_time=b.t(0.3))

        with self.beat("request") as b:
            l2 = main("rebuild on request", ys[1])
            self.play(FadeIn(l2, shift=RIGHT * 0.1), run_time=b.t(0.4))
        with self.beat("gates") as b:
            g2 = M(': <span fgcolor="%s">type gate</span> + <span fgcolor="%s">build</span> + '
                   '<span fgcolor="%s">render check</span>' % (CREATION, VITE, CREATION), BODY, TEXT)
            g2.next_to(l2[1], RIGHT, buff=0.03).align_to(l2[1], DOWN)
            self.play(FadeIn(g2, shift=RIGHT * 0.1), run_time=b.t(0.35))
        with self.beat("keep") as b:
            s2 = sub("fail keeps old page and old lockfile", ys[1])
            self.play(FadeIn(s2), run_time=b.t(0.35))

        with self.beat("force") as b:
            l3 = main("forced rebuild only for a security fix in a patch or minor version", ys[2])
            self.play(FadeIn(l3, shift=RIGHT * 0.1), run_time=b.t(0.3))
        with self.beat("flag") as b:
            s3 = sub("fail keeps old page and flags the widget", ys[2])
            self.play(FadeIn(s3), run_time=b.t(0.35))

        with self.beat("never") as b:
            l4 = main("never auto-rebuild across a major version or a changed library", ys[3])
            l4[0].set_fill(ISOLATION)
            self.play(FadeIn(l4, shift=RIGHT * 0.1), run_time=b.t(0.35))


# ====================================================================== pin_work
class PinWork(DWScene):
    # beat starts (s): check 4.38, path 7.9, size 9.7; close starts at 13.4, on "an estimate"
    BEATS = [("records", 4.38), ("check", 3.52), ("path", 1.8), ("size", 3.7), ("close", 2.0)]

    def construct(self):
        outline = OutlineDiagram()
        lx, vx = _X0 + 0.3, _X0 + 2.6

        def label(t, y):
            return T(t, LABEL, MUTED, bold=True).move_to([lx, y, 0], aligned_edge=LEFT)

        def val(m, y):
            return m.move_to([vx, y, 0], aligned_edge=LEFT)

        with self.beat("records") as b:
            title = scene_title("What the pin front records and checks", PIN)
            card = rbox(_X1 - _X0, 3.0, PIN, fill=0.05)
            card.move_to([(_X0 + _X1) / 2, 1.2, 0])
            r_l = label("Records", 2.25)
            r_v = VGroup(T("kitVersion", LABEL, KIT, mono=True), T("lockfile hash", LABEL, PNPM, mono=True),
                         T("per build", LABEL, MUTED))
            r_v = val(r_v.arrange(RIGHT, buff=0.5), 2.25)
            self.play(FadeIn(title, shift=RIGHT * 0.2), Create(card), FadeIn(r_l), run_time=b.t(0.3))
            self.play(LaggedStart(*[FadeIn(m, shift=RIGHT * 0.1) for m in r_v], lag_ratio=0.35), run_time=b.t(0.4))

        with self.beat("check") as b:
            c_l = label("Check", 1.25)
            c_v = val(M("in-use before " + _mono("kit_remove", MCP), LABEL), 1.25)
            self.play(FadeIn(c_l), FadeIn(c_v, shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("path") as b:
            p_l = label("Path", 0.25)
            p_v = val(T("rebuild", LABEL, PIN, mono=True), 0.25)
            self.play(FadeIn(p_l), FadeIn(p_v, shift=RIGHT * 0.1), run_time=b.t(0.45))

        with self.beat("size") as b:
            sz = chip("kit versions and pins: M (estimate)", INFERRED, mono=False, size=LABEL)
            sz.next_to(card, DOWN, buff=0.35).align_to(card, LEFT)
            self.play(FadeIn(sz, shift=UP * 0.1), run_time=b.t(0.35))

        with self.beat("close") as b:
            outline.close_part(self, "pin", next_key="describe", run_time=b.left)
