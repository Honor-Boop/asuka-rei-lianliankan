# -*- coding: utf-8 -*-
"""Download 2K+ wallpapers of Ayanami Rei & Souryuu Asuka (safebooru API, safe-rated),
then build thumbnails and a static manifest.js for the gallery / background rotator."""
import json
import os
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WALL_DIR = os.path.join(BASE, "wallpapers")
THUMB_DIR = os.path.join(WALL_DIR, "thumbs")
os.makedirs(THUMB_DIR, exist_ok=True)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
MIN_W, MIN_H = 2560, 1440
MAX_BYTES = 25 * 1024 * 1024
WANT_PER_CHAR = 10

CHARS = {
    "rei": "ayanami_rei",
    "asuka": "souryuu_asuka_langley",
}


def fetch(url, timeout=40):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": url})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def safebooru_search(tag, pages=3):
    """Search safebooru for safe-rated 2K+ posts, best-score first, landscape preferred."""
    out = []
    for pid in range(pages):
        url = ("https://safebooru.org/index.php?page=dapi&s=post&q=index"
               "&pid=%d&tags=%s"
               % (pid, urllib.parse.quote(
                   "%s width:>=%d height:>=%d rating:safe" % (tag, MIN_W, MIN_H))))
        try:
            xml = fetch(url)
        except Exception as e:
            print("[safebooru] FAIL pid %d: %s" % (pid, e))
            break
        try:
            root = ET.fromstring(xml)
        except Exception as e:
            print("[safebooru] parse fail pid %d: %s" % (pid, e))
            break
        for p in root.findall("post"):
            fu = p.get("file_url") or ""
            if fu.startswith("//"):
                fu = "https:" + fu
            out.append({
                "url": fu,
                "w": int(p.get("width") or 0),
                "h": int(p.get("height") or 0),
                "score": float(p.get("score") or 0),
            })
        if len(root.findall("post")) < 100:
            break
    # 横版优先（更适合做桌面背景），同向按分数排序
    out.sort(key=lambda x: (1 if x["w"] >= x["h"] else 0, x["score"]), reverse=True)
    return out


def download(char, cand, seq):
    """Download one candidate for char; return entry dict or None."""
    ext = os.path.splitext(urllib.parse.urlparse(cand["url"]).path)[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png"):
        return None
    path = os.path.join(WALL_DIR, "%s_wall_%02d%s" % (char, seq, ext))
    try:
        blob = fetch(cand["url"])
        if len(blob) > MAX_BYTES:
            print("  skip(too big %.1fMB)" % (len(blob) / 1e6))
            return None
        with open(path, "wb") as f:
            f.write(blob)
        with Image.open(path) as im:
            w, h = im.size
        if w < MIN_W or h < MIN_H:
            os.remove(path)
            print("  skip(small %dx%d)" % (w, h))
            return None
        print("  ok %dx%d score=%s %.1fMB %s"
              % (w, h, cand["score"], len(blob) / 1e6, os.path.basename(path)))
        return {"file": os.path.basename(path), "res": "%dx%d" % (w, h)}
    except Exception as e:
        if os.path.exists(path):
            os.remove(path)
        print("  skip(%s): %s" % (type(e).__name__, cand["url"][:80]))
        return None


def make_thumbs(entries):
    for e in entries:
        src = os.path.join(WALL_DIR, e["file"])
        dst = os.path.join(THUMB_DIR, e["file"])
        with Image.open(src) as im:
            im = im.convert("RGB")
            w, h = im.size
            tw = 560
            th = round(h * tw / w)
            im.thumbnail((tw, th), Image.LANCZOS)
            im.save(dst, "JPEG", quality=82)
    print("thumbs done:", len(entries))


def contact_sheet(entries):
    from PIL import ImageDraw, ImageFont
    cols, tw, pad, label_h = 4, 300, 8, 20
    rows = (len(entries) + cols - 1) // cols
    cell_h = round(tw * 9 / 16)
    sheet = Image.new("RGB", (cols * (tw + pad) + pad,
                              rows * (cell_h + label_h + pad) + pad), (18, 18, 26))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=14)
    except Exception:
        font = None
    for i, e in enumerate(entries):
        r, c = divmod(i, cols)
        x, y = pad + c * (tw + pad), pad + r * (cell_h + label_h + pad)
        with Image.open(os.path.join(THUMB_DIR, e["file"])) as im:
            im.thumbnail((tw, cell_h))
            sheet.paste(im, (x + (tw - im.width) // 2, y + (cell_h - im.height) // 2))
        draw.text((x + 2, y + cell_h + 2), "%s %s" % (e["file"], e["res"]),
                  fill=(235, 235, 235), font=font)
    out = os.path.join(WALL_DIR, "_sheet.png")
    sheet.save(out)
    print("sheet:", out)


def write_manifest(all_entries):
    items = []
    for e in all_entries:
        char = "rei" if e["file"].startswith("rei") else "asuka"
        items.append({
            "src": "wallpapers/" + e["file"],
            "thumb": "wallpapers/thumbs/" + e["file"],
            "char": char,
            "res": e["res"],
        })
    with open(os.path.join(WALL_DIR, "manifest.js"), "w", encoding="utf-8") as f:
        f.write("// auto-generated by scripts/fetch_wallpapers.py\n")
        f.write("window.WALLPAPER_LIST = %s;\n" % json.dumps(items, ensure_ascii=False, indent=2))
    print("manifest entries:", len(items))


if __name__ == "__main__":
    # 先清空旧壁纸，避免上一轮文件与新一轮编号混淆
    for name in os.listdir(WALL_DIR):
        p = os.path.join(WALL_DIR, name)
        if os.path.isfile(p) and (name.startswith("rei_wall") or name.startswith("asuka_wall")):
            os.remove(p)
    for name in os.listdir(THUMB_DIR):
        os.remove(os.path.join(THUMB_DIR, name))

    cands = {}
    for ch in ("rei", "asuka"):
        cands[ch] = safebooru_search(CHARS[ch])
        print("[%s] safebooru candidates: %d" % (ch, len(cands[ch])))
    seen_urls, all_entries = set(), []
    for ch in ("rei", "asuka"):        # 全局按帖子 URL 去重（双人图只归先处理的角色）
        saved = 0
        for c in cands[ch]:
            if saved >= WANT_PER_CHAR:
                break
            if c["url"] in seen_urls:
                continue
            entry = download(ch, c, saved + 1)
            if entry:
                seen_urls.add(c["url"])
                all_entries.append(entry)
                saved += 1
    if not all_entries:
        print("no wallpapers downloaded", file=sys.stderr)
        sys.exit(1)
    make_thumbs(all_entries)
    contact_sheet(all_entries)
    write_manifest(all_entries)
