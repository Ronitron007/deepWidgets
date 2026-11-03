"""Part `part_intro`: cold_open outline_today outline_kit direction_list example_cast.

Beat weights are seconds of the recorded take (sentence ends found with ffmpeg silencedetect),
so each beat starts with its sentence. The base scales them to the audio length.
`_until(scene, t)` waits until second t of the take, scaled the same way.
"""
from dwscene import *


# ---------------------------------------------------------------- part helpers
def _until(scene, t):
    """Wait until second `t` of the recorded take (beat weights are take seconds)."""
    nominal = sum(w for _, w in scene.BEATS)
    scene.wait_until(t * scene.total / nominal)


def _mono(s):
    """Pango span in Menlo for a code name inside MarkupText (escapes < > &)."""
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f'<span font_family="{MONO}">{s}</span>'


def _mx(markup, size=SMALL, color=TEXT):
    return M(markup, size, color)


# Detail slot: the free band between the two outline rows (left of host extras, under the
# describe tag, right of the MCP door). Two lines at most.
_SLOT_C = np.array([-2.075, 0.835, 0])
_SLOT_W = 5.6


def _slot(*rows):
    g = VGroup(*rows).arrange(DOWN, buff=0.1)
    assert g.width <= _SLOT_W + 1e-6 and g.height <= 0.8, (g.width, g.height)
    return g.move_to(_SLOT_C)


def _swap(scene, old, new, rt):
    """Slot change: the old one fades out, then the new one fades in (no overlap)."""
    if old is not None:
        scene.play(FadeOut(old), run_time=rt / 2)
        scene.play(FadeIn(new), run_time=rt / 2)
    else:
        scene.play(FadeIn(new), run_time=rt)
    return new


def _mini_windows(n, color=SHELL, w=0.62, h=0.42, gap=0.28):
    g = VGroup(*[rbox(w, h, color, fill=0.12, sw=2, r=0.06) for _ in range(n)])
    return g.arrange(RIGHT, buff=gap)


def _page_card(head, sub, third, color, shared, third_mono=True):
    """cold_open card: header, two lines, and a small diagram (3 windows -> 1 or 3 pages)."""
    frame = rbox(5.9, 3.7, color, fill=0.06, sw=3)
    h = T(head, HEADING, color, bold=True)
    s = T(sub, BODY, TEXT)
    m = T(third, LABEL, TEXT, mono=third_mono)
    txt = VGroup(h, s, m).arrange(DOWN, buff=0.14)
    wins = _mini_windows(3)
    if shared:
        page = rbox(2.6, 0.5, color, fill=0.15, sw=2, r=0.08)
        pl = T("one page", SMALL, TEXT).move_to(page)
        pages = VGroup(VGroup(page, pl))
    else:
        pages = VGroup(*[rbox(0.62, 0.5, color, fill=0.15, sw=2, r=0.06) for _ in range(3)]).arrange(RIGHT, buff=0.28)
    diag = VGroup(wins, pages).arrange(DOWN, buff=0.5)
    if not shared:
        pages.match_x(wins)
    arrows = VGroup()
    for i, wdw in enumerate(wins):
        tgt = pages[0] if shared else pages[i]
        end = [tgt.get_x() + (wdw.get_x() - tgt.get_x()) * 0.45, tgt.get_top()[1], 0] if shared else tgt.get_top()
        arrows.add(Arrow(wdw.get_bottom(), end, buff=0.05, color=color, stroke_width=3, tip_length=0.14,
                         max_tip_length_to_length_ratio=0.4))
    diag.add(arrows)
    body = VGroup(txt, diag).arrange(DOWN, buff=0.35).move_to(frame)
    g = VGroup(frame, body)
    g.frame, g.txt, g.wins, g.pages, g.arrows = frame, txt, wins, pages, arrows
    return g


# ================================================================ cold_open
class ColdOpen(DWScene):
    SPEC_TAG = False  # first time the tag shows: it comes in with an animation
    BEATS = [("title", 7.3), ("tag", 3.7), ("sources", 5.95), ("spike", 4.05), ("legend", 5.6),
             ("today", 6.0), ("kit", 6.6), ("walk", 5.8)]

    def construct(self):
        with self.beat("title") as b:
            name = T("widget kit", 72, KIT, bold=True).move_to(UP * 0.7)
            self.play(Write(name), run_time=b.t(0.3))
            _until(self, 2.95)
            sub = T("a direction for how agents build widgets in deepWidgets", BODY, MUTED)
            sub.next_to(name, DOWN, buff=0.35)
            self.play(FadeIn(sub, shift=UP * 0.15), run_time=b.t(0.12))

        with self.beat("tag") as b:
            big = spec_tag().scale(1.6).next_to(sub, DOWN, buff=0.5)
            self.play(FadeIn(big, scale=1.1), run_time=b.t(0.3))
            _until(self, 10.0)
            tgt = self.spec_tag
            self.play(big.animate.scale(tgt.width / big.width).move_to(tgt.get_center()), run_time=b.left)
            self.remove(big)
            self.add_foreground_mobject(tgt)

        with self.beat("sources") as b:
            head = scene_title("widget kit", KIT)
            self.play(FadeOut(sub), ReplacementTransform(name, head), run_time=b.t(0.2))
            c1t = lines("source", "operator direction so far", size=LABEL)
            c1t[0].set_color(MUTED)
            c2t = VGroup(T("source", LABEL, MUTED), T("kit_spike", LABEL, CHECKS, mono=True),
                         T("2026-11-03", LABEL, TEXT, mono=True),
                         T("origin/main 1ca2967d", LABEL, TEXT, mono=True)).arrange(DOWN, buff=0.12,
                                                                                   aligned_edge=LEFT)
            c1 = VGroup(rbox(5.4, 2.2, MUTED, fill=0.06, sw=2.5), c1t)
            c2 = VGroup(rbox(5.4, 2.2, CHECKS, fill=0.06, sw=2.5), c2t)
            c1.move_to([-3.2, 0.95, 0])
            c2.move_to([3.2, 0.95, 0])
            for c in (c1, c2):
                c[1].move_to(c[0])
            self.play(FadeIn(c1, shift=UP * 0.2), run_time=b.t(0.2))
            _until(self, 14.4)
            self.play(FadeIn(c2, shift=UP * 0.2), run_time=b.t(0.2))

        with self.beat("spike") as b:
            cap = caption("spike: a short test that measures one question", color=CHECKS)
            self.play(FadeIn(cap), Circumscribe(c2[0], color=CHECKS, buff=0.06), run_time=b.t(0.4))

        with self.beat("legend") as b:
            ml = VGroup(T("number", HEADING, MEASURED, mono=True), T("measured: white", LABEL, MUTED))
            ml.arrange(DOWN, buff=0.2)
            il = VGroup(inferred("number", HEADING), T("inferred: amber, with the word", LABEL, MUTED))
            il.arrange(DOWN, buff=0.2)
            ml.move_to([-3.2, -1.55, 0])
            il.move_to([3.2, -1.55, 0])
            ml[0].align_to(il[0], DOWN)
            self.play(FadeOut(cap), FadeIn(ml, shift=UP * 0.15), run_time=b.t(0.25))
            _until(self, 24.0)
            self.play(FadeIn(il, shift=UP * 0.15), run_time=b.t(0.25))

        with self.beat("today") as b:
            self.play(FadeOut(VGroup(c1, c2, ml, il)), run_time=b.t(0.15))
            left = _page_card("today", "one shared page", "shadcn-widgets@1", SHELL, shared=True)
            left.move_to([-3.35, -0.05, 0])
            self.play(FadeIn(left, shift=UP * 0.2), run_time=b.t(0.2))
            _until(self, 30.1)
            self.play(Indicate(left.pages, color=SHELL, scale_factor=1.08), run_time=b.t(0.3))

        with self.beat("kit") as b:
            right = _page_card("kit", "one page per widget", "agent library", KIT, shared=False, third_mono=False)
            right.move_to([3.35, -0.05, 0])
            self.play(FadeIn(VGroup(right.frame, right.txt), shift=UP * 0.2), run_time=b.t(0.2))
            _until(self, 35.1)
            self.play(FadeIn(right.wins), run_time=b.t(0.15))
            self.play(LaggedStart(*[GrowArrow(a) for a in right.arrows], lag_ratio=0.3),
                      LaggedStart(*[FadeIn(p, scale=0.6) for p in right.pages], lag_ratio=0.3),
                      run_time=b.t(0.3))

        with self.beat("walk") as b:
            self.play(Circumscribe(right.frame, color=KIT, buff=0.08), run_time=b.t(0.4))


# ================================================================ outline_today
class OutlineToday(DWScene):
    BEATS = [("whole", 3.2), ("toprow", 2.2), ("agent", 6.0), ("mcp", 7.3), ("gates", 5.6),
             ("host", 6.2), ("shell", 7.26)]

    def construct(self):
        o = OutlineDiagram()
        slot = None
        with self.beat("whole") as b:
            self.play(FadeIn(o, lag_ratio=0.02), run_time=b.t(0.75))

        with self.beat("toprow") as b:
            self.play(o.highlight("today_row"), run_time=b.t(0.4))

        lit = ["agent"]
        arr = []
        with self.beat("agent") as b:
            new = _slot(_mx(_mono("src/index.ts"), LABEL, AGENT),
                        _mx(f"imports {_mono('zod')} only", LABEL))
            self.play(o.highlight(*lit), run_time=b.t(0.15))
            slot = _swap(self, slot, new, b.t(0.12))

        with self.beat("mcp") as b:
            lit += ["mcp_install"]
            arr += ["arrow_agent_mcp"]
            l1 = _mx(f"MCP tool {_mono('widget_install')}", LABEL, MCP)
            l2 = _mx("MCP lets an agent call tools", LABEL)
            self.play(o.highlight(*lit, arrows=arr), run_time=b.t(0.12))
            l2.set_opacity(0)  # comes in with its own sentence
            slot = _swap(self, slot, _slot(l1, l2), b.t(0.1))
            _until(self, 15.2)
            self.play(l2.animate.set_opacity(1), run_time=b.t(0.08))

        with self.beat("gates") as b:
            lit += ["gates"]
            arr += ["arrow_mcp_gates"]
            new = _slot(_mx(f"compile: {_mono('esbuild')}", LABEL, CREATION),
                        _mx(f"lint: {_mono('oxlint + tsgolint')}", LABEL, CREATION))
            self.play(o.highlight(*lit, arrows=arr), run_time=b.t(0.12))
            slot = _swap(self, slot, new, b.t(0.1))
            _until(self, 21.25)
            for i, k in enumerate(("gate_compile", "gate_lint", "gate_test_run")):
                anims = [Indicate(o.box(k), color=CREATION, scale_factor=1.12)]
                if i < 2:
                    anims.append(Indicate(new[i], color=CREATION, scale_factor=1.06))
                self.play(*anims, run_time=b.t(0.12))

        with self.beat("host") as b:
            lit += ["host"]
            arr += ["arrow_gates_host"]
            l1 = _mx(_mono("plugin manager + hmr"), LABEL, HOST)
            l2 = _mx("the process that runs all widget code", LABEL)
            self.play(o.highlight(*lit, arrows=arr), run_time=b.t(0.12))
            l2.set_opacity(0)  # comes in with its own sentence
            slot = _swap(self, slot, _slot(l1, l2), b.t(0.1))
            _until(self, 27.0)
            self.play(l2.animate.set_opacity(1), run_time=b.t(0.08))

        with self.beat("shell") as b:
            lit += ["shell", "windows", "electron_main"]
            arr += ["arrow_host_shell", "arrow_shell_em", "arrow_em_windows"]
            l1 = _mx(_mono("@deepwidgets/shell"), LABEL, SHELL)
            l2 = _mx(f"catalog {_mono('shadcn-widgets@1')}", LABEL)
            self.play(o.highlight(*lit, arrows=arr), run_time=b.t(0.1))
            l2.set_opacity(0)  # comes in with its own sentence
            slot = _swap(self, slot, _slot(l1, l2), b.t(0.08))
            _until(self, 35.6)
            self.play(l2.animate.set_opacity(1), Indicate(o.node("windows"), color=SHELL, scale_factor=1.06),
                      run_time=b.t(0.15))


# the state outline_today ends in (outline_kit starts from it, so the cut does not jump)
_TODAY_END = (("agent", "mcp_install", "gates", "host", "shell", "windows", "electron_main"),
              ("arrow_agent_mcp", "arrow_mcp_gates", "arrow_gates_host", "arrow_host_shell",
               "arrow_shell_em", "arrow_em_windows"))


# ================================================================ outline_kit
class OutlineKit(DWScene):
    BEATS = [("bottom", 2.2), ("start", 2.2), ("kitproj", 3.88), ("library", 10.79), ("vite", 3.21),
             ("gates", 3.32), ("serve", 4.9), ("extras", 3.9), ("doors", 6.54), ("back", 2.14)]

    def construct(self):
        o = OutlineDiagram()
        o.set_highlight_now(*_TODAY_END[0], arrows=_TODAY_END[1])
        self.add(o)
        slot = None
        with self.beat("bottom") as b:
            self.play(o.highlight("kit_row"), run_time=b.t(0.35))

        with self.beat("start") as b:
            new = _slot(_mx(_mono("$DSH_HOME/deepwidgets/kit/"), LABEL, KIT),
                        _mx(_mono("package.json, pnpm-lock.yaml"), LABEL))
            self.play(o.highlight("kit_project"), run_time=b.t(0.25))
            slot = _swap(self, slot, new, b.t(0.3))

        with self.beat("kitproj") as b:
            new = _slot(_mx(f"{_mono('node_modules')}, {_mono('kit.json')}", LABEL, KIT),
                        _mx("core + extras", LABEL))
            self.play(o.highlight("kit_project", "kit_config"), run_time=b.t(0.15))
            slot = _swap(self, slot, new, b.t(0.2))

        lit = ["kit_project", "agent_library"]
        arr = ["arrow_kit_library"]
        with self.beat("library") as b:
            new = _slot(_mx("its own component library", LABEL, AGENT),
                        _mx("+ a child component", LABEL))
            self.play(o.highlight(*lit, arrows=arr), run_time=b.t(0.06))
            slot = _swap(self, slot, new, b.t(0.05))
            _until(self, 12.5)
            l1 = _mx(f"the child holds {_mono('<Renderer.Root>')}", LABEL, AGENT)
            l2 = _mx("OpenUI: program text to React", LABEL)
            l2.set_opacity(0)  # comes in with its own sentence
            slot = _swap(self, slot, _slot(l1, l2), b.t(0.06))
            _until(self, 15.0)
            self.play(l2.animate.set_opacity(1), run_time=b.t(0.04))

        with self.beat("vite") as b:
            lit += ["vite_build"]
            new = _slot(_mx("Vite build per widget", LABEL, VITE), _mx("one page for each widget", LABEL))
            self.play(o.highlight(*lit, arrows=arr), run_time=b.t(0.2))
            slot = _swap(self, slot, new, b.t(0.2))

        with self.beat("gates") as b:
            lit += ["type_gate", "render_check"]
            arr += ["arrow_library_type", "arrow_type_vite", "arrow_vite_render"]
            new = _slot(_mx("type gate before the build", LABEL, CREATION),
                        _mx("render check tests the page", LABEL, CREATION))
            self.play(o.highlight(*lit, arrows=arr), run_time=b.t(0.2))
            slot = _swap(self, slot, new, b.t(0.2))

        with self.beat("serve") as b:
            lit += ["pinned_pages", "electron_main", "windows"]
            arr += ["arrow_render_pinned", "arrow_pinned_em", "arrow_em_windows"]
            l1 = _mx(_mono("dsh-app://app/widget/<slug>/"), LABEL, SERVING)
            l2 = _mx("slug: the id of a widget", LABEL)
            self.play(o.highlight(*lit, arrows=arr), run_time=b.t(0.14))
            l2.set_opacity(0)  # comes in with its own sentence
            slot = _swap(self, slot, _slot(l1, l2), b.t(0.14))
            _until(self, 28.5)
            self.play(l2.animate.set_opacity(1), run_time=b.t(0.1))

        with self.beat("extras") as b:
            new = _slot(_mx("host extras, on the host side", LABEL, HOST_EXTRAS),
                        _mx("bundle | external | native addon", LABEL))
            self.play(o.highlight("kit_row", "host_extras", "host", arrows=("link_host_extras",)),
                      run_time=b.t(0.2))
            slot = _swap(self, slot, new, b.t(0.2))

        with self.beat("doors") as b:
            doors = ("kit_row", "mcp_door", "settings_pane")
            darr = ("arrow_door_kit", "arrow_settings_kit")
            l1 = VGroup(status_chip("spike design", solved=False), _mx("two doors into the kit", LABEL))
            l1.arrange(RIGHT, buff=0.25)
            self.play(o.highlight(*doors, arrows=darr), run_time=b.t(0.12))
            slot = _swap(self, slot, _slot(l1), b.t(0.1))
            _until(self, 37.2)
            new = _slot(_mx(_mono("kit_read, kit_describe,"), LABEL, MCP),
                        _mx(_mono("kit_add, kit_remove"), LABEL, MCP))
            slot = _swap(self, slot, new, b.t(0.1))
            self.play(Indicate(o.node("mcp_door"), color=MCP, scale_factor=1.08), run_time=b.t(0.1))
            _until(self, 39.0)
            api = _mx(_mono("/api/kit"), LABEL, SETTINGS)
            api.next_to(o.box("settings_pane"), RIGHT, buff=0.18)
            self.play(FadeIn(api), Indicate(o.node("settings_pane"), color=SETTINGS, scale_factor=1.06),
                      run_time=b.t(0.15))

        with self.beat("back") as b:
            self.play(FadeOut(slot), FadeOut(api), o.reset(), run_time=b.t(0.45))


# ================================================================ direction_list
_DIRECTION = [
    (AGENT, [f"agent writes its own OpenUI library + child that holds {_mono('<Renderer>')}"]),
    (VITE, ["own Vite build per widget at install (layout A)"]),
    (KIT, [f"{_mono('@deepwidgets/widget-kit')}: locked core + user extras",
           f"core = what {_mono('main.tsx')} needs; extras in a settings pane"]),
    (HOST_EXTRAS, ["extras on renderer side and host side"]),
    (CONFIG, ["agent adds packages via MCP when a setting allows"]),
    (DESCRIBE, ["kit packages described to agents dynamically"]),
    (PIN, ["pin or rebuild: decide from data"]),
]


class DirectionList(DWScene):
    # take seconds: intro, then one beat per point (the third point has two lines)
    BEATS = [("intro", 4.1), ("p1", 6.4), ("p2", 3.4), ("p3", 11.1), ("p4", 4.5), ("p5", 4.8),
             ("p6", 3.45), ("p7", 4.17)]
    P3_SPLIT = 0.405  # where the second line of the third point starts, as a fraction of beat p3

    def construct(self):
        with self.beat("intro") as b:
            head = scene_title("operator direction so far", KIT)
            tag = chip("kit_spike.direction", KIT)
            tag.next_to(head, RIGHT, buff=0.4)
            self.play(FadeIn(head, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(tag), run_time=b.t(0.2))
            items = VGroup()
            for color, ls in _DIRECTION:
                txt = VGroup(*[_mx(s, 26) for s in ls]).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
                dot = Dot(radius=0.09, color=color)
                dot.next_to(txt[0], LEFT, buff=0.3)
                items.add(VGroup(dot, txt))
            items.arrange(DOWN, buff=0.3, aligned_edge=LEFT)
            panel = rbox(items.width + 1.0, items.height + 0.7, MUTED, fill=0.04, sw=2)
            panel.move_to([0, (CONTENT_TOP + CONTENT_BOTTOM) / 2, 0])
            items.move_to(panel)
            self.play(FadeIn(panel), run_time=b.t(0.2))

        for i, (name, _) in enumerate(self.BEATS[1:]):
            with self.beat(name) as b:
                it = items[i]
                if i == 2:  # third point: the second line comes with its own sentence
                    self.play(FadeIn(it[0]), FadeIn(it[1][0], shift=RIGHT * 0.2), run_time=b.t(0.12))
                    self.wait_until(b.start + self.P3_SPLIT * b.length)
                    self.play(FadeIn(it[1][1], shift=RIGHT * 0.2), run_time=b.t(0.12))
                else:
                    self.play(FadeIn(it, shift=RIGHT * 0.2), run_time=b.t(0.25))


# ================================================================ example_cast
def _cast_card(title, rows):
    """A widget window with rows of markup text (each row: markup, color)."""
    w = window_card(title, 4.3, 2.35)
    body = VGroup(*[_mx(m, SMALL, c) for m, c in rows]).arrange(DOWN, buff=0.1)
    body.move_to(w.body_center)
    w.body = body
    w.add(body)
    return w


def _kit_box(name, *pkgs):
    t = T(name, LABEL, KIT, bold=True)
    ps = [T(p, SMALL, TEXT, mono=True) for p in pkgs]
    txt = VGroup(t, *ps).arrange(DOWN, buff=0.1)
    box = rbox(txt.width + 0.5, txt.height + 0.35, KIT, fill=0.08, sw=2.5)
    txt.move_to(box)
    return VGroup(box, txt)


class ExampleCast(DWScene):
    BEATS = [("cast", 5.8), ("shadcn", 3.7), ("clock", 3.3), ("meter", 5.6), ("v1", 4.5), ("v2a", 4.7),
             ("v2b", 5.7), ("close", 2.34)]

    def construct(self):
        with self.beat("cast") as b:
            head = scene_title("one worked example: three widgets", SHELL)
            self.play(FadeIn(head, shift=RIGHT * 0.2), run_time=b.t(0.15))
            shad = _cast_card("shadcn", [("copy of", TEXT), (_mono("shadcn-widgets@1"), SHELL),
                                         ("with charts", TEXT)])
            clock = _cast_card("clock", [(_mono("DateLine"), AGENT),
                                         (f"with {_mono('date-fns')} {_mono('format')}", TEXT),
                                         (f"{_mono('Tag')} with {_mono('Pill')}", TEXT)])
            meter = _cast_card("meter", [(_mono("Gauge"), AGENT), (f"with {_mono('Meter')}", TEXT),
                                         (f"from {_mono('dw-mini-ui')}", TEXT)])
            clock.body[2][0:3].set_color(AGENT)  # 'Tag'
            cards = VGroup(shad, clock, meter).arrange(RIGHT, buff=0.3).move_to([0, 1.62, 0])
            for c in cards:
                c.body.set_opacity(0)
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.2) for c in cards], lag_ratio=0.3),
                      run_time=b.t(0.4))

        for name, card in (("shadcn", shad), ("clock", clock), ("meter", meter)):
            with self.beat(name) as b:
                self.play(card.body.animate.set_opacity(1), Circumscribe(card.frame, color=SHELL, buff=0.05),
                          run_time=b.t(0.35))

        with self.beat("v1") as b:
            v1 = _kit_box("kit v1", "date-fns 4.0.0", "dw-mini-ui 1.0.0").move_to([-5.0, -1.45, 0])
            lbl = T("three kit versions", LABEL, KIT).next_to(v1, UP, buff=0.25)
            self.play(FadeIn(lbl), FadeIn(v1, shift=RIGHT * 0.2), run_time=b.t(0.3))

        with self.beat("v2a") as b:
            v2a = _kit_box("kit v2a", "date-fns 4.1.0").move_to([-0.9, -0.7, 0])
            a1 = Arrow(v1[0].get_right(), v2a[0].get_left(), buff=0.08, color=KIT, stroke_width=4,
                       tip_length=0.18)
            self.play(GrowArrow(a1), FadeIn(v2a, shift=RIGHT * 0.2), run_time=b.t(0.3))

        with self.beat("v2b") as b:
            v2b = _kit_box("kit v2b", "dw-mini-ui 2.0.0").move_to([-0.9, -2.2, 0])
            a2 = Arrow(v1[0].get_right(), v2b[0].get_left(), buff=0.08, color=KIT, stroke_width=4,
                       tip_length=0.18)
            self.play(GrowArrow(a2), FadeIn(v2b, shift=RIGHT * 0.2), run_time=b.t(0.12))
            old = T("Meter { value, max, label }", SMALL, MUTED, mono=True)
            new = T("Meter { percent, caption }", SMALL, TEXT, mono=True)
            down = Arrow(UP * 0.25, DOWN * 0.25, buff=0, color=PNPM, stroke_width=4, tip_length=0.16)
            stack = VGroup(old, down, new).arrange(DOWN, buff=0.12).move_to([3.9, -1.9, 0])
            note = T("renamed props", SMALL, PNPM).next_to(down, RIGHT, buff=0.2)
            link = DashedLine(v2b[0].get_right(), [stack.get_left()[0] - 0.1, v2b.get_y(), 0],
                              color=KIT, stroke_width=3, dash_length=0.08)
            _until(self, 29.2)
            self.play(Create(link), FadeIn(old), run_time=b.t(0.12))
            _until(self, 31.0)
            self.play(GrowArrow(down), FadeIn(note), FadeIn(new, shift=DOWN * 0.15), run_time=b.t(0.12))
            cap = caption("prop: one input of a component")
            self.play(FadeIn(cap), run_time=b.t(0.08))

        with self.beat("close") as b:
            OutlineDiagram().close_part(self, "kit_row", next_key="shell", run_time=b.left)
