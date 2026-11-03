"""Part `part_library`: the agent library and the split of main.tsx.

Scenes, in order: library_why library_split library_contract library_agent_code library_catalog library_work.
Beat weights follow the narration word counts of each sentence group.
Code text comes from the spike files in ~/.deepwidgets/kit-spike/build (long lines wrapped to fit).
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content
_X1 = FRAME_W / 2 - MARGIN - 0.1     # right edge of content


def _lock(color=KIT, s=0.3):
    body = RoundedRectangle(corner_radius=0.03, width=s, height=s * 0.75, stroke_color=color,
                            stroke_width=2, fill_color=color, fill_opacity=0.5)
    shackle = Arc(radius=s * 0.3, start_angle=0, angle=PI, stroke_color=color, stroke_width=2.5)
    shackle.next_to(body, UP, buff=0)
    return VGroup(shackle, body)


def _folder_icon(color=AGENT, s=0.5):
    pts = [[0, 0, 0], [s * 1.2, 0, 0], [s * 1.2, s * 0.75, 0], [s * 0.55, s * 0.75, 0], [s * 0.45, s * 0.9, 0],
           [0, s * 0.9, 0]]
    return Polygon(*pts, stroke_color=color, stroke_width=2.5).move_to(ORIGIN)


def _cross(m, color=ISOLATION, sw=5):
    return VGroup(Line(m.get_corner(UL), m.get_corner(DR), stroke_color=color, stroke_width=sw),
                  Line(m.get_corner(DL), m.get_corner(UR), stroke_color=color, stroke_width=sw))


def _arrow(a, b, color=TEXT, buff=0.1, sw=3.5):
    return Arrow(a, b, buff=buff, color=color, stroke_width=sw, tip_length=0.2,
                 max_tip_length_to_length_ratio=0.25)


def _words(parts, size=SMALL, mono=True, color=TEXT):
    """A line of separate Text words (so one word can be marked or recolored)."""
    g = VGroup(*[T(p, size, color, mono=mono) for p in parts])
    g.arrange(RIGHT, buff=0.2, aligned_edge=DOWN)
    return g


# ====================================================================== library_why
class LibraryWhy(DWScene):
    BEATS = [("open", 11), ("file", 18), ("today", 16), ("owns", 25), ("split", 19)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "agent_library", run_time=b.left)

        with self.beat("file") as b:
            title = scene_title("Why split main.tsx?", AGENT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.15))
            cx = -2.7
            card = rbox(7.0, 4.3, SHELL, fill=0.05)
            card.move_to([cx, 0.45, 0])
            path = T("deepwidgets/shell/src/main.tsx", LABEL, SHELL, mono=True)
            path.move_to(card.get_top() + DOWN * 0.38)
            blue = rbox(6.4, 1.45, KIT, fill=0.14)
            blue.move_to([cx, path.get_y() - 1.2, 0])
            b_txt = lines("channel, stream,", "refresh, diagnostics", size=BODY, color=TEXT)
            b_txt.move_to(blue).align_to(blue, LEFT).shift(RIGHT * 0.3)
            pink = rbox(6.4, 1.45, AGENT, fill=0.14)
            pink.next_to(blue, DOWN, buff=0.3)
            p_txt = lines("Renderer.Root", "+ widgetLibrary", size=LABEL, color=TEXT, mono=True)
            p_txt.move_to(pink).align_to(pink, LEFT).shift(RIGHT * 0.3)
            shell_lab = T("today: one file inside the shell", SMALL, SHELL)
            shell_lab.next_to(card, DOWN, buff=0.18).align_to(card, LEFT)
            self.play(Create(card), FadeIn(path), run_time=b.t(0.25))
            self.play(LaggedStart(FadeIn(VGroup(blue, b_txt)), FadeIn(VGroup(pink, p_txt)), lag_ratio=0.5),
                      run_time=b.t(0.35))
            self.play(FadeIn(shell_lab), run_time=b.t(0.15))

        with self.beat("today") as b:
            agent = ProcessBox("agent", "writes components?", color=AGENT, sub_mono=False)
            agent.move_to([4.5, pink.get_y(), 0])
            arr = DashedLine(agent.get_left() + LEFT * 0.1, pink.get_right() + RIGHT * 0.1, color=AGENT,
                             stroke_width=3, dash_length=0.1)
            arr.add_tip(tip_length=0.2, tip_width=0.2)
            xmark = _cross(Square(0.45).move_to(arr.get_center()))
            no = T("cannot reach", SMALL, ISOLATION).next_to(xmark, UP, buff=0.15)
            self.play(Indicate(pink, color=AGENT, scale_factor=1.03), run_time=b.t(0.3))
            self.play(FadeIn(agent), run_time=b.t(0.2))
            self.play(Create(arr), run_time=b.t(0.2))
            self.play(Create(xmark), FadeIn(no), run_time=b.t(0.2))

        with self.beat("owns") as b:
            self.play(FadeOut(VGroup(arr, xmark, no, agent)), FadeOut(shell_lab), run_time=b.t(0.15))
            kit_lab = chip("kit direction", KIT, mono=False)
            kit_lab.next_to(card, RIGHT, buff=0.5).align_to(card, UP)
            self.play(FadeIn(kit_lab), run_time=b.t(0.12))
            lock = _lock(KIT, 0.34)
            we = T("we lock", LABEL, KIT, bold=True)
            lock_g = VGroup(lock, we).arrange(RIGHT, buff=0.15)
            lock_g.move_to(blue).align_to(blue, RIGHT).shift(LEFT * 0.3)
            owns = T("agent owns", LABEL, AGENT, bold=True)
            owns.move_to(pink).align_to(pink, RIGHT).shift(LEFT * 0.3)
            self.play(FadeIn(owns, shift=LEFT * 0.15), Indicate(pink, color=AGENT, scale_factor=1.03),
                      run_time=b.t(0.3))
            self.play(FadeIn(lock_g, shift=LEFT * 0.15), Indicate(blue, color=KIT, scale_factor=1.03),
                      run_time=b.t(0.3))

        with self.beat("split") as b:
            slot = rbox(6.4, 1.45, AGENT, fill=0.0, sw=2, dashed=True).move_to(pink)
            folder = _folder_icon(AGENT, 0.55)
            f_lab = T("agent/", BODY, AGENT, mono=True)
            f_g = VGroup(folder, f_lab).arrange(RIGHT, buff=0.2)
            f_g.move_to([3.9, 0.55, 0])
            moving = VGroup(pink, p_txt, owns)
            p2 = rbox(4.4, 2.1, AGENT, fill=0.14)
            t2 = p_txt.copy()
            o2 = owns.copy()
            VGroup(t2, o2).arrange(DOWN, buff=0.25, aligned_edge=LEFT).move_to(p2)
            target = VGroup(p2, t2, o2).next_to(f_g, DOWN, buff=0.25)
            self.add(slot)
            self.play(FadeIn(f_g), run_time=b.t(0.15))
            self.play(Transform(moving, target), run_time=b.t(0.45))
            cap = caption("main.tsx splits: we lock one part, the agent writes the other")
            self.play(FadeIn(cap), run_time=b.t(0.15))


# ====================================================================== library_split
class LibrarySplit(DWScene):
    BEATS = [("halves", 5), ("core", 12), ("bridge", 13), ("agent", 19), ("import", 22), ("place", 10)]

    def construct(self):
        top, h = 2.9, 3.6
        with self.beat("halves") as b:
            title = scene_title("Two halves", AGENT)
            lbox = rbox(6.35, h, KIT, fill=0.07).move_to([-3.4, top - h / 2, 0])
            rbx = rbox(6.35, h, AGENT, fill=0.07).move_to([3.4, top - h / 2, 0])
            l_head = VGroup(_lock(KIT, 0.3), T("locked core", LABEL, KIT, bold=True)).arrange(RIGHT, buff=0.15)
            l_pkg = T("@deepwidgets/widget-kit", SMALL, TEXT, mono=True)
            l_hd = VGroup(l_head, l_pkg).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            l_hd.move_to(lbox.get_corner(UL) + RIGHT * 0.3 + DOWN * 0.3, aligned_edge=UL)
            r_head = T("agent half: a child component", LABEL, AGENT, bold=True)
            r_head.move_to(rbx.get_corner(UL) + RIGHT * 0.3 + DOWN * 0.3, aligned_edge=UL)
            self.play(FadeIn(title, shift=RIGHT * 0.2), Create(lbox), Create(rbx), run_time=b.t(0.5))
            self.play(FadeIn(l_hd), FadeIn(r_head), run_time=b.left)

        with self.beat("core") as b:
            x_items = l_hd.get_left()[0]
            items = [T("channel.ts", LABEL, TEXT, mono=True), T("RefreshBridge", LABEL, TEXT, mono=True),
                     T("boot", LABEL, TEXT, mono=True), T("diagnostics (window.__dw)", LABEL, TEXT, mono=True)]
            ys = [l_hd.get_bottom()[1] - 0.38 - i * 0.46 for i in range(4)]
            ys[2] -= 0.36
            ys[3] -= 0.36
            for it, y in zip(items, ys):
                it.move_to([x_items + 0.15, y, 0], aligned_edge=LEFT)
            self.play(LaggedStart(*[FadeIn(i, shift=RIGHT * 0.1) for i in items], lag_ratio=0.3),
                      run_time=b.t(0.7))

        with self.beat("bridge") as b:
            note = T("new stream data: run the queries again", SMALL, MUTED)
            note.move_to([x_items + 0.45, (ys[1] + ys[2]) / 2, 0], aligned_edge=LEFT)
            mk = SurroundingRectangle(items[1], color=KIT, buff=0.07, stroke_width=2.5, corner_radius=0.05)
            self.play(Create(mk), run_time=b.t(0.25))
            self.play(FadeIn(note, shift=DOWN * 0.1), run_time=b.t(0.3))

        with self.beat("agent") as b:
            xr = r_head.get_left()[0] + 0.15
            c1 = T("src/agent/child.tsx", LABEL, AGENT, mono=True)
            c1n = T("holds Renderer.Root", SMALL, MUTED)
            c2 = T("src/agent/library.tsx", LABEL, AGENT, mono=True)
            c2n = T("the library of the agent", SMALL, MUTED)
            c1.move_to([xr, r_head.get_bottom()[1] - 0.55, 0], aligned_edge=LEFT)
            c1n.next_to(c1, DOWN, buff=0.12, aligned_edge=LEFT).shift(RIGHT * 0.3)
            c2.next_to(c1n, DOWN, buff=0.35).align_to(c1, LEFT)
            c2n.next_to(c2, DOWN, buff=0.12, aligned_edge=LEFT).shift(RIGHT * 0.3)
            self.play(FadeOut(mk), FadeIn(c1, shift=RIGHT * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(c1n), run_time=b.t(0.15))
            self.play(FadeIn(c2, shift=RIGHT * 0.1), FadeIn(c2n), run_time=b.t(0.3))

        with self.beat("import") as b:
            lab = T("spike core/src/main.tsx:", SMALL, MUTED)
            code = code_block("import Child, { CATALOG_ID } from '@agent/child.tsx'", "typescript", color=KIT)
            lab.move_to([_X0, -1.0, 0], aligned_edge=LEFT)
            code.next_to(lab, DOWN, buff=0.12).align_to(lab, LEFT)
            self.play(FadeIn(lab), FadeIn(code, shift=UP * 0.1), run_time=b.t(0.3))
            link = DashedLine(c2n.get_bottom() + DOWN * 0.08, [code.get_right()[0] - 0.6, code.get_top()[1] + 0.05, 0],
                              color=AGENT, stroke_width=2.5, dash_length=0.08)
            self.play(Create(link), run_time=b.t(0.2))
            cat = VGroup(T("CATALOG_ID:", SMALL, AGENT, mono=True), T("from the same file", SMALL, TEXT))
            cat.arrange(DOWN, buff=0.08, aligned_edge=LEFT).next_to(code, RIGHT, buff=0.3)
            self.play(FadeIn(cat, shift=LEFT * 0.1), run_time=b.t(0.25))

        with self.beat("place") as b:
            c_core = chip("core", KIT, size=LABEL, mono=False)
            c_child = chip("<Child root={…} />", AGENT, size=LABEL)
            where = T("where Renderer.Root was", LABEL, TEXT)
            row = VGroup(c_core, T("puts", LABEL, TEXT), c_child, where).arrange(RIGHT, buff=0.25)
            row.move_to([0, -2.5, 0]).align_to(lab, LEFT)
            self.play(LaggedStart(*[FadeIn(m) for m in row], lag_ratio=0.3), run_time=b.t(0.6))


# ====================================================================== library_contract
class LibraryContract(DWScene):
    BEATS = [("type", 19), ("fields", 21), ("fill", 12), ("provider", 24), ("guard", 19), ("routes", 19)]

    CODE = """export type RootProps = Omit<
  ComponentProps<typeof Renderer.Root>,
  'library' | 'children'>
export interface ChildProps {
  root: RootProps; children?: ReactNode }"""

    def construct(self):
        with self.beat("type") as b:
            title = scene_title("The contract: ChildProps", KIT)
            lab = T("core/src/contract.ts (spike)", SMALL, MUTED, mono=True)
            lab.move_to([_X1, TITLE_Y, 0], aligned_edge=RIGHT)
            code = code_block(self.CODE, "typescript", color=KIT)
            code.move_to([_X0, CONTENT_TOP, 0], aligned_edge=UL)
            hide_lines(code)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(lab), run_time=b.t(0.25))
            self.add(code)
            self.play(reveal_lines(code, 0, 5, lag=0.2), run_time=b.t(0.35))
            m_cp = mark_line(code, 3, KIT)
            self.play(Create(m_cp), run_time=b.t(0.2))

        nx = code.get_right()[0] + 0.45
        with self.beat("fields") as b:
            f1 = M('<b>root</b>: every prop of', LABEL)
            f2 = T("Renderer.Root", LABEL, TEXT, mono=True)
            f3 = M('except <span font_family="Menlo">library</span>,', LABEL)
            f4 = M('<span font_family="Menlo">children</span>', LABEL)
            f5 = M('<b>children</b>: optional', LABEL)
            notes = VGroup(f1, f2, f3, f4, f5).arrange(DOWN, buff=0.12, aligned_edge=LEFT)
            f5.shift(DOWN * 0.15)
            notes.move_to([nx, code.get_top()[1] - 0.1, 0], aligned_edge=UL)
            self.play(ReplacementTransform(m_cp, mark_line(code, 4, KIT)), run_time=b.t(0.15))
            self.play(Indicate(code.code_lines[0:3], color=KIT, scale_factor=1.02), run_time=b.t(0.3))
            self.play(FadeIn(VGroup(f1, f2, f3, f4)), run_time=b.t(0.25))
            self.play(FadeIn(f5), run_time=b.t(0.15))

        with self.beat("fill") as b:
            ay = -0.8
            core = ProcessBox("core", color=KIT, title_size=BODY)
            core.move_to([_X0, ay, 0], aligned_edge=LEFT)
            child = ProcessBox("Child", "+ library", color=AGENT, title_size=BODY, sub_size=LABEL)
            child.move_to([_X1, ay, 0], aligned_edge=RIGHT)
            arr = _arrow(core.get_right(), child.get_left(), KIT, buff=0.12)
            l1 = _words(["root", "=", "{", "response,", "toolProvider,", "queryLoader,"])
            l2 = _words(["onParseResult,", "onError,", "onAction", "}"])
            obj = VGroup(l1, l2).arrange(DOWN, buff=0.12, aligned_edge=LEFT)
            l2.shift(RIGHT * (l1[3].get_left()[0] - l2.get_left()[0]))
            obj.next_to(arr, UP, buff=0.12)
            self.play(FadeIn(core), FadeIn(child.box), FadeIn(child.title), run_time=b.t(0.3))
            self.play(GrowArrow(arr), FadeIn(obj, shift=RIGHT * 0.2), run_time=b.t(0.45))

        with self.beat("provider") as b:
            tp = l1[4]
            mk = SurroundingRectangle(tp, color=MCP, buff=0.06, stroke_width=2.5, corner_radius=0.05)
            pn = M('<span font_family="Menlo">toolProvider</span>: sends each query and mutation to the call route',
                   SMALL)
            pn.move_to([0, -1.62, 0])
            pn.set_x(0)
            self.play(Create(mk), tp.animate.set_color(MCP), run_time=b.t(0.2))
            self.play(FadeIn(pn, shift=DOWN * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(child.sub, shift=UP * 0.1), Indicate(child.box, color=AGENT, scale_factor=1.04),
                      run_time=b.t(0.3))

        with self.beat("guard") as b:
            g = chip("a type, not a guard: the child can replace toolProvider", ISOLATION, mono=False,
                     size=LABEL)
            g.move_to([0, -2.1, 0])
            self.play(FadeIn(g, shift=UP * 0.1), run_time=b.t(0.3))
            self.play(mk.animate.set_color(ISOLATION), tp.animate.set_color(ISOLATION),
                      run_time=b.t(0.35))

        with self.beat("routes") as b:
            r = M(f'<span fgcolor="{INFERRED}">inferred:</span> agent code can call the host routes itself',
                  SMALL)
            r2 = T("page policy: same-origin requests are allowed", SMALL, MUTED)
            r.move_to([_X0, -2.6, 0], aligned_edge=LEFT)
            r2.next_to(r, RIGHT, buff=0.35)
            r = VGroup(r, r2)
            self.play(FadeIn(r, shift=UP * 0.1), run_time=b.t(0.35))


# ====================================================================== library_agent_code
class LibraryAgentCode(DWScene):
    BEATS = [("imports", 22), ("components", 22), ("create", 16), ("clock", 16), ("child", 16)]

    LIB = """import { z } from 'zod'
import { createLibrary, defineComponent }
  from '@openuidev/react-lang'
import { Meter } from 'dw-mini-ui'
export const CATALOG_ID = 'meter@1'
const Gauge = defineComponent({ name: 'Gauge',
  props: z.object({ value: z.number(),
    max: z.number().optional(), label: z.string() }),
  component: ({ props }) => <Meter value={props.value}
    max={props.max ?? 100} label={props.label} />,
})
const Stack = defineComponent({ name: 'Stack', … })
export const library = createLibrary(
  { root: 'Stack', components: [Stack, Gauge] })"""

    CHILD = """<Renderer.Root {...root} library={library}>
  <Renderer.Content />
  {children}
</Renderer.Root>"""

    def construct(self):
        with self.beat("imports") as b:
            title = scene_title("The real library of meter", AGENT)
            path = T("widgets/meter/agent/library.tsx", SMALL, AGENT, mono=True)
            path.move_to([_X1, 3.45, 0], aligned_edge=RIGHT)
            code = code_block(self.LIB, "tsx", color=AGENT)
            code.move_to([_X0, 2.95, 0], aligned_edge=UL)
            hide_lines(code)
            side_x = code.get_right()[0] + 0.3
            r_t = lines("real spike file,", "14 lines", size=SMALL, color=TEXT)
            real = VGroup(rbox(r_t.width + 0.44, r_t.height + 0.3, AGENT, fill=0.15, sw=2, r=0.1), r_t)
            r_t.move_to(real[0])
            real.move_to([side_x, 2.6, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(path), run_time=b.t(0.15))
            self.add(code)
            self.play(reveal_lines(code, 0, 4, lag=0.3), FadeIn(real), run_time=b.t(0.35))
            mk = SurroundingRectangle(code.code_lines[3], color=AGENT, buff=0.05, stroke_width=2.5,
                                      corner_radius=0.05)
            cap = caption("imports: zod, the OpenUI functions, Meter from dw-mini-ui")
            self.play(Create(mk), FadeIn(cap), run_time=b.t(0.25))

        with self.beat("components") as b:
            self.play(FadeOut(mk), reveal_lines(code, 4, 12, lag=0.15), run_time=b.t(0.35))
            mk2 = SurroundingRectangle(code.code_lines[5:8], color=AGENT, buff=0.05, stroke_width=2.5,
                                       corner_radius=0.05)
            cap2 = caption("Gauge: value, max, label. Stack: a vertical list of children")
            c_g = chip("Gauge", AGENT)
            c_s = chip("Stack", AGENT)
            VGroup(c_g, c_s).arrange(DOWN, buff=0.2, aligned_edge=LEFT).next_to(real, DOWN, buff=0.4) \
                .align_to(real, LEFT)
            self.play(Create(mk2), FadeTransform(cap, cap2), FadeIn(c_g), run_time=b.t(0.3))
            mk3 = SurroundingRectangle(code.code_lines[11], color=AGENT, buff=0.05, stroke_width=2.5,
                                       corner_radius=0.05)
            self.play(ReplacementTransform(mk2, mk3), FadeIn(c_s), run_time=b.t(0.25))

        with self.beat("create") as b:
            self.play(FadeOut(mk3), reveal_lines(code, 12, 14, lag=0.3), run_time=b.t(0.3))
            mk4 = SurroundingRectangle(code.code_lines[12:14], color=AGENT, buff=0.05, stroke_width=2.5,
                                       corner_radius=0.05)
            mk5 = SurroundingRectangle(code.code_lines[4], color=KIT, buff=0.05, stroke_width=2.5,
                                       corner_radius=0.05)
            root = T("root: Stack", SMALL, TEXT, mono=True).next_to(c_s, DOWN, buff=0.35).align_to(c_s, LEFT)
            cid = chip("meter@1", KIT).next_to(root, DOWN, buff=0.35).align_to(c_s, LEFT)
            cap3 = caption("createLibrary joins them, root Stack. Catalog id: meter@1")
            self.play(Create(mk4), FadeIn(root), FadeTransform(cap2, cap3), run_time=b.t(0.3))
            self.play(Create(mk5), FadeIn(cid), run_time=b.t(0.25))

        with self.beat("clock") as b:
            self.play(FadeOut(VGroup(code, mk4, mk5, real, c_g, c_s, root, cid, cap3, path)), run_time=b.t(0.2))
            m1 = chip("meter@1", AGENT, size=LABEL)
            same = T("same shape", LABEL, MUTED)
            m2 = chip("clock@1", AGENT, size=LABEL)
            row = VGroup(m1, same, m2).arrange(RIGHT, buff=0.4).move_to([0, 2.35, 0])
            tag = chip("clock@1: DateLine uses format() from date-fns", AGENT, size=SMALL)
            tag.next_to(row, DOWN, buff=0.35)
            self.play(FadeIn(row), run_time=b.t(0.3))
            self.play(FadeIn(tag, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("child") as b:
            clab = T("widgets/meter/agent/child.tsx: 7 lines", SMALL, AGENT, mono=True)
            ccode = code_block(self.CHILD, "tsx", color=AGENT, size=LABEL)
            VGroup(clab, ccode).arrange(DOWN, buff=0.18, aligned_edge=LEFT).next_to(tag, DOWN, buff=0.45)
            hide_lines(ccode)
            self.play(FadeIn(clab), run_time=b.t(0.15))
            self.add(ccode)
            self.play(reveal_lines(ccode, 0, 4, lag=0.25), run_time=b.t(0.35))
            cap4 = caption("the child wraps Renderer.Root around the library")
            self.play(FadeIn(cap4), run_time=b.t(0.15))


# ====================================================================== library_catalog
class LibraryCatalog(DWScene):
    BEATS = [("check", 24), ("today", 12), ("own", 9), ("guide", 13), ("infer", 11)]

    XS = (-2.9, 0.85, 4.6)
    NAMES = ("shadcn", "clock", "meter")

    def _strip_label(self, text, y, color):
        return T(text, LABEL, color, bold=True).move_to([_X0, y, 0], aligned_edge=LEFT)

    def construct(self):
        ky = -0.6
        with self.beat("check") as b:
            title = scene_title("One catalog per page", SHELL)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.1))
            k_lab = self._strip_label("kit", ky, KIT)
            pages, chips = [], []
            subs = ("copy of the shadcn set", None, None)
            ids = ("shadcn", "clock@1", "meter@1")
            for x, n, cid, sub in zip(self.XS, self.NAMES, ids, subs):
                w = window_card(f"{n} page", w=3.55, h=1.75, color=SHELL)
                c = chip(cid, AGENT)
                if sub:
                    s = T(sub, SMALL, MUTED)
                    g = VGroup(c, s).arrange(DOWN, buff=0.1)
                else:
                    g = VGroup(c)
                g.move_to(w.body_center)
                VGroup(w, g).shift([x, ky, 0])
                pages.append(w)
                chips.append(g)
            self.play(FadeIn(k_lab), LaggedStart(*[FadeIn(p) for p in pages], lag_ratio=0.2), run_time=b.t(0.25))
            self.play(LaggedStart(*[FadeIn(c, scale=0.9) for c in chips], lag_ratio=0.25), run_time=b.t(0.2))
            rule = M('each page compiles in one catalog: the <span font_family="Menlo">CATALOG_ID</span>'
                     ' that its child exports', SMALL)
            rule.move_to([0, 2.45, 0])
            prog = chip("program names clock@1", ISOLATION, mono=False)
            prog.move_to([self.XS[2], 1.35, 0])
            arr = _arrow(prog.get_bottom(), pages[2].get_top(), ISOLATION, buff=0.08)
            xm = _cross(Square(0.36).move_to(arr.get_center()))
            ref = T("refused", SMALL, ISOLATION).next_to(xm, LEFT, buff=0.2)
            self.play(FadeIn(rule), run_time=b.t(0.15))
            self.play(FadeIn(prog), GrowArrow(arr), run_time=b.t(0.15))
            self.play(Create(xm), FadeIn(ref), run_time=b.t(0.1))

        with self.beat("today") as b:
            self.play(FadeOut(VGroup(rule, prog, arr, xm, ref)), run_time=b.t(0.2))
            ty = 1.55
            t_lab = self._strip_label("today", ty, SHELL)
            wins = []
            for x, n in zip(self.XS, self.NAMES):
                w = window_card(n, w=3.55, h=1.35, color=SHELL)
                c = chip("shadcn-widgets@1", SHELL).move_to(w.body_center)
                VGroup(w, c).shift([x, ty, 0])
                wins.append(VGroup(w, c))
            self.play(FadeIn(t_lab), LaggedStart(*[FadeIn(w) for w in wins], lag_ratio=0.2), run_time=b.t(0.5))
            shared = T("one shared catalog", SMALL, MUTED).next_to(wins[0], UP, buff=0.12).align_to(wins[0], LEFT)
            self.play(FadeIn(shared), run_time=b.t(0.2))

        with self.beat("own") as b:
            self.play(LaggedStart(*[Indicate(c, color=AGENT, scale_factor=1.12) for c in chips], lag_ratio=0.2),
                      run_time=b.t(0.6))
            own = T("own catalog per widget", SMALL, MUTED).next_to(pages[0], UP, buff=0.12).align_to(pages[0], LEFT)
            self.play(FadeIn(own), run_time=b.t(0.25))

        with self.beat("guide") as b:
            gd = M('the guide must describe the catalog of <b>each</b> widget, not one shared set', LABEL)
            gd.move_to([0, -2.0, 0])
            self.play(FadeIn(gd, shift=UP * 0.1), run_time=b.t(0.35))

        with self.beat("infer") as b:
            note = chip("guide per widget catalog (inferred, not tested)", INFERRED, mono=False)
            note.move_to([0, -2.6, 0])
            self.play(FadeIn(note, shift=UP * 0.1), run_time=b.t(0.35))


# ====================================================================== library_work
class LibraryWork(DWScene):
    BEATS = [("reads", 12), ("writes", 27), ("fail", 19), ("size", 19), ("close", 10)]

    def construct(self):
        outline = OutlineDiagram()
        lx, vx = _X0 + 0.3, _X0 + 2.6

        def label(t, y):
            return T(t, LABEL, MUTED, bold=True).move_to([lx, y, 0], aligned_edge=LEFT)

        def val(m, y):
            return m.move_to([vx, y, 0], aligned_edge=LEFT)

        with self.beat("reads") as b:
            title = scene_title("What the agent library front reads and writes", AGENT)
            card = rbox(_X1 - _X0, 4.15, AGENT, fill=0.05)
            card.move_to([(_X0 + _X1) / 2, 0.8, 0])
            r_l = label("Reads", 2.3)
            r_v = val(T("deepwidgets/shell/src/main.tsx", LABEL, SHELL, mono=True), 2.3)
            self.play(FadeIn(title, shift=RIGHT * 0.2), Create(card), run_time=b.t(0.4))
            self.play(FadeIn(r_l), FadeIn(r_v, shift=RIGHT * 0.1), run_time=b.t(0.35))

        with self.beat("writes") as b:
            w_l = label("Writes", 1.45)
            w1 = VGroup(_lock(KIT, 0.28), T("@deepwidgets/widget-kit locked core", LABEL, KIT, mono=True))
            w1.arrange(RIGHT, buff=0.15)
            w1 = val(w1, 1.45)
            w2 = val(T("template: src/agent/library.tsx + child.tsx", LABEL, AGENT, mono=True), 0.9)
            w3 = val(M('template tool gives the library folder and the child file', SMALL, MUTED), 0.42)
            self.play(FadeIn(w_l), FadeIn(w1, shift=RIGHT * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(w2, shift=RIGHT * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(w3), run_time=b.t(0.2))

        with self.beat("fail") as b:
            f_l = label("On failure", -0.35)
            f1 = val(T("missing child or bad export", LABEL, ISOLATION), -0.35)
            f2 = VGroup(T("type gate or build stops", LABEL, CREATION), T("(inferred)", LABEL, INFERRED))
            f2.arrange(RIGHT, buff=0.15)
            f2 = val(f2, -0.82)
            self.play(FadeIn(f_l), FadeIn(f1, shift=RIGHT * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(f2, shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("size") as b:
            s1 = chip("split of main.tsx: M (estimate)", INFERRED, mono=False, size=LABEL)
            s2 = chip("guide and template: S (estimate)", INFERRED, mono=False, size=LABEL)
            sizes = VGroup(s1, s2).arrange(RIGHT, buff=0.4)
            sizes.next_to(card, DOWN, buff=0.35).align_to(card, LEFT)
            self.play(FadeIn(s1, shift=UP * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(s2, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("close") as b:
            outline.close_part(self, "agent_library", next_key="vite_build", run_time=b.left)
