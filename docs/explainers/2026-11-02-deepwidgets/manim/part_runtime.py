"""Part `part_runtime`: the widget runtime `@deepwidgets/widgets` and its action contract.

Scenes, in script order: runtime_overview widget_definition register_ownership storage_tables
queue_rule timeout_rule args_and_errors idempotency change_feed routes drain_on_stop sample_widget.
"""
from dwscene import *

# ---------------------------------------------------------------- part helpers
_RULES = ["queue", "timeout", "args", "requestId"]


def _contract(lit=None):
    """The four rules of the action contract as chips in the title row; `lit` is the current one."""
    cs = []
    for r in _RULES:
        on = r == lit
        c = chip(r, RUNTIME if on else OPEN, fill=0.22 if on else 0.04)
        if not on:
            c[1].set_color(MUTED)
        cs.append(c)
    g = VGroup(*cs).arrange(RIGHT, buff=0.15)
    g.to_edge(RIGHT, buff=MARGIN).set_y(TITLE_Y)
    return g


def _kv(k, v, kc=MUTED, vc=TEXT, size=SMALL):
    return VGroup(T(k, size, kc), T(v, size, vc, mono=True)).arrange(RIGHT, buff=0.22)


def _entry(key, desc, color=RUNTIME, desc2=None):
    """A mono key over a short description (and an optional second line)."""
    parts = [T(key, SMALL, color, mono=True), T(desc, SMALL, TEXT)]
    if desc2:
        parts.append(T(desc2, SMALL, TEXT))
    return VGroup(*parts).arrange(DOWN, aligned_edge=LEFT, buff=0.08)


def _lock(color=HOST, s=0.26):
    body = RoundedRectangle(corner_radius=0.03, width=s, height=s * 0.75, stroke_color=color,
                            stroke_width=2, fill_color=color, fill_opacity=0.5)
    shackle = Arc(radius=s * 0.3, start_angle=0, angle=PI, stroke_color=color, stroke_width=2.5)
    shackle.next_to(body, UP, buff=0)
    return VGroup(shackle, body)


def _clock(color=CREATION, r=0.22):
    c = Circle(radius=r, stroke_color=color, stroke_width=2.5)
    h1 = Line(ORIGIN, UP * r * 0.75, stroke_color=color, stroke_width=2.5)
    h2 = Line(ORIGIN, RIGHT * r * 0.55, stroke_color=color, stroke_width=2.5)
    return VGroup(c, h1, h2)


def _restart(color=HOST, r=0.28):
    a = Arc(radius=r, start_angle=PI / 2, angle=1.6 * PI, stroke_color=color, stroke_width=3)
    a.add_tip(tip_length=0.14, tip_width=0.14)
    return a


def _cross(m, color=ISOLATION, sw=4):
    return VGroup(Line(m.get_corner(UL), m.get_corner(DR), stroke_color=color, stroke_width=sw),
                  Line(m.get_corner(DL), m.get_corner(UR), stroke_color=color, stroke_width=sw))


def _arrow(a, b, color=TEXT, buff=0.1, sw=3.5):
    return Arrow(a, b, buff=buff, color=color, stroke_width=sw, tip_length=0.18,
                 max_tip_length_to_length_ratio=0.25)


def _short_arrow(color=TEXT):
    return _arrow(LEFT * 0.4, RIGHT * 0.4, color, buff=0)


def _swap(scene, old, new, rt):
    """Fade the old side panel out, then the new one in (no cross-fade overlap)."""
    if old is not None:
        scene.play(FadeOut(old), run_time=rt / 2)
        scene.play(FadeIn(new, shift=UP * 0.1), run_time=rt / 2)
    else:
        scene.play(FadeIn(new, shift=UP * 0.1), run_time=rt)
    return new


# ================================================================ runtime_overview
class RuntimeOverview(DWScene):
    BEATS = [("open", 9), ("card", 31), ("methods_a", 20), ("methods_b", 24), ("errors", 27)]

    METHODS = [("register", "adds a widget"), ("list", "tells what is live"),
               ("describe", "tells about one live widget"), ("get", "reads the state"),
               ("call", "runs one action"), ("update", "writes the state from a timer"),
               ("setProgram", "stores new screen text"), ("changes", "reads the change feed"),
               ("cursor", "a point in the change feed")]

    def construct(self):
        outline = OutlineDiagram()
        with self.beat("open") as b:
            self.add(outline)
            self.wait(b.t(0.1))
            outline.open_part(self, "ctx_widgets", run_time=b.left)

        with self.beat("card") as b:
            title = scene_title("The widget runtime", RUNTIME)
            pkg = T("@deepwidgets/widgets", BODY, RUNTIME, mono=True)
            lang = T("a package, in TypeScript", SMALL, MUTED)
            row = _kv("row", "deepwidgets-widgets")
            svc = _kv("provides", "ctx.widgets", vc=RUNTIME)
            c1 = chip("connection", HOST)
            c2 = chip("storageDomain", RUNTIME)
            inj_l = T("inject", SMALL, MUTED)
            inj = VGroup(inj_l, c1, c2).arrange(RIGHT, buff=0.22)
            n1 = T("routes", SMALL, MUTED).next_to(c1, DOWN, buff=0.1)
            n2 = T("data on disk", SMALL, MUTED).next_to(c2, DOWN, buff=0.1)
            inner = VGroup(pkg, lang, row, svc, VGroup(inj, n1, n2)).arrange(DOWN, aligned_edge=LEFT, buff=0.2)
            card = rbox(inner.width + 0.6, inner.height + 0.5, RUNTIME, fill=0.08)
            card.move_to(inner)
            grp = VGroup(card, inner)
            grp.to_edge(LEFT, buff=MARGIN + 0.1).align_to([0, 2.8, 0], UP)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.12))
            self.play(Create(card), FadeIn(pkg), FadeIn(lang), run_time=b.t(0.2))
            self.play(FadeIn(row), FadeIn(svc), run_time=b.t(0.2))
            self.play(FadeIn(inj_l), FadeIn(c1), FadeIn(n1), run_time=b.t(0.15))
            self.play(FadeIn(c2), FadeIn(n2), run_time=b.t(0.15))

        rows = []
        for name, desc in self.METHODS:
            c = chip(name, RUNTIME)
            d = T(desc, SMALL, TEXT)
            rows.append(VGroup(c, d))
        x0 = 0.55
        hdr = T("ctx.widgets: nine methods", SMALL, MUTED)
        hdr.move_to([x0, 2.72, 0], aligned_edge=LEFT)
        for i, r in enumerate(rows):
            r[0].move_to([x0, 2.18 - i * 0.57, 0], aligned_edge=LEFT)
            r[1].next_to([x0 + 2.45, r[0].get_y(), 0], RIGHT, buff=0)
        with self.beat("methods_a") as b:
            self.play(FadeIn(hdr), run_time=b.t(0.15))
            self.play(LaggedStart(*[FadeIn(r, shift=LEFT * 0.15) for r in rows[:4]], lag_ratio=0.5),
                      run_time=b.t(0.75))

        with self.beat("methods_b") as b:
            self.play(LaggedStart(*[FadeIn(r, shift=LEFT * 0.15) for r in rows[4:]], lag_ratio=0.55),
                      run_time=b.t(0.85))

        with self.beat("errors") as b:
            we = chip("WidgetError { code, status }", ISOLATION)
            we_d = T("most failures: a code", SMALL, TEXT)
            te = chip("TypeError", ISOLATION)
            te_d = VGroup(T("a malformed definition, or", SMALL, TEXT),
                          T("an update function that is async", SMALL, TEXT)).arrange(DOWN, aligned_edge=LEFT, buff=0.08)
            te_row = VGroup(te, te_d).arrange(RIGHT, buff=0.25, aligned_edge=UP)
            col = VGroup(we, we_d, te_row).arrange(DOWN, aligned_edge=LEFT, buff=0.14)
            col.next_to(grp, DOWN, buff=0.25, aligned_edge=LEFT)
            self.play(FadeIn(we, shift=UP * 0.1), FadeIn(we_d), run_time=b.t(0.3))
            self.play(Indicate(rows[4][0], color=ISOLATION, scale_factor=1.05), run_time=b.t(0.15))
            self.play(FadeIn(te, shift=UP * 0.1), FadeIn(te_d), run_time=b.t(0.3))


# ================================================================ widget_definition
class WidgetDefinition(DWScene):
    BEATS = [("parts", 11), ("slug", 29), ("program", 38), ("actions", 26), ("kinds", 55), ("handler", 61)]

    CODE = """ctx.widgets.register({
  slug: 'sample',
  title: 'Sample',
  program: PROGRAM,
  initialState: { count: 0 },
  // timeoutMs: optional widget default
  actions: [
    { name: 'get', kind: 'query',
      handler: (_a, w) => w.state },
    { name: 'add', kind: 'mutation',
      args: z.object({ by: z.number() }),
      handler: ({ by }, w) => w.update(
        s => ({ count: s.count + by })) },
  ]})"""

    def construct(self):
        title = scene_title("A widget definition", RUNTIME)
        code = code_block(self.CODE, "typescript", color=RUNTIME)
        code.to_edge(LEFT, buff=MARGIN).align_to([0, 2.9, 0], UP)
        hide_lines(code)
        side_x = code.get_right()[0] + 0.3
        side_top = 2.75

        def place(g):
            g.move_to([side_x, side_top, 0], aligned_edge=UL)
            return g

        mark = None

        def mark_to(lines_idx, color=CREATION):
            nonlocal mark
            rect = SurroundingRectangle(VGroup(*[code.code_lines[i] for i in lines_idx]), color=color,
                                        buff=0.06, stroke_width=2.5, corner_radius=0.05)
            if mark is None:
                mark = rect
                return Create(rect)
            old = mark
            mark = rect
            return ReplacementTransform(old, rect)

        with self.beat("parts") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(code.background), run_time=b.t(0.25))
            self.add(code)
            self.play(reveal_lines(code, 0, 1), reveal_lines(code, 13, 14), run_time=b.t(0.2))
            req = [chip(t, RUNTIME) for t in ("slug", "title", "program", "initialState", "actions")]
            opt = chip("timeoutMs", OPEN, dashed=True)
            lab_r = T("five required parts", SMALL, MUTED)
            lab_o = T("one optional part", SMALL, MUTED)
            side = place(VGroup(lab_r, *req, lab_o, opt).arrange(DOWN, aligned_edge=LEFT, buff=0.12))
            self.play(LaggedStart(*[FadeIn(m, shift=LEFT * 0.1) for m in side], lag_ratio=0.2), run_time=b.t(0.5))

        with self.beat("slug") as b:
            self.play(reveal_lines(code, 1, 2), mark_to([1]), run_time=b.t(0.12))
            s1 = _entry("slug", "the id of the widget")
            rx = VGroup(T("^[a-z0-9][a-z0-9-]{0,62}$", SMALL, CREATION, mono=True),
                        T("lower-case, digits, hyphens", SMALL, TEXT),
                        T("up to 63 characters", SMALL, TEXT)).arrange(DOWN, aligned_edge=LEFT, buff=0.08)
            s2 = _entry("title", "the name for people")
            new = place(VGroup(s1, rx, s2).arrange(DOWN, aligned_edge=LEFT, buff=0.3))
            s2.set_opacity(0)
            side = _swap(self, side, new, b.t(0.15))
            self.wait(b.t(0.45))
            self.play(reveal_lines(code, 2, 3), mark_to([2]), s2.animate.set_opacity(1), run_time=b.t(0.15))

        with self.beat("program") as b:
            self.play(reveal_lines(code, 3, 4), mark_to([3]), run_time=b.t(0.08))
            p1 = _entry("program", "the text that tells the window", desc2="what to show")
            p2 = chip("data, not code", SOLVED, mono=False)
            p3 = _entry("PROGRAM", "the seed program:", desc2="the text in the widget code")
            p4 = _entry("initialState", "the first JSON data")
            new = place(VGroup(p1, p2, p3, p4).arrange(DOWN, aligned_edge=LEFT, buff=0.26))
            for m in (p2, p3, p4):
                m.set_opacity(0)
            side = _swap(self, side, new, b.t(0.1))
            self.wait(b.t(0.1))
            self.play(p2.animate.set_opacity(1), run_time=b.t(0.08))
            self.wait(b.t(0.05))
            self.play(p3.animate.set_opacity(1), run_time=b.t(0.08))
            p2[0].set_fill(opacity=0.15)
            self.wait(b.t(0.12))
            self.play(reveal_lines(code, 4, 5), mark_to([4]), p4.animate.set_opacity(1), run_time=b.t(0.1))

        with self.beat("actions") as b:
            self.play(reveal_lines(code, 6, 13, lag=0.25), mark_to(list(range(6, 13))), run_time=b.t(0.3))
            a1 = _entry("action", "a named operation", desc2="with a handler function")
            a2 = _entry("kind", "one of two kinds:")
            k = VGroup(chip("'query'", RUNTIME), chip("'mutation'", RUNTIME)).arrange(RIGHT, buff=0.2)
            a2.add(k)
            k.next_to(a2[1], DOWN, buff=0.12, aligned_edge=LEFT)
            new = place(VGroup(a1, a2).arrange(DOWN, aligned_edge=LEFT, buff=0.35))
            side = _swap(self, side, new, b.t(0.2))

        with self.beat("kinds") as b:
            q = _entry("query", "only reads the state")
            m = _entry("mutation", "can write it")
            z1 = _entry("args", "an argument schema in zod")
            z2 = VGroup(T("zod: a TypeScript library", SMALL, MUTED),
                        T("that checks data shapes", SMALL, MUTED)).arrange(DOWN, aligned_edge=LEFT, buff=0.06)
            w1 = _entry("timeoutMs", "widget timeout: for each", CREATION,
                        desc2="action with no timeout of its own")
            new = place(VGroup(q, m, z1, z2, w1).arrange(DOWN, aligned_edge=LEFT, buff=0.22))
            for x in (m, z1, z2, w1):
                x.set_opacity(0)
            self.play(mark_to([7]), run_time=b.t(0.06))
            side = _swap(self, side, new, b.t(0.06))
            self.wait(b.t(0.06))
            self.play(mark_to([9]), m.animate.set_opacity(1), run_time=b.t(0.08))
            self.wait(b.t(0.04))
            self.play(mark_to([10]), z1.animate.set_opacity(1), run_time=b.t(0.08))
            self.wait(b.t(0.12))
            self.play(z2.animate.set_opacity(1), run_time=b.t(0.08))
            self.wait(b.t(0.08))
            self.play(reveal_lines(code, 5, 6), mark_to([5]), w1.animate.set_opacity(1), run_time=b.t(0.1))

        with self.beat("handler") as b:
            self.play(mark_to([11, 12]), run_time=b.t(0.06))
            h0 = T("handler(args, w)", SMALL, RUNTIME, mono=True)
            ws = [_entry("w.state", "the current state"), _entry("w.update(fn)", "fn makes the new state"),
                  _entry("w.signal", "says when its time is over")]
            hv = VGroup(h0, *ws).arrange(DOWN, aligned_edge=LEFT, buff=0.18)
            for x in ws:
                x.set_opacity(0)
            new = place(hv)
            side = _swap(self, side, new, b.t(0.08))
            self.play(ws[0].animate.set_opacity(1), run_time=b.t(0.06))
            self.wait(b.t(0.04))
            self.play(ws[1].animate.set_opacity(1), run_time=b.t(0.06))
            self.wait(b.t(0.08))
            self.play(ws[2].animate.set_opacity(1), run_time=b.t(0.06))
            self.wait(b.t(0.1))
            chk = VGroup(T("register checks it all", SMALL, ISOLATION, bold=True),
                         T("bad slug, bad action name,", SMALL, TEXT),
                         T("repeated action:", SMALL, TEXT),
                         chip("TypeError", ISOLATION)).arrange(DOWN, aligned_edge=LEFT, buff=0.08)
            chk.next_to(hv, DOWN, buff=0.3, aligned_edge=LEFT)
            self.play(mark_to(list(range(0, 14)), ISOLATION), FadeIn(chk, shift=UP * 0.1), run_time=b.t(0.12))


# ================================================================ register_ownership
class RegisterOwnership(DWScene):
    BEATS = [("own", 13), ("cut", 21), ("disk", 16), ("conflict", 14)]

    def construct(self):
        title = scene_title("Register is an effect", RUNTIME)
        fiber = ProcessBox("fiber", "deepwidgets-widget-sample", RUNTIME)
        fiber.move_to([-4.1, 1.4, 0])
        eff = T("register = ctx.effect", SMALL, MUTED, mono=True).next_to(fiber, DOWN, buff=0.15)
        widget = ProcessBox("widget", "sample", RUNTIME)
        widget.move_to([0.4, 1.4, 0])
        owns = labeled_arrow(fiber.get_right(), widget.get_left(), "owns", RUNTIME, mono=False)
        routes = VGroup(*[chip(r, HOST) for r in ("/program", "/call", "/stream")]).arrange(DOWN, buff=0.14)
        routes.move_to([3.0, 1.4, 0])
        r_arrows = VGroup(*[_arrow(widget.get_right(), r.get_left(), RUNTIME, buff=0.08, sw=2.5) for r in routes])
        win = window_card("Sample", w=2.3, h=1.7)
        win.move_to([5.55, 1.4, 0])
        stream = _arrow(routes[2].get_right(), win.frame.get_bottom() + LEFT * 0.4, SHELL, buff=0.08, sw=2.5)

        with self.beat("own") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(fiber), FadeIn(eff), run_time=b.t(0.3))
            self.play(GrowArrow(owns.arrow), FadeIn(owns.label), FadeIn(widget), run_time=b.t(0.25))
            self.play(LaggedStart(*[GrowArrow(a) for a in r_arrows], lag_ratio=0.2), FadeIn(routes),
                      FadeIn(win), GrowArrow(stream), run_time=b.t(0.3))

        with self.beat("cut") as b:
            mid = owns.arrow.get_center()
            cut = Line(mid + UP * 0.45 + LEFT * 0.2, mid + DOWN * 0.45 + RIGHT * 0.2, stroke_color=ISOLATION,
                       stroke_width=6)
            stop = T("plugin stops", SMALL, ISOLATION).next_to(cut, DOWN, buff=0.12)
            self.play(Create(cut), FadeIn(stop), fiber.animate.set_opacity(0.35), run_time=b.t(0.2))
            self.play(FadeOut(eff), widget.animate.set_opacity(0.35), run_time=b.t(0.1))
            self.play(routes.animate.set_opacity(DIM), r_arrows.animate.set_opacity(DIM), run_time=b.t(0.2))
            rem = chip("{ type: 'removed' }", SHELL)
            rem.next_to(win, DOWN, buff=0.25).align_to(win, RIGHT)
            self.play(FadeIn(rem, shift=UP * 0.1), run_time=b.t(0.15))
            self.play(FadeOut(win, scale=0.6), stream.animate.set_opacity(DIM), run_time=b.t(0.2))

        with self.beat("disk") as b:
            d = disk_icon(RUNTIME, 0.6)
            st = T("state: { rev: 10, data: { count: 10 } }", SMALL, TEXT, mono=True)
            note = T("stays on disk: a widget that comes back gets its data back", SMALL, SOLVED)
            row = VGroup(d, st).arrange(RIGHT, buff=0.3)
            VGroup(row, note).arrange(DOWN, aligned_edge=LEFT, buff=0.2).move_to([-0.6, -0.95, 0])
            self.play(FadeIn(row, shift=UP * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(note), run_time=b.t(0.3))

        with self.beat("conflict") as b:
            live = T("while sample is live:", SMALL, MUTED)
            again = chip("register({ slug: 'sample' })", RUNTIME)
            err = chip("409 conflict", ISOLATION)
            ar = _arrow(LEFT, RIGHT, ISOLATION)
            line = VGroup(live, again, ar, err).arrange(RIGHT, buff=0.25)
            line.move_to([0, -2.35, 0])
            self.play(FadeIn(live), FadeIn(again, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(GrowArrow(ar), FadeIn(err, scale=1.2), run_time=b.t(0.25))


# ================================================================ storage_tables
class StorageTables(DWScene):
    BEATS = [("domain", 40), ("state", 33), ("program", 14), ("requests", 12), ("seed", 23), ("changed", 21)]

    def construct(self):
        title = scene_title("Storage: three tables", RUNTIME)
        d = disk_icon(RUNTIME, 0.55)
        name = T("storage domain", BODY, RUNTIME, bold=True)
        chips = [chip("'widgets'", RUNTIME), chip("v1", RUNTIME), chip("json backend", RUNTIME, mono=False)]
        head = VGroup(d, name, *chips).arrange(RIGHT, buff=0.25)
        head.to_edge(LEFT, buff=MARGIN + 0.1).set_y(2.5)
        defn = T("a DSH service: named tables of records on disk", SMALL, MUTED)
        defn.next_to(head, DOWN, buff=0.18, aligned_edge=LEFT)

        def table(label, key, rec):
            lab = chip(label, RUNTIME, mono=True, fill=0.25)
            t = RevealTable(["key", "record"], [(key, rec)], mono_cols=[0, 1], show_rows=True)
            g = VGroup(lab, t).arrange(RIGHT, buff=0.35, aligned_edge=UP)
            return g

        t_state = table("state", "sample", "{ rev: 0, data: { count: 0 } }")
        t_prog = table("program", "sample", "{ rev: 1, text: 'root = Card(...)', updatedAt }")
        t_req = table("requests", "sha256([caller, requestId])", "{ hash, at, outcome }")
        x_left = head.get_left()[0]
        for i, t in enumerate((t_state, t_prog, t_req)):
            t.move_to([x_left, 1.4 - i * 1.25, 0], aligned_edge=UL)

        with self.beat("domain") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.1))
            self.play(FadeIn(d), FadeIn(name), run_time=b.t(0.12))
            self.play(FadeIn(defn), run_time=b.t(0.15))
            self.wait(b.t(0.2))
            self.play(LaggedStart(*[FadeIn(c, shift=LEFT * 0.1) for c in chips], lag_ratio=0.5), run_time=b.t(0.3))

        with self.beat("state") as b:
            self.play(FadeIn(t_state, shift=UP * 0.1), run_time=b.t(0.2))
            rev = VGroup(T("revision (rev):", SMALL, CREATION), T("+1 on each write", SMALL, TEXT))
            rev.arrange(DOWN, aligned_edge=LEFT, buff=0.06)
            rev.next_to(t_state, RIGHT, buff=0.5)
            self.wait(b.t(0.25))
            self.play(FadeIn(rev), Indicate(t_state[1].cell(0, 1), color=CREATION, scale_factor=1.05),
                      run_time=b.t(0.25))

        with self.beat("program") as b:
            self.play(FadeIn(t_prog, shift=UP * 0.1), run_time=b.t(0.35))
            self.play(Indicate(t_prog[1].cell(0, 1), color=CREATION, scale_factor=1.04), run_time=b.t(0.3))

        bottom_y = -2.45
        with self.beat("requests") as b:
            self.play(FadeIn(t_req, shift=UP * 0.1), run_time=b.t(0.35))
            rn = T("makes retries safe (scene idempotency)", SMALL, MUTED)
            rn.move_to([x_left, bottom_y, 0], aligned_edge=LEFT)
            self.play(FadeIn(rn), run_time=b.t(0.25))

        with self.beat("seed") as b:
            sd = chip("seed program + initial state", RUNTIME, mono=False)
            a = _short_arrow(RUNTIME)
            w1 = T("the first register writes them", SMALL, TEXT)
            w2 = T("later: stored records win", SMALL, SOLVED)
            row = VGroup(sd, a, w1).arrange(RIGHT, buff=0.25)
            row.move_to([x_left, bottom_y, 0], aligned_edge=LEFT)
            w2.next_to(row, RIGHT, buff=0.4)
            self.play(FadeOut(rn), FadeIn(row, shift=UP * 0.1), run_time=b.t(0.2))
            self.play(Indicate(t_state[1].body_rows[0], color=RUNTIME, scale_factor=1.03),
                      Indicate(t_prog[1].body_rows[0], color=RUNTIME, scale_factor=1.03), run_time=b.t(0.25))
            self.play(FadeIn(w2), run_time=b.t(0.2))
            seed_row = VGroup(row, w2)

        with self.beat("changed") as b:
            ev = chip("domain/changed", RUNTIME)
            a = _short_arrow(SHELL)
            fr = chip("{ type: 'data', rev }", SHELL)
            win = T("to each open window", SMALL, SHELL)
            row = VGroup(T("each write:", SMALL, MUTED), ev, a, fr, win).arrange(RIGHT, buff=0.25)
            row.move_to([x_left, bottom_y, 0], aligned_edge=LEFT)
            self.play(FadeOut(seed_row), FadeIn(row[:2], shift=UP * 0.1), run_time=b.t(0.25))
            self.play(GrowArrow(a), FadeIn(fr), FadeIn(win), run_time=b.t(0.3))


# ================================================================ queue_rule
class QueueRule(DWScene):
    BEATS = [("intro", 18), ("lane", 28), ("race", 27), ("check", 26), ("query", 13), ("busy", 18)]

    def construct(self):
        title = scene_title("The action contract", RUNTIME)
        strip = _contract("queue")
        lane = rbox(8.2, 0.8, RUNTIME, fill=0.06)
        lane.move_to([-1.9, 1.2, 0])
        lab = T("queue of slug check: mutations and updates, first in, first out", SMALL, MUTED)
        lab.next_to(lane, UP, buff=0.12, aligned_edge=LEFT)
        runner = ProcessBox("handler", None, RUNTIME, width=1.6, height=0.8)
        runner.next_to(lane, RIGHT, buff=0.35)
        counter = T("n = 0", BODY, TEXT, mono=True).next_to(runner, RIGHT, buff=0.45)
        jobs = VGroup(*[RoundedRectangle(corner_radius=0.08, width=0.55, height=0.45, stroke_color=RUNTIME,
                                         stroke_width=2, fill_color=RUNTIME, fill_opacity=0.35) for _ in range(10)])
        jobs.arrange(RIGHT, buff=0.18).move_to(lane).shift(RIGHT * 0.2)
        jl = T("add × 10", SMALL, RUNTIME).next_to(lane, DOWN, buff=0.12, aligned_edge=LEFT)

        with self.beat("intro") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(c, shift=DOWN * 0.1) for c in strip], lag_ratio=0.3), run_time=b.t(0.4))
            self.play(Indicate(strip[0], color=RUNTIME), run_time=b.t(0.25))

        with self.beat("lane") as b:
            self.play(Create(lane), FadeIn(lab), FadeIn(runner), FadeIn(counter), run_time=b.t(0.25))
            self.play(LaggedStart(*[FadeIn(j, shift=RIGHT * 0.6) for j in jobs], lag_ratio=0.25), FadeIn(jl),
                      run_time=b.t(0.45))

        with self.beat("race") as b:
            wq = T("without a queue:", SMALL, ISOLATION, bold=True)
            ra = T("call A   read n=0   wait   write n=1", SMALL, TEXT, mono=True)
            rb = T("call B   read n=0   wait   write n=1", SMALL, TEXT, mono=True)
            lost = T("n = 1, not 2: one change is lost", SMALL, ISOLATION)
            race = VGroup(wq, ra, rb, lost).arrange(DOWN, aligned_edge=LEFT, buff=0.14)
            race.move_to([-6.3, -0.35, 0], aligned_edge=UL)
            self.play(FadeIn(wq), run_time=b.t(0.1))
            self.play(FadeIn(ra, shift=RIGHT * 0.2), FadeIn(rb, shift=RIGHT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(lost), run_time=b.t(0.15))

        with self.beat("check") as b:
            self.play(FadeOut(race), run_time=b.t(0.06))
            for k, j in enumerate(jobs):
                new = T(f"n = {k + 1}", BODY, SOLVED if k == 9 else TEXT, mono=True).move_to(counter, aligned_edge=LEFT)
                self.play(j.animate.move_to(runner).set_opacity(0), Transform(counter, new), run_time=b.t(0.042))
            plus = T("+10", BODY, SOLVED, bold=True).next_to(counter, DOWN, buff=0.15)
            self.play(FadeIn(plus), run_time=b.t(0.05))
            # the mutant lane: queue removed, all ten read n=0 together
            m_lane = rbox(8.2, 0.8, ISOLATION, fill=0.04, dashed=True).move_to([-1.9, -1.0, 0])
            m_lab = T("mutant: queue removed", SMALL, ISOLATION).next_to(m_lane, UP, buff=0.12, aligned_edge=LEFT)
            m_jobs = jobs.copy().set_opacity(1).set_fill(opacity=0.35).arrange(RIGHT, buff=0.18).move_to(m_lane).shift(RIGHT * 0.2)
            m_jobs.set_stroke(ISOLATION).set_fill(ISOLATION)
            m_run = ProcessBox("handler", None, ISOLATION, width=1.6, height=0.8).next_to(m_lane, RIGHT, buff=0.35)
            m_cnt = T("n = 0", BODY, TEXT, mono=True).next_to(m_run, RIGHT, buff=0.45)
            self.play(FadeIn(m_lane), FadeIn(m_lab), FadeIn(m_jobs), FadeIn(m_run), FadeIn(m_cnt), run_time=b.t(0.1))
            self.play(*[j.animate.move_to(m_run).set_opacity(0) for j in m_jobs],
                      Transform(m_cnt, T("n = 1", BODY, ISOLATION, mono=True).move_to(m_cnt, aligned_edge=LEFT)),
                      run_time=b.t(0.12))
            fail = T("FAIL queue: ... +10: n=1", SMALL, ISOLATION, mono=True)
            src = T("(check output, PR #54)", SMALL, MUTED)
            VGroup(fail, src).arrange(RIGHT, buff=0.3).move_to([-6.3, -2.2, 0], aligned_edge=LEFT)
            self.play(FadeIn(fail), FadeIn(src), run_time=b.t(0.1))
            mutant = VGroup(m_lane, m_lab, m_run, m_cnt, fail, src, m_jobs)

        with self.beat("query") as b:
            self.play(FadeOut(mutant), FadeOut(plus), FadeOut(jl), run_time=b.t(0.15))
            q = chip("get (query)", RUNTIME)
            q.move_to([-6.0, -0.2, 0], aligned_edge=LEFT)
            qn = T("a query does not wait in the queue: it does not write", SMALL, TEXT)
            qn.next_to(q, DOWN, buff=0.15, aligned_edge=LEFT)
            self.play(FadeIn(q), run_time=b.t(0.12))
            self.play(q.animate.move_to([runner.get_x(), -0.2, 0]), FadeIn(qn), run_time=b.t(0.45))

        with self.beat("busy") as b:
            self.play(FadeOut(q), FadeOut(qn), run_time=b.t(0.08))
            j = RoundedRectangle(corner_radius=0.08, width=0.55, height=0.45, stroke_color=RUNTIME,
                                 stroke_width=2, fill_color=RUNTIME, fill_opacity=0.35).move_to(lane.get_left() + RIGHT * 1.0)
            ck = _clock(CREATION, 0.2).next_to(j, UP, buff=0.08)
            self.play(FadeIn(j, shift=RIGHT * 0.4), FadeIn(ck), run_time=b.t(0.12))
            self.play(Rotate(ck[1], angle=-2 * PI, about_point=ck[0].get_center()),
                      ck.animate.set_color(ISOLATION), run_time=b.t(0.25))
            self.play(j.animate.shift(DOWN * 1.6).set_stroke(ISOLATION).set_fill(ISOLATION), FadeOut(ck),
                      run_time=b.t(0.12))
            busy = VGroup(chip("503 busy", ISOLATION), T("waited longer than its timeout: it does not run", SMALL, TEXT))
            busy.arrange(RIGHT, buff=0.3).next_to(j, RIGHT, buff=0.3)
            self.play(FadeIn(busy), run_time=b.t(0.12))


# ================================================================ timeout_rule
class TimeoutRule(DWScene):
    BEATS = [("order", 28), ("limit", 22), ("refuse", 40), ("loop", 49)]

    @staticmethod
    def _x(ms):
        return -5.5 + ms / 700 * 11

    def construct(self):
        title = scene_title("The action contract", RUNTIME)
        strip = _contract("timeout")
        with self.beat("order") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(strip), run_time=b.t(0.15))
            lab = T("the time limit of a call:", SMALL, MUTED)
            o = [chip("action timeoutMs", RUNTIME), T("else", SMALL, MUTED), chip("widget timeoutMs", RUNTIME),
                 T("else", SMALL, MUTED), chip("5000 ms", CREATION)]
            row = VGroup(lab, *o).arrange(RIGHT, buff=0.25).move_to([0, 2.3, 0])
            self.play(FadeIn(lab), FadeIn(o[0]), run_time=b.t(0.2))
            self.wait(b.t(0.1))
            self.play(FadeIn(o[1]), FadeIn(o[2]), run_time=b.t(0.15))
            self.play(FadeIn(o[3]), FadeIn(o[4]), run_time=b.t(0.15))

        x = self._x
        axis = Line([x(0), -0.1, 0], [x(700), -0.1, 0], stroke_color=MUTED, stroke_width=2)
        ticks = VGroup()
        for ms in (0, 300, 600):
            ticks.add(Line([x(ms), -0.2, 0], [x(ms), 0.0, 0], stroke_color=MUTED, stroke_width=2))
            ticks.add(T(f"{ms} ms", SMALL, MUTED, mono=True).move_to([x(ms), -0.45, 0]))
        bar = Rectangle(width=x(300) - x(0), height=0.42, stroke_color=RUNTIME, stroke_width=2,
                        fill_color=RUNTIME, fill_opacity=0.3).move_to([(x(0) + x(300)) / 2, 0.35, 0])
        bar_l = T("call late (timeoutMs 300)", SMALL, RUNTIME, mono=True).next_to(bar, UP, buff=0.12).align_to(bar, LEFT)
        with self.beat("limit") as b:
            self.play(Create(axis), FadeIn(ticks), run_time=b.t(0.15))
            self.play(FadeIn(bar_l), GrowFromEdge(bar, LEFT), run_time=b.t(0.3))
            red = Line([x(300), -0.25, 0], [x(300), 1.35, 0], stroke_color=ISOLATION, stroke_width=5)
            t1 = chip("504 timeout", ISOLATION).next_to(red, RIGHT, buff=0.2).set_y(1.05)
            t2 = T("w.signal.aborted = true", SMALL, ISOLATION, mono=True).next_to(t1, RIGHT, buff=0.3)
            self.play(Create(red), FadeIn(t1), run_time=b.t(0.2))
            self.play(FadeIn(t2), run_time=b.t(0.2))

        with self.beat("refuse") as b:
            ext = Rectangle(width=x(600) - x(300), height=0.42, stroke_color=MUTED, stroke_width=2,
                            fill_color=MUTED, fill_opacity=0.12).move_to([(x(300) + x(600)) / 2, 0.35, 0])
            ext_l = VGroup()
            state = ProcessBox("state", "count = 10", RUNTIME).move_to([5.3, -1.5, 0])
            w1 = chip("w.update(...)", RUNTIME).move_to([x(600) - 2.2, -1.2, 0])
            w2 = chip("ctx.widgets.update(...)", RUNTIME).move_to([x(600) - 2.2, -1.9, 0]).align_to(w1, RIGHT)
            self.play(GrowFromEdge(ext, LEFT), FadeIn(state), run_time=b.t(0.12))
            self.play(FadeIn(w1, shift=RIGHT * 0.2), FadeIn(w2, shift=RIGHT * 0.2), run_time=b.t(0.1))
            a1 = _arrow(w1.get_right(), state.get_left() + UP * 0.2, ISOLATION, buff=0.08)
            a2 = _arrow(w2.get_right(), state.get_left() + DOWN * 0.2, ISOLATION, buff=0.08)
            self.play(GrowArrow(a1), GrowArrow(a2), run_time=b.t(0.12))
            wall = Line(state.get_left() + UP * 0.55 + LEFT * 0.15, state.get_left() + DOWN * 0.55 + LEFT * 0.15,
                        stroke_color=ISOLATION, stroke_width=7)
            msg = T("timeout: a write after the timeout was refused", SMALL, ISOLATION, mono=True)
            msg.move_to([0, -2.55, 0])
            self.play(Create(wall), FadeIn(msg), Indicate(state, color=SOLVED, scale_factor=1.04), run_time=b.t(0.15))
            why = caption("Why? We infer: a call that failed for the caller must not change the data later.",
                          size=24, color=MUTED)
            self.wait(b.t(0.12))
            self.play(FadeIn(why), run_time=b.t(0.12))
            timeline = VGroup(axis, ticks, bar, bar_l, red, t1, t2, ext, ext_l, state, w1, w2, a1, a2, wall, msg, why,
                              row)

        with self.beat("loop") as b:
            self.play(FadeOut(timeline), run_time=b.t(0.06))
            lim = T("one limit: the timeout is a JavaScript timer", BODY, TEXT).move_to([0, 1.9, 0])
            self.play(FadeIn(lim), run_time=b.t(0.08))
            code = code_block("while (true) {}", "javascript", color=ISOLATION, size=BODY)
            code.move_to([-3.6, 0.3, 0])
            clk = _clock(MUTED, 0.55).move_to([0.6, 0.3, 0])
            frz = T("the timer never fires", SMALL, MUTED).next_to(clk, DOWN, buff=0.2)
            arr = _arrow(code.get_right(), clk.get_left(), ISOLATION, buff=0.25)
            self.play(FadeIn(code), run_time=b.t(0.1))
            self.play(GrowArrow(arr), FadeIn(clk), run_time=b.t(0.1))
            self.play(Rotate(clk[1], angle=-PI / 3, about_point=clk[0].get_center()), run_time=b.t(0.06))
            self.play(FadeIn(frz), clk.animate.set_stroke(opacity=0.4), run_time=b.t(0.08))
            nope = T("the timeout cannot end such a loop", SMALL, ISOLATION).next_to(code, DOWN, buff=0.3)
            self.play(FadeIn(nope), run_time=b.t(0.1))
            wd = ProcessBox("watchdog", "ends it (a later part)", ISOLATION, sub_mono=False, dashed=True)
            wd.move_to([4.6, 0.3, 0])
            a2 = _arrow(wd.get_left(), clk.get_right() + RIGHT * 0.1, ISOLATION, buff=0.15)
            self.play(FadeIn(wd), GrowArrow(a2), run_time=b.t(0.15))


# ================================================================ args_and_errors
class ArgsAndErrors(DWScene):
    BEATS = [("zod", 31), ("rows_a", 24), ("rows_b", 19), ("rows_c", 38)]

    ROWS = [
        ("unknown-widget", "404"), ("unknown-action", "404"), ("invalid-args", "422"),
        ("handler-error", "500"), ("timeout", "504"), ("busy", "503"),
        ("idempotency-conflict", "409"), ("conflict", "409"), ("bad-request", "400"),
        ("safe-mode", "503"), ("widget-failed", "503"),
    ]

    def construct(self):
        title = scene_title("The action contract", RUNTIME)
        strip = _contract("args")
        cx = 2.0
        call = chip("call(action, args)", RUNTIME).move_to([cx, 2.45, 0])
        zod = ProcessBox("argument check", "zod schema", CREATION).move_to([cx, 1.25, 0])
        lane = rbox(3.0, 0.62, RUNTIME, fill=0.06).move_to([cx, 0.0, 0])
        lane_l = T("queue", SMALL, RUNTIME).next_to(lane, RIGHT, buff=0.15)
        slots = VGroup(*[RoundedRectangle(corner_radius=0.06, width=0.42, height=0.36, stroke_color=RUNTIME,
                                          stroke_width=2, fill_color=RUNTIME, fill_opacity=0.3) for _ in range(3)])
        slots.arrange(RIGHT, buff=0.15).move_to(lane)
        hnd = ProcessBox("handler", None, RUNTIME, width=1.8, height=0.6).move_to([cx, -1.15, 0])
        a1 = _arrow(call.get_bottom(), zod.get_top(), RUNTIME, buff=0.06)
        a2 = _arrow(zod.get_bottom(), lane.get_top(), RUNTIME, buff=0.06)
        a3 = _arrow(lane.get_bottom(), hnd.get_top(), RUNTIME, buff=0.06)
        flow = VGroup(call, zod, lane, lane_l, slots, hnd, a1, a2, a3)

        with self.beat("zod") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(strip), run_time=b.t(0.12))
            self.play(FadeIn(call), GrowArrow(a1), FadeIn(zod), run_time=b.t(0.2))
            self.play(GrowArrow(a2), FadeIn(lane), FadeIn(lane_l), FadeIn(slots), GrowArrow(a3), FadeIn(hnd),
                      run_time=b.t(0.2))
            bad = chip("422", ISOLATION)
            bad.next_to(zod, RIGHT, buff=0.6)
            ab = _arrow(zod.get_right(), bad.get_left(), ISOLATION, buff=0.06)
            note = VGroup(T("invalid-args", SMALL, ISOLATION, mono=True),
                          T("no queue slot", SMALL, ISOLATION)).arrange(DOWN, aligned_edge=LEFT, buff=0.06)
            note.next_to(bad, DOWN, buff=0.12, aligned_edge=LEFT)
            self.play(GrowArrow(ab), FadeIn(bad), run_time=b.t(0.15))
            self.play(FadeIn(note), Indicate(slots, color=SOLVED), run_time=b.t(0.15))

        tbl = RevealTable(["code", "HTTP status"], self.ROWS, mono_cols=[0, 1],
                          cell_colors={(i, 1): ISOLATION for i in range(len(self.ROWS))})
        tbl.to_edge(LEFT, buff=MARGIN + 0.2).align_to([0, 2.8, 0], UP)
        with self.beat("rows_a") as b:
            self.add(tbl)
            self.play(FadeIn(tbl.header), run_time=b.t(0.1))
            self.wait(b.t(0.3))
            self.play(tbl.reveal_rows(0, 2), run_time=b.t(0.25))
            self.play(tbl.reveal_row(2), Indicate(bad, color=ISOLATION), run_time=b.t(0.2))

        with self.beat("rows_b") as b:
            self.play(tbl.reveal_rows(3, 5), run_time=b.t(0.55))
            self.play(tbl.reveal_row(5), run_time=b.t(0.25))

        with self.beat("rows_c") as b:
            self.play(tbl.reveal_rows(6, 8), run_time=b.t(0.2))
            self.play(tbl.reveal_row(8), run_time=b.t(0.12))
            iso = VGroup(tbl.mark_row(9, ISOLATION), tbl.mark_row(10, ISOLATION))
            iso_l = T("came with isolation", SMALL, ISOLATION)
            iso_l.next_to(iso[1], RIGHT, buff=0.25)
            self.play(tbl.reveal_rows(9, 11), run_time=b.t(0.15))
            self.play(Create(iso), FadeIn(iso_l), run_time=b.t(0.12))
            qw = chip("a query that writes", RUNTIME, mono=False)
            he = chip("handler-error", ISOLATION)
            ar = _short_arrow(ISOLATION)
            row = VGroup(qw, ar, he).arrange(RIGHT, buff=0.2).move_to([cx + 1.0, -2.5, 0])
            self.play(FadeIn(row), Create(tbl.mark_row(3, ISOLATION)), run_time=b.t(0.15))


# ================================================================ idempotency
class Idempotency(DWScene):
    BEATS = [("once", 40), ("hash", 43), ("disk", 18), ("restart", 41), ("gap", 29)]

    def construct(self):
        title = scene_title("The action contract", RUNTIME)
        strip = _contract("requestId")
        run = ProcessBox("one run", "count + 1", RUNTIME).move_to([1.6, 1.3, 0])
        calls = [chip("add {by: 1}  requestId 'same'", RUNTIME) for _ in range(3)]
        for i, c in enumerate(calls):
            c.move_to([-6.4, 1.95 - i * 0.65, 0], aligned_edge=LEFT)

        with self.beat("once") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(strip), run_time=b.t(0.1))
            self.play(FadeIn(calls[0], shift=RIGHT * 0.2), run_time=b.t(0.12))
            a0 = _arrow(calls[0].get_right(), run.get_left(), RUNTIME, buff=0.1)
            self.play(GrowArrow(a0), FadeIn(run), run_time=b.t(0.15))
            once = T("runs once for each pair (caller, requestId)", SMALL, TEXT)
            once.next_to(run, DOWN, buff=0.35).align_to(run, LEFT)
            self.play(FadeIn(once), run_time=b.t(0.15))
            idem = VGroup(T("idempotent:", SMALL, CREATION, bold=True),
                          T("runs again with no second effect", SMALL, TEXT)).arrange(RIGHT, buff=0.2)
            idem.next_to(once, DOWN, buff=0.15, aligned_edge=LEFT)
            self.wait(b.t(0.1))
            self.play(FadeIn(idem), run_time=b.t(0.15))

        with self.beat("hash") as b:
            hs = chip("hash = slug + action + args", CREATION).move_to([2.2, 2.6, 0])
            self.play(FadeOut(once), FadeOut(idem), FadeIn(hs), run_time=b.t(0.12))
            self.wait(b.t(0.08))
            a12 = [_arrow(c.get_right(), run.get_left(), RUNTIME, buff=0.1) for c in calls[1:]]
            self.play(*[FadeIn(c, shift=RIGHT * 0.2) for c in calls[1:]], *[GrowArrow(a) for a in a12],
                      run_time=b.t(0.12))
            rp = VGroup(*[chip("replayed: true", SOLVED) for _ in range(2)]).arrange(DOWN, buff=0.15)
            rp.move_to([5.2, 1.3, 0])
            ar = _arrow(run.get_right(), rp.get_left(), SOLVED, buff=0.1)
            self.play(GrowArrow(ar), FadeIn(rp), run_time=b.t(0.12))
            self.wait(b.t(0.08))
            cf = chip("add {by: 6}  requestId 'same'", ISOLATION)
            ce = chip("409 idempotency-conflict", ISOLATION)
            ac = _short_arrow(ISOLATION)
            crow = VGroup(cf, ac, ce).arrange(RIGHT, buff=0.25).move_to([-6.4, -0.6, 0], aligned_edge=LEFT)
            self.play(FadeIn(crow), run_time=b.t(0.12))
            share = T("three parallel retries share one run", SMALL, SOLVED)
            share.next_to(run, DOWN, buff=0.4).align_to(run, LEFT)
            self.play(FadeIn(share), Indicate(run, color=SOLVED, scale_factor=1.05), run_time=b.t(0.15))
            top = VGroup(*calls, a0, *a12, run, hs, rp, ar, share)

        with self.beat("disk") as b:
            self.play(FadeOut(crow), run_time=b.t(0.1))
            d = disk_icon(RUNTIME, 0.5)
            t = RevealTable(["requests key", "record"], [("sha256([caller, requestId])", "{ hash, at, outcome }")],
                            mono_cols=[0, 1], show_rows=True)
            row = VGroup(d, t).arrange(RIGHT, buff=0.35).move_to([-6.4, -0.75, 0], aligned_edge=LEFT)
            self.play(FadeIn(row, shift=UP * 0.1), run_time=b.t(0.3))
            hc = VGroup(_restart(HOST), T("why on disk? a host can crash and restart", SMALL, HOST)).arrange(RIGHT, buff=0.2)
            hc.next_to(row, DOWN, buff=0.3, aligned_edge=LEFT)
            self.play(FadeIn(hc), run_time=b.t(0.25))

        with self.beat("restart") as b:
            self.play(FadeOut(top), run_time=b.t(0.06))
            ic = _restart(HOST, 0.3)
            rl = T("host restart", SMALL, HOST)
            icg = VGroup(ic, rl).arrange(DOWN, buff=0.08)
            rc = chip("requestId 'restart-1'", RUNTIME)
            ra = _short_arrow(SOLVED)
            rr = chip("replayed: true", SOLVED)
            rn = T("count unchanged", SMALL, SOLVED)
            line = VGroup(icg, rc, ra, rr, rn).arrange(RIGHT, buff=0.25).move_to([-6.4, 2.25, 0], aligned_edge=LEFT)
            self.play(FadeIn(icg), run_time=b.t(0.05))
            self.play(Rotate(ic, angle=-2 * PI), run_time=b.t(0.07))
            self.play(FadeIn(rc), GrowArrow(ra), FadeIn(rr), FadeIn(rn), run_time=b.t(0.15))
            ttl = VGroup(chip("TTL 10 min", CREATION), T("an older record is void", SMALL, TEXT)).arrange(RIGHT, buff=0.25)
            ttl.move_to([-6.4, 1.2, 0], aligned_edge=LEFT)
            self.wait(b.t(0.05))
            self.play(FadeIn(ttl), run_time=b.t(0.12))
            fl = VGroup(T("a failed call is stored only when it already wrote", SMALL, TEXT),
                        T("so a retry of a busy call can run", SMALL, SOLVED)).arrange(DOWN, aligned_edge=LEFT, buff=0.1)
            fl.move_to([-6.4, 0.3, 0], aligned_edge=LEFT)
            self.wait(b.t(0.05))
            self.play(FadeIn(fl[0]), run_time=b.t(0.12))
            self.play(FadeIn(fl[1]), run_time=b.t(0.12))

        with self.beat("gap") as b:
            g0 = T("one gap stays:", SMALL, ISOLATION, bold=True)
            w1 = chip("state write", RUNTIME, mono=False)
            w2 = chip("request record", RUNTIME, mono=False)
            bs = burst(ISOLATION, 0.22)
            grow = VGroup(g0, w1, bs, w2).arrange(RIGHT, buff=0.3).move_to([-6.4, -1.75, 0], aligned_edge=LEFT)
            two = T("two writes", SMALL, MUTED).next_to(grow, RIGHT, buff=0.4)
            out = T("a crash between them: a retry can run twice (inferred from the code)", SMALL, ISOLATION)
            out.move_to([-6.4, -2.4, 0], aligned_edge=LEFT)
            self.play(FadeOut(hc), FadeIn(g0), FadeIn(w1), FadeIn(w2), FadeIn(two), run_time=b.t(0.2))
            self.play(GrowFromCenter(bs), run_time=b.t(0.15))
            self.play(FadeIn(out), run_time=b.t(0.2))


# ================================================================ change_feed
class ChangeFeed(DWScene):
    BEATS = [("why", 13), ("entry", 31), ("ribbon", 17), ("cursor", 25), ("reset", 21)]

    def construct(self):
        title = scene_title("The change feed", RUNTIME)
        with self.beat("why") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.15))
            u = chip("your clicks", USER, mono=False)
            ag = chip("agent", AGENT, mono=False)
            row = VGroup(u, ag).arrange(RIGHT, buff=2.0).move_to([-3.4, 2.4, 0])
            dl = DashedLine(u.get_right(), ag.get_left(), color=MUTED, buff=0.1, dash_length=0.08)
            x = _cross(Square(0.3).move_to(dl.get_center()))
            self.play(FadeIn(u), FadeIn(ag), Create(dl), run_time=b.t(0.3))
            self.play(Create(x), run_time=b.t(0.2))
            feed = chip("so: a change feed", RUNTIME, mono=False).next_to(row, RIGHT, buff=0.5)
            self.play(FadeIn(feed), run_time=b.t(0.2))

        code = code_block("{ seq, at, slug,\n  kind: 'state' | 'program' | 'added' | 'removed',\n  by, action?, rev? }",
                          "typescript", color=RUNTIME)
        code.to_edge(LEFT, buff=MARGIN).align_to([0, 1.75, 0], UP)
        with self.beat("entry") as b:
            hide_lines(code)
            self.add(code)
            self.play(FadeIn(code.background), reveal_lines(code, 0, 3, lag=0.4), run_time=b.t(0.35))
            by_l = T("by:", SMALL, MUTED)
            bys = [chip("user", USER), chip("agent id", AGENT, mono=False), chip("host", HOST), chip("timer", RUNTIME)]
            grid = VGroup(VGroup(bys[0], bys[1]).arrange(RIGHT, buff=0.15),
                          VGroup(bys[2], bys[3]).arrange(RIGHT, buff=0.15)).arrange(DOWN, aligned_edge=LEFT, buff=0.12)
            col = VGroup(by_l, *bys)
            VGroup(by_l, grid).arrange(DOWN, aligned_edge=LEFT, buff=0.1).next_to(code, RIGHT, buff=0.4).align_to(code, UP)
            self.wait(b.t(0.1))
            self.play(LaggedStart(*[FadeIn(m, shift=LEFT * 0.1) for m in col], lag_ratio=0.3), run_time=b.t(0.4))

        n = 14
        boxes = VGroup(*[RoundedRectangle(corner_radius=0.05, width=0.62, height=0.5, stroke_color=RUNTIME,
                                          stroke_width=2, fill_color=RUNTIME, fill_opacity=0.18) for _ in range(n)])
        boxes.arrange(RIGHT, buff=0.12).move_to([-1.5, -0.9, 0])
        with self.beat("ribbon") as b:
            self.play(LaggedStart(*[FadeIn(bx, shift=LEFT * 0.2) for bx in boxes], lag_ratio=0.1), run_time=b.t(0.4))
            l0, l1 = boxes[0].get_corner(DL) + DOWN * 0.12, boxes[-1].get_corner(DR) + DOWN * 0.12
            br = VGroup(Line(l0, l1, stroke_color=MUTED, stroke_width=2),
                        Line(l0, l0 + UP * 0.1, stroke_color=MUTED, stroke_width=2),
                        Line(l1, l1 + UP * 0.1, stroke_color=MUTED, stroke_width=2))
            bl = T("the last 1000 changes, in memory", SMALL, MUTED).next_to(br, DOWN, buff=0.08)
            sq = T("seq →", SMALL, RUNTIME, mono=True).next_to(boxes, RIGHT, buff=0.25)
            self.play(Create(br), FadeIn(bl), FadeIn(sq), run_time=b.t(0.3))

        with self.beat("cursor") as b:
            cur = chip("f6967379:1", CREATION).move_to([-4.3, -2.35, 0])
            ep = T("epoch : seq", SMALL, CREATION, mono=True).next_to(cur, RIGHT, buff=0.25)
            ar = _arrow(cur.get_top(), boxes[3].get_bottom() + DOWN * 0.05, CREATION, buff=0.05)
            self.play(FadeOut(bl), FadeIn(cur), GrowArrow(ar), Indicate(boxes[3], color=CREATION), run_time=b.t(0.3))
            self.play(FadeIn(ep), run_time=b.t(0.15))
            epd = T("epoch: a random id of one start of the runtime", SMALL, TEXT)
            epd.next_to(VGroup(cur, ep), DOWN, buff=0.12, aligned_edge=LEFT)
            if epd.get_bottom()[1] < CONTENT_BOTTOM:
                epd.next_to(ep, RIGHT, buff=0.3)
            self.play(FadeIn(epd), run_time=b.t(0.2))

        with self.beat("reset") as b:
            self.play(FadeOut(epd), run_time=b.t(0.08))
            old = chip("older start, too old", ISOLATION, mono=False, dashed=True)
            a = _short_arrow(ISOLATION)
            rs = chip("reset: true", ISOLATION)
            again = T("the agent reads the list again", SMALL, TEXT)
            row = VGroup(old, a, rs).arrange(RIGHT, buff=0.2)
            row.next_to(ep, RIGHT, buff=0.45)
            again.next_to(row, UP, buff=0.12).align_to(row, RIGHT)
            self.play(FadeIn(old), GrowArrow(a), FadeIn(rs), run_time=b.t(0.35))
            self.play(FadeIn(again), run_time=b.t(0.2))


# ================================================================ routes
class Routes(DWScene):
    BEATS = [("global", 41), ("slug", 31), ("sse", 26), ("ping", 25)]

    ROWS = [("GET", "/api/widgets", "the list"),
            ("GET", "/api/widgets/events", "SSE: added, removed"),
            ("GET", "/api/widgets/<slug>/program", "{ rev, text }"),
            ("POST", "/api/widgets/<slug>/call", "{ action, args, requestId? }"),
            ("GET", "/api/widgets/<slug>/stream", "SSE: the live channel")]

    def construct(self):
        title = scene_title("Five routes", RUNTIME)
        tbl = RevealTable(["method", "path", "gives"], self.ROWS, mono_cols=[0, 1, 2],
                          cell_colors={(i, 1): HOST for i in range(5)})
        tbl.move_to([0.35, 0, 0]).align_to([0, 2.75, 0], UP)
        locks = VGroup(*[_lock(HOST).move_to([tbl.get_left()[0] - 0.3, r.get_y(), 0]) for r in tbl.body_rows])
        for lk in locks:
            lk.set_opacity(0)

        with self.beat("global") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.08))
            conn = T("through the connection service: each route has the cookie check", SMALL, HOST)
            conn.next_to(title, RIGHT, buff=0.5).align_to(title, DOWN)
            if conn.get_right()[0] > 6.75:
                conn.to_edge(RIGHT, buff=MARGIN)
            self.add(tbl)
            self.play(FadeIn(tbl.header), FadeIn(conn), run_time=b.t(0.15))
            self.wait(b.t(0.12))
            self.play(tbl.reveal_row(0), locks[0].animate.set_opacity(1), run_time=b.t(0.15))
            self.wait(b.t(0.1))
            self.play(tbl.reveal_row(1), locks[1].animate.set_opacity(1), run_time=b.t(0.15))

        with self.beat("slug") as b:
            self.wait(b.t(0.1))
            for i in (2, 3, 4):
                self.play(tbl.reveal_row(i), locks[i].animate.set_opacity(1), run_time=b.t(0.15))
                self.wait(b.t(0.1))

        def frames(label, items, y):
            lab = T(label, SMALL, MUTED, mono=True)
            cs = [chip(t, SHELL) for t in items]
            g = VGroup(lab)
            for c in cs:
                g.add(c)
            g.arrange(RIGHT, buff=0.22).move_to([-6.4, y, 0], aligned_edge=LEFT)
            return g

        with self.beat("sse") as b:
            sd = VGroup(T("SSE (server-sent events):", SMALL, SHELL, bold=True),
                        T("a one-way HTTP stream of text frames", SMALL, TEXT)).arrange(RIGHT, buff=0.2)
            sd.move_to([-6.4, -0.3, 0], aligned_edge=LEFT)
            ev = frames("events", ["hello {slugs}", "added", "removed"], -0.9)
            st = frames("stream", ["hello {rev, programRev}", "data", "program", "removed"], -1.55)
            self.play(FadeIn(sd), Indicate(tbl.body_rows[1], color=SHELL, scale_factor=1.02),
                      Indicate(tbl.body_rows[4], color=SHELL, scale_factor=1.02), run_time=b.t(0.25))
            self.play(FadeIn(ev[0]), FadeIn(ev[1]), FadeIn(st[0]), FadeIn(st[1]), run_time=b.t(0.25))
            self.play(LaggedStart(*[FadeIn(c, shift=LEFT * 0.1) for c in [*ev[2:], *st[2:]]], lag_ratio=0.25),
                      run_time=b.t(0.35))

        with self.beat("ping") as b:
            pg = chip(": ping  every 15 s", SHELL)
            pg.move_to([ev.get_right()[0] + 0.6, ev.get_y(), 0], aligned_edge=LEFT)
            self.play(FadeIn(pg, shift=RIGHT * 0.1), run_time=b.t(0.15))
            self.wait(b.t(0.1))
            gh = chip("/api/widgets/ghost/call", HOST)
            ar = _short_arrow(ISOLATION)
            nf = chip("plain 404", ISOLATION)
            why = T("a slug that is not live has no routes", SMALL, MUTED)
            row = VGroup(gh, ar, nf, why).arrange(RIGHT, buff=0.25)
            row.move_to([-6.4, -2.3, 0], aligned_edge=LEFT)
            self.play(FadeIn(gh), run_time=b.t(0.15))
            self.play(GrowArrow(ar), FadeIn(nf), FadeIn(why), run_time=b.t(0.2))


# ================================================================ drain_on_stop
class DrainOnStop(DWScene):
    BEATS = [("refuse", 19), ("streams", 6), ("wait", 8), ("domain", 7), ("why", 13), ("bound", 21)]

    def construct(self):
        title = scene_title("Drain on stop", RUNTIME)
        xs = [-5.05, -1.7, 1.7, 5.05]
        names = ["stopping = true", "streams close", "calls finish", "domain closes"]
        steps = []
        for x, n in zip(xs, names):
            t = T(n, LABEL, RUNTIME, bold=True, mono=(n == "stopping = true"))
            bx = rbox(3.05, 0.8, RUNTIME, fill=0.08).move_to([x, 1.9, 0])
            t.move_to(bx)
            steps.append(VGroup(bx, t))
        arrows = [_arrow(steps[i].get_right(), steps[i + 1].get_left(), RUNTIME, buff=0.02, sw=3)
                  for i in range(3)]

        with self.beat("refuse") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.1))
            q = T("the runtime stops, for example on a reload", SMALL, MUTED).move_to([0, 2.65, 0])
            self.play(FadeIn(q), run_time=b.t(0.15))
            self.wait(b.t(0.2))
            self.play(FadeIn(steps[0]), run_time=b.t(0.12))
            nc = chip("new call", RUNTIME, mono=False)
            bz = chip("503 busy", ISOLATION)
            col = VGroup(nc, bz).arrange(DOWN, buff=0.35).next_to(steps[0], DOWN, buff=0.35)
            a = _arrow(nc.get_bottom(), bz.get_top(), ISOLATION, buff=0.04)
            self.play(FadeIn(nc), GrowArrow(a), FadeIn(bz), run_time=b.t(0.2))

        with self.beat("streams") as b:
            sse = VGroup(chip("events", SHELL), chip("stream", SHELL)).arrange(DOWN, buff=0.2)
            sse.next_to(steps[1], DOWN, buff=0.35)
            xx = VGroup(*[_cross(c, ISOLATION, 3) for c in sse])
            self.play(GrowArrow(arrows[0]), FadeIn(steps[1]), FadeIn(sse), run_time=b.t(0.45))
            self.play(Create(xx), run_time=b.t(0.3))

        with self.beat("wait") as b:
            slow = chip("slow", RUNTIME)
            barbg = Rectangle(width=2.6, height=0.3, stroke_color=RUNTIME, stroke_width=2)
            bar = Rectangle(width=2.6, height=0.3, stroke_width=0, fill_color=RUNTIME, fill_opacity=0.6)
            wr = chip("write: rev + 1", SOLVED)
            col = VGroup(slow, barbg, wr).arrange(DOWN, buff=0.2).next_to(steps[2], DOWN, buff=0.35)
            bar.move_to(barbg)
            self.play(GrowArrow(arrows[1]), FadeIn(steps[2]), FadeIn(slow), FadeIn(barbg), run_time=b.t(0.3))
            self.play(GrowFromEdge(bar, LEFT), run_time=b.t(0.35))
            self.play(FadeIn(wr), run_time=b.t(0.2))

        with self.beat("domain") as b:
            d = disk_icon(RUNTIME, 0.6).next_to(steps[3], DOWN, buff=0.4)
            cl = T("closed", SMALL, MUTED).next_to(d, DOWN, buff=0.15)
            self.play(GrowArrow(arrows[2]), FadeIn(steps[3]), FadeIn(d), run_time=b.t(0.5))
            self.play(d.animate.set_stroke(opacity=0.4), FadeIn(cl), run_time=b.t(0.3))

        with self.beat("why") as b:
            w = VGroup(T("Why?", SMALL, CREATION, bold=True),
                       T("a call that started must not lose its write in the middle", SMALL, TEXT)).arrange(RIGHT, buff=0.2)
            w.move_to([0, -1.6, 0])
            self.play(FadeIn(w), Indicate(wr, color=SOLVED), run_time=b.t(0.35))

        with self.beat("bound") as b:
            bd = chip("upper bound: 2 x longest timeout + 1 s", CREATION)
            gd = T("the bound only guards against a defect", SMALL, MUTED)
            g = VGroup(bd, gd).arrange(RIGHT, buff=0.35).move_to([0, -2.35, 0])
            self.play(FadeIn(bd, shift=UP * 0.1), run_time=b.t(0.3))
            self.wait(b.t(0.2))
            self.play(FadeIn(gd), run_time=b.t(0.2))


# ================================================================ sample_widget
class SampleWidget(DWScene):
    BEATS = [("intro", 11), ("actions", 15), ("program", 24), ("tick", 23), ("catch", 14), ("close", 7)]

    PROGRAM = """root = Card([CardHeader("Sample", "A counter"),
  Stat("Count", s.count),
  Button("Add 1", Action([@Run(add), @Run(s)]))])
s = Query("get", {}, {count: 0})
add = Mutation("add", {by: 1})"""

    def construct(self):
        title = scene_title("The built-in widget: sample", RUNTIME)
        win = window_card("Sample", w=4.4, h=2.75)
        win.move_to([-4.4, 1.45, 0])
        bar_y = win.frame.get_top()[1] - 0.42
        win.body_center = np.array([win.frame.get_x(), (bar_y + win.frame.get_bottom()[1]) / 2, 0])
        sub = T("A counter", SMALL, MUTED).move_to(win.body_center + UP * 0.75)
        stat_l = T("Count", SMALL, MUTED).move_to(win.body_center + LEFT * 1.1 + UP * 0.05)
        num = T("0", 40, TEXT, bold=True).next_to(stat_l, RIGHT, buff=0.35)
        btn_t = T("Add 1", SMALL, TEXT, bold=True)
        btn = rbox(btn_t.width + 0.6, btn_t.height + 0.32, USER, fill=0.25, sw=2, r=0.1)
        btn.move_to(win.body_center + DOWN * 0.72)
        btn_t.move_to(btn)
        card = VGroup(win, sub, stat_l, num, btn, btn_t)
        rx = 3.15

        with self.beat("intro") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.15))
            self.play(FadeIn(card, shift=UP * 0.1), run_time=b.t(0.35))

        with self.beat("actions") as b:
            g = VGroup(chip("get", RUNTIME), T("query", SMALL, MUTED)).arrange(RIGHT, buff=0.2)
            gd = T("returns the count", SMALL, TEXT)
            a = VGroup(chip("add", RUNTIME), T("mutation", SMALL, MUTED)).arrange(RIGHT, buff=0.2)
            ad = T("{ by }: adds that number", SMALL, TEXT)
            col = VGroup(g, gd, a, ad).arrange(DOWN, aligned_edge=LEFT, buff=0.1)
            col.move_to([rx, 2.75, 0], aligned_edge=UL)
            col_a = col
            gd.shift(DOWN * 0.0)
            a.shift(DOWN * 0.15)
            ad.shift(DOWN * 0.15)
            self.play(FadeIn(g), FadeIn(gd), run_time=b.t(0.3))
            self.play(FadeIn(a), FadeIn(ad), run_time=b.t(0.3))
            self.col_a = col

        code = code_block(self.PROGRAM, "text", color=RUNTIME)
        code.to_edge(LEFT, buff=MARGIN).align_to([0, -0.15, 0], UP)
        with self.beat("program") as b:
            hide_lines(code)
            self.add(code)
            self.play(FadeIn(code.background), reveal_lines(code, 0, 5, lag=0.3), run_time=b.t(0.35))
            click = Circle(radius=0.12, stroke_color=USER, stroke_width=3).move_to(btn)
            flow = T("add {by: 1}, then get", SMALL, USER).next_to(btn, RIGHT, buff=0.3)
            self.wait(b.t(0.1))
            self.play(Create(click), Indicate(btn, color=USER), FadeIn(flow), run_time=b.t(0.2))
            self.play(click.animate.scale(3).set_opacity(0), FadeOut(click),
                      Transform(num, T("1", 40, TEXT, bold=True).move_to(num, aligned_edge=LEFT)), run_time=b.t(0.15))
            ill = T("(illustrative click)", SMALL, MUTED).next_to(flow, RIGHT, buff=0.25)
            self.play(FadeIn(ill), run_time=b.t(0.1))

        col_a = self.col_a
        with self.beat("tick") as b:
            c0 = chip("tickMs: 0", RUNTIME)
            c0d = T("the default: timer off", SMALL, TEXT)
            cfg = VGroup(T("config", SMALL, MUTED), c0, c0d).arrange(DOWN, aligned_edge=LEFT, buff=0.1)
            cfg.next_to(col_a, DOWN, buff=0.35, aligned_edge=LEFT)
            self.play(FadeOut(flow), FadeOut(ill), FadeIn(cfg), run_time=b.t(0.2))
            self.wait(b.t(0.15))
            c1 = chip("tickMs: 100", CREATION).move_to(c0, aligned_edge=LEFT)
            c1d = VGroup(T("an interval adds 1", SMALL, TEXT), T("every 100 ms", SMALL, TEXT))
            c1d.arrange(DOWN, aligned_edge=LEFT, buff=0.06).move_to(c0d, aligned_edge=UL)
            self.play(Transform(c0, c1), Transform(c0d, c1d), run_time=b.t(0.12))
            for k in (2, 3, 4, 5):
                self.play(Transform(num, T(str(k), 40, CREATION, bold=True).move_to(num, aligned_edge=LEFT)),
                          run_time=b.t(0.06))
            chk = VGroup(T("runtime check:", SMALL, SOLVED), T("+3 or more in 700 ms", SMALL, SOLVED))
            chk.arrange(DOWN, aligned_edge=LEFT, buff=0.06).next_to(cfg, DOWN, buff=0.2, aligned_edge=LEFT)
            self.play(FadeIn(chk), run_time=b.t(0.12))

        with self.beat("catch") as b:
            ct = VGroup(chip(".catch(...)", ISOLATION), T("catches its own errors:", SMALL, TEXT),
                        T("a Cordis timer does not", SMALL, TEXT))
            ct.arrange(DOWN, aligned_edge=LEFT, buff=0.08)
            ct.move_to(chk, aligned_edge=UL)
            self.play(FadeOut(chk), run_time=b.t(0.12))
            self.play(FadeIn(ct, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("close") as b:
            outline = OutlineDiagram()
            outline.close_part(self, "ctx_widgets", next_key="shell_page", run_time=b.left)
