"""part_intro: cold_open, outline, from_the_plan."""
from dwscene import *


def _program_rows(color, n=3, w=1.9):
    """Little bars that stand for the drawn program inside a widget window."""
    rows = VGroup(*[RoundedRectangle(corner_radius=0.06, width=w * (1 - 0.18 * i), height=0.22,
                                     stroke_width=0, fill_color=color, fill_opacity=0.55)
                    for i in range(n)])
    return rows.arrange(DOWN, buff=0.16, aligned_edge=LEFT)


def _blocks(colors, w=0.62, h=0.42):
    g = VGroup(*[RoundedRectangle(corner_radius=0.08, width=w, height=h, stroke_color=c,
                                  stroke_width=2.5, fill_color=c, fill_opacity=0.3) for c in colors])
    return g.arrange(RIGHT, buff=0.14)


class ColdOpen(DWScene):
    BEATS = [("open", 11), ("today", 35), ("after", 27), ("nobody", 26)]

    def construct(self):
        with self.beat("open") as b:
            head = T("An agent can send a widget with its own page", HEADING, TEXT, bold=True)
            head.set_y(TITLE_Y)
            self.play(FadeIn(head, shift=DOWN * 0.2), run_time=b.t(0.45))

        with self.beat("today") as b:
            left = window_card("widget window", w=5.2, h=3.6, color=SHELL)
            left.move_to([-3.5, 0.0, 0])
            tag_l = T("TODAY", LABEL, SHELL, bold=True).next_to(left, UP, buff=0.22)
            shell = chip("shared shell page", SHELL, mono=False)
            prog = _program_rows(AGENT, 3, 2.6)
            body_l = VGroup(shell, prog).arrange(DOWN, buff=0.3)
            body_l.move_to(left.body())
            note_l = T("our components, agent text", SMALL, MUTED).next_to(left, DOWN, buff=0.22)
            self.play(FadeIn(tag_l), Create(left.frame), run_time=b.t(0.25))
            self.play(FadeIn(left[1]), FadeIn(left.title), FadeIn(shell), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(r) for r in prog], lag_ratio=0.3), run_time=b.t(0.25))
            self.play(FadeIn(note_l), run_time=b.t(0.15))

        with self.beat("after") as b:
            right = window_card("widget window", w=5.2, h=3.6, color=AGENT)
            right.move_to([3.5, 0.0, 0])
            tag_r = T("AFTER", LABEL, AGENT, bold=True).next_to(right, UP, buff=0.22)
            own = chip("the page of the agent", AGENT, mono=False)
            rows = VGroup(_blocks([AGENT, AGENT, AGENT]), _blocks([AGENT, AGENT]))
            rows.arrange(DOWN, buff=0.2, aligned_edge=LEFT)
            body_r = VGroup(own, rows).arrange(DOWN, buff=0.3)
            body_r.move_to(right.body())
            note_r = T("its own React components", SMALL, MUTED).next_to(right, DOWN, buff=0.22)
            self.play(FadeIn(tag_r), Create(right.frame), run_time=b.t(0.25))
            self.play(FadeIn(right[1]), FadeIn(right.title), FadeIn(own), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(r) for r in rows], lag_ratio=0.4), run_time=b.t(0.25))
            self.play(FadeIn(note_r), run_time=b.t(0.15))
            self.right, self.note_r = right, note_r

        with self.beat("nobody") as b:
            ring = SurroundingRectangle(self.right, color=ISOLATION, buff=0.14, stroke_width=5,
                                        corner_radius=0.14)
            cap = T("nobody reviews it first", BODY, ISOLATION, bold=True)
            cap.next_to(self.note_r, DOWN, buff=0.3)
            self.play(Create(ring), run_time=b.t(0.3))
            self.play(FadeIn(cap, shift=UP * 0.15), run_time=b.t(0.25))
            ask = T("so the install must check it", BODY, TEXT)
            ask.move_to([-3.5, cap.get_y(), 0])
            self.play(FadeIn(ask), run_time=b.t(0.2))


class Outline(DWScene):
    BEATS = [("here", 5), ("host", 45), ("page", 30), ("refuse", 17), ("live", 26)]

    def construct(self):
        o = OutlineDiagram()
        with self.beat("here") as b:
            self.play(FadeIn(o), run_time=b.t(0.6))

        with self.beat("host") as b:
            self.play(o.highlight("install"), run_time=b.t(0.2))
            self.play(o.highlight("install", "host_gates", arrows=("arrow_install_gates",)),
                      run_time=b.t(0.25))
            for key in ("gate_compile", "gate_lint", "gate_test_run"):
                self.play(o.highlight("host_gates", key, arrows=("arrow_install_gates",)),
                          run_time=b.t(0.12))
            cap = lines("a gate: a check that new code", "must pass before the host runs it",
                        size=LABEL, color=MUTED)
            cap.move_to([-3.3, 1.35, 0])
            self.play(FadeIn(cap), run_time=b.t(0.15))
            self.cap = cap

        with self.beat("page") as b:
            self.play(FadeOut(self.cap), o.highlight("page_q", arrows=("arrow_gates_q",)),
                      run_time=b.t(0.2))
            self.play(o.highlight("page_q", "page_gates", arrows=("branch_page",)), run_time=b.t(0.25))
            for key in ("page_files", "page_types", "page_build", "page_render"):
                self.play(o.highlight("page_gates", key, arrows=("branch_page",)), run_time=b.t(0.12))

        with self.beat("refuse") as b:
            self.play(o.highlight("page_gates", "refuse", arrows=("branch_refuse",)), run_time=b.t(0.35))
            cap = lines("the first gate that refuses", "stops the install", size=LABEL, color=ISOLATION)
            cap.move_to([-1.0, -3.05, 0])
            self.play(FadeIn(cap), run_time=b.t(0.25))
            self.cap2 = cap

        with self.beat("live") as b:
            self.play(FadeOut(self.cap2), run_time=b.t(0.12))
            self.play(o.highlight("page_gates", "profile", "live",
                                  arrows=("arrow_render_profile", "arrow_profile_live")),
                      run_time=b.t(0.3))
            self.play(o.reset(), run_time=b.t(0.3))


class FromThePlan(DWScene):
    BEATS = [("kit", 21), ("now", 27), ("callbacks", 32)]

    @staticmethod
    def _card(title, sub, color):
        frame = rbox(5.0, 2.5, color, fill=0.07, sw=3)
        t = T(title, LABEL, color, bold=True)
        s = T(sub, SMALL, TEXT, mono=True)
        VGroup(t, s).arrange(DOWN, buff=0.22).move_to(frame)
        g = VGroup(frame, t, s)
        g.frame = frame
        return g

    def construct(self):
        with self.beat("kit") as b:
            title = scene_title("the plan, and what we built", CREATION)
            plan = self._card("widget kit video", "2026-11-03   43:50", KIT)
            plan.move_to([-3.6, 0.4, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))
            self.play(FadeIn(plan), run_time=b.t(0.3))
            sub = T("the plan for this work", SMALL, MUTED).next_to(plan, DOWN, buff=0.25)
            self.play(FadeIn(sub), run_time=b.t(0.2))
            self.plan, self.sub = plan, sub

        with self.beat("now") as b:
            now = self._card("this video", "what we built", CREATION)
            now.move_to([3.6, 0.4, 0])
            self.play(FadeIn(now), run_time=b.t(0.3))
            line = T("the plan holds in most places", BODY, TEXT).next_to(now, DOWN, buff=0.25)
            self.play(FadeIn(line), run_time=b.t(0.25))

        with self.beat("callbacks") as b:
            pins = VGroup()
            for i, name in enumerate(("deadline", "copy", "allowed set")):
                dot = Dot(radius=0.12, color=ISOLATION)
                lab = T(name, SMALL, ISOLATION, mono=True).next_to(dot, RIGHT, buff=0.14)
                pins.add(VGroup(dot, lab))
            pins.arrange(DOWN, buff=0.26, aligned_edge=LEFT)
            pins.move_to([-3.6, -2.45, 0])
            head = T("three places it does not", BODY, ISOLATION, bold=True)
            head.next_to(pins, UP, buff=0.3).align_to(pins, LEFT)
            self.play(FadeOut(self.sub), FadeIn(head), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(p, shift=DOWN * 0.2) for p in pins], lag_ratio=0.4),
                      run_time=b.t(0.35))
            cb = T("earlier video and time, when we lean on it", SMALL, MUTED)
            cb.move_to([3.6, pins.get_y(), 0])
            self.play(FadeIn(cb), run_time=b.t(0.2))
