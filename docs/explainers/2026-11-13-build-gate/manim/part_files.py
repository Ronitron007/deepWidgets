"""part_files: hash_idea, gate_files, symlink_teach, gate_files_links."""
from dwscene import *


def _file_card(name, color=TEXT, w=2.3, h=1.5, rows=3):
    frame = rbox(w, h, color, fill=0.06, sw=2.5)
    bars = VGroup(*[RoundedRectangle(corner_radius=0.04, width=w * 0.6 * (1 - 0.15 * i), height=0.1,
                                     stroke_width=0, fill_color=color, fill_opacity=0.5)
                    for i in range(rows)])
    bars.arrange(DOWN, buff=0.12, aligned_edge=LEFT).move_to(frame).shift(DOWN * 0.18)
    label = T(name, SMALL, color, mono=True).move_to([frame.get_x(), frame.get_top()[1] - 0.3, 0])
    g = VGroup(frame, label, bars)
    g.frame, g.bars = frame, bars
    return g


class HashIdea(DWScene):
    BEATS = [("idea", 6), ("what", 43), ("jobs", 48), ("name", 19)]

    def construct(self):
        with self.beat("idea") as b:
            title = scene_title("the gate compares files by hash", FILES)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("what") as b:
            f1 = _file_card("styles.css", FILES).move_to([-4.6, 1.5, 0])
            box1 = ProcessBox("sha256", color=FILES, width=2.0, height=1.0, sub=None)
            box1.move_to([-1.1, 1.5, 0])
            h1 = chip("3f9c2a...", FILES)
            h1.move_to([2.6, 1.5, 0])
            a1 = labeled_arrow(f1.get_right(), box1.get_left(), None, FILES)
            a2 = labeled_arrow(box1.get_right(), h1.get_left(), None, FILES)
            self.play(FadeIn(f1), run_time=b.t(0.12))
            self.play(GrowArrow(a1.arrow), FadeIn(box1), run_time=b.t(0.14))
            self.play(GrowArrow(a2.arrow), FadeIn(h1), run_time=b.t(0.14))
            note = T("the same bytes always give the same fingerprint", SMALL, MUTED)
            note.move_to([-0.6, 0.35, 0])
            self.play(FadeIn(note), run_time=b.t(0.12))

            f2 = _file_card("styles.css", ISOLATION).move_to([-4.6, -1.5, 0])
            byte = Rectangle(width=0.3, height=0.12, stroke_width=0, fill_color=ISOLATION,
                             fill_opacity=1).move_to(f2.bars[1].get_right() + LEFT * 0.15)
            box2 = ProcessBox("sha256", color=FILES, width=2.0, height=1.0, sub=None)
            box2.move_to([-1.1, -1.5, 0])
            h2 = chip("b7e014...", ISOLATION)
            h2.move_to([2.6, -1.5, 0])
            a3 = labeled_arrow(f2.get_right(), box2.get_left(), None, FILES)
            a4 = labeled_arrow(box2.get_right(), h2.get_left(), None, FILES)
            one = T("one byte changed", SMALL, ISOLATION).next_to(f2, DOWN, buff=0.25)
            self.play(FadeIn(f2), FadeIn(byte), FadeIn(one), run_time=b.t(0.12))
            self.play(GrowArrow(a3.arrow), FadeIn(box2), GrowArrow(a4.arrow), FadeIn(h2),
                      run_time=b.t(0.14))
            cite = T("deepWidgets video  12:14", SMALL, MUTED).move_to([0, CAPTION_Y, 0])
            self.play(FadeIn(cite), run_time=b.t(0.08))
            self.scene_all = VGroup(f1, box1, h1, a1, a2, note, f2, byte, box2, h2, a3, a4, one, cite)

        with self.beat("jobs") as b:
            self.play(FadeOut(self.scene_all), run_time=b.t(0.1))
            head = T("here the hash does two jobs", BODY, TEXT).move_to([0, 2.2, 0])
            j1 = VGroup(T("1", HEADING, FILES, bold=True),
                        lines("does a fixed file still match the template?",
                              "the gate hashes both and compares", size=LABEL, color=TEXT))
            j1.arrange(RIGHT, buff=0.5)
            j2 = VGroup(T("2", HEADING, FILES, bold=True),
                        lines("it names a build: the path and the bytes of",
                              "every page file, in sorted order", size=LABEL, color=TEXT))
            j2.arrange(RIGHT, buff=0.5)
            jobs = VGroup(j1, j2).arrange(DOWN, buff=0.7, aligned_edge=LEFT).move_to([0, 0.5, 0])
            self.play(FadeIn(head), run_time=b.t(0.12))
            self.play(FadeIn(j1, shift=RIGHT * 0.2), run_time=b.t(0.35))
            self.play(FadeIn(j2, shift=RIGHT * 0.2), run_time=b.t(0.35))
            self.jobs = VGroup(head, jobs)

        with self.beat("name") as b:
            form = VGroup(chip("page-", FILES), chip("first 16 hex characters", FILES, mono=False))
            form.arrange(RIGHT, buff=0.25).move_to([0, -2.0, 0])
            same = T("the same sources always give the same build name", SMALL, MUTED)
            same.next_to(form, DOWN, buff=0.35)
            self.play(FadeIn(form), run_time=b.t(0.4))
            self.play(FadeIn(same), run_time=b.t(0.3))


class GateFiles(DWScene):
    BEATS = [("open", 6), ("three", 45), ("problems", 24), ("answer", 34), ("cheap", 15)]

    ROWS = [("index.html", "sha256", "= template"),
            ("main.tsx", "sha256", "= template"),
            ("styles.css: dw-core block", "sha256", "= template")]

    def construct(self):
        o = OutlineDiagram()
        with self.beat("open") as b:
            o.open_part(self, "page_files", run_time=b.left, arrows=("branch_page",))

        with self.beat("three") as b:
            title = scene_title("page-files: three comparisons", FILES)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.1))
            tbl = RevealTable(["what it reads", "how", "pass"], self.ROWS, mono_cols=[0, 1],
                              size=LABEL,
                              cell_colors={(i, 0): FILES for i in range(3)})
            tbl.move_to([-0.8, 1.4, 0])
            self.add(tbl)
            ticks = VGroup()
            for i in range(3):
                self.play(tbl.reveal_row(i), run_time=b.t(0.2))
                tk = tick(SOLVED).next_to(tbl.cell(i, 2), RIGHT, buff=0.5)
                ticks.add(tk)
                self.play(FadeIn(tk), run_time=b.t(0.08))
            self.tbl = tbl

        with self.beat("problems") as b:
            probs = lines("a missing file", "a changed file",
                          "a stylesheet with no block, or with two blocks",
                          size=LABEL, color=ISOLATION)
            probs.move_to([-3.6, -1.35, 0])
            head = T("each one is a problem", SMALL, MUTED)
            head.next_to(probs, UP, buff=0.25).align_to(probs, LEFT)
            self.play(FadeIn(head), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(p) for p in probs], lag_ratio=0.4), run_time=b.t(0.55))

        with self.beat("answer") as b:
            diag = lines("page/main.tsx: the file differs",
                         "from the template. It is fixed:",
                         "restore it from the template.",
                         size=SMALL, color=TEXT, mono=True)
            panel = rbox(diag.width + 0.5, diag.height + 0.45, ISOLATION, fill=0.08, sw=2.5)
            diag.move_to(panel)
            group = VGroup(panel, diag).move_to([3.4, -0.95, 0])
            step = lines("next step: restore from the template,",
                         "then call widget_install again. nothing was installed.",
                         size=SMALL, color=MUTED)
            step.next_to(group, DOWN, buff=0.3)
            self.play(FadeIn(group), run_time=b.t(0.45))
            self.play(FadeIn(step), run_time=b.t(0.35))

        with self.beat("cheap") as b:
            cap = caption("it reads files only, before any build, so it costs almost nothing")
            self.play(FadeIn(cap), run_time=b.t(0.5))


class SymlinkTeach(DWScene):
    BEATS = [("word", 13), ("what", 52), ("make", 35), ("catch", 23)]

    def construct(self):
        with self.beat("word") as b:
            title = scene_title("a symbolic link", LINK)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("what") as b:
            folder = rbox(5.0, 3.0, DISK, fill=0.05, sw=3)
            folder.move_to([-3.6, 0.5, 0])
            ftag = T("a folder", SMALL, DISK).next_to(folder.get_corner(UL), DR, buff=0.14)
            link = _file_card("link", LINK, w=2.4, h=1.1, rows=0)
            link.move_to(folder.get_center() + UP * 0.1)
            inside = T("/etc/secret", SMALL, LINK, mono=True)
            inside.move_to(link.frame.get_center() + DOWN * 0.22)
            self.play(Create(folder), FadeIn(ftag), run_time=b.t(0.15))
            self.play(FadeIn(link), run_time=b.t(0.12))
            self.play(FadeIn(inside), run_time=b.t(0.12))
            say = T("a file whose content is a path", LABEL, TEXT)
            say.next_to(folder, DOWN, buff=0.35)
            self.play(FadeIn(say), run_time=b.t(0.12))
            target = _file_card("secret", ISOLATION, w=2.2, h=1.3)
            target.move_to([4.3, 0.5, 0])
            arrow = labeled_arrow(link.get_right(), target.get_left(), "the system follows it", LINK,
                                  side=UP, mono=False)
            self.play(GrowArrow(arrow.arrow), FadeIn(arrow.label), FadeIn(target), run_time=b.t(0.16))
            sign = lines("a street sign: the shop is around the corner.",
                         "the sign is not the shop, and it can point anywhere.",
                         size=SMALL, color=MUTED)
            sign.move_to([0, -2.4, 0])
            self.play(FadeIn(sign), run_time=b.t(0.16))
            self.left_side = VGroup(folder, ftag, link, inside, say, arrow, target)
            self.sign = sign

        with self.beat("make") as b:
            self.play(FadeOut(self.left_side), FadeOut(self.sign), run_time=b.t(0.12))
            cmd = code_block("ln -s target name", "bash")
            cmd.move_to([0, 1.3, 0])
            self.play(FadeIn(cmd), run_time=b.t(0.3))
            now = T("now  name  behaves like  target", BODY, TEXT, mono=True)
            now.next_to(cmd, DOWN, buff=0.5)
            self.play(FadeIn(now), run_time=b.t(0.35))
            self.cmd = VGroup(cmd, now)

        with self.beat("catch") as b:
            catch = lines("the target can sit anywhere on the disk,",
                          "even outside the folder in front of you",
                          size=BODY, color=ISOLATION)
            catch.move_to([0, -1.4, 0])
            self.play(FadeIn(catch, shift=UP * 0.15), run_time=b.t(0.45))
            cap = caption("a folder can look small and still reach the whole disk")
            self.play(FadeIn(cap), run_time=b.t(0.3))


class GateFilesLinks(DWScene):
    BEATS = [("rule", 10), ("walk", 32), ("race", 46), ("check", 28)]

    def construct(self):
        with self.beat("rule") as b:
            title = scene_title("a page may hold no symbolic link", FILES)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("walk") as b:
            folder = rbox(4.6, 2.6, SHELL, fill=0.05, sw=3)
            folder.move_to([-4.0, 1.2, 0])
            ftag = T("page/", SMALL, SHELL, mono=True).next_to(folder.get_corner(UL), DR, buff=0.14)
            files = lines("child.tsx", "library.tsx", "styles.css", size=SMALL, color=TEXT, mono=True)
            files.move_to(folder.get_center() + LEFT * 1.1 + UP * 0.1)
            leak = T("leak.ts", SMALL, ISOLATION, mono=True)
            leak.next_to(files, DOWN, buff=0.2).align_to(files, LEFT)
            out = T("a secret file outside", SMALL, ISOLATION)
            out.move_to([2.6, 0.7, 0])
            arrow = labeled_arrow(leak.get_right(), out.get_left(), None, ISOLATION)
            self.play(Create(folder), FadeIn(ftag), FadeIn(files), run_time=b.t(0.3))
            self.play(FadeIn(leak), run_time=b.t(0.2))
            self.play(GrowArrow(arrow.arrow), FadeIn(out), run_time=b.t(0.25))
            walk = T("the gate walks page/ at every depth", SMALL, MUTED)
            walk.next_to(folder, DOWN, buff=0.3).align_to(folder, LEFT)
            self.play(FadeIn(walk), run_time=b.t(0.15))
            self.top = VGroup(folder, ftag, files, leak, out, arrow, walk)

        with self.beat("race") as b:
            head = T("why refuse it instead of checking the target?", BODY, TEXT)
            head.move_to([0, -0.9, 0])
            line = Line([-5.6, -2.1, 0], [5.6, -2.1, 0], stroke_color=MUTED, stroke_width=2)
            steps = [("the gate reads the target: fine", SOLVED, -4.2),
                     ("the agent repoints the link", ISOLATION, 0.0),
                     ("the build reads another file", ISOLATION, 4.2)]
            marks = VGroup()
            for text, color, x in steps:
                d = Dot([x, -2.1, 0], radius=0.1, color=color)
                t = lines(*text.split(": "), size=SMALL, color=color) if ": " in text else \
                    T(text, SMALL, color)
                t.move_to([x, -2.75, 0])
                marks.add(VGroup(d, t))
            self.play(FadeIn(head), run_time=b.t(0.2))
            self.play(Create(line), run_time=b.t(0.12))
            self.play(LaggedStart(*[FadeIn(m, shift=UP * 0.15) for m in marks], lag_ratio=0.5),
                      run_time=b.t(0.45))
            gap = T("a refusal has no such gap", LABEL, SOLVED)
            gap.move_to([0, -1.5, 0])
            self.play(FadeIn(gap), run_time=b.t(0.15))

        with self.beat("check") as b:
            st = stamp("REFUSED at page-files", ISOLATION)
            st.move_to([3.9, 1.9, 0])
            self.play(FadeIn(st, scale=1.2), run_time=b.t(0.3))
            proof = T("the check plants leak.ts in a page", SMALL, MUTED)
            proof.next_to(st, DOWN, buff=0.35)
            self.play(FadeIn(proof), run_time=b.t(0.3))
