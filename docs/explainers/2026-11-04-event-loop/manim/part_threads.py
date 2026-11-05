"""part_threads: the worker thread, shared memory, the heartbeat
(script scenes `worker_thread` `shared_memory` `heartbeat`).

Opens on the outline at `endless_loop` (also `notice`), closes there and lights `find_who`.

Code cards are the real snippets of `sources.runs` (`worker_heap.cjs`, `message_waits.cjs`).
Lines longer than about 72 characters do not fit at the least font size, so the cards wrap the
same tokens (part_loop pattern). `heartbeat.cjs` has 22 lines, too many for one card: the scene
shows its real output, with the file name. Outputs are the real outputs of runs.log.

Credit chips drop title words that the viewer has not met yet (`watchdog`, `SharedArrayBuffers`),
as part_loop does for `macrotasks` and `Worker Pool`.

Beat weights are seconds of the final audio where it exists: each beat starts at the pause
before its sentence (ffmpeg silencedetect). The base scales them to the audio length.
"""
from dwscene import *

# ---------------------------------------------------------------- real code and outputs
_WORKER_HEAP_CJS = """\
const { Worker } = require('node:worker_threads')
globalThis.owner = 'main'
const w = new Worker("globalThis.owner = 'worker';
  require('node:worker_threads').parentPort
  .postMessage(globalThis.owner)", { eval: true })
w.on('message', (m) => console.log('worker sees:', m,
  '| main sees:', globalThis.owner))"""

_WORKER_HEAP_OUT = "worker sees: worker | main sees: main"

_MESSAGE_WAITS_CJS = """\
const { Worker } = require('node:worker_threads')
const t0 = Date.now()
const w = new Worker("require('node:worker_threads').parentPort
  .postMessage('hello from the worker')", { eval: true })
w.on('message', (m) => console.log('main got', JSON.stringify(m),
  'at', Date.now() - t0, 'ms'))
setTimeout(() => {
  console.log('main loop starts at', Date.now() - t0, 'ms')
  while (Date.now() - t0 < 1000) {}
  console.log('main loop ends at', Date.now() - t0, 'ms')
}, 0)"""

_MESSAGE_WAITS_OUT = """\
main loop starts at 4 ms
main loop ends at 1000 ms
main got "hello from the worker" at 1000 ms"""

_HEARTBEAT_OUT = """\
main: loop starts at 305 ms
worker at 742 ms: no beat for 516 ms
worker at 1257 ms: no beat for 1031 ms
main: loop ends at 1800 ms
main: done at 2105 ms"""


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
    """A credit card: one or two grey lines in a thin box (part_loop pattern)."""
    t = lines(*ls, size=SMALL, color=MUTED, buff=0.08)
    box = rbox(t.width + 0.4, t.height + 0.3, color, fill=0.06, sw=2, r=0.1)
    t.move_to(box)
    return VGroup(box, t)


def _base_at(pile, x, y):
    """Shift vector that puts the pile's base line center at (x, y)."""
    return np.array([x, y, 0]) - pile.base.get_center()


def _host_frame(x0, x1, y0, y1):
    """The host box (a rounded frame in the host color) with its name at the top left (part_loop)."""
    box = rbox(x1 - x0, y1 - y0, HOST, fill=0.03, sw=3).move_to([(x0 + x1) / 2, (y0 + y1) / 2, 0])
    name = T("host", LABEL, HOST, bold=True)
    name.align_to(box, UP).align_to(box, LEFT).shift(DOWN * 0.14 + RIGHT * 0.25)
    g = VGroup(box, name)
    g.box, g.name = box, name
    return g


def _lane(label, color, x0, x1, y0, y1, dashed=False):
    """A thread lane: a band in the thread color with its name at the top left. .band .label"""
    band = rbox(x1 - x0, y1 - y0, color, fill=0.07, sw=2.5, r=0.12, dashed=dashed)
    band.move_to([(x0 + x1) / 2, (y0 + y1) / 2, 0])
    lbl = T(label, LABEL, color, bold=True) if label else VGroup()
    if label:
        lbl.align_to(band, UP).align_to(band, LEFT).shift(DOWN * 0.14 + RIGHT * 0.22)
    g = VGroup(band, lbl)
    g.band, g.label = band, lbl
    return g


def _heap_box(w=3.0, h=1.25):
    """A small heap area: a box in the heap color with its name and two objects."""
    box = rbox(w, h, HEAP, fill=0.06, sw=2.5)
    name = T("heap", LABEL, HEAP, bold=True)
    name.align_to(box, UP).align_to(box, LEFT).shift(DOWN * 0.12 + RIGHT * 0.2)
    objs = VGroup(*[RoundedRectangle(corner_radius=0.06, width=0.45, height=0.3, stroke_color=HEAP,
                                     stroke_width=2, fill_color=HEAP, fill_opacity=0.35) for _ in range(2)])
    objs.arrange(RIGHT, buff=0.25).move_to(box).shift(DOWN * 0.18 + RIGHT * 0.3)
    g = VGroup(box, name, objs)
    g.box = box
    return g


def _loop(center, radius=0.36):
    """The loop arrow with its name at the right, its ring centered on `center`. A turning arrow
    with the tip sweeps a circle of about radius + 0.5, so the name under it would need a taller lane."""
    loop = LoopArrow(radius=radius, title=None)
    loop.shift(np.array(center) - loop.center_point)
    lbl = T("event loop", LABEL, LOOP, bold=True).next_to(loop.arc, RIGHT, buff=0.3)
    lbl.set_y(loop.center_point[1])
    loop.title = lbl
    loop.add(lbl)
    return loop


def _thread_parts(lane, color_title=True):
    """Call stack, event loop and heap placed inside a lane band. Returns (stack, loop, heap)."""
    band = lane.band
    cy = band.get_y()
    stack = CallStack(width=2.5, frame_h=0.42, max_frames=2)
    stack.shift(_base_at(stack, band.get_left()[0] + 2.5, cy - 0.45))
    loop = _loop([band.get_left()[0] + 5.0, cy, 0])
    heap = _heap_box().move_to([band.get_right()[0] - 2.2, cy - 0.05, 0])
    return stack, loop, heap


def _arrow(start, end, color, double=False):
    """A short arrow that keeps its full stroke and tip."""
    cls = DoubleArrow if double else Arrow
    return cls(start, end, buff=0.06, color=color, stroke_width=4, tip_length=0.2,
               max_stroke_width_to_length_ratio=40, max_tip_length_to_length_ratio=0.45)


def _envelope(color=WORKER, w=0.62, h=0.42):
    """A message: a letter in the color of the thread that sent it."""
    body = Rectangle(width=w, height=h, stroke_color=color, stroke_width=2.5, fill_color=PANEL, fill_opacity=1)
    flap = VMobject(stroke_color=color, stroke_width=2.5).set_points_as_corners(
        [body.get_corner(UL), body.get_center() + DOWN * h * 0.1, body.get_corner(UR)])
    return VGroup(body, flap)


def _mailbox(color=HOST):
    """The queue of a thread, drawn as a mailbox: a box with a slot and its name under it."""
    box = rbox(1.2, 0.85, color, fill=0.08, sw=2.5, r=0.1)
    slot = Line(LEFT * 0.35, RIGHT * 0.35, stroke_color=color, stroke_width=4).move_to(box.get_top() + DOWN * 0.2)
    name = T("queue", SMALL, color).next_to(box, DOWN, buff=0.08)
    g = VGroup(box, slot, name)
    g.box = box
    return g


class _Strip(VGroup):
    """Shared memory: one strip of two cells. .cells .vals .name; set(i, text) returns an animation."""

    def __init__(self, name="SharedArrayBuffer", cell_w=0.95, cell_h=0.62, values=("0", "0")):
        super().__init__()
        self.cells = VGroup(*[Rectangle(width=cell_w, height=cell_h, stroke_color=HEARTBEAT, stroke_width=3,
                                        fill_color=HEARTBEAT, fill_opacity=0.12) for _ in values])
        self.cells.arrange(RIGHT, buff=0)
        self.vals = VGroup(*[T(v, BODY, TEXT, mono=True).move_to(c) for v, c in zip(values, self.cells)])
        self.name = T(name, SMALL, HEARTBEAT, mono=True) if name else VGroup()
        if name:
            self.name.next_to(self.cells, UP, buff=0.1)
        self.add(self.cells, self.vals, self.name)

    def set(self, i, text, color=TEXT) -> Animation:
        new = T(text, BODY, color, mono=True).move_to(self.cells[i])
        return Transform(self.vals[i], new)


def _person(color, s=1.0):
    """A simple person: a head and the top of a body."""
    head = Circle(radius=0.26 * s, stroke_color=color, stroke_width=3, fill_color=color, fill_opacity=0.3)
    body = Arc(radius=0.45 * s, start_angle=0, angle=PI, stroke_color=color, stroke_width=3)
    body.next_to(head, DOWN, buff=0.06)
    return VGroup(head, body)


def _desk(person_color, label, w=3.2):
    """One person at a private desk, with a small heap on the desk."""
    p = _person(person_color)
    top = Line(LEFT * w / 2, RIGHT * w / 2, stroke_color=TEXT, stroke_width=4)
    top.next_to(p, DOWN, buff=0.02)
    p.shift(LEFT * 0.7)
    legs = VGroup(*[Line(top.get_left() + RIGHT * 0.2 + d * RIGHT * (w - 0.4), top.get_left() + RIGHT * 0.2
                         + d * RIGHT * (w - 0.4) + DOWN * 0.6, stroke_color=TEXT, stroke_width=3) for d in (0, 1)])
    paper = chip("heap", HEAP, mono=False, fill=0.15).next_to(top, UP, buff=0.04)
    paper.align_to(top, RIGHT).shift(LEFT * 0.15)
    name = T(label, LABEL, person_color, bold=True).next_to(legs, DOWN, buff=0.15)
    return VGroup(p, top, legs, paper, name)


def _pulse_path(x0, y0, x_end, beats, unit, amp=0.6, w=0.12):
    """Points of a pulse line from x0 to x_end: a spike at each beat x in `beats` (scene units)."""
    pts = [np.array([x0, y0, 0])]
    for bx in beats:
        if bx - w < pts[-1][0] or bx + w > x_end:
            continue
        pts += [np.array([bx - w, y0, 0]), np.array([bx - w / 3, y0 + amp, 0]),
                np.array([bx + w / 3, y0 - amp * 0.35, 0]), np.array([bx + w, y0, 0])]
    pts.append(np.array([x_end, y0, 0]))
    return pts


def _pulse(x0, y0, x_end, beats, color=HEARTBEAT, sw=4, **kw):
    return VMobject(stroke_color=color, stroke_width=sw).set_points_as_corners(
        _pulse_path(x0, y0, x_end, beats, None, **kw))


# ================================================================ worker_thread
class WorkerThread(DWScene):
    # weights = seconds between the pauses of audio-final/worker_thread.wav (37.96 s)
    BEATS = [("open", 2.6), ("frozen", 6.71), ("worker", 11.03), ("heapq", 7.82), ("run", 5.86), ("desks", 3.94)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram(self).open_part(self, "endless_loop", also=("notice",), run_time=b.left)

        title = scene_title("A second thread", WORKER)
        host = _host_frame(-6.6, 6.6, -2.85, 2.9)
        main = _lane("main thread", HOST, -6.35, 6.35, 0.1, 2.4)
        work = _lane("worker thread", WORKER, -6.35, 6.35, -2.65, -0.35)
        m_stack, m_loop, m_heap = _thread_parts(main)
        w_stack, w_loop, w_heap = _thread_parts(work)
        hole = _lane("", MUTED, -6.35, 6.35, -2.65, -0.35, dashed=True)
        q = T("?", HEADING, MUTED, bold=True).move_to(hole.band)

        with self.beat("frozen") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(host), FadeIn(main), FadeIn(m_stack),
                      FadeIn(m_loop), FadeIn(m_heap), run_time=b.t(0.15))
            self.play(m_stack.push_cube("endless loop", mono=False), run_time=b.t(0.1))
            self.play(m_loop.freeze(), run_time=b.t(0.08))
            cap = caption("the main thread cannot notice its own freeze")
            _at(self, b, 0.35)
            self.play(FadeIn(cap), run_time=b.t(0.1))
            _at(self, b, 0.68)
            self.play(FadeIn(hole), FadeIn(q), run_time=b.t(0.12))

        with self.beat("worker") as b:
            self.play(FadeOut(hole), FadeOut(q), FadeOut(cap), FadeIn(work), run_time=b.t(0.08))
            same = caption("a second JavaScript thread, same process")
            self.play(FadeIn(same), run_time=b.t(0.05))
            for m, at in ((w_stack, 0.36), (w_heap, 0.48), (w_loop, 0.57)):
                _at(self, b, at)
                self.play(FadeIn(m, scale=0.9), run_time=b.t(0.06))
            _at(self, b, 0.7)
            runs = caption("it keeps running while the main thread is stuck", color=WORKER)
            self.play(FadeOut(same), FadeIn(runs), run_time=b.t(0.05))
            for _ in range(2):
                self.play(w_stack.push(None), w_loop.turn(0.5), run_time=b.t(0.04))
                self.play(w_stack.pop(), w_loop.turn(0.5), run_time=b.t(0.04))
            self.play(Indicate(m_stack.top, color=MUTED, scale_factor=1.04), run_time=b.t(0.05))

        with self.beat("heapq") as b:
            card_txt = VGroup(T("asked:", SMALL, MUTED),
                              lines("does each thread", "have its own heap?", size=SMALL)).arrange(
                DOWN, buff=0.1, aligned_edge=LEFT)
            card = VGroup(rbox(card_txt.width + 0.5, card_txt.height + 0.4, MUTED, fill=0.08, sw=2), card_txt)
            card_txt.move_to(card[0])
            card.to_edge(RIGHT, buff=MARGIN).set_y(1.75)
            lane_objs = VGroup(host, main, work, m_stack, m_loop, m_heap, w_stack, w_loop, w_heap)
            self.play(FadeOut(lane_objs), FadeOut(runs), run_time=b.t(0.1))
            self.play(FadeIn(card, shift=LEFT * 0.4), run_time=b.t(0.08))
            self.play(card.animate.move_to([0, 2.25, 0]), run_time=b.t(0.08))

            # left: threads of one process share one heap
            os_t = T("OS threads", BODY, TEXT, bold=True).move_to([-3.4, 1.05, 0])
            th = VGroup(*[chip("thread", TEXT, mono=False) for _ in range(2)]).arrange(RIGHT, buff=1.0)
            th.move_to([-3.4, 0.25, 0])
            one = rbox(3.6, 0.8, HEAP, fill=0.1, sw=2.5).move_to([-3.4, -1.05, 0])
            one_t = T("one shared heap", LABEL, HEAP, bold=True).move_to(one)
            arr_l = VGroup(*[_arrow(t.get_bottom(), one.get_top(), HEAP) for t in th])
            # right: a Node worker thread has its own heap
            nd_t = T("Node worker thread", BODY, TEXT, bold=True).move_to([3.4, 1.05, 0])
            mt = chip("main thread", HOST, mono=False).move_to([2.0, 0.25, 0])
            wt = chip("worker thread", WORKER, mono=False).move_to([4.85, 0.25, 0])
            hs = VGroup(*[rbox(2.2, 0.8, HEAP, fill=0.1, sw=2.5).move_to([x, -1.05, 0]) for x in (2.0, 4.85)])
            hs_t = VGroup(*[T("own heap", LABEL, HEAP, bold=True).move_to(h) for h in hs])
            arr_r = VGroup(*[_arrow(t.get_bottom(), h.get_top(), HEAP) for t, h in zip((mt, wt), hs)])
            credit = _credit('threads share the heap, processes do not:',
                             'Coding Shuttle, "Threads vs Processes"').move_to([-3.4, -2.3, 0])
            _at(self, b, 0.27)
            self.play(FadeIn(os_t), FadeIn(th), run_time=b.t(0.08))
            self.play(GrowArrow(arr_l[0]), GrowArrow(arr_l[1]), FadeIn(one), FadeIn(one_t), FadeIn(credit),
                      run_time=b.t(0.1))
            _at(self, b, 0.73)
            self.play(FadeIn(nd_t), FadeIn(mt), FadeIn(wt), run_time=b.t(0.08))
            self.play(GrowArrow(arr_r[0]), GrowArrow(arr_r[1]), FadeIn(hs), FadeIn(hs_t), run_time=b.t(0.1))

        with self.beat("run") as b:
            code = _code(_WORKER_HEAP_CJS).move_to([0, 0, 0]).align_to([0, CONTENT_TOP, 0], UP)
            fname = _fname("worker_heap.cjs", code)
            diag = VGroup(card, os_t, th, one, one_t, arr_l, nd_t, mt, wt, hs, hs_t, arr_r, credit)
            self.play(FadeOut(diag), FadeIn(code), FadeIn(fname), run_time=b.t(0.12))
            mk = mark_line(code, 1, color=HOST)
            self.play(Create(mk), run_time=b.t(0.08))
            mk2 = mark_line(code, 2, color=WORKER)
            self.play(Create(mk2), run_time=b.t(0.08))
            out = _code(_WORKER_HEAP_OUT, language="text").next_to(code, DOWN, buff=0.4).align_to(code, LEFT)
            note = _ran_note("node v22.23.0 and", "host runtime: same").next_to(out, RIGHT, buff=0.45)
            note.align_to(out, UP)
            _at(self, b, 0.52)
            self.play(FadeIn(out, shift=UP * 0.15), FadeIn(note), run_time=b.t(0.12))

        with self.beat("desks") as b:
            out_top = out.copy().move_to([0, 2.3, 0])
            d1 = _desk(HOST, "main thread").move_to([-3.0, -0.35, 0])
            d2 = _desk(WORKER, "worker thread").move_to([3.0, -0.35, 0])
            credit2 = _credit('two people, private desks:', 'Lin Clark, Mozilla Hacks (2017)').move_to([0, -2.35, 0])
            self.play(FadeOut(code), FadeOut(fname), FadeOut(mk), FadeOut(mk2), FadeOut(note),
                      Transform(out, out_top), run_time=b.t(0.12))
            self.play(FadeIn(d1, shift=UP * 0.2), FadeIn(d2, shift=UP * 0.2), FadeIn(credit2), run_time=b.t(0.15))


# ================================================================ shared_memory
class SharedMemory(DWScene):
    # weights = seconds between the pauses of audio-final/shared_memory.wav (38.44 s)
    BEATS = [("talk", 10.57), ("run", 5.63), ("shared", 12.24), ("race", 3.56), ("atomic", 6.44)]

    def construct(self):
        title = scene_title("Shared memory", HEARTBEAT)
        main = _lane("main thread", HOST, -6.6, 6.6, 0.95, 2.85)
        work = _lane("worker thread", WORKER, -6.6, 6.6, -2.85, -0.95)
        stack = CallStack(width=2.2, frame_h=0.5, max_frames=1)
        stack.shift(_base_at(stack, -2.6, 1.5))
        box = _mailbox().move_to([-0.2, 2.0, 0])
        w_loop = _loop([-3.6, -1.9, 0], radius=0.3)
        letter = _envelope().move_to([-0.2, -1.85, 0])

        with self.beat("talk") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(main), FadeIn(work), FadeIn(stack),
                      FadeIn(w_loop), run_time=b.t(0.1))
            _at(self, b, 0.22)
            self.play(FadeIn(box), FadeIn(letter, scale=0.8), run_time=b.t(0.07))
            copy = letter.copy()
            self.play(copy.animate.move_to(box.box.get_center()), run_time=b.t(0.1))
            cp = T("copy", SMALL, WORKER).next_to(box.box, RIGHT, buff=0.25)
            self.play(FadeIn(cp), run_time=b.t(0.05))
            _at(self, b, 0.68)
            self.play(stack.push_cube("1 s loop", mono=False), run_time=b.t(0.08))
            waits = caption("the message waits: the main thread is stuck")
            self.play(FadeIn(waits), Indicate(copy, color=WORKER, scale_factor=1.15), run_time=b.t(0.1))
            for _ in range(2):
                self.play(w_loop.turn(), run_time=b.t(0.04))

        with self.beat("run") as b:
            pic = VGroup(main, work, stack, box, w_loop, letter, copy, cp)
            code = _code(_MESSAGE_WAITS_CJS).move_to([0, 0, 0]).align_to([0, CONTENT_TOP, 0], UP)
            fname = _fname("message_waits.cjs", code)
            out = _code(_MESSAGE_WAITS_OUT, language="text").next_to(code, DOWN, buff=0.2).align_to(code, LEFT)
            hide_lines(out)
            note = claim_tag("ran").next_to(out, RIGHT, buff=0.4).align_to(out, UP)
            self.play(FadeOut(pic), FadeOut(waits), FadeIn(code), FadeIn(fname), FadeIn(out), FadeIn(note),
                      run_time=b.t(0.1))
            mk = mark_line(code, 8)
            self.play(Create(mk), reveal_lines(out, 0), run_time=b.t(0.1))
            _at(self, b, 0.45)
            self.play(reveal_lines(out, 1), run_time=b.t(0.08))
            _at(self, b, 0.6)
            self.play(Transform(mk, mark_line(code, 4)), reveal_lines(out, 2), run_time=b.t(0.1))
            self.play(Indicate(out.code_lines[2], color=WORKER, scale_factor=1.05), run_time=b.t(0.12))

        with self.beat("shared") as b:
            strip = _Strip(name=None).move_to([1.9, 0.0, 0])
            sab = T("SharedArrayBuffer", SMALL, HEARTBEAT, mono=True).next_to(strip, RIGHT, buff=0.25)
            self.play(FadeOut(code), FadeOut(fname), FadeOut(out), FadeOut(note), FadeOut(mk),
                      FadeIn(pic), run_time=b.t(0.08))
            self.play(FadeIn(strip, scale=0.9), FadeIn(sab), run_time=b.t(0.08))
            a_main = _arrow([1.9, main.band.get_bottom()[1], 0], strip.cells.get_top(), HOST, double=True)
            a_work = _arrow([1.9, work.band.get_top()[1], 0], strip.cells.get_bottom(), WORKER, double=True)
            rw = T("read and write", SMALL, MUTED).next_to(strip, LEFT, buff=0.35)
            _at(self, b, 0.2)
            self.play(GrowArrow(a_main), GrowArrow(a_work), FadeIn(rw), run_time=b.t(0.1))
            _at(self, b, 0.49)
            nocopy = caption("no copy, no queue", color=HEARTBEAT)
            self.play(FadeIn(nocopy), run_time=b.t(0.06))
            _at(self, b, 0.7)
            self.play(Indicate(stack.top, color=MUTED, scale_factor=1.04), run_time=b.t(0.06))
            for _ in range(2):
                dot = Dot(strip.cells[0].get_center(), radius=0.09, color=WORKER)
                self.play(dot.animate.move_to([1.9, work.band.get_top()[1] - 0.35, 0]),
                          w_loop.turn(0.5), run_time=b.t(0.07))
                self.remove(dot)

        with self.beat("race") as b:
            pic2 = VGroup(pic, strip, sab, a_main, a_work, rw)
            hm = T("main thread", LABEL, HOST, bold=True).move_to([-4.0, 2.3, 0])
            hw = T("worker thread", LABEL, WORKER, bold=True).move_to([4.0, 2.3, 0])
            cell = _Strip(name="one number", values=("0",)).move_to([0, 2.15, 0])
            ys = [1.2, 0.45, -0.3, -1.05]
            steps = [("read 0", HOST, -4.0), ("read 0", WORKER, 4.0), ("write 0 + 1", HOST, -4.0),
                     ("write 0 + 1", WORKER, 4.0)]
            rows = [chip(t, c, mono=True).move_to([x, y, 0]) for (t, c, x), y in zip(steps, ys)]
            self.play(FadeOut(pic2), FadeOut(nocopy), FadeIn(hm), FadeIn(hw), FadeIn(cell), run_time=b.t(0.12))
            self.play(FadeIn(rows[0], shift=DOWN * 0.1), run_time=b.t(0.12))
            self.play(FadeIn(rows[1], shift=DOWN * 0.1), run_time=b.t(0.12))
            self.play(FadeIn(rows[2], shift=DOWN * 0.1), cell.set(0, "1"), run_time=b.t(0.12))
            self.play(FadeIn(rows[3], shift=DOWN * 0.1), cell.set(0, "1"), run_time=b.t(0.12))
            lost = caption("two adds, but the number is 1: one add is lost", color=ISOLATION)
            self.play(FadeIn(lost), Indicate(cell.vals[0], color=ISOLATION, scale_factor=1.4), run_time=b.t(0.12))

        with self.beat("atomic") as b:
            cell2 = _Strip(name="shared counter", values=("0",)).move_to([0, 2.15, 0])
            one = [chip("add 1, one step", c, mono=False).move_to([x, y, 0])
                   for (c, x), y in zip(((HOST, -4.0), (WORKER, 4.0)), (1.2, 0.45))]
            self.play(FadeOut(VGroup(*rows)), FadeOut(lost), FadeOut(cell), FadeIn(cell2), run_time=b.t(0.08))
            _at(self, b, 0.35)
            self.play(FadeIn(one[0], shift=DOWN * 0.1), cell2.set(0, "1"), run_time=b.t(0.08))
            self.play(FadeIn(one[1], shift=DOWN * 0.1), cell2.set(0, "2"), run_time=b.t(0.08))
            ok = caption("one step that the other thread cannot split", color=HEARTBEAT)
            api = VGroup(chip("Atomics.add", MUTED), chip("Atomics.load", MUTED)).arrange(RIGHT, buff=0.4)
            api.move_to([0, -0.75, 0])
            credit = _credit("lost update and the indivisible step:", "Lin Clark, Mozilla Hacks (2017)")
            credit.move_to([0, -2.1, 0])
            _at(self, b, 0.6)
            self.play(FadeIn(ok), FadeIn(api), run_time=b.t(0.1))
            self.play(FadeIn(credit), run_time=b.t(0.08))


# ================================================================ heartbeat
class Heartbeat(DWScene):
    # weights = seconds between the pauses of audio-final/heartbeat.wav (41.6 s)
    BEATS = [("trick", 9.23), ("look", 6.74), ("wiki", 14.89), ("run", 8.74), ("close", 2.0)]

    def construct(self):
        title = scene_title("The heartbeat", HEARTBEAT)
        main = _lane("main thread", HOST, -6.6, -0.9, 0.85, 2.85)
        work = _lane("worker thread", WORKER, -6.6, -0.9, -2.8, -0.8)
        stack = CallStack(width=1.7, frame_h=0.4, max_frames=2)
        stack.shift(_base_at(stack, -2.2, 1.42))
        strip = _Strip(name=None)
        strip.shift(np.array([-3.3, 0.02, 0]) - strip.cells[0].get_center())
        hb = T("heartbeat", LABEL, HEARTBEAT, bold=True).next_to(strip, LEFT, buff=0.3)
        beat_arrow = _arrow([-3.3, 0.85, 0], strip.cells[0].get_top(), HOST)
        beat_lbl = T("+1 every 100 ms", SMALL, HOST, mono=True).next_to(main.label, DOWN, buff=0.2)
        beat_lbl.align_to(main.label, LEFT)
        look_arrow = _arrow(strip.cells[0].get_bottom(), [-3.3, -0.8, 0], WORKER)
        look_lbl = T("look every 50 ms", SMALL, WORKER, mono=True).move_to([-3.3, -1.95, 0])
        eye = Dot([-3.3, -1.2, 0], radius=0.1, color=WORKER)

        # the pulse line, right half
        gx0, gx1, gy = -0.4, 6.4, 1.85
        g_lbl = T("heartbeat", SMALL, HEARTBEAT).move_to([gx0, 2.75, 0], aligned_edge=LEFT)

        with self.beat("trick") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(main), FadeIn(work), FadeIn(stack),
                      run_time=b.t(0.1))
            _at(self, b, 0.28)
            self.play(FadeIn(strip), GrowArrow(beat_arrow), FadeIn(beat_lbl), run_time=b.t(0.1))
            healthy = _pulse(gx0, gy, gx1, [gx0 + 0.6 + 0.85 * i for i in range(8)], amp=0.55)
            self.play(FadeIn(g_lbl), run_time=b.t(0.04))
            # three beats: the counter goes up, the pulse line grows
            seg = 1.0 / 8
            segs = [healthy.copy().pointwise_become_partial(healthy, i * seg, (i + 1) * seg) for i in range(6)]
            for i in range(3):
                self.play(strip.set(0, str(i + 1)), Flash(strip.cells[0], color=HOST, line_length=0.15),
                          Create(segs[i]), run_time=b.t(0.1))
            _at(self, b, 0.76)
            self.play(FadeIn(hb), Indicate(strip.cells[0], color=HEARTBEAT), run_time=b.t(0.12))

        with self.beat("look") as b:
            self.play(GrowArrow(look_arrow), FadeIn(look_lbl), FadeIn(eye), run_time=b.t(0.12))
            for i in range(3, 6):
                self.play(strip.set(0, str(i + 1)), Create(segs[i]),
                          Flash(eye, color=WORKER, line_length=0.12), run_time=b.t(0.1))
            _at(self, b, 0.45)
            stuck = caption("the number stops changing: the main thread is stuck", color=INFERRED)
            self.play(stack.push_cube("loop", mono=False), FadeIn(stuck), run_time=b.t(0.1))
            flat = Line([gx0 + 0.6 + 0.85 * 5.5, gy, 0], [gx1, gy, 0], stroke_color=ISOLATION, stroke_width=4)
            self.play(Create(flat), Flash(eye, color=ISOLATION, line_length=0.12), run_time=b.t(0.15))

        with self.beat("wiki") as b:
            credit = _credit("a timer that healthy code keeps resetting:", "Wikipedia, embedded systems").move_to(
                [3.0, -0.2, 0])
            self.play(FadeOut(stuck), run_time=b.t(0.08))
            _at(self, b, 0.15)
            self.play(FadeIn(credit), run_time=b.t(0.08))
            _at(self, b, 0.42)
            rec = caption("resets stop: recovery starts")
            self.play(FadeIn(rec), run_time=b.t(0.06))
            _at(self, b, 0.62)
            rep = caption("a missing beat is the report", color=HEARTBEAT)
            self.play(FadeOut(rec), FadeIn(rep), Indicate(flat, color=ISOLATION), run_time=b.t(0.1))

        with self.beat("run") as b:
            # the real run: pulse until 305 ms, flat until 1800 ms, pulse again to 2105 ms
            ms_x = lambda ms: gx0 + (gx1 - gx0) * ms / 2150  # noqa: E731
            beats_x = [ms_x(t) for t in (100, 200, 300, 1850, 1950, 2050)]
            before = _pulse(gx0, gy, ms_x(305), beats_x[:3], amp=0.55, w=0.1)
            after = _pulse(ms_x(1800), gy, ms_x(2105), beats_x[3:], amp=0.55, w=0.1)
            ticks = VGroup(*[Dot([ms_x(t), gy, 0], radius=0.09, color=WORKER) for t in (742, 1257)])
            out = _code(_HEARTBEAT_OUT, language="text")
            out.move_to([0, 0, 0]).align_to([gx0 - 0.1, 0, 0], LEFT).align_to([0, 0.95, 0], UP)
            hide_lines(out)
            fname = T("heartbeat.cjs", SMALL, MUTED, mono=True).next_to(out, UP, buff=0.12).align_to(out, LEFT)
            tag = claim_tag("ran").next_to(fname, RIGHT, buff=0.3)
            host_note = lines("node v22.23.0; host runtime:", "743 / 520 ms and 1260 / 1037 ms", size=SMALL,
                              color=MUTED, buff=0.06)
            host_note.next_to(out, DOWN, buff=0.15).align_to(out, LEFT)
            old = VGroup(*segs, flat, credit)
            self.play(FadeOut(old), FadeOut(rep), stack.pop(), run_time=b.t(0.07))
            self.play(FadeIn(out), FadeIn(fname), FadeIn(tag), run_time=b.t(0.05))
            self.play(Create(before), run_time=b.t(0.06))
            self.play(stack.push_cube("1.5 s loop", mono=False), reveal_lines(out, 0), run_time=b.t(0.06))
            # the pen runs along the flat line; the worker reports at 742 ms and 1257 ms.
            # Pen times follow the voice ("about five hundred", "then about one thousand").
            parts = [(305, 742, 0.26), (742, 1257, 0.16), (1257, 1800, 0.1)]
            for i, (t0, t1, frac) in enumerate(parts):
                piece = Line([ms_x(t0), gy, 0], [ms_x(t1), gy, 0], stroke_color=ISOLATION, stroke_width=4)
                self.play(Create(piece), rate_func=linear, run_time=b.t(frac))
                if i < 2:
                    self.play(FadeIn(ticks[i], scale=1.5), reveal_lines(out, i + 1),
                              Flash(eye, color=WORKER, line_length=0.12), run_time=b.t(0.05))
            self.play(stack.pop(), reveal_lines(out, 3), run_time=b.t(0.05))
            self.play(Create(after), reveal_lines(out, 4), FadeIn(host_note), run_time=b.t(0.06))

        with self.beat("close") as b:
            OutlineDiagram(self).close_part(self, "endless_loop", next_key="find_who",
                                            also=("notice", "f_worker_thread", "f_shared_memory"),
                                            run_time=b.left)
