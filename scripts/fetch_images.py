# -*- coding: utf-8 -*-
"""Download candidate images of Ayanami Rei & Souryuu Asuka from public booru APIs."""
import json
import os
import sys
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(BASE, "candidates", "raw")
os.makedirs(RAW_DIR, exist_ok=True)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
MAX_BYTES = 8 * 1024 * 1024
MIN_SIDE = 350
WANT_PER_CHAR = 16
GOOD_EXT = {".jpg", ".jpeg", ".png"}

CHARS = {
    "rei": ["ayanami_rei"],
    "asuka": ["souryuu_asuka_langley", "asuka_langley_soryuu", "asuka_langley"],
}


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": url})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def safebooru_posts(tags, limit=40):
    url = ("https://safebooru.org/index.php?page=dapi&s=post&q=index"
           "&limit=%d&tags=%s" % (limit, urllib.parse.quote(" ".join(tags))))
    try:
        xml = fetch(url)
    except Exception as e:
        print("[safebooru] FAIL %s: %s" % (tags, e))
        return []
    out = []
    try:
        root = ET.fromstring(xml)
        for p in root.findall("post"):
            fu = p.get("file_url") or ""
            if fu.startswith("//"):
                fu = "https:" + fu
            out.append({
                "url": fu,
                "w": int(p.get("width") or 0),
                "h": int(p.get("height") or 0),
                "score": float(p.get("score") or 0),
                "ext": os.path.splitext(urllib.parse.urlparse(fu).path)[1].lower(),
            })
    except Exception as e:
        print("[safebooru] parse fail: %s" % e)
    return out


def konachan_posts(tags, limit=40):
    url = ("https://konachan.net/post.json?limit=%d&tags=%s"
           % (limit, urllib.parse.quote(" ".join(["order:score"] + tags))))
    try:
        data = json.loads(fetch(url))
    except Exception as e:
        print("[konachan] FAIL %s: %s" % (tags, e))
        return []
    out = []
    for p in data:
        fu = p.get("file_url") or ""
        out.append({
            "url": fu,
            "w": int(p.get("width") or 0),
            "h": int(p.get("height") or 0),
            "score": float(p.get("score") or 0),
            "ext": os.path.splitext(urllib.parse.urlparse(fu).path)[1].lower(),
        })
    return out


def download(char):
    seen, cands = set(), []
    for tagset in (["solo", "score:>=15"], []):
        base_tags = CHARS[char][:1]
        posts = safebooru_posts(base_tags + tagset)
        posts += konachan_posts(base_tags + (["solo"] if tagset else []))
        for p in posts:
            if p["url"] in seen:
                continue
            seen.add(p["url"])
            if p["ext"] not in GOOD_EXT:
                continue
            if p["w"] and p["h"] and min(p["w"], p["h"]) < 500:
                continue
            cands.append(p)
        if len(cands) >= WANT_PER_CHAR * 2:
            break
    cands.sort(key=lambda x: -x["score"])
    print("[%s] candidates: %d" % (char, len(cands)))

    saved = []
    for c in cands:
        if len(saved) >= WANT_PER_CHAR:
            break
        i = len(saved) + 1
        ext = c["ext"] or ".jpg"
        path = os.path.join(RAW_DIR, "%s_cand_%02d%s" % (char, i, ext))
        try:
            blob = fetch(c["url"])
            if len(blob) > MAX_BYTES:
                print("  skip(too big %.1fMB): %s" % (len(blob) / 1e6, c["url"]))
                continue
            with open(path, "wb") as f:
                f.write(blob)
            with Image.open(path) as im:
                im.verify()
            with Image.open(path) as im2:
                w, h = im2.size
            if min(w, h) < MIN_SIDE:
                os.remove(path)
                print("  skip(small %dx%d)" % (w, h))
                continue
            saved.append(path)
            print("  ok %dx%d score=%s %s" % (w, h, c["score"], os.path.basename(path)))
        except Exception as e:
            if os.path.exists(path):
                os.remove(path)
            print("  skip(%s): %s" % (type(e).__name__, c["url"][:90]))
    print("[%s] saved: %d" % (char, len(saved)))
    return saved


def contact_sheet(paths):
    cell_w, cell_h, cols, pad, label_h = 220, 220, 8, 6, 22
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (cell_w + pad) + pad,
                              rows * (cell_h + label_h + pad) + pad), (24, 24, 32))
    try:
        from PIL import ImageDraw, ImageFont
        font = ImageFont.load_default(size=16)
    except Exception:
        font = None
        from PIL import ImageDraw
    draw = ImageDraw.Draw(sheet)
    for idx, p in enumerate(paths):
        r, cidx = divmod(idx, cols)
        x = pad + cidx * (cell_w + pad)
        y = pad + r * (cell_h + label_h + pad)
        try:
            with Image.open(p) as im:
                im = im.convert("RGB")
                im.thumbnail((cell_w, cell_h))
                sheet.paste(im, (x + (cell_w - im.width) // 2,
                                 y + (cell_h - im.height) // 2))
        except Exception as e:
            print("thumb fail %s: %s" % (p, e))
        draw.text((x + 2, y + cell_h + 3), os.path.splitext(os.path.basename(p))[0],
                  fill=(240, 240, 240), font=font)
    out = os.path.join(BASE, "candidates", "sheet.png")
    sheet.save(out)
    print("sheet:", out, "items:", len(paths))
    return out


if __name__ == "__main__":
    all_paths = []
    for ch in ("rei", "asuka"):
        all_paths += download(ch)
    contact_sheet(all_paths)
