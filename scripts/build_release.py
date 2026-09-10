# -*- coding: utf-8 -*-
"""一键打包发布产物（Windows 绿色版 + 安装程序）

流程：
  1. PyInstaller 构建桌面程序（EVA小游戏.spec）→ dist/EVA小游戏/
  2. 拷贝网页资源（*.html / *.js 排除 *-test.js / serve.py / 图片素材）进 dist/EVA小游戏/
  3. 打包绿色版 zip → dist/EVA小游戏.zip
  4. PyInstaller 构建单文件安装程序（EVA小游戏-安装程序.spec，内嵌上面的 zip）
     → dist/EVA小游戏-安装程序.exe
  5. 复制一份发布命名 dist/EVA-MiniGames-Setup-<版本>.exe

用法：python scripts/build_release.py [版本号]
    版本号省略时读取 serve.py 里的 VERSION。
"""
import os
import re
import shutil
import subprocess
import sys
import zipfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(BASE, "dist")
APP_DIR = os.path.join(DIST, "EVA小游戏")
ZIP_PATH = os.path.join(DIST, "EVA小游戏.zip")
INSTALLER = os.path.join(DIST, "EVA小游戏-安装程序.exe")

HTML_JS = re.compile(r".*\.(html|js)$")


def read_version():
    with open(os.path.join(BASE, "serve.py"), encoding="utf-8") as f:
        m = re.search(r'VERSION = "([^"]+)"', f.read())
    if not m:
        raise SystemExit("serve.py 里找不到 VERSION")
    return m.group(1)


def run(cmd):
    print(">>", " ".join(cmd))
    subprocess.run(cmd, cwd=BASE, check=True)


def step_build_desktop():
    if os.path.isdir(APP_DIR):
        shutil.rmtree(APP_DIR)
    run([sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "EVA小游戏.spec"])


def step_copy_assets():
    # 图片素材
    for d in ("assets", "images", "wallpapers"):
        src = os.path.join(BASE, d)
        if os.path.isdir(src):
            shutil.copytree(src, os.path.join(APP_DIR, d), dirs_exist_ok=True)
    # 网页与脚本（排除自动化测试文件）
    copied = []
    for name in sorted(os.listdir(BASE)):
        src = os.path.join(BASE, name)
        if not os.path.isfile(src):
            continue
        if name == "serve.py" or HTML_JS.match(name):
            if name.endswith("-test.js"):
                continue
            shutil.copy2(src, os.path.join(APP_DIR, name))
            copied.append(name)
    print("copied:", ", ".join(copied))
    # 校验关键文件在位
    for need in ("sudoku.html", "spider.html", "gallery_panel.js", "deco.js", "background.js", "serve.py"):
        p = os.path.join(APP_DIR, need)
        if not os.path.isfile(p):
            raise SystemExit("缺少资源：" + need)
    with open(os.path.join(APP_DIR, "serve.py"), encoding="utf-8") as f:
        v = re.search(r'VERSION = "([^"]+)"', f.read()).group(1)
    print("bundled VERSION:", v)


def step_zip():
    if os.path.isfile(ZIP_PATH):
        os.remove(ZIP_PATH)
    n = 0
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_STORED) as z:
        for root, _dirs, files in os.walk(APP_DIR):
            for f in files:
                p = os.path.join(root, f)
                z.write(p, os.path.relpath(p, DIST).replace(os.sep, "/"))
                n += 1
    print("zip entries:", n, "size:", os.path.getsize(ZIP_PATH))


def step_build_installer(version):
    if os.path.isfile(INSTALLER):
        os.remove(INSTALLER)
    run([sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "EVA小游戏-安装程序.spec"])
    if not os.path.isfile(INSTALLER):
        raise SystemExit("安装程序未生成")
    out = os.path.join(DIST, "EVA-MiniGames-Setup-%s.exe" % version)
    shutil.copy2(INSTALLER, out)
    print("installer:", out, os.path.getsize(out), "bytes")


def main():
    version = sys.argv[1] if len(sys.argv) > 1 else read_version()
    print("=== 打包", version, "===")
    step_build_desktop()
    step_copy_assets()
    step_zip()
    step_build_installer(version)
    print("=== 完成 ===")


if __name__ == "__main__":
    main()
