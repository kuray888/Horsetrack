#!/usr/bin/env python3
"""Moteur de montage HorseTrack : JSON -> MP4 1080x1920 (Piper + Pillow + FFmpeg).

Usage : .venv/bin/python build.py videos/HT-xxx.json [--no-render]
Sorties dans out/<id>/ : <id>.mp4, <id>.srt, voice.wav, timeline.json.
Chaque ligne de voix off = un sous-titre synthétisé seul : synchro exacte.
"""
import hashlib, json, re, subprocess, sys, wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SCREENS = ROOT.parents[1] / "apps/web/src/assets/screens"
W, H, FPS = 1080, 1920, 30
CARD = (90, 400, 900, 960)  # x, y, largeur, hauteur de la fenêtre d'écran
CAP_BOX = (70, 1385, 940, 150)  # sous-titres (au-dessus de la zone d'interface)
TITLE_BOX = (70, 130, 940, 240)
FOOT_Y = 1545
BG = (22, 40, 68)
ACCENT = (240, 190, 90)
WHITE = (255, 255, 255)
INK = (14, 26, 46)
CROP = (84, 96, 972, 2008)  # zone d'écran dans les maquettes du site
FONT_B = str(ROOT / "fonts/BricolageGrotesque_800ExtraBold.ttf")
FONT_M = str(ROOT / "fonts/BricolageGrotesque_700Bold.ttf")
_fonts = {}


def font(path, size):
    return _fonts.setdefault((path, size), ImageFont.truetype(path, size))


def ease(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


# ---------- voix ----------
def tts(text, voice, cache):
    plain = text.replace("*", "")
    key = hashlib.sha1(json.dumps([plain, voice], sort_keys=True).encode()).hexdigest()[:16]
    wav = cache / f"{key}.wav"
    if not wav.exists():
        py = ROOT / ".venv/bin/python"
        cmd = [str(py), "-m", "piper", "-m", str(ROOT / "models" / (voice["model"] + ".onnx")),
               "-f", str(wav), "--length-scale", str(voice.get("length_scale", 1.0))]
        subprocess.run(cmd, input=plain.encode(), check=True, capture_output=True)
    with wave.open(str(wav)) as w:
        sr = w.getframerate()
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return sr, pcm


def build_timeline(cfg, cache):
    v, sr = cfg["voice"], None
    t, tl, chunks = 0.0, [], []
    for sc in cfg["scenes"]:
        s0 = t
        t += sc.get("lead", 0.2)
        for line in sc["lines"]:
            sr, pcm = tts(line, v, cache)
            d = len(pcm) / sr
            chunks.append((t, pcm))
            tl.append({"text": line, "start": round(t, 3), "end": round(t + d, 3), "scene": cfg["scenes"].index(sc)})
            t += d + v.get("gap", 0.2)
        t += sc.get("tail", 0.15)
        sc["_t0"], sc["_t1"] = s0, t
    total = t
    audio = np.zeros(int(total * sr) + sr, dtype=np.float32)
    for start, pcm in chunks:
        i = int(start * sr)
        audio[i:i + len(pcm)] += pcm.astype(np.float32) / 32768
    return tl, audio, sr, total


def write_wav(path, audio, sr):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())


def srt_time(x):
    ms = int(round(x * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


# ---------- texte ----------
def parse_runs(text):
    """'a *b* c' -> mots, chaque mot = liste de (texte, accentué)."""
    chars, emph, on = [], [], False
    for ch in text:
        if ch == "*":
            on = not on
        else:
            chars.append(ch); emph.append(on)
    words, cur = [], []
    for ch, e in zip(chars, emph):
        if ch == " ":
            if cur: words.append(cur); cur = []
        elif cur and cur[-1][1] == e:
            cur[-1] = (cur[-1][0] + ch, e)
        else:
            cur.append((ch, e))
    if cur: words.append(cur)
    return words


def wrap(words, f, maxw):
    lines, cur, w = [], [], 0
    sp = f.getlength(" ")
    for wd in words:
        ww = sum(f.getlength(t) for t, _ in wd)
        if cur and w + sp + ww > maxw:
            lines.append((cur, w)); cur, w = [], 0
        w += (sp if cur else 0) + ww
        cur.append(wd)
    if cur: lines.append((cur, w))
    return lines


def text_layer(text, box, fpath, smax, smin, maxlines, color=WHITE, stroke=0, align="center", label=""):
    """Rend le texte dans box (x,y,w,h) ; réduit la taille jusqu'à tenir. Échoue si ça déborde."""
    x, y, bw, bh = box
    words = parse_runs(text)
    for size in range(smax, smin - 1, -2):
        f = font(fpath, size)
        lines = wrap(words, f, bw - 2 * stroke)
        lh = int(size * 1.12)
        if len(lines) <= maxlines and len(lines) * lh <= bh and all(w <= bw - 2 * stroke for _, w in lines):
            break
    else:
        raise SystemExit(f"TEXTE TROP LONG ({label}) : {text!r}")
    img = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    sp = f.getlength(" ")
    yy = (bh - len(lines) * lh) // 2 if align == "center" else 0
    for ln, w in lines:
        xx = (bw - w) / 2
        for k, wd in enumerate(ln):
            for t, e in wd:
                d.text((xx, yy), t, font=f, fill=ACCENT if e else color, stroke_width=stroke, stroke_fill=INK)
                xx += f.getlength(t)
            xx += sp
        yy += lh
    return img, (x, y)


def rounded_mask(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), r, fill=255)
    return m


# ---------- rendu ----------
def render(cfg, tl, total, out_mp4, audio_wav):
    cw, ch = CARD[2], CARD[3]
    mask = rounded_mask((cw, ch), 44)
    shots = {}
    for sc in cfg["scenes"]:
        n = sc.get("screen")
        if n and n not in shots:
            shots[n] = Image.open(SCREENS / f"{n}.webp").convert("RGB").crop(CROP)
    icon = Image.open(ROOT / "icon-512.png").convert("RGB").resize((300, 300))
    icon_mask = rounded_mask((300, 300), 68)
    layers = []
    for i, sc in enumerate(cfg["scenes"]):
        lay = {"title": text_layer(sc["title"], TITLE_BOX, FONT_B, 76, 52, 3, label=f"titre {i}")}
        if sc.get("footnote"):
            lay["foot"] = text_layer(sc["footnote"], (70, FOOT_Y, 940, 60), FONT_M, 28, 22, 2, color=(205, 214, 228), label=f"note {i}")
        layers.append(lay)
    caps = [text_layer(c["text"], CAP_BOX, FONT_B, 64, 44, 3, stroke=7, label=f"sous-titre {j}") for j, c in enumerate(tl)]
    bgimg = Image.new("RGB", (W, H), BG)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", str(audio_wav), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,apad", "-t", f"{total:.3f}",
           "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
           "-metadata", f"title={cfg['id']}", "-metadata", f"comment={cfg['angle']}", "-movflags", "+faststart", str(out_mp4)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    nf = int(round(total * FPS))
    for f in range(nf):
        t = f / FPS
        si = next(i for i, s in enumerate(cfg["scenes"]) if t < s["_t1"] or i == len(cfg["scenes"]) - 1)
        sc = cfg["scenes"][si]
        u = (t - sc["_t0"]) / (sc["_t1"] - sc["_t0"])
        fr = bgimg.copy()
        k = min((t - sc["_t0"]) / 0.25, 1.0)  # apparition du titre
        if sc.get("cta"):
            fr.paste(icon, ((W - 300) // 2, 520), icon_mask)
            d = ImageDraw.Draw(fr)
            for txt, yy, fp, sz, col in ((sc["cta"]["name"], 880, FONT_B, 110, WHITE), (sc["cta"]["sub"], 1020, FONT_M, 44, (205, 214, 228)), (sc["cta"]["action"], 1160, FONT_B, 60, ACCENT)):
                fnt = font(fp, sz); d.text((W / 2, yy), txt, font=fnt, fill=col, anchor="mm")
        else:
            a, b = sc["from"], sc.get("to", sc["from"])
            e = ease(u)
            x, y, w = (a[i] + (b[i] - a[i]) * e for i in range(3))
            h = w * ch / cw
            src = shots[sc["screen"]]
            x = min(max(x, 0), src.width - w); y = min(max(y, 0), src.height - h)
            view = src.resize((cw, ch), Image.BICUBIC, box=(x, y, x + w, y + h))
            if sc.get("highlight") and u > 0.2:
                hx, hy, hw, hh = sc["highlight"]; s = cw / w
                ImageDraw.Draw(view).rounded_rectangle(((hx - x) * s, (hy - y) * s, (hx - x + hw) * s, (hy - y + hh) * s), 22, outline=ACCENT, width=8)
            fr.paste(view, CARD[:2], mask)
        for key in ("title", "foot"):
            if key in layers[si]:
                img, pos = layers[si][key]
                if k < 1.0:
                    img = img.copy(); img.putalpha(img.getchannel("A").point(lambda v: int(v * k)))
                fr.paste(img, pos, img)
        for j, c in enumerate(tl):
            nxt = tl[j + 1]["start"] if j + 1 < len(tl) else total
            if c["start"] - 0.02 <= t < min(c["end"] + 0.25, nxt):
                img, pos = caps[j]; fr.paste(img, pos, img); break
        p.stdin.write(fr.tobytes())
    p.stdin.close(); p.wait()
    if p.returncode: raise SystemExit("ffmpeg a échoué")


def main():
    cfg_path = Path(sys.argv[1]); cfg = json.loads(cfg_path.read_text())
    out = ROOT / "out" / cfg["id"]; out.mkdir(parents=True, exist_ok=True)
    cache = ROOT / "cache"; cache.mkdir(exist_ok=True)
    tl, audio, sr, total = build_timeline(cfg, cache)
    write_wav(out / "voice.wav", audio, sr)
    (out / f"{cfg['id']}.srt").write_text("\n".join(f"{i + 1}\n{srt_time(c['start'])} --> {srt_time(c['end'] + 0.2)}\n{c['text'].replace('*', '')}\n" for i, c in enumerate(tl)))
    (out / "timeline.json").write_text(json.dumps({"total": round(total, 2), "lines": tl, "scenes": [[round(s["_t0"], 2), round(s["_t1"], 2)] for s in cfg["scenes"]]}, ensure_ascii=False, indent=1))
    print(f"{cfg['id']} : {total:.1f} s, {len(tl)} sous-titres" + ("" if 20 <= total <= 30 else "  /!\\ hors 20-30 s"))
    if "--no-render" in sys.argv: return
    mp4 = out / f"{cfg['id']}.mp4"
    render(cfg, tl, total, mp4, out / "voice.wav")
    pres = cfg.get("presenter")
    if pres and (ROOT / pres["clip"]).exists():  # clip de présentateur virtuel fourni : incrustation (son du clip ignoré)
        tmp = out / "tmp.mp4"; mp4.rename(tmp)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-i", str(ROOT / pres["clip"]), "-filter_complex",
                        "[1:v]scale=340:340:force_original_aspect_ratio=increase,crop=340:340[p];[0:v][p]overlay=40:1560[v]", "-map", "[v]", "-map", "0:a",
                        "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "copy", "-shortest", str(mp4)], check=True)
        tmp.unlink()
    print("->", mp4)


if __name__ == "__main__":
    main()
