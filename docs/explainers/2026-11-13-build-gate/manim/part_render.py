"""part_render: ipc_teach, check_route, test_run_fixture, hidden_window, deadline,
shadow_dom_teach, style_probe, render_verdicts, cli_skip."""
from dwscene import *


class IpcTeach(DWScene):
    BEATS = [("needs", 14), ("channel", 38), ("number", 56), ("cite", 24)]

    def construct(self):
        with self.beat("needs") as b:
            title = scene_title("the last gate needs a browser, so it asks", RENDER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("channel") as b:
            em = ProcessBox("Electron main", color=SERVING, width=4.0, height=1.3)
            em.move_to([-4.2, 1.9, 0])
            host = ProcessBox("host", "its child process", color=HOST, width=4.0, height=1.3)
            host.move_to([4.2, 1.9, 0])
            rend = ProcessBox("renderer", "one for each window", color=SHELL, width=4.4, height=1.3)
            rend.move_to([-4.2, -0.4, 0])
            link = labeled_arrow(em.get_bottom(), rend.get_top(), None, SERVING)
            self.play(FadeIn(em), run_time=b.t(0.2))
            self.play(FadeIn(host), run_time=b.t(0.2))
            self.play(GrowArrow(link.arrow), FadeIn(rend), run_time=b.t(0.2))
            ipc = T("a channel: each side sends an object and listens for one", SMALL, MUTED)
            ipc.move_to([0, 0.75, 0])
            self.play(FadeIn(ipc), run_time=b.t(0.25))
            self.em, self.host = em, host

        with self.beat("number") as b:
            up = code_block('{ checkId: 7, check: {...} }', "text")
            up.move_to([0.4, 2.4, 0])
            a1 = labeled_arrow(self.host.get_left(), [1.9, 1.9, 0], None, HOST)
            down = code_block('{ checkId: 7, result: {...} }', "text")
            down.move_to([0.4, 1.4, 0])
            a2 = labeled_arrow([-1.9, 1.4, 0], [-2.3, 1.6, 0], None, SERVING)
            self.play(GrowArrow(a1.arrow), FadeIn(up), run_time=b.t(0.3))
            self.play(GrowArrow(a2.arrow), FadeIn(down), run_time=b.t(0.3))
            rule = lines("a message is not a question. a counter puts the next number on it,",
                         "then the asker waits for an answer with the same number.",
                         size=LABEL, color=TEXT)
            rule.move_to([0, -1.9, 0])
            self.play(FadeIn(rule), run_time=b.t(0.25))
            two = VGroup(chip("checkId: 7", CREATION), chip("checkId: 8", CREATION))
            two.arrange(RIGHT, buff=0.8).move_to([0, -2.8, 0])
            self.play(FadeIn(two), run_time=b.t(0.12))

        with self.beat("cite") as b:
            cite = T("deepWidgets video  05:42", SMALL, MUTED).move_to([0, CAPTION_Y, 0])
            self.play(FadeIn(cite), run_time=b.t(0.5))


class CheckRoute(DWScene):
    BEATS = [("address", 13), ("two", 35), ("one", 33), ("csp", 23)]

    @staticmethod
    def _door(label, sub, color, x):
        frame = rbox(5.2, 2.3, color, fill=0.07, sw=3).move_to([x, 1.3, 0])
        t = T(label, LABEL, color, mono=True)
        s = T(sub, SMALL, TEXT)
        VGroup(t, s).arrange(DOWN, buff=0.25).move_to(frame)
        return VGroup(frame, t, s)

    def construct(self):
        with self.beat("address") as b:
            title = scene_title("the page needs an address", RENDER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("two") as b:
            live = self._door("dsh-app://app", "the live widget page", SHELL, -3.4)
            chk = self._door("dsh-app://widget-check", "the render check alone", RENDER, 3.4)
            self.play(FadeIn(live), run_time=b.t(0.4))
            self.play(FadeIn(chk), run_time=b.t(0.4))
            self.chk = chk

        with self.beat("one") as b:
            serves = lines("it serves the files of the build under check,",
                           "and nothing else", size=LABEL, color=TEXT)
            serves.move_to([0, -0.6, 0])
            self.play(FadeIn(serves), run_time=b.t(0.3))
            bad = code_block("/widget/<slug>/../../secret", "text")
            bad.move_to([-3.2, -1.9, 0])
            res = chip("403", ISOLATION)
            res.next_to(bad, RIGHT, buff=0.6)
            self.play(FadeIn(bad), run_time=b.t(0.3))
            self.play(FadeIn(res), run_time=b.t(0.25))
            links = T("it resolves each link first", SMALL, MUTED)
            links.move_to([3.6, -1.9, 0])
            self.play(FadeIn(links), run_time=b.t(0.15))

        with self.beat("csp") as b:
            cap = lines("a page there can not reach the live app:",
                        "its policy allows connections to its own address only",
                        size=LABEL, color=SOLVED)
            cap.move_to([0, -3.0, 0])
            self.play(FadeIn(cap), run_time=b.t(0.6))


class TestRunFixture(DWScene):
    BEATS = [("data", 14), ("recall", 31), ("new", 17), ("routes", 38), ("never", 21)]

    def construct(self):
        with self.beat("data") as b:
            title = scene_title("the check answers from a recording", RENDER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("recall") as b:
            card = rbox(5.6, 2.2, CREATION, fill=0.06, sw=3).move_to([-3.6, 1.6, 0])
            t = T("the test run", LABEL, CREATION, bold=True)
            s = lines("the third host gate: it runs the bundle",
                      "in a throwaway process and calls each action once",
                      size=SMALL, color=TEXT)
            VGroup(t, s).arrange(DOWN, buff=0.25).move_to(card)
            cite = T("deepWidgets video  26:55", SMALL, MUTED).next_to(card, DOWN, buff=0.25)
            self.play(FadeIn(card), FadeIn(t), FadeIn(s), run_time=b.t(0.5))
            self.play(FadeIn(cite), run_time=b.t(0.3))
            self.card = card

        with self.beat("new") as b:
            new = lines("new: the run now keeps", "what each query returned",
                        size=LABEL, color=SOLVED)
            new.move_to([3.6, 1.6, 0])
            self.play(FadeIn(new, shift=RIGHT * 0.15), run_time=b.t(0.6))

        with self.beat("routes") as b:
            rows = [("program", "the recorded program text"),
                    ("call", "the recorded answer for the action, by name"),
                    ("stream", "one hello, then it stays open")]
            tbl = RevealTable(["the check answers", "with"], rows, mono_cols=[0], size=LABEL,
                              cell_colors={(i, 0): RENDER for i in range(3)})
            tbl.move_to([-0.6, -0.9, 0])
            self.add(tbl)
            self.play(tbl.reveal_rows(0, 3, lag=0.45), run_time=b.t(0.8))
            why = T("so the page does not open the stream again", SMALL, MUTED)
            why.next_to(tbl, DOWN, buff=0.35)
            self.play(FadeIn(why), run_time=b.t(0.15))
            self.tbl = tbl

        with self.beat("never") as b:
            cut = DashedLine([-6.4, -2.55, 0], [6.4, -2.55, 0], color=ISOLATION, stroke_width=3,
                             dash_length=0.12)
            lab = T("the page never reaches the live host", SMALL, ISOLATION)
            lab.next_to(cut, DOWN, buff=0.22)
            self.play(Create(cut), run_time=b.t(0.3))
            self.play(FadeIn(lab), run_time=b.t(0.3))


class HiddenWindow(DWScene):
    BEATS = [("now", 3), ("window", 39), ("listeners", 31), ("queue", 33)]

    def construct(self):
        with self.beat("now") as b:
            title = scene_title("the hidden window", RENDER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("window") as b:
            win = rbox(4.2, 3.0, SHELL, fill=0.05, sw=3).move_to([-4.0, 0.6, 0])
            size = T("320 x 300", LABEL, SHELL, mono=True).move_to(win)
            note = T("the size of a real widget window", SMALL, MUTED)
            note.next_to(win, DOWN, buff=0.25)
            self.play(Create(win), FadeIn(size), FadeIn(note), run_time=b.t(0.35))
            props = lines("show: false", "no frame", "no Node access", "sandbox: true",
                          size=SMALL, color=TEXT, mono=True)
            props.move_to([0.6, 0.6, 0])
            self.play(LaggedStart(*[FadeIn(p, shift=RIGHT * 0.1) for p in props], lag_ratio=0.4),
                      run_time=b.t(0.5))
            self.win = win

        with self.beat("listeners") as b:
            ears = VGroup(*[chip(x, RENDER, mono=False) for x in
                            ("console errors: kept", "the renderer ended: recorded with the reason",
                             "navigation and new windows: refused")])
            ears.arrange(DOWN, buff=0.26, aligned_edge=LEFT).move_to([3.4, 0.6, 0])
            self.play(LaggedStart(*[FadeIn(e, shift=LEFT * 0.15) for e in ears], lag_ratio=0.4),
                      run_time=b.t(0.8))

        with self.beat("queue") as b:
            boxes = VGroup(*[chip(f"check {i}", CREATION) for i in (7, 8, 9)])
            boxes.arrange(RIGHT, buff=0.35).move_to([-1.0, -2.3, 0])
            lab = T("one check at a time; each new one waits", SMALL, MUTED)
            lab.next_to(boxes, DOWN, buff=0.3)
            self.play(LaggedStart(*[FadeIn(x) for x in boxes], lag_ratio=0.4), run_time=b.t(0.45))
            self.play(FadeIn(lab), run_time=b.t(0.3))


class Deadline(DWScene):
    BEATS = [("queue", 8), ("loop", 32), ("old", 47), ("new", 42), ("pin", 14)]

    def construct(self):
        with self.beat("queue") as b:
            title = scene_title("one deadline over the whole thing", RENDER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("loop") as b:
            loop = lines("a loop at the top level of the page never yields:",
                         "the load never finishes, and the wait never settles",
                         size=LABEL, color=ISOLATION)
            loop.move_to([0, 2.3, 0])
            self.play(FadeIn(loop), run_time=b.t(0.6))

        with self.beat("old") as b:
            lab = T("OLD", LABEL, ISOLATION, bold=True).move_to([-6.2, 1.1, 0])
            line = Line([-5.4, 1.1, 0], [5.6, 1.1, 0], stroke_color=ISOLATION, stroke_width=3)
            marks = [("load: never finishes", -3.6), ("the 10 s ready limit never starts", 0.6),
                     ("45 s host timeout", 4.6)]
            g = VGroup()
            for text, x in marks:
                d = Dot([x, 1.1, 0], radius=0.09, color=ISOLATION)
                t = T(text, SMALL, TEXT).move_to([x, 0.6, 0])
                g.add(VGroup(d, t))
            self.play(FadeIn(lab), Create(line), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(x, shift=UP * 0.12) for x in g], lag_ratio=0.5),
                      run_time=b.t(0.5))
            stuck = T("the queue never moved, so every later check failed", SMALL, ISOLATION)
            stuck.move_to([0, 0.05, 0])
            self.play(FadeIn(stuck), run_time=b.t(0.25))

        with self.beat("new") as b:
            lab = T("NEW", LABEL, SOLVED, bold=True).move_to([-6.2, -1.3, 0])
            line = Line([-5.4, -1.3, 0], [5.6, -1.3, 0], stroke_color=SOLVED, stroke_width=3)
            bar = Rectangle(width=6.0, height=0.26, stroke_width=0, fill_color=SOLVED,
                            fill_opacity=0.35).move_to([-2.4, -1.3, 0])
            over = T("one 15 s deadline over load and judgement", SMALL, SOLVED)
            over.move_to([-2.0, -0.8, 0])
            after = lines("it crashes the renderer, destroys the window,",
                          "and frees the queue", size=SMALL, color=TEXT)
            after.move_to([1.6, -2.1, 0])
            verdict = chip("not ready, with the console lines", ISOLATION, mono=False)
            verdict.move_to([-3.2, -2.3, 0])
            self.play(FadeIn(lab), Create(line), FadeIn(bar), FadeIn(over), run_time=b.t(0.4))
            self.play(FadeIn(after), run_time=b.t(0.3))
            self.play(FadeIn(verdict), run_time=b.t(0.2))

        with self.beat("pin") as b:
            pin = VGroup(Dot(radius=0.12, color=ISOLATION),
                         T("the first of the three places the plan did not hold", SMALL, ISOLATION))
            pin.arrange(RIGHT, buff=0.25).move_to([0, -3.3, 0])
            self.play(FadeIn(pin, shift=UP * 0.15), run_time=b.t(0.6))


class ShadowDomTeach(DWScene):
    BEATS = [("feature", 17), ("case", 52), ("gap", 39), ("make", 17)]

    def construct(self):
        with self.beat("feature") as b:
            title = scene_title("a shadow root", RENDER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("case") as b:
            host_el = rbox(5.6, 3.2, SHELL, fill=0.04, sw=3).move_to([-2.4, 0.7, 0])
            htag = T("an element of the page", SMALL, SHELL)
            htag.next_to(host_el.get_corner(UL), DR, buff=0.16)
            case = rbox(3.8, 2.0, RENDER, fill=0.08, sw=3).move_to([-2.4, 0.3, 0])
            ctag = lines("a shadow root:", "its own document", size=SMALL, color=RENDER)
            ctag.move_to(case)
            self.play(Create(host_el), FadeIn(htag), run_time=b.t(0.25))
            self.play(Create(case), FadeIn(ctag), run_time=b.t(0.25))
            bounce = VGroup()
            for dy in (0.7, 0.0, -0.7):
                a = labeled_arrow([-6.6, 0.3 + dy, 0], [case.get_left()[0] - 0.12, 0.3 + dy, 0],
                                  None, ISOLATION)
                bounce.add(a)
            blab = lines("page styles do not", "reach inside", size=SMALL, color=ISOLATION)
            blab.move_to([2.2, 1.8, 0])
            self.play(LaggedStart(*[GrowArrow(a.arrow) for a in bounce], lag_ratio=0.3),
                      FadeIn(blab), run_time=b.t(0.3))
            shop = lines("a sealed display case in a shop: you see through it,",
                         "but the shop lighting does not reach inside",
                         size=SMALL, color=MUTED)
            shop.move_to([0, -2.4, 0])
            self.play(FadeIn(shop), run_time=b.t(0.16))
            self.case = case

        with self.beat("gap") as b:
            pass_in = VGroup(chip("inherited properties", SOLVED, mono=False),
                             chip("custom properties", SOLVED, mono=False))
            pass_in.arrange(DOWN, buff=0.3).move_to([3.4, 0.3, 0])
            arrows = VGroup(*[labeled_arrow(c.get_left(), [self.case.get_right()[0] + 0.12,
                                                           c.get_y(), 0], None, SOLVED)
                              for c in pass_in])
            self.play(FadeIn(pass_in), run_time=b.t(0.35))
            self.play(LaggedStart(*[GrowArrow(a.arrow) for a in arrows], lag_ratio=0.3),
                      run_time=b.t(0.25))
            note = T("a fresh style scope, not a fresh style universe", LABEL, TEXT)
            note.move_to([0, -1.6, 0])
            self.play(FadeIn(note), run_time=b.t(0.3))

        with self.beat("make") as b:
            code = code_block("el.attachShadow({ mode: 'open' })", "typescript")
            code.move_to([0, -3.2, 0])
            self.play(FadeIn(code), run_time=b.t(0.7))


class StyleProbe(DWScene):
    BEATS = [("how", 7), ("right", 29), ("two", 45), ("compare", 38), ("only", 27)]

    ROWS = [(".dw-surface", "padding", "0px", "12px"),
            (".dw-state", "display", "flex", "flex"),
            (".dw-state strong", "font-weight", "500", "500"),
            (".dw-state--error strong", "color", "same", "same"),
            (".dw-skeleton", "height", "12px", "12px"),
            (".dw-skeleton + .dw-skeleton", "width", "70%", "70%")]

    def construct(self):
        with self.beat("how") as b:
            title = scene_title("the style probe", RENDER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("right") as b:
            say = lines("the page may have lost the protected styles.",
                        "the check builds the right answer in the page itself.",
                        size=LABEL, color=TEXT)
            say.move_to([0, 2.4, 0])
            self.play(FadeIn(say), run_time=b.t(0.6))

        with self.beat("two") as b:
            left = rbox(4.6, 1.9, SHELL, fill=0.06, sw=3).move_to([-3.8, 1.0, 0])
            lt = lines("the same markup, where", "every page stylesheet applies",
                       size=SMALL, color=SHELL)
            lt.move_to(left)
            right = rbox(4.6, 1.9, RENDER, fill=0.06, sw=3).move_to([2.0, 1.0, 0])
            rt = lines("a shadow root: the same markup,", "with the template dw-core block only",
                       size=SMALL, color=RENDER)
            rt.move_to(right)
            tag = T("both hidden", SMALL, MUTED)
            tag.move_to([5.6, 1.0, 0])
            self.play(FadeIn(left), FadeIn(lt), run_time=b.t(0.4))
            self.play(FadeIn(right), FadeIn(rt), FadeIn(tag), run_time=b.t(0.45))

        with self.beat("compare") as b:
            tbl = RevealTable(["box", "property", "page", "control"], self.ROWS, mono_cols=[0, 1, 2, 3],
                              size=SMALL, cell_colors={(0, 2): ISOLATION, (0, 3): SOLVED})
            tbl.move_to([-1.2, -1.4, 0])
            self.add(tbl)
            self.play(tbl.reveal_rows(0, 6, lag=0.3), run_time=b.t(0.55))
            mark = tbl.mark_row(0, ISOLATION)
            self.play(Create(mark), run_time=b.t(0.14))
            verdict = chip("lost-core-styles", ISOLATION)
            verdict.move_to([4.9, -1.2, 0])
            self.play(FadeIn(verdict), run_time=b.t(0.14))
            which = lines("it reports which property", "on which box", size=SMALL, color=MUTED)
            which.next_to(verdict, DOWN, buff=0.3)
            self.play(FadeIn(which), run_time=b.t(0.08))

        with self.beat("only") as b:
            cap = caption("every compared property is one the block itself sets")
            self.play(FadeIn(cap), run_time=b.t(0.6))


class RenderVerdicts(DWScene):
    BEATS = [("so", 10), ("refuse", 28), ("warn", 29), ("ride", 21), ("why", 31)]

    ROWS = [("render-error", "a component threw while the page drew the program", "stops"),
            ("not-ready", "the page never reached ready", "stops"),
            ("lost-core-styles", "a protected style was lost", "stops"),
            ("no height", "the body of the page has no height", "warns"),
            ("too wide", "the content is wider than the window", "warns"),
            ("program errors", "the program itself reported errors", "warns")]

    def construct(self):
        with self.beat("so") as b:
            title = scene_title("three refusals, three warnings", RENDER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("refuse") as b:
            colors = {}
            for i in range(3):
                colors[(i, 0)] = ISOLATION
                colors[(i, 2)] = ISOLATION
            for i in range(3, 6):
                colors[(i, 0)] = CREATION
                colors[(i, 2)] = CREATION
            tbl = RevealTable(["verdict", "what it means", "the install"], self.ROWS,
                              mono_cols=[0], size=LABEL, cell_colors=colors)
            tbl.move_to([0, 0.9, 0])
            self.add(tbl)
            self.play(tbl.reveal_rows(0, 3, lag=0.4), run_time=b.t(0.8))
            self.tbl = tbl

        with self.beat("warn") as b:
            self.play(self.tbl.reveal_rows(3, 6, lag=0.4), run_time=b.t(0.8))

        with self.beat("ride") as b:
            ride = lines("a warning rides along with a successful install.",
                         "the agent sees it and can fix it.", size=LABEL, color=TEXT)
            ride.move_to([0, -1.9, 0])
            self.play(FadeIn(ride), run_time=b.t(0.6))

        with self.beat("why") as b:
            why = lines("a page with no height is probably wrong, but a person may have meant it.",
                        "a component that throws is wrong in every reading.",
                        size=LABEL, color=MUTED)
            why.move_to([0, -3.1, 0])
            self.play(FadeIn(why), run_time=b.t(0.6))


class CliSkip(DWScene):
    BEATS = [("one", 7), ("two", 39), ("skip", 34), ("gap", 33)]

    def construct(self):
        with self.beat("one") as b:
            title = scene_title("one host has no browser at all", RENDER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("two") as b:
            em = ProcessBox("Electron main", color=SERVING, width=4.0, height=1.2)
            em.move_to([-1.6, 2.0, 0])
            h1 = ProcessBox("host", "started by the app", color=HOST, width=4.0, height=1.2)
            h1.move_to([-5.2, 2.0, 0])
            a1 = labeled_arrow(h1.get_right(), em.get_left(), "asks", HOST, side=UP, mono=False)
            self.play(FadeIn(h1), run_time=b.t(0.2))
            self.play(GrowArrow(a1.arrow), FadeIn(a1.label), FadeIn(em), run_time=b.t(0.3))
            h2 = ProcessBox("host", "straight from the command line", color=HOST, width=5.6,
                            height=1.2)
            h2.move_to([-3.6, 0.0, 0])
            a2 = labeled_arrow(h2.get_right(), [1.2, 0.0, 0], None, HOST, dashed=True)
            nobody = T("nobody to ask", SMALL, OPEN).next_to(a2.arrow, RIGHT, buff=0.3)
            self.play(FadeIn(h2), run_time=b.t(0.25))
            self.play(Create(a2.arrow), FadeIn(nobody), run_time=b.t(0.2))

        with self.beat("skip") as b:
            passes = lines("there the render gate does not run.",
                           "it passes, and it adds a warning to the install answer.",
                           size=LABEL, color=TEXT)
            passes.move_to([0, -1.4, 0])
            self.play(FadeIn(passes), run_time=b.t(0.4))
            warn = chip("this host has no Electron main, so the check did not run",
                        CREATION, mono=False)
            warn.move_to([0, -2.3, 0])
            self.play(FadeIn(warn), run_time=b.t(0.4))

        with self.beat("gap") as b:
            gap = lines("a real gap in our own test runs, on purpose:",
                        "your app always runs the full check", size=LABEL, color=SOLVED)
            gap.move_to([0, -3.3, 0])
            self.play(FadeIn(gap), run_time=b.t(0.6))
