"""Part `part_processes`: process_pid child_process signals exit_info.

Processes, PIDs, child processes, signals, and how a child ended. Opens and closes on the
outline at `start_again`; the close lights `widget_code`.

Beat weights are seconds of the final audio where it exists: each beat starts at the pause
before its sentence (ffmpeg silencedetect). The base scales them to the audio length.

Code cards: the real snippets (`notes/script-v2/snippets/pid.cjs`, `signals.cjs`) have lines of
120 to 150 characters. At the least font size a line holds about 70 characters, so the cards
wrap the same tokens at statement or argument boundaries.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (no-op if already later)."""
    scene.wait_until(b.start + frac * b.length)


def _cross(color=ISOLATION, s=0.2, sw=6):
    return VGroup(Line([-s, -s, 0], [s, s, 0], stroke_color=color, stroke_width=sw),
                  Line([-s, s, 0], [s, -s, 0], stroke_color=color, stroke_width=sw))


def _tick(color=TEXT, s=0.18):
    return VMobject(stroke_color=color, stroke_width=6).set_points_as_corners(
        [[-s, 0, 0], [-s * 0.3, -s * 0.7, 0], [s, s * 0.8, 0]])


def _arr(a, b, color=TEXT, buff=0.08, sw=3, tip=0.18):
    return Arrow(a, b, buff=buff, color=color, stroke_width=sw, max_tip_length_to_length_ratio=0.35,
                 tip_length=tip)


def _memory(w, h, color=MUTED):
    """A dashed region with the word memory."""
    r = rbox(w, h, color, fill=0.04, sw=2, dashed=True)
    t = T("memory", SMALL, MUTED).move_to(r)
    g = VGroup(r, t)
    g.region = r
    return g


def _win(w=1.0, h=0.7, color=WIDGET):
    """A small window icon: frame and title bar, no text."""
    f = rbox(w, h, color, fill=0.08, sw=2.5, r=0.06)
    y = f.get_top()[1] - 0.17
    bar = Line([f.get_left()[0], y, 0], [f.get_right()[0], y, 0], stroke_color=color, stroke_width=2)
    return VGroup(f, bar)


def _envelope(label, color=TEXT, sub=None):
    """A message envelope with its label above. .body"""
    body = Rectangle(width=0.95, height=0.6, stroke_color=color, stroke_width=3, fill_color=BG, fill_opacity=1)
    tl, tr = body.get_corner(UL), body.get_corner(UR)
    flap = VMobject(stroke_color=color, stroke_width=3).set_points_as_corners([tl, body.get_center() + DOWN * 0.05, tr])
    env = VGroup(body, flap)
    lab = T(label, LABEL, color, mono=True, bold=True).next_to(env, UP, buff=0.12)
    parts = [env, lab]
    if sub:
        parts.append(T(sub, SMALL, MUTED).next_to(env, DOWN, buff=0.1))
    g = VGroup(*parts)
    g.body = env
    return g


def _glyphs(t, full, sub, nth=0):
    """Glyphs of Text t (built from the string `full`) that draw substring `sub` (its nth match).
    Text keeps one glyph per non-space character."""
    i = -1
    for _ in range(nth + 1):
        i = full.index(sub, i + 1)
    a = len(full[:i].replace(" ", ""))
    n = len(sub.replace(" ", ""))
    return VGroup(*t.submobjects[a:a + n])


def _frame(m, color=TEXT, buff=0.06):
    return SurroundingRectangle(m, color=color, buff=buff, stroke_width=2.5, corner_radius=0.05)


def _out_panel(rows, size=CODE, buff=0.2):
    """Real program output: mono lines on the panel color. .rows (Text), .texts (the strings)."""
    ts = VGroup(*[T(r, size, TEXT, mono=True) for r in rows]).arrange(DOWN, buff=buff, aligned_edge=LEFT)
    box = rbox(ts.width + 0.5, ts.height + 0.45, MUTED, fill=0, sw=2, r=0.14)
    box.set_fill(PANEL, 1)
    ts.move_to(box)
    g = VGroup(box, ts)
    g.rows, g.texts, g.box = list(ts), list(rows), box
    return g


def _credit(text):
    return chip(text, MUTED, size=SMALL, mono=False, fill=0.06)


# ====================================================================== process_pid
class ProcessPid(DWScene):
    BEATS = [("open", 2.4), ("idea", 4.1), ("apart", 6.3), ("pid", 6.8), ("point", 6.8), ("app", 9.0)]

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram(self).open_part(self, "start_again", run_time=b.left)

        # left process: becomes the app process
        lx, rx = -3.2, 3.9
        lbox = rbox(5.6, 4.1, TEXT, fill=0.05).move_to([lx, 0.25, 0])        # y 2.3 .. -1.8
        ltitle = T("process", LABEL, TEXT, bold=True).move_to([lx, 1.9, 0])
        lmem = _memory(4.8, 0.85).move_to([lx, -1.2, 0])
        # right process: another program
        rbx = rbox(3.4, 3.0, TEXT, fill=0.05).move_to([rx, 0.3, 0])          # y 1.8 .. -1.2
        rtitle = T("process", LABEL, TEXT, bold=True).move_to([rx, 1.4, 0])
        rmem = _memory(2.8, 0.85).move_to([rx, -0.55, 0])

        with self.beat("idea") as b:
            title = scene_title("The process", SUPERVISOR)
            credit = _credit('process as a bundle of state: Julia Evans, "what\'s in a process?" (wizardzines)')
            credit.move_to([_X0, -2.45, 0], aligned_edge=LEFT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.15))
            self.play(Create(lbox), FadeIn(ltitle), run_time=b.t(0.25))
            self.play(FadeIn(lmem, shift=UP * 0.1), run_time=b.t(0.2))
            self.play(FadeIn(credit), run_time=b.t(0.15))

        with self.beat("apart") as b:
            self.play(Create(rbx), FadeIn(rtitle), FadeIn(rmem), run_time=b.t(0.3))
            _at(self, b, 0.4)
            reach = _arr(lmem.region.get_right() + LEFT * 0.3, rmem.region.get_left(), ISOLATION, sw=4, tip=0.22)
            x = _cross().move_to([(lbox.get_right()[0] + rbx.get_left()[0]) / 2, reach.get_center()[1], 0])
            self.play(GrowArrow(reach), run_time=b.t(0.25))
            self.play(Create(x), run_time=b.t(0.15))

        with self.beat("pid") as b:
            tag = chip("PID 68721", SUPERVISOR, size=LABEL).move_to([lx, 1.2, 0])
            note = T("illustrative number", SMALL, MUTED).next_to(tag, DOWN, buff=0.12)
            self.play(FadeOut(reach), FadeOut(x), run_time=b.t(0.12))
            _at(self, b, 0.4)
            self.play(FadeIn(tag, scale=1.15), run_time=b.t(0.12))
            self.play(FadeIn(note), run_time=b.t(0.08))
            _at(self, b, 0.65)
            cap = caption("PID = process ID, the number the operating system gives one running process")
            self.play(FadeIn(cap), run_time=b.t(0.2))

        with self.beat("point") as b:
            stop = _arr([rbx.get_left()[0] + 0.05, tag.get_y(), 0], tag.get_right(), TEXT, sw=4, tip=0.22)
            slabel = T("stop 68721", SMALL, TEXT, mono=True)
            slabel.move_to([(lbox.get_right()[0] + rbx.get_left()[0]) / 2, tag.get_y() + 0.32, 0])
            self.play(GrowArrow(stop), run_time=b.t(0.2))
            self.play(Indicate(tag, color=SUPERVISOR, scale_factor=1.12), run_time=b.t(0.2))
            _at(self, b, 0.6)
            self.play(FadeIn(slabel, shift=DOWN * 0.1), run_time=b.t(0.15))

        with self.beat("app") as b:
            self.play(FadeOut(stop), FadeOut(slabel), FadeOut(cap), run_time=b.t(0.1))
            new_t = VGroup(T("app process", LABEL, SUPERVISOR, bold=True), T("Electron main", SMALL, TEXT, mono=True))
            new_t.arrange(DOWN, buff=0.1).move_to([lx, 1.8, 0])
            _at(self, b, 0.42)
            self.play(lbox.animate.set_stroke(SUPERVISOR).set_fill(SUPERVISOR, 0.08),
                      ReplacementTransform(ltitle, new_t), tag.animate.shift(DOWN * 0.3),
                      note.animate.shift(DOWN * 0.3), run_time=b.t(0.15))
            _at(self, b, 0.76)
            wins = VGroup(*[_win() for _ in range(3)]).arrange(RIGHT, buff=0.45).move_to([lx, -0.2, 0])
            self.play(LaggedStart(*[FadeIn(w, shift=UP * 0.1) for w in wins], lag_ratio=0.3), run_time=b.t(0.18))


# ====================================================================== child_process
_PID_CODE = """
const { spawnSync } = require('node:child_process')
const one = spawnSync(process.execPath,
  ['-e', 'console.log(process.pid, process.ppid)'],
  { encoding: 'utf8' }).stdout.trim()
const two = spawnSync(process.execPath,
  ['-e', 'console.log(process.pid, process.ppid)'],
  { encoding: 'utf8' }).stdout.trim()
console.log('parent pid', process.pid)
console.log('child one pid, parent', one)
console.log('child two pid, parent', two)
"""
_PID_OUT = ["parent pid 68721", "child one pid, parent 68722 68721", "child two pid, parent 68723 68721"]


class ChildProcess(DWScene):
    BEATS = [("family", 6.7), ("own", 6.8), ("code", 8.2), ("same", 4.0), ("host", 7.3), ("dies", 5.4)]

    def construct(self):
        title = scene_title("Child processes", HOST)
        parent = ProcessBox("parent", "PID 68721", color=TEXT, width=3.4).move_to([0, 2.15, 0])
        child = rbox(6.0, 2.5, TEXT, fill=0.05).move_to([0, -0.85, 0])            # y 0.4 .. -2.1
        ctitle = T("child process", LABEL, TEXT, bold=True).move_to([0, 0.05, 0])
        starts = labeled_arrow(parent.get_bottom(), child.get_top(), "starts", MUTED, mono=False, side=RIGHT)

        with self.beat("family") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(parent), run_time=b.t(0.25))
            _at(self, b, 0.3)
            self.play(GrowArrow(starts.arrow), FadeIn(starts.label), run_time=b.t(0.2))
            self.play(Create(child), FadeIn(ctitle), run_time=b.t(0.25))

        with self.beat("own") as b:
            cpid = chip("PID 68722", HOST, size=LABEL).move_to([-1.4, -0.65, 0])
            cmem = _memory(2.2, 0.6).move_to([1.5, -0.65, 0])
            ppid = T("parent PID 68721", LABEL, TEXT, mono=True).move_to([0, -1.55, 0])
            self.play(FadeIn(cpid, scale=1.1), run_time=b.t(0.2))
            self.play(FadeIn(cmem), run_time=b.t(0.2))
            _at(self, b, 0.55)
            self.play(FadeIn(ppid, shift=UP * 0.1), run_time=b.t(0.2))
            self.play(Indicate(parent.sub, color=TEXT, scale_factor=1.15), Indicate(ppid, color=TEXT, scale_factor=1.08),
                      run_time=b.t(0.2))

        with self.beat("code") as b:
            fam = VGroup(parent, starts, child, ctitle, cpid, cmem, ppid)
            code = code_block(_PID_CODE, "javascript").move_to([_X0, 2.85, 0], aligned_edge=UL)
            fname = T("pid.cjs", SMALL, MUTED, mono=True).next_to(code, RIGHT, buff=0.3).align_to(code, UP)
            out = _out_panel(_PID_OUT).next_to(code, DOWN, buff=0.2).align_to(code, LEFT)
            for r in out.rows:
                r.set_opacity(0)
            tag = VGroup(claim_tag("ran"), T("node v22.23.0", SMALL, MUTED)).arrange(RIGHT, buff=0.2)
            tag.next_to(out, RIGHT, buff=0.35)
            self.play(FadeOut(fam), run_time=b.t(0.1))
            self.play(FadeIn(code, shift=UP * 0.1), FadeIn(fname), run_time=b.t(0.2))
            _at(self, b, 0.45)
            self.play(FadeIn(out.box), FadeIn(tag), run_time=b.t(0.1))
            self.play(LaggedStart(*[r.animate.set_opacity(1) for r in out.rows], lag_ratio=0.5), run_time=b.t(0.35))

        with self.beat("same") as b:
            kids = VGroup(_frame(_glyphs(out.rows[1], _PID_OUT[1], "68722"), HOST),
                          _frame(_glyphs(out.rows[2], _PID_OUT[2], "68723"), HOST))
            par = VGroup(_frame(_glyphs(out.rows[0], _PID_OUT[0], "68721")),
                         _frame(_glyphs(out.rows[1], _PID_OUT[1], "68721")),
                         _frame(_glyphs(out.rows[2], _PID_OUT[2], "68721")))
            self.play(Create(kids), run_time=b.t(0.25))
            _at(self, b, 0.45)
            self.play(Create(par), run_time=b.t(0.3))

        with self.beat("host") as b:
            self.play(FadeOut(VGroup(code, fname, out, tag, kids, par)), run_time=b.t(0.12))
            app = ProcessBox("app process", "Electron main", color=SUPERVISOR, width=3.8).move_to([0, 2.1, 0])
            host = rbox(7.4, 2.5, HOST, fill=0.08).move_to([0, -0.9, 0])          # y 0.35 .. -2.15
            hhead = VGroup(T("host", LABEL, HOST, bold=True), T("runs every widget", SMALL, TEXT))
            hhead.arrange(RIGHT, buff=0.35).move_to([0, -0.05, 0])
            hhead[1].move_to([0, -0.05, 0])
            chips = VGroup(*[chip(w, WIDGET, size=LABEL) for w in ("sample", "pinger", "spinner")])
            chips.arrange(RIGHT, buff=0.45).move_to([0, -1.2, 0])
            st = labeled_arrow(app.get_bottom(), host.get_top(), "starts", MUTED, mono=False, side=RIGHT)
            self.play(FadeIn(app), run_time=b.t(0.15))
            self.play(GrowArrow(st.arrow), FadeIn(st.label), run_time=b.t(0.15))
            self.play(Create(host), FadeIn(hhead[1]), run_time=b.t(0.15))
            self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.1) for c in chips], lag_ratio=0.3), run_time=b.t(0.2))
            _at(self, b, 0.76)
            run_l = hhead[1].copy().next_to(hhead[0], RIGHT, buff=0.35).align_to(hhead[1], DOWN)
            self.play(hhead[1].animate.move_to(run_l), FadeIn(hhead[0], shift=RIGHT * 0.1), run_time=b.t(0.15))

        with self.beat("dies") as b:
            bang = burst(r=0.4).move_to(host.get_corner(UR) + LEFT * 0.4 + DOWN * 0.4)
            self.play(host.animate.set_stroke(ISOLATION).set_fill(ISOLATION, 0.25), FadeIn(bang, scale=0.4),
                      run_time=b.t(0.12))
            self.play(FadeOut(chips, shift=DOWN * 0.15), FadeOut(bang),
                      host.animate.set_stroke(ISOLATION, opacity=0.5).set_fill(ISOLATION, 0.04),
                      hhead.animate.set_opacity(0.35), run_time=b.t(0.18))
            alive = T("stays alive", LABEL, SUPERVISOR).next_to(app, LEFT, buff=0.4)
            self.play(Indicate(app, color=SUPERVISOR, scale_factor=1.06), FadeIn(alive), run_time=b.t(0.22))
            _at(self, b, 0.55)
            again = labeled_arrow(app.get_right() + DOWN * 0.1, host.get_corner(UR) + LEFT * 0.6, "new host",
                                  SUPERVISOR, mono=False, side=RIGHT, dashed=True)
            self.play(Create(again.arrow), FadeIn(again.label), run_time=b.t(0.25))


# ====================================================================== signals
class Signals(DWScene):
    BEATS = [("ask", 4.0), ("msg", 8.6), ("polite", 5.2), ("kill", 8.7), ("why", 6.3), ("run", 6.64)]

    def construct(self):
        y = 1.55
        sender = ProcessBox("process", "PID 68721", color=TEXT, width=3.0, height=1.5).move_to([-4.6, y, 0])
        tbox = rbox(3.8, 2.0, TEXT, fill=0.05).move_to([4.15, y, 0])           # x 2.25 .. 6.05
        ttitle = VGroup(T("process", LABEL, TEXT, bold=True), T("PID 68722", SMALL, TEXT, mono=True))
        ttitle.arrange(DOWN, buff=0.1).move_to([4.15, y + 0.45, 0])
        slot = [4.15, y - 0.5, 0]
        src = sender.get_right() + RIGHT * 0.65
        dst = [tbox.get_left()[0] - 1.4, y, 0]

        with self.beat("ask") as b:
            title = scene_title("Signals", ISOLATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(sender), Create(tbox), FadeIn(ttitle),
                      run_time=b.t(0.6))

        with self.beat("msg") as b:
            env = _envelope("to PID 68722").move_to(src)
            path = DashedLine(sender.get_right(), tbox.get_left(), color=MUTED, dash_length=0.1, stroke_width=2)
            os_l = T("the operating system delivers it", SMALL, MUTED).next_to(path, DOWN, buff=0.95)
            self.play(Create(path), FadeIn(env, scale=0.6), run_time=b.t(0.15))
            self.play(env.animate.move_to(dst), FadeIn(os_l), run_time=b.t(0.3))
            _at(self, b, 0.62)
            credit = _credit('signal as a text message: Naz Quadri, "Signals" (The Layer Below)')
            credit.move_to([CAPTION_X, CAPTION_Y, 0])
            self.play(FadeIn(credit), run_time=b.t(0.12))
            self.play(FadeOut(env.body, target_position=tbox.get_center(), scale=0.4), FadeOut(VGroup(*env[1:])), run_time=b.t(0.15))

        with self.beat("polite") as b:
            env = _envelope("SIGTERM", TEXT, sub="polite").move_to(src)
            self.play(FadeIn(env, scale=0.6), run_time=b.t(0.12))
            self.play(env.animate.move_to(dst), run_time=b.t(0.22))
            self.play(FadeOut(env.body, target_position=tbox.get_center(), scale=0.4), FadeOut(VGroup(*env[1:])), run_time=b.t(0.12))
            fn = chip("cleanup()", TEXT, size=LABEL).move_to(slot)
            ok = _tick().next_to(fn, RIGHT, buff=0.15)
            self.play(FadeIn(fn, scale=1.15), run_time=b.t(0.15))
            self.play(Create(ok), run_time=b.t(0.12))

        with self.beat("kill") as b:
            self.play(FadeOut(ok), fn.animate.set_opacity(0.0), run_time=b.t(0.08))
            env = _envelope("SIGKILL", ISOLATION).move_to(src)
            _at(self, b, 0.2)
            self.play(FadeIn(env, scale=0.6), run_time=b.t(0.08))
            self.play(env.animate.move_to(dst), run_time=b.t(0.14))
            self.play(FadeOut(env.body, target_position=tbox.get_center(), scale=0.4), FadeOut(VGroup(*env[1:])), run_time=b.t(0.06))
            # the target goes dark at once: no code runs
            self.play(tbox.animate.set_stroke(MUTED, opacity=0.35).set_fill(BG, 1),
                      ttitle.animate.set_opacity(0.3), run_time=b.t(0.05))
            fn2 = chip("cleanup()", MUTED, size=LABEL).move_to(slot).set_opacity(0.35)
            no = _cross(s=0.16).next_to(fn2, RIGHT, buff=0.15)
            self.play(FadeIn(fn2), Create(no), run_time=b.t(0.1))
            _at(self, b, 0.62)
            cap = caption("SIGKILL cannot be caught or ignored (signal(7))")
            self.play(FadeOut(credit), FadeIn(cap), run_time=b.t(0.15))

        with self.beat("why") as b:
            why = VGroup(claim_tag("inferred"), T("a stuck process cannot refuse SIGKILL", LABEL, INFERRED))
            why.arrange(RIGHT, buff=0.25).move_to([_X0, -0.45, 0], aligned_edge=LEFT)
            self.play(FadeIn(why[0]), run_time=b.t(0.15))
            _at(self, b, 0.25)
            self.play(FadeIn(why[1], shift=RIGHT * 0.1), run_time=b.t(0.25))

        with self.beat("run") as b:
            line = "process.on('SIGKILL', () => {})"
            code = code_block(line, "javascript").move_to([_X0, -1.45, 0], aligned_edge=LEFT)
            res = "process.on SIGKILL threw EINVAL"
            out = _out_panel([res]).next_to(code, DOWN, buff=0.15).align_to(code, LEFT)
            ran = claim_tag("ran").next_to(out, RIGHT, buff=0.3)
            _at(self, b, 0.33)
            self.play(FadeIn(code, shift=UP * 0.1), run_time=b.t(0.15))
            _at(self, b, 0.72)
            self.play(FadeIn(out, shift=DOWN * 0.1), FadeIn(ran), run_time=b.t(0.12))
            self.play(Create(_frame(_glyphs(out.rows[0], res, "EINVAL"), ISOLATION)), run_time=b.t(0.12))


# ====================================================================== exit_info
_SIG_CODE = """
process.on('exit', () => console.log('cleanup ran'))
process.kill(process.pid, 'SIGKILL')

process.on('SIGTERM', () => {
  console.log('SIGTERM handled'); process.exit(0) })
process.kill(process.pid, 'SIGTERM')
setTimeout(() => {}, 1000)

process.on('uncaughtException', () => console.log('handler ran'))
const a = []; for (;;) a.push({ n: a.length, s: 'x'.repeat(64) })
"""
_SIG_OUT = ['killed child: code null signal SIGKILL printed ""',
            'SIGTERM child: code 0 signal null printed "SIGTERM handled"',
            'out-of-memory child: code null signal SIGABRT printed ""']


class ExitInfo(DWScene):
    BEATS = [("learn", 5.4), ("code", 6.4), ("signal", 4.8), ("killed", 5.9), ("term", 5.8), ("oom", 7.6),
             ("close", 2.06)]

    def construct(self):
        title = scene_title("How a child process ended", SUPERVISOR)
        y = 2.1
        child = ProcessBox("child process", color=TEXT, width=3.4, height=1.0).move_to([-3.6, y, 0])
        parent = ProcessBox("parent", color=TEXT, width=3.4, height=1.0).move_to([3.6, y, 0])
        tell = labeled_arrow(child.get_right(), parent.get_left(), "how it ended", MUTED, mono=False)
        tbl = RevealTable(["how the child ended", "what the parent gets"],
                          [["ends by itself", "exit code"], ["ends by a signal", "signal name, code null"]],
                          size=BODY, row_gap=0.3, col_gap=1.2, header_color=MUTED)
        tbl.move_to([0, 0.05, 0])

        with self.beat("learn") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), FadeIn(child), FadeIn(parent), run_time=b.t(0.25))
            self.play(child.animate.set_opacity(0.35), GrowArrow(tell.arrow), FadeIn(tell.label), run_time=b.t(0.25))
            _at(self, b, 0.62)
            self.play(FadeIn(tbl), run_time=b.t(0.25))

        with self.beat("code") as b:
            self.play(tbl.reveal_row(0), run_time=b.t(0.2))
            _at(self, b, 0.45)
            fine = VGroup(chip("0", TEXT, size=LABEL), T("fine", LABEL, TEXT)).arrange(RIGHT, buff=0.2)
            bad = VGroup(chip("any other number", TEXT, size=LABEL, mono=False), T("trouble", LABEL, ISOLATION))
            bad.arrange(RIGHT, buff=0.2)
            codes = VGroup(fine, bad).arrange(RIGHT, buff=1.0).move_to([0, -1.75, 0])
            self.play(FadeIn(fine, shift=UP * 0.1), run_time=b.t(0.2))
            _at(self, b, 0.7)
            self.play(FadeIn(bad, shift=UP * 0.1), run_time=b.t(0.2))

        with self.beat("signal") as b:
            self.play(FadeOut(codes), run_time=b.t(0.1))
            self.play(tbl.reveal_row(1), run_time=b.t(0.25))
            _at(self, b, 0.6)
            mrow = tbl.mark_row(1, SUPERVISOR)
            self.play(Create(mrow), run_time=b.t(0.2))

        code = code_block(_SIG_CODE, "javascript").move_to([_X0, 2.85, 0], aligned_edge=UL)
        fname = T("signals.cjs: the code of each child", SMALL, MUTED)
        fname.move_to([FRAME_W / 2 - MARGIN, TITLE_Y, 0], aligned_edge=RIGHT)
        out = _out_panel(_SIG_OUT).next_to(code, DOWN, buff=0.18).align_to(code, LEFT)
        for r in out.rows:
            r.set_opacity(0)
        ran = claim_tag("ran").next_to(out, RIGHT, buff=0.3)
        cl = code.code_lines

        with self.beat("killed") as b:
            self.play(FadeOut(VGroup(child, parent, tell, tbl, mrow)), run_time=b.t(0.12))
            self.play(FadeIn(code, shift=UP * 0.1), FadeIn(fname), FadeIn(out.box), FadeIn(ran), run_time=b.t(0.18))
            m1 = _frame(VGroup(*cl[0:2]), ISOLATION, buff=0.1)
            self.play(Create(m1), out.rows[0].animate.set_opacity(1), run_time=b.t(0.2))
            _at(self, b, 0.75)
            p1 = _frame(_glyphs(out.rows[0], _SIG_OUT[0], 'printed ""'), ISOLATION)
            self.play(Create(p1), run_time=b.t(0.15))

        with self.beat("term") as b:
            m2 = _frame(VGroup(*cl[3:7]), TEXT, buff=0.1)
            self.play(FadeOut(m1), FadeOut(p1), Create(m2), out.rows[1].animate.set_opacity(1), run_time=b.t(0.25))
            _at(self, b, 0.65)
            p2 = _frame(_glyphs(out.rows[1], _SIG_OUT[1], "code 0"), TEXT)
            self.play(Create(p2), run_time=b.t(0.15))

        with self.beat("oom") as b:
            m3 = _frame(VGroup(*cl[8:10]), ISOLATION, buff=0.1)
            self.play(FadeOut(m2), FadeOut(p2), Create(m3), out.rows[2].animate.set_opacity(1), run_time=b.t(0.15))
            _at(self, b, 0.66)
            s3 = _frame(_glyphs(out.rows[2], _SIG_OUT[2], "SIGABRT"), ISOLATION)
            self.play(Create(s3), run_time=b.t(0.1))
            _at(self, b, 0.86)
            p3 = _frame(_glyphs(out.rows[2], _SIG_OUT[2], 'printed ""'), ISOLATION)
            cap = caption("heap full: V8 ended it with SIGABRT, and no JavaScript ran")
            self.play(Create(p3), FadeIn(cap), run_time=b.t(0.12))

        with self.beat("close") as b:
            OutlineDiagram(self).close_part(self, "start_again", next_key="widget_code", run_time=b.left)
