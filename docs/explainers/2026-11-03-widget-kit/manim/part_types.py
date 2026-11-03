"""Part `part_types`: types_why types_tsc types_config types_tsgolint types_error_path types_work.
The type gate of the kit: tsc or oxlint with tsgolint, in front of the Vite build.

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


def _mono(s, color=None):
    c = f' fgcolor="{color}"' if color else ""
    return f'<span font_family="{MONO}"{c}>{s}</span>'


def _note(rows, color=INFERRED, size=SMALL, dashed=False):
    """A boxed note of one or more text lines (str or mobject) in the concept color."""
    ms = [T(r, size, color) if isinstance(r, str) else r for r in rows]
    txt = VGroup(*ms).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
    box = rbox(txt.width + 0.45, txt.height + 0.35, color, fill=0.1, sw=2, r=0.1, dashed=dashed)
    txt.move_to(box)
    g = VGroup(box, txt)
    g.box, g.txt = box, txt
    return g


# ====================================================================== types_why
class TypesWhy(DWScene):
    # beat starts at sentence pauses of the final audio (s): check 4.5, catch 7.85, strip 10.75, without 13.9
    BEATS = [("open", 4.5), ("check", 3.35), ("catch", 2.9), ("strip", 3.15), ("without", 4.82)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "type_gate", also=("vite_build",), arrows=("arrow_type_vite",),
                                       run_time=b.left)

        with self.beat("check") as b:
            title = scene_title("The type gate", CREATION)
            agent = ProcessBox("agent code", "src/agent", AGENT, height=1.3)
            vite = ProcessBox("Vite build", "per widget", VITE, width=2.9, height=1.3)
            gate = ProcessBox("type gate", "TypeScript types", CREATION, width=3.2, height=1.3)
            row = VGroup(agent, gate, vite).arrange(RIGHT, buff=1.1).move_to([0, 1.5, 0])
            a1 = _arr(agent.get_right(), gate.get_left(), AGENT)
            a2 = _arr(gate.get_right(), vite.get_left(), CREATION)
            before = T("before the build", SMALL, MUTED).next_to(gate, DOWN, buff=0.18)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(agent), FadeIn(vite), run_time=b.t(0.25))
            self.play(GrowFromCenter(gate), GrowArrow(a1), GrowArrow(a2), run_time=b.t(0.3))
            self.play(FadeIn(before), run_time=b.t(0.2))

        with self.beat("catch") as b:
            catch = VGroup(_tick(CREATION), T("catches props a component does not have", BODY))
            catch.arrange(RIGHT, buff=0.25)
            catch.move_to([0, -0.05, 0])
            self.play(Indicate(gate, color=CREATION, scale_factor=1.05), run_time=b.t(0.3))
            self.play(FadeIn(catch, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("strip") as b:
            strip = M(_mono("Vite / esbuild", VITE) + ":  strip types only", BODY)
            strip.next_to(catch, DOWN, buff=0.35)
            self.play(Indicate(vite, color=VITE, scale_factor=1.05), FadeIn(strip, shift=UP * 0.1),
                      run_time=b.t(0.45))

        with self.beat("without") as b:
            err = chip("type error", ISOLATION, mono=False, size=LABEL)
            rc = chip("render check", CREATION, mono=False, size=LABEL)
            usr = chip("user", USER, mono=False, size=LABEL)
            orr = T("or", LABEL, MUTED)
            path = VGroup(err, rc, orr, usr).arrange(RIGHT, buff=0.55).move_to([0, -2.3, 0])
            p1 = _arr(err.get_right(), rc.get_left(), ISOLATION)
            no_gate = M("<b>without the gate:</b>", LABEL, ISOLATION)
            no_gate.next_to(path, UP, buff=0.25).align_to(path, LEFT)
            self.play(gate.animate.set_opacity(DIM), a2.animate.set_opacity(DIM), run_time=b.t(0.15))
            self.play(FadeIn(no_gate), FadeIn(err, shift=RIGHT * 0.1), run_time=b.t(0.2))
            self.play(GrowArrow(p1), FadeIn(rc), run_time=b.t(0.2))
            self.play(FadeIn(orr), FadeIn(usr), run_time=b.t(0.2))


# ====================================================================== types_tsc
class TypesTsc(DWScene):
    # beat starts (s): strict 4.5, shadcn 9.5, clock 13.55, meter 16.4
    BEATS = [("tsc", 4.5), ("strict", 5.0), ("shadcn", 4.05), ("clock", 2.85), ("meter", 2.88)]

    ROWS = [("shadcn", "1.4 to 1.9 s"), ("clock", "0.62 to 0.66 s"), ("meter", "0.53 to 0.58 s")]

    def construct(self):
        with self.beat("tsc") as b:
            title = scene_title("Type gate tool one: tsc", CREATION)
            cmd = T("tsc -p .", HEADING, CREATION, mono=True)
            what = T("TypeScript compiler, check mode", LABEL, TEXT)
            head = VGroup(cmd, what).arrange(DOWN, buff=0.18, aligned_edge=LEFT)
            head.move_to([_X0 + 0.35 + head.width / 2, 1.9, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.2))
            self.play(FadeIn(cmd, shift=RIGHT * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(what), run_time=b.t(0.25))

        with self.beat("strict") as b:
            fh = T("tsconfig flags", LABEL, MUTED, bold=True)
            flags = VGroup(*[chip(f, CREATION) for f in
                             ("strict", "noUncheckedIndexedAccess", "exactOptionalPropertyTypes")])
            flags.arrange(DOWN, buff=0.16, aligned_edge=LEFT)
            fg = VGroup(fh, flags).arrange(DOWN, buff=0.2, aligned_edge=LEFT)
            fg.next_to(head, DOWN, buff=0.55).align_to(head, LEFT)
            card = SurroundingRectangle(VGroup(head, fg), color=CREATION, buff=0.35, stroke_width=3,
                                        corner_radius=0.14)
            self.play(Create(card), FadeIn(fh), run_time=b.t(0.25))
            self.play(LaggedStart(*[FadeIn(c, shift=RIGHT * 0.1) for c in flags], lag_ratio=0.35),
                      run_time=b.t(0.5))

        tbl = RevealTable(["widget", "tsc time (measured)"], self.ROWS, mono_cols=[0, 1], size=LABEL,
                          row_gap=0.22, col_gap=0.9)
        tbl.move_to([3.4, 0.9, 0])
        for i, beat in enumerate(("shadcn", "clock", "meter")):
            with self.beat(beat) as b:
                if i == 0:
                    self.add(tbl)
                    self.play(FadeIn(tbl.header), run_time=b.t(0.2))
                self.play(tbl.reveal_row(i), run_time=b.t(0.3))


# ====================================================================== types_config
class TypesConfig(DWScene):
    # beat starts (s): agent 3.9, core 6.45, other 10.4, skip 17.85, refuse 24.6, declare 30.0
    BEATS = [("aliases", 3.9), ("agent", 2.55), ("core", 3.95), ("other", 7.45), ("skip", 6.75), ("refuse", 5.4),
             ("declare", 7.6)]

    CONF = """\
"paths": {
  "@agent/*": ["./src/agent/*"],
  "@core/*": ["./src/*"]
},
"skipLibCheck": true,
"types": []"""

    def construct(self):
        rx = 0.2  # left edge of the right column

        with self.beat("aliases") as b:
            title = scene_title("The spike tsconfig", CREATION)
            path = M(_mono("core/tsconfig.json", CREATION) + "  compilerOptions, excerpt", LABEL, MUTED)
            code = code_block(self.CONF, "json", color=CREATION)
            path.move_to([_X0, 2.6, 0], aligned_edge=LEFT)
            code.next_to(path, DOWN, buff=0.15).align_to(path, LEFT)
            hide_lines(code, 1, 3)
            hide_lines(code, 4, 6)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(path), FadeIn(code), run_time=b.t(0.5))

        with self.beat("agent") as b:
            self.play(reveal_lines(code, 1), run_time=b.t(0.3))
            m_agent = mark_line(code, 1, AGENT)
            t_agent = M(_mono("@agent", AGENT) + "  =  agent folder", LABEL)
            t_agent.move_to([rx, 2.2, 0], aligned_edge=LEFT)
            self.play(Create(m_agent), FadeIn(t_agent, shift=LEFT * 0.1), run_time=b.t(0.4))

        with self.beat("core") as b:
            self.play(reveal_lines(code, 2), run_time=b.t(0.2))
            m_core = mark_line(code, 2, KIT)
            t_core = M(_mono("@core", KIT) + "  =  core source", LABEL)
            t_core.next_to(t_agent, DOWN, buff=0.25).align_to(t_agent, LEFT)
            t_contract = M("where " + _mono("contract.ts", KIT) + " lives", SMALL, MUTED)
            t_contract.next_to(t_core, DOWN, buff=0.12).align_to(t_core, LEFT)
            self.play(Create(m_core), FadeIn(t_core, shift=LEFT * 0.1), run_time=b.t(0.35))
            self.play(FadeIn(t_contract), run_time=b.t(0.25))

        with self.beat("other") as b:
            oth = chip("other imports", AGENT, mono=False)
            nm = chip("node_modules -> kit", KIT)
            oth.next_to(t_contract, DOWN, buff=0.3).align_to(t_core, LEFT)
            nm.next_to(oth, RIGHT, buff=0.4)
            a = _arr(oth.get_right(), nm.get_left(), KIT)
            self.play(FadeIn(oth), run_time=b.t(0.15))
            self.play(GrowArrow(a), FadeIn(nm, shift=RIGHT * 0.1), run_time=b.t(0.2))
            real = VGroup(_tick(SOLVED, 0.16), T("real types of each extra", LABEL, TEXT)).arrange(RIGHT, buff=0.2)
            real.next_to(oth, DOWN, buff=0.22).align_to(oth, LEFT)
            _at(self, b, 0.55)
            self.play(FadeIn(real, shift=UP * 0.1), run_time=b.t(0.2))

        with self.beat("skip") as b:
            self.play(reveal_lines(code, 4), run_time=b.t(0.2))
            m_skip = mark_line(code, 4, CREATION)
            t_skip = VGroup(T("package .d.ts files: not checked", LABEL, TEXT),
                            T("keeps the gate fast", LABEL, CREATION))
            t_skip.arrange(DOWN, buff=0.12, aligned_edge=LEFT)
            t_skip.next_to(real, DOWN, buff=0.3).align_to(real, LEFT)
            self.play(Create(m_skip), FadeIn(t_skip[0], shift=UP * 0.1), run_time=b.t(0.3))
            _at(self, b, 0.75)
            self.play(FadeIn(t_skip[1]), reveal_lines(code, 5), run_time=b.t(0.2))

        with self.beat("refuse") as b:
            n1 = _note(["extra with no .d.ts: tsc refuses, TS7016 (ran)"], INFERRED, SMALL)
            n1.next_to(code, DOWN, buff=0.3).align_to(code, LEFT)
            self.play(FadeIn(n1, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("declare") as b:
            decl = T("declare module 'x'", LABEL, AGENT, mono=True)
            decl.next_to(n1, DOWN, buff=0.3).align_to(n1, LEFT)
            self.play(FadeIn(decl, shift=RIGHT * 0.1), run_time=b.t(0.2))
            n2 = _note(["after declare module: no type help, render check only guard"], INFERRED, LABEL)
            n2.next_to(decl, DOWN, buff=0.25).align_to(decl, LEFT).shift(RIGHT * 0.6)
            a2 = _arr(decl.get_bottom() + LEFT * (decl.width / 2 - 0.3), n2.get_left() + LEFT * 0.02, INFERRED,
                      buff=0.06)
            _at(self, b, 0.3)
            self.play(GrowArrow(a2), FadeIn(n2, shift=RIGHT * 0.1), run_time=b.t(0.25))


# ====================================================================== types_tsgolint
class TypesTsgolint(DWScene):
    # beat starts (s): today 3.55, times 6.3, clock 12.0, faster 14.05, same 18.6, open 22.0
    BEATS = [("card", 3.55), ("today", 2.75), ("times", 5.7), ("clock", 2.05), ("faster", 4.55), ("same", 3.4),
             ("open", 5.12)]

    ROWS = [("shadcn", "0.29 to 0.55 s"), ("meter", "0.11 to 0.12 s"), ("clock", "not run")]

    def construct(self):
        with self.beat("card") as b:
            title = scene_title("Type gate tool two: oxlint with tsgolint", CREATION)
            cmd = T("oxlint --type-aware (tsgolint)", BODY, CREATION, mono=True)
            cmd.move_to([_X0 + 0.35, 2.2, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))
            self.play(FadeIn(cmd, shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("today") as b:
            today = M("today's lint gate uses it  (" + _mono("creation.ts", MCP) + ")", LABEL)
            today.next_to(cmd, DOWN, buff=0.22).align_to(cmd, LEFT)
            self.play(FadeIn(today, shift=UP * 0.1), run_time=b.t(0.4))

        tbl = RevealTable(["widget", "oxlint time (measured)"], self.ROWS, mono_cols=[0, 1], size=LABEL,
                          row_gap=0.22, col_gap=0.9, cell_colors={(2, 1): MUTED})
        tbl.next_to(today, DOWN, buff=0.6).align_to(cmd, LEFT)

        with self.beat("times") as b:
            self.add(tbl)
            self.play(FadeIn(tbl.header), run_time=b.t(0.15))
            self.play(tbl.reveal_rows(0, 2), run_time=b.t(0.4))

        with self.beat("clock") as b:
            self.play(tbl.reveal_row(2), run_time=b.t(0.4))

        with self.beat("faster") as b:
            fast = chip("about 3x to 5x faster than tsc (computed)", CREATION, mono=False, size=LABEL)
            fast.next_to(tbl, DOWN, buff=0.45).align_to(tbl, LEFT)
            self.play(FadeIn(fast, shift=UP * 0.1), run_time=b.t(0.3))

        rx = tbl.get_right()[0] + 0.9
        with self.beat("same") as b:
            same = VGroup(_tick(SOLVED), T("same v2b error found", LABEL, TEXT),
                          T("(meter)", LABEL, MUTED)).arrange(RIGHT, buff=0.2)
            same.move_to([rx, tbl.body_rows[0].get_y(), 0], aligned_edge=LEFT)
            self.play(Create(same[0]), FadeIn(same[1:], shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("open") as b:
            either = T("either tool can run the gate", LABEL, TEXT)
            either.next_to(same, DOWN, buff=0.45).align_to(same, LEFT)
            tag = status_chip("tool not decided", solved=False)
            tag.next_to(either, DOWN, buff=0.3).align_to(either, LEFT)
            self.play(FadeIn(either, shift=UP * 0.1), run_time=b.t(0.25))
            _at(self, b, 0.4)
            self.play(FadeIn(tag, shift=UP * 0.1), run_time=b.t(0.25))


# ====================================================================== types_error_path
class TypesErrorPath(DWScene):
    # beat starts (s): code 2.6, diag 6.65, next 12.3, infer 18.7
    BEATS = [("ask", 2.6), ("code", 4.05), ("diag", 5.65), ("next", 6.4), ("infer", 4.06)]

    ANSWER = """\
code: 'gate-failed',
gate: 'lint',
diagnostics: ['src/index.ts:12:5: ...'],
nextStep: 'Fix the code at each diagnostic,
  then call widget_install again
  with the same folder.
  Nothing was installed.'"""

    def construct(self):
        with self.beat("ask") as b:
            title = scene_title("How a type error reaches the agent", CREATION)
            src = M("today: " + _mono("deepwidgets/mcp/src/index.ts", MCP) + "  NEXT_STEP", LABEL, MUTED)
            src.move_to([_X0, 2.6, 0], aligned_edge=LEFT)
            code = code_block(self.ANSWER, "javascript", color=MCP)
            code.next_to(src, DOWN, buff=0.15).align_to(src, LEFT)
            hide_lines(code)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(src), FadeIn(code.background), run_time=b.t(0.35))

        with self.beat("code") as b:
            self.play(reveal_lines(code, 0), run_time=b.t(0.3))
            m1 = mark_line(code, 0, ISOLATION)
            self.play(Create(m1), run_time=b.t(0.2))

        with self.beat("diag") as b:
            self.play(FadeOut(m1), reveal_lines(code, 1), run_time=b.t(0.2))
            _at(self, b, 0.3)
            self.play(reveal_lines(code, 2), run_time=b.t(0.2))
            fl = T("file:line:column", LABEL, CREATION, mono=True)
            fl.next_to(code, RIGHT, buff=0.4).match_y(code.code_lines[2])
            self.play(FadeIn(fl, shift=LEFT * 0.1), run_time=b.t(0.2))

        with self.beat("next") as b:
            self.play(reveal_lines(code, 3, 7, lag=0.3), run_time=b.t(0.4))
            nothing = VGroup(_cross(ISOLATION, 0.14), T("nothing installs", LABEL, ISOLATION)).arrange(RIGHT, buff=0.2)
            nothing.next_to(code, RIGHT, buff=0.4).match_y(code.code_lines[6])
            _at(self, b, 0.78)
            self.play(FadeIn(nothing, shift=LEFT * 0.1), run_time=b.t(0.18))

        with self.beat("infer") as b:
            tag = chip("same shape for the kit type gate (inferred)", INFERRED, mono=False, size=LABEL)
            slot = M("diagnostics: [" + _mono("'src/agent/library.tsx(8,36): error TS2322 ...'", AGENT) + "]",
                     SMALL, TEXT, mono=True)
            grp = VGroup(tag, slot).arrange(DOWN, buff=0.22, aligned_edge=LEFT)
            grp.next_to(code, DOWN, buff=0.35).align_to(code, LEFT)
            self.play(FadeOut(fl), FadeIn(tag, shift=UP * 0.1), run_time=b.t(0.25))
            self.play(Indicate(code.code_lines[2], color=AGENT, scale_factor=1.03), FadeIn(slot, shift=UP * 0.1),
                      run_time=b.t(0.3))


# ====================================================================== types_work
class TypesWork(DWScene):
    # beat starts (s): writes 5.9, fail 11.7, row 15.5, close 19.5 (n2 lands in the pause before "We infer")
    BEATS = [("reads", 5.9), ("writes", 5.8), ("fail", 3.8), ("row", 4.0), ("close", 2.38)]

    def construct(self):
        outline = OutlineDiagram()
        lx, vx = _X0 + 0.3, _X0 + 2.6

        def label(t, y):
            return T(t, LABEL, MUTED, bold=True).move_to([lx, y, 0], aligned_edge=LEFT)

        def val(m, y):
            return m.move_to([vx, y, 0], aligned_edge=LEFT)

        with self.beat("reads") as b:
            title = scene_title("What the type gate reads and writes", CREATION)
            card = rbox(_X1 - _X0, 3.3, CREATION, fill=0.05)
            card.move_to([(_X0 + _X1) / 2, 1.2, 0])
            r_l = label("Reads", 2.3)
            reads = VGroup(T("src/agent", LABEL, AGENT, mono=True), T("core contract.ts", LABEL, KIT, mono=True),
                           M("kit " + _mono(".d.ts", KIT) + " files", LABEL))
            reads.arrange(RIGHT, buff=0.55)
            val(reads, 2.3)
            self.play(FadeIn(title, shift=RIGHT * 0.2), Create(card), FadeIn(r_l), run_time=b.t(0.3))
            self.play(LaggedStart(*[FadeIn(m, shift=RIGHT * 0.1) for m in reads], lag_ratio=0.4), run_time=b.t(0.5))

        with self.beat("writes") as b:
            w_l = label("Writes", 1.4)
            w1 = val(M("diagnostics  " + _mono("file:line:column", CREATION), LABEL), 1.4)
            w2 = val(T("as the lint gate does today", SMALL, MUTED), 0.95)
            self.play(FadeIn(w_l), FadeIn(w1, shift=RIGHT * 0.1), run_time=b.t(0.35))
            self.play(FadeIn(w2), run_time=b.t(0.25))

        with self.beat("fail") as b:
            f_l = label("On failure", 0.1)
            f1 = val(VGroup(_cross(ISOLATION, 0.13), T("nothing installs", LABEL, ISOLATION),
                            T("·  the agent gets the error text", LABEL, TEXT)).arrange(RIGHT, buff=0.2), 0.1)
            self.play(FadeIn(f_l), FadeIn(f1, shift=RIGHT * 0.1), run_time=b.t(0.45))

        with self.beat("row") as b:
            n1 = T("no own row in the work map", LABEL, TEXT)
            n2 = VGroup(T("part of the Vite build gate", LABEL, INFERRED), T("inferred", LABEL, INFERRED, bold=True))
            n2.arrange(RIGHT, buff=0.2)
            note = VGroup(n1, n2).arrange(DOWN, buff=0.15, aligned_edge=LEFT)
            nbox = rbox(note.width + 0.5, note.height + 0.4, INFERRED, fill=0.08, sw=2, r=0.1)
            note.move_to(nbox)
            ng = VGroup(nbox, note)
            ng.next_to(card, DOWN, buff=0.3).align_to(card, LEFT)
            self.play(FadeIn(nbox), FadeIn(n1, shift=UP * 0.1), run_time=b.t(0.3))
            _at(self, b, 0.8)
            self.play(FadeIn(n2, shift=UP * 0.1), run_time=b.t(0.18))

        with self.beat("close") as b:
            outline.close_part(self, "type_gate", next_key="kit_project", run_time=b.left)
