"""Part `part_serving`: serving_today serving_slug serving_rebuild serving_csp.
How Electron main serves a page per slug with the kit, and what stays the same (CSP).

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


def _tick(color=SOLVED, s=0.18):
    return VMobject(stroke_color=color, stroke_width=6).set_points_as_corners(
        [[-s, 0, 0], [-s * 0.3, -s * 0.7, 0], [s, s * 0.8, 0]])


def _cross(color=ISOLATION, s=0.16):
    return VGroup(Line([-s, -s, 0], [s, s, 0], stroke_color=color, stroke_width=6),
                  Line([-s, s, 0], [s, -s, 0], stroke_color=color, stroke_width=6))


def _mono(s, color=None):
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    c = f' fgcolor="{color}"' if color else ""
    return f'<span font_family="{MONO}"{c}>{s}</span>'


def _folder(color=VITE, w=0.6, h=0.44, dashed=False):
    """A folder icon: tab and body."""
    tab = Polygon([0, 0, 0], [w * 0.38, 0, 0], [w * 0.46, h * 0.18, 0], [0, h * 0.18, 0],
                  stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.35)
    body = Rectangle(width=w, height=h, stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.15)
    body.next_to(tab, DOWN, buff=0).align_to(tab, LEFT)
    if dashed:
        body = DashedVMobject(body, num_dashes=18, dashed_ratio=0.55).set_stroke(color, 2.5)
    return VGroup(tab, body)


def _src(text, color=MUTED):
    """A small file-name label above a code card."""
    return T(text, SMALL, color, mono=True)


# ====================================================================== serving_today
class ServingToday(DWScene):
    # beat starts (s): serves 3.25, url 8.3
    BEATS = [("open", 3.25), ("serves", 5.05), ("url", 4.02)]

    ROOT = "const shellRoot = join(resources.dsh,\n  'node_modules', '@deepwidgets', 'shell', 'dist')"

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "electron_main", also=("pinned_pages",), arrows=("arrow_pinned_em",),
                                       run_time=b.left)

        src = _src("apps/desktop/src/main.ts")
        src.move_to([_X0, 2.45, 0], aligned_edge=LEFT)
        root = code_block(self.ROOT, "typescript", color=SERVING, size=26)
        root.next_to(src, DOWN, buff=0.15).align_to(src, LEFT)
        y_s = [-0.8, -1.45, -2.1]
        slugs = VGroup(*[chip(s, SHELL, size=LABEL) for s in ("meter", "shadcn", "clock")])
        for c, y in zip(slugs, y_s):
            c.move_to([_X0 + 0.9, y, 0])
        fld = _folder(SHELL, w=0.9, h=0.68)
        fld_t = T("shell/dist", LABEL, SHELL, mono=True)
        dst = VGroup(fld, fld_t).arrange(DOWN, buff=0.15).move_to([1.6, y_s[1], 0])
        arrows = VGroup(*[_arr(c.get_right(), fld.get_left() + LEFT * 0.1, SERVING, buff=0.12) for c in slugs])
        one = T("one shell, one folder", LABEL, SERVING).next_to(dst, RIGHT, buff=0.7)
        with self.beat("serves") as b:
            title = scene_title("Today: one shell for every slug", SERVING)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(src), FadeIn(root), run_time=b.t(0.3))
            self.play(LaggedStart(*[FadeIn(c, shift=RIGHT * 0.1) for c in slugs], lag_ratio=0.3),
                      run_time=b.t(0.2))
            self.play(LaggedStart(*[GrowArrow(a) for a in arrows], lag_ratio=0.25), FadeIn(dst), run_time=b.t(0.25))
            self.play(FadeIn(one), run_time=b.t(0.15))

        with self.beat("url") as b:
            lab = T("window URL", SMALL, MUTED)
            url = M(_mono("`${SCHEME}://app") + _mono("/widget/", SERVING) + _mono("?slug=<slug>", SHELL) + _mono("`"), BODY)
            row = VGroup(lab, url).arrange(RIGHT, buff=0.35)
            row.move_to([_X0, 0.5, 0], aligned_edge=LEFT)
            self.play(FadeIn(row, shift=RIGHT * 0.1), run_time=b.t(0.3))
            q = url[-13:-1]
            box = SurroundingRectangle(q, color=SHELL, buff=0.07, stroke_width=2.5, corner_radius=0.05)
            qs = T("slug in the query string", LABEL, SHELL).next_to(box, DOWN, buff=0.15).align_to(box, RIGHT)
            self.play(Create(box), FadeIn(qs), run_time=b.t(0.3))


# ====================================================================== serving_slug
class ServingSlug(DWScene):
    # beat starts (s): base 3.3, map 8.3, window 12.5, infer 15.3
    BEATS = [("kit", 3.3), ("base", 5.0), ("map", 4.2), ("window", 2.8), ("infer", 3.54)]

    BASE = "base: `/widget/${slug}/`,"

    def construct(self):
        with self.beat("kit") as b:
            title = scene_title("With the kit: a build folder per slug", SERVING)
            items = VGroup()
            for s in ("meter", "shadcn", "clock"):
                items.add(VGroup(_folder(VITE), T(s, LABEL, TEXT, mono=True)).arrange(RIGHT, buff=0.2))
            items.arrange(RIGHT, buff=0.8).move_to([_X0, 2.3, 0], aligned_edge=LEFT)
            each = T("one build folder for each slug", LABEL, VITE).next_to(items, RIGHT, buff=0.7)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))
            self.play(LaggedStart(*[FadeIn(i, shift=UP * 0.1) for i in items], lag_ratio=0.3), FadeIn(each),
                      run_time=b.t(0.45))

        src = _src("spike vite.config.ts")
        src.move_to([_X0, 1.35, 0], aligned_edge=LEFT)
        base = code_block(self.BASE, "typescript", color=VITE, size=26)
        base.next_to(src, DOWN, buff=0.15).align_to(src, LEFT)
        with self.beat("base") as b:
            self.play(FadeIn(src), FadeIn(base, shift=RIGHT * 0.1), run_time=b.t(0.35))

        y = -0.3
        req = M(_mono("dsh-app://app") + _mono("/widget/meter/", SERVING), LABEL)
        req.move_to([_X0, y, 0], aligned_edge=LEFT)
        dst = M(_mono("<build folder of meter>", VITE) + _mono("/index.html"), LABEL)
        dst.move_to([_X1, y, 0], aligned_edge=RIGHT)
        a = _arr(req.get_right(), dst.get_left(), SERVING, buff=0.2)
        em = T("Electron main maps it", SMALL, SERVING).next_to(a, DOWN, buff=0.12)
        with self.beat("map") as b:
            self.play(FadeIn(req, shift=RIGHT * 0.1), run_time=b.t(0.25))
            self.play(GrowArrow(a), FadeIn(em), run_time=b.t(0.25))
            self.play(FadeIn(dst, shift=RIGHT * 0.1), run_time=b.t(0.25))

        with self.beat("window") as b:
            win = chip("window code opens that address", SHELL, mono=False, size=LABEL)
            win.next_to(req, DOWN, buff=0.45).align_to(req, LEFT).shift(RIGHT * 0.3)
            up = _arr(win.get_top(), [win.get_x(), req.get_bottom()[1], 0], SHELL, buff=0.06, sw=2.5, tip=0.14)
            self.play(FadeIn(win, shift=UP * 0.1), GrowArrow(up), run_time=b.t(0.5))

        with self.beat("infer") as b:
            inf = chip("Electron main and window URL changes (inferred)", INFERRED, mono=False, size=LABEL)
            inf.move_to([_X0, -1.95, 0], aligned_edge=LEFT)
            frm = T("from the spike config and the current code", SMALL, MUTED).next_to(inf, DOWN, buff=0.15).align_to(inf, LEFT)
            self.play(FadeIn(inf, shift=UP * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(frm), run_time=b.t(0.2))


# ====================================================================== serving_rebuild
class ServingRebuild(DWScene):
    # beat starts (s): stays 3.3, swap 6.9, fail 11.5, cleanup 14.9, infer 18.1
    BEATS = [("write", 3.3), ("stays", 3.6), ("swap", 4.6), ("fail", 3.4), ("cleanup", 3.2), ("infer", 4.06)]

    def construct(self):
        x_name = _X0 + 0.85

        def folder_row(name, state, color, y, dashed=False):
            f = _folder(VITE, dashed=dashed).move_to([_X0 + 0.3, y, 0])
            t = T(name, LABEL, TEXT, mono=True).move_to([x_name, y - 0.05, 0], aligned_edge=LEFT)
            c = chip(state, color, mono=False, size=SMALL, dashed=dashed)
            c.move_to([x_name + 4.35, y - 0.05, 0], aligned_edge=LEFT)
            return VGroup(f, t, c)

        live = folder_row("widget/meter/", "live, v1", SOLVED, 2.25)
        nxt = folder_row("widget/meter.next/", "building, v2b", KIT, 1.35, dashed=True)
        illus = T("folder names illustrative", SMALL, MUTED).move_to([_X1, 2.25, 0], aligned_edge=RIGHT)

        with self.beat("write") as b:
            title = scene_title("A rebuild writes a new folder", SERVING)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(live), FadeIn(illus), run_time=b.t(0.35))
            self.play(FadeIn(nxt, shift=DOWN * 0.1), run_time=b.t(0.35))

        gates = VGroup(*[chip(g, CREATION, mono=False, size=SMALL) for g in ("type gate", "build", "render check")])
        gates.arrange(RIGHT, buff=0.3).move_to([_X0, 0.35, 0], aligned_edge=LEFT)
        g_arr = _arr(nxt[0].get_bottom(), [nxt[0].get_x(), gates.get_top()[1], 0], CREATION, buff=0.08, sw=2.5,
                     tip=0.14)
        with self.beat("stays") as b:
            self.play(Indicate(live[2], color=SOLVED, scale_factor=1.1), run_time=b.t(0.3))
            self.play(GrowArrow(g_arr), LaggedStart(*[FadeIn(g) for g in gates], lag_ratio=0.3), run_time=b.t(0.4))

        x_out = gates.get_right()[0] + 0.55
        y_pass, y_fail = -0.3, -1.25

        def outcome(head, head_color, mark, steps, y):
            h = M(head, LABEL, head_color)
            mk = mark.move_to([_X0 + 0.2, y, 0])
            h.next_to(mk, RIGHT, buff=0.25)
            h.set_y(y)
            rest = M(steps, LABEL, TEXT).next_to(h, DOWN, buff=0.18).align_to(h, LEFT)
            return VGroup(mk, h, rest)

        with self.beat("swap") as b:
            ok = outcome("all gates pass:", SOLVED, _tick(SOLVED),
                         "swap folders  >  window loads the " + '<span fgcolor="%s">v2b page</span>' % KIT, y_pass)
            self.play(FadeIn(ok[0]), FadeIn(ok[1]), run_time=b.t(0.25))
            self.play(FadeIn(ok[2], shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("fail") as b:
            bad = outcome("gate fails " + _mono("(v2b meter TS2322)") + ":", ISOLATION, _cross(ISOLATION),
                          _mono("meter.next/") + " deleted  >  window keeps the "
                          + '<span fgcolor="%s">v1 page</span>' % SOLVED, y_fail)
            self.play(FadeIn(bad[0]), FadeIn(bad[1]), run_time=b.t(0.25))
            strike = Line(nxt[1].get_left() + LEFT * 0.05, nxt[1].get_right() + RIGHT * 0.05,
                          stroke_color=ISOLATION, stroke_width=4)
            self.play(FadeIn(bad[2], shift=RIGHT * 0.1), Create(strike), run_time=b.t(0.35))

        with self.beat("cleanup") as b:
            binc = chip("builds of removed widgets: cleanup", OPEN, mono=False, size=LABEL, dashed=True)
            binc.move_to([_X0, -2.45, 0], aligned_edge=LEFT)
            self.play(FadeIn(binc, shift=UP * 0.1), run_time=b.t(0.35))

        with self.beat("infer") as b:
            tag = chip("inferred from pin policy and spike config", INFERRED, mono=False, size=LABEL)
            tag.next_to(binc, RIGHT, buff=0.4)
            self.play(FadeIn(tag, shift=LEFT * 0.1), run_time=b.t(0.3))


# ====================================================================== serving_csp
class ServingCsp(DWScene):
    # beat starts (s): self 2.9, infer 5.7, fallback 11.6, size 15.5; close starts at 17.2, on "as medium"
    BEATS = [("keeps", 2.9), ("self", 2.8), ("infer", 5.9), ("fallback", 3.9), ("size", 1.7), ("close", 2.2)]

    CSP = """\
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
connect-src 'self';
img-src 'self' data:"""

    def construct(self):
        src = _src("deepwidgets/shell/index.html  (CSP)")
        src.move_to([_X0, 2.4, 0], aligned_edge=LEFT)
        csp = code_block(self.CSP, "text", color=SERVING, size=26)
        csp.next_to(src, DOWN, buff=0.15).align_to(src, LEFT)
        with self.beat("keeps") as b:
            title = scene_title("The page keeps its CSP", SERVING)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(src), FadeIn(csp), run_time=b.t(0.45))

        x_r = csp.get_right()[0] + 0.7
        with self.beat("self") as b:
            m = mark_line(csp, 1, SERVING)
            so = T("scripts: same origin only", LABEL, SERVING)
            so.move_to([x_r, csp.code_lines[1].get_y(), 0], aligned_edge=LEFT)
            self.play(Create(m), FadeIn(so, shift=RIGHT * 0.1), run_time=b.t(0.45))

        with self.beat("infer") as b:
            s123 = chip("same origin for S1, S2, S3 (inferred)", INFERRED, mono=False, size=LABEL)
            s123.next_to(csp, DOWN, buff=0.35).align_to(csp, LEFT)
            holds = T("so the policy holds", LABEL, MUTED).next_to(s123, RIGHT, buff=0.4)
            self.play(FadeIn(s123, shift=RIGHT * 0.1), run_time=b.t(0.3))
            _at(self, b, 0.55)
            self.play(FadeIn(holds), run_time=b.t(0.25))

        with self.beat("fallback") as b:
            fb = chip("fallback page when a slug has no build", SERVING, mono=False, size=LABEL)
            fb.next_to(s123, DOWN, buff=0.3).align_to(s123, LEFT)
            self.play(FadeIn(fb, shift=UP * 0.1), run_time=b.t(0.4))

        with self.beat("size") as b:
            sz = chip("Electron main serves each slug: M (estimate)", INFERRED, mono=False, size=LABEL)
            sz.next_to(fb, DOWN, buff=0.3).align_to(fb, LEFT)
            self.play(FadeIn(sz, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("close") as b:
            OutlineDiagram().close_part(self, "electron_main", next_key="checks", run_time=b.left)
