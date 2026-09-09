# -*- coding: utf-8 -*-
"""Push explicit file list to GitHub via Git Data API (bypasses git-over-443).
Usage: python scripts/api_push_files.py <commit-message-file-or-string> file1 file2 ...
Commit message: pass a file path starting with '@' (e.g. @msg.txt) or a plain string.
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request

REPO = "Honor-Boop/asuka-rei-lianliankan"
API = "https://api.github.com/repos/" + REPO


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
    with urllib.request.urlopen(req, data, timeout=60) as r:
        return json.load(r)


def main():
    msg_arg, files = sys.argv[1], sys.argv[2:]
    if msg_arg.startswith("@"):
        with open(msg_arg[1:], encoding="utf-8") as f:
            msg = f.read()
    else:
        msg = msg_arg
    if not files:
        raise SystemExit("no files given")

    ref = api("/git/refs/heads/main")
    head_sha = ref["object"]["sha"]
    base_tree = api("/git/commits/" + head_sha)["tree"]["sha"]
    print("head:", head_sha[:10])

    tree = []
    for f in files:
        with open(f, "rb") as fh:
            blob = api("/git/blobs",
                       {"content": base64.b64encode(fh.read()).decode(), "encoding": "base64"},
                       method="POST")
        tree.append({"path": f.replace("\\", "/"), "mode": "100644",
                     "type": "blob", "sha": blob["sha"]})
        print("blob:", f, blob["sha"][:10])

    new_tree = api("/git/trees", {"base_tree": base_tree, "tree": tree}, method="POST")
    print("tree:", new_tree["sha"][:10])

    commit = api("/git/commits", {"message": msg, "tree": new_tree["sha"],
                                  "parents": [head_sha]}, method="POST")
    print("commit:", commit["sha"][:10])
    api("/git/refs/heads/main", {"sha": commit["sha"], "force": False}, method="PATCH")
    print("ref updated ->", commit["sha"][:10])


TOKEN = token()
if __name__ == "__main__":
    main()
