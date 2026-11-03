"""Part `part_packaging`: the kit project with pnpm, and the three packaging strategies.

Scenes, in order: pnpm_terms kit_project strategy_fresh_install pnpm_strict_builds strategy_kit_lockfile
pnpm_trust_lockfile kit_lockfile_failures strategy_shared_chunks strategy_compare packaging_work.
Beat weights follow the narration word counts of each sentence group.
Log text and numbers come from the script visuals (spike record `kit_spike`, real files in ~/.deepwidgets/kit-spike).
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content
_X1 = FRAME_W / 2 - MARGIN - 0.1     # right edge of content


def _arrow(a, b, color=TEXT, buff=0.1, sw=3.5):
    return Arrow(a, b, buff=buff, color=color, stroke_width=sw, tip_length=0.2,
                 max_tip_length_to_length_ratio=0.25)


def _cross(m, color=ISOLATION, sw=5):
    return VGroup(Line(m.get_corner(UL), m.get_corner(DR), stroke_color=color, stroke_width=sw),
                  Line(m.get_corner(DL), m.get_corner(UR), stroke_color=color, stroke_width=sw))


def _panel(content, color, pad=0.25):
    """Dark log panel around content (like a code block)."""
    p = RoundedRectangle(corner_radius=0.12, width=content.width + 2 * pad, height=content.height + 2 * pad * 0.8,
                         stroke_color=color, stroke_width=2, fill_color=PANEL, fill_opacity=1)
    p.move_to(content)
    return p


def _log(rows, color=ISOLATION):
    """A real log excerpt: mono lines on a dark panel. rows: strings or VGroups. .panel .rows"""
    ms = [T(r, SMALL, TEXT, mono=True) if isinstance(r, str) else r for r in rows]
    body = VGroup(*ms).arrange(DOWN, buff=0.14, aligned_edge=LEFT)
    p = _panel(body, color)
    g = VGroup(p, body)
    g.panel, g.rows = p, ms
    return g


def _words(parts, size=SMALL, mono=True, color=TEXT, buff=0.2):
    g = VGroup(*[T(p, size, color, mono=mono) for p in parts])
    return g.arrange(RIGHT, buff=buff, aligned_edge=DOWN)


def _stat(label, value, x, y, vsize=LABEL):
    """A label (muted) above a measured value (white, mono)."""
    lab = T(label, SMALL, MUTED)
    val = T(value, vsize, MEASURED, mono=True)
    g = VGroup(lab, val).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
    return g.move_to([x, y, 0], aligned_edge=UL)


def _left(m, y, x=_X0):
    return m.move_to([x, y, 0], aligned_edge=LEFT)


# ====================================================================== pnpm_terms
class PnpmTerms(DWScene):
    BEATS = [("open", 11), ("pm", 17), ("store", 19), ("lockfile", 16), ("fetch", 13), ("install", 12),
             ("apfs", 22), ("registry", 9)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "kit_project", run_time=b.left)

        fy = 0.9
        with self.beat("pm") as b:
            title = scene_title("The kit is a pnpm project", PNPM)
            pm = M('<b>pnpm</b>: a package manager for Node', LABEL)
            _left(pm, 2.5)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(pm, shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("store") as b:
            st_box = rbox(3.6, 1.75, PNPM, fill=0.1).move_to([0.0, fy, 0])
            st_head = VGroup(disk_icon(PNPM, 0.4), T("pnpm store", BODY, PNPM, bold=True)).arrange(RIGHT, buff=0.2)
            st_sub = lines("content-addressable,", "each file once", size=SMALL, color=TEXT, align=ORIGIN, buff=0.08)
            VGroup(st_head, st_sub).arrange(DOWN, buff=0.18).move_to(st_box)
            store = VGroup(st_box, st_head, st_sub)
            self.play(FadeIn(store, scale=0.95), run_time=b.t(0.3))
            hash_note = T("one file per content hash", SMALL, MUTED).next_to(st_box, DOWN, buff=0.15)
            self.play(FadeIn(hash_note), run_time=b.t(0.2))

        with self.beat("lockfile") as b:
            lk_box = rbox(2.9, 1.75, PNPM, fill=0.06).move_to([-5.3, fy, 0])
            lk_t = VGroup(T("pnpm-lock.yaml", LABEL, PNPM, mono=True),
                          lines("exact versions,", "also transitive", size=SMALL, align=ORIGIN, buff=0.08))
            lk_t.arrange(DOWN, buff=0.18).move_to(lk_box)
            lock = VGroup(lk_box, lk_t)
            self.play(FadeIn(lock, shift=RIGHT * 0.2), run_time=b.t(0.35))
            self.play(Indicate(lk_t[1], color=PNPM, scale_factor=1.05), run_time=b.t(0.3))

        with self.beat("fetch") as b:
            a_f = labeled_arrow(lk_box.get_right(), st_box.get_left(), "pnpm fetch", PNPM)
            c_f = chip("pnpm fetch", PNPM)
            n_f = T("lockfile only, fills the store", SMALL, MUTED)
            r_f = VGroup(c_f, n_f).arrange(RIGHT, buff=0.3)
            _left(r_f, -1.2)
            self.play(GrowArrow(a_f.arrow), FadeIn(a_f.label), run_time=b.t(0.4))
            self.play(FadeIn(r_f, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("install") as b:
            nms = []
            for y, n in ((1.75, "widget A"), (0.05, "widget B")):
                p = ProcessBox(n, "node_modules", color=PNPM, width=3.0, height=1.1)
                p.move_to([5.2, y, 0])
                nms.append(p)
            arrs = [_arrow(st_box.get_right(), p.box.get_left(), PNPM, buff=0.08) for p in nms]
            c_i = chip("pnpm install --offline --frozen-lockfile", PNPM)
            n_i = T("no network", SMALL, MUTED)
            r_i = VGroup(c_i, n_i).arrange(RIGHT, buff=0.3)
            _left(r_i, -1.85)
            self.play(LaggedStart(*[FadeIn(p) for p in nms], lag_ratio=0.3), *[GrowArrow(a) for a in arrs],
                      run_time=b.t(0.45))
            self.play(FadeIn(r_i, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("apfs") as b:
            lab = lines("hard link /", "APFS clone", size=SMALL, color=PNPM, mono=True, align=ORIGIN, buff=0.08)
            lab.move_to([2.65, 2.05, 0])
            self.play(FadeIn(lab), *[Indicate(a, color=TEXT) for a in arrs], run_time=b.t(0.3))
            cap = caption("APFS clone: shares the disk blocks until a file changes")
            self.play(FadeIn(cap), run_time=b.t(0.2))

        with self.beat("registry") as b:
            reg = chip("registry = registry.npmjs.org", PNPM)
            _left(reg, -2.5)
            self.play(FadeIn(reg, shift=UP * 0.1), run_time=b.t(0.4))


# ====================================================================== kit_project
class KitProject(DWScene):
    BEATS = [("card", 10), ("core", 12), ("extras", 16), ("exact", 4), ("resolve", 17), ("fetch", 9),
             ("store", 8), ("meta", 8), ("footer", 25)]

    CORE = ["react 18.3.1, react-dom 18.3.1,", "@openuidev/react-lang 1.0.1,", "@openuidev/lang-core 1.0.1,",
            "zod 4.4.3, vite 6.4.3,", "@vitejs/plugin-react 4.7.0,", "tailwindcss 4.3.3,",
            "@tailwindcss/vite 4.3.3,", "typescript 6.0.3, esbuild 0.28.2,", "@types/*"]
    EXTRAS = ["date-fns 4.0.0,", "dw-mini-ui file:...tgz,", "@radix-ui/* x4,", "class-variance-authority,",
              "clsx,", "lucide-react 0.575.0,", "recharts 3.10.1"]

    def construct(self):
        with self.beat("card") as b:
            title = scene_title("The spike kit: kit/v1", KIT)
            card = rbox(_X1 - _X0 + 0.3, 5.3, KIT, fill=0.05).move_to([(_X0 + _X1) / 2, 0.25, 0])
            head = VGroup(T("kit/v1/package.json", LABEL, KIT, mono=True), T("24 dependencies", LABEL, TEXT))
            head.arrange(RIGHT, buff=0.4)
            head.move_to(card.get_corner(UL) + RIGHT * 0.3 + DOWN * 0.4, aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), Create(card), run_time=b.t(0.4))
            self.play(FadeIn(head), run_time=b.t(0.3))

        pitch, y0 = 0.37, 1.45
        with self.beat("core") as b:
            ch = T("core", LABEL, KIT, bold=True).move_to([-6.3, 1.95, 0], aligned_edge=LEFT)
            core = VGroup(*[T(s, SMALL, TEXT, mono=True).move_to([-6.3, y0 - i * pitch, 0], aligned_edge=LEFT)
                            for i, s in enumerate(self.CORE)])
            self.play(FadeIn(ch), LaggedStart(*[FadeIn(c, shift=RIGHT * 0.1) for c in core], lag_ratio=0.2),
                      run_time=b.t(0.85))

        with self.beat("extras") as b:
            xh = T("extras", LABEL, KIT, bold=True).move_to([0.8, 1.95, 0], aligned_edge=LEFT)
            extras = VGroup(*[T(s, SMALL, TEXT, mono=True).move_to([0.8, y0 - i * pitch, 0], aligned_edge=LEFT)
                              for i, s in enumerate(self.EXTRAS)])
            self.play(FadeIn(xh), LaggedStart(*[FadeIn(c, shift=RIGHT * 0.1) for c in extras], lag_ratio=0.2),
                      run_time=b.t(0.8))

        with self.beat("exact") as b:
            ex = chip("all versions exact", KIT, mono=False, size=LABEL).move_to([3.0, -1.7, 0])
            self.play(FadeIn(ex, scale=0.9), run_time=b.t(0.6))

        k = 5.6 / 219
        bx = -0.6
        rows = [("resolve", "first resolve of kit v1", "6.9 s", 35, "35 MB net", 1.45),
                ("fetch", "fetch", "5.0 s", 38, "38 MB net", 0.6),
                ("store", "store", None, 219, "219 MB", -0.25),
                ("meta", "metadata cache", None, 113, "113 MB", -1.1)]
        for i, (beat, lab, val, mb, mb_lab, y) in enumerate(rows):
            with self.beat(beat) as b:
                f = 0.7 if i == 0 else 1.0
                if i == 0:
                    self.play(FadeOut(VGroup(card, head, ch, core, xh, extras, ex)), run_time=b.t(0.12))
                    summ = chip("kit/v1/package.json: 24 dependencies, exact", KIT)
                    _left(summ, 2.45)
                    self.play(FadeIn(summ), run_time=b.t(0.12))
                l_m = _left(T(lab, LABEL, TEXT), y)
                parts = [FadeIn(l_m, shift=RIGHT * 0.1)]
                if val:
                    v_m = T(val, BODY, MEASURED, mono=True).move_to([-2.2, y, 0], aligned_edge=LEFT)
                    parts.append(FadeIn(v_m))
                bar = Rectangle(width=mb * k, height=0.36, stroke_width=0, fill_color=PNPM, fill_opacity=0.8)
                bar.move_to([bx, y, 0], aligned_edge=LEFT)
                b_l = T(mb_lab, LABEL, MEASURED, mono=True).next_to(bar, RIGHT, buff=0.15)
                self.play(*parts, run_time=b.t(0.3 * f))
                self.play(GrowFromEdge(bar, LEFT), FadeIn(b_l), run_time=b.t(0.4 * f))

        with self.beat("footer") as b:
            note = T("all runs used the pnpm and the Node that ship in the app", SMALL, MUTED)
            _left(note, -1.85)
            ft = chip("pnpm 11.28.5, Node 24.21.0 (bundled runtime)", PNPM, size=LABEL)
            _left(ft, -2.45)
            self.play(FadeIn(note), run_time=b.t(0.2))
            self.play(FadeIn(ft, shift=UP * 0.1), run_time=b.t(0.2))


# ====================================================================== strategy_fresh_install
def _strategy_chips():
    cs = [chip(s, PNPM, mono=False, size=LABEL) for s in ("S1: fresh install", "S2: kit lockfile",
                                                         "S3: shared chunks")]
    return VGroup(*cs).arrange(RIGHT, buff=0.5).move_to([0, 2.35, 0])


class StrategyFreshInstall(DWScene):
    BEATS = [("three", 16), ("s1", 14), ("cold", 13), ("warm", 5), ("add", 15), ("drift", 17), ("down", 14)]

    def construct(self):
        with self.beat("three") as b:
            title = scene_title("Three packaging strategies", PNPM)
            sc = _strategy_chips()
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.1) for c in sc], lag_ratio=0.4), run_time=b.t(0.5))

        with self.beat("s1") as b:
            self.play(sc[1].animate.set_opacity(DIM), sc[2].animate.set_opacity(DIM),
                      Indicate(sc[0], color=PNPM, scale_factor=1.06), run_time=b.t(0.3))
            reg = ProcessBox("registry", "registry.npmjs.org", color=PNPM).move_to([-3.45, 1.0, 0])
            wa = ProcessBox("widget A", "pnpm install", color=PNPM).move_to([-5.3, -0.75, 0])
            wb = ProcessBox("widget B", "pnpm install", color=PNPM).move_to([-1.6, -0.75, 0])
            arrs = [_arrow(reg.box.get_bottom(), w.box.get_top(), PNPM) for w in (wa, wb)]
            self.play(FadeIn(reg), run_time=b.t(0.2))
            self.play(FadeIn(wa), FadeIn(wb), *[GrowArrow(a) for a in arrs], run_time=b.t(0.3))

        sx = 0.6
        with self.beat("cold") as b:
            s_c = _stat("cold install", "13.95 s, 74 MB net", sx, 1.65)
            self.play(FadeIn(s_c, shift=LEFT * 0.1), run_time=b.t(0.35))

        with self.beat("warm") as b:
            s_w = _stat("warm install", "3.0 to 3.1 s", sx, 0.65)
            self.play(FadeIn(s_w, shift=LEFT * 0.1), run_time=b.t(0.5))

        with self.beat("add") as b:
            s_a = _stat("add a package", "3.25 s per widget, 817 KB", sx, -0.35)
            self.play(FadeIn(s_a, shift=LEFT * 0.1), run_time=b.t(0.35))

        with self.beat("drift") as b:
            dc = chip("transitive versions resolved again per build", PNPM)
            _left(dc, -1.85)
            ne = T("≠", HEADING, ISOLATION).move_to([(wa.get_right()[0] + wb.get_left()[0]) / 2, wa.get_y(), 0])
            self.play(FadeIn(dc, shift=UP * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(ne, scale=1.3), Indicate(wa.box, color=ISOLATION), Indicate(wb.box, color=ISOLATION),
                      run_time=b.t(0.35))

        with self.beat("down") as b:
            xm = _cross(Square(0.45).next_to(reg, RIGHT, buff=0.3))
            fc = chip("registry down: ERR_PNPM_META_FETCH_FAIL after 70.5 s", ISOLATION)
            _left(fc, -2.5)
            self.play(Create(xm), reg.box.animate.set_stroke(ISOLATION), run_time=b.t(0.3))
            self.play(FadeIn(fc, shift=UP * 0.1), run_time=b.t(0.3))


# ====================================================================== pnpm_strict_builds
class PnpmStrictBuilds(DWScene):
    BEATS = [("exit", 9), ("block", 20), ("refused", 17), ("code", 9), ("fix", 11), ("allow", 16), ("warn", 16)]

    def construct(self):
        with self.beat("exit") as b:
            title = scene_title("pnpm 11 blocks build scripts", PNPM)
            s1 = chip("S1: fresh install exited with an error", ISOLATION, mono=False)
            s1.move_to([_X1, TITLE_Y, 0], aligned_edge=RIGHT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.35))
            self.play(FadeIn(s1), run_time=b.t(0.35))

        with self.beat("block") as b:
            d1 = M('<b>pnpm 11</b>: blocks the build scripts of packages by default', LABEL)
            d2 = M('<b>build script</b>: code that runs at install time', LABEL, color=MUTED)
            _left(d1, 2.6)
            _left(d2, 2.15)
            self.play(FadeIn(d1, shift=RIGHT * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(d2, shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("refused") as b:
            path = T("s1/cold1/install.log (real)", SMALL, MUTED, mono=True)
            l1 = _words(["[ERR_PNPM_IGNORED_BUILDS]", "Ignored build scripts:"], buff=0.2)
            l2 = _words(["@openuidev/lang-core@1.0.1,", "esbuild@0.25.12,"], buff=0.2)
            l3 = _words(["esbuild@0.28.2"])
            log = _log([l1, l2, l3])
            _left(path, 1.65)
            log.next_to(path, DOWN, buff=0.15).align_to(path, LEFT)
            self.play(FadeIn(path), FadeIn(log, shift=UP * 0.1), run_time=b.t(0.3))
            mk_e = VGroup(*[SurroundingRectangle(m, color=ISOLATION, buff=0.05, stroke_width=2.5, corner_radius=0.05)
                            for m in (l2[1], l3[0])])
            mk_o = SurroundingRectangle(l2[0], color=ISOLATION, buff=0.05, stroke_width=2.5, corner_radius=0.05)
            n_e = T("esbuild: build script", SMALL, MUTED)
            n_o = T("lang-core: telemetry", SMALL, MUTED)
            notes = VGroup(n_e, n_o).arrange(DOWN, buff=0.15, aligned_edge=LEFT)
            notes.next_to(log, RIGHT, buff=0.35)
            self.play(Create(mk_e), FadeIn(n_e), run_time=b.t(0.25))
            self.play(Create(mk_o), FadeIn(n_o), run_time=b.t(0.25))

        with self.beat("code") as b:
            mk_c = SurroundingRectangle(l1[0], color=ISOLATION, buff=0.05, stroke_width=2.5, corner_radius=0.05)
            self.play(FadeOut(mk_e), FadeOut(mk_o), Create(mk_c), l1[0].animate.set_color(ISOLATION),
                      run_time=b.t(0.5))

        with self.beat("fix") as b:
            fx = chip("strict-dep-builds=false (spike, verified)", SOLVED)
            _left(fx, -0.62)
            self.play(FadeIn(fx, shift=UP * 0.1), run_time=b.t(0.4))

        with self.beat("allow") as b:
            al = chip("allowBuilds (spike record only, not checked)", OPEN, dashed=True)
            _left(al, -1.22)
            self.play(FadeIn(al, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("warn") as b:
            p2 = T("s2/w1/install.log (real)", SMALL, MUTED, mono=True)
            log2 = _log(["Ignored build scripts: ... Done in 3s"], color=PNPM)
            _left(p2, -1.88)
            log2.next_to(p2, DOWN, buff=0.15).align_to(p2, LEFT)
            wo = chip("warning only", PNPM, mono=False).next_to(log2, RIGHT, buff=0.35)
            self.play(FadeIn(p2), FadeIn(log2, shift=UP * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(wo, scale=0.9), run_time=b.t(0.2))


# ====================================================================== strategy_kit_lockfile
class StrategyKitLockfile(DWScene):
    BEATS = [("flow", 16), ("offline", 9), ("nums", 26), ("link", 15), ("change", 8), ("v2", 19), ("net", 6),
             ("frozen", 16)]

    def construct(self):
        with self.beat("flow") as b:
            title = scene_title("S2: kit lockfile", PNPM)
            lk = ProcessBox("kit lockfile", "pnpm-lock.yaml", color=PNPM).move_to([-5.0, 1.95, 0])
            st = VGroup(disk_icon(PNPM, 0.4), T("store", BODY, PNPM, bold=True)).arrange(RIGHT, buff=0.2)
            st_b = rbox(st.width + 0.6, lk.height, PNPM, fill=0.1).move_to([1.0, 1.95, 0])
            st.move_to(st_b)
            store = VGroup(st_b, st)
            af = labeled_arrow(lk.box.get_right(), st_b.get_left(), "pnpm fetch", PNPM)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(lk), run_time=b.t(0.3))
            self.play(GrowArrow(af.arrow), FadeIn(af.label), run_time=b.t(0.3))
            self.play(FadeIn(store), run_time=b.t(0.25))

        ay = 0.25
        with self.beat("offline") as b:
            a_box = rbox(6.5, 1.55, PNPM, fill=0.06).move_to([-2.35, ay, 0])
            a_t = T("widget: install --offline", LABEL, PNPM, mono=True)
            a_t.move_to(a_box.get_top() + DOWN * 0.35)
            a_arr = _arrow(st_b.get_bottom(), a_box.get_top(), PNPM)
            self.play(GrowArrow(a_arr), FadeIn(a_box), FadeIn(a_t), run_time=b.t(0.6))

        with self.beat("nums") as b:
            n1 = T("2.6 to 3.3 s, 0 net", LABEL, MEASURED, mono=True)
            n2 = T("about 10 MB disk via APFS clone", LABEL, MEASURED)
            VGroup(n1, n2).arrange(DOWN, buff=0.12).next_to(a_t, DOWN, buff=0.18)
            self.play(FadeIn(n1, shift=UP * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(n2, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("link") as b:
            l_box = ProcessBox("link to kit node_modules", "0 s, 0 disk", color=PNPM, height=1.55)
            l_box.move_to([4.6, ay, 0])
            l_arr = _arrow(st_b.get_bottom(), l_box.box.get_top(), PNPM)
            self.play(GrowArrow(l_arr), FadeIn(l_box), run_time=b.t(0.5))

        with self.beat("change") as b:
            ch = M(f'<span fgcolor="{KIT}"><b>kit change</b></span>: a new kit version (measured)', LABEL)
            _left(ch, -0.9)
            self.play(FadeIn(ch, shift=RIGHT * 0.1), run_time=b.t(0.5))

        with self.beat("v2") as b:
            v2a = T("v2a: resolve 0.95 s + fetch 3.15 s + install 0.53 s", SMALL, MEASURED, mono=True)
            v2b = T("v2b: 0.92 + 2.98 + 0.58 s", SMALL, MEASURED, mono=True)
            _left(v2a, -1.4, _X0 + 0.3)
            _left(v2b, -1.85, _X0 + 0.3)
            self.play(FadeIn(v2a, shift=RIGHT * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(v2b, shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("net") as b:
            nn = T("only the change uses the network", SMALL, MUTED).next_to(v2b, RIGHT, buff=0.6)
            self.play(FadeIn(nn), run_time=b.t(0.5))

        with self.beat("frozen") as b:
            fz = chip("lockfile frozen", PNPM, mono=False)
            fn = T("every widget of one kit version gets the same versions", SMALL, TEXT)
            row = VGroup(fz, fn).arrange(RIGHT, buff=0.3)
            _left(row, -2.45)
            self.play(FadeIn(fz, scale=0.9), Indicate(lk, color=PNPM, scale_factor=1.04), run_time=b.t(0.3))
            self.play(FadeIn(fn), run_time=b.t(0.25))


# ====================================================================== pnpm_trust_lockfile
class PnpmTrustLockfile(DWScene):
    BEATS = [("flag", 16), ("without", 11), ("day", 12), ("cache", 11), ("offline", 9), ("cost", 8), ("fix", 18)]

    def construct(self):
        with self.beat("flag") as b:
            title = scene_title("One flag outside a workspace", PNPM)
            fl = chip("--config.trust-lockfile=true", PNPM, size=BODY)
            fn = T("kit lockfile strategy, outside a workspace", SMALL, MUTED)
            row = VGroup(fl, fn).arrange(RIGHT, buff=0.35)
            _left(row, 2.3)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))
            self.play(FadeIn(row, shift=UP * 0.1), run_time=b.t(0.35))

        cx = _X0 + 0.3
        with self.beat("without") as b:
            wl = _left(T("without it:", LABEL, MUTED, bold=True), 1.35)
            c1 = _left(chip("minimumReleaseAge 1440 min", PNPM, size=LABEL), 0.6, cx)
            self.play(FadeIn(wl), run_time=b.t(0.25))
            self.play(FadeIn(c1, shift=DOWN * 0.1), run_time=b.t(0.35))

        with self.beat("day") as b:
            dn = T("holds back a version younger than one day", SMALL, MUTED).next_to(c1, RIGHT, buff=0.4)
            self.play(FadeIn(dn), run_time=b.t(0.4))

        ax = cx + 0.8
        with self.beat("cache") as b:
            c2 = _left(chip("needs metadata cache 113 MB", PNPM, size=LABEL), -0.45, cx)
            a1 = _arrow([ax, c1.get_bottom()[1], 0], [ax, c2.get_top()[1], 0], PNPM, buff=0.05)
            self.play(GrowArrow(a1), FadeIn(c2, shift=DOWN * 0.1), run_time=b.t(0.45))

        with self.beat("offline") as b:
            c3 = _left(chip("offline: NO_OFFLINE_META", ISOLATION, size=LABEL), -1.5, cx)
            a2 = _arrow([ax, c2.get_bottom()[1], 0], [ax, c3.get_top()[1], 0], ISOLATION, buff=0.05)
            self.play(GrowArrow(a2), FadeIn(c3, shift=DOWN * 0.1), run_time=b.t(0.5))

        with self.beat("cost") as b:
            cl = T("a cost for security", LABEL, ISOLATION, bold=True)
            _left(cl, -2.3)
            self.play(FadeIn(cl, shift=RIGHT * 0.1), run_time=b.t(0.45))

        with self.beat("fix") as b:
            red = chip("holds a security fix 24 h unless excluded", ISOLATION, mono=False, size=LABEL)
            red.next_to(cl, RIGHT, buff=0.4)
            self.play(FadeIn(red, shift=LEFT * 0.1), Indicate(c1, color=ISOLATION, scale_factor=1.04),
                      run_time=b.t(0.35))


# ====================================================================== kit_lockfile_failures
class KitLockfileFailures(DWScene):
    BEATS = [("fast", 11), ("miss", 17), ("drift", 15), ("dead", 11), ("infer", 17)]

    def construct(self):
        with self.beat("fast") as b:
            title = scene_title("Kit lockfile failures: fast and clear", ISOLATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.4))

        with self.beat("miss") as b:
            p1 = T("s2/miss/install.log (real)", SMALL, MUTED, mono=True)
            _left(p1, 2.5)
            t1 = chip("0.8 s", ISOLATION).next_to(p1, RIGHT, buff=0.35)
            log1 = _log([_words(["[ERR_PNPM_NO_OFFLINE_TARBALL]", "A package is missing"]),
                         "from the store but cannot download it in offline mode."])
            log1.next_to(p1, DOWN, buff=0.2).align_to(p1, LEFT)
            self.play(FadeIn(p1), FadeIn(log1, shift=UP * 0.1), run_time=b.t(0.35))
            self.play(log1.rows[0][0].animate.set_color(ISOLATION), FadeIn(t1, scale=0.9), run_time=b.t(0.3))

        with self.beat("drift") as b:
            p2 = T("s2/drift/install.log (real)", SMALL, MUTED, mono=True)
            _left(p2, 0.35)
            log2 = _log([_words(["[ERR_PNPM_OUTDATED_LOCKFILE]", "Cannot install with"]),
                         '"frozen-lockfile" because pnpm-lock.yaml is not up to date',
                         "1 dependencies were added: left-pad@1.3.0"])
            log2.next_to(p2, DOWN, buff=0.2).align_to(p2, LEFT)
            self.play(FadeIn(p2), FadeIn(log2, shift=UP * 0.1), run_time=b.t(0.35))
            self.play(log2.rows[0][0].animate.set_color(ISOLATION), run_time=b.t(0.25))

        with self.beat("dead") as b:
            tm = chip("offline, dead registry 127.0.0.1:9", PNPM)
            tm.move_to([_X1, p1.get_y(), 0], aligned_edge=RIGHT)
            self.play(FadeIn(tm, shift=LEFT * 0.1), run_time=b.t(0.4))

        with self.beat("infer") as b:
            td = chip("no network (inferred)", INFERRED, mono=False)
            td.move_to([_X1, p2.get_y(), 0], aligned_edge=RIGHT)
            why = T("inferred: the lockfile check fails first", SMALL, INFERRED)
            _left(why, -2.4)
            self.play(FadeIn(td, shift=LEFT * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(why), run_time=b.t(0.3))


# ====================================================================== strategy_shared_chunks
class StrategySharedChunks(DWScene):
    BEATS = [("base", 10), ("runtime", 16), ("external", 9), ("rewrite", 11), ("rt_num", 19), ("build", 12),
             ("page", 10), ("nodrop", 7), ("bars", 15), ("broke", 18)]

    SPEC1 = ["react", "react-dom/client", "@openuidev/react-lang", "zod", "date-fns"]
    SPEC2 = ["dw-mini-ui", "lucide-react", "recharts", "..."]
    VITE_CFG = """rollupOptions: { external: Object.keys(shared),
  output: { paths: ... kitUrl + file } }"""

    def construct(self):
        with self.beat("base") as b:
            title = scene_title("S3: shared chunks", PNPM)
            base = chip("builds on S2: kit lockfile", PNPM, mono=False)
            _left(base, 2.5)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(base), run_time=b.t(0.3))

        with self.beat("runtime") as b:
            card = rbox(7.0, 2.6, KIT, fill=0.05).move_to([_X0 - 0.15 + 3.5, 0.75, 0])
            hd = VGroup(T("s3/kit-v1/shared.json", SMALL, KIT, mono=True), T("17 specifiers", SMALL, MUTED))
            hd.arrange(RIGHT, buff=0.35).move_to(card.get_corner(UL) + RIGHT * 0.3 + DOWN * 0.3, aligned_edge=LEFT)
            x1, x2 = card.get_left()[0] + 0.35, card.get_left()[0] + 4.5
            c1 = VGroup(*[_left(T(s, SMALL, TEXT, mono=True), 1.25 - i * 0.36, x1) for i, s in enumerate(self.SPEC1)])
            c2 = VGroup(*[_left(T(s, SMALL, TEXT, mono=True), 1.25 - i * 0.36, x2) for i, s in enumerate(self.SPEC2)])
            rt = ProcessBox("kit v1 runtime", "script files, built once", color=KIT, sub_mono=False)
            rt.move_to([4.25, 1.55, 0])
            a_rt = _arrow(card.get_right() + UP * 0.8, rt.box.get_left(), KIT)
            self.play(Create(card), FadeIn(hd), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(m) for m in [*c1, *c2]], lag_ratio=0.15), run_time=b.t(0.35))
            self.play(GrowArrow(a_rt), FadeIn(rt), run_time=b.t(0.3))

        with self.beat("external") as b:
            wd = ProcessBox("widget build", "shared packages: external", color=VITE, sub_mono=False)
            wd.move_to([4.25, -0.35, 0])
            self.play(FadeIn(wd, shift=UP * 0.1), run_time=b.t(0.5))

        with self.beat("rewrite") as b:
            a_w = _arrow(wd.box.get_top(), rt.box.get_bottom(), VITE, buff=0.06)
            code = code_block(self.VITE_CFG, "typescript", color=VITE)
            code.move_to([_X0 - 0.15, -1.5, 0], aligned_edge=LEFT)
            a_lab = T("import → runtime file", SMALL, VITE).next_to(a_w, LEFT, buff=0.15)
            self.play(GrowArrow(a_w), FadeIn(a_lab), run_time=b.t(0.35))
            self.play(FadeIn(code, shift=UP * 0.1), run_time=b.t(0.35))

        sx = _X0
        with self.beat("rt_num") as b:
            self.play(FadeOut(VGroup(card, hd, c1, c2, a_rt, code)), run_time=b.t(0.2))
            s_r = _stat("runtime build, per kit version", "3.5 to 3.8 s, 2.1 MB", sx, 1.95)
            self.play(FadeIn(s_r, shift=RIGHT * 0.1), Indicate(rt.box, color=KIT, scale_factor=1.03),
                      run_time=b.t(0.35))

        with self.beat("build") as b:
            s_b = _stat("widget build", "0.29 to 0.93 s", sx, 0.95)
            self.play(FadeIn(s_b, shift=RIGHT * 0.1), Indicate(wd.box, color=VITE, scale_factor=1.03),
                      run_time=b.t(0.4))

        with self.beat("page") as b:
            s_p = _stat("widget page", "44 to 96 KB", sx, -0.05)
            self.play(FadeIn(s_p, shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("nodrop") as b:
            nd = _left(T("the runtime files cannot drop unused code", LABEL, TEXT, bold=True), -1.3)
            self.play(FadeIn(nd, shift=RIGHT * 0.1), run_time=b.t(0.5))

        k = 3.4 / 903
        with self.beat("bars") as b:
            bars = VGroup()
            for y, name, kb in ((-1.85, "lucide", 903), (-2.35, "recharts", 578)):
                n = _left(T(name, SMALL, TEXT, mono=True), y, _X0 + 0.2)
                r = Rectangle(width=kb * k, height=0.3, stroke_width=0, fill_color=KIT, fill_opacity=0.8)
                r.move_to([_X0 + 1.9, y, 0], aligned_edge=LEFT)
                v = T(f"{kb} KB", SMALL, MEASURED, mono=True).next_to(r, RIGHT, buff=0.15)
                bars.add(VGroup(n, r, v))
            for g in bars:
                self.play(FadeIn(g[0]), GrowFromEdge(g[1], LEFT), FadeIn(g[2]), run_time=b.t(0.3))

        with self.beat("broke") as b:
            red = chip("in-place kit change broke an old widget", ISOLATION, mono=False)
            red.move_to([_X1, -1.85, 0], aligned_edge=RIGHT)
            see = T("shown in the part: pin or rebuild", SMALL, MUTED)
            see.next_to(red, DOWN, buff=0.2).align_to(red, RIGHT)
            self.play(FadeIn(red, shift=LEFT * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(see), run_time=b.t(0.2))


# ====================================================================== strategy_compare
class StrategyCompare(DWScene):
    BEATS = [("table", 8), ("s1", 15), ("s2", 17), ("s3", 12), ("tie", 11), ("open", 7)]

    HEAD = ["S1 fresh install", "S2 kit lockfile", "S3 shared chunks"]
    ROWS = [
        (("add a", "package"), ("3.3 s per widget,", "817 KB"), ("new kit version", "1.0 + 3.2 + 0.5 s"),
         ("S2 + 3.5 to 3.8 s", "runtime")),
        (("install", "per widget"), ("14.0 s cold,", "3.0 s warm"), ("2.6 to 3.3 s offline,", "or 0 s link"),
         ("0 s link",)),
        (("build",), ("0.9 to 3.7 s",), ("0.9 to 3.7 s",), ("0.3 to 0.9 s",)),
        (("size",), ("352 to 796 KB",), ("352 to 796 KB",), ("44 to 96 KB + 2.1 MB", "runtime per kit version")),
        (("determinism",), ("resolves again",), ("frozen",), ("frozen",)),
        (("failure",), ("registry down 70.5 s",), ("NO_OFFLINE_TARBALL", "0.8 s"),
         ("in-place kit change", "broke old widget")),
    ]
    XS = (-6.6, -4.35, -1.0, 2.75)
    FAIL_ROW = 5

    def construct(self):
        lp, gap = 0.33, 0.24
        with self.beat("table") as b:
            title = scene_title("Three strategies side by side", PNPM)
            ref = T("kit_spike.strategies", SMALL, MUTED, mono=True).move_to([_X1, TITLE_Y, 0], aligned_edge=RIGHT)
            hdr = VGroup(*[T(h, SMALL, PNPM, bold=True).move_to([x, 2.75, 0], aligned_edge=LEFT)
                           for h, x in zip(self.HEAD, self.XS[1:])])
            rows, lines_ = [], []
            top = 2.75 - 0.5
            for r, row in enumerate(self.ROWS):
                n = max(len(c) for c in row)
                cells = VGroup()
                for c, (cell, x) in enumerate(zip(row, self.XS)):
                    col = ISOLATION if (r == self.FAIL_ROW and c > 0) else TEXT
                    for i, s in enumerate(cell):
                        t = T(s, SMALL, col, bold=(c == 0))
                        t.move_to([x, top - i * lp, 0], aligned_edge=LEFT)
                        cells.add(t)
                rows.append(cells)
                y_line = top + lp / 2 + gap / 2
                lines_.append(Line([self.XS[0], y_line, 0], [_X1, y_line, 0], stroke_width=1.5, stroke_color=MUTED,
                                   stroke_opacity=0.55))
                top -= n * lp + gap
            self.table_bottom = top + gap
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(ref), FadeIn(hdr), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(VGroup(l, r)) for l, r in zip(lines_, rows)], lag_ratio=0.5),
                      run_time=b.left)

        def col_cells(c):
            return VGroup(hdr[c - 1], *[m for r in rows for m in r if abs(m.get_left()[0] - self.XS[c]) < 1e-3])

        def frame(c):
            g = col_cells(c)
            return SurroundingRectangle(g, color=PNPM, buff=0.12, stroke_width=3, corner_radius=0.08)

        with self.beat("s1") as b:
            f1 = frame(1)
            self.play(Create(f1), run_time=b.t(0.3))
            self.play(Indicate(VGroup(*rows[0][2:4]), color=PNPM, scale_factor=1.04), run_time=b.t(0.25))
            self.play(Indicate(rows[4][1], color=PNPM, scale_factor=1.1), run_time=b.t(0.25))

        with self.beat("s2") as b:
            f2 = frame(2)
            self.play(ReplacementTransform(f1, f2), run_time=b.t(0.3))
            self.play(Indicate(rows[4][2], color=PNPM, scale_factor=1.1), run_time=b.t(0.25))
            self.play(Indicate(rows[3][2], color=PNPM, scale_factor=1.1), run_time=b.t(0.25))

        with self.beat("s3") as b:
            f3 = frame(3)
            self.play(ReplacementTransform(f2, f3), run_time=b.t(0.3))
            s3_size = VGroup(*[m for m in rows[3] if abs(m.get_left()[0] - self.XS[3]) < 1e-3])
            s3_build = VGroup(*[m for m in rows[2] if abs(m.get_left()[0] - self.XS[3]) < 1e-3])
            self.play(Indicate(s3_build, color=PNPM), Indicate(s3_size[0], color=PNPM), run_time=b.t(0.4))

        with self.beat("tie") as b:
            mk = SurroundingRectangle(s3_size, color=KIT, buff=0.06, stroke_width=2.5, corner_radius=0.05)
            self.play(Create(mk), s3_size[1].animate.set_color(KIT), run_time=b.t(0.45))

        with self.beat("open") as b:
            nd = chip("not decided", OPEN, mono=False, size=LABEL, dashed=True)
            nd.move_to([_X0, -2.5, 0], aligned_edge=LEFT)
            self.play(FadeOut(f3), FadeIn(nd, scale=0.9), run_time=b.t(0.45))


# ====================================================================== packaging_work
class PackagingWork(DWScene):
    BEATS = [("front", 8), ("reads", 8), ("writes", 16), ("size", 14), ("close", 8)]

    def construct(self):
        outline = OutlineDiagram()
        lx, vx = _X0 + 0.3, _X0 + 2.6

        def label(t, y):
            return T(t, LABEL, MUTED, bold=True).move_to([lx, y, 0], aligned_edge=LEFT)

        def val(m, y):
            return m.move_to([vx, y, 0], aligned_edge=LEFT)

        with self.beat("front") as b:
            title = scene_title("The kit service with pnpm", PNPM)
            card = rbox(_X1 - _X0, 2.6, PNPM, fill=0.05).move_to([(_X0 + _X1) / 2, 1.5, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), Create(card), run_time=b.t(0.5))

        with self.beat("reads") as b:
            r_l = label("Reads", 2.3)
            r_v = val(T("kit folder, pnpm-lock.yaml", LABEL, PNPM, mono=True), 2.3)
            self.play(FadeIn(r_l), FadeIn(r_v, shift=RIGHT * 0.1), run_time=b.t(0.5))

        with self.beat("writes") as b:
            w_l = label("Writes", 1.35)
            w_v = val(T("store, node_modules, kitVersion", LABEL, PNPM, mono=True), 1.35)
            w_n = val(T("a new kit version on each change", SMALL, MUTED), 0.8)
            self.play(FadeIn(w_l), FadeIn(w_v, shift=RIGHT * 0.1), run_time=b.t(0.35))
            self.play(FadeIn(w_n), run_time=b.t(0.25))

        with self.beat("size") as b:
            s = chip("kit service with pnpm: L (estimate)", INFERRED, mono=False, size=LABEL)
            s.next_to(card, DOWN, buff=0.4).align_to(card, LEFT)
            self.play(FadeIn(s, shift=UP * 0.1), run_time=b.t(0.35))

        with self.beat("close") as b:
            outline.close_part(self, "kit_project", next_key="host_extras", run_time=b.left)
