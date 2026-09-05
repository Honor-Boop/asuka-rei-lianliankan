# -*- coding: utf-8 -*-
"""Extend the raw candidate pool for tile faces: download more safebooru posts
(md5-deduped against existing raw files) and sheet only the new ones."""
import hashlib
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_wallpapers import fetch  # noqa: E402  (same UA/fetch helper)

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "candidates", "raw")
os.makedirs(RAW, exist_ok=True)

TARGET_PER_CHAR = 30
CHARS = {"rei": "ayanami_rei", "asuka": "souryuu_asuka_langley"}
MAX_BYTES = 8 * 1024 * 1024


def md5_of(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()


def safebooru_posts(tag, pages=4, min_score=10):
    import xml.etree.ElementTree as ET
    out = []
    for pid in range(pages):
        url = ("https://safebooru.org/index.php?page=dapi&s=post&q=index"
               "&pid=%d&tags=%s" % (pid, urllib.parse.quote("%s solo score:>=%d" % (tag, min_score))))
        try:
            xml = fetch(url)
            root = ET.fromstring(xml)
        except Exception as e:
            print("[safebooru] pid %d fail: %s" % (pid, e))
            break
        for p in root.findall("post"):
            fu = p.get("file_url") or ""
            if fu.startswith("//"):
                fu = "https:" + fu
            ext = os.path.splitext(urllib.parse.urlparse(fu).path)[1].lower()
            if ext not in (".jpg", ".jpeg", ".png"):
                continue
            out.append({"url": fu, "w": int(p.get("width") or 0),
                        "h": int(p.get("height") or 0), "score": float(p.get("score") or 0)})
        if len(root.findall("post")) < 100:
            pass  # 可能不足一页，继续尝试下一 pid 意义不大
    out.sort(key=lambda x: -x["score"])
    return out


def sheet(files):
    cols, tw, pad, lh = 6, 170, 6, 18
    ch = 170
    rows = (len(files) + cols - 1) // cols
    img = Image.new("RGB", (cols * (tw + pad) + pad, rows * (ch + lh + pad) + pad), (18, 18, 26))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default(size=13)
    except Exception:
        font = None
    for i, f in enumerate(files):
        r, c = divmod(i, cols)
        x, y = pad + c * (tw + pad), pad + r * (ch + lh + pad)
        try:
            with Image.open(os.path.join(RAW, f)) as im:
                im = im.convert("RGB")
                im.thumbnail((tw, ch))
                img.paste(im, (x + (tw - im.width) // 2, y + (ch - im.height) // 2))
        except Exception:
            pass
        d.text((x + 2, y + ch + 2), os.path.splitext(f)[0], fill=(240, 240, 240), font=font)
    out = os.path.join(BASE, "candidates", "new_tiles_sheet.png")
    img.save(out)
    print("sheet:", out, "items:", len(files))


if __name__ == "__main__":
    known = {}
    for f in os.listdir(RAW):
        try:
            known[md5_of(os.path.join(RAW, f))] = f
        except Exception:
            pass
    print("existing raw:", len(known))
    new_files = []
    for ch, tag in CHARS.items():
        have = sum(1 for f in os.listdir(RAW) if f.startswith(ch + "_cand_"))
        print("[%s] have %d raws" % (ch, have))
        for c in safebooru_posts(tag, min_score=4):
            if have >= TARGET_PER_CHAR:
                break
            base = os.path.basename(urllib.parse.urlparse(c["url"]).path)
            if base in known:
                continue
            ext = os.path.splitext(base)[1] or ".jpg"
            path = os.path.join(RAW, "%s_cand_%02d%s" % (ch, have + 1, ext))
            try:
                blob = fetch(c["url"])
                if len(blob) > MAX_BYTES:
                    continue
                with open(path, "wb") as f:
                    f.write(blob)
                with Image.open(path) as im:
                    im.verify()
                with Image.open(path) as im2:
                    w, h = im2.size
                if min(w, h) < 350:
                    os.remove(path)
                    continue
                known[md5_of(path)] = os.path.basename(path)
                new_files.append(os.path.basename(path))
                have += 1
                print("  + %dx%d score=%s %s" % (w, h, c["score"], os.path.basename(path)))
            except Exception as e:
                if os.path.exists(path):
                    os.remove(path)
                print("  skip(%s)" % type(e).__name__)
        print("[%s] now have %d" % (ch, have))
    sheet(new_files)
