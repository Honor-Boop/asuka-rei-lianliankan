# -*- coding: utf-8 -*-
"""Fetch 2K+ Misato wallpapers (safe-rated) and regenerate the manifest
with the new misato category added."""
import json
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_wallpapers import safebooru_search, fetch, WALL_DIR, THUMB_DIR  # noqa: E402

from PIL import Image  # noqa: E402

TAG = "katsuragi_misato solo"
WANT = 8
MAX_BYTES = 25 * 1024 * 1024
# 需要从非 solo 查询中按尺寸找回的保留图（夜景/啤酒三人组/车内氛围）
RECOVER_DIMS = {(5247, 3729), (5867, 3441), (4703, 3408)}


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
    out = os.path.join(WALL_DIR, "_misato_sheet.png")
    img.save(out)
    print("sheet:", out)


def curl_download(url, path, max_time=75):
    """curl 硬超时下载；先预检 Content-Length 拒绝超大文件。返回字节数或 None。"""
    import subprocess
    head = subprocess.run(
        ["curl", "-sIL", "--max-time", "20", url],
        capture_output=True, text=True)
    size = None
    for line in head.stdout.splitlines():
        if line.lower().startswith("content-length:"):
            try:
                size = int(line.split(":")[1].strip())
            except ValueError:
                pass
    if size is not None and size > MAX_BYTES:
        print("  skip(%dMB pre-check)" % (size // 1048576), flush=True)
        return None
    r = subprocess.run(
        ["curl", "-sL", "--max-time", str(max_time), "-A",
         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0", "-o", path, url],
        capture_output=True)
    if r.returncode != 0 or not os.path.exists(path):
        return None
    return os.path.getsize(path)


def valid_image(path):
    """PIL 完整加载校验（防截断文件）。"""
    try:
        with Image.open(path) as im:
            im.load()
        return True
    except Exception:
        return False


def main():
    # 第一轮：严格 2560x1440；不足再放宽到 1920x1080（2K 优先）
    cands = safebooru_search_tag(TAG, 2560, 1440)
    print("strict candidates:", len(cands), flush=True)
    if len(cands) < WANT:
        cands += safebooru_search_tag(TAG, 1920, 1080)
        print("relaxed candidates:", len(cands), flush=True)

    saved = []
    for c in cands:
        if len(saved) >= WANT:
            break
        ext = os.path.splitext(urllib.parse.urlparse(c["url"]).path)[1].lower() or ".jpg"
        if ext not in (".jpg", ".jpeg", ".png"):
            continue
        path = os.path.join(WALL_DIR, "misato_wall_%02d%s" % (len(saved) + 1, ext))
        if os.path.exists(path):
            if not valid_image(path):
                os.remove(path)
                print("  remove corrupt %s" % os.path.basename(path), flush=True)
            else:
                with Image.open(path) as im:
                    w, h = im.size
                saved.append({"file": os.path.basename(path), "res": "%dx%d" % (w, h)})
                print("  reuse %s" % os.path.basename(path), flush=True)
                continue
        try:
            n = curl_download(c["url"], path)
            if n is None:
                continue
            if not valid_image(path):
                os.remove(path)
                print("  skip corrupt download", flush=True)
                continue
            with Image.open(path) as im:
                w, h = im.size
            if w < 1920 or h < 1080:
                os.remove(path)
                print("  skip small %dx%d" % (w, h), flush=True)
                continue
            saved.append({"file": os.path.basename(path), "res": "%dx%d" % (w, h)})
            print("  ok %dx%d %.1fMB score=%s %s"
                  % (w, h, n / 1e6, c["score"], os.path.basename(path)), flush=True)
        except Exception as e:
            if os.path.exists(path):
                os.remove(path)
            print("  skip(%s)" % type(e).__name__, flush=True)

    # 从非 solo 查询按尺寸找回保留图
    if len(RECOVER_DIMS):
        print("recovering keepers by dims...", flush=True)
        for c in safebooru_search_tag("katsuragi_misato", 1920, 1080):
            if not RECOVER_DIMS:
                break
            if (c["w"], c["h"]) not in RECOVER_DIMS:
                continue
            ext = os.path.splitext(urllib.parse.urlparse(c["url"]).path)[1].lower() or ".jpg"
            path = os.path.join(WALL_DIR, "misato_wall_%02d%s" % (len(saved) + 1, ext))
            n = curl_download(c["url"], path)
            if n is None or not valid_image(path):
                if os.path.exists(path):
                    os.remove(path)
                continue
            with Image.open(path) as im:
                w, h = im.size
            if (w, h) not in RECOVER_DIMS:
                os.remove(path)
                continue
            RECOVER_DIMS.discard((w, h))
            saved.append({"file": os.path.basename(path), "res": "%dx%d" % (w, h)})
            print("  recovered %dx%d %s" % (w, h, os.path.basename(path)), flush=True)

    # 缩略图
    for e in saved:
        with Image.open(os.path.join(WALL_DIR, e["file"])) as im:
            im = im.convert("RGB")
            im.thumbnail((560, 10000), Image.LANCZOS)
            im.save(os.path.join(THUMB_DIR, e["file"]), "JPEG", quality=82)
    if saved:
        sheet([e["file"] for e in saved])

    # 重建 manifest（rei/asuka/misato）
    items = []
    for name in sorted(os.listdir(WALL_DIR)):
        stem, ext = os.path.splitext(name)
        if ext.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        if not any(stem.startswith(p) for p in ("rei_wall", "asuka_wall", "misato_wall")):
            continue
        with Image.open(os.path.join(WALL_DIR, name)) as im:
            w, h = im.size
        char = "rei" if stem.startswith("rei") else ("asuka" if stem.startswith("asuka") else "misato")
        items.append({"src": "wallpapers/" + name, "thumb": "wallpapers/thumbs/" + name,
                      "char": char, "res": "%dx%d" % (w, h)})
    with open(os.path.join(WALL_DIR, "manifest.js"), "w", encoding="utf-8") as f:
        f.write("// auto-generated: 2K+ wallpapers of Ayanami Rei / Souryuu Asuka / Katsuragi Misato\n")
        f.write("window.WALLPAPER_LIST = " + json.dumps(items, ensure_ascii=False, indent=2) + ";\n")
    print("manifest entries:", len(items))


def safebooru_search_tag(tag, min_w, min_h, pages=4):
    """Same as fetch_wallpapers.safebooru_search but with configurable size."""
    import xml.etree.ElementTree as ET
    out = []
    for pid in range(pages):
        url = ("https://safebooru.org/index.php?page=dapi&s=post&q=index"
               "&pid=%d&tags=%s" % (pid, urllib.parse.quote(
                   "%s width:>=%d height:>=%d rating:safe" % (tag, min_w, min_h))))
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
            out.append({"url": fu, "w": int(p.get("width") or 0),
                        "h": int(p.get("height") or 0),
                        "score": float(p.get("score") or 0)})
        if len(root.findall("post")) < 100:
            break
    out.sort(key=lambda x: (1 if x["w"] >= x["h"] else 0, x["score"]), reverse=True)
    return out


if __name__ == "__main__":
    main()
