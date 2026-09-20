# -*- coding: utf-8 -*-
"""创建 GitHub Release 并上传安装包（走 Git Data API 同源的凭据，绕开被代理阻断的直连）。

用法：
    python scripts/create_release.py v1.5.0            # 用 scripts/release_notes_v1.5.0.md 作公告
    python scripts/create_release.py v1.5.0 --dry-run  # 只打印将要提交的内容
"""
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

REPO = "Honor-Boop/asuka-rei-lianliankan"
API = "https://api.github.com/repos/" + REPO
UPLOAD = "https://uploads.github.com/repos/" + REPO
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def token():
    out = subprocess.run(["git", "credential", "fill"],
                         input="protocol=https\nhost=github.com\n\n",
                         capture_output=True, text=True).stdout
    for line in out.splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1]
    raise SystemExit("未取到 GitHub token（git credential 为空）")


TOKEN = token()


def api(url, payload=None, method="GET", raw=None, ctype="application/json"):
    if not url.startswith("http"):
        url = API + url
    data = raw if raw is not None else (json.dumps(payload).encode() if payload is not None else None)
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "token " + TOKEN,
        "Accept": "application/vnd.github+json",
        "User-Agent": "llk-releaser",
    })
    if data is not None:
        req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            body = r.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:400]
        raise SystemExit("HTTP %s %s -> %s" % (e.code, url, detail))


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    ver = sys.argv[1].strip()
    dry = "--dry-run" in sys.argv
    notes = os.path.join(BASE, "scripts", "release_notes_%s.md" % ver)
    if not os.path.isfile(notes):
        raise SystemExit("缺少公告文件：scripts/release_notes_%s.md" % ver)
    with open(notes, encoding="utf-8") as f:
        body = f.read()
    asset = os.path.join(BASE, "dist", "EVA-MiniGames-Setup-%s.exe" % ver)
    if not os.path.isfile(asset):
        raise SystemExit("缺少安装包：dist/EVA-MiniGames-Setup-%s.exe（先跑 build_release.py）" % ver)
    size = os.path.getsize(asset)
    title = "EVA 小游戏 %s" % ver
    m = re.search(r"^###\s*[^\n]*?([^\n#]+)$", body, re.M)
    if m:
        title += " · " + m.group(1).strip()

    print("版本:", ver)
    print("标题:", title)
    print("公告: %d 字（来自 %s）" % (len(body), os.path.relpath(notes, BASE)))
    print("资产: %s（%d 字节）" % (os.path.relpath(asset, BASE), size))
    if dry:
        print("\n--- 公告预览（前 300 字）---\n" + body[:300])
        return

    head = api("/git/refs/heads/main")["object"]["sha"]
    print("main HEAD:", head[:10])
    payload = {"tag_name": ver, "name": title, "body": body,
               "target_commitish": "main", "draft": False, "prerelease": False}
    rel = api("/releases", payload, method="POST")
    print("Release 已创建:", rel["html_url"], "id=", rel["id"])

    with open(asset, "rb") as f:
        data = f.read()
    up = api(UPLOAD + "/releases/%d/assets?name=%s" % (rel["id"], os.path.basename(asset)),
             raw=data, method="POST", ctype="application/octet-stream")
    print("资产已上传:", up["name"], up["size"], "字节")
    print("下载直链:", up["browser_download_url"])


if __name__ == "__main__":
    main()
