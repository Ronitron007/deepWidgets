"""Part `part_settings`: kit_routes settings_rules kit_feed settings_pane. The user door: the /api/kit
routes, the rules of the user door, the change feed, and the settings pane. The routes and the pane are
a design from the spike (`kit_spike`), not a decision. No route and no pane exists yet.

Beat weights follow the narration: one beat for each sentence (or sentence group).
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content
_X1 = FRAME_W / 2 - MARGIN - 0.1     # right edge of content


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (no-op if already later)."""
    scene.wait_until(b.start + frac * b.length)


def _arr(a, b, color=TEXT, buff=0.08, sw=3, tip=0.18):
    return Arrow(a, b, buff=buff, color=color, stroke_width=sw, max_tip_length_to_length_ratio=0.35,
                 tip_length=tip)


def _mono(s, color=None):
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    c = f' fgcolor="{color}"' if color else ""
    return f'<span font_family="{MONO}"{c}>{s}</span>'


def _left(m, y, x=_X0):
    return m.move_to([x, y, 0], aligned_edge=LEFT)


def _right(m, y, x=_X1):
    return m.move_to([x, y, 0], aligned_edge=RIGHT)


def _design_tag(text="spike design"):
    """Grey dashed tag for a spike design, as in part_describe."""
    return status_chip(text, solved=False)


def _note(*ls, color=INFERRED, size=SMALL):
    """A box of a few lines in one color (an inferred note in amber, a design note in grey)."""
    t = lines(*ls, size=size, color=color if color != OPEN else TEXT, buff=0.1)
    b = rbox(t.width + 0.45, t.height + 0.35, color, fill=0.12, sw=2, r=0.1, dashed=color == OPEN)
    t.move_to(b)
    return VGroup(b, t)


def _toggle(on=True):
    """A settings switch: a pill with a knob."""
    pill = RoundedRectangle(corner_radius=0.22, width=0.9, height=0.44, stroke_width=0,
                            fill_color=CONFIG if on else MUTED, fill_opacity=0.9)
    knob = Circle(radius=0.16, stroke_width=0, fill_color=BG, fill_opacity=1)
    knob.move_to(pill.get_center() + RIGHT * (0.23 if on else -0.23))
    return VGroup(pill, knob)


def _lock(color=MUTED, s=0.22):
    body = RoundedRectangle(corner_radius=0.03, width=s, height=s * 0.75, stroke_width=0,
                            fill_color=color, fill_opacity=0.9)
    shackle = Arc(radius=s * 0.3, start_angle=0, angle=PI, stroke_color=color, stroke_width=3)
    shackle.next_to(body, UP, buff=0)
    return VGroup(body, shackle)


def _field(label, w, color=MUTED):
    """An empty form field with a grey label inside."""
    b = rbox(w, 0.46, color, fill=0.05, sw=2, r=0.06)
    t = T(label, SMALL, MUTED).move_to(b.get_left() + RIGHT * 0.15, aligned_edge=LEFT)
    return VGroup(b, t)


def _button(label, color=SETTINGS):
    t = T(label, SMALL, BG, bold=True)
    b = RoundedRectangle(corner_radius=0.08, width=t.width + 0.4, height=0.46, stroke_width=0,
                         fill_color=color, fill_opacity=0.95)
    t.move_to(b)
    return VGroup(b, t)


# ====================================================================== kit_routes
class KitRoutes(DWScene):
    BEATS = [("open", 10), ("design", 20), ("get", 11), ("put", 10), ("post", 8), ("delete", 12),
             ("stream", 13), ("ignores", 6), ("today", 25), ("cookie", 10), ("size", 10)]

    ROUTES = [("GET /api/kit", "same body as kit_read"),
              ("PUT /api/kit/settings", "{ agentsMayAddPackages }"),
              ("POST /api/kit/extras", "{ name, version?, side }"),
              ("DELETE /api/kit/extras/<name>", "removes one extra"),
              ("GET /api/kit/stream", "SSE")]
    TODAY = [("/api/widgets/<slug>/program", "guarded"),
             ("/call", "guarded"),
             ("/stream", "guarded"),
             ("/api/widgets/events", "guarded")]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "settings_pane", arrows=("arrow_settings_kit",), run_time=b.left)

        tbl = RevealTable(["spike design route", "body"], self.ROUTES, mono_cols=[0], size=SMALL,
                          row_gap=0.14, col_gap=0.6,
                          cell_colors={(i, 0): SETTINGS for i in range(len(self.ROUTES))})
        tbl.shift([_X0 - tbl.get_left()[0], 2.55 - tbl.header.get_top()[1], 0])
        with self.beat("design") as b:
            title = scene_title("The user door: /api/kit", SETTINGS)
            tag = _design_tag("spike design, no route exists")
            _right(tag, TITLE_Y)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.2))
            self.add(tbl)
            tbl.header.set_opacity(0)
            self.play(tbl.header.animate.set_opacity(1), run_time=b.t(0.2))
            _at(self, b, 0.6)
            self.play(FadeIn(tag, shift=LEFT * 0.1), run_time=b.t(0.2))

        for i, name in enumerate(("get", "put", "post", "delete", "stream")):
            with self.beat(name) as b:
                self.play(tbl.reveal_row(i), run_time=b.t(0.35))

        with self.beat("ignores") as b:
            ig = chip("ignores kit-locked", SETTINGS, mono=False, size=SMALL)
            ig.move_to([_X1, tbl.body_rows[2].get_y(), 0], aligned_edge=RIGHT)
            self.play(Create(tbl.mark_row(2, SETTINGS)), FadeIn(ig, shift=LEFT * 0.1), run_time=b.t(0.5))

        cc = {(i, 0): SHELL for i in range(len(self.TODAY))}
        cc.update({(i, 1): SOLVED for i in range(len(self.TODAY))})
        today = RevealTable(["today: widget routes", "guard"], self.TODAY, mono_cols=[0, 1], size=SMALL,
                            row_gap=0.1, col_gap=0.6, cell_colors=cc)
        today.shift([_X0 - today.get_left()[0], -0.55 - today.header.get_top()[1], 0])
        with self.beat("today") as b:
            self.add(today)
            today.header.set_opacity(0)
            self.play(today.header.animate.set_opacity(1), run_time=b.t(0.15))
            self.play(today.reveal_rows(0, 3, lag=0.4), run_time=b.t(0.45))
            _at(self, b, 0.72)
            self.play(today.reveal_row(3), run_time=b.t(0.18))

        rx = today.get_right()[0] + 0.7
        with self.beat("cookie") as b:
            ck = chip("host checks the host cookie", HOST, mono=False, size=LABEL)
            _left(ck, today.body_rows[1].get_y(), rx)
            br = Brace(VGroup(*[today.cell(i, 1) for i in range(len(self.TODAY))]), RIGHT, color=SOLVED,
                       buff=0.12)
            self.play(GrowFromCenter(br), FadeIn(ck, shift=LEFT * 0.1), run_time=b.t(0.5))

        with self.beat("size") as b:
            sz = chip("routes: S (estimate)", INFERRED, mono=False, size=LABEL)
            _left(sz, today.body_rows[3].get_y() - 0.15, rx)
            self.play(FadeIn(sz, shift=UP * 0.1), run_time=b.t(0.4))


# ====================================================================== settings_rules
class SettingsRules(DWScene):
    BEATS = [("ignore", 10), ("reason", 15), ("one", 11), ("same", 12), ("failure", 22), ("inuse", 10),
             ("pane_err", 8), ("stream", 16)]

    def construct(self):
        dy = 2.25
        svc = ProcessBox("kit service", "ctx.widgetKit", color=KIT).move_to([0, dy, 0])
        mcp = chip("MCP (agent)", MCP, size=LABEL).move_to([-4.7, dy, 0])
        http = chip("HTTP (user)", SETTINGS, size=LABEL).move_to([4.7, dy, 0])
        a1 = _arr(mcp.get_right(), svc.get_left(), MCP)
        a2 = _arr(http.get_left(), svc.get_right(), SETTINGS)
        l1 = M(_mono("kit-locked") + " applies", LABEL).next_to(mcp, DOWN, buff=0.25)
        l2 = M(_mono("kit-locked") + " ignored", LABEL).next_to(http, DOWN, buff=0.25)
        with self.beat("ignore") as b:
            title = scene_title("The user door: rules", SETTINGS)
            tag = _right(_design_tag(), TITLE_Y)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(tag), run_time=b.t(0.2))
            self.play(FadeIn(svc, scale=0.95), FadeIn(mcp), FadeIn(http), GrowArrow(a1), GrowArrow(a2),
                      run_time=b.t(0.3))
            self.play(FadeIn(l1, shift=UP * 0.1), FadeIn(l2, shift=UP * 0.1), run_time=b.t(0.25))

        with self.beat("reason") as b:
            why = _note("the setting limits agents,", "not the machine owner (inferred)")
            _right(why, 0.5)
            self.play(Indicate(l2, color=SETTINGS, scale_factor=1.06), run_time=b.t(0.2))
            self.play(FadeIn(why, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("one") as b:
            one = T("pane and tools: one service", LABEL, KIT).next_to(svc, DOWN, buff=0.3)
            self.play(Indicate(svc, color=KIT, scale_factor=1.06), FadeIn(one, shift=UP * 0.1), run_time=b.t(0.45))

        with self.beat("same") as b:
            same = _note("other errors: same", "at both doors (inferred)")
            _left(same, 0.5)
            self.play(FadeIn(same, shift=UP * 0.1), run_time=b.t(0.35))

        pane = rbox(6.3, 2.1, SETTINGS, fill=0.05).move_to([_X1 - 3.15, -1.73, 0])
        ph = T("settings pane", LABEL, SETTINGS, bold=True)
        ph.move_to(pane.get_corner(UL) + RIGHT * 0.3 + DOWN * 0.3, aligned_edge=LEFT)
        ill = T("inferred, illustrative", SMALL, INFERRED).next_to(ph, RIGHT, buff=0.4).align_to(ph, DOWN)
        t1 = chip("install-failed: kit unchanged", ISOLATION, size=SMALL)
        t2 = chip("in-use: meter, clock", ISOLATION, size=SMALL)
        _left(t1, -1.5, pane.get_left()[0] + 0.3)
        _left(t2, -2.2, pane.get_left()[0] + 0.3)
        with self.beat("failure") as b:
            ex = M("on failure: " + _mono("install-failed", ISOLATION) + " leaves the kit and its old folder",
                   LABEL)
            _left(ex, -0.3)
            self.play(FadeIn(ex, shift=UP * 0.1), run_time=b.t(0.25))
            _at(self, b, 0.5)
            self.play(Create(pane), FadeIn(ph), run_time=b.t(0.2))
            self.play(FadeIn(t1, shift=DOWN * 0.1), run_time=b.t(0.15))

        with self.beat("inuse") as b:
            self.play(FadeIn(t2, shift=DOWN * 0.1), run_time=b.t(0.35))

        with self.beat("pane_err") as b:
            self.play(FadeIn(ill), run_time=b.t(0.4))

        with self.beat("stream") as b:
            st = chip("GET /api/kit/stream", SETTINGS, size=SMALL)
            _left(st, -1.75, _X0)
            sa = _arr(st.get_right(), [pane.get_left()[0], -1.75, 0], SETTINGS)
            ref = T("pane refreshes", LABEL, SETTINGS).next_to(sa, DOWN, buff=0.15)
            ag = M('a change from an <span fgcolor="%s">agent</span> shows at once' % AGENT, LABEL)
            _left(ag, -2.55, _X0)
            self.play(FadeIn(st, shift=RIGHT * 0.1), run_time=b.t(0.2))
            self.play(GrowArrow(sa), FadeIn(ref), Indicate(pane, color=SETTINGS, scale_factor=1.02),
                      run_time=b.t(0.3))
            self.play(FadeIn(ag, shift=UP * 0.1), run_time=b.t(0.2))


# ====================================================================== kit_feed
class KitFeed(DWScene):
    BEATS = [("feed", 15), ("entry", 13), ("kinds", 8), ("need", 10), ("infer", 6), ("spike", 15)]

    CODE = ("export interface WidgetChange {\n"
            "  seq: number\n"
            "  at: number\n"
            "  slug: string\n"
            "  kind: 'state' | 'program' | 'added' | 'removed'\n"
            "  by: string\n"
            "  action?: string\n"
            "  rev?: number\n"
            "}")

    def construct(self):
        fy = 2.4
        with self.beat("feed") as b:
            title = scene_title("The change feed", SETTINGS)
            ag = chip("agent", AGENT, mono=False, size=LABEL)
            wc = chip("widget_changes", MCP, size=LABEL)
            fd = T("recent changes", LABEL, TEXT)
            row = VGroup(ag, wc, fd).arrange(RIGHT, buff=0.9)
            _left(row, fy, _X0 + 0.05)
            r1 = _arr(ag.get_right(), wc.get_left(), AGENT)
            r2 = _arr(fd.get_left(), wc.get_right(), MCP)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.2))
            self.play(FadeIn(ag), FadeIn(wc), GrowArrow(r1), run_time=b.t(0.3))
            self.play(FadeIn(fd), GrowArrow(r2), run_time=b.t(0.25))

        card = code_block(self.CODE, "typescript", color=MUTED)
        card.move_to([_X0, 1.25, 0], aligned_edge=UL)
        hide_lines(card)
        src = T("deepwidgets/widgets/src/index.ts", SMALL, MUTED, mono=True)
        src.next_to(card, UP, buff=0.12).align_to(card, LEFT)
        rx = card.get_right()[0] + 0.35
        with self.beat("entry") as b:
            self.play(FadeIn(card.background), FadeIn(src), run_time=b.t(0.15))
            self.play(reveal_lines(card, 0, 9, lag=0.25), run_time=b.t(0.45))
            self.play(*[Create(mark_line(card, i, SETTINGS)) for i in (3, 5)], run_time=b.t(0.2))

        with self.beat("kinds") as b:
            self.play(Create(mark_line(card, 4, KIT)), run_time=b.t(0.4))

        with self.beat("need") as b:
            need = _note("kit change: new kind", "or new feed (inferred)")
            need.move_to([rx, 0.6, 0], aligned_edge=LEFT)
            self.play(FadeIn(need, shift=LEFT * 0.1), run_time=b.t(0.4))

        with self.beat("infer") as b:
            self.play(Indicate(src, color=INFERRED, scale_factor=1.06), run_time=b.t(0.6))

        with self.beat("spike") as b:
            sp = _note("spike design: a feed", "entry from an agent", "or a user", color=OPEN)
            sp.move_to([rx, -1.2, 0], aligned_edge=LEFT)
            self.play(FadeIn(sp, shift=LEFT * 0.1), run_time=b.t(0.35))


# ====================================================================== settings_pane
class SettingsPane(DWScene):
    BEATS = [("pane", 17), ("switch", 7), ("core", 10), ("extras", 12), ("form", 10), ("size", 10),
             ("close", 9)]

    CORE = ("react", "@openuidev/react-lang", "zod", "vite", "...")

    def construct(self):
        outline = OutlineDiagram()
        px0, px1, ptop, pbot = _X0 - 0.1, 2.25, 2.75, -2.75
        pane = rbox(px1 - px0, ptop - pbot, SETTINGS, fill=0.04).move_to([(px0 + px1) / 2, (ptop + pbot) / 2, 0])
        head = T("Widget kit", BODY, SETTINGS, bold=True).move_to([px0 + 0.35, 2.38, 0], aligned_edge=LEFT)
        sep1 = Line([px0 + 0.25, 2.07, 0], [px1 - 0.25, 2.07, 0], stroke_color=MUTED, stroke_width=1.5,
                    stroke_opacity=0.5)
        rx = px1 + 0.4
        with self.beat("pane") as b:
            title = scene_title("Settings pane", SETTINGS)
            tag = _right(_design_tag("mock, illustrative, spike design"), TITLE_Y)
            none = _right(_design_tag("no pane exists yet"), 2.3)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(tag), run_time=b.t(0.2))
            self.play(Create(pane), FadeIn(head), Create(sep1), run_time=b.t(0.3))
            _at(self, b, 0.6)
            self.play(FadeIn(none, shift=LEFT * 0.1), run_time=b.t(0.2))

        with self.beat("switch") as b:
            sw_t = T("Agents may add packages", LABEL, TEXT)
            _left(sw_t, 1.62, px0 + 0.35)
            sw = _toggle(on=True).move_to([px1 - 0.85, 1.62, 0])
            self.play(FadeIn(sw_t), FadeIn(sw), run_time=b.t(0.45))

        cx, ex, hy, pitch = px0 + 0.35, -1.55, 1.05, 0.4
        with self.beat("core") as b:
            ch = M("<b>core</b>  " + '<span fgcolor="%s">locked</span>' % MUTED, LABEL)
            _left(ch, hy, cx)
            rows = []
            for i, name in enumerate(self.CORE):
                lk = _lock()
                t = T(name, SMALL, TEXT, mono=True)
                r = VGroup(lk, t).arrange(RIGHT, buff=0.18)
                rows.append(_left(r, hy - 0.48 - i * pitch, cx + 0.1))
            self.play(FadeIn(ch), run_time=b.t(0.15))
            self.play(LaggedStart(*[FadeIn(r, shift=RIGHT * 0.1) for r in rows], lag_ratio=0.3), run_time=b.t(0.5))

        with self.beat("extras") as b:
            eh = T("extras", LABEL, TEXT, bold=True)
            _left(eh, hy, ex)
            e1 = VGroup(T("date-fns 4.0.0", SMALL, TEXT, mono=True), T("renderer, added by user", SMALL, MUTED))
            e2 = VGroup(T("dw-mini-ui 1.0.0", SMALL, TEXT, mono=True), T("renderer", SMALL, MUTED))
            for e in (e1, e2):
                e.arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            _left(e1, hy - 0.72, ex + 0.1)
            _left(e2, hy - 1.72, ex + 0.1)
            self.play(FadeIn(eh), run_time=b.t(0.15))
            self.play(FadeIn(e1, shift=RIGHT * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(e2, shift=RIGHT * 0.1), run_time=b.t(0.25))

        with self.beat("form") as b:
            sep2 = Line([px0 + 0.25, -1.4, 0], [px1 - 0.25, -1.4, 0], stroke_color=MUTED, stroke_width=1.5,
                        stroke_opacity=0.5)
            f1 = VGroup(_field("name", 2.6), _field("version", 1.9)).arrange(RIGHT, buff=0.3)
            _left(f1, -1.82, px0 + 0.35)
            seg = VGroup(*[chip(s, SETTINGS if s == "renderer" else MUTED, size=SMALL, fill=0.3 if s == "renderer" else 0.05)
                           for s in ("renderer", "host", "both")]).arrange(RIGHT, buff=0.08)
            side = VGroup(T("side", SMALL, MUTED), seg).arrange(RIGHT, buff=0.2)
            btns = VGroup(_button("Add"), _button("Remove", ISOLATION)).arrange(RIGHT, buff=0.25)
            f2 = VGroup(side, btns).arrange(RIGHT, buff=0.5)
            _left(f2, -2.4, px0 + 0.35)
            to = T("through /api/kit", SMALL, SETTINGS, mono=True)
            _left(to, -1.82, f1.get_right()[0] + 0.4)
            self.play(Create(sep2), FadeIn(f1), run_time=b.t(0.3))
            self.play(FadeIn(f2), run_time=b.t(0.25))
            self.play(FadeIn(to, shift=LEFT * 0.1), run_time=b.t(0.2))

        with self.beat("size") as b:
            sz = _note("settings pane:", "M (estimate)", size=LABEL)
            _right(sz, -2.2)
            self.play(FadeIn(sz, shift=UP * 0.1), run_time=b.t(0.4))

        with self.beat("close") as b:
            outline.close_part(self, "settings_pane", next_key="electron_main", run_time=b.left - 0.07)
