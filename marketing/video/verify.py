#!/usr/bin/env python3
"""Contrôles automatiques d'un export : verify.py out/<id>/<id>.mp4 -> rapport + planche contact."""
import json, re, subprocess, sys
from pathlib import Path
from PIL import Image
p = Path(sys.argv[1]); d = p.parent
pr = lambda *a: subprocess.run(a, capture_output=True, text=True)
info = json.loads(pr("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(p)).stdout)
v = next(s for s in info["streams"] if s["codec_type"] == "video"); a = [s for s in info["streams"] if s["codec_type"] == "audio"]
dur = float(info["format"]["duration"])
vol = re.search(r"mean_volume: (-?[\d.]+) dB", pr("ffmpeg", "-i", str(p), "-af", "volumedetect", "-f", "null", "-").stderr)
ok = {"ouverture": True, "dimensions 1080x1920": (v["width"], v["height"]) == (1080, 1920), "durée 20-30 s": 20 <= dur <= 30,
      "piste audio": bool(a), "volume moyen > -30 dB": bool(vol) and float(vol[1]) > -30, "codec h264/aac": v["codec_name"] == "h264" and bool(a) and a[0]["codec_name"] == "aac"}
for k, r in ok.items(): print(("OK  " if r else "ÉCHEC"), k)
print(f"durée {dur:.1f} s, volume moyen {vol[1] if vol else '?'} dB")
tl = json.loads((d / "timeline.json").read_text())
ts = [round((l["start"] + l["end"]) / 2, 2) for l in tl["lines"]]
ims = []
for i, t in enumerate(ts):
    f = d / f"_f{i}.png"; pr("ffmpeg", "-y", "-loglevel", "error", "-ss", str(t), "-i", str(p), "-frames:v", "1", "-vf", "scale=270:480", str(f)); ims.append(Image.open(f))
cols = 4; rows = -(-len(ims) // cols); sh = Image.new("RGB", (270 * cols, 480 * rows), "white")
for i, im in enumerate(ims): sh.paste(im, ((i % cols) * 270, (i // cols) * 480))
sh.save(d / "planche.png")
for i in range(len(ims)): (d / f"_f{i}.png").unlink()
sys.exit(0 if all(ok.values()) else 1)
