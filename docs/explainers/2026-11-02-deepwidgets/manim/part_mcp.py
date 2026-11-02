"""Part `part_mcp`: the MCP server, the fixed port, the handshake, the fence, and the interact tools.

Scenes, in order: mcp_server mcp_port mcp_handshake mcp_fence mcp_interact.
Beat weights follow the narration word counts of each sentence group.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content


def _arrow(a, b, color=MCP, sw=3, tip=0.16, buff=0.06):
    return Arrow(a, b, buff=buff, color=color, stroke_width=sw, tip_length=tip,
                 max_tip_length_to_length_ratio=0.3)


def _mono(s):
    return f'<span font_family="{MONO}">{s}</span>'


def _page(color=MCP, w=0.42, h=0.55):
    """A file icon: a page with a folded corner."""
    f = 0.14
    p = Polygon([-w / 2, h / 2, 0], [w / 2 - f, h / 2, 0], [w / 2, h / 2 - f, 0], [w / 2, -h / 2, 0],
                [-w / 2, -h / 2, 0], stroke_color=color, stroke_width=2.5, fill_color=color, fill_opacity=0.12)
    fold = VMobject(stroke_color=color, stroke_width=2)
    fold.set_points_as_corners([[w / 2 - f, h / 2, 0], [w / 2 - f, h / 2 - f, 0], [w / 2, h / 2 - f, 0]])
    return VGroup(p, fold)


def _browser(label="web page", color=ISOLATION):
    """A small browser window icon with a label under it."""
    frame = rbox(1.5, 1.0, color, fill=0.08, sw=2.5, r=0.08)
    bar_y = frame.get_top()[1] - 0.22
    bar = Line([frame.get_left()[0], bar_y, 0], [frame.get_right()[0], bar_y, 0], stroke_color=color,
               stroke_width=2)
    dots = VGroup(*[Dot(radius=0.035, color=color) for _ in range(3)]).arrange(RIGHT, buff=0.07)
    dots.move_to([frame.get_left()[0] + 0.25, bar_y + 0.11, 0])
    t = T(label, SMALL, TEXT).next_to(frame, DOWN, buff=0.1)
    return VGroup(frame, bar, dots, t)


def _cross(m, color=ISOLATION, sw=4):
    return VGroup(Line(m.get_corner(UL), m.get_corner(DR), color=color, stroke_width=sw),
                  Line(m.get_corner(DL), m.get_corner(UR), color=color, stroke_width=sw))


# ====================================================================== mcp_server
class McpServer(DWScene):
    BEATS = [("open", 10), ("mcp_def", 21), ("tool_def", 10), ("route", 16), ("sdk", 10), ("stateless", 10),
             ("tools", 31), ("scale", 10), ("ctx", 24)]

    INTERACT = ["widget_list", "widget_describe", "widget_call", "widget_changes"]
    CREATE = ["widget_template", "widget_guide", "widget_install", "widget_reload", "widget_remove"]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "mcp_server", arrows=("arrow_agent", "arrow_mcp"), run_time=b.left)

        with self.beat("mcp_def") as b:
            title = scene_title("The MCP server: the door for agents", MCP)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.12))
            d1 = M(f'<b>MCP</b> = <span fgcolor="{MCP}">Model Context Protocol</span>', BODY)
            d2 = T("a standard way for an AI agent to call the tools of a server", LABEL, MUTED)
            defs = VGroup(d1, d2).arrange(DOWN, buff=0.15, aligned_edge=LEFT).move_to([0, 2.3, 0])
            defs.to_edge(LEFT, buff=MARGIN + 0.3)
            self.play(FadeIn(d1, shift=UP * 0.1), run_time=b.t(0.18))
            self.play(FadeIn(d2), run_time=b.t(0.15))
            agent = ProcessBox("agent", "Claude Code", AGENT, width=3.2, height=1.3).move_to([-4.6, 0.25, 0])
            srv = rbox(5.2, 2.2, MCP, fill=0.07).move_to([3.4, 0.25, 0])
            srv_l = T("server", LABEL, MCP, bold=True).next_to(srv.get_corner(UL), DR, buff=0.15)
            tools = VGroup(*[chip(n, MCP, size=SMALL) for n in ("tool", "tool", "tool")]).arrange(RIGHT, buff=0.25)
            tools.move_to(srv).shift(DOWN * 0.2)
            call = labeled_arrow(agent.get_right(), srv.get_left(), "calls a tool", color=AGENT, mono=False)
            self.play(FadeIn(agent), FadeIn(srv), FadeIn(srv_l), run_time=b.t(0.2))
            self.play(GrowArrow(call.arrow), FadeIn(call.label), LaggedStart(*[FadeIn(t) for t in tools],
                                                                               lag_ratio=0.3), run_time=b.t(0.25))

        with self.beat("tool_def") as b:
            card = rbox(9.6, 1.25, MCP, fill=0.06, sw=2).move_to([0, -1.9, 0])
            name = M(f'<b>tool</b> = one named operation  ({_mono("widget_call")})', LABEL)
            sch = M('       + an <b>input schema</b>: the shape of its input', LABEL, color=MUTED)
            VGroup(name, sch).arrange(DOWN, buff=0.12, aligned_edge=LEFT).move_to(card)
            link = DashedLine(tools[1].get_bottom(), card.get_top(), color=MCP, stroke_width=2, dash_length=0.08)
            self.play(Indicate(tools[1], color=MCP), Create(link), FadeIn(card), run_time=b.t(0.35))
            self.play(FadeIn(name), run_time=b.t(0.25))
            self.play(FadeIn(sch), run_time=b.t(0.25))
            intro = VGroup(defs, agent, srv, srv_l, tools, call, card, name, sch, link)

        with self.beat("route") as b:
            self.play(FadeOut(intro), run_time=b.t(0.12))
            host = rbox(12.8, 2.3, HOST, fill=0.05).move_to([0, 1.45, 0])
            host_l = T("host", LABEL, HOST, bold=True).next_to(host.get_corner(UL), DR, buff=0.14)
            web = ProcessBox("web server", None, HOST).move_to([-3.6, 1.25, 0])
            route = chip("/mcp", MCP, size=BODY).next_to(web, RIGHT, buff=0.45)
            r_line = Line(web.get_right(), route.get_left(), color=MCP, stroke_width=3)
            pkg = ProcessBox("@deepwidgets/mcp", "a package", MCP, sub_mono=False).move_to([3.7, 1.25, 0])
            mounts = labeled_arrow(pkg.get_left(), route.get_right(), "mounts", color=MCP, mono=False)
            self.play(FadeIn(host), FadeIn(host_l), FadeIn(web), run_time=b.t(0.25))
            self.play(FadeIn(pkg, shift=LEFT * 0.2), run_time=b.t(0.2))
            self.play(GrowArrow(mounts.arrow), FadeIn(mounts.label), Create(r_line), FadeIn(route), run_time=b.t(0.3))
            one = T("one route", SMALL, MCP).next_to(route, DOWN, buff=0.12)
            self.play(FadeIn(one), run_time=b.t(0.12))

        with self.beat("sdk") as b:
            sdk = ProcessBox("the official MCP software kit", "@modelcontextprotocol/server 2.2.0", MCP,
                             fill=0.05).move_to([-3.1, -1.25, 0])
            uses = _arrow(pkg.get_bottom(), [sdk.get_right()[0], sdk.get_y(), 0] + RIGHT * 0.05, MCP)
            uses_l = T("uses", SMALL, MCP).next_to(uses.get_center(), RIGHT, buff=0.15)
            self.play(FadeIn(sdk, shift=UP * 0.15), run_time=b.t(0.35))
            self.play(GrowArrow(uses), FadeIn(uses_l), run_time=b.t(0.3))
            mode = chip("stateless mode", MCP, size=LABEL, mono=False).next_to(sdk, DOWN, buff=0.25)
            self.play(FadeIn(mode), run_time=b.t(0.2))

        with self.beat("stateless") as b:
            r1 = chip("request 1", AGENT, size=SMALL, mono=False).move_to([2.4, -0.95, 0])
            r2 = chip("request 2", AGENT, size=SMALL, mono=False).move_to([2.4, -1.85, 0])
            sess = chip("session", OPEN, size=SMALL, mono=False, dashed=True).move_to([5.3, -1.4, 0])
            l1 = DashedLine(r1.get_right(), sess.get_left(), color=OPEN, stroke_width=2, dash_length=0.07)
            l2 = DashedLine(r2.get_right(), sess.get_left(), color=OPEN, stroke_width=2, dash_length=0.07)
            self.play(FadeIn(r1), FadeIn(r2), FadeIn(sess), Create(l1), Create(l2), run_time=b.t(0.3))
            x = _cross(sess)
            note = T("no session between requests", SMALL, TEXT).next_to(VGroup(r2, sess), DOWN, buff=0.22)
            note.set_x(VGroup(r1, sess).get_x())
            self.play(Create(x), FadeIn(note), run_time=b.t(0.35))
            route_g = VGroup(host, host_l, web, route, r_line, pkg, mounts, one, sdk, uses, uses_l, mode,
                             r1, r2, sess, l1, l2, x, note)

        with self.beat("tools") as b:
            self.play(FadeOut(route_g), run_time=b.t(0.06))
            cx_i, cx_c = -1.15, -4.75
            h_i = T("interact (4)", LABEL, MCP, bold=True).move_to([cx_i, 2.45, 0])
            h_c = T("create (5)", LABEL, CREATION, bold=True).move_to([cx_c, 2.45, 0])
            ci = [chip(n, MCP, size=SMALL) for n in self.INTERACT]
            cc = [chip(n, CREATION, size=SMALL) for n in self.CREATE]
            for i, c in enumerate(ci):
                c.move_to([cx_i, 1.75 - 0.72 * i, 0])
            for i, c in enumerate(cc):
                c.move_to([cx_c, 1.75 - 0.72 * i, 0])
            nine = T("9 tools", BODY, TEXT, bold=True).move_to([cx_c, 2.45, 0])
            self.play(FadeIn(nine), run_time=b.t(0.1))
            self.play(FadeOut(nine), FadeIn(h_i), run_time=b.t(0.06))
            self.play(LaggedStart(*[FadeIn(c, shift=DOWN * 0.1) for c in ci], lag_ratio=0.5), run_time=b.t(0.32))
            self.play(FadeIn(h_c), run_time=b.t(0.06))
            self.play(LaggedStart(*[FadeIn(c, shift=DOWN * 0.1) for c in cc], lag_ratio=0.5), run_time=b.t(0.36))

        with self.beat("scale") as b:
            wl = T("widgets:", LABEL, MUTED).move_to([2.6, 2.1, 0])
            wn = T("1", BODY, RUNTIME, mono=True, bold=True).next_to(wl, RIGHT, buff=0.25)
            tl = T("tools:", LABEL, MUTED).next_to(wl, DOWN, buff=0.3).align_to(wl, RIGHT)
            tn = T("9", BODY, MCP, mono=True, bold=True).next_to(tl, RIGHT, buff=0.25)
            self.play(FadeIn(VGroup(wl, wn, tl, tn)), run_time=b.t(0.25))
            wn2 = T("100", BODY, RUNTIME, mono=True, bold=True).next_to(wl, RIGHT, buff=0.25)
            self.play(Transform(wn, wn2), Indicate(tn, color=MCP), run_time=b.t(0.35))
            cap = caption("9 tools for 1 or 100 widgets")
            self.play(FadeIn(cap), run_time=b.t(0.2))

        with self.beat("ctx") as b:
            ctx = ProcessBox("ctx.widgets", "queue · timeout · checks", RUNTIME, width=5.0, height=1.3)
            ctx.move_to([4.1, -0.75, 0])
            ib = Brace(VGroup(*ci), RIGHT, color=MCP, buff=0.15)
            a_ag = _arrow(ib.get_tip(), ctx.box.get_left(), MCP)
            self.play(FadeIn(ib), GrowArrow(a_ag), FadeIn(ctx), run_time=b.t(0.3))
            click = chip("a click", USER, size=LABEL, mono=False).move_to([4.1, -2.45, 0])
            a_cl = _arrow(click.get_top(), ctx.box.get_bottom(), USER)
            self.play(FadeIn(click), GrowArrow(a_cl), run_time=b.t(0.25))
            same = T("agent calls and clicks: the same path", SMALL, TEXT).next_to(ctx, UP, buff=0.15)
            self.play(FadeIn(same), Indicate(ctx.box, color=RUNTIME, scale_factor=1.04), run_time=b.t(0.3))


# ====================================================================== mcp_port
class McpPort(DWScene):
    BEATS = [("find", 13), ("default", 8), ("setting", 32), ("taken", 25), ("decided", 17), ("file", 19),
             ("fields", 27), ("mode", 13), ("live", 11), ("alive", 11), ("dies", 10)]

    ROWS = [("not set", "47615 (the default)"), ("0", "the system picks a port"),
            ("not a port", "the host stops with an error")]
    FILE = '''{
  "port": 53312,
  "nonce": "mf7wks...",
  "pid": 85765,
  "started": 1793606813019
}'''
    NOTES = [(1, "the port"), (2, "a random secret, new at each host start"), (3, "the process id"),
             (4, "the start time")]
    RULES = [("the /mcp route is live", "the host writes it"),
             ("its host is still alive", "a new host does not take it"),
             ("its host dies", "Electron main removes it")]

    def construct(self):
        with self.beat("find") as b:
            title = scene_title("A fixed port", MCP)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.15))
            agent = ProcessBox("agent", "Claude Code", AGENT, width=3.0, height=1.25).move_to([-4.9, 1.5, 0])
            host = ProcessBox("host", "MCP server", HOST, sub_mono=False, width=3.0, height=1.25)
            host.move_to([4.9, 1.5, 0])
            q = T("where is the server?", SMALL, AGENT).next_to(agent, DOWN, buff=0.15)
            self.play(FadeIn(agent), FadeIn(q), run_time=b.t(0.3))
            self.play(FadeIn(host), run_time=b.t(0.25))
            fx = T("so the host binds a fixed port", LABEL, TEXT).move_to([0, -0.4, 0])
            self.play(FadeIn(fx, shift=UP * 0.1), run_time=b.t(0.2))

        with self.beat("default") as b:
            port = T("47615", 80, MCP, mono=True, bold=True).move_to([0, 1.55, 0])
            pl = T("the default port", SMALL, MUTED).next_to(port, DOWN, buff=0.12)
            a1 = _arrow(agent.get_right(), port.get_left(), AGENT, buff=0.15)
            a2 = Line(port.get_right() + RIGHT * 0.15, host.get_left(), color=HOST, stroke_width=3)
            self.play(FadeIn(port, scale=1.2), Create(a2), run_time=b.t(0.45))
            self.play(FadeIn(pl), GrowArrow(a1), FadeOut(q), run_time=b.t(0.35))

        with self.beat("setting") as b:
            st = M(f'setting {_mono("DEEPWIDGETS_MCP_PORT")}', LABEL).move_to([0, 0.15, 0])
            where = T("in $DSH_HOME/.env or the environment", SMALL, MUTED, mono=True).next_to(st, DOWN, buff=0.1)
            self.play(FadeOut(fx), FadeIn(st), FadeIn(where), run_time=b.t(0.2))
            tbl = RevealTable(["value", "result"], self.ROWS, mono_cols=[0],
                              cell_colors={(2, 0): ISOLATION, (2, 1): ISOLATION, (0, 1): MCP})
            tbl.move_to([0, 0, 0]).align_to([0, -0.75, 0], UP)
            self.add(tbl)
            self.play(tbl.reveal_row(0), run_time=b.t(0.2))
            self.play(tbl.reveal_row(1), run_time=b.t(0.25))
            self.play(tbl.reveal_row(2), run_time=b.t(0.25))

        with self.beat("taken") as b:
            self.play(FadeOut(VGroup(agent, a1, st, where, tbl)), run_time=b.t(0.1))
            other = ProcessBox("another process", "holds :47615", MUTED, width=3.4, height=1.25)
            other.move_to([-4.7, 1.5, 0])
            hold = Line(other.get_right(), port.get_left() + LEFT * 0.15, color=MUTED, stroke_width=3)
            self.play(FadeIn(other), Create(hold), run_time=b.t(0.2))
            app = ProcessBox("our app starts", None, HOST).move_to([4.9, 0.0, 0])
            self.play(host.box.animate.set_stroke(opacity=0.25), host.text.animate.set_opacity(0.25), FadeIn(app, shift=UP * 0.15), run_time=b.t(0.15))
            err = T("Error: listen EADDRINUSE: address already in use 127.0.0.1:P", SMALL, ISOLATION, mono=True)
            err.move_to([0, -1.15, 0])
            bx = burst(ISOLATION, 0.25).move_to(app.get_corner(UR))
            fails = T("the app fails at start", SMALL, ISOLATION).next_to(app, DOWN, buff=0.15)
            self.play(FadeIn(bx), FadeIn(err, shift=DOWN * 0.1), FadeIn(fails), run_time=b.t(0.3))
            pr = chip("seen in the check of PR #60", MUTED, size=SMALL, mono=False).move_to([-4.7, 0.25, 0])
            self.play(FadeIn(pr), run_time=b.t(0.2))

        with self.beat("decided") as b:
            dec = ProcessBox("on purpose", "the operator decided this rule; the documents give no reason", MCP,
                             sub_mono=False).move_to([0, -2.4, 0])
            self.play(FadeIn(dec, shift=UP * 0.15), run_time=b.t(0.4))
            taken_g = VGroup(other, hold, host, app, err, bx, fails, pr, dec, port, pl, a2)

        with self.beat("file") as b:
            self.play(FadeOut(taken_g), run_time=b.t(0.12))
            pg = _page(MCP).move_to([_X0 + 0.25, 2.35, 0])
            path = T("$DSH_HOME/deepwidgets/mcp.json", LABEL, MCP, mono=True).next_to(pg, RIGHT, buff=0.25)
            pf = T("the port file", SMALL, MUTED).next_to(path, RIGHT, buff=0.3)
            self.play(FadeIn(pg), FadeIn(path, shift=RIGHT * 0.1), FadeIn(pf), run_time=b.t(0.35))
            dh = T("$DSH_HOME: the folder of the app data, by default ~/.dsh", SMALL, MUTED)
            dh.next_to(VGroup(pg, path), DOWN, buff=0.2).align_to(pg, LEFT)
            self.play(FadeIn(dh), run_time=b.t(0.3))

        with self.beat("fields") as b:
            js = code_block(self.FILE, "json", color=MCP)
            js.align_to([_X0, 0, 0], LEFT).align_to([0, 1.35, 0], UP)
            hide_lines(js)
            self.add(js)
            self.play(reveal_lines(js, 0, 1), reveal_lines(js, 5, 6), run_time=b.t(0.1))
            notes = []
            for k, (i, n) in enumerate(self.NOTES):
                t = T(n, SMALL, MCP if i == 2 else TEXT)
                t.move_to([0, js.code_lines[i].get_y(), 0]).align_to([js.get_right()[0] + 0.4, 0, 0], LEFT)
                notes.append(t)
                self.play(reveal_lines(js, i, i + 1), FadeIn(t, shift=LEFT * 0.1), run_time=b.t(0.17))
            ex = T("values from the worked example", SMALL, MUTED).next_to(js, DOWN, buff=0.15).align_to(js, LEFT)
            self.play(FadeIn(ex), run_time=b.t(0.1))
            nonce_box = SurroundingRectangle(VGroup(js.code_lines[2], notes[1]), color=MCP, buff=0.08,
                                             stroke_width=2.5, corner_radius=0.06)

        with self.beat("mode") as b:
            self.play(Create(nonce_box), run_time=b.t(0.2))
            md = chip("mode 0600", MCP, size=LABEL).move_to([0, -2.3, 0]).align_to([_X0, 0, 0], LEFT)
            only = T("only your user can read it", LABEL, TEXT).next_to(md, RIGHT, buff=0.3)
            self.play(FadeIn(md), FadeIn(only), run_time=b.t(0.4))

        with self.beat("live") as b:
            self.play(FadeOut(VGroup(js, *notes, ex, nonce_box, dh)), md.animate.next_to(pf, RIGHT, buff=0.3),
                      FadeOut(only), run_time=b.t(0.15))
            rt = RevealTable(["when", "the port file"], self.RULES, size=BODY, row_gap=0.2,
                             cell_colors={(2, 1): SHELL, (2, 0): ISOLATION})
            rt.move_to([0, 0, 0]).align_to([0, 1.5, 0], UP)
            self.add(rt)
            self.play(rt.reveal_row(0), run_time=b.t(0.35))
            ok = status_chip("route first, file second").next_to(rt, DOWN, buff=0.5)
            self.play(FadeIn(ok), run_time=b.t(0.3))

        with self.beat("alive") as b:
            self.play(rt.reveal_row(1), run_time=b.t(0.4))

        with self.beat("dies") as b:
            self.play(rt.reveal_row(2), run_time=b.t(0.35))
            em = chip("Electron main", SHELL, size=LABEL, mono=False).move_to([-3.2, -2.2, 0])
            dh2 = chip("host", HOST, size=LABEL, mono=False).move_to([0.2, -2.2, 0])
            bxd = burst(ISOLATION, 0.22).move_to(dh2.get_corner(UR))
            pf2 = VGroup(_page(MCP), T("mcp.json", SMALL, MCP, mono=True)).arrange(RIGHT, buff=0.12)
            pf2.move_to([3.6, -2.2, 0])
            self.play(Create(rt.mark_row(2, SHELL)), FadeOut(ok), FadeIn(em), FadeIn(dh2), FadeIn(bxd), FadeIn(pf2),
                      run_time=b.t(0.3))
            rm = labeled_arrow(em.get_right(), dh2.get_left(), "runs", color=SHELL, mono=False)
            rm2 = labeled_arrow(dh2.get_right(), pf2.get_left(), "removes", color=SHELL, mono=False, dashed=True)
            self.play(GrowArrow(rm.arrow), FadeIn(rm.label), Create(rm2.arrow), FadeIn(rm2.label), run_time=b.t(0.15))
            self.play(pf2.animate.set_opacity(0.2), run_time=b.t(0.15))


# ====================================================================== mcp_handshake
class McpHandshake(DWScene):
    BEATS = [("why", 14), ("take", 10), ("name", 5), ("read", 9), ("challenge", 9), ("post", 12),
             ("answer", 11), ("hmac", 17), ("same", 6), ("stop", 8), ("fake", 14), ("store", 15),
             ("restart", 19), ("again", 7)]

    def construct(self):
        with self.beat("why") as b:
            title = scene_title("The handshake", MCP)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.15))
            agent = ProcessBox("agent", "Claude Code", AGENT, width=3.0, height=1.25).move_to([-4.6, 1.0, 0])
            port = chip(":47615", MCP, size=BODY).move_to([0, 1.0, 0])
            host = ProcessBox("host", "the real one", HOST, sub_mono=False, width=3.0, height=1.25)
            host.move_to([4.6, 1.0, 0])
            a1 = _arrow(agent.get_right(), port.get_left(), AGENT)
            l2 = Line(port.get_right(), host.get_left(), color=HOST, stroke_width=3)
            self.play(FadeIn(agent), FadeIn(port), FadeIn(host), Create(l2), run_time=b.t(0.3))
            q = T("is this the real host?", LABEL, AGENT).next_to(agent, DOWN, buff=0.2)
            data = chip("data", AGENT, size=SMALL, mono=False).next_to(agent, UP, buff=0.15)
            self.play(GrowArrow(a1), FadeIn(q), FadeIn(data), run_time=b.t(0.3))

        with self.beat("take") as b:
            st = T("stopped", SMALL, ISOLATION).next_to(host, DOWN, buff=0.15)
            self.play(host.box.animate.set_stroke(opacity=0.2), host.text.animate.set_opacity(0.2), FadeIn(st), run_time=b.t(0.3))
            imp = ProcessBox("another process", "takes the port", ISOLATION, sub_mono=False, width=3.4, height=1.25)
            imp.move_to([4.6, -0.75, 0])
            self.play(FadeIn(imp, shift=UP * 0.2), l2.animate.put_start_and_end_on(port.get_right(), imp.get_left()),
                      run_time=b.t(0.4))

        with self.beat("name") as b:
            hs = chip("check first: the handshake", MCP, size=LABEL, mono=False).move_to([0, -1.9, 0])
            self.play(FadeIn(hs, scale=1.1), run_time=b.t(0.5))
            why_g = VGroup(agent, port, host, a1, l2, q, data, st, imp, hs)

        # sequence diagram: lifelines for the port file, the agent, and the host
        xf, xa, xh = -5.75, -3.1, 4.9
        top_y, bot_y = 2.45, -2.75
        with self.beat("read") as b:
            self.play(FadeOut(why_g), run_time=b.t(0.12))
            h_file = VGroup(_page(MCP, 0.34, 0.44), T("mcp.json", SMALL, MCP, mono=True)).arrange(DOWN, buff=0.06)
            h_file.move_to([xf, top_y, 0])
            h_agent = chip("agent", AGENT, size=LABEL, mono=False).move_to([xa, top_y, 0])
            h_host = chip("host  /mcp/token", HOST, size=LABEL, mono=True).move_to([xh, top_y, 0])
            lls = VGroup(*[DashedLine([x, top_y - 0.4, 0], [x, yb, 0], color=MUTED, stroke_width=2,
                                      dash_length=0.08) for x, yb in ((xa, bot_y), (xh, -1.65))])
            ll_f = DashedLine([xf, top_y - 0.45, 0], [xf, 0.9, 0], color=MUTED, stroke_width=2, dash_length=0.08)
            self.play(FadeIn(h_file), FadeIn(h_agent), FadeIn(h_host), Create(lls), Create(ll_f), run_time=b.t(0.35))
            m_read = _arrow([xf, 1.45, 0], [xa, 1.45, 0], MCP, buff=0.05)
            l_read = T("nonce", SMALL, MCP, mono=True).next_to(m_read, UP, buff=0.06)
            self.play(GrowArrow(m_read), FadeIn(l_read), run_time=b.t(0.3))
            loc = T("stays local", SMALL, MUTED).next_to(m_read, DOWN, buff=0.08)
            self.play(FadeIn(loc), run_time=b.t(0.2))

        with self.beat("challenge") as b:
            ch = M(f'challenge = {_mono("random bytes")} (at least 16)', SMALL, color=AGENT)
            ch.move_to([0, 1.45, 0]).align_to([xa + 0.25, 0, 0], LEFT)
            self.play(FadeIn(ch, shift=RIGHT * 0.1), run_time=b.t(0.5))

        with self.beat("post") as b:
            y = 0.6
            m_post = _arrow([xa, y, 0], [xh, y, 0], AGENT, buff=0.05)
            l_post = T("POST /mcp/token", SMALL, AGENT, mono=True).next_to(m_post, UP, buff=0.06)
            p1 = T("{ agent: 'Claude Code',", SMALL, TEXT, mono=True)
            p2 = T("  challenge: '7vFM_pcU01mzX96pLOmRsQ' }", SMALL, TEXT, mono=True)
            post_p = VGroup(p1, p2).arrange(DOWN, buff=0.08, aligned_edge=LEFT)
            post_p.next_to(m_post, DOWN, buff=0.1).set_x((xa + xh) / 2)
            self.play(GrowArrow(m_post), FadeIn(l_post), run_time=b.t(0.35))
            self.play(FadeIn(post_p), run_time=b.t(0.3))

        with self.beat("answer") as b:
            y = -0.8
            m_ans = _arrow([xh, y, 0], [xa, y, 0], HOST, buff=0.05)
            a1 = T("{ token, agentId: 'claude-code-c1e6b7',", SMALL, TEXT, mono=True)
            a2 = T("  proof: '7e69ce49...' }", SMALL, TEXT, mono=True)
            ans_p = VGroup(a1, a2).arrange(DOWN, buff=0.08, aligned_edge=LEFT)
            ans_p.next_to(m_ans, DOWN, buff=0.1).set_x((xa + xh) / 2)
            self.play(GrowArrow(m_ans), run_time=b.t(0.3))
            self.play(FadeIn(ans_p), run_time=b.t(0.3))
            proof_word = a2[0:19]
            tk_cap = caption("token: the secret that the agent sends on each request after this")
            self.play(FadeIn(tk_cap), run_time=b.t(0.2))

        with self.beat("hmac") as b:
            hm = T("HMAC-SHA256(nonce, challenge)", SMALL, AGENT, mono=True)
            hm.move_to([0, -2.3, 0]).align_to([xa + 0.25, 0, 0], LEFT)
            hcap = caption("HMAC: a keyed hash. Here the key is the nonce.")
            self.play(FadeOut(tk_cap), FadeIn(hcap), run_time=b.t(0.2))
            self.play(Indicate(proof_word, color=HOST), run_time=b.t(0.3))
            hb = SurroundingRectangle(proof_word, color=HOST, buff=0.05, stroke_width=2.5)
            self.play(Create(hb), run_time=b.t(0.2))

        with self.beat("same") as b:
            self.play(FadeIn(hm, shift=RIGHT * 0.1), run_time=b.t(0.4))
            eq = T("= proof ?", SMALL, TEXT, mono=True).next_to(hm, RIGHT, buff=0.15)
            self.play(FadeIn(eq), run_time=b.t(0.3))

        with self.beat("stop") as b:
            match = chip("match: go on", SOLVED, size=SMALL, mono=False).next_to(eq, RIGHT, buff=0.3)
            self.play(FadeIn(match, scale=1.1), run_time=b.t(0.35))
            nomatch = chip("no match: stop", ISOLATION, size=SMALL, mono=False).next_to(match, UP, buff=0.12)
            nomatch.align_to(match, LEFT)
            self.play(FadeIn(nomatch), run_time=b.t(0.3))

        with self.beat("fake") as b:
            fake = chip("fake server", ISOLATION, size=LABEL, mono=False).move_to(h_host)
            self.play(FadeOut(VGroup(post_p, ans_p, hb, match, nomatch, hcap)), FadeOut(h_host), FadeIn(fake),
                      lls[1].animate.set_color(ISOLATION), run_time=b.t(0.2))
            nn = T("has no nonce", SMALL, ISOLATION).next_to(fake, DOWN, buff=0.1)
            fa = T("{ token, agentId, proof: ??? }", SMALL, ISOLATION, mono=True)
            fa.next_to(m_ans, DOWN, buff=0.1).set_x((xa + xh) / 2)
            self.play(FadeIn(nn), m_ans.animate.set_color(ISOLATION), FadeIn(fa), run_time=b.t(0.3))
            mis = chip("no match: stop", ISOLATION, size=SMALL, mono=False).next_to(eq, RIGHT, buff=0.3)
            self.play(FadeIn(mis, scale=1.1), Indicate(l_read, color=MCP), run_time=b.t(0.3))
            ncap = caption("The nonce never leaves the file. A fake server cannot make the proof.")
            self.play(FadeIn(ncap), run_time=b.t(0.15))
            seq_g = VGroup(h_file, h_agent, fake, nn, lls, ll_f, m_read, l_read, loc, ch, m_post, l_post, m_ans,
                           fa, hm, eq, mis, ncap)

        with self.beat("store") as b:
            self.play(FadeOut(seq_g), run_time=b.t(0.1))
            hdr = M('The host stores only a <b>hash</b> of each token', BODY).move_to([0, 2.4, 0])
            hdr.to_edge(LEFT, buff=MARGIN + 0.3)
            row = code_block("sha256(token) -> { agentId, agent, issuedAt, epoch }", "text", color=MCP)
            row.next_to(hdr, DOWN, buff=0.3).align_to(hdr, LEFT)
            self.play(FadeIn(hdr), run_time=b.t(0.2))
            self.play(FadeIn(row, shift=DOWN * 0.1), run_time=b.t(0.25))
            stack = VGroup(*[rbox(4.0, 0.22, MCP, fill=0.25, sw=1.5, r=0.05) for _ in range(7)])
            stack.arrange(DOWN, buff=0.08).move_to([-3.6, -1.15, 0])
            sl = T("the 64 newest", LABEL, MCP).next_to(stack, RIGHT, buff=0.35).shift(UP * 0.35)
            sl2 = T("the oldest drops", SMALL, MUTED).next_to(sl, DOWN, buff=0.15).align_to(sl, LEFT)
            self.play(LaggedStart(*[FadeIn(r) for r in stack], lag_ratio=0.15), FadeIn(sl), run_time=b.t(0.2))
            new = rbox(4.0, 0.22, SOLVED, fill=0.5, sw=1.5, r=0.05).next_to(stack, UP, buff=0.08)
            self.play(FadeIn(new, shift=DOWN * 0.15), stack[-1].animate.set_opacity(0.1), FadeIn(sl2),
                      run_time=b.t(0.2))
            store_g = VGroup(stack, new, sl, sl2)

        with self.beat("restart") as b:
            self.play(FadeOut(store_g), run_time=b.t(0.1))
            h1 = ProcessBox("host start", "epoch: a new random id", HOST, sub_mono=False, width=4.2, height=1.25)
            h1.move_to([3.6, -0.9, 0])
            tok = chip("old token", AGENT, size=LABEL, mono=False).move_to([-4.6, -0.9, 0])
            self.play(FadeIn(h1), FadeIn(tok), run_time=b.t(0.2))
            a = _arrow(tok.get_right(), h1.get_left(), AGENT)
            self.play(GrowArrow(a), run_time=b.t(0.2))
            r401 = chip("401", ISOLATION, size=BODY).next_to(a, UP, buff=0.12)
            ep = T("other epoch", SMALL, ISOLATION).next_to(a, DOWN, buff=0.12)
            self.play(FadeIn(r401, scale=1.2), FadeIn(ep), a.animate.set_color(ISOLATION), run_time=b.t(0.3))

        with self.beat("again") as b:
            ag = chip("new handshake", SOLVED, size=LABEL, mono=False).move_to([-0.5, -2.35, 0])
            loop = CurvedArrow(tok.get_bottom() + DOWN * 0.05, ag.get_left() + LEFT * 0.05, color=SOLVED,
                               angle=PI / 3, stroke_width=3, tip_length=0.16)
            self.play(Create(loop), FadeIn(ag), run_time=b.t(0.5))


# ====================================================================== mcp_fence
class McpFence(DWScene):
    BEATS = [("fence", 8), ("peer", 10), ("origin", 15), ("browsers", 13), ("page", 15), ("host", 9),
             ("token", 13), ("limit", 23)]

    BARS = [("peer is loopback", "127.0.0.0/8, ::1", "403"),
            ("no Origin, no Sec-Fetch-Site", "browser headers", "403"),
            ("Host is exactly", "127.0.0.1 | localhost | [::1]", "403"),
            ("Bearer token known", "Authorization header", "401")]

    def construct(self):
        bx0, bx1 = -4.3, 5.0
        lane = bx0 + 0.6
        ys = [1.75, 0.8, -0.15, -1.1]
        bars, codes = [], []
        for (main, sub, code), y in zip(self.BARS, ys):
            r = rbox(bx1 - bx0, 0.72, MCP, fill=0.1, sw=2.5).move_to([(bx0 + bx1) / 2, y, 0])
            t1 = T(main, LABEL, TEXT, bold=True)
            t2 = T(sub, SMALL, MUTED, mono=True)
            VGroup(t1, t2).arrange(RIGHT, buff=0.3).move_to(r).align_to([bx0 + 1.15, 0, 0], LEFT)
            bars.append(VGroup(r, t1, t2))
            c = chip(f"else {code}", ISOLATION, size=SMALL, mono=False).next_to(r, RIGHT, buff=0.2)
            codes.append(c)
        top = [lane, 2.55, 0]
        mcp = chip("/mcp", MCP, size=BODY).move_to([lane, -2.2, 0])

        with self.beat("fence") as b:
            title = scene_title("The fence on /mcp", MCP)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.2))
            each = T("each request", SMALL, MUTED).next_to([lane, 2.5, 0], RIGHT, buff=0.25)
            down = _arrow([lane, 2.6, 0], [lane, 2.15, 0], MUTED, buff=0.0)
            self.play(FadeIn(mcp), FadeIn(each), GrowArrow(down),
                      LaggedStart(*[FadeIn(br[0]) for br in bars], lag_ratio=0.2), run_time=b.t(0.5))

        with self.beat("peer") as b:
            self.play(FadeOut(each), FadeOut(down), run_time=b.t(0.1))
            self.play(FadeIn(bars[0][1:]), FadeIn(codes[0]), run_time=b.t(0.35))
            lb = T("loopback: this computer", SMALL, MCP).next_to(bars[0], UP, buff=0.12).align_to(bars[0], RIGHT)
            self.play(FadeIn(lb), run_time=b.t(0.3))

        with self.beat("origin") as b:
            self.play(FadeIn(bars[1][1:]), FadeIn(codes[1]), run_time=b.t(0.4))
            self.play(Indicate(codes[1], color=ISOLATION), run_time=b.t(0.3))

        with self.beat("browsers") as b:
            note = caption("These headers come from browsers. An MCP client is never a browser.")
            self.play(FadeIn(note), run_time=b.t(0.35))

        with self.beat("page") as b:
            self.play(FadeOut(note), run_time=b.t(0.1))
            br = _browser("web page")
            br.move_to([-5.6, 2.2, 0])
            # the page passes the peer check (it runs on this computer) and bounces off bar two
            self.play(FadeIn(br), run_time=b.t(0.12))
            dot = chip("request", ISOLATION, size=SMALL, mono=False).move_to(top)
            dot.move_to(br[0])
            self.play(FadeIn(dot), run_time=b.t(0.04))
            self.play(dot.animate.move_to(top), run_time=b.t(0.08))
            self.play(dot.animate.move_to([lane, ys[1] + 0.05, 0]), run_time=b.t(0.25), rate_func=rush_into)
            self.play(dot.animate(rate_func=rush_from).move_to(top), Indicate(codes[1], color=ISOLATION),
                      run_time=b.t(0.2))
            no = caption("A web page that you visit must not drive your widgets.", color=ISOLATION)
            self.play(FadeOut(dot), FadeIn(no), run_time=b.t(0.12))

        with self.beat("host") as b:
            self.play(FadeOut(br), FadeOut(no), FadeIn(bars[2][1:]), FadeIn(codes[2]), run_time=b.t(0.45))

        with self.beat("token") as b:
            self.play(FadeIn(bars[3][1:]), FadeIn(codes[3]), run_time=b.t(0.35))
            nt = T("no token, or an unknown token", SMALL, TEXT).next_to(codes[3], DOWN, buff=0.1)
            nt.align_to(codes[3], RIGHT)
            ag = chip("agent", AGENT, size=SMALL, mono=False).move_to(top)
            self.play(FadeIn(nt), FadeIn(ag), run_time=b.t(0.2))
            self.play(ag.animate.move_to(mcp.get_top() + UP * 0.3), run_time=b.t(0.3))
            self.play(FadeOut(ag), Indicate(mcp, color=SOLVED), run_time=b.t(0.12))

        with self.beat("limit") as b:
            lim = status_chip("limit", solved=False)
            proc = ProcessBox("a process of your own user", None, OPEN, dashed=True)
            pg = VGroup(_page(MCP), T("mcp.json", SMALL, MCP, mono=True)).arrange(RIGHT, buff=0.15)
            rd = labeled_arrow(ORIGIN, RIGHT * 1.6, "can read", color=OPEN, dashed=True, mono=False)
            row = VGroup(lim, proc, rd, pg).arrange(RIGHT, buff=0.3).move_to([0, -3.0, 0])
            rd_l = rd.label
            row.set_y(CAPTION_Y + 0.05)
            self.play(FadeIn(lim), FadeIn(proc), run_time=b.t(0.25))
            self.play(Create(rd.arrow), FadeIn(rd_l), FadeIn(pg), run_time=b.t(0.25))
            nh = T("the handshake does not protect against it", SMALL, OPEN)
            nh.next_to(mcp, RIGHT, buff=0.6)
            self.play(FadeIn(nh), run_time=b.t(0.25))


# ====================================================================== mcp_interact
class McpInteract(DWScene):
    BEATS = [("path", 6), ("list", 9), ("describe", 19), ("call", 14), ("changes", 8), ("error", 14),
             ("next", 9), ("timeout", 17), ("codes", 10), ("nopush", 6), ("check", 20), ("except", 11),
             ("pull", 13), ("close", 9)]

    TOOLS = ["widget_list", "widget_describe", "widget_call", "widget_changes"]
    CODES = ["unknown-widget", "unknown-action", "invalid-args", "handler-error", "timeout", "busy",
             "idempotency-conflict", "conflict", "bad-request", "safe-mode", "widget-failed", "stale-cursor",
             "internal-error", "bad-source", "gate-failed", "slug-taken", "slug-changed", "install-failed",
             "not-installed", "creation-unavailable"]
    NEXT = ["The action ran past its limit and was aborted.", "Its later writes were refused.",
            "Read the state with widget_describe", "before you retry with the same requestId."]

    def construct(self):
        cx = -4.7
        ys = [2.25, 0.95, -0.35, -1.65]
        cards = [chip(n, MCP, size=LABEL) for n in self.TOOLS]
        for c, y in zip(cards, ys):
            c.move_to([cx, y, 0])
        arrs = [_arrow(a.get_bottom(), c.get_top(), MCP, buff=0.06) for a, c in zip(cards, cards[1:])]
        dx = cx + 2.0

        def desc(i, *ls):
            g = VGroup(*[M(s, LABEL) for s in ls]).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            g.move_to([0, ys[i], 0]).align_to([dx, 0, 0], LEFT)
            return g

        with self.beat("path") as b:
            title = scene_title("The interact tools", MCP)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))
            self.play(LaggedStart(*[FadeIn(c) for c in cards], *[GrowArrow(a) for a in arrs], lag_ratio=0.12),
                      run_time=b.t(0.6))

        with self.beat("list") as b:
            d0 = desc(0, "each live widget + a <b>cursor</b>")
            self.play(Indicate(cards[0], color=MCP), FadeIn(d0, shift=LEFT * 0.1), run_time=b.t(0.4))
            cc = caption("cursor: a point in the change feed")
            self.play(FadeIn(cc), run_time=b.t(0.2))

        with self.beat("describe") as b:
            d1 = desc(1, "the <b>actions</b> of one widget,",
                      "the <b>JSON Schema</b> of each args object, and the <b>state</b>")
            self.play(Indicate(cards[1], color=MCP), FadeIn(d1, shift=LEFT * 0.1), run_time=b.t(0.4))

        with self.beat("call") as b:
            d2 = desc(2, "runs <b>one action</b>",
                      f'caller = the agentId of the token  ({_mono("claude-code-c1e6b7")})')
            self.play(Indicate(cards[2], color=MCP), FadeIn(d2[0], shift=LEFT * 0.1), run_time=b.t(0.35))
            self.play(FadeIn(d2[1]), run_time=b.t(0.35))

        with self.beat("changes") as b:
            d3 = desc(3, "the changes after a <b>cursor</b>")
            self.play(Indicate(cards[3], color=MCP), FadeIn(d3, shift=LEFT * 0.1), run_time=b.t(0.5))
            path_g = VGroup(*cards, *arrs, d0, d1, d2, d3, cc)

        # error card: three parts
        with self.beat("error") as b:
            self.play(FadeOut(path_g), run_time=b.t(0.1))
            hdr = M('Each tool error has <b>three parts</b>', BODY).move_to([0, 2.45, 0])
            hdr.to_edge(LEFT, buff=MARGIN + 0.3)
            keys = [chip(k, MCP, size=LABEL) for k in ("code", "message", "nextStep")]
            ky = [1.55, 0.8, 0.05]
            for k, y in zip(keys, ky):
                k.move_to([0, y, 0]).align_to([_X0 + 0.1, 0, 0], RIGHT if False else LEFT)
            vx = _X0 + 2.6
            v_code = T("timeout", LABEL, ISOLATION, mono=True).move_to([0, ky[0], 0]).align_to([vx, 0, 0], LEFT)
            v_msg = T("what went wrong", LABEL, MUTED).move_to([0, ky[1], 0]).align_to([vx, 0, 0], LEFT)
            v_next = VGroup(*[T(s, LABEL, TEXT) for s in self.NEXT]).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            v_next.align_to([vx, 0, 0], LEFT).align_to(keys[2], UP)
            self.play(FadeIn(hdr), run_time=b.t(0.2))
            self.play(LaggedStart(FadeIn(keys[0]), FadeIn(v_code), FadeIn(keys[1]), FadeIn(v_msg), FadeIn(keys[2]),
                                  lag_ratio=0.3), run_time=b.t(0.55))

        with self.beat("next") as b:
            tells = T("tells the agent what to do", LABEL, MCP).move_to([0, ky[2], 0]).align_to([vx, 0, 0], LEFT)
            self.play(FadeIn(tells), Indicate(keys[2], color=MCP), run_time=b.t(0.5))

        with self.beat("timeout") as b:
            self.play(FadeOut(tells), run_time=b.t(0.08))
            self.play(LaggedStart(*[FadeIn(l, shift=LEFT * 0.1) for l in v_next], lag_ratio=0.35), run_time=b.t(0.4))
            self.play(v_next[2].animate.set_color(MCP), v_next[3].animate.set_color(MCP), run_time=b.t(0.25))
            src = T("the real text, for the code timeout", SMALL, MUTED).next_to(v_next, DOWN, buff=0.2)
            src.align_to(v_next, LEFT)
            self.play(FadeIn(src), run_time=b.t(0.15))
            err_g = VGroup(hdr, *keys, v_code, v_msg, v_next, tells, src)

        with self.beat("codes") as b:
            self.play(FadeOut(err_g), run_time=b.t(0.08))
            cnt = M(f'<b>20 codes</b>, each with its own {_mono("nextStep")}', BODY).move_to([0, 2.45, 0])
            cnt.to_edge(LEFT, buff=MARGIN + 0.3)
            grid = VGroup(*[chip(c, ISOLATION if c == "timeout" else MCP, size=SMALL, fill=0.1) for c in self.CODES])
            grid.arrange_in_grid(rows=7, cols=3, buff=(0.3, 0.14), flow_order="rd", col_alignments="lll")
            grid.next_to(cnt, DOWN, buff=0.3).set_x(0)
            self.play(FadeIn(cnt), run_time=b.t(0.12))
            self.play(LaggedStart(*[FadeIn(c, shift=DOWN * 0.05) for c in grid], lag_ratio=0.18), run_time=b.t(0.7))

        # pushed notices
        with self.beat("nopush") as b:
            self.play(FadeOut(VGroup(cnt, grid)), run_time=b.t(0.15))
            srv = ProcessBox("MCP server", None, MCP, width=3.0, height=3.0).move_to([-4.9, 0.55, 0])
            ag = ProcessBox("Claude Code", "2.1.311", AGENT, width=3.0, height=3.0).move_to([4.9, 0.55, 0])
            pn = T("no pushed news", LABEL, ISOLATION, bold=True).move_to([0, 2.45, 0]).align_to(srv, LEFT)
            self.play(FadeIn(srv), FadeIn(ag), FadeIn(pn), run_time=b.t(0.6))

        notes = [("resources/updated", False), ("logging", False), ("custom notifications", False),
                 ("tools list_changed", True)]
        ny = [1.65, 0.95, 0.25, -0.45]
        x0, x1 = srv.box.get_right()[0], ag.box.get_left()[0]
        with self.beat("check") as b:
            pc = T("project check (standing.checked.mcp_push)", SMALL, MUTED).move_to([0, 2.45, 0])
            pc.align_to(ag, RIGHT)
            self.play(FadeIn(pc), run_time=b.t(0.12))
            drops = []
            for (n, ok), y in zip(notes[:3], ny):
                ar = _arrow([x0, y, 0], [x1, y, 0], MCP, buff=0.1)
                lb = T(n, SMALL, TEXT, mono=True).next_to(ar, UP, buff=0.04)
                self.play(GrowArrow(ar), FadeIn(lb), run_time=b.t(0.13))
                xm = _cross(Square(0.3).move_to([x1 - 0.55, y, 0]))
                self.play(ar.animate.set_color(ISOLATION).set_opacity(0.4), Create(xm), run_time=b.t(0.12))
                drops.append(VGroup(ar, lb, xm))

        with self.beat("except") as b:
            ar = _arrow([x0, ny[3], 0], [x1, ny[3], 0], SOLVED, buff=0.1)
            lb = T("tools list_changed", SMALL, TEXT, mono=True).next_to(ar, UP, buff=0.04)
            self.play(GrowArrow(ar), FadeIn(lb), run_time=b.t(0.4))
            rf = T("refetches the tools", SMALL, SOLVED).next_to(ar, DOWN, buff=0.06)
            self.play(FadeIn(rf), run_time=b.t(0.3))

        with self.beat("pull") as b:
            yb = -2.3
            click = chip("your click", USER, size=LABEL, mono=False).move_to([-4.9, yb, 0])
            feed = chip("change feed", RUNTIME, size=LABEL, mono=False).move_to([-0.6, yb, 0])
            a_c = _arrow(click.get_right(), feed.get_left(), USER)
            pull = labeled_arrow([4.9, yb, 0], feed.get_right(), "widget_changes", color=AGENT, side=UP)
            pull_from = Line(ag.box.get_bottom(), [4.9, yb, 0], color=AGENT, stroke_width=4)
            self.play(FadeIn(click), GrowArrow(a_c), FadeIn(feed), run_time=b.t(0.35))
            self.play(Create(pull_from), GrowArrow(pull.arrow), FadeIn(pull.label), run_time=b.t(0.35))
            only = T("the only way the agent learns", SMALL, AGENT).next_to(pull, DOWN, buff=0.08)
            self.play(FadeIn(only), run_time=b.t(0.2))

        with self.beat("close") as b:
            OutlineDiagram().close_part(self, "mcp_server", next_key="creation", run_time=b.left)
