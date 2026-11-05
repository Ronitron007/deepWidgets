"""Part `part_errors`: try_stack exception_vs_rejection emitter_handler uncaught_unhandled
process_handlers promise_not_process handler_vs_effect.

Errors, emitters, and process handlers. Opens on the outline at `notice` (also `late_error`),
closes there and lights `late_error`.

Code cards and outputs are the real snippets of `sources.runs` (`notes/script-v2/make_snippets.py`,
`runs.log`). Lines longer than about 70 characters do not fit at the least font size, so the cards
wrap the same tokens at statement or argument boundaries. The handler_vs_effect card is
`isolation.ts:370-375` with its two registry lines shown as `...`.

Beat weights are seconds of the final audio: each beat starts at the pause before its sentence
group (ffmpeg silencedetect). The base scales them to the audio length.
The scene class names do not shadow loopviz classes; the pile is imported as `_Pile` anyway.
"""
from dwscene import *
from loopviz import CallStack as _Pile

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content
_X1 = FRAME_W / 2 - MARGIN - 0.25    # right edge of content

# ---------------------------------------------------------------- real snippets (sources.runs)
_TRY_TIMER = """\
try {
  setTimeout(() => { throw new Error('late boom') }, 10)
  console.log('try block ends')
} catch (error) { console.log('caught:', error.message) }
console.log('script ends')"""

_TRY_AWAIT = """\
async function ping() {
  await new Promise((resolve) => setTimeout(resolve, 10))
  throw new Error('late boom')
}
async function main() {
  try { await ping() }
  catch (error) { console.log('caught after await:', error.message) }
  ping().catch((error) =>
    console.log('caught by .catch:', error.message))
}
main()"""

_EMIT_SYNC = """\
const { EventEmitter } = require('node:events')
const emitter = new EventEmitter()
emitter.on('ping', () => console.log('handler 1'))
emitter.on('ping', () => console.log('handler 2'))
console.log('before emit')
emitter.emit('ping')
console.log('after emit')"""

_REJECT_NONE = """\
Promise.reject(
  new Error('nobody waits for me'))
console.log('script ends')"""

_PROC_HANDLERS = """\
process.on('uncaughtException', (error, origin) =>
  console.log('process handler:', origin, '-', error.message))
setTimeout(() => { throw new Error('timer throw') }, 10)
Promise.reject(new Error('nobody waits'))
setTimeout(() => console.log('process still alive at the end'), 50)"""

_PROC_OUT = ("process handler: unhandledRejection - nobody waits",
             "process handler: uncaughtException - timer throw",
             "process still alive at the end")

_ISO_EFFECT = """\
ctx.effect(() => {
  ...
  hooks.add(claim)
  return () => { hooks.delete(claim) }
}, 'widgets: the crash claimer')"""


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (a cue point from the pauses of the audio)."""
    scene.wait_until(b.start + frac * b.length)


def _code(src, language="javascript", buff=0.2) -> Code:
    """style.code_block with a chosen panel padding."""
    c = Code(code_string=src.strip("\n"), language=language, formatter_style="github-dark",
             add_line_numbers=False,
             paragraph_config={"font": MONO, "font_size": CODE, "line_spacing": 0.6},
             background_config={"fill_color": PANEL, "stroke_color": MUTED, "stroke_width": 2,
                                "corner_radius": 0.14, "buff": buff})
    c._dw_fs = CODE
    c._dw_ref_h = c.code_lines.height
    return c


def _fname(name, code):
    """The file name of a code card, grey, at the title row, right-aligned to the card."""
    return T(name, SMALL, MUTED, mono=True).move_to([0, TITLE_Y, 0]).align_to(code, RIGHT)


def _out_panel(rows, colors=None, size=CODE, buff=0.2):
    """Real program output: mono lines on the panel color. .rows (Text)."""
    colors = colors or {}
    ts = VGroup(*[T(r, size, colors.get(i, TEXT), mono=True) for i, r in enumerate(rows)])
    ts.arrange(DOWN, buff=buff, aligned_edge=LEFT)
    box = rbox(ts.width + 0.5, ts.height + 0.45, MUTED, fill=0, sw=2, r=0.14)
    box.set_fill(PANEL, 1)
    ts.move_to(box)
    g = VGroup(box, ts)
    g.rows, g.box = list(ts), box
    return g


def _hide_rows(panel):
    for r in panel.rows:
        r.set_opacity(0)
    return panel


def _show_row(panel, i):
    return panel.rows[i].animate.set_opacity(1)


def _credit(text):
    return chip(text, MUTED, size=SMALL, mono=False, fill=0.06)


def _strike(m, color=ISOLATION, sw=4):
    return Line(m.get_left() + LEFT * 0.08, m.get_right() + RIGHT * 0.08, stroke_color=color, stroke_width=sw)


def _x_mark(color=ISOLATION, s=0.18, sw=6):
    return VGroup(Line([-s, -s, 0], [s, s, 0], stroke_color=color, stroke_width=sw),
                  Line([-s, s, 0], [s, -s, 0], stroke_color=color, stroke_width=sw))


def _clock(color=TASK, r=0.22):
    c = Circle(radius=r, stroke_color=color, stroke_width=3)
    h1 = Line(ORIGIN, UP * r * 0.72, stroke_color=color, stroke_width=3)
    h2 = Line(ORIGIN, RIGHT * r * 0.55, stroke_color=color, stroke_width=3)
    return VGroup(c, h1, h2)


def _flag(color=ISOLATION, h=0.55):
    pole = Line(ORIGIN, UP * h, stroke_color=TEXT, stroke_width=3)
    cloth = Polygon(pole.get_top(), pole.get_top() + DOWN * 0.24, pole.get_top() + DOWN * 0.12 + RIGHT * 0.38,
                    stroke_color=color, stroke_width=2, fill_color=color, fill_opacity=0.9)
    return VGroup(pole, cloth)


def _eye_crossed(color=TEXT, w=0.8):
    up = ArcBetweenPoints(LEFT * w / 2, RIGHT * w / 2, angle=-PI / 2, stroke_color=color, stroke_width=3)
    down = ArcBetweenPoints(LEFT * w / 2, RIGHT * w / 2, angle=PI / 2, stroke_color=color, stroke_width=3)
    pupil = Circle(radius=w * 0.13, stroke_width=0, fill_color=color, fill_opacity=1)
    bar = Line([-w * 0.45, -w * 0.4, 0], [w * 0.45, w * 0.4, 0], stroke_color=ISOLATION, stroke_width=5)
    return VGroup(up, down, pupil, bar)


def _restart(color=TEXT, r=0.26):
    a = Arc(radius=r, start_angle=PI / 2, angle=1.6 * PI, stroke_color=color, stroke_width=3)
    a.add_tip(tip_length=0.14, tip_width=0.14)
    return a


def _promise(r=0.42, label="promise"):
    c = Circle(radius=r, stroke_color=PROMISE, stroke_width=3, fill_color=PROMISE, fill_opacity=0.15)
    g = VGroup(c)
    if label:
        g.add(T(label, SMALL, TEXT).move_to(c))
    g.circle = c
    return g


def _card(text, color=EMITTER, size=SMALL, w=None, h=0.5, mono=True, fill=0.15):
    t = T(text, size, TEXT, mono=mono)
    b = rbox(w or t.width + 0.36, h, color, fill=fill, sw=2.5, r=0.08)
    t.move_to(b)
    g = VGroup(b, t)
    g.box, g.text = b, t
    return g


def _ran_note(*ls) -> VGroup:
    """The `ran` claim tag with a short grey note beside it."""
    return VGroup(claim_tag("ran"), lines(*ls, size=SMALL, color=MUTED, buff=0.08)).arrange(RIGHT, buff=0.2)


def _asked(*qs) -> VGroup:
    """The grey 'asked:' card (part_memory heap_vs_stack). .qs: the question lines."""
    q = VGroup(*[T(x, BODY) for x in qs]).arrange(DOWN, buff=0.25, aligned_edge=LEFT)
    txt = VGroup(T("asked:", LABEL, MUTED), q).arrange(DOWN, buff=0.2, aligned_edge=LEFT)
    box = rbox(txt.width + 0.7, txt.height + 0.5, MUTED, fill=0.08, sw=2)
    txt.move_to(box)
    g = VGroup(box, txt)
    g.qs = list(q)
    return g


def _markup(s):
    """Cell text: `x` -> Menlo span; escape the markup characters."""
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    parts = s.split("`")
    out = []
    for i, p in enumerate(parts):
        out.append(f'<span font_family="{MONO}">{p}</span>' if i % 2 else p)
    return "".join(out)


class _Grid(VGroup):
    """A table whose cells can hold several lines (style.RevealTable holds one line per cell).

    header: list of str ('' for an empty corner). rows: list of rows; a cell is a str or a tuple of
    lines; `x` in a line draws x in Menlo. Column 0 is the row label (grey). Data cells start hidden;
    reveal(cells) shows them. .cells[r][c] (row 0 = header).
    """

    def __init__(self, header, rows, header_colors=None, size=SMALL, row_pad=0.24, col_gap=0.5, **kw):
        super().__init__(**kw)
        hc = header_colors or [TEXT] * len(header)
        grid = [[self._cell(h, size, hc[c], bold=True) for c, h in enumerate(header)]]
        for r in rows:
            grid.append([self._cell(x, size, MUTED if c == 0 else TEXT) for c, x in enumerate(r)])
        ncol = len(header)
        widths = [max(row[c].width for row in grid) for c in range(ncol)]
        heights = [max(m.height for m in row) for row in grid]
        xs = np.cumsum([0] + [w + col_gap for w in widths[:-1]])
        total_w = sum(widths) + col_gap * (ncol - 1)
        x0 = -total_w / 2
        y = 0.0
        self.hlines = []
        for i, row in enumerate(grid):
            for c, m in enumerate(row):
                if len(m):
                    m.move_to([x0 + xs[c], y, 0], aligned_edge=UL)
            y -= heights[i] + row_pad
            if i < len(grid) - 1:
                ln = Line([x0 - 0.15, y + row_pad / 2, 0], [x0 + total_w + 0.15, y + row_pad / 2, 0],
                          stroke_width=1.5 if i else 2, stroke_color=MUTED, stroke_opacity=0.55)
                self.hlines.append(ln)
        self.cells = grid
        self.add(*self.hlines, *[m for row in grid for m in row])
        for row in grid[1:]:
            for m in row[1:]:
                m.set_opacity(0)

    @staticmethod
    def _cell(x, size, color, bold=False):
        ls = (x,) if isinstance(x, str) else tuple(x)
        if ls == ("",):
            return VGroup()
        out = []
        for s in ls:
            if "`" in s:
                m = M(_markup(s), size, color)
                if bold:
                    m = M(f"<b>{_markup(s)}</b>", size, color)
            else:
                m = T(s, size, color, bold=bold)
            out.append(m)
        return VGroup(*out).arrange(DOWN, buff=0.1, aligned_edge=LEFT)

    def reveal(self, *rc) -> Animation:
        return AnimationGroup(*[self.cells[r][c].animate.set_opacity(1) for r, c in rc], group=self)

    def row_cells(self, r):
        return [(r, c) for c in range(1, len(self.cells[0]))]

    def col_cells(self, c):
        return [(r, c) for r in range(1, len(self.cells))]


# ====================================================================== try_stack
class TryStack(DWScene):
    # weights = seconds between the pauses of audio-final/try_stack.wav (39.32 s)
    BEATS = [("open", 3.5), ("rule", 7.7), ("timer", 6.5), ("gone", 8.5), ("exit", 3.6), ("credit", 9.52)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram(self).open_part(self, "notice", also=("late_error",), run_time=b.left)

        with self.beat("rule") as b:
            title = scene_title("A try covers only the call stack", STACK)
            p1 = _Pile(width=2.6, max_frames=3)
            p1.shift(np.array([-3.4, -1.6, 0]) - p1.base.get_center())
            rule = lines("a try covers the code", "that runs while the try", "is on the call stack", size=BODY)
            rule.move_to([2.6, 0.2, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(p1), run_time=b.t(0.12))
            _at(self, b, 0.38)
            self.play(p1.push("try"), run_time=b.t(0.08))
            self.play(p1.push("f()"), run_time=b.t(0.08))
            cover = DashedVMobject(SurroundingRectangle(VGroup(*p1.frames), color=STACK, buff=0.12,
                                                         corner_radius=0.1), num_dashes=40)
            cover_lbl = T("covered", LABEL, STACK).next_to(cover, LEFT, buff=0.2)
            self.play(Create(cover), FadeIn(cover_lbl), FadeIn(rule), run_time=b.t(0.15))
            _at(self, b, 0.8)
            self.play(p1.pop(), run_time=b.t(0.06))
            self.play(p1.pop(), FadeOut(cover), FadeOut(cover_lbl), run_time=b.t(0.08))

        with self.beat("timer") as b:
            code = _code(_TRY_TIMER).move_to([0, 0, 0]).align_to([_X0, 2.95, 0], UL)
            fname = _fname("try_timer.cjs", code)
            pile = _Pile(width=2.2, max_frames=2)
            pile.shift(np.array([-5.25, -2.35, 0]) - pile.base.get_center())
            pile.title.next_to(pile.room, UP, buff=0.12)
            queue = LoopQueue("task queue", TASK, width=2.6, shape="ball").move_to([-2.0, -1.75, 0])
            clock = _clock(TASK).move_to([-0.15, -0.95, 0])
            ms = T("10 ms", LABEL, TASK, mono=True).next_to(clock, RIGHT, buff=0.15)
            out = _hide_rows(_out_panel(["try block ends", "script ends", "Error: late boom"],
                                        colors={2: ISOLATION}))
            out.align_to([1.6, 0.25, 0], UL)
            self.play(FadeOut(rule), FadeOut(p1), FadeIn(code), FadeIn(fname), run_time=b.t(0.1))
            self.play(FadeIn(pile), FadeIn(queue), FadeIn(out), run_time=b.t(0.08))
            mark = mark_line(code, 0)
            self.play(Create(mark), pile.push("try"), run_time=b.t(0.08))
            _at(self, b, 0.3)
            self.play(Transform(mark, mark_line(code, 1)), FadeIn(clock), FadeIn(ms), run_time=b.t(0.1))
            _at(self, b, 0.58)
            self.play(Rotate(clock[1], -TAU, about_point=clock[0].get_center()), run_time=b.t(0.2))
            _at(self, b, 0.85)
            self.play(Transform(mark, mark_line(code, 2)), _show_row(out, 0), run_time=b.t(0.1))

        with self.beat("gone") as b:
            self.play(Transform(mark, mark_line(code, 3)), pile.pop(), run_time=b.t(0.08))
            self.play(Transform(mark, mark_line(code, 4)), _show_row(out, 1), run_time=b.t(0.07))
            _at(self, b, 0.3)
            self.play(queue.enqueue("callback", source=clock), FadeOut(mark), run_time=b.t(0.1))
            _at(self, b, 0.5)
            self.play(run_next(queue, pile), run_time=b.t(0.1))
            boom = burst(ISOLATION, 0.22).next_to(pile.top, RIGHT, buff=0.12)
            mark = mark_line(code, 1, color=ISOLATION)
            self.play(FadeIn(boom, scale=0.5), Create(mark), run_time=b.t(0.08))
            note = caption("fresh, empty call stack: no catch is there")
            _at(self, b, 0.78)
            self.play(FadeIn(note), run_time=b.t(0.08))

        with self.beat("exit") as b:
            err = T("Error: late boom", SMALL, ISOLATION, mono=True).next_to(pile.top, RIGHT, buff=0.1)
            self.play(FadeOut(boom), FadeIn(err), run_time=b.t(0.08))
            self.play(pile.pop(), err.animate.move_to([-5.25, -2.7, 0]).set_opacity(0),
                      run_time=b.t(0.2))
            self.play(_show_row(out, 2), run_time=b.t(0.1))
            exit_chip = chip("exit code 1", ISOLATION, mono=False)
            ran = claim_tag("ran")
            row = VGroup(exit_chip, ran).arrange(RIGHT, buff=0.3).next_to(out, DOWN, buff=0.25)
            row.align_to(out, LEFT)
            caught = T("caught:", SMALL, MUTED, mono=True)
            never = T("never prints", SMALL, MUTED)
            crow = VGroup(caught, never).arrange(RIGHT, buff=0.2).next_to(row, DOWN, buff=0.25)
            crow.align_to(out, LEFT)
            self.play(FadeIn(row), run_time=b.t(0.12))
            self.play(FadeIn(crow), Create(_strike(caught)), run_time=b.t(0.12))

        with self.beat("credit") as b:
            credit = _credit('javascript.info, "Error handling, try...catch"')
            sync = T("try and catch only see synchronous code", LABEL, TEXT)
            pg = VGroup(chip("pinger", WIDGET), T("has this shape", LABEL, MUTED)).arrange(RIGHT, buff=0.25)
            grp = VGroup(credit, sync, pg).arrange(DOWN, buff=0.35, aligned_edge=LEFT)
            grp.move_to([0, -1.45, 0]).align_to([_X0, 0, 0], LEFT)
            self.play(FadeOut(pile), FadeOut(queue), FadeOut(clock), FadeOut(ms), FadeOut(mark),
                      FadeOut(note), run_time=b.t(0.1))
            self.play(FadeIn(credit), run_time=b.t(0.1))
            _at(self, b, 0.38)
            self.play(FadeIn(sync), run_time=b.t(0.1))
            _at(self, b, 0.72)
            self.play(FadeIn(pg, shift=UP * 0.1), run_time=b.t(0.1))


# ====================================================================== exception_vs_rejection
class ExceptionVsRejection(DWScene):
    # weights = seconds between the pauses of audio-final/exception_vs_rejection.wav (36.40 s)
    BEATS = [("exc", 7.9), ("rej", 6.6), ("table", 4.1), ("bridge", 10.4), ("example", 7.4)]

    def construct(self):
        with self.beat("exc") as b:
            title = scene_title("Two forms of an error", ISOLATION)
            exc_lbl = T("exception", HEADING, ISOLATION, bold=True).move_to([-3.6, 2.3, 0])
            pile = _Pile(width=2.8, max_frames=3)
            pile.shift(np.array([-3.6, -1.7, 0]) - pile.base.get_center())
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.08))
            _at(self, b, 0.3)
            self.play(FadeIn(exc_lbl), FadeIn(pile), run_time=b.t(0.08))
            self.play(pile.push("has catch", mono=False), run_time=b.t(0.05))
            self.play(pile.push("b()"), run_time=b.t(0.05))
            self.play(pile.push("c()"), run_time=b.t(0.05))
            ball = VGroup(burst(ISOLATION, 0.2), T("throw", SMALL, ISOLATION, mono=True)).arrange(RIGHT, buff=0.1)
            ball.next_to(pile.top, RIGHT, buff=0.15)
            _at(self, b, 0.6)
            self.play(FadeIn(ball, scale=0.6), run_time=b.t(0.06))
            for _ in range(2):
                self.play(pile.pop(), ball.animate.shift(DOWN * (pile.frame_h + pile.gap)), run_time=b.t(0.08))
            self.play(Indicate(pile.top, color=STACK, scale_factor=1.1), run_time=b.t(0.1))

        with self.beat("rej") as b:
            rej_lbl = T("rejection", HEADING, PROMISE, bold=True).move_to([3.6, 2.3, 0])
            prom = _promise(0.75).move_to([3.3, 0.35, 0])
            flag = _flag(ISOLATION).next_to(prom.circle, UR, buff=-0.15)
            failed = T("failed", SMALL, ISOLATION).next_to(flag, RIGHT, buff=0.1)
            wait = lines("waits on the promise", "until code asks", size=LABEL, color=MUTED, align=ORIGIN)
            wait.next_to(prom, DOWN, buff=0.45).set_x(3.6)
            self.play(FadeIn(rej_lbl), FadeIn(prom), run_time=b.t(0.12))
            self.play(FadeIn(flag), FadeIn(failed), run_time=b.t(0.1))
            _at(self, b, 0.5)
            self.play(FadeIn(wait), run_time=b.t(0.12))

        with self.beat("table") as b:
            grid = _Grid(["", "exception", "rejection"],
                         [["made by", "`throw`", "a promise that fails"],
                          ["travels", "down the call stack", "stays on the promise"],
                          ["taken by", "`catch`", "`.catch`, or `await` inside `try`"]],
                         header_colors=[TEXT, ISOLATION, PROMISE], size=LABEL)
            grid.move_to([0, 0, 0]).align_to([0, 2.75, 0], UP)
            self.play(FadeOut(VGroup(exc_lbl, pile, ball, rej_lbl, prom, flag, failed, wait)), run_time=b.t(0.1))
            credit = _credit('Domenic Denicola, "You\'re Missing the Point of Promises" (2012)')
            credit.move_to([0, -2.4, 0])
            self.play(FadeIn(grid), FadeIn(credit), run_time=b.t(0.1))
            for i, at in zip((1, 2, 3), (0.25, 0.5, 0.72)):
                _at(self, b, at)
                self.play(grid.reveal(*grid.row_cells(i)), run_time=b.t(0.12))

        with self.beat("bridge") as b:
            r = chip("rejection", PROMISE, mono=False, size=LABEL)
            e = chip("exception", ISOLATION, mono=False, size=LABEL)
            row = VGroup(r, e).arrange(RIGHT, buff=2.4).move_to([-1.2, -0.95, 0])
            arr = labeled_arrow(r.get_right(), e.get_left(), "await", color=TEXT, size=LABEL)
            tryok = T("a normal try works", LABEL, MUTED).next_to(e, RIGHT, buff=0.35)
            _at(self, b, 0.03)
            self.play(FadeIn(r), run_time=b.t(0.08))
            _at(self, b, 0.22)
            self.play(GrowArrow(arr.arrow), FadeIn(arr.label), FadeIn(e), run_time=b.t(0.12))
            _at(self, b, 0.45)
            self.play(FadeIn(tryok), run_time=b.t(0.1))
            _at(self, b, 0.68)
            self.play(Indicate(grid.cells[3][2], color=PROMISE, scale_factor=1.08), run_time=b.t(0.15))

        with self.beat("example") as b:
            code = _code(_TRY_AWAIT, buff=0.15).move_to([0, 0, 0]).align_to([_X0, 3.75, 0], UL)
            out = _hide_rows(_out_panel(["caught after await: late boom", "caught by .catch: late boom"]))
            out.next_to(code, DOWN, buff=0.15).align_to(code, LEFT)
            ran = claim_tag("ran").next_to(out, RIGHT, buff=0.3).align_to(out, UP)
            fname = T("try_await.cjs", SMALL, MUTED, mono=True).next_to(ran, DOWN, buff=0.2).align_to(ran, LEFT)
            self.play(FadeOut(VGroup(title, grid, credit, row, arr, tryok)), run_time=b.t(0.08))
            self.play(FadeIn(code), FadeIn(fname), FadeIn(out), FadeIn(ran), run_time=b.t(0.1))
            _at(self, b, 0.46)
            mark = SurroundingRectangle(VGroup(code.code_lines[5], code.code_lines[6]), color=STACK, buff=0.06,
                                        stroke_width=2.5, corner_radius=0.05)
            self.play(Create(mark), _show_row(out, 0), run_time=b.t(0.12))
            _at(self, b, 0.77)
            mark2 = SurroundingRectangle(VGroup(code.code_lines[7], code.code_lines[8]), color=STACK, buff=0.06,
                                         stroke_width=2.5, corner_radius=0.05)
            self.play(Transform(mark, mark2), _show_row(out, 1), run_time=b.t(0.12))


# ====================================================================== emitter_handler
class EmitterHandler(DWScene):
    # weights = seconds between the pauses of audio-final/emitter_handler.wav (47.08 s)
    BEATS = [("table", 9.0), ("on", 3.2), ("emit", 6.3), ("handler", 2.3), ("watcher", 6.3),
             ("notices", 5.1), ("guru", 7.3), ("run", 7.58)]

    def construct(self):
        ebox = rbox(6.6, 3.7, EMITTER, fill=0.06).move_to([-3.05, 0.4, 0])
        etitle = T("emitter", LABEL, EMITTER, bold=True).align_to(ebox, UL).shift(RIGHT * 0.3 + DOWN * 0.25)
        hx, fx = -5.95, -3.85
        h_name = T("event name", SMALL, MUTED).move_to([hx, 1.25, 0], aligned_edge=LEFT)
        h_fns = T("functions", SMALL, MUTED).move_to([fx, 1.25, 0], aligned_edge=LEFT)
        sep = Line([hx, 0.98, 0], [ebox.get_right()[0] - 0.3, 0.98, 0], stroke_color=MUTED, stroke_width=1.5,
                   stroke_opacity=0.55)
        ping = T("'ping'", LABEL, TEXT, mono=True).move_to([hx, 0.5, 0], aligned_edge=LEFT)
        other = T("'done'", LABEL, TEXT, mono=True).move_to([hx, -0.7, 0], aligned_edge=LEFT)
        other_fn = _card("fn", w=1.15).move_to([fx, -0.7, 0], aligned_edge=LEFT)
        dots = T("...", LABEL, MUTED).move_to([hx, -1.2, 0], aligned_edge=LEFT)
        fn1 = _card("fn 1", w=1.15).move_to([fx, 0.5, 0], aligned_edge=LEFT)
        fn2 = _card("fn 2", w=1.15).next_to(fn1, RIGHT, buff=0.2)

        with self.beat("table") as b:
            title = scene_title("Emitter and handler", EMITTER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.06))
            _at(self, b, 0.22)
            self.play(Create(ebox), FadeIn(etitle), run_time=b.t(0.1))
            _at(self, b, 0.45)
            self.play(FadeIn(h_name), FadeIn(h_fns), Create(sep), run_time=b.t(0.08))
            self.play(FadeIn(ping), FadeIn(other), FadeIn(other_fn), FadeIn(dots), run_time=b.t(0.1))

        with self.beat("on") as b:
            on = chip("on('ping', fn)", EMITTER, size=LABEL).move_to([3.3, 1.35, 0])
            self.play(FadeIn(on, shift=LEFT * 0.2), run_time=b.t(0.15))
            self.play(FadeIn(fn1, target_position=on), run_time=b.t(0.2))
            self.play(Indicate(on, color=EMITTER), run_time=b.t(0.15))
            self.play(FadeIn(fn2, target_position=on), run_time=b.t(0.2))

        with self.beat("emit") as b:
            em = chip("emit('ping')", EMITTER, size=LABEL).move_to([3.3, -0.1, 0])
            order = T("each one, at once, in order", LABEL, MUTED).next_to(em, DOWN, buff=0.25)
            self.play(FadeIn(em, shift=LEFT * 0.2), run_time=b.t(0.1))
            arr = Arrow(em.get_left(), ping.get_right() + RIGHT * 0.1, buff=0.1, color=EMITTER, stroke_width=4)
            arr.put_start_and_end_on(em.get_left() + LEFT * 0.1, fn2.get_right() + RIGHT * 0.12)
            self.play(GrowArrow(arr), run_time=b.t(0.12))
            n1 = T("1", LABEL, EMITTER, bold=True).next_to(fn1, UP, buff=0.1)
            n2 = T("2", LABEL, EMITTER, bold=True).next_to(fn2, UP, buff=0.1)
            _at(self, b, 0.35)
            self.play(fn1.box.animate.set_fill(EMITTER, 0.6), FadeIn(n1), run_time=b.t(0.12))
            self.play(fn1.box.animate.set_fill(EMITTER, 0.15), fn2.box.animate.set_fill(EMITTER, 0.6), FadeIn(n2),
                      run_time=b.t(0.12))
            self.play(fn2.box.animate.set_fill(EMITTER, 0.15), FadeIn(order), run_time=b.t(0.12))

        with self.beat("handler") as b:
            br = Brace(VGroup(fn1, fn2), DOWN, buff=0.1, color=EMITTER)
            hl = T("handlers", LABEL, EMITTER, bold=True).next_to(br, DOWN, buff=0.08)
            self.play(FadeOut(on), FadeOut(em), FadeOut(arr), FadeOut(order), FadeOut(n1), FadeOut(n2),
                      run_time=b.t(0.2))
            self.play(GrowFromCenter(br), FadeIn(hl), run_time=b.t(0.3))

        with self.beat("watcher") as b:
            eye = _eye_crossed(TEXT, 0.9).move_to([1.6, 1.55, 0])
            nw = T("not a watcher", BODY, TEXT).next_to(eye, RIGHT, buff=0.3)
            self.play(FadeIn(eye, scale=0.7), FadeIn(nw), run_time=b.t(0.25))
            _at(self, b, 0.53)
            self.play(fn1.animate.set_opacity(0.35), fn2.animate.set_opacity(0.35), run_time=b.t(0.2))
            idle = T("does nothing until called", LABEL, MUTED).next_to(nw, DOWN, buff=0.2).align_to(nw, LEFT)
            self.play(FadeIn(idle), run_time=b.t(0.15))

        with self.beat("notices") as b:
            src = ProcessBox("code that sees", "the event", color=TEXT, sub_mono=False, sub_size=LABEL)
            src.move_to([3.6, -1.25, 0])
            self.play(FadeIn(src), run_time=b.t(0.12))
            call = labeled_arrow(src.get_left(), fn2.get_right() + RIGHT * 0.12 + DOWN * 0.1, None, color=EMITTER)
            call.label = T("emit('ping')", SMALL, EMITTER, mono=True).next_to(src, UP, buff=0.12)
            call.add(call.label)
            _at(self, b, 0.3)
            self.play(GrowArrow(call.arrow), FadeIn(call.label), run_time=b.t(0.15))
            self.play(fn1.animate.set_opacity(1), fn2.animate.set_opacity(1), run_time=b.t(0.1))
            self.play(fn1.box.animate.set_fill(EMITTER, 0.6), run_time=b.t(0.08))
            self.play(fn1.box.animate.set_fill(EMITTER, 0.15), fn2.box.animate.set_fill(EMITTER, 0.6), run_time=b.t(0.08))
            self.play(fn2.box.animate.set_fill(EMITTER, 0.15), run_time=b.t(0.06))

        with self.beat("guru") as b:
            credit = _credit('subscriber list: Refactoring.Guru, "Observer"').move_to([0, -2.45, 0])
            self.play(FadeIn(credit), run_time=b.t(0.12))
            _at(self, b, 0.4)
            self.play(Indicate(VGroup(fn1, fn2), color=EMITTER, scale_factor=1.08), run_time=b.t(0.2))

        with self.beat("run") as b:
            code = _code(_EMIT_SYNC).move_to([0, 0, 0]).align_to([_X0, 2.95, 0], UL)
            fname = _fname("emit_sync.cjs", code)
            out = _hide_rows(_out_panel(["before emit", "handler 1", "handler 2", "after emit"]))
            out.next_to(code, RIGHT, buff=0.45).align_to(code, UP)
            ran = claim_tag("ran").next_to(out, DOWN, buff=0.2).align_to(out, LEFT)
            fact = _credit("Node.js docs, Events: emit calls listeners synchronously, in registration order")
            fact.move_to([0, -1.25, 0]).align_to([_X0, 0, 0], LEFT)
            diagram = VGroup(ebox, etitle, h_name, h_fns, sep, ping, other, other_fn, dots, fn1, fn2, br, hl,
                             eye, nw, idle, src, call)
            self.play(FadeOut(diagram), run_time=b.t(0.08))
            self.play(FadeIn(code), FadeIn(fname), FadeIn(out), FadeIn(ran), run_time=b.t(0.08))
            self.play(FadeIn(fact), run_time=b.t(0.08))
            mark = mark_line(code, 4)
            _at(self, b, 0.43)
            self.play(Create(mark), _show_row(out, 0), run_time=b.t(0.07))
            _at(self, b, 0.57)
            self.play(Transform(mark, mark_line(code, 5)), _show_row(out, 1), run_time=b.t(0.07))
            _at(self, b, 0.72)
            self.play(_show_row(out, 2), run_time=b.t(0.06))
            _at(self, b, 0.86)
            self.play(Transform(mark, mark_line(code, 6)), _show_row(out, 3), run_time=b.t(0.07))


# ====================================================================== uncaught_unhandled
def _door(w=4.4, h=2.6, color=TEXT):
    return VGroup(rbox(w, h, color, fill=0.04, sw=3, r=0.08))


class UncaughtUnhandled(DWScene):
    # weights = seconds between the pauses of audio-final/uncaught_unhandled.wav (38.80 s)
    BEATS = [("uncaught", 9.8), ("pinger", 3.0), ("unhandled", 6.3), ("check", 7.8), ("same", 5.3),
             ("exit", 6.6)]

    def construct(self):
        sign = chip("exit code 1", ISOLATION, size=LABEL, mono=False, fill=0.3).move_to([0, 2.35, 0])
        ld = _door().move_to([-3.6, -0.5, 0])
        rd = _door().move_to([3.6, -0.5, 0])
        lt = T("uncaught exception", LABEL, ISOLATION, bold=True).next_to(ld, UP, buff=0.15)
        rt = T("unhandled rejection", LABEL, PROMISE, bold=True).next_to(rd, UP, buff=0.15)
        la = Arrow(lt.get_top(), sign.get_left(), buff=0.1, color=ISOLATION, stroke_width=4)
        ra = Arrow(rt.get_top(), sign.get_right(), buff=0.1, color=ISOLATION, stroke_width=4)

        with self.beat("uncaught") as b:
            title = scene_title("Two ways an error escapes", ISOLATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.06))
            _at(self, b, 0.33)
            self.play(FadeIn(ld), FadeIn(lt), run_time=b.t(0.1))
            pile = _Pile(width=2.2, max_frames=2)
            pile.shift(np.array([-3.6, -1.15, 0]) - pile.base.get_center())
            pile.title.next_to(pile.room, UP, buff=0.05)
            self.play(FadeIn(pile), run_time=b.t(0.06))
            ball = VGroup(burst(ISOLATION, 0.2), T("throw", SMALL, ISOLATION, mono=True)).arrange(RIGHT, buff=0.1)
            ball.move_to(pile.next_slot())
            _at(self, b, 0.52)
            self.play(FadeIn(ball, scale=0.6), run_time=b.t(0.06))
            self.play(ball.animate.move_to([-3.6, -2.3, 0]), run_time=b.t(0.14))
            none = T("no catch on the way", LABEL, MUTED).next_to(ball, RIGHT, buff=0.3)
            _at(self, b, 0.83)
            self.play(FadeIn(none), run_time=b.t(0.1))

        with self.beat("pinger") as b:
            pg = chip("pinger", WIDGET).next_to(lt, RIGHT, buff=0.3)
            self.play(FadeIn(pg, shift=DOWN * 0.1), run_time=b.t(0.25))

        with self.beat("unhandled") as b:
            self.play(FadeIn(rd), FadeIn(rt), run_time=b.t(0.1))
            prom = _promise(0.55).move_to([2.3, 0.05, 0])
            flag = _flag(ISOLATION, 0.45).next_to(prom.circle, UR, buff=-0.12)
            hl = VGroup(T("handlers:", LABEL, MUTED), T("none", LABEL, TEXT)).arrange(RIGHT, buff=0.15)
            hl.next_to(prom, RIGHT, buff=0.4)
            self.play(FadeIn(prom), FadeIn(flag), run_time=b.t(0.12))
            _at(self, b, 0.58)
            self.play(FadeIn(hl), run_time=b.t(0.12))

        with self.beat("check") as b:
            mq = LoopQueue("microtask queue", MICROTASK, width=2.4, shape="small_ball", labels=False,
                           title_side=DOWN).move_to([3.15, -1.05, 0])
            mq.title.set_x(mq.tray.get_x())
            clock = _clock(TEXT, 0.25).move_to([5.05, -1.05, 0])
            self.play(FadeIn(mq), run_time=b.t(0.08))
            self.play(mq.enqueue(None), mq.enqueue(None), run_time=b.t(0.08))
            _at(self, b, 0.22)
            self.play(mq.dequeue(), run_time=b.t(0.07))
            self.play(mq.dequeue(), run_time=b.t(0.07))
            self.play(FadeIn(clock), Rotate(clock[1], -TAU, about_point=clock[0].get_center()), run_time=b.t(0.12))
            self.play(Indicate(hl[1], color=ISOLATION), run_time=b.t(0.1))
            late = VGroup(T(".catch()", LABEL, PROMISE, mono=True), T("later: too late", LABEL, MUTED)).arrange(
                RIGHT, buff=0.2)
            late.next_to(rd, DOWN, buff=0.15)
            _at(self, b, 0.6)
            self.play(FadeIn(late, shift=LEFT * 0.2), run_time=b.t(0.1))
            self.play(Create(_strike(late[0])), run_time=b.t(0.08))

        with self.beat("same") as b:
            inside = [m for m in self.mobjects if m not in (title, lt, rt, self.source_tag)]
            self.play(*[FadeOut(m) for m in inside], run_time=b.t(0.12))
            self.play(lt.animate.next_to(sign, LEFT, buff=1.1).set_y(sign.get_y()),
                      rt.animate.next_to(sign, RIGHT, buff=1.1).set_y(sign.get_y()), run_time=b.t(0.15))
            sub_l = T("about the call stack", SMALL, MUTED).next_to(lt, DOWN, buff=0.15)
            sub_r = T("about one promise", SMALL, MUTED).next_to(rt, DOWN, buff=0.15)
            self.play(FadeIn(sub_l), run_time=b.t(0.12))
            _at(self, b, 0.5)
            self.play(FadeIn(sub_r), run_time=b.t(0.12))
            la = Arrow(lt.get_right(), sign.get_left(), buff=0.12, color=ISOLATION, stroke_width=4)
            ra = Arrow(rt.get_left(), sign.get_right(), buff=0.12, color=ISOLATION, stroke_width=4)
            _at(self, b, 0.76)
            self.play(FadeIn(sign), GrowArrow(la), GrowArrow(ra), run_time=b.t(0.2))

        with self.beat("exit") as b:
            code = _code(_REJECT_NONE).move_to([0, 0, 0]).align_to([_X0, 1.15, 0], UL)
            fname = T("reject_none.cjs", SMALL, MUTED, mono=True).next_to(code, DOWN, buff=0.12).align_to(code, LEFT)
            out = _hide_rows(_out_panel(["script ends", "Error: nobody waits for me"], colors={1: ISOLATION}))
            out.next_to(code, RIGHT, buff=0.5).align_to(code, UP)
            ex = VGroup(chip("exit code 1", ISOLATION, mono=False), claim_tag("ran")).arrange(RIGHT, buff=0.3)
            ex.next_to(out, DOWN, buff=0.2).align_to(out, LEFT)
            fact = _credit("Node 15 and later: --unhandled-rejections=throw is the default (Node CLI docs)")
            fact.move_to([0, -2.35, 0])
            self.play(FadeIn(code), FadeIn(fname), FadeIn(out), run_time=b.t(0.1))
            _at(self, b, 0.12)
            self.play(FadeIn(fact), run_time=b.t(0.1))
            _at(self, b, 0.3)
            self.play(_show_row(out, 0), run_time=b.t(0.08))
            _at(self, b, 0.52)
            self.play(_show_row(out, 1), run_time=b.t(0.08))
            _at(self, b, 0.66)
            self.play(FadeIn(ex), run_time=b.t(0.1))


# ====================================================================== process_handlers
class ProcessHandlers(DWScene):
    # weights = seconds between the pauses of audio-final/process_handlers.wav (43.64 s)
    BEATS = [("who", 2.2), ("emitter", 10.9), ("handler", 6.1), ("nowidget", 4.7), ("run", 13.8), ("quote", 5.94)]

    def construct(self):
        host = rbox(6.6, 5.0, HOST, fill=0.04).move_to([-3.4, 0.05, 0])
        host_t = T("host", LABEL, HOST, bold=True).align_to(host, UL).shift(RIGHT * 0.3 + DOWN * 0.22)
        pbox = rbox(6.7, 3.7, EMITTER, fill=0.1).move_to([3.15, 0.15, 0])
        p_t = VGroup(T("process", LABEL, EMITTER, bold=True, mono=True), T("emitter", LABEL, MUTED)).arrange(
            RIGHT, buff=0.2).align_to(pbox, UL).shift(RIGHT * 0.3 + DOWN * 0.25)
        n1 = T("'uncaughtException'", SMALL, TEXT, mono=True).move_to([0.2, 1.0, 0], aligned_edge=LEFT)
        n2 = T("'unhandledRejection'", SMALL, TEXT, mono=True).move_to([0.2, -1.05, 0], aligned_edge=LEFT)
        slot1 = T("[ ]", SMALL, MUTED, mono=True).next_to(n1, RIGHT, buff=0.35)
        slot2 = T("[ ]", SMALL, MUTED, mono=True).next_to(n2, RIGHT, buff=0.35)

        with self.beat("who") as b:
            title = scene_title("Process handlers", EMITTER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), Create(host), FadeIn(host_t), run_time=b.t(0.4))

        with self.beat("emitter") as b:
            _at(self, b, 0.05)
            self.play(Create(pbox), FadeIn(p_t), run_time=b.t(0.12))
            _at(self, b, 0.42)
            self.play(FadeIn(n1), FadeIn(slot1), FadeIn(n2), FadeIn(slot2), run_time=b.t(0.1))
            thr = VGroup(burst(ISOLATION, 0.18), T("escaped throw", SMALL, ISOLATION)).arrange(RIGHT, buff=0.12)
            thr.move_to([-4.3, 1.0, 0])
            rej = VGroup(_flag(ISOLATION, 0.4), T("escaped rejection", SMALL, PROMISE)).arrange(RIGHT, buff=0.12)
            rej.move_to([-4.3, -1.05, 0])
            a1 = Arrow(thr.get_right(), n1.get_left(), buff=0.15, color=ISOLATION, stroke_width=4)
            a2 = Arrow(rej.get_right(), n2.get_left(), buff=0.15, color=ISOLATION, stroke_width=4)
            _at(self, b, 0.55)
            self.play(FadeIn(thr), GrowArrow(a1), run_time=b.t(0.12))
            _at(self, b, 0.74)
            self.play(FadeIn(rej), GrowArrow(a2), run_time=b.t(0.12))

        with self.beat("handler") as b:
            card = _card("(error, origin)", EMITTER, size=SMALL)
            card.next_to(n1, DOWN, buff=0.25).align_to(n1, LEFT).shift(RIGHT * 0.4)
            ph = T("process handler", LABEL, EMITTER, bold=True).next_to(card, RIGHT, buff=0.25)
            hook = Line(n1.get_left() + RIGHT * 0.2 + DOWN * 0.15, [n1.get_left()[0] + 0.2, card.get_y(), 0],
                        stroke_color=EMITTER, stroke_width=2.5)
            hook.add_line_to(card.get_left())
            dflt = VGroup(T("default:", LABEL, MUTED), chip("exit code 1", ISOLATION, mono=False)).arrange(
                RIGHT, buff=0.2).move_to([-3.4, -1.95, 0])
            self.play(FadeOut(slot1), Create(hook), FadeIn(card, shift=LEFT * 0.2), FadeIn(ph), run_time=b.t(0.2))
            _at(self, b, 0.52)
            self.play(FadeIn(dflt), run_time=b.t(0.15))
            self.play(Create(_strike(dflt)), run_time=b.t(0.15))

        with self.beat("nowidget") as b:
            wq = chip("widget: ?", WIDGET, mono=True, dashed=True).next_to(card, DOWN, buff=0.2).align_to(card, LEFT)
            x = _x_mark(ISOLATION, 0.16).next_to(wq, RIGHT, buff=0.15)
            self.play(Indicate(card, color=EMITTER), run_time=b.t(0.2))
            self.play(FadeIn(wq), run_time=b.t(0.15))
            self.play(Create(x), run_time=b.t(0.12))

        with self.beat("run") as b:
            code = _code(_PROC_HANDLERS).move_to([0, 0, 0]).align_to([_X0, 2.95, 0], UL)
            fname = _fname("process_handlers.cjs", code)
            out = _hide_rows(_out_panel(_PROC_OUT))
            out.next_to(code, DOWN, buff=0.2).align_to(code, LEFT)
            note = VGroup(claim_tag("ran"), lines("Node and Electron:", "same output", size=SMALL, color=MUTED, buff=0.08)
                          ).arrange(DOWN, buff=0.15, aligned_edge=LEFT).next_to(out, RIGHT, buff=0.35).align_to(out, UP)
            self.play(*[FadeOut(m) for m in self.mobjects if m not in (title, self.source_tag)], run_time=b.t(0.06))
            self.play(FadeIn(code), FadeIn(fname), FadeIn(out), FadeIn(note), run_time=b.t(0.06))
            mark = mark_line(code, 0)
            self.play(Create(mark), run_time=b.t(0.05))
            _at(self, b, 0.3)
            m2 = SurroundingRectangle(VGroup(code.code_lines[2], code.code_lines[3]), color=STACK, buff=0.06,
                                      stroke_width=2.5, corner_radius=0.05)
            self.play(Transform(mark, m2), run_time=b.t(0.06))
            self.play(_show_row(out, 0), run_time=b.t(0.06))
            self.play(_show_row(out, 1), run_time=b.t(0.06))
            o1 = SurroundingRectangle(out.rows[0][15:33], color=EMITTER, buff=0.05, stroke_width=2.5)
            o2 = SurroundingRectangle(out.rows[1][15:32], color=EMITTER, buff=0.05, stroke_width=2.5)
            _at(self, b, 0.53)
            self.play(Create(o1), Create(o2), run_time=b.t(0.08))
            _at(self, b, 0.86)
            self.play(Transform(mark, mark_line(code, 4)), _show_row(out, 2), run_time=b.t(0.08))

        with self.beat("quote") as b:
            q = lines("“It is not safe to resume normal operation", "after 'uncaughtException'.”",
                      size=BODY, color=TEXT)
            src = T("Node.js docs, process", SMALL, MUTED)
            txt = VGroup(q, src).arrange(DOWN, buff=0.15, aligned_edge=LEFT)
            box = rbox(txt.width + 0.6, txt.height + 0.4, ISOLATION, fill=0.08, sw=2.5)
            txt.move_to(box)
            card = VGroup(box, txt).move_to([0, 0, 0]).align_to(out, DOWN).align_to([_X1, 0, 0], RIGHT)
            card.next_to(out, DOWN, buff=0.2).align_to(out, LEFT)
            self.play(FadeIn(card, shift=UP * 0.15), run_time=b.t(0.15))


# ====================================================================== promise_not_process
class PromiseNotProcess(DWScene):
    # weights = seconds between the pauses of audio-final/promise_not_process.wav (42.76 s)
    BEATS = [("asked", 7.6), ("promise", 8.4), ("then", 7.4), ("handler", 11.4), ("mdn", 7.96)]

    def construct(self):
        with self.beat("asked") as b:
            card = _asked("is a promise a process?", "is .then a process handler?").move_to([-1.0, 0.2, 0])
            nos = VGroup(*[T("no", HEADING, ISOLATION, bold=True).next_to(card, RIGHT, buff=0.4).set_y(q.get_y())
                           for q in card.qs])
            self.play(FadeIn(card, shift=RIGHT * 0.2), run_time=b.t(0.15))
            _at(self, b, 0.77)
            self.play(FadeIn(nos[0], scale=0.7), run_time=b.t(0.1))
            self.play(FadeIn(nos[1], scale=0.7), run_time=b.t(0.1))

        pbox = rbox(7.4, 2.1, TEXT, fill=0.04).move_to([-2.85, 1.8, 0])
        ptitle = T("one process", LABEL, TEXT, bold=True).align_to(pbox, UL).shift(RIGHT * 0.25 + DOWN * 0.2)
        dots = VGroup(*[Circle(radius=0.1, stroke_color=PROMISE, stroke_width=2, fill_color=PROMISE, fill_opacity=0.35)
                        for _ in range(3 * 16)]).arrange_in_grid(3, 16, buff=0.17)
        dots.move_to(pbox).align_to(pbox, DOWN).shift(UP * 0.22)
        many = T("thousands of promises", LABEL, MUTED).next_to(ptitle, RIGHT, buff=0.4)
        grid = _Grid(["", "promise", "`.then(fn)`", "process handler"],
                     [["what", "object in the heap", "callback on one promise", ("handler on the one", "`process` emitter")],
                      ["how many", "thousands", "one per call", ("one per event name,", "for the whole process")],
                      ["runs", "settles once", ("once, as a", "microtask"), ("for every", "escaped error")]],
                     header_colors=[TEXT, PROMISE, PROMISE, EMITTER])
        grid.move_to([0, 0, 0]).align_to([0, 0.35, 0], UP)

        with self.beat("promise") as b:
            self.play(FadeOut(card), FadeOut(nos), run_time=b.t(0.08))
            title = scene_title("A promise is not a process", PROMISE)
            self.play(FadeIn(title, shift=RIGHT * 0.2), Create(pbox), FadeIn(ptitle), run_time=b.t(0.1))
            one = dots[17]
            self.play(FadeIn(one, scale=0.5), run_time=b.t(0.08))
            _at(self, b, 0.33)
            self.play(Indicate(one, color=PROMISE, scale_factor=1.8), run_time=b.t(0.12))
            _at(self, b, 0.6)
            self.play(LaggedStart(*[FadeIn(d, scale=0.5) for i, d in enumerate(dots) if i != 17], lag_ratio=0.02),
                      FadeIn(many), run_time=b.t(0.18))
            self.play(FadeIn(grid), run_time=b.t(0.07))
            self.play(grid.reveal(*grid.col_cells(1)), run_time=b.t(0.08))

        with self.beat("then") as b:
            then = _card(".then(fn)", PROMISE, size=LABEL).move_to([3.2, 2.15, 0])
            link = Arrow(dots[15].get_center(), then.get_left(), buff=0.12, color=PROMISE, stroke_width=3,
                         max_tip_length_to_length_ratio=0.15)
            mt = VGroup(Circle(radius=0.17, stroke_color=MICROTASK, stroke_width=2.5, fill_color=MICROTASK,
                               fill_opacity=0.75), T("once, as a microtask", LABEL, MICROTASK)).arrange(RIGHT, buff=0.15)
            mt.next_to(then, DOWN, buff=0.3).align_to(then, LEFT)
            self.play(Indicate(dots[15], color=PROMISE, scale_factor=1.8), run_time=b.t(0.1))
            self.play(GrowArrow(link), FadeIn(then), run_time=b.t(0.12))
            _at(self, b, 0.5)
            self.play(FadeIn(mt), run_time=b.t(0.1))
            self.play(grid.reveal(*grid.col_cells(2)), run_time=b.t(0.12))

        with self.beat("handler") as b:
            ph = _card("process handler", EMITTER, size=LABEL, mono=False).move_to([3.2, 0.95, 0])
            ph.align_to(then, LEFT)
            self.play(FadeOut(mt), FadeIn(ph, shift=LEFT * 0.2), run_time=b.t(0.1))
            feeds = VGroup(*[Line(dots[i].get_center(), ph.get_left(), stroke_color=EMITTER, stroke_width=1.5,
                                  stroke_opacity=0.6) for i in range(32, 48, 2)])
            self.play(LaggedStart(*[Create(f) for f in feeds], lag_ratio=0.08), run_time=b.t(0.15))
            _at(self, b, 0.35)
            self.play(grid.reveal(*grid.col_cells(3)), run_time=b.t(0.12))
            _at(self, b, 0.57)
            last = T("last stop", LABEL, EMITTER).next_to(ph, RIGHT, buff=0.25)
            self.play(FadeIn(last), run_time=b.t(0.1))

        with self.beat("mdn") as b:
            para = VGroup(T("MDN, Promise: promises stand for operations already in progress", LABEL, TEXT),
                          T("here “process” = an operation, not an operating system process", LABEL, MUTED)
                          ).arrange(DOWN, buff=0.15, aligned_edge=LEFT)
            box = rbox(para.width + 0.5, para.height + 0.4, MUTED, fill=0.06, sw=2)
            para.move_to(box)
            mdn = VGroup(box, para).move_to([0, 1.7, 0])
            self.play(FadeOut(VGroup(pbox, ptitle, dots, many, then, link, ph, feeds, last)), run_time=b.t(0.1))
            self.play(FadeIn(mdn, shift=DOWN * 0.15), run_time=b.t(0.15))


# ====================================================================== handler_vs_effect
class HandlerVsEffect(DWScene):
    # weights = seconds between the pauses of audio-final/handler_vs_effect.wav (43.60 s)
    BEATS = [("asked", 7.0), ("owner", 5.4), ("reloads", 10.0), ("effect", 11.6), ("hook", 7.2), ("close", 2.4)]

    def construct(self):
        grid = _Grid(["", "process handler", "Cordis effect"],
                     [["owner", "the whole process", "one plugin"],
                      ["undo", ("`process.off(name, fn)`,", "by hand"), ("the returned cleanup,", "run by Cordis")],
                      ["after 4 reloads", ("2 grew to 5", "(plugins-spike.md:110)"), "no extra"]],
                     header_colors=[TEXT, EMITTER, TEXT])
        grid.move_to([0, 0, 0]).align_to([0, 2.85, 0], UP)
        py = -1.55
        lbox = rbox(5.9, 2.3, TEXT, fill=0.04).move_to([-3.35, py, 0])
        lt = T("process", LABEL, TEXT, bold=True).align_to(lbox, UL).shift(RIGHT * 0.25 + DOWN * 0.2)
        rbx = rbox(5.9, 2.3, TEXT, fill=0.04).move_to([3.35, py, 0])
        rt = T("plugin", LABEL, TEXT, bold=True).align_to(rbx, UL).shift(RIGHT * 0.25 + DOWN * 0.2)

        def hcard():
            return rbox(0.5, 0.42, EMITTER, fill=0.35, sw=2.5, r=0.06)

        with self.beat("asked") as b:
            title = scene_title("Process handler and Cordis effect", EMITTER)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.08))
            _at(self, b, 0.3)
            self.play(FadeIn(grid), run_time=b.t(0.12))
            _at(self, b, 0.65)
            diff = T("ownership and cleanup", BODY, TEXT).move_to([0, py, 0])
            self.play(FadeIn(diff), run_time=b.t(0.12))

        with self.beat("owner") as b:
            self.play(FadeOut(diff), Create(lbox), FadeIn(lt), grid.reveal((1, 1)), run_time=b.t(0.15))
            cards = VGroup(hcard(), hcard()).arrange(RIGHT, buff=0.15).move_to([-4.6, py - 0.2, 0])
            self.play(FadeIn(cards, shift=DOWN * 0.1), run_time=b.t(0.12))
            _at(self, b, 0.55)
            self.play(grid.reveal((2, 1)), run_time=b.t(0.15))

        with self.beat("reloads") as b:
            rl = VGroup(_restart(TEXT), T("reload", LABEL, TEXT)).arrange(RIGHT, buff=0.15)
            rl.align_to(lbox, UR).shift(LEFT * 0.25 + DOWN * 0.2)
            count = T("2", HEADING, EMITTER, bold=True, mono=True).next_to(cards, RIGHT, buff=0.5)
            self.play(FadeIn(rl), FadeIn(count), run_time=b.t(0.1))
            self.play(Rotate(rl[0], -TAU, about_point=rl[0].get_arc_center()), run_time=b.t(0.12))
            _at(self, b, 0.55)
            times = T("x 4", LABEL, MUTED).next_to(rl, DOWN, buff=0.1).align_to(rl, RIGHT)
            self.play(FadeIn(times), Rotate(rl[0], -2 * TAU, about_point=rl[0].get_arc_center()), run_time=b.t(0.18))
            more = VGroup(*[hcard() for _ in range(3)]).arrange(RIGHT, buff=0.15).next_to(cards, RIGHT, buff=0.15)
            five = T("5", HEADING, EMITTER, bold=True, mono=True).next_to(more, RIGHT, buff=0.35)
            self.play(LaggedStart(*[FadeIn(c, shift=DOWN * 0.1) for c in more], lag_ratio=0.3),
                      Transform(count, five), run_time=b.t(0.15))
            self.play(grid.reveal((3, 1)), run_time=b.t(0.12))

        with self.beat("effect") as b:
            self.play(Create(rbx), FadeIn(rt), grid.reveal((1, 2)), run_time=b.t(0.1))
            ec = hcard().move_to([1.9, py - 0.2, 0])
            cl = chip("cleanup", TEXT, mono=False).next_to(ec, RIGHT, buff=0.3)
            self.play(FadeIn(ec, shift=DOWN * 0.1), run_time=b.t(0.08))
            _at(self, b, 0.28)
            self.play(FadeIn(cl), grid.reveal((2, 2)), run_time=b.t(0.12))
            rl2 = VGroup(_restart(TEXT), T("reload", LABEL, TEXT)).arrange(RIGHT, buff=0.15)
            rl2.align_to(rbx, UR).shift(LEFT * 0.25 + DOWN * 0.2)
            _at(self, b, 0.55)
            self.play(FadeIn(rl2), run_time=b.t(0.05))
            self.play(Rotate(rl2[0], -TAU, about_point=rl2[0].get_arc_center()), run_time=b.t(0.08))
            self.play(Indicate(cl, color=TEXT), ec.animate.set_opacity(0), run_time=b.t(0.08))
            ec2 = hcard().move_to(ec)
            self.play(FadeIn(ec2, shift=DOWN * 0.1), run_time=b.t(0.07))
            one = T("1", HEADING, TEXT, bold=True, mono=True).next_to(cl, RIGHT, buff=0.4)
            self.play(FadeIn(one), grid.reveal((3, 2)), run_time=b.t(0.1))

        with self.beat("hook") as b:
            code = _code(_ISO_EFFECT, language="typescript").move_to([0, 0, 0]).align_to([_X0, -0.1, 0], UL)
            fname = T("isolation.ts:370-375", SMALL, MUTED, mono=True).next_to(code, RIGHT, buff=0.6).align_to(code, UP)
            hook = chip("crash hook", ISOLATION, mono=False, size=LABEL)
            what = lines("the function that the process handler", "calls on a fatal error", size=LABEL, color=MUTED)
            hk = VGroup(hook, what).arrange(DOWN, buff=0.15, aligned_edge=LEFT).next_to(fname, DOWN, buff=0.25)
            hk.align_to(fname, LEFT)
            self.play(FadeOut(VGroup(lbox, lt, rbx, rt, cards, more, count, rl, times, ec, ec2, cl, rl2, one)),
                      run_time=b.t(0.08))
            self.play(FadeIn(code), FadeIn(fname), FadeIn(hook), run_time=b.t(0.1))
            self.play(FadeIn(what), run_time=b.t(0.1))
            mark = mark_line(code, 2, color=ISOLATION)
            _at(self, b, 0.76)
            self.play(Create(mark), run_time=b.t(0.08))
            _at(self, b, 0.87)
            gone = T("a reload removes the old hook", LABEL, TEXT).next_to(hk, DOWN, buff=0.3).align_to(hk, LEFT)
            self.play(Transform(mark, mark_line(code, 3, color=TEXT)), FadeIn(gone), run_time=b.t(0.09))

        with self.beat("close") as b:
            OutlineDiagram(self).close_part(self, "notice", next_key="late_error", also=("late_error",),
                                            run_time=b.left)
