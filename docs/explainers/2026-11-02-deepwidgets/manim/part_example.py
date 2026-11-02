"""Part `part_example`: the worked example, one real run on a command-line host with no windows.

Scenes, in order: example_intro example_handshake example_gates example_calls example_user_door
example_streams example_crash example_quarantine example_lift.

Every value on screen comes from the run of record (commit 8b9c8672):
/Users/rohanmalik/kyaloon-media/explainer-deepwidgets-2026-11-02/notes/worked-example/run.log
and parse.log. The groceries code is illustrative agent code (notes/worked-example/out/*.index.ts),
labeled as such. Beat weights follow the narration word counts of each sentence group.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content
_X1 = FRAME_W / 2 - MARGIN - 0.25    # right edge of content


def _left(m, x=_X0):
    return m.align_to([x, 0, 0], LEFT)


def _top(m, y):
    return m.align_to([0, y, 0], UP)


def _at(m, x, y):
    """Left edge at x, vertical center at y."""
    m.set_y(y)
    return _left(m, x)


def _arrow(a, b, color=TEXT, sw=3, tip=0.16, buff=0.06):
    return Arrow(a, b, buff=buff, color=color, stroke_width=sw, tip_length=tip,
                 max_tip_length_to_length_ratio=0.3)


def _mono(s, size=SMALL, color=TEXT):
    return T(s, size, color, mono=True)


def _row(*ms, buff=0.3):
    return VGroup(*ms).arrange(RIGHT, buff=buff)


def _code(text, color=MUTED, lang="json"):
    """A code block with every line hidden, ready for reveal_lines."""
    return hide_lines(code_block(text, lang, color=color))


def _check(color=SOLVED, s=0.3):
    m = VMobject(stroke_color=color, stroke_width=5)
    m.set_points_as_corners([[-s / 2, 0, 0], [-s / 6, -s / 2.5, 0], [s / 2, s / 2.5, 0]])
    return m


def _cross(s=0.28, color=ISOLATION):
    return VGroup(Line([-s / 2, s / 2, 0], [s / 2, -s / 2, 0]),
                  Line([-s / 2, -s / 2, 0], [s / 2, s / 2, 0])).set_stroke(color, 5)


def _cross_over(m, color=ISOLATION, sw=4):
    return VGroup(Line(m.get_corner(UL), m.get_corner(DR)), Line(m.get_corner(DL), m.get_corner(UR))
                  ).set_stroke(color, sw)


def _gate_bars(rows, top_y, pitch=0.6, x_bar=-3.4, scale=6.6 / 1600):
    """One row per gate: name, a bar whose length follows the ms, the ms, a check.

    rows: [(gate, ms)]. Each row: VGroup(label, bar, ms text, check). Grow the bar with
    GrowFromEdge(row[1], LEFT).
    """
    out = VGroup()
    for i, (g, ms) in enumerate(rows):
        y = top_y - pitch * i
        lab = _at(T(g, LABEL, TEXT), _X0 + 0.2, y)
        bar = Rectangle(width=max(0.06, ms * scale), height=0.32, stroke_width=0, fill_color=CREATION,
                        fill_opacity=0.85)
        bar.move_to([x_bar, y, 0], aligned_edge=LEFT)
        mt = _mono(f"{ms} ms").next_to(bar, RIGHT, buff=0.2)
        ok = _check().next_to(mt, RIGHT, buff=0.25)
        out.add(VGroup(lab, bar, mt, ok))
    return out


def _grow_bars(bars):
    return LaggedStart(*[AnimationGroup(FadeIn(r[0]), GrowFromEdge(r[1], LEFT), FadeIn(r[2]), Create(r[3]))
                         for r in bars], lag_ratio=0.45)


def _open(scene, b, key, arrows=()):
    OutlineDiagram().open_part(scene, key, arrows=arrows, run_time=b.left)


def _title(scene, b, text, color, frac=0.1):
    t = scene_title(text, color)
    scene.play(FadeIn(t, shift=RIGHT * 0.2), run_time=b.t(frac))
    return t


def _clear(scene, keep, run_time):
    others = [m for m in scene.mobjects if m not in keep and m is not scene.camera.frame]
    if others:
        scene.play(*[FadeOut(m) for m in others], run_time=run_time)


# ====================================================================== example_intro
class ExampleIntro(DWScene):
    BEATS = [("outline", 14), ("commit", 33), ("cli", 30), ("widget", 22), ("code", 18)]

    FACTS = [("code", "commit 8b9c8672 (the run of record)"),
             ("rerun", "commit 108d663f: the same outcomes"),
             ("host", "a command-line host, web profile"),
             ("windows", "none, so the run shows no pixels"),
             ("run time", "16.7 s")]
    SRC = '''ctx.widgets.register({
  slug: 'groceries',
  initialState: { items: [] },
  actions: [
    { name: 'list', kind: 'query', handler: (_args, w) => w.state },
    { name: 'add', kind: 'mutation',
      args: z.object({ text: z.string().min(1).max(80) }),
      handler: ({ text }, w) =>
        w.update((state) => ({ items: [...state.items, { text }] })) },
  ],
})'''

    def construct(self):
        outline = OutlineDiagram()
        with self.beat("outline") as b:
            self.play(FadeIn(outline), run_time=b.t(0.2))
            self.play(outline.highlight(), run_time=b.t(0.2))
            ag = outline.box("agent")
            tok = chip("groceries", AGENT, size=SMALL)
            tokg = VGroup(BackgroundRectangle(tok, color=BG, fill_opacity=1, buff=0.03), tok)
            tokg.move_to([ag.get_x(), 2.1, 0])
            il = T("illustrative code", SMALL, AGENT).next_to(tokg, DOWN, buff=0.1)
            self.play(FadeIn(tokg, shift=DOWN * 0.25), FadeIn(il), run_time=b.t(0.3))

        with self.beat("commit") as b:
            self.play(FadeOut(outline), FadeOut(tokg), FadeOut(il), run_time=b.t(0.1))
            title = _title(self, b, "The worked example: one real run", HOST)
            tbl = RevealTable(["what", "value"], self.FACTS, size=BODY, row_gap=0.24,
                              cell_colors={(0, 1): SOLVED, (1, 1): SOLVED, (4, 1): HOST})
            _top(_left(tbl, _X0 + 0.1), 2.6)
            self.add(tbl)
            self.play(tbl.reveal_row(0), run_time=b.t(0.3))
            self.play(tbl.reveal_row(1), run_time=b.t(0.3))

        with self.beat("cli") as b:
            host = ProcessBox("command-line host", "web profile", HOST, sub_mono=False, title_size=SMALL)
            host.move_to([0, 1.75, 0]).align_to([_X1, 0, 0], RIGHT)
            win = window_card("window", w=2.6, h=1.6).move_to([host.get_x(), -0.55, 0])
            win.set_opacity(0.45)
            no_win = _cross_over(win.frame)
            self.play(tbl.reveal_row(2), FadeIn(host), run_time=b.t(0.25))
            self.play(tbl.reveal_row(3), FadeIn(win), run_time=b.t(0.2))
            self.play(Create(no_win), run_time=b.t(0.1))
            self.play(tbl.reveal_row(4), run_time=b.t(0.15))
            cap = caption("times on screen come from the run of record; three runs took 16.7, 19.2 and "
                          "19.5 s, so the narration rounds", size=24)
            self.play(FadeIn(cap), run_time=b.t(0.15))

        with self.beat("widget") as b:
            self.play(FadeOut(VGroup(tbl, host, win, no_win, cap)), run_time=b.t(0.12))
            slug = chip("groceries", RUNTIME, size=LABEL)
            what = T("a grocery list", LABEL, TEXT)
            ill = chip("illustrative agent code", AGENT, size=SMALL, mono=False, dashed=True)
            fname = T("src/index.ts, an excerpt", SMALL, MUTED)
            head = _at(_row(slug, what, ill, fname), _X0, 2.45)
            self.play(FadeIn(slug), FadeIn(what), run_time=b.t(0.2))
            self.play(FadeIn(ill), FadeIn(fname), run_time=b.t(0.2))
            src = _code(self.SRC, AGENT, "typescript")
            _top(src, 1.95).set_x(0)
            self.add(src)
            self.play(reveal_lines(src, 0, 4, lag=0.3), run_time=b.t(0.4))

        with self.beat("code") as b:
            self.play(reveal_lines(src, 4), run_time=b.t(0.15))
            m_list = mark_line(src, 4, RUNTIME)
            self.play(Create(m_list), run_time=b.t(0.12))
            self.play(reveal_lines(src, 5, 11, lag=0.2), run_time=b.t(0.3))
            m_add = mark_line(src, 6, CREATION)
            cap2 = caption("list: a query.  add: a mutation; its text has 1 to 80 characters")
            self.play(Create(m_add), FadeIn(cap2), run_time=b.t(0.2))


# ====================================================================== example_handshake
class ExampleHandshake(DWScene):
    BEATS = [("open", 7), ("boot", 22), ("post", 11), ("answer", 19), ("hmac", 15), ("tokenfile", 13),
             ("fence", 31)]

    PORT_FILE = '''{
  "port": 53312,
  "nonce": "mf7wks...",
  "pid": 85765,
  "started": 1793606813019
}'''
    TOKEN_ROW = '''{ "sha256OfToken": "10fef3...",
  "agentId": "claude-code-c1e6b7",
  "agent": "Claude Code",
  "issuedAt": "2026-11-02T08:06:54.060Z" }'''

    def construct(self):
        with self.beat("open") as b:
            _open(self, b, "mcp_server", ("arrow_agent", "arrow_mcp"))

        with self.beat("boot") as b:
            title = _title(self, b, "Handshake and fence: real values", MCP)
            boot = _at(_row(chip("host_boot", HOST, size=SMALL), _mono("bootMs 1052   port 53312   pid 85765")),
                       _X0, 2.45)
            self.play(FadeIn(boot), run_time=b.t(0.2))
            pf_l = _at(T("mcp.json, the port file", SMALL, MCP), _X0, 1.85)
            pf = _top(_left(_code(self.PORT_FILE, MCP)), 1.6)
            self.add(pf)
            self.play(FadeIn(pf_l), run_time=b.t(0.1))
            self.play(reveal_lines(pf, 0, 6, lag=0.3), run_time=b.t(0.4))
            cap = caption("the nonce and the token are masked on screen")
            self.play(FadeIn(cap), run_time=b.t(0.1))

        xa, xb = -0.5, _X1
        with self.beat("post") as b:
            ya = 1.45
            post = _arrow([xa, ya, 0], [xb, ya, 0], AGENT)
            post_l = _mono("agent: POST /mcp/token", SMALL, AGENT).next_to(post, UP, buff=0.08).set_x((xa + xb) / 2)
            req = VGroup(_mono("{ agent: 'Claude Code',"), _mono("  challenge: '7vFM_pcU01mzX96pLOmRsQ' }"))
            req.arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            req[1].shift(RIGHT * 0.37)
            _top(_left(req, xa + 0.1), ya - 0.2)
            self.play(GrowArrow(post), FadeIn(post_l), run_time=b.t(0.4))
            self.play(FadeIn(req), run_time=b.t(0.4))

        with self.beat("answer") as b:
            yb = -0.1
            ans = _arrow([xb, yb, 0], [xa, yb, 0], HOST)
            ans_l = _mono("host: the answer", SMALL, HOST).next_to(ans, UP, buff=0.08).set_x((xa + xb) / 2)
            body = VGroup(_mono("{ token: 'HW4a1O...',"), _mono("  agentId: 'claude-code-c1e6b7',"),
                          _mono("  proof: '7e69ce4951628f60...' }"))
            body.arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            body[1:].shift(RIGHT * 0.37)
            _top(_left(body, xa + 0.1), yb - 0.2)
            self.play(GrowArrow(ans), FadeIn(ans_l), run_time=b.t(0.25))
            self.play(LaggedStart(*[FadeIn(x) for x in body], lag_ratio=0.5), run_time=b.t(0.5))

        with self.beat("hmac") as b:
            self.play(FadeOut(cap), Create(mark_line(pf, 2, MCP)), run_time=b.t(0.15))
            hm = _at(_row(_mono("HMAC-SHA256(nonce, challenge)", SMALL, AGENT), _mono("= 7e69ce4951628f60...")),
                     _X0, -1.85)
            self.play(FadeIn(hm, shift=RIGHT * 0.1), run_time=b.t(0.3))
            pr = SurroundingRectangle(body[2], color=SOLVED, buff=0.06, stroke_width=2.5)
            ok = _at(status_chip("proofMatches: true"), _X0, -2.5)
            self.play(Create(pr), FadeIn(ok), run_time=b.t(0.3))

        with self.beat("tokenfile") as b:
            _clear(self, [title], b.t(0.12))
            tk = chip("token  HW4a1O...", MCP, size=LABEL).move_to([-3.2, 2.35, 0])
            card = _top(_left(_code(self.TOKEN_ROW, MCP)), 1.05)
            h = _arrow(tk.get_bottom(), [tk.get_x(), card.get_top()[1], 0], MCP)
            h_l = _mono("sha256", SMALL, MCP).next_to(h, RIGHT, buff=0.15)
            self.play(FadeIn(tk), run_time=b.t(0.15))
            self.play(GrowArrow(h), FadeIn(h_l), run_time=b.t(0.15))
            self.add(card)
            self.play(reveal_lines(card, 0, 4, lag=0.3), run_time=b.t(0.3))
            note = VGroup(T("the token file holds", LABEL, TEXT), T("a hash of the token,", LABEL, MCP),
                          T("not the token", LABEL, MCP)).arrange(DOWN, buff=0.12, aligned_edge=LEFT)
            note.move_to([4.6, 0.2, 0])
            self.play(FadeIn(note), Create(mark_line(card, 0, MCP)), run_time=b.t(0.25))

        with self.beat("fence") as b:
            _clear(self, [title], b.t(0.08))
            fx = 0.6
            fence = DashedLine([fx, 2.45, 0], [fx, -1.1, 0], color=MCP, stroke_width=7, dash_length=0.12)
            f_l = T("the fence", SMALL, MCP).next_to(fence, UP, buff=0.08)
            self.play(Create(fence), FadeIn(f_l), run_time=b.t(0.12))
            r1 = chip("POST /mcp, no token", AGENT, size=SMALL).move_to([-3.4, 1.4, 0])
            a1 = _arrow(r1.get_right(), [fx - 0.08, 1.4, 0], AGENT)
            s1 = _at(T("401", HEADING, ISOLATION, mono=True, bold=True), fx + 0.5, 1.4)
            s1_l = T("no token", SMALL, MUTED).next_to(s1, RIGHT, buff=0.25)
            self.play(FadeIn(r1), GrowArrow(a1), run_time=b.t(0.13))
            self.play(FadeIn(s1), FadeIn(s1_l), Indicate(fence, color=ISOLATION), run_time=b.t(0.15))
            r2 = chip("request with an Origin header", AGENT, size=SMALL, mono=False).move_to([-3.4, -0.2, 0])
            a2 = _arrow(r2.get_right(), [fx - 0.08, -0.2, 0], AGENT)
            s2 = _at(T("403", HEADING, ISOLATION, mono=True, bold=True), fx + 0.5, -0.2)
            s2_l = T("a browser sends Origin", SMALL, MUTED).next_to(s2, RIGHT, buff=0.25)
            self.play(FadeIn(r2), GrowArrow(a2), run_time=b.t(0.13))
            self.play(FadeIn(s2), FadeIn(s2_l), run_time=b.t(0.12))
            err = _mono("{ error: 'browser requests are refused' }", SMALL, ISOLATION).move_to([0, -1.75, 0])
            self.play(FadeIn(err, shift=UP * 0.1), run_time=b.t(0.12))
            cap = caption("the fence refuses browser requests")
            self.play(FadeIn(cap), run_time=b.t(0.1))


# ====================================================================== example_gates
class ExampleGates(DWScene):
    BEATS = [("open", 7), ("list", 18), ("raw", 13), ("refused", 10), ("diag", 18), ("fixed", 11),
             ("bars", 20), ("total", 14), ("warn", 17)]

    RAW = '''13  export function apply(ctx: WidgetContext): void {
14    setTimeout(() => { ctx.logger.info('tidy') }, 1000)
15    ctx.widgets.register({'''

    def construct(self):
        with self.beat("open") as b:
            _open(self, b, "creation", ("arrow_creation",))

        with self.beat("list") as b:
            title = _title(self, b, "The gates: two installs, real results", CREATION, frac=0.15)
            lst = _at(_row(chip("widget_list", MCP, size=SMALL),
                           _mono("{ cursor: 'f6967379:1', widgets: [ sample ] }")), _X0, 2.45)
            self.play(FadeIn(lst[0]), run_time=b.t(0.2))
            self.play(FadeIn(lst[1], shift=RIGHT * 0.1), run_time=b.t(0.3))

        with self.beat("raw") as b:
            lab = _at(_row(T("install 1: a raw setTimeout in apply", SMALL, AGENT),
                           chip("illustrative", AGENT, size=SMALL, mono=False, dashed=True)), _X0, 1.8)
            src = _top(_left(_code(self.RAW, AGENT, "typescript")), 1.45)
            self.add(src)
            self.play(FadeIn(lab), run_time=b.t(0.2))
            self.play(reveal_lines(src, 0, 3, lag=0.4), run_time=b.t(0.4))
            m = mark_line(src, 1, ISOLATION)
            self.play(Create(m), run_time=b.t(0.2))

        with self.beat("refused") as b:
            y = -0.75
            lint = chip("lint", ISOLATION, size=LABEL, mono=False)
            x = _cross(0.24).next_to(lint, RIGHT, buff=0.15)
            res = _row(chip("widget_install", CREATION, size=SMALL), T("→", LABEL, MUTED),
                       chip("gate-failed", ISOLATION, size=SMALL), T("gate", SMALL, MUTED), VGroup(lint, x),
                       _mono("349 ms", SMALL, TEXT), buff=0.25)
            _at(res, _X0, y)
            self.play(FadeIn(res[0:3]), run_time=b.t(0.4))
            self.play(FadeIn(res[3:]), run_time=b.t(0.4))

        with self.beat("diag") as b:
            diag = VGroup(_mono("src/index.ts:14:3: Unexpected use of 'setTimeout'.", SMALL, ISOLATION),
                          _mono("a raw setTimeout is not owned by the widget, so it runs on"),
                          _mono("after the widget stops. Use ctx.timeout(callback, ms).")
                          ).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            _top(_left(diag, _X0 + 0.2), -1.25)
            self.play(FadeIn(diag[0]), run_time=b.t(0.3))
            self.play(FadeIn(diag[1:]), run_time=b.t(0.3))
            fix = SurroundingRectangle(diag[2][-27:], color=SOLVED, buff=0.05, stroke_width=2.5)
            self.play(Create(fix), run_time=b.t(0.2))

        with self.beat("fixed") as b:
            self.play(FadeOut(VGroup(lab, src, m, res, diag, fix)), run_time=b.t(0.2))
            lab2 = _at(T("install 2: the fixed version", LABEL, CREATION, bold=True), _X0, 1.6)
            self.play(FadeIn(lab2), run_time=b.t(0.3))
            three = T("three gates", SMALL, MUTED).next_to(lab2, RIGHT, buff=0.4)
            self.play(FadeIn(three), run_time=b.t(0.2))

        with self.beat("bars") as b:
            bars = _gate_bars([("compile", 34), ("lint", 263), ("test run", 1579)], 0.85)
            self.play(_grow_bars(bars), run_time=b.t(0.6))
            both = T("compile + lint: 297 ms", SMALL, MUTED).next_to(bars[1][3], RIGHT, buff=0.5)
            self.play(FadeIn(both), run_time=b.t(0.2))

        with self.beat("total") as b:
            tot = _at(_row(T("the whole install", LABEL, TEXT), _mono("3233 ms", LABEL),
                           status_chip("application: 'applied'"), buff=0.4), _X0 + 0.2, -1.2)
            self.play(FadeIn(tot[0:2]), run_time=b.t(0.35))
            self.play(FadeIn(tot[2], scale=1.1), run_time=b.t(0.3))

        with self.beat("warn") as b:
            w1 = T("the test run also gave a warning:", SMALL, CREATION)
            w2 = T("“action add: its args schema refuses {}, so the test run did not call it”", SMALL, TEXT)
            warn = _top(_left(VGroup(w1, w2).arrange(DOWN, buff=0.1, aligned_edge=LEFT), _X0 + 0.2), -1.85)
            self.play(FadeIn(w1), run_time=b.t(0.25))
            self.play(FadeIn(w2), run_time=b.t(0.3))
            self.play(Indicate(bars[2][1], color=CREATION, scale_factor=1.04), run_time=b.t(0.25))


# ====================================================================== example_calls
class ExampleCalls(DWScene):
    BEATS = [("open", 7), ("list", 7), ("add", 21), ("timeouts", 5), ("milk", 32), ("again", 21),
             ("bread", 14), ("empty", 14), ("next", 6)]

    DESCRIBE = '''{ "name": "list", "kind": "query", "args": null, "timeoutMs": 5000 }
{ "name": "add", "kind": "mutation", "timeoutMs": 5000,
  "args": { "text": { "type": "string",
                      "minLength": 1, "maxLength": 80 } } }'''

    def construct(self):
        with self.beat("open") as b:
            _open(self, b, "ctx_widgets", ("arrow_agent", "arrow_mcp"))

        with self.beat("list") as b:
            title = _title(self, b, "Calls through the agent door", RUNTIME, frac=0.2)
            head = _at(_row(chip("widget_describe", MCP, size=SMALL), _mono("groceries: the actions")), _X0, 2.45)
            desc = _top(_left(_code(self.DESCRIBE, RUNTIME)), 2.0)
            self.add(desc)
            self.play(FadeIn(head), run_time=b.t(0.3))
            self.play(reveal_lines(desc, 0), run_time=b.t(0.4))

        with self.beat("add") as b:
            self.play(reveal_lines(desc, 1, 4, lag=0.4), run_time=b.t(0.5))
            mk = SurroundingRectangle(VGroup(desc.code_lines[2], desc.code_lines[3]), color=CREATION, buff=0.06,
                                      stroke_width=2.5, corner_radius=0.05)
            note = T("text: 1 to 80 characters", LABEL, CREATION).next_to(desc, DOWN, buff=0.25)
            _left(note, _X0 + 0.2)
            self.play(Create(mk), FadeIn(note), run_time=b.t(0.35))

        with self.beat("timeouts") as b:
            to = chip("timeoutMs 5000: 5 s each", RUNTIME, size=SMALL).next_to(note, RIGHT, buff=0.6)
            self.play(FadeIn(to, shift=LEFT * 0.1), run_time=b.t(0.5))

        xr, xa, xs = _X0, -2.4, -1.7      # request, arrow, answer columns
        ys = [1.85, 1.0, 0.15, -0.95]

        def req(text, y, color=AGENT):
            m = _at(_mono(text, SMALL, color), xr, y)
            a = _arrow([xa, y, 0], [xs - 0.1, y, 0], MUTED, sw=2.5)
            return VGroup(m, a)

        with self.beat("milk") as b:
            self.play(FadeOut(VGroup(head, desc, mk, note, to)), run_time=b.t(0.1))
            h2 = _at(_row(chip("widget_call", MCP, size=SMALL), _mono("groceries, action add")), _X0, 2.55)
            self.play(FadeIn(h2), run_time=b.t(0.1))
            q0 = req("{text:'milk'} r-1", ys[0])
            self.play(FadeIn(q0[0]), GrowArrow(q0[1]), run_time=b.t(0.25))
            ans0 = _at(_row(_mono("{ items: [ milk ] }, rev: 1", SMALL, RUNTIME), _mono("35 ms", SMALL, MUTED)), xs, ys[0])
            self.play(FadeIn(ans0, shift=RIGHT * 0.1), run_time=b.t(0.3))
            cap = caption("r-1: the requestId, a name for one operation")
            self.play(FadeIn(cap), run_time=b.t(0.12))

        with self.beat("again") as b:
            q1 = req("{text:'milk'} r-1", ys[1])
            self.play(FadeIn(q1[0]), GrowArrow(q1[1]), run_time=b.t(0.25))
            ans1 = _at(_row(_mono("same answer, rev: 1,", SMALL, RUNTIME), _mono("replayed: true", SMALL, SOLVED),
                            _mono("7 ms", SMALL, MUTED)), xs, ys[1])
            self.play(FadeIn(ans1, shift=RIGHT * 0.1), run_time=b.t(0.35))
            cap2 = caption("nothing ran twice")
            self.play(FadeOut(cap), FadeIn(cap2), run_time=b.t(0.2))

        with self.beat("bread") as b:
            q2 = req("{text:'bread'} r-1", ys[2])
            self.play(FadeIn(q2[0]), GrowArrow(q2[1]), FadeOut(cap2), run_time=b.t(0.35))
            ans2 = _at(chip("idempotency-conflict", ISOLATION, size=SMALL), xs, ys[2])
            self.play(FadeIn(ans2, shift=RIGHT * 0.1), run_time=b.t(0.35))

        with self.beat("empty") as b:
            q3 = req("{text:''}", ys[3])
            self.play(FadeIn(q3[0]), GrowArrow(q3[1]), run_time=b.t(0.25))
            ans3 = _at(chip("invalid-args", ISOLATION, size=SMALL), xs, ys[3])
            msg = _at(T("✖ Too small: expected string to have >=1 characters", SMALL, TEXT), xs, ys[3] - 0.45)
            self.play(FadeIn(ans3, shift=RIGHT * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(msg), run_time=b.t(0.3))

        with self.beat("next") as b:
            n2 = T("next step: Use a new requestId for a new operation.", SMALL, MUTED)
            _at(n2, xs, ys[2] - 0.45)
            n3 = VGroup(T("next step: Fix args to match the action args schema", SMALL, MUTED),
                        T("from widget_describe, then retry.", SMALL, MUTED)).arrange(DOWN, buff=0.08, aligned_edge=LEFT)
            _top(_left(n3, xs), msg.get_bottom()[1] - 0.15)
            self.play(FadeIn(n2), FadeIn(n3), run_time=b.t(0.6))


# ====================================================================== example_user_door
class ExampleUserDoor(DWScene):
    BEATS = [("open", 7), ("post", 27), ("answer", 15), ("program", 10), ("nocookie", 10), ("parser", 23),
             ("typo", 11)]

    PROGRAM = '''root = Card([CardHeader("Groceries", "A shared list"),
  Row([Input("item", "Add an item", $item),
       Button("Add", Action([@Run(add), @Run(list), @Reset($item)]))]),
  List(@Each(list.items, "it", TextContent(it.text)))])
$item = ""
list = Query("list", {}, {items: []})
add = Mutation("add", {text: $item})'''
    PARSED = '''{ "catalog": "shadcn-widgets@1", "root": "Card",
  "statementCount": 4,
  "queries": [ { "id": "list", "tool": "list" } ],
  "mutations": [ "add" ], "errors": [] }'''

    def construct(self):
        with self.beat("open") as b:
            _open(self, b, "shell_page", ("arrow_shell",))

        with self.beat("post") as b:
            title = _title(self, b, "The user door: the same call over HTTP", SHELL)
            click = _at(_row(chip("a click in the shell", USER, size=SMALL, mono=False),
                             T("sends this request", SMALL, MUTED)), _X0, 2.45)
            self.play(FadeIn(click), run_time=b.t(0.2))
            r1 = _row(_mono("POST /api/widgets/groceries/call", SMALL, SHELL), chip("host cookie", SHELL, size=SMALL,
                                                                                   mono=False))
            r2 = _mono("{ action: 'add', args: { text: 'eggs' } }")
            reqg = _top(_left(VGroup(r1, r2).arrange(DOWN, buff=0.15, aligned_edge=LEFT), _X0 + 0.2), 1.75)
            self.play(FadeIn(r1), run_time=b.t(0.3))
            self.play(FadeIn(r2), run_time=b.t(0.25))

        with self.beat("answer") as b:
            ans = _at(_row(_mono("200", SMALL, SOLVED),
                           _mono("{ ok: true, result: { items: [milk, eggs] }, rev: 2 }", SMALL, RUNTIME),
                           _mono("12 ms", SMALL, MUTED)), _X0 + 0.2, -0.45)
            arr = _arrow([_X0 + 0.5, r2.get_bottom()[1] - 0.05, 0], [_X0 + 0.5, ans.get_top()[1] + 0.05, 0], SHELL)
            self.play(GrowArrow(arr), run_time=b.t(0.25))
            self.play(FadeIn(ans, shift=DOWN * 0.1), run_time=b.t(0.45))
            door1 = VGroup(click, reqg, ans, arr)

        with self.beat("program") as b:
            self.play(FadeOut(door1), run_time=b.t(0.15))
            g = _at(_row(_mono("GET /api/widgets/groceries/program", SMALL, SHELL), _mono("200, rev 1", SMALL, SOLVED)),
                    _X0, 2.45)
            self.play(FadeIn(g), run_time=b.t(0.25))
            prog = _top(_left(_code(self.PROGRAM, SHELL, "text")), 2.05)
            self.add(prog)
            self.play(reveal_lines(prog, 0, 7, lag=0.25), run_time=b.t(0.5))

        with self.beat("nocookie") as b:
            nc = _at(_row(T("the same route without the cookie", SMALL, TEXT), _mono("401", LABEL, ISOLATION)),
                     _X0, -1.85)
            self.play(FadeIn(nc), run_time=b.t(0.4))
            wrap = T("program text wrapped for the screen", SMALL, MUTED).next_to(prog, RIGHT, buff=0.2)
            wrap.align_to(prog, DOWN)
            if wrap.get_right()[0] > _X1:
                wrap.next_to(nc, RIGHT, buff=0.8)
            self.play(FadeIn(wrap), run_time=b.t(0.2))

        with self.beat("parser") as b:
            self.play(FadeOut(VGroup(g, prog, nc, wrap)), run_time=b.t(0.1))
            ph = _at(_row(chip("the real OpenUI parser", SHELL, size=SMALL, mono=False),
                          _mono("lang-core createParser + shadcn-widgets@1")), _X0, 2.45)
            self.play(FadeIn(ph), run_time=b.t(0.2))
            parsed = _top(_left(_code(self.PARSED, SHELL)), 1.95)
            self.add(parsed)
            self.play(reveal_lines(parsed, 0, 4, lag=0.4), run_time=b.t(0.45))
            ok = status_chip("4 statements, 1 query, 1 mutation, 0 errors").next_to(parsed, DOWN, buff=0.2)
            _left(ok, _X0 + 0.2)
            self.play(FadeIn(ok), run_time=b.t(0.2))

        with self.beat("typo") as b:
            ty = _at(_row(T("typo:", SMALL, MUTED), _mono('root = Card([Stat("Count", s.count), Buton("Add 1")])')),
                     _X0 + 0.2, -1.55)
            self.play(FadeIn(ty), run_time=b.t(0.3))
            er = _at(_mono('Unknown component "Buton" — not found in catalog', SMALL, ISOLATION), _X0 + 0.2, -2.1)
            self.play(FadeIn(er, shift=UP * 0.1), run_time=b.t(0.35))


# ====================================================================== example_streams
class ExampleStreams(DWScene):
    BEATS = [("title", 9), ("hello", 10), ("rev1", 10), ("rev2", 9), ("windows", 13), ("changes", 14),
             ("c1", 8), ("c2", 18), ("c3", 11), ("saw", 6)]

    FRAMES = [("4733 ms", "retry: 1000"), ("4733 ms", 'data: {"type":"hello","rev":0,"programRev":1}'),
              ("5053 ms", 'data: {"type":"data","rev":1}'), ("5096 ms", 'data: {"type":"data","rev":2}')]
    CHANGES = [("2", "added", "host", "-"), ("3", "state", "claude-code-c1e6b7", "1"), ("4", "state", "user", "2")]

    def construct(self):
        with self.beat("title") as b:
            title = _title(self, b, "The stream and the change feed", RUNTIME, frac=0.25)
            sh = _at(_row(_mono("GET /api/widgets/groceries/stream", SMALL, RUNTIME),
                          T("frames as they came, with the time in the run", SMALL, MUTED)), _X0, 2.45)
            self.play(FadeIn(sh), run_time=b.t(0.35))

        fl = []
        for i, (t, raw) in enumerate(self.FRAMES):
            r = _row(_mono(t, SMALL, MUTED), _mono(raw, SMALL, TEXT), buff=0.4)
            fl.append(_at(r, _X0, 1.8 - 0.42 * i))

        with self.beat("hello") as b:
            self.play(FadeIn(fl[0]), run_time=b.t(0.3))
            self.play(FadeIn(fl[1]), run_time=b.t(0.35))

        with self.beat("rev1") as b:
            tag1 = T("← after the agent call", SMALL, AGENT).next_to(fl[2], RIGHT, buff=0.4)
            self.play(FadeIn(fl[2]), run_time=b.t(0.35))
            self.play(FadeIn(tag1), run_time=b.t(0.3))

        with self.beat("rev2") as b:
            tag2 = T("← after the click", SMALL, USER).next_to(fl[3], RIGHT, buff=0.4)
            tag2.align_to(tag1, LEFT)
            self.play(FadeIn(fl[3]), run_time=b.t(0.35))
            self.play(FadeIn(tag2), run_time=b.t(0.3))

        with self.beat("windows") as b:
            wins = VGroup()
            for x in (1.6, 4.6):
                w = window_card("groceries", w=2.7, h=1.45, color=SHELL)
                w.move_to([x, -1.15, 0])
                q = chip("list: runs again", RUNTIME, size=SMALL, mono=False)
                bar_y = w.frame.get_top()[1] - 0.42
                q.move_to([w.frame.get_x(), (bar_y + w.frame.get_bottom()[1]) / 2, 0])
                wins.add(VGroup(w, q))
            wn = VGroup(T("each data frame:", LABEL, TEXT), T("each window of groceries", LABEL, SHELL),
                        T("runs its queries again", LABEL, SHELL),
                        T("(this run has no windows)", SMALL, MUTED)).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            _top(_left(wn, _X0), -0.35)
            self.play(FadeIn(wn), FadeIn(wins), run_time=b.t(0.3))
            dots = [Dot(fl[3][1].get_right(), radius=0.08, color=RUNTIME) for _ in wins]
            self.play(*[d.animate.move_to(w[0].frame.get_top()) for d, w in zip(dots, wins)], run_time=b.t(0.25))
            self.play(*[FadeOut(d) for d in dots], *[Indicate(w[1], color=RUNTIME) for w in wins],
                      run_time=b.t(0.25))

        with self.beat("changes") as b:
            self.play(FadeOut(VGroup(wins, wn)), run_time=b.t(0.15))
            ch = _at(_row(chip("widget_changes", MCP, size=SMALL), _mono("since f6967379:1"),
                          T("→", LABEL, MUTED), _mono("new cursor f6967379:4", SMALL, MCP)), _X0, -0.2)
            self.play(FadeIn(ch), run_time=b.t(0.35))
            tbl = RevealTable(["seq", "kind", "by", "rev"], self.CHANGES, mono_cols=[0, 1, 2, 3], size=SMALL,
                              row_gap=0.14, cell_colors={(0, 2): HOST, (1, 2): AGENT, (2, 2): USER})
            _top(_left(tbl, _X0 + 0.3), -0.65)
            self.add(tbl)
            three = T("3 changes", LABEL, TEXT).move_to([3.6, -1.4, 0])
            self.play(FadeIn(three), run_time=b.t(0.2))

        with self.beat("c1") as b:
            self.play(tbl.reveal_row(0), run_time=b.t(0.5))

        with self.beat("c2") as b:
            self.play(tbl.reveal_row(1), run_time=b.t(0.4))

        with self.beat("c3") as b:
            self.play(tbl.reveal_row(2), run_time=b.t(0.4))

        with self.beat("saw") as b:
            cap = caption("the agent saw your click")
            self.play(Create(tbl.mark_row(2, USER)), FadeIn(cap), run_time=b.t(0.6))


# ====================================================================== example_crash
class ExampleCrash(DWScene):
    BEATS = [("open", 9), ("install", 6), ("interval", 13), ("throws", 6), ("cordis", 12), ("testwin", 15),
             ("passed", 9), ("exit", 10), ("printed", 16), ("record", 15), ("error", 11), ("method", 4),
             ("hash", 19)]

    BUGGY = '''export function apply(ctx: WidgetContext): void {
  let saved = ''
  ctx.interval(() => {
    const list = JSON.parse(saved) as State
    saved = JSON.stringify(list)
  }, 3000)
  ctx.widgets.register({ ... })'''
    CRASH = '''{
  "row": "include:deepwidgets-widget-groceries",
  "slugs": [ "groceries" ],
  "error": { "name": "SyntaxError",
             "message": "Unexpected end of JSON input" },
  "event": "uncaughtException",
  "method": "store",
  "root": ".../deepwidgets-widgets/groceries",
  "hash": "303b082bf922a622...",
  "pid": 85765,
  "applied": false
}'''

    def construct(self):
        with self.beat("open") as b:
            _open(self, b, "isolation", ("link_isolation",))

        with self.beat("install") as b:
            title = _title(self, b, "A bug that the gates cannot see", ISOLATION, frac=0.25)
            lab = _at(_row(T("install 3: the buggy version", SMALL, AGENT),
                           chip("illustrative bug", AGENT, size=SMALL, mono=False, dashed=True)), _X0, 2.45)
            self.play(FadeIn(lab), run_time=b.t(0.4))

        src = _top(_left(_code(self.BUGGY, AGENT, "typescript")), 2.1)
        rx = src.get_right()[0] + 0.35
        with self.beat("interval") as b:
            self.add(src)
            self.play(reveal_lines(src, 0, 1), run_time=b.t(0.15))
            self.play(reveal_lines(src, 1, 6, lag=0.3), run_time=b.t(0.45))
            self.play(reveal_lines(src, 6, 7), run_time=b.t(0.1))
            every = _at(_mono("every 3000 ms", SMALL, AGENT), rx, src.code_lines[5].get_y())
            self.play(FadeIn(every), run_time=b.t(0.15))

        with self.beat("throws") as b:
            m = mark_line(src, 3, ISOLATION)
            th = VGroup(_mono("JSON.parse('')", SMALL, ISOLATION), T("throws SyntaxError", SMALL, ISOLATION))
            th.arrange(DOWN, buff=0.08, aligned_edge=LEFT)
            _at(th, rx, src.code_lines[3].get_y())
            self.play(Create(m), FadeIn(th), run_time=b.t(0.6))

        with self.beat("cordis") as b:
            m2 = mark_line(src, 2, CREATION)
            ct = VGroup(T("ctx.interval: a Cordis timer,", SMALL, CREATION), T("so lint allows it", SMALL, CREATION))
            ct.arrange(DOWN, buff=0.08, aligned_edge=LEFT)
            _at(ct, rx, src.code_lines[1].get_y() + 0.25)
            self.play(Create(m2), FadeIn(ct), run_time=b.t(0.5))

        with self.beat("testwin") as b:
            y = -1.75
            x0, k = _X0 + 0.4, 2.0          # 2 units for each second
            ax = Line([x0, y, 0], [x0 + 4.2 * k, y, 0], color=MUTED, stroke_width=2.5)
            ticks = VGroup(*[VGroup(Line([x0 + s * k, y - 0.08, 0], [x0 + s * k, y + 0.08, 0], color=MUTED,
                                         stroke_width=2.5),
                                    _mono(f"{s} s", SMALL, MUTED).move_to([x0 + s * k, y - 0.35, 0]))
                             for s in range(5)])
            win = Rectangle(width=1.5 * k, height=0.45, stroke_color=CREATION, stroke_width=2, fill_color=CREATION,
                            fill_opacity=0.3).move_to([x0 + 0.75 * k, y + 0.3, 0])
            win_l = T("test run: 1.5 s", SMALL, CREATION).move_to(win)
            fire = burst(ISOLATION, 0.2).move_to([x0 + 3 * k, y + 0.3, 0])
            fire_l = T("first timer: 3 s", SMALL, ISOLATION).next_to(fire, RIGHT, buff=0.2)
            self.play(Create(ax), FadeIn(ticks), run_time=b.t(0.2))
            self.play(GrowFromEdge(win, LEFT), FadeIn(win_l), run_time=b.t(0.3))
            self.play(FadeIn(fire, scale=1.3), FadeIn(fire_l), run_time=b.t(0.25))

        with self.beat("passed") as b:
            gx = rx + 0.1
            gates = VGroup(*[_row(_check(s=0.24), _mono(f"{g} {ms} ms", SMALL, TEXT), buff=0.15)
                             for g, ms in (("compile", 29), ("lint", 162), ("test", 1578))])
            gates.arrange(DOWN, buff=0.12, aligned_edge=LEFT)
            ap = status_chip("applied")
            gg = VGroup(gates, ap).arrange(DOWN, buff=0.18, aligned_edge=LEFT)
            _top(_left(gg, gx), -0.25)
            self.play(LaggedStart(*[FadeIn(g) for g in gates], lag_ratio=0.4), run_time=b.t(0.45))
            self.play(FadeIn(ap, scale=1.1), run_time=b.t(0.25))

        with self.beat("exit") as b:
            _clear(self, [title], b.t(0.15))
            host = ProcessBox("host", "pid 85765", HOST, width=3.0, height=1.25).move_to([-4.6, 1.7, 0])
            self.add(host)
            bx = burst(ISOLATION, 0.32).move_to(host.get_corner(UR))
            code = chip("exit code 1", ISOLATION, size=LABEL)
            after = T("3004 ms after the install answer", LABEL, TEXT)
            ex = _at(VGroup(code, after).arrange(DOWN, buff=0.15, aligned_edge=LEFT), -2.4, 1.7)
            self.play(FadeIn(bx, scale=1.4), host.box.animate.set_stroke(ISOLATION), run_time=b.t(0.3))
            self.play(FadeIn(ex), run_time=b.t(0.35))

        with self.beat("printed") as b:
            se = T("stderr of the host", SMALL, MUTED)
            l1 = _mono("deepwidgets: uncaughtException blamed on", SMALL, ISOLATION)
            l2 = _mono("include:deepwidgets-widget-groceries (store); the host exits now", SMALL, ISOLATION)
            txt = VGroup(l1, l2).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            panel = rbox(txt.width + 0.6, txt.height + 0.5, ISOLATION, fill=0.06, sw=2).move_to(txt)
            g = VGroup(panel, txt)
            _top(_left(g, _X0), -0.15)
            se.next_to(panel, UP, buff=0.1).align_to(panel, LEFT)
            self.play(FadeIn(se), FadeIn(panel), run_time=b.t(0.2))
            self.play(FadeIn(l1), run_time=b.t(0.3))
            self.play(FadeIn(l2), run_time=b.t(0.35))

        with self.beat("record") as b:
            _clear(self, [title], b.t(0.12))
            cr = _top(_left(_code(self.CRASH, ISOLATION)), 2.85)
            cl = VGroup(_mono("crash.json", LABEL, ISOLATION), T("the crash record", SMALL, MUTED))
            cl.arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            _top(_left(cl, cr.get_right()[0] + 0.3), 2.8)
            self.add(cr)
            self.play(FadeIn(cl), reveal_lines(cr, 0, 1), reveal_lines(cr, 11, 12), run_time=b.t(0.2))
            self.play(reveal_lines(cr, 1, 3, lag=0.4), run_time=b.t(0.35))
            self.play(Create(mark_line(cr, 1, ISOLATION)), run_time=b.t(0.2))

        with self.beat("error") as b:
            self.play(reveal_lines(cr, 3, 5, lag=0.4), run_time=b.t(0.45))
            self.play(Create(SurroundingRectangle(VGroup(cr.code_lines[3], cr.code_lines[4]), color=ISOLATION,
                                                  buff=0.05, stroke_width=2.5)), run_time=b.t(0.3))

        with self.beat("method") as b:
            self.play(reveal_lines(cr, 5, 7, lag=0.4), run_time=b.t(0.5))
            self.play(Create(mark_line(cr, 6, ISOLATION)), run_time=b.t(0.3))

        with self.beat("hash") as b:
            self.play(reveal_lines(cr, 7, 8), run_time=b.t(0.15))
            pk = T("root: the package folder of the widget", SMALL, MUTED)
            _top(_left(pk, _X0 + 0.2), cr.get_bottom()[1] - 0.12)
            self.play(FadeIn(pk), run_time=b.t(0.12))
            self.play(reveal_lines(cr, 8, 9), run_time=b.t(0.15))
            self.play(Create(mark_line(cr, 8, ISOLATION)), run_time=b.t(0.15))
            self.play(reveal_lines(cr, 9, 11, lag=0.4), run_time=b.t(0.2))


# ====================================================================== example_quarantine
class ExampleQuarantine(DWScene):
    BEATS = [("restart", 25), ("boot", 9), ("oldtoken", 14), ("applied", 9), ("qfile", 14), ("list", 11),
             ("rev", 5), ("call", 15), ("program", 7), ("hello", 8), ("sample", 13)]

    QFILE = '''[ { "row": "include:deepwidgets-widget-groceries",
    "slugs": [ "groceries" ],
    "reason": "quarantined after a crash (...)",
    "hash": "303b082bf922a622..." } ]'''

    def construct(self):
        with self.beat("restart") as b:
            title = _title(self, b, "After the restart: quarantine", ISOLATION)
            who = _at(chip("the script restarts the host (in the app: the supervisor)", OPEN, size=SMALL, mono=False,
                           dashed=True), _X0, 2.45)
            self.play(FadeIn(who), run_time=b.t(0.2))
            old = ProcessBox("old host", "pid 85765", HOST, width=3.0, height=1.2).move_to([-5.0, 1.25, 0])
            old.set_opacity(0.35)
            oldx = _cross_over(old.box)
            new = ProcessBox("new host", "pid 85828", HOST, width=3.0, height=1.2).move_to([-1.1, 1.25, 0])
            ar = _arrow(old.get_right(), new.get_left(), MUTED)
            self.play(FadeIn(old), Create(oldx), run_time=b.t(0.25))
            self.play(GrowArrow(ar), FadeIn(new, shift=RIGHT * 0.2), run_time=b.t(0.3))

        with self.beat("boot") as b:
            bt = _mono("bootMs 862", SMALL, HOST).next_to(new, DOWN, buff=0.12)
            self.play(FadeIn(bt), run_time=b.t(0.5))

        with self.beat("oldtoken") as b:
            ot = _row(chip("old token", MCP, size=SMALL, mono=False), T("→", LABEL, MUTED),
                      _mono("401", LABEL, ISOLATION))
            nh = _row(chip("new handshake", MCP, size=SMALL, mono=False), _check(s=0.26))
            tg = VGroup(ot, nh).arrange(DOWN, buff=0.25, aligned_edge=LEFT)
            _at(tg, 1.2, 1.25)
            self.play(FadeIn(ot), run_time=b.t(0.4))
            self.play(FadeIn(nh), run_time=b.t(0.35))

        with self.beat("applied") as b:
            ap = _at(_row(_mono("crash.json", SMALL, ISOLATION), _mono("applied: false", SMALL, MUTED),
                          T("→", LABEL, MUTED), _mono("applied: true", SMALL, SOLVED)), _X0, -0.05)
            self.play(FadeIn(ap[0:2]), run_time=b.t(0.3))
            self.play(FadeIn(ap[2:]), run_time=b.t(0.35))

        with self.beat("qfile") as b:
            ql = _at(_mono("quarantine.json", SMALL, ISOLATION), _X0, -0.65)
            qf = _top(_left(_code(self.QFILE, ISOLATION)), -0.9)
            self.add(qf)
            self.play(FadeIn(ql), run_time=b.t(0.15))
            self.play(reveal_lines(qf, 0, 4, lag=0.3), run_time=b.t(0.45))
            self.play(Create(mark_line(qf, 2, ISOLATION)), run_time=b.t(0.2))

        with self.beat("list") as b:
            _clear(self, [title], b.t(0.12))
            wl = _at(_row(chip("widget_list", MCP, size=SMALL), _mono("groceries", SMALL, RUNTIME),
                          _mono("rev 2", SMALL, TEXT)), _X0, 2.45)
            fl = VGroup(_mono("failed: quarantined after a crash (uncaughtException,", SMALL, ISOLATION),
                        _mono("        blamed by store): Unexpected end of JSON input", SMALL, ISOLATION))
            fl.arrange(DOWN, buff=0.08, aligned_edge=LEFT)
            _top(_left(fl, _X0 + 0.3), 2.05)
            self.play(FadeIn(wl), run_time=b.t(0.3))
            self.play(FadeIn(fl), run_time=b.t(0.4))

        with self.beat("rev") as b:
            kept = T("the state stays", SMALL, MUTED).next_to(wl, RIGHT, buff=0.35)
            self.play(Indicate(wl[2], color=RUNTIME), FadeIn(kept), run_time=b.t(0.6))

        with self.beat("call") as b:
            cl = _at(_row(chip("widget_call", MCP, size=SMALL), chip("widget-failed", ISOLATION, size=SMALL)),
                     _X0, 0.95)
            ns = VGroup(T("next step: The widget crashed the host and is quarantined. Do not retry.", SMALL, MUTED),
                        T("Change its files to bring it back, or tell the user the message.", SMALL, MUTED))
            ns.arrange(DOWN, buff=0.08, aligned_edge=LEFT)
            _top(_left(ns, _X0 + 0.3), 0.6)
            self.play(FadeIn(cl), run_time=b.t(0.3))
            self.play(FadeIn(ns), run_time=b.t(0.4))

        with self.beat("program") as b:
            pg = _at(_row(_mono("GET /api/widgets/groceries/program", SMALL, SHELL), _mono("503", LABEL, ISOLATION)),
                     _X0, -0.4)
            self.play(FadeIn(pg), run_time=b.t(0.6))

        with self.beat("hello") as b:
            he = _at(_row(_mono("stream hello", SMALL, RUNTIME), _mono('{"type":"hello","rev":2,"programRev":-1}')),
                     _X0, -1.1)
            self.play(FadeIn(he), run_time=b.t(0.6))

        with self.beat("sample") as b:
            sm = _at(_row(chip("sample", RUNTIME, size=SMALL), _mono("get → { count: 0 }"), _mono("6 ms", SMALL, MUTED),
                          status_chip("still live")), _X0, -2.0)
            self.play(FadeIn(sm[0]), run_time=b.t(0.25))
            self.play(FadeIn(sm[1:]), run_time=b.t(0.4))


# ====================================================================== example_lift
class ExampleLift(DWScene):
    BEATS = [("install", 20), ("hash", 13), ("empty", 7), ("list", 16), ("outline", 12)]

    ORDER = ["mcp_server", "creation", "ctx_widgets", "shell_page", "bundle_groceries", "isolation"]

    def construct(self):
        with self.beat("install") as b:
            title = _title(self, b, "Reinstall: the quarantine lifts", CREATION)
            lab = _at(T("install 4: the fixed version again", LABEL, CREATION, bold=True), _X0, 2.45)
            self.play(FadeIn(lab), run_time=b.t(0.1))
            bars = _gate_bars([("compile", 35), ("lint", 174), ("test run", 1583)], 1.8, pitch=0.5)
            self.play(_grow_bars(bars), run_time=b.t(0.45))
            tot = _at(_row(T("the whole install", LABEL, TEXT), _mono("3555 ms", LABEL), status_chip("applied"),
                           buff=0.4), _X0 + 0.2, 0.2)
            self.play(FadeIn(tot), run_time=b.t(0.25))

        with self.beat("hash") as b:
            oh = chip("old hash 303b082b...", ISOLATION, size=SMALL)
            nh = chip("new files, new hash", CREATION, size=SMALL, mono=False)
            lf = status_chip("quarantine lifted")
            hr = _at(_row(oh, T("→", LABEL, MUTED), nh, T("→", LABEL, MUTED), lf), _X0, -0.5)
            self.play(FadeIn(hr[0:3]), run_time=b.t(0.45))
            self.play(FadeIn(hr[3:]), run_time=b.t(0.35))

        with self.beat("empty") as b:
            qe = _at(_row(_mono("quarantine.json", SMALL, ISOLATION), _mono("[]", BODY, TEXT)), _X0, -1.2)
            self.play(FadeIn(qe), run_time=b.t(0.6))

        with self.beat("list") as b:
            wl = _at(_row(chip("widget_list", MCP, size=SMALL), _mono("groceries", SMALL, RUNTIME),
                          _mono("Groceries  rev 2", SMALL), T("no failed field", SMALL, SOLVED)), _X0, -1.9)
            st = _at(_row(chip("list", RUNTIME, size=SMALL), _mono("{ items: [milk, eggs] }, rev: 2", SMALL, RUNTIME)),
                     _X0, -2.5)
            self.play(FadeIn(wl), run_time=b.t(0.4))
            self.play(FadeIn(st), run_time=b.t(0.4))

        with self.beat("outline") as b:
            outline = OutlineDiagram()
            _clear(self, [], b.t(0.1))
            outline.set_highlight_now()
            self.play(FadeIn(outline), run_time=b.t(0.1))
            for k in self.ORDER:
                self.play(outline.highlight(k), run_time=b.t(0.1))
            self.play(outline.reset(), run_time=b.t(0.12))
