"""Part `part_screen`: the shell page and the widget windows.

Scenes, in order: openui_lang shell_page shell_refresh shell_reconnect shell_serving windows_manager.
Beat weights follow the narration word counts of each sentence group.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content


def _travel(chip_m, start, end):
    """Place chip_m at start; return the animation that moves it to end."""
    chip_m.move_to(start)
    return chip_m.animate.move_to(end)


def _row(*items, buff=0.25):
    return VGroup(*items).arrange(RIGHT, buff=buff)


def _note(markup, size=SMALL, color=TEXT):
    return M(markup, size, color)


def _body(w):
    """Center of a window_card body, from its current position (window_card.body_center is fixed at build)."""
    return np.array([w.frame.get_x(), (w[1].get_y() + w.frame.get_bottom()[1]) / 2, 0])


def _dim(box, label, op=0.3):
    """Animations that grey out a box (stroke) and its label, for a host that is down."""
    return [box.animate.set_stroke(opacity=op).set_fill(opacity=0.02), label.animate.set_opacity(op)]


def _undim(box, label):
    return [box.animate.set_stroke(opacity=1).set_fill(opacity=0.15), label.animate.set_opacity(1)]


# ====================================================================== openui_lang
class OpenuiLang(DWScene):
    BEATS = [("open", 9), ("anatomy", 28), ("root", 20), ("query", 11), ("mutation", 13), ("plan", 10),
             ("set", 37), ("shadcn", 21)]

    PROGRAM = '''root = Card([
  CardHeader("Sample", "A counter"),
  Stat("Count", s.count),
  Button("Add 1",
    Action([@Run(add), @Run(s)]))
])
s = Query("get", {}, {count: 0})
add = Mutation("add", {by: 1})'''

    COMPONENTS = ["Card", "Row", "List", "CardHeader", "TextContent", "Stat", "Button", "Input", "Checkbox",
                  "Badge", "Progress", "Alert", "Separator", "Table", "Col", "Empty", "BarChart", "LineChart",
                  "Series"]
    NAMED = ["Card", "Row", "List", "Stat", "Button", "Input", "Checkbox", "Table", "BarChart", "LineChart"]

    def _preview(self):
        frame = rbox(4.3, 2.9, SHELL, fill=0.06, sw=3, r=0.12)
        hdr = T("Sample", LABEL, TEXT, bold=True)
        sub = T("A counter", SMALL, MUTED)
        head = VGroup(hdr, sub).arrange(DOWN, buff=0.08, aligned_edge=LEFT)
        st_l = T("Count", SMALL, MUTED)
        st_v = T("0", HEADING, TEXT, bold=True)
        stat = VGroup(st_l, st_v).arrange(DOWN, buff=0.08, aligned_edge=LEFT)
        btn = chip("Add 1", USER, size=LABEL, mono=False, fill=0.2)
        body = VGroup(head, stat, btn).arrange(DOWN, buff=0.22, aligned_edge=LEFT)
        body.move_to(frame).align_to(frame, LEFT).shift(RIGHT * 0.35)
        g = VGroup(frame, body)
        g.btn, g.value = btn, st_v
        return g

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "shell_page", run_time=b.left)

        with self.beat("anatomy") as b:
            title = scene_title("OpenUI Lang 1.0.1", SHELL)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.1))
            l1 = M('A <b>program</b> is a list of <b>statements</b>.', BODY)
            l1.move_to([0, 1.9, 0])
            self.play(FadeIn(l1), run_time=b.t(0.15))
            c_name = chip("name", SHELL, size=BODY, mono=False)
            c_eq = T("=", HEADING, TEXT, mono=True)
            c_expr = chip("expression", SHELL, size=BODY, mono=False)
            anat = _row(c_name, c_eq, c_expr, buff=0.6).move_to([0, 0.6, 0])
            self.play(LaggedStart(FadeIn(c_name), FadeIn(c_eq), FadeIn(c_expr), lag_ratio=0.4),
                      run_time=b.t(0.3))
            e_name = T("add", BODY, TEXT, mono=True)
            e_eq = T("=", BODY, TEXT, mono=True)
            e_expr = T('Mutation("add", {by: 1})', BODY, TEXT, mono=True)
            _row(e_name, e_eq, e_expr, buff=0.3).move_to([0, -0.8, 0])
            links = VGroup(*[DashedLine(c.get_bottom() + DOWN * 0.1, e.get_top() + UP * 0.1, color=MUTED,
                                        stroke_width=2, dash_length=0.08)
                             for c, e in ((c_name, e_name), (c_expr, e_expr))])
            ex_lab = T("one statement", SMALL, MUTED).next_to(VGroup(e_name, e_expr), DOWN, buff=0.35)
            self.play(Create(links), FadeIn(VGroup(e_name, e_eq, e_expr, ex_lab)), run_time=b.t(0.3))
            anatomy = VGroup(l1, anat, links, e_name, e_eq, e_expr, ex_lab)

        with self.beat("root") as b:
            code = code_block(self.PROGRAM, "javascript", color=SHELL, size=26)
            code.move_to([0, 0, 0]).to_edge(LEFT, buff=MARGIN + 0.1).align_to([0, CONTENT_TOP - 0.05, 0], UP)
            hide_lines(code)
            self.play(FadeOut(anatomy), run_time=b.t(0.12))
            self.add(code)
            self.play(reveal_lines(code, 0, len(code.code_lines), lag=0.12), run_time=b.t(0.35))
            m_root = SurroundingRectangle(code.code_lines[0:6], color=SHELL, buff=0.08, stroke_width=2.5,
                                          corner_radius=0.06)
            prev = self._preview()
            prev.move_to([4.6, 1.15, 0])
            p_lab = T("root = the screen", SMALL, SHELL, bold=True).next_to(prev, UP, buff=0.12)
            self.play(Create(m_root), FadeIn(prev), FadeIn(p_lab), run_time=b.t(0.35))

        notes_x = code.get_left()[0] + 0.1
        with self.beat("query") as b:
            m_s = mark_line(code, 6, RUNTIME)
            n1 = _note(f'<span font_family="{MONO}">s</span>: a <b>Query</b>, runs action '
                       f'<span font_family="{MONO}">get</span>')
            n1.next_to(code, DOWN, buff=0.35).align_to([notes_x, 0, 0], LEFT)
            self.play(ReplacementTransform(m_root, m_s), FadeIn(n1, shift=LEFT * 0.2), run_time=b.t(0.5))

        with self.beat("mutation") as b:
            m_a = mark_line(code, 7, RUNTIME)
            n2b = _note(f'<span font_family="{MONO}">add</span>: a <b>Mutation</b>, runs action '
                        f'<span font_family="{MONO}">add</span> with <span font_family="{MONO}">{{by: 1}}</span>')
            n2 = VGroup()
            n2b.next_to(n1, DOWN, buff=0.2).align_to(n1, LEFT)
            self.play(ReplacementTransform(m_s, m_a), FadeIn(VGroup(n2, n2b), shift=LEFT * 0.2),
                      run_time=b.t(0.5))

        with self.beat("plan") as b:
            m_p = SurroundingRectangle(code.code_lines[3:5], color=USER, buff=0.06, stroke_width=2.5,
                                       corner_radius=0.05)
            n3 = _note(f'Button runs an <b>action plan</b>: '
                       f'<span font_family="{MONO}">add</span>, then <span font_family="{MONO}">s</span>')
            n3.next_to(n2b, DOWN, buff=0.2).align_to(n1, LEFT)
            self.play(ReplacementTransform(m_a, m_p), FadeIn(n3, shift=LEFT * 0.2), run_time=b.t(0.45))
            self.play(Indicate(prev.btn, color=USER, scale_factor=1.12), run_time=b.t(0.3))

        with self.beat("set") as b:
            self.play(FadeOut(VGroup(code, m_p, prev, p_lab, n1, n2, n2b, n3)), run_time=b.t(0.08))
            head = M(f'One program uses one <b>component set</b>: '
                     f'<span font_family="{MONO}" fgcolor="{SHELL}">shadcn-widgets@1</span>', BODY)
            head.move_to([0, 2.45, 0])
            self.play(FadeIn(head), run_time=b.t(0.1))
            chips = [chip(n, SHELL if n in self.NAMED else MUTED, size=SMALL, fill=0.08) for n in self.COMPONENTS]
            grid = VGroup(*chips).arrange_in_grid(rows=4, cols=5, buff=(0.35, 0.3), flow_order="rd")
            grid.move_to([0, 0.2, 0])
            for c in chips:
                c[1].set_color(TEXT)
            count = T("19 components", LABEL, MUTED).next_to(grid, DOWN, buff=0.3)
            self.play(LaggedStart(*[FadeIn(c, scale=0.9) for c in chips], lag_ratio=0.08), run_time=b.t(0.35))
            self.play(FadeIn(count), run_time=b.t(0.07))
            named = [c for n, c in zip(self.COMPONENTS, chips) if n in self.NAMED]
            self.play(LaggedStart(*[c[0].animate.set_fill(opacity=0.35) for c in named], lag_ratio=0.25),
                      run_time=b.t(0.35))

        with self.beat("shadcn") as b:
            sh = M(f'<b>shadcn</b>: a popular set of React components. '
                   f'<span fgcolor="{SHELL}">shadcn-widgets@1</span> ports a small part.', LABEL)
            sh.move_to([0, -2.4, 0])
            self.play(FadeOut(count), FadeIn(sh, shift=UP * 0.15), run_time=b.t(0.3))


# ====================================================================== shell_page
class ShellPage(DWScene):
    BEATS = [("zoom", 9), ("shell", 19), ("pins", 19), ("decision", 12), ("address", 8), ("program", 8),
             ("check", 24), ("render", 17), ("call", 11), ("noretry", 13), ("channel", 18)]

    PINS = [("react", "18.3.1"), ("@openuidev/react-lang", "1.0.1"), ("@openuidev/lang-core", "1.0.1"),
            ("vite", "6.4.3")]

    def construct(self):
        with self.beat("zoom") as b:
            OutlineDiagram().open_part(self, "shell_page", run_time=b.left)

        with self.beat("shell") as b:
            title = scene_title("The shell page", SHELL)
            w1 = window_card("sample", w=2.7, h=2.1)
            w2 = window_card("groceries", w=2.7, h=2.1)
            wins = _row(w1, w2, buff=0.35).move_to([0, 1.55, 0]).to_edge(LEFT, buff=MARGIN + 0.25)
            bodies = VGroup()
            for w in (w1, w2):
                t = T("shell", LABEL, SHELL, bold=True).move_to(_body(w))
                bodies.add(t)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(wins), run_time=b.t(0.3))
            self.play(FadeIn(bodies), run_time=b.t(0.15))
            defs = VGroup(_note('<b>React</b>: a UI library', LABEL), _note('<b>Vite</b>: a build tool', LABEL))
            defs.arrange(DOWN, buff=0.15, aligned_edge=LEFT).next_to(wins, DOWN, buff=1.25).align_to(wins, LEFT)
            self.play(FadeIn(defs, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("pins") as b:
            tbl = RevealTable(["package", "pinned"], self.PINS, mono_cols=[0, 1],
                              cell_colors={(i, 1): SHELL for i in range(len(self.PINS))})
            tbl.move_to([3.3, 0, 0]).align_to([0, 2.55, 0], UP)
            self.add(tbl)
            self.play(tbl.reveal_row(0), run_time=b.t(0.3))
            one = chip("@deepwidgets/shell · one version", SHELL, size=SMALL)
            one.next_to(wins, DOWN, buff=0.3)
            arrs = VGroup(*[Arrow(w.frame.get_bottom(), one.get_top(), buff=0.05, color=SHELL, stroke_width=3,
                                  tip_length=0.16) for w in (w1, w2)])
            self.play(FadeIn(one), Create(arrs), tbl.reveal_rows(1, len(self.PINS)), run_time=b.t(0.6))

        with self.beat("decision") as b:
            dec = ProcessBox("decision", "no widget shows HTML that a server makes", SHELL, sub_mono=False,
                             sub_size=SMALL)
            dec.move_to([3.3, -1.6, 0])
            self.play(FadeIn(dec, shift=UP * 0.15), run_time=b.t(0.4))

        # flow, top to bottom
        with self.beat("address") as b:
            self.play(FadeOut(VGroup(wins, bodies, defs, one, arrs, tbl, dec)), run_time=b.t(0.15))
            n_addr = chip("dsh-app://app/widget/?slug=sample", SHELL)
            n_get = chip("GET program", SHELL)
            n_chk = chip("catalog check: shadcn-widgets@1", SHELL)
            n_rnd = chip("Renderer.Root", SHELL)
            n_tp = chip("toolProvider", SHELL)
            n_call = chip("POST /call", SHELL)
            flow = [n_addr, n_get, n_chk, n_rnd, n_tp, n_call]
            col = VGroup(*flow).arrange(DOWN, buff=0.36).move_to([-3.4, -0.05, 0])
            arrs = [Arrow(a.get_bottom(), c.get_top(), buff=0.04, color=SHELL, stroke_width=3, tip_length=0.15)
                    for a, c in zip(flow, flow[1:])]
            self.play(FadeIn(n_addr, shift=DOWN * 0.1), run_time=b.t(0.3))
            slug = n_addr[1][-11:]
            self.play(slug.animate.set_color(USER), run_time=b.t(0.25))

        with self.beat("program") as b:
            self.play(GrowArrow(arrs[0]), FadeIn(n_get), run_time=b.t(0.5))

        with self.beat("check") as b:
            self.play(GrowArrow(arrs[1]), FadeIn(n_chk), run_time=b.t(0.2))
            states = RevealTable(["screen", "when"], [("loading", "the program loads"),
                                                      ("error", "it names another set"),
                                                      ("empty", "This widget is empty"),
                                                      ("removed", "This widget was removed")],
                                 mono_cols=[0], cell_colors={(1, 0): ISOLATION, (1, 1): ISOLATION})
            states.move_to([3.55, 0.95, 0])
            self.add(states)
            self.play(states.reveal_rows(0, 2), run_time=b.t(0.25))
            a_err = Arrow(n_chk.get_right(), states.body_rows[1].get_left() + LEFT * 0.15, buff=0.08,
                          color=ISOLATION, stroke_width=3, tip_length=0.16)
            self.play(GrowArrow(a_err), run_time=b.t(0.15))
            self.play(states.reveal_rows(2, 4), run_time=b.t(0.3))

        with self.beat("render") as b:
            self.play(FadeOut(VGroup(states, a_err)), GrowArrow(arrs[2]), FadeIn(n_rnd), run_time=b.t(0.35))
            self.play(GrowArrow(arrs[3]), FadeIn(n_tp), run_time=b.t(0.3))
            qm = _note(f'each <b>Query</b> and <b>Mutation</b>', SMALL, MUTED).next_to(n_tp, RIGHT, buff=0.35)
            self.play(FadeIn(qm), run_time=b.t(0.2))

        with self.beat("call") as b:
            self.play(GrowArrow(arrs[4]), FadeIn(n_call), run_time=b.t(0.5))

        with self.beat("noretry") as b:
            nr = chip("no retry", ISOLATION, size=SMALL, mono=False)
            why = T("a mutation must not run twice", SMALL, TEXT)
            g = _row(nr, why, buff=0.2).next_to(n_call, RIGHT, buff=0.35)
            self.play(FadeIn(g, shift=LEFT * 0.15), run_time=b.t(0.4))

        with self.beat("channel") as b:
            ch = ProcessBox("channel.ts", "every request", SHELL, sub_mono=False, width=3.0, height=1.3)
            ch.move_to([4.3, 0.3, 0])
            host = chip("host  /api/widgets/<slug>/…", HOST, size=SMALL)
            host.move_to([4.3, 2.1, 0])
            a1 = Arrow(n_get.get_right(), ch.box.get_left() + UP * 0.25, buff=0.08, color=SHELL, stroke_width=3,
                       tip_length=0.16)
            a2 = Arrow(nr.get_corner(UR), ch.box.get_left() + DOWN * 0.3, buff=0.12,
                       color=SHELL, stroke_width=3, tip_length=0.16)
            a3 = Arrow(ch.box.get_top(), host.get_bottom(), buff=0.05, color=HOST, stroke_width=3, tip_length=0.16)
            self.play(FadeOut(qm), FadeIn(ch), GrowArrow(a1), GrowArrow(a3), FadeIn(host), run_time=b.t(0.3))
            self.play(GrowArrow(a2), run_time=b.t(0.15))
            fast = status_chip("faster transport (later)", solved=False)
            fast.move_to([4.3, -1.3, 0])
            rep = DashedLine(fast.get_top(), ch.box.get_bottom() + RIGHT * 0.6, color=OPEN, stroke_width=3,
                             dash_length=0.08).add_tip(tip_length=0.14, tip_width=0.14)
            self.play(FadeIn(fast), Create(rep), run_time=b.t(0.3))


# ====================================================================== shell_refresh
class ShellRefresh(DWScene):
    BEATS = [("stream", 13), ("data", 22), ("spike", 17), ("program", 9), ("removed", 7), ("hello", 26),
             ("warn", 22)]

    ROWS = [("data", "runs all queries again (useTriggerAction)"),
            ("program", "loads the program again"),
            ("removed", "shows: This widget was removed"),
            ("hello", "compares revs, catches up")]

    def construct(self):
        lane_y = 1.75
        with self.beat("stream") as b:
            title = scene_title("How a window refreshes", SHELL)
            win = window_card("sample", w=3.3, h=2.3)
            win.move_to([-4.75, 1.45, 0])
            lab = T("Count", SMALL, MUTED)
            val = T("0", TITLE, TEXT, bold=True)
            body = VGroup(lab, val).arrange(DOWN, buff=0.08).move_to(_body(win))
            src = chip("host · stream", HOST, size=SMALL)
            src.move_to([5.4, lane_y, 0])
            lane = DashedLine(src.get_left(), [win.frame.get_right()[0], lane_y, 0], color=HOST, stroke_width=3,
                              dash_length=0.12)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(win), FadeIn(body), run_time=b.t(0.35))
            self.play(FadeIn(src), Create(lane), run_time=b.t(0.4))
            tbl = RevealTable(["frame", "the shell"], self.ROWS, mono_cols=[0],
                              cell_colors={(0, 0): RUNTIME, (1, 0): SHELL, (2, 0): ISOLATION, (3, 0): HOST})
            tbl.move_to([0.4, 0, 0]).align_to([0, -0.15, 0], UP)
            self.add(tbl)

        def send(text, color, b, frac):
            f = chip(text, color, size=SMALL)
            mv = _travel(f, [src.get_left()[0] - f.width / 2 - 0.1, lane_y + 0.42, 0],
                         [win.frame.get_right()[0] + f.width / 2 + 0.1, lane_y + 0.42, 0])
            self.add(f)
            self.play(mv, run_time=b.t(frac))
            return f

        with self.beat("data") as b:
            f = send("data {rev: 1}", RUNTIME, b, 0.3)
            self.play(tbl.reveal_row(0), run_time=b.t(0.2))
            v1 = T("1", TITLE, TEXT, bold=True).move_to(val)
            self.play(FadeOut(f), Transform(val, v1), Indicate(win.frame, color=RUNTIME, scale_factor=1.03),
                      run_time=b.t(0.3))

        with self.beat("spike") as b:
            sp = status_chip("spike: typed text in an input stays. Not checked in the current shell.",
                             solved=False)
            sp.move_to([0, 0.5, 0]).align_to([win.frame.get_right()[0] + 0.3, 0, 0], LEFT)
            self.play(FadeIn(sp, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("program") as b:
            self.play(FadeOut(sp), run_time=b.t(0.12))
            f = send("program {rev: 2}", SHELL, b, 0.4)
            self.play(FadeOut(f), tbl.reveal_row(1), Indicate(win.frame, color=SHELL, scale_factor=1.03),
                      run_time=b.left)

        with self.beat("removed") as b:
            f = send("removed", ISOLATION, b, 0.5)
            self.play(FadeOut(f), tbl.reveal_row(2), run_time=b.left)

        with self.beat("hello") as b:
            down = Cross(lane, stroke_color=ISOLATION, stroke_width=4).scale(0.15).move_to(lane)
            dl = T("stream down", SMALL, ISOLATION).next_to(down, DOWN, buff=0.1)
            self.play(lane.animate.set_stroke(opacity=0.25), FadeIn(down), FadeIn(dl), run_time=b.t(0.2))
            self.play(lane.animate.set_stroke(opacity=1), FadeOut(down), FadeOut(dl), run_time=b.t(0.12))
            f = send("hello {revs}", HOST, b, 0.25)
            cmp = _note('last seen revs  ≠  hello revs  →  <b>catch up</b>', SMALL)
            cmp.move_to([0, 0.5, 0]).align_to([win.frame.get_right()[0] + 0.3, 0, 0], LEFT)
            self.play(FadeOut(f), tbl.reveal_row(3), FadeIn(cmp), run_time=b.t(0.25))

        with self.beat("warn") as b:
            self.play(FadeOut(VGroup(tbl, cmp)), run_time=b.t(0.12))
            w = ProcessBox("OpenUI does not export the action plan shape", "the refresh depends on it",
                           ISOLATION, sub_mono=False, sub_size=LABEL)
            w.move_to([0, -1.0, 0])
            pin = chip("pin  @openuidev/react-lang 1.0.1", SHELL, size=LABEL)
            pin.next_to(w, DOWN, buff=0.35)
            self.play(FadeIn(w, shift=UP * 0.15), run_time=b.t(0.3))
            self.play(FadeIn(pin, shift=UP * 0.1), run_time=b.t(0.25))


# ====================================================================== shell_reconnect
class ShellReconnect(DWScene):
    BEATS = [("trap", 21), ("watch", 15), ("timer", 14), ("main", 25), ("retry", 10), ("fetch", 14)]

    def construct(self):
        with self.beat("trap") as b:
            title = scene_title("Reconnect", SHELL)
            es = chip("EventSource", SHELL, size=LABEL)
            es.move_to([-4.6, 2.2, 0])
            ans = chip("answer 503", ISOLATION, size=LABEL)
            ans.move_to([1.2, 2.2, 0])
            a = Arrow(ans.get_left(), es.get_right(), buff=0.12, color=ISOLATION, stroke_width=3, tip_length=0.18)
            not200 = T("not 200", SMALL, ISOLATION).next_to(a, UP, buff=0.08)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(es), run_time=b.t(0.2))
            self.play(FadeIn(ans), GrowArrow(a), FadeIn(not200), run_time=b.t(0.3))
            closed = chip("CLOSED", ISOLATION, size=LABEL, fill=0.35)
            closed.next_to(es, DOWN, buff=0.4)
            forever = T("stops for good", LABEL, ISOLATION).next_to(closed, RIGHT, buff=0.3)
            self.play(FadeIn(closed, shift=DOWN * 0.1), FadeIn(forever), run_time=b.t(0.3))

        with self.beat("watch") as b:
            sw = T("the shell watches for the close, then opens a new stream after a wait", LABEL, SHELL)
            sw.move_to([0, 0.45, 0]).align_to(closed, LEFT)
            self.play(FadeIn(sw, shift=RIGHT * 0.15), run_time=b.t(0.4))

        with self.beat("timer") as b:
            vals = ["250 ms", "500 ms", "1 s", "2 s", "4 s", "8 s"]
            cs = [chip(v, SHELL, size=SMALL, fill=0.08 + 0.05 * i) for i, v in enumerate(vals)]
            row = VGroup(*cs).arrange(RIGHT, buff=0.55)
            row.next_to(sw, DOWN, buff=0.3).align_to(sw, LEFT)
            x2 = VGroup(*[T("×2", SMALL, MUTED).move_to((p.get_right() + q.get_left()) / 2)
                          for p, q in zip(cs, cs[1:])])
            cap = T("cap", SMALL, SHELL).next_to(cs[-1], RIGHT, buff=0.2)
            self.play(LaggedStart(*[FadeIn(c, shift=RIGHT * 0.1) for c in cs], lag_ratio=0.35), FadeIn(x2),
                      run_time=b.t(0.7))
            self.play(FadeIn(cap), run_time=b.t(0.15))

        with self.beat("main") as b:
            y = -1.2
            es2 = chip("EventSource", SHELL, size=SMALL)
            em = ProcessBox("Electron main", None, SHELL, width=2.9, height=0.8)
            host = ProcessBox("host", None, HOST, width=1.9, height=0.8)
            es2.move_to([-5.3, y, 0])
            em.move_to([-1.0, y, 0])
            host.move_to([3.0, y, 0])
            r1 = Arrow(es2.get_right() + UP * 0.12, em.box.get_left() + UP * 0.12, buff=0.08, color=SHELL,
                       stroke_width=3, tip_length=0.16)
            r1l = T("request", SMALL, MUTED).next_to(r1, UP, buff=0.06)
            r2 = DashedLine(em.box.get_right(), host.box.get_left(), color=HOST, stroke_width=3, dash_length=0.08)
            self.play(FadeIn(es2), FadeIn(em), GrowArrow(r1), FadeIn(r1l), run_time=b.t(0.2))
            self.play(Create(r2), FadeIn(host), run_time=b.t(0.12))
            bx = burst(ISOLATION, 0.28).move_to(host.box.get_corner(UR))
            dn = T("down", SMALL, ISOLATION).next_to(host, RIGHT, buff=0.25)
            self.play(*_dim(host.box, host.title), FadeIn(bx), FadeIn(dn), run_time=b.t(0.13))
            back = Arrow(em.box.get_left() + DOWN * 0.18, es2.get_right() + DOWN * 0.18, buff=0.08, color=SOLVED,
                         stroke_width=3, tip_length=0.16)
            bl = T("Response.error()", SMALL, SOLVED, mono=True).next_to(back, DOWN, buff=0.08)
            self.play(GrowArrow(back), FadeIn(bl), run_time=b.t(0.2))
            no503 = T("not 503", SMALL, ISOLATION).next_to(bl, RIGHT, buff=0.35)
            strike = Line(no503.get_left(), no503.get_right(), color=ISOLATION, stroke_width=3)
            self.play(FadeIn(no503), Create(strike), run_time=b.t(0.15))

        with self.beat("retry") as b:
            ok = status_chip("network error: EventSource retries by itself", solved=True)
            ok.next_to(es2, DOWN, buff=0.62).align_to(es2, LEFT)
            self.play(FadeIn(ok, shift=UP * 0.1), run_time=b.t(0.4))

        with self.beat("fetch") as b:
            lab = T("program request:", SMALL, SHELL)
            tries = [chip(f"try {i} · 5 s", SHELL, size=SMALL, fill=0.1) for i in range(1, 5)]
            g = _row(lab, *tries, buff=0.2)
            g.next_to(ok, DOWN, buff=0.2).align_to(ok, LEFT)
            if g.get_right()[0] > FRAME_W / 2 - MARGIN:
                g.shift(LEFT * (g.get_right()[0] - (FRAME_W / 2 - MARGIN)))
            self.play(FadeIn(lab), LaggedStart(*[FadeIn(t, shift=RIGHT * 0.1) for t in tries], lag_ratio=0.3),
                      run_time=b.t(0.6))


# ====================================================================== shell_serving
class ShellServing(DWScene):
    BEATS = [("q", 6), ("serve", 19), ("noask", 8), ("down", 10), ("pr", 14), ("zero", 5), ("add", 7),
             ("one", 16)]

    SMOKE = '''widget first={count:"0", stream:"open",
  events:["open","hello"]}
widget add={status:200,
  body:{ok:true, result:{count:1}, rev:1}}
widget after-add={count:"1", refreshes:1,
  events:["open","hello","data"]}'''

    def construct(self):
        with self.beat("q") as b:
            title = scene_title("Where the page comes from", SHELL)
            win = window_card("sample", w=2.9, h=2.2)
            win.move_to([-5.15, 0.9, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(win), run_time=b.t(0.5))

        with self.beat("serve") as b:
            em = rbox(3.9, 2.9, SHELL, fill=0.06)
            em.move_to([-0.35, 0.9, 0])
            em_t = T("Electron main", LABEL, SHELL, bold=True).next_to(em.get_corner(UL), DR, buff=0.15)
            r_w = chip("/widget/*", SHELL, size=SMALL)
            r_a = chip("/api/*", HOST, size=SMALL)
            routes = VGroup(r_w, r_a).arrange(DOWN, buff=0.45).move_to(em).shift(DOWN * 0.25)
            url = chip("dsh-app://app/widget/", SHELL, size=SMALL)
            url.move_to([-2.85, 2.65, 0])
            a_in = Arrow(win.frame.get_right(), em.get_left(), buff=0.08, color=SHELL, stroke_width=3,
                         tip_length=0.16)
            disk = disk_icon(SHELL, 0.55)
            dist = T("@deepwidgets/shell/dist", SMALL, TEXT, mono=True)
            dgrp = VGroup(disk, dist).arrange(DOWN, buff=0.12)
            dgrp.move_to([FRAME_W / 2 - MARGIN - dgrp.width / 2, 1.75, 0])
            dl = T("on disk", SMALL, MUTED).next_to(dgrp, UP, buff=0.1)
            a_disk = Arrow(r_w.get_right(), disk.get_left(), buff=0.1, color=SHELL, stroke_width=3,
                           tip_length=0.16)
            self.play(FadeIn(url), GrowArrow(a_in), FadeIn(em), FadeIn(em_t), run_time=b.t(0.3))
            self.play(FadeIn(r_w), FadeIn(dgrp), FadeIn(dl), GrowArrow(a_disk), run_time=b.t(0.3))
            files = T("built shell files", SMALL, SHELL).next_to(win.frame, DOWN, buff=0.15)
            self.play(Indicate(r_w, color=SHELL), FadeIn(files), run_time=b.t(0.25))

        with self.beat("noask") as b:
            host = ProcessBox("host", None, HOST, width=2.0, height=0.8).move_to([4.65, -0.6, 0])
            a_api = DashedLine(r_a.get_right(), host.box.get_left(), color=HOST, stroke_width=3,
                               dash_length=0.08).add_tip(tip_length=0.14, tip_width=0.14)
            fw = T("forwards", SMALL, HOST).next_to(host, DOWN, buff=0.12)
            self.play(FadeIn(r_a), Create(a_api), FadeIn(host), FadeIn(fw), run_time=b.t(0.5))

        with self.beat("down") as b:
            bx = burst(ISOLATION, 0.28).move_to(host.box.get_corner(UR))
            self.play(*_dim(host.box, host.title), FadeIn(bx), run_time=b.t(0.25))
            ok = status_chip("the page still loads", solved=True)
            ok.next_to(files, DOWN, buff=0.35).align_to(win.frame, LEFT)
            self.play(FadeIn(ok, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("pr") as b:
            self.play(FadeOut(Group(*[m for m in self.mobjects if m is not title])), run_time=b.t(0.12))
            pr = chip("PR #57 smoke check, in the app", SHELL, size=LABEL, mono=False)
            pr.move_to([0, 2.5, 0]).to_edge(LEFT, buff=MARGIN + 0.25)
            code = code_block(self.SMOKE, "text", color=SHELL)
            code.next_to(pr, DOWN, buff=0.3).align_to(pr, LEFT)
            hide_lines(code)
            self.add(code)
            mini = window_card("sample", w=3.0, h=2.4)
            mini.move_to([5.0, 0.9, 0])
            lab = T("Count", SMALL, MUTED)
            val = T("0", TITLE, TEXT, bold=True)
            mbody = VGroup(lab, val).arrange(DOWN, buff=0.08).move_to(_body(mini))
            self.play(FadeIn(pr), FadeIn(mini), run_time=b.t(0.35))

        with self.beat("zero") as b:
            self.play(reveal_lines(code, 0, 2), FadeIn(mbody), run_time=b.t(0.6))

        with self.beat("add") as b:
            self.play(reveal_lines(code, 2, 4), run_time=b.t(0.5))
            m = mark_line(code, 3, RUNTIME)
            self.play(Create(m), run_time=b.t(0.3))

        with self.beat("one") as b:
            self.play(reveal_lines(code, 4, 6), FadeOut(m), run_time=b.t(0.3))
            v1 = T("1", TITLE, TEXT, bold=True).move_to(val)
            self.play(Transform(val, v1), Indicate(mini.frame, color=RUNTIME, scale_factor=1.03), run_time=b.t(0.2))
            evs = VGroup(*[chip(e, c, size=SMALL) for e, c in (("open", SHELL), ("hello", HOST), ("data", RUNTIME))])
            evs.arrange(RIGHT, buff=0.15).next_to(mini, DOWN, buff=0.3)
            el = T("frames", SMALL, MUTED).next_to(evs, DOWN, buff=0.12)
            self.play(LaggedStart(*[FadeIn(e, shift=UP * 0.1) for e in evs], lag_ratio=0.4), FadeIn(el),
                      run_time=b.t(0.35))


# ====================================================================== windows_manager
class WindowsManager(DWScene):
    BEATS = [("open", 6), ("klass", 24), ("hello", 15), ("added", 5), ("removed", 5), ("reconnect", 21),
             ("flags", 24), ("size", 21), ("sandbox", 9), ("down", 9), ("fail", 15), ("notbuilt", 9),
             ("close", 6)]

    ROWS = [("hello", "opens the listed slugs, closes others"),
            ("added", "opens one window"),
            ("removed", "closes one window"),
            ("stream ends", "reopens: 0.5 s, doubling to 10 s")]

    FLAGS = '''frame: false
alwaysOnTop: true
setVisibleOnAllWorkspaces(true)
showInactive()
width: 320, height: 300
sandbox: true'''
    FLAG_NOTES = ["no frame", "on top", "all Spaces", "no focus", "320 × 300 px", "own renderer"]

    def construct(self):
        outline = OutlineDiagram()
        with self.beat("open") as b:
            outline.open_part(self, "electron_main", run_time=b.left)

        WW, WH = 2.0, 1.875   # 320 x 300 px
        GAP = 0.1             # 16 px at the same scale
        with self.beat("klass") as b:
            title = scene_title("The widget windows", SHELL)
            scr = rbox(4.7, 5.7, MUTED, fill=0.03, sw=2)
            scr.move_to([-4.4, 0.05, 0])
            scr_l = T("main screen", SMALL, MUTED).next_to(scr.get_corner(DR), UL, buff=0.15)
            emb = rbox(5.7, 2.3, SHELL, fill=0.04, sw=2)
            emb.move_to([1.5, 1.75, 0])
            em_l = T("Electron main", SMALL, SHELL, bold=True).next_to(emb.get_corner(UL), DR, buff=0.12)
            klass = ProcessBox("DesktopWidgetWindows", "GET /api/widgets/events", SHELL)
            klass.move_to([1.5, 1.8, 0])
            host = chip("host", HOST, size=LABEL)
            host.move_to([5.65, 2.05, 0])
            ck = chip("host cookie", HOST, size=SMALL)
            ck.next_to(host, DOWN, buff=0.25)
            a_ev = Arrow(host.get_left(), klass.box.get_right() + UP * 0.2, buff=0.1, color=HOST, stroke_width=3,
                         tip_length=0.16)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(scr), FadeIn(scr_l), run_time=b.t(0.2))
            self.play(FadeIn(emb), FadeIn(em_l), FadeIn(klass), run_time=b.t(0.25))
            one = T("one window for each widget", SMALL, SHELL).next_to(klass, DOWN, buff=0.12)
            self.play(FadeIn(one), run_time=b.t(0.15))
            self.play(FadeIn(host), GrowArrow(a_ev), FadeIn(ck), run_time=b.t(0.3))
            tbl = RevealTable(["event", "the class"], self.ROWS, mono_cols=[0],
                              cell_colors={(0, 0): HOST, (1, 0): HOST, (2, 0): HOST, (3, 0): HOST})
            tbl.move_to([2.6, 0, 0]).align_to([0, -0.3, 0], UP)
            self.add(tbl)

        x_win = scr.get_left()[0] + 0.15 + WW / 2
        y1 = scr.get_top()[1] - 0.15 - WH / 2
        y2 = y1 - WH - GAP

        def make_win(name, y):
            w = window_card(name, w=WW, h=WH)
            w.move_to([x_win, y, 0])
            return w

        def frame_chip(text, b, frac, y=0.22):
            f = chip(text, HOST, size=SMALL)
            start = [host.get_x() - f.width / 2 + host.width / 2, y, 0]
            f.move_to(start)
            self.add(f)
            self.play(FadeIn(f), f.animate.move_to([klass.get_x(), y, 0]), run_time=b.t(frac))
            return f

        with self.beat("hello") as b:
            f = frame_chip("hello {slugs:[sample, groceries]}", b, 0.3)
            w1, w2 = make_win("sample", y1), make_win("groceries", y2)
            self.play(FadeOut(f), tbl.reveal_row(0), run_time=b.t(0.2))
            self.play(FadeIn(w1, scale=0.9), FadeIn(w2, scale=0.9), run_time=b.t(0.3))

        with self.beat("added") as b:
            self.play(tbl.reveal_row(1), run_time=b.t(0.5))

        with self.beat("removed") as b:
            f = chip("removed groceries", HOST, size=SMALL).move_to([klass.get_x(), 0.22, 0])
            self.play(FadeIn(f), tbl.reveal_row(2), run_time=b.t(0.35))
            self.play(FadeOut(w2, scale=0.9), FadeOut(f), run_time=b.t(0.4))

        with self.beat("reconnect") as b:
            self.play(tbl.reveal_row(3), run_time=b.t(0.3))
            mk = tbl.mark_row(3, SHELL)
            self.play(Create(mk), run_time=b.t(0.2))

        with self.beat("flags") as b:
            self.play(FadeOut(VGroup(tbl, mk)), run_time=b.t(0.08))
            code = code_block(self.FLAGS, "typescript", color=SHELL)
            code.move_to([0, 0, 0]).align_to([0, 0.15, 0], UP).align_to(emb, LEFT)
            hide_lines(code)
            self.add(code)
            notes = VGroup()
            for i, n in enumerate(self.FLAG_NOTES):
                t = T(n, SMALL, MUTED)
                t.move_to([0, code.code_lines[i].get_y(), 0]).align_to([code.get_right()[0] + 0.3, 0, 0], LEFT)
                t.set_opacity(0)
                notes.add(t)
            self.add(notes)
            self.play(reveal_lines(code, 0, 4, lag=0.3), LaggedStart(*[n.animate.set_opacity(1) for n in notes[:4]],
                                                                      lag_ratio=0.3), run_time=b.t(0.6))
            sp = T("Spaces: the virtual desktops of macOS", SMALL, MUTED)
            sp.next_to(code, DOWN, buff=0.2).align_to(code, LEFT)
            self.play(FadeIn(sp), run_time=b.t(0.2))

        with self.beat("size") as b:
            self.play(reveal_lines(code, 4, 5), notes[4].animate.set_opacity(1), run_time=b.t(0.25))
            ghost = rbox(WW, WH, SHELL, fill=0.0, sw=2, dashed=True).move_to([x_win, y2, 0])
            gl = T("next", SMALL, MUTED).move_to(ghost)
            gap_l = T("16 px", SMALL, SHELL).next_to(VGroup(w1.frame, ghost), RIGHT, buff=0.2)
            gap_l.set_y((w1.frame.get_bottom()[1] + ghost.get_top()[1]) / 2)
            dim_l = T("320 × 300 px", SMALL, SHELL).next_to(w1.frame, RIGHT, buff=0.2)
            self.play(Create(ghost), FadeIn(gl), FadeIn(gap_l), FadeIn(dim_l), run_time=b.t(0.4))

        with self.beat("sandbox") as b:
            self.play(reveal_lines(code, 5, 6), notes[5].animate.set_opacity(1), run_time=b.t(0.3))
            rb = lines("renderer", "sandbox", size=SMALL, color=SHELL, align=ORIGIN, buff=0.08).move_to(_body(w1))
            self.play(FadeIn(rb), run_time=b.t(0.3))

        with self.beat("down") as b:
            self.play(FadeOut(VGroup(code, notes, sp)), FadeOut(VGroup(ghost, gl, gap_l, dim_l)),
                      run_time=b.t(0.15))
            bx = burst(ISOLATION, 0.26).move_to(host.get_corner(UR))
            dn = T("down", SMALL, ISOLATION).next_to(host, UP, buff=0.12)
            self.play(*_dim(host[0], host[1]), *_dim(ck[0], ck[1]), FadeIn(bx), FadeIn(dn),
                      run_time=b.t(0.3))
            stay = status_chip("windows stay open", solved=True)
            stay.move_to([2.75, -0.3, 0])
            self.play(FadeIn(stay), Indicate(w1.frame, color=SOLVED, scale_factor=1.03), run_time=b.t(0.4))

        with self.beat("fail") as b:
            self.play(FadeOut(VGroup(bx, dn, stay)), *_undim(host[0], host[1]), *_undim(ck[0], ck[1]),
                      run_time=b.t(0.1))
            w3 = make_win("groceries", y2)
            fl = T("fails to load", SMALL, ISOLATION).move_to(_body(w3))
            self.play(FadeIn(w3), w3.frame.animate.set_stroke(ISOLATION), FadeIn(fl), run_time=b.t(0.2))
            cl = T("closes", SMALL, ISOLATION).next_to(w3, RIGHT, buff=0.25)
            self.play(FadeOut(VGroup(w3, fl), scale=0.9), FadeIn(cl), run_time=b.t(0.2))
            f = frame_chip("hello", b, 0.2, y=-0.3)
            w4 = make_win("groceries", y2)
            ag = T("opens again", SMALL, SOLVED).next_to(w4, RIGHT, buff=0.25).set_y(cl.get_y() - 0.45)
            self.play(FadeOut(f), FadeIn(w4, scale=0.9), FadeIn(ag), run_time=b.t(0.25))

        with self.beat("notbuilt") as b:
            nb = VGroup(*[status_chip(t, solved=False) for t in ("saved positions", "window manager", "tray icon")])
            nb.arrange(RIGHT, buff=0.25).move_to([2.75, -1.6, 0])
            nl = T("not built yet", SMALL, OPEN).next_to(nb, DOWN, buff=0.15)
            self.play(LaggedStart(*[FadeIn(n, shift=UP * 0.1) for n in nb], lag_ratio=0.3), FadeIn(nl),
                      run_time=b.t(0.6))

        with self.beat("close") as b:
            outline.close_part(self, "electron_main", next_key="mcp_server", run_time=b.left)
