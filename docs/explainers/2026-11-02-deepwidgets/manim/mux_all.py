#!/usr/bin/env python3
"""Mux each scene video with its final audio, then join scenes in script order.

Shared base file. Part agents do not edit it.

    mux_all.py mux [scene ...]            # default: every script scene with a rendered video
    mux_all.py mux --silent-ok [scene ...] # a scene with no audio-final/<scene>.wav gets silence
    mux_all.py join OUT.mp4               # every script scene, in script order; all must be muxed
    mux_all.py join OUT.mp4 --part part_runtime   # only the scenes of one part (preview)

Mux rules: the audio is padded with silence to the video length. Speech is never cut: when
the audio is longer than the video, the last video frame is held until the audio ends (and a
warning is printed). Output: render/muxed/<scene>.mp4 (AAC 192k, 48 kHz).
join never overwrites: it stops if OUT exists.
Exit code: 0 ok; 1 an ffmpeg step failed; 2 a scene is missing; 3 OUT exists.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import timing  # noqa: E402

R = timing.RENDER


def dur(p: Path) -> float:
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", str(p)]).decode().strip())


def mux_one(scene: str, silent_ok: bool) -> int:
    v = R / "scenes" / f"{scene}.mp4"
    a = timing.AUDIO / f"{scene}.wav"
    out = R / "muxed" / f"{scene}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    if not v.exists():
        print(f"{scene}: no video {v}")
        return 2
    vd = dur(v)
    if a.exists():
        ad = dur(a)
        audio_in = ["-i", str(a)]
    elif silent_ok:
        ad = 0.0
        audio_in = ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        print(f"{scene}: no audio, muxing silence")
    else:
        print(f"{scene}: no audio {a} (use --silent-ok for a preview)")
        return 2
    length = max(vd, ad)
    if ad > vd + 0.01:
        hold = ad - vd
        print(f"{scene}: WARNING audio {ad:.2f} s > video {vd:.2f} s; holding the last frame {hold:.2f} s")
        vf = ["-vf", f"tpad=stop_mode=clone:stop_duration={hold:.3f}", "-c:v", "libx264", "-crf", "18",
              "-preset", "medium", "-pix_fmt", "yuv420p"]
    else:
        vf = ["-c:v", "copy"]
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(v), *audio_in,
           "-filter_complex", f"[1:a]aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur={length:.3f}[a]",
           "-map", "0:v", "-map", "[a]", *vf, "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
           "-t", f"{length:.3f}", str(out)]
    rc = subprocess.run(cmd).returncode
    print(f"{scene}: mux rc={rc} video={vd:.2f} audio={ad:.2f} out={length:.2f}")
    return 0 if rc == 0 else 1


def join(out: Path, scenes: list[str]) -> int:
    if out.exists():
        print(f"{out} exists; never overwritten. Pick a new name (for example a -v2 suffix).")
        return 3
    files = [R / "muxed" / f"{s}.mp4" for s in scenes]
    missing = [s for s, f in zip(scenes, files) if not f.exists()]
    if missing:
        print(f"not muxed: {missing}")
        return 2
    args, fc = [], ""
    for i, f in enumerate(files):
        args += ["-i", str(f)]
        fc += f"[{i}:v][{i}:a]"
    fc += f"concat=n={len(files)}:v=1:a=1[v][a]"
    out.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["ffmpeg", "-n", "-v", "error", *args, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
           "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", "30",
           "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(out)]
    rc = subprocess.run(cmd).returncode
    if rc == 0:
        expect = sum(dur(f) for f in files)
        print(f"joined {len(files)} scenes -> {out} ({dur(out):.2f} s; sum of scenes {expect:.2f} s)")
    return 0 if rc == 0 else 1


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("mux")
    m.add_argument("scenes", nargs="*")
    m.add_argument("--silent-ok", action="store_true")
    j = sub.add_parser("join")
    j.add_argument("out")
    j.add_argument("--part", action="append", default=[])
    a = ap.parse_args()
    order = timing.script_order()
    if a.cmd == "mux":
        scenes = a.scenes or [s for s in order if (R / "scenes" / f"{s}.mp4").exists()]
        rcs = [mux_one(s, a.silent_ok) for s in scenes]
        sys.exit(max(rcs, default=0))
    parts = timing.parts()
    if a.part:
        want = {s for p in a.part for s in parts[p]}
        scenes = [s for s in order if s in want]
    else:
        scenes = order
    sys.exit(join(Path(a.out).expanduser().resolve(), scenes))


if __name__ == "__main__":
    main()
