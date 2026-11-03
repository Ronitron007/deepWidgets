"""Part `part_config`: config_place config_setting kit_read_describe kit_add_remove kit_errors add_steps
add_example config_work. The kit config: where the kit lives, the setting, the kit tools, the kit errors,
and one addition. All of it is a design from the spike (`kit_spike`), not a decision.

Beat weights are seconds of the final audio: each beat starts at the pause before its sentence
(ffmpeg silencedetect). The base scales them to the audio length.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content
_X1 = FRAME_W / 2 - MARGIN - 0.1     # right edge of content
_BANNER = "a design from the spike, not a decision"


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (no-op if already later)."""
    scene.wait_until(b.start + frac * b.length)


def _arr(a, b, color=TEXT, buff=0.08, sw=3, tip=0.18):
    return Arrow(a, b, buff=buff, color=color, stroke_width=sw, max_tip_length_to_length_ratio=0.35,
                 tip_length=tip)


def _tick(color=SOLVED, s=0.16):
    return VMobject(stroke_color=color, stroke_width=6).set_points_as_corners(
        [[-s, 0, 0], [-s * 0.3, -s * 0.7, 0], [s, s * 0.8, 0]])


def _cross(color=ISOLATION, s=0.16):
    return VGroup(Line([-s, -s, 0], [s, s, 0], stroke_color=color, stroke_width=6),
                  Line([-s, s, 0], [s, -s, 0], stroke_color=color, stroke_width=6))


def _mono(s, color=None):
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    c = f' fgcolor="{color}"' if color else ""
    return f'<span font_family="{MONO}"{c}>{s}</span>'


def _strike(m, color=ISOLATION):
    """A line through m."""
    return Line(m.get_left() + LEFT * 0.08, m.get_right() + RIGHT * 0.08, stroke_color=color, stroke_width=5)


def _left(m, y, x=_X0):
    return m.move_to([x, y, 0], aligned_edge=LEFT)


def _banner(size=LABEL):
    """The design banner: grey dashed, like the `spike design` tag of part_describe."""
    return chip(_BANNER, OPEN, size=size, mono=False, dashed=True, fill=0.12)


def _toggle(on=True):
    """A settings toggle: a pill with a knob. .pill .knob"""
    pill = RoundedRectangle(corner_radius=0.24, width=1.0, height=0.48, stroke_width=0,
                            fill_color=CONFIG if on else MUTED, fill_opacity=0.9)
    knob = Circle(radius=0.18, stroke_width=0, fill_color=BG, fill_opacity=1)
    knob.move_to(pill.get_center() + RIGHT * (0.26 if on else -0.26))
    g = VGroup(pill, knob)
    g.pill, g.knob = pill, knob
    return g


# ====================================================================== config_place
class ConfigPlace(DWScene):
    BEATS = [("open", 3.0), ("banner", 1.65), ("folder", 7.56), ("files", 5.04), ("kitver", 2.98),
             ("extras", 6.01), ("ask_profile", 3.25), ("why_profile", 4.22), ("ask_host", 2.12),
             ("why_host", 4.61)]

    FILES = ("package.json", "pnpm-lock.yaml", "node_modules/", "kit.json")
    KITJSON = "{\n  kitVersion,\n  extras: {\n    side, addedBy, addedAt, card\n  }\n}"

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "kit_config", also=("kit_project", "mcp_door"),
                                       arrows=("arrow_door_kit",), run_time=b.left)

        with self.beat("banner") as b:
            title = scene_title("Kit config: the place", CONFIG)
            ban = _banner().move_to([_X1, TITLE_Y, 0], aligned_edge=RIGHT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(ban, shift=LEFT * 0.1), run_time=b.t(0.3))

        tx, pitch = _X0 + 0.1, 0.48
        with self.beat("folder") as b:
            root = VGroup(disk_icon(KIT, 0.36), T("$DSH_HOME/deepwidgets/kit/", LABEL, KIT, mono=True, bold=True))
            root.arrange(RIGHT, buff=0.2)
            _left(root, 2.35, tx)
            pn = chip("a pnpm project", PNPM, mono=False, size=SMALL).next_to(root, DOWN, buff=0.18)
            pn.align_to(root, LEFT).shift(RIGHT * 0.55)
            self.play(FadeIn(root, shift=RIGHT * 0.1), run_time=b.t(0.3))
            _at(self, b, 0.3)
            self.play(FadeIn(pn), run_time=b.t(0.2))

        ents = []
        y0 = 1.5
        for i, f in enumerate(self.FILES):
            pre = "└─ " if i == len(self.FILES) - 1 else "├─ "
            t = T(pre + f, LABEL, CONFIG if f == "kit.json" else TEXT, mono=True)
            ents.append(_left(t, y0 - i * pitch, tx + 0.35))
        with self.beat("files") as b:
            self.play(FadeOut(pn), run_time=b.t(0.1))
            self.play(LaggedStart(*[FadeIn(e, shift=RIGHT * 0.1) for e in ents], lag_ratio=0.45), run_time=b.t(0.75))

        card = code_block(self.KITJSON, "typescript", color=CONFIG, size=LABEL)
        card.move_to([_X1, 1.15, 0], aligned_edge=RIGHT)
        hide_lines(card)
        a = _arr(ents[-1].get_right(), card.get_left() + DOWN * 0.6, CONFIG)
        with self.beat("kitver") as b:
            self.play(Indicate(ents[-1], color=CONFIG, scale_factor=1.08), GrowArrow(a), FadeIn(card.background),
                      run_time=b.t(0.4))
            self.play(reveal_lines(card, 0, 2), run_time=b.t(0.4))

        with self.beat("extras") as b:
            self.play(reveal_lines(card, 2, 6, lag=0.3), run_time=b.t(0.6))

        def option(name, why, y):
            n = T(name, BODY, TEXT, mono=True)
            w = T(why, LABEL, MUTED)
            row = VGroup(n, w).arrange(RIGHT, buff=0.35, aligned_edge=DOWN)
            _left(row, y, _X0 + 0.65)
            x = _cross().next_to(row, LEFT, buff=0.3)
            return n, w, _strike(n), x

        ya, yb = -1.45, -2.4
        q = T("why not", LABEL, MUTED, bold=True)
        _left(q, -0.75)
        with self.beat("ask_profile") as b:
            n1, w1, s1, x1 = option("profile package.json", "(plugin manager owns it)", ya)
            self.play(FadeIn(q), FadeIn(n1, shift=UP * 0.1), run_time=b.t(0.45))

        with self.beat("why_profile") as b:
            self.play(FadeIn(w1, shift=RIGHT * 0.1), run_time=b.t(0.25))
            _at(self, b, 0.55)
            self.play(Create(s1), Create(x1), run_time=b.t(0.25))

        with self.beat("ask_host") as b:
            n2, w2, s2, x2 = option("host storage", "(no real node_modules)", yb)
            self.play(FadeIn(n2, shift=UP * 0.1), run_time=b.t(0.6))

        with self.beat("why_host") as b:
            self.play(FadeIn(w2, shift=RIGHT * 0.1), Indicate(ents[2], color=PNPM, scale_factor=1.08),
                      run_time=b.t(0.35))
            _at(self, b, 0.5)
            self.play(Create(s2), Create(x2), run_time=b.t(0.25))


# ====================================================================== config_setting
class ConfigSetting(DWScene):
    BEATS = [("lives", 4.45), ("pane", 2.88), ("off", 4.02), ("user", 3.25)]

    def construct(self):
        ry = 1.35
        with self.beat("lives") as b:
            title = scene_title("Kit config: the setting", CONFIG)
            name = T("agentsMayAddPackages", BODY, TEXT, mono=True)
            where = T("(host settings)", LABEL, HOST)
            tg = _toggle(on=True)
            name.move_to([-4.3, ry, 0], aligned_edge=LEFT)
            where.next_to(name, RIGHT, buff=0.35).align_to(name, DOWN)
            tg.move_to([3.9, ry, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))
            self.play(FadeIn(name, shift=RIGHT * 0.1), FadeIn(tg), run_time=b.t(0.3))
            _at(self, b, 0.6)
            self.play(FadeIn(where), run_time=b.t(0.25))

        with self.beat("pane") as b:
            frame = rbox(10.0, 2.4, SETTINGS, fill=0.05).move_to([0, ry - 0.25, 0])
            head = T("settings pane", LABEL, SETTINGS, bold=True)
            head.move_to(frame.get_corner(UL) + RIGHT * 0.3 + DOWN * 0.35, aligned_edge=LEFT)
            sep = Line([frame.get_left()[0] + 0.3, ry - 0.55, 0], [frame.get_right()[0] - 0.3, ry - 0.55, 0],
                       stroke_color=MUTED, stroke_width=1.5, stroke_opacity=0.5)
            other = T("other settings ...", LABEL, MUTED).move_to([-4.3, ry - 0.95, 0], aligned_edge=LEFT)
            self.play(Create(frame), FadeIn(head), run_time=b.t(0.4))
            self.play(Create(sep), FadeIn(other), run_time=b.t(0.3))

        l1y, l2y = -1.05, -2.1
        with self.beat("off") as b:
            off = _toggle(on=False).move_to(tg)
            self.play(Transform(tg, off), run_time=b.t(0.2))
            l1 = M('<b>off:</b> <span fgcolor="%s">agent</span> can read, not change' % AGENT, BODY)
            _left(l1, l1y, -4.3)
            icons = VGroup(_tick(), _cross()).arrange(RIGHT, buff=0.3).next_to(l1, RIGHT, buff=0.5)
            self.play(FadeIn(l1, shift=UP * 0.1), run_time=b.t(0.3))
            self.play(Create(icons[0]), run_time=b.t(0.15))
            self.play(Create(icons[1]), run_time=b.t(0.15))

        with self.beat("user") as b:
            l2 = M('<b><span fgcolor="%s">user:</span></b> can always change' % USER, BODY)
            _left(l2, l2y, -4.3)
            self.play(FadeIn(l2, shift=UP * 0.1), run_time=b.t(0.35))
            self.play(Indicate(frame, color=USER, scale_factor=1.02), run_time=b.t(0.4))


# ====================================================================== kit_read_describe
class KitReadDescribe(DWScene):
    BEATS = [("service", 4.63), ("doors", 4.91), ("read_in", 3.05), ("read_out", 6.16), ("pkg", 5.07),
             ("side", 2.71), ("desc_in", 3.26), ("desc_out", 6.44), ("desc_more", 4.81)]

    READ = ("kit_read: {} -> {\n"
            "  kitVersion, agentsMayAdd,\n"
            "  core: Pkg[], extras: Pkg[],\n"
            "  index\n"
            "}\n"
            "Pkg = { name, version,\n"
            "  side: 'renderer' | 'host' | 'both',\n"
            "  types, addedBy? }")
    DESC = ("kit_describe: { name } -> {\n"
            "  name, version, side,\n"
            "  import, exports[],\n"
            "  typesPath (absolute),\n"
            "  usage\n"
            "}")

    def construct(self):
        sy = 2.3
        with self.beat("service") as b:
            title = scene_title("Kit tools: read and describe", CONFIG)
            svc = ProcessBox("kit service", "ctx.widgetKit", color=KIT).move_to([0, sy, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))
            self.play(FadeIn(svc, scale=0.95), run_time=b.t(0.3))

        with self.beat("doors") as b:
            mcp = chip("MCP", MCP, size=LABEL).move_to([-3.0, sy, 0])
            http = chip("HTTP", SETTINGS, size=LABEL).move_to([3.0, sy, 0])
            ag = chip("agents", AGENT, size=LABEL, mono=False).move_to([-5.6, sy, 0])
            pane = chip("settings pane", SETTINGS, size=LABEL, mono=False).move_to([5.45, sy, 0])
            a1 = _arr(ag.get_right(), mcp.get_left(), AGENT)
            a2 = _arr(mcp.get_right(), svc.get_left(), MCP)
            a3 = _arr(pane.get_left(), http.get_right(), SETTINGS)
            a4 = _arr(http.get_left(), svc.get_right(), SETTINGS)
            self.play(FadeIn(mcp), FadeIn(http), GrowArrow(a2), GrowArrow(a4), run_time=b.t(0.3))
            _at(self, b, 0.35)
            self.play(FadeIn(ag), GrowArrow(a1), run_time=b.t(0.2))
            _at(self, b, 0.7)
            self.play(FadeIn(pane), GrowArrow(a3), run_time=b.t(0.2))

        rd = code_block(self.READ, "typescript", color=MCP)
        rd.move_to([_X0, 1.45, 0], aligned_edge=UL)
        hide_lines(rd)
        ds = code_block(self.DESC, "typescript", color=MCP)
        ds.move_to([_X1, 1.45, 0], aligned_edge=UR)
        hide_lines(ds)
        with self.beat("read_in") as b:
            self.play(FadeIn(rd.background), run_time=b.t(0.3))
            self.play(reveal_lines(rd, 0), run_time=b.t(0.4))

        with self.beat("read_out") as b:
            self.play(reveal_lines(rd, 1, 5, lag=0.5), run_time=b.t(0.7))

        with self.beat("pkg") as b:
            self.play(reveal_lines(rd, 5, 8, lag=0.5), run_time=b.t(0.6))

        with self.beat("side") as b:
            m = mark_line(rd, 6, KIT)
            self.play(Create(m), run_time=b.t(0.4))

        with self.beat("desc_in") as b:
            self.play(FadeOut(m), FadeIn(ds.background), run_time=b.t(0.3))
            self.play(reveal_lines(ds, 0), run_time=b.t(0.4))

        with self.beat("desc_out") as b:
            self.play(reveal_lines(ds, 1, 3, lag=0.5), run_time=b.t(0.6))

        with self.beat("desc_more") as b:
            self.play(reveal_lines(ds, 3, 4), run_time=b.t(0.25))
            m2 = mark_line(ds, 3, KIT)
            self.play(Create(m2), run_time=b.t(0.15))
            _at(self, b, 0.6)
            self.play(reveal_lines(ds, 4, 6, lag=0.5), run_time=b.t(0.3))


# ====================================================================== kit_add_remove
class KitAddRemove(DWScene):
    BEATS = [("add_in", 5.05), ("add_out", 2.84), ("rm_in", 3.3), ("rm_out", 1.9), ("retry", 4.59)]

    ADD = "kit_add: { name, version?, side, requestId }\n  -> { kitVersion, card }"
    RM = "kit_remove: { name, requestId }\n  -> { kitVersion }"

    def construct(self):
        add = code_block(self.ADD, "typescript", color=MCP, size=BODY)
        add.move_to([_X0, 2.6, 0], aligned_edge=UL)
        hide_lines(add)
        rm = code_block(self.RM, "typescript", color=MCP, size=BODY)
        rm.next_to(add, DOWN, buff=0.55).align_to(add, LEFT)
        hide_lines(rm)

        with self.beat("add_in") as b:
            title = scene_title("Kit tools: add and remove", CONFIG)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(add.background), run_time=b.t(0.3))
            self.play(reveal_lines(add, 0), run_time=b.t(0.35))

        with self.beat("add_out") as b:
            self.play(reveal_lines(add, 1), run_time=b.t(0.45))

        with self.beat("rm_in") as b:
            self.play(FadeIn(rm.background), run_time=b.t(0.2))
            self.play(reveal_lines(rm, 0), run_time=b.t(0.35))

        with self.beat("rm_out") as b:
            self.play(reveal_lines(rm, 1), run_time=b.t(0.5))

        with self.beat("retry") as b:
            note = chip("requestId: retry safe, as widget_call", CONFIG, size=LABEL)
            note.next_to(rm, DOWN, buff=0.6).align_to(rm, LEFT)
            self.play(Create(mark_line(add, 0, CONFIG)), Create(mark_line(rm, 0, CONFIG)), run_time=b.t(0.3))
            self.play(FadeIn(note, shift=UP * 0.1), run_time=b.t(0.3))


# ====================================================================== kit_errors
class KitErrors(DWScene):
    BEATS = [("head", 2.69), ("locked", 2.74), ("nextstep", 3.13), ("core", 5.54), ("inuse", 4.11),
             ("slugs", 1.72), ("notfound", 4.17), ("install", 5.14), ("also", 4.6)]

    ROWS = [("kit-locked", "setting off"),
            ("↳", "nextStep: ask the user to turn on the setting"),
            ("in-core", "package is in the locked core"),
            ("in-use", "lists slugs whose last build imports it"),
            ("not-found", "no such package or version"),
            ("install-failed", "pnpm failed, kit unchanged")]

    def construct(self):
        cc = {(i, 0): CONFIG for i in range(len(self.ROWS))}
        cc[(1, 0)] = MUTED
        cc[(1, 1)] = SOLVED
        tbl = RevealTable(["error code", "meaning"], self.ROWS, mono_cols=[0], size=LABEL, row_gap=0.24,
                          col_gap=0.9, cell_colors=cc)
        tbl.move_to([_X0 + 0.1, 2.45, 0], aligned_edge=UL)
        tbl.shift(UP * (2.45 - tbl.header.get_top()[1]))

        with self.beat("head") as b:
            title = scene_title("Kit errors: a code and a next step", CONFIG)
            self.add(tbl)
            tbl.header.set_opacity(0)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(tbl.header.animate.set_opacity(1), run_time=b.t(0.3))

        for i, name in enumerate(("locked", "nextstep", "core", "inuse")):
            with self.beat(name) as b:
                self.play(tbl.reveal_row(i), run_time=b.t(0.35))

        with self.beat("slugs") as b:
            self.play(Indicate(tbl.cell(3, 1), color=CONFIG, scale_factor=1.05), run_time=b.t(0.6))

        for i, name in ((4, "notfound"), (5, "install")):
            with self.beat(name) as b:
                self.play(tbl.reveal_row(i), run_time=b.t(0.35))

        with self.beat("also") as b:
            also = M("also  " + _mono("bad-name", CONFIG) + ",  " + _mono("idempotency-conflict", CONFIG)
                     + "   (from " + _mono("mcp/research.md") + ")", LABEL)
            also.next_to(tbl, DOWN, buff=0.45).align_to(tbl, LEFT)
            self.play(FadeIn(also, shift=UP * 0.1), run_time=b.t(0.4))


# ====================================================================== add_steps
class AddSteps(DWScene):
    BEATS = [("intro", 2.56), ("check", 4.91), ("copy", 6.17), ("fail", 2.68), ("swap", 1.88), ("card", 5.57),
             ("version", 3.69), ("signal", 3.71), ("guide", 2.46), ("built", 2.39), ("rebuild", 2.26)]

    STEPS = ("check (name, setting, not core)",
             "copy folder + pnpm add --save-exact <name>@<version>",
             "swap folders",
             "read version, types entry, exports; write card to kit.json",
             "kitVersion += 1, record lock hash",
             "signal: change feed, /api/kit/stream, notify.resourcesChanged()")

    def construct(self):
        x, y0, pitch = _X0 + 0.15, 2.45, 0.72
        chips = []
        for i, s in enumerate(self.STEPS):
            c = chip(s, CONFIG, size=SMALL)
            chips.append(_left(c, y0 - i * pitch, x))
        order = _arr([x - 0.28, chips[0].get_top()[1], 0], [x - 0.28, chips[-1].get_bottom()[1], 0], CONFIG,
                     buff=0.0, sw=4, tip=0.2)
        strip = VGroup(*chips)

        with self.beat("intro") as b:
            title = scene_title("One addition, in order", CONFIG)
            for c in chips:
                c[0].set_stroke(opacity=DIM).set_fill(opacity=0.15 * DIM)
                c[1].set_opacity(DIM)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(strip), run_time=b.t(0.4))
            self.play(GrowArrow(order), run_time=b.t(0.4))

        def light(i, b, frac=0.35):
            anims = [chips[i][0].animate.set_stroke(opacity=1).set_fill(opacity=0.15),
                     chips[i][1].animate.set_opacity(1)]
            self.play(*anims, run_time=b.t(frac))

        with self.beat("check") as b:
            light(0, b)

        with self.beat("copy") as b:
            light(1, b)

        with self.beat("fail") as b:
            fl = VGroup(_cross(s=0.12), T("copy fails: old folder stays", LABEL, ISOLATION)).arrange(RIGHT, buff=0.2)
            fl.next_to(chips[2], RIGHT, buff=0.5)
            self.play(FadeIn(fl, shift=LEFT * 0.1), run_time=b.t(0.4))

        with self.beat("swap") as b:
            light(2, b, 0.5)

        with self.beat("card") as b:
            light(3, b)

        with self.beat("version") as b:
            light(4, b)

        with self.beat("signal") as b:
            light(5, b)

        by = chips[-1].get_y() - 0.68
        with self.beat("guide") as b:
            gd = M(_mono("widget_guide", MCP) + " shows the change at the next call", LABEL)
            _left(gd, by, x + 0.75)
            ga = _arr(chips[-1].get_left() + DOWN * 0.15 + RIGHT * 0.4, gd.get_left(), MCP, buff=0.1)
            self.play(GrowArrow(ga), FadeIn(gd, shift=RIGHT * 0.1), run_time=b.t(0.4))

        with self.beat("built") as b:
            n1 = T("built widgets unchanged;", LABEL, SHELL)
            n2 = T("rebuild uses new kit", LABEL, KIT)
            note = VGroup(n1, n2).arrange(RIGHT, buff=0.2, aligned_edge=UP)
            box = rbox(note.width + 0.5, note.height + 0.35, MUTED, fill=0.06, sw=2)
            box.move_to([x + box.width / 2, by - 0.72, 0])
            note.move_to(box)
            self.play(FadeIn(box), FadeIn(n1, shift=UP * 0.1), run_time=b.t(0.5))

        with self.beat("rebuild") as b:
            self.play(FadeIn(n2, shift=UP * 0.1), run_time=b.t(0.45))


# ====================================================================== add_example
class AddExample(DWScene):
    BEATS = [("intro", 2.96), ("pkg", 3.02), ("resolve", 2.65), ("fetch", 2.41), ("install", 2.42), ("net", 2.38),
             ("illus", 3.78), ("holds", 3.46), ("notool", 2.4)]

    CARD = ("{ kitVersion: 2,\n"
            "  card: { name: 'nanoid', version: '<installed>',\n"
            "          side: 'renderer', ... } }")
    K = 1.75  # units per second of a bar

    def construct(self):
        with self.beat("intro") as b:
            title = scene_title("One addition from the spike", CONFIG)
            src = M(_mono("measurements.tsv", PNPM) + "   real times (measured)", LABEL, MUTED)
            _left(src, 2.55)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(src), run_time=b.t(0.3))

        with self.beat("pkg") as b:
            call = T("kit_add_package(nanoid)", BODY, TEXT, mono=True)
            _left(call, 1.9)
            self.play(FadeIn(call, shift=RIGHT * 0.1), run_time=b.t(0.45))

        by, x = 0.75, _X0 + 0.1
        segs = []
        for name, s, op in (("resolve", 1.2, 0.95), ("fetch", 3.3, 0.7), ("kit install", 0.5, 0.45)):
            r = Rectangle(width=s * self.K, height=0.5, stroke_color=BG, stroke_width=2, fill_color=PNPM,
                          fill_opacity=op).move_to([x, by, 0], aligned_edge=LEFT)
            x += s * self.K
            segs.append((name, s, r))
        labs = []
        for i, (name, s, r) in enumerate(segs):
            lab = M(name + "  " + _mono(f"{s} s"), LABEL)
            if i == 2:
                lab.next_to(r, DOWN, buff=0.18).align_to(r, LEFT)
            else:
                lab.next_to(r, UP, buff=0.15)
            labs.append(lab)

        for i, name in enumerate(("resolve", "fetch", "install")):
            with self.beat(name) as b:
                self.play(GrowFromEdge(segs[i][2], LEFT), FadeIn(labs[i]), run_time=b.t(0.45))

        with self.beat("net") as b:
            tot = T("= 5.0 s", BODY, MEASURED, mono=True).next_to(segs[-1][2], RIGHT, buff=0.3)
            net = M("net  " + _mono("47 KB"), BODY).next_to(tot, RIGHT, buff=0.6)
            self.play(FadeIn(tot), run_time=b.t(0.3))
            self.play(FadeIn(net, shift=LEFT * 0.1), run_time=b.t(0.35))

        card = code_block(self.CARD, "typescript", color=OPEN)
        card.move_to([_X0 + 0.1, -2.75, 0], aligned_edge=DL)
        hide_lines(card)
        tag = status_chip("illustrative, no such tool yet", solved=False)
        tag.next_to(card, UP, buff=0.18).align_to(card, LEFT)
        with self.beat("illus") as b:
            head = M("the answer of " + _mono("kit_add", MCP), LABEL, MUTED)
            head.next_to(tag, RIGHT, buff=0.4)
            self.play(FadeIn(card.background), FadeIn(tag), FadeIn(head), run_time=b.t(0.4))

        with self.beat("holds") as b:
            self.play(reveal_lines(card, 0, 3, lag=0.5), run_time=b.t(0.6))

        with self.beat("notool") as b:
            self.play(Indicate(tag, color=OPEN, scale_factor=1.08), run_time=b.t(0.6))


# ====================================================================== config_work
class ConfigWork(DWScene):
    BEATS = [("sizes", 5.31), ("est", 1.5), ("design", 3.2), ("close", 2.04)]

    def construct(self):
        outline = OutlineDiagram()
        with self.beat("sizes") as b:
            title = scene_title("Kit config: the work", CONFIG)
            c1 = chip("MCP kit tools: M (estimate)", INFERRED, mono=False, size=BODY)
            c2 = chip("kit service with pnpm: L (estimate)", INFERRED, mono=False, size=BODY)
            _left(c1, 1.9, _X0 + 0.3)
            _left(c2, 0.85, _X0 + 0.3)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))
            self.play(FadeIn(c1, shift=UP * 0.1), run_time=b.t(0.25))
            _at(self, b, 0.6)
            self.play(FadeIn(c2, shift=UP * 0.1), run_time=b.t(0.25))

        with self.beat("est") as b:
            self.play(Indicate(c1, color=INFERRED, scale_factor=1.04), Indicate(c2, color=INFERRED, scale_factor=1.04),
                      run_time=b.t(0.8))

        with self.beat("design") as b:
            parts = VGroup(*[chip(p, CONFIG, mono=False, size=BODY) for p in ("the place", "the tools", "the errors")])
            parts.arrange(RIGHT, buff=0.4)
            _left(parts, -0.6, _X0 + 0.3)
            ban = _banner(BODY)
            _left(ban, -1.75, _X0 + 0.3)
            self.play(LaggedStart(*[FadeIn(p, shift=UP * 0.1) for p in parts], lag_ratio=0.4), run_time=b.t(0.45))
            self.play(FadeIn(ban, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("close") as b:
            outline.close_part(self, "kit_config", next_key="settings_pane", run_time=b.left - 0.07)
