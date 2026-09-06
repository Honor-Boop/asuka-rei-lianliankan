# -*- coding: utf-8 -*-
"""Replace asuka_wall_02 with fresh candidates (md5-deduped against existing files)."""
import hashlib
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_misato import curl_download, valid_image, safebooru_search_tag  # noqa: E402
from fetch_wallpapers import WALL_DIR, THUMB_DIR  # noqa: E402

from PIL import Image  # noqa: E402

TAG = "souryuu_asuka_langley"
WANT = 4


def md5_of(p):
    h = hashlib.md5()
    with open(p, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def sheet(files):
    from PIL import ImageDraw, ImageFont
    cols, tw, pad, lh = 4, 300, 8, 20
    ch = round(tw * 9 / 16)
    rows = (len(files) + cols - 1) // cols
    img = Image.new("RGB", (cols * (tw + pad) + pad, rows * (ch + lh + pad) + pad), (18, 18, 26))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default(size=14)
    except Exception:
        font = None
    for i, f in enumerate(files):
        r, c = divmod(i, cols)
        x, y = pad + c * (tw + pad), pad + r * (ch + lh + pad)
        with Image.open(os.path.join(WALL_DIR, f)) as im:
            im = im.convert("RGB")
            im.thumbnail((tw, ch))
            img.paste(im, (x + (tw - im.width) // 2, y + (ch - im.height) // 2))
        d.text((x + 2, y + ch + 2), f, fill=(240, 240, 240), font=font)
    out = os.path.join(WALL_DIR, "_asuka_sheet.png")
    img.save(out)
    print("sheet:", out)


def main():
    # 删除被点名的图
    for f in ("asuka_wall_02.jpg", ):
        p = os.path.join(WALL_DIR, f)
        if os.path.exists(p):
            os.remove(p)
            print("removed:", f)
    tp = os.path.join(THUMB_DIR, "asuka_wall_02.jpg")
    if os.path.exists(tp):
        os.remove(tp)

    # 现有 asuka 图的 md5，用于跳过重复
    known = set()
    for f in os.listdir(WALL_DIR):
        if f.startswith("asuka_wall"):
            known.add(md5_of(os.path.join(WALL_DIR, f)))

    saved = []
    slot = 11  # 新图从 11 号开始编号，避免与浏览器缓存的旧 02 号混淆
    for c in safebooru_search_tag(TAG, 2560, 1440):
        if len(saved) >= WANT:
            break
        ext = os.path.splitext(urllib.parse.urlparse(c["url"]).path)[1].lower() or ".jpg"
        if ext not in (".jpg", ".jpeg", ".png"):
            continue
        path = os.path.join(WALL_DIR, "asuka_wall_%02d%s" % (slot, ext))
        n = curl_download(c["url"], path)
        if n is None or not valid_image(path):
            if os.path.exists(path):
                os.remove(path)
            continue
        if md5_of(path) in known:
            os.remove(path)
            print("  dup skip", flush=True)
            continue
        with Image.open(path) as im:
            w, h = im.size
        if w < 2560 or h < 1440:
            os.remove(path)
            continue
        known.add(md5_of(path))
        with Image.open(path) as im:
            im = im.convert("RGB")
            im.thumbnail((560, 10000), Image.LANCZOS)
            im.save(os.path.join(THUMB_DIR, os.path.basename(path)), "JPEG", quality=82)
        saved.append(os.path.basename(path))
        slot += 1
        print("  ok %dx%d %.1fMB score=%s %s" % (w, h, n / 1e6, c["score"], os.path.basename(path)), flush=True)

    if saved:
        sheet(saved)


if __name__ == "__main__":
    main()
