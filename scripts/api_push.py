# -*- coding: utf-8 -*-
"""Push the current commit's changed files to GitHub via the Git Data API
(bypasses git-over-443 when direct push is blocked). api.github.com only."""
import base64
import json
import os
import subprocess
import sys
import urllib.request

REPO = "Honor-Boop/asuka-rei-lianliankan"
API = "https://api.github.com/repos/" + REPO
FILES = ["index.html", "gomoku.html", "README.md", "DEVELOPMENT.md"]
MSG = """feat: 新增五珠对弈玩法，打开时先选玩法

- index.html 玩法选择大厅：连连看 / 五珠对弈，游戏中可随时点 🎮 玩法 切换
- gomoku.html：9×9 人机轮流落珠，横竖斜五珠连线得分消除（连长×10，双线双倍计）
- AI 三层策略：自己能成五直接得分 → 封堵玩家将成五的点 → 成线潜力+限制+中心偏好启发式
- 你执绫波丽珠、AI 执明日香珠；棋盘填满后比总分，胜/负/平三种结算"""


def token():
    out = subprocess.run(["git", "credential", "fill"], input="protocol=https\nhost=github.com\n\n",
                         capture_output=True, text=True).stdout
    for line in out.splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1]
    raise SystemExit("no token")


def api(path, payload=None, method="GET"):
    req = urllib.request.Request(API + path, method=method,
                                 headers={"Authorization": "token " + TOKEN,
                                          "Accept": "application/vnd.github+json",
                                          "User-Agent": "llk-uploader"})
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data, timeout=40) as r:
        return json.load(r)


def main():
    ref = api("/git/ref/heads/main")
    head_sha = ref["object"]["sha"]
    base_tree = api("/git/commits/" + head_sha)["tree"]["sha"]
    print("head:", head_sha[:10], "tree:", base_tree[:10])

    tree = []
    for f in FILES:
        blob = api("/git/blobs", {"content": base64.b64encode(
            open(f, "rb").read()).decode(), "encoding": "base64"}, method="POST")
        tree.append({"path": f, "mode": "100644", "type": "blob", "sha": blob["sha"]})
        print("blob:", f, blob["sha"][:10])

    new_tree = api("/git/trees", {"base_tree": base_tree, "tree": tree}, method="POST")
    print("tree:", new_tree["sha"][:10])

    commit = api("/git/commits", {"message": MSG, "tree": new_tree["sha"],
                                  "parents": [head_sha]}, method="POST")
    print("commit:", commit["sha"][:10])

    api("/git/refs/heads/main", {"sha": commit["sha"], "force": False}, method="PATCH")
    print("ref updated ->", commit["sha"][:10])


TOKEN = token()
if __name__ == "__main__":
    main()
