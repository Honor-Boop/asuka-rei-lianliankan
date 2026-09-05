# -*- coding: utf-8 -*-
"""Generate assets/icon.ico for the desktop launcher (Rei|Asuka split, rounded)."""
import os
from PIL import Image, ImageDraw, ImageOps

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(BASE, "assets")
os.makedirs(ASSETS, exist_ok=True)

SIZE = 256
RAD = 36


def center_square(path, out_w, out_h):
    with Image.open(path) as im:
        im = im.convert("RGB")
        w, h = im.size
        side = min(w, h)
        x0 = (w - side) // 2
        y0 = max(0, int((h - side) * 0.10))  # 略偏上保留脸部
        im = im.crop((x0, y0, x0 + side, y0 + side))
        return im.resize((out_w, out_h), Image.LANCZOS)


def main():
    half = SIZE // 2
    left = center_square(os.path.join(BASE, "images", "rei_15.jpg"), half, SIZE)   # 绫波丽
    right = center_square(os.path.join(BASE, "images", "asuka_5.jpg"), half, SIZE)  # 明日香
    canvas = Image.new("RGB", (SIZE, SIZE))
    canvas.paste(left, (0, 0))
    canvas.paste(right, (half, 0))

    # 圆角蒙版
    mask = Image.new("L", (SIZE, SIZE), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=RAD, fill=255)
    canvas.putalpha(mask)

    out = os.path.join(ASSETS, "icon.ico")
    canvas.save(out, sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    # 顺手存一张 PNG 预览
    canvas.save(os.path.join(ASSETS, "icon.png"))
    print("icon:", out)


if __name__ == "__main__":
    main()
