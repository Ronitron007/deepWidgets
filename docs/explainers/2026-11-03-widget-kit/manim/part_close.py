"""Part `part_close`: prior_art risks_build risks_supply work_map open_items closing.
Prior art, the risks, the work map, the open points for the operator, and the close on the outline.

Beat weights are seconds of the final audio: each beat starts at the pause before its sentence
(ffmpeg silencedetect). The base scales them to the audio length.
"""
from dwscene import *

_X0 = -FRAME_W / 2 + MARGIN + 0.25   # left edge of content
_X1 = FRAME_W / 2 - MARGIN - 0.1     # right edge of content


# ---------------------------------------------------------------- part helpers
def _at(scene, b, frac):
    """Wait until `frac` of beat b has passed (no-op if already later)."""
    scene.wait_until(b.start + frac * b.length)


def _esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _mono(s, color=None):
    c = f' fgcolor="{color}"' if color else ""
    return f'<span font_family="{MONO}"{c}>{_esc(s)}</span>'


def _col(s, color):
    return f'<span fgcolor="{color}">{_esc(s)}</span>'


def _b(s, color=None):
    c = f' fgcolor="{color}"' if color else ""
    return f'<span weight="bold"{c}>{_esc(s)}</span>'


def _card(rows, color, w, size=LABEL, dashed=False, pad=0.3, buff=0.14):
    """Box in `color` with markup rows, left-aligned. .box .rows"""
    txt = VGroup(*[M(r, size, TEXT) for r in rows]).arrange(DOWN, buff=buff, aligned_edge=LEFT)
    box = rbox(w, txt.height + 2 * pad - 0.05, color, fill=0.1, dashed=dashed)
    txt.move_to(box).align_to(box, LEFT).shift(RIGHT * pad)
    g = VGroup(box, txt)
    g.box, g.rows = box, txt
    return g


def _frame(m, color, buff=0.06):
    return SurroundingRectangle(m, color=color, buff=buff, stroke_width=4, corner_radius=0.14)


def _badge(rows, color, size=BODY):
    """Bold lines on an opaque patch, to sit on the outline."""
    t = VGroup(*[T(r, size, color, bold=True) for r in rows]).arrange(DOWN, buff=0.1)
    bg = RoundedRectangle(corner_radius=0.1, width=t.width + 0.34, height=t.height + 0.26, stroke_color=color,
                          stroke_width=2.5, fill_color=BG, fill_opacity=0.95)
    bg.move_to(t)
    return VGroup(bg, t)


# ====================================================================== prior_art
class PriorArt(DWScene):
    BEATS = [("open", 3.4), ("ctx7", 5.6), ("match", 2.2), ("llms", 4.8), ("raycast", 4.6), ("valtown", 3.0),
             ("observable", 5.0), ("memory", 4.4), ("parts", 3.8)]

    VERIFIED, MEMORY = "verified", "from memory"

    def construct(self):
        with self.beat("open") as b:
            OutlineDiagram().open_part(self, "kit_row", also=("today_row",), run_time=b.left)

        title = scene_title("Prior art: other projects solve parts", KIT)
        specs = [
            ("Context7", self.VERIFIED, "two tools: find a library, docs on request"),
            ("llms.txt", self.MEMORY, "index + full file"),
            ("Raycast, VS Code", self.MEMORY, "each extension build includes its own packages"),
            ("Val Town", self.MEMORY, _mono("npm:pkg@ver") + " per import"),
            ("Observable, Deno import maps", self.MEMORY, "build resolves and pins each import"),
        ]
        y0, pitch = 2.3, 0.98
        rows, seps = [], []
        for i, (name, src, desc) in enumerate(specs):
            y = y0 - i * pitch
            nm = T(name, LABEL, TEXT, bold=True, mono=name == "llms.txt")
            sc = T(f"({src})", LABEL, SOLVED if src == self.VERIFIED else MUTED)
            head = VGroup(nm, sc).arrange(RIGHT, buff=0.25, aligned_edge=DOWN)
            head.move_to([_X0, y, 0], aligned_edge=LEFT)
            d = M(desc if "<span" in desc else _esc(desc), LABEL, TEXT)
            d.next_to(head, DOWN, buff=0.14).align_to(head, LEFT).shift(RIGHT * 0.4)
            rows.append(VGroup(head, d))
            if i:
                ly = y + 0.29
                seps.append(Line([_X0 - 0.1, ly, 0], [_X1 - 0.3, ly, 0], stroke_color=MUTED, stroke_width=1.5,
                                 stroke_opacity=0.55))

        with self.beat("ctx7") as b:
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.15))
            self.play(FadeIn(rows[0][0], shift=RIGHT * 0.1), run_time=b.t(0.15))
            _at(self, b, 0.32)
            self.play(FadeIn(rows[0][1], shift=RIGHT * 0.1), run_time=b.t(0.25))

        with self.beat("match") as b:
            arr = Arrow(ORIGIN, RIGHT * 0.7, buff=0, color=DESCRIBE, stroke_width=3, tip_length=0.16,
                        max_tip_length_to_length_ratio=0.35)
            mt = M("matches the kit " + _col("index", DESCRIBE) + " and " + _col("card", DESCRIBE), LABEL, TEXT)
            mg = VGroup(arr, mt).arrange(RIGHT, buff=0.2).next_to(rows[0][1], RIGHT, buff=0.35)
            self.play(GrowArrow(arr), FadeIn(mt, shift=RIGHT * 0.1), run_time=b.t(0.5))

        for i, name in enumerate(("llms", "raycast", "valtown", "observable"), start=1):
            with self.beat(name) as b:
                self.play(Create(seps[i - 1]), FadeIn(rows[i], shift=RIGHT * 0.1), run_time=b.t(0.35))

        with self.beat("memory") as b:
            mem = VGroup(*[r[0][1] for r in rows[1:]])
            _at(self, b, 0.22)
            self.play(Create(_frame(rows[0][0][1], SOLVED, buff=0.08)), run_time=b.t(0.3))
            _at(self, b, 0.6)
            self.play(Indicate(mem, color=MUTED, scale_factor=1.08), run_time=b.t(0.35))

        with self.beat("parts") as b:
            cap = caption("no project does the whole path")
            self.play(FadeIn(cap, shift=UP * 0.1), run_time=b.t(0.3))


# ====================================================================== risks_build
class RisksBuild(DWScene):
    BEATS = [("title", 2.5), ("render", 3.2), ("untyped", 4.8), ("wrongprop", 5.1), ("s3", 8.1), ("nm", 5.15),
             ("lucide", 5.05), ("record", 4.4), ("ours", 6.42)]

    def construct(self):
        with self.beat("title") as b:
            title = scene_title("Risks: the build", ISOLATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.5))

        lw, rw = 6.2, 6.45
        lx, rx = _X0, _X1 - rw
        c_render = _card([_col("render check", CREATION) + " finds only throws"], ISOLATION, lw)
        c_untyped = _card([_b("untyped extra", HOST_EXTRAS) + ": " + _mono("TS7016"),
                           "until " + _mono("declare module") + ",",
                           "then wrong prop passes",
                           _col("(spike record, not checked)", INFERRED)], INFERRED, lw)
        c_s3 = _card([_col("S3", PNPM) + " cannot tree-shake:",
                      _mono("lucide") + " " + _b("903 KB") + ", " + _mono("recharts") + " " + _b("578 KB")],
                     ISOLATION, lw)
        left = VGroup(c_render, c_untyped, c_s3).arrange(DOWN, buff=0.32, aligned_edge=LEFT)
        left.move_to([lx, 2.65, 0], aligned_edge=UL)

        c_nm = _card([_col("kit v1", KIT) + " " + _mono("node_modules") + " " + _b("228 MB") + " " + _col("(du)", MUTED)],
                     ISOLATION, rw)
        c_luc = _card([_mono("lucide-react") + " " + _b("45 MB") + ",",
                       _mono("date-fns") + " " + _b("38 MB") + " " + _col("(du)", MUTED)], ISOLATION, rw)
        c_rec = _card([_col("spike record:", INFERRED), _esc('"about 85 MB of the kit is build tooling"')],
                      INFERRED, rw)
        ours = M("our du sum: " + _b("75 to 90 MB") + ", by tool list " + _col("(ran)", MUTED), LABEL, TEXT)
        right = VGroup(c_nm, c_luc, c_rec).arrange(DOWN, buff=0.32, aligned_edge=LEFT)
        right.move_to([rx, 2.65, 0], aligned_edge=UL)
        ours.next_to(c_rec, DOWN, buff=0.22).align_to(c_rec, LEFT).shift(RIGHT * 0.3)
        hook = VMobject(stroke_color=MUTED, stroke_width=2.5).set_points_as_corners(
            [c_rec.box.get_corner(DL) + RIGHT * 0.15, [c_rec.box.get_left()[0] + 0.15, ours.get_y(), 0],
             [ours.get_left()[0] - 0.08, ours.get_y(), 0]])

        with self.beat("render") as b:
            self.play(FadeIn(c_render, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("untyped") as b:
            self.play(FadeIn(c_untyped.box), FadeIn(c_untyped.rows[0], shift=UP * 0.1), run_time=b.t(0.25))
            _at(self, b, 0.55)
            self.play(FadeIn(c_untyped.rows[1], shift=UP * 0.1), run_time=b.t(0.2))

        with self.beat("wrongprop") as b:
            self.play(FadeIn(c_untyped.rows[2], shift=UP * 0.1), run_time=b.t(0.25))
            _at(self, b, 0.72)
            self.play(FadeIn(c_untyped.rows[3], shift=UP * 0.1), run_time=b.t(0.25))

        with self.beat("s3") as b:
            self.play(FadeIn(c_s3.box), FadeIn(c_s3.rows[0], shift=UP * 0.1), run_time=b.t(0.2))
            _at(self, b, 0.4)
            self.play(FadeIn(c_s3.rows[1], shift=UP * 0.1), run_time=b.t(0.2))

        with self.beat("nm") as b:
            self.play(FadeIn(c_nm, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("lucide") as b:
            self.play(FadeIn(c_luc, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("record") as b:
            self.play(FadeIn(c_rec, shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("ours") as b:
            self.play(Create(hook), FadeIn(ours, shift=RIGHT * 0.1), run_time=b.t(0.3))
            _at(self, b, 0.57)
            cap = caption("the range depends on which helper packages we count")
            self.play(FadeIn(cap, shift=UP * 0.1), run_time=b.t(0.2))


# ====================================================================== risks_supply
class RisksSupply(DWScene):
    BEATS = [("mra", 6.3), ("file", 5.65), ("fixed", 3.65), ("external", 6.3), ("infer", 1.9), ("native", 5.68)]

    def construct(self):
        w = 12.6
        c_mra = _card([_mono("minimumReleaseAge", PNPM) + ": security fix held " + _b("24 h") + " unless excluded"],
                      ISOLATION, w)
        c_file = _card([_mono("file:", PNPM) + " extra recorded as a path relative to the project",
                        _col("kit layout must stay fixed", KIT)], ISOLATION, w)
        c_ext = _card([_col("external host import", HOST_EXTRAS) + " can resolve from "
                       + _mono("<profile>/node_modules") + " " + _col("(inferred)", INFERRED)], INFERRED, w)
        c_nat = _card([_col("native addon", HOST_EXTRAS) + ": ABI " + _b("149") + " vs " + _b("137")], ISOLATION, w)
        cards = VGroup(c_mra, c_file, c_ext, c_nat).arrange(DOWN, buff=0.38, aligned_edge=LEFT)
        cards.move_to([_X0, 2.55, 0], aligned_edge=UL)

        with self.beat("mra") as b:
            title = scene_title("Risks: packages and the host", ISOLATION)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.2))
            self.play(FadeIn(c_mra, shift=UP * 0.1), run_time=b.t(0.25))

        with self.beat("file") as b:
            self.play(FadeIn(c_file.box), FadeIn(c_file.rows[0], shift=UP * 0.1), run_time=b.t(0.3))

        with self.beat("fixed") as b:
            self.play(FadeIn(c_file.rows[1], shift=UP * 0.1), run_time=b.t(0.35))

        with self.beat("external") as b:
            self.play(FadeIn(c_ext.box), FadeIn(c_ext.rows[0][:-10], shift=UP * 0.1), run_time=b.t(0.25))

        with self.beat("infer") as b:
            self.play(FadeIn(c_ext.rows[0][-10:], scale=1.2), run_time=b.t(0.6))

        with self.beat("native") as b:
            self.play(FadeIn(c_nat, shift=UP * 0.1), run_time=b.t(0.25))


# ====================================================================== work_map
class WorkMap(DWScene):
    BEATS = [("open", 2.0), ("estimate", 2.2), ("large", 4.9), ("med1", 7.7), ("med2", 7.4), ("med3", 3.4),
             ("small", 4.2), ("tally", 3.84)]

    ROWS = [
        ("MCP kit tools and index", "M", MCP),
        ("kit service with pnpm", "L", PNPM),
        ("settings pane", "M", SETTINGS),
        ("/api/kit routes", "S", SETTINGS),
        ("Vite build gate", "L", VITE),
        ("gate for host extras", "M", HOST_EXTRAS),
        ("kit versions and pins", "M", PIN),
        ("guide and template", "S", DESCRIBE),
        ("split of main.tsx", "M", AGENT),
        ("Electron main serves each slug", "M", SERVING),
        ("checks", "M", CHECKS),
        ("TLA+", "M", CHECKS),
    ]
    # (row, fraction of the beat where the narration names it)
    ORDER = {"large": ((1, 0.2), (4, 0.6)), "med1": ((0, 0.1), (2, 0.48), (5, 0.68)),
             "med2": ((6, 0.2), (8, 0.44), (9, 0.68)), "med3": ((10, 0.3), (11, 0.6)),
             "small": ((3, 0.12), (7, 0.55))}

    def construct(self):
        with self.beat("open") as b:
            title = scene_title("The work map: twelve fronts", KIT)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.35))

        def table(rows):
            cc = {}
            for i, (_, _, c) in enumerate(rows):
                cc[(i, 0)] = c
                cc[(i, 1)] = INFERRED
            return RevealTable(["front", "size"], [(n, s) for n, s, _ in rows], size=LABEL, row_gap=0.3,
                               col_gap=0.7, cell_colors=cc)

        t_l, t_r = table(self.ROWS[:6]), table(self.ROWS[6:])
        t_l.move_to([_X0 - 0.15, 2.4, 0], aligned_edge=UL)
        t_r.move_to([_X0 + 6.7, 2.4, 0], aligned_edge=UL)
        cells = {i: (t_l, i) if i < 6 else (t_r, i - 6) for i in range(12)}

        with self.beat("estimate") as b:
            tag = chip("sizes inferred", INFERRED, mono=False, size=LABEL)
            tag.next_to(title, RIGHT, buff=0.5)
            self.add(t_l, t_r)
            self.play(FadeIn(t_l.header), FadeIn(t_r.header), FadeIn(tag, shift=LEFT * 0.1), run_time=b.t(0.45))

        for name in ("large", "med1", "med2", "med3", "small"):
            with self.beat(name) as b:
                idx = self.ORDER[name]
                for i, frac in idx:
                    _at(self, b, frac)
                    tb, r = cells[i]
                    self.play(tb.reveal_row(r), run_time=b.t(0.15))

        with self.beat("tally") as b:
            tal = M(_b("2") + " large, " + _b("8") + " medium, " + _b("2") + " small "
                    + _col("(inferred)", INFERRED), BODY, TEXT)
            tal.move_to([_X0, -2.45, 0], aligned_edge=LEFT)
            self.play(FadeIn(tal, shift=UP * 0.1), run_time=b.t(0.3))


# ====================================================================== open_items
class OpenItems(DWScene):
    BEATS = [("open", 3.4), ("packaging", 5.4), ("pin", 4.1), ("extras", 4.3), ("native", 2.1), ("typegate", 4.5),
             ("config", 3.7), ("card", 5.0), ("mra", 4.0), ("standing", 6.6), ("none", 2.7)]

    ITEMS = [
        ("packaging", "packaging: S1 fresh install / S2 kit lockfile / S3 shared chunks"),
        ("pin", "pin or rebuild: adopt the " + _col("inferred", INFERRED) + " policy?"),
        ("extras", "host extras: bundle / external / none"),
        ("native", "native addons: out?"),
        ("typegate", "type gate: " + _mono("tsc") + " / " + _mono("oxlint") + " + " + _mono("tsgolint")),
        ("config", "kit config: place, tools, errors"),
        ("card", "package card: readme excerpt / curated usage"),
        ("mra", _mono("minimumReleaseAge") + " and security fixes"),
        ("standing", _mono("widget.runtime_pin") + " still says one shared shell"),
    ]

    def construct(self):
        y0, pitch = 2.25, 0.5
        items = []
        for i, (_, mk) in enumerate(self.ITEMS):
            dot = Circle(radius=0.07, stroke_color=OPEN, stroke_width=2.5).move_to([_X0 + 0.45, y0 - i * pitch, 0])
            t = M(mk if "<span" in mk else _esc(mk), LABEL, TEXT)
            t.next_to(dot, RIGHT, buff=0.3).set_y(dot.get_y())
            items.append(VGroup(dot, t))
        q = T("does the kit direction replace it?", LABEL, TEXT)
        q.next_to(items[-1], DOWN, buff=0.16).align_to(items[-1][1], LEFT)
        body = VGroup(*items, q)
        box = rbox(body.width + 0.95, body.height + 0.65, OPEN, fill=0.05, dashed=True)
        box.move_to(body).align_to(body, LEFT).shift(LEFT * 0.4)

        with self.beat("open") as b:
            title = scene_title("Open for the operator", OPEN)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.25))
            self.play(FadeIn(box), run_time=b.t(0.25))
            note = T("no ranking", SMALL, MUTED).next_to(box, UP, buff=0.1).align_to(box, RIGHT)
            self.play(FadeIn(note), run_time=b.t(0.15))

        for i, (name, _) in enumerate(self.ITEMS):
            with self.beat(name) as b:
                self.play(FadeIn(items[i], shift=RIGHT * 0.1), run_time=b.t(0.3))
                if name == "standing":
                    _at(self, b, 0.72)
                    self.play(FadeIn(q, shift=UP * 0.1), run_time=b.t(0.25))

        with self.beat("none") as b:
            cap = caption("this video recommends none of these choices")
            self.play(FadeIn(cap, shift=UP * 0.1), run_time=b.t(0.35))


# ====================================================================== closing
class Closing(DWScene):
    BEATS = [("back", 1.0), ("spec", 4.3), ("page", 4.5), ("measured", 5.6), ("twelve", 4.05), ("operator", 3.15)]

    def construct(self):
        o = OutlineDiagram()
        with self.beat("back") as b:
            o.set_highlight_now("today_row", "kit_row")
            self.play(FadeIn(o), run_time=b.left)

        with self.beat("spec") as b:
            _at(self, b, 0.1)
            fr = _frame(self.spec_tag, INFERRED, buff=0.08)
            self.play(Create(fr), run_time=b.t(0.25))
            _at(self, b, 0.8)
            self.play(FadeOut(fr), run_time=b.t(0.15))

        with self.beat("page") as b:
            pp = _frame(o.box("pinned_pages"), SHELL)
            lib = _frame(o.box("agent_library"), AGENT)
            _at(self, b, 0.3)
            self.play(Create(pp), run_time=b.t(0.15))
            _at(self, b, 0.62)
            self.play(Create(lib), run_time=b.t(0.15))
            _at(self, b, 0.86)
            self.play(FadeOut(pp), FadeOut(lib), run_time=b.t(0.12))

        with self.beat("measured") as b:
            seq = [("vite_build", VITE), ("kit_project", KIT), ("host_extras", HOST_EXTRAS), ("pin", PIN),
                   ("describe", DESCRIBE)]
            frames = []
            for k, (key, c) in enumerate(seq):
                _at(self, b, (0.18, 0.32, 0.48, 0.62, 0.8)[k])
                f = _frame(o.box(key), c)
                frames.append(f)
                self.play(Create(f), run_time=b.t(0.08))
            _at(self, b, 0.93)
            self.play(*[FadeOut(f) for f in frames], run_time=b.left)

        with self.beat("twelve") as b:
            bd = _badge(["12 fronts of work"], KIT, size=26).move_to([-0.89, 1.64, 0])
            self.play(FadeIn(bd, scale=1.15), run_time=b.t(0.3))

        with self.beat("operator") as b:
            od = _badge(["operator decides", "before any spec"], OPEN, size=LABEL).move_to([-0.89, 0.82, 0])
            od[1].set_color(TEXT)
            self.play(FadeIn(od, scale=1.15), run_time=b.t(0.3))
