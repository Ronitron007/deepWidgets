"""part_loop: one thread, the task queue, the event loop, timers, microtasks, blocking
(script scenes `one_thread` `task_queue` `event_loop` `timers` `microtasks` `blocking` `block_widgets`).

Opens on the outline at `widget_code`, closes there and lights `notice`.

Code cards are the real snippets of `sources.runs` (`queue.cjs`, `block_timer.cjs`, `order.cjs`,
`race_timeout.cjs`). Lines longer than about 72 characters do not fit at the least font size, so
the cards wrap the same tokens at argument boundaries. Outputs are the real outputs of runs.log.

Beat weights are seconds of the final audio where it exists: each beat starts at the pause
before its sentence (ffmpeg silencedetect). The base scales them to the audio length.
"""
from dwscene import *

# ---------------------------------------------------------------- real code and outputs
_QUEUE_CJS = """\
const t0 = Date.now()
setTimeout(() => console.log('timer 1 at', Date.now() - t0, 'ms'), 0)
setTimeout(() => console.log('timer 2 at', Date.now() - t0, 'ms'), 0)
console.log('sync code ends at', Date.now() - t0, 'ms')"""

_QUEUE_OUT = """\
sync code ends at 0 ms
timer 1 at 2 ms
timer 2 at 2 ms"""

_BLOCK_TIMER_CJS = """\
const t0 = Date.now()
setTimeout(() => console.log('timer asked for 100 ms, ran at',
  Date.now() - t0, 'ms'), 100)
while (Date.now() - t0 < 1000) {}   // one second of sync work
console.log('loop done at', Date.now() - t0, 'ms')"""

_BLOCK_TIMER_OUT = """\
loop done at 1000 ms
timer asked for 100 ms, ran at 1003 ms"""

_ORDER_CJS = """\
console.log('A')
setTimeout(() => console.log('timer'), 0)
Promise.resolve().then(() => console.log('promise'))
console.log('B')"""

_ORDER_OUT = """\
A
B
promise
timer"""

_RACE_CJS = """\
const t0 = Date.now()
const timeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('timeout')), 100))
const action = Promise.resolve().then(() => {
  while (Date.now() - t0 < 1000) {}   // a sync loop of one second
  return 'action value'
})
Promise.race([action, timeout]).then(
  (value) => console.log('race gave:', value, 'at',
    Date.now() - t0, 'ms'),
  (error) => console.log('race gave:', error.message, 'at',
    Date.now() - t0, 'ms'),
)
timeout.catch(() => console.log('timeout fired at',
  Date.now() - t0, 'ms'))"""

_RACE_OUT = """\
race gave: action value at 1000 ms
timeout fired at 1003 ms"""


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (a cue point from the pauses of the final audio)."""
    scene.wait_until(b.start + frac * b.length)


def _code(src, language="javascript", color=MUTED, buff=0.15) -> Code:
    """style.code_block with a chosen panel padding (part_memory pattern)."""
    c = Code(code_string=src.strip("\n"), language=language, formatter_style="github-dark",
             add_line_numbers=False,
             paragraph_config={"font": MONO, "font_size": CODE, "line_spacing": 0.6},
             background_config={"fill_color": PANEL, "stroke_color": color, "stroke_width": 2,
                                 "corner_radius": 0.14, "buff": buff})
    c._dw_fs = CODE
    c._dw_ref_h = c.code_lines.height
    return c


def _fname(name, card):
    """The file name of a code card, grey, at the right of the title row."""
    return T(name, SMALL, MUTED, mono=True).move_to([0, TITLE_Y, 0]).align_to(card, RIGHT)


def _ran_note(*ls) -> VGroup:
    """The `ran` claim tag with a short grey note under it."""
    return VGroup(claim_tag("ran"), lines(*ls, size=SMALL, color=MUTED, buff=0.08)).arrange(
        DOWN, buff=0.14, aligned_edge=LEFT)


def _credit(*ls, color=MUTED) -> VGroup:
    """A credit card: one or two grey lines in a thin box."""
    t = lines(*ls, size=SMALL, color=MUTED, buff=0.08)
    box = rbox(t.width + 0.4, t.height + 0.3, color, fill=0.06, sw=2, r=0.1)
    t.move_to(box)
    return VGroup(box, t)


def _base_at(pile, x, y):
    """Shift vector that puts the pile's base line center at (x, y)."""
    return np.array([x, y, 0]) - pile.base.get_center()


def _cross(color=ISOLATION, s=0.22, sw=7):
    return VGroup(Line([-s, -s, 0], [s, s, 0], stroke_color=color, stroke_width=sw),
                  Line([-s, s, 0], [s, -s, 0], stroke_color=color, stroke_width=sw))


def _qball(color=TASK, r=0.26):
    """A big ball with a question mark (where does the next piece wait?)."""
    c = Circle(radius=r, stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.75)
    return VGroup(c, T("?", LABEL, TEXT, bold=True).move_to(c))


def _ball(color=TASK, r=0.26):
    return Circle(radius=r, stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.75)


def _cube(w=0.5, h=0.5):
    return Rectangle(width=w, height=h, stroke_color=TEXT, stroke_width=2.5, fill_color=TEXT, fill_opacity=0.92)


def _legend(micro=False) -> VGroup:
    """The fixed shapes of the video (script `task_queue`)."""
    rows = [VGroup(_cube(0.45, 0.45), T("sync code", LABEL)).arrange(RIGHT, buff=0.25),
            VGroup(_ball(TASK), T("task", LABEL)).arrange(RIGHT, buff=0.25)]
    if micro:
        rows.append(VGroup(_ball(MICROTASK, 0.17), T("microtask", LABEL)).arrange(RIGHT, buff=0.25))
    for r in rows:  # line up the words
        r[0].move_to(r[1].get_left() + LEFT * 0.5)
    g = VGroup(*rows).arrange(DOWN, buff=0.22, aligned_edge=LEFT)
    return g


class _Clock(VGroup):
    """A dial: one turn = `turn_ms`. .face .hand .center_point; sweep(ms) turns the hand."""

    def __init__(self, r=0.9, color=TEXT, turn_ms=1000):
        super().__init__()
        self.r, self.turn_ms = r, turn_ms
        self.face = Circle(radius=r, stroke_color=color, stroke_width=3, fill_color=PANEL, fill_opacity=1)
        ticks = VGroup(*[Line(UP * r * 0.84, UP * r, stroke_color=MUTED, stroke_width=2).rotate(
            -i * TAU / 10, about_point=ORIGIN) for i in range(10)])
        self.hand = Line(ORIGIN, UP * r * 0.78, stroke_color=color, stroke_width=5)
        hub = Dot(ORIGIN, radius=0.06, color=color)
        self.add(self.face, ticks, self.hand, hub)
        self.hub = hub

    @property
    def center_point(self):
        return self.hub.get_center()

    def point_at(self, ms, k=1.0):
        a = PI / 2 - TAU * ms / self.turn_ms
        return self.center_point + k * self.r * np.array([np.cos(a), np.sin(a), 0])

    def sweep(self, ms) -> Animation:
        return Rotate(self.hand, angle=-TAU * ms / self.turn_ms, about_point=self.center_point,
                      rate_func=linear)


def _small_clock(r=0.3):
    face = Circle(radius=r, stroke_color=TEXT, stroke_width=3)
    h1 = Line(ORIGIN, UP * r * 0.7, stroke_color=TEXT, stroke_width=3)
    h2 = Line(ORIGIN, RIGHT * r * 0.55, stroke_color=TEXT, stroke_width=3)
    return VGroup(face, h1, h2)


def _host_frame(x0, x1, y0, y1):
    """The host box (a rounded frame in the host color) with its name at the top left."""
    box = rbox(x1 - x0, y1 - y0, HOST, fill=0.04, sw=3).move_to([(x0 + x1) / 2, (y0 + y1) / 2, 0])
    name = T("host", LABEL, HOST, bold=True)
    name.align_to(box, UP).align_to(box, LEFT).shift(DOWN * 0.18 + RIGHT * 0.25)
    g = VGroup(box, name)
    g.box, g.name = box, name
    return g


def _row(max_frames, y=-1.5):
    """The call stack, the loop arrow, the microtask queue and the task queue in one row."""
    stack = CallStack(width=2.2, max_frames=max_frames)
    stack.shift(_base_at(stack, -5.6, -2.2))
    loop = LoopArrow(radius=0.5).move_to([-3.25, y + 0.1, 0])
    mq = LoopQueue("microtask queue", MICROTASK, width=3.3, shape="small_ball", gap=0.35).move_to([-0.05, y, 0])
    tq = LoopQueue("task queue", TASK, width=4.6, shape="ball", gap=0.35).move_to([4.2, y, 0])
    return stack, loop, mq, tq


# ================================================================ one_thread
class OneThread(DWScene):
    # weights = seconds between the pauses of audio-final/one_thread.wav (39.96 s)
    BEATS = [("open", 3.4), ("host", 8.9), ("rule", 6.28), ("cutin", 6.62), ("credit", 6.0), ("price", 8.76)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram(self).open_part(self, "widget_code", run_time=b.left)

        lane_y = -1.5
        with self.beat("host") as b:
            title = scene_title("One thread", HOST)
            host = _host_frame(-6.6, 6.6, -2.8, 2.85)
            lane = Rectangle(width=8.6, height=1.1, stroke_color=HOST, stroke_width=2, fill_color=HOST,
                             fill_opacity=0.1).move_to([-1.85, lane_y, 0])
            lane_lbl = T("main thread", LABEL, HOST, bold=True).next_to(lane, UP, buff=0.12).align_to(lane, LEFT)
            stack = CallStack(width=2.4, max_frames=4)
            stack.shift(_base_at(stack, 4.5, -2.05))
            into = Arrow(lane.get_right() + LEFT * 0.1, [stack.base.get_left()[0] - 0.05, lane_y, 0], buff=0.05,
                         color=HOST, stroke_width=4, max_tip_length_to_length_ratio=0.4, tip_length=0.2)
            chips = {n: chip(n, WIDGET) for n in ("sample", "pinger", "spinner")}
            for n, x in zip(("sample", "pinger", "spinner"), (-1.6, -3.4, -5.2)):
                chips[n].move_to([x, lane_y, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(host), run_time=b.t(0.12))
            _at(self, b, 0.18)
            self.play(FadeIn(lane), FadeIn(lane_lbl), run_time=b.t(0.1))
            _at(self, b, 0.36)
            self.play(FadeIn(stack), GrowArrow(into), run_time=b.t(0.1))
            self.play(LaggedStart(*[FadeIn(c, shift=RIGHT * 0.2) for c in chips.values()], lag_ratio=0.3),
                      run_time=b.t(0.12))
            _at(self, b, 0.62)
            src = chips["sample"]
            self.remove(src)
            self.play(stack.push("sample", source=src), run_time=b.t(0.14))
            self.play(Indicate(stack.top, color=STACK, scale_factor=1.08), run_time=b.t(0.1))

        with self.beat("rule") as b:
            rule = T("runs until the call stack is empty", BODY).move_to([-1.8, 1.55, 0])
            _at(self, b, 0.36)
            self.play(FadeIn(rule), run_time=b.t(0.15))
            self.play(stack.push(None), run_time=b.t(0.1))
            self.play(stack.push(None), run_time=b.t(0.1))

        with self.beat("cutin") as b:
            p = chips["pinger"]
            home = p.get_center()
            gate = np.array([2.2, lane_y, 0])
            x1 = _cross().move_to(gate + RIGHT * 0.15 + UP * 0.75)
            _at(self, b, 0.4)
            self.play(p.animate.move_to(gate), run_time=b.t(0.08))
            self.play(FadeIn(x1, scale=1.4), run_time=b.t(0.05))
            self.play(p.animate.move_to(home), FadeOut(x1), run_time=b.t(0.08))
            clock = _small_clock().move_to([-0.6, 0.35, 0])
            x2 = _cross().move_to([2.65, 0.35, 0])
            _at(self, b, 0.64)
            self.play(FadeIn(clock), run_time=b.t(0.05))
            self.play(clock.animate.move_to([2.0, 0.35, 0]), run_time=b.t(0.08))
            self.play(FadeIn(x2, scale=1.4), run_time=b.t(0.05))
            self.play(clock.animate.move_to([-0.6, 0.35, 0]), FadeOut(x2), run_time=b.t(0.08))

        with self.beat("credit") as b:
            credit = _credit("to-do list that cannot be paused:",
                             'Jake Archibald, "In The Loop" (JSConf.Asia 2018)', color=HOST)
            credit.move_to([-1.8, 0.45, 0])
            self.play(FadeOut(clock), FadeIn(credit), run_time=b.t(0.12))
            self.play(stack.pop(), run_time=b.t(0.08))
            self.play(stack.pop(), run_time=b.t(0.08))
            self.play(stack.pop(), run_time=b.t(0.08))
            src = chips["pinger"]
            self.remove(src)
            self.play(stack.push("pinger", source=src), run_time=b.t(0.16))

        with self.beat("price") as b:
            obj = chip("object", HEAP, mono=False).move_to([stack.base.get_x(), 1.3, 0])
            arr = Arrow(stack.top.get_top(), obj.get_bottom(), buff=0.1, color=STACK, stroke_width=4,
                        max_tip_length_to_length_ratio=0.2, tip_length=0.2)
            good = caption("good side: one piece of code changes an object at a time")
            self.play(FadeOut(credit), FadeOut(rule), run_time=b.t(0.06))
            _at(self, b, 0.06)
            self.play(FadeIn(obj, scale=0.8), GrowArrow(arr), run_time=b.t(0.1))
            _at(self, b, 0.23)
            self.play(FadeIn(good), run_time=b.t(0.08))
            price = caption("but the rule has a price", color=STACK)
            _at(self, b, 0.67)
            self.play(FadeOut(good), run_time=b.t(0.04))
            self.play(FadeIn(price), run_time=b.t(0.08))


# ================================================================ task_queue
class TaskQueue(DWScene):
    # weights = seconds between the pauses of audio-final/task_queue.wav (30.8 s)
    BEATS = [("where", 4.6), ("queue", 2.04), ("task", 3.29), ("sources", 6.05), ("fifo", 3.51), ("example", 5.18),
             ("run", 6.13)]

    def construct(self):
        stack = CallStack(width=2.8, max_frames=3)
        stack.shift(_base_at(stack, -4.9, -2.1))
        q = LoopQueue("task queue", TASK, width=7.4, shape="ball", gap=0.35).move_to([2.5, -1.65, 0])

        with self.beat("where") as b:
            title = scene_title("The task queue", TASK)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(stack), run_time=b.t(0.12))
            self.play(stack.push_cube("sync code", mono=False), run_time=b.t(0.1))
            qb = _qball().move_to([0.0, -1.65, 0])
            _at(self, b, 0.6)
            self.play(FadeIn(qb, shift=LEFT * 0.3), run_time=b.t(0.12))

        with self.beat("queue") as b:
            self.play(FadeIn(q), FadeOut(qb), run_time=b.t(0.3))
            self.play(Indicate(q.title, color=TASK), run_time=b.t(0.3))

        with self.beat("task") as b:
            define = M("a <b>task</b>: one callback that is ready to run", BODY).move_to([-0.6, 2.25, 0])
            legend = _legend().move_to([3.9, 0.95, 0])
            credit = _credit("balls and cubes:", "HRomium (dev.to, 2025)").next_to(legend, LEFT, buff=0.8)
            self.play(FadeIn(define), run_time=b.t(0.15))
            self.play(q.enqueue("a callback"), run_time=b.t(0.12))
            _at(self, b, 0.5)
            self.play(FadeIn(legend), FadeIn(credit), run_time=b.t(0.15))

        with self.beat("sources") as b:
            for lbl, at in (("window call", 0.11), ("file read", 0.34), ("delay passed", 0.56)):
                _at(self, b, at)
                self.play(q.enqueue(lbl), run_time=b.t(0.1))

        with self.beat("fifo") as b:
            fifo = VGroup(Arrow(RIGHT, LEFT, color=TASK, stroke_width=4, max_tip_length_to_length_ratio=0.3,
                                tip_length=0.2),
                          T("first in, first out", LABEL, TASK)).arrange(RIGHT, buff=0.2)
            fifo.next_to(q.tray, DOWN, buff=0.15).align_to(q.tray, LEFT)
            self.play(FadeIn(fifo), run_time=b.t(0.1))
            self.play(stack.pop(), run_time=b.t(0.06))
            for _ in range(4):
                self.play(run_next(q, stack), run_time=b.t(0.08))
                self.play(stack.pop(), run_time=b.t(0.06))

        with self.beat("example") as b:
            code = _code(_QUEUE_CJS).move_to([0, 0, 0]).align_to([0, CONTENT_TOP, 0], UP)
            fname = _fname("queue.cjs", code)
            self.play(FadeOut(define), FadeOut(legend), FadeOut(credit), FadeOut(fifo), run_time=b.t(0.06))
            self.play(FadeIn(code), FadeIn(fname), stack.push_cube("sync code", mono=False), run_time=b.t(0.12))
            mark = mark_line(code, 1)
            _at(self, b, 0.3)
            self.play(Create(mark), q.enqueue("callback 1"), run_time=b.t(0.12))
            self.play(Transform(mark, mark_line(code, 2)), q.enqueue("callback 2"), run_time=b.t(0.12))
            _at(self, b, 0.8)
            self.play(Indicate(VGroup(*q.items), color=TASK, scale_factor=1.15), run_time=b.t(0.15))

        with self.beat("run") as b:
            out = _code(_QUEUE_OUT, language="text")
            out.next_to(code, DOWN, buff=0.3).align_to(code, RIGHT)
            hide_lines(out)
            note = _ran_note("node v22.23.0").next_to(out, LEFT, buff=0.4).align_to(out, UP)
            self.play(Transform(mark, mark_line(code, 3)), FadeIn(out), run_time=b.t(0.08))
            self.play(reveal_lines(out, 0), run_time=b.t(0.06))
            _at(self, b, 0.4)
            self.play(stack.pop(), run_time=b.t(0.06))
            self.play(run_next(q, stack), run_time=b.t(0.08))
            self.play(reveal_lines(out, 1), run_time=b.t(0.05))
            self.play(stack.pop(), run_time=b.t(0.05))
            self.play(run_next(q, stack), run_time=b.t(0.08))
            self.play(reveal_lines(out, 2), run_time=b.t(0.05))
            self.play(stack.pop(), FadeIn(note), run_time=b.t(0.08))


# ================================================================ event_loop
class EventLoop(DWScene):
    # weights = seconds between the pauses of audio-final/event_loop.wav (29.04 s)
    BEATS = [("who", 3.55), ("loop", 5.4), ("cycle", 6.6), ("credit", 7.8), ("sleep", 2.48), ("wake", 3.21)]

    def construct(self):
        stack = CallStack(width=2.4, max_frames=3)
        stack.shift(_base_at(stack, -4.6, -1.6))
        q = LoopQueue("task queue", TASK, width=5.4, shape="ball", gap=0.35).move_to([3.6, -0.5, 0])
        loop = LoopArrow().move_to([-1.4, -0.5, 0])

        with self.beat("who") as b:
            title = scene_title("The event loop", LOOP)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(stack), FadeIn(q), run_time=b.t(0.15))
            self.play(stack.push("main()"), q.enqueue("task 1"), run_time=b.t(0.1))
            self.play(q.enqueue("task 2"), run_time=b.t(0.08))
            ask = T("?", HEADING, LOOP, bold=True).move_to(loop.arc)
            _at(self, b, 0.45)
            self.play(FadeIn(ask, scale=1.4), run_time=b.t(0.15))

        with self.beat("loop") as b:
            define = T("a loop inside Node: it runs while work is left", BODY).move_to([0, 1.9, 0])
            self.play(FadeOut(ask), FadeIn(loop), run_time=b.t(0.12))
            self.play(loop.turn(), run_time=b.t(0.15))
            _at(self, b, 0.35)
            self.play(FadeIn(define), run_time=b.t(0.12))

        with self.beat("cycle") as b:
            wait1 = caption("waits until the call stack is empty")
            self.play(FadeIn(wait1), run_time=b.t(0.06))
            _at(self, b, 0.2)
            self.play(stack.pop(), run_time=b.t(0.08))
            _at(self, b, 0.35)
            take = caption("takes the next task and runs it")
            self.play(FadeOut(wait1), run_time=b.t(0.04))
            self.play(FadeIn(take), loop.turn(), run_time=b.t(0.1))
            self.play(run_next(q, stack), run_time=b.t(0.1))
            _at(self, b, 0.8)
            again = caption("then waits again")
            self.play(FadeOut(take), run_time=b.t(0.03))
            self.play(FadeIn(again), run_time=b.t(0.05))
            self.play(stack.pop(), run_time=b.t(0.08))

        with self.beat("credit") as b:
            credit = _credit('stack, queue, loop boxes: Lydia Hallie,', '"JavaScript Visualized: Event Loop"',
                             color=LOOP).move_to([0, 1.9, 0])
            sbox = rbox(3.1, 2.75, MUTED, fill=0.0, sw=2, dashed=True).move_to(
                [stack.base.get_x(), -0.95, 0])
            qbox = rbox(q.width + 0.4, q.height + 0.4, MUTED, fill=0.0, sw=2, dashed=True).move_to(q)
            self.play(FadeOut(define), FadeOut(again), run_time=b.t(0.06))
            _at(self, b, 0.08)
            self.play(FadeIn(credit), run_time=b.t(0.1))
            _at(self, b, 0.44)
            self.play(Create(sbox), run_time=b.t(0.1))
            _at(self, b, 0.63)
            self.play(Create(qbox), run_time=b.t(0.1))
            _at(self, b, 0.78)
            self.play(Indicate(loop, color=LOOP, scale_factor=1.1), run_time=b.t(0.15))

        with self.beat("sleep") as b:
            self.play(FadeOut(sbox), FadeOut(qbox), loop.turn(), run_time=b.t(0.15))
            self.play(run_next(q, stack), run_time=b.t(0.15))
            self.play(stack.pop(), run_time=b.t(0.12))
            sleeps = caption("queue empty: the loop sleeps")
            self.play(loop.sleep(), FadeIn(sleeps), run_time=b.t(0.2))

        with self.beat("wake") as b:
            os_lbl = T("operating system: ready", LABEL, MUTED).move_to([3.6, 1.1, 0])
            self.play(FadeIn(os_lbl), run_time=b.t(0.1))
            self.play(q.enqueue("task 3", source=np.array([7.4, 0.5, 0])), FadeOut(sleeps), run_time=b.t(0.14))
            woke = caption("a task arrives: the loop wakes")
            self.play(loop.wake(), FadeIn(woke), run_time=b.t(0.12))
            self.play(loop.turn(), run_time=b.t(0.14))
            self.play(run_next(q, stack), run_time=b.t(0.14))
            self.play(stack.pop(), run_time=b.t(0.1))


# ================================================================ timers
class Timers(DWScene):
    # weights = seconds between the pauses of audio-final/timers.wav (37.16 s)
    BEATS = [("ask", 10.78), ("minimum", 6.27), ("code", 6.8), ("run", 3.79), ("limit", 6.19), ("keep", 3.33)]

    def construct(self):
        stack = CallStack(width=2.6, max_frames=3)
        stack.shift(_base_at(stack, -5.2, -2.2))
        clock = _Clock(r=0.95).move_to([-1.1, -1.2, 0])
        top_lbl = T("0 / 1000 ms", SMALL, MUTED, mono=True).next_to(clock, UP, buff=0.1)
        mark = Line(clock.point_at(100, 0.72), clock.point_at(100, 1.12), stroke_color=TASK, stroke_width=6)
        mark_lbl = T("100 ms", SMALL, TASK, mono=True).move_to(clock.point_at(100, 1.0) + RIGHT * 0.75 + UP * 0.1)
        dial = VGroup(clock, top_lbl, mark, mark_lbl)
        q = LoopQueue("task queue", TASK, width=3.6, shape="ball").move_to([4.4, -1.6, 0])

        def park():
            return np.array([-2.95, -1.0, 0])

        with self.beat("ask") as b:
            title = scene_title("Timers", TASK)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(stack), FadeIn(dial), FadeIn(q), run_time=b.t(0.12))
            ask = T("a timer: run this callback later", BODY).move_to([0, 2.1, 0])
            cb = _ball().move_to(park())
            cb_lbl = T("callback", SMALL).next_to(cb, DOWN, buff=0.06)
            self.play(FadeIn(ask), FadeIn(cb), FadeIn(cb_lbl), run_time=b.t(0.12))
            _at(self, b, 0.62)
            self.play(clock.sweep(100), run_time=b.t(0.12))
            self.play(Indicate(mark_lbl, color=TASK), run_time=b.t(0.06))
            self.play(FadeOut(cb), FadeOut(cb_lbl), q.enqueue("callback", source=cb), run_time=b.t(0.12))

        with self.beat("minimum") as b:
            self.play(stack.push_cube("sync code", mono=False), run_time=b.t(0.1))
            self.play(Indicate(q.items[0], color=TASK, scale_factor=1.3), run_time=b.t(0.12))
            _at(self, b, 0.5)
            minimum = caption("the delay is a minimum, not an exact time")
            self.play(FadeIn(minimum), run_time=b.t(0.1))
            _at(self, b, 0.72)
            self.play(stack.pop(), run_time=b.t(0.06))
            self.play(run_next(q, stack), run_time=b.t(0.08))
            self.play(stack.pop(), clock.sweep(-100), run_time=b.t(0.08))

        with self.beat("code") as b:
            code = _code(_BLOCK_TIMER_CJS).move_to([0, 0, 0]).align_to([0, CONTENT_TOP, 0], UP)
            fname = _fname("block_timer.cjs", code)
            self.play(FadeOut(ask), FadeOut(minimum), FadeIn(code), FadeIn(fname), run_time=b.t(0.1))
            mk = mark_line(code, 1)
            cb = _ball().move_to(park())
            cb_lbl = T("callback", SMALL).next_to(cb, DOWN, buff=0.06)
            _at(self, b, 0.12)
            self.play(Create(mk), FadeIn(cb), FadeIn(cb_lbl), run_time=b.t(0.1))
            _at(self, b, 0.59)
            self.play(Transform(mk, mark_line(code, 3)), stack.push_cube("1 s loop", mono=False), run_time=b.t(0.1))
            self.play(clock.sweep(100), run_time=b.t(0.1))
            self.play(FadeOut(cb), FadeOut(cb_lbl), q.enqueue("callback", source=cb), run_time=b.t(0.06))

        with self.beat("run") as b:
            out = _code(_BLOCK_TIMER_OUT, language="text").move_to([0, 0, 0]).align_to([0, CONTENT_TOP, 0], UP)
            out.to_edge(LEFT, buff=MARGIN + 0.25)
            hide_lines(out)
            note = _ran_note("node v22.23.0;", "host runtime: ran at 1001 ms").next_to(out, RIGHT, buff=0.4)
            note.align_to(out, UP)
            self.play(clock.sweep(900), run_time=b.t(0.4))
            self.play(FadeOut(code), FadeOut(fname), FadeOut(mk), FadeIn(out), stack.pop(), run_time=b.t(0.1))
            self.play(reveal_lines(out, 0), run_time=b.t(0.06))
            self.play(run_next(q, stack), run_time=b.t(0.1))
            self.play(reveal_lines(out, 1), FadeIn(note), run_time=b.t(0.1))
            self.play(stack.pop(), run_time=b.t(0.06))

        with self.beat("limit") as b:
            limit_t = T("every action call has a time limit", BODY).move_to([0, 1.9, 0])
            big = VGroup(_small_clock(0.45), T("5 s", TITLE, TEXT, bold=True)).arrange(RIGHT, buff=0.3)
            big.move_to([0, 0.55, 0])
            src = lines("action time limit: DEFAULT_TIMEOUT_MS = 5_000",
                        "(deepwidgets/widgets/src/index.ts:33),",
                        "a setTimeout (index.ts:946-959)", size=SMALL, color=TEXT, mono=True, buff=0.1)
            src_card = VGroup(rbox(src.width + 0.4, src.height + 0.35, MUTED, fill=0.06, sw=2, r=0.1), src)
            src.move_to(src_card[0])
            tag = claim_tag("read")
            row = VGroup(src_card, tag).arrange(RIGHT, buff=0.3).move_to([0, -1.35, 0])
            self.play(FadeOut(out), FadeOut(note), FadeOut(stack), FadeOut(dial), FadeOut(q), run_time=b.t(0.08))
            _at(self, b, 0.12)
            self.play(FadeIn(limit_t), run_time=b.t(0.1))
            _at(self, b, 0.68)
            self.play(FadeIn(big, scale=0.8), FadeIn(row), run_time=b.t(0.14))

        with self.beat("keep") as b:
            keep = caption("that time limit is a timer too", color=TASK)
            self.play(FadeIn(keep), Indicate(big, color=TASK, scale_factor=1.1), run_time=b.t(0.35))


# ================================================================ microtasks
class Microtasks(DWScene):
    # weights = seconds between the pauses of audio-final/microtasks.wav (37.64 s)
    BEATS = [("line", 2.03), ("then", 8.22), ("rule", 8.42), ("jump", 3.53), ("puzzle", 7.15), ("output", 8.29)]

    def construct(self):
        stack, loop, mq, tq = _row(3)
        title = scene_title("The microtask queue", MICROTASK)
        legend = _legend(micro=True).move_to([4.3, 1.6, 0])

        with self.beat("line") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(stack), FadeIn(loop), FadeIn(tq),
                      run_time=b.t(0.2))
            self.play(stack.push("task"), tq.enqueue("task 2"), run_time=b.t(0.2))
            self.play(FadeIn(mq), FadeIn(legend), run_time=b.t(0.4))

        with self.beat("then") as b:
            settle = M("promise settles: its <b>.then</b> callback", BODY).move_to([-2.0, 1.9, 0])
            resume = M("code after <b>await</b> resumes", BODY).move_to([-2.0, 1.15, 0])
            resume.align_to(settle, LEFT)
            _at(self, b, 0.05)
            self.play(FadeIn(settle), run_time=b.t(0.08))
            self.play(mq.enqueue(".then"), run_time=b.t(0.08))
            _at(self, b, 0.58)
            self.play(FadeIn(resume), run_time=b.t(0.08))
            self.play(mq.enqueue("after await"), run_time=b.t(0.08))

        with self.beat("rule") as b:
            rule = T("after each task: every microtask, until the queue is empty", BODY)
            rule.move_to([0, 1.5, 0])
            self.play(FadeOut(settle), FadeOut(resume), FadeOut(legend), run_time=b.t(0.06))
            self.play(FadeIn(rule), run_time=b.t(0.08))
            _at(self, b, 0.17)
            self.play(stack.pop(), run_time=b.t(0.06))
            self.play(loop.turn(0.5), run_time=b.t(0.06))
            self.play(run_next(mq, stack), run_time=b.t(0.07))
            self.play(stack.pop(), run_time=b.t(0.05))
            self.play(run_next(mq, stack, label="await"), run_time=b.t(0.07))
            self.play(stack.pop(), run_time=b.t(0.05))
            _at(self, b, 0.76)
            self.play(loop.turn(0.5), run_time=b.t(0.06))
            self.play(run_next(tq, stack), run_time=b.t(0.08))
            self.play(stack.pop(), run_time=b.t(0.06))

        with self.beat("jump") as b:
            jump = caption("the microtask queue jumps ahead of the task queue", color=MICROTASK)
            self.play(FadeIn(jump), Indicate(mq.tray, color=MICROTASK, scale_factor=1.05), run_time=b.t(0.3))

        with self.beat("puzzle") as b:
            code = _code(_ORDER_CJS).to_edge(LEFT, buff=MARGIN + 0.25).align_to([0, CONTENT_TOP, 0], UP)
            fname = _fname("order.cjs", code)
            out = _code(_ORDER_OUT, language="text").next_to(code, RIGHT, buff=0.5).align_to(code, UP)
            hide_lines(out)
            credit = _credit('Jake Archibald, "Tasks, microtasks,', 'queues and schedules" (2015)',
                             color=MICROTASK).next_to(code, DOWN, buff=0.25).align_to(code, LEFT)
            self.play(FadeOut(rule), FadeOut(jump), FadeIn(code), FadeIn(fname), FadeIn(out),
                      run_time=b.t(0.08))
            self.play(stack.push_cube("sync code", mono=False), run_time=b.t(0.06))
            mk = mark_line(code, 0)
            _at(self, b, 0.24)
            self.play(Create(mk), reveal_lines(out, 0), run_time=b.t(0.08))
            _at(self, b, 0.44)
            self.play(Transform(mk, mark_line(code, 1)), tq.enqueue("timer"), run_time=b.t(0.08))
            _at(self, b, 0.63)
            self.play(Transform(mk, mark_line(code, 2)), mq.enqueue("promise", color=MICROTASK), run_time=b.t(0.08))
            _at(self, b, 0.85)
            self.play(Transform(mk, mark_line(code, 3)), reveal_lines(out, 1), run_time=b.t(0.08))

        with self.beat("output") as b:
            note = _ran_note("node and Electron:", "same output").next_to(out, RIGHT, buff=0.4).align_to(out, UP)
            if note.get_right()[0] > FRAME_W / 2 - MARGIN:
                note.next_to(out, DOWN, buff=0.25).align_to(out, LEFT)
            self.play(FadeOut(mk), stack.pop(), run_time=b.t(0.06))
            self.play(loop.turn(0.5), run_time=b.t(0.06))
            self.play(run_next(mq, stack), run_time=b.t(0.08))
            self.play(reveal_lines(out, 2), run_time=b.t(0.05))
            self.play(stack.pop(), run_time=b.t(0.05))
            self.play(loop.turn(0.5), run_time=b.t(0.06))
            self.play(run_next(tq, stack), run_time=b.t(0.08))
            self.play(reveal_lines(out, 3), FadeIn(note), run_time=b.t(0.06))
            self.play(stack.pop(), run_time=b.t(0.05))
            _at(self, b, 0.55)
            self.play(Indicate(out.code_lines[2], color=MICROTASK, scale_factor=1.15), FadeIn(credit),
                      run_time=b.t(0.15))


# ================================================================ blocking
class Blocking(DWScene):
    # weights = seconds between the pauses of audio-final/blocking.wav (31.96 s)
    BEATS = [("price", 2.59), ("hold", 8.74), ("count", 6.45), ("slices", 4.87), ("node", 6.93), ("forever", 2.38)]

    def construct(self):
        stack, loop, mq, tq = _row(4)

        with self.beat("price") as b:
            title = scene_title("Blocking", STACK)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(stack), FadeIn(loop), FadeIn(mq), FadeIn(tq),
                      run_time=b.t(0.4))

        with self.beat("hold") as b:
            define = T("one piece of code holds the call stack for a long time", BODY).move_to([0, 1.9, 0])
            self.play(FadeIn(define), run_time=b.t(0.08))
            self.play(stack.push_cube("count to 1e9", mono=False), run_time=b.t(0.1))
            self.play(loop.freeze(), run_time=b.t(0.06))
            _at(self, b, 0.5)
            for lbl in ("task 1", "task 2", "task 3"):
                self.play(tq.enqueue(lbl), run_time=b.t(0.05))
            for _ in range(2):
                self.play(mq.enqueue(None), run_time=b.t(0.05))
            self.play(Indicate(loop, color=MUTED, scale_factor=1.1), run_time=b.t(0.1))

        with self.beat("count") as b:
            credit = _credit("count to 1e9, then slices:", "Ilya Kantor, javascript.info").move_to([0, 1.0, 0])
            self.play(FadeIn(credit), run_time=b.t(0.12))
            _at(self, b, 0.69)
            freeze = caption("the page freezes until the count ends")
            self.play(FadeIn(freeze), run_time=b.t(0.1))

        with self.beat("slices") as b:
            fix = caption("fix: cut the work into slices, a timer between them", color=LOOP)
            self.play(stack.pop(), loop.thaw(), FadeOut(freeze), FadeIn(fix), run_time=b.t(0.08))
            self.play(loop.turn(0.5), run_next(mq, stack), run_time=b.t(0.07))
            self.play(stack.pop(), run_time=b.t(0.04))
            self.play(run_next(mq, stack), run_time=b.t(0.07))
            self.play(stack.pop(), run_time=b.t(0.04))
            for i in range(3):
                self.play(stack.push_cube("slice", slots=1, mono=False), run_time=b.t(0.05))
                self.play(stack.pop(), run_time=b.t(0.04))
                self.play(loop.turn(0.5), run_next(tq, stack), run_time=b.t(0.07))
                self.play(stack.pop(), run_time=b.t(0.04))

        with self.beat("node") as b:
            credit2 = _credit('Node.js guide,', '"Don\'t Block the Event Loop"', color=LOOP).move_to([0, 1.0, 0])
            short = caption("each callback must stay short", color=LOOP)
            self.play(FadeOut(credit), FadeOut(define), FadeOut(fix), FadeIn(credit2), run_time=b.t(0.1))
            _at(self, b, 0.66)
            self.play(FadeIn(short), run_time=b.t(0.08))
            self.play(stack.push_cube("short", slots=1, mono=False), run_time=b.t(0.06))
            self.play(stack.pop(), loop.turn(0.5), run_time=b.t(0.08))

        with self.beat("forever") as b:
            ever = caption("a loop that never ends blocks forever", color=ISOLATION)
            self.play(FadeOut(short), FadeIn(ever), stack.push_cube("endless loop", mono=False), run_time=b.t(0.2))
            self.play(loop.freeze(), tq.enqueue("task 4"), run_time=b.t(0.15))


# ================================================================ block_widgets
class BlockWidgets(DWScene):
    # weights = seconds between the pauses of audio-final/block_widgets.wav (38.76 s)
    BEATS = [("share", 6.84), ("stop", 8.89), ("limit", 8.03), ("race", 6.23), ("alive", 5.46), ("close", 3.31)]

    def construct(self):
        y = -1.5
        host = _host_frame(-6.6, 4.35, -2.8, 2.45)
        stack = CallStack(width=2.4, max_frames=4)
        stack.shift(_base_at(stack, -4.9, -2.15))
        lane_lbl = T("main thread", LABEL, HOST, bold=True).next_to(stack.room, UP, buff=0.1)
        loop = LoopArrow(radius=0.5).move_to([-2.45, y + 0.1, 0])
        tq = LoopQueue("task queue", TASK, width=3.9, shape="ball", gap=0.3).move_to([2.1, y, 0])
        chips = {n: chip(n, WIDGET) for n in ("spinner", "pinger", "sample")}
        for n, x in zip(("spinner", "pinger", "sample"), (-1.5, 0.5, 2.5)):
            chips[n].move_to([x, 1.3, 0])
        title = scene_title("One thread for every widget", WIDGET)

        with self.beat("share") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(host), FadeIn(stack), FadeIn(lane_lbl),
                      FadeIn(loop), FadeIn(tq), run_time=b.t(0.15))
            self.play(LaggedStart(*[FadeIn(c) for c in chips.values()], lag_ratio=0.3), run_time=b.t(0.12))
            _at(self, b, 0.66)
            sp = chips["spinner"]
            self.play(sp.animate.move_to(stack.room).set_opacity(0), stack.push_cube("spinner", mono=False),
                      run_time=b.t(0.15))
            self.play(loop.freeze(), run_time=b.t(0.1))

        with self.beat("stop") as b:
            for n, at in (("pinger", 0.04), ("sample", 0.17)):
                _at(self, b, at)
                c = chips[n]
                self.play(FadeOut(c), tq.enqueue(n, source=c), run_time=b.t(0.1))
            calls = VGroup(*[VGroup(_ball(TASK), T("window call", SMALL)).arrange(DOWN, buff=0.06)
                             for _ in range(2)]).arrange(DOWN, buff=0.25).move_to([5.55, -1.1, 0])
            inf = claim_tag("inferred").next_to(calls, UP, buff=0.2)
            _at(self, b, 0.5)
            self.play(FadeIn(calls, shift=LEFT * 0.3), FadeIn(inf), run_time=b.t(0.12))
            _at(self, b, 0.81)
            self.play(tq.enqueue("timer"), run_time=b.t(0.08))
            nofire = _cross().next_to(tq.items[-1], UP, buff=0.05)
            self.play(FadeIn(nofire, scale=1.4), run_time=b.t(0.06))

        with self.beat("limit") as b:
            code = _code(_RACE_CJS).move_to([0, 0, 0]).align_to([0, CONTENT_TOP, 0], UP)
            fname = _fname("race_timeout.cjs", code)
            scene_objs = VGroup(host, stack, lane_lbl, loop, tq, calls, inf, nofire)
            self.play(FadeOut(scene_objs), FadeIn(code), FadeIn(fname), run_time=b.t(0.1))
            mk = mark_line(code, 2)
            _at(self, b, 0.14)
            self.play(Create(mk), run_time=b.t(0.08))
            _at(self, b, 0.72)
            self.play(Transform(mk, mark_line(code, 4)), run_time=b.t(0.08))

        with self.beat("race") as b:
            out = _code(_RACE_OUT, language="text").move_to([0, 1.4, 0])
            hide_lines(out)
            note = _ran_note("node v22.23.0; host runtime:", "1000 ms and 1001 ms").next_to(out, DOWN, buff=0.35)
            note.align_to(out, LEFT)
            self.play(Transform(mk, mark_line(code, 7)), run_time=b.t(0.08))
            _at(self, b, 0.14)
            self.play(FadeOut(code), FadeOut(fname), FadeOut(mk), FadeIn(out), run_time=b.t(0.1))
            _at(self, b, 0.33)
            self.play(reveal_lines(out, 0), run_time=b.t(0.1))
            self.play(reveal_lines(out, 1), FadeIn(note), run_time=b.t(0.1))
            _at(self, b, 0.62)
            wins = caption("the 1 s loop wins: the 100 ms time limit fires late", color=STACK)
            self.play(FadeIn(wins), run_time=b.t(0.1))

        with self.beat("alive") as b:
            self.play(FadeOut(out), FadeOut(note), FadeOut(wins), FadeIn(host), FadeIn(stack), FadeIn(lane_lbl),
                      FadeIn(loop), FadeIn(tq), FadeIn(calls), FadeIn(inf), FadeIn(nofire), run_time=b.t(0.15))
            idle = caption("host alive, main thread does no work for anyone")
            _at(self, b, 0.3)
            self.play(FadeIn(idle), Indicate(host.box, color=HOST, scale_factor=1.02), run_time=b.t(0.2))

        with self.beat("close") as b:
            OutlineDiagram(self).close_part(self, "widget_code", next_key="notice", run_time=b.left)
