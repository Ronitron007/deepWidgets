"""Part `part_limits`: limit_blame_gaps limit_provisional limit_threshold.

The limits of the design, stated plainly.
Opens on the outline at `write_down` (also `find_who`); closes there and lights `all`.

Code cards are the real snippets (`notes/script-v2/snippets/emit_store.cjs`, `number_await.cjs`);
outputs are the real outputs of `sources.runs`. Long lines wrap at argument boundaries (same tokens).
The widget `A` of `limit_provisional` is illustrative, as in the script.

Chips drop words the viewer has not met (term rule):
- script `in the app the native stack read does not load (watchdog.ts:10-12), so the slot is the only
  watchdog blame` shows as `in the app, the widget number is the only blame of the watchdog`.
- script `PID reuse: not in the TLA+ model` shows as `PID reuse: not in the model check`.
- script `2 s from the crash_only spike` shows as `2 s: from one experiment (crash_only)`.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content

_EMIT_STORE = """\
const { AsyncLocalStorage } = require('node:async_hooks')
const { EventEmitter } = require('node:events')
const blame = new AsyncLocalStorage()
const bus = new EventEmitter()
blame.run('pinger', () => bus.on('tick', () =>
  console.log('pinger handler sees:', blame.getStore())))
blame.run('sample', () => bus.emit('tick'))"""

_EMIT_OUT = "pinger handler sees: sample"

_NUMBER_AWAIT = """\
const shared = new Int32Array(new SharedArrayBuffer(8))
function inSlot(index, fn) {
  const previous = Atomics.exchange(shared, 1, index)
  try { return fn() } finally { Atomics.store(shared, 1, previous) }
}
inSlot(7, async () => {
  console.log('before await, running widget =',
    Atomics.load(shared, 1))
  await null
  console.log('after await, running widget =',
    Atomics.load(shared, 1))
})"""

_NUMBER_OUT = """\
before await, running widget = 7
after await, running widget = 0"""


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (a cue point from the pauses of the final audio)."""
    scene.wait_until(b.start + frac * b.length)


def _code(src, language="javascript", color=MUTED, buff=0.15) -> Code:
    """style.code_block with a thinner panel padding (as in part_context)."""
    c = Code(code_string=src.strip("\n"), language=language, formatter_style="github-dark",
             add_line_numbers=False,
             paragraph_config={"font": MONO, "font_size": CODE, "line_spacing": 0.6},
             background_config={"fill_color": PANEL, "stroke_color": color, "stroke_width": 2,
                                 "corner_radius": 0.14, "buff": buff})
    c._dw_fs = CODE
    c._dw_ref_h = c.code_lines.height
    return c


def _fname(text):
    """File name at the title row, right edge (part_context)."""
    t = T(text, SMALL, MUTED, mono=True)
    return t.move_to([0, TITLE_Y, 0]).to_edge(RIGHT, buff=MARGIN + 0.1)


def _mark(code, i, j=None, color=TEXT):
    """A frame around code lines i..j (inclusive)."""
    j = i if j is None else j
    return SurroundingRectangle(VGroup(*code.code_lines[i:j + 1]), color=color, buff=0.08, stroke_width=2.5,
                                corner_radius=0.05)


def _note(kind, *ls, mono=False) -> VGroup:
    """A claim tag (`ran`, `read`, `inferred`) with a short note beside it (part_example_loop)."""
    color = INFERRED if kind == "inferred" else MUTED
    return VGroup(claim_tag(kind), lines(*ls, size=SMALL, color=color, mono=mono, buff=0.08)).arrange(
        RIGHT, buff=0.25, aligned_edge=UP)


def _cell(value, color=TEXT, w=1.1, h=0.62):
    """One shared memory cell `widget number` with its value (part_example_loop `_Cells`)."""
    box = Rectangle(width=w, height=h, stroke_color=HEARTBEAT, stroke_width=3, fill_color=HEARTBEAT,
                    fill_opacity=0.12)
    v = T(value, BODY, color, mono=True).move_to(box)
    name = T("widget number", SMALL, MUTED).next_to(box, DOWN, buff=0.1)
    g = VGroup(box, v, name)
    g.box, g.val = box, v
    return g


def _cube(text):
    """The white cube of sync code (scene `task_queue`), here an endless loop."""
    t = T(text, SMALL, BG, mono=True)
    r = Rectangle(width=t.width + 0.5, height=0.62, stroke_color=TEXT, stroke_width=2.5, fill_color=TEXT,
                  fill_opacity=0.92)
    t.move_to(r)
    return VGroup(r, t)


# ====================================================================== limit_blame_gaps
class LimitBlameGaps(DWScene):
    # weights = seconds between the pauses of audio-final/limit_blame_gaps.wav (44.56 s, silencedetect)
    BEATS = [("open", 3.26), ("top", 8.34), ("emit", 10.14), ("number", 9.81), ("timer", 7.21), ("app", 5.8)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram(self).open_part(self, "write_down", also=("find_who",), run_time=b.left)

        # ---- the module top level runs before any wrap
        title = scene_title("Limit: the blame store misses some code", ASYNC_CTX)
        mod = rbox(7.2, 3.9, WIDGET, fill=0.04, sw=2.5).move_to([-2.6, 0.45, 0])
        mod_t = T("widget module", LABEL, WIDGET, bold=True).next_to(mod.get_corner(UL), DR, buff=0.2)
        top_t = T("top level code", LABEL, TEXT).next_to(mod_t, DOWN, buff=0.35).align_to(mod_t, LEFT)
        wrap = rbox(6.4, 1.55, ASYNC_CTX, fill=0.05, sw=2.5, dashed=True)
        wrap.move_to(mod).align_to(mod, DOWN).shift(UP * 0.3)
        wrap_t = T("wrap", LABEL, ASYNC_CTX).next_to(wrap.get_corner(UL), DR, buff=0.15)
        act_t = T("action code", LABEL, TEXT).move_to(wrap).shift(DOWN * 0.15)
        top_v = chip("blame store: undefined", MUTED, mono=False).next_to(mod, RIGHT, buff=0.35)
        top_v.set_y(top_t.get_y())
        act_v = chip("blame store: sample", ASYNC_CTX, mono=False).next_to(mod, RIGHT, buff=0.35)
        act_v.set_y(act_t.get_y())
        top_ar = Arrow(top_t.get_right(), top_v.get_left(), buff=0.15, color=MUTED, stroke_width=3,
                       max_tip_length_to_length_ratio=0.15)
        act_ar = Arrow(act_t.get_right(), act_v.get_left(), buff=0.15, color=ASYNC_CTX, stroke_width=3,
                       max_tip_length_to_length_ratio=0.15)
        inf1 = _note("inferred", "module top level runs outside any wrap")
        inf1.move_to([0, -2.2, 0]).align_to([_X0, 0, 0], LEFT)

        with self.beat("top") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.08))
            _at(self, b, 0.28)
            self.play(FadeIn(mod), FadeIn(mod_t), FadeIn(top_t), run_time=b.t(0.1))
            _at(self, b, 0.5)
            self.play(Create(wrap), FadeIn(wrap_t), FadeIn(act_t), run_time=b.t(0.08))
            self.play(GrowArrow(act_ar), FadeIn(act_v, shift=LEFT * 0.15), run_time=b.t(0.08))
            _at(self, b, 0.72)
            self.play(GrowArrow(top_ar), FadeIn(top_v, shift=LEFT * 0.15), run_time=b.t(0.08))
            self.play(FadeIn(inf1, shift=UP * 0.1), run_time=b.t(0.08))

        # ---- a handler runs in the chain of the code that calls emit
        code = _code(_EMIT_STORE).align_to([_X0, 0, 0], LEFT).align_to([0, CONTENT_TOP, 0], UP)
        fname = _fname("emit_store.cjs")
        out = _code(_EMIT_OUT, language="text", color=TEXT)
        out.next_to(code, DOWN, buff=0.35).align_to(code, LEFT)
        hide_lines(out)
        note = _note("ran", "node and Electron:", "same output").next_to(out, RIGHT, buff=0.5).align_to(out, UP)
        title2 = scene_title("A handler runs in the chain of emit", ASYNC_CTX)

        with self.beat("emit") as b:
            self.play(FadeOut(VGroup(mod, mod_t, top_t, wrap, wrap_t, act_t, top_v, act_v, top_ar, act_ar, inf1)),
                      Transform(title, title2), run_time=b.t(0.08))
            self.play(FadeIn(code), FadeIn(fname), FadeIn(out), run_time=b.t(0.08))
            mk = _mark(code, 4, 5, color=WIDGET)
            self.play(Create(mk), run_time=b.t(0.06))
            _at(self, b, 0.39)
            self.play(Transform(mk, _mark(code, 6, color=ASYNC_CTX)), run_time=b.t(0.08))
            _at(self, b, 0.6)
            self.play(reveal_lines(out, 0), run_time=b.t(0.08))
            self.play(Create(_mark(out, 0, color=ASYNC_CTX)), run_time=b.t(0.06))
            _at(self, b, 0.79)
            self.play(FadeIn(note), run_time=b.t(0.08))

        # ---- the widget number covers only sync code inside the wrap
        code2 = _code(_NUMBER_AWAIT).align_to([_X0, 0, 0], LEFT).align_to([0, CONTENT_TOP, 0], UP)
        fname2 = _fname("number_await.cjs")
        out2 = _code(_NUMBER_OUT, language="text", color=TEXT)
        out2.next_to(code2, DOWN, buff=0.2).align_to(code2, LEFT)
        hide_lines(out2)
        note2 = VGroup(_note("ran", "node and Electron:", "same output"),
                       _note("read", "a model of inSlot", "(watchdog.ts:40-49)")).arrange(
            DOWN, buff=0.15, aligned_edge=LEFT)
        note2.next_to(out2, RIGHT, buff=0.5).align_to(out2, UP)
        title3 = scene_title("The widget number misses more", HEARTBEAT)

        with self.beat("number") as b:
            self.play(FadeOut(VGroup(code, out, note, mk)), *[FadeOut(m) for m in self.mobjects
                                                               if isinstance(m, SurroundingRectangle)],
                      Transform(title, title3), Transform(fname, fname2), run_time=b.t(0.08))
            self.play(FadeIn(code2), FadeIn(out2), run_time=b.t(0.08))
            mk2 = _mark(code2, 2, 3, color=HEARTBEAT)
            _at(self, b, 0.2)
            self.play(Create(mk2), run_time=b.t(0.06))
            _at(self, b, 0.62)
            self.play(Transform(mk2, _mark(code2, 6, 7)), reveal_lines(out2, 0), run_time=b.t(0.08))
            _at(self, b, 0.8)
            self.play(Transform(mk2, _mark(code2, 8, 10, color=ISOLATION)), reveal_lines(out2, 1),
                      run_time=b.t(0.08))
            self.play(FadeIn(note2), run_time=b.t(0.08))

        # ---- so a loop after an await has no widget number; the same inferred for a widget timer
        row1 = VGroup(chip("await null", PROMISE), _cube("endless loop"), _cell("0", ISOLATION))
        row1.arrange(RIGHT, buff=0.7)
        row2 = VGroup(chip("ctx.timeout callback", TASK), _cube("endless loop"), _cell("0", ISOLATION))
        row2.arrange(RIGHT, buff=0.7)
        rows = VGroup(row1, row2).arrange(DOWN, buff=0.9, aligned_edge=LEFT)
        rows.move_to([0, 0.75, 0]).align_to([_X0, 0, 0], LEFT)
        row1[1].set_x(row2[1].get_x())   # line the cubes and the cells up in columns
        row1[2].set_x(row2[2].get_x())
        ars = VGroup(*[Arrow(r[i].get_right(), r[i + 1].get_left() if i == 0 else r[2].box.get_left(), buff=0.12,
                             color=MUTED, stroke_width=3, max_tip_length_to_length_ratio=0.2)
                       for r in (row1, row2) for i in (0, 1)])
        nob = T("no widget number", LABEL, ISOLATION).next_to(row1[2], RIGHT, buff=0.4).set_y(row1[2].box.get_y())
        inf2 = _note("inferred", "a ctx.timeout callback finds 0")
        inf2.next_to(rows, DOWN, buff=0.5).align_to([_X0, 0, 0], LEFT)

        with self.beat("timer") as b:
            self.play(FadeOut(VGroup(code2, out2, note2, mk2, fname)), run_time=b.t(0.08))
            self.play(FadeIn(row1[0]), GrowArrow(ars[0]), FadeIn(row1[1]), run_time=b.t(0.1))
            self.play(GrowArrow(ars[1]), FadeIn(row1[2]), run_time=b.t(0.08))
            self.play(FadeIn(nob), Indicate(row1[2].val, color=ISOLATION, scale_factor=1.3), run_time=b.t(0.1))
            _at(self, b, 0.59)
            self.play(FadeIn(row2[0]), GrowArrow(ars[2]), FadeIn(row2[1]), run_time=b.t(0.1))
            self.play(GrowArrow(ars[3]), FadeIn(row2[2]), FadeIn(inf2), run_time=b.t(0.1))

        # ---- in the app: the watchdog kills the host with no blame; it counts against the app
        wd = ProcessBox("watchdog", color=WORKER).move_to([-4.6, 1.6, 0])
        host = ProcessBox("host", sub="blame: none", color=HOST, sub_mono=False).move_to([2.2, 1.6, 0])
        kill = labeled_arrow(wd.get_right(), host.get_left(), "SIGKILL", ISOLATION)
        sup = ProcessBox("supervisor", sub="app process", color=SUPERVISOR, sub_mono=False).move_to([-4.6, -0.6, 0])
        cnt = chip("counts the crash against the app", SUPERVISOR, mono=False, size=LABEL)
        cnt.next_to(sup, RIGHT, buff=0.6)
        cnt_ar = Arrow(sup.get_right(), cnt.get_left(), buff=0.1, color=SUPERVISOR, stroke_width=3,
                       max_tip_length_to_length_ratio=0.2)
        rd = _note("read", "in the app, the widget number is the only blame of the watchdog",
                   "(watchdog.ts:10-12)")
        rd.move_to([0, -2.2, 0]).align_to([_X0, 0, 0], LEFT)
        title4 = scene_title("In the app: a stall with no blame", WORKER)

        with self.beat("app") as b:
            self.play(FadeOut(VGroup(rows, ars, nob, inf2)), Transform(title, title4), run_time=b.t(0.08))
            self.play(FadeIn(wd), FadeIn(host), run_time=b.t(0.1))
            self.play(GrowArrow(kill.arrow), FadeIn(kill.label), run_time=b.t(0.1))
            self.play(Indicate(host.sub, color=ISOLATION, scale_factor=1.15), FadeIn(rd), run_time=b.t(0.12))
            _at(self, b, 0.58)
            self.play(FadeIn(sup), run_time=b.t(0.08))
            self.play(GrowArrow(cnt_ar), FadeIn(cnt, shift=LEFT * 0.15), run_time=b.t(0.1))


# ====================================================================== limit_provisional
_P0X, _P1X, _PY = -6.3, 2.9, 0.35   # the timeline: 0 ms at _P0X, 700 ms at _P1X
_PCOL = 1.45                         # left edge of the notes right of 600 ms


def _px(ms):
    return _P0X + ms / 700 * (_P1X - _P0X)


class LimitProvisional(DWScene):
    # weights = seconds between the pauses of audio-final/limit_provisional.wav (37.36 s, silencedetect)
    BEATS = [("gap", 2.82), ("stall", 5.34), ("returns", 3.22), ("look", 6.75), ("abort", 5.3), ("fix", 6.95),
             ("pid", 6.98)]

    def construct(self):
        title = scene_title("Limit: the provisional record has a short gap", RECORDS)
        illus = chip("illustrative", MUTED, mono=False).to_edge(RIGHT, buff=MARGIN).set_y(TITLE_Y)
        line = Line([_P0X, _PY, 0], [_P1X + 0.4, _PY, 0], stroke_color=MUTED, stroke_width=3)
        ticks = VGroup(*[Line([_px(ms), _PY - 0.12, 0], [_px(ms), _PY + 0.12, 0], stroke_color=TEXT,
                              stroke_width=3) for ms in (0, 500, 600)])
        tlabels = VGroup(*[T(f"{ms} ms", SMALL, TEXT, mono=True).next_to(t, DOWN, buff=0.12)
                           for ms, t in zip((0, 500, 600), ticks)])

        with self.beat("gap") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(illus), run_time=b.t(0.3))
            self.play(Create(line), FadeIn(ticks[0]), FadeIn(tlabels[0]), run_time=b.t(0.3))

        bar = Rectangle(width=_px(600) - _px(0), height=0.5, stroke_color=WIDGET, stroke_width=2.5,
                        fill_color=WIDGET, fill_opacity=0.15)
        bar.move_to([(_px(0) + _px(600)) / 2, _PY + 0.65, 0])
        bar0 = bar.copy().stretch_to_fit_width(0.05).align_to(bar, LEFT)
        bar_t = T("600 ms stall: a call of widget A", LABEL, TEXT).move_to(bar)
        prov = chip("provisional.json (widget A)", RECORDS, size=LABEL)
        prov.move_to([0, -1.05, 0]).align_to([_px(500) + 0.35, 0, 0], RIGHT)
        prov_ar = Arrow([_px(500), prov.get_top()[1], 0], tlabels[1].get_bottom(), buff=0.06, color=RECORDS,
                        stroke_width=3, max_tip_length_to_length_ratio=0.35)

        with self.beat("stall") as b:
            self.add(bar0)
            self.play(Transform(bar0, bar), run_time=b.t(0.42), rate_func=linear)
            self.play(FadeIn(bar_t), FadeIn(ticks[1:]), FadeIn(tlabels[1:]), run_time=b.t(0.12))
            _at(self, b, 0.59)
            self.play(GrowArrow(prov_ar), FadeIn(prov, shift=UP * 0.1), run_time=b.t(0.15))

        ret = T("call returns, beat returns", LABEL, HEARTBEAT).move_to([_px(600), _PY + 1.75, 0])
        ret_ar = Arrow(ret.get_bottom(), [_px(600), bar.get_top()[1], 0], buff=0.08, color=HEARTBEAT,
                       stroke_width=3, max_tip_length_to_length_ratio=0.3)

        with self.beat("returns") as b:
            self.play(FadeIn(ret, shift=DOWN * 0.1), GrowArrow(ret_ar), run_time=b.t(0.3))
            self.play(Indicate(ticks[2], color=HEARTBEAT, scale_factor=1.6), run_time=b.t(0.25))

        win = Rectangle(width=_px(650) - _px(600), height=0.5, stroke_width=0, fill_color=INFERRED,
                        fill_opacity=0.4).move_to([(_px(600) + _px(650)) / 2, _PY, 0])
        look = lines("next look of the watchdog:", "the note goes", size=SMALL, color=WORKER, buff=0.08)
        look.move_to([0, _PY + 0.72, 0]).align_to([_px(650) + 0.25, 0, 0], LEFT)
        win_t = inferred("≤ 50 ms", LABEL).move_to([0, -0.62, 0]).align_to([_PCOL, 0, 0], LEFT)

        with self.beat("look") as b:
            self.play(FadeIn(look), run_time=b.t(0.15))
            _at(self, b, 0.49)
            self.play(FadeIn(win), FadeIn(win_t), run_time=b.t(0.15))

        boom = burst(ISOLATION, 0.2).move_to([_px(625), _PY, 0]).set_z_index(2)
        boom_t = T("abort here blames A", LABEL, ISOLATION, bold=True)
        boom_t.next_to(win_t, DOWN, buff=0.3).align_to([_PCOL, 0, 0], LEFT)

        with self.beat("abort") as b:
            self.play(FadeIn(boom, scale=0.4), run_time=b.t(0.12))
            self.play(Flash(boom, color=ISOLATION, line_length=0.25), FadeIn(boom_t), run_time=b.t(0.2))
            _at(self, b, 0.46)
            self.play(Indicate(prov, color=ISOLATION, scale_factor=1.08), run_time=b.t(0.2))

        head = T("planned fix: remove the note when the call returns", LABEL, TEXT)
        ids = T("widget_fv.crash, unit widget.crash_records (docs/plans/widget-fv.md)", SMALL, MUTED, mono=True)
        notyet = chip("not built yet", OPEN, mono=False, dashed=True)
        row = VGroup(head, notyet).arrange(RIGHT, buff=0.4)
        plan = VGroup(row, ids).arrange(DOWN, buff=0.14, aligned_edge=LEFT)
        plan_box = rbox(plan.width + 0.5, plan.height + 0.35, OPEN, fill=0.05, sw=2.5, dashed=True)
        plan.move_to(plan_box)
        planc = VGroup(plan_box, head, ids).move_to([0, -2.35, 0]).align_to([_X0, 0, 0], LEFT)
        notyet.next_to(head, RIGHT, buff=0.4)

        with self.beat("fix") as b:
            self.play(FadeIn(planc), run_time=b.t(0.15))
            _at(self, b, 0.63)
            self.play(FadeIn(notyet), run_time=b.t(0.12))

        title2 = scene_title("Limit: a PID can come back", HOST)
        dead = ProcessBox("host", sub="pid P", color=HOST).move_to([-4.0, 1.0, 0])
        gone = T("exited", SMALL, ISOLATION).next_to(dead, DOWN, buff=0.15)
        other = ProcessBox("another process", sub="pid P", color=MUTED).move_to([3.0, 1.0, 0])
        later = labeled_arrow(dead.get_right(), other.get_left(), "later", MUTED, mono=False)
        reuse = _note("read", "PID reuse: not in the model check", "(side chat, 2026-11-04)")
        reuse.move_to([0, -0.9, 0]).align_to([_X0, 0, 0], LEFT)

        with self.beat("pid") as b:
            self.play(FadeOut(VGroup(line, ticks, tlabels, bar0, bar_t, prov, prov_ar, ret, ret_ar, win, win_t, look,
                                     boom, boom_t, planc, notyet)), Transform(title, title2), run_time=b.t(0.1))
            self.play(FadeIn(dead), run_time=b.t(0.08))
            self.play(dead.animate.set_opacity(0.35), FadeIn(gone), run_time=b.t(0.08))
            _at(self, b, 0.3)
            self.play(GrowArrow(later.arrow), FadeIn(later.label), FadeIn(other, shift=LEFT * 0.2),
                      run_time=b.t(0.12))
            _at(self, b, 0.68)
            self.play(FadeIn(reuse, shift=UP * 0.1), run_time=b.t(0.1))


# ====================================================================== limit_threshold
class LimitThreshold(DWScene):
    # weights = seconds between the pauses of audio-final/limit_threshold.wav (28.8 s, silencedetect)
    BEATS = [("one", 5.82), ("load", 3.67), ("rules", 4.66), ("crash", 7.62), ("node", 4.2), ("close", 2.83)]

    def construct(self):
        title = scene_title("Limit: the 2 s threshold", WORKER)
        wd = ProcessBox("watchdog", color=WORKER).move_to([-5.0, 1.9, 0])
        host = ProcessBox("host", sub="healthy, under load", color=HOST, sub_mono=False).move_to([3.6, 1.9, 0])
        two = labeled_arrow(wd.get_right(), host.get_left(), "no beat for 2 s: SIGKILL", ISOLATION, size=LABEL)
        host.sub.set_opacity(0)
        n1 = _note("read", "2 s: from one experiment (crash_only)", "(where-we-stand.md:242, watchdog.ts:6-8)")
        n2 = _note("read", "2026-11-02 17:15: healthy host stopped, stall 2061 ms under load",
                   "(docs/specs/widget-fv.md:85)")
        n3 = _note("read", "CLAUDE.md head.commands: under machine load,", "the watchdog can stop a healthy host;",
                   "open point \"Watchdog threshold\" (docs/specs/widget-fv.md:85)")
        notes = VGroup(n1, n2, n3).arrange(DOWN, buff=0.35, aligned_edge=LEFT)
        notes.move_to([0, -0.85, 0]).align_to([_X0, 0, 0], LEFT)

        with self.beat("one") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(wd), FadeIn(host), run_time=b.t(0.15))
            self.play(GrowArrow(two.arrow), FadeIn(two.label), run_time=b.t(0.15))
            _at(self, b, 0.66)
            self.play(FadeIn(n1, shift=UP * 0.1), run_time=b.t(0.12))

        with self.beat("load") as b:
            self.play(host.sub.animate.set_opacity(1), run_time=b.t(0.2))
            self.play(Indicate(host, color=ISOLATION, scale_factor=1.05), FadeIn(n2, shift=UP * 0.1),
                      run_time=b.t(0.3))

        with self.beat("rules") as b:
            self.play(FadeIn(n3, shift=UP * 0.1), run_time=b.t(0.15))

        outline = OutlineDiagram(self)
        title2 = scene_title("Crash only: one error stops every widget", ISOLATION)
        pinger = outline.node("widget_pinger").box
        boom = burst(ISOLATION, 0.24).move_to(pinger.get_corner(UR))
        chips = outline.box("widget_chips")
        stop_t = T("~2.1 s", LABEL, ISOLATION, mono=True).next_to(outline.box("widget_code"), DOWN, buff=0.18)
        prog0 = Line(stop_t.get_corner(DL) + DOWN * 0.15, stop_t.get_corner(DL) + DOWN * 0.15 + RIGHT * 0.02,
                     stroke_color=ISOLATION, stroke_width=6)
        prog = Line(stop_t.get_corner(DL) + DOWN * 0.15, stop_t.get_corner(DR) + DOWN * 0.15,
                    stroke_color=ISOLATION, stroke_width=6)
        src = T("(where-we-stand.md:242)", SMALL, MUTED, mono=True).next_to(stop_t, RIGHT, buff=0.3)

        with self.beat("crash") as b:
            self.play(FadeOut(VGroup(wd, host, two, notes)), Transform(title, title2), run_time=b.t(0.08))
            self.play(FadeIn(outline), run_time=b.t(0.08))
            self.play(outline.highlight("widget_code"), run_time=b.t(0.08))
            _at(self, b, 0.32)
            self.play(FadeIn(boom, scale=0.4), run_time=b.t(0.06))
            self.play(outline.highlight("late_error"), FadeIn(stop_t), FadeIn(prog0), FadeIn(src),
                      run_time=b.t(0.1))
            self.play(Transform(prog0, prog), run_time=b.t(0.25), rate_func=linear)
            self.play(outline.highlight("widget_code"), FadeOut(boom), run_time=b.t(0.1))

        node_t = _note("read", "Node docs: resuming after an uncaught exception is not safe")
        node_t.move_to([0, TITLE_Y, 0]).align_to([_X0 - 0.25, 0, 0], LEFT)

        with self.beat("node") as b:
            self.play(FadeOut(title), FadeOut(src), FadeIn(node_t), run_time=b.t(0.2))

        with self.beat("close") as b:
            OutlineDiagram(self).close_part(self, "write_down", next_key="all", also=("find_who",),
                                            run_time=b.left)
