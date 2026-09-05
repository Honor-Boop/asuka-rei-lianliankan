# -*- coding: utf-8 -*-
"""Crop selected candidates into 160x160 square tiles (top-biased for faces)."""
import os
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "candidates", "raw")
OUT = os.path.join(BASE, "images")
os.makedirs(OUT, exist_ok=True)

# thumb name -> (candidate file, vertical crop bias 0..1; 0=top, 1=bottom)
PICKS = {
    "rei_1":   ("rei_cand_02.jpg", 0.15),
    "rei_2":   ("rei_cand_04.jpg", 0.10),
    "rei_3":   ("rei_cand_08.jpg", 0.12),
    "rei_4":   ("rei_cand_09.jpg", 0.25),
    "rei_5":   ("rei_cand_10.jpg", 0.15),
    "rei_6":   ("rei_cand_14.jpg", 0.10),
    "asuka_1": ("asuka_cand_03.jpg", 0.10),
    "asuka_2": ("asuka_cand_04.png", 0.12),
    "asuka_3": ("asuka_cand_05.jpg", 0.15),
    "asuka_4": ("asuka_cand_12.jpg", 0.10),
    "asuka_5": ("asuka_cand_13.jpg", 0.08),
    "asuka_6": ("asuka_cand_14.jpg", 0.12),
}

SIZE = 160


def make_thumb(src, bias, dst):
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        side = min(w, h)
        x0 = (w - side) // 2
        y0 = int((h - side) * bias)
        y0 = max(0, min(y0, h - side))
        im = im.crop((x0, y0, x0 + side, y0 + side))
        im = im.resize((SIZE, SIZE), Image.LANCZOS)
        im.save(dst, "JPEG", quality=88)
        print(dst, "from", os.path.basename(src), "bias", bias)


def preview_sheet():
    from PIL import ImageDraw, ImageFont
    names = sorted(PICKS.keys())
    cols, cell, pad, label_h = 6, SIZE, 6, 20
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (cell + pad) + pad,
                              rows * (cell + label_h + pad) + pad), (20, 20, 28))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=14)
    except Exception:
        font = None
    for i, n in enumerate(names):
        r, c = divmod(i, cols)
        x, y = pad + c * (cell + pad), pad + r * (cell + label_h + pad)
        with Image.open(os.path.join(OUT, n + ".jpg")) as im:
            sheet.paste(im, (x, y))
        draw.text((x, y + cell + 2), n, fill=(235, 235, 235), font=font)
    out = os.path.join(BASE, "candidates", "thumbs_sheet.png")
    sheet.save(out)
    print("preview:", out)


if __name__ == "__main__":
    for name, (src, bias) in PICKS.items():
        make_thumb(os.path.join(RAW, src), bias, os.path.join(OUT, name + ".jpg"))
    preview_sheet()
