"""Part `part_today`: today_shell today_component_set today_creation today_paths_map today_serving
today_agent_text. The code of today, before the kit.

Beat weights are seconds of the final audio: each beat starts at the pause before its sentence
(silencedetect). The base scales them to the audio length.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content
_X1 = FRAME_W / 2 - MARGIN - 0.25    # right edge of content


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (no-op if already later)."""
    scene.wait_until(b.start + frac * b.length)


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


def _mono(s, color=None):
    c = f' fgcolor="{color}"' if color else ""
    return f'<span font_family="{MONO}"{c}>{s}</span>'


def _lock(color=MUTED, s=0.2):
    body = RoundedRectangle(corner_radius=0.03, width=s, height=s * 0.75, stroke_color=color, stroke_width=2,
                            fill_color=color, fill_opacity=0.6)
    shackle = Arc(radius=s * 0.3, start_angle=0, angle=PI, stroke_color=color, stroke_width=2.5)
    shackle.next_to(body, UP, buff=0)
    return VGroup(shackle, body)


def _card(head, body, color, w=None, head_mono=True, body_mono=False, size=SMALL, fill=0.08, dashed=False):
    """Box with a head line (concept color) and body lines. .box .head .body"""
    h = T(head, size, color, mono=head_mono, bold=not head_mono)
    bl = VGroup(*[T(x, size, TEXT, mono=body_mono) for x in ([body] if isinstance(body, str) else body)])
    bl.arrange(DOWN, buff=0.1, aligned_edge=LEFT)
    txt = VGroup(h, bl).arrange(DOWN, buff=0.16, aligned_edge=LEFT)
    box = rbox(w or txt.width + 0.5, txt.height + 0.4, color, fill=fill, dashed=dashed)
    txt.move_to(box)
    if w:
        txt.align_to(box, LEFT).shift(RIGHT * 0.25)
    g = VGroup(box, txt)
    g.box, g.head, g.body = box, h, bl
    return g




# ====================================================================== today_shell
class TodayShell(DWScene):
    # beat starts at sentence pauses of the final audio (s): card 5.58, program 16.19, root 22.25, vite 31.73
    BEATS = [("open", 5.58), ("card", 10.61), ("program", 6.06), ("root", 9.48), ("vite", 7.55)]

    MAIN = """\
import { ACTION_STEPS, Renderer, ... } from '@openuidev/react-lang'
import { CATALOG_ID, widgetLibrary } from './library.tsx'
<Renderer.Root
  response={load.text}
  library={load.library}
  toolProvider={channel?.tools ?? null}
  ...>"""

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "shell", run_time=b.left)

        with self.beat("card") as b:
            title = scene_title("Today: the shell", SHELL)
            path = T("deepwidgets/shell/src/main.tsx", LABEL, SHELL, mono=True)
            code = code_block(self.MAIN, "tsx", color=SHELL)
            path.move_to([_X0, 2.6, 0], aligned_edge=LEFT)
            code.next_to(path, DOWN, buff=0.15).align_to(path, LEFT)
            hide_lines(code)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(path), FadeIn(code.background), run_time=b.t(0.12))
            self.play(reveal_lines(code, 0, 7), run_time=b.t(0.2))
            # the three jobs of main.tsx
            steps = [chip("channel to the host", HOST, mono=False), chip("load the program", SHELL, mono=False),
                     chip("draw it", SHELL, mono=False)]
            flow = VGroup(*steps).arrange(RIGHT, buff=0.75)
            flow.next_to(code, DOWN, buff=0.4).align_to(code, LEFT)
            arrs = VGroup(*[_arr(steps[i].get_right(), steps[i + 1].get_left(), MUTED, buff=0.08)
                            for i in range(2)])
            _at(self, b, 0.6)
            self.play(FadeIn(steps[0], shift=UP * 0.1), run_time=b.t(0.08))
            self.play(GrowArrow(arrs[0]), FadeIn(steps[1], shift=UP * 0.1), run_time=b.t(0.08))
            self.play(GrowArrow(arrs[1]), FadeIn(steps[2], shift=UP * 0.1), run_time=b.t(0.08))

        with self.beat("program") as b:
            prog = chip("program = text in OpenUI Lang", SHELL, mono=False)
            prog.next_to(steps[1], DOWN, buff=0.3)
            self.play(Indicate(steps[1], color=SHELL, scale_factor=1.06), run_time=b.t(0.25))
            self.play(FadeIn(prog, shift=LEFT * 0.15), run_time=b.t(0.2))

        with self.beat("root") as b:
            frame = SurroundingRectangle(VGroup(*code.code_lines[2:7]), color=SHELL, buff=0.03,
                                         stroke_width=2.5, corner_radius=0.05)
            self.play(Create(frame), run_time=b.t(0.2))
            also = VGroup(T("main.tsx also holds:", SMALL, MUTED),
                          *[T("·  " + x, SMALL, TEXT) for x in ("the stream", "the refresh logic", "the diagnostics")])
            also.arrange(DOWN, buff=0.12, aligned_edge=LEFT)
            also.next_to(frame, RIGHT, buff=0.7).align_to(frame, UP).shift(DOWN * 0.05)
            _at(self, b, 0.45)
            self.play(LaggedStart(*[FadeIn(m, shift=LEFT * 0.1) for m in also], lag_ratio=0.3), run_time=b.t(0.3))

        with self.beat("vite") as b:
            self.play(FadeOut(VGroup(flow, arrs, prog)), run_time=b.t(0.1))
            wins = VGroup(*[chip(s, SHELL) for s in ("shadcn", "clock", "meter")]).arrange(DOWN, buff=0.1)
            wins.move_to([_X0 + wins.width / 2, -2.0, 0])
            page = chip("one page: /widget/", SHELL)
            page.next_to(wins, RIGHT, buff=1.0)
            to_page = VGroup(*[_arr(w.get_right(), page.get_left(), SHELL, sw=2.5, tip=0.14, buff=0.1)
                               for w in wins])
            vite = _card("deepwidgets/shell/vite.config.ts", ["base: '/widget/'", "outDir: 'dist/widget'"],
                         VITE, body_mono=True)
            vite.move_to([_X1 - vite.width / 2, wins.get_y(), 0])
            build = _arr(vite.get_left(), page.get_right(), VITE, sw=2.5, tip=0.14, buff=0.1)
            self.play(FadeIn(wins, lag_ratio=0.2), run_time=b.t(0.12))
            self.play(LaggedStart(*[GrowArrow(a) for a in to_page], lag_ratio=0.2), FadeIn(page),
                      run_time=b.t(0.15))
            _at(self, b, 0.45)
            self.play(FadeIn(vite, shift=UP * 0.15), GrowArrow(build), run_time=b.t(0.2))
            once = caption("Vite builds the shell once, into one folder")
            self.play(FadeIn(once), run_time=b.t(0.12))


# ====================================================================== today_component_set
class TodayComponentSet(DWScene):
    # beat starts (s): error 13.77, only 21.3, decision 26.93, conflict 34.79
    BEATS = [("card", 13.77), ("error", 7.53), ("only", 5.63), ("decision", 7.86), ("conflict", 5.65)]

    NAMES = [["Stat", "Button", "Input", "Checkbox"], ["Empty", "BarChart", "LineChart"],
             ["Row", "List", "Card", "..."]]

    def construct(self):
        with self.beat("card") as b:
            title = scene_title("One component set", SHELL)
            head = T("deepwidgets/shell/src/library.tsx", LABEL, SHELL, mono=True)
            line = VGroup(T("export const CATALOG_ID =", SMALL, TEXT, mono=True),
                          T("'shadcn-widgets@1'", SMALL, SOLVED, mono=True)).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            line[1].shift(RIGHT * 0.37)
            rows = VGroup(*[VGroup(*[chip(n, SHELL) for n in r]).arrange(RIGHT, buff=0.14) for r in self.NAMES])
            rows.arrange(DOWN, buff=0.14, aligned_edge=LEFT)
            inner = VGroup(line, rows).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
            box = rbox(inner.width + 0.5, inner.height + 0.45, SHELL, fill=0.06)
            inner.move_to(box)
            card = VGroup(box, inner)
            head.move_to([_X0, 2.6, 0], aligned_edge=LEFT)
            card.next_to(head, DOWN, buff=0.15).align_to(head, LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(head), Create(box), run_time=b.t(0.12))
            self.play(FadeIn(line), run_time=b.t(0.1))
            what = caption("component set: a list of components with names, props, and descriptions")
            _at(self, b, 0.3)
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.08) for r in rows for c in r], lag_ratio=0.12),
                      FadeIn(what), run_time=b.t(0.35))

        with self.beat("error") as b:
            prog = chip('program names set "x"', AGENT, mono=False)
            err = _card("Unsupported component set", ['The widget needs "x".', "This shell has shadcn-widgets@1."],
                        ISOLATION, head_mono=False, size=SMALL)
            right = VGroup(prog, err).arrange(DOWN, buff=0.45)
            right.move_to([_X1 - right.width / 2, 0, 0]).align_to(card, UP)
            a = _arr(prog.get_bottom(), err.get_top(), ISOLATION, buff=0.06)
            self.play(FadeIn(prog, shift=DOWN * 0.1), run_time=b.t(0.2))
            self.play(GrowArrow(a), FadeIn(err, shift=DOWN * 0.1), run_time=b.t(0.3))

        with self.beat("only") as b:
            own = chip("an agent's own component", AGENT, mono=False, dashed=True)
            own.next_to(err, DOWN, buff=0.35).align_to(err, LEFT)
            x = _cross().scale(0.8).next_to(own, RIGHT, buff=0.2)
            self.play(Indicate(rows, color=SHELL, scale_factor=1.03), run_time=b.t(0.3))
            self.play(FadeIn(own), run_time=b.t(0.2))
            self.play(Create(x), run_time=b.t(0.15))

        with self.beat("decision") as b:
            self.play(FadeOut(VGroup(prog, a, err, own, x)), run_time=b.t(0.12))
            src = T("standing decision, where-we-stand.md", SMALL, MUTED)
            dec = VGroup(M(_mono("widget.runtime_pin", SHELL) + "  |", SMALL),
                         T("All widgets share one shell,", SMALL), T("pinned to one version.", SMALL))
            dec.arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            dbox = rbox(dec.width + 0.5, dec.height + 0.45, SHELL, fill=0.08)
            dec.move_to(dbox)
            decision = VGroup(dbox, dec)
            col_x = card.get_right()[0] + 0.7
            src.move_to([col_x + src.width / 2, 0, 0]).align_to(head, UP)
            decision.next_to(src, DOWN, buff=0.15).align_to(src, LEFT)
            self.play(FadeIn(src), FadeIn(decision, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("conflict") as b:
            kit = chip("widget kit (direction)", KIT, mono=False, dashed=True)
            kit.next_to(decision, DOWN, buff=1.1).align_to(decision, LEFT)
            ax = decision.get_left()[0] + 0.8
            arrow = labeled_arrow([ax, decision.get_bottom()[1], 0], [ax, kit.get_top()[1], 0], None, KIT,
                                  dashed=True)
            lbl = lines("kit direction conflicts", "(not decided)", size=SMALL, color=KIT)
            lbl.next_to(arrow, RIGHT, buff=0.25)
            self.play(FadeIn(kit), Create(arrow), run_time=b.t(0.3))
            self.play(FadeIn(lbl), run_time=b.t(0.2))


# ====================================================================== today_creation
def _gate_row(name, detail, color, name_w, width, detail_mono=True):
    """One row of the gate strip: name (bold, concept color) and a detail. .box .name .detail"""
    n = T(name, LABEL, color, bold=True)
    d = T(detail, SMALL, TEXT, mono=detail_mono)
    box = rbox(width, 0.66, color, fill=0.08)
    n.move_to(box.get_left() + RIGHT * (0.25 + n.width / 2))
    d.move_to(box.get_left() + RIGHT * (0.25 + name_w + d.width / 2))
    g = VGroup(box, n, d)
    g.box, g.name, g.detail = box, n, d
    return g


class TodayCreation(DWScene):
    # beat starts (s): staging 3.92, compile 8.22, lint 16.53, test 27.21, fail 31.67, install 34.88
    BEATS = [("tool", 3.92), ("staging", 4.3), ("compile", 8.31), ("lint", 10.68), ("test", 4.46), ("fail", 3.21),
             ("install", 3.32)]

    ROWS = [("staging", "$TMPDIR/deepwidgets-gates-*", CREATION, True),
            ("compile", "esbuild  bundle:true  platform:node", CREATION, True),
            ("lint", "oxlint --type-aware --type-check (tsgolint)", CREATION, True),
            ("test run", "a throwaway process", CREATION, False),
            ("plugin manager", "installs <profile>/deepwidgets-widgets/<slug>", HOST, True)]

    def construct(self):
        name_w = 2.7
        width = name_w + max(T(d, SMALL, mono=m).width for _, d, _, m in self.ROWS) + 0.5
        rows = [_gate_row(n, d, c, name_w, width, m) for n, d, c, m in self.ROWS]
        for i, r in enumerate(rows):
            r.move_to([_X0 + width / 2, 1.55 - i * 0.95, 0])
        downs = [_arr(rows[i].box.get_bottom() + LEFT * (width / 2 - 1.0),
                      rows[i + 1].box.get_top() + LEFT * (width / 2 - 1.0), MUTED, buff=0.03, tip=0.13)
                 for i in range(len(rows) - 1)]

        with self.beat("tool") as b:
            title = scene_title("Today: creating a widget", CREATION)
            tool = chip("widget_install(dir)", MCP)
            tool.move_to([_X0 + tool.width / 2, 2.55, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(tool, shift=DOWN * 0.1), run_time=b.t(0.3))
            first = _arr([rows[0].box.get_left()[0] + 1.0, tool.get_bottom()[1], 0],
                         rows[0].box.get_top() + LEFT * (width / 2 - 1.0), MUTED, buff=0.03, tip=0.13)

        with self.beat("staging") as b:
            self.play(GrowArrow(first), FadeIn(rows[0], shift=DOWN * 0.1), run_time=b.t(0.4))
            copy = T("copies the source folder here", SMALL, MUTED).next_to(tool, RIGHT, buff=0.5)
            self.play(FadeIn(copy), run_time=b.t(0.25))

        with self.beat("compile") as b:
            gates = VGroup(*[r.box for r in rows[1:4]])
            brace = Brace(gates, RIGHT, color=CREATION, buff=0.15)
            three = T("3 gates", LABEL, CREATION, bold=True).next_to(brace, RIGHT, buff=0.15)
            self.play(GrowArrow(downs[0]), FadeIn(rows[1], shift=DOWN * 0.1), run_time=b.t(0.2))
            self.play(GrowFromCenter(brace), FadeIn(three), run_time=b.t(0.15))
            _at(self, b, 0.65)
            term = caption("esbuild: a fast JavaScript bundler")
            self.play(FadeIn(term), run_time=b.t(0.12))

        with self.beat("lint") as b:
            self.play(GrowArrow(downs[1]), FadeIn(rows[2], shift=DOWN * 0.1), run_time=b.t(0.12))
            t2 = caption("oxlint: a fast linter")
            _at(self, b, 0.33)
            self.play(FadeTransform(term, t2), run_time=b.t(0.1))
            _at(self, b, 0.52)
            t3 = caption("tsgolint: type check on the Go port of the TypeScript compiler")
            self.play(FadeTransform(t2, t3), run_time=b.t(0.1))

        with self.beat("test") as b:
            self.play(GrowArrow(downs[2]), FadeIn(rows[3], shift=DOWN * 0.1), FadeOut(t3), run_time=b.t(0.3))

        with self.beat("fail") as b:
            x = _cross().move_to([brace.get_x() + 0.6, rows[2].get_y(), 0])
            self.play(FadeOut(VGroup(brace, three)), run_time=b.t(0.15))
            self.play(Create(x), rows[2].box.animate.set_stroke(ISOLATION), run_time=b.t(0.2))
            ghost = rows[4].copy().set_opacity(DIM)
            strike = _strike(ghost.box)
            nothing = caption("nothing was installed: the code never reaches the host", color=ISOLATION)
            self.play(FadeIn(ghost), Create(strike), FadeIn(nothing), run_time=b.t(0.3))

        with self.beat("install") as b:
            self.play(FadeOut(VGroup(x, strike, nothing)), rows[2].box.animate.set_stroke(CREATION),
                      run_time=b.t(0.2))
            self.play(GrowArrow(downs[3]), FadeOut(ghost), FadeIn(rows[4]), run_time=b.t(0.25))
            live = caption("the plugin manager installs the bundle while the app runs", color=HOST)
            ticks = VGroup(*[_tick().scale(0.7).next_to(r, RIGHT, buff=0.25) for r in rows[1:4]])
            self.play(FadeIn(ticks, lag_ratio=0.2), FadeIn(live), run_time=b.t(0.3))


# ====================================================================== today_paths_map
class TodayPathsMap(DWScene):
    # beat starts (s): explain 7.29, zod 11.52, rule 17.04, halves 23.31, measured 30.87
    BEATS = [("code", 7.29), ("explain", 4.23), ("zod", 5.52), ("rule", 6.27), ("halves", 7.56), ("measured", 5.53)]

    TSCONFIG = """\
compilerOptions: {
  moduleResolution: 'bundler',
  ...
  paths: { zod: [t.zod] },
}"""

    PKG = """\
{
  "version": "1.0.0",
  "type": "module",
  "exports": "./index.js",
  ...
}"""

    def construct(self):
        with self.beat("code") as b:
            title = scene_title("The paths map of the compile gate", CREATION)
            head = T("creation.ts  writeConfigs > tsconfig.json", SMALL, CREATION, mono=True)
            code = code_block(self.TSCONFIG, "typescript", color=CREATION)
            head.move_to([_X0, 2.6, 0], aligned_edge=LEFT)
            code.next_to(head, DOWN, buff=0.15).align_to(head, LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.2))
            self.play(FadeIn(head), FadeIn(code, shift=UP * 0.1), run_time=b.t(0.3))
            mark = mark_line(code, 3)
            self.play(Create(mark), run_time=b.t(0.2))

        with self.beat("explain") as b:
            imp = chip("from 'zod'", AGENT)
            dst = chip("t.zod", CREATION)
            lab1 = T("bare import name", SMALL, MUTED)
            lab2 = T("where it resolves", SMALL, MUTED)
            pair = VGroup(imp, dst).arrange(RIGHT, buff=1.4)
            pair.move_to([(code.get_right()[0] + _X1) / 2, 1.6, 0])
            a = labeled_arrow(imp.get_right(), dst.get_left(), "paths", CREATION, buff=0.1)
            lab1.next_to(imp, DOWN, buff=0.15)
            lab2.next_to(dst, DOWN, buff=0.15)
            self.play(FadeIn(imp), FadeIn(lab1), run_time=b.t(0.25))
            self.play(GrowArrow(a.arrow), FadeIn(a.label), FadeIn(dst), FadeIn(lab2), run_time=b.t(0.35))
            explain = VGroup(pair, a, lab1, lab2)

        with self.beat("zod") as b:
            one = M("today: <b>one entry</b>, " + _mono("zod", CREATION), SMALL)
            what = T("zod: a library that checks data shapes", SMALL, MUTED)
            note = VGroup(one, what).arrange(DOWN, buff=0.12, aligned_edge=LEFT)
            note.next_to(code, DOWN, buff=0.25).align_to(code, LEFT)
            self.play(Indicate(code.code_lines[3], color=CREATION, scale_factor=1.04), FadeIn(one), run_time=b.t(0.35))
            self.play(FadeIn(what), run_time=b.t(0.25))

        with self.beat("rule") as b:
            rule = _card("widget_guide rule", ["Only zod and the types of deepwidgets:widget",
                                               "can be imported."], AGENT, size=SMALL)
            rule.move_to([_X1 - rule.width / 2, 0, 0]).align_to(explain, UP).shift(DOWN * 0.0)
            self.play(FadeOut(explain), run_time=b.t(0.15))
            rule.move_to([_X1 - rule.width / 2, 0, 0]).align_to(code, UP)
            self.play(FadeIn(rule, shift=DOWN * 0.1), run_time=b.t(0.35))

        with self.beat("halves") as b:
            halves, sizes = VGroup(), VGroup()
            for slug in ("shadcn", "clock", "meter"):
                box = rbox(2.6, 1.05, HOST, fill=0.06)
                t = T(f"{slug} host half", SMALL, HOST).move_to(box.get_top() + DOWN * 0.27)
                bar = Rectangle(width=2.25, height=0.36, stroke_width=0, fill_color=CREATION, fill_opacity=0.75)
                z = T("zod", SMALL, BG, mono=True, bold=True).move_to(bar)
                bar_g = VGroup(bar, z).move_to(box.get_bottom() + UP * 0.32)
                halves.add(VGroup(box, t, bar_g))
                sizes.add(T("zod 545 KB", SMALL, BG, mono=True, bold=True).move_to(bar))
            halves.arrange(RIGHT, buff=0.25)
            halves.move_to([_X0 + halves.width / 2, -2.2, 0])
            for h, z in zip(halves, sizes):
                z.move_to(h[2])
            what_half = caption("host half: the part of a widget that runs in the host")
            self.play(FadeOut(note), run_time=b.t(0.1))
            self.play(LaggedStart(*[FadeIn(h[0]) for h in halves], lag_ratio=0.2), FadeIn(VGroup(*[h[1] for h in halves])),
                      run_time=b.t(0.2))
            esb = T("esbuild puts a copy of zod into each host half", SMALL, CREATION)
            esb.next_to(halves, UP, buff=0.2).align_to(halves, LEFT)
            self.play(LaggedStart(*[FadeIn(h[2], shift=DOWN * 0.15) for h in halves], lag_ratio=0.25),
                      FadeIn(esb), run_time=b.t(0.3))
            _at(self, b, 0.6)
            self.play(FadeIn(what_half), run_time=b.t(0.15))

        with self.beat("measured") as b:
            meas = VGroup(T("zod in each host half:", SMALL, MEASURED),
                          M("<b>545 KB</b> (measured)", SMALL, MEASURED)).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            meas.next_to(halves, RIGHT, buff=0.35)
            self.play(*[FadeTransform(h[2][1], z) for h, z in zip(halves, sizes)], FadeIn(meas), run_time=b.t(0.25))
            pkg_head = T("bundle package.json", SMALL, HOST, mono=True)
            pkg = code_block(self.PKG, "json", color=HOST)
            nodeps = T("no dependencies field", SMALL, ISOLATION)
            pk = VGroup(pkg_head, pkg).arrange(DOWN, buff=0.12, aligned_edge=LEFT)
            pk.move_to([_X1 - pk.width / 2, 0, 0]).align_to(head, UP)
            self.play(FadeOut(rule), run_time=b.t(0.1))
            self.play(FadeIn(pk, shift=UP * 0.1), run_time=b.t(0.25))
            nodeps.next_to(pkg, DOWN, buff=0.15).align_to(pkg, LEFT)
            self.play(FadeIn(nodeps), run_time=b.t(0.15))


# ====================================================================== today_serving
class TodayServing(DWScene):
    # beat starts (s): widget 2.58, same 12.66, other 17.38, api 23.22, cookie 28.23
    BEATS = [("ask", 2.58), ("widget", 10.08), ("same", 4.72), ("other", 5.84), ("api", 5.01), ("cookie", 4.25)]

    def construct(self):
        with self.beat("ask") as b:
            outline = OutlineDiagram()
            self.play(FadeIn(outline), run_time=b.t(0.25))
            self.play(outline.highlight("electron_main"), run_time=b.t(0.3))
            self.play(FadeOut(outline), run_time=b.left)

        with self.beat("widget") as b:
            title = scene_title("Today: serving a widget page", SERVING)
            em = M("<b>Electron main</b>   " + _mono("protocol.handle", SERVING)
                   + "  answers each " + _mono("dsh-app://") + " request", SMALL, SERVING)
            em_box = rbox(_X1 - _X0, em.height + 0.4, SERVING, fill=0.1)
            em_box.move_to([0, 2.45, 0])
            em.move_to(em_box)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(em_box), FadeIn(em), run_time=b.t(0.2))
            ys = [1.45, 1.1, 0.75]
            reqs = [M(_mono("dsh-app://app") + _mono("/widget/", SERVING) + _mono(f"?slug={s}", SHELL), SMALL)
                    for s in ("meter", "shadcn", "clock")]
            for r, y in zip(reqs, ys):
                r.move_to([_X0 + r.width / 2, y, 0])
            dst = lines("@deepwidgets/shell/dist/widget/", "index.html", size=SMALL, mono=True)
            dst.move_to([_X1 - dst.width / 2, ys[1], 0])
            a1 = _arr(reqs[0].get_right() + RIGHT * 0.12, [dst.get_left()[0] - 0.12, ys[0], 0], SERVING, buff=0)
            self.play(FadeIn(reqs[0], shift=RIGHT * 0.15), run_time=b.t(0.15))
            _at(self, b, 0.5)
            self.play(GrowArrow(a1), FadeIn(dst), run_time=b.t(0.2))
            shell_lbl = T("shell build folder, on disk", SMALL, SHELL)
            shell_lbl.next_to(dst, DOWN, buff=0.15).align_to(dst, LEFT)
            self.play(FadeIn(shell_lbl), run_time=b.t(0.1))

        with self.beat("same") as b:
            self.play(FadeIn(VGroup(*reqs[1:]), shift=DOWN * 0.1, lag_ratio=0.3), run_time=b.t(0.25))
            more = VGroup(*[_arr(r.get_right() + RIGHT * 0.12, [dst.get_left()[0] - 0.12, y, 0], SERVING,
                                 buff=0, sw=2.5, tip=0.14) for r, y in zip(reqs[1:], ys[1:])])
            self.play(LaggedStart(*[GrowArrow(m) for m in more], lag_ratio=0.3), run_time=b.t(0.2))
            same = T("same index page for every slug; the slug is in the query string", SMALL, SHELL)
            same.next_to(reqs[2], DOWN, buff=0.2).align_to(reqs[2], LEFT)
            self.play(FadeOut(shell_lbl), FadeIn(same), run_time=b.t(0.2))

        with self.beat("other") as b:
            y = -0.55
            req2 = T("/   /index.html   /assets/*", SMALL, TEXT, mono=True)
            req2.move_to([_X0 + req2.width / 2, y, 0])
            dst2 = T("dsh-web-frontend/dist", SMALL, TEXT, mono=True)
            dst2.move_to([_X1 - dst.width + dst2.width / 2, y, 0])
            disk2 = disk_icon(MUTED, 0.4).next_to(dst2, LEFT, buff=0.15)
            a2 = _arr(req2.get_right() + RIGHT * 0.12, disk2.get_left() + LEFT * 0.12, MUTED, buff=0)
            web = T("DSH web folder, on disk", SMALL, MUTED).next_to(dst2, DOWN, buff=0.12).align_to(dst2, LEFT)
            self.play(FadeIn(req2), run_time=b.t(0.25))
            self.play(GrowArrow(a2), FadeIn(dst2), FadeIn(disk2), FadeIn(web), run_time=b.t(0.3))

        with self.beat("api") as b:
            y = -1.9
            req3 = M(_mono("dsh-app://app") + _mono("/api/widgets/meter/program", HOST), SMALL)
            req3.move_to([_X0 + req3.width / 2, y, 0])
            host = ProcessBox("host", "127.0.0.1:<port>", HOST)
            host.move_to([_X1 - host.width / 2, y, 0])
            a3 = _arr(req3.get_right() + RIGHT * 0.12, host.get_left() + LEFT * 0.1, HOST, buff=0)
            cookie = chip("+ host cookie", HOST, mono=True)
            cookie.next_to(a3, UP, buff=0.12)
            self.play(FadeIn(req3), run_time=b.t(0.25))
            self.play(GrowArrow(a3), FadeIn(host), run_time=b.t(0.3))
            self.play(FadeIn(cookie, shift=UP * 0.1), run_time=b.t(0.2))

        with self.beat("cookie") as b:
            tick = _tick(SOLVED).scale(0.8)
            chk = T("checks the cookie", SMALL, HOST)
            ck = VGroup(chk, tick).arrange(RIGHT, buff=0.15).next_to(a3, DOWN, buff=0.15).align_to(a3, RIGHT)
            self.play(Indicate(host.box, color=HOST, scale_factor=1.05), run_time=b.t(0.2))
            self.play(Create(tick), FadeIn(chk), run_time=b.t(0.2))
            cap = caption("the page reaches the host only through these routes")
            self.play(FadeIn(cap), run_time=b.t(0.2))


# ====================================================================== today_agent_text
class TodayAgentText(DWScene):
    # beat starts (s): tools 6.59, guide 10.2, content 13.94, fixed 22.81, close 25.84
    BEATS = [("instr", 6.59), ("tools", 3.61), ("guide", 3.74), ("content", 8.87), ("fixed", 3.03), ("close", 4.88)]

    TOOLS = ["widget_list", "widget_describe", "widget_call", "widget_changes", "widget_template",
             "widget_guide", "widget_install", "widget_reload", "widget_remove"]

    def construct(self):
        with self.beat("instr") as b:
            title = scene_title("What an agent reads today", MCP)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.15))
            ih = M("<b>instructions</b>  (fixed)", SMALL, MCP)
            it = lines("deepWidgets: desktop widgets. Call widget_list,",
                       "then widget_describe, then widget_call...", size=SMALL, mono=True)
            instr = VGroup(ih, it).arrange(DOWN, buff=0.12, aligned_edge=LEFT)
            instr.move_to([_X0 + 0.35 + instr.width / 2, 2.2, 0])
            self.play(FadeIn(ih), run_time=b.t(0.15))
            self.play(FadeIn(it, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("tools") as b:
            th = M("<b>9 tools</b>, each with a fixed description", SMALL, MCP)
            chips = []
            for name in self.TOOLS:
                c = chip(name, MCP)
                lk = _lock(MUTED).next_to(c, RIGHT, buff=0.12)
                chips.append(VGroup(c, lk))
            grid = VGroup(*chips).arrange_in_grid(rows=3, cols=3, buff=(0.45, 0.16), cell_alignment=LEFT)
            tools = VGroup(th, grid).arrange(DOWN, buff=0.2, aligned_edge=LEFT)
            tools.next_to(instr, DOWN, buff=0.4).align_to(instr, LEFT)
            legend = VGroup(_lock(MUTED), T("description fixed", SMALL, MUTED)).arrange(RIGHT, buff=0.15)
            legend.next_to(th, RIGHT, buff=0.5)
            self.play(FadeIn(th), run_time=b.t(0.15))
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.08) for c in chips], lag_ratio=0.12), FadeIn(legend),
                      run_time=b.t(0.5))

        with self.beat("guide") as b:
            g_chip = chips[5]
            gh = M(_mono("widget_guide", MCP) + "  returns the guide as tool output", SMALL)
            gh.next_to(tools, DOWN, buff=0.4).align_to(tools, LEFT)
            self.play(Indicate(g_chip, color=MCP, scale_factor=1.08), run_time=b.t(0.3))
            self.play(FadeIn(gh), run_time=b.t(0.25))

        with self.beat("content") as b:
            parts = [chip("API types", MCP, mono=False), chip("gate rules", CREATION, mono=False),
                     chip("OpenUI guide", SHELL, mono=False)]
            plus = [T("+", LABEL, MUTED) for _ in range(2)]
            row = VGroup(parts[0], plus[0], parts[1], plus[1], parts[2]).arrange(RIGHT, buff=0.2)
            row.next_to(gh, DOWN, buff=0.22).align_to(gh, LEFT)
            size = M(_mono("guide.md") + "  <b>16,195 bytes</b>", SMALL, MEASURED)
            size.next_to(row, RIGHT, buff=0.35)
            self.play(LaggedStart(*[FadeIn(m) for m in row], lag_ratio=0.25), run_time=b.t(0.35))
            _at(self, b, 0.6)
            self.play(Indicate(parts[2], color=SHELL, scale_factor=1.06), FadeIn(size), run_time=b.t(0.25))

        with self.beat("fixed") as b:
            box = SurroundingRectangle(VGroup(instr, tools, gh, row, size), color=MCP, buff=0.3,
                                       stroke_width=3, corner_radius=0.14)
            server = T("MCP server", LABEL, MCP, bold=True).next_to(box, UP, buff=0.08).align_to(box, RIGHT)
            cap = caption("none of this changes during a session")
            self.play(Create(box), FadeIn(server), FadeIn(cap), run_time=b.t(0.4))

        with self.beat("close") as b:
            OutlineDiagram().close_part(self, "shell", next_key="agent_library", run_time=b.left)
