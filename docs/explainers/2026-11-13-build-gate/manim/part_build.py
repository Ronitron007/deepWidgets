"""part_build: plugin_hook_teach, import_fence, fence_hole, module_graph_teach, data_url_teach,
monkey_patch_teach, output_fence, postcss_teach, stylesheet_checks, build_child."""
from dwscene import *

ALLOWED = ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom", "react-dom/client",
           "@openuidev/react-lang", "@deepwidgets/widget-kit", "zod", "vite/modulepreload-polyfill"]
PREFIXES = ["@deepwidgets/shell/ui/*", "@deepwidgets/shell/components/*"]


def _corridor(w=11.0, h=2.6, y=0.6, color=BUILD):
    top = Line([-w / 2, y + h / 2, 0], [w / 2, y + h / 2, 0], stroke_color=color, stroke_width=3)
    bot = Line([-w / 2, y - h / 2, 0], [w / 2, y - h / 2, 0], stroke_color=color, stroke_width=3)
    return VGroup(top, bot)


def _door(x, y, h, color, label, sub=None):
    bar = Rectangle(width=0.18, height=h, stroke_width=0, fill_color=color, fill_opacity=0.85)
    bar.move_to([x, y, 0])
    t = T(label, SMALL, color, mono=True).next_to(bar, UP, buff=0.22)
    g = VGroup(bar, t)
    if sub:
        s = T(sub, SMALL, MUTED).next_to(bar, DOWN, buff=0.22)
        g.add(s)
    return g


class PluginHookTeach(DWScene):
    BEATS = [("word", 16), ("kitchen", 50), ("hooks", 42), ("pre", 30)]

    def construct(self):
        with self.beat("word") as b:
            title = scene_title("a plugin hook", BUILD)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("kitchen") as b:
            cor = _corridor()
            lab = T("the build, from the first import to the finished bundle", SMALL, MUTED)
            lab.move_to([0, 2.4, 0])
            self.play(Create(cor), FadeIn(lab), run_time=b.t(0.3))
            say = lines("a bundler plugin is an object with named functions.",
                        "the bundler calls each one at a fixed point of the build.",
                        size=LABEL, color=TEXT)
            say.move_to([0, -1.6, 0])
            self.play(FadeIn(say), run_time=b.t(0.3))
            kitchen = T("a kitchen inspector at two doors", SMALL, MUTED)
            kitchen.next_to(say, DOWN, buff=0.35)
            self.play(FadeIn(kitchen), run_time=b.t(0.25))
            self.cor, self.say = cor, VGroup(say, kitchen)

        with self.beat("hooks") as b:
            d1 = _door(-3.4, 0.6, 2.6, BUILD, "resolveId(source, importer)", "the delivery entrance")
            d2 = _door(3.9, 0.6, 2.6, BUILD, "generateBundle(bundle)", "the pass, where food leaves")
            self.play(FadeIn(d1), run_time=b.t(0.25))
            w1 = T("runs for every import, and it can refuse", SMALL, TEXT)
            w1.move_to([-3.4, 0.6, 0]).shift(LEFT * 0.1)
            w1 = lines("runs for every import,", "and it can refuse", size=SMALL, color=TEXT)
            w1.move_to([-5.2, 0.6, 0])
            w2 = lines("runs once at the end,", "with the finished bundle", size=SMALL, color=TEXT)
            w2.move_to([1.3, 0.6, 0])
            self.play(FadeIn(w1), run_time=b.t(0.2))
            self.play(FadeIn(d2), run_time=b.t(0.2))
            self.play(FadeIn(w2), run_time=b.t(0.2))
            self.d1 = d1

        with self.beat("pre") as b:
            badge = chip("enforce: 'pre'", CREATION)
            badge.next_to(self.d1, UP, buff=0.9)
            why = T("so the fence sees an import before any other plugin rewrites it", SMALL, MUTED)
            why.move_to([0, -3.2, 0])
            self.play(FadeIn(badge, shift=DOWN * 0.15), run_time=b.t(0.4))
            self.play(FadeIn(why), run_time=b.t(0.35))


class ImportFence(DWScene):
    BEATS = [("where", 10), ("only", 33), ("two", 41), ("list", 31), ("subpath", 32)]

    def construct(self):
        with self.beat("where") as b:
            title = scene_title("the import fence, on resolveId", BUILD)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("only") as b:
            q1 = ProcessBox("is the importer a file of page/ ?", color=BUILD, width=6.4, height=1.0)
            q1.move_to([-2.6, 2.1, 0])
            no = labeled_arrow(q1.get_right(), q1.get_right() + RIGHT * 1.6, "no", MUTED, side=UP,
                               mono=False)
            through = chip("let it through", MUTED, mono=False)
            through.next_to(no.arrow, RIGHT, buff=0.2)
            self.play(FadeIn(q1), run_time=b.t(0.35))
            self.play(GrowArrow(no.arrow), FadeIn(no.label), FadeIn(through), run_time=b.t(0.3))
            why = T("an allowed package imports its own files and dependencies", SMALL, MUTED)
            why.move_to([0, 1.2, 0])
            self.play(FadeIn(why), run_time=b.t(0.25))
            self.q1 = q1
            self.extra = VGroup(no, through, why)

        with self.beat("two") as b:
            bare = ProcessBox("a bare import", "react", color=TYPES, width=4.2, height=1.1)
            path = ProcessBox("a path import", "./child.tsx", color=TYPES, width=4.2, height=1.1)
            bare.move_to([-4.3, 0.0, 0])
            path.move_to([0.6, 0.0, 0])
            yes = labeled_arrow([self.q1.get_x(), self.q1.get_bottom()[1], 0],
                                [-1.9, 0.62, 0], "yes", CREATION, side=LEFT, mono=False)
            self.play(GrowArrow(yes.arrow), FadeIn(yes.label), run_time=b.t(0.2))
            self.play(FadeIn(bare), run_time=b.t(0.25))
            self.play(FadeIn(path), run_time=b.t(0.25))
            r1 = T("must be on the list, exactly", SMALL, TEXT).next_to(bare, DOWN, buff=0.3)
            r2 = lines("must resolve to a file", "inside page/", size=SMALL, color=TEXT)
            r2.next_to(path, DOWN, buff=0.3)
            self.play(FadeIn(r1), FadeIn(r2), run_time=b.t(0.25))
            self.tree = VGroup(self.q1, bare, path, yes, r1, r2)

        with self.beat("list") as b:
            self.play(FadeOut(self.tree), FadeOut(self.extra), run_time=b.t(0.08))
            col1 = lines(*ALLOWED[:5], size=SMALL, color=TEXT, mono=True)
            col2 = lines(*ALLOWED[5:], size=SMALL, color=TEXT, mono=True)
            cols = VGroup(col1, col2).arrange(RIGHT, buff=0.7, aligned_edge=UP)
            pre = lines(*PREFIXES, size=SMALL, color=CREATION, mono=True)
            body = VGroup(cols, pre).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
            panel = rbox(body.width + 0.6, body.height + 0.7, TYPES, fill=0.06, sw=2.5)
            head = T("ALLOWED, and two prefixes", SMALL, TYPES, bold=True)
            body.move_to(panel).shift(DOWN * 0.18)
            head.move_to([panel.get_left()[0] + 0.3, panel.get_top()[1] - 0.3, 0], aligned_edge=LEFT)
            g = VGroup(panel, head, body).move_to([0, 0.7, 0])
            self.play(FadeIn(panel), FadeIn(head), run_time=b.t(0.18))
            self.play(LaggedStart(*[FadeIn(x) for x in [*col1, *col2, *pre]], lag_ratio=0.18),
                      run_time=b.t(0.6))

        with self.beat("subpath") as b:
            bad = code_block("@deepwidgets/shell/ui/../../secret", "text")
            bad.move_to([-2.6, -2.1, 0])
            x = cross(ISOLATION).next_to(bad, RIGHT, buff=0.35)
            note = lines("a subpath with .. , a single dot, or an empty segment",
                         "can climb out of the folder a package means to expose",
                         size=SMALL, color=ISOLATION)
            note.move_to([0, -3.3, 0])
            self.play(FadeIn(bad), run_time=b.t(0.3))
            self.play(FadeIn(x), run_time=b.t(0.2))
            self.play(FadeIn(note), run_time=b.t(0.3))


class FenceHole(DWScene):
    BEATS = [("why", 11), ("never", 21), ("ways", 53), ("reviewer", 42), ("result", 14)]

    WAYS = [("@import", "a stylesheet pulls in another stylesheet"),
            ("image-set()", "a stylesheet names an image"),
            ("new URL(..., import.meta.url)", "a script builds a file path"),
            ("a plugin reads a file", "no import at all")]

    def construct(self):
        with self.beat("why") as b:
            title = scene_title("that fence is not enough", ISOLATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("never") as b:
            cor = _corridor(w=11.0, h=1.6, y=1.9)
            door = _door(-3.4, 1.9, 1.6, BUILD, "resolveId")
            lab = T("the fence reads imports", SMALL, MUTED).move_to([3.0, 1.9, 0])
            self.play(Create(cor), FadeIn(door), FadeIn(lab), run_time=b.t(0.5))
            self.cor = VGroup(cor, door, lab)

        with self.beat("ways") as b:
            rows = VGroup()
            for i, (form, what) in enumerate(self.WAYS):
                f = T(form, SMALL, ISOLATION, mono=True)
                w = T(what, SMALL, MUTED)
                f.move_to([-6.2, 0.4 - i * 0.72, 0], aligned_edge=LEFT)
                w.move_to([-0.6, 0.4 - i * 0.72, 0], aligned_edge=LEFT)
                tag = T("no import", SMALL, ISOLATION)
                tag.move_to([5.4, 0.4 - i * 0.72, 0], aligned_edge=LEFT)
                rows.add(VGroup(f, w, tag))
            self.play(LaggedStart(*[FadeIn(r, shift=RIGHT * 0.15) for r in rows], lag_ratio=0.45),
                      run_time=b.t(0.85))
            self.rows = rows

        with self.beat("reviewer") as b:
            marks = VGroup(*[cross(ISOLATION, 0.34).next_to(r, LEFT, buff=0.3) for r in self.rows])
            for m, r in zip(marks, self.rows):
                m.move_to([-6.6, r.get_y(), 0])
            self.play(LaggedStart(*[FadeIn(m, scale=1.4) for m in marks], lag_ratio=0.3),
                      run_time=b.t(0.4))
            found = lines("we shipped the syntax checks first, for the forms we knew.",
                          "a reviewer then found four more that got past them.",
                          size=LABEL, color=TEXT)
            found.move_to([0, -2.1, 0])
            self.play(FadeIn(found), run_time=b.t(0.35))
            one = T("one was an @import with no space after the keyword", SMALL, MUTED)
            one.next_to(found, DOWN, buff=0.3)
            self.play(FadeIn(one), run_time=b.t(0.2))

        with self.beat("result") as b:
            cap = T("so the second fence does not read syntax at all: it reads the result",
                    BODY, SOLVED, bold=True)
            cap.move_to([0, -3.4, 0])
            self.play(FadeIn(cap, shift=UP * 0.15), run_time=b.t(0.6))


class ModuleGraphTeach(DWScene):
    BEATS = [("words", 5), ("graph", 55), ("emitted", 26), ("question", 27)]

    def construct(self):
        with self.beat("words") as b:
            title = scene_title("the module graph, and watch files", BUILD)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("graph") as b:
            nodes = {}
            spec = [("main.tsx", [-4.6, 1.9]), ("child.tsx", [-5.6, 0.5]), ("library.tsx", [-3.2, 0.5]),
                    ("styles.css", [-4.4, -0.9])]
            for name, (x, y) in spec:
                nodes[name] = chip(name, BUILD).move_to([x, y, 0])
            edges = VGroup(
                labeled_arrow(nodes["main.tsx"].get_bottom(), nodes["child.tsx"].get_top(), None, BUILD),
                labeled_arrow(nodes["main.tsx"].get_bottom(), nodes["library.tsx"].get_top(), None, BUILD),
                labeled_arrow(nodes["main.tsx"].get_left(), nodes["styles.css"].get_top(), None, BUILD))
            head = T("every module it pulled in, with its path", SMALL, MUTED)
            head.move_to([-4.4, 2.6, 0])
            self.play(FadeIn(head), run_time=b.t(0.12))
            self.play(LaggedStart(*[FadeIn(n) for n in nodes.values()], lag_ratio=0.3),
                      run_time=b.t(0.3))
            self.play(LaggedStart(*[GrowArrow(e.arrow) for e in edges], lag_ratio=0.3),
                      run_time=b.t(0.18))
            wf = lines("page.css", "theme.css", size=SMALL, color=CREATION, mono=True)
            box = rbox(wf.width + 0.8, wf.height + 1.0, CREATION, fill=0.06, sw=2.5)
            wtag = T("watch files", SMALL, CREATION, bold=True)
            wf.move_to(box).shift(DOWN * 0.22)
            wtag.move_to([box.get_x(), box.get_top()[1] - 0.32, 0])
            g = VGroup(box, wtag, wf).move_to([0.9, 0.9, 0])
            self.play(FadeIn(g), run_time=b.t(0.2))
            note = lines("read, but not turned into modules:", "a stylesheet it followed is one",
                         size=SMALL, color=MUTED)
            note.next_to(g, DOWN, buff=0.3)
            self.play(FadeIn(note), run_time=b.t(0.2))
            self.graph = VGroup(head, *nodes.values(), edges, g, note)

        with self.beat("emitted") as b:
            em = VGroup(*[chip(n, VITE) for n in ("assets/index.js", "assets/index.css", "logo.png")])
            em.arrange(DOWN, buff=0.22).move_to([4.8, 0.9, 0])
            back = lines("each one remembers", "the path it came from", size=SMALL, color=MUTED)
            back.move_to([4.8, -0.7, 0])
            self.play(LaggedStart(*[FadeIn(e) for e in em], lag_ratio=0.35), run_time=b.t(0.5))
            self.play(FadeIn(back), run_time=b.t(0.3))

        with self.beat("question") as b:
            q = T("which files on this disk went into this page?", HEADING, SOLVED, bold=True)
            q.move_to([0, -2.4, 0])
            self.play(FadeIn(q, shift=UP * 0.15), run_time=b.t(0.45))
            a = T("one answer, whatever syntax put them there", SMALL, MUTED)
            a.next_to(q, DOWN, buff=0.35)
            self.play(FadeIn(a), run_time=b.t(0.3))


class DataUrlTeach(DWScene):
    BEATS = [("word", 11), ("embed", 49), ("trap", 35), ("two", 26)]

    def construct(self):
        with self.beat("word") as b:
            title = scene_title("a data URL", BUILD)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("embed") as b:
            png = rbox(1.9, 1.5, VITE, fill=0.1, sw=2.5).move_to([-5.0, 1.5, 0])
            pl = T("logo.png", SMALL, VITE, mono=True).move_to(png)
            limit = lines("below the size limit", "of the bundler", size=SMALL, color=MUTED)
            limit.move_to([-2.2, 1.5, 0])
            arrow = labeled_arrow(png.get_right(), [-3.5, 1.5, 0], None, VITE)
            self.play(FadeIn(png), FadeIn(pl), run_time=b.t(0.2))
            self.play(GrowArrow(arrow.arrow), FadeIn(limit), run_time=b.t(0.25))
            css = code_block("background: url(data:image/png;base64,iVBOR...);", "css")
            css.move_to([2.4, 1.5, 0])
            self.play(FadeIn(css), run_time=b.t(0.35))
            inside = T("the bytes sit inside the script or the stylesheet, as text", SMALL, MUTED)
            inside.move_to([0.6, 0.4, 0])
            self.play(FadeIn(inside), run_time=b.t(0.15))

        with self.beat("trap") as b:
            folder = rbox(4.0, 1.9, DISK, fill=0.04, sw=2.5).move_to([-3.6, -1.4, 0])
            ftag = T("the output folder", SMALL, DISK).next_to(folder, UP, buff=0.2)
            empty = T("nothing wrong here", SMALL, MUTED).move_to(folder)
            trap = lines("an embedded file is not a file", "in the output folder",
                         size=LABEL, color=ISOLATION)
            trap.move_to([3.0, -1.4, 0])
            self.play(FadeIn(folder), FadeIn(ftag), FadeIn(empty), run_time=b.t(0.4))
            self.play(FadeIn(trap), run_time=b.t(0.4))

        with self.beat("two") as b:
            cap = T("two of the four bypasses worked exactly this way", BODY, ISOLATION)
            cap.move_to([0, -3.2, 0])
            self.play(FadeIn(cap), run_time=b.t(0.5))


class MonkeyPatchTeach(DWScene):
    BEATS = [("word", 13), ("patch", 42), ("five", 51), ("limit", 43)]

    def construct(self):
        with self.beat("word") as b:
            title = scene_title("monkey patching", BUILD)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("patch") as b:
            orig = ProcessBox("readFile", color=HOST, width=3.0, height=0.9)
            orig.move_to([-4.3, 1.9, 0])
            wrap = rbox(4.4, 2.3, BUILD, fill=0.07, sw=3).move_to([0.9, 1.6, 0])
            wtag = T("our wrapper", SMALL, BUILD, bold=True)
            wlines = lines("record the path", "then call the original", size=SMALL, color=TEXT)
            VGroup(wtag, wlines).arrange(DOWN, buff=0.22).move_to(wrap)
            a = labeled_arrow(orig.get_right(), wrap.get_left(), "swapped for", MUTED, side=UP,
                              mono=False)
            recorder = chip("the read recorder: a set of paths", BUILD, mono=False)
            recorder.move_to([0.9, -0.3, 0])
            down = labeled_arrow(wrap.get_bottom(), recorder.get_top(), None, BUILD)
            self.play(FadeIn(orig), run_time=b.t(0.2))
            self.play(GrowArrow(a.arrow), FadeIn(a.label), FadeIn(wrap), FadeIn(wtag),
                      FadeIn(wlines), run_time=b.t(0.4))
            self.play(GrowArrow(down.arrow), FadeIn(recorder), run_time=b.t(0.25))
            self.top = VGroup(orig, a, wrap, wtag, wlines, down, recorder)

        with self.beat("five") as b:
            fs = lines("readFile", "readFileSync", "createReadStream", "open", "openSync",
                       size=SMALL, color=TEXT, mono=True)
            fsbox = rbox(fs.width + 0.9, fs.height + 1.0, HOST, fill=0.06, sw=2.5)
            fstag = T("node:fs", SMALL, HOST, bold=True, mono=True)
            fs.move_to(fsbox).shift(DOWN * 0.22)
            fstag.move_to([fsbox.get_x(), fsbox.get_top()[1] - 0.32, 0])
            g1 = VGroup(fsbox, fstag, fs)
            pr = lines("readFile", "open", size=SMALL, color=TEXT, mono=True)
            prbox = rbox(pr.width + 1.6, pr.height + 1.0, HOST, fill=0.06, sw=2.5)
            prtag = T("node:fs/promises", SMALL, HOST, bold=True, mono=True)
            pr.move_to(prbox).shift(DOWN * 0.22)
            prtag.move_to([prbox.get_x(), prbox.get_top()[1] - 0.32, 0])
            g2 = VGroup(prbox, prtag, pr)
            VGroup(g1, g2).arrange(RIGHT, buff=0.7, aligned_edge=UP).move_to([-3.6, -1.6, 0])
            self.play(FadeIn(g1), run_time=b.t(0.3))
            self.play(FadeIn(g2), run_time=b.t(0.25))
            sync = code_block("syncBuiltinESMExports()", "typescript")
            sync.move_to([3.6, -1.1, 0])
            syncn = lines("one call makes the wrapped versions visible",
                          "to code that imported them by name", size=SMALL, color=MUTED)
            syncn.next_to(sync, DOWN, buff=0.3)
            self.play(FadeIn(sync), FadeIn(syncn), run_time=b.t(0.3))

        with self.beat("limit") as b:
            self.play(FadeOut(self.top), run_time=b.t(0.1))
            native = ProcessBox("a native module", "reads files through its own code",
                                color=OPEN, width=5.6, height=1.3, dashed=True)
            native.move_to([-2.6, 1.9, 0])
            disk = disk_icon(DISK, 1.0).move_to([3.6, 1.9, 0])
            dlab = T("the disk", SMALL, DISK).next_to(disk, DOWN, buff=0.25)
            a = labeled_arrow(native.get_right(), disk.get_left(), "not seen", OPEN, side=UP,
                              mono=False, dashed=True)
            self.play(FadeIn(native), run_time=b.t(0.3))
            self.play(Create(a.arrow), FadeIn(a.label), FadeIn(disk), FadeIn(dlab), run_time=b.t(0.3))
            tw = T("the Tailwind scanner is one; it reports its files as watch files",
                   SMALL, MUTED)
            tw.move_to([0, 0.5, 0])
            self.play(FadeIn(tw), run_time=b.t(0.25))


class OutputFence(DWScene):
    BEATS = [("now", 9), ("four", 44), ("real", 52), ("else", 25), ("guard", 21)]

    LISTS = ["every module of the module graph", "every watch file",
             "the original path of every emitted file", "every path the recorder saw"]

    def construct(self):
        with self.beat("now") as b:
            title = scene_title("the output fence, on generateBundle", BUILD)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("four") as b:
            items = VGroup(*[chip(x, BUILD, mono=False) for x in self.LISTS])
            items.arrange(DOWN, buff=0.26).move_to([-4.0, 1.3, 0])
            one = ProcessBox("one set of paths", color=BUILD, width=3.6, height=1.0)
            one.move_to([1.6, 1.3, 0])
            arrows = VGroup(*[labeled_arrow(i.get_right(), one.get_left(), None, BUILD) for i in items])
            self.play(LaggedStart(*[FadeIn(i, shift=RIGHT * 0.15) for i in items], lag_ratio=0.4),
                      run_time=b.t(0.6))
            self.play(LaggedStart(*[GrowArrow(a.arrow) for a in arrows], lag_ratio=0.2),
                      FadeIn(one), run_time=b.t(0.25))
            self.one = one

        with self.beat("real") as b:
            rp = ProcessBox("realpath", "it follows every link", color=LINK, width=3.6, height=1.1)
            rp.move_to([5.2, 1.3, 0])
            a = labeled_arrow(self.one.get_right(), rp.get_left(), None, BUILD)
            self.play(GrowArrow(a.arrow), FadeIn(rp), run_time=b.t(0.25))
            tests = VGroup(*[chip(x, SOLVED, mono=False) for x in
                             ("inside page/", "inside the staging folder",
                              "inside an allowed package folder")])
            tests.arrange(RIGHT, buff=0.4).move_to([0, -0.7, 0])
            head = T("three ways to be fine", SMALL, MUTED).next_to(tests, UP, buff=0.3)
            self.play(FadeIn(head), run_time=b.t(0.12))
            self.play(LaggedStart(*[FadeIn(t) for t in tests], lag_ratio=0.4), run_time=b.t(0.5))
            self.tests = tests

        with self.beat("else") as b:
            bucket = rbox(10.6, 1.5, ISOLATION, fill=0.08, sw=3).move_to([0, -2.4, 0])
            msg = lines("the page reads 1 file(s) outside the page folder: <path>.",
                        "A page may use only files in page/ and the allowed packages.",
                        size=SMALL, color=TEXT, mono=True)
            msg.move_to(bucket)
            self.play(FadeIn(bucket), run_time=b.t(0.25))
            self.play(FadeIn(msg), run_time=b.t(0.4))
            cnt = T("the count, and the first five paths", SMALL, ISOLATION)
            cnt.next_to(bucket, DOWN, buff=0.22)
            self.play(FadeIn(cnt), run_time=b.t(0.2))

        with self.beat("guard") as b:
            cap = T("one exemption stays, and we come back to it at the end", SMALL, MUTED)
            cap.move_to([0, 0.2, 0])
            self.play(FadeIn(cap), run_time=b.t(0.5))


class PostcssTeach(DWScene):
    BEATS = [("word", 15), ("what", 35), ("lookup", 42), ("inline", 17)]

    def construct(self):
        with self.beat("word") as b:
            title = scene_title("PostCSS", BUILD)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("what") as b:
            sheet = _sheet_icon().move_to([-5.4, 1.6, 0])
            slab = T("styles.css", SMALL, VITE, mono=True).next_to(sheet, DOWN, buff=0.22)
            tool = ProcessBox("PostCSS", "parse, plugins, write out", color=BUILD,
                              width=4.4, height=1.2).move_to([-0.6, 1.6, 0])
            plugins = VGroup(chip("Tailwind", VITE), chip("...", VITE)).arrange(DOWN, buff=0.2)
            plugins.move_to([4.4, 1.6, 0])
            a1 = labeled_arrow(sheet.get_right(), tool.get_left(), None, VITE)
            a2 = labeled_arrow(tool.get_right(), plugins.get_left(), "a list of plugins", VITE,
                               side=UP, mono=False)
            self.play(FadeIn(sheet), FadeIn(slab), run_time=b.t(0.25))
            self.play(GrowArrow(a1.arrow), FadeIn(tool), run_time=b.t(0.3))
            self.play(GrowArrow(a2.arrow), FadeIn(a2.label), FadeIn(plugins), run_time=b.t(0.35))

        with self.beat("lookup") as b:
            steps = VGroup(*[T(p, SMALL, TEXT, mono=True) for p in
                             ("page/", "the widget folder/", "the folder above/")])
            for i, s in enumerate(steps):
                s.move_to([-4.2, -0.3 - i * 0.62, 0], aligned_edge=LEFT)
            up = labeled_arrow([-4.6, -1.6, 0], [-4.6, -0.2, 0], None, MUTED)
            head = T("it looks for a config file, up the folder tree", SMALL, MUTED)
            head.move_to([-1.2, 0.4, 0])
            self.play(FadeIn(head), run_time=b.t(0.15))
            self.play(GrowArrow(up.arrow), LaggedStart(*[FadeIn(s) for s in steps], lag_ratio=0.4),
                      run_time=b.t(0.35))
            stop = VGroup(RegularPolygon(8, color=ISOLATION, fill_color=ISOLATION, fill_opacity=0.25,
                                         stroke_width=4).scale(0.75),
                          T("STOP", SMALL, ISOLATION, bold=True))
            stop.move_to([0.6, -1.0, 0])
            warn = lines("a config file is a list of code to run,",
                         "and the agent owns the page folder", size=LABEL, color=ISOLATION)
            warn.move_to([4.0, -1.0, 0])
            self.play(FadeIn(stop, scale=1.2), run_time=b.t(0.2))
            self.play(FadeIn(warn), run_time=b.t(0.25))

        with self.beat("inline") as b:
            code = code_block("css: { postcss: {} }", "typescript")
            code.move_to([0, -2.9, 0])
            note = T("the build passes its own config inline, so the tool looks for no file",
                     SMALL, MUTED)
            note.next_to(code, UP, buff=0.3)
            self.play(FadeIn(note), FadeIn(code), run_time=b.t(0.6))


def _sheet_icon(color=VITE, w=1.3, h=1.7):
    page = rbox(w, h, color, fill=0.06, sw=2.5)
    bars = VGroup(*[Line([-w * 0.3, 0, 0], [w * 0.3 * (1 - 0.2 * i), 0, 0], stroke_color=color,
                         stroke_width=3) for i in range(4)])
    bars.arrange(DOWN, buff=0.18, aligned_edge=LEFT).move_to(page)
    return VGroup(page, bars)


class StylesheetChecks(DWScene):
    BEATS = [("with", 8), ("file", 23), ("rules", 36), ("why", 36)]

    def construct(self):
        with self.beat("with") as b:
            title = scene_title("three rules on a page stylesheet", BUILD)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("file") as b:
            item = T("page/postcss.config.mjs", BODY, ISOLATION, mono=True)
            item.move_to([-3.4, 2.1, 0])
            x = cross(ISOLATION).next_to(item, LEFT, buff=0.4)
            diag = lines("page/postcss.config.mjs: a page may not have a PostCSS",
                         "or Tailwind config file. The build uses its own config.",
                         size=SMALL, color=TEXT, mono=True)
            diag.move_to([0, 1.2, 0])
            self.play(FadeIn(x), FadeIn(item), run_time=b.t(0.35))
            self.play(FadeIn(diag), run_time=b.t(0.4))

        with self.beat("rules") as b:
            items = VGroup(T("@plugin", BODY, ISOLATION, mono=True),
                           T("@config", BODY, ISOLATION, mono=True))
            items.arrange(RIGHT, buff=1.2).move_to([-3.4, 0.0, 0])
            xs = VGroup(cross(ISOLATION).next_to(items, LEFT, buff=0.4))
            diag = lines("page/styles.css: @plugin is not allowed in a page stylesheet.",
                         "The build loads no plugin or config of the page.",
                         size=SMALL, color=TEXT, mono=True)
            diag.move_to([0, -0.9, 0])
            strip = T("the gate strips the comments out first, then looks for the keywords",
                      SMALL, MUTED)
            strip.move_to([0, -1.7, 0])
            self.play(FadeIn(xs), FadeIn(items), run_time=b.t(0.3))
            self.play(FadeIn(diag), run_time=b.t(0.35))
            self.play(FadeIn(strip), run_time=b.t(0.25))

        with self.beat("why") as b:
            why = lines("the output fence would catch the file that such a rule pulls in.",
                        "these three rules exist for the error message.",
                        size=LABEL, color=TEXT)
            why.move_to([0, -2.8, 0])
            self.play(FadeIn(why), run_time=b.t(0.45))
            beat = T("a line that names the file and the rule beats a list of five paths",
                     SMALL, SOLVED)
            beat.next_to(why, DOWN, buff=0.3)
            self.play(FadeIn(beat), run_time=b.t(0.3))


class BuildChild(DWScene):
    BEATS = [("own", 7), ("job", 45), ("why", 36), ("limit", 44)]

    def construct(self):
        with self.beat("own") as b:
            title = scene_title("the build runs in its own process", BUILD)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        with self.beat("job") as b:
            host = ProcessBox("host", "the gate", color=HOST, width=3.4, height=1.5)
            host.move_to([-4.4, 1.5, 0])
            child = ProcessBox("build child", "Vite", color=BUILD, width=3.8, height=1.5)
            child.move_to([2.0, 1.5, 0])
            job = labeled_arrow(host.get_right(), child.get_left(), "job.json", BUILD, side=UP)
            res = code_block('RESULT {"ok":true,"name":"page-3f9c2a...","ms":1250}', "text")
            res.scale_to_fit_width(7.6)
            res.move_to([1.2, -0.4, 0])
            resa = labeled_arrow(child.get_bottom(), [res.get_x(), res.get_top()[1], 0],
                                 "one line on its stdout", BUILD, side=RIGHT, mono=False)
            self.play(FadeIn(host), run_time=b.t(0.2))
            self.play(GrowArrow(job.arrow), FadeIn(job.label), FadeIn(child), run_time=b.t(0.3))
            self.play(GrowArrow(resa.arrow), FadeIn(resa.label), run_time=b.t(0.15))
            self.play(FadeIn(res), run_time=b.t(0.25))
            self.host, self.child = host, child

        with self.beat("why") as b:
            beats_line = VMobject(stroke_color=SOLVED, stroke_width=3)
            pts = []
            for i in range(28):
                x = -6.4 + i * 0.22
                y = 2.9 + (0.28 if i % 7 == 3 else 0.0)
                pts.append([x, y, 0])
            beats_line.set_points_as_corners(pts)
            hb = T("the heartbeat of the host stays unbroken", SMALL, SOLVED)
            hb.move_to([1.4, 2.95, 0])
            self.play(Create(beats_line), FadeIn(hb), run_time=b.t(0.35))
            why = lines("a build has long steps that do not pause.",
                        "a build inside the host would look like a frozen host.",
                        size=LABEL, color=TEXT)
            why.move_to([0, -1.9, 0])
            self.play(FadeIn(why), run_time=b.t(0.45))

        with self.beat("limit") as b:
            bar = rbox(8.6, 0.6, CREATION, fill=0.08, sw=2.5).move_to([-0.6, -3.0, 0])
            lab = T("90 s", SMALL, CREATION, mono=True).move_to(bar)
            kill = chip("SIGKILL", ISOLATION)
            kill.next_to(bar, RIGHT, buff=0.35)
            self.play(FadeIn(bar), FadeIn(lab), run_time=b.t(0.25))
            self.play(FadeIn(kill), run_time=b.t(0.2))
            fails = lines("it also fails with no result line,",
                          "and when the build wrote no index page", size=SMALL, color=MUTED)
            fails.move_to([0, -2.3, 0])
            self.play(FadeIn(fails), run_time=b.t(0.3))
