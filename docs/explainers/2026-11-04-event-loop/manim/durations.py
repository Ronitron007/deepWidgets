#!/usr/bin/env python3
"""Write scene lengths into durations.json, under an exclusive flock.

Shared base file. Part agents do not edit it.

Many part agents write durations.json at the same time. Each write takes the lock
durations.json.lock (fcntl.flock), reads the file again, merges, and replaces it
atomically. Never write durations.json in another way.

Usage (run with the manim venv python):
    durations.py set cold_open outline_today     # lengths from audio-final/<scene>.wav (ffprobe)
    durations.py set-value cold_open 56.2        # one length in seconds, from your own cut
    durations.py show                            # every entry
Exit code: 0 ok; 1 a wav is missing or a scene is not in script.md.
"""
from __future__ import annotations

import fcntl
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import timing  # noqa: E402

LOCK = timing.DURATIONS.with_name("durations.json.lock")


def wav_seconds(scene: str) -> float:
    p = timing.AUDIO / f"{scene}.wav"
    if not p.exists():
        raise SystemExit(f"missing {p}")
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                   "-of", "csv=p=0", str(p)])
    return round(float(out.decode().strip()), 3)


def merge(values: dict[str, float]) -> dict:
    known = set(timing.script_order())
    bad = [s for s in values if s not in known]
    if bad:
        raise SystemExit(f"not a scene of script.md: {bad}")
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    with LOCK.open("w") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        try:
            cur = json.loads(timing.DURATIONS.read_text()) if timing.DURATIONS.exists() else {}
            cur.update(values)
            tmp = timing.DURATIONS.with_name(f"durations.json.tmp-{os.getpid()}")
            tmp.write_text(json.dumps(cur, indent=1))
            os.replace(tmp, timing.DURATIONS)
        finally:
            fcntl.flock(lk, fcntl.LOCK_UN)
    return cur


def main():
    a = sys.argv[1:]
    if a[:1] == ["set"] and len(a) > 1:
        vals = {s: wav_seconds(s) for s in a[1:]}
    elif a[:1] == ["set-value"] and len(a) == 3:
        vals = {a[1]: round(float(a[2]), 3)}
    elif a == ["show"]:
        cur = json.loads(timing.DURATIONS.read_text()) if timing.DURATIONS.exists() else {}
        for k, v in cur.items():
            print(f"{k:24s} {v}")
        return
    else:
        raise SystemExit(__doc__)
    cur = merge(vals)
    for k, v in vals.items():
        print(f"{k:24s} {v:8.3f} s")
    print(f"durations.json: {len(cur)} scenes")


if __name__ == "__main__":
    main()
