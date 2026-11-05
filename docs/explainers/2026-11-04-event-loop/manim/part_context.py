"""Part `part_context`: async_chain als handler_reads_store.

The async chain, async local storage, and the process handler that reads the store.
Opens on the outline at `late_error` (also `find_who`); closes there and lights `endless_loop`.

Code cards are the real snippets (`notes/script-v2/snippets/async_ids.cjs`, `als_basic.cjs`,
`late_throw.cjs`, `late_reject.cjs`); outputs are the real outputs of `sources.runs`. At the least
font size a line holds about 60 characters, so long lines wrap at argument boundaries (same tokens).
`als_basic.cjs`: the script prints a condensed form with `log(...)`; the card shows the real file,
so that its labels match the real output. `late_throw.cjs` (13 lines) and its output do not fit
the content height together, so the card shows lines 8-13 first, then lines 1-7.

Beat weights are seconds of the final audio where it exists: each beat starts at the pause before
its sentence (ffmpeg silencedetect). The base scales them to the audio length.
"""
from dwscene import *
from loopviz import CallStack as _Pile

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content

_ASYNC_IDS = """\
const ah = require('node:async_hooks')
console.log('top level  asyncId', ah.executionAsyncId(),
  'trigger', ah.triggerAsyncId())
setTimeout(function a() {
  console.log('timer a    asyncId', ah.executionAsyncId(),
    'trigger', ah.triggerAsyncId())
  setTimeout(function d() {
    console.log('timer d    asyncId', ah.executionAsyncId(),
      'trigger', ah.triggerAsyncId())
  }, 5)
}, 10)"""

_ASYNC_IDS_OUT = """\
top level  asyncId 1 trigger 0
timer a    asyncId 5 trigger 1
timer d    asyncId 7 trigger 5"""

_ALS_BASIC = """\
const { AsyncLocalStorage } = require('node:async_hooks')
const blame = new AsyncLocalStorage()
blame.run('pinger', async () => {
  await null
  setTimeout(() => console.log('timer in the pinger chain:',
    blame.getStore()), 5)
})
blame.run('sample', () => console.log('inside the sample run:',
  blame.getStore()))
console.log('outside any run:', blame.getStore())"""

_ALS_OUT = """\
inside the sample run: sample
outside any run: undefined
timer in the pinger chain: pinger"""

_LATE_TOP = """\
const { AsyncLocalStorage } = require('node:async_hooks')
const blame = new AsyncLocalStorage()
process.on('uncaughtException', (error) => {
  console.log('process handler: error =', error.message,
    '| store =', blame.getStore())
  process.exit(1)
})"""

_LATE_BOTTOM = """\
function ping() {
  setTimeout(() => { throw new Error('late boom') }, 50)
  return 'ok'
}
console.log('call returns', blame.run('pinger', ping))
console.log('outside the run, store =', blame.getStore())"""

_LATE_OUT = """\
call returns ok
outside the run, store = undefined
process handler: error = late boom | store = pinger"""

_LATE_REJECT_OUT = "process handler: reason = late reject | store = pinger"

_IDS_CAPTION = "asyncId = this work, triggerAsyncId = the work that created it (Node.js docs, async_hooks)"
_REACT_CREDIT = 'React context as inherited value: react.dev, "Passing Data Deeply with Context"'


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (no-op if already later)."""
    scene.wait_until(b.start + frac * b.length)


def _code(src, language="javascript", color=MUTED, buff=0.15) -> Code:
    """style.code_block with a thinner panel padding (as in part_memory)."""
    c = Code(code_string=src.strip("\n"), language=language, formatter_style="github-dark",
             add_line_numbers=False,
             paragraph_config={"font": MONO, "font_size": CODE, "line_spacing": 0.6},
             background_config={"fill_color": PANEL, "stroke_color": color, "stroke_width": 2,
                                 "corner_radius": 0.14, "buff": buff})
    c._dw_fs = CODE
    c._dw_ref_h = c.code_lines.height
    return c


def _fname(text):
    """File name at the title row, right edge."""
    t = T(text, SMALL, MUTED, mono=True)
    return t.move_to([0, TITLE_Y, 0]).to_edge(RIGHT, buff=MARGIN + 0.1)


def _ran_note(*ls) -> VGroup:
    """The `ran` claim tag with a short grey note under it."""
    return VGroup(claim_tag("ran"), lines(*ls, size=SMALL, color=MUTED, buff=0.08)).arrange(
        DOWN, buff=0.14, aligned_edge=LEFT)


def _mark(code, i, j=None, color=ASYNC_CTX):
    """A frame around code lines i..j (inclusive)."""
    j = i if j is None else j
    return SurroundingRectangle(VGroup(*code.code_lines[i:j + 1]), color=color, buff=0.08, stroke_width=2.5,
                                corner_radius=0.05)


def _edge(a, b, color=ASYNC_CTX):
    """Dashed line = scheduled, not called."""
    return DashedLine(a.get_bottom(), b.get_top(), buff=0.08, color=color, stroke_width=3, dash_length=0.1)


def _ribbon(a, b, color=ASYNC_CTX, width=16):
    """The thick soft band that follows one async chain."""
    r = Line(a.get_bottom(), b.get_top(), buff=0.08, stroke_color=color, stroke_width=width, stroke_opacity=0.3)
    r.set_z_index(-1)
    return r


def _tree(cx, top, root_text="pinger.ping"):
    """The async chain of script `async_chain`: root, `setTimeout a`, `.then b`, and `setTimeout d` under a."""
    root = chip(root_text, WIDGET).move_to([cx, top, 0])
    a = chip("setTimeout a", TASK).move_to([cx - 2.3, top - 1.3, 0])
    bb = chip(".then b", PROMISE).move_to([cx + 2.3, top - 1.3, 0])
    d = chip("setTimeout d", TASK).move_to([cx - 2.3, top - 2.6, 0])
    return root, a, bb, d


def _card(title, rows, color, w, h, title_color=None):
    """A rounded card with a bold title and short lines under it."""
    box = rbox(w, h, color, fill=0.07, sw=2.5)
    t = T(title, LABEL, title_color or color, bold=True)
    body = lines(*rows, size=LABEL, color=TEXT, buff=0.16)
    txt = VGroup(t, body).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
    txt.move_to(box).align_to(box, UP).shift(DOWN * 0.3)
    g = VGroup(box, txt)
    g.box, g.head, g.body = box, t, body
    return g


# ---------------------------------------------------------------- scenes
class AsyncChain(DWScene):
    # weights = seconds between the pauses of audio-final/async_chain.wav (40.36 s)
    BEATS = [("open", 2.5), ("gap", 9.6), ("define", 7.16), ("tree", 8.44), ("ids", 6.8), ("run", 5.86)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram(self).open_part(self, "late_error", also=("find_who",), run_time=b.left)

        with self.beat("gap") as b:
            title = scene_title("The gap", ISOLATION)
            pile = _Pile(width=2.8, max_frames=3)
            pile.shift(np.array([-4.3, -1.6, 0]) - pile.base.get_center())
            card = rbox(5.4, 2.6, EMITTER, fill=0.08).move_to([2.6, 0.2, 0])
            head = T("process handler", LABEL, EMITTER, bold=True)
            err = M(f'error: <span fgcolor="{ISOLATION}">late boom</span>', BODY, mono=True)
            who = M(f'widget: <span fgcolor="{MUTED}">?</span>', BODY, mono=True)
            txt = VGroup(head, err, who).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
            txt.move_to(card).align_to(card, LEFT).shift(RIGHT * 0.45)
            qmark = T("?", 64, MUTED, bold=True).next_to(card, RIGHT, buff=0.3)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(pile), run_time=b.t(0.04))
            self.play(pile.push("pinger.ping"), run_time=b.t(0.03))
            self.play(Create(card), FadeIn(head), run_time=b.t(0.04))
            self.play(FadeIn(err, shift=RIGHT * 0.4), run_time=b.t(0.04))
            _at(self, b, 0.19)
            self.play(FadeIn(who), run_time=b.t(0.08))
            _at(self, b, 0.3)
            self.play(pile.pop(), run_time=b.t(0.1))
            gone = T("long gone", LABEL, MUTED).next_to(pile.base, UP, buff=0.35)
            self.play(FadeIn(gone), run_time=b.t(0.06))
            _at(self, b, 0.6)
            self.play(FadeIn(qmark, scale=0.6), run_time=b.t(0.08))
            self.play(Indicate(who, color=ISOLATION, scale_factor=1.08), run_time=b.t(0.12))

        with self.beat("define") as b:
            title2 = scene_title("The async chain", ASYNC_CTX)
            root, a, bb, d = _tree(-0.6, 2.35)
            area = rbox(8.6, 3.55, ASYNC_CTX, fill=0.03, sw=2, dashed=True).move_to([-0.6, 1.05, 0])
            tbl = RevealTable(["kind", "f and g", "shape", "ends"],
                              [["call stack", "f called g", "a line", "at return"],
                               ["async chain", "f scheduled g", "a tree", "when the last callback ends"]],
                              cell_colors={(0, 0): STACK, (1, 0): ASYNC_CTX})
            tbl.move_to([0, -1.95, 0])
            cap = caption("all the work that one piece of code starts, now or later")
            self.play(FadeOut(VGroup(pile, card, txt, qmark, gone)), Transform(title, title2),
                      run_time=b.t(0.12))
            self.play(FadeIn(root, scale=0.8), run_time=b.t(0.08))
            _at(self, b, 0.35)
            self.play(Create(area), FadeIn(cap), run_time=b.t(0.14))
            _at(self, b, 0.62)
            self.play(FadeIn(tbl), run_time=b.t(0.08))
            self.play(tbl.reveal_row(0), run_time=b.t(0.08))
            self.play(tbl.reveal_row(1), run_time=b.t(0.08))

        with self.beat("tree") as b:
            ea, eb, ed = _edge(root, a), _edge(root, bb), _edge(a, d)
            key = VGroup(DashedLine(LEFT * 0.35, RIGHT * 0.35, color=ASYNC_CTX, stroke_width=3, dash_length=0.1),
                         T("scheduled, not called", SMALL, MUTED)).arrange(RIGHT, buff=0.2)
            key.align_to(area, RIGHT).align_to(area, DOWN).shift(LEFT * 0.35 + UP * 0.3)
            self.play(Create(ea), FadeIn(a, shift=DOWN * 0.2), run_time=b.t(0.1))
            self.play(FadeIn(key), run_time=b.t(0.06))
            _at(self, b, 0.33)
            self.play(Create(eb), FadeIn(bb, shift=DOWN * 0.2), run_time=b.t(0.1))
            _at(self, b, 0.56)
            self.play(Create(ed), FadeIn(d, shift=DOWN * 0.2), run_time=b.t(0.1))
            _at(self, b, 0.82)
            self.play(Indicate(tbl.cell(1, 2), color=ASYNC_CTX, scale_factor=1.15), run_time=b.t(0.14))

        with self.beat("ids") as b:
            code = _code(_ASYNC_IDS).move_to([0, 0, 0]).align_to([0, CONTENT_TOP, 0], UP)
            fname = _fname("async_ids.cjs")
            cap2 = caption(_IDS_CAPTION, size=24)
            self.play(FadeOut(VGroup(root, a, bb, d, ea, eb, ed, area, key, tbl, cap)), run_time=b.t(0.1))
            self.play(FadeIn(code), FadeIn(fname), run_time=b.t(0.1))
            _at(self, b, 0.27)
            m1 = VGroup(*[_mark(code, i) for i in (1, 4, 7)])
            self.play(Create(m1), FadeIn(cap2), run_time=b.t(0.12))
            _at(self, b, 0.62)
            m2 = VGroup(*[_mark(code, i) for i in (2, 5, 8)])
            self.play(ReplacementTransform(m1, m2), run_time=b.t(0.12))

        with self.beat("run") as b:
            out = _code(_ASYNC_IDS_OUT, language="text", color=TEXT)
            out.move_to([0, 0, 0]).align_to([_X0, 0, 0], LEFT).align_to([0, 2.5, 0], UP)
            hide_lines(out)
            note = _ran_note("node and Electron:", "same output").next_to(out, DOWN, buff=0.35).align_to(out, LEFT)
            n1 = chip("1  top level", TEXT).move_to([3.6, 2.1, 0])
            n5 = chip("5  timer a", TASK).move_to([3.6, 0.45, 0])
            n7 = chip("7  timer d", TASK).move_to([3.6, -1.2, 0])
            a51 = labeled_arrow(n5.get_top(), n1.get_bottom(), "trigger", ASYNC_CTX, side=RIGHT)
            a75 = labeled_arrow(n7.get_top(), n5.get_bottom(), "trigger", ASYNC_CTX, side=RIGHT)
            self.play(FadeOut(code), FadeOut(m2), run_time=b.t(0.08))
            self.play(FadeIn(out), FadeIn(note), FadeIn(n1), reveal_lines(out, 0), run_time=b.t(0.1))
            _at(self, b, 0.18)
            self.play(reveal_lines(out, 1), FadeIn(n5, shift=UP * 0.2), GrowArrow(a51.arrow), FadeIn(a51.label),
                      run_time=b.t(0.12))
            _at(self, b, 0.5)
            self.play(reveal_lines(out, 2), FadeIn(n7, shift=UP * 0.2), GrowArrow(a75.arrow), FadeIn(a75.label),
                      run_time=b.t(0.12))
            _at(self, b, 0.8)
            self.play(Indicate(n5, color=TASK, scale_factor=1.12), run_time=b.t(0.14))


class Als(DWScene):
    # weights = seconds between the pauses of audio-final/als.wav (46.16 s)
    BEATS = [("carry", 4.4), ("api", 8.16), ("asked", 14.17), ("react", 13.46), ("code", 5.97)]

    def construct(self):
        with self.beat("carry") as b:
            title = scene_title("Async local storage", ASYNC_CTX)
            root, a, bb, d = _tree(0, 2.2)
            edges = VGroup(_edge(root, a), _edge(root, bb), _edge(a, d))
            rib = VGroup(_ribbon(root, a), _ribbon(root, bb), _ribbon(a, d))
            val = chip("'pinger'", ASYNC_CTX, fill=0.3).next_to(root, RIGHT, buff=0.3)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(VGroup(root, a, bb, d, edges)), run_time=b.t(0.25))
            self.play(FadeIn(val, scale=0.8), run_time=b.t(0.15))
            self.play(Create(rib), run_time=b.t(0.4))

        with self.beat("api") as b:
            run = chip("run(value, fn)", ASYNC_CTX).move_to([-4.6, 2.2, 0])
            run_arr = Arrow(run.get_right(), root.get_left(), buff=0.1, color=ASYNC_CTX, stroke_width=3,
                            max_tip_length_to_length_ratio=0.3, tip_length=0.18)
            get = M(f'getStore() <span fgcolor="{MUTED}">→</span> <span fgcolor="{ASYNC_CTX}">\'pinger\'</span>',
                    SMALL, mono=True).next_to(d, RIGHT, buff=0.4)
            self.play(FadeIn(run, shift=RIGHT * 0.2), GrowArrow(run_arr), run_time=b.t(0.12))
            _at(self, b, 0.5)
            self.play(Indicate(VGroup(a, bb, d), color=ASYNC_CTX, scale_factor=1.06), run_time=b.t(0.14))
            _at(self, b, 0.74)
            self.play(FadeIn(get, shift=LEFT * 0.2), run_time=b.t(0.1))

        with self.beat("asked") as b:
            ask_txt = VGroup(T("asked:", SMALL, MUTED),
                             T("is AsyncLocalStorage like browser localStorage?", SMALL)).arrange(RIGHT, buff=0.2)
            ask = VGroup(rbox(ask_txt.width + 0.5, ask_txt.height + 0.4, MUTED, fill=0.08, sw=2), ask_txt)
            ask_txt.move_to(ask[0])
            ask.move_to([0, 2.4, 0])
            left = _card("localStorage (browser)", ["text", "on disk", "per site", "survives restarts"],
                         MUTED, 5.4, 3.3, title_color=TEXT).move_to([-3.4, -0.55, 0])
            right = _card("AsyncLocalStorage (Node)", ["one value", "in memory", "per async chain",
                                                       "while the chain lives"],
                          ASYNC_CTX, 5.4, 3.3).move_to([3.4, -0.55, 0])
            disk = disk_icon(MUTED, 0.6).move_to(left.box).align_to(left.box, RIGHT).shift(LEFT * 0.6)
            ribb = Line(LEFT * 0.5, RIGHT * 0.5, stroke_color=ASYNC_CTX, stroke_width=16, stroke_opacity=0.35)
            ribb.move_to(right.box).align_to(right.box, RIGHT).shift(LEFT * 0.4)
            neq = T("≠", 64, ISOLATION, bold=True).move_to([0, -0.55, 0])
            self.play(FadeOut(VGroup(root, a, bb, d, edges, rib, val, run, run_arr, get)), run_time=b.t(0.06))
            self.play(FadeIn(ask, shift=DOWN * 0.2), run_time=b.t(0.08))
            _at(self, b, 0.22)
            self.play(FadeIn(neq, scale=0.6), run_time=b.t(0.05))
            _at(self, b, 0.3)
            self.play(FadeIn(left), FadeIn(disk), run_time=b.t(0.08))
            _at(self, b, 0.52)
            self.play(FadeIn(right), FadeIn(ribb), run_time=b.t(0.08))

        with self.beat("react") as b:
            lx, rx = -3.4, 3.4
            lhead = T("React context", LABEL, TEXT, bold=True).move_to([lx, 2.5, 0])
            rhead = T("async local storage", LABEL, ASYNC_CTX, bold=True).move_to([rx, 2.5, 0])
            prov = chip("provider", TEXT, mono=False).move_to([lx, 1.6, 0])
            pval = chip("'pinger'", ASYNC_CTX, fill=0.3).next_to(prov, RIGHT, buff=0.2)
            c1 = chip("component", TEXT, mono=False).move_to([lx - 1.5, 0.35, 0])
            c2 = chip("component", TEXT, mono=False).move_to([lx + 1.5, 0.35, 0])
            c3 = chip("component", TEXT, mono=False).move_to([lx - 1.5, -0.9, 0])
            ledges = VGroup(Line(prov.get_bottom(), c1.get_top(), buff=0.08, stroke_color=MUTED, stroke_width=3),
                            Line(prov.get_bottom(), c2.get_top(), buff=0.08, stroke_color=MUTED, stroke_width=3),
                            Line(c1.get_bottom(), c3.get_top(), buff=0.08, stroke_color=MUTED, stroke_width=3))
            lrib = VGroup(_ribbon(prov, c1), _ribbon(prov, c2), _ribbon(c1, c3))
            ltag = T("component tree", SMALL, MUTED).move_to([lx, -1.75, 0])
            rroot = chip("run('pinger', fn)", ASYNC_CTX).move_to([rx, 1.6, 0])
            r1 = chip("callback", TASK).move_to([rx - 1.5, 0.35, 0])
            r2 = chip("callback", PROMISE).move_to([rx + 1.5, 0.35, 0])
            r3 = chip("callback", TASK).move_to([rx - 1.5, -0.9, 0])
            redges = VGroup(_edge(rroot, r1), _edge(rroot, r2), _edge(r1, r3))
            rrib = VGroup(_ribbon(rroot, r1), _ribbon(rroot, r2), _ribbon(r1, r3))
            rtag = T("async chain", SMALL, MUTED).move_to([rx, -1.75, 0])
            credit = chip(_REACT_CREDIT, MUTED, mono=False, fill=0.08).move_to([0, -2.45, 0])
            self.play(FadeOut(VGroup(ask, left, right, disk, ribb, neq)), run_time=b.t(0.05))
            self.play(FadeIn(lhead), FadeIn(credit), run_time=b.t(0.06))
            _at(self, b, 0.26)
            self.play(FadeIn(prov), FadeIn(pval, scale=0.8), run_time=b.t(0.06))
            _at(self, b, 0.38)
            self.play(Create(ledges), FadeIn(VGroup(c1, c2, c3)), FadeIn(ltag), run_time=b.t(0.08))
            self.play(Create(lrib), run_time=b.t(0.1))
            _at(self, b, 0.61)
            self.play(FadeIn(rhead), FadeIn(rroot), run_time=b.t(0.06))
            self.play(Create(redges), FadeIn(VGroup(r1, r2, r3)), FadeIn(rtag), run_time=b.t(0.08))
            self.play(Create(rrib), run_time=b.t(0.1))

        with self.beat("code") as b:
            code = _code(_ALS_BASIC).move_to([0, 0, 0]).align_to([0, CONTENT_TOP, 0], UP)
            fname = _fname("als_basic.cjs")
            out = _code(_ALS_OUT, language="text", color=TEXT)
            out.align_to(code, LEFT).next_to(code, DOWN, buff=0.25)
            out.align_to(code, LEFT)
            hide_lines(out)
            note = _ran_note("node and Electron:", "same output").next_to(out, RIGHT, buff=0.5).align_to(out, UP)
            self.play(FadeOut(VGroup(lhead, rhead, prov, pval, c1, c2, c3, ledges, lrib, ltag, rroot, r1, r2, r3,
                                     redges, rrib, rtag, credit)), run_time=b.t(0.05))
            self.play(FadeIn(code), FadeIn(fname), FadeIn(out), FadeIn(note), run_time=b.t(0.08))
            mk = _mark(code, 7, 8, color=TEXT)
            self.play(Create(mk), reveal_lines(out, 0), run_time=b.t(0.08))
            _at(self, b, 0.37)
            self.play(Transform(mk, _mark(code, 9, color=TEXT)), reveal_lines(out, 1), run_time=b.t(0.08))
            _at(self, b, 0.64)
            self.play(Transform(mk, _mark(code, 2, 6)), reveal_lines(out, 2), run_time=b.t(0.08))
            self.play(Create(_mark(out, 2)), run_time=b.t(0.08))


class HandlerReadsStore(DWScene):
    # weights = seconds between the pauses of audio-final/handler_reads_store.wav (36.6 s)
    BEATS = [("together", 12.54), ("run", 13.94), ("handler", 4.31), ("reject", 2.47), ("close", 3.34)]

    def construct(self):
        with self.beat("together") as b:
            title = scene_title("The handler in the chain", ASYNC_CTX)
            band = rbox(12.9, 2.3, ASYNC_CTX, fill=0.1, sw=0).move_to([-0.1, -0.1, 0])
            val = chip("'pinger'", ASYNC_CTX, fill=0.3).next_to(band, UP, buff=0.15).align_to(band, LEFT)
            ping = chip("run('pinger', ping)", WIDGET).move_to([-4.55, 0.1, 0])
            timer = chip("timer", TASK).move_to([-0.9, 0.1, 0])
            step = labeled_arrow(ping.get_right(), timer.get_left(), None, ASYNC_CTX, dashed=True, stroke_width=3)
            boom = burst(ISOLATION, 0.28).next_to(timer, UR, buff=-0.05)
            boom_t = T("late boom", LABEL, ISOLATION).next_to(timer, DOWN, buff=0.3)
            hbox = rbox(3.9, 1.85, EMITTER, fill=0.12).move_to([3.95, -0.1, 0])
            hhead = T("process handler", LABEL, EMITTER, bold=True)
            hget = M(f'getStore() <span fgcolor="{MUTED}">→</span>', SMALL, mono=True)
            hval = T("'pinger'", SMALL, ASYNC_CTX, mono=True)
            hrow = VGroup(hget, hval).arrange(RIGHT, buff=0.15)
            htxt = VGroup(hhead, hrow).arrange(DOWN, buff=0.3).move_to(hbox)
            to_h = labeled_arrow(timer.get_right(), hbox.get_left(), None, ISOLATION, stroke_width=3)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.06))
            self.play(FadeIn(band), FadeIn(val), FadeIn(ping), run_time=b.t(0.08))
            self.play(Create(step), FadeIn(timer, shift=RIGHT * 0.2), run_time=b.t(0.08))
            _at(self, b, 0.22)
            self.play(Create(hbox), FadeIn(hhead), run_time=b.t(0.08))
            _at(self, b, 0.42)
            self.play(FadeIn(boom, scale=0.5), FadeIn(boom_t), GrowArrow(to_h.arrow), run_time=b.t(0.08))
            _at(self, b, 0.65)
            self.play(FadeIn(hget), run_time=b.t(0.06))
            _at(self, b, 0.8)
            self.play(FadeIn(hval, shift=LEFT * 0.2), run_time=b.t(0.06))
            self.play(Indicate(hval, color=ASYNC_CTX, scale_factor=1.25), run_time=b.t(0.08))

        with self.beat("run") as b:
            code = _code(_LATE_BOTTOM)
            code.move_to([0, 0, 0]).align_to([_X0, 0, 0], LEFT).align_to([0, CONTENT_TOP, 0], UP)
            fname = _fname("late_throw.cjs, lines 8-13")
            out = _code(_LATE_OUT, language="text", color=TEXT)
            out.align_to([_X0, 0, 0], LEFT).align_to([0, -0.2, 0], UP)
            hide_lines(out)
            note = _ran_note("node and Electron:", "same output, exit code 1")
            note.next_to(out, RIGHT, buff=0.4).align_to(out, UP)
            self.play(FadeOut(VGroup(band, val, ping, timer, step, boom, boom_t, hbox, htxt, to_h)),
                      run_time=b.t(0.06))
            self.play(FadeIn(code), FadeIn(fname), FadeIn(out), run_time=b.t(0.08))
            mk = _mark(code, 4)
            self.play(Create(mk), run_time=b.t(0.06))
            _at(self, b, 0.37)
            self.play(Transform(mk, _mark(code, 2, color=TEXT)), reveal_lines(out, 0), run_time=b.t(0.07))
            _at(self, b, 0.5)
            self.play(Transform(mk, _mark(code, 5, color=TEXT)), reveal_lines(out, 1), run_time=b.t(0.07))
            _at(self, b, 0.79)
            boom2 = burst(ISOLATION, 0.22).next_to(code.code_lines[1], RIGHT, buff=0.15)
            self.play(Transform(mk, _mark(code, 1, color=ISOLATION)), FadeIn(boom2, scale=0.5), run_time=b.t(0.08))

        with self.beat("handler") as b:
            code2 = _code(_LATE_TOP)
            code2.move_to([0, 0, 0]).align_to([_X0, 0, 0], LEFT).align_to([0, CONTENT_TOP, 0], UP)
            fname2 = _fname("late_throw.cjs, lines 1-7")
            self.play(FadeOut(code), FadeOut(mk), FadeOut(boom2), FadeIn(code2), Transform(fname, fname2),
                      run_time=b.t(0.2))
            mk2 = _mark(code2, 3, 4)
            self.play(Create(mk2), reveal_lines(out, 2), run_time=b.t(0.2))
            self.play(Create(_mark(out, 2)), FadeIn(note), run_time=b.t(0.2))

        with self.beat("reject") as b:
            rname = T("late_reject.cjs", SMALL, MUTED, mono=True)
            rchip = chip(_LATE_REJECT_OUT, TEXT, fill=0.08)
            rrow = VGroup(rname, rchip).arrange(DOWN, buff=0.15, aligned_edge=LEFT)
            rrow.align_to([_X0, 0, 0], LEFT).next_to(out, DOWN, buff=0.3).align_to([_X0, 0, 0], LEFT)
            rtag = claim_tag("ran").next_to(rchip, RIGHT, buff=0.3)
            self.play(code2.animate.set_opacity(DIM), FadeOut(mk2), run_time=b.t(0.15))
            self.play(FadeIn(rrow, shift=DOWN * 0.2), FadeIn(rtag), run_time=b.t(0.25))

        with self.beat("close") as b:
            OutlineDiagram(self).close_part(self, "late_error", next_key="endless_loop", also=("find_who",),
                                            run_time=b.left)
