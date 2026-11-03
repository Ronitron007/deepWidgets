"""Demo of the shared base: outline open (highlight, zoom), a row-by-row table, outline close.
Not a script scene. It borrows the length and the visuals of `kit_routes` (part_settings)."""
from dwscene import *


class DemoOutlineTable(DWScene):
    SCENE = "kit_routes"
    BEATS = [("open", 2), ("title", 1), ("table", 6), ("today", 3), ("close", 2)]

    ROWS = [
        ("GET /api/kit", "same body as kit_read"),
        ("PUT /api/kit/settings", "{ agentsMayAddPackages }"),
        ("POST /api/kit/extras", "{ name, version?, side }"),
        ("DELETE /api/kit/extras/<name>", "removes one extra"),
        ("GET /api/kit/stream", "SSE: a signal on each kit change"),
    ]

    def construct(self):
        outline = OutlineDiagram()
        with self.beat("open") as b:
            self.add(outline)
            self.wait(b.t(0.25))
            outline.open_part(self, "settings_pane", run_time=b.left)

        with self.beat("title") as b:
            title = scene_title("The user door: /api/kit", SETTINGS)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("table") as b:
            tbl = RevealTable(["route", "what it does"], self.ROWS, mono_cols=[0],
                              cell_colors={(i, 0): SETTINGS for i in range(len(self.ROWS))})
            tbl.next_to(title, DOWN, buff=0.4).to_edge(LEFT, buff=0.8)
            self.add(tbl)
            self.play(tbl.reveal_rows(0, len(self.ROWS)), run_time=b.t(0.75))
            self.play(Create(tbl.mark_row(2)), run_time=b.left)

        with self.beat("today") as b:
            note = chip("POST ignores kit-locked", SETTINGS, mono=False)
            size = chip("routes: S (estimate)", INFERRED, mono=False)
            VGroup(note, size).arrange(RIGHT, buff=0.4).next_to(tbl, DOWN, buff=0.45).align_to(tbl, LEFT)
            self.play(FadeIn(note), run_time=b.t(0.3))
            self.play(FadeIn(size), run_time=b.t(0.3))

        with self.beat("close") as b:
            outline.close_part(self, "settings_pane", next_key="electron_main", run_time=b.left)
