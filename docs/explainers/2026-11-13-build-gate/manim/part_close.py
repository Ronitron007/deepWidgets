"""part_close: twelve_cases, mutants, limits_open, not_served, closing."""
from dwscene import *


class TwelveCases(DWScene):
    BEATS = [("hold", 5), ("files", 22), ("types", 14), ("build", 35), ("more", 34), ("assert", 22)]

    FILES_ROWS = [("a changed fixed file", "page-files"),
                  ("a changed protected block", "page-files"),
                  ("a symbolic link in page/", "page-files")]
    TYPES_ROWS = [("a plain type error", "page-types"),
                  ("an import of recharts", "page-types")]
    BUILD_ROWS = [("an import of a file outside page/", "page-build"),
                  ("@import of a secret file, plain", "page-build"),
                  ("@import with no space after the keyword", "page-build"),
                  ("@import with a comment", "page-build"),
                  ("a bare string inside an image function", "page-build"),
                  ("the new URL form", "page-build"),
                  ("an @plugin rule", "page-build"),
                  ("a postcss config file", "page-build")]

    def construct(self):
        with self.beat("hold") as b:
            title = scene_title("the checks hold thirteen refusals", CREATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.7))

        with self.beat("files") as b:
            head = T("page-files: 3", LABEL, FILES, bold=True).move_to([-4.6, 2.5, 0])
            rows = VGroup(*[T(f"· {x}", SMALL, TEXT) for x, _ in self.FILES_ROWS])
            rows.arrange(DOWN, buff=0.18, aligned_edge=LEFT)
            rows.next_to(head, DOWN, buff=0.28).align_to(head, LEFT)
            self.play(FadeIn(head), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(r) for r in rows], lag_ratio=0.4), run_time=b.t(0.6))
            self.files_group = VGroup(head, rows)

        with self.beat("types") as b:
            head = T("page-types: 2", LABEL, TYPES, bold=True)
            head.next_to(self.files_group, DOWN, buff=0.5).align_to(self.files_group, LEFT)
            rows = VGroup(*[T(f"· {x}", SMALL, TEXT) for x, _ in self.TYPES_ROWS])
            rows.arrange(DOWN, buff=0.18, aligned_edge=LEFT)
            rows.next_to(head, DOWN, buff=0.28).align_to(head, LEFT)
            self.play(FadeIn(head), run_time=b.t(0.3))
            self.play(LaggedStart(*[FadeIn(r) for r in rows], lag_ratio=0.4), run_time=b.t(0.5))

        with self.beat("build") as b:
            head = T("page-build: 8", LABEL, BUILD, bold=True).move_to([1.2, 2.5, 0])
            rows = VGroup(*[T(f"· {x}", SMALL, TEXT) for x, _ in self.BUILD_ROWS[:4]])
            rows.arrange(DOWN, buff=0.18, aligned_edge=LEFT)
            rows.next_to(head, DOWN, buff=0.28).align_to(head, LEFT)
            self.play(FadeIn(head), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(r) for r in rows], lag_ratio=0.4), run_time=b.t(0.7))
            self.build_rows = rows

        with self.beat("more") as b:
            rows = VGroup(*[T(f"· {x}", SMALL, TEXT) for x, _ in self.BUILD_ROWS[4:]])
            rows.arrange(DOWN, buff=0.18, aligned_edge=LEFT)
            rows.next_to(self.build_rows, DOWN, buff=0.3).align_to(self.build_rows, LEFT)
            self.play(LaggedStart(*[FadeIn(r) for r in rows], lag_ratio=0.4), run_time=b.t(0.85))

        with self.beat("assert") as b:
            cap = lines("each case asserts the gate name and the diagnostic.",
                        "all but the link case also assert that a next step came back.",
                        size=LABEL, color=MUTED)
            cap.move_to([0, -3.2, 0])
            self.play(FadeIn(cap), run_time=b.t(0.7))


class Mutants(DWScene):
    BEATS = [("tested", 7), ("idea", 25), ("three", 38), ("four", 32)]

    ROWS = [("the render check", "the loop page installs, and the suite fails"),
            ("the lost style line", "the broken style case is not refused"),
            ("the warning lines", "the warning case reports no warning")]

    def construct(self):
        with self.beat("tested") as b:
            title = scene_title("we then tested each of those checks", CREATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("idea") as b:
            idea = lines("remove the thing the check guards, rebuild,",
                         "and the check must fail", size=BODY, color=TEXT)
            idea.move_to([0, 2.2, 0])
            self.play(FadeIn(idea), run_time=b.t(0.45))
            never = T("a check that never fails proves nothing", SMALL, MUTED)
            never.next_to(idea, DOWN, buff=0.3)
            self.play(FadeIn(never), run_time=b.t(0.35))

        with self.beat("three") as b:
            tbl = RevealTable(["without", "what happens"], self.ROWS, mono_cols=[], size=LABEL,
                              cell_colors={(i, 0): ISOLATION for i in range(3)})
            tbl.move_to([0, 0.2, 0])
            self.add(tbl)
            self.play(tbl.reveal_rows(0, 3, lag=0.45), run_time=b.t(0.85))
            self.tbl = tbl

        with self.beat("four") as b:
            row = chip("the four bypasses, with the syntax checks turned off", BUILD, mono=False)
            row.move_to([0, -1.75, 0])
            res = chip("all four stayed refused", SOLVED, mono=False)
            res.next_to(row, DOWN, buff=0.35)
            self.play(FadeIn(row), run_time=b.t(0.3))
            self.play(FadeIn(res), run_time=b.t(0.25))
            proof = lines("which proves that the output fence catches them on its own,",
                          "and not the syntax checks", size=SMALL, color=MUTED)
            proof.move_to([0, -3.35, 0])
            self.play(FadeIn(proof), run_time=b.t(0.3))


class LimitsOpen(DWScene):
    BEATS = [("open", 8), ("first", 54), ("second", 26), ("accepted", 39), ("third", 25),
             ("walk", 33), ("pin", 11)]

    def construct(self):
        with self.beat("open") as b:
            title = scene_title("three things stay open", OPEN)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.7))

        with self.beat("first") as b:
            h1 = T("1", HEADING, OPEN, bold=True).move_to([-6.3, 2.2, 0])
            t1 = lines("the resolver must read package and tsconfig files, so the build",
                       "may read any file with those names, anywhere on the disk.",
                       size=LABEL, color=TEXT)
            t1.next_to(h1, RIGHT, buff=0.4).align_to(h1, UP)
            n1 = VGroup(chip("under 4 KB with new URL", INFERRED, mono=False),
                        chip("any size inside a worker", INFERRED, mono=False))
            n1.arrange(RIGHT, buff=0.5)
            n1.next_to(t1, DOWN, buff=0.3).align_to(t1, LEFT)
            self.play(FadeIn(h1), FadeIn(t1), run_time=b.t(0.55))
            self.play(FadeIn(n1), run_time=b.t(0.35))
            self.first = VGroup(h1, t1, n1)

        with self.beat("second") as b:
            h2 = T("2", HEADING, OPEN, bold=True).move_to([-6.3, 0.5, 0])
            t2 = lines("a worker of a page builds with no import fence at all.",
                       "a test worker pulled in a charting library of 720 KB.",
                       size=LABEL, color=TEXT)
            t2.next_to(h2, RIGHT, buff=0.4).align_to(h2, UP)
            self.play(FadeIn(h2), FadeIn(t2), run_time=b.t(0.8))
            self.second = VGroup(h2, t2)

        with self.beat("accepted") as b:
            st = stamp("ACCEPTED", SOLVED)
            st.move_to([5.2, 1.45, 0])
            self.play(FadeIn(st, scale=1.15), run_time=b.t(0.3))
            why = lines("the host half of the same widget already runs as full Node.",
                        "neither hole gives an agent anything it did not already have.",
                        size=SMALL, color=MUTED)
            why.move_to([-0.6, -0.7, 0])
            self.play(FadeIn(why), run_time=b.t(0.45))
            self.acc = VGroup(st, why)

        with self.beat("third") as b:
            h3 = T("3", HEADING, OPEN, bold=True).move_to([-6.3, -1.6, 0])
            t3 = lines("the allowed set grew. the gate links eight packages, and the code",
                       "follows their dependencies, with development dependencies too.",
                       size=LABEL, color=TEXT)
            t3.next_to(h3, RIGHT, buff=0.4).align_to(h3, UP)
            self.play(FadeIn(h3), FadeIn(t3), run_time=b.t(0.8))

        with self.beat("walk") as b:
            nums = VGroup(chip("1152 folders", ISOLATION, mono=False),
                          chip("313 workspace packages", ISOLATION, mono=False),
                          chip("no secret files found in them", SOLVED, mono=False))
            nums.arrange(RIGHT, buff=0.45).move_to([-0.4, -2.6, 0])
            self.play(LaggedStart(*[FadeIn(n) for n in nums], lag_ratio=0.4), run_time=b.t(0.5))
            st = stamp("FOLLOW-UP", CREATION)
            st.move_to([5.2, -1.75, 0])
            self.play(FadeIn(st, scale=1.15), run_time=b.t(0.25))
            narrow = T("it narrows the walk to the shell and the widget kit", SMALL, MUTED)
            narrow.move_to([0, -3.2, 0])
            self.play(FadeIn(narrow), run_time=b.t(0.2))

        with self.beat("pin") as b:
            pin = VGroup(Dot(radius=0.12, color=ISOLATION),
                         T("the third place where the plan did not hold", SMALL, ISOLATION))
            pin.arrange(RIGHT, buff=0.25).move_to([0, -3.7, 0])
            self.play(FadeIn(pin, shift=UP * 0.12), run_time=b.t(0.7))


class NotServed(DWScene):
    BEATS = [("undone", 11), ("window", 23), ("next", 31), ("fences", 39), ("tell", 22),
             ("today", 16)]

    def construct(self):
        o = OutlineDiagram()
        with self.beat("undone") as b:
            self.add(o)
            o.set_highlight_now("page_gates", "profile")
            self.play(o.highlight("page_gates", "profile", "live",
                                  arrows=("arrow_render_profile", "arrow_profile_live")),
                      run_time=b.t(0.6))

        with self.beat("window") as b:
            self.play(FadeOut(o), run_time=b.t(0.12))
            win = window_card("widget window", w=4.6, h=2.4, color=SHELL)
            win.move_to([-4.0, 1.1, 0])
            body = chip("the shared shell", SHELL, mono=False)
            body.move_to(win.body())
            nothing = lines("the built page sits in the profile folder,",
                            "checked and linked, and nothing serves it",
                            size=LABEL, color=TEXT)
            nothing.move_to([2.6, 1.1, 0])
            self.play(FadeIn(win), FadeIn(body), run_time=b.t(0.4))
            self.play(FadeIn(nothing), run_time=b.t(0.4))

        with self.beat("next") as b:
            box = rbox(5.0, 1.3, OPEN, fill=0.05, sw=3, dashed=True).move_to([-3.6, -0.9, 0])
            nm = T("library.serving", LABEL, OPEN, mono=True).move_to(box)
            what = lines("Electron main will serve the link of each slug.",
                         "a slug with no page falls back to the shared shell.",
                         size=SMALL, color=MUTED)
            what.move_to([2.9, -0.9, 0])
            self.play(FadeIn(box), FadeIn(nm), run_time=b.t(0.4))
            self.play(FadeIn(what), run_time=b.t(0.4))

        with self.beat("fences") as b:
            old = VGroup(chip("REFUSE", ISOLATION, mono=False))
            old.move_to([-4.2, -2.1, 0])
            strike = Line(old.get_left() + LEFT * 0.1, old.get_right() + RIGHT * 0.1,
                          stroke_color=ISOLATION, stroke_width=5)
            new = chip("WARN + LOG, and the install goes on", SOLVED, mono=False)
            new.move_to([1.4, -2.1, 0])
            a = labeled_arrow(old.get_right() + RIGHT * 0.2, new.get_left(), None, SOLVED)
            self.play(FadeIn(old), run_time=b.t(0.25))
            self.play(Create(strike), run_time=b.t(0.2))
            self.play(GrowArrow(a.arrow), FadeIn(new), run_time=b.t(0.3))
            cap = T("the operator chose recovery over a defensive block", SMALL, MUTED)
            cap.move_to([0, -2.9, 0])
            self.play(FadeIn(cap), run_time=b.t(0.2))

        with self.beat("tell") as b:
            tell = lines("the gate will still tell you what a page reached for.",
                         "it will not decide for you what to do about it.",
                         size=LABEL, color=TEXT)
            tell.move_to([0, -3.5, 0])
            self.play(FadeIn(tell), run_time=b.t(0.7))

        with self.beat("today") as b:
            cap = T("today the gate is real, and the page it guards is not on screen yet",
                    BODY, TEXT, bold=True)
            cap.move_to([0, 2.9, 0])
            self.play(FadeIn(cap), run_time=b.t(0.7))


class Closing(DWScene):
    BEATS = [("that", 6), ("four", 37), ("idea", 53), ("pins", 36)]

    GATES = [("page-files", "the fixed files, by hash", FILES),
             ("page-types", "the types, against eight linked packages", TYPES),
             ("page-build", "the build, behind two fences", BUILD),
             ("page-render", "a hidden window, against recorded data", RENDER)]

    def construct(self):
        with self.beat("that") as b:
            title = scene_title("that is the page build gate", CREATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.7))

        with self.beat("four") as b:
            stamps = VGroup()
            for i, (name, what, color) in enumerate(self.GATES):
                y = 2.3 - i * 0.85
                st = stamp(name, color, angle=0)
                st.move_to([-4.8, y, 0], aligned_edge=LEFT)
                w = T(what, SMALL, MUTED)
                w.move_to([-1.4, y, 0], aligned_edge=LEFT)
                stamps.add(VGroup(st, w))
            self.play(LaggedStart(*[FadeIn(r, scale=1.08) for r in stamps], lag_ratio=0.45),
                      run_time=b.t(0.85))

        with self.beat("idea") as b:
            one = T("check the result, not the syntax", TITLE, SOLVED, bold=True)
            one.move_to([0, -1.0, 0])
            self.play(FadeIn(one, scale=1.05), run_time=b.t(0.3))
            why = lines("the import fence reads what the agent wrote, and it kept losing to a new form.",
                        "the output fence reads what landed in the page: a form it has never seen",
                        "still shows up as a path.",
                        size=LABEL, color=TEXT)
            why.move_to([0, -2.4, 0])
            self.play(FadeIn(why), run_time=b.t(0.45))
            self.why = why

        with self.beat("pins") as b:
            self.play(FadeOut(self.why), run_time=b.t(0.1))
            pins = VGroup()
            for text in ("a limit that started too late", "a copy where a rename belongs",
                         "a set wider than its specification"):
                d = Dot(radius=0.12, color=ISOLATION)
                t = T(text, LABEL, ISOLATION)
                pins.add(VGroup(d, t).arrange(RIGHT, buff=0.3))
            pins.arrange(DOWN, buff=0.35, aligned_edge=LEFT).move_to([0, -2.3, 0])
            self.play(LaggedStart(*[FadeIn(p, shift=UP * 0.12) for p in pins], lag_ratio=0.5),
                      run_time=b.t(0.75))
