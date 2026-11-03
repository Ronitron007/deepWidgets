"""DWScene: the base class of every scene in the widget kit explainer.

Shared base file. Part agents do not edit it.

    from dwscene import *          # manim, style, OutlineDiagram, DWScene

    class QueueRule(DWScene):      # class name = CamelCase of the scene name `queue_rule`
        BEATS = [("lane", 2), ("jobs", 3), ("mutant", 3), ("caption", 1)]

        def construct(self):
            with self.beat("lane") as b:
                self.play(Create(lane), run_time=b.t(0.5))   # half of this beat
            with self.beat("jobs") as b:
                ...
                self.play(..., run_time=b.left)              # all that is left of it

Each beat lasts exactly its share of the scene length. Leaving the `with` block waits out
the rest of the beat. The scene length comes from timing.scene_duration().
Each scene shows the amber spec tag (style.spec_tag) in the bottom-right corner, pinned to
the camera, from its first frame. Set SPEC_TAG = False to add and animate it yourself.
At each beat end the scene checks text size (>= MIN_FONT_SIZE on screen) and text that
leaves the frame. A report JSON goes to render/reports/<scene>.json for render_all.py.
"""
from __future__ import annotations

import json
import os
import sys
from contextlib import contextmanager
from pathlib import Path

from manim import *  # noqa: F401,F403

import timing
from outline import OutlineDiagram  # noqa: F401
from style import *  # noqa: F401,F403
from style import FRAME_W, MIN_FONT_SIZE


class Beat:
    def __init__(self, scene, plan):
        self.scene, self.name, self.start, self.length = scene, plan.name, plan.start, plan.length

    @property
    def end(self) -> float:
        return self.start + self.length

    def t(self, frac: float) -> float:
        """`frac` of this beat's length, in seconds (at least one frame)."""
        return max(1.0 / config.frame_rate, frac * self.length)

    @property
    def left(self) -> float:
        """Seconds left until this beat ends (at least one frame)."""
        return max(1.0 / config.frame_rate, self.end - self.scene.renderer.time)


class DWScene(MovingCameraScene):
    BEATS: list = []     # [(name, weight), ...] in play order
    SCENE: str | None = None  # script scene name; default: snake_case of the class name
    SPEC_TAG = True           # show the spec tag from the first frame (self.spec_tag)

    # -------------------------------------------------------------- setup and end
    def setup(self):
        super().setup()
        self.scene_name = self.SCENE or timing.camel_to_snake(type(self).__name__)
        self.output_name = timing.camel_to_snake(type(self).__name__)
        self.total, self.duration_source = timing.scene_duration(self.scene_name)
        self.plans = timing.plan(self.total, self.BEATS)
        self._next = 0
        self._beat_log = []
        self._warnings: dict[str, str] = {}
        self.spec_tag = self.pinned_tag(spec_tag())
        if self.SPEC_TAG:
            self.add_foreground_mobject(self.spec_tag)

    def pinned_tag(self, m):
        """Keep m at its place on the screen while the camera zooms or moves (an updater)."""
        frame = self.camera.frame
        home_w, off = frame.width, m.get_center() - frame.get_center()
        base_w = m.width

        def follow(mob):
            k = frame.width / home_w
            if abs(mob.width - base_w * k) > 1e-4:
                mob.scale(base_w * k / mob.width)
            mob.move_to(frame.get_center() + off * k)

        m.add_updater(follow)
        return m

    @contextmanager
    def beat(self, name):
        if self._next >= len(self.plans):
            raise RuntimeError(f"beat {name!r}: all {len(self.plans)} beats are used")
        p = self.plans[self._next]
        if p.name != name:
            raise RuntimeError(f"beat {name!r} out of order: next declared beat is {p.name!r}")
        self._next += 1
        b = Beat(self, p)
        late = self.renderer.time - b.start
        yield b
        over = self.renderer.time - b.end
        self._beat_log.append({"name": name, "start": round(b.start, 3), "length": round(b.length, 3),
                               "late_start": round(max(0.0, late), 3), "overrun": round(max(0.0, over), 3)})
        if over > 1.0 / config.frame_rate:
            self._warn(f"overrun:{name}", f"beat {name!r} ran {over:.2f} s past its end; later beats lose time")
        self.wait_until(b.end)
        self.lint()

    def wait_until(self, t: float):
        d = t - self.renderer.time
        if d >= 0.5 / config.frame_rate:
            Scene.wait(self, d)

    def tear_down(self):
        super().tear_down()
        if self._next != len(self.plans):
            missing = [p.name for p in self.plans[self._next:]]
            self._warn("beats", f"beats never played: {missing}")
            self.wait_until(self.total)
        self._write_report()

    # -------------------------------------------------------------- checks
    def _warn(self, key, msg):
        if key not in self._warnings:
            self._warnings[key] = msg
            print(f"[dw-warn] {self.output_name}: {msg}", file=sys.stderr)

    def lint(self):
        """Check text on screen: effective size >= MIN_FONT_SIZE, and inside the frame."""
        frame = self.camera.frame
        self.spec_tag.update()  # a camera jump on the last frame of a beat has not run its updater yet
        zoom = FRAME_W / frame.width
        fx0, fx1 = frame.get_left()[0], frame.get_right()[0]
        fy0, fy1 = frame.get_bottom()[1], frame.get_top()[1]
        pad = 0.02 / zoom
        for top in self.mobjects:
            for m in top.get_family():
                if isinstance(m, Code) and hasattr(m, "_dw_fs"):
                    fs = m._dw_fs * m.code_lines.height / m._dw_ref_h
                    label = "code block"
                    vis = max((ln.get_fill_opacity() for ln in m.code_lines), default=0)
                elif isinstance(m, (Text, MarkupText)) and m.height > 1e-3:
                    fs = m.font_size
                    label = repr(getattr(m, "text", "").rstrip("|")[:40])
                    vis = m.get_fill_opacity()
                else:
                    continue
                if vis < 0.05:
                    continue
                if fs * zoom < MIN_FONT_SIZE - 0.5:
                    self._warn(f"size:{label}", f"text {label} is font size {fs * zoom:.1f} on screen "
                                                f"(min {MIN_FONT_SIZE})")
                if (m.get_left()[0] < fx0 - pad or m.get_right()[0] > fx1 + pad
                        or m.get_bottom()[1] < fy0 - pad or m.get_top()[1] > fy1 + pad):
                    self._warn(f"off:{label}", f"text {label} goes outside the frame")

    def _write_report(self):
        out = Path(os.environ.get("DW_REPORT_DIR", str(timing.RENDER / "reports")))
        out.mkdir(parents=True, exist_ok=True)
        rendered = self.renderer.time
        rep = {
            "output": self.output_name, "scene": self.scene_name, "class": type(self).__name__,
            "target_s": round(self.total, 3), "rendered_s": round(rendered, 3),
            "duration_source": self.duration_source, "beats": self._beat_log,
            "warnings": list(self._warnings.values()),
            "length_ok": abs(rendered - self.total) <= timing.TOLERANCE,
        }
        (out / f"{self.output_name}.json").write_text(json.dumps(rep, indent=2))
