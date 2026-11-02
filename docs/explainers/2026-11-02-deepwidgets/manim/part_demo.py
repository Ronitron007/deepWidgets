"""Demo of the shared base: outline open (highlight, zoom), a row-by-row table, a JSON reveal,
outline close. Not a script scene. It borrows the length of `args_and_errors`."""
from dwscene import *


class DemoOutlineTable(DWScene):
    SCENE = "args_and_errors"
    BEATS = [("open", 2), ("title", 1), ("table", 5), ("json", 2.5), ("close", 2)]

    ROWS = [
        ("unknown-widget", "404"), ("unknown-action", "404"), ("invalid-args", "422"),
        ("handler-error", "500"), ("timeout", "504"), ("busy", "503"),
        ("idempotency-conflict", "409"), ("conflict", "409"), ("bad-request", "400"),
        ("safe-mode", "503"), ("widget-failed", "503"),
    ]

    def construct(self):
        outline = OutlineDiagram()
        with self.beat("open") as b:
            self.add(outline)
            self.wait(b.t(0.25))
            outline.open_part(self, "ctx_widgets", run_time=b.left)

        with self.beat("title") as b:
            title = scene_title("Errors of a call", RUNTIME)
            self.play(FadeIn(title, shift=RIGHT * 0.2), run_time=b.t(0.6))

        with self.beat("table") as b:
            tbl = RevealTable(["code", "HTTP status"], self.ROWS, mono_cols=[0, 1],
                              cell_colors={(i, 1): ISOLATION for i in range(len(self.ROWS))})
            tbl.next_to(title, DOWN, buff=0.35).to_edge(LEFT, buff=1.0)
            self.add(tbl)
            self.play(tbl.reveal_rows(0, len(self.ROWS)), run_time=b.t(0.75))
            self.play(Create(tbl.mark_row(4)), run_time=b.left)

        with self.beat("json") as b:
            js = json_block({"ok": False, "code": "timeout", "status": 504, "retry": "same requestId"})
            js.next_to(tbl, RIGHT, buff=0.8).align_to(tbl, UP)
            hide_lines(js)
            self.add(js)
            self.play(reveal_lines(js, 0, len(js.code_lines)), run_time=b.t(0.7))

        with self.beat("close") as b:
            outline.close_part(self, "ctx_widgets", next_key="shell_page", run_time=b.left)
