# -*- coding: utf-8 -*-
"""把整套双姝扑克牌（54 张 + 双牌背）压缩为 320 宽 JPG 供网页使用。"""
import os
import shutil

from PIL import Image

SRC = r"D:\双姝扑克牌设计\完整54张"
SRC_TOP = r"D:\双姝扑克牌设计"
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "spider", "cards")
os.makedirs(OUT, exist_ok=True)

SIZE = 320


def convert(path, out_name):
    with Image.open(path) as im:
        im = im.convert("RGB")
        w, h = im.size
        nw = SIZE
        nh = round(h * SIZE / w)
        im = im.resize((nw, nh), Image.LANCZOS)
        im.save(os.path.join(OUT, out_name), "JPEG", quality=82)
        print(" ", out_name, im.size)


def main():
    for f in sorted(os.listdir(SRC)):
        if not f.endswith(".png"):
            continue
        name = os.path.splitext(f)[0]
        convert(os.path.join(SRC, f), name + ".jpg")
    convert(os.path.join(SRC_TOP, "10_牌背_蓝副.png"), "back_blue.jpg")
    convert(os.path.join(SRC_TOP, "11_牌背_红副.png"), "back_red.jpg")
    print("cards ready:", len(os.listdir(OUT)))


if __name__ == "__main__":
    main()
