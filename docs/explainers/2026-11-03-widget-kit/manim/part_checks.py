"""Part `part_checks`: checks_list checks_today tla_models.
The checks of the kit path: the new tests, the change to today's checks, and the TLA+ models.

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


def _tick(color=CHECKS, s=0.16):
    return VMobject(stroke_color=color, stroke_width=6).set_points_as_corners(
        [[-s, 0, 0], [-s * 0.3, -s * 0.7, 0], [s, s * 0.8, 0]])


def _esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _mono(s, color=None):
    c = f' fgcolor="{color}"' if color else ""
    return f'<span font_family="{MONO}"{c}>{_esc(s)}</span>'


def _col(s, color):
    return f'<span fgcolor="{color}">{_esc(s)}</span>'


def _folder(color=CHECKS, w=0.6, h=0.44):
    tab = Polygon([0, 0, 0], [w * 0.38, 0, 0], [w * 0.46, h * 0.18, 0], [0, h * 0.18, 0],
                  stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.35)
    body = Rectangle(width=w, height=h, stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.15)
    body.next_to(tab, DOWN, buff=0).align_to(tab, LEFT)
    return VGroup(tab, body)


# ====================================================================== checks_list
class ChecksList(DWScene):
    # beat starts (s): open 3.27, names 5.96, smoke 8.5, locked 12.49, inuse 18.18, listchg 21.88, size 28.63
    BEATS = [("touch", 3.27), ("open", 2.69), ("names", 2.54), ("smoke", 3.99), ("locked", 5.69), ("inuse", 3.7),
             ("listchg", 6.75), ("size", 4.37)]

    # outline boxes that get a check frame (all boxes but the row containers and the checks strip)
    BOXES = ("agent", "mcp_install", "gates", "host", "shell", "kit_project", "agent_library", "type_gate",
             "vite_build", "render_check", "pinned_pages", "electron_main", "windows", "mcp_door", "describe",
             "settings_pane", "host_extras", "pin")

    def construct(self):
        outline = OutlineDiagram()
        with self.beat("touch") as b:
            outline.set_highlight_now("checks")
            self.add(outline)
            self.play(outline.highlight(*self.BOXES, "kit_config", "checks", arrows=OutlineDiagram.ARROWS), run_time=b.t(0.2))
            frames = VGroup()
            for k in self.BOXES:
                bx = outline.box(k)
                r = SurroundingRectangle(bx, color=CHECKS, buff=0.05, stroke_width=3, corner_radius=0.16)
                if k in ("describe", "pin"):  # thin tags: a tick would cover their text
                    frames.add(r)
                    continue
                tk = _tick(CHECKS, s=0.1).move_to(bx.get_corner(UR) + LEFT * 0.14 + DOWN * 0.13)
                frames.add(VGroup(r, tk))
            self.play(LaggedStart(*[Create(f) for f in frames], lag_ratio=0.08), run_time=b.t(0.6))

        with self.beat("open") as b:
            self.play(FadeOut(frames), run_time=b.t(0.1))
            outline.open_part(self, "checks", run_time=b.t(0.55))
            title = scene_title("Each unit of work needs a check that can fail", CHECKS)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))

        with self.beat("names") as b:
            src = T("checks named in the spike work map", LABEL, MUTED)
            src.move_to([_X0, 2.45, 0], aligned_edge=LEFT)
            self.play(FadeIn(src), run_time=b.t(0.4))

        def item(markup, y):
            tk = _tick(CHECKS).move_to([_X0 + 0.2, y, 0])
            t = M(markup, LABEL, TEXT)
            t.next_to(tk, RIGHT, buff=0.3).set_y(y)
            return VGroup(tk, t)

        ys = [1.6, 0.75, -0.1, -0.95]
        items = [
            item(_col("smoke: ", CHECKS) + _mono("add extra > build > render"), ys[0]),
            item(_col("MCP test: ", CHECKS) + _mono("kit_add", MCP) + _mono(" with setting off -> ")
                 + _mono("kit-locked", CONFIG), ys[1]),
            item(_col("MCP test: ", CHECKS) + _mono("kit_remove", MCP) + _mono(" of a used package -> ")
                 + _mono("in-use", CONFIG), ys[2]),
            item(_mono("list_changed", DESCRIBE) + _col(" test with ", CHECKS)
                 + _mono("@modelcontextprotocol/client 2.2.0"), ys[3]),
        ]
        for name, it in zip(("smoke", "locked", "inuse", "listchg"), items):
            with self.beat(name) as b:
                self.play(FadeIn(it, shift=RIGHT * 0.15), run_time=b.t(0.3))

        with self.beat("size") as b:
            sz = chip("checks: M (estimate)", INFERRED, mono=False, size=LABEL)
            sz.move_to([_X0, -2.1, 0], aligned_edge=LEFT)
            self.play(FadeIn(sz, shift=UP * 0.1), run_time=b.t(0.35))


# ====================================================================== checks_today
class ChecksToday(DWScene):
    # beat starts (s): mcp 2.47, four 8.5, kit 11.22, create 13.93, gates 18.36, smoke 23.22, fail 27.06,
    # nothing 30.3, infer 32.75
    BEATS = [("intro", 2.47), ("mcp", 6.03), ("four", 2.72), ("kit", 2.71), ("create", 4.43), ("gates", 4.86),
             ("smoke", 3.84), ("fail", 3.24), ("nothing", 2.45), ("infer", 4.53)]

    def construct(self):
        with self.beat("intro") as b:
            title = scene_title("Checks today, and what must change", CHECKS)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.4))

        def head(path, y):
            return T(path, LABEL, CHECKS, mono=True).move_to([_X0, y, 0], aligned_edge=LEFT)

        def today(text, ref):
            t = M(_col("today: ", MUTED) + text, LABEL, TEXT)
            return t.next_to(ref, DOWN, buff=0.16).align_to(ref, LEFT).shift(RIGHT * 0.35)

        def plus(markup, ref):
            a = _arr(ORIGIN, RIGHT * 0.5, CHECKS, buff=0, sw=3, tip=0.14)
            t = M(markup, LABEL, TEXT)
            g = VGroup(a, t).arrange(RIGHT, buff=0.2)
            return g.next_to(ref, DOWN, buff=0.16).align_to(ref, LEFT)

        h1 = head("tools/widgets-mcp.mjs", 2.45)
        t1 = today("lists nine tools, calls four", h1)
        p1 = plus(_col("plus ", CHECKS) + _mono("kit_read, kit_describe, kit_add, kit_remove", MCP), t1)
        h2 = head("tools/widgets-create.mjs", 0.95)
        t2 = today("compile, lint, test run", h2)
        p2 = plus(_col("plus ", CHECKS) + _col("type gate, Vite build, render check", CREATION), t2)
        h3 = head("DSH_SMOKE_WIDGET=<slug> node tools/smoke-desktop.mjs", -0.55)
        p3 = plus(_col("page of that slug", SHELL), h3).shift(RIGHT * 0.35)

        with self.beat("mcp") as b:
            self.play(FadeIn(h1, shift=RIGHT * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(t1[0]), FadeIn(t1[1:], shift=RIGHT * 0.1), run_time=b.t(0.25))

        with self.beat("four") as b:
            four = t1[-4:]
            self.play(Indicate(four, color=MCP, scale_factor=1.12), run_time=b.t(0.6))

        with self.beat("kit") as b:
            self.play(FadeIn(p1, shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("create") as b:
            self.play(FadeIn(h2, shift=RIGHT * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(t2, shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("gates") as b:
            self.play(FadeIn(p2, shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("smoke") as b:
            self.play(FadeIn(h3, shift=RIGHT * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(p3, shift=RIGHT * 0.1), run_time=b.t(0.3))

        foot = M(_col("each check must fail on a broken build", CHECKS), BODY)
        foot.move_to([_X0, -1.85, 0], aligned_edge=LEFT)
        line = Line([_X0, -1.35, 0], [_X1, -1.35, 0], stroke_color=MUTED, stroke_width=1.5, stroke_opacity=0.55)
        with self.beat("fail") as b:
            self.play(Create(line), FadeIn(foot, shift=UP * 0.1), run_time=b.t(0.4))

        with self.beat("nothing") as b:
            self.play(Indicate(foot, color=CHECKS, scale_factor=1.06), run_time=b.t(0.6))

        with self.beat("infer") as b:
            inf = T("(inferred list)", BODY, INFERRED).next_to(foot, RIGHT, buff=0.25)
            src = T("from the work map and the current tools folder", SMALL, INFERRED)
            src.next_to(foot, DOWN, buff=0.2).align_to(foot, LEFT)
            self.play(FadeIn(inf, shift=LEFT * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(src), run_time=b.t(0.2))


# ====================================================================== tla_models
class TlaModels(DWScene):
    # beat starts (s): checker 3.95, three 8.03, install 10.85, crash 12.86, plans 17.42, race 22.33,
    # small 27.86, other 32.08, size 35.23, close 37.0 (during "an estimate")
    BEATS = [("lang", 3.95), ("checker", 4.08), ("three", 2.82), ("install", 2.01), ("crash", 4.56), ("plans", 4.91),
             ("race", 5.53), ("small", 4.22), ("other", 3.15), ("size", 1.77), ("close", 2.0)]

    def construct(self):
        # ------------------------------------------------ what TLA+ is
        with self.beat("lang") as b:
            title = scene_title("TLA+ models of the widget system", CHECKS)
            d1 = M(_col("TLA+", CHECKS) + ": a language for models of systems", LABEL, TEXT)
            d1b = T("that change state", LABEL, TEXT)
            d1g = VGroup(d1, d1b).arrange(DOWN, buff=0.14, aligned_edge=LEFT)
            d1g.move_to([_X0, 1.9, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(d1g, shift=RIGHT * 0.1), run_time=b.t(0.3))

        # a small state graph: every order of steps, the rules checked in each state
        c = np.array([3.9, 0.9, 0])
        pos = {"s0": c + LEFT * 1.9, "s1": c + UP * 1.0, "s2": c + DOWN * 1.0, "s3": c + RIGHT * 1.9}
        dots = {k: Circle(radius=0.22, stroke_color=CHECKS, stroke_width=3, fill_color=CHECKS,
                          fill_opacity=0.12).move_to(p) for k, p in pos.items()}
        edges = [("s0", "s1"), ("s0", "s2"), ("s1", "s3"), ("s2", "s3"), ("s1", "s2")]
        eds = VGroup(*[_arr(dots[a].get_center(), dots[z].get_center(), MUTED, buff=0.26, sw=2.5, tip=0.14)
                       for a, z in edges])
        graph = VGroup(eds, *dots.values())
        illus = T("illustrative", SMALL, MUTED).next_to(graph, DOWN, buff=0.25)
        with self.beat("checker") as b:
            d2 = M(_col("model checker", CHECKS) + ": walks every order of steps,", LABEL, TEXT)
            d2b = T("checks the rules", LABEL, TEXT)
            d2g = VGroup(d2, d2b).arrange(DOWN, buff=0.14, aligned_edge=LEFT)
            d2g.move_to([_X0, 0.2, 0], aligned_edge=LEFT)
            self.play(FadeIn(d2g, shift=RIGHT * 0.1), FadeIn(graph), FadeIn(illus), run_time=b.t(0.25))
            orders = [("s0", "s1", "s3"), ("s0", "s2", "s3"), ("s0", "s1", "s2", "s3")]
            for path in orders:
                self.play(*[dots[k].animate.set_fill(CHECKS, opacity=0.6) for k in path],
                          *[eds[edges.index((a, z))].animate.set_color(CHECKS) for a, z in zip(path, path[1:])],
                          run_time=b.t(0.12))
                self.play(*[dots[k].animate.set_fill(CHECKS, opacity=0.12) for k in path],
                          *[eds[edges.index((a, z))].animate.set_color(MUTED) for a, z in zip(path, path[1:])],
                          run_time=b.t(0.06))
            ok = _tick(CHECKS).next_to(dots["s3"], RIGHT, buff=0.2)
            self.play(Create(ok), run_time=b.t(0.08))

        # ------------------------------------------------ the three models
        fold = _folder(CHECKS, w=0.5, h=0.36)
        fpath = T(".agents/skills/widget-state-models/", LABEL, CHECKS, mono=True)
        fh = VGroup(fold, fpath).arrange(RIGHT, buff=0.2).move_to([_X0, 2.45, 0], aligned_edge=LEFT)
        ents = VGroup(
            T("action_contract", LABEL, TEXT, mono=True),
            T("crash_lifecycle", LABEL, TEXT, mono=True),
            M(_mono("widget_install/WidgetInstall.tla") + "  " + _col("(654 lines)", MEASURED), LABEL, TEXT),
        ).arrange(DOWN, buff=0.16, aligned_edge=LEFT)
        ents.next_to(fh, DOWN, buff=0.2).align_to(fh, LEFT).shift(RIGHT * 0.7)
        with self.beat("three") as b:
            self.play(FadeOut(VGroup(d1g, d2g, graph, illus, ok)), run_time=b.t(0.25))
            self.play(FadeIn(fh, shift=RIGHT * 0.1), run_time=b.t(0.25))
            self.play(LaggedStart(*[FadeIn(e, shift=RIGHT * 0.1) for e in ents], lag_ratio=0.3), run_time=b.t(0.4))

        with self.beat("install") as b:
            mk = SurroundingRectangle(ents[2], color=CHECKS, buff=0.07, stroke_width=2.5, corner_radius=0.05)
            self.play(Create(mk), ents[0].animate.set_opacity(0.45), ents[1].animate.set_opacity(0.45),
                      run_time=b.t(0.5))

        # install, reload, remove with crashes between the steps
        y_steps = 0.28
        steps = VGroup(*[chip(s, CREATION, mono=False, size=LABEL) for s in ("install", "reload", "remove")])
        steps.arrange(RIGHT, buff=1.1).move_to([_X0 + 0.7, y_steps, 0], aligned_edge=LEFT)
        links = VGroup(*[_arr(a.get_right(), z.get_left(), MUTED, buff=0.1, sw=2.5, tip=0.14)
                         for a, z in zip(steps, steps[1:])])
        crashes = VGroup(*[burst(ISOLATION, r=0.17).move_to(l.get_center()) for l in links])
        clab = T("crashes between steps", LABEL, ISOLATION).next_to(steps, RIGHT, buff=0.5)
        with self.beat("crash") as b:
            self.play(LaggedStart(*[FadeIn(s, shift=RIGHT * 0.1) for s in steps], lag_ratio=0.3),
                      LaggedStart(*[GrowArrow(l) for l in links], lag_ratio=0.3), run_time=b.t(0.35))
            self.play(LaggedStart(*[GrowFromCenter(cr) for cr in crashes], lag_ratio=0.3), FadeIn(clab),
                      run_time=b.t(0.3))

        # ------------------------------------------------ planned changes
        ph = M(_col("Planned in the work map ", TEXT) + _col("(inferred)", INFERRED)
               + _col(", additions to ", TEXT) + _mono("WidgetInstall.tla", CHECKS) + ":", LABEL, TEXT)
        ph.move_to([_X0, -0.36, 0], aligned_edge=LEFT)
        a_build = chip("build step", VITE, mono=False, size=LABEL)
        a_kit = chip("kitVersion", KIT, mono=True, size=LABEL)
        a_race = M(_mono("kit_remove", MCP) + _mono(" racing an install -> ") + _mono("in-use", CONFIG), LABEL, TEXT)
        a_race_b = rbox(a_race.width + 0.44, a_kit.height, CHECKS, fill=0.15, sw=2, r=0.1)
        a_race.move_to(a_race_b)
        a_race_g = VGroup(a_race_b, a_race)
        adds = VGroup(a_build, a_kit, a_race_g).arrange(RIGHT, buff=0.3)
        adds.next_to(ph, DOWN, buff=0.18).align_to(ph, LEFT).shift(RIGHT * 0.35)
        with self.beat("plans") as b:
            self.play(FadeIn(ph, shift=RIGHT * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(a_build, shift=UP * 0.1), run_time=b.t(0.15))
            _at(self, b, 0.6)
            self.play(FadeIn(a_kit, shift=UP * 0.1), run_time=b.t(0.15))

        with self.beat("race") as b:
            self.play(FadeIn(a_race_g, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("small") as b:
            nb = M(_col("small kit model: ", CHECKS) + _mono("kit_add / kit_remove", MCP) + " vs builds",
                   LABEL, TEXT)
            nbb = rbox(nb.width + 0.6, nb.height + 0.3, CHECKS, fill=0.08, sw=2.5, dashed=True)
            nb.move_to(nbb)
            new = T("new", SMALL, CHECKS, bold=True)
            newg = VGroup(nbb, nb)
            newg.move_to([_X0, -1.76, 0], aligned_edge=LEFT)
            new.next_to(newg, RIGHT, buff=0.2)
            self.play(FadeIn(newg, shift=UP * 0.1), FadeIn(new), run_time=b.t(0.3))

        with self.beat("other") as b:
            oth = T("ActionContract.tla, crash_lifecycle.tla: no change (inferred)", LABEL, INFERRED)
            oth.move_to([_X0, -2.52, 0], aligned_edge=LEFT)
            self.play(FadeIn(oth, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("size") as b:
            sz = chip("TLA+: M (estimate)", INFERRED, mono=False, size=LABEL)
            sz.next_to(newg, RIGHT, buff=0.2).shift(RIGHT * 0.9).set_y(newg.get_y())
            self.play(FadeIn(sz, shift=UP * 0.1), run_time=b.t(0.45))

        with self.beat("close") as b:
            OutlineDiagram().close_part(self, "checks", next_key="kit_row", run_time=b.left)
