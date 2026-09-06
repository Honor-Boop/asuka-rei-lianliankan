# -*- coding: utf-8 -*-
"""Brighten the UI palette across all pages while keeping EVA identity."""
import io

REPLACEMENTS = {
    "index.html": [
        ("--bg1: #17102b;", "--bg1: #2c2256;"),
        ("--bg2: #0b0817;", "--bg2: #1b1544;"),
        ("--panel: rgba(255, 255, 255, 0.055);", "--panel: rgba(255, 255, 255, 0.11);"),
        ("--panel-border: rgba(255, 255, 255, 0.12);", "--panel-border: rgba(255, 255, 255, 0.24);"),
        ("--rei: #58b6ff;", "--rei: #74c4ff;"),
        ("--asuka: #ff6a3d;", "--asuka: #ff8055;"),
        ("--gold: #ffd54a;", "--gold: #ffe066;"),
        ("--eva-green: #58ffa3;", "--eva-green: #70ffb8;"),
        ("--eva-red: #ff5a3c;", "--eva-red: #ff7057;"),
        ("--text: #ece8f7;", "--text: #ffffff;"),
        ("--text-dim: #9a92b8;", "--text-dim: #c9c2ea;"),
        ("border: 2px solid rgba(255, 255, 255, 0.14);", "border: 2px solid rgba(255, 255, 255, 0.28);"),
        ("background: linear-gradient(160deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03));",
         "background: linear-gradient(160deg, rgba(255,255,255,0.16), rgba(255,255,255,0.07));"),
        ("background: rgba(20, 14, 36, 0.9);", "background: rgba(34, 25, 66, 0.92);"),
        ("background: rgba(20, 14, 36, 0.85);", "background: rgba(34, 25, 66, 0.88);"),
    ],
    "gallery.html": [
        ("--bg2: #0b0817;", "--bg1: #2c2256;\n    --bg2: #1b1544;"),
        ("background: var(--bg2);",
         "background:\n      radial-gradient(1200px 700px at 80% -10%, rgba(88, 182, 255, 0.16), transparent 60%),\n"
         "      radial-gradient(1000px 700px at 12% 110%, rgba(255, 106, 61, 0.15), transparent 60%),\n"
         "      linear-gradient(160deg, var(--bg1), var(--bg2));"),
        ("--panel: rgba(255, 255, 255, 0.055);", "--panel: rgba(255, 255, 255, 0.11);"),
        ("--panel-border: rgba(255, 255, 255, 0.12);", "--panel-border: rgba(255, 255, 255, 0.24);"),
        ("--rei: #58b6ff;", "--rei: #74c4ff;"),
        ("--asuka: #ff6a3d;", "--asuka: #ff8055;"),
        ("--gold: #ffd54a;", "--gold: #ffe066;"),
        ("--text: #ece8f7;", "--text: #ffffff;"),
        ("--text-dim: #9a92b8;", "--text-dim: #c9c2ea;"),
    ],
    "gomoku.html": [
        ("--bg1: #17102b;", "--bg1: #2c2256;"),
        ("--bg2: #0b0817;", "--bg2: #1b1544;"),
        ("--panel: rgba(255, 255, 255, 0.055);", "--panel: rgba(255, 255, 255, 0.11);"),
        ("--panel-border: rgba(255, 255, 255, 0.12);", "--panel-border: rgba(255, 255, 255, 0.24);"),
        ("--rei: #58b6ff;", "--rei: #74c4ff;"),
        ("--asuka: #ff6a3d;", "--asuka: #ff8055;"),
        ("--gold: #ffd54a;", "--gold: #ffe066;"),
        ("--eva-green: #58ffa3;", "--eva-green: #70ffb8;"),
        ("--eva-red: #ff5a3c;", "--eva-red: #ff7057;"),
        ("--text: #ece8f7;", "--text: #ffffff;"),
        ("--text-dim: #9a92b8;", "--text-dim: #c9c2ea;"),
        ("border: 1px solid rgba(255, 255, 255, 0.09);", "border: 1px solid rgba(255, 255, 255, 0.2);"),
        ("background: rgba(255, 255, 255, 0.03);", "background: rgba(255, 255, 255, 0.07);"),
        ("background: rgba(255, 255, 255, 0.04);", "background: rgba(255, 255, 255, 0.08);"),
        ("background: rgba(20, 14, 36, 0.9);", "background: rgba(34, 25, 66, 0.92);"),
    ],
    "background.js": [
        ("background: #0b0817;", "background: #1b1544;"),
        ("linear-gradient(180deg, rgba(11, 8, 23, 0.60), rgba(11, 8, 23, 0.74));",
         "linear-gradient(180deg, rgba(27, 21, 68, 0.38), rgba(27, 21, 68, 0.55));"),
        ("rgba(255, 255, 255, 0.014) 0 2px", "rgba(255, 255, 255, 0.03) 0 2px"),
    ],
    "deco.js": [
        ("font-size: 13px;letter-spacing:8px;color:rgba(236,232,247,.30)", 
         "font-size: 13px;letter-spacing:8px;color:rgba(255,255,255,.5)"),
        (".vtext b{color:rgba(236,232,247,.5)", ".vtext b{color:rgba(255,255,255,.75)"),
        ("color:rgba(236,232,247,.35);line-height:1.7", "color:rgba(255,255,255,.55);line-height:1.7"),
        ("color:rgba(236,232,247,.3)}", "color:rgba(255,255,255,.5)}"),
        ("color:rgba(236,232,247,.4)}", "color:rgba(255,255,255,.6)}"),
        ("color:rgba(236,232,247,.35)}", "color:rgba(255,255,255,.55)}"),
        ("barcode{width:88px;height:20px;opacity:.45", "barcode{width:88px;height:20px;opacity:.65"),
        ("opacity:.92}", "opacity:1}"),
    ],
}

for fname, pairs in REPLACEMENTS.items():
    s = io.open(fname, encoding="utf-8").read()
    for old, new in pairs:
        if old not in s:
            print("MISS:", fname, "|", old[:60])
            continue
        s = s.replace(old, new)
    io.open(fname, "w", encoding="utf-8", newline="\n").write(s)
    print("patched:", fname, f"({len(pairs)} rules)")
