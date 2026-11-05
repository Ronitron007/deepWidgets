"""Shared look for the event loop explainer: colors, fonts, sizes, reusable shapes.

Shared base file. Part agents do not edit it. Ask for a change in your report.
"""
from __future__ import annotations

import json as _json

import numpy as np
from manim import *  # noqa: F401,F403

# ---------------------------------------------------------------- canvas
BG = "#14161B"
PANEL = "#1D2027"       # fill of code blocks, tables, panels
TEXT = "#ECEFF4"
MUTED = "#9AA3AF"       # secondary text, table lines, the `read` claim tag
DIM = 0.22              # opacity of a dimmed thing
config.background_color = BG

# ---------------------------------------------------------------- one color per concept
HOST = "#58C4DD"        # the host process (Node in Electron), its main thread lane, the host runtime
WIDGET = "#CBD5E1"      # widget action handlers: the chips sample, pinger, spinner; widget code
STACK = "#FFD166"       # call stack, stack frames, run to completion
TASK = "#6E8BFF"        # task queue, tasks (macrotasks): timer callback, I/O done, HTTP request
MICROTASK = "#E36BF0"   # microtask queue, small balls (microtasks)
PHASE = "#2DD4BF"       # the event loop: the loop arrow (loopviz.LoopArrow). Script v2 shows no phase ring
LOOP = PHASE            # the same color under its plain name
HEAP = "#F2CDCD"        # the heap: objects that live longer than one call
PROMISE = "#A78BFA"     # promises: pending, fulfilled, rejected, then, await
EMITTER = "#FF8C3A"     # EventEmitter: event table, listeners, emit, process handlers
ASYNC_CTX = "#C3E35A"   # async chain, async local storage, the blame store ribbon, the wrap
WORKER = "#F472B6"      # worker thread: the watchdog thread, worker_threads, its own loop
HEARTBEAT = "#7DD3FC"   # shared memory cells: heartbeat, widget number
RECORDS = "#D9B38C"     # records on disk: provisional.json, crash.json, CrashRecord
SUPERVISOR = "#4ADE80"  # the app process (Electron main): the supervisor, restart, waits
ISOLATION = "#FC6255"   # errors, crash, the crash hook, kill, quarantine, the late error and endless loop arrows
INFERRED = "#FFB020"    # amber: an inferred claim (with the word inferred), path B (stuck thread, spinner)
OPEN = "#9AA3AF"        # not built / not covered: grey, drawn dashed
MEASURED = TEXT         # white: a number that we ran and measured
PATH_A = ISOLATION      # path A: late error (pinger), red
PATH_B = INFERRED       # path B: stuck thread (spinner), amber

CONCEPT = {
    "host": HOST, "main_thread": HOST, "widget": WIDGET, "handler": WIDGET,
    "stack": STACK, "call_stack": STACK, "task": TASK, "task_queue": TASK,
    "microtask": MICROTASK, "microtask_queue": MICROTASK, "heap": HEAP,
    "event_loop": LOOP, "loop": LOOP, "promise": PROMISE,
    "emitter": EMITTER, "listener": EMITTER, "process_handlers": EMITTER,
    "async_chain": ASYNC_CTX, "blame_store": ASYNC_CTX, "als": ASYNC_CTX, "wrap": ASYNC_CTX,
    "worker": WORKER, "worker_thread": WORKER, "watchdog": WORKER,
    "heartbeat": HEARTBEAT, "shared_memory": HEARTBEAT, "widget_number": HEARTBEAT,
    "records": RECORDS, "crash_record": RECORDS, "provisional_record": RECORDS, "fingerprint": RECORDS,
    "supervisor": SUPERVISOR, "app_process": SUPERVISOR,
    "error": ISOLATION, "crash": ISOLATION, "crash_hook": ISOLATION, "quarantine": ISOLATION,
    "path_a": PATH_A, "path_b": PATH_B,
    "inferred": INFERRED, "open": OPEN, "measured": MEASURED,
}

# ---------------------------------------------------------------- fonts and sizes
SANS = "Helvetica Neue"
MONO = "Menlo"
# Font size 22 gives a cap height of about 20 px at 720p (measured). Nothing smaller.
MIN_FONT_SIZE = 22
TITLE = 44
HEADING = 34
BODY = 28
LABEL = 24
SMALL = 22
CODE = 22

# ---------------------------------------------------------------- layout (Manim units; frame 14.22 x 8)
FRAME_W = config.frame_width
FRAME_H = config.frame_height
MARGIN = 0.35
TITLE_Y = 3.45          # scene title baseline row
CONTENT_TOP = 2.95      # content goes between CONTENT_TOP and CONTENT_BOTTOM
CONTENT_BOTTOM = -2.85  # below this: the caption strip, keep free
CAPTION_Y = -3.42
CONTENT_W = FRAME_W - 2 * MARGIN
TAG_LEFT = 3.2          # the source tag (bottom right) starts here; captions stay left of it
CAPTION_W = TAG_LEFT - 0.25 - (-FRAME_W / 2 + MARGIN)
CAPTION_X = (-FRAME_W / 2 + MARGIN + TAG_LEFT - 0.25) / 2


# ---------------------------------------------------------------- text
def T(s, size=BODY, color=TEXT, mono=False, bold=False, **kw) -> Text:
    """One line of text. Use mono for code names, paths, numbers from logs."""
    return Text(str(s), font=MONO if mono else SANS, font_size=size, color=color,
                weight=BOLD if bold else NORMAL, **kw)


def M(markup, size=BODY, color=TEXT, mono=False) -> MarkupText:
    """Pango markup, for mixed styles in one line: '<b>host</b> runs <span fgcolor="#FC6255">x</span>'."""
    return MarkupText(markup, font=MONO if mono else SANS, font_size=size, color=color)


def lines(*ls, size=BODY, color=TEXT, mono=False, align=LEFT, buff=0.14) -> VGroup:
    """Several lines stacked, left-aligned by default."""
    g = VGroup(*[T(x, size, color, mono) for x in ls])
    return g.arrange(DOWN, buff=buff, aligned_edge=align)


def fit(m, w=None, h=None):
    """Scale m down to fit w x h. The size lint reports it if text then falls below MIN_FONT_SIZE."""
    if w is not None and m.width > w:
        m.scale_to_fit_width(w)
    if h is not None and m.height > h:
        m.scale_to_fit_height(h)
    return m


def scene_title(text, color=TEXT, size=HEADING) -> VGroup:
    """Heading at the top left, with a short bar in the concept color."""
    t = T(text, size, TEXT, bold=True)
    t.to_edge(LEFT, buff=MARGIN + 0.25).set_y(TITLE_Y)
    bar = Rectangle(width=0.12, height=t.height + 0.1, stroke_width=0, fill_color=color, fill_opacity=1)
    bar.next_to(t, LEFT, buff=0.15)
    return VGroup(bar, t)


def caption(text, size=26, color=TEXT, max_lines=2) -> VGroup:
    """Short on-screen caption in the bottom strip (not subtitles). Wraps to max_lines.
    It sits left of the source tag in the bottom-right corner."""
    words, rows, cur = str(text).split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if cur and T(trial, size).width > CAPTION_W:
            rows.append(cur)
            cur = w
        else:
            cur = trial
    rows.append(cur)
    if len(rows) > max_lines:
        raise ValueError(f"caption needs {len(rows)} lines (max {max_lines}): {text!r}")
    g = VGroup(*[T(r, size, color) for r in rows]).arrange(DOWN, buff=0.1)
    g.move_to([CAPTION_X, CAPTION_Y, 0])
    return g


# ---------------------------------------------------------------- shapes
def rbox(w, h, color=TEXT, fill=0.08, sw=3, r=0.14, dashed=False):
    b = RoundedRectangle(corner_radius=r, width=w, height=h, stroke_color=color, stroke_width=sw,
                         fill_color=color, fill_opacity=fill)
    if dashed:
        d = DashedVMobject(b, num_dashes=max(12, int((w + h) * 5)), dashed_ratio=0.55)
        d.set_stroke(color, sw)
        fillb = b.copy().set_stroke(width=0)
        return VGroup(fillb, d)
    return b


class ProcessBox(VGroup):
    """A box with a title and an optional second line (mono by default).

    .box, .title, .sub. Size follows the text unless width/height are given.
    """

    def __init__(self, title, sub=None, color=HOST, width=None, height=None, title_size=LABEL,
                 sub_size=SMALL, sub_mono=True, dashed=False, fill=0.1, **kw):
        super().__init__(**kw)
        self.title = T(title, title_size, color, bold=True)
        self.sub = T(sub, sub_size, MUTED if not sub_mono else TEXT, mono=sub_mono) if sub else None
        txt = VGroup(self.title, *([self.sub] if self.sub else [])).arrange(DOWN, buff=0.12)
        w = width or txt.width + 0.6
        h = height or txt.height + 0.45
        self.box = rbox(w, h, color, fill=fill, dashed=dashed)
        txt.move_to(self.box)
        self.text = txt
        self.concept_color = color  # not .color: that property recolors the whole group
        self.add(self.box, txt)


def chip(text, color=HOST, size=SMALL, mono=True, fill=0.15, pad=0.22, dashed=False) -> VGroup:
    """Small rounded tag: a slug, a row id, a status, a tool name."""
    t = T(text, size, TEXT, mono=mono)
    b = rbox(t.width + 2 * pad, t.height + pad * 1.2, color, fill=fill, sw=2, r=0.1, dashed=dashed)
    t.move_to(b)
    return VGroup(b, t)


CLAIM_COLORS = {"ran": TEXT, "read": MUTED, "inferred": INFERRED}


def claim_tag(kind) -> VGroup:
    """The claim legend tag of script `cold_open`: 'ran' (white: we ran it on this Mac),
    'read' (grey: read in code or docs), 'inferred' (amber). Put it next to the claim."""
    return chip(kind, CLAIM_COLORS[kind], mono=False, fill=0.12)


def claim_legend() -> VGroup:
    """The three claim tags in one row, with their meanings (script `cold_open`)."""
    rows = [("ran", "we ran it on this Mac"), ("read", "read in code or docs"), ("inferred", "inferred")]
    g = VGroup(*[VGroup(claim_tag(k), T(m, SMALL, MUTED)).arrange(RIGHT, buff=0.15) for k, m in rows])
    return g.arrange(RIGHT, buff=0.45)


def labeled_arrow(start, end, label=None, color=TEXT, size=SMALL, mono=True, side=UP, buff=0.12,
                  dashed=False, stroke_width=4) -> VGroup:
    """Arrow from start to end (points or mobjects) with an optional label beside its middle.

    .arrow, .label
    """
    if dashed:
        a = DashedLine(start, end, buff=buff, color=color, stroke_width=stroke_width, dash_length=0.09)
        a.add_tip(tip_length=0.2, tip_width=0.2)
    else:
        a = Arrow(start, end, buff=buff, color=color, stroke_width=stroke_width,
                  max_tip_length_to_length_ratio=0.2, tip_length=0.22)
    g = VGroup(a)
    g.arrow = a
    g.label = None
    if label:
        t = T(label, size, color, mono=mono)
        t.next_to(a, side, buff=0.1)
        g.label = t
        g.add(t)
    return g


# ---------------------------------------------------------------- code and JSON
def code_block(code, language="typescript", color=MUTED, size=CODE, line_numbers=False) -> Code:
    """Syntax-colored code on a panel. Lines: .code_lines[i]. Use reveal helpers to show line by line."""
    c = Code(code_string=code.strip("\n"), language=language, formatter_style="github-dark",
             add_line_numbers=line_numbers,
             paragraph_config={"font": MONO, "font_size": size, "line_spacing": 0.6},
             background_config={"fill_color": PANEL, "stroke_color": color, "stroke_width": 2,
                                "corner_radius": 0.14, "buff": 0.25})
    c._dw_fs = size
    c._dw_ref_h = c.code_lines.height
    return c


def json_block(obj, color=MUTED, size=CODE, indent=2) -> Code:
    """JSON (a dict/list, or a string you formatted) as a code block."""
    text = obj if isinstance(obj, str) else _json.dumps(obj, indent=indent, ensure_ascii=False)
    return code_block(text, "json", color=color, size=size)


def hide_lines(code: Code, start=0, stop=None) -> Code:
    """Make code lines [start, stop) invisible, so reveal_lines can show them later. Add the block after this."""
    for ln in code.code_lines[start:stop]:
        ln.set_opacity(0)
    return code


def reveal_lines(code: Code, start, stop=None, lag=0.15) -> Animation:
    """Animation that shows code lines [start, stop) one after the other."""
    stop = start + 1 if stop is None else stop
    return LaggedStart(*[ln.animate.set_opacity(1) for ln in code.code_lines[start:stop]], lag_ratio=lag)


def mark_line(code: Code, i, color=STACK) -> SurroundingRectangle:
    """A frame around code line i (add or Create it)."""
    return SurroundingRectangle(code.code_lines[i], color=color, buff=0.06, stroke_width=2.5, corner_radius=0.05)


# ---------------------------------------------------------------- tables
class RevealTable(VGroup):
    """A table that reveals row by row, with baselines aligned and an even row pitch.

    Cells are non-empty strings. `mono_cols` holds the indices of columns drawn in Menlo.
    `cell_colors` maps (row, col) -> color; row 0 is the first data row.
    The header and its line show when you add the table; data rows show when revealed:
        tbl = RevealTable(["code", "status"], rows, mono_cols=[0])
        self.add(tbl)                       # header and top line
        self.play(tbl.reveal_row(0))        # first data row
        self.play(tbl.reveal_rows(1, 4))    # rows 1..3, staggered
        self.play(Create(tbl.mark_row(2)))  # frame one row, full width
    Pass show_rows=True to build it fully visible.
    (Manim's Table centers each cell on its own glyph box, so baselines and row gaps vary.)
    """

    LINE_OPACITY = 0.55

    @staticmethod
    def _cell(s, size, color, mono, bold=False):
        # A trailing '|' strut gives every cell the same ascent and descent for layout.
        t = Text(str(s) + "|", font=MONO if mono else SANS, font_size=size, color=color,
                 weight=BOLD if bold else NORMAL)
        t._dw_strut = True
        return t

    @staticmethod
    def _drop_strut(t):
        """Remove the strut glyph after layout; keep .font_size honest for the size lint."""
        fs0 = t.font_size
        t.remove(t[-1])
        t.initial_height *= t.font_size / fs0

    def __init__(self, header, rows, mono_cols=(), color=TEXT, header_color=None, size=SMALL,
                 row_gap=0.1, col_gap=0.6, cell_colors=None, show_rows=False, **kw):
        super().__init__(**kw)
        cell_colors = cell_colors or {}
        ncol = len(header)
        hdr = [self._cell(h, size, header_color or color, False, bold=True) for h in header]
        body = [[self._cell(s, size, cell_colors.get((r, c), color), c in mono_cols)
                 for c, s in enumerate(row)] for r, row in enumerate(rows)]
        widths = [max(x[c].width for x in [hdr, *body]) for c in range(ncol)]
        pitch = hdr[0].height + row_gap
        xs = np.cumsum([0] + [w + col_gap for w in widths[:-1]])
        total_w = sum(widths) + col_gap * (ncol - 1) + 0.3
        x0 = -total_w / 2 + 0.15

        def place(cells, i):
            for c, m in enumerate(cells):
                m.move_to([x0 + xs[c], -i * pitch, 0], aligned_edge=LEFT)
            return VGroup(*cells)

        self.header = place(hdr, 0)
        self.body_rows = [place(r, i + 1) for i, r in enumerate(body)]
        for t in [*hdr, *[m for r in body for m in r]]:
            self._drop_strut(t)
        self.hlines = [Line([-total_w / 2, -(i + 0.5) * pitch, 0], [total_w / 2, -(i + 0.5) * pitch, 0],
                            stroke_width=1.5, stroke_color=MUTED, stroke_opacity=self.LINE_OPACITY)
                       for i in range(len(body))]  # hlines[i] sits above data row i
        self.pitch, self.total_w = pitch, total_w
        self.add(self.header, *self.hlines, *self.body_rows)
        if not show_rows:
            for i, r in enumerate(self.body_rows):
                r.set_opacity(0)
                if i > 0:
                    self.hlines[i].set_stroke(opacity=0)

    def reveal_row(self, i) -> Animation:
        anims = [self.body_rows[i].animate.set_opacity(1)]
        if i > 0:
            anims.append(self.hlines[i].animate.set_stroke(opacity=self.LINE_OPACITY))
        return AnimationGroup(*anims)

    def reveal_rows(self, start, stop, lag=0.35) -> Animation:
        return LaggedStart(*[self.reveal_row(i) for i in range(start, stop)], lag_ratio=lag)

    def mark_row(self, i, color=STACK) -> Rectangle:
        """A frame around data row i, across the full table width."""
        r = RoundedRectangle(corner_radius=0.06, width=self.hlines[0].width, height=self.pitch - 0.04,
                             stroke_color=color, stroke_width=2.5)
        return r.move_to([self.hlines[0].get_x(), self.body_rows[i].get_y(), 0])

    def cell(self, i, j):
        """Mobject of data row i, column j."""
        return self.body_rows[i][j]


# ---------------------------------------------------------------- small icons
def window_card(title, w=2.6, h=2.0, color=WIDGET) -> VGroup:
    """A floating widget window: frame, title bar, title text. .frame, .title, .body_center"""
    frame = rbox(w, h, color, fill=0.07, sw=3, r=0.1)
    bar_y = frame.get_top()[1] - 0.42
    bar = Line([frame.get_left()[0], bar_y, 0], [frame.get_right()[0], bar_y, 0],
               stroke_color=color, stroke_width=2)
    t = T(title, LABEL, TEXT, bold=True).move_to([frame.get_x(), bar_y + 0.21, 0])
    g = VGroup(frame, bar, t)
    g.frame, g.title = frame, t
    g.body_center = np.array([frame.get_x(), (bar_y + frame.get_bottom()[1]) / 2, 0])
    return g


def disk_icon(color=RECORDS, s=0.5) -> VGroup:
    top = Ellipse(width=s, height=s * 0.32, stroke_color=color, stroke_width=2.5)
    side_l = Line(top.get_left(), top.get_left() + DOWN * s * 0.7, stroke_color=color, stroke_width=2.5)
    side_r = Line(top.get_right(), top.get_right() + DOWN * s * 0.7, stroke_color=color, stroke_width=2.5)
    bottom = Arc(radius=1, start_angle=PI, angle=PI, stroke_color=color, stroke_width=2.5)
    bottom.stretch_to_fit_width(s).stretch_to_fit_height(s * 0.16).move_to(top.get_center() + DOWN * (s * 0.7 + s * 0.08))
    return VGroup(top, side_l, side_r, bottom)


SOURCE = "origin/main 68aabd9a"   # the commit this video explains (script `cold_open`)


def source_tag(corner=DR) -> VGroup:
    """The grey corner tag with the source commit. It stays on screen for the whole video.

    One line, 22 px, bottom right. DWScene adds it to each scene by itself (SOURCE_TAG = True),
    pinned to the camera. The outline and caption() keep that corner free.
    """
    t = T(SOURCE, SMALL, MUTED, mono=True)
    g = VGroup(t)
    g._dw_keep = True  # OutlineDiagram.close_part does not fade it out
    return g.to_corner(corner, buff=0.18)


def inferred(value, size=BODY) -> VGroup:
    """An inferred value: amber value plus the word 'inferred' (claim legend of `cold_open`)."""
    v = T(value, size, INFERRED, mono=True)
    w = T("inferred", max(SMALL, size - 6), INFERRED)
    return VGroup(v, w).arrange(RIGHT, buff=0.15, aligned_edge=DOWN)


def burst(color=ISOLATION, r=0.3) -> Star:
    return Star(n=8, outer_radius=r, inner_radius=r * 0.45, stroke_color=color, fill_color=color, fill_opacity=0.85)
