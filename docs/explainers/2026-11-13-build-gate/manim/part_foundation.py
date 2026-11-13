"""part_foundation: core_and_child, page_folder, fixed_files, dw_core_block."""
from dwscene import *

CITE = MUTED


def _cite(text):
    return T(text, SMALL, CITE)


def _bullets(items, color=TEXT, size=SMALL):
    return VGroup(*[T(f"· {x}", size, color) for x in items]).arrange(DOWN, buff=0.16,
                                                                          aligned_edge=LEFT)


class CoreAndChild(DWScene):
    BEATS = [("split", 12), ("halves", 49), ("contract", 29), ("cite", 18), ("new", 21)]

    def construct(self):
        with self.beat("split") as b:
            title = scene_title("the page has two halves", SHELL)
            page = rbox(11.6, 4.0, SHELL, fill=0.04, sw=3)
            page.move_to([0, -0.1, 0])
            tag = T("page", LABEL, SHELL, bold=True).next_to(page.get_corner(UL), DR, buff=0.16)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(Create(page), FadeIn(tag), run_time=b.t(0.5))
            self.page = page

        with self.beat("halves") as b:
            core = rbox(5.2, 3.2, KIT, fill=0.08, sw=3)
            core.move_to([-3.0, -0.3, 0])
            ct = T("core (widget-kit)", LABEL, KIT, bold=True)
            cl = _bullets(["loads the program", "sends each query and mutation",
                           "reads the stream", "draws the four page states"])
            VGroup(ct, cl).arrange(DOWN, buff=0.3).move_to(core)
            child = rbox(5.2, 3.2, AGENT, fill=0.08, sw=3)
            child.move_to([3.0, -0.3, 0])
            ht = T("child (agent)", LABEL, AGENT, bold=True)
            hl = _bullets(["one React component", "holds the renderer root",
                           "holds a component library"])
            VGroup(ht, hl).arrange(DOWN, buff=0.3).move_to(child)
            self.play(FadeIn(core), FadeIn(ct), run_time=b.t(0.16))
            self.play(LaggedStart(*[FadeIn(x) for x in cl], lag_ratio=0.3), run_time=b.t(0.3))
            self.play(FadeIn(child), FadeIn(ht), run_time=b.t(0.16))
            self.play(LaggedStart(*[FadeIn(x) for x in hl], lag_ratio=0.3), run_time=b.t(0.28))
            self.core, self.child = core, child

        with self.beat("contract") as b:
            seam = Line([0, 1.4, 0], [0, -2.0, 0], stroke_color=CREATION, stroke_width=5)
            label = chip("ChildProps { root, children }", CREATION)
            label.move_to([0, 1.95, 0])
            fills = VGroup(T("core fills root", SMALL, KIT), T("child adds its library", SMALL, AGENT))
            fills[0].move_to([-3.0, -2.25, 0])
            fills[1].move_to([3.0, -2.25, 0])
            self.play(Create(seam), run_time=b.t(0.3))
            self.play(FadeIn(label), run_time=b.t(0.25))
            self.play(FadeIn(fills[0]), FadeIn(fills[1]), run_time=b.t(0.3))

        with self.beat("cite") as b:
            c = _cite("widget kit video  07:29, and the contract at 08:00")
            c.move_to([0, CAPTION_Y, 0])
            self.play(FadeIn(c), run_time=b.t(0.4))

        with self.beat("new") as b:
            new = T("new: the core is its own package, the shell keeps the default child",
                    LABEL, KIT)
            new.move_to([0, 2.55, 0])
            self.play(FadeIn(new, shift=DOWN * 0.15), run_time=b.t(0.45))


class PageFolder(DWScene):
    BEATS = [("ask", 6), ("bundle", 25), ("page", 34), ("files", 46), ("template", 15)]

    def construct(self):
        with self.beat("ask") as b:
            title = scene_title("what the agent writes", AGENT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("bundle") as b:
            root = T("widget bundle/", BODY, TEXT, mono=True)
            src = T("src/index.ts", BODY, HOST, mono=True)
            note = T("the host half: the actions and the state", SMALL, MUTED)
            src_row = VGroup(src, note).arrange(RIGHT, buff=0.45)
            tree = VGroup(root, src_row).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
            tree.move_to([-1.2, 2.0, 0])
            src_row.shift(RIGHT * 0.6)
            self.play(FadeIn(root), run_time=b.t(0.3))
            self.play(FadeIn(src_row), run_time=b.t(0.4))
            self.tree_top = tree

        with self.beat("page") as b:
            pg = T("page/", BODY, SHELL, mono=True)
            pg.next_to(self.tree_top, DOWN, buff=0.35).align_to(self.tree_top, LEFT).shift(RIGHT * 0.6)
            cap = T("five files: three fixed, two of the agent", SMALL, MUTED)
            cap.next_to(pg, RIGHT, buff=0.45)
            self.play(FadeIn(pg), run_time=b.t(0.35))
            self.play(FadeIn(cap), run_time=b.t(0.35))
            self.pg = pg

        with self.beat("files") as b:
            rows, icons = VGroup(), VGroup()
            spec = [("index.html", lock_icon, FILES, "fixed"),
                    ("main.tsx", lock_icon, FILES, "fixed"),
                    ("styles.css", lock_icon, FILES, "fixed: the dw-core block only"),
                    ("child.tsx", pencil_icon, AGENT, "the agent writes it"),
                    ("library.tsx", pencil_icon, AGENT, "the agent writes it")]
            names = [T(n, BODY, c, mono=True) for n, _, c, _ in spec]
            wname = max(n.width for n in names)
            for i, ((name, icon, color, note), nm) in enumerate(zip(spec, names)):
                ic = icon(color)
                nt = T(note, SMALL, MUTED)
                y = -i * 0.55
                ic.move_to([0.0, y, 0])
                nm.move_to([0.42, y, 0], aligned_edge=LEFT)
                nt.move_to([0.42 + wname + 0.55, y, 0], aligned_edge=LEFT)
                rows.add(VGroup(ic, nm, nt))
            rows.next_to(self.pg, DOWN, buff=0.45).align_to(self.pg, LEFT).shift(RIGHT * 0.7)
            self.play(LaggedStart(*[FadeIn(r, shift=RIGHT * 0.2) for r in rows], lag_ratio=0.45),
                      run_time=b.t(0.85))
            self.rows = rows

        with self.beat("template") as b:
            cap = caption("the template gives every file; the agent fills two and leaves the rest")
            self.play(FadeIn(cap), run_time=b.t(0.5))


class FixedFiles(DWScene):
    BEATS = [("why", 5), ("html", 49), ("main", 30), ("seam", 32)]

    HTML = """
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self';
      style-src 'self' 'unsafe-inline'; connect-src 'self';
      img-src 'self' data:" />
    <title>widget</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
"""

    MAIN = """
import { mountWidget } from '@deepwidgets/widget-kit'
import { CATALOG_ID, Child } from './child.tsx'
import './styles.css'

mountWidget({ catalog: CATALOG_ID, child: Child })
"""

    def construct(self):
        with self.beat("why") as b:
            title = scene_title("why three files are fixed", FILES)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("html") as b:
            name = T("page/index.html", LABEL, FILES, mono=True)
            code = code_block(self.HTML, "html")
            group = VGroup(name, code).arrange(DOWN, buff=0.22, aligned_edge=LEFT)
            group.move_to([0, -0.35, 0])
            hide_lines(code, 0)
            self.play(FadeIn(name), FadeIn(code.background), run_time=b.t(0.12))
            self.play(reveal_lines(code, 0, len(code.code_lines), lag=0.08), run_time=b.t(0.3))
            mark = VGroup(*[mark_line(code, i, CREATION) for i in (4, 5, 6, 7)])
            box = SurroundingRectangle(VGroup(*[code.code_lines[i] for i in (4, 5, 6, 7)]),
                                       color=CREATION, buff=0.06, stroke_width=3, corner_radius=0.05)
            note = T("the content security policy of the page", SMALL, CREATION)
            note.move_to([2.9, 2.8, 0])
            self.play(Create(box), run_time=b.t(0.2))
            self.play(FadeIn(note), run_time=b.t(0.15))
            cite = _cite("widget kit video  38:05")
            cite.move_to([0, CAPTION_Y, 0])
            self.play(FadeIn(cite), run_time=b.t(0.12))
            self.html_group = VGroup(group, box, note, cite)

        with self.beat("main") as b:
            self.play(FadeOut(self.html_group), run_time=b.t(0.12))
            name = T("page/main.tsx", LABEL, FILES, mono=True)
            code = code_block(self.MAIN, "typescript")
            group = VGroup(name, code).arrange(DOWN, buff=0.22)
            group.move_to([-1.4, 0.4, 0])
            hide_lines(code, 0)
            self.play(FadeIn(name), FadeIn(code.background), run_time=b.t(0.1))
            labels = ["the mount function of the core", "the child of the agent",
                      "the stylesheet", "", "it calls that function"]
            notes = VGroup()
            for i, text in enumerate(labels):
                if not text:
                    continue
                n = T(text, SMALL, MUTED)
                n.next_to(code.code_lines[i], RIGHT, buff=0.5).align_to(code, RIGHT).shift(RIGHT * 0.35)
                n.set_y(code.code_lines[i].get_y())
                notes.add(n)
            steps = [0, 1, 2, 4]
            anims = []
            for j, i in enumerate(steps):
                anims.append(AnimationGroup(reveal_lines(code, i), FadeIn(notes[j])))
            self.play(LaggedStart(*anims, lag_ratio=0.5), run_time=b.t(0.6))
            self.play(reveal_lines(code, 3), run_time=b.t(0.05))
            self.main_group = VGroup(group, notes)

        with self.beat("seam") as b:
            seam = T("both files are the seam between the core and the child", BODY, TEXT)
            seam.move_to([0, -2.2, 0])
            rule = T("an agent that edits them can route the page anywhere", BODY, ISOLATION)
            rule.next_to(seam, DOWN, buff=0.3)
            self.play(FadeIn(seam), run_time=b.t(0.3))
            self.play(FadeIn(rule), run_time=b.t(0.3))
            cap = caption("so the gate holds them to the template, byte for byte")
            self.play(FadeIn(cap), run_time=b.t(0.25))


class DwCoreBlock(DWScene):
    BEATS = [("third", 10), ("states", 39), ("block", 33), ("cascade", 25), ("hole", 51)]

    BLOCK = """
/* dw-core:begin. Do not change this block. */
@layer dw-core {
  .dw-surface { background: var(--card) !important; ... }
  .dw-state { display: flex !important; ... }
  .dw-state strong { color: var(--foreground) !important; }
  .dw-state--error strong { color: ... !important; }
  .dw-skeleton { height: 12px !important; ... }
  .dw-skeleton + .dw-skeleton { width: 70% !important; }
}
/* dw-core:end */
"""

    @staticmethod
    def _state(title, color, kind):
        card = window_card(title, w=2.7, h=1.5, color=color)
        if kind == "loading":
            body = VGroup(*[RoundedRectangle(corner_radius=0.05, width=w, height=0.16, stroke_width=0,
                                             fill_color=MUTED, fill_opacity=0.7) for w in (1.9, 1.3)])
            body.arrange(DOWN, buff=0.16, aligned_edge=LEFT)
        elif kind == "error":
            t = T("could not load", SMALL, ISOLATION, bold=True)
            btn = chip("Retry", ISOLATION, mono=False)
            body = VGroup(t, btn).arrange(DOWN, buff=0.18)
        else:
            body = T(kind, SMALL, MUTED)
        body.move_to(card.body())
        return VGroup(card, body)

    def construct(self):
        with self.beat("third") as b:
            title = scene_title("the third fixed thing is a block", FILES)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("states") as b:
            cards = VGroup(self._state("loading", SHELL, "loading"),
                           self._state("error", ISOLATION, "error"),
                           self._state("empty", SHELL, "no data"),
                           self._state("removed", SHELL, "widget removed"))
            cards.arrange(RIGHT, buff=0.35).move_to([0, 1.75, 0])
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.2) for c in cards], lag_ratio=0.4),
                      run_time=b.t(0.6))
            note = T("the core draws these four states, or the user sees an unstyled error",
                     SMALL, MUTED)
            note.next_to(cards, DOWN, buff=0.3)
            self.play(FadeIn(note), run_time=b.t(0.25))
            self.cards = VGroup(cards, note)

        with self.beat("block") as b:
            code = code_block(self.BLOCK, "css")
            code.move_to([0, -1.2, 0])
            hide_lines(code, 0)
            self.play(FadeIn(code.background), run_time=b.t(0.1))
            self.play(reveal_lines(code, 0, len(code.code_lines), lag=0.1), run_time=b.t(0.5))
            m1 = mark_line(code, 1, CREATION)
            self.play(Create(m1), run_time=b.t(0.2))
            self.code, self.m1 = code, m1

        with self.beat("cascade") as b:
            self.play(FadeOut(self.cards), FadeOut(self.code), FadeOut(self.m1), run_time=b.t(0.12))
            left = chip("unlayered  !important", MUTED)
            right = chip("@layer dw-core  !important", CREATION)
            row = VGroup(left, right).arrange(RIGHT, buff=2.4).move_to([0, 1.5, 0])
            arrow = labeled_arrow(left.get_right(), right.get_left(), "loses to", TEXT, side=UP)
            self.play(FadeIn(left), FadeIn(right), run_time=b.t(0.25))
            self.play(GrowArrow(arrow.arrow), FadeIn(arrow.label), run_time=b.t(0.3))
            rule = T("for an important declaration the layer order flips", BODY, TEXT)
            rule.move_to([0, 0.5, 0])
            self.play(FadeIn(rule), run_time=b.t(0.3))
            self.cas = VGroup(row, arrow, rule)

        with self.beat("hole") as b:
            hole = T("the hole: the agent opens the same layer again, lower down", BODY, ISOLATION)
            hole.move_to([0, -0.6, 0])
            fixture = code_block("@layer dw-core { .dw-surface { padding: 0 !important; } }", "css")
            fixture.next_to(hole, DOWN, buff=0.4)
            win = T("it wins there by order", SMALL, MUTED).next_to(fixture, DOWN, buff=0.28)
            self.play(FadeIn(hole), run_time=b.t(0.25))
            self.play(FadeIn(fixture), run_time=b.t(0.25))
            self.play(FadeIn(win), run_time=b.t(0.15))
            cap = caption("the gate holds the text of the block; only the render check catches this")
            self.play(FadeIn(cap), run_time=b.t(0.2))
