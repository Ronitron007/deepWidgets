"""Part `part_describe`: describe_problem describe_test describe_results describe_rule describe_cost
describe_work. The dynamic description: which MCP text Claude Code reads again when the kit changes
(spike `kit_spike.mcp`), the rule that follows, and the cost of a package list.

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


def _cross(color=ISOLATION, s=0.15):
    return VGroup(Line([-s, -s, 0], [s, s, 0], stroke_color=color, stroke_width=6),
                  Line([-s, s, 0], [s, -s, 0], stroke_color=color, stroke_width=6))


def _mono(s, color=None):
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    c = f' fgcolor="{color}"' if color else ""
    return f'<span font_family="{MONO}"{c}>{s}</span>'


def _strike(m, color=ISOLATION):
    """A line through m."""
    return Line(m.get_left() + LEFT * 0.08, m.get_right() + RIGHT * 0.08, stroke_color=color, stroke_width=5)


def _verdict(yes, size=LABEL):
    """Tick + yes, or cross + no."""
    icon = _tick(SOLVED) if yes else _cross(ISOLATION)
    word = T("yes" if yes else "no", size, SOLVED if yes else ISOLATION, bold=True)
    return VGroup(icon, word).arrange(RIGHT, buff=0.15)


# ====================================================================== describe_problem
class DescribeProblem(DWScene):
    # beat starts at sentence pauses of the final audio (s): change 3.4, which 8.7, resource 13.6, instr 18.8,
    # tooldesc 23.7
    BEATS = [("open", 3.4), ("change", 5.3), ("which", 4.9), ("resource", 5.2), ("instr", 4.9), ("tooldesc", 4.78)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "describe", also=("mcp_door", "agent"), arrows=("arrow_describe",),
                                       run_time=b.left)

        with self.beat("change") as b:
            title = scene_title("Which MCP text does the agent read again?", DESCRIBE)
            agent = ProcessBox("agent", "Claude Code", AGENT, width=3.0, height=1.3, sub_mono=False)
            agent.move_to([0, 0.2, 0])
            kit = chip("kit changes: new package list", KIT, mono=False, size=LABEL)
            kit.move_to([0, 2.35, 0])
            ka = _arr(kit.get_bottom(), agent.get_top(), KIT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(agent), run_time=b.t(0.25))
            _at(self, b, 0.4)
            self.play(FadeIn(kit, shift=DOWN * 0.1), GrowArrow(ka), run_time=b.t(0.3))

        srcs = {}
        with self.beat("which") as b:
            spec = [("instr", "server instructions", None, [-4.3, 1.45, 0], LEFT),
                    ("tooldesc", "tool description", None, [4.3, 1.45, 0], RIGHT),
                    ("output", "tool output", None, [-4.3, -1.25, 0], LEFT),
                    ("resource", "resource", "deepwidgets://kit/manifest", [4.1, -1.25, 0], RIGHT)]
            anims = []
            for key, title_s, sub, pos, side in spec:
                box = ProcessBox(title_s, sub, DESCRIBE, height=1.15)
                box.move_to(pos)
                q = T("?", TITLE, DESCRIBE, bold=True).next_to(box, UP, buff=0.08).align_to(box, side)
                if pos[1] > 0:
                    start = box.get_edge_center(-side)
                    end = agent.get_edge_center(side) + UP * 0.25
                else:
                    start = box.get_top() + (-side) * box.width * 0.3
                    end = agent.get_corner(DOWN + side) + (-side) * 0.45
                a = _arr(start, end, DESCRIBE, sw=2.5)
                a.set_opacity(0.6)
                srcs[key] = (box, q, a)
                anims.append(AnimationGroup(FadeIn(box), GrowArrow(a), FadeIn(q, scale=1.3)))
            self.play(LaggedStart(*anims, lag_ratio=0.25), run_time=b.t(0.75))

        defs = {
            "resource": ("MCP resource", "a named piece of data that a client reads on request"),
            "instr": ("server instructions", "a fixed text that the server sends at connect time"),
            "tooldesc": ("tool description", "the text that tells the agent what one tool does"),
        }
        shown = None
        for key in ("resource", "instr", "tooldesc"):
            with self.beat(key) as b:
                box, q, a = srcs[key]
                head, body = defs[key]
                d = M(f'<b>{head}</b>: {body}', LABEL, TEXT)
                d[:len(head)].set_color(DESCRIBE)
                d.move_to([0, -2.4, 0])
                anims = [Indicate(box, color=DESCRIBE, scale_factor=1.06), box.box.animate.set_stroke(width=5)]
                if shown is not None:
                    anims += [FadeOut(shown[0]), shown[1].box.animate.set_stroke(width=3)]
                self.play(*anims, FadeIn(d, shift=UP * 0.1), run_time=b.t(0.3))
                shown = (d, box)


# ====================================================================== describe_test
class DescribeTest(DWScene):
    # beat starts (s): server 5.5, third 12.4, fake 15.8, nopaid 20.1, bump 22.7, signal 29.5
    BEATS = [("claude", 5.5), ("server", 6.9), ("third", 3.4), ("fake", 4.3), ("nopaid", 2.6), ("bump", 6.8),
             ("signal", 5.34)]

    def construct(self):
        with self.beat("claude") as b:
            title = scene_title("The spike test", DESCRIBE)
            claude = ProcessBox("claude", "interactive, PTY", AGENT, height=1.3)
            claude.move_to([_X0 + claude.width / 2, 1.75, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))
            self.play(FadeIn(claude, shift=RIGHT * 0.1), run_time=b.t(0.35))

        sx0 = -1.75
        with self.beat("server") as b:
            head = VGroup(T("MCP server kitspike", LABEL, MCP, bold=True), T("127.0.0.1:48931", SMALL, TEXT, mono=True))
            head.arrange(RIGHT, buff=0.35, aligned_edge=DOWN)
            impl = T("createMcpHandler, legacy: 'stateless'", SMALL, MUTED, mono=True)
            tl = T("tools", SMALL, MUTED, bold=True)
            tools = VGroup(chip("kit_read", MCP), chip("kit_probe", MCP), chip("kit_added_v2", MCP, dashed=True))
            tools.arrange(RIGHT, buff=0.15)
            trow = VGroup(tl, tools).arrange(RIGHT, buff=0.3)
            ml = T("markers", SMALL, MUTED, bold=True)
            marks = VGroup(*[chip(m, DESCRIBE) for m in ("KIT_INSTR_V1", "KIT_TOOL_V1", "KIT_PROBE_V1", "KIT_RES_V1")])
            marks.arrange_in_grid(rows=2, cols=2, buff=(0.2, 0.12), cell_alignment=LEFT)
            mrow = VGroup(ml, marks).arrange(RIGHT, buff=0.3, aligned_edge=UP)
            body = VGroup(head, impl, trow, mrow).arrange(DOWN, buff=0.2, aligned_edge=LEFT)
            trow.shift(DOWN * 0.25)
            mrow.shift(DOWN * 0.25)
            sbox = rbox(_X1 - sx0, body.height + 0.5, MCP, fill=0.06)
            sbox.move_to([(sx0 + _X1) / 2, CONTENT_TOP - sbox.height / 2 - 0.05, 0])
            body.move_to(sbox).align_to(sbox, LEFT).shift(RIGHT * 0.3)
            # tool chip widths: line the marker grid up under the tools
            mrow.align_to(trow, LEFT)
            ml.align_to(tl, LEFT)
            a1 = _arr(claude.get_right(), [sx0, claude.get_y(), 0], AGENT)
            added = tools[2]
            added.set_opacity(0)
            self.play(Create(sbox), FadeIn(head), FadeIn(impl), GrowArrow(a1), run_time=b.t(0.25))
            self.play(FadeIn(tl), FadeIn(tools[0]), FadeIn(tools[1]), run_time=b.t(0.2))
            _at(self, b, 0.6)
            self.play(FadeIn(ml), LaggedStart(*[FadeIn(m, shift=UP * 0.08) for m in marks], lag_ratio=0.3),
                      run_time=b.t(0.35))

        with self.beat("third") as b:
            after = T("after the bump", SMALL, KIT).next_to(added, UP, buff=0.08)
            self.play(added.animate.set_opacity(1), FadeIn(after), run_time=b.t(0.4))
            # the dashed chip's fill goes back to its own low opacity
            added[0][0].set_fill(opacity=0.15)

        with self.beat("fake") as b:
            fb = VGroup(T("fake model API", LABEL, CHECKS, bold=True), T("127.0.0.1:48932", SMALL, TEXT, mono=True),
                        T("records /v1/messages", SMALL, MUTED, mono=True))
            fb.arrange(DOWN, buff=0.12, aligned_edge=LEFT)
            fbox = rbox(fb.width + 0.6, fb.height + 0.45, CHECKS, fill=0.06)
            fbox.move_to([_X0 + fbox.width / 2, 0.45 - fbox.height / 2, 0])
            fb.move_to(fbox)
            a2 = _arr([fbox.get_x(), claude.get_bottom()[1], 0], fbox.get_top(), AGENT)
            same = T("same machine", SMALL, MUTED).next_to(a2, RIGHT, buff=0.15)
            self.play(Create(fbox), FadeIn(fb), GrowArrow(a2), run_time=b.t(0.3))
            self.play(FadeIn(same), run_time=b.t(0.15))

        with self.beat("nopaid") as b:
            cap = caption("Claude Code 2.1.317, no paid run")
            self.play(FadeIn(cap, shift=UP * 0.1), Indicate(fbox, color=CHECKS, scale_factor=1.03), run_time=b.t(0.5))

        with self.beat("bump") as b:
            bump = chip("GET /ctl/bump", KIT, size=LABEL)
            note = lines("notify.toolsChanged(),", "resourcesChanged(), resourceUpdated()", size=SMALL,
                         color=DESCRIBE, mono=True, buff=0.1)
            brow = VGroup(bump, note).arrange(RIGHT, buff=1.0)
            brow.move_to([_X0, -1.8, 0], aligned_edge=LEFT)
            ba = _arr(bump.get_right(), note.get_left(), KIT)
            turns = T("between two turns", SMALL, MUTED).next_to(bump, UP, buff=0.12).align_to(bump, LEFT)
            self.play(FadeIn(turns), FadeIn(bump, shift=RIGHT * 0.1), run_time=b.t(0.25))
            _at(self, b, 0.48)
            self.play(GrowArrow(ba), FadeIn(note, shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("signal") as b:
            d = M("<b>list_changed</b>: an MCP signal that says a list of tools or resources changed", LABEL)
            d[:len("list_changed")].set_color(DESCRIBE)
            d.move_to([_X0, -2.55, 0], aligned_edge=LEFT)
            self.play(FadeIn(d, shift=UP * 0.1), run_time=b.t(0.3))


# ====================================================================== describe_results
class DescribeResults(DWScene):
    # beat starts (s): output 1.4, listchg 9.5, desc 21.0, instr 28.6, push 33.4
    BEATS = [("title", 1.4), ("output", 8.1), ("listchg", 11.5), ("desc", 7.6), ("instr", 4.8), ("push", 6.32)]

    def construct(self):
        cx = [_X0, _X0 + 6.05, _X0 + 7.4]   # column left edges: what, re-read, evidence

        def row(what, what_mono, yes, ev_lines):
            w = T(what, SMALL, TEXT, mono=what_mono)
            v = _verdict(yes, SMALL)
            ev = VGroup(*[M(x, SMALL) for x in ev_lines]).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            return w, v, ev

        rows_spec = [
            ("tool output and resources", False, True, ["live each call", "(" + _mono("kitVersion 2") + " after bump)"]),
            ("notifications/tools/list_changed", True, True,
             [_mono("tools/list") + " again in 14 to 63 ms", "(three runs); new tool next turn (deferred)"]),
            ("description of a loaded tool", False, False, [_mono("KIT_TOOL_V1", DESCRIBE) + " in messages 05 to 08"]),
            ("server instructions", False, False, [_mono("KIT_INSTR_V1", DESCRIBE) + " in every request"]),
        ]

        with self.beat("title") as b:
            title = scene_title("Results: what Claude Code reads again", DESCRIBE)
            tag = chip("kit_spike.mcp", DESCRIBE).next_to(title, RIGHT, buff=0.4)
            hdr = VGroup(*[T(h, SMALL, MUTED, bold=True) for h in ("text source", "re-read", "evidence")])
            for h, x in zip(hdr, cx):
                h.move_to([x, 2.6, 0], aligned_edge=LEFT)
            hl = Line([_X0 - 0.1, 2.35, 0], [_X1, 2.35, 0], stroke_width=1.5, stroke_color=MUTED, stroke_opacity=0.55)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(tag), FadeIn(hdr), Create(hl), run_time=b.t(0.6))

        rows = []
        y = 2.0
        for w_s, w_mono, yes, ev in rows_spec:
            w, v, e = row(w_s, w_mono, yes, ev)
            top = y
            w.move_to([cx[0], 0, 0], aligned_edge=LEFT)
            v.move_to([cx[1], 0, 0], aligned_edge=LEFT)
            e.move_to([cx[2], 0, 0], aligned_edge=LEFT)
            # first lines share one baseline row
            for m in (w, v):
                m.set_y(top)
            e.align_to([0, top + e[0].height / 2, 0], UP)
            rows.append(VGroup(w, v, e))
            y = min(e.get_bottom()[1], w.get_bottom()[1]) - 0.38

        with self.beat("output") as b:
            self.play(FadeIn(rows[0][0]), run_time=b.t(0.12))
            _at(self, b, 0.17)
            self.play(FadeIn(rows[0][1], scale=1.2), run_time=b.t(0.1))
            _at(self, b, 0.35)
            self.play(FadeIn(rows[0][2], shift=RIGHT * 0.1), run_time=b.t(0.2))

        with self.beat("listchg") as b:
            self.play(FadeIn(rows[1][0]), FadeIn(rows[1][1], scale=1.2), run_time=b.t(0.12))
            self.play(FadeIn(rows[1][2][0], shift=RIGHT * 0.1), run_time=b.t(0.12))
            # timeline from the server log
            src = T("run-stateless2/server.log", SMALL, MUTED, mono=True)
            src.move_to([_X0, -1.1, 0], aligned_edge=LEFT)
            ty = -1.6
            xs = [_X0 + 1.0, _X0 + 4.5, _X0 + 8.0, _X0 + 11.0]
            ev = [("12:53:13.040", "bump", KIT), ("13.052", "resources/templates/list", DESCRIBE),
                  ("13.058", "tools/list", DESCRIBE), ("13.061", "resources/list", DESCRIBE)]
            line = Line([xs[0] - 0.4, ty, 0], [xs[-1] + 0.4, ty, 0], stroke_width=2, stroke_color=MUTED)
            pts = []
            for x, (t_s, e_s, col) in zip(xs, ev):
                dot = Dot([x, ty, 0], radius=0.08, color=col)
                lab = VGroup(T(t_s, SMALL, TEXT, mono=True), T(e_s, SMALL, col, mono=True)).arrange(DOWN, buff=0.08)
                lab.next_to(dot, DOWN, buff=0.15)
                pts.append(VGroup(dot, lab))
            _at(self, b, 0.33)
            self.play(FadeIn(src), Create(line), run_time=b.t(0.1))
            self.play(LaggedStart(*[FadeIn(p, shift=UP * 0.08) for p in pts], lag_ratio=0.35), run_time=b.t(0.25))
            _at(self, b, 0.72)
            self.play(FadeIn(rows[1][2][1], shift=RIGHT * 0.1), run_time=b.t(0.12))

        with self.beat("desc") as b:
            self.play(FadeIn(rows[2][0]), run_time=b.t(0.15))
            _at(self, b, 0.55)
            self.play(FadeIn(rows[2][1], scale=1.2), run_time=b.t(0.1))
            _at(self, b, 0.7)
            self.play(FadeIn(rows[2][2], shift=RIGHT * 0.1), run_time=b.t(0.15))

        with self.beat("instr") as b:
            self.play(FadeIn(rows[3][0]), run_time=b.t(0.2))
            _at(self, b, 0.35)
            self.play(FadeIn(rows[3][1], scale=1.2), FadeIn(rows[3][2], shift=RIGHT * 0.1), run_time=b.t(0.25))

        with self.beat("push") as b:
            cap = caption("no push to the model: it learns from a new tool name or a call")
            self.play(FadeIn(cap, shift=UP * 0.1), run_time=b.t(0.2))


# ====================================================================== describe_rule
class DescribeRule(DWScene):
    # beat starts (s): not 4.1, fixed 7.6, listchg 12.6, tools 17.9, setting 24.2, lie 26.9
    BEATS = [("facts", 4.1), ("not", 3.5), ("fixed", 5.0), ("listchg", 5.3), ("tools", 6.3), ("setting", 2.7),
             ("lie", 4.3)]

    def construct(self):
        lx = _X0          # left column
        rx = 1.0          # right column left edge

        with self.beat("facts") as b:
            title = scene_title("The rule: kit facts go where the agent reads again", DESCRIBE)
            facts = chip("kit facts", KIT, mono=False, size=LABEL)
            out = ProcessBox("tool output", "widget_guide, kit_read", DESCRIBE, height=1.05)
            plus = T("+", BODY, MUTED)
            res = ProcessBox("resource", None, DESCRIBE, height=1.05)
            dest = VGroup(out, plus, res).arrange(RIGHT, buff=0.25)
            dest.move_to([lx, 1.15, 0], aligned_edge=LEFT)
            facts.next_to(out, UP, buff=0.45)
            fa = _arr(facts.get_bottom(), out.get_top(), KIT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(facts), run_time=b.t(0.3))
            self.play(GrowArrow(fa), FadeIn(dest, shift=DOWN * 0.1), run_time=b.t(0.35))

        with self.beat("not") as b:
            nl = T("not in", LABEL, MUTED)
            c1 = chip("tool description", MUTED, mono=False, size=LABEL)
            c2 = chip("instructions", MUTED, mono=False, size=LABEL)
            nrow = VGroup(nl, c1, c2).arrange(RIGHT, buff=0.3)
            nrow.move_to([lx, 0.05, 0], aligned_edge=LEFT)
            s1, s2 = _strike(c1[1]), _strike(c2[1])
            self.play(FadeIn(nrow), run_time=b.t(0.25))
            self.play(Create(s1), Create(s2), run_time=b.t(0.25))

        with self.beat("fixed") as b:
            fx = VGroup(T("instructions (fixed):", LABEL), T("call kit_read for packages", LABEL, DESCRIBE, mono=True))
            fx.arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            fx[1].shift(RIGHT * 0.3)
            fx.move_to([lx, -1.0, 0], aligned_edge=LEFT)
            self.play(FadeIn(fx, shift=RIGHT * 0.1), run_time=b.t(0.35))

        with self.beat("listchg") as b:
            lc = VGroup(M(_mono("list_changed", DESCRIBE) + " only:", LABEL),
                        T("refreshes the resource list", LABEL), T("announces a new tool name", LABEL))
            lc.arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            lc[1:].shift(RIGHT * 0.3)
            lc.move_to([lx, -2.2, 0], aligned_edge=LEFT)
            self.play(FadeIn(lc[0]), run_time=b.t(0.2))
            self.play(LaggedStart(FadeIn(lc[1], shift=RIGHT * 0.1), FadeIn(lc[2], shift=RIGHT * 0.1), lag_ratio=0.5),
                      run_time=b.t(0.4))

        with self.beat("tools") as b:
            th = T("tool list", LABEL, MCP, bold=True)
            tag = status_chip("spike design", solved=False)
            thead = VGroup(th, tag).arrange(RIGHT, buff=0.4)
            names = VGroup(*[chip(n, MCP, size=LABEL) for n in ("kit_add", "kit_remove")])
            names.arrange(DOWN, buff=0.15, aligned_edge=LEFT)
            always = T("always present", SMALL, MCP)
            body = VGroup(thead, names).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
            tbox = rbox(_X1 - rx, body.height + 0.6, MCP, fill=0.05)
            tbox.move_to([(rx + _X1) / 2, 2.6 - tbox.height / 2, 0])
            body.move_to(tbox).align_to(tbox, LEFT).shift(RIGHT * 0.35)
            brace = Brace(names, RIGHT, color=MCP)
            always.next_to(brace, RIGHT, buff=0.15)
            self.play(Create(tbox), FadeIn(thead), run_time=b.t(0.25))
            _at(self, b, 0.35)
            self.play(FadeIn(names, shift=RIGHT * 0.1), run_time=b.t(0.2))
            self.play(GrowFromCenter(brace), FadeIn(always), run_time=b.t(0.2))

        with self.beat("setting") as b:
            st = VGroup(_tick(CONFIG), T("setting checked in the call", LABEL, CONFIG)).arrange(RIGHT, buff=0.2)
            st.next_to(tbox, DOWN, buff=0.35).align_to(tbox, LEFT).shift(RIGHT * 0.2)
            self.play(FadeIn(st, shift=UP * 0.1), run_time=b.t(0.45))

        with self.beat("lie") as b:
            dc = chip('description: "off"', MUTED, size=LABEL)
            why = lines("would lie after the user", "turns the setting on", size=SMALL, color=ISOLATION, buff=0.08)
            grp = VGroup(dc, why).arrange(DOWN, buff=0.15, aligned_edge=LEFT)
            grp.next_to(st, DOWN, buff=0.35).align_to(st, LEFT)
            s3 = _strike(dc[1])
            self.play(FadeIn(dc), run_time=b.t(0.2))
            _at(self, b, 0.4)
            self.play(Create(s3), FadeIn(why), run_time=b.t(0.25))


# ====================================================================== describe_cost
class DescribeCost(DWScene):
    # beat starts (s): index 5.7, card 14.0, holds 20.3, raw 28.1, lucide 35.7, est 39.6, guide 43.8, tool 48.1,
    # types 50.5
    BEATS = [("ask", 5.7), ("index", 8.3), ("card", 6.3), ("holds", 7.8), ("raw", 7.6), ("lucide", 3.9), ("est", 4.2),
             ("guide", 4.3), ("tool", 2.4), ("types", 6.38)]

    ROWS = [("index line", "1,667", "about 505"),
            ("card", "19,447", "about 5,893"),
            ("raw types entries", "2,554,817", "about 774,187"),
            ("lucide-react types alone", "2,173,743", "-")]

    def construct(self):
        with self.beat("ask") as b:
            title = scene_title("What a package list costs", DESCRIBE)
            src = M(_mono("measure-out.md", DESCRIBE) + ",  20 packages (measured)", LABEL, MUTED)
            src.move_to([_X0, 2.6, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))
            _at(self, b, 0.55)
            self.play(FadeIn(src), run_time=b.t(0.25))

        cc = {(i, 2): INFERRED for i in range(4)}
        cc[(3, 2)] = MUTED
        cc.update({(i, 1): MEASURED for i in range(4)})
        tbl = RevealTable(["what (20 packages)", "chars (measured)", "tokens (estimate)"], self.ROWS,
                          mono_cols=[1, 2], size=LABEL, row_gap=0.18, col_gap=0.9, cell_colors=cc)
        tbl.next_to(src, DOWN, buff=0.35).align_to(src, LEFT)
        tbl.header[2].set_color(INFERRED)

        with self.beat("index") as b:
            self.add(tbl)
            self.play(FadeIn(tbl.header), run_time=b.t(0.15))
            _at(self, b, 0.15)
            self.play(tbl.reveal_row(0), run_time=b.t(0.2))

        with self.beat("card") as b:
            self.play(tbl.reveal_row(1), run_time=b.t(0.3))

        with self.beat("holds") as b:
            hl = T("a card holds", SMALL, MUTED, bold=True)
            parts = VGroup(*[chip(p, DESCRIBE, mono=False) for p in
                             ("index line", "types entry", "import line", "top exports", "short readme part")])
            parts.arrange(RIGHT, buff=0.15)
            holds = VGroup(hl, parts).arrange(RIGHT, buff=0.25)
            holds.move_to([_X0, -1.2, 0], aligned_edge=LEFT)
            self.play(Indicate(tbl.body_rows[1], color=DESCRIBE, scale_factor=1.03), FadeIn(hl), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(p, shift=UP * 0.08) for p in parts], lag_ratio=0.3), run_time=b.t(0.5))

        with self.beat("raw") as b:
            self.play(tbl.reveal_row(2), run_time=b.t(0.3))

        with self.beat("lucide") as b:
            self.play(tbl.reveal_row(3), run_time=b.t(0.4))

        with self.beat("est") as b:
            cap = caption("tokens = chars / 3.3 (estimate)", color=INFERRED)
            self.play(FadeIn(cap, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("guide") as b:
            self.play(FadeOut(tbl), FadeOut(holds), src.animate.set_opacity(0.6), run_time=b.t(0.15))
            sl = T("sample index line", SMALL, MUTED, bold=True)
            sample = VGroup(T("zod@4.4.3 (both): TypeScript-first schema declaration", SMALL, TEXT, mono=True),
                            T("and validation library with static type inference", SMALL, TEXT, mono=True))
            sample.arrange(DOWN, buff=0.08, aligned_edge=LEFT)
            sample[1].shift(RIGHT * 0.4)
            sg = VGroup(sl, sample).arrange(DOWN, buff=0.15, aligned_edge=LEFT)
            sg.next_to(src, DOWN, buff=0.4).align_to(src, LEFT)
            tag = status_chip("spike design", solved=False)
            tag.next_to(sg, DOWN, buff=0.5).align_to(sg, LEFT)
            m1 = M(_mono("index", DESCRIBE) + "  &gt;  guide  (one line per package)", BODY)
            m1.next_to(tag, DOWN, buff=0.35).align_to(tag, LEFT).shift(RIGHT * 0.3)
            self.play(FadeIn(sg, shift=UP * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(tag), FadeIn(m1, shift=RIGHT * 0.1), run_time=b.t(0.25))

        with self.beat("tool") as b:
            m2 = M(_mono("card", DESCRIBE) + "  &gt;  " + _mono("kit_describe", MCP) + " on request", BODY)
            m2.next_to(m1, DOWN, buff=0.28).align_to(m1, LEFT)
            self.play(FadeIn(m2, shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("types") as b:
            m3 = M(_mono("types", DESCRIBE) + "  &gt;  path only, never inline", BODY)
            m3.next_to(m2, DOWN, buff=0.28).align_to(m2, LEFT)
            self.play(FadeIn(m3, shift=RIGHT * 0.1), run_time=b.t(0.2))
            _at(self, b, 0.45)
            own = T("the agent reads the type file with its own tools", LABEL, AGENT)
            own.next_to(m3, DOWN, buff=0.2).align_to(m3, LEFT).shift(RIGHT * 0.4)
            self.play(FadeIn(own, shift=UP * 0.08), run_time=b.t(0.2))


# ====================================================================== describe_work
class DescribeWork(DWScene):
    # beat starts (s): resource 4.85, notify 7.3, size 9.9, close 12.6 (the close starts during the size sentence)
    BEATS = [("index", 4.85), ("resource", 2.45), ("notify", 2.6), ("size", 2.7), ("close", 2.76)]

    def construct(self):
        outline = OutlineDiagram()
        lx, vx = _X0 + 0.3, _X0 + 2.6

        def label(t, y):
            return T(t, LABEL, MUTED, bold=True).move_to([lx, y, 0], aligned_edge=LEFT)

        def val(m, y):
            return m.move_to([vx, y, 0], aligned_edge=LEFT)

        with self.beat("index") as b:
            title = scene_title("What the describe front adds", DESCRIBE)
            card = rbox(_X1 - _X0, 3.0, DESCRIBE, fill=0.05)
            card.move_to([(_X0 + _X1) / 2, 1.2, 0])
            i_l = label("Output", 2.25)
            i_v = val(M("kit index into " + _mono("widget_guide", MCP) + " and " + _mono("kit_read", MCP) + " output",
                        LABEL), 2.25)
            self.play(FadeIn(title, shift=RIGHT * 0.2), Create(card), FadeIn(i_l), run_time=b.t(0.3))
            self.play(FadeIn(i_v, shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("resource") as b:
            r_l = label("Resource", 1.25)
            r_v = val(M("one per package  " + _mono("deepwidgets://kit/pkg/<name>", DESCRIBE), LABEL), 1.25)
            self.play(FadeIn(r_l), FadeIn(r_v, shift=RIGHT * 0.1), run_time=b.t(0.45))

        with self.beat("notify") as b:
            n_l = label("Signal", 0.25)
            n_v = val(M(_mono("notify.resourcesChanged()", DESCRIBE) + "  on each kit change", LABEL), 0.25)
            self.play(FadeIn(n_l), FadeIn(n_v, shift=RIGHT * 0.1), run_time=b.t(0.45))

        with self.beat("size") as b:
            sz = chip("MCP kit tools and index: M (estimate)", INFERRED, mono=False, size=LABEL)
            sz.next_to(card, DOWN, buff=0.35).align_to(card, LEFT)
            self.play(FadeIn(sz, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("close") as b:
            outline.close_part(self, "describe", next_key="kit_config", run_time=b.left)
