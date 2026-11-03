"""Part `part_host`: host_today host_bundle host_external host_native host_rules host_work.
Host extras: the three ways (bundle, external, native addon) that the spike tested with date-fns.

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


def _note(text, color=INFERRED, size=LABEL, mono=False):
    """Text in a thin rounded frame of its color (amber notes, error lines)."""
    t = T(text, size, color, mono=mono)
    b = rbox(t.width + 0.45, t.height + 0.35, color, fill=0.1, sw=2, r=0.1)
    t.move_to(b)
    g = VGroup(b, t)
    g.box, g.text = b, t
    return g


def _code_chip(text, color=HOST_EXTRAS, size=LABEL, mono=True):
    """One line of code on the panel color, framed in the concept color."""
    t = T(text, size, TEXT, mono=mono)
    b = rbox(t.width + 0.45, t.height + 0.35, color, fill=0.0, sw=2, r=0.1)
    b.set_fill(PANEL, 1)
    t.move_to(b)
    return VGroup(b, t)


def _way_head(name, sub=None):
    """Scene title for one way, with the way chip."""
    title = scene_title("Host extras: " + name, HOST_EXTRAS)
    return title


# ====================================================================== host_today
class HostToday(DWScene):
    BEATS = [("open", 3.64), ("extras", 3.76), ("today", 3.1), ("test", 4.6), ("ways", 4.14)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "host_extras", also=("host",), arrows=("link_host_extras",),
                                       run_time=b.left)

        y1 = 1.75
        with self.beat("extras") as b:
            title = scene_title("Host extras: imports on the host side", HOST_EXTRAS)
            wc = ProcessBox("widget code", color=AGENT, width=2.9, height=0.95).move_to([-4.6, y1, 0])
            hh = ProcessBox("host half", "runs in the host (Node)", color=HOST, sub_mono=False,
                            height=1.15).move_to([-0.3, y1, 0])
            hh.sub.set_color(TEXT)
            ex = chip("extras", HOST_EXTRAS, size=BODY, mono=False, dashed=True).move_to([4.2, y1, 0])
            a1 = _arr(wc.get_right(), hh.get_left(), AGENT)
            a2 = labeled_arrow(ex.get_left(), hh.get_right(), "import", HOST_EXTRAS, buff=0.1)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.2))
            self.play(FadeIn(wc), GrowArrow(a1), FadeIn(hh), run_time=b.t(0.3))
            self.play(GrowArrow(a2.arrow), FadeIn(a2.label), FadeIn(ex, shift=LEFT * 0.1), run_time=b.t(0.3))

        y2 = -0.1
        with self.beat("today") as b:
            tl = T("today", LABEL, MUTED, bold=True)
            tc = _code_chip("paths: { zod }", CREATION, size=BODY)
            only = T("host half imports only zod", LABEL, TEXT)
            today = VGroup(tl, tc, only).arrange(RIGHT, buff=0.35).move_to([_X0, y2, 0], aligned_edge=LEFT)
            self.play(FadeIn(today, shift=UP * 0.1), run_time=b.t(0.4))
            self.play(Indicate(tc, color=CREATION, scale_factor=1.06), run_time=b.t(0.35))

        y3 = -1.3
        with self.beat("test") as b:
            sl = T("spike: three ways to give it more", LABEL, TEXT)
            te = T("test extra", LABEL, MUTED, bold=True)
            df = chip("date-fns", HOST_EXTRAS, size=BODY)
            row = VGroup(sl, te, df).arrange(RIGHT, buff=0.35).move_to([_X0, y3, 0], aligned_edge=LEFT)
            row[1:].shift(RIGHT * 0.5)
            self.play(FadeIn(sl, shift=UP * 0.1), run_time=b.t(0.3))
            _at(self, b, 0.55)
            self.play(FadeIn(te), FadeIn(df, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("ways") as b:
            ways = VGroup(*[chip(w, HOST_EXTRAS, size=BODY, mono=False) for w in ("bundle", "external",
                                                                                 "native addon")])
            ways.arrange(RIGHT, buff=0.6).move_to([0, -2.35, 0])
            self.play(LaggedStart(*[FadeIn(w, shift=UP * 0.12) for w in ways], lag_ratio=0.45), run_time=b.t(0.75))


# ====================================================================== host_bundle
class HostBundle(DWScene):
    BEATS = [("put", 3.2), ("numbers", 6.1), ("nochange", 2.4), ("cost", 1.75), ("copy", 3.83)]

    KB = 0.009  # units per KB of a bar

    def construct(self):
        with self.beat("put") as b:
            title = _way_head("bundle")
            way = chip("bundle", HOST_EXTRAS, size=BODY, mono=False).move_to([_X0, 2.35, 0], aligned_edge=LEFT)
            hh = ProcessBox("host half", color=HOST, width=3.6, height=1.5).move_to([3.6, 1.95, 0])
            hh.title.shift(UP * 0.3)
            df = chip("date-fns", HOST_EXTRAS, size=LABEL).move_to([0.2, 1.95, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(way), run_time=b.t(0.25))
            self.play(FadeIn(hh), FadeIn(df), run_time=b.t(0.2))
            self.play(df.animate.move_to(hh.box.get_center() + DOWN * 0.28), run_time=b.t(0.35))

        y = 0.75
        with self.beat("numbers") as b:
            cmd = _code_chip("esbuild bundle:true", HOST_EXTRAS)
            cmd.move_to([_X0, y, 0], aligned_edge=LEFT)
            out = M(f'<span font_family="{MONO}">index.js</span>  <span font_family="{MONO}">594 KB</span> in '
                    f'<span font_family="{MONO}">377 ms</span>', BODY)
            out.next_to(cmd, RIGHT, buff=1.2)
            a = _arr(cmd.get_right(), out.get_left(), HOST_EXTRAS)
            self.play(FadeIn(cmd, shift=RIGHT * 0.1), run_time=b.t(0.2))
            _at(self, b, 0.3)
            self.play(GrowArrow(a), FadeIn(out, shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("nochange") as b:
            nc = VGroup(_tick(), T("no host change", BODY, SOLVED)).arrange(RIGHT, buff=0.25)
            nc.move_to([_X0, -0.35, 0], aligned_edge=LEFT)
            self.play(FadeIn(nc, shift=UP * 0.1), run_time=b.t(0.4))

        with self.beat("cost") as b:
            bx = -0.4
            yb1, yb2 = -1.45, -2.2
            b1 = Rectangle(width=594 * self.KB, height=0.45, stroke_width=0, fill_color=HOST_EXTRAS,
                           fill_opacity=0.8).move_to([bx, yb1, 0], aligned_edge=LEFT)
            b2 = Rectangle(width=545 * self.KB, height=0.45, stroke_width=0, fill_color=MUTED,
                           fill_opacity=0.6).move_to([bx, yb2, 0], aligned_edge=LEFT)
            l1 = T("index.js", LABEL, TEXT, mono=True).next_to(b1, LEFT, buff=0.3)
            l2 = T("zod alone", LABEL, TEXT).next_to(b2, LEFT, buff=0.3)
            v1 = T("594 KB", LABEL, MEASURED, mono=True).next_to(b1, RIGHT, buff=0.2)
            v2 = T("545 KB", LABEL, MEASURED, mono=True).next_to(b2, RIGHT, buff=0.2)
            cl = T("cost: size", BODY, HOST_EXTRAS, bold=True).move_to([_X0, -1.8, 0], aligned_edge=LEFT)
            self.play(FadeIn(cl), GrowFromEdge(b1, LEFT), GrowFromEdge(b2, LEFT), FadeIn(l1), FadeIn(l2),
                      run_time=b.t(0.5))
            self.play(FadeIn(v1), FadeIn(v2), run_time=b.t(0.3))

        with self.beat("copy") as b:
            cap = caption("each host half carries its own copy, as with zod today", color=HOST_EXTRAS)
            self.play(FadeIn(cap), Indicate(df, color=HOST_EXTRAS, scale_factor=1.12), run_time=b.t(0.45))


# ====================================================================== host_external
class HostExternal(DWScene):
    BEATS = [("leave", 3.35), ("size", 2.37), ("find", 3.43), ("fail", 3.23), ("fix", 4.72), ("ties", 7.1),
             ("fallback", 8.2)]

    def construct(self):
        y0, y1, y2 = 2.3, 1.2, 0.1
        with self.beat("leave") as b:
            title = _way_head("external")
            cfg = _code_chip("external: ['date-fns', 'zod']", HOST_EXTRAS)
            cfg.move_to([_X0, y0, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(cfg, shift=RIGHT * 0.1), run_time=b.t(0.35))

        with self.beat("size") as b:
            out = M(f'<span font_family="{MONO}">index.js</span>  <span font_family="{MONO}">350 B</span> in '
                    f'<span font_family="{MONO}">16 ms</span>', BODY)
            out.next_to(cfg, RIGHT, buff=1.1)
            a = _arr(cfg.get_right(), out.get_left(), HOST_EXTRAS)
            self.play(GrowArrow(a), FadeIn(out, shift=RIGHT * 0.1), run_time=b.t(0.45))

        with self.beat("find") as b:
            node = ProcessBox("Node", color=HOST, width=1.7, height=0.75).move_to([_X0 + 0.85, y1, 0])
            imp = VGroup(T("import 'date-fns'", LABEL, TEXT, mono=True), T("at run time", LABEL, MUTED))
            imp.arrange(RIGHT, buff=0.25).next_to(node, RIGHT, buff=0.35)
            self.play(FadeIn(node), FadeIn(imp, shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("fail") as b:
            err = _note("ERR_MODULE_NOT_FOUND", ISOLATION, size=LABEL, mono=True)
            err.next_to(imp, RIGHT, buff=0.45)
            x = _cross(s=0.16).next_to(err, RIGHT, buff=0.25)
            self.play(FadeIn(err, shift=LEFT * 0.1), Create(x), run_time=b.t(0.4))

        with self.beat("fix") as b:
            fl = T("fix", LABEL, SOLVED, bold=True)
            fix = _code_chip("<bundle>/node_modules -> kit/node_modules", KIT)
            ok = _tick(s=0.16)
            frow = VGroup(fl, fix, ok).arrange(RIGHT, buff=0.35).move_to([_X0, y2, 0], aligned_edge=LEFT)
            _at(self, b, 0.2)
            self.play(FadeIn(fl), FadeIn(fix, shift=RIGHT * 0.1), run_time=b.t(0.35))
            self.play(Create(ok), run_time=b.t(0.2))

        with self.beat("ties") as b:
            n1 = _note("link ties widget to its kit")
            n1.move_to([_X0, -1.05, 0], aligned_edge=LEFT)
            n1b = T("kit change under the link changes the code that the widget runs (inferred)", SMALL,
                    INFERRED)
            n1b.next_to(n1, DOWN, buff=0.15).align_to(n1, LEFT).shift(RIGHT * 0.2)
            self.play(Indicate(fix, color=KIT, scale_factor=1.04), FadeIn(n1, shift=UP * 0.1), run_time=b.t(0.3))
            _at(self, b, 0.35)
            self.play(FadeIn(n1b, shift=UP * 0.1), run_time=b.t(0.25))

        with self.beat("fallback") as b:
            n2 = _note("fallback resolve from <profile>/node_modules (inferred, not tested)")
            n2.move_to([_X0, -2.45, 0], aligned_edge=LEFT)
            self.play(FadeIn(n2, shift=UP * 0.1), run_time=b.t(0.25))


# ====================================================================== host_native
class HostNative(DWScene):
    BEATS = [("define", 5.9), ("loader", 4.5), ("abi", 4.8), ("electron", 3.87), ("node", 3.93), ("both", 2.7),
             ("failed", 2.46)]

    def construct(self):
        with self.beat("define") as b:
            title = _way_head("native addon")
            d = M('<b>native addon</b>: a package with compiled machine code', BODY)
            f = chip("*.node", HOST_EXTRAS, size=BODY)
            row = VGroup(d, f).arrange(RIGHT, buff=0.5).move_to([_X0, 2.35, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.15))
            self.play(FadeIn(d, shift=UP * 0.1), run_time=b.t(0.3))
            _at(self, b, 0.65)
            self.play(FadeIn(f, shift=UP * 0.1), run_time=b.t(0.2))

        with self.beat("loader") as b:
            el = T("esbuild", LABEL, MUTED, bold=True)
            err = _note('No loader is configured for ".node" files', ISOLATION, size=LABEL, mono=True)
            erow = VGroup(el, err).arrange(RIGHT, buff=0.35).move_to([_X0, 1.3, 0], aligned_edge=LEFT)
            self.play(FadeIn(el), FadeIn(err, shift=RIGHT * 0.1), run_time=b.t(0.35))

        with self.beat("abi") as b:
            ad = M('<b>ABI</b>: the binary interface that a native addon must match', BODY)
            ad.move_to([_X0, 0.3, 0], aligned_edge=LEFT)
            self.play(FadeIn(ad, shift=UP * 0.1), run_time=b.t(0.35))

        ys = -1.05
        with self.beat("electron") as b:
            e = _card2("Electron 44 (Node 24.21.0)", "ABI 149", SERVING).move_to([-3.35, ys, 0])
            self.play(FadeIn(e, shift=UP * 0.1), run_time=b.t(0.4))

        with self.beat("node") as b:
            n = _card2("bundled Node 24.21.0", "ABI 137", HOST).move_to([3.35, ys, 0])
            vs = T("vs", BODY, MUTED).move_to([0, ys, 0])
            self.play(FadeIn(vs), FadeIn(n, shift=UP * 0.1), run_time=b.t(0.4))

        with self.beat("both") as b:
            ne = T("≠", HEADING, ISOLATION).move_to(vs)
            one = T("one addon cannot load in both", LABEL, ISOLATION)
            one.move_to([0, -2.25, 0])
            self.play(Transform(vs, ne), FadeIn(one, shift=UP * 0.1), run_time=b.t(0.5))

        with self.beat("failed") as b:
            x = _cross(s=0.3)
            fl = T("failed", HEADING, ISOLATION, bold=True)
            fail = VGroup(x, fl).arrange(RIGHT, buff=0.3).move_to([_X1, 1.3, 0], aligned_edge=RIGHT)
            self.play(Create(x), FadeIn(fl), run_time=b.t(0.5))


def _card2(head, value, color):
    """A box with a head line and a big mono value under it."""
    h = T(head, LABEL, TEXT, mono=True)
    v = T(value, HEADING, color, mono=True, bold=True)
    txt = VGroup(h, v).arrange(DOWN, buff=0.2)
    box = rbox(max(txt.width + 0.6, 5.2), txt.height + 0.5, color, fill=0.08)
    txt.move_to(box)
    return VGroup(box, txt)


# ====================================================================== host_rules
class HostRules(DWScene):
    BEATS = [("head", 2.4), ("bundle", 6.3), ("external", 5.75), ("native", 7.9), ("reads", 4.05), ("writes", 3.0),
             ("fail", 4.95), ("testrun", 6.0), ("infer", 4.05)]

    COLS = (("bundle", ("widget whole;", "kit change cannot break", "built host half")),
            ("external", ("small file;", "tied to kit folder")),
            ("native addon", ("needs one ABI;", "cannot serve both")))

    def construct(self):
        cw, top = 4.3, 2.55
        xs = (-4.45, 0.0, 4.45)
        cols = []
        for (name, rule), x in zip(self.COLS, xs):
            hd = chip(name, HOST_EXTRAS, size=BODY, mono=False).move_to([x, top, 0])
            rl = VGroup(*[T(r, LABEL, TEXT) for r in rule]).arrange(DOWN, buff=0.12)
            rl.next_to(hd, DOWN, buff=0.3)
            cols.append((hd, rl))
        frames = VGroup(*[rbox(cw, 2.35, HOST_EXTRAS, fill=0.04, sw=2).move_to([x, 1.75, 0]) for x in xs])

        with self.beat("head") as b:
            title = scene_title("Host extras: rule and reason", HOST_EXTRAS)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(Create(frames), LaggedStart(*[FadeIn(hd) for hd, _ in cols], lag_ratio=0.3),
                      run_time=b.t(0.5))

        for i, name in enumerate(("bundle", "external", "native")):
            with self.beat(name) as b:
                self.play(Indicate(cols[i][0], color=HOST_EXTRAS, scale_factor=1.06),
                          FadeIn(cols[i][1], shift=UP * 0.1), run_time=b.t(0.35))

        fy = -0.2
        with self.beat("reads") as b:
            gl = T("gate", LABEL, CREATION, bold=True)
            rd = _code_chip("reads host src + kit node_modules", CREATION, mono=False)
            VGroup(gl, rd).arrange(RIGHT, buff=0.3).move_to([_X0, fy, 0], aligned_edge=LEFT)
            self.play(FadeIn(gl), FadeIn(rd, shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("writes") as b:
            wr = _code_chip("writes host half per widget", HOST, mono=False)
            wr.move_to([_X1, fy, 0], aligned_edge=RIGHT)
            a = _arr(rd.get_right(), wr.get_left(), CREATION)
            self.play(GrowArrow(a), FadeIn(wr, shift=RIGHT * 0.1), run_time=b.t(0.45))

        with self.beat("fail") as b:
            fl = T("fail:", LABEL, ISOLATION, bold=True).move_to([_X0, -1.35, 0], aligned_edge=LEFT)
            f1 = _note("compile gate refuses, nothing installs", ISOLATION)
            f1.next_to(fl, RIGHT, buff=0.3)
            self.play(FadeIn(fl), FadeIn(f1, shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("testrun") as b:
            f2 = _note("test run loads host half (inferred, not run)", INFERRED)
            f2.move_to([f1.get_left()[0], -2.35, 0], aligned_edge=LEFT)
            self.play(FadeIn(f2, shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("infer") as b:
            self.play(Indicate(f2, color=INFERRED, scale_factor=1.04), run_time=b.t(0.35))


# ====================================================================== host_work
class HostWork(DWScene):
    BEATS = [("front", 3.1), ("today", 3.2), ("adds", 4.0), ("size", 2.7), ("open", 1.6), ("close", 2.0)]

    def construct(self):
        outline = OutlineDiagram()
        lx, vx = _X0 + 0.3, _X0 + 2.6

        def label(t, y):
            return T(t, LABEL, MUTED, bold=True).move_to([lx, y, 0], aligned_edge=LEFT)

        def val(m, y):
            return m.move_to([vx, y, 0], aligned_edge=LEFT)

        with self.beat("front") as b:
            title = scene_title("The gate for host extras", HOST_EXTRAS)
            card = rbox(_X1 - _X0, 2.75, HOST_EXTRAS, fill=0.05)
            card.move_to([(_X0 + _X1) / 2, 1.25, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), Create(card), run_time=b.t(0.4))

        with self.beat("today") as b:
            t_l = label("Today", 2.2)
            t_v = val(_code_chip("paths: { zod }", CREATION), 2.2)
            self.play(FadeIn(t_l), FadeIn(t_v, shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("adds") as b:
            w_l = label("Work", 1.15)
            w1 = val(T("extend paths map beyond zod", LABEL, TEXT), 1.15)
            w2 = val(T("update guide rule 'Only zod ... can be imported'", LABEL, TEXT, mono=True), 0.35)
            self.play(FadeIn(w_l), FadeIn(w1, shift=RIGHT * 0.1), run_time=b.t(0.3))
            _at(self, b, 0.45)
            self.play(FadeIn(w2, shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("size") as b:
            sz = chip("gate for host extras: M (estimate)", INFERRED, mono=False, size=LABEL)
            sz.next_to(card, DOWN, buff=0.35).align_to(card, LEFT)
            self.play(FadeIn(sz, shift=UP * 0.1), run_time=b.t(0.4))

        with self.beat("open") as b:
            nd = status_chip("which way: not decided", solved=False)
            nd.next_to(sz, RIGHT, buff=0.4)
            self.play(FadeIn(nd, shift=UP * 0.1), run_time=b.t(0.5))

        with self.beat("close") as b:
            outline.close_part(self, "host_extras", next_key="pin", run_time=b.left - 0.07)  # one frame of slack
