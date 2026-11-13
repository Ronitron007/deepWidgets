"""part_example: example_setup, example_pass, example_refuse, example_loop."""
from dwscene import *


class ExampleSetup(DWScene):
    BEATS = [("now", 7), ("fixture", 37), ("host", 24), ("then", 16)]

    LIB = """
export const CATALOG_ID = 'create-page'

const Card = defineComponent({
  props: z.object({ title: z.string() }),
  render: ({ title }) => <div className="dw-surface">{title}</div>,
})
"""

    def construct(self):
        with self.beat("now") as b:
            title = scene_title("one real page, end to end", SOLVED)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("fixture") as b:
            slug = chip("slug: create-page", AGENT, mono=False).move_to([-4.6, 2.3, 0])
            code = code_block(self.LIB, "typescript")
            code.scale_to_fit_width(min(code.width, 11.0))
            code.move_to([-0.6, 0.9, 0])
            self.play(FadeIn(slug), run_time=b.t(0.15))
            self.play(FadeIn(code), run_time=b.t(0.45))
            note = lines("its library declares a component with a zod schema,",
                         "so it proves that the shared zod works",
                         size=SMALL, color=MUTED)
            note.next_to(code, DOWN, buff=0.35)
            self.play(FadeIn(note), run_time=b.t(0.3))
            self.code = VGroup(code, note)

        with self.beat("host") as b:
            gates = VGroup(*[chip(x, CREATION, mono=False) for x in ("compile", "lint", "test run")])
            gates.arrange(RIGHT, buff=0.7).move_to([-1.2, -1.9, 0])
            ticks = VGroup(*[tick(SOLVED).next_to(g, RIGHT, buff=0.22) for g in gates])
            self.play(LaggedStart(*[FadeIn(g) for g in gates], lag_ratio=0.4), run_time=b.t(0.45))
            self.play(LaggedStart(*[FadeIn(t) for t in ticks], lag_ratio=0.4), run_time=b.t(0.3))
            rec = T("the test run records the program and the answer of the one query",
                    SMALL, MUTED)
            rec.move_to([0, -2.7, 0])
            self.play(FadeIn(rec), run_time=b.t(0.2))

        with self.beat("then") as b:
            cap = T("then the four page gates run", BODY, TEXT, bold=True)
            cap.move_to([0, -3.4, 0])
            self.play(FadeIn(cap), run_time=b.t(0.7))


class ExamplePass(DWScene):
    BEATS = [("files", 9), ("types", 16), ("build", 43), ("render", 28), ("applied", 31)]

    def construct(self):
        o = OutlineDiagram()
        with self.beat("files") as b:
            self.add(o)
            o.set_highlight_now("page_gates")
            self.play(o.highlight("page_files", arrows=("branch_page",)), run_time=b.t(0.3))
            n1 = chip("3 hashes matched", SOLVED, mono=False)
            n1.move_to([o.box("page_files").get_x(), -2.5, 0])
            self.play(FadeIn(n1), run_time=b.t(0.45))

        with self.beat("types") as b:
            self.play(o.highlight("page_types", arrows=("arrow_files_types",)), run_time=b.t(0.3))
            n2 = chip("8 links, no type error", SOLVED, mono=False)
            n2.move_to([o.box("page_types").get_x() + 0.3, -2.5, 0])
            self.play(FadeIn(n2), run_time=b.t(0.5))

        with self.beat("build") as b:
            self.play(o.highlight("page_build", arrows=("arrow_types_build",)), run_time=b.t(0.2))
            n3 = chip("about 1.25 s", SOLVED, mono=False)
            n3.move_to([o.box("page_build").get_x() + 0.2, -2.5, 0])
            self.play(FadeIn(n3), run_time=b.t(0.25))
            det = lines("the child checked the stylesheet, started Vite with its four",
                        "plugin entries, and built the page. the output fence found every",
                        "file inside the page or the allowed packages.",
                        size=SMALL, color=TEXT)
            det.move_to([0, -3.4, 0])
            self.play(FadeIn(det), run_time=b.t(0.4))
            self.det = det

        with self.beat("render") as b:
            self.play(FadeOut(self.det), run_time=b.t(0.1))
            self.play(o.highlight("page_render", arrows=("arrow_build_render",)), run_time=b.t(0.2))
            n4 = chip("648 ms", SOLVED, mono=False)
            n4.move_to([o.box("page_render").get_x() + 0.2, -2.5, 0])
            self.play(FadeIn(n4), run_time=b.t(0.25))
            det = T("the page reached ready, and the six style boxes matched", SMALL, TEXT)
            det.move_to([0, -3.4, 0])
            self.play(FadeIn(det), run_time=b.t(0.3))
            self.det2 = det

        with self.beat("applied") as b:
            self.play(FadeOut(self.det2), FadeOut(o), run_time=b.t(0.12))
            ok = T("the install applied, and the link swapped", BODY, SOLVED, bold=True)
            ok.move_to([0, 2.4, 0])
            self.play(FadeIn(ok), run_time=b.t(0.22))
            code = code_block('<script type="module" src="/widget/create-page/assets/index.js">',
                              "html")
            code.scale_to_fit_width(min(code.width, 12.2))
            code.move_to([0, 1.2, 0])
            self.play(FadeIn(code), run_time=b.t(0.25))
            mark = SurroundingRectangle(code.code_lines[0], color=CREATION, buff=0.06,
                                        stroke_width=3, corner_radius=0.05)
            base = chip("the base path of this page: /widget/create-page/", CREATION, mono=False)
            base.move_to([0, 0.1, 0])
            self.play(Create(mark), FadeIn(base), run_time=b.t(0.2))
            proof = T("each page gets its own base", LABEL, TEXT).move_to([0, -0.9, 0])
            self.play(FadeIn(proof), run_time=b.t(0.2))


class ExampleRefuse(DWScene):
    BEATS = [("added", 8), ("line", 36), ("passes", 30), ("fence", 31), ("stops", 25)]

    def construct(self):
        with self.beat("added") as b:
            title = scene_title("the same page, with one line added", ISOLATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("line") as b:
            code = code_block("export const leak = new URL('../../../secret.txt',\n"
                              "  import.meta.url).href", "typescript")
            code.move_to([-1.0, 2.0, 0])
            self.play(FadeIn(code), run_time=b.t(0.5))
            note = lines("it builds a path to a file three folders up,",
                         "a secret file the check planted outside the page",
                         size=SMALL, color=MUTED)
            note.next_to(code, DOWN, buff=0.3)
            self.play(FadeIn(note), run_time=b.t(0.35))

        with self.beat("passes") as b:
            rows = VGroup()
            spec = [("page-files", "no fixed file changed", SOLVED),
                    ("page-types", "new URL is valid TypeScript, with no import", SOLVED),
                    ("the import fence", "sees nothing: there is no import", OPEN)]
            for i, (name, why, color) in enumerate(spec):
                n = T(name, SMALL, color, mono=True)
                w = T(why, SMALL, MUTED)
                n.move_to([-6.0, -0.3 - i * 0.6, 0], aligned_edge=LEFT)
                w.move_to([-2.2, -0.3 - i * 0.6, 0], aligned_edge=LEFT)
                mk = tick(SOLVED, 0.26) if color is SOLVED else cross(OPEN, 0.26)
                mk.move_to([-6.4, -0.3 - i * 0.6, 0])
                rows.add(VGroup(mk, n, w))
            self.play(LaggedStart(*[FadeIn(r, shift=RIGHT * 0.12) for r in rows], lag_ratio=0.45),
                      run_time=b.t(0.85))

        with self.beat("fence") as b:
            step = lines("then Vite inlines that file as a data URL.",
                         "the output fence sees its real path in the recorder list.",
                         size=LABEL, color=ISOLATION)
            step.move_to([0, -2.2, 0])
            self.play(FadeIn(step), run_time=b.t(0.45))
            msg = code_block("the page reads 1 file(s) outside the page folder: "
                             ".../secret.txt", "text")
            msg.scale_to_fit_width(min(msg.width, 12.2))
            msg.move_to([0, -3.3, 0])
            self.play(FadeIn(msg), run_time=b.t(0.35))

        with self.beat("stops") as b:
            st = stamp("the install stops at page-build", ISOLATION)
            st.move_to([3.6, 1.1, 0])
            self.play(FadeIn(st, scale=1.15), run_time=b.t(0.4))
            keep = lines("the old bundle and the old page link stay,",
                         "and no .tmp folder is left behind", size=SMALL, color=SOLVED)
            keep.next_to(st, DOWN, buff=0.4)
            self.play(FadeIn(keep), run_time=b.t(0.4))


class ExampleLoop(DWScene):
    BEATS = [("case", 9), ("loop", 50), ("deadline", 24), ("after", 42)]

    def construct(self):
        with self.beat("case") as b:
            title = scene_title("the loop case, with the app", RENDER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("loop") as b:
            code = code_block("while (true) {\n"
                              "  document.title = String(Date.now())\n"
                              "}", "typescript")
            code.move_to([-3.4, 1.5, 0])
            self.play(FadeIn(code), run_time=b.t(0.4))
            trap = lines("the check planted a loop and found a trap of its own:",
                         "the bundler removed the first loop, because it had no effect.",
                         "so the loop writes the document title, and now it survives.",
                         size=SMALL, color=MUTED)
            trap.move_to([2.6, -0.3, 0])
            self.play(FadeIn(trap), run_time=b.t(0.45))

        with self.beat("deadline") as b:
            clock = VGroup(Circle(radius=0.7, stroke_color=ISOLATION, stroke_width=4),
                           Line(ORIGIN, UP * 0.5, stroke_color=ISOLATION, stroke_width=4),
                           Line(ORIGIN, RIGHT * 0.35, stroke_color=ISOLATION, stroke_width=4))
            clock.move_to([-4.4, -1.6, 0])
            lab = T("15 s", LABEL, ISOLATION, mono=True).next_to(clock, DOWN, buff=0.25)
            self.play(FadeIn(clock), FadeIn(lab), run_time=b.t(0.45))
            crashed = lines("the renderer crashed, the window went,",
                            "and the queue was free", size=SMALL, color=TEXT)
            crashed.move_to([0.4, -1.6, 0])
            self.play(FadeIn(crashed), run_time=b.t(0.4))

        with self.beat("after") as b:
            verdict = chip("the install failed with not ready", ISOLATION, mono=False)
            verdict.move_to([-3.0, -2.7, 0])
            whole = chip("the whole case: 18 s", ISOLATION, mono=False)
            whole.next_to(verdict, RIGHT, buff=0.5)
            self.play(FadeIn(verdict), run_time=b.t(0.25))
            self.play(FadeIn(whole), run_time=b.t(0.2))
            good = T("a good page installed right after it, and passed in 654 ms",
                     BODY, SOLVED, bold=True)
            good.move_to([0, -3.5, 0])
            self.play(FadeIn(good), run_time=b.t(0.3))
            why = T("that second half is the part that matters: the queue really did free",
                    SMALL, MUTED)
            why.move_to([0, 2.5, 0])
            self.play(FadeIn(why), run_time=b.t(0.2))
