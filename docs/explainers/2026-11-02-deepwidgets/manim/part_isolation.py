"""Part `part_isolation`: the crash-only host, blame, the claimer, quarantine, the supervisor,
safe mode, and the watchdog.

Scenes, in script order: isolation_why blame_store claimer quarantine supervisor safe_mode watchdog.
Beat weights follow the narration word counts of each sentence group.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content
_X1 = FRAME_W / 2 - MARGIN - 0.1     # right edge of content
_ROW = "include:deepwidgets-widget-groceries"


# ---------------------------------------------------------------- part helpers
def _arrow(a, b, color=TEXT, buff=0.08, sw=3.5):
    return Arrow(a, b, buff=buff, color=color, stroke_width=sw, tip_length=0.18,
                 max_tip_length_to_length_ratio=0.3)


def _down(top, bottom, color=TEXT):
    return _arrow(top.get_bottom(), bottom.get_top(), color)


def _right(left, right, color=TEXT):
    return _arrow(left.get_right(), right.get_left(), color)


def _cross(m, color=ISOLATION, sw=4):
    return VGroup(Line(m.get_corner(UL), m.get_corner(DR), stroke_color=color, stroke_width=sw),
                  Line(m.get_corner(DL), m.get_corner(UR), stroke_color=color, stroke_width=sw))


def _row(*items, buff=0.25):
    return VGroup(*items).arrange(RIGHT, buff=buff)


def _left_at(m, x, y):
    """Put m with its left edge at x and its center at height y."""
    m.move_to([0, y, 0]).align_to([x, 0, 0], LEFT)
    return m


def _chip_color(c, color, fill=0.15):
    """Animations that recolor a chip box (plain or dashed)."""
    return c[0].animate.set_stroke(color).set_fill(color, opacity=fill)


def _grey(c):
    """Animations that grey out a chip: a quarantined or refused widget."""
    return [c[0].animate.set_stroke(OPEN, opacity=0.6).set_fill(OPEN, opacity=0.03),
            c[1].animate.set_opacity(0.45)]


def _ungrey(c, color=RUNTIME):
    return [c[0].animate.set_stroke(color, opacity=1).set_fill(color, opacity=0.15), c[1].animate.set_opacity(1)]


def _swap(scene, old, new, rt):
    """Fade the old panel out, then the new one in."""
    if old is not None and len(old) > 0:
        scene.play(FadeOut(old), run_time=rt / 2)
        scene.play(FadeIn(new, shift=UP * 0.1), run_time=rt / 2)
    else:
        scene.play(FadeIn(new, shift=UP * 0.1), run_time=rt)
    return new


def _host_box(w, h, center, label="host (Node)"):
    box = rbox(w, h, HOST, fill=0.06, sw=3)
    box.move_to(center)
    lab = T(label, LABEL, HOST, bold=True).next_to(box.get_corner(UL), DR, buff=0.15)
    return box, lab


# ====================================================================== isolation_why
class IsolationWhy(DWScene):
    BEATS = [("open", 9), ("risk", 26), ("gates", 11), ("crashonly", 22), ("exit", 10), ("restart", 14),
             ("why", 22), ("swallow", 23), ("numbers", 31)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "isolation", run_time=b.left)

        # left: Electron main above one host with five widgets
        box, hlab = _host_box(5.7, 3.9, [-3.65, -0.6, 0])
        names = ["widget A", "widget B", "widget C", "widget D", "widget E"]
        chips = [chip(n, RUNTIME, size=SMALL, mono=False) for n in names]
        top = _row(*chips[:3], buff=0.25)
        bot = _row(*chips[3:], buff=0.25)
        grid = VGroup(top, bot).arrange(DOWN, buff=0.45).move_to(box).shift(DOWN * 0.2)
        illus = T("names illustrative", SMALL, MUTED).next_to(box, DOWN, buff=0.12).align_to(box, RIGHT)
        em = ProcessBox("Electron main", None, SHELL)
        em.move_to([box.get_x(), 2.42, 0])
        bad = chips[2]
        PX = 0.35  # left edge of the right panel

        with self.beat("risk") as b:
            title = scene_title("Isolation", ISOLATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(box), FadeIn(hlab), run_time=b.t(0.15))
            self.play(LaggedStart(*[FadeIn(c, scale=0.9) for c in chips], lag_ratio=0.2), FadeIn(illus),
                      run_time=b.t(0.2))
            l1 = M('Widget code that an <b>agent</b> writes', LABEL)
            l2 = M(f'runs <b>inside the host</b>, with <span fgcolor="{HOST}">full Node rights</span>', LABEL)
            l3 = M('It can call any server.', LABEL)
            risk = VGroup(l1, l2, l3).arrange(DOWN, buff=0.16, aligned_edge=LEFT)
            _left_at(risk, PX, 2.0)
            self.play(FadeIn(risk, shift=LEFT * 0.15), run_time=b.t(0.25))
            l4 = M(f'<span fgcolor="{ISOLATION}">One bad widget can stop every widget.</span>', LABEL)
            l4.next_to(risk, DOWN, buff=0.35).align_to(risk, LEFT)
            bx = burst(ISOLATION, 0.22).move_to(bad.get_corner(UR))
            self.play(FadeIn(l4), _chip_color(bad, ISOLATION, 0.3), FadeIn(bx, scale=0.5), run_time=b.t(0.2))
            self.play(*[Indicate(c, color=ISOLATION, scale_factor=1.06) for c in chips if c is not bad],
                      run_time=b.t(0.15))

        with self.beat("gates") as b:
            gates = _row(*[chip(g, CREATION, size=SMALL, mono=False) for g in ("compile", "lint", "test run")],
                         buff=0.18)
            gl = T("catch the usual mistakes", SMALL, CREATION)
            gg = VGroup(gates, gl).arrange(DOWN, buff=0.12, aligned_edge=LEFT)
            _left_at(gg, PX, -0.75)
            ns = chip("not a sandbox", ISOLATION, size=LABEL, mono=False, fill=0.25)
            ns.next_to(gg, DOWN, buff=0.3).align_to(gg, LEFT)
            self.play(FadeIn(gg, shift=UP * 0.1), run_time=b.t(0.45))
            self.play(FadeIn(ns, scale=1.1), run_time=b.t(0.3))

        with self.beat("crashonly") as b:
            self.play(FadeOut(VGroup(risk, l4, gg, ns)), run_time=b.t(0.1))
            co = T("crash-only host", HEADING, ISOLATION, bold=True)
            _left_at(co, PX, 2.25)
            trig = VGroup(chip("uncaughtException", ISOLATION), chip("unhandledRejection", ISOLATION))
            trig.arrange(DOWN, buff=0.15, aligned_edge=LEFT).next_to(co, DOWN, buff=0.25).align_to(co, LEFT)
            nogo = M('the host does <b>not</b> try to go on', LABEL).next_to(trig, DOWN, buff=0.25).align_to(co, LEFT)
            self.play(FadeIn(co, shift=RIGHT * 0.15), run_time=b.t(0.25))
            self.play(FadeIn(trig, shift=UP * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(nogo), run_time=b.t(0.2))

        with self.beat("exit") as b:
            s1 = M(f'1. names the guilty widget', LABEL)
            s2 = M(f'2. writes a record <span font_family="{MONO}" fgcolor="{ISOLATION}">crash.json</span>', LABEL)
            s3 = M('3. exits', LABEL)
            steps = VGroup(s1, s2, s3).arrange(DOWN, buff=0.16, aligned_edge=LEFT)
            steps.next_to(nogo, DOWN, buff=0.4).align_to(co, LEFT)
            blame = chip("blame", ISOLATION, size=SMALL, mono=False, fill=0.3).next_to(bad, UP, buff=0.12)
            self.play(FadeIn(s1), FadeIn(blame, shift=DOWN * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(s2), run_time=b.t(0.2))
            self.play(FadeIn(s3), FadeOut(bx), box.animate.set_stroke(opacity=0.15).set_fill(opacity=0.0),
                      hlab.animate.set_opacity(0.2), *[c.animate.set_opacity(0.12) for c in chips],
                      blame.animate.set_opacity(0.12), run_time=b.t(0.3))

        with self.beat("restart") as b:
            s4 = M('4. Electron main starts a <b>new host</b>', LABEL)
            s5 = M(f'5. the new host keeps the guilty widget <span fgcolor="{OPEN}">off</span>', LABEL)
            VGroup(s4, s5).arrange(DOWN, buff=0.16, aligned_edge=LEFT).next_to(steps, DOWN, buff=0.16) \
                .align_to(steps, LEFT)
            a_em = _arrow(em.get_bottom(), box.get_top(), SHELL)
            self.play(FadeIn(em), GrowArrow(a_em), FadeIn(s4), run_time=b.t(0.25))
            off = T("off", SMALL, OPEN, bold=True).next_to(bad, UP, buff=0.12)
            self.play(box.animate.set_stroke(opacity=1).set_fill(opacity=0.06), hlab.animate.set_opacity(1),
                      *[c.animate.set_opacity(1) for c in chips if c is not bad], FadeOut(blame),
                      run_time=b.t(0.3))
            bad.set_opacity(1)
            bad[0].set_stroke(OPEN, opacity=0.6).set_fill(OPEN, opacity=0.03)
            bad[1].set_opacity(0.45)
            self.play(FadeIn(bad), FadeIn(off), FadeIn(s5), run_time=b.t(0.3))

        with self.beat("why") as b:
            self.play(FadeOut(VGroup(co, trig, nogo, steps, s4, s5)), run_time=b.t(0.1))
            q = T("Why not catch the error and go on?", LABEL, TEXT, bold=True)
            _left_at(q, PX, 2.3)
            calls = VGroup(*[chip(c, RUNTIME) for c in ("ctx.timeout", "ctx.interval", "ctx.on")])
            calls.arrange(DOWN, buff=0.18, aligned_edge=LEFT)
            _left_at(calls, PX, 0.95)
            ph = chip("process handlers", ISOLATION, mono=False, size=LABEL)
            ph.move_to([0, calls.get_y(), 0]).align_to([_X1, 0, 0], RIGHT)
            arrs = VGroup(*[_arrow(c.get_right(), ph.get_left(), ISOLATION, sw=2.5) for c in calls])
            note = T("Cordis does not contain these errors", SMALL, TEXT)
            note.next_to(calls, DOWN, buff=0.25).align_to(q, LEFT)
            src = T("standing.checked.cordis_containment", SMALL, MUTED, mono=True)
            src.next_to(note, DOWN, buff=0.1).align_to(q, LEFT)
            self.play(FadeIn(q), run_time=b.t(0.2))
            self.play(LaggedStart(*[FadeIn(c) for c in calls], lag_ratio=0.3), run_time=b.t(0.25))
            self.play(LaggedStart(*[GrowArrow(a) for a in arrs], lag_ratio=0.2), FadeIn(ph), run_time=b.t(0.25))
            self.play(FadeIn(note), FadeIn(src), run_time=b.t(0.15))

        with self.beat("swallow") as b:
            old = ProcessBox("earlier design", "catch there, then go on", MUTED, sub_mono=False)
            old.next_to(src, DOWN, buff=0.35).align_to(q, LEFT)
            self.play(FadeIn(old), run_time=b.t(0.25))
            sw = lines("it could also swallow an error", "in host code that a widget called",
                       size=SMALL, color=ISOLATION)
            sw.next_to(old, DOWN, buff=0.2).align_to(old, LEFT)
            self.play(FadeIn(sw, shift=LEFT * 0.1), run_time=b.t(0.3))
            self.play(Create(_cross(old.box)), run_time=b.t(0.2))
            crossed = self.mobjects[-1]

        with self.beat("numbers") as b:
            self.play(FadeOut(VGroup(q, calls, ph, arrs, note, src, old, sw, crossed)), run_time=b.t(0.08))
            cap = caption("crash-only host; every widget stops about 2 s per crash (project notes)")
            big = M(f'each crash: every widget stops <span fgcolor="{ISOLATION}"><b>~2 s</b></span>', BODY)
            _left_at(big, PX, 2.2)
            pn = T("project notes", SMALL, MUTED).next_to(big, DOWN, buff=0.12).align_to(big, LEFT)
            self.play(FadeIn(cap), FadeIn(big), FadeIn(pn), run_time=b.t(0.15))
            # kill -> new host answers
            k = chip("kill", ISOLATION, mono=False, size=LABEL)
            n = chip("new host answers", SOLVED, mono=False, size=LABEL)
            _left_at(k, PX, 0.6)
            n.move_to([0, 0.6, 0]).align_to([_X1, 0, 0], RIGHT)
            line = _arrow(k.get_right(), n.get_left(), HOST)
            ms = T("1560 ms", BODY, HOST, mono=True, bold=True).next_to(line, UP, buff=0.12)
            pr = T("merged supervisor check, PR #61", SMALL, MUTED)
            pr.next_to(VGroup(k, n), DOWN, buff=0.3).align_to(k, LEFT)
            self.play(FadeIn(k), run_time=b.t(0.08))
            self.play(box.animate.set_stroke(opacity=0.15), hlab.animate.set_opacity(0.2),
                      *[c.animate.set_opacity(0.12) for c in chips if c is not bad], run_time=b.t(0.1))
            self.play(GrowArrow(line), FadeIn(ms), run_time=b.t(0.25))
            self.play(FadeIn(n), FadeIn(pr), box.animate.set_stroke(opacity=1), hlab.animate.set_opacity(1),
                      *[c.animate.set_opacity(1) for c in chips if c is not bad], run_time=b.t(0.12))
            self.play(Indicate(n, color=SOLVED, scale_factor=1.06), run_time=b.t(0.12))


# ====================================================================== blame_store
class BlameStore(DWScene):
    BEATS = [("q", 11), ("als", 29), ("wrap", 25), ("handler", 12), ("timer", 18), ("key", 29), ("spec", 28),
             ("private", 20), ("misblame", 21)]

    def construct(self):
        with self.beat("q") as b:
            title = scene_title("Blame: which widget failed?", ISOLATION)
            als = T("AsyncLocalStorage", HEADING, ISOLATION, mono=True, bold=True)
            als.move_to([0, 0.3, 0])
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.35))
            self.play(FadeIn(als, scale=0.9), run_time=b.t(0.35))

        with self.beat("als") as b:
            self.play(als.animate.scale(LABEL / HEADING).move_to([0, 2.45, 0]).align_to([_X0, 0, 0], LEFT),
                      run_time=b.t(0.12))
            d1 = VGroup(M('a Node feature: it keeps one value across all the <b>timers</b>, <b>promises</b>,', LABEL),
                        M('and <b>callbacks</b> that one piece of code starts', LABEL))
            d1.arrange(DOWN, buff=0.12, aligned_edge=LEFT).next_to(als, DOWN, buff=0.25).align_to(als, LEFT)
            self.play(FadeIn(d1), run_time=b.t(0.2))
            # abstract demo: one value spreads to the work that the code starts
            v = chip("value", ISOLATION, mono=False, size=LABEL, fill=0.3).move_to([0, 0.75, 0])
            kids = VGroup(*[chip(k, RUNTIME, mono=False, size=LABEL) for k in ("timer", "promise", "callback")])
            kids.arrange(RIGHT, buff=1.6).move_to([0, -0.45, 0])
            fan = VGroup(*[_arrow(v.get_bottom(), k.get_top(), ISOLATION, sw=2.5) for k in kids])
            tags = VGroup(*[chip("value", ISOLATION, mono=False, size=SMALL, fill=0.3).next_to(k, DOWN, buff=0.1)
                            for k in kids])
            self.play(FadeIn(v), run_time=b.t(0.12))
            self.play(LaggedStart(*[AnimationGroup(GrowArrow(a), FadeIn(k)) for a, k in zip(fan, kids)],
                                  lag_ratio=0.3), run_time=b.t(0.25))
            self.play(LaggedStart(*[TransformFromCopy(v, t) for t in tags], lag_ratio=0.25), run_time=b.t(0.18))
            here = M(f'Here the value is the <span fgcolor="{RUNTIME}">id of the widget row</span>', LABEL)
            here.move_to([0, -2.0, 0])
            self.play(FadeIn(here), run_time=b.t(0.12))
            demo = VGroup(v, kids, fan, tags, here)

        # the store wrap around one plugin body
        outer = rbox(_X1 - _X0, 3.05, ISOLATION, fill=0.05, sw=3)
        outer.move_to([(_X0 + _X1) / 2, 0.55, 0])
        head = T(f"blameStore.run('{_ROW}', () => …)", SMALL, ISOLATION, mono=True)
        head.next_to(outer.get_corner(UL), DR, buff=0.18)
        pb = T("plugin body of the widget row", SMALL, MUTED).next_to(head, DOWN, buff=0.14).align_to(head, LEFT)
        items = [chip("ctx.timeout(…)", RUNTIME), chip("fetch(…).then(…)", RUNTIME), chip("ctx.on(…)", RUNTIME)]
        kinds = ["timer", "promise", "listener"]
        cols = []
        for i, (it, kd) in enumerate(zip(items, kinds)):
            x = -4.4 + 4.4 * i
            it.move_to([x, 0.35, 0])
            k = T(kd, SMALL, MUTED).next_to(it, UP, buff=0.1)
            tg = chip("widget-groceries", ISOLATION, size=SMALL, fill=0.25).next_to(it, DOWN, buff=0.12)
            cols.append((it, k, tg))
        PY = [-1.35, -1.95, -2.55]  # rows of the bottom panel

        with self.beat("wrap") as b:
            self.play(FadeOut(demo), FadeOut(d1), run_time=b.t(0.12))
            self.play(Create(outer), FadeIn(head), run_time=b.t(0.25))
            self.play(FadeIn(pb), LaggedStart(*[FadeIn(VGroup(it, k)) for it, k, _ in cols], lag_ratio=0.25),
                      run_time=b.t(0.25))
            wr = _row(chip("WIDGET_ROW = /^deepwidgets-widget-/", RUNTIME),
                      T("a widget row: its id matches", SMALL, TEXT), buff=0.3)
            _left_at(wr, _X0, PY[0])
            fit(wr, w=_X1 - _X0)
            self.play(FadeIn(wr, shift=UP * 0.1), run_time=b.t(0.25))

        with self.beat("handler") as b:
            hd = chip("runAs(entry.registration.row, () => action.handler(args, scope))", ISOLATION)
            _left_at(hd, _X0, PY[1])
            hn = T("each action handler runs in the store of its row", SMALL, TEXT)
            _left_at(hn, _X0, PY[2])
            self.play(FadeIn(hd, shift=UP * 0.1), run_time=b.t(0.5))
            self.play(FadeIn(hn), run_time=b.t(0.3))

        with self.beat("timer") as b:
            self.play(LaggedStart(*[FadeIn(tg, shift=DOWN * 0.1) for _, _, tg in cols], lag_ratio=0.25),
                      run_time=b.t(0.35))
            t0 = cols[0][0]
            fired = T("fires later: same row id", SMALL, ISOLATION)
            fired.next_to(cols[0][2], DOWN, buff=0.1).align_to(cols[0][2], LEFT)
            self.play(Flash(t0.get_right(), color=RUNTIME, line_length=0.18, flash_radius=0.3),
                      Indicate(cols[0][2], color=ISOLATION, scale_factor=1.08), run_time=b.t(0.3))
            self.play(FadeIn(fired), run_time=b.t(0.2))

        with self.beat("key") as b:
            self.play(FadeOut(VGroup(wr, hd, hn)), run_time=b.t(0.1))
            ok = _row(status_chip("blame key: Loader row id", solved=True),
                      T(_ROW, SMALL, TEXT, mono=True), buff=0.25)
            _left_at(ok, _X0, PY[0])
            nm = chip("plugin name", OPEN, mono=False, size=SMALL)
            nmx = _cross(nm[0])
            nmt = M('not the plugin <span font_family="' + MONO + '">name</span>: a bundle can export any name',
                    SMALL)
            nrow = _row(VGroup(nm, nmx), nmt, buff=0.25)
            _left_at(nrow, _X0, PY[1])
            why = T("a name key would let one bundle get another widget blocked", SMALL, ISOLATION)
            _left_at(why, _X0, PY[2])
            self.play(FadeIn(ok, shift=UP * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(nrow), run_time=b.t(0.2))
            self.play(Create(nmx), FadeIn(why), run_time=b.t(0.25))
            keyp = VGroup(ok, nrow, why)

        with self.beat("spec") as b:
            sc = chip("widget_phase2.creation.rows", OPEN, dashed=True)
            st = T("spec: each agent bundle gets its own row id", SMALL, TEXT)
            ag = chip("deepwidgets-agent-<slug>", AGENT)
            srow = _row(sc, st, buff=0.3)
            _left_at(srow, _X0, PY[0])
            ag.next_to(st, DOWN, buff=0.15).align_to(st, LEFT)
            srow.add(ag)
            pr = _row(status_chip("PR #67 · open", solved=False),
                      M(f'code at <span font_family="{MONO}">108d663f</span> still uses '
                        f'<span font_family="{MONO}">deepwidgets-widget-&lt;slug&gt;</span>', SMALL), buff=0.3)
            _left_at(pr, _X0, PY[2] - 0.05)
            self.play(FadeOut(keyp), run_time=b.t(0.1))
            self.play(FadeIn(srow, shift=UP * 0.1), run_time=b.t(0.35))
            self.play(FadeIn(pr, shift=UP * 0.1), run_time=b.t(0.35))
            specp = VGroup(srow, pr)

        with self.beat("private") as b:
            wn = chip("fiber._runner.execute", ISOLATION, fill=0.3)
            wt = T("undocumented: a private part of Cordis, the fiber runner", SMALL, TEXT)
            wrow = _row(wn, wt, buff=0.3)
            _left_at(wrow, _X0, PY[0])
            np_ = T("Cordis has no public hook around a plugin body", SMALL, MUTED)
            _left_at(np_, _X0, PY[1])
            self.play(FadeOut(specp), run_time=b.t(0.1))
            self.play(FadeIn(wrow, shift=UP * 0.1), run_time=b.t(0.35))
            self.play(FadeIn(np_), run_time=b.t(0.25))

        with self.beat("misblame") as b:
            mb = chip("misblame (spike)", ISOLATION, mono=False, fill=0.3)
            ht = chip("host timer", HOST)
            htag = chip("widget-groceries", ISOLATION, size=SMALL, fill=0.25)
            mrow = _row(mb, ht, htag, buff=0.3)
            _left_at(mrow, _X0, PY[1] - 0.05)
            mt = T("host code first makes the timer inside a widget call: it carries that widget's store",
                   SMALL, TEXT)
            _left_at(mt, _X0, PY[2] - 0.05)
            fit(mt, w=_X1 - _X0)
            self.play(FadeOut(np_), FadeIn(mb), run_time=b.t(0.25))
            self.play(FadeIn(ht), FadeIn(htag, shift=LEFT * 0.2), run_time=b.t(0.3))
            self.play(FadeIn(mt), run_time=b.t(0.25))


# ====================================================================== claimer
class Claimer(DWScene):
    BEATS = [("hook", 43), ("claim", 27), ("write", 41), ("exit", 26), ("table", 34)]

    RECORD = f'''{{
  "row": "{_ROW}",
  "slugs": ["groceries"],
  "error": {{ "name": "Error", "message": "…" }},
  "at": 1762070000000,
  "method": "store",
  "root": "…/groceries",
  "hash": "…",
  "pid": 41873,
  "applied": false
}}'''

    FAULTS = [("timer-throw", "store", "64"), ("interval-throw", "store", "62"), ("promise-reject", "store", "63"),
              ("fetch-reject", "store", "18"), ("listener-throw", "stack", "100"), ("service-throw", "store", "61"),
              ("service-reject", "store", "62"), ("string-throw", "store", "62"), ("host-throw", "none", "61")]

    def construct(self):
        with self.beat("hook") as b:
            title = scene_title("The claimer", ISOLATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.06))
            n1 = chip("uncaughtException", ISOLATION, size=LABEL)
            n2 = ProcessBox("DSH fail-loud handler", "installFailLoud diagnostic", HOST)
            n3 = chip("Symbol.for('deepwidgets.fatal.hooks')", ISOLATION)
            n4 = ProcessBox("claim()", None, ISOLATION, title_size=BODY, fill=0.2)
            col = VGroup(n1, n2, n3, n4).arrange(DOWN, buff=0.55).move_to([-1.6, 0.0, 0])
            arrs = [_down(a, c) for a, c in zip([n1, n2, n3], [n2, n3, n4])]
            self.play(FadeIn(n1), run_time=b.t(0.1))
            self.play(GrowArrow(arrs[0]), FadeIn(n2), run_time=b.t(0.14))
            fl = T("reports a fatal error", SMALL, MUTED).next_to(n2, RIGHT, buff=0.3)
            self.play(FadeIn(fl), run_time=b.t(0.08))
            self.play(GrowArrow(arrs[1]), FadeIn(n3), run_time=b.t(0.14))
            trim = chip("deepwidgets-trim", OPEN, size=SMALL).next_to(n3, RIGHT, buff=0.3)
            hk = T("the hook that deepWidgets adds", SMALL, MUTED).next_to(trim, DOWN, buff=0.1).align_to(trim, LEFT)
            self.play(FadeIn(trim), FadeIn(hk), run_time=b.t(0.12))
            self.play(GrowArrow(arrs[2]), FadeIn(n4), run_time=b.t(0.12))
            ctxn = lines("after the DSH report,", "in the async context of the error", size=SMALL, color=TEXT)
            ctxn.next_to(n4, RIGHT, buff=0.35)
            self.play(FadeIn(ctxn), run_time=b.t(0.12))

        with self.beat("claim") as b:
            self.play(FadeOut(VGroup(n1, n2, n3, arrs[0], arrs[1], arrs[2], fl, trim, hk, ctxn)),
                      n4.animate.move_to([0, 2.25, 0]).align_to([_X0, 0, 0], LEFT), run_time=b.t(0.15))
            q1 = chip("store has a row?", ISOLATION, mono=False)
            q2 = chip("widget package folder in the stack?", ISOLATION, mono=False)
            q3 = chip("else", ISOLATION, mono=False)
            qs = _row(q1, q2, q3, buff=0.75).move_to([0, 0.4, 0])
            qa = [_right(q1, q2, MUTED), _right(q2, q3, MUTED)]
            no = [T("no", SMALL, MUTED).next_to(a, UP, buff=0.06) for a in qa]
            r1 = chip("blame the row · store", RUNTIME, mono=False, size=SMALL)
            r2 = chip("blame the row · stack", RUNTIME, mono=False, size=SMALL)
            r3 = chip("no widget", OPEN, mono=False, size=SMALL)
            rs = []
            for q, r in zip((q1, q2, q3), (r1, r2, r3)):
                r.next_to(q, DOWN, buff=0.8)
                rs.append(_down(q, r, MUTED))
            yes = [T("yes", SMALL, MUTED).next_to(a, RIGHT, buff=0.08) for a in rs[:2]]
            a_in = _arrow(n4.get_bottom(), q1.get_top(), ISOLATION)
            self.play(GrowArrow(a_in), FadeIn(q1), run_time=b.t(0.15))
            self.play(GrowArrow(rs[0]), FadeIn(yes[0]), FadeIn(r1), run_time=b.t(0.15))
            self.play(GrowArrow(qa[0]), FadeIn(no[0]), FadeIn(q2), run_time=b.t(0.15))
            self.play(GrowArrow(rs[1]), FadeIn(yes[1]), FadeIn(r2), run_time=b.t(0.15))
            self.play(GrowArrow(qa[1]), FadeIn(no[1]), FadeIn(q3), GrowArrow(rs[2]), FadeIn(r3),
                      run_time=b.t(0.2))
            chain = VGroup(a_in, q1, q2, q3, *qa, *no, r1, r2, r3, *rs, *yes)

        with self.beat("write") as b:
            self.play(FadeOut(chain), run_time=b.t(0.08))
            js = json_block(self.RECORD, color=ISOLATION)
            js.move_to([0, 0, 0]).align_to([_X1, 0, 0], RIGHT).align_to([0, CONTENT_TOP - 0.1, 0], UP)
            hide_lines(js)
            jl = T("crash.json · values illustrative", SMALL, MUTED).next_to(js, DOWN, buff=0.1).align_to(js, RIGHT)
            tmp = chip("temp file", ISOLATION, mono=False)
            dst = chip("crash.json", ISOLATION)
            _left_at(tmp, _X0, 0.9)
            dst.next_to(tmp, DOWN, buff=0.75).align_to(tmp, LEFT)
            a_w = _down(n4, tmp, ISOLATION)
            a_r = _down(tmp, dst, ISOLATION)
            wl = T("one sync write", SMALL, TEXT).next_to(a_w, RIGHT, buff=0.12)
            rl = T("rename", SMALL, TEXT).next_to(a_r, RIGHT, buff=0.12)
            self.play(GrowArrow(a_w), FadeIn(tmp), FadeIn(wl), run_time=b.t(0.14))
            self.play(GrowArrow(a_r), FadeIn(dst), FadeIn(rl), run_time=b.t(0.12))
            self.add(js)
            self.play(FadeIn(jl), reveal_lines(js, 0, 1), run_time=b.t(0.05))
            self.play(reveal_lines(js, 1, 6, lag=0.3), run_time=b.t(0.3))
            self.play(reveal_lines(js, 6, 11, lag=0.3), run_time=b.t(0.3))

        with self.beat("exit") as b:
            self.play(FadeOut(VGroup(js, jl, tmp, wl, rl, a_r, a_w)), dst.animate.next_to(n4, DOWN, buff=0.35)
                      .align_to(n4, LEFT), run_time=b.t(0.12))
            ex = chip("process.exit(1)", ISOLATION, size=BODY, fill=0.3)
            ex.next_to(n4, RIGHT, buff=1.6)
            a_x = _arrow(n4.get_right(), ex.get_left(), ISOLATION)
            at_once = T("at once", SMALL, ISOLATION).next_to(a_x, UP, buff=0.08)
            self.play(GrowArrow(a_x), FadeIn(ex), FadeIn(at_once), run_time=b.t(0.2))
            sk = ProcessBox("DSH cleanup", "fiber dispose", MUTED, sub_mono=True)
            sk.next_to(ex, DOWN, buff=0.45).align_to(ex, LEFT)
            skx = _cross(sk.box)
            skl = T("skipped", SMALL, ISOLATION).next_to(sk, RIGHT, buff=0.3)
            self.play(FadeIn(sk), run_time=b.t(0.15))
            self.play(Create(skx), FadeIn(skl), run_time=b.t(0.15))
            # time scale: 2 units per second
            BX = _X0 + 3.2
            e_bar = Rectangle(width=0.06, height=0.32, stroke_width=0, fill_color=ISOLATION, fill_opacity=0.9)
            e_bar.move_to([BX, -1.3, 0], aligned_edge=LEFT)
            c_bar = Rectangle(width=2.9 * 2, height=0.32, stroke_color=MUTED, stroke_width=2, fill_color=MUTED,
                              fill_opacity=0.25).move_to([BX, -1.95, 0], aligned_edge=LEFT)
            e_l = T("exit at once", SMALL, TEXT).move_to([0, -1.3, 0]).align_to([BX - 0.25, 0, 0], RIGHT)
            c_l = T("DSH cleanup", SMALL, MUTED).move_to([0, -1.95, 0]).align_to([BX - 0.25, 0, 0], RIGHT)
            c_t = T("~2.9 s on the desktop host (spike)", SMALL, MUTED).next_to(c_bar, DOWN, buff=0.12) \
                .align_to(c_bar, LEFT)
            self.play(FadeIn(e_l), FadeIn(e_bar), FadeIn(c_l), GrowFromEdge(c_bar, LEFT), FadeIn(c_t),
                      run_time=b.t(0.3))
            bars = VGroup(e_bar, c_bar, e_l, c_l, c_t)

        with self.beat("table") as b:
            self.play(FadeOut(VGroup(n4, dst, ex, a_x, at_once, sk, skx, skl, bars)), run_time=b.t(0.06))
            colors = {(i, 1): (OPEN if r[1] == "none" else RUNTIME) for i, r in enumerate(self.FAULTS)}
            tbl = RevealTable(["fault", "blame by", "ms to exit"], self.FAULTS, mono_cols=[0, 1, 2],
                              cell_colors=colors, size=LABEL, row_gap=0.16)
            tbl.move_to([0, 0, 0]).align_to([_X0, 0, 0], LEFT).align_to([0, CONTENT_TOP - 0.05, 0], UP)
            self.add(tbl)
            src = T("tools/widgets-blame.mjs · run of record 8b9c8672", SMALL, MUTED, mono=True)
            src.next_to(tbl, DOWN, buff=0.18).align_to(tbl, LEFT)
            self.play(tbl.reveal_rows(0, 9, lag=0.3), FadeIn(src), run_time=b.t(0.45))
            PXr = tbl.get_right()[0] + 0.6
            s1 = status_chip("8 of 9: the widget is blamed", solved=True)
            s2 = chip("host-throw: no widget", OPEN, mono=False)
            s3 = VGroup(T("fault to exit:", LABEL, TEXT),
                        T("about 20 to 100 ms", LABEL, ISOLATION, bold=True)).arrange(DOWN, buff=0.08,
                                                                                   aligned_edge=LEFT)
            o1 = T("other runs:", SMALL, MUTED)
            o2 = T("19 to 98 ms at 47b515dc", SMALL, MUTED)
            o3 = T("19 to 103 ms at 108d663f", SMALL, MUTED)
            side = VGroup(s1, s2, s3, VGroup(o1, o2, o3).arrange(DOWN, buff=0.08, aligned_edge=LEFT))
            side.arrange(DOWN, buff=0.3, aligned_edge=LEFT)
            _left_at(side, PXr, 0.6)
            fit(side, w=_X1 - PXr)
            self.play(FadeIn(s1), run_time=b.t(0.1))
            self.play(Create(tbl.mark_row(8, OPEN)), FadeIn(s2), run_time=b.t(0.12))
            self.play(FadeIn(s3), FadeIn(side[3]), run_time=b.t(0.12))


# ====================================================================== quarantine
class Quarantine(DWScene):
    BEATS = [("apply", 34), ("failed", 22), ("routes", 33), ("others", 6), ("lift", 39), ("noexit", 18)]

    def construct(self):
        with self.beat("apply") as b:
            title = scene_title("Quarantine", ISOLATION)
            h = ProcessBox("next host starts", None, HOST)
            c1 = chip("crash.json { applied: false }", ISOLATION, size=LABEL)
            q = chip("quarantine.json [ { row, slugs, reason, hash } ]", ISOLATION, size=LABEL, fill=0.3)
            c2 = chip("crash.json { applied: true }", OPEN, size=LABEL)
            col = VGroup(h, c1, q, c2).arrange(DOWN, buff=0.8).move_to([-1.0, 0.0, 0])
            a = [_down(x, y, ISOLATION) for x, y in zip([h, c1, q], [c1, q, c2])]
            l1 = T("reads the crash record", SMALL, TEXT).next_to(a[0], RIGHT, buff=0.2)
            l2 = T("names a row, not yet applied: move the row", SMALL, TEXT).next_to(a[1], RIGHT, buff=0.2)
            l3 = T("mark the record applied", SMALL, TEXT).next_to(a[2], RIGHT, buff=0.2)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(h), run_time=b.t(0.1))
            self.play(GrowArrow(a[0]), FadeIn(l1), FadeIn(c1), run_time=b.t(0.2))
            self.play(GrowArrow(a[1]), FadeIn(l2), FadeIn(q), run_time=b.t(0.3))
            self.play(GrowArrow(a[2]), FadeIn(l3), FadeIn(c2), run_time=b.t(0.25))
            flow = VGroup(h, c1, q, c2, *a, l1, l2, l3)

        g = chip("groceries", RUNTIME, size=LABEL)
        s = chip("sample", RUNTIME, size=LABEL)
        _left_at(g, _X0, 2.3)
        _left_at(s, _X0, 1.6)
        with self.beat("failed") as b:
            self.play(FadeOut(flow), run_time=b.t(0.1))
            self.play(FadeIn(g), FadeIn(s), run_time=b.t(0.15))
            nc = T("loads with no code", SMALL, ISOLATION)
            self.play(*_grey(g), run_time=b.t(0.2))
            ft = T("failed: quarantined after a crash …", SMALL, ISOLATION, mono=True)
            ft.next_to(g, RIGHT, buff=0.3)
            nc.next_to(ft, RIGHT, buff=0.4)
            self.play(FadeIn(ft, shift=LEFT * 0.1), FadeIn(nc), run_time=b.t(0.35))

        with self.beat("routes") as b:
            rts = VGroup()
            for i, rname in enumerate(("/call", "/program")):
                y = 0.3 - 0.7 * i
                rc = _left_at(chip(rname, SHELL), _X0, y)
                ar = _arrow([_X0 + 2.05, y, 0], [_X0 + 2.75, y, 0], ISOLATION, buff=0)
                ans = _left_at(chip("503 widget-failed", ISOLATION, fill=0.25), _X0 + 2.9, y)
                rts.add(VGroup(rc, ar, ans))
            self.play(LaggedStart(*[FadeIn(r, shift=UP * 0.1) for r in rts], lag_ratio=0.4), run_time=b.t(0.35))
            hx = 1.0
            st = chip("hello { programRev: -1 }", HOST)
            _left_at(st, hx + 1.05, 0.3)
            stl = T("stream", SMALL, MUTED).next_to(st, LEFT, buff=0.2)
            st = VGroup(stl, st)
            sn = lines("the page loads the program again", "when the widget comes back", size=SMALL, color=TEXT)
            sn.next_to(st, DOWN, buff=0.18).align_to(st, LEFT)
            self.play(FadeIn(st, shift=UP * 0.1), run_time=b.t(0.3))
            self.play(FadeIn(sn), run_time=b.t(0.25))

        with self.beat("others") as b:
            rn = T("runs as normal", SMALL, SOLVED).next_to(s, RIGHT, buff=0.3)
            self.play(Indicate(s, color=SOLVED, scale_factor=1.08), FadeIn(rn), run_time=b.t(0.7))

        with self.beat("lift") as b:
            q2 = T("How does a widget leave the quarantine?", LABEL, TEXT, bold=True)
            _left_at(q2, _X0, -1.4)
            hd = M(f'<b>hash</b> (SHA-256) of the package files: a short fingerprint of data', SMALL)
            _left_at(hd, _X0, -1.95)
            lc = chip("sha256(files) != stored hash", ISOLATION)
            lt = T("files changed: the next load runs the widget", SMALL, SOLVED)
            lr = _row(lc, _arrow(LEFT * 0.35, RIGHT * 0.35, SOLVED, buff=0), lt, buff=0.15)
            _left_at(lr, _X0, -2.55)
            self.play(FadeIn(q2), run_time=b.t(0.15))
            self.play(FadeIn(hd), run_time=b.t(0.2))
            self.play(FadeIn(lc), run_time=b.t(0.15))
            self.play(FadeIn(lr[1:]), *_ungrey(g), FadeOut(ft), FadeOut(nc), rts.animate.set_opacity(0.3),
                      st.animate.set_opacity(0.3), sn.animate.set_opacity(0.3), run_time=b.t(0.25))
            self.play(Indicate(g, color=SOLVED, scale_factor=1.1), run_time=b.t(0.15))

        with self.beat("noexit") as b:
            self.play(FadeOut(VGroup(hd, lr)), run_time=b.t(0.12))
            nw = chip("crashes before it registers", OPEN, mono=False, dashed=True)
            nt = T("no package folder: it cannot leave by a hash change", SMALL, ISOLATION)
            nr = _row(nw, nt, buff=0.3)
            _left_at(nr, _X0, -2.2)
            self.play(FadeIn(nw), run_time=b.t(0.3))
            self.play(FadeIn(nt, shift=LEFT * 0.1), run_time=b.t(0.3))


# ====================================================================== supervisor
class Supervisor(DWScene):
    BEATS = [("owns", 37), ("read", 35), ("blamed", 20), ("unblamed", 30), ("restart", 21)]

    MS = 7.0 / 8000  # units per millisecond on the restart bars

    def construct(self):
        BX = -2.8  # bars start here

        def bar(ms, y, color, label):
            r = Rectangle(width=max(0.05, ms * self.MS), height=0.3, stroke_width=0, fill_color=color,
                          fill_opacity=0.85)
            r.move_to([BX, y, 0], aligned_edge=LEFT)
            t = T(f"{ms} ms", SMALL, TEXT, mono=True).next_to(r, RIGHT, buff=0.15)
            lab = T(label, SMALL, TEXT)
            lab.move_to([0, y, 0]).align_to([BX - 0.25, 0, 0], RIGHT)
            return VGroup(r, t, lab)

        with self.beat("owns") as b:
            title = scene_title("The supervisor", ISOLATION)
            em = ProcessBox("Electron main", "DesktopHostSupervisor", SHELL, title_size=LABEL)
            _left_at(em, _X0, 2.25)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(em), run_time=b.t(0.15))
            r1 = M(f'<span fgcolor="{SOLVED}"><b>owned</b></span>: a host exit after the first host was ready',
                   LABEL)
            r2 = M(f'<span fgcolor="{ISOLATION}"><b>not owned</b></span>: a host that cannot boot fails loudly at once',
                   LABEL)
            r3 = M(f'for example, a taken port still shows its error', SMALL, MUTED)
            rules = VGroup(r1, r2, r3).arrange(DOWN, buff=0.22, aligned_edge=LEFT)
            _left_at(rules, _X0, 0.3)
            fit(rules, w=_X1 - _X0)
            # a host life line: boot, then the first ready
            ty, tx0, tx1, tr = -1.45, _X0 + 0.3, _X1 - 0.3, -0.4
            boot = Line([tx0, ty, 0], [tr, ty, 0], stroke_color=ISOLATION, stroke_width=6)
            life = Line([tr, ty, 0], [tx1, ty, 0], stroke_color=SOLVED, stroke_width=6)
            rdy = Line([tr, ty - 0.3, 0], [tr, ty + 0.3, 0], stroke_color=TEXT, stroke_width=3)
            rdl = T("first host ready", SMALL, TEXT).next_to(rdy, UP, buff=0.1)
            bl_ = T("boot fails: loud error at once", SMALL, ISOLATION).next_to(boot, DOWN, buff=0.18)
            lf_ = T("host exit: the supervisor owns it", SMALL, SOLVED).next_to(life, DOWN, buff=0.18)
            self.play(FadeIn(r1, shift=UP * 0.1), Create(rdy), FadeIn(rdl), Create(life), FadeIn(lf_),
                      run_time=b.t(0.3))
            self.play(FadeIn(r2, shift=UP * 0.1), Create(boot), FadeIn(bl_), run_time=b.t(0.25))
            self.play(FadeIn(r3), run_time=b.t(0.15))
            rules.add(boot, life, rdy, rdl, bl_, lf_)

        with self.beat("read") as b:
            self.play(FadeOut(rules), run_time=b.t(0.08))
            hx = chip("host exits", HOST, mono=False, size=LABEL)
            rd = chip("read crash.json", ISOLATION, size=LABEL)
            hx.move_to([0, em.get_y(), 0]).align_to(em, LEFT).shift(RIGHT * (em.width + 0.9))
            rd.next_to(hx, RIGHT, buff=0.9)
            a1 = _right(hx, rd, ISOLATION)
            self.play(FadeIn(hx), GrowArrow(a1), FadeIn(rd), run_time=b.t(0.2))
            prov = chip("+ provisional.json, only for an abort exit (scene watchdog)", OPEN, size=SMALL,
                        mono=False, dashed=True)
            _left_at(prov, _X0, 1.4)
            cond = chip("pid == dead child pid && !applied && row", ISOLATION, size=LABEL, fill=0.08)
            cond.move_to([0, 0.45, 0])
            a2 = _arrow(rd.get_bottom() + RIGHT * 0.5, cond.get_top() + RIGHT * 3.2, ISOLATION)
            self.play(GrowArrow(a2), FadeIn(cond), run_time=b.t(0.3))
            bl = chip("blamed", ISOLATION, mono=False, size=LABEL, fill=0.3)
            ub = chip("unblamed", HOST, mono=False, size=LABEL, fill=0.2)
            bl.move_to([-3.6, -0.4, 0])
            ub.move_to([3.0, -0.4, 0])
            ab = _arrow(cond.get_bottom() + LEFT * 1.5, bl.get_top(), ISOLATION, sw=3)
            au = _arrow(cond.get_bottom() + RIGHT * 1.5, ub.get_top(), HOST, sw=3)
            yl = T("true", SMALL, MUTED).next_to(ab, LEFT, buff=0.1)
            nl = T("false", SMALL, MUTED).next_to(au, RIGHT, buff=0.1)
            self.play(GrowArrow(ab), FadeIn(bl), FadeIn(yl), GrowArrow(au), FadeIn(ub), FadeIn(nl),
                      run_time=b.t(0.25))
            self.play(FadeIn(prov), run_time=b.t(0.12))

        with self.beat("blamed") as b:
            b0 = bar(500, -1.2, ISOLATION, "blamed")
            nc = T("not counted · the quarantine handles it", SMALL, ISOLATION).next_to(b0[1], RIGHT, buff=0.3)
            self.play(FadeIn(b0[2]), GrowFromEdge(b0[0], LEFT), FadeIn(b0[1]), run_time=b.t(0.4))
            self.play(FadeIn(nc), run_time=b.t(0.3))

        with self.beat("unblamed") as b:
            hdr = T("unblamed crashes in the last 60 s: they count", SMALL, HOST)
            hdr.move_to([0, -1.68, 0]).align_to([BX, 0, 0], LEFT)
            bars = [bar(500, -2.08, HOST, "1st"), bar(2000, -2.48, HOST, "2nd"), bar(8000, -2.88, HOST, "3rd")]
            self.play(FadeIn(hdr), run_time=b.t(0.15))
            for i, br in enumerate(bars):
                self.play(FadeIn(br[2]), GrowFromEdge(br[0], LEFT), FadeIn(br[1]), run_time=b.t(0.22))

        with self.beat("restart") as b:
            self.play(FadeOut(VGroup(cond, a2, ab, au, yl, nl, prov, bl, ub)), run_time=b.t(0.1))
            st = chip("backend.start", SHELL)
            nv = chip("navigateMain", SHELL)
            rr = _row(st, _arrow(LEFT * 0.3, RIGHT * 0.3, SHELL, buff=0), nv, buff=0.15)
            rr.move_to([0, 0.75, 0]).align_to(em, LEFT)
            rl = T("new host, main window loads again", SMALL, TEXT).next_to(rr, DOWN, buff=0.12).align_to(rr, LEFT)
            self.play(FadeIn(rr, shift=UP * 0.1), FadeIn(rl), run_time=b.t(0.3))
            w1 = window_card("sample", w=1.9, h=1.15)
            w2 = window_card("groceries", w=1.9, h=1.15)
            ws = _row(w1, w2, buff=0.25).move_to([0, 0.5, 0]).align_to([_X1, 0, 0], RIGHT)
            wl = T("widget windows stay open, pages reconnect", SMALL, SHELL)
            wl.next_to(ws, DOWN, buff=0.12).align_to(ws, RIGHT)
            self.play(FadeIn(ws), run_time=b.t(0.25))
            self.play(FadeIn(wl), run_time=b.t(0.2))


# ====================================================================== safe_mode
class SafeMode(DWScene):
    BEATS = [("flag", 23), ("refuse", 31), ("builtin", 42), ("giveup", 29)]

    ROWS = [("0 s", "blamed", "0", "500 ms", "false"),
            ("1 s", "unblamed", "1", "500 ms", "false"),
            ("5 s", "unblamed", "2", "2000 ms", "true"),
            ("15 s", "unblamed", "3", "8000 ms", "true"),
            ("30 s", "unblamed", "4", "give-up", "–"),
            ("100 s", "unblamed", "1 (window passed)", "500 ms", "false")]

    def construct(self):
        PY = [-1.0, -1.65, -2.3]
        with self.beat("flag") as b:
            title = scene_title("Safe mode", ISOLATION)
            src = T("real HostCrashPolicy, fake clock (worked example)", SMALL, MUTED)
            src.move_to([0, TITLE_Y, 0]).align_to([_X1, 0, 0], RIGHT)
            colors = {(i, 4): ISOLATION for i in (2, 3)}
            colors.update({(4, 3): ISOLATION, (0, 1): ISOLATION})
            tbl = RevealTable(["time", "crash", "unblamed in 60 s", "restart after", "safe mode"], self.ROWS,
                              mono_cols=[0, 2, 3, 4], cell_colors=colors, size=LABEL, row_gap=0.14)
            tbl.move_to([0, 0, 0]).align_to([0, CONTENT_TOP - 0.05, 0], UP).align_to([_X0, 0, 0], LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(src), run_time=b.t(0.1))
            self.add(tbl)
            self.play(tbl.reveal_rows(0, 3, lag=0.4), run_time=b.t(0.35))
            mk = tbl.mark_row(2, ISOLATION)
            self.play(Create(mk), run_time=b.t(0.12))
            em = chip("Electron main", SHELL, mono=False)
            env = chip("DEEPWIDGETS_SAFE_MODE=1", HOST, fill=0.25)
            hs = chip("host environment", HOST, mono=False)
            fr = _row(em, _arrow(LEFT * 0.35, RIGHT * 0.35, SHELL, buff=0), env,
                      _arrow(LEFT * 0.35, RIGHT * 0.35, HOST, buff=0), hs, buff=0.15)
            _left_at(fr, _X0, PY[0])
            self.play(FadeIn(fr, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("refuse") as b:
            self.play(tbl.reveal_row(3), run_time=b.t(0.15))
            rf = T("the runtime refuses each widget that is not built in", LABEL, TEXT)
            _left_at(rf, _X0, PY[1])
            self.play(FadeIn(rf), run_time=b.t(0.25))
            on = chip("sample", RUNTIME)
            off = chip("groceries", RUNTIME)
            offt = T("off: safe mode · no routes · no window", SMALL, ISOLATION)
            lrow = _row(on, T("on", SMALL, SOLVED), off, offt, buff=0.25)
            _left_at(lrow, _X0, PY[2])
            self.play(FadeIn(lrow[:3]), run_time=b.t(0.2))
            self.play(*_grey(off), FadeIn(offt), run_time=b.t(0.25))
            panel = VGroup(fr, rf, lrow)

        with self.beat("builtin") as b:
            self.play(FadeOut(panel), FadeOut(mk), run_time=b.t(0.08))
            d = T("built in: the module file of the row is in a listed repository folder", LABEL, TEXT)
            _left_at(d, _X0, PY[0])
            fit(d, w=_X1 - _X0)
            li = _row(T("today:", SMALL, MUTED), chip("['widget-sample']", SOLVED, fill=0.2), buff=0.25)
            _left_at(li, _X0, PY[1])
            ck = _row(status_chip("real module file path", solved=True), T("not", SMALL, MUTED),
                      VGroup(chip("package name", OPEN, mono=False)), buff=0.25)
            ck[2].add(_cross(ck[2][0][0]))
            _left_at(ck, _X0, PY[2])
            why = T("a bundle can take any name", SMALL, ISOLATION).next_to(ck, RIGHT, buff=0.35)
            self.play(FadeIn(d), run_time=b.t(0.25))
            self.play(FadeIn(li, shift=UP * 0.1), run_time=b.t(0.2))
            self.play(FadeIn(ck[:2]), run_time=b.t(0.15))
            self.play(FadeIn(ck[2]), FadeIn(why), run_time=b.t(0.2))
            panel = VGroup(d, li, ck, why)

        with self.beat("giveup") as b:
            self.play(FadeOut(panel), tbl.reveal_row(4), run_time=b.t(0.15))
            mk2 = tbl.mark_row(4, ISOLATION)
            self.play(Create(mk2), run_time=b.t(0.1))
            gu = M(f'4 unblamed crashes in 60 s: the supervisor <span fgcolor="{ISOLATION}"><b>gives up</b></span>',
                   LABEL)
            _left_at(gu, _X0, PY[0])
            dlg = rbox(3.6, 1.15, ISOLATION, fill=0.1, sw=3)
            dt = T("DSH fatal dialog", LABEL, TEXT, bold=True)
            bang = VGroup(Circle(radius=0.2, stroke_color=ISOLATION, stroke_width=3),
                          T("!", LABEL, ISOLATION, bold=True))
            VGroup(bang, dt).arrange(RIGHT, buff=0.25).move_to(dlg)
            dialog = VGroup(dlg, bang, dt)
            _left_at(dialog, _X0, -2.25)
            dn = lines("on macOS it blocks Electron main", "seen in PR #61", size=SMALL, color=MUTED)
            dn.next_to(dialog, RIGHT, buff=0.35)
            self.play(FadeIn(gu), run_time=b.t(0.2))
            self.play(FadeIn(dialog, scale=0.9), FadeIn(dn), run_time=b.t(0.2))
            self.play(tbl.reveal_row(5), run_time=b.t(0.15))
            wp = T("at 100 s the 60 s window passed: the count starts again", SMALL, MUTED)
            _left_at(wp, _X0, -1.45)
            self.play(FadeIn(wp), run_time=b.t(0.12))


# ====================================================================== watchdog
class Watchdog(DWScene):
    BEATS = [("banner", 21), ("why", 32), ("thread", 26), ("slot", 13), ("poll", 8), ("gap", 23), ("prov", 49),
             ("kill", 16), ("main", 51), ("numbers", 45), ("desktop", 49), ("close", 9)]

    LX0, LX1 = -3.9, 6.5   # lane x range
    MAIN_Y, MEM_Y, WORK_Y, STALL_Y = 2.25, 1.2, 0.2, -1.45

    def construct(self):
        LX0, LX1 = self.LX0, self.LX1
        with self.beat("banner") as b:
            title = scene_title("The watchdog", ISOLATION)
            ban = status_chip("PR #65 · merged 2026-11-02 (7503af6c)", solved=True)
            ban.move_to([0, TITLE_Y, 0]).align_to([_X1, 0, 0], RIGHT)
            boxes = VGroup(*[chip(k, ISOLATION, mono=False, size=BODY, fill=0.04) for k in
                             ("blame", "quarantine", "supervisor", "watchdog")]).arrange(RIGHT, buff=0.35)
            boxes.move_to([0, 0.7, 0])
            for c in boxes[:3]:
                c.set_opacity(0.3)
            boxes[3][0].set_fill(ISOLATION, opacity=0.25).set_stroke(width=5)
            last = T("the last box of isolation", LABEL, MUTED).next_to(boxes, DOWN, buff=0.3)
            last.align_to(boxes[3], RIGHT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(boxes), run_time=b.t(0.25))
            self.play(Indicate(boxes[3], color=ISOLATION, scale_factor=1.08), FadeIn(last), run_time=b.t(0.25))
            self.play(FadeIn(ban, shift=LEFT * 0.2), run_time=b.t(0.25))

        with self.beat("why") as b:
            box, hlab = _host_box(6.2, 3.4, [-3.2, 0.0, 0])
            w = chip("widget", RUNTIME, mono=False, size=LABEL).move_to(box).shift(UP * 0.1)
            loop = Arc(radius=0.42, start_angle=-PI / 3, angle=-5 * PI / 3, stroke_color=ISOLATION, stroke_width=4)
            loop.add_tip(tip_length=0.15, tip_width=0.15)
            loop.next_to(w, RIGHT, buff=0.15)
            code = T("while (true) {}", SMALL, ISOLATION, mono=True).next_to(w, DOWN, buff=0.35)
            self.play(FadeOut(VGroup(boxes, last)), FadeIn(box), FadeIn(hlab), FadeIn(w), run_time=b.t(0.15))
            self.play(Create(loop), FadeIn(code), run_time=b.t(0.2))
            n1 = T("no error: nothing throws", LABEL, TEXT)
            cl = chip("claimer", ISOLATION, mono=False)
            n2 = _row(cl, T("never runs", LABEL, TEXT), buff=0.25)
            n3 = M(f'the whole host <span fgcolor="{ISOLATION}"><b>freezes</b></span>, and nothing kills it', LABEL)
            notes = VGroup(n1, n2, n3).arrange(DOWN, buff=0.35, aligned_edge=LEFT)
            _left_at(notes, 0.6, 0.0)
            clx = _cross(cl[0])
            self.play(FadeIn(n1), run_time=b.t(0.15))
            self.play(FadeIn(n2), Create(clx), run_time=b.t(0.15))
            self.play(FadeIn(n3), box.animate.set_fill(HOST, opacity=0.18), run_time=b.t(0.15))
            frz = T("frozen", LABEL, HOST, bold=True).next_to(code, DOWN, buff=0.3)
            self.play(FadeIn(frz), run_time=b.t(0.1))
            whyg = VGroup(box, hlab, w, loop, code, notes, clx, frz)

        # lanes
        def lane(y, label, color):
            ln = Line([LX0, y, 0], [LX1, y, 0], stroke_color=color, stroke_width=3)
            lab = T(label, LABEL, color, bold=True)
            lab.move_to([0, y, 0]).align_to([_X0, 0, 0], LEFT)
            return VGroup(ln, lab)

        def ticks(y, step, color, t_end=2.4, h=0.13):
            k = (LX1 - LX0) / t_end
            n = int(t_end / step)
            return VGroup(*[Line([LX0 + i * step * k, y - h, 0], [LX0 + i * step * k, y + h, 0],
                                 stroke_color=color, stroke_width=2.5) for i in range(1, n + 1)])

        with self.beat("thread") as b:
            self.play(FadeOut(whyg), run_time=b.t(0.1))
            mainl = lane(self.MAIN_Y, "main thread", HOST)
            workl = lane(self.WORK_Y, "worker", ISOLATION)
            wd = T("a second JavaScript thread in the host", SMALL, MUTED)
            wd.next_to(workl[1], DOWN, buff=0.1).align_to(workl[1], LEFT)
            self.play(Create(mainl), run_time=b.t(0.15))
            self.play(Create(workl), FadeIn(wd), run_time=b.t(0.2))
            hb = ticks(self.MAIN_Y, 0.1, HOST)
            hbl = T("heartbeat +1 every 100 ms", SMALL, HOST).move_to([0, self.MAIN_Y + 0.38, 0]) \
                .align_to([LX0, 0, 0], LEFT)
            self.play(Create(hb, lag_ratio=0.5), FadeIn(hbl), run_time=b.t(0.45))

        with self.beat("slot") as b:
            mem = rbox(5.4, 0.62, MUTED, fill=0.05, sw=2)
            mem.move_to([2.6, self.MEM_Y, 0])
            ml = T("SharedArrayBuffer · Int32 slots", SMALL, MUTED).next_to(mem, LEFT, buff=0.25)
            c1 = _row(T("heartbeat", SMALL, HOST, mono=True), T("41", SMALL, TEXT, mono=True), buff=0.2)
            c2 = _row(T("running", SMALL, ISOLATION, mono=True), T("2", SMALL, TEXT, mono=True), buff=0.2)
            cells = _row(c2, Line(UP * 0.25, DOWN * 0.25, stroke_color=MUTED, stroke_width=2), c1, buff=0.4)
            cells.move_to(mem)
            ra = chip("runAs", RUNTIME, size=SMALL)
            ra.move_to([LX0 + 0.6, self.MEM_Y, 0])
            ral = T("row slot index (illustrative)", SMALL, MUTED).next_to(mem, DOWN, buff=0.08).align_to(c2, LEFT)
            self.play(FadeIn(mem), FadeIn(ml), FadeIn(c1), run_time=b.t(0.3))
            ml2 = _arrow(ra.get_right(), c2.get_left() + LEFT * 0.1, RUNTIME, sw=2.5)
            self.play(FadeIn(ra), FadeIn(cells[1]), GrowArrow(ml2), FadeIn(c2), FadeIn(ral), run_time=b.t(0.4))
            # ml would overlap the runAs chip: keep only the chip
            self.remove(ml)

        with self.beat("poll") as b:
            pt = ticks(self.WORK_Y, 0.05, ISOLATION, h=0.09)
            pl = T("polls the heartbeat every 50 ms", SMALL, ISOLATION).move_to([0, self.WORK_Y + 0.33, 0]) \
                .align_to([LX0, 0, 0], LEFT)
            self.play(Create(pt, lag_ratio=0.5), FadeIn(pl), run_time=b.t(0.8))

        with self.beat("gap") as b:
            k = (LX1 - LX0) / 2.4
            gx0, gx1 = LX0 + 1.05 * k, LX0 + 2.05 * k
            gapr = Rectangle(width=gx1 - gx0, height=0.36, stroke_color=MUTED, stroke_width=2,
                             fill_color=BG, fill_opacity=1).move_to([(gx0 + gx1) / 2, self.WORK_Y, 0])
            gl = T("poll gap ≥ 1 s (sleep, SIGSTOP)", SMALL, TEXT).move_to(gapr)
            gn = M(f'the whole process was stopped: the <span fgcolor="{ISOLATION}">stall clock</span> starts again',
                   SMALL)
            gn.move_to([0, self.WORK_Y - 0.55, 0]).align_to([LX0, 0, 0], LEFT)
            self.play(FadeOut(wd), FadeIn(gapr), FadeIn(gl), run_time=b.t(0.35))
            self.play(FadeIn(gn), run_time=b.t(0.3))

        # stall clock: 0..2000 ms
        sk = (LX1 - LX0) / 2000

        def sx(ms):
            return LX0 + ms * sk

        with self.beat("prov") as b:
            self.play(FadeOut(VGroup(gapr, gl, gn)), run_time=b.t(0.06))
            # main thread stops beating: a loop in widget code
            lp = Rectangle(width=LX1 - sx(900), height=0.2, stroke_width=0, fill_color=ISOLATION,
                           fill_opacity=0.35).move_to([sx(900), self.MAIN_Y, 0], aligned_edge=LEFT)
            lpl = T("loop in widget code: no beats", SMALL, ISOLATION).move_to([0, self.MAIN_Y + 0.38, 0]) \
                .align_to([LX1, 0, 0], RIGHT)
            kk = (LX1 - LX0) / 2.4
            late = [t for t in hb if t.get_x() > LX0 + 0.95 * kk]
            self.play(FadeIn(lp), FadeIn(lpl), *[t.animate.set_opacity(0.15) for t in late], run_time=b.t(0.1))
            axis = Line([sx(0), self.STALL_Y, 0], [sx(2000), self.STALL_Y, 0], stroke_color=MUTED, stroke_width=2)
            sl = T("stall clock", LABEL, ISOLATION, bold=True)
            sl.move_to([0, self.STALL_Y, 0]).align_to([_X0, 0, 0], LEFT)
            m500 = Line([sx(500), self.STALL_Y - 0.25, 0], [sx(500), self.STALL_Y + 0.25, 0], stroke_color=TEXT,
                        stroke_width=3)
            m2000 = Line([sx(2000), self.STALL_Y - 0.25, 0], [sx(2000), self.STALL_Y + 0.25, 0],
                         stroke_color=TEXT, stroke_width=3)
            t500 = T("500 ms", SMALL, TEXT, mono=True).next_to(m500, UP, buff=0.08)
            t2000 = T("2000 ms", SMALL, TEXT, mono=True).next_to(m2000, UP, buff=0.08).align_to(m2000, RIGHT)
            self.play(FadeIn(sl), Create(axis), FadeIn(VGroup(m500, m2000, t500, t2000)), run_time=b.t(0.1))
            fill = Rectangle(width=500 * sk, height=0.22, stroke_width=0, fill_color=ISOLATION, fill_opacity=0.8)
            fill.move_to([sx(0), self.STALL_Y, 0], aligned_edge=LEFT)
            self.play(GrowFromEdge(fill, LEFT), run_time=b.t(0.12))
            pv = chip("provisional.json", ISOLATION, fill=0.25)
            pv.next_to(m500, DOWN, buff=0.2).align_to(m500, LEFT).shift(LEFT * 0.6)
            pvl = T("blames the widget in the slot", SMALL, TEXT).next_to(pv, DOWN, buff=0.1).align_to(pv, LEFT)
            self.play(FadeIn(pv, shift=UP * 0.1), FadeIn(pvl), run_time=b.t(0.12))
            w1 = M(f'Why so early? An <b>out-of-memory abort</b> runs no JavaScript at all.', SMALL)
            w2 = T("Then the early record is the only blame.", SMALL, TEXT)
            wy = VGroup(w1, w2).arrange(DOWN, buff=0.1, aligned_edge=LEFT)
            wy.move_to([0, self.WORK_Y - 0.65, 0]).align_to([LX0, 0, 0], LEFT)
            self.play(FadeIn(wy), run_time=b.t(0.2))
            rm = T("removed when the heartbeat comes back", SMALL, SOLVED).next_to(pvl, DOWN, buff=0.1) \
                .align_to(pv, LEFT)
            self.play(FadeIn(rm), run_time=b.t(0.15))

        with self.beat("kill") as b:
            self.play(fill.animate.stretch_to_fit_width(2000 * sk).move_to([sx(0), self.STALL_Y, 0],
                                                                          aligned_edge=LEFT),
                      run_time=b.t(0.35))
            ck = chip("crash.json + SIGKILL", ISOLATION, fill=0.35)
            ck.next_to(m2000, DOWN, buff=0.2).align_to(m2000, RIGHT)
            bx = burst(ISOLATION, 0.25).next_to(ck, LEFT, buff=0.15)
            self.play(FadeIn(ck, shift=UP * 0.1), FadeIn(bx, scale=0.5), run_time=b.t(0.3))
            everything = [m for m in self.mobjects if m not in (title, ban, self.camera.frame)]

        with self.beat("main") as b:
            self.play(*[FadeOut(m) for m in everything], run_time=b.t(0.06))
            em = ProcessBox("Electron main", "after the host exits", SHELL, sub_mono=False)
            _left_at(em, _X0, 2.25)
            self.play(FadeIn(em), run_time=b.t(0.06))
            rows = [("a crash.json of the dead pid", "it wins"),
                    ("SIGABRT, SIGTRAP, SIGILL, or code 134", "provisional.json counts"),
                    ("any other exit", "Electron main deletes provisional.json")]
            tbl = RevealTable(["the host ended with", "then"], rows, mono_cols=[], size=LABEL, row_gap=0.25,
                              cell_colors={(0, 1): ISOLATION, (1, 1): ISOLATION, (2, 1): SOLVED})
            tbl.move_to([0, 0, 0]).align_to([0, 1.35, 0], UP).align_to([_X0, 0, 0], LEFT)
            self.add(tbl)
            self.play(tbl.reveal_row(0), run_time=b.t(0.14))
            self.play(tbl.reveal_row(1), run_time=b.t(0.14))
            self.play(Create(tbl.mark_row(1, ISOLATION)), run_time=b.t(0.06))
            self.play(tbl.reveal_row(2), run_time=b.t(0.14))
            wq = T("Why?", LABEL, TEXT, bold=True)
            st = chip("long allowed step", RUNTIME, mono=False)
            other = chip("host ends for another reason", HOST, mono=False)
            wn = T("not the fault of the widget", SMALL, ISOLATION)
            wrow = _row(wq, st, T("+", LABEL, TEXT), other, wn, buff=0.25)
            _left_at(wrow, _X0, -2.0)
            fit(wrow, w=_X1 - _X0)
            self.play(FadeIn(wrow[:2]), run_time=b.t(0.12))
            self.play(FadeIn(wrow[2:4]), run_time=b.t(0.1))
            self.play(FadeIn(wrow[4]), run_time=b.t(0.08))
            mainp = [m for m in self.mobjects if m not in (title, ban, self.camera.frame)]

        with self.beat("numbers") as b:
            self.play(*[FadeOut(m) for m in mainp], run_time=b.t(0.06))
            src = T("tools/widgets-watchdog.mjs at 108d663f · 21 PASS · merged code", SMALL, MUTED, mono=True)
            _left_at(src, _X0, 2.1)
            fit(src, w=_X1 - _X0)
            rows = [("parse of 150 MB in host code", "868 ms · the host lives"),
                    ("loop in an action (spin)", "SIGKILL 2050 ms after the call"),
                    ("out of memory (oom)", "SIGABRT · the provisional record blames the widget")]
            tbl = RevealTable(["case", "result"], rows, size=LABEL, row_gap=0.35,
                              cell_colors={(0, 1): SOLVED, (1, 1): ISOLATION, (2, 1): ISOLATION})
            tbl.move_to([0, 0, 0]).align_to([0, 1.5, 0], UP).align_to([_X0, 0, 0], LEFT)
            fit(tbl, w=_X1 - _X0)
            self.play(FadeIn(src), run_time=b.t(0.08))
            self.add(tbl)
            big = []
            for v, sub, col in (("868 ms", "parse: the host lives", SOLVED),
                                ("2050 ms", "spin: SIGKILL after the call", ISOLATION),
                                ("SIGABRT", "oom: provisional blame", ISOLATION)):
                big.append(VGroup(T(v, TITLE, col, mono=True, bold=True), T(sub, SMALL, MUTED)).arrange(DOWN, buff=0.15))
            bigs = VGroup(*big).arrange(RIGHT, buff=1.0).move_to([0, -1.75, 0])
            fit(bigs, w=_X1 - _X0)
            self.play(tbl.reveal_row(0), FadeIn(big[0], shift=UP * 0.1), run_time=b.t(0.3))
            self.play(tbl.reveal_row(1), FadeIn(big[1], shift=UP * 0.1), run_time=b.t(0.25))
            self.play(tbl.reveal_row(2), FadeIn(big[2], shift=UP * 0.1), run_time=b.t(0.25))
            nump = VGroup(src, tbl, bigs)

        with self.beat("desktop") as b:
            self.play(FadeOut(nump), run_time=b.t(0.05))
            cli = ProcessBox("command-line host", "a native module reads the stack of the stuck thread", HOST,
                             sub_mono=False, width=_X1 - _X0)
            _left_at(cli, _X0, 1.85)
            dsk = ProcessBox("desktop host", "blame by the slot only", SHELL, sub_mono=False, width=_X1 - _X0)
            _left_at(dsk, _X0, 0.35)
            nb = M(f'no Electron build of <span font_family="{MONO}">@sentry/node-native-stacktrace</span>', SMALL,
                   MUTED)
            nb.next_to(dsk, DOWN, buff=0.15).align_to(dsk, LEFT)
            nbl = chip("not blamed in the app: a loop in a raw timer, or after an await", ISOLATION, mono=False,
                       fill=0.2)
            _left_at(nbl, _X0, -1.6)
            fit(nbl, w=_X1 - _X0)
            self.play(FadeIn(cli, shift=UP * 0.1), run_time=b.t(0.25))
            self.play(FadeIn(dsk, shift=UP * 0.1), run_time=b.t(0.2))
            self.play(FadeIn(nb), run_time=b.t(0.15))
            self.play(FadeIn(nbl, shift=UP * 0.1), run_time=b.t(0.2))

        with self.beat("close") as b:
            OutlineDiagram().close_part(self, "isolation", run_time=b.left)
