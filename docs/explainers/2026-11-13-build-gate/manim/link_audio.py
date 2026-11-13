#!/usr/bin/env python3
"""Link each take of `takes/` to `audio-final/<scene>.wav`, the name that mux_all.py reads.

A take file name ends with its scene name, with underscores written as hyphens:
the scene `cold_open` is `...-bgvid-01-cold-open.wav`.

    link_audio.py            # make the links and check that every scene has one
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import timing  # noqa: E402

TAKES = timing.MEDIA / "takes"


def main() -> None:
    timing.AUDIO.mkdir(parents=True, exist_ok=True)
    wavs = sorted(TAKES.glob("*.wav"))
    missing = []
    for scene in timing.script_order():
        tail = f"-{scene.replace('_', '-')}.wav"
        hits = [w for w in wavs if w.name.endswith(tail)]
        if len(hits) != 1:
            missing.append((scene, len(hits)))
            continue
        link = timing.AUDIO / f"{scene}.wav"
        if link.is_symlink() or link.exists():
            link.unlink()
        link.symlink_to(hits[0])
    for scene, n in missing:
        print(f"{scene}: {n} takes match")
    print(f"{len(timing.script_order()) - len(missing)} links in {timing.AUDIO}")
    sys.exit(1 if missing else 0)


if __name__ == "__main__":
    main()
