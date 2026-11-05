"""Part `part_example_loop`: ex_loop_stall ex_loop_restart ex_loop_oom.

Worked example B: the endless loop of spinner, through every box, and its heap-full variant.
Opens on the outline at `widget_spinner` (also `endless_loop`); closes there and lights `write_down`.

The widgets are illustrative (script `two_failures`); so are the heartbeat counter values and the
widget number 2 of spinner (pinger has 1 in part_example_throw). The kill time (2050 ms) and the
heap-full record time (508 ms) are real runs (`sources.runs`, watchdog check at 108d663f).
The abort time was not measured (cuts.md), so the heap-full timeline puts no number on it.

Credit and claim chips drop words the viewer has not met: the script chip `oom case` shows as
`heap full case`.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content

# the watchdog lane and its timeline (ex_loop_stall, ex_loop_oom)
_LANE_TOP, _LANE_BOT = -0.55, -2.8
_T0X, _T1X, _TLY = -2.6, 4.6, -1.45


def _tx(ms):
    """x of a time (ms after the beat stopped) on the lane timeline."""
    return _T0X + ms / 2000 * (_T1X - _T0X)


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (a cue point from the pauses of the final audio)."""
    scene.wait_until(b.start + frac * b.length)


def _illus():
    """The grey `illustrative` chip at the right end of the title row (part_example_throw)."""
    return chip("illustrative", MUTED, mono=False).to_edge(RIGHT, buff=MARGIN).set_y(TITLE_Y)


def _note(kind, *ls) -> VGroup:
    """A claim tag (`ran` or `read`) with a short grey note beside it."""
    return VGroup(claim_tag(kind), lines(*ls, size=SMALL, color=MUTED, buff=0.08)).arrange(
        RIGHT, buff=0.25, aligned_edge=UP)


def _strike(m, color=ISOLATION, sw=4):
    return Line(m.get_left() + LEFT * 0.08, m.get_right() + RIGHT * 0.08, stroke_color=color, stroke_width=sw)


def _file(name, color=RECORDS, size=LABEL):
    """A file on disk: the disk icon and the file name."""
    return VGroup(disk_icon(color, 0.36), T(name, size, color, mono=True)).arrange(RIGHT, buff=0.18)


def _body(win):
    """Center of a window card body, after the card moved (window_card sets .body_center only once)."""
    return np.array([win.frame.get_x(), (win[1].get_y() + win.frame.get_bottom()[1]) / 2, 0])


def _stack(x=-5.1, y=0.05, max_frames=4):
    """The call stack of the host main thread, its base line center at (x, y)."""
    s = CallStack(width=2.6, frame_h=0.45, max_frames=max_frames)
    s.shift(np.array([x, y, 0]) - s.base.get_center())
    return s


class _Cells(VGroup):
    """Shared memory: two cells, `heartbeat` (a counter) and `widget number` (part_threads `_Strip`,
    names under the cells). .cells .vals; set(i, text) returns an animation."""

    def __init__(self, center, cell_w=2.1, cell_h=0.65, beat="41"):
        super().__init__()
        self.cells = VGroup(*[Rectangle(width=cell_w, height=cell_h, stroke_color=HEARTBEAT, stroke_width=3,
                                        fill_color=HEARTBEAT, fill_opacity=0.12) for _ in range(2)])
        self.cells.arrange(RIGHT, buff=0).move_to(center)
        self.vals = VGroup(*[T(v, BODY, TEXT, mono=True).move_to(c) for v, c in zip((beat, "0"), self.cells)])
        self.names = VGroup(T("heartbeat", SMALL, MUTED).next_to(self.cells[0], DOWN, buff=0.12),
                            T("widget number", SMALL, MUTED).next_to(self.cells[1], DOWN, buff=0.12))
        self.title = T("shared memory", LABEL, HEARTBEAT, bold=True).next_to(self.cells, UP, buff=0.15)
        self.title.align_to(self.cells, LEFT)
        self.add(self.cells, self.vals, self.names, self.title)

    def set(self, i, text, color=TEXT) -> Animation:
        new = T(text, BODY, color, mono=True).move_to(self.cells[i])
        return Transform(self.vals[i], new)


class _Lane(VGroup):
    """The watchdog thread lane with its timeline: time with no beat, ticks at 0, 500, 2000 ms.
    .band .label .line .ticks .tick_labels .dot .prog; go(ms) returns an animation."""

    def __init__(self):
        super().__init__()
        self.band = rbox(FRAME_W - 2 * MARGIN, _LANE_TOP - _LANE_BOT, WORKER, fill=0.06, sw=2.5, r=0.12)
        self.band.move_to([0, (_LANE_TOP + _LANE_BOT) / 2, 0])
        self.label = T("watchdog thread", LABEL, WORKER, bold=True)
        self.label.align_to(self.band, UP).align_to(self.band, LEFT).shift(DOWN * 0.14 + RIGHT * 0.22)
        self.line = Line([_T0X, _TLY, 0], [_T1X, _TLY, 0], stroke_color=MUTED, stroke_width=3)
        self.axis = T("time with no beat", SMALL, MUTED).next_to(self.line, LEFT, buff=0.25)
        self.ticks = VGroup(*[Line([_tx(ms), _TLY - 0.12, 0], [_tx(ms), _TLY + 0.12, 0], stroke_color=TEXT,
                                   stroke_width=3) for ms in (0, 500, 2000)])
        self.tick_labels = VGroup(*[T(f"{ms} ms", SMALL, TEXT, mono=True).next_to(t, UP, buff=0.1)
                                    for ms, t in zip((0, 500, 2000), self.ticks)])
        self.prog = Line([_T0X, _TLY, 0], [_T0X + 0.01, _TLY, 0], stroke_color=WORKER, stroke_width=7)
        self.dot = Dot([_T0X, _TLY, 0], radius=0.1, color=WORKER).set_z_index(3)
        self.add(self.band, self.label, self.line, self.axis, self.ticks, self.tick_labels, self.prog, self.dot)

    def go(self, ms) -> Animation:
        end = np.array([_tx(ms), _TLY, 0])
        return AnimationGroup(self.prog.animate.put_start_and_end_on(np.array([_T0X, _TLY, 0]), end),
                              self.dot.animate.move_to(end), group=self)


def _record(name, detail, ms, color=RECORDS, dashed=False):
    """A record chip under the timeline at time `ms`, with a grey detail line under it."""
    c = chip(name, color, size=SMALL, dashed=dashed).move_to([_tx(ms), -2.0, 0])
    d = T(detail, SMALL, MUTED, mono=True).next_to(c, DOWN, buff=0.1)
    return VGroup(c, d)


# ====================================================================== ex_loop_stall
class ExLoopStall(DWScene):
    # weights = seconds between the pauses of audio-final/ex_loop_stall.wav (39.44 s, silencedetect)
    BEATS = [("open", 2.6), ("call", 1.25), ("wrap", 4.65), ("loop", 3.7), ("empty", 2.2), ("queues", 3.0),
             ("counter", 4.1), ("limit", 2.8), ("others", 2.3), ("watch", 2.8), ("prov", 5.1), ("kill", 4.94)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram(self).open_part(self, "widget_spinner", also=("endless_loop",), run_time=b.left)

        stack = _stack()
        cells = _Cells([2.6, 1.8, 0], beat="42")
        idx = chip("spinner", WIDGET, mono=False).next_to(cells.cells, RIGHT, buff=0.2)

        with self.beat("call") as b:
            title = scene_title("The endless loop, step by step", PATH_B)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(_illus()), FadeIn(stack), FadeIn(cells),
                      run_time=b.t(0.4))
            self.play(stack.push("spinner.spin"), run_time=b.t(0.4))

        wrap = rbox(stack.room.width + 0.3, stack.room.height + 0.2, ASYNC_CTX, fill=0.04, sw=2.5, dashed=True)
        wrap.move_to(stack.room).shift(UP * 0.1)
        wrap_t = T("wrap", LABEL, ASYNC_CTX).next_to(wrap, RIGHT, buff=0.15).align_to(wrap, DOWN).shift(UP * 0.15)
        blame = chip("blame store: spinner", ASYNC_CTX, mono=False).next_to(wrap, RIGHT, buff=0.2).align_to(wrap, UP)

        with self.beat("wrap") as b:
            self.play(Create(wrap), FadeIn(wrap_t), run_time=b.t(0.15))
            _at(self, b, 0.22)
            self.play(FadeIn(blame, shift=LEFT * 0.15), run_time=b.t(0.12))
            _at(self, b, 0.58)
            self.play(cells.set(1, "2"), FadeIn(idx, shift=LEFT * 0.15), run_time=b.t(0.15))

        with self.beat("loop") as b:
            _at(self, b, 0.1)
            self.play(stack.push_cube("endless loop"), run_time=b.t(0.25))
            _at(self, b, 0.58)
            nr = caption("it never returns", color=PATH_B)
            self.play(FadeIn(nr), run_time=b.t(0.2))

        tasks = LoopQueue("task queue", TASK, width=5.0, shape="ball", gap=0.4).move_to([0.45, -0.75, 0])
        micro = LoopQueue("microtask queue", MICROTASK, width=2.5, shape="small_ball").move_to([4.85, -0.75, 0])
        micro.tray.align_to(tasks.tray, DOWN)
        micro.title.next_to(micro.tray, UP, buff=0.15).align_to(micro.tray, LEFT)

        with self.beat("empty") as b:
            empty = caption("the call stack never empties")
            self.play(FadeOut(nr), FadeIn(empty), Indicate(stack.top, color=PATH_B, scale_factor=1.05),
                      run_time=b.t(0.5))

        with self.beat("queues") as b:
            self.play(FadeIn(tasks), FadeIn(micro), run_time=b.t(0.25))
            self.play(tasks.enqueue(None), micro.enqueue(None), run_time=b.t(0.2))
            q_cap = caption("no task and no microtask runs")
            self.play(FadeOut(empty), FadeIn(q_cap), run_time=b.t(0.2))

        with self.beat("counter") as b:
            self.play(tasks.enqueue("heartbeat"), run_time=b.t(0.2))
            _at(self, b, 0.6)
            self.play(cells.set(0, "42", MUTED), Indicate(cells.cells[0], color=ISOLATION, scale_factor=1.05),
                      run_time=b.t(0.25))
            stop = T("stopped", SMALL, ISOLATION).next_to(cells.names[0], DOWN, buff=0.1)
            self.play(FadeIn(stop), run_time=b.t(0.12))

        with self.beat("limit") as b:
            self.play(tasks.enqueue("time limit 5 s"), run_time=b.t(0.2))
            _at(self, b, 0.35)
            self.play(Indicate(tasks.items[-1], color=PATH_B, scale_factor=1.1), run_time=b.t(0.3))

        win = window_card("sample", w=2.6, h=1.1).move_to([0.45, -2.3, 0])
        waits = T("waits", LABEL, MUTED).move_to(_body(win))

        with self.beat("others") as b:
            self.play(FadeIn(win), FadeIn(waits), run_time=b.t(0.4))

        lane = _Lane()

        with self.beat("watch") as b:
            self.play(FadeOut(VGroup(tasks, micro, win, waits, q_cap)), run_time=b.t(0.2))
            self.play(FadeIn(lane), run_time=b.t(0.3))

        prov = _record("provisional.json", "(spinner, slot)", 500)
        reads = Arrow(cells.names[1].get_bottom(), prov[0].get_corner(UR) + LEFT * 0.3, buff=0.12,
                      color=HEARTBEAT, stroke_width=3, max_tip_length_to_length_ratio=0.12)

        with self.beat("prov") as b:
            _at(self, b, 0.05)
            self.play(lane.go(500), run_time=b.t(0.35))
            _at(self, b, 0.54)
            self.play(GrowArrow(reads), run_time=b.t(0.15))
            self.play(FadeIn(prov, shift=UP * 0.1), run_time=b.t(0.15))

        crash = _record("crash.json", "(spinner, stall, slot)", 2000)
        kill = chip("SIGKILL", ISOLATION, size=LABEL).move_to([_tx(2000), 0.45, 0])
        kill_ar = Arrow(lane.tick_labels[2].get_top(), kill.get_bottom(), buff=0.08, color=ISOLATION,
                        stroke_width=4, max_tip_length_to_length_ratio=0.25)

        with self.beat("kill") as b:
            _at(self, b, 0.08)
            self.play(FadeOut(reads), lane.go(2000), run_time=b.t(0.3))
            _at(self, b, 0.4)
            self.play(FadeIn(crash, shift=UP * 0.1), run_time=b.t(0.15))
            _at(self, b, 0.74)
            self.play(GrowArrow(kill_ar), FadeIn(kill, scale=0.9), stack.mark_top(ISOLATION), run_time=b.t(0.15))


# ====================================================================== ex_loop_restart
class ExLoopRestart(DWScene):
    # weights = seconds between the pauses of audio-final/ex_loop_restart.wav (28.6 s, silencedetect)
    BEATS = [("dies", 2.4), ("measured", 5.2), ("deleted", 4.7), ("sees", 4.8), ("counts", 5.1),
             ("restart", 4.4), ("others", 2.0)]

    def construct(self):
        host = rbox(4.6, 2.0, HOST, fill=0.05, sw=3).move_to([-3.9, 1.55, 0])
        host_t = T("host", LABEL, HOST, bold=True).next_to(host.get_corner(UL), DR, buff=0.18)
        cube = Rectangle(width=2.4, height=0.7, stroke_color=TEXT, stroke_width=2.5, fill_color=TEXT,
                         fill_opacity=0.92).move_to(host).shift(DOWN * 0.2)
        cube_t = T("endless loop", SMALL, BG, mono=True).move_to(cube)
        hostg = VGroup(host, host_t, cube, cube_t)
        exitc = chip("code null, signal SIGKILL", ISOLATION, size=LABEL).next_to(host, DOWN, buff=0.4)
        title = scene_title("The endless loop, start again", PATH_B)

        with self.beat("dies") as b:
            self.add(title, _illus(), hostg)
            self.play(Indicate(cube, color=ISOLATION, scale_factor=1.05), run_time=b.t(0.3))
            self.play(hostg.animate.set_opacity(0.25), FadeIn(exitc, scale=0.9), run_time=b.t(0.4))

        ran = _note("ran", "spin killed 2050 ms after the call", "(watchdog check at 108d663f)")
        ran.move_to([0, 2.2, 0]).align_to([0.3, 0, 0], LEFT)

        with self.beat("measured") as b:
            _at(self, b, 0.15)
            self.play(FadeIn(ran, shift=UP * 0.1), run_time=b.t(0.15))

        provf = _file("provisional.json").move_to([0, 0.7, 0]).align_to([0.3, 0, 0], LEFT)
        crashf = _file("crash.json").move_to([0, -0.15, 0]).align_to([0.3, 0, 0], LEFT)
        read = _note("read", "write() removes the provisional record", "(watchdog-worker.ts:183-190)")
        read.move_to([0, -1.3, 0]).align_to([0.3, 0, 0], LEFT)

        with self.beat("deleted") as b:
            self.play(FadeIn(provf), FadeIn(crashf), run_time=b.t(0.15))
            _at(self, b, 0.36)
            st = _strike(provf[1])
            self.play(Create(st), provf.animate.set_opacity(0.35), run_time=b.t(0.15))
            self.play(FadeIn(read, shift=UP * 0.1), run_time=b.t(0.12))

        sup = ProcessBox("supervisor", sub="app process", color=SUPERVISOR, sub_mono=False).move_to([-4.3, 2.0, 0])
        ins = VGroup(chip("signal SIGKILL", HOST), chip("code null", HOST)).arrange(RIGHT, buff=0.3)
        ins.next_to(sup, DOWN, buff=0.4).align_to([_X0, 0, 0], LEFT)

        with self.beat("sees") as b:
            self.play(FadeOut(VGroup(hostg, exitc, ran, provf, st, read)), run_time=b.t(0.15))
            self.play(FadeIn(sup), crashf.animate.move_to([0, -0.4, 0]).align_to([_X0, 0, 0], LEFT),
                      run_time=b.t(0.15))
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.2) for c in ins], lag_ratio=0.4), run_time=b.t(0.3))

        rec_pid = chip("pid", RECORDS).next_to(crashf, RIGHT, buff=0.3)
        link = T("=", BODY, TEXT).next_to(rec_pid, RIGHT, buff=0.3)
        dead = chip("pid of the dead host", HOST, mono=False).next_to(link, RIGHT, buff=0.3)
        same = T("same pid: counts", LABEL, TEXT).next_to(VGroup(crashf, rec_pid), DOWN, buff=0.45)
        same.align_to(crashf, LEFT)
        blames = chip("blames spinner", ISOLATION, size=LABEL, mono=False).next_to(same, RIGHT, buff=0.6)

        with self.beat("counts") as b:
            self.play(FadeIn(rec_pid), run_time=b.t(0.1))
            self.play(FadeIn(link), FadeIn(dead, shift=LEFT * 0.15), run_time=b.t(0.15))
            _at(self, b, 0.5)
            self.play(FadeIn(same), run_time=b.t(0.1))
            _at(self, b, 0.72)
            self.play(FadeIn(blames, scale=0.9), run_time=b.t(0.12))

        bar0 = Line([-2.0, 2.0, 0], [0.6, 2.0, 0], stroke_color=MUTED, stroke_width=8, stroke_opacity=0.4)
        bar = Line([-2.0, 2.0, 0], [0.6, 2.0, 0], stroke_color=SUPERVISOR, stroke_width=8)
        wait_t = T("wait 500 ms", LABEL, SUPERVISOR, mono=True).next_to(bar0, UP, buff=0.15)
        newh = ProcessBox("new host", color=HOST).move_to([2.3, 2.0, 0])
        qfile = _file("quarantine.json", ISOLATION)
        qrow = VGroup(qfile, chip("spinner", ISOLATION, mono=False)).arrange(RIGHT, buff=0.3)
        qrow.move_to([0, 0.75, 0]).align_to(newh, LEFT)
        qa = Arrow(newh.get_bottom(), [newh.get_x(), qrow.get_top()[1], 0], buff=0.1, color=ISOLATION,
                   stroke_width=4)

        with self.beat("restart") as b:
            self.play(FadeOut(VGroup(ins, dead, rec_pid, link, same, crashf, blames)), FadeIn(bar0), FadeIn(wait_t),
                      run_time=b.t(0.12))
            self.play(Create(bar), run_time=b.t(0.2))
            self.play(FadeIn(newh, scale=0.9), run_time=b.t(0.12))
            _at(self, b, 0.55)
            self.play(GrowArrow(qa), FadeIn(qrow, shift=DOWN * 0.1), run_time=b.t(0.18))

        sw = window_card("spinner", w=4.6, h=1.9).move_to([-3.1, -1.65, 0])
        sw_body = VGroup(T("failed", BODY, ISOLATION, bold=True),
                         T("quarantined after a crash", SMALL, MUTED)).arrange(DOWN, buff=0.12)
        sw_body.move_to(_body(sw))
        smw = window_card("sample", w=4.6, h=1.9).move_to([3.1, -1.65, 0])
        cnt = T("count: 4", BODY, TEXT, mono=True).move_to(_body(smw))

        with self.beat("others") as b:
            self.play(FadeIn(sw), FadeIn(sw_body), FadeIn(smw), FadeIn(cnt), run_time=b.t(0.3))
            self.play(Transform(cnt, T("count: 5", BODY, TEXT, mono=True).move_to(_body(smw))),
                      run_time=b.t(0.2))


# ====================================================================== ex_loop_oom
class ExLoopOom(DWScene):
    # weights = seconds between the pauses of audio-final/ex_loop_oom.wav (38.84 s, silencedetect)
    BEATS = [("variant", 3.2), ("fills", 3.1), ("stops", 3.7), ("prov", 5.0), ("full", 3.0), ("abort", 2.5),
             ("nojs", 3.6), ("sup", 5.1), ("quar", 2.8), ("answer", 2.8), ("close", 4.04)]

    def construct(self):
        title = scene_title("A variant: the heap fills up", PATH_B)
        stack = _stack()
        cells = _Cells([-1.3, 1.85, 0], cell_w=1.95)
        heap = rbox(5.5, 1.85, HEAP, fill=0.05, sw=2.5).move_to([3.95, 1.5, 0])
        heap_t = T("heap", LABEL, HEAP, bold=True).next_to(heap.get_corner(UL), DR, buff=0.15)
        full = Rectangle(width=5.1, height=0.85, stroke_width=0, fill_color=HEAP, fill_opacity=0.55)
        full.move_to(heap).shift(DOWN * 0.25)
        fill = full.copy().stretch_to_fit_width(0.12).align_to(full, LEFT)
        half = full.copy().stretch_to_fit_width(1.6).align_to(full, LEFT)
        more = full.copy().stretch_to_fit_width(3.7).align_to(full, LEFT)

        with self.beat("variant") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(_illus()), FadeIn(stack), FadeIn(cells),
                      run_time=b.t(0.25))
            self.play(stack.push("spinner.spin"), cells.set(1, "2"), run_time=b.t(0.2))

        with self.beat("fills") as b:
            self.play(FadeIn(heap), FadeIn(heap_t), FadeIn(fill), run_time=b.t(0.2))
            self.play(stack.push_cube("fill heap"), Transform(fill, half), run_time=b.t(0.3))

        with self.beat("stops") as b:
            self.play(cells.set(0, "41", MUTED), Indicate(cells.cells[0], color=ISOLATION, scale_factor=1.05),
                      run_time=b.t(0.25))
            stop = T("stopped", SMALL, ISOLATION).next_to(cells.names[0], DOWN, buff=0.1)
            self.play(FadeIn(stop), run_time=b.t(0.12))
            _at(self, b, 0.5)
            hold = caption("the loop holds the call stack")
            self.play(FadeIn(hold), Indicate(stack.top, color=PATH_B, scale_factor=1.05), run_time=b.t(0.3))

        lane = _Lane()
        prov = _record("provisional.json", "(spinner, slot)", 500)

        with self.beat("prov") as b:
            self.play(FadeOut(hold), FadeIn(lane), run_time=b.t(0.12))
            self.play(lane.go(500), Transform(fill, more), run_time=b.t(0.25))
            _at(self, b, 0.62)
            self.play(FadeIn(prov, shift=UP * 0.1), run_time=b.t(0.15))

        full_t = T("heap full", LABEL, ISOLATION, bold=True).move_to(full)

        with self.beat("full") as b:
            self.play(lane.go(1150), Transform(fill, full), run_time=b.t(0.45))
            _at(self, b, 0.6)
            self.play(fill.animate.set_fill(ISOLATION, 0.5), FadeIn(full_t), run_time=b.t(0.2))

        abortc = chip("code null, signal SIGABRT", ISOLATION, size=LABEL).move_to([3.0, 0.05, 0]).set_z_index(2)
        dark = VGroup(stack, cells, stop, heap, heap_t, fill, full_t, lane)
        # the host goes dark under a veil; the provisional record is on disk and stays bright
        veil = Rectangle(width=FRAME_W, height=CONTENT_TOP - CONTENT_BOTTOM + 0.1, stroke_width=0, fill_color=BG,
                         fill_opacity=0.72).move_to([0, (CONTENT_TOP + CONTENT_BOTTOM) / 2, 0]).set_z_index(1)
        prov.set_z_index(2)

        with self.beat("abort") as b:
            self.play(FadeIn(veil), FadeIn(abortc, scale=0.9), run_time=b.t(0.4))

        nocrash = _record("crash.json", "never written", 2000, color=OPEN, dashed=True).set_z_index(2)
        nostrike = _strike(nocrash[0], MUTED).set_z_index(2)

        with self.beat("nojs") as b:
            _at(self, b, 0.45)
            self.play(FadeIn(nocrash), run_time=b.t(0.15))
            self.play(Create(nostrike), run_time=b.t(0.12))
            self.play(Indicate(prov, color=RECORDS, scale_factor=1.08), run_time=b.t(0.2))

        sup = ProcessBox("supervisor", sub="app process", color=SUPERVISOR, sub_mono=False).move_to([-4.3, 2.0, 0])
        sig = chip("signal SIGABRT", HOST).next_to(sup, DOWN, buff=0.35)
        rule = lines("abort exit + provisional.json", "of this pid → blame", size=LABEL)
        rule_box = rbox(rule.width + 0.5, rule.height + 0.4, SUPERVISOR, fill=0.06, sw=2.5)
        rule.move_to(rule_box)
        card = VGroup(rule_box, rule).move_to([3.2, 2.0, 0])
        rule_src = _note("read", "SUP:95-97").next_to(card, DOWN, buff=0.15).align_to(card, LEFT)
        provf = _file("provisional.json")
        ppid = chip("pid", RECORDS)
        prow = VGroup(provf, ppid).arrange(RIGHT, buff=0.3).move_to([0, 0.15, 0]).align_to([_X0, 0, 0], LEFT)
        blames = chip("blames spinner", ISOLATION, size=LABEL, mono=False).next_to(prow, RIGHT, buff=0.6)

        with self.beat("sup") as b:
            self.play(FadeOut(VGroup(dark, veil, abortc, nocrash, nostrike)), ReplacementTransform(prov, prow),
                      run_time=b.t(0.1))
            self.play(FadeIn(sup), FadeIn(sig, shift=UP * 0.1), run_time=b.t(0.12))
            _at(self, b, 0.5)
            self.play(FadeIn(card), FadeIn(rule_src), run_time=b.t(0.15))
            self.play(rule_box.animate.set_fill(SUPERVISOR, 0.2), Indicate(rule, color=SUPERVISOR, scale_factor=1.03),
                      run_time=b.t(0.15))
            _at(self, b, 0.84)
            self.play(FadeIn(blames, scale=0.9), run_time=b.t(0.12))

        newh = ProcessBox("new host", color=HOST)
        qrow = VGroup(newh, _file("quarantine.json", ISOLATION), chip("spinner", ISOLATION, mono=False))
        qrow.arrange(RIGHT, buff=0.8)
        qrow[2].next_to(qrow[1], RIGHT, buff=0.3)
        qrow.move_to([0, -1.2, 0]).align_to([_X0, 0, 0], LEFT)
        qa = Arrow(newh.get_right(), qrow[1].get_left(), buff=0.1, color=ISOLATION, stroke_width=4)

        with self.beat("quar") as b:
            self.play(FadeIn(newh, scale=0.9), run_time=b.t(0.2))
            self.play(GrowArrow(qa), FadeIn(qrow[1:], shift=LEFT * 0.15), run_time=b.t(0.25))

        ran = _note("ran", "heap full case: stall of at least 500 ms (record at 508 ms),",
                    "host aborts before the 2 s kill (watchdog check at 108d663f)")
        ran.move_to([0, -2.35, 0]).align_to([_X0, 0, 0], LEFT)

        cap = caption("provisional record: blame for a death with no time to write", color=RECORDS)

        with self.beat("answer") as b:
            self.play(FadeIn(ran, shift=UP * 0.1), run_time=b.t(0.25))
            _at(self, b, 0.6)
            self.play(FadeIn(cap), run_time=b.t(0.2))

        with self.beat("close") as b:
            self.play(Indicate(prow, color=RECORDS, scale_factor=1.06), run_time=b.t(0.22))
            _at(self, b, 0.25)
            OutlineDiagram(self).close_part(self, "widget_spinner", next_key="write_down",
                                            also=("endless_loop",), run_time=b.left)
