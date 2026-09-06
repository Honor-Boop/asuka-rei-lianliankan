# -*- coding: utf-8 -*-
"""Sync local HEAD content to GitHub via Git Data API (full-tree method).
Works when github.com:443 is blocked but api.github.com is reachable."""
import base64
import json
import os
import subprocess
import urllib.request

REPO = "Honor-Boop/asuka-rei-lianliankan"
API = "https://api.github.com/repos/" + REPO
GITIGNORED = ("candidates/", "_sheet", "__pycache__", ".git")


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
                                          "User-Agent": "llk-sync"})
    data = json.dumps(payload).encode() if payload is not None else None
    if data:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data, timeout=60) as r:
        return json.load(r)


def git(*args):
    return subprocess.run(["git"] + list(args), capture_output=True, text=True, check=True).stdout.strip()


def main():
    head = api("/git/ref/heads/main")["object"]["sha"]
    head_tree = api("/git/commits/" + head)["tree"]["sha"]
    remote = {e["path"]: e["sha"] for e in
              api("/git/trees/" + head_tree + "?recursive=1")["tree"]
              if e["type"] == "blob"}
    print("remote head:", head[:10], "| remote files:", len(remote))

    tracked = [p for p in git("ls-files").splitlines() if p]
    uploads = []
    new_tree = []
    for p in tracked:
        sha = git("hash-object", "-w", p)
        if remote.get(p) == sha:
            new_tree.append({"path": p, "mode": "100644", "type": "blob", "sha": sha})
            continue
        with open(p, "rb") as f:
            content = f.read()
        blob = api("/git/blobs", {"content": base64.b64encode(content).decode(),
                                  "encoding": "base64"}, method="POST")
        new_tree.append({"path": p, "mode": "100644", "type": "blob", "sha": blob["sha"]})
        uploads.append(p)
        print("upload:", p, "(", len(content), "bytes )", flush=True)
    deleted = [p for p in remote if p not in tracked]
    for p in deleted:
        print("delete:", p, flush=True)

    commit = api("/git/commits", {
        "message": git("log", "-1", "--pretty=%B"),
        "tree": new_tree and api("/git/trees", {"tree": new_tree}, method="POST")["sha"],
        "parents": [head],
    }, method="POST")
    api("/git/refs/heads/main", {"sha": commit["sha"]}, method="PATCH")
    print("synced:", commit["sha"][:10], "| uploads:", len(uploads), "| deleted:", len(deleted))


TOKEN = token()
if __name__ == "__main__":
    main()
