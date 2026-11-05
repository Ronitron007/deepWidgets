"""part_memory: the call stack and the heap (script scenes `call_stack`, `heap_vs_stack`).

Opens on the outline at `f_call_stack` (also `widget_code`), closes there and lights `start_again`.
Code cards and outputs are the real snippets of `sources.runs` (`stack.cjs`, `heap.cjs`).
The scene class `CallStack` shadows loopviz.CallStack in this module, so the pile is `_Pile`.
"""
from dwscene import *
from loopviz import CallStack as _Pile

_STACK_CJS = """\
function c() { console.log('  c runs, then returns') }
function b() { console.log(' b calls c'); c(); console.log(' back in b') }
function a() { console.log('a calls b'); b(); console.log('back in a') }
a()
console.log('stack empty')"""

_STACK_OUT = """\
a calls b
 b calls c
  c runs, then returns
 back in b
back in a
stack empty"""

_HEAP_CJS = """\
function makeUser() {
  const user = { name: 'pinger' }   // the object goes to the heap
  return user                       // only the arrow leaves the call
}
const u = makeUser()                // makeUser is off the stack now
console.log('object still alive:', u.name)"""

_HEAP_OUT = "object still alive: pinger"

_CREDIT = 'pancake pile: Lydia Hallie, "JavaScript Visualized: Event Loop" (dev.to, 2019)'


def _code(src, language="javascript", color=MUTED, buff=0.25) -> Code:
    """style.code_block with a chosen panel padding (stack.cjs needs a thinner one to fit at size 22)."""
    c = Code(code_string=src.strip("\n"), language=language, formatter_style="github-dark",
             add_line_numbers=False,
             paragraph_config={"font": MONO, "font_size": CODE, "line_spacing": 0.6},
             background_config={"fill_color": PANEL, "stroke_color": color, "stroke_width": 2,
                                 "corner_radius": 0.14, "buff": buff})
    c._dw_fs = CODE
    c._dw_ref_h = c.code_lines.height
    return c


def _ran_note(*ls) -> VGroup:
    """The `ran` claim tag with a short grey note under it."""
    return VGroup(claim_tag("ran"), lines(*ls, size=SMALL, color=MUTED, buff=0.08)).arrange(
        DOWN, buff=0.14, aligned_edge=LEFT)


def _base_at(pile, x, y):
    """Shift vector that puts the pile's base line center at (x, y)."""
    return np.array([x, y, 0]) - pile.base.get_center()


def _at(scene, b, frac):
    """Wait until `frac` of beat b (a cue point taken from the pauses of the final audio)."""
    scene.wait_until(b.start + frac * b.length)


def _lift(m):
    """m lifts off and fades, like a popped pancake."""
    return m.animate.shift(UP * 0.35).set_opacity(0)


class CallStack(DWScene):
    # weights = seconds between the pauses of audio-final/call_stack.wav (35.56 s)
    BEATS = [("open", 3.0), ("define", 3.7), ("pancakes", 7.5), ("grow", 6.7), ("shrink", 7.3), ("locals", 7.36)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram(self).open_part(self, "f_call_stack", also=("widget_code",), run_time=b.left)

        with self.beat("define") as b:
            title = scene_title("The call stack", STACK)
            pile = _Pile(width=2.4, max_frames=3)
            pile.shift(_base_at(pile, -3.0, -1.4))
            idea = lines("the function calls", "that run now", size=BODY, color=TEXT)
            idea.move_to([1.6, 0.0, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(pile), run_time=b.t(0.3))
            _at(self, b, 0.55)
            self.play(FadeIn(idea), run_time=b.t(0.25))

        with self.beat("pancakes") as b:
            credit = chip(_CREDIT, STACK, mono=False, fill=0.08).move_to([-0.6, -2.45, 0])
            rule_call = M('<b>call</b>: one pancake on top', BODY)
            rule_ret = M('<b>return</b>: top pancake off', BODY)
            rules = VGroup(rule_call, rule_ret).arrange(DOWN, buff=0.4, aligned_edge=LEFT).move_to([1.8, 0.0, 0])
            self.play(FadeOut(idea), FadeIn(credit), run_time=b.t(0.12))
            _at(self, b, 0.29)
            self.play(FadeIn(rule_call), pile.push(None), run_time=b.t(0.1))
            self.play(pile.push(None), run_time=b.t(0.08))
            self.play(pile.push(None), run_time=b.t(0.08))
            _at(self, b, 0.62)
            self.play(FadeIn(rule_ret), pile.pop(), run_time=b.t(0.1))
            self.play(pile.pop(), run_time=b.t(0.07))
            self.play(pile.pop(), run_time=b.t(0.07))

        with self.beat("grow") as b:
            code = _code(_STACK_CJS, buff=0.15)
            code.move_to([0, 0, 0]).align_to([0, 2.95, 0], UP)
            fname = T("stack.cjs", SMALL, MUTED, mono=True)
            fname.move_to([0, TITLE_Y, 0]).align_to(code, RIGHT)
            out = _code(_STACK_OUT, language="text")
            out.align_to(code, LEFT).align_to([0, 0.35, 0], UP)
            hide_lines(out)
            note = _ran_note("node v22.23.0 and", "Electron: same output")
            note.next_to(out, RIGHT, buff=0.5).align_to(out, UP)
            self.play(FadeOut(rules), FadeOut(credit), pile.animate.shift(_base_at(pile, 4.6, -2.0)),
                      run_time=b.t(0.1))
            self.play(FadeIn(code), FadeIn(fname), FadeIn(out), FadeIn(note), run_time=b.t(0.1))
            mark = mark_line(code, 3)
            self.play(Create(mark), run_time=b.t(0.06))
            for i, ((lbl, line), at) in enumerate(zip((("a()", 2), ("b()", 1), ("c()", 0)), (0.27, 0.43, 0.55))):
                _at(self, b, at)
                self.play(pile.push(lbl), Transform(mark, mark_line(code, line)), reveal_lines(out, i),
                          run_time=b.t(0.1))
            _at(self, b, 0.8)
            self.play(Indicate(VGroup(*pile.frames), color=STACK, scale_factor=1.06), run_time=b.t(0.15))

        with self.beat("shrink") as b:
            for i, (line, at) in enumerate(((1, 0.02), (2, 0.24), (4, 0.39))):
                _at(self, b, at)
                self.play(pile.pop(), Transform(mark, mark_line(code, line)), reveal_lines(out, i + 3),
                          run_time=b.t(0.08))
            _at(self, b, 0.56)
            self.play(Indicate(out.code_lines[5], color=STACK, scale_factor=1.08), run_time=b.t(0.2))

        with self.beat("locals") as b:
            self.play(FadeOut(code), FadeOut(fname), FadeOut(out), FadeOut(note), FadeOut(mark),
                      pile.animate.shift(_base_at(pile, 1.2, -0.9)), run_time=b.t(0.08))
            self.play(pile.push("a()"), run_time=b.t(0.06))
            va = chip("local values", STACK, mono=False).next_to(pile.top, LEFT, buff=0.3)
            self.play(FadeIn(va, shift=RIGHT * 0.2), run_time=b.t(0.06))
            self.play(pile.push("b()"), run_time=b.t(0.06))
            vb = chip("local values", STACK, mono=False).next_to(pile.top, LEFT, buff=0.3)
            self.play(FadeIn(vb, shift=RIGHT * 0.2), run_time=b.t(0.06))
            _at(self, b, 0.51)
            cap = caption("a return takes its local values with it")
            self.play(FadeIn(cap), run_time=b.t(0.08))
            _at(self, b, 0.7)
            self.play(pile.pop(), _lift(vb), run_time=b.t(0.12))


class HeapVsStack(DWScene):
    # weights = seconds between the pauses of audio-final/heap_vs_stack.wav (29.96 s)
    BEATS = [("place", 4.9), ("arrow", 7.7), ("make", 3.9), ("stays", 7.1), ("asked", 3.7), ("close", 2.66)]

    def construct(self):
        heap_y = -1.3

        with self.beat("place") as b:
            title = scene_title("The heap", HEAP)
            pile = _Pile(width=2.8, max_frames=2)
            pile.shift(_base_at(pile, -5.1, -1.95))
            heap = rbox(8.6, 2.1, HEAP, fill=0.06).move_to([2.35, -1.2, 0])
            heap_lbl = T("heap", LABEL, HEAP, bold=True)
            heap_lbl.align_to(heap, UP).align_to(heap, LEFT).shift(DOWN * 0.2 + RIGHT * 0.25)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(pile), run_time=b.t(0.3))
            _at(self, b, 0.74)
            self.play(Create(heap), FadeIn(heap_lbl), run_time=b.t(0.2))

        with self.beat("arrow") as b:
            sub = T("a big area of memory for objects", LABEL, MUTED).next_to(heap_lbl, RIGHT, buff=0.3)
            _at(self, b, 0.08)
            self.play(FadeIn(sub), run_time=b.t(0.08))
            obj = chip("object", HEAP, mono=False).move_to([2.3, heap_y, 0])
            self.play(FadeIn(obj, scale=0.8), run_time=b.t(0.08))
            _at(self, b, 0.47)
            self.play(pile.push("a call"), run_time=b.t(0.06))
            dot = Dot(radius=0.07, color=STACK).next_to(pile.top, RIGHT, buff=0.15)
            arr = Arrow(dot.get_center(), obj.get_left(), buff=0.08, color=STACK, stroke_width=4)
            self.play(FadeIn(dot), GrowArrow(arr), run_time=b.t(0.12))

        with self.beat("make") as b:
            code = _code(_HEAP_CJS).move_to([0, 0, 0]).align_to([0, 2.95, 0], UP)
            fname = T("heap.cjs", SMALL, MUTED, mono=True)
            fname.move_to([0, TITLE_Y, 0]).align_to(code, RIGHT)
            self.play(pile.pop(), _lift(dot), FadeOut(arr), FadeOut(obj), FadeOut(sub), FadeIn(code),
                      FadeIn(fname), run_time=b.t(0.12))
            mark = mark_line(code, 4)
            self.play(pile.push("caller"), Create(mark), run_time=b.t(0.1))
            _at(self, b, 0.22)
            self.play(pile.push("makeUser()"), Transform(mark, mark_line(code, 0)), run_time=b.t(0.12))
            obj = chip("{ name: 'pinger' }", HEAP).move_to([2.6, heap_y, 0])
            user = VGroup(T("user", SMALL, TEXT, mono=True), Dot(radius=0.07, color=STACK)).arrange(
                RIGHT, buff=0.12).next_to(pile.top, RIGHT, buff=0.12)
            arr = Arrow(user[1].get_center(), obj.get_left(), buff=0.08, color=STACK, stroke_width=4)
            _at(self, b, 0.45)
            self.play(Transform(mark, mark_line(code, 1)), FadeIn(obj, scale=0.8), run_time=b.t(0.12))
            self.play(FadeIn(user), GrowArrow(arr), run_time=b.t(0.12))
            _at(self, b, 0.78)
            self.play(Transform(mark, mark_line(code, 2)), run_time=b.t(0.1))

        with self.beat("stays") as b:
            caller = pile.frames[0]
            u = VGroup(T("u", SMALL, TEXT, mono=True), Dot(radius=0.07, color=STACK)).arrange(
                RIGHT, buff=0.12)
            u.next_to(caller, RIGHT, buff=0.12).align_to(user, LEFT)
            arr2 = Arrow(u[1].get_center(), obj.get_left(), buff=0.08, color=STACK, stroke_width=4)
            _at(self, b, 0.04)
            self.play(Transform(mark, mark_line(code, 4)), FadeIn(u), run_time=b.t(0.08))
            self.play(pile.pop(), _lift(user), Transform(arr, arr2), run_time=b.t(0.12))
            _at(self, b, 0.46)
            self.play(Indicate(obj, color=HEAP, scale_factor=1.12), run_time=b.t(0.12))
            out = T(_HEAP_OUT, SMALL, TEXT, mono=True)
            row = VGroup(out, claim_tag("ran")).arrange(RIGHT, buff=0.3)
            row.next_to(heap, DOWN, buff=0.25).align_to(heap, LEFT)
            _at(self, b, 0.68)
            self.play(Indicate(u, color=STACK, scale_factor=1.3), run_time=b.t(0.1))
            self.play(Transform(mark, mark_line(code, 5)), FadeIn(row), run_time=b.t(0.1))

        with self.beat("asked") as b:
            card_txt = VGroup(T("asked:", SMALL, MUTED),
                              lines("does each thread", "have its own heap?", size=SMALL)).arrange(
                DOWN, buff=0.1, aligned_edge=LEFT)
            card = VGroup(rbox(card_txt.width + 0.5, card_txt.height + 0.4, MUTED, fill=0.08, sw=2), card_txt)
            card_txt.move_to(card[0])
            card.to_edge(RIGHT, buff=MARGIN).set_y(1.75)
            self.play(FadeOut(code), FadeOut(fname), FadeOut(mark), run_time=b.t(0.12))
            _at(self, b, 0.15)
            self.play(FadeIn(card, shift=LEFT * 0.4), run_time=b.t(0.15))

        with self.beat("close") as b:
            OutlineDiagram(self).close_part(self, "f_call_stack", next_key="start_again",
                                            also=("widget_code", "f_heap"), run_time=b.left)
