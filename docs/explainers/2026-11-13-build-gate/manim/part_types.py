"""part_types: staging_copy, linked_modules, one_copy_rule, gate_types."""
from dwscene import *

LINKS = ["react", "react-dom", "@openuidev/react-lang", "zod",
         "@types/react", "@types/react-dom", "@deepwidgets/widget-kit", "@deepwidgets/shell"]


def _bin_icon(color=MUTED, s=0.5):
    body = VGroup(Line([-s / 2, 0, 0], [-s / 2 + 0.06, -s * 0.9, 0], stroke_color=color, stroke_width=3),
                  Line([s / 2, 0, 0], [s / 2 - 0.06, -s * 0.9, 0], stroke_color=color, stroke_width=3),
                  Line([-s / 2 + 0.06, -s * 0.9, 0], [s / 2 - 0.06, -s * 0.9, 0], stroke_color=color,
                       stroke_width=3))
    lid = Line([-s * 0.62, 0.06, 0], [s * 0.62, 0.06, 0], stroke_color=color, stroke_width=3)
    return VGroup(body, lid)


class StagingCopy(DWScene):
    BEATS = [("need", 8), ("copy", 36), ("only", 25), ("configs", 38), ("end", 18)]

    def construct(self):
        with self.beat("need") as b:
            title = scene_title("the gates work in a copy", TYPES)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("copy") as b:
            src = rbox(3.6, 2.2, AGENT, fill=0.06, sw=3).move_to([-4.6, 1.2, 0])
            st = T("the folder of the agent", SMALL, AGENT)
            st.next_to(src, UP, buff=0.2)
            sfiles = lines("page/", "src/", size=SMALL, color=TEXT, mono=True).move_to(src)
            self.play(FadeIn(src), FadeIn(st), FadeIn(sfiles), run_time=b.t(0.3))
            dst = rbox(6.6, 3.4, DISK, fill=0.06, sw=3).move_to([2.6, 0.7, 0])
            path = lines("<profile>/deepwidgets-widgets/",
                         ".page-staging/stage-XXXX/", size=SMALL, color=DISK, mono=True)
            path.next_to(dst, UP, buff=0.2)
            arrow = labeled_arrow(src.get_right(), dst.get_left(), "copy", DISK, side=UP, mono=False)
            self.play(GrowArrow(arrow.arrow), FadeIn(arrow.label), run_time=b.t(0.25))
            self.play(FadeIn(dst), FadeIn(path), run_time=b.t(0.3))
            self.dst, self.src = dst, VGroup(src, st, sfiles, arrow)

        with self.beat("only") as b:
            rows = VGroup(T("page/", BODY, SHELL, mono=True),
                          T("node_modules/", BODY, TYPES, mono=True))
            rows.arrange(DOWN, buff=0.3, aligned_edge=LEFT)
            rows.move_to(self.dst.get_center() + UP * 0.8 + LEFT * 1.4)
            skip = T("a node_modules inside page/ is never copied", SMALL, MUTED)
            skip.next_to(self.dst, DOWN, buff=0.3)
            self.play(FadeIn(rows[0]), run_time=b.t(0.3))
            self.play(FadeIn(skip), run_time=b.t(0.35))
            self.rows = rows

        with self.beat("configs") as b:
            self.play(FadeIn(self.rows[1]), run_time=b.t(0.15))
            cfg = VGroup(T("tsconfig.json", SMALL, DISK, mono=True),
                         T("oxlintrc.json", SMALL, DISK, mono=True),
                         T("page-env.d.ts", SMALL, DISK, mono=True))
            cfg.arrange(DOWN, buff=0.22, aligned_edge=LEFT)
            cfg.move_to(self.dst.get_center() + DOWN * 0.7 + LEFT * 1.4)
            notes = VGroup(T("for the type check", SMALL, MUTED),
                           T("for oxlint", SMALL, MUTED),
                           T("one line of types", SMALL, MUTED))
            for c, n in zip(cfg, notes):
                n.next_to(c, RIGHT, buff=0.4).set_y(c.get_y())
            self.play(LaggedStart(*[AnimationGroup(FadeIn(c), FadeIn(n)) for c, n in zip(cfg, notes)],
                                  lag_ratio=0.5), run_time=b.t(0.65))

        with self.beat("end") as b:
            bin_i = _bin_icon(ISOLATION).scale(1.3)
            lab = T("removed at the end, pass or fail", SMALL, ISOLATION)
            g = VGroup(bin_i, lab).arrange(RIGHT, buff=0.3).move_to([2.6, -2.5, 0])
            self.play(FadeIn(g, shift=UP * 0.15), run_time=b.t(0.5))


class LinkedModules(DWScene):
    BEATS = [("beside", 11), ("eight", 33), ("trick", 48), ("check", 22)]

    def construct(self):
        with self.beat("beside") as b:
            title = scene_title("node_modules of symbolic links", TYPES)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("eight") as b:
            box = rbox(5.2, 4.9, TYPES, fill=0.05, sw=3).move_to([-3.8, -0.45, 0])
            tag = T("node_modules/", SMALL, TYPES, mono=True)
            tag.next_to(box.get_corner(UL), DR, buff=0.16)
            entries = VGroup(*[T(n, SMALL, TEXT, mono=True) for n in LINKS])
            for i, e in enumerate(LINKS):
                entries[i].move_to([box.get_left()[0] + 0.35, 1.25 - i * 0.46, 0], aligned_edge=LEFT)
            real = rbox(4.2, 1.9, DISK, fill=0.05, sw=3).move_to([4.4, 0.4, 0])
            rtag = lines("the real folder of", "each package, as the",
                         "widget kit resolves it", size=SMALL, color=DISK)
            rtag.move_to(real)
            self.play(FadeIn(box), FadeIn(tag), run_time=b.t(0.14))
            self.play(LaggedStart(*[FadeIn(e, shift=RIGHT * 0.15) for e in entries], lag_ratio=0.35),
                      run_time=b.t(0.44))
            spine_x = -0.5
            arrows = VGroup(*[labeled_arrow(entries[i].get_right() + RIGHT * 0.1,
                                            [spine_x, entries[i].get_y(), 0], None, LINK, buff=0.05)
                              for i in range(len(LINKS))])
            spine = Line([spine_x, entries[0].get_y(), 0], [spine_x, entries[-1].get_y(), 0],
                         stroke_color=LINK, stroke_width=4)
            bus = labeled_arrow([spine_x, 0.4, 0], real.get_left(), None, LINK)
            self.play(FadeIn(real), FadeIn(rtag), run_time=b.t(0.1))
            self.play(LaggedStart(*[GrowArrow(a.arrow) for a in arrows], lag_ratio=0.2),
                      Create(spine), GrowArrow(bus.arrow), run_time=b.t(0.13))
            count = chip("eight links", TYPES, mono=False)
            count.next_to(box, UP, buff=0.2).align_to(box, RIGHT)
            self.play(FadeIn(count), run_time=b.t(0.08))
            self.entries, self.real = entries, VGroup(real, rtag, arrows)

        with self.beat("trick") as b:
            ghost = T("recharts", SMALL, ISOLATION, mono=True)
            ghost.next_to(self.entries, DOWN, buff=0.22).align_to(self.entries, LEFT)
            ghost.set_opacity(0.45)
            x = cross(ISOLATION).next_to(ghost, RIGHT, buff=0.3)
            self.play(FadeIn(ghost), run_time=b.t(0.2))
            self.play(FadeIn(x), run_time=b.t(0.15))
            why = lines("a page that imports recharts", "gets no resolution: no link",
                        "with that name exists", size=LABEL, color=TEXT)
            why.move_to([4.3, -1.0, 0])
            self.play(FadeIn(why), run_time=b.t(0.3))
            plain = T("a plain missing module error, not a rule of ours", SMALL, MUTED)
            plain.move_to([3.5, -2.0, 0])
            self.play(FadeIn(plain), run_time=b.t(0.25))

        with self.beat("check") as b:
            code = code_block("page/child.tsx:3:24:\nCannot find module 'recharts'. [TS2307]",
                              "text")
            code.move_to([3.5, -3.0, 0])
            self.play(FadeIn(code), run_time=b.t(0.6))


class OneCopyRule(DWScene):
    BEATS = [("which", 7), ("react", 36), ("zod", 47), ("why", 29)]

    def construct(self):
        with self.beat("which") as b:
            title = scene_title("which copy does each link point at?", TYPES)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("react") as b:
            page = ProcessBox("page", color=SHELL, width=2.4, height=1.0)
            page.move_to([-5.1, 1.5, 0])
            kit = ProcessBox("@deepwidgets/widget-kit", color=KIT, width=5.2, height=1.0)
            kit.move_to([0.4, 1.5, 0])
            react = ProcessBox("react, react-dom", color=TYPES, width=4.0, height=1.0)
            react.move_to([5.0, 0.1, 0])
            a1 = labeled_arrow(page.get_right(), kit.get_left(), "resolves", KIT, side=UP, mono=False)
            a2 = labeled_arrow(kit.get_right(), react.get_left(), None, KIT)
            self.play(FadeIn(page), run_time=b.t(0.2))
            self.play(GrowArrow(a1.arrow), FadeIn(a1.label), FadeIn(kit), run_time=b.t(0.3))
            self.play(GrowArrow(a2.arrow), FadeIn(react), run_time=b.t(0.3))
            same = T("the page gets the same copy as the core", SMALL, MUTED)
            same.move_to([-2.4, 0.2, 0])
            self.play(FadeIn(same), run_time=b.t(0.15))

        with self.beat("zod") as b:
            lang = ProcessBox("@openuidev/react-lang", color=TYPES, width=5.0, height=1.0)
            lang.move_to([0.4, -1.3, 0])
            zod = ProcessBox("zod", color=TYPES, width=2.0, height=1.0)
            zod.move_to([5.4, -1.3, 0])
            a3 = labeled_arrow([page.get_x(), page.get_bottom()[1], 0], lang.get_left(),
                               None, KIT)
            a4 = labeled_arrow(lang.get_right(), zod.get_left(), "peer", KIT, side=UP, mono=False)
            self.play(GrowArrow(a3.arrow), FadeIn(lang), run_time=b.t(0.3))
            self.play(GrowArrow(a4.arrow), FadeIn(a4.label), FadeIn(zod), run_time=b.t(0.3))
            share = T("the page and OpenUI share one zod", LABEL, SOLVED)
            share.move_to([-2.6, -2.2, 0])
            self.play(FadeIn(share), run_time=b.t(0.25))

        with self.beat("why") as b:
            why = lines("the components of an agent declare their props with a zod schema.",
                        "two copies of zod would fail a type check against each other.",
                        size=LABEL, color=TEXT)
            why.move_to([0, -3.1, 0])
            self.play(FadeIn(why), run_time=b.t(0.6))


class GateTypes(DWScene):
    BEATS = [("open", 15), ("oxlint", 34), ("limits", 39), ("kinds", 28)]

    CMD = """
oxlint -c <staging>/oxlintrc.json
  --type-aware --type-check
  --tsconfig <staging>/tsconfig.json
  --format unix  page
"""

    def construct(self):
        o = OutlineDiagram()
        with self.beat("open") as b:
            o.open_part(self, "page_types", run_time=b.t(0.75), arrows=("arrow_files_types",))
            title = scene_title("page-types: the same tool as the lint gate", TYPES)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.2))

        with self.beat("oxlint") as b:
            code = code_block(self.CMD, "bash")
            code.move_to([-3.1, 1.4, 0])
            self.play(FadeIn(code), run_time=b.t(0.5))
            cite = T("deepWidgets video  25:51", SMALL, MUTED)
            cite.next_to(code, DOWN, buff=0.3)
            self.play(FadeIn(cite), run_time=b.t(0.3))

        with self.beat("limits") as b:
            rows = [("limit", "60 s"), ("diagnostics", "at most 20"),
                    ("each one keeps", "file, line, column"),
                    ("the path shown", "under page/")]
            tbl = RevealTable(["the gate", ""], rows, mono_cols=[1], size=LABEL,
                              cell_colors={(i, 1): TYPES for i in range(len(rows))})
            tbl.move_to([3.6, 1.4, 0])
            self.add(tbl)
            self.play(tbl.reveal_rows(0, len(rows)), run_time=b.t(0.7))
            strip = T("the staging path is stripped off", SMALL, MUTED)
            strip.next_to(tbl, DOWN, buff=0.35)
            self.play(FadeIn(strip), run_time=b.t(0.2))

        with self.beat("kinds") as b:
            head = T("two kinds of failure land here", BODY, TEXT).move_to([0, -1.3, 0])
            d1 = code_block("page/library.tsx:18:22: Type 'string' is not assignable "
                            "to type 'number'. [TS2322]", "text")
            d2 = code_block("page/child.tsx:3:24: Cannot find module 'recharts'. [TS2307]", "text")
            d1.scale_to_fit_width(min(d1.width, 12.4))
            group = VGroup(d1, d2).arrange(DOWN, buff=0.3).next_to(head, DOWN, buff=0.4)
            self.play(FadeIn(head), run_time=b.t(0.2))
            self.play(FadeIn(d1), run_time=b.t(0.3))
            self.play(FadeIn(d2), run_time=b.t(0.3))
