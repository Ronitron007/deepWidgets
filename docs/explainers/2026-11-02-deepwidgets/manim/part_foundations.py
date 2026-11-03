"""Part `part_foundations`: cold_open outline dsh_fork cordis_context plugin_rows trim_method
widget_rows_on three_processes probe_and_trace.

Beat weights are seconds of the recorded take (sentence ends found with silencedetect), so each
beat starts with its sentence. The base scales them to the audio length.
"""
import numpy as np

from dwscene import *


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (no-op if already later)."""
    scene.wait_until(b.start + frac * b.length)


def _cursor(color=USER):
    pts = [(0, 0, 0), (0, -0.55, 0), (0.14, -0.42, 0), (0.25, -0.65, 0), (0.33, -0.61, 0),
           (0.22, -0.38, 0), (0.4, -0.38, 0)]
    return Polygon(*pts, stroke_color=BG, stroke_width=2, fill_color=color, fill_opacity=1)


def _row_stack(cols=10, rows=20, bw=0.4, bh=0.12, px=0.5, py=0.205, color=RUNTIME, opacity=0.85):
    """200 small bars, one per plugin row, row-major (top row first)."""
    g = VGroup()
    for r in range(rows):
        for c in range(cols):
            g.add(Rectangle(width=bw, height=bh, stroke_width=0, fill_color=color, fill_opacity=opacity)
                  .move_to([c * px, -r * py, 0]))
    return g


_RNG = np.random.default_rng(7)
_ON = sorted(_RNG.choice(200, 40, replace=False).tolist())       # 40 rows stay on
_PENDING = sorted(_RNG.choice(_ON, 8, replace=False).tolist())    # 8 of them pending


def _swap(old, new):
    """Caption change: the old one fades out, then the new one fades in (no overlap)."""
    return Succession(FadeOut(old), FadeIn(new))


def _body(card):
    """Body center of a window_card at its current place (window_card.body_center is set at build time)."""
    return card.frame.get_center() + DOWN * 0.21


def _def(text, color=TEXT, size=26):
    """Short definition label in the caption strip."""
    return caption(text, size=size, color=color)


# ================================================================ cold_open
class ColdOpen(DWScene):
    BEATS = [("title", 3.4), ("windows", 9.7), ("click", 6.5), ("agent", 8.2), ("covers", 8.5),
             ("run", 6.5)]

    def construct(self):
        with self.beat("title") as b:
            name = T("deepWidgets", 72, TEXT, bold=True)
            sub = T("from the top down", BODY, MUTED)
            g = VGroup(name, sub).arrange(DOWN, buff=0.35).move_to(UP * 0.3)
            self.play(Write(name), run_time=b.t(0.55))
            self.play(FadeIn(sub, shift=UP * 0.15), run_time=b.t(0.3))

        with self.beat("windows") as b:
            head = scene_title("deepWidgets", SHELL)
            self.play(FadeOut(sub), ReplacementTransform(name, head), run_time=b.t(0.12))
            sample = window_card("sample", 3.0, 2.2).move_to([-4.6, 1.05, 0])
            count = T("Count 0", BODY).move_to(_body(sample) + UP * 0.32)
            add = chip("Add 1", USER, mono=False).move_to(_body(sample) + DOWN * 0.38)
            groc = window_card("groceries", 3.0, 2.0).move_to([-4.6, -1.55, 0])
            items = lines("milk", "eggs", size=LABEL).move_to(_body(groc))
            self.play(LaggedStart(FadeIn(VGroup(sample, count, add), shift=UP * 0.3),
                                  FadeIn(VGroup(groc, items), shift=UP * 0.3), lag_ratio=0.4),
                      run_time=b.t(0.2))
            _at(self, b, 0.33)
            w1 = T("each window = one widget", BODY, SHELL).move_to([1.6, 1.6, 0])
            self.play(FadeIn(w1), Indicate(sample.frame, color=SHELL), Indicate(groc.frame, color=SHELL),
                      run_time=b.t(0.15))
            _at(self, b, 0.55)
            w2 = lines("a widget shows one thing:", "a counter, a grocery list", size=LABEL, color=MUTED)
            w2.next_to(w1, DOWN, buff=0.35)
            self.play(FadeIn(w2), Indicate(count), Indicate(items), run_time=b.t(0.2))

        with self.beat("click") as b:
            u1 = T("two kinds of users can change a widget", BODY).move_to([2.2, 2.2, 0])
            self.play(FadeOut(VGroup(w1, w2)), FadeIn(u1), run_time=b.t(0.2))
            _at(self, b, 0.35)
            you = T("you: click a button", BODY, USER).move_to([1.2, 1.0, 0])
            cur = _cursor().move_to([0.3, -0.6, 0])
            self.play(FadeIn(you), FadeIn(cur), run_time=b.t(0.12))
            self.play(cur.animate.move_to(add.get_center() + DR * 0.25), run_time=b.t(0.2))
            count1 = T("Count 1", BODY).move_to(count)
            self.play(Indicate(add, color=USER, scale_factor=1.15), Transform(count, count1), run_time=b.t(0.15))

        with self.beat("agent") as b:
            ag = chip("agent (Claude Code)", AGENT, mono=False).move_to([4.6, 0.0, 0])
            arr = labeled_arrow(ag.get_left(), sample.frame.get_right() + DOWN * 0.4, color=AGENT)
            self.play(FadeIn(ag), GrowArrow(arr.arrow), run_time=b.t(0.2))
            dfn = T("an outside AI program", LABEL, MUTED).next_to(ag, DOWN, buff=0.15)
            self.play(FadeIn(dfn), run_time=b.t(0.1))
            _at(self, b, 0.5)
            newc = window_card("new widget", 2.8, 1.6).move_to([2.0, -1.75, 0])
            mk = T("+", HEADING, AGENT).move_to(_body(newc))
            arr2 = labeled_arrow(dfn.get_bottom() + DOWN * 0.05, newc.frame.get_right() + UP * 0.2,
                                 color=AGENT, dashed=True)
            note = lines("written by the agent,", "installed while", "the app runs", size=LABEL, color=AGENT)
            note.next_to(newc, RIGHT, buff=0.4).shift(DOWN * 0.15)
            if note.get_right()[0] > 6.8:
                note.shift(LEFT * (note.get_right()[0] - 6.8))
            self.play(Create(arr2), FadeIn(VGroup(newc, mk), shift=UP * 0.2), run_time=b.t(0.25))
            self.play(FadeIn(note), run_time=b.t(0.15))

        with self.beat("covers") as b:
            keep = [m for m in self.mobjects if m is not head]
            self.play(*[FadeOut(m) for m in keep], run_time=b.t(0.12))
            row = VGroup(status_chip("what works today", True), status_chip("what does not", False),
                         chip("the numbers that show both", TEXT, mono=False)).arrange(RIGHT, buff=0.4)
            row.move_to([0, 1.7, 0])
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.2) for c in row], lag_ratio=0.5),
                      run_time=b.t(0.4))
            _at(self, b, 0.6)
            host = ProcessBox("host", "no windows", HOST, sub_mono=False).move_to([0, 0.35, 0])
            one = T("one real run", BODY).next_to(host, LEFT, buff=0.5)
            self.play(FadeIn(host), FadeIn(one), run_time=b.t(0.2))

        with self.beat("run") as b:
            names = [("MCP server", MCP), ("runtime", RUNTIME), ("creation", CREATION),
                     ("blame", ISOLATION), ("quarantine", ISOLATION)]
            chips = VGroup(*[chip(n, c, mono=False, size=LABEL) for n, c in names]).arrange(RIGHT, buff=0.75)
            chips.move_to([0, -1.4, 0])
            arrows = VGroup(*[Arrow(chips[i].get_right(), chips[i + 1].get_left(), buff=0.08, stroke_width=3,
                                    color=MUTED, tip_length=0.16) for i in range(4)])
            down = Arrow(host.get_bottom(), chips[0].get_top() + RIGHT * 0.3, buff=0.1, color=MUTED,
                         stroke_width=3, tip_length=0.16)
            seq = [GrowArrow(down)]
            for i, c in enumerate(chips):
                seq.append(FadeIn(c, shift=RIGHT * 0.15))
                if i < 4:
                    seq.append(GrowArrow(arrows[i]))
            self.play(LaggedStart(*seq, lag_ratio=0.55), run_time=b.t(0.8))


# ================================================================ outline
class Outline(DWScene):
    BEATS = [("intro", 4.9), ("desktop", 9.5), ("host", 4.2), ("ctxw", 8.1), ("doors", 2.6),
             ("shell", 4.0), ("mcp", 7.9), ("same", 4.1), ("bottom", 2.4), ("creation", 4.4),
             ("isolation", 9.1), ("parts", 3.9), ("walk", 3.1)]

    def construct(self):
        o = OutlineDiagram()
        with self.beat("intro") as b:
            self.play(FadeIn(o, lag_ratio=0.02), run_time=b.t(0.7))

        with self.beat("desktop") as b:
            self.play(o.highlight("desktop_app"), run_time=b.t(0.15))
            _at(self, b, 0.2)
            for k in ("electron_main", "host_node", "renderer"):
                self.play(o.highlight("desktop_app", k), run_time=b.t(0.1))
            _at(self, b, 0.62)
            self.play(o.highlight("desktop_app", "host_node"), run_time=b.t(0.15))

        with self.beat("host") as b:
            self.play(o.highlight("host"), run_time=b.t(0.3))
            _at(self, b, 0.5)
            self.play(o.highlight("host", "cordis"), run_time=b.t(0.3))

        with self.beat("ctxw") as b:
            self.play(o.highlight("ctx_widgets"), run_time=b.t(0.2))
            _at(self, b, 0.62)
            self.play(o.highlight("ctx_widgets", "bundles", "bundle_sample", "bundle_groceries"),
                      run_time=b.t(0.25))

        with self.beat("doors") as b:
            self.play(o.highlight("ctx_widgets", arrows=("arrow_shell", "arrow_mcp")), run_time=b.t(0.5))

        with self.beat("shell") as b:
            self.play(o.highlight("shell_page", "ctx_widgets", arrows=("arrow_shell",)), run_time=b.t(0.3))

        with self.beat("mcp") as b:
            self.play(o.highlight("mcp_server", "agent", "ctx_widgets", arrows=("arrow_agent", "arrow_mcp")),
                      run_time=b.t(0.2))
            _at(self, b, 0.5)
            mdef = lines("MCP: a standard", "protocol that lets", "an agent call tools", size=SMALL, color=MCP)
            mdef.move_to([5.85, -1.05, 0])
            self.play(FadeIn(mdef), run_time=b.t(0.15))

        with self.beat("same") as b:
            same = lines("same", "action", "code", size=SMALL, color=RUNTIME).move_to([-2.55, 0.75, 0])
            self.play(FadeOut(mdef),
                      o.highlight("shell_page", "mcp_server", "ctx_widgets", arrows=("arrow_shell", "arrow_mcp")),
                      run_time=b.t(0.3))
            self.play(FadeIn(same), Indicate(o.box("ctx_widgets"), color=RUNTIME, scale_factor=1.05),
                      run_time=b.t(0.35))

        with self.beat("bottom") as b:
            self.play(FadeOut(same), o.highlight("creation", "isolation"), run_time=b.t(0.5))

        with self.beat("creation") as b:
            self.play(o.highlight("creation", "gate_compile", "gate_lint", "gate_test_run", "install",
                                  arrows=("arrow_creation",)), run_time=b.t(0.25))
            for k in ("gate_compile", "gate_lint", "gate_test_run"):
                self.play(Indicate(o.box(k), color=CREATION, scale_factor=1.12), run_time=b.t(0.15))

        with self.beat("isolation") as b:
            self.play(o.highlight("isolation", "host", arrows=("link_isolation",)), run_time=b.t(0.15))
            _at(self, b, 0.45)
            pr = T("PR #65, merged", SMALL, SOLVED).move_to([5.85, -1.75, 0])
            self.play(FadeIn(pr), run_time=b.t(0.12))

        with self.beat("parts") as b:
            for k in ("blame", "quarantine", "supervisor", "watchdog"):
                self.play(o.highlight("isolation", k), run_time=b.t(0.2))

        with self.beat("walk") as b:
            self.play(FadeOut(pr), o.reset(), run_time=b.t(0.5))


# ================================================================ dsh_fork
class DshFork(DWScene):
    BEATS = [("open", 3.5), ("dsh", 8.4), ("apps", 3.5), ("fork", 4.1), ("squash", 9.2), ("count", 10.2),
             ("why", 5.4), ("tiles", 6.1), ("rest", 3.3)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "host", run_time=b.left)

        with self.beat("dsh") as b:
            title = scene_title("A fork of DeepSeek Harness (DSH)", MUTED)
            box = rbox(6.6, 1.65, MUTED, fill=0.08).move_to([-3.4, 1.85, 0])
            t1 = T("DeepSeek Harness (DSH)", LABEL, TEXT, bold=True)
            t2 = T("deepseek-ai/deepseek-harness", SMALL, TEXT, mono=True)
            t3 = T("open source · runs AI agents · MIT license", SMALL, MUTED)
            txt = VGroup(t1, t2, t3).arrange(DOWN, buff=0.12).move_to(box)
            dsh = VGroup(box, txt)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.12))
            self.play(FadeIn(box), FadeIn(VGroup(t1, t2)), run_time=b.t(0.2))
            _at(self, b, 0.45)
            self.play(FadeIn(t3), run_time=b.t(0.2))

        with self.beat("apps") as b:
            apps = VGroup(*[chip(s, MUTED, mono=False) for s in ("command-line app", "web app", "desktop app")])
            apps.arrange(RIGHT, buff=0.2).move_to([-3.4, 0.4, 0])
            self.play(LaggedStart(*[FadeIn(a, shift=UP * 0.15) for a in apps], lag_ratio=0.4), run_time=b.t(0.6))

        with self.beat("fork") as b:
            cap = _def("fork = a copy of a project that then changes on its own")
            self.play(FadeIn(cap), run_time=b.t(0.2))

        with self.beat("squash") as b:
            dw = ProcessBox("deepWidgets", None, RUNTIME, width=2.8, height=1.0).move_to([4.95, 1.85, 0])
            arr = labeled_arrow(box.get_right(), dw.get_left(), "one squashed commit", MUTED, mono=False)
            sha = chip("22ddee3", MUTED).next_to(arr.arrow, DOWN, buff=0.15)
            self.play(GrowArrow(arr.arrow), FadeIn(arr.label), run_time=b.t(0.2))
            self.play(FadeIn(dw, shift=LEFT * 0.2), FadeIn(sha), run_time=b.t(0.15))
            _at(self, b, 0.58)
            cap2 = _def("squashed commit = a whole history as one change")
            self.play(_swap(cap, cap2), run_time=b.t(0.15))

        with self.beat("count") as b:
            n = T("394 workspace packages", BODY, TEXT, bold=True).move_to([3.6, 0.5, 0])
            bar_w, x0, y = 6.0, 0.6, -0.15
            dsh_part = Rectangle(width=bar_w * 387 / 394, height=0.32, stroke_width=0, fill_color=MUTED,
                                 fill_opacity=0.8).move_to([x0, y, 0], aligned_edge=LEFT)
            dw_part = Rectangle(width=bar_w * 7 / 394, height=0.32, stroke_width=0, fill_color=RUNTIME,
                                fill_opacity=1).next_to(dsh_part, RIGHT, buff=0)
            l1 = T("387 from DSH", SMALL, MUTED).next_to(dsh_part, DOWN, buff=0.15).align_to(dsh_part, LEFT)
            l2 = T("7 in deepwidgets/*", SMALL, RUNTIME, mono=False).next_to(dw_part, DOWN, buff=0.15)
            l2.align_to(dw_part, RIGHT)
            self.play(FadeOut(cap2), FadeIn(n), run_time=b.t(0.12))
            self.play(GrowFromEdge(dsh_part, LEFT), FadeIn(dw_part), run_time=b.t(0.2))
            _at(self, b, 0.4)
            self.play(FadeIn(l1), FadeIn(l2), run_time=b.t(0.12))
            _at(self, b, 0.72)
            cap3 = _def("most of them: DSH code that deepWidgets does not need", MUTED)
            self.play(FadeIn(cap3), Indicate(dsh_part, color=MUTED, scale_factor=1.03), run_time=b.t(0.15))

        with self.beat("why") as b:
            q = T("Why start from DSH?", BODY, TEXT, bold=True).move_to([0, -1.3, 0])
            self.play(FadeOut(cap3), FadeOut(apps), FadeIn(q), run_time=b.t(0.2))
            _at(self, b, 0.4)
            cap4 = _def("DSH already has the three parts that a widget app needs")
            self.play(FadeIn(cap4), run_time=b.t(0.2))

        with self.beat("tiles") as b:
            tiles = VGroup(ProcessBox("Cordis host process", None, HOST, width=4.15, height=0.8),
                           ProcessBox("Cordis client in the page", None, SHELL, width=4.15, height=0.8),
                           ProcessBox("Electron desktop app", None, SHELL, width=4.15, height=0.8))
            tiles.arrange(RIGHT, buff=0.3).move_to([0, -2.25, 0])
            self.play(LaggedStart(*[FadeIn(t, shift=UP * 0.2) for t in tiles], lag_ratio=0.45), run_time=b.t(0.7))

        with self.beat("rest") as b:
            cap5 = _def("take those parts, turn off the rest", SOLVED)
            self.play(_swap(cap4, cap5), dsh_part.animate.set_fill(opacity=DIM),
                      l1.animate.set_opacity(0.45), run_time=b.t(0.4))


# ================================================================ cordis_context
class CordisContext(DWScene):
    BEATS = [("plugin", 10.8), ("ctx", 6.5), ("service", 12.2), ("inject", 8.1), ("fiber", 4.4),
             ("cut", 3.8), ("effect", 5.1), ("own", 5.13)]

    CODE = ("export const name = 'deepwidgets-widget-sample'\n"
            "export const inject = ['widgets', 'timer']\n"
            "export function apply(ctx, config) { ... }")

    def construct(self):
        with self.beat("plugin") as b:
            title = scene_title("Cordis: plugin, context, fiber", RUNTIME)
            code = code_block(self.CODE)
            code.to_edge(LEFT, buff=0.6).set_y(2.05)
            hide_lines(code)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.08))
            _at(self, b, 0.15)
            cap = _def("Cordis = a plugin runtime")
            self.add(code)
            self.play(FadeIn(cap), reveal_lines(code, 0), run_time=b.t(0.15))
            _at(self, b, 0.45)
            cap2 = _def("plugin = a module with a function apply()")
            self.play(_swap(cap, cap2), reveal_lines(code, 2), run_time=b.t(0.15))
            m = mark_line(code, 2, RUNTIME)
            _at(self, b, 0.78)
            cap3 = _def("Cordis calls apply() when the plugin loads")
            self.play(_swap(cap2, cap3), Create(m), run_time=b.t(0.15))

        with self.beat("ctx") as b:
            ln = code.code_lines[2]
            # 'export function apply(' is 22 characters; mark ctx (3) then config (6)
            cw = ln.width / len("export function apply(ctx, config) { ... }")
            x0 = ln.get_left()[0]
            u_ctx = Line([x0 + 22 * cw, ln.get_bottom()[1] - 0.06, 0], [x0 + 25 * cw, ln.get_bottom()[1] - 0.06, 0],
                         color=CREATION, stroke_width=4)
            u_cfg = Line([x0 + 27 * cw, ln.get_bottom()[1] - 0.06, 0], [x0 + 33 * cw, ln.get_bottom()[1] - 0.06, 0],
                         color=CREATION, stroke_width=4)
            cap4 = _def("first: the context (ctx)   second: the config of its row")
            self.play(FadeOut(m), Create(u_ctx), _swap(cap3, cap4), run_time=b.t(0.25))
            _at(self, b, 0.55)
            self.play(Create(u_cfg), run_time=b.t(0.2))

        with self.beat("service") as b:
            root = ProcessBox("Context", "ctx", RUNTIME).move_to([-1.3, 0.45, 0])
            svc_lbl = T("services", LABEL, MUTED)
            s1 = chip("ctx.widgets", RUNTIME)
            s2 = chip("ctx.timer", RUNTIME)
            svcs = VGroup(s1, s2).arrange(RIGHT, buff=0.3)
            sv = VGroup(svc_lbl, svcs).arrange(RIGHT, buff=0.3).move_to([3.6, 0.45, 0])
            link = Line(root.get_right(), sv.get_left(), color=RUNTIME, stroke_width=2.5)
            self.play(FadeOut(u_ctx), FadeOut(u_cfg), FadeIn(root), run_time=b.t(0.12))
            _at(self, b, 0.33)
            cap5 = _def("a plugin reads services and registers the things that it owns")
            self.play(_swap(cap4, cap5), run_time=b.t(0.1))
            _at(self, b, 0.58)
            cap6 = _def("service = a named object on the context, e.g. ctx.widgets")
            self.play(_swap(cap5, cap6), Create(link), FadeIn(sv), run_time=b.t(0.15))
            _at(self, b, 0.8)
            cap7 = _def("one plugin gives a service; other plugins use it")
            self.play(_swap(cap6, cap7), Indicate(s1, color=RUNTIME), run_time=b.t(0.15))

        with self.beat("inject") as b:
            self.play(reveal_lines(code, 1), run_time=b.t(0.12))
            mi = mark_line(code, 1, CREATION)
            pa = Arrow(code.code_lines[1].get_right() + RIGHT * 0.1, svcs.get_top(), buff=0.1, color=CREATION,
                       stroke_width=3, tip_length=0.18)
            cap8 = _def("inject: Cordis waits until each named service exists")
            self.play(Create(mi), GrowArrow(pa), _swap(cap7, cap8), run_time=b.t(0.25))
            self.play(Indicate(svcs, color=CREATION, scale_factor=1.06), run_time=b.t(0.2))

        with self.beat("fiber") as b:
            f1 = chip("widgets", RUNTIME)
            f2 = chip("widget-sample", RUNTIME)
            f3 = chip("timer", RUNTIME)
            fib = VGroup(f1, f2, f3).arrange(RIGHT, buff=0.8).move_to([-1.3, -0.95, 0])
            flbl = T("fibers", LABEL, MUTED).next_to(fib, LEFT, buff=0.35)
            edges = VGroup(*[Line(root.get_bottom(), f.get_top(), color=RUNTIME, stroke_width=2) for f in fib])
            it = VGroup(*[chip(s, MUTED, mono=False) for s in ("route", "timer", "widget")])
            it.arrange(RIGHT, buff=0.3).move_to([f2.get_x(), -2.25, 0])
            iedges = VGroup(*[Line(f2.get_bottom(), c.get_top(), color=MUTED, stroke_width=2) for c in it])
            cap9 = _def("fiber = the live record of one loaded plugin")
            self.play(FadeOut(cap8), FadeOut(mi), FadeOut(pa), Create(edges), FadeIn(fib), FadeIn(flbl),
                      FadeIn(cap9), run_time=b.t(0.3))
            self.play(Create(iedges), FadeIn(it, shift=DOWN * 0.1), run_time=b.t(0.3))

        with self.beat("cut") as b:
            x = Cross(f2, stroke_color=ISOLATION, stroke_width=5, scale_factor=0.8)
            cap10 = _def("fiber ends: Cordis removes all that the plugin registered", ISOLATION)
            self.play(_swap(cap9, cap10), Create(x), f2[0].animate.set_stroke(ISOLATION),
                      run_time=b.t(0.3))
            self.play(FadeOut(VGroup(it, iedges), shift=DOWN * 0.3), run_time=b.t(0.35))

        with self.beat("effect") as b:
            eff = chip("ctx.effect(setup) → cleanup", RUNTIME, size=LABEL).move_to([3.6, -2.25, 0])
            ea = Arrow(eff.get_left(), f2.get_bottom() + RIGHT * 0.4, buff=0.1, color=RUNTIME, stroke_width=3,
                       tip_length=0.18)
            cap11 = _def("setup runs now; the cleanup waits for the fiber end")
            self.play(FadeIn(eff), GrowArrow(ea), _swap(cap10, cap11), run_time=b.t(0.35))

        with self.beat("own") as b:
            it2 = VGroup(*[chip(s, MUTED, mono=False) for s in ("route", "timer", "widget")])
            it2.arrange(RIGHT, buff=0.3).move_to([f2.get_x(), -2.25, 0])
            ie2 = VGroup(*[Line(f2.get_bottom(), c.get_top(), color=MUTED, stroke_width=2) for c in it2])
            self.play(FadeOut(x), f2[0].animate.set_stroke(RUNTIME), FadeOut(ea), FadeOut(eff),
                      FadeIn(it2), Create(ie2), run_time=b.t(0.3))
            own = SurroundingRectangle(VGroup(f2, it2[2]), color=CREATION, buff=0.12, corner_radius=0.08)
            cap12 = _def("a widget registration belongs to the fiber of its plugin", CREATION)
            self.play(_swap(cap11, cap12), Create(own), it2[2][0].animate.set_stroke(CREATION),
                      run_time=b.t(0.3))


# ================================================================ plugin_rows
class PluginRows(DWScene):
    BEATS = [("q", 4.3), ("row", 5.7), ("loader", 4.2), ("profile", 4.3), ("patch", 5.6), ("boot", 2.975)]

    YAML = ("# deepwidgets/widgets/cordis.patch.yml\n"
            "- insert:\n"
            "    - id: deepwidgets-widgets\n"
            "      name: '@deepwidgets/widgets'")

    def construct(self):
        with self.beat("q") as b:
            title = scene_title("Plugin rows", RUNTIME)
            q = T("Which plugins does Cordis load?", BODY, MUTED).move_to([-2.5, 1.5, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(q), run_time=b.t(0.3))

        with self.beat("row") as b:
            code = code_block(self.YAML, "yaml")
            code.to_edge(LEFT, buff=0.5).set_y(1.9)
            hide_lines(code)
            self.add(code)
            self.play(FadeOut(q), reveal_lines(code, 1, 4, lag=0.3), run_time=b.t(0.3))
            tags = VGroup(chip("id", RUNTIME, mono=False), chip("package name", RUNTIME, mono=False),
                          chip("config (none in this row)", MUTED, mono=False, dashed=True))
            tags.arrange(RIGHT, buff=0.25).next_to(code, DOWN, buff=0.3).align_to(code, LEFT)
            cap = _def("plugin row = one entry in a config file")
            m2, m3 = mark_line(code, 2, RUNTIME), mark_line(code, 3, RUNTIME)
            self.play(FadeIn(cap), run_time=b.t(0.12))
            _at(self, b, 0.5)
            self.play(Create(m2), FadeIn(tags[0]), run_time=b.t(0.12))
            self.play(Create(m3), FadeIn(tags[1]), run_time=b.t(0.12))
            self.play(FadeIn(tags[2]), run_time=b.t(0.1))

        with self.beat("loader") as b:
            stack = _row_stack(color=MUTED, opacity=0.5)
            stack.move_to([4.1, 0.25, 0])
            loader = ProcessBox("Cordis loader", "reads rows, loads each plugin", RUNTIME, sub_mono=False)
            loader.move_to([-3.6, -1.05, 0])
            la = Arrow(loader.get_right(), stack.get_left() + DOWN * 0.6, buff=0.15, color=RUNTIME,
                       stroke_width=3, tip_length=0.18)
            self.play(FadeOut(VGroup(m2, m3)), FadeIn(stack, lag_ratio=0.002), FadeIn(loader), GrowArrow(la),
                      run_time=b.t(0.35))
            scan = Line(stack.get_corner(UL) + LEFT * 0.1 + UP * 0.05, stack.get_corner(UR) + RIGHT * 0.1 + UP * 0.05,
                        color=RUNTIME, stroke_width=3)
            self.add(scan)
            self.play(scan.animate.shift(DOWN * (stack.height + 0.1)),
                      LaggedStart(*[bar.animate.set_fill(RUNTIME, 0.85) for bar in stack], lag_ratio=0.004),
                      run_time=b.t(0.55))
            self.remove(scan)

        with self.beat("profile") as b:
            pl = T("profile = a named set of rows", LABEL, TEXT)
            pcs = VGroup(chip("desktop", RUNTIME), chip("web", MUTED)).arrange(RIGHT, buff=0.25)
            prof = VGroup(pl, pcs).arrange(RIGHT, buff=0.35).move_to([0, -2.35, 0]).align_to(code, LEFT)
            self.play(FadeOut(cap), FadeIn(prof), run_time=b.t(0.3))

        with self.beat("patch") as b:
            self.play(reveal_lines(code, 0), run_time=b.t(0.12))
            m0 = mark_line(code, 0, CREATION)
            cap2 = _def("packages add rows with a patch file: cordis.patch.yml")
            self.play(Create(m0), FadeIn(cap2), run_time=b.t(0.2))
            self.play(Indicate(code.code_lines[1], color=CREATION), run_time=b.t(0.2))

        with self.beat("boot") as b:
            lbl = T("desktop profile: 200 rows", LABEL, RUNTIME).next_to(stack, DOWN, buff=0.2)
            self.play(FadeIn(lbl), Indicate(pcs[0], color=RUNTIME), run_time=b.t(0.4))


# ================================================================ trim_method
class TrimMethod(DWScene):
    BEATS = [("off", 4.2), ("disable", 6.0), ("tag", 3.7), ("nodelete", 8.8), ("why", 5.4), ("forty", 4.0),
             ("pending", 4.7), ("search", 4.0), ("js", 4.665)]

    TAG = ("# deepwidgets-trim: <reason>\n"
           "- id: <row id>\n"
           "  disabled: true")
    KEPT = ("// deepwidgets-trim: <reason>\n"
            "// <old line>\n"
            "// <old line>")
    PENDING = [("mcp-resources", "tools"), ("cordis-host-runner", "tools"),
               ("cordis-inspect-providers", "cordisInspect, tools"),
               ("file-upload", "agents, attachments, commands"), ("preset-cordis", "agentPresets"),
               ("preset-standard", "agentPresets"), ("preset-ptc", "agentPresets"),
               ("session-controller", "agents, sessions, llm, …")]

    def construct(self):
        stack = _row_stack(px=0.36, bw=0.28, py=0.2, bh=0.12)
        stack.move_to([-5.05, 0.6, 0])
        with self.beat("off") as b:
            title = scene_title("The trim", RUNTIME)
            c0 = T("200 rows", LABEL, RUNTIME).next_to(stack, DOWN, buff=0.25)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(stack, lag_ratio=0.002), FadeIn(c0),
                      run_time=b.t(0.45))

        with self.beat("disable") as b:
            off = [bar for i, bar in enumerate(stack) if i not in _ON]
            self.play(LaggedStart(*[bar.animate.set_fill(OPEN, 0.25) for bar in off], lag_ratio=0.004),
                      run_time=b.t(0.6))
            c1 = T("160 disabled: true", LABEL, OPEN).move_to(c0, aligned_edge=LEFT)
            self.play(FadeOut(c0), FadeIn(c1), run_time=b.t(0.15))

        with self.beat("tag") as b:
            tag = code_block(self.TAG, "yaml").move_to([2.4, 2.0, 0])
            tag.align_to([-2.2, 0, 0], LEFT)
            cap = _def("each row stays in the file, with a comment that gives the reason")
            self.play(FadeIn(tag, shift=LEFT * 0.2), FadeIn(cap), run_time=b.t(0.35))

        with self.beat("nodelete") as b:
            nd = status_chip("the trim deletes no code", True).next_to(tag, DOWN, buff=0.35).align_to(tag, LEFT)
            self.play(FadeIn(nd), run_time=b.t(0.15))
            _at(self, b, 0.25)
            kept_l = T("a kept DSH file that must change:", LABEL, TEXT).next_to(nd, DOWN, buff=0.35)
            kept_l.align_to(tag, LEFT)
            kept = code_block(self.KEPT, "typescript").next_to(kept_l, DOWN, buff=0.2).align_to(tag, LEFT)
            cap2 = _def("old lines become comments with the marker deepwidgets-trim")
            self.play(FadeIn(kept_l), FadeIn(kept), _swap(cap, cap2), run_time=b.t(0.25))
            self.play(Create(mark_line(kept, 0, CREATION)), run_time=b.t(0.15))

        with self.beat("why") as b:
            cap3 = _def("why keep dead code? the operator reads it to learn how DSH writes Cordis plugins")
            self.play(_swap(cap2, cap3), run_time=b.t(0.2))

        with self.beat("forty") as b:
            keep = {id(x) for x in [title, c1, *stack.get_family()]}
            right = [m for m in self.mobjects if id(m) not in keep]
            self.play(*[FadeOut(m) for m in right], run_time=b.t(0.2))
            on = VGroup(*[stack[i] for i in _ON])
            c2 = T("40 stay on", LABEL, RUNTIME).next_to(c1, DOWN, buff=0.15).align_to(c1, LEFT)
            self.play(FadeIn(c2), Indicate(on, color=RUNTIME, scale_factor=1.15), run_time=b.t(0.4))

        with self.beat("pending") as b:
            pend = VGroup(*[stack[i] for i in _PENDING])
            c3 = T("8 of them pending", LABEL, CREATION).next_to(c2, DOWN, buff=0.15).align_to(c1, LEFT)
            tbl = RevealTable(["pending row", "waits for"], self.PENDING, mono_cols=[0], col_gap=0.45,
                              cell_colors={(i, 1): CREATION for i in range(8)})
            tbl.move_to([2.4, 0.75, 0]).align_to([-2.65, 0, 0], LEFT).align_to([0, 2.75, 0], UP)
            self.add(tbl)
            self.play(pend.animate.set_fill(CREATION, 1), FadeIn(c3), run_time=b.t(0.15))
            self.play(tbl.reveal_rows(0, 8, lag=0.3), Indicate(pend, color=CREATION, scale_factor=1.3),
                      run_time=b.t(0.65))

        with self.beat("search") as b:
            g1 = chip("git grep deepwidgets-trim", MUTED).move_to([0, -1.55, 0]).align_to(tbl, LEFT)
            n1 = _def("a comment search does not show which code runs", MUTED)
            self.play(FadeIn(g1), FadeIn(n1), run_time=b.t(0.3))

        with self.beat("js") as b:
            g2 = chip("!!js \"process.env.DEEPWIDGETS_PROBE === 'off'\"", MUTED)
            g2.move_to([0, -2.35, 0]).align_to(tbl, LEFT)
            cap4 = _def("a row can also turn itself off with a JavaScript condition")
            self.play(FadeIn(g2), _swap(n1, cap4), run_time=b.t(0.3))


# ================================================================ widget_rows_on
class WidgetRowsOn(DWScene):
    BEATS = [("rows", 4.3), ("hmr", 7.4), ("pm", 8.3), ("off", 6.3), ("on", 3.4), ("ms", 6.7), ("timer", 7.9),
             ("stop", 2.7), ("raw", 2.405)]

    def construct(self):
        with self.beat("rows") as b:
            title = scene_title("Two rows back on: hmr and timer", RUNTIME)
            r_off = VGroup(chip("hmr", OPEN, dashed=True), chip("timer", OPEN, dashed=True)).arrange(RIGHT, buff=0.3)
            r_off.move_to([-5.3, 2.3, 0])
            r_on = VGroup(chip("hmr", RUNTIME), chip("timer", RUNTIME)).arrange(RIGHT, buff=0.3).move_to(r_off)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(r_off), run_time=b.t(0.3))
            _at(self, b, 0.6)
            self.play(ReplacementTransform(r_off, r_on), run_time=b.t(0.3))

        with self.beat("hmr") as b:
            h1 = T("hmr = hot module replacement", BODY, TEXT).move_to([0, 2.45, 0]).align_to([-3.4, 0, 0], LEFT)
            h2 = T("loads changed plugin code into a running process", LABEL, MUTED)
            h2.next_to(h1, DOWN, buff=0.15).align_to(h1, LEFT)
            self.play(FadeIn(h1), Indicate(r_on[0], color=RUNTIME), run_time=b.t(0.3))
            _at(self, b, 0.45)
            self.play(FadeIn(h2), run_time=b.t(0.2))

        with self.beat("pm") as b:
            pm = ProcessBox("plugin manager", "installs a bundle while the app runs", CREATION, sub_mono=False)
            pm.move_to([-3.4, 0.6, 0])
            na = labeled_arrow(pm.get_top(), r_on[0].get_bottom(), "needs", CREATION, mono=False, side=LEFT)
            self.play(FadeIn(pm), GrowArrow(na.arrow), FadeIn(na.label), run_time=b.t(0.25))
            _at(self, b, 0.7)
            bd = chip("bundle = a package with code + its rows", RUNTIME, mono=False).next_to(pm, RIGHT, buff=0.5)
            self.play(FadeIn(bd, shift=LEFT * 0.2), run_time=b.t(0.2))

        with self.beat("off") as b:
            self.play(FadeOut(VGroup(pm, na, bd, h1, h2)), run_time=b.t(0.12))
            lh = T("hmr off", BODY, ISOLATION, bold=True)
            lc = code_block("installBundle(...) ->\n{ application: 'restart-required',\n  restartReason: 'no-hmr' }",
                            color=ISOLATION)
            left = VGroup(lh, lc).arrange(DOWN, buff=0.25, aligned_edge=LEFT).move_to([-3.25, 0.65, 0])
            self.play(FadeIn(lh), FadeIn(lc, shift=UP * 0.15), run_time=b.t(0.3))

        with self.beat("on") as b:
            rh = T("hmr on", BODY, SOLVED, bold=True)
            rc = code_block("{ application: 'applied' }", color=SOLVED)
            right = VGroup(rh, rc).arrange(DOWN, buff=0.25, aligned_edge=LEFT)
            right.move_to([3.9, 0, 0]).align_to(left, UP)
            self.play(FadeIn(rh), FadeIn(rc, shift=UP * 0.15), run_time=b.t(0.45))

        with self.beat("ms") as b:
            ms = T("install ms=1673", BODY, SOLVED, mono=True).next_to(rc, DOWN, buff=0.3).align_to(rc, LEFT)
            pr = chip("check in PR #50", SOLVED, mono=False).next_to(ms, DOWN, buff=0.2).align_to(ms, LEFT)
            self.play(FadeIn(ms), FadeIn(pr), run_time=b.t(0.25))

        with self.beat("timer") as b:
            t1 = chip("ctx.timeout / ctx.interval", RUNTIME, size=LABEL).move_to([-3.6, -1.75, 0])
            t1n = T("widgets refresh their data", LABEL, MUTED).next_to(t1, RIGHT, buff=0.35)
            self.play(FadeIn(t1), run_time=b.t(0.2))
            _at(self, b, 0.6)
            self.play(FadeIn(t1n), run_time=b.t(0.2))

        with self.beat("stop") as b:
            st = T("stops with the fiber", LABEL, SOLVED).move_to(t1n, aligned_edge=LEFT)
            self.play(ReplacementTransform(t1n, st), run_time=b.t(0.4))

        with self.beat("raw") as b:
            t2 = chip("setTimeout", ISOLATION, size=LABEL).next_to(t1, DOWN, buff=0.3).align_to(t1, LEFT)
            t2n = T("raw JavaScript timer: keeps running", LABEL, ISOLATION).next_to(t2, RIGHT, buff=0.35)
            self.play(FadeIn(t2), FadeIn(t2n), run_time=b.t(0.45))


# ================================================================ three_processes
class ThreeProcesses(DWScene):
    BEATS = [("open", 3.0), ("main", 5.7), ("host", 8.7), ("flag", 7.5), ("renderer", 4.8), ("scheme", 6.5),
             ("disk", 6.3), ("api", 5.3), ("cookie", 3.865)]

    def construct(self):
        X_R, X_M, X_H, Y = -4.75, 0.0, 4.6, 2.2
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "desktop_app", run_time=b.left)

        with self.beat("main") as b:
            title = scene_title("Three kinds of processes", SHELL)
            em = ProcessBox("Electron main", None, SHELL, width=3.6, height=0.8).move_to([X_M, Y, 0])
            emd = lines("makes the windows", "starts the host", "runs no Cordis", size=LABEL)
            emd.next_to(em, DOWN, buff=0.3)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(em), run_time=b.t(0.25))
            self.play(LaggedStart(*[FadeIn(x) for x in emd], lag_ratio=0.6), run_time=b.t(0.55))

        with self.beat("host") as b:
            hb = ProcessBox("host", None, HOST, width=3.6, height=0.8).move_to([X_H, Y, 0])
            hd = VGroup(T("Node child process", LABEL),
                        T("ELECTRON_RUN_AS_NODE=1", SMALL, mono=True),
                        T("--expose-internals", SMALL, mono=True),
                        T("Cordis context, loader,", LABEL),
                        T("web server, all widget code", LABEL)).arrange(DOWN, buff=0.14)
            hd.next_to(hb, DOWN, buff=0.3)
            self.play(FadeIn(hb), FadeIn(hd[0]), run_time=b.t(0.3))
            _at(self, b, 0.4)
            self.play(FadeIn(hd[3]), FadeIn(hd[4]), run_time=b.t(0.25))

        with self.beat("flag") as b:
            sp = Arrow(em.get_right(), hb.get_left(), buff=0.12, color=SHELL, stroke_width=3, tip_length=0.18)
            spl = T("starts", SMALL, SHELL).next_to(sp, UP, buff=0.08)
            self.play(GrowArrow(sp), FadeIn(spl), FadeIn(hd[1]), FadeIn(hd[2]), run_time=b.t(0.3))
            mk = SurroundingRectangle(hd[2], color=CREATION, buff=0.06, corner_radius=0.05)
            cap = _def("why: the loader and hmr read private Node internals")
            _at(self, b, 0.45)
            self.play(Create(mk), FadeIn(cap), run_time=b.t(0.25))

        with self.beat("renderer") as b:
            rb = ProcessBox("renderer", None, SHELL, width=3.6, height=0.8).move_to([X_R, Y, 0])
            rd = lines("Chromium process", "shows one web page", "one per window", size=LABEL)
            rd.next_to(rb, DOWN, buff=0.3)
            self.play(FadeOut(mk), FadeOut(cap), FadeIn(rb), FadeIn(rd[0]), run_time=b.t(0.3))
            self.play(FadeIn(rd[1]), FadeIn(rd[2]), run_time=b.t(0.3))

        with self.beat("scheme") as b:
            sc = chip("dsh-app://app/", SHELL, size=LABEL).move_to([X_R, -0.55, 0]).align_to(rb, LEFT)
            scl = T("main window + each widget window", SMALL, MUTED).next_to(sc, DOWN, buff=0.12).align_to(rb, LEFT)
            self.play(FadeIn(sc), FadeIn(scl), run_time=b.t(0.3))

        with self.beat("disk") as b:
            dk = disk_icon(SHELL, 0.45).move_to([X_M - 0.95, -0.75, 0])
            dkl = T("built page files", LABEL, SHELL).next_to(dk, RIGHT, buff=0.2)
            serve = Arrow(dk.get_left() + LEFT * 0.1, sc.get_right(), buff=0.1, color=SHELL, stroke_width=3,
                          tip_length=0.18)
            cap2 = _def("Electron main answers each dsh-app:// request; page files come from disk")
            self.play(FadeIn(dk), FadeIn(dkl), FadeIn(cap2), run_time=b.t(0.3))
            _at(self, b, 0.5)
            self.play(GrowArrow(serve), run_time=b.t(0.25))

        with self.beat("api") as b:
            yA = -2.0
            a1 = labeled_arrow([X_R + 1.0, yA, 0], [X_M - 0.4, yA, 0], "dsh-app://app/api/…", SHELL)
            a2 = labeled_arrow([X_M + 0.4, yA, 0], [X_H - 1.2, yA, 0], "+ host cookie", HOST, mono=False)
            src = chip("each other path", SHELL, mono=False).next_to(a1.arrow, LEFT, buff=0.1)
            mid = Dot([X_M, yA, 0], radius=0.09, color=SHELL)
            dst = chip("127.0.0.1:<port>", HOST).next_to(a2.arrow, RIGHT, buff=0.1)
            self.play(FadeOut(cap2), FadeOut(serve), FadeIn(src), GrowArrow(a1.arrow), FadeIn(a1.label),
                      FadeIn(mid), run_time=b.t(0.35))
            self.play(GrowArrow(a2.arrow), FadeIn(a2.label), FadeIn(dst), run_time=b.t(0.35))

        with self.beat("cookie") as b:
            cap3 = _def("the host checks that cookie on each route of the connection service", HOST)
            self.play(FadeIn(cap3), Indicate(dst, color=HOST), run_time=b.t(0.4))


# ================================================================ probe_and_trace
class ProbeAndTrace(DWScene):
    BEATS = [("intro", 4.9), ("probe", 6.7), ("window", 5.2), ("trace", 5.3), ("serve", 5.6), ("check", 2.1),
             ("close", 2.315)]

    def construct(self):
        XL, XR = -3.55, 3.55
        with self.beat("intro") as b:
            title = scene_title("Check tools: probe and trace", HOST)
            pb = ProcessBox("@deepwidgets/probe", None, HOST, width=5.4, height=0.75).move_to([XL, 2.2, 0])
            tb = ProcessBox("@deepwidgets/trace", None, HOST, width=5.4, height=0.75).move_to([XR, 2.2, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.2))
            self.play(FadeIn(pb, shift=UP * 0.2), FadeIn(tb, shift=UP * 0.2), run_time=b.t(0.3))

        with self.beat("probe") as b:
            route = chip("GET /api/probe", HOST, size=LABEL).move_to([XL, 1.2, 0])
            js = json_block("{ ok: true, pid: 85765 }", color=HOST).move_to([XL, 0.1, 0])
            ar = Arrow(route.get_bottom(), js.get_top(), buff=0.08, color=HOST, stroke_width=3, tip_length=0.16)
            self.play(FadeIn(route), run_time=b.t(0.3))
            _at(self, b, 0.55)
            self.play(GrowArrow(ar), FadeIn(js), run_time=b.t(0.3))

        with self.beat("window") as b:
            mw = window_card("main window", 4.6, 1.5).move_to([XL, -1.65, 0])
            pt = T("probe pid 85765", LABEL, TEXT, mono=True).move_to(_body(mw))
            self.play(FadeIn(mw), run_time=b.t(0.2))
            self.play(TransformFromCopy(js.code_lines[0], pt), run_time=b.t(0.3))
            _at(self, b, 0.65)
            cap = _def("a page can reach the host", SOLVED)
            self.play(FadeIn(cap), run_time=b.t(0.15))

        with self.beat("trace") as b:
            tw = window_card("trace", 5.4, 2.55).move_to([XR, -0.05, 0])
            tbl = RevealTable(["row", "state"], [("deepwidgets-probe", "active"), ("deepwidgets-trace", "active"),
                                                  ("mcp-resources", "pending"), ("file-upload", "pending")],
                              mono_cols=[0], cell_colors={(0, 1): SOLVED, (1, 1): SOLVED, (2, 1): CREATION,
                                                          (3, 1): CREATION})
            tbl.move_to(_body(tw))
            sub = T("each row as it loads + app boot steps", SMALL, MUTED).next_to(tb, DOWN, buff=0.12)
            self.play(FadeOut(cap), FadeIn(tw), FadeIn(tbl.header), FadeIn(tbl.hlines[0]), FadeIn(sub),
                      run_time=b.t(0.2))
            self.add(tbl)
            self.play(tbl.reveal_rows(0, 4), run_time=b.t(0.6))

        with self.beat("serve") as b:
            r1 = chip("/api/trace", HOST, size=LABEL)
            r2 = chip("/trace", SHELL, size=LABEL)
            rr = VGroup(r1, r2).arrange(RIGHT, buff=0.4).move_to([XR, -1.95, 0])
            l1 = T("data", SMALL, MUTED).next_to(r1, DOWN, buff=0.1)
            l2 = T("trace window", SMALL, MUTED).next_to(r2, DOWN, buff=0.1)
            self.play(FadeIn(r1), FadeIn(l1), run_time=b.t(0.25))
            _at(self, b, 0.5)
            self.play(FadeIn(r2), FadeIn(l2), Indicate(tw.frame, color=SHELL), run_time=b.t(0.25))

        with self.beat("check") as b:
            cap2 = _def("check tools: the widget system does not depend on them", MUTED)
            self.play(FadeIn(cap2), run_time=b.t(0.4))

        with self.beat("close") as b:
            OutlineDiagram().close_part(self, "host", next_key="ctx_widgets", run_time=b.left)
