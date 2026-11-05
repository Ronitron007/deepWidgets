"""Part `part_example_throw`: ex_throw_path ex_throw_record.

Worked example A: the late throw of pinger, through every box.
Opens on the outline at `widget_pinger` (also `late_error`); closes there and lights `widget_spinner`.

The widgets are illustrative (script `two_failures`); so are the row id, the widget number 1 of
pinger and the PID 68722 (script `crash_record`, `watchdog`). The fault-to-exit times are real runs
(`sources.runs`: record 8b9c8672, rerun 108d663f).

Beat weights are seconds of the final audio: each beat starts at the pause before its sentence
(ffmpeg silencedetect). The take of ex_throw_record (38.00 s) seems to end after "into quarantine":
its speech fits about 100 of the 116 words, so "The pinger window shows failed. The sample counter
and every other widget run again." seems missing (inferred from the pauses, not heard).
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content

_CRASH = """\
{ "row": "pinger",
  "event": "uncaughtException",
  "method": "store",
  "pid": 68722 }"""


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (no-op if already later)."""
    scene.wait_until(b.start + frac * b.length)


def _code(src, language="json", color=RECORDS, buff=0.18) -> Code:
    """style.code_block with a thinner panel padding (as in part_context)."""
    c = Code(code_string=src.strip("\n"), language=language, formatter_style="github-dark",
             add_line_numbers=False,
             paragraph_config={"font": MONO, "font_size": CODE, "line_spacing": 0.6},
             background_config={"fill_color": PANEL, "stroke_color": color, "stroke_width": 2,
                                 "corner_radius": 0.14, "buff": buff})
    c._dw_fs = CODE
    c._dw_ref_h = c.code_lines.height
    return c


def _illus():
    """The grey `illustrative` chip at the right end of the title row."""
    return chip("illustrative", MUTED, mono=False).to_edge(RIGHT, buff=MARGIN).set_y(TITLE_Y)


def _ribbon(a, b, color=ASYNC_CTX, width=16):
    """The thick soft band that follows one async chain (part_context)."""
    r = Line(a, b, buff=0.0, stroke_color=color, stroke_width=width, stroke_opacity=0.3)
    r.set_z_index(-1)
    return r


def _pulse_icon(color=HEARTBEAT, w=1.1):
    """A short heartbeat line, for the heartbeat cell."""
    pts = [[-w / 2, 0, 0], [-0.15, 0, 0], [-0.06, 0.2, 0], [0.04, -0.12, 0], [0.12, 0, 0], [w / 2, 0, 0]]
    return VMobject(stroke_color=color, stroke_width=3).set_points_as_corners([np.array(p) for p in pts])


class _Cells(VGroup):
    """Shared memory: two cells, `heartbeat` and `widget number` (part_threads `_Strip`, labels under).
    .cells .vals; set(i, text) returns an animation."""

    def __init__(self, cell_w=2.3, cell_h=0.72):
        super().__init__()
        self.cells = VGroup(*[Rectangle(width=cell_w, height=cell_h, stroke_color=HEARTBEAT, stroke_width=3,
                                        fill_color=HEARTBEAT, fill_opacity=0.12) for _ in range(2)])
        self.cells.arrange(RIGHT, buff=0)
        self.vals = VGroup(_pulse_icon().move_to(self.cells[0]), T("0", BODY, TEXT, mono=True).move_to(self.cells[1]))
        self.names = VGroup(T("heartbeat", SMALL, MUTED).next_to(self.cells[0], DOWN, buff=0.12),
                            T("widget number", SMALL, MUTED).next_to(self.cells[1], DOWN, buff=0.12))
        self.title = T("shared memory", LABEL, HEARTBEAT, bold=True).next_to(self.cells, UP, buff=0.15)
        self.title.align_to(self.cells, LEFT)
        self.add(self.cells, self.vals, self.names, self.title)

    def set(self, i, text, color=TEXT) -> Animation:
        new = T(text, BODY, color, mono=True).move_to(self.cells[i])
        return Transform(self.vals[i], new)


def _strike(m, color=ISOLATION, sw=4):
    return Line(m.get_left() + LEFT * 0.08, m.get_right() + RIGHT * 0.08, stroke_color=color, stroke_width=sw)


def _token(r=0.14):
    """The pinger token that walks the outline boxes (path A, red)."""
    return VGroup(Circle(radius=r * 1.9, stroke_width=0, fill_color=PATH_A, fill_opacity=0.25),
                  Dot(radius=r, color=PATH_A)).set_z_index(5)


def _walk(token, *points):
    """Animation: the token goes through `points` in order, on straight lines."""
    path = VMobject().set_points_as_corners([token.get_center(), *points])
    return MoveAlongPath(token, path, rate_func=smooth)


def _ran_note(*ls) -> VGroup:
    """The `ran` claim tag with a short grey note beside it."""
    return VGroup(claim_tag("ran"), lines(*ls, size=SMALL, color=MUTED, buff=0.08)).arrange(
        RIGHT, buff=0.25, aligned_edge=UP)


# ====================================================================== ex_throw_path
class ExThrowPath(DWScene):
    # weights = seconds between the pauses of audio-final/ex_throw_path.wav (38.04 s)
    BEATS = [("open", 3.0), ("call", 9.3), ("returns", 12.1), ("fires", 6.3), ("uncaught", 7.34)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram(self).open_part(self, "widget_pinger", also=("late_error",), run_time=b.left)

        stack = CallStack(width=3.2, frame_h=0.55, max_frames=3)
        stack.shift(np.array([-4.2, -0.9, 0]) - stack.base.get_center())
        wrap = rbox(stack.room.width + 0.5, stack.room.height + 0.35, ASYNC_CTX, fill=0.05, sw=2.5, dashed=True)
        wrap.move_to(stack.room).shift(UP * 0.12)
        wrap_t = T("wrap", LABEL, ASYNC_CTX).next_to(wrap, RIGHT, buff=0.15).align_to(wrap, UP)
        blame = chip("blame store: pinger", ASYNC_CTX, mono=False).next_to(wrap, UP, buff=0.15)
        cells = _Cells().move_to([2.6, 1.55, 0])
        idx = chip("pinger", WIDGET, mono=False).next_to(cells.cells, RIGHT, buff=0.3)

        with self.beat("call") as b:
            title = scene_title("The late error, step by step", PATH_A)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(_illus()), FadeIn(stack), run_time=b.t(0.12))
            self.play(stack.push("pinger.ping"), run_time=b.t(0.1))
            _at(self, b, 0.25)
            self.play(Create(wrap), FadeIn(wrap_t), run_time=b.t(0.1))
            _at(self, b, 0.44)
            self.play(FadeIn(blame, shift=DOWN * 0.1), run_time=b.t(0.1))
            _at(self, b, 0.67)
            self.play(FadeIn(cells), run_time=b.t(0.1))
            self.play(cells.set(1, "1"), FadeIn(idx, shift=LEFT * 0.15), run_time=b.t(0.12))

        timer = chip("timer: 3000 ms", TASK, mono=False).move_to([-0.6, -0.15, 0])
        ttag = chip("pinger", ASYNC_CTX, mono=False).next_to(timer, UP, buff=0.12)
        limit = chip("time limit", TASK, mono=False).move_to([2.9, -0.15, 0])
        ok = chip("answer: 'ok'", TEXT, mono=False).move_to([5.6, -0.15, 0])
        cleared = T("clearTimeout (index.ts:974-981)", SMALL, MUTED, mono=True).next_to(limit, DOWN, buff=0.15)

        with self.beat("returns") as b:
            self.play(FadeIn(limit), run_time=b.t(0.06))
            self.play(FadeIn(timer, shift=RIGHT * 0.2), FadeIn(ttag, shift=RIGHT * 0.2), run_time=b.t(0.1))
            _at(self, b, 0.2)
            self.play(stack.pop(), FadeIn(ok, shift=RIGHT * 0.3), FadeOut(blame), run_time=b.t(0.1))
            _at(self, b, 0.32)
            self.play(cells.set(1, "0"), FadeOut(idx), run_time=b.t(0.1))
            _at(self, b, 0.58)
            self.play(Indicate(ok, color=TEXT, scale_factor=1.1), run_time=b.t(0.08))
            strike = _strike(limit[1], TEXT)
            self.play(Create(strike), FadeIn(cleared), limit.animate.set_opacity(0.45),
                      run_time=b.t(0.1))
            _at(self, b, 0.88)
            fine = caption("everything looks fine")
            self.play(FadeIn(fine), run_time=b.t(0.08))

        queue = LoopQueue("task queue", TASK, width=3.0, shape="ball").move_to([-1.3, 1.55, 0])
        clock = T("+3000 ms", LABEL, TEXT, mono=True).next_to(timer, DOWN, buff=0.2)

        with self.beat("fires") as b:
            gone = VGroup(cells, limit, strike, cleared, ok, wrap, wrap_t, fine)
            self.play(FadeOut(gone), run_time=b.t(0.1))
            self.play(FadeIn(clock, shift=UP * 0.1), FadeIn(queue), run_time=b.t(0.12))
            self.play(queue.enqueue("timer", source=timer), FadeOut(timer), FadeOut(ttag), FadeOut(clock),
                      run_time=b.t(0.14))
            _at(self, b, 0.48)
            self.play(run_next(queue, stack, label="timer callback"), run_time=b.t(0.14))
            ctag = chip("pinger", ASYNC_CTX, mono=False).next_to(stack.top, UP, buff=0.15)
            self.play(FadeIn(ctag, shift=LEFT * 0.1), run_time=b.t(0.08))
            _at(self, b, 0.8)
            ball = VGroup(burst(ISOLATION, 0.2), T("throw", SMALL, ISOLATION, mono=True)).arrange(RIGHT, buff=0.1)
            ball.next_to(stack.top, RIGHT, buff=0.25)
            self.play(FadeIn(ball, scale=0.6), stack.top.box.animate.set_stroke(ISOLATION), run_time=b.t(0.1))

        door = chip("uncaughtException", ISOLATION, size=LABEL).move_to([-0.4, -2.35, 0])
        handler = ProcessBox("process handler", color=EMITTER).move_to([4.3, -2.35, 0])

        with self.beat("uncaught") as b:
            self.play(ball.animate.move_to([-4.2, -2.35, 0]), stack.pop(), FadeOut(ctag), run_time=b.t(0.14))
            none = T("no catch", LABEL, MUTED).next_to(stack.base, RIGHT, buff=0.3)
            self.play(FadeIn(none), run_time=b.t(0.06))
            _at(self, b, 0.24)
            self.play(FadeIn(door, scale=0.9), ball.animate.next_to(door, LEFT, buff=0.3), run_time=b.t(0.1))
            _at(self, b, 0.47)
            ar = Arrow(door.get_right(), handler.get_left(), buff=0.15, color=EMITTER, stroke_width=4)
            self.play(GrowArrow(ar), FadeIn(handler), run_time=b.t(0.12))
            rib = _ribbon([ball.get_left()[0] - 0.2, -2.35, 0], [handler.get_right()[0] + 0.2, -2.35, 0], width=75)
            rib.set_stroke(opacity=0.18)
            rib_t = T("inside the pinger async chain", LABEL, ASYNC_CTX).move_to([2.2, -1.62, 0])
            _at(self, b, 0.73)
            self.play(Create(rib), FadeIn(rib_t), run_time=b.t(0.14))
            note = lines("ctx.timeout calls the raw setTimeout,", "with no try around it",
                         "(where-we-stand.md)", size=SMALL, color=MUTED, buff=0.08)
            note.next_to(queue.tray, RIGHT, buff=0.6).align_to(queue.title, UP)
            self.play(FadeIn(note), run_time=b.t(0.1))


# ====================================================================== ex_throw_record
class ExThrowRecord(DWScene):
    # weights = seconds between the pauses of audio-final/ex_throw_record.wav (38.00 s); the take ends
    # after "into quarantine" (see the part docstring), so the windows and the close share its tail
    BEATS = [("find", 3.0), ("write", 6.0), ("exit", 7.4), ("sup", 10.5), ("restart", 6.0), ("quar", 2.9),
             ("close", 2.2)]

    def construct(self):
        o = OutlineDiagram(self)
        tok = _token()

        with self.beat("find") as b:
            o.set_highlight_now("widget_pinger", "late_error")
            tok.move_to(o.box("widget_pinger").get_center())
            self.play(FadeIn(o), FadeIn(tok), run_time=b.t(0.2))
            la = o.box("late_error")
            self.play(o.highlight("late_error", "notice", "find_who", "widget_pinger",
                                  arrows=("arrow_notice_find_who",)),
                      _walk(tok, [la.get_left()[0], la.get_y(), 0], o.box("notice").get_center()),
                      run_time=b.t(0.35))
            self.play(_walk(tok, o.box("find_who").get_center()), run_time=b.t(0.3))

        hostf = rbox(4.7, 4.6, HOST, fill=0.05, sw=3).move_to([-4.4, 0.3, 0])
        host_t = VGroup(T("host", LABEL, HOST, bold=True), T("pid 68722", SMALL, TEXT, mono=True)).arrange(
            RIGHT, buff=0.3)
        host_t.next_to(hostf.get_corner(UL), DR, buff=0.2)
        hook = ProcessBox("crash hook", color=ISOLATION).move_to([-4.4, 1.1, 0])
        gs = VGroup(T("getStore()", LABEL, ASYNC_CTX, mono=True), T("→", LABEL, TEXT),
                    chip("pinger", ASYNC_CTX, mono=False)).arrange(RIGHT, buff=0.2).move_to([-4.4, -0.2, 0])
        card = _code(_CRASH)
        card.move_to([0, 0, 0]).align_to([-1.2, 0, 0], LEFT).set_y(0.55)
        hide_lines(card)
        fname = VGroup(disk_icon(RECORDS, 0.4), T("crash.json", LABEL, RECORDS, mono=True)).arrange(RIGHT, buff=0.2)
        fname.next_to(card, UP, buff=0.2).align_to(card, LEFT)

        with self.beat("write") as b:
            self.play(_walk(tok, o.box("write_down").get_center()),
                      o.highlight("late_error", "notice", "find_who", "write_down", "widget_pinger",
                                  arrows=("arrow_notice_find_who", "arrow_find_who_write_down")),
                      run_time=b.t(0.08))
            self.play(FadeOut(o), FadeOut(tok), run_time=b.t(0.06))
            title = scene_title("The late error, written down", PATH_A)
            illus = _illus()
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(illus), FadeIn(hostf), FadeIn(host_t),
                      FadeIn(hook), run_time=b.t(0.08))
            self.play(FadeIn(gs, shift=DOWN * 0.1), run_time=b.t(0.07))
            _at(self, b, 0.24)
            ar = Arrow(hook.get_right(), fname.get_left(), buff=0.15, color=RECORDS, stroke_width=4)
            self.play(GrowArrow(ar), FadeIn(fname), FadeIn(card), reveal_lines(card, 0), run_time=b.t(0.12))
            _at(self, b, 0.45)
            self.play(reveal_lines(card, 1, 3), run_time=b.t(0.1))
            _at(self, b, 0.72)
            self.play(reveal_lines(card, 3), run_time=b.t(0.08))

        exitc = chip("code 1, signal null", ISOLATION, size=LABEL).move_to([-4.4, -1.35, 0])
        ran = _ran_note("throw to exit: 64 ms (record 8b9c8672)", "and 67 ms (rerun 108d663f)")
        ran.next_to(card, DOWN, buff=0.45).align_to(card, LEFT)

        with self.beat("exit") as b:
            self.play(VGroup(hook, gs).animate.set_opacity(0.25), hostf.animate.set_stroke(opacity=0.3),
                      FadeOut(ar),
                      FadeIn(exitc, scale=0.9), run_time=b.t(0.15))
            _at(self, b, 0.43)
            self.play(FadeIn(ran, shift=UP * 0.1), run_time=b.t(0.12))

        sup = ProcessBox("supervisor", sub="app process", color=SUPERVISOR, sub_mono=False).move_to([4.6, 2.05, 0])
        ins = VGroup(chip("code 1", HOST), chip("signal null", HOST), chip("pid 68722", HOST)).arrange(
            DOWN, buff=0.15).next_to(sup, DOWN, buff=0.35)

        with self.beat("sup") as b:
            self.play(FadeOut(VGroup(hostf, host_t, hook, gs, exitc, ran)), run_time=b.t(0.06))
            self.play(VGroup(card, fname).animate.align_to([_X0, 0, 0], LEFT).set_y(1.2), FadeIn(sup),
                      run_time=b.t(0.08))
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.2) for c in ins], lag_ratio=0.3), run_time=b.t(0.14))
            _at(self, b, 0.36)
            pid_mark = mark_line(card, 3, HOST)
            same = T("same pid: counts", LABEL, TEXT)
            same.next_to(card, DOWN, buff=0.35).align_to(card, LEFT)
            link = Arrow(ins[2].get_left(), [card.get_right()[0], card.code_lines[3].get_y(), 0], buff=0.1,
                         color=HOST, stroke_width=3)
            self.play(Create(pid_mark), Create(link), run_time=b.t(0.12))
            _at(self, b, 0.6)
            self.play(FadeIn(same), run_time=b.t(0.08))
            _at(self, b, 0.75)
            blames = chip("blames pinger", ISOLATION, size=LABEL, mono=False).next_to(same, RIGHT, buff=0.5)
            self.play(FadeIn(blames, scale=0.9), run_time=b.t(0.1))

        notc = chip("blamed crash: not counted", SUPERVISOR, mono=False).move_to([-3.4, -2.0, 0])
        bar0 = Line([0.6, -2.0, 0], [3.2, -2.0, 0], stroke_color=MUTED, stroke_width=8, stroke_opacity=0.4)
        bar = Line([0.6, -2.0, 0], [3.2, -2.0, 0], stroke_color=SUPERVISOR, stroke_width=8)
        wait_t = T("wait 500 ms", LABEL, SUPERVISOR, mono=True).next_to(bar0, UP, buff=0.15)
        newh = ProcessBox("new host", color=HOST).move_to([5.3, -2.0, 0])

        with self.beat("restart") as b:
            _at(self, b, 0.08)
            self.play(FadeIn(notc, shift=UP * 0.1), run_time=b.t(0.12))
            _at(self, b, 0.52)
            self.play(FadeIn(bar0), FadeIn(wait_t), run_time=b.t(0.08))
            self.play(Create(bar), run_time=b.t(0.2))
            self.play(FadeIn(newh, scale=0.9), run_time=b.t(0.1))

        qfile = VGroup(disk_icon(ISOLATION, 0.4), T("quarantine.json", LABEL, ISOLATION, mono=True)).arrange(
            RIGHT, buff=0.2)
        qfile.move_to([1.6, 1.9, 0])
        qrow = chip("pinger", ISOLATION, mono=False).next_to(qfile, RIGHT, buff=0.3)
        pw = window_card("pinger", w=4.6, h=2.3).move_to([-3.1, -1.2, 0])
        pw_body = VGroup(T("failed", BODY, ISOLATION, bold=True),
                         T("quarantined after a crash", SMALL, MUTED)).arrange(DOWN, buff=0.15)
        pw_body.move_to(pw.frame.get_center() + DOWN * 0.21)
        sw_ = window_card("sample", w=4.6, h=2.3).move_to([3.1, -1.2, 0])
        cnt = T("count: 3", BODY, TEXT, mono=True).move_to(sw_.frame.get_center() + DOWN * 0.21)

        with self.beat("quar") as b:
            keep = [newh, title, illus, self.source_tag]
            self.play(*[FadeOut(m) for m in self.mobjects if m not in keep], run_time=b.t(0.08))
            self.play(newh.animate.move_to([-4.3, 1.9, 0]), run_time=b.t(0.08))
            qa = Arrow(newh.get_right(), qfile.get_left(), buff=0.15, color=ISOLATION, stroke_width=4)
            self.play(GrowArrow(qa), FadeIn(qfile), run_time=b.t(0.12))
            self.play(FadeIn(qrow, shift=LEFT * 0.2), run_time=b.t(0.08))
            _at(self, b, 0.45)
            self.play(FadeIn(pw), FadeIn(pw_body), run_time=b.t(0.15))
            self.play(FadeIn(sw_), FadeIn(cnt), run_time=b.t(0.12))
            self.play(Transform(cnt, T("count: 4", BODY, TEXT, mono=True).move_to(cnt)), run_time=b.t(0.1))

        with self.beat("close") as b:
            OutlineDiagram(self).close_part(self, "widget_pinger", next_key="widget_spinner",
                                            also=("late_error",), run_time=b.left)
