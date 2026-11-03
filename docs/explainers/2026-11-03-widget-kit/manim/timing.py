"""Scene lengths and beat plans for the deepWidgets explainer.

Shared base file. Part agents do not edit it.

A scene's length comes from durations.json (scene name -> seconds of final audio).
When a scene has no entry yet, the fallback length is its narration word count at
140 words per minute. A scene declares beats with relative weights; plan() scales
them so that they fill the scene length exactly.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXPLAINER = HERE.parent
NARRATION = EXPLAINER / "narration.md"
SCRIPT = EXPLAINER / "script.md"
MEDIA = Path("/Users/rohanmalik/kyaloon-media/explainer-widget-kit-2026-11-03")
DURATIONS = MEDIA / "durations.json"
PARTS = MEDIA / "parts.json"
RENDER = MEDIA / "render"
AUDIO = MEDIA / "audio-final"

WPM = 140
TOLERANCE = 0.1  # s: a rendered scene must match its target length this closely
FPS = 30


def camel_to_snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def snake_to_camel(name: str) -> str:
    return "".join(p.capitalize() for p in name.split("_"))


def script_order() -> list[str]:
    """Scene names in script order (the `## `name`` headings of script.md)."""
    return re.findall(r"^## `(\w+)`", SCRIPT.read_text(), re.M)


def parts() -> dict[str, list[str]]:
    return {k: v.split() for k, v in json.loads(PARTS.read_text()).items()}


def narration_words() -> dict[str, int]:
    text = NARRATION.read_text()
    out = {}
    for m in re.finditer(r"^## (\w+)\n(.*?)(?=^## |\Z)", text, re.S | re.M):
        out[m.group(1)] = len(m.group(2).split())
    return out


def scene_duration(scene: str) -> tuple[float, str]:
    """(seconds, source). source is 'audio' or 'fallback'."""
    if DURATIONS.exists():
        d = json.loads(DURATIONS.read_text())
        if scene in d:
            v = d[scene]
            return float(v["seconds"] if isinstance(v, dict) else v), "audio"
    words = narration_words()
    if scene not in words:
        raise KeyError(f"scene {scene!r} is not in narration.md and has no duration")
    return round(words[scene] * 60.0 / WPM, 3), "fallback"


@dataclass
class BeatPlan:
    name: str
    start: float
    length: float

    @property
    def end(self) -> float:
        return self.start + self.length


def plan(total: float, beats) -> list[BeatPlan]:
    """Scale relative beat weights so that the beats fill `total` seconds.

    `beats` is a list of (name, weight) pairs or a dict in declaration order.
    """
    items = list(beats.items()) if isinstance(beats, dict) else list(beats)
    if not items:
        raise ValueError("a scene needs at least one beat")
    names = [n for n, _ in items]
    if len(set(names)) != len(names):
        raise ValueError(f"beat names repeat: {names}")
    weights = [float(w) for _, w in items]
    if any(w <= 0 for w in weights):
        raise ValueError("beat weights must be positive")
    k = total / sum(weights)
    out, t = [], 0.0
    for name, w in zip(names, weights):
        out.append(BeatPlan(name, t, w * k))
        t += w * k
    out[-1].length = total - out[-1].start  # no float drift at the end
    return out


if __name__ == "__main__":
    # Print every scene's target length and its source.
    order = script_order()
    tot = 0.0
    for s in order:
        sec, src = scene_duration(s)
        tot += sec
        print(f"{s:24s} {sec:7.2f} s  {src}")
    print(f"{len(order)} scenes, {tot / 60:.1f} min")
