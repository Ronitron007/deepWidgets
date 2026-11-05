"""Part `part_intro`: cold_open outline_map two_failures.

Beat weights are seconds of the recorded take (sentence ends found with ffmpeg silencedetect),
so each beat starts with its sentence. The base scales them to the audio length.
`_until(scene, t)` waits until second t of the take, scaled the same way.
"""
from dwscene import *


# ---------------------------------------------------------------- part helpers
def _until(scene, t):
    """Wait until second `t` of the recorded take (beat weights are take seconds)."""
    nominal = sum(w for _, w in scene.BEATS)
    scene.wait_until(t * scene.total / nominal)


def _wrap(text, width, size=SMALL, color=TEXT, mono=False):
    """Word-wrap `text` into left-aligned lines no wider than `width`."""
    rows, cur = [], ""
    for w in text.split():
        trial = (cur + " " + w).strip()
        if cur and T(trial, size, mono=mono).width > width:
            rows.append(cur)
            cur = w
        else:
            cur = trial
    rows.append(cur)
    return VGroup(*[T(r, size, color, mono=mono) for r in rows]).arrange(DOWN, buff=0.1, aligned_edge=LEFT)


def _chars(code, line, sub):
    """The glyphs of `sub` in code line `line` (Code glyphs skip spaces)."""
    src = code.code_lines[line]
    text = _CODE_TEXT[id(code)][line]
    start = text.index(sub)
    i0 = len(text[:start].replace(" ", ""))
    return VGroup(*src[i0:i0 + len(sub.replace(" ", ""))])


_CODE_TEXT: dict = {}


def _code(src):
    c = code_block(src)
    _CODE_TEXT[id(c)] = src.strip("\n").split("\n")
    return c


# ================================================================ cold_open
# (question in Rohan's words, scenes that answer it, short checklist label)
_QUESTIONS = (
    ("what does the provisional record contain? which calls? how does it work with blame?",
     "provisional_record, ex_loop_oom", "provisional record?"),
    ("is it like a Cordis effect with its own cleanup?", "provisional_record", "like a Cordis effect?"),
    ("what is a process handler, and how is it different from a Cordis effect?",
     "process_handlers, handler_vs_effect", "process handler?"),
    ("is a promise a process? is .then the handler?", "promise_not_process", "promise a process?"),
    ("what is a PID?", "process_pid", "what is a PID?"),
    ("is a handler a watcher?", "emitter_handler", "handler a watcher?"),
    ("is AsyncLocalStorage like browser localStorage?", "als", "AsyncLocalStorage?"),
    ("what is an async chain?", "async_chain", "async chain?"),
)
_CARD_W = 6.6


def _question_card(q, tags):
    text = _wrap(q, _CARD_W - 0.4)
    tag = T("→ " + tags, SMALL, MUTED)
    return text, tag


class ColdOpen(DWScene):
    BEATS = [("title", 8.8), ("questions", 3.35), ("answers", 4.62), ("words", 3.88), ("cuts", 3.39)]

    def construct(self):
        with self.beat("title") as b:
            name = T("How deepWidgets survives a bad widget", TITLE, TEXT, bold=True).move_to(UP * 0.5)
            sub = T("branch rohan/explainer-event-loop-2026-11-04, code at 3bc10af2", SMALL, MUTED, mono=True)
            sub.next_to(name, DOWN, buff=0.4)
            self.play(Write(name), run_time=b.t(0.25))
            _until(self, 2.4)
            self.play(FadeIn(sub, shift=UP * 0.15), run_time=b.t(0.1))

        with self.beat("questions") as b:
            head = scene_title("How deepWidgets survives a bad widget", WIDGET)
            self.play(FadeOut(sub), ReplacementTransform(name, head[1]), FadeIn(head[0]), run_time=b.t(0.25))
            parts = [_question_card(q, t) for q, t, _ in _QUESTIONS]
            inner_h = max(p[0].height + 0.12 + p[1].height for p in parts)
            h = inner_h + 0.3
            cards, tags = [], []
            for i, (text, tag) in enumerate(parts):
                col, row = i % 2, i // 2
                x = (-1 if col == 0 else 1) * (_CARD_W / 2 + 0.15)
                y = 2.9 - h / 2 - row * (h + 0.12)
                frame = rbox(_CARD_W, h, WIDGET, fill=0.06, sw=2)
                frame.move_to([x, y, 0])
                text.move_to(frame.get_corner(UL) + np.array([0.2, -0.15, 0]), aligned_edge=UL)
                tag.move_to(frame.get_corner(DL) + np.array([0.2, 0.15, 0]), aligned_edge=DL)
                cards.append(VGroup(frame, text))
                tags.append(tag)
            assert cards[-1][0].get_bottom()[1] >= CONTENT_BOTTOM, cards[-1][0].get_bottom()
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.15) for c in cards], lag_ratio=0.45),
                      run_time=b.left)

        with self.beat("answers") as b:
            self.play(LaggedStart(*[FadeIn(t, shift=RIGHT * 0.15) for t in tags], lag_ratio=0.4),
                      run_time=b.t(0.62))
            rows = VGroup()
            for _, _, short in _QUESTIONS:
                box = Square(0.3, stroke_color=MUTED, stroke_width=2.5)
                rows.add(VGroup(box, T(short, SMALL, TEXT)).arrange(RIGHT, buff=0.2))
            rows.arrange(DOWN, buff=0.16, aligned_edge=LEFT)
            hdr = T("your 8 questions", LABEL, MUTED, bold=True)
            checklist = VGroup(hdr, rows).arrange(DOWN, buff=0.25, aligned_edge=LEFT)
            checklist.to_edge(RIGHT, buff=MARGIN).set_y(0.6)
            self.play(*[FadeTransform(VGroup(c, t), r) for c, t, r in zip(cards, tags, rows)],
                      FadeIn(hdr), run_time=b.left)

        with self.beat("words") as b:
            rule = VGroup(chip("new word", TEXT, mono=False), Arrow(LEFT, RIGHT, color=MUTED, stroke_width=3,
                                                                     max_tip_length_to_length_ratio=0.25),
                          chip("picture", TEXT, mono=False), T("+", LABEL, MUTED),
                          chip("tiny example", TEXT, mono=False)).arrange(RIGHT, buff=0.18)
            rule[1].scale(0.6)
            rule.arrange(RIGHT, buff=0.18).move_to([-2.6, 0.9, 0])
            self.play(LaggedStart(*[FadeIn(m, shift=RIGHT * 0.1) for m in rule], lag_ratio=0.3),
                      run_time=b.t(0.45))

        with self.beat("cuts") as b:
            cut = VGroup(T("extra details", SMALL, MUTED), Arrow(LEFT, RIGHT, color=MUTED, stroke_width=3,
                                                                 max_tip_length_to_length_ratio=0.25).scale(0.6),
                         chip("cut list", MUTED, mono=False, dashed=True)).arrange(RIGHT, buff=0.18)
            cut.next_to(rule, DOWN, buff=0.55).align_to(rule, LEFT)
            self.play(FadeIn(cut, shift=DOWN * 0.1), run_time=b.t(0.25))
            legend = claim_legend().move_to([-0.6, -2.4, 0])
            self.play(FadeIn(legend, shift=UP * 0.15), run_time=b.t(0.25))


# ================================================================ outline_map
_RIGHT_BOXES = ("notice", "find_who", "write_down", "start_again", "keep_off")


class OutlineMap(DWScene):
    BEATS = [("whole", 4.5), ("widget", 5.1), ("wrong", 1.7), ("late", 3.3), ("loop", 3.3), ("jobs", 2.05),
             ("notice", 2.0), ("find", 2.35), ("write", 1.65), ("again", 2.55), ("keep", 4.25), ("names", 3.6),
             ("back", 2.49)]

    def construct(self):
        o = OutlineDiagram(self)
        with self.beat("whole") as b:
            self.play(FadeIn(o, lag_ratio=0.02), run_time=b.t(0.35))

        with self.beat("widget") as b:
            cap = caption("every widget runs in one process")
            self.play(o.highlight("widget_code"), FadeIn(cap), run_time=b.t(0.2))

        with self.beat("wrong") as b:
            self.play(o.highlight("late_error", "endless_loop"), FadeOut(cap), run_time=b.t(0.4))

        with self.beat("late") as b:
            self.play(o.highlight("late_error"), run_time=b.t(0.2))

        with self.beat("loop") as b:
            self.play(o.highlight("endless_loop"), run_time=b.t(0.2))

        with self.beat("jobs") as b:
            self.play(o.highlight(*_RIGHT_BOXES, arrows=OutlineDiagram.ARROWS), run_time=b.t(0.5))

        for key, beat in zip(_RIGHT_BOXES, ("notice", "find", "write", "again", "keep")):
            with self.beat(beat) as b:
                self.play(o.highlight(key), run_time=b.t(0.3 if beat != "keep" else 0.15))

        with self.beat("names") as b:
            cap = caption("each ? gets its real name later")
            self.play(o.highlight(*[f"q_{k}" for k in _RIGHT_BOXES]), FadeIn(cap), run_time=b.t(0.2))

        with self.beat("back") as b:
            self.play(o.reset(), FadeOut(cap), run_time=b.t(0.3))


# ================================================================ two_failures
_PINGER = """// pinger
ctx.widgets.register({ slug: 'pinger', actions: [
  { name: 'ping', kind: 'query', handler: () => {
    ctx.timeout(() => { throw new Error('late boom') }, 3000)
    return 'ok'
  } },
] })"""
_SPINNER = """// spinner
{ name: 'spin', kind: 'query', handler: () => { for (;;) {} } }"""


def _side_arrow(card, text, y):
    """A red arrow out of the right side of a card, like the outline arrow it stands for."""
    x0 = card.get_right()[0] + 0.12
    ar = Arrow([x0, y, 0], [config.frame_width / 2 - MARGIN, y, 0], buff=0, color=ISOLATION, stroke_width=4,
               tip_length=0.2, max_tip_length_to_length_ratio=0.3, max_stroke_width_to_length_ratio=20)
    lbl = VGroup(*[T(w, SMALL, ISOLATION) for w in text.split()]).arrange(DOWN, buff=0.06)
    lbl.next_to(ar, UP, buff=0.1)
    return VGroup(ar, lbl)


class TwoFailures(DWScene):
    BEATS = [("two", 5.0), ("illus", 5.4), ("pinger", 2.2), ("ping", 3.9), ("returns", 3.6), ("later", 3.7),
             ("spinner", 2.1), ("spin", 3.3), ("never", 1.65), ("close", 4.07)]

    def construct(self):
        o = OutlineDiagram(self)
        with self.beat("two") as b:
            self.play(FadeIn(o), run_time=b.t(0.2))
            self.play(o.highlight("late_error", "endless_loop"), run_time=b.t(0.2))
            _until(self, 2.85)
            self.play(o.highlight("widget_code"), run_time=b.t(0.15))

        with self.beat("illus") as b:
            title = scene_title("Two failures", ISOLATION)
            tag = chip("illustrative", MUTED, mono=False)
            tag.to_edge(RIGHT, buff=MARGIN).set_y(TITLE_Y)
            cap = caption("made-up widgets, real code paths of deepWidgets")
            self.play(FadeOut(o), run_time=b.t(0.2))
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(tag), FadeIn(cap), run_time=b.t(0.2))

        with self.beat("pinger") as b:
            pc = _code(_PINGER)
            pc.to_edge(LEFT, buff=MARGIN).align_to([0, 2.85, 0], UP)
            _chars(pc, 3, "ctx.timeout").set_color(MUTED)
            self.play(FadeOut(cap), FadeIn(pc, shift=UP * 0.15), run_time=b.t(0.5))

        with self.beat("ping") as b:
            m_throw = SurroundingRectangle(_chars(pc, 3, "throw new Error('late boom')"), color=ISOLATION,
                                           buff=0.06, stroke_width=2.5, corner_radius=0.05)
            m_wait = SurroundingRectangle(_chars(pc, 3, "3000"), color=ISOLATION, buff=0.06, stroke_width=2.5,
                                          corner_radius=0.05)
            self.play(Create(m_wait), run_time=b.t(0.2))
            self.play(Create(m_throw), run_time=b.t(0.2))

        with self.beat("returns") as b:
            ax_y, x0, x3 = -0.78, -5.2, 1.4
            axis = Line([x0 - 0.4, ax_y, 0], [x3 + 1.6, ax_y, 0], stroke_color=MUTED, stroke_width=2.5)
            ticks = VGroup(*[Line([x, ax_y - 0.1, 0], [x, ax_y + 0.1, 0], stroke_color=MUTED, stroke_width=2.5)
                             for x in (x0, x3)])
            t0 = T("0 s", SMALL, TEXT, mono=True).next_to(ticks[0], DOWN, buff=0.2)
            t3 = T("3 s", SMALL, TEXT, mono=True).next_to(ticks[1], DOWN, buff=0.2)
            ok = T("returns 'ok'", SMALL, TEXT, mono=True).next_to(ticks[0], UP, buff=0.2)
            m_ret = SurroundingRectangle(pc.code_lines[4], color=TEXT, buff=0.06, stroke_width=2.5,
                                         corner_radius=0.05)
            dot = Dot([x0, ax_y, 0], radius=0.09, color=TEXT)
            self.play(Create(m_ret), FadeIn(axis), FadeIn(ticks), FadeIn(t0), run_time=b.t(0.25))
            self.play(FadeIn(ok, shift=UP * 0.1), FadeIn(dot), run_time=b.t(0.2))

        with self.beat("later") as b:
            boom = burst(ISOLATION, 0.16).move_to([x3, ax_y, 0])
            err = T("Error('late boom')", SMALL, ISOLATION, mono=True).next_to(ticks[1], UP, buff=0.2)
            self.play(dot.animate.move_to([x3, ax_y, 0]), FadeIn(t3), run_time=b.t(0.35))
            self.play(FadeOut(dot), FadeIn(boom, scale=0.5), FadeIn(err, shift=UP * 0.1), run_time=b.t(0.15))
            late = _side_arrow(pc, "late error", pc.get_y())
            self.play(GrowArrow(late[0]), FadeIn(late[1]), run_time=b.t(0.25))

        with self.beat("spinner") as b:
            sc = _code(_SPINNER)
            sc.to_edge(LEFT, buff=MARGIN).align_to([0, -1.62, 0], UP)
            self.play(FadeIn(sc, shift=UP * 0.15), run_time=b.t(0.5))

        with self.beat("spin") as b:
            m_for = SurroundingRectangle(_chars(sc, 1, "for (;;) {}"), color=PATH_B, buff=0.06, stroke_width=2.5,
                                         corner_radius=0.05)
            self.play(Create(m_for), run_time=b.t(0.25))
            self.play(Circumscribe(_chars(sc, 1, "for (;;) {}"), color=PATH_B, buff=0.1), run_time=b.t(0.4))

        with self.beat("never") as b:
            endless = _side_arrow(sc, "endless loop", sc.get_top()[1] - 0.3)
            self.play(GrowArrow(endless[0]), FadeIn(endless[1]), run_time=b.t(0.45))

        with self.beat("close") as b:
            o2 = OutlineDiagram(self)
            o2.close_part(self, "widget_code", also=("late_error", "endless_loop"), next_key="widget_code",
                          run_time=b.t(0.4))
            o2.trace(self, PATH_A_KEYS, PATH_A, run_time=b.t(0.27))
            o2.trace(self, PATH_B_KEYS, PATH_B, run_time=b.t(0.27))
