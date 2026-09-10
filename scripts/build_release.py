# -*- coding: utf-8 -*-
"""一键打包发布产物（Windows 绿色版 + 安装程序）

流程：
  1. PyInstaller 构建桌面程序（EVA小游戏.spec）→ dist/EVA小游戏/
  2. 拷贝网页资源（*.html / *.js 排除 *-test.js / serve.py / 图片素材）进 dist/EVA小游戏/
  3. 打包绿色版 zip → dist/EVA小游戏.zip
  4. PyInstaller 构建单文件安装程序（EVA小游戏-安装程序.spec，内嵌上面的 zip）
     → dist/EVA小游戏-安装程序.exe
  5. 复制一份发布命名 dist/EVA-MiniGames-Setup-<版本>.exe

用法：python scripts/build_release.py [版本号] [--no-local]
    版本号省略时读取 serve.py 里的 VERSION。

  构建完成后会**自动**同步本机安装目录并重建桌面/开始菜单快捷方式
  （调用 scripts/refresh_local.py；本机入口靠 vbs 启动器，整目录覆盖会删掉它）。
  --no-local  跳过本机刷新（只出分发包）
  --local-only 不构建，只刷新本机安装目录与快捷方式
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


def step_refresh_local():
    """同步本机安装目录并重建桌面/开始菜单快捷方式。

    本机入口是 vbs 启动器（WDAC 拦截无签名 exe），而 vbs 与 desktop.py 不在分发包里，
    整目录覆盖更新会把它们删掉、导致快捷方式失效 —— 所以这里必须跟在构建后面自动执行。
    """
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import refresh_local as rl
    print(">> 同步本机安装目录 + 重建快捷方式")
    app_dir = rl.extract(ZIP_PATH, rl.DEFAULT_TARGET)
    launcher = rl.write_launcher(app_dir)
    rl.make_shortcuts(app_dir, launcher)
    print(rl.ps(f'''
$ws = New-Object -ComObject WScript.Shell
$desk = [Environment]::GetFolderPath('Desktop')
$menu = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'
Write-Host "=== 快捷方式 ==="
foreach ($p in @((Join-Path $desk '{rl.APP_NAME}.lnk'), (Join-Path $desk '{rl.APP_NAME} - 快捷方式.lnk'), (Join-Path $menu '{rl.APP_NAME}.lnk'))) {{
  if (Test-Path $p) {{
    $l = $ws.CreateShortcut($p)
    Write-Host ("  [OK] " + (Split-Path $p -Leaf) + " -> " + $l.TargetPath + " exists=" + (Test-Path $l.TargetPath))
  }} else {{ Write-Host ("  [缺失] " + $p) }}
}}
'''))
    if not rl.verify(app_dir, launcher):
        raise SystemExit("本机安装目录校验失败")
    print(">> 本机快捷方式已更新（桌面 + 开始菜单）")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    version = args[0] if args else read_version()

    if "--local-only" in flags:
        print("=== 仅刷新本机（不构建）", version, "===")
        step_refresh_local()
        print("=== 完成 ===")
        return

    print("=== 打包", version, "===")
    step_build_desktop()
    step_copy_assets()
    step_zip()
    step_build_installer(version)
    if "--no-local" in flags:
        print(">> 跳过本机刷新（--no-local）")
    else:
        step_refresh_local()
    print("=== 完成 ===")


if __name__ == "__main__":
    main()
