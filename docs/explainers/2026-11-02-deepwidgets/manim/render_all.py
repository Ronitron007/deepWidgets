#!/usr/bin/env python3
"""Render scenes at -qm (720p, 30 fps) into the render folder, then check them.

Shared base file. Part agents do not edit it.

Usage (run with the manim venv python, from any directory):
    render_all.py part_runtime                 # every scene of a part module
    render_all.py queue_rule timeout_rule      # named scenes (snake_case or ClassName)
    render_all.py part_runtime --frames 0.3 0.7   # also extract frames at 30 % and 70 %
    render_all.py --all -j 4                   # every part module, 4 renders at a time

Outputs under /Users/rohanmalik/kyaloon-media/explainer-deepwidgets-2026-11-02/render/:
    scenes/<scene>.mp4        the rendered scene (an older file moves to scenes/old/ first)
    frames/<scene>_<pct>.png  extracted frames (with --frames)
    logs/<scene>.log          manim output
    reports/<scene>.json      beats, warnings, lengths
    media/<module>/           manim's own media folder, one per module (safe in parallel)

Exit code: 0 all good; 1 a render failed; 2 a length is off by more than 0.1 s;
3 the size/frame lint or a beat overrun gave warnings.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import timing  # noqa: E402

VENV_MANIM = Path("/Users/rohanmalik/.venvs/kyaloon-manim/bin/manim")
R = timing.RENDER
CLASS_RE = re.compile(r"^class (\w+)\(DWScene\):", re.M)


def scene_index() -> dict[str, tuple[str, str]]:
    """output name -> (module file name, class name), from every part_*.py."""
    idx = {}
    for f in sorted(HERE.glob("part_*.py")):
        for cls in CLASS_RE.findall(f.read_text()):
            out = timing.camel_to_snake(cls)
            if out in idx:
                raise SystemExit(f"class {cls} is in both {idx[out][0]} and {f.name}")
            idx[out] = (f.name, cls)
    return idx


def resolve(targets, all_parts) -> list[tuple[str, str, str]]:
    idx = scene_index()
    if all_parts:
        targets = sorted({m[:-3] for m, _ in idx.values()})
    out = []
    for t in targets:
        mod = t[:-3] if t.endswith(".py") else t
        if (HERE / f"{mod}.py").exists() and mod.startswith("part_"):
            out += [(o, m, c) for o, (m, c) in idx.items() if m == f"{mod}.py"]
            continue
        name = timing.camel_to_snake(t) if t[:1].isupper() else t
        if name not in idx:
            raise SystemExit(f"no DWScene class for {t!r} in part_*.py")
        out.append((name, *idx[name]))
    seen, uniq = set(), []
    for o in out:
        if o[0] not in seen:
            seen.add(o[0])
            uniq.append(o)
    return uniq


def probe_duration(p: Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", str(p)]).decode().strip())


def render_one(out_name, module, cls, frames) -> dict:
    for d in ("scenes", "frames", "logs", "reports", "media"):
        (R / d).mkdir(parents=True, exist_ok=True)
    media = R / "media" / module[:-3]
    log = R / "logs" / f"{out_name}.log"
    report = R / "reports" / f"{out_name}.json"
    if report.exists():
        report.unlink()
    # cached partial clips can survive a timing change and make a scene run long
    cmd = [str(VENV_MANIM), "render", "-qm", "--disable_caching", "--media_dir", str(media), str(HERE / module), cls]
    t0 = time.time()
    with log.open("w") as fh:
        rc = subprocess.run(cmd, cwd=str(HERE), stdout=fh, stderr=subprocess.STDOUT,
                            env={**__import__("os").environ, "DW_REPORT_DIR": str(R / "reports")}).returncode
    res = {"scene": out_name, "rc": rc, "secs": round(time.time() - t0, 1), "status": "ok", "notes": []}
    src = media / "videos" / module[:-3] / "720p30" / f"{cls}.mp4"
    if rc != 0 or not src.exists():
        res["status"] = "render-failed"
        res["notes"].append(f"see {log}")
        return res
    dst = R / "scenes" / f"{out_name}.mp4"
    if dst.exists():
        old = R / "scenes" / "old"
        old.mkdir(exist_ok=True)
        stamp = time.strftime("%Y%m%d-%H%M%S", time.localtime(dst.stat().st_mtime))
        dst.rename(old / f"{out_name}.{stamp}.mp4")
    shutil.copy2(src, dst)
    rep = json.loads(report.read_text()) if report.exists() else {}
    dur = probe_duration(dst)
    res["video_s"] = round(dur, 3)
    res["target_s"] = rep.get("target_s")
    res["source"] = rep.get("duration_source")
    if rep.get("target_s") is None or abs(dur - rep["target_s"]) > timing.TOLERANCE:
        res["status"] = "length-off"
        res["notes"].append(f"video {dur:.2f} s vs target {rep.get('target_s')} s")
    if rep.get("warnings"):
        if res["status"] == "ok":
            res["status"] = "warnings"
        res["notes"] += rep["warnings"]
    for f in frames:
        png = R / "frames" / f"{out_name}_{int(round(f * 100)):02d}.png"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{dur * f:.3f}", "-i", str(dst),
                        "-frames:v", "1", str(png)], check=False)
        res["notes"].append(f"frame {png}")
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("targets", nargs="*")
    ap.add_argument("--all", action="store_true", help="every part_*.py module")
    ap.add_argument("--frames", nargs="*", type=float, default=None,
                    help="fractions of the scene length to extract as PNG (default with flag: 0.3 0.7)")
    ap.add_argument("-j", type=int, default=1, help="renders at a time")
    a = ap.parse_args()
    if not a.targets and not a.all:
        ap.error("name scenes, part modules, or --all")
    frames = [] if a.frames is None else (a.frames or [0.3, 0.7])
    jobs = resolve(a.targets, a.all)
    with ThreadPoolExecutor(max_workers=max(1, a.j)) as ex:
        results = list(ex.map(lambda j: render_one(*j, frames), jobs))
    code = 0
    rank = {"ok": 0, "warnings": 3, "length-off": 2, "render-failed": 1}
    for r in results:
        print(f"{r['scene']:24s} {r['status']:13s} rc={r['rc']} video={r.get('video_s')} "
              f"target={r.get('target_s')} ({r.get('source')}) {r['secs']} s")
        for n in r["notes"]:
            print(f"    {n}")
        c = rank[r["status"]]
        if c and (code == 0 or c < code):
            code = c
    sys.exit(code)


if __name__ == "__main__":
    main()
