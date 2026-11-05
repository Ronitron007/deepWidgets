"""part_boxes: the deepWidgets boxes (script scenes `blame_store` `crash_record` `watchdog`
`provisional_record` `supervisor` `quarantine`).

Opens on the outline at `find_who`, closes there and lights `widget_pinger`. Each scene in the
middle of the part starts on the full outline, lights its box, and brings in its code name with
`fill_in()` when the voice says it (`animate.template.outline_mid`).

Code cards show real lines of the code at `68aabd9a`. A line longer than about 70 characters does
not fit at the least font size, so it wraps (same tokens). A card that would need more than about
12 lines shows the lines that the voice names, with a `…` row for each run of lines left out.
`watchdog.ts:24-29` leaves out its three comment lines. Record values are illustrative, as the
script says.

Words that no scene teaches stay off screen (`animate.template.rules`): the script's "Cordis runner",
"row id", "the runtime", "threshold" and the signal names SIGTRAP and SIGILL appear only inside real
code. The credit for Fowler names the author and the site, as part_threads does for title words
that the viewer has not met.

Beat weights are seconds of the final audio where it exists: each beat starts at the pause
before its sentence (ffmpeg silencedetect). The base scales them to the audio length.
"""
from dwscene import *

# ---------------------------------------------------------------- real code (68aabd9a)
_BLAME_51 = "const blameStore = new AsyncLocalStorage<string>()"

_RUN_AS = """\
export function runAs<T>(row: string | undefined,
  fn: () => T): T {
  return row === undefined ? fn()
    : blameStore.run(row, () => inSlot(row, fn))
}"""

_CLAIM = """\
function claim(error: unknown, event: CrashRecord['event']): void {
  try {
    const info = errorInfo(error)
    const store = blameStore.getStore()
    …
    writeJsonSync(crashFile(), crash)
    …
  } catch (failure) {
    …
  }
  process.exit(1)
}"""

_RECORD = """\
{ "row": "deepwidgets-widget-pinger",
  "slugs": ["pinger"],
  "error": { "name": "Error", "message": "late boom", "stack": "…" },
  "at": 1762300000000,
  "event": "uncaughtException",
  "method": "store",
  "root": "…/pinger",
  "hash": "9f2c…",
  "pid": 68722,
  "applied": false }"""

_WD_CONST = """\
export const WATCHDOG_THRESHOLD_MS = 2_000
const BEAT_MS = Math.max(20, Math.min(100,
  Math.floor(WATCHDOG_THRESHOLD_MS / 5)))
const POLL_MS = Math.max(10, Math.floor(BEAT_MS / 2))"""

_WDW_KILL = """\
if (stalledMs < data.thresholdMs) return
…
    writeJsonSync(data.crashFile, recordOf(blame, 'stall',
      'WatchdogStall', message, Date.now()))
…
let found = slotBlame()
…
process.kill(process.pid, 'SIGKILL')"""

_PROV_FIELDS = """\
"event": "provisional-stall",
"method": "slot\""""

_ABORT = """\
const ABORT_SIGNALS = new Set(['SIGABRT', 'SIGTRAP', 'SIGILL'])
…
const ABORT_CODE = 134"""

_QUARANTINE = """\
const record = readJson(crashFile()) as CrashRecord | undefined
if (record !== undefined && !record.applied)
  apply(crashFile(), record)
…
  else apply(provisionalFile(), provisional)
…
function held(row: string): Quarantine | undefined {
  const item = quarantine.get(row)
  if (item === undefined) return undefined
  if (item.root !== null && item.hash !== null
    && packageHash(item.root) !== item.hash) return undefined
  return item
}"""

# the first two questions of the side chat (part_intro `cold_open`), in Rohan's words
_Q_PROVISIONAL = ("what does the provisional record contain?", "which calls? how does it work with blame?")
_Q_EFFECT = ("is it like a Cordis effect with its own cleanup?",)


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (a cue point from the pauses of the final audio)."""
    scene.wait_until(b.start + frac * b.length)


def _code(src, language="typescript", color=MUTED, buff=0.15) -> Code:
    """style.code_block with a thinner panel padding (part_threads pattern)."""
    c = Code(code_string=src.strip("\n"), language=language, formatter_style="github-dark",
             add_line_numbers=False,
             paragraph_config={"font": MONO, "font_size": CODE, "line_spacing": 0.6},
             background_config={"fill_color": PANEL, "stroke_color": color, "stroke_width": 2,
                                 "corner_radius": 0.14, "buff": buff})
    c._dw_fs = CODE
    c._dw_ref_h = c.code_lines.height
    return c


def _top(m, y=CONTENT_TOP - 0.05):
    """Put m with its top at y, centered."""
    return m.move_to([0, 0, 0]).align_to([0, y, 0], UP)


def _fname(text):
    """A file name at the title row, right edge."""
    t = T(text, SMALL, MUTED, mono=True)
    return t.move_to([0, TITLE_Y, 0]).to_edge(RIGHT, buff=MARGIN + 0.1)


def _mark(code, i, j=None, color=STACK):
    """A frame around code lines i..j (inclusive)."""
    j = i if j is None else j
    return SurroundingRectangle(VGroup(*code.code_lines[i:j + 1]), color=color, buff=0.07, stroke_width=2.5,
                                corner_radius=0.05)


def _credit(*ls, color=MUTED) -> VGroup:
    """A credit card: grey lines in a thin box (part_loop pattern)."""
    t = lines(*ls, size=SMALL, color=MUTED, buff=0.08)
    box = rbox(t.width + 0.4, t.height + 0.3, color, fill=0.06, sw=2, r=0.1)
    t.move_to(box)
    return VGroup(box, t)


def _note(*ls, color=MUTED, size=SMALL) -> VGroup:
    return lines(*ls, size=size, color=color, buff=0.08)


def _card(*ls, color=RECORDS, size=SMALL, mono=False, sub=None) -> VGroup:
    """A rule card: text in a box of the concept color, an optional grey line under the text."""
    t = lines(*ls, size=size, color=TEXT, mono=mono, buff=0.1)
    if sub:
        t = VGroup(t, T(sub, SMALL, MUTED, mono=True)).arrange(DOWN, buff=0.12, aligned_edge=LEFT)
    box = rbox(t.width + 0.45, t.height + 0.35, color, fill=0.1, sw=2.5, r=0.1)
    t.move_to(box)
    g = VGroup(box, t)
    g.box = box
    return g


def _asked(*qs) -> VGroup:
    """The grey 'asked:' card (part_errors pattern)."""
    q = VGroup(*[T(x, BODY) for x in qs]).arrange(DOWN, buff=0.18, aligned_edge=LEFT)
    txt = VGroup(T("asked:", LABEL, MUTED), q).arrange(DOWN, buff=0.2, aligned_edge=LEFT)
    box = rbox(txt.width + 0.7, txt.height + 0.5, MUTED, fill=0.08, sw=2)
    txt.move_to(box)
    return VGroup(box, txt)


def _strike(m, color=ISOLATION, sw=4):
    return Line(m.get_left() + LEFT * 0.08, m.get_right() + RIGHT * 0.08, stroke_color=color, stroke_width=sw)


def _x_mark(color=ISOLATION, s=0.18, sw=6):
    return VGroup(Line([-s, -s, 0], [s, s, 0], stroke_color=color, stroke_width=sw),
                  Line([-s, s, 0], [s, -s, 0], stroke_color=color, stroke_width=sw))


def _tick(color=SUPERVISOR, s=0.2, sw=6):
    return VMobject(stroke_color=color, stroke_width=sw).set_points_as_corners(
        [[-s, 0, 0], [-s * 0.3, -s * 0.7, 0], [s, s * 0.8, 0]])


def _arrow(start, end, color, sw=4, tip=0.2):
    """A short arrow that keeps its full stroke and tip."""
    return Arrow(start, end, buff=0.06, color=color, stroke_width=sw, tip_length=tip,
                 max_stroke_width_to_length_ratio=40, max_tip_length_to_length_ratio=0.45)


def _host_frame(x0, x1, y0, y1, label="host", color=HOST):
    """A process box: a rounded frame with its name at the top left (part_threads)."""
    box = rbox(x1 - x0, y1 - y0, color, fill=0.03, sw=3).move_to([(x0 + x1) / 2, (y0 + y1) / 2, 0])
    name = T(label, LABEL, color, bold=True)
    name.align_to(box, UP).align_to(box, LEFT).shift(DOWN * 0.14 + RIGHT * 0.25)
    g = VGroup(box, name)
    g.box, g.name = box, name
    return g


def _lane(label, color, x0, x1, y0, y1):
    """A thread lane: a band in the thread color with its name at the top left (part_threads)."""
    band = rbox(x1 - x0, y1 - y0, color, fill=0.07, sw=2.5, r=0.12)
    band.move_to([(x0 + x1) / 2, (y0 + y1) / 2, 0])
    lbl = T(label, LABEL, color, bold=True)
    lbl.align_to(band, UP).align_to(band, LEFT).shift(DOWN * 0.14 + RIGHT * 0.22)
    g = VGroup(band, lbl)
    g.band, g.label = band, lbl
    return g


def _base_at(pile, x, y):
    """Shift vector that puts the pile's base line center at (x, y)."""
    return np.array([x, y, 0]) - pile.base.get_center()


class _Strip(VGroup):
    """Shared memory: one strip of two cells (part_threads). .cells .vals; set(i, text) returns an animation."""

    def __init__(self, cell_w=1.0, cell_h=0.62, values=("0", "0")):
        super().__init__()
        self.cells = VGroup(*[Rectangle(width=cell_w, height=cell_h, stroke_color=HEARTBEAT, stroke_width=3,
                                        fill_color=HEARTBEAT, fill_opacity=0.12) for _ in values])
        self.cells.arrange(RIGHT, buff=0)
        self.vals = VGroup(*[T(v, BODY, TEXT, mono=True).move_to(c) for v, c in zip(values, self.cells)])
        self.add(self.cells, self.vals)

    def set(self, i, text, color=TEXT) -> Animation:
        new = T(text, BODY, color, mono=True).move_to(self.cells[i])
        return Transform(self.vals[i], new)


def _body(w):
    """Center of the body of a window_card at its current place (window_card.body_center does not move)."""
    return np.array([w.frame.get_x(), (w[1].get_y() + w.frame.get_bottom()[1]) / 2, 0])


def _others(scene, *keep):
    """The visual mobjects on screen, except `keep`, the source tag and the camera frame."""
    skip = {id(m) for m in keep} | {id(scene.source_tag), id(scene.camera.frame)}
    return [m for m in scene.mobjects if id(m) not in skip and isinstance(m, VMobject)]


def _outline_in(scene, b, keys, frac=0.3):
    """The middle-of-part opener: the full outline fades in, then `keys` light. Returns the outline."""
    outline = OutlineDiagram(scene)
    scene.play(FadeIn(outline), run_time=b.t(frac / 2))
    scene.play(outline.highlight(*keys), run_time=b.t(frac / 2))
    return outline


class _Timeline(VGroup):
    """A time axis from 0 to `end_ms`, with ticks. x(ms) gives the scene x of a time."""

    def __init__(self, x0, x1, y, end_ms=2000, ticks=(0, 500, 2000), color=MUTED):
        super().__init__()
        self.x0, self.x1, self.y, self.end_ms = x0, x1, y, end_ms
        self.axis = Line([x0, y, 0], [x1, y, 0], stroke_color=color, stroke_width=3)
        self.ticks = VGroup()
        for ms in ticks:
            tk = Line([self.x(ms), y - 0.1, 0], [self.x(ms), y + 0.1, 0], stroke_color=color, stroke_width=3)
            lb = T(f"{ms} ms", SMALL, MUTED, mono=True).next_to(tk, DOWN, buff=0.08)
            self.ticks.add(VGroup(tk, lb))
        self.add(self.axis, self.ticks)

    def x(self, ms):
        return self.x0 + (self.x1 - self.x0) * ms / self.end_ms

    def p(self, ms, dy=0.0):
        return np.array([self.x(ms), self.y + dy, 0])


# ================================================================ blame_store
class BlameStore(DWScene):
    BEATS = [("open", 5.27), ("store", 6.02), ("wrap", 7.45), ("carry", 6.74)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram(self).open_part(self, "find_who", run_time=b.left)

        title = scene_title("The blame store", ASYNC_CTX)
        card = _top(_code(_BLAME_51))
        fname = _fname("isolation.ts:51")
        host = _host_frame(-5.2, 5.2, -2.7, 1.45)
        store = rbox(6.4, 2.6, ASYNC_CTX, fill=0.1, sw=3).move_to([0, -0.75, 0])
        store_t = T("blame store", LABEL, ASYNC_CTX, bold=True).next_to(store.get_top(), DOWN, buff=0.18)
        store_s = T("one async local storage", SMALL, MUTED).next_to(store_t, DOWN, buff=0.1)
        value = chip("deepwidgets-widget-pinger", WIDGET).move_to([0, -1.1, 0])
        value_l = T("value: the name of a widget (illustrative)", SMALL, MUTED).next_to(value, DOWN, buff=0.15)

        with self.beat("store") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(card), FadeIn(fname), run_time=b.t(0.15))
            _at(self, b, 0.25)
            self.play(FadeIn(host), FadeIn(store), FadeIn(store_t), FadeIn(store_s), run_time=b.t(0.15))
            _at(self, b, 0.56)
            self.play(FadeIn(value, scale=0.9), FadeIn(value_l), run_time=b.t(0.15))

        run_as = _code(_RUN_AS).move_to([0.6, -0.55, 0])
        fname2 = _fname("isolation.ts:113-115")
        wrap_l = T("the wrap", LABEL, ASYNC_CTX, bold=True).next_to(run_as, LEFT, buff=0.3).align_to(run_as, UP)
        start = chip("widget start", WIDGET, mono=False).move_to([-3.4, 2.15, 0])
        start_r = T("isolation.ts:296-304", SMALL, MUTED, mono=True).next_to(start, DOWN, buff=0.1)
        action = chip("action call", WIDGET, mono=False).move_to([3.4, 2.15, 0])
        action_r = T("index.ts:963", SMALL, MUTED, mono=True).next_to(action, DOWN, buff=0.1)
        a1 = _arrow(start_r.get_bottom() + DOWN * 0.05, [-1.2, run_as.get_top()[1], 0], WIDGET)
        a2 = _arrow(action_r.get_bottom() + DOWN * 0.05, [2.4, run_as.get_top()[1], 0], WIDGET)

        with self.beat("wrap") as b:
            self.play(FadeOut(VGroup(card, host, store, store_t, store_s, value, value_l)),
                      FadeOut(fname), run_time=b.t(0.12))
            self.play(FadeIn(run_as), FadeIn(fname2), FadeIn(wrap_l), run_time=b.t(0.14))
            _at(self, b, 0.47)
            self.play(FadeIn(start), FadeIn(start_r), GrowArrow(a1), run_time=b.t(0.12))
            _at(self, b, 0.74)
            self.play(FadeIn(action), FadeIn(action_r), GrowArrow(a2), run_time=b.t(0.12))

        with self.beat("carry") as b:
            up = VGroup(run_as, wrap_l)
            self.play(FadeOut(VGroup(start, start_r, action, action_r, a1, a2)),
                      up.animate.shift(UP * 2.0), run_time=b.t(0.12))
            mk = _mark(run_as, 3, color=ASYNC_CTX)
            self.play(Create(mk), run_time=b.t(0.08))
            # the async chain of the widget code, carrying the name
            ry = -1.55
            ribbon = Line([-5.6, ry, 0], [5.6, ry, 0], stroke_color=ASYNC_CTX, stroke_width=26, stroke_opacity=0.3)
            name = chip("deepwidgets-widget-pinger", ASYNC_CTX).move_to([-2.6, -0.5, 0])
            drop = _arrow(mk.get_bottom(), name.get_top(), ASYNC_CTX)
            code_c = chip("widget code", WIDGET, mono=False).move_to([-4.3, ry, 0])
            timer = chip("timer", TASK, mono=False).move_to([0.0, ry, 0])
            prom = chip("promise", PROMISE, mono=False).move_to([3.9, ry, 0])
            self.play(GrowArrow(drop), FadeIn(name, scale=0.9), run_time=b.t(0.12))
            _at(self, b, 0.45)
            self.play(Create(ribbon), FadeIn(code_c), run_time=b.t(0.1))
            self.play(FadeIn(timer, shift=RIGHT * 0.2), run_time=b.t(0.08))
            self.play(FadeIn(prom, shift=RIGHT * 0.2), run_time=b.t(0.08))
            carries = caption("every timer and promise carries the name", color=ASYNC_CTX)
            self.play(FadeIn(carries), Indicate(timer, color=ASYNC_CTX), Indicate(prom, color=ASYNC_CTX),
                      run_time=b.t(0.14))


# ================================================================ crash_record
class CrashRecord(DWScene):
    BEATS = [("escape", 3.98), ("handler", 7.02), ("record", 9.72), ("fields", 9.33), ("sync", 11.04), ("credit", 6.43)]

    def construct(self):
        with self.beat("escape") as b:
            outline = _outline_in(self, b, ("late_error", "notice"), frac=0.6)

        with self.beat("handler") as b:
            _at(self, b, 0.1)
            self.play(outline.fill_in("name_process_handlers"), run_time=b.t(0.15))
            two = caption("one process handler for each of the two events")
            self.play(FadeIn(two), run_time=b.t(0.1))
            _at(self, b, 0.5)
            hook = caption("the handler calls the crash hook of deepWidgets", color=ISOLATION)
            self.play(FadeOut(two), FadeIn(hook), run_time=b.t(0.12))

        with self.beat("record") as b:
            self.play(FadeOut(hook), outline.highlight("notice", "find_who"), run_time=b.t(0.08))
            store = caption("get store finds the widget", color=ASYNC_CTX)
            self.play(FadeIn(store), run_time=b.t(0.06))
            outline.trace(self, ("late_error", "notice", "find_who"), PATH_A, run_time=b.t(0.16))
            _at(self, b, 0.33)
            self.play(FadeOut(store), outline.highlight("write_down"), run_time=b.t(0.08))
            self.play(outline.fill_in("name_crash_json"), run_time=b.t(0.08))
            disk = caption("the crash record: a small JSON file on disk", color=RECORDS)
            _at(self, b, 0.56)
            self.play(FadeIn(disk), run_time=b.t(0.06))
            _at(self, b, 0.86)
            self.play(FadeOut(outline), FadeOut(disk), run_time=b.left)

        title = scene_title("The crash record", RECORDS)
        rec = _code(_RECORD, language="json")
        rec.move_to([0, 0, 0]).align_to([0, CONTENT_TOP - 0.05, 0], UP).to_edge(LEFT, buff=MARGIN + 0.2)
        fname = _fname("crash.json   records.ts:25-41")
        illus = T("values illustrative", SMALL, MUTED).next_to(rec, DOWN, buff=0.15).align_to(rec, LEFT)
        hide_lines(rec)

        with self.beat("fields") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(rec), FadeIn(fname), FadeIn(illus),
                      run_time=b.t(0.08))
            # widget, event, error, time, pid (the order of the voice), then the fingerprint
            cues = ((0.06, (0, 1)), (0.17, (4,)), (0.26, (2,)), (0.37, (3,)), (0.49, (8, 5, 6, 9)))
            for at, idx in cues:
                _at(self, b, at)
                self.play(*[rec.code_lines[i].animate.set_opacity(1) for i in idx], run_time=b.t(0.07))
            _at(self, b, 0.68)
            self.play(rec.code_lines[7].animate.set_opacity(1), run_time=b.t(0.06))
            mk = _mark(rec, 7, color=RECORDS)
            fp = T("fingerprint of the widget files", LABEL, RECORDS, bold=True)
            fp.next_to(mk, RIGHT, buff=0.5)
            self.play(Create(mk), FadeIn(fp, shift=LEFT * 0.2), run_time=b.t(0.12))

        claim = _code(_CLAIM)
        claim.move_to([0, 0, 0]).align_to([0, CONTENT_TOP - 0.05, 0], UP).to_edge(LEFT, buff=MARGIN + 0.2)
        fname2 = _fname("isolation.ts:342-368")

        with self.beat("sync") as b:
            self.play(FadeOut(VGroup(rec, illus, mk, fp)), FadeOut(fname), FadeIn(claim), FadeIn(fname2),
                      run_time=b.t(0.08))
            m_store = _mark(claim, 3, color=ASYNC_CTX)
            self.play(Create(m_store), run_time=b.t(0.06))
            m_write = _mark(claim, 5, color=RECORDS)
            w_note = VGroup(T("synchronous write:", SMALL, RECORDS),
                            T("a temp file, then rename", SMALL, TEXT),
                            T("records.ts:81-87", SMALL, MUTED, mono=True)).arrange(DOWN, buff=0.08, aligned_edge=LEFT)
            w_note.next_to(m_write, RIGHT, buff=0.5)
            self.play(ReplacementTransform(m_store, m_write), FadeIn(w_note, shift=LEFT * 0.2), run_time=b.t(0.1))
            _at(self, b, 0.31)
            m_exit = _mark(claim, 10, color=ISOLATION)
            e_note = T("exit code 1", LABEL, ISOLATION, bold=True).next_to(m_exit, RIGHT, buff=0.5)
            self.play(Create(m_exit), FadeIn(e_note, shift=LEFT * 0.2), run_time=b.t(0.1))
            _at(self, b, 0.45)
            asy = VGroup(T("an async write might not finish before the exit", SMALL, TEXT), claim_tag("inferred"))
            asy.arrange(RIGHT, buff=0.25).next_to(claim, DOWN, buff=0.2).align_to(claim, LEFT)
            self.play(FadeIn(asy), run_time=b.t(0.1))
            _at(self, b, 0.72)
            nowait = caption("no wait, no resume", color=ISOLATION)
            self.play(FadeIn(nowait), Indicate(e_note, color=ISOLATION), run_time=b.t(0.12))

        with self.beat("credit") as b:
            self.play(FadeOut(VGroup(claim, m_write, w_note, m_exit, e_note, asy, nowait, fname2)),
                      run_time=b.t(0.1))
            row1 = VGroup(chip("stop", TEXT, mono=False, size=BODY), T("=", HEADING, MUTED),
                          chip("crash", ISOLATION, mono=False, size=BODY)).arrange(RIGHT, buff=0.35)
            row2 = VGroup(chip("start", TEXT, mono=False, size=BODY), T("=", HEADING, MUTED),
                          chip("recover", SUPERVISOR, mono=False, size=BODY)).arrange(RIGHT, buff=0.35)
            pair = VGroup(row1, row2).arrange(DOWN, buff=0.5).move_to([0, 0.9, 0])
            name = T("crash only software", HEADING, TEXT, bold=True).move_to([0, 2.35, 0])
            credit = _credit('George Candea and Armando Fox, "Crash-Only Software"', "(HotOS 2003)")
            credit.move_to([0, -1.4, 0])
            self.play(FadeIn(name), FadeIn(credit), run_time=b.t(0.14))
            _at(self, b, 0.53)
            self.play(FadeIn(row1, shift=UP * 0.2), run_time=b.t(0.12))
            _at(self, b, 0.75)
            self.play(FadeIn(row2, shift=UP * 0.2), run_time=b.t(0.12))


# ================================================================ watchdog
class Watchdog(DWScene):
    BEATS = [("outline", 6.21), ("strip", 13.5), ("act", 8.38), ("kill", 6.77), ("why", 16.14)]

    def construct(self):
        with self.beat("outline") as b:
            outline = _outline_in(self, b, ("endless_loop", "notice"), frac=0.4)
            _at(self, b, 0.45)
            self.play(outline.fill_in("name_watchdog"), run_time=b.t(0.15))
            _at(self, b, 0.85)
            self.play(FadeOut(outline), run_time=b.left)

        title = scene_title("The watchdog", WORKER)
        host = _host_frame(-6.6, 6.6, -2.85, 2.9)
        main = _lane("main thread", HOST, -6.35, 6.35, 0.7, 2.45)
        work = _lane("watchdog (worker thread)", WORKER, -6.35, 6.35, -2.65, -0.75)
        stack = CallStack(width=2.2, frame_h=0.42, max_frames=2)
        stack.remove(stack.title)
        stack.shift(_base_at(stack, -4.2, 0.85))
        strip = _Strip(cell_w=1.15)
        strip.move_to([1.0, 0.0, 0])
        c0, c1 = strip.cells
        hb_l = T("heartbeat", LABEL, HEARTBEAT, bold=True).next_to(strip, LEFT, buff=0.25)
        wn_l = T("widget number", LABEL, HEARTBEAT, bold=True).next_to(strip, RIGHT, buff=0.25)
        rec_ref = T("records.ts:43-48", SMALL, MUTED, mono=True).next_to(hb_l, LEFT, buff=0.35)
        beat_a = _arrow([c0.get_x(), 1.45, 0], c0.get_top(), HOST)
        beat_l = T("+1 every 100 ms", SMALL, HOST, mono=True).next_to(beat_a, LEFT, buff=0.15).set_y(1.2)
        look_a = _arrow(c0.get_bottom(), [c0.get_x(), -1.3, 0], WORKER)
        eye = Dot([c0.get_x(), -1.45, 0], radius=0.1, color=WORKER)
        look_l = T("look every 50 ms", SMALL, WORKER, mono=True).next_to(eye, RIGHT, buff=0.25)

        with self.beat("strip") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(host), FadeIn(main), FadeIn(work),
                      FadeIn(strip), FadeIn(hb_l), FadeIn(rec_ref), run_time=b.t(0.06))
            self.play(GrowArrow(look_a), FadeIn(eye), FadeIn(look_l), run_time=b.t(0.05))
            self.play(GrowArrow(beat_a), FadeIn(beat_l), strip.set(0, "1"), run_time=b.t(0.04))
            for i in range(2, 4):
                self.play(strip.set(0, str(i)), Flash(eye, color=WORKER, line_length=0.12), run_time=b.t(0.035))
            _at(self, b, 0.17)
            self.play(FadeIn(wn_l), FadeIn(stack), run_time=b.t(0.05))
            # the wrap writes the widget number while widget code runs
            _at(self, b, 0.285)
            self.play(stack.push("pinger"), strip.set(0, "4"), run_time=b.t(0.05))
            wrap = SurroundingRectangle(stack.top, color=ASYNC_CTX, buff=0.08, stroke_width=3, corner_radius=0.06)
            wrap_l = T("wrap", SMALL, ASYNC_CTX, bold=True).next_to(wrap, UP, buff=0.08)
            self.play(Create(wrap), FadeIn(wrap_l), run_time=b.t(0.05))
            _at(self, b, 0.43)
            xch = chip("Atomics.exchange", MUTED).move_to([4.0, 1.62, 0])
            idx = T("pinger = 1 (illustrative)", SMALL, MUTED).next_to(wn_l, DOWN, buff=0.12).align_to(wn_l, LEFT)
            self.play(strip.set(1, "1"), Flash(c1, color=ASYNC_CTX, line_length=0.15), FadeIn(xch), FadeIn(idx),
                      run_time=b.t(0.07))
            self.play(Indicate(strip.vals[1], color=HEARTBEAT), strip.set(0, "5"), run_time=b.t(0.05))
            _at(self, b, 0.8)
            fin = chip("finally: Atomics.store", MUTED).move_to([4.0, 1.05, 0])
            ref = T("watchdog.ts:40-49", SMALL, MUTED, mono=True).move_to([0, 2.15, 0]).align_to([6.1, 0, 0], RIGHT)
            self.play(stack.pop(), FadeOut(wrap), FadeOut(wrap_l), strip.set(1, "0"), FadeIn(fin), FadeIn(ref),
                      run_time=b.t(0.08))
            self.play(strip.set(0, "6"), Flash(eye, color=WORKER, line_length=0.12), run_time=b.t(0.04))

        clock = T("no beat for 0 ms", SMALL, WORKER, mono=True).move_to([0.6, -2.2, 0])
        rec = VGroup(disk_icon(s=0.42), VGroup(T("crash.json", SMALL, RECORDS, mono=True),
                                               T("event: 'stall'", SMALL, TEXT, mono=True)).arrange(
            DOWN, buff=0.08, aligned_edge=LEFT)).arrange(RIGHT, buff=0.2).move_to([4.45, -2.0, 0])

        with self.beat("act") as b:
            self.play(FadeOut(VGroup(xch, fin, ref)), stack.push("spinner"), strip.set(1, "2"),
                      Transform(idx, T("spinner = 2 (illustrative)", SMALL, MUTED).move_to(idx, aligned_edge=LEFT)),
                      run_time=b.t(0.08))
            self.play(stack.push_cube("endless loop", mono=False), FadeIn(clock), run_time=b.t(0.07))
            for ms in (500, 1000, 1500, 2000):
                new = T(f"no beat for {ms} ms", SMALL, ISOLATION if ms == 2000 else WORKER, mono=True)
                self.play(Transform(clock, new.move_to(clock)), Flash(eye, color=WORKER, line_length=0.12),
                          run_time=b.t(0.06))
            _at(self, b, 0.4)
            read = _arrow(c1.get_bottom(), [c1.get_x(), -1.15, 0], WORKER)
            self.play(GrowArrow(read), Indicate(strip.vals[1], color=WORKER, scale_factor=1.4), run_time=b.t(0.1))
            _at(self, b, 0.68)
            self.play(FadeIn(rec, shift=UP * 0.15), run_time=b.t(0.1))

        with self.beat("kill") as b:
            kill = _arrow([5.7, -1.55, 0], [5.7, 0.75, 0], ISOLATION, sw=6, tip=0.25)
            kill_l = T("SIGKILL", LABEL, ISOLATION, mono=True, bold=True).next_to(kill.get_end(), LEFT, buff=0.15)
            kill_l.shift(UP * 0.3)
            self.play(GrowArrow(kill), FadeIn(kill_l), run_time=b.t(0.12))
            self.play(host.box.animate.set_stroke(ISOLATION, width=6), main.band.animate.set_stroke(ISOLATION),
                      FadeIn(burst().next_to(stack.top, RIGHT, buff=0.2)), run_time=b.t(0.1))
            _at(self, b, 0.42)
            pic = Group(*_others(self, title))
            card = _top(_code(_WDW_KILL))
            fname = _fname("watchdog-worker.ts:181-199")
            self.play(FadeOut(pic), FadeIn(card), FadeIn(fname), run_time=b.t(0.1))
            self.play(Create(_mark(card, 2, 3, color=RECORDS)), Create(_mark(card, 7, color=ISOLATION)),
                      run_time=b.t(0.1))
            refuse = caption("the host cannot refuse, even in an endless loop", color=ISOLATION)
            self.play(FadeIn(refuse), run_time=b.t(0.08))

        with self.beat("why") as b:
            olds = _others(self, title)
            card = _top(_code(_WD_CONST))
            fname = _fname("watchdog.ts:24-29")
            ann = VGroup(T("= 100 ms", SMALL, MUTED, mono=True), T("= 50 ms", SMALL, MUTED, mono=True))
            ann[0].next_to(card, RIGHT, buff=0.2).set_y(card.code_lines[2].get_y())
            ann[1].next_to(card, RIGHT, buff=0.2).set_y(card.code_lines[3].get_y())
            self.play(*[FadeOut(m) for m in olds], FadeIn(card), FadeIn(fname), run_time=b.t(0.06))
            mk = _mark(card, 0, color=WORKER)
            self.play(Create(mk), FadeIn(ann), run_time=b.t(0.06))

            tl = _Timeline(-5.8, 5.8, -0.55, ticks=(0, 500, 2000))
            bar = Rectangle(width=tl.x(868) - tl.x(0), height=0.3, stroke_color=TEXT, stroke_width=2,
                            fill_color=TEXT, fill_opacity=0.55)
            bar.move_to(tl.p(434, 0.35))
            bar_l = VGroup(T("150 MB JSON.parse: 868 ms, host lived", SMALL, TEXT), claim_tag("ran")).arrange(
                RIGHT, buff=0.2)
            bar_l.next_to(bar, UP, buff=0.12).align_to(bar, LEFT)
            bar_r = T("watchdog check at 108d663f", SMALL, MUTED).next_to(tl.ticks, DOWN, buff=0.2)
            bar_r.align_to(bar, LEFT)
            _at(self, b, 0.14)
            self.play(Create(tl), run_time=b.t(0.06))
            _at(self, b, 0.33)
            self.play(GrowFromEdge(bar, LEFT), FadeIn(bar_l), FadeIn(bar_r), run_time=b.t(0.08))
            _at(self, b, 0.65)
            m500 = DashedLine(tl.p(500, -0.25), tl.p(500, 0.55), stroke_color=ISOLATION, stroke_width=4,
                              dash_length=0.1)
            l500 = VGroup(T("500 ms limit: a false kill", SMALL, ISOLATION),
                          T("where-we-stand.md:242", SMALL, MUTED, mono=True)).arrange(DOWN, buff=0.08,
                                                                                    aligned_edge=LEFT)
            l500.next_to(bar_r, DOWN, buff=0.2).align_to(bar_r, LEFT)
            self.play(Create(m500), FadeIn(l500), run_time=b.t(0.08))
            _at(self, b, 0.92)
            m2 = Line(tl.p(2000, -0.25), tl.p(2000, 0.9), stroke_color=WORKER, stroke_width=5)
            room = DoubleArrow(tl.p(868, 0.35) + RIGHT * 0.1, tl.p(2000, 0.35) + LEFT * 0.1, buff=0,
                               color=SUPERVISOR, stroke_width=4, tip_length=0.18,
                               max_tip_length_to_length_ratio=0.2)
            room_l = T("room", LABEL, SUPERVISOR, bold=True).next_to(room, UP, buff=0.1)
            self.play(Create(m2), GrowFromCenter(room), FadeIn(room_l), run_time=b.left)


# ================================================================ provisional_record
class ProvisionalRecord(DWScene):
    BEATS = [("outline", 4.91), ("death", 7.82), ("early", 8.69), ("fields", 4.2), ("number", 12.0),
             ("back", 6.93), ("planned", 8.45)]

    def construct(self):
        with self.beat("outline") as b:
            outline = _outline_in(self, b, ("write_down",), frac=0.3)
            _at(self, b, 0.25)
            self.play(outline.fill_in("name_provisional_json"), run_time=b.t(0.15))
            _at(self, b, 0.57)
            asked = _asked(*_Q_PROVISIONAL).move_to([0, -0.2, 0])
            self.play(FadeOut(outline), FadeIn(asked, shift=UP * 0.2), run_time=b.left)

        title = scene_title("The provisional record", RECORDS)
        host = _host_frame(-6.4, -0.6, -2.4, 2.5)
        heap = rbox(4.6, 2.6, HEAP, fill=0.04, sw=2.5).move_to([-3.5, 0.1, 0])
        heap_t = T("heap", LABEL, HEAP, bold=True).next_to(heap.get_top(), DOWN, buff=0.12)
        fill = Rectangle(width=4.4, height=0.01, stroke_width=0, fill_color=HEAP, fill_opacity=0.45)
        fill.move_to(heap.get_bottom() + UP * 0.12, aligned_edge=DOWN)
        full = T("full", LABEL, ISOLATION, bold=True).move_to(heap)

        with self.beat("death") as b:
            self.play(FadeOut(asked), FadeIn(title, shift=RIGHT * 0.2), FadeIn(host), FadeIn(heap),
                      FadeIn(heap_t), run_time=b.t(0.1))
            _at(self, b, 0.38)
            self.play(fill.animate.stretch_to_fit_height(2.1, about_edge=DOWN), rate_func=linear,
                      run_time=b.t(0.15))
            self.add(fill)
            self.play(FadeIn(full), run_time=b.t(0.04))
            _at(self, b, 0.56)
            v8 = VGroup(chip("V8", TEXT, mono=False), T("ends the host:", SMALL, TEXT),
                        T("SIGABRT", LABEL, ISOLATION, mono=True, bold=True)).arrange(RIGHT, buff=0.2)
            v8.move_to([3.0, 1.2, 0])
            self.play(FadeIn(v8), host.box.animate.set_stroke(ISOLATION, width=5), run_time=b.t(0.1))
            _at(self, b, 0.82)
            none = T("no JavaScript runs", LABEL, ISOLATION, bold=True).move_to([3.0, 0.1, 0])
            gone = VGroup(chip("process handler", EMITTER, mono=False), chip("crash hook", ISOLATION, mono=False))
            gone.arrange(DOWN, buff=0.25).next_to(none, DOWN, buff=0.35)
            strikes = VGroup(*[_strike(g) for g in gone])
            self.play(FadeIn(none), FadeIn(gone), run_time=b.t(0.08))
            self.play(Create(strikes), gone.animate.set_opacity(0.4), run_time=b.t(0.08))

        tl = _Timeline(-5.6, 5.6, 1.3)
        stop = VGroup(T("beat stops", SMALL, HEARTBEAT)).next_to(tl.p(0), UP, buff=0.25)
        note = chip("provisional.json", RECORDS).next_to(tl.p(500), UP, buff=0.25)
        note_r = T("watchdog-worker.ts:166-180", SMALL, MUTED, mono=True).next_to(note, UP, buff=0.12)
        note_r.align_to(note, LEFT)
        kill = chip("crash record + SIGKILL", ISOLATION, mono=False).next_to(tl.p(2000), UP, buff=0.25)
        kill.align_to([tl.x1 + 0.3, 0, 0], RIGHT)
        head = Dot(tl.p(0), radius=0.11, color=TEXT)

        with self.beat("early") as b:
            pic = VGroup(host, heap, heap_t, fill, full, v8, none, gone, strikes)
            self.play(FadeOut(pic), run_time=b.t(0.08))
            just = caption("a note, early, just in case", color=RECORDS)
            self.play(FadeIn(just), run_time=b.t(0.06))
            self.play(Create(tl), FadeIn(stop), FadeIn(head), FadeIn(kill), run_time=b.t(0.1))
            _at(self, b, 0.36)
            self.play(head.animate.move_to(tl.p(500)), rate_func=linear, run_time=b.t(0.2))
            _at(self, b, 0.76)
            self.play(FadeIn(note, shift=UP * 0.15), FadeIn(note_r), run_time=b.t(0.1))

        card = _code(_PROV_FIELDS, language="json")
        hdr = T("same fields as crash.json, but:", LABEL, TEXT)
        fields = VGroup(hdr, card).arrange(DOWN, buff=0.2, aligned_edge=LEFT).move_to([0, -1.2, 0])

        with self.beat("fields") as b:
            self.play(FadeOut(just), FadeIn(hdr), run_time=b.t(0.15))
            _at(self, b, 0.55)
            self.play(FadeIn(card, shift=UP * 0.15), run_time=b.t(0.15))

        strip = _Strip(cell_w=1.0).move_to([-3.4, -0.55, 0])
        s_hb = T("heartbeat", SMALL, HEARTBEAT).next_to(strip, LEFT, buff=0.2)
        s_wn = T("widget number", SMALL, HEARTBEAT).next_to(strip, RIGHT, buff=0.2)
        s_ref = VGroup(s_hb, s_wn)

        with self.beat("number") as b:
            self.play(FadeOut(fields), FadeIn(strip), FadeIn(s_ref), run_time=b.t(0.06))
            self.play(strip.set(1, "1"), run_time=b.t(0.04))
            link = _arrow(strip.cells[1].get_top(), note.get_bottom() + LEFT * 0.4, HEARTBEAT)
            who = T("pinger", SMALL, TEXT, mono=True).next_to(link, RIGHT, buff=0.1).shift(DOWN * 0.2)
            self.play(GrowArrow(link), FadeIn(who), run_time=b.t(0.08))
            _at(self, b, 0.24)
            no_note = VGroup(_x_mark().move_to(note), T("no number: no note", SMALL, ISOLATION))
            no_note[1].next_to(s_wn, RIGHT, buff=0.5)
            self.play(strip.set(1, "0"), FadeOut(who), link.animate.set_opacity(0.25), FadeIn(no_note),
                      note.animate.set_opacity(0.35), run_time=b.t(0.1))
            _at(self, b, 0.45)
            self.play(FadeOut(no_note), note.animate.set_opacity(1), link.animate.set_opacity(1),
                      strip.set(1, "1"), run_time=b.t(0.06))
            # the call: the number covers only its synchronous part
            y = -2.25
            seg_a = rbox(5.0, 0.55, ASYNC_CTX, fill=0.25, sw=2.5, r=0.08).move_to([-2.9, y, 0])
            seg_a_t = T("sync part: number set", SMALL, TEXT).move_to(seg_a)
            aw = T("await", SMALL, PROMISE, mono=True, bold=True).move_to([0.25, y, 0])
            seg_b = rbox(5.0, 0.55, MUTED, fill=0.04, sw=2, r=0.08, dashed=True).move_to([3.4, y, 0])
            seg_b_t = T("after it: no number", SMALL, MUTED).move_to(seg_b)
            calls = T("widget start, or action call", SMALL, ASYNC_CTX).next_to(seg_a, UP, buff=0.12)
            calls.align_to(seg_a, LEFT)
            self.play(FadeIn(seg_a), FadeIn(seg_a_t), FadeIn(calls), run_time=b.t(0.08))
            _at(self, b, 0.88)
            self.play(FadeIn(aw), FadeIn(seg_b), FadeIn(seg_b_t), strip.set(1, "0"), run_time=b.t(0.1))

        tl2 = _Timeline(-5.6, 5.6, -0.7, ticks=(0, 500, 1200))
        stop2 = T("beat stops", SMALL, HEARTBEAT).next_to(tl2.p(0), UP, buff=0.25)
        note2 = chip("provisional.json", RECORDS).next_to(tl2.p(500), UP, buff=0.25)
        back = T("beat back", SMALL, HEARTBEAT).next_to(tl2.p(1200), UP, buff=0.25)
        gone_l = T("deleted at the next look", SMALL, RECORDS).next_to(tl2.p(1250), DOWN, buff=0.75)
        gone_r = T("watchdog-worker.ts:150-156", SMALL, MUTED, mono=True).next_to(gone_l, DOWN, buff=0.08)
        gone_r.align_to(gone_l, LEFT)
        head2 = Dot(tl2.p(0), radius=0.11, color=TEXT)

        with self.beat("back") as b:
            olds = VGroup(strip, s_ref, link, seg_a, seg_a_t, aw, seg_b, seg_b_t, calls)
            self.play(FadeOut(olds), run_time=b.t(0.06))
            self.play(Create(tl2), FadeIn(stop2), FadeIn(head2), FadeIn(note2), run_time=b.t(0.1))
            self.play(head2.animate.move_to(tl2.p(1200)), rate_func=linear, run_time=b.t(0.15))
            self.play(FadeIn(back), run_time=b.t(0.06))
            self.play(head2.animate.move_to(tl2.p(1250)), note2.animate.set_opacity(0.2),
                      FadeIn(gone_l), FadeIn(gone_r), run_time=b.t(0.1))
            _at(self, b, 0.55)
            follows = caption("the note follows the heartbeat, not the call", color=HEARTBEAT)
            self.play(FadeIn(follows), run_time=b.t(0.1))

        with self.beat("planned") as b:
            olds = _others(self, title)
            asked = _asked(*_Q_EFFECT).move_to([0, 1.75, 0])
            self.play(*[FadeOut(m) for m in olds], FadeIn(asked, shift=UP * 0.2), run_time=b.t(0.1))
            ans = T("no: the note follows the heartbeat", LABEL, TEXT).next_to(asked, DOWN, buff=0.35)
            self.play(FadeIn(ans), run_time=b.t(0.08))
            _at(self, b, 0.3)
            plan_t = VGroup(T("planned: deepWidgets removes the record when the call returns", SMALL, OPEN),
                            T("docs/specs/widget-fv.md:61", SMALL, MUTED, mono=True))
            plan_t.arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            plan = VGroup(rbox(plan_t.width + 0.5, plan_t.height + 0.4, OPEN, fill=0.04, sw=2.5, dashed=True), plan_t)
            plan_t.move_to(plan[0])
            plan.move_to([0, -1.1, 0])
            self.play(FadeIn(plan, shift=UP * 0.2), run_time=b.t(0.1))
            _at(self, b, 0.82)
            nb = T("not built", LABEL, OPEN, bold=True).next_to(plan, DOWN, buff=0.25)
            self.play(FadeIn(nb), run_time=b.t(0.08))


# ================================================================ supervisor
class Supervisor(DWScene):
    BEATS = [("outline", 6.6), ("facts", 8.39), ("records", 11.88), ("abort", 13.08), ("restart", 16.41)]

    def construct(self):
        with self.beat("outline") as b:
            outline = _outline_in(self, b, ("start_again",), frac=0.35)
            _at(self, b, 0.56)
            self.play(outline.fill_in("name_supervisor"), run_time=b.t(0.15))
            _at(self, b, 0.86)
            self.play(FadeOut(outline), run_time=b.left)

        title = scene_title("The supervisor", SUPERVISOR)
        fname = _fname("apps/desktop/src/deepwidgets-supervisor.ts")
        app = _host_frame(-6.5, -0.9, -2.3, 2.5, label="app process", color=SUPERVISOR)
        sup = ProcessBox("supervisor", "DesktopHostSupervisor", color=SUPERVISOR).move_to([-3.7, 1.0, 0])
        host = _host_frame(2.2, 6.4, -0.3, 1.9, label="host child")
        link = DashedLine(sup.get_right(), host.box.get_left(), stroke_color=MUTED, stroke_width=3, dash_length=0.12)
        facts = VGroup(*[VGroup(chip(c, HOST), T(w, SMALL, MUTED)).arrange(RIGHT, buff=0.2)
                         for c, w in (("hostPid", "PID"), ("hostCode", "exit code"), ("hostSignal", "signal"))])
        facts.arrange(DOWN, buff=0.18, aligned_edge=LEFT).move_to([-3.7, -0.85, 0])

        with self.beat("facts") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(fname), FadeIn(app), FadeIn(sup), run_time=b.t(0.08))
            self.play(FadeIn(host), Create(link), run_time=b.t(0.1))
            _at(self, b, 0.25)
            x = _x_mark(s=0.35).move_to(host.box)
            self.play(host.animate.set_opacity(0.35), Create(x), run_time=b.t(0.1))
            _at(self, b, 0.6)
            for f in facts:
                start = f.copy().move_to(host.box)
                self.play(TransformFromCopy(start, f), run_time=b.t(0.08))

        with self.beat("records") as b:
            olds = VGroup(app, sup, host, link, facts, x)
            rule = _card("crash.json counts if pid === dead pid", color=RECORDS, mono=True,
                         sub="lines 58-63, 93-94").move_to([0, 2.15, 0])
            self.play(FadeOut(olds), run_time=b.t(0.06))
            self.play(FadeIn(rule, shift=DOWN * 0.15), run_time=b.t(0.08))
            row_a = VGroup(chip("crash.json  pid 68722", RECORDS), T("=", BODY, TEXT),
                           chip("dead host  pid 68722", HOST)).arrange(RIGHT, buff=0.3)
            ok = VGroup(_tick(), T("counts", SMALL, SUPERVISOR)).arrange(RIGHT, buff=0.15)
            row_b = VGroup(chip("crash.json  pid 51200", RECORDS), T("≠", BODY, TEXT),
                           chip("dead host  pid 68722", HOST)).arrange(RIGHT, buff=0.3)
            no = VGroup(_x_mark(s=0.14), T("old record: no blame", SMALL, ISOLATION)).arrange(RIGHT, buff=0.15)
            row_a.move_to([-1.9, 0.75, 0])
            row_b.move_to([-1.9, -0.35, 0])
            ok.next_to(row_a, RIGHT, buff=0.4)
            no.next_to(row_b, RIGHT, buff=0.4)
            pids = T("PIDs illustrative", SMALL, MUTED).next_to(row_b, DOWN, buff=0.25).align_to(row_b, LEFT)
            _at(self, b, 0.28)
            self.play(FadeIn(row_a), run_time=b.t(0.08))
            self.play(FadeIn(ok), run_time=b.t(0.06))
            _at(self, b, 0.5)
            self.play(FadeIn(row_b), FadeIn(pids), run_time=b.t(0.08))
            self.play(FadeIn(no), run_time=b.t(0.06))
            _at(self, b, 0.78)
            rare = _note("one rare case: the limits part shows it").move_to([0, -1.9, 0])
            self.play(FadeIn(rare), run_time=b.t(0.08))

        with self.beat("abort") as b:
            self.play(FadeOut(VGroup(rule, row_a, ok, row_b, no, pids, rare)), run_time=b.t(0.06))
            r2 = _card("provisional.json counts only after an abort", color=RECORDS,
                       sub="lines 70-79, 95-96").move_to([0, 2.15, 0])
            code = _code(_ABORT).next_to(r2, DOWN, buff=0.3)
            self.play(FadeIn(r2, shift=DOWN * 0.15), run_time=b.t(0.08))
            self.play(FadeIn(code), run_time=b.t(0.08))
            _at(self, b, 0.39)
            r3 = _card("any other end: discard provisional.json", color=OPEN, sub="line 159")
            r3.next_to(code, DOWN, buff=0.3)
            self.play(FadeIn(r3, shift=DOWN * 0.15), run_time=b.t(0.08))
            _at(self, b, 0.64)
            r4 = _card("crash.json of the dead host always wins", color=ISOLATION, sub="lines 93-94")
            r4.next_to(r3, DOWN, buff=0.3)
            self.play(FadeIn(r4, shift=DOWN * 0.15), run_time=b.t(0.08))

        with self.beat("restart") as b:
            self.play(FadeOut(VGroup(r2, code, r3, r4)), run_time=b.t(0.04))
            fname2 = _fname("apps/desktop/src/deepwidgets-crash-policy.ts:10-16")
            rows = [("wait before each restart", "500 ms, 2000 ms, 8000 ms"),
                    ("a crash with a blamed widget", "waits 500 ms, not counted"),
                    ("crashes with no blame count for", "60 s"),
                    ("built-in widgets only from", "2 crashes with no blame"),
                    ("restarts stop at", "4 crashes with no blame")]
            tbl = RevealTable(["rule", "value"], rows, mono_cols=(), size=LABEL, row_gap=0.32)
            tbl.move_to([0, 0.4, 0])
            self.play(FadeOut(fname), FadeIn(fname2), FadeIn(tbl), run_time=b.t(0.05))
            self.play(tbl.reveal_row(0), run_time=b.t(0.05))
            _at(self, b, 0.2)
            self.play(tbl.reveal_row(1), run_time=b.t(0.05))
            _at(self, b, 0.4)
            self.play(tbl.reveal_row(2), run_time=b.t(0.05))
            _at(self, b, 0.54)
            mk = tbl.mark_row(0, color=SUPERVISOR)
            self.play(Create(mk), run_time=b.t(0.05))
            _at(self, b, 0.73)
            self.play(tbl.reveal_row(3), FadeOut(mk), run_time=b.t(0.05))
            _at(self, b, 0.88)
            self.play(tbl.reveal_row(4), run_time=b.t(0.05))
            self.play(Create(tbl.mark_row(4, color=ISOLATION)), run_time=b.t(0.05))


# ================================================================ quarantine
class Quarantine(DWScene):
    BEATS = [("outline", 9.15), ("held", 9.38), ("lift", 8.97), ("fowler", 7.96), ("others", 0.92), ("close", 1.9)]

    def construct(self):
        with self.beat("outline") as b:
            outline = _outline_in(self, b, ("keep_off",), frac=0.3)
            _at(self, b, 0.38)
            nxt = caption("the next host reads the record at its start")
            self.play(FadeIn(nxt), run_time=b.t(0.08))
            _at(self, b, 0.82)
            self.play(outline.fill_in("name_quarantine"), run_time=b.t(0.12))

        title = scene_title("Quarantine", ISOLATION)
        card = _top(_code(_QUARANTINE))
        fname = _fname("isolation.ts:223-245")

        with self.beat("held") as b:
            self.play(FadeOut(outline), FadeOut(nxt), run_time=b.t(0.06))
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(card), FadeIn(fname), run_time=b.t(0.06))
            m1 = _mark(card, 0, 2, color=RECORDS)
            self.play(Create(m1), run_time=b.t(0.06))
            _at(self, b, 0.2)
            m2 = _mark(card, 9, 10, color=ISOLATION)
            fp = T("same fingerprint: held", LABEL, ISOLATION, bold=True).next_to(m2, DOWN, buff=0.15)
            fp.align_to(m2, RIGHT)
            self.play(ReplacementTransform(m1, m2), FadeIn(fp), run_time=b.t(0.08))
            _at(self, b, 0.58)
            win = window_card("pinger", w=7.4, h=2.0, color=WIDGET).move_to([0, -0.3, 0])
            fail = VGroup(T("failed", LABEL, ISOLATION, bold=True),
                          T("quarantined after a crash (…)", SMALL, TEXT)).arrange(DOWN, buff=0.15)
            fail.move_to(_body(win))
            qf = T("$DSH_HOME/deepwidgets/quarantine.json", SMALL, RECORDS, mono=True).next_to(win, DOWN, buff=0.3)
            self.play(FadeOut(VGroup(card, m2, fp, fname)), FadeIn(win), run_time=b.t(0.08))
            self.play(FadeIn(fail), FadeIn(qf), win.frame.animate.set_stroke(ISOLATION), run_time=b.t(0.08))

        with self.beat("lift") as b:
            self.play(FadeOut(VGroup(win, fail, qf)), run_time=b.t(0.06))
            r1 = VGroup(chip("new files of pinger load", WIDGET, mono=False), T("→", BODY, TEXT),
                        chip("quarantine ends", SUPERVISOR, mono=False)).arrange(RIGHT, buff=0.3)
            r2 = VGroup(chip("same broken files reload", WIDGET, mono=False), T("→", BODY, TEXT),
                        chip("still held", ISOLATION, mono=False)).arrange(RIGHT, buff=0.3)
            r1.move_to([0, 1.2, 0])
            r2.move_to([0, -0.4, 0]).align_to(r1, LEFT)
            fix = T("a fix lifts it", LABEL, SUPERVISOR, bold=True).next_to(r1, DOWN, buff=0.2).align_to(r1, LEFT)
            same = T("same fingerprint", SMALL, MUTED).next_to(r2, DOWN, buff=0.2).align_to(r2, LEFT)
            self.play(FadeIn(r1[0]), run_time=b.t(0.08))
            self.play(GrowFromEdge(r1[1], LEFT), FadeIn(r1[2]), run_time=b.t(0.08))
            _at(self, b, 0.43)
            self.play(FadeIn(fix), run_time=b.t(0.08))
            _at(self, b, 0.62)
            self.play(FadeIn(r2), FadeIn(same), run_time=b.t(0.1))

        with self.beat("fowler") as b:
            self.play(FadeOut(VGroup(r1, r2, fix, same)), run_time=b.t(0.06))
            ours = T("the word quarantine is ours", LABEL, TEXT).move_to([0, 2.3, 0])
            self.play(FadeIn(ours), run_time=b.t(0.08))
            _at(self, b, 0.25)
            caller = chip("caller", TEXT, mono=False).move_to([-4.6, 0.6, 0])
            part = chip("failing part", ISOLATION, mono=False).move_to([4.4, 0.6, 0])
            fails = VGroup(*[_x_mark(s=0.12).move_to([1.6 + 0.45 * i, 1.15, 0]) for i in range(3)])
            line_a = Line(caller.get_right(), [-0.6, 0.6, 0], stroke_color=TEXT, stroke_width=4)
            line_b = Line([0.6, 0.6, 0], part.get_left(), stroke_color=TEXT, stroke_width=4)
            sw_closed = Line([-0.6, 0.6, 0], [0.6, 0.6, 0], stroke_color=TEXT, stroke_width=4)
            sw_open = Line([-0.6, 0.6, 0], [0.45, 1.15, 0], stroke_color=ISOLATION, stroke_width=4)
            self.play(FadeIn(caller), FadeIn(part), Create(line_a), Create(sw_closed), Create(line_b),
                      run_time=b.t(0.1))
            self.play(LaggedStart(*[FadeIn(f, scale=1.5) for f in fails], lag_ratio=0.5), run_time=b.t(0.12))
            stopc = T("after repeated failures, stop calling", SMALL, TEXT).move_to([0, -0.3, 0])
            _at(self, b, 0.64)
            self.play(Transform(sw_closed, sw_open), FadeIn(stopc), run_time=b.t(0.1))
            credit = _credit("network calls: Martin Fowler, martinfowler.com (2014)").move_to([0, -1.5, 0])
            self.play(FadeIn(credit), run_time=b.t(0.08))

        with self.beat("others") as b:
            olds = _others(self, title)
            wins = VGroup(*[window_card(n, w=3.6, h=2.0, color=WIDGET) for n in ("sample", "pinger", "spinner")])
            wins.arrange(RIGHT, buff=0.5).move_to([0, 0.2, 0])
            states = VGroup(*[T(s, LABEL, c, bold=True).move_to(_body(w))
                              for s, c, w in (("runs", SUPERVISOR, wins[0]), ("failed", ISOLATION, wins[1]),
                                              ("runs", SUPERVISOR, wins[2]))])
            self.play(*[FadeOut(m) for m in olds], FadeIn(wins), FadeIn(states),
                      wins[1].frame.animate.set_stroke(ISOLATION), run_time=b.left)

        with self.beat("close") as b:
            OutlineDiagram(self).close_part(self, "find_who", next_key="widget_pinger", run_time=b.left)
