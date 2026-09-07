# -*- coding: utf-8 -*-
"""Fetch EXTRA 'sexy' Misato portraits (bikini / lingerie / low-cut vibes, safe-rated,
portrait orientation) for the side-rail decoration. Candidates land in candidates/misato_sexy."""
import hashlib
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_misato import curl_download, valid_image, safebooru_search_tag  # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "candidates", "misato_sexy")
os.makedirs(OUT, exist_ok=True)

# 查询组合（safe 站内最性感的几类）
QUERIES = [
    "katsuragi_misato solo sexy",
    "katsuragi_misato solo bikini",
    "katsuragi_misato lingerie",
    "katsuragi_misato solo cleavage",
]
MIN_W, MIN_H = 1000, 1300   # 竖构图优先
WANT = 14


def main():
    seen = set()
    for f in os.listdir(OUT):
        seen.add(f)
    cands = []
    for q in QUERIES:
        for c in safebooru_search_tag(q, 1000, 1000, pages=3):
            # 该函数按 横版优先排序；我们只要竖图，取高度≥宽度的
            if c["h"] < c["w"]:
                continue
            key = c["url"]
            if key in seen:
                continue
            seen.add(key)
            cands.append(c)
        if len(cands) >= WANT * 2:
            break
    # 竖比例优先 + 评分
    cands.sort(key=lambda x: ((1 if x["h"] >= x["w"] * 1.25 else 0), x["score"]), reverse=True)
    print("total portrait candidates:", len(cands), flush=True)

    saved = 0
    for c in cands:
        if saved >= WANT:
            break
        ext = os.path.splitext(urllib.parse.urlparse(c["url"]).path)[1].lower() or ".jpg"
        if ext not in (".jpg", ".jpeg", ".png"):
            continue
        path = os.path.join(OUT, "sexy_%02d%s" % (saved + 1, ext))
        n = curl_download(c["url"], path, max_time=60)
        if n is None or not valid_image(path):
            if os.path.exists(path):
                os.remove(path)
            continue
        from PIL import Image
        with Image.open(path) as im:
            w, h = im.size
        if h < w or w < 900:
            os.remove(path)
            continue
        saved += 1
        print("  ok %dx%d %.1fMB score=%s %s"
              % (w, h, n / 1e6, c["score"], os.path.basename(path)), flush=True)
    if saved:
        sheet()


def sheet():
    from PIL import Image, ImageDraw, ImageFont
    files = sorted(os.listdir(OUT))
    files = [f for f in files if not f.startswith("_")]
    cols, pad, lh = 3, 10, 22
    tw = 220
    cell_h = round(tw * 4 / 3)
    rows = (len(files) + cols - 1) // cols
    img = Image.new("RGB", (cols * (tw + pad) + pad, rows * (cell_h + lh + pad) + pad), (20, 20, 30))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default(size=14)
    except Exception:
        font = None
    for i, f in enumerate(files):
        r, c = divmod(i, cols)
        x, y = pad + c * (tw + pad), pad + r * (cell_h + lh + pad)
        try:
            with Image.open(os.path.join(OUT, f)) as im:
                im = im.convert("RGB")
                im.thumbnail((tw, cell_h))
                img.paste(im, (x + (tw - im.width) // 2, y + (cell_h - im.height) // 2))
        except Exception:
            pass
        d.text((x + 2, y + cell_h + 3), f, fill=(255, 255, 255), font=font)
    img.save(os.path.join(OUT, "_sheet.png"))
    print("sheet:", os.path.join(OUT, "_sheet.png"))


if __name__ == "__main__":
    main()
