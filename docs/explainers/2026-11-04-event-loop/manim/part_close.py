"""Part `part_close`: answers closing.

`answers` opens on the outline at `all`. The checklist of the eight questions from `cold_open`
(part_intro) comes back at the right edge. One focus card at a time on the left shows the question
in Rohan's words, a one-line answer for each sentence of the voice, and the scenes that taught it.
Each answer ticks its row; at the end all eight ticks are lit.

`closing` shows the full outline (`animate.template.close`), lights each box and the foundation
rows as the voice names them, ends on `highlight("all")` and the caption `cuts.md: ...`.
It does not call close_part.

Beat weights are seconds of the final audio where it exists: each beat starts at the pause
before its sentence (ffmpeg silencedetect). The base scales them to the audio length.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN          # left edge of content


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (a cue point from the pauses of the final audio)."""
    scene.wait_until(b.start + frac * b.length)


def _c(s, color):
    return f'<span fgcolor="{color}">{s}</span>'


def _mono(s):
    return f'<span font_family="{MONO}">{s}</span>'


def _tick(color=TEXT, s=0.13, sw=5):
    """A tick mark (part_boxes pattern)."""
    return VMobject(stroke_color=color, stroke_width=sw).set_points_as_corners(
        [[-s, 0, 0], [-s * 0.3, -s * 0.7, 0], [s, s * 0.8, 0]])


# (checklist label of cold_open, question lines in Rohan's words, concept color,
#  answer rows (markup, one per sentence group), taught in)
_ANSWERS = (
    ("provisional record?",
     ("what does the provisional record contain?", "which calls? how does it work with blame?"), RECORDS,
     (f"{_c('provisional record', RECORDS)}: an early note from the {_c('watchdog', WORKER)}",
      f"same fields as a {_c('crash record', RECORDS)}",
      "names the widget whose synchronous code runs",
      f"counts only after an {_c('abort', ISOLATION)}"),
     ("provisional_record", "ex_loop_oom")),
    ("like a Cordis effect?", ("is it like a Cordis effect with its own cleanup?",), RECORDS,
     (f"follows the {_c('heartbeat', HEARTBEAT)}, not the call",
      "so it is not a Cordis effect"),
     ("provisional_record",)),
    ("process handler?", ("what is a process handler, and how is it different", "from a Cordis effect?"), EMITTER,
     (f"{_c('process handler', EMITTER)}: belongs to the whole process",
      "Cordis effect: one plugin, cleans up on reload"),
     ("process_handlers", "handler_vs_effect")),
    ("promise a process?", ("is a promise a process? is .then the handler?",), PROMISE,
     (f"a {_c('promise', PROMISE)} is an object in the {_c('heap', HEAP)}",
      f"{_mono(_c('.then', PROMISE))} is a callback on that one promise"),
     ("promise_not_process",)),
    ("what is a PID?", ("what is a PID?",), TEXT,
     ("a PID is the number of a process",),
     ("process_pid",)),
    ("handler a watcher?", ("is a handler a watcher?",), EMITTER,
     (f"a {_c('handler', EMITTER)} is a function that an {_c('emitter', EMITTER)} calls",
      "not a watcher"),
     ("emitter_handler",)),
    ("AsyncLocalStorage?", ("is AsyncLocalStorage like browser localStorage?",), ASYNC_CTX,
     (f"{_c('async local storage', ASYNC_CTX)} is a value along an {_c('async chain', ASYNC_CTX)}",
      "not browser storage"),
     ("als",)),
    ("async chain?", ("what is an async chain?",), ASYNC_CTX,
     (f"an {_c('async chain', ASYNC_CTX)} is all the work",
      "that one piece of code starts, now or later"),
     ("async_chain",)),
)


def _checklist():
    """The checklist of cold_open: header and eight rows (box + short label). .rows .boxes"""
    rows = VGroup()
    for short, *_ in _ANSWERS:
        box = Square(0.3, stroke_color=MUTED, stroke_width=2.5)
        rows.add(VGroup(box, T(short, SMALL, TEXT)).arrange(RIGHT, buff=0.2))
    rows.arrange(DOWN, buff=0.22, aligned_edge=LEFT)
    hdr = T("your 8 questions", LABEL, MUTED, bold=True)
    g = VGroup(hdr, rows).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
    g.to_edge(RIGHT, buff=MARGIN).set_y(0.25)
    g.rows = rows
    return g


def _rows(markups, size=BODY, pitch=0.52):
    """Markup rows at one even baseline pitch: a trailing '|' strut gives each row the same
    ascent and descent for layout, then goes (style.RevealTable pattern)."""
    rows = VGroup()
    for k, a in enumerate(markups):
        m = M(a + "|", size, TEXT)
        m.move_to([0, -k * pitch, 0], aligned_edge=LEFT)
        fs0 = m.font_size
        m.remove(m[-1])
        m.initial_height *= m.font_size / fs0
        rows.add(m)
    return rows


def _focus(i, width, y):
    """Focus card of answer i: asked lines, answer rows, taught-in chips. .rows (answer rows)"""
    _, asked, color, answers, scenes = _ANSWERS[i]
    q = VGroup(T("asked:", SMALL, MUTED), *[T(x, LABEL, MUTED) for x in asked]).arrange(
        DOWN, buff=0.12, aligned_edge=LEFT)
    rows = _rows(answers)
    taught = VGroup(T("taught in", SMALL, MUTED), *[chip(s, MUTED) for s in scenes]).arrange(RIGHT, buff=0.2)
    body = VGroup(q, rows, taught).arrange(DOWN, buff=0.45, aligned_edge=LEFT)
    inner = width - 0.7
    if body.width > inner:
        raise ValueError(f"answer card {i} is {body.width:.2f} wide (max {inner:.2f})")
    box = rbox(width, body.height + 0.7, color, fill=0.06, sw=3)
    box.move_to([_X0 + width / 2, y, 0])
    body.move_to(box).align_to(box, LEFT).shift(RIGHT * 0.35)
    g = VGroup(box, body)
    g.rows = rows
    return g


# ================================================================ answers
class Answers(DWScene):
    # weights = seconds between the pauses of audio-final/answers.wav (48.52 s)
    BEATS = [("open", 2.95), ("q1", 5.15), ("q1b", 4.5), ("q2", 4.7), ("q3", 7.9), ("q4", 6.1), ("q5", 3.0),
             ("q6", 4.5), ("q7", 5.1), ("q8", 4.62)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram(self).open_part(self, "all", run_time=b.t(0.55))
            title = scene_title("Your 8 answers", WIDGET)
            cl = _checklist()
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(cl, shift=LEFT * 0.15), run_time=b.left)

        card_w = cl.get_left()[0] - 0.45 - _X0
        cards = [_focus(i, card_w, cl.rows.get_y()) for i in range(len(_ANSWERS))]
        assert all(c.get_bottom()[1] >= CONTENT_BOTTOM for c in cards), [c.get_bottom()[1] for c in cards]
        rows, ticks = cl.rows, []
        state = {"card": None, "mark": None}

        def show(i, b, n_rows, frac=0.18):
            """Swap in card i with its first n_rows answer rows; move the row mark."""
            card = cards[i]
            for r in card.rows[n_rows:]:
                r.set_opacity(0)
            color = _ANSWERS[i][2]
            mark = SurroundingRectangle(rows[i], color=color, buff=0.1, stroke_width=2.5, corner_radius=0.08)
            anims = [FadeIn(card, shift=UP * 0.15)]
            if state["card"] is not None:
                anims += [FadeOut(state["card"], shift=UP * 0.15), ReplacementTransform(state["mark"], mark)]
            else:
                anims.append(Create(mark))
            self.play(*anims, run_time=b.t(frac))
            state["card"], state["mark"] = card, mark

        def reveal(i, j, b, frac=0.12):
            self.play(cards[i].rows[j].animate.set_opacity(1), run_time=b.t(frac))

        def tick(i, b, frac=0.1):
            t = _tick().move_to(rows[i][0])
            ticks.append(t)
            self.play(Create(t), run_time=b.t(frac))

        with self.beat("q1") as b:
            show(0, b, 1)
            _at(self, b, 0.62)
            reveal(0, 1, b)

        with self.beat("q1b") as b:
            reveal(0, 2, b, 0.15)
            _at(self, b, 0.52)
            reveal(0, 3, b, 0.15)
            tick(0, b)

        with self.beat("q2") as b:
            show(1, b, 1)
            _at(self, b, 0.47)
            reveal(1, 1, b)
            tick(1, b)

        with self.beat("q3") as b:
            show(2, b, 1)
            _at(self, b, 0.4)
            reveal(2, 1, b)
            tick(2, b)

        with self.beat("q4") as b:
            show(3, b, 1)
            _at(self, b, 0.39)
            reveal(3, 1, b)
            tick(3, b)

        with self.beat("q5") as b:
            show(4, b, 1, frac=0.3)
            tick(4, b, 0.15)

        with self.beat("q6") as b:
            show(5, b, 1, frac=0.25)
            _at(self, b, 0.6)
            reveal(5, 1, b, 0.15)
            tick(5, b, 0.12)

        with self.beat("q7") as b:
            show(6, b, 1, frac=0.22)
            _at(self, b, 0.66)
            reveal(6, 1, b, 0.13)
            tick(6, b, 0.1)

        with self.beat("q8") as b:
            show(7, b, 2)
            tick(7, b)
            _at(self, b, 0.7)
            self.play(FadeOut(state["mark"]), Indicate(VGroup(*ticks), color=TEXT, scale_factor=1.15),
                      run_time=b.t(0.2))


# ================================================================ closing
_BOXES = ("notice", "find_who", "write_down", "start_again", "keep_off")


class Closing(DWScene):
    # weights = seconds between the pauses of audio-final/closing.wav (30.44 s)
    BEATS = [("back", 2.0), ("names", 2.1), ("notice", 2.85), ("find", 2.15), ("write", 3.15), ("again", 4.95),
             ("floor", 3.25), ("thread", 4.05), ("second", 2.7), ("cuts", 3.24)]

    def construct(self):
        o = OutlineDiagram(self)
        with self.beat("back") as b:
            self.play(FadeIn(o), run_time=b.t(0.45))

        with self.beat("names") as b:
            self.play(o.highlight(*_BOXES, arrows=OutlineDiagram.ARROWS), run_time=b.t(0.35))

        with self.beat("notice") as b:
            self.play(o.highlight("notice", "late_error", "endless_loop"), run_time=b.t(0.3))

        with self.beat("find") as b:
            self.play(o.highlight("find_who"), run_time=b.t(0.3))

        with self.beat("write") as b:
            self.play(o.highlight("write_down"), run_time=b.t(0.25))

        with self.beat("again") as b:
            self.play(o.highlight("start_again"), run_time=b.t(0.18))
            _at(self, b, 0.47)
            self.play(o.highlight("keep_off"), run_time=b.t(0.18))

        with self.beat("floor") as b:
            self.play(o.highlight("foundations"), run_time=b.t(0.3))

        with self.beat("thread") as b:
            _at(self, b, 0.22)
            self.play(o.highlight("f_call_stack"), run_time=b.t(0.12))
            _at(self, b, 0.53)
            self.play(o.highlight("f_call_stack", "f_event_loop"), run_time=b.t(0.12))
            _at(self, b, 0.76)
            self.play(o.highlight("f_call_stack", "f_event_loop", "f_task_queue", "f_microtask_queue"),
                      run_time=b.t(0.12))

        with self.beat("second") as b:
            self.play(o.highlight("f_worker_thread", "f_shared_memory"), run_time=b.t(0.3))

        with self.beat("cuts") as b:
            cap = M(f"{_mono('cuts.md')}: the details this video left out", 26, TEXT)
            cap.move_to([CAPTION_X, CAPTION_Y, 0])
            assert cap.width <= CAPTION_W, cap.width
            self.play(o.highlight("all"), run_time=b.t(0.3))
            self.play(FadeIn(cap, shift=UP * 0.1), run_time=b.t(0.2))
