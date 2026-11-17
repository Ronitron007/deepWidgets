"""part_place: rename_teach, tmp_build, page_link, keep_three, sweep."""
from dwscene import *


def _folder_row(name, color, w=3.2, h=0.62):
    box = rbox(w, h, color, fill=0.07, sw=2.5)
    t = T(name, SMALL, color, mono=True).move_to(box)
    g = VGroup(box, t)
    g.box = box
    return g


class RenameTeach(DWScene):
    BEATS = [("word", 18), ("rename", 42), ("pattern", 20), ("crash", 34)]

    def construct(self):
        with self.beat("word") as b:
            title = scene_title("an atomic rename", PLACE)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("rename") as b:
            cl = T("a copy", LABEL, ISOLATION, bold=True).move_to([-5.6, 2.2, 0])
            track = rbox(6.4, 0.5, MUTED, fill=0.04, sw=2).move_to([-1.6, 2.2, 0])
            fill = Rectangle(width=3.4, height=0.42, stroke_width=0, fill_color=ISOLATION,
                             fill_opacity=0.5)
            fill.move_to([track.get_left()[0] + 1.7, 2.2, 0])
            reader = T("a reader sees a file that is half written", SMALL, ISOLATION)
            reader.move_to([0.4, 1.45, 0])
            self.play(FadeIn(cl), FadeIn(track), run_time=b.t(0.2))
            self.play(FadeIn(fill), run_time=b.t(0.2))
            self.play(FadeIn(reader), run_time=b.t(0.2))
            rl = T("a rename", LABEL, SOLVED, bold=True).move_to([-5.6, 0.2, 0])
            sw_box = rbox(3.2, 1.0, SOLVED, fill=0.07, sw=2.5).move_to([-2.4, 0.2, 0])
            sw_t = lines("either it happened,", "or it did not", size=SMALL, color=SOLVED)
            sw_t.move_to(sw_box)
            none = T("no moment where a reader sees half of one", SMALL, SOLVED)
            none.move_to([3.3, 0.2, 0])
            self.play(FadeIn(rl), FadeIn(sw_box), FadeIn(sw_t), run_time=b.t(0.2))
            self.play(FadeIn(none), run_time=b.t(0.16))

        with self.beat("pattern") as b:
            pat = T("build somewhere else, then rename into place", BODY, TEXT, bold=True)
            pat.move_to([0, -1.2, 0])
            never = T("never write over the thing that readers hold open", LABEL, ISOLATION)
            never.next_to(pat, DOWN, buff=0.35)
            self.play(FadeIn(pat), run_time=b.t(0.45))
            self.play(FadeIn(never), run_time=b.t(0.4))

        with self.beat("crash") as b:
            card = rbox(9.4, 1.2, MUTED, fill=0.05, sw=2.5).move_to([0, -2.9, 0])
            txt = lines("the crash record of the host already works this way",
                        "deepWidgets video  30:48, one line, without the reason",
                        size=SMALL, color=MUTED)
            txt.move_to(card)
            self.play(FadeIn(card), FadeIn(txt), run_time=b.t(0.6))


class TmpBuild(DWScene):
    BEATS = [("wrong", 11), ("old", 43), ("now", 34), ("pass", 24), ("pin", 11)]

    def construct(self):
        with self.beat("wrong") as b:
            title = scene_title("the first version copied, and that was wrong", ISOLATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("old") as b:
            lab = T("OLD", LABEL, ISOLATION, bold=True).move_to([-6.3, 2.2, 0])
            steps = [("live", SOLVED), ("delete the old page", ISOLATION),
                     ("copy the new one in", ISOLATION)]
            boxes = VGroup(*[chip(t, c, mono=False) for t, c in steps])
            boxes.arrange(RIGHT, buff=1.1).move_to([0.2, 2.2, 0])
            arrows = VGroup(*[labeled_arrow(boxes[i].get_right(), boxes[i + 1].get_left(), None,
                                            ISOLATION) for i in range(2)])
            self.play(FadeIn(lab), run_time=b.t(0.12))
            self.play(LaggedStart(*[FadeIn(x) for x in boxes], lag_ratio=0.4),
                      LaggedStart(*[GrowArrow(a.arrow) for a in arrows], lag_ratio=0.4),
                      run_time=b.t(0.4))
            bst = burst(ISOLATION, 0.4).move_to([0.6, 1.5, 0])
            gap = lines("a crash in the gap left the widget", "with no page, or half a page",
                        size=SMALL, color=ISOLATION)
            gap.move_to([3.9, 1.15, 0])
            after = T("and it ran after the new code was already live", SMALL, MUTED)
            after.move_to([-3.6, 0.6, 0])
            self.play(FadeIn(bst, scale=1.3), FadeIn(gap), run_time=b.t(0.25))
            self.play(FadeIn(after), run_time=b.t(0.2))

        with self.beat("now") as b:
            lab = T("NEW", LABEL, SOLVED, bold=True).move_to([-6.3, 0.0, 0])
            s1 = _folder_row("<slug>/page-<hash>.tmp", BUILD, w=5.0)
            s1.move_to([-2.6, 0.0, 0])
            s2 = chip("the render check loads that folder", RENDER, mono=False)
            s2.move_to([3.4, 0.0, 0])
            a = labeled_arrow(s1.get_right(), s2.get_left(), None, BUILD)
            self.play(FadeIn(lab), FadeIn(s1), run_time=b.t(0.4))
            self.play(GrowArrow(a.arrow), FadeIn(s2), run_time=b.t(0.35))
            vite = T("Vite builds straight into the folder of the slug: no copy at all",
                     SMALL, MUTED)
            vite.move_to([0, -0.9, 0])
            self.play(FadeIn(vite), run_time=b.t(0.2))

        with self.beat("pass") as b:
            ok = VGroup(T("every gate passes", SMALL, SOLVED),
                        chip("one rename drops the .tmp", SOLVED, mono=False))
            ok.arrange(RIGHT, buff=0.4).move_to([0, -1.8, 0])
            bad = VGroup(T("a gate fails", SMALL, ISOLATION),
                         chip("the folder goes, the current page stays", ISOLATION, mono=False))
            bad.arrange(RIGHT, buff=0.4).move_to([0, -2.6, 0])
            self.play(FadeIn(ok), run_time=b.t(0.4))
            self.play(FadeIn(bad), run_time=b.t(0.4))

        with self.beat("pin") as b:
            pin = VGroup(Dot(radius=0.12, color=ISOLATION),
                         T("the second place where the plan did not hold", SMALL, ISOLATION))
            pin.arrange(RIGHT, buff=0.25).move_to([0, -3.4, 0])
            self.play(FadeIn(pin, shift=UP * 0.12), run_time=b.t(0.7))


class PageLink(DWScene):
    BEATS = [("last", 13), ("slug", 26), ("swap", 43), ("order", 34)]

    def construct(self):
        with self.beat("last") as b:
            title = scene_title("the swap, with a symbolic link", PLACE)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("slug") as b:
            box = rbox(5.4, 3.4, DISK, fill=0.04, sw=3).move_to([-3.8, 0.9, 0])
            tag = T("<profile>/.../<slug>/", SMALL, DISK, mono=True)
            tag.next_to(box, UP, buff=0.2)
            builds = VGroup(*[_folder_row(n, BUILD, w=3.6) for n in
                              ("page-3f9c2a...", "page-b7e014...", "page-5d8810...")])
            builds.arrange(DOWN, buff=0.3).move_to(box).shift(UP * 0.35)
            link = _folder_row("page", LINK, w=2.0)
            link.move_to([box.get_x() - 1.3, box.get_bottom()[1] + 0.5, 0])
            lane = box.get_right()[0] - 0.3
            path = VMobject(stroke_color=LINK, stroke_width=4)
            path.set_points_as_corners([link.get_right(), [lane, link.get_y(), 0],
                                        [lane, builds[0].get_y(), 0],
                                        [builds[0].get_right()[0] + 0.12, builds[0].get_y(), 0]])
            atip = Triangle(fill_color=LINK, fill_opacity=1, stroke_width=0).scale(0.1)
            atip.rotate(PI / 2).move_to([builds[0].get_right()[0] + 0.08, builds[0].get_y(), 0])
            arrow = VGroup(path, atip)
            arrow.arrow = path
            self.play(FadeIn(box), FadeIn(tag), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(x) for x in builds], lag_ratio=0.35), run_time=b.t(0.4))
            self.play(FadeIn(link), Create(arrow), run_time=b.t(0.3))
            self.builds, self.link = builds, link

        with self.beat("swap") as b:
            s1 = VGroup(T("1", LABEL, PLACE, bold=True),
                        lines("make a new link under a temporary name,",
                              ".page-link-ab12cd, pointing at the new build",
                              size=SMALL, color=TEXT))
            s1.arrange(RIGHT, buff=0.4)
            s2 = VGroup(T("2", LABEL, PLACE, bold=True),
                        lines("rename that link over the name page",
                              size=SMALL, color=TEXT))
            s2.arrange(RIGHT, buff=0.4)
            steps = VGroup(s1, s2).arrange(DOWN, buff=0.6, aligned_edge=LEFT)
            steps.move_to([2.9, 1.3, 0])
            self.play(FadeIn(s1, shift=RIGHT * 0.15), run_time=b.t(0.45))
            self.play(FadeIn(s2, shift=RIGHT * 0.15), run_time=b.t(0.4))
            reader = T("a reader sees the old build or the new build, never nothing",
                       LABEL, SOLVED)
            reader.move_to([0, -1.5, 0])
            self.play(FadeIn(reader), run_time=b.t(0.12))

        with self.beat("order") as b:
            order = lines("the link swaps only after the install applies.",
                          "an install that fails at the last step leaves the old page in place.",
                          size=LABEL, color=TEXT)
            order.move_to([0, -2.5, 0])
            self.play(FadeIn(order), run_time=b.t(0.5))
            still = T("that page serves the old code, which still runs", SMALL, MUTED)
            still.next_to(order, DOWN, buff=0.3)
            self.play(FadeIn(still), run_time=b.t(0.35))


class KeepThree(DWScene):
    BEATS = [("stay", 6), ("three", 20), ("why", 43), ("size", 24), ("none", 13)]

    def construct(self):
        with self.beat("stay") as b:
            title = scene_title("the old builds do not go", PLACE)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("three") as b:
            rows = VGroup(*[_folder_row(n, c, w=5.0) for n, c in
                            [("page-3f9c2a...   current", SOLVED), ("page-b7e014...", BUILD),
                             ("page-5d8810...", BUILD), ("page-91ab7e...   oldest", MUTED)]])
            rows.arrange(DOWN, buff=0.35).move_to([-3.8, 1.1, 0])
            self.play(LaggedStart(*[FadeIn(r) for r in rows], lag_ratio=0.35), run_time=b.t(0.55))
            self.play(rows[3].animate.set_opacity(0.2), run_time=b.t(0.25))
            keep = lines("three in all: the current one", "and the two newest others",
                         size=SMALL, color=MUTED)
            keep.next_to(rows, DOWN, buff=0.35)
            self.play(FadeIn(keep), run_time=b.t(0.1))

        with self.beat("why") as b:
            r1 = lines("a reinstall of the same sources keeps",
                       "the build that is there", size=LABEL, color=TEXT)
            r2 = lines("a later pin can point the link back",
                       "at an old build with one rename", size=LABEL, color=TEXT)
            reasons = VGroup(r1, r2).arrange(DOWN, buff=0.6, aligned_edge=LEFT)
            reasons.move_to([3.2, 1.3, 0])
            self.play(FadeIn(r1, shift=RIGHT * 0.15), run_time=b.t(0.45))
            self.play(FadeIn(r2, shift=RIGHT * 0.15), run_time=b.t(0.45))

        with self.beat("size") as b:
            size = chip("a page of this kind: about 360 to 800 KB", DISK, mono=False)
            size.move_to([0, -2.0, 0])
            cost = T("so three of them cost little", SMALL, MUTED)
            cost.next_to(size, DOWN, buff=0.3)
            self.play(FadeIn(size), run_time=b.t(0.45))
            self.play(FadeIn(cost), run_time=b.t(0.35))

        with self.beat("none") as b:
            cap = T("a reinstall with no page folder removes the link and keeps the builds",
                    SMALL, MUTED)
            cap.move_to([0, -3.4, 0])
            self.play(FadeIn(cap), run_time=b.t(0.7))


class Sweep(DWScene):
    BEATS = [("stop", 10), ("left", 42), ("first", 25), ("names", 42)]

    def construct(self):
        with self.beat("stop") as b:
            title = scene_title("a host can stop in the middle of all this", ISOLATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("left") as b:
            spec = [("during the staging copy", ".page-staging/stage-XXXX/"),
                    ("during the build", "page-<hash>.tmp"),
                    ("between the two renames", ".page-link-ab12cd")]
            rows = VGroup()
            for i, (when, left) in enumerate(spec):
                w = T(when, SMALL, MUTED)
                l = T(left, SMALL, ISOLATION, mono=True)
                w.move_to([-6.3, 1.8 - i * 0.9, 0], aligned_edge=LEFT)
                l.move_to([-0.6, 1.8 - i * 0.9, 0], aligned_edge=LEFT)
                rows.add(VGroup(w, l))
            head = T("each one leaves something behind", LABEL, TEXT).move_to([-2.4, 2.6, 0])
            self.play(FadeIn(head), run_time=b.t(0.15))
            self.play(LaggedStart(*[FadeIn(r, shift=RIGHT * 0.15) for r in rows], lag_ratio=0.45),
                      run_time=b.t(0.7))
            self.rows = rows

        with self.beat("first") as b:
            job = chip("the first job of the installer queue, at every host start", HOST,
                       mono=False)
            job.move_to([0, -0.9, 0])
            removes = T("it removes all three kinds", SMALL, SOLVED)
            removes.next_to(job, DOWN, buff=0.3)
            self.play(FadeIn(job), run_time=b.t(0.45))
            self.play(FadeIn(removes), run_time=b.t(0.35))

        with self.beat("names") as b:
            n1 = T("the serving code refuses a .tmp name, so it never reaches a window",
                   LABEL, TEXT)
            n2 = T("a link under a temporary name is never the name page", LABEL, TEXT)
            notes = VGroup(n1, n2).arrange(DOWN, buff=0.35)
            notes.move_to([0, -2.4, 0])
            self.play(FadeIn(n1), run_time=b.t(0.3))
            self.play(FadeIn(n2), run_time=b.t(0.3))
            cap = T("each leftover is both inert and easy to find", BODY, SOLVED, bold=True)
            cap.move_to([0, -3.5, 0])
            self.play(FadeIn(cap), run_time=b.t(0.3))
