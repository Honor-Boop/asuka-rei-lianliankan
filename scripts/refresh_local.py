# -*- coding: utf-8 -*-
"""刷新本地安装目录 + 重建快捷方式（开发机专用）

用途：把 dist/EVA小游戏.zip 解压到正式安装目录，并补回**不在分发包里**的本地启动器，
然后重建桌面 / 开始菜单快捷方式。解决“每次整目录覆盖更新后，vbs 启动器被删、
桌面快捷方式失效/消失”的问题。

背景：本机启用了应用程序控制策略（WDAC），PyInstaller 生成的无签名 exe 会被拦截，
因此本机入口走 vbs → pythonw desktop.py（pywebview 独立窗口）。这两个文件是本地专用，
不放进分发包（其他玩家机器有 Python 才能跑，且他们直接双击 exe 即可）。

用法：python scripts/refresh_local.py [--zip dist/EVA小游戏.zip] [--target <安装目录>]
"""
import argparse
import base64
import os
import shutil
import subprocess
import sys
import time
import zipfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_TARGET = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "EVA小游戏")
APP_NAME = "EVA小游戏"
LAUNCHER_NAME = APP_NAME + ".vbs"

# 本地启动器模板（项目根 official_launcher.vbs）：拉起 pywebview 独立窗口，
# 起服务由 desktop.py 负责。VBS 内容含 """" 转义，直接从文件读取避免转义踩坑。
LAUNCHER_SRC = os.path.join(BASE, "official_launcher.vbs")


def ps(cmd):
    """以 UTF-16LE + base64 传 PowerShell，避免中文/引号编码问题。

    只回传 stdout：PS 5.1 会把 Write-Host 的信息流以 CLIXML 形式塞进 stderr，属噪音。
    """
    cmd = "$ProgressPreference='SilentlyContinue';" + cmd
    out = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
         "-EncodedCommand", base64.b64encode(cmd.encode("utf-16-le")).decode()],
        capture_output=True)
    text = out.stdout.decode("gbk", "replace")
    if not text.strip() and out.returncode != 0:
        text = out.stderr.decode("gbk", "replace")
    return text


def _kill_running(app_dir):
    """关掉本机正在运行的该游戏实例（pythonw desktop.py / 8765 服务），否则目录被占用。"""
    out = ps(f'''
$n = 0
Get-CimInstance Win32_Process -Filter "Name = 'pythonw.exe'" |
  Where-Object {{ $_.CommandLine -match 'desktop\\.py' }} |
  ForEach-Object {{ Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $n++; Write-Host ("  关闭游戏窗口 pid=" + $_.ProcessId) }}
$c = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
if ($c) {{ Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host "  关闭 8765 本地服务" }}
if ($n -eq 0 -and -not $c) {{ Write-Host "  （没有运行中的实例）" }}
''')
    print(out.strip())
    time.sleep(1.5)


def extract(zip_path, target):
    app_dir = os.path.join(target, APP_NAME)
    if os.path.isdir(app_dir):
        try:
            shutil.rmtree(app_dir)
        except PermissionError:
            print("安装目录被占用 → 先关闭正在运行的游戏实例")
            _kill_running(app_dir)
            try:
                shutil.rmtree(app_dir)
            except PermissionError:
                print("仍被占用 → 改为就地覆盖（保留无法删除的文件）")
                with zipfile.ZipFile(zip_path) as z:
                    z.extractall(target)
                return app_dir
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(target)
    return app_dir


def write_launcher(app_dir):
    """补回本地专用启动器（分发包里没有）"""
    if not os.path.isfile(LAUNCHER_SRC):
        raise SystemExit("找不到启动器模板：" + LAUNCHER_SRC)
    launcher = os.path.join(app_dir, LAUNCHER_NAME)
    shutil.copy2(LAUNCHER_SRC, launcher)
    src = os.path.join(BASE, "desktop.py")           # desktop.py 是项目文件，拷一份进安装目录
    shutil.copy2(src, os.path.join(app_dir, "desktop.py"))
    return launcher


def make_shortcuts(app_dir, launcher):
    ico = os.path.join(app_dir, "assets", "icon_rei.ico")
    if not os.path.isfile(ico):
        ico = os.path.join(app_dir, "assets", "icon.ico")
    ps(f'''
$ws = New-Object -ComObject WScript.Shell
$desk = [Environment]::GetFolderPath('Desktop')
$menu = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'
$target = '{launcher}'
$work = '{app_dir}'
$icon = '{ico}'
foreach ($p in @((Join-Path $desk '{APP_NAME}.lnk'), (Join-Path $desk '{APP_NAME} - 快捷方式.lnk'), (Join-Path $menu '{APP_NAME}.lnk'))) {{
  if (Test-Path $p) {{ Remove-Item $p -Force }}
  $l = $ws.CreateShortcut($p)
  $l.TargetPath = $target
  $l.WorkingDirectory = $work
  $l.IconLocation = "$icon,0"
  $l.Description = 'EVA 小游戏 · 明日香×绫波丽（连连看/五珠/扫雷/蜘蛛/数独/观景）'
  $l.Save()
  Write-Host ("shortcut: " + $p)
}}
''')
    # 清理失效/重复的开始菜单项
    ps(f'''
$ws = New-Object -ComObject WScript.Shell
$menu = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'
Get-ChildItem $menu -Filter *.lnk | Where-Object {{ $_.Name -match 'EVA' }} | ForEach-Object {{
  $t = $ws.CreateShortcut($_.FullName).TargetPath
  if (-not (Test-Path $t)) {{ Remove-Item $_.FullName -Force; Write-Host ("removed broken: " + $_.Name) }}
  elseif ($_.Name -match '\\(2\\)|连连看') {{ Remove-Item $_.FullName -Force; Write-Host ("removed dup: " + $_.Name) }}
}}
''')


def verify(app_dir, launcher):
    print("=== 校验 ===")
    checks = {"启动器": launcher, "desktop.py": os.path.join(app_dir, "desktop.py"),
              "serve.py": os.path.join(app_dir, "serve.py"),
              "sudoku.html": os.path.join(app_dir, "sudoku.html"),
              "gallery_panel.js": os.path.join(app_dir, "gallery_panel.js")}
    ok = True
    for name, p in checks.items():
        good = os.path.isfile(p)
        ok = ok and good
        print(("  ✓ " if good else "  ✗ ") + name)
    with open(os.path.join(app_dir, "serve.py"), encoding="utf-8") as f:
        import re
        print("  版本:", re.search(r'VERSION = "([^"]+)"', f.read()).group(1))
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", default=os.path.join(BASE, "dist", "EVA小游戏.zip"))
    ap.add_argument("--target", default=DEFAULT_TARGET)
    a = ap.parse_args()
    if not os.path.isfile(a.zip):
        raise SystemExit("找不到分发包：" + a.zip)
    print("解压", a.zip, "->", a.target)
    app_dir = extract(a.zip, a.target)
    launcher = write_launcher(app_dir)
    make_shortcuts(app_dir, launcher)
    print(ps(f'''
$ws = New-Object -ComObject WScript.Shell
$desk = [Environment]::GetFolderPath('Desktop')
$menu = Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs'
Write-Host "=== 快捷方式现状 ==="
foreach ($p in @((Join-Path $desk '{APP_NAME}.lnk'), (Join-Path $desk '{APP_NAME} - 快捷方式.lnk'), (Join-Path $menu '{APP_NAME}.lnk'))) {{
  if (Test-Path $p) {{
    $l = $ws.CreateShortcut($p)
    Write-Host ("  [OK] " + (Split-Path $p -Leaf) + " -> " + $l.TargetPath + " exists=" + (Test-Path $l.TargetPath))
  }} else {{ Write-Host ("  [缺失] " + $p) }}
}}
'''))
    return 0 if verify(app_dir, launcher) else 1


if __name__ == "__main__":
    sys.exit(main())
