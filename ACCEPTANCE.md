# 验收报告 · 修复桌面快捷方式消失（2026-09-10）

## 用户反馈
“本地的桌面快捷方式怎么没了”

## 根因（我的操作失误）
本机启用了应用程序控制策略（WDAC），PyInstaller 生成的无签名 exe 会被拦截，
所以本机游戏入口走的是 `EVA小游戏.vbs → pythonw desktop.py`（pywebview 独立窗口）。
而 `EVA小游戏.vbs` 与 `desktop.py` 是**本地专用文件、不在分发包 zip 里**。

上一轮更新本地版本时，我用「删除安装目录 → 整目录解压 zip」的方式覆盖，
把这两个文件一起删掉了 → 桌面/开始菜单快捷方式的目标不存在 →
桌面那两个快捷方式消失（探查时桌面上只剩 EVA刷新启动 / 明日香&凌波丽连连看），
开始菜单 `EVA小游戏.lnk` 指向的 vbs 也已失效（exists=False）。

## 修复
新增 `scripts/refresh_local.py`（本机刷新脚本，根治此问题）：
1. 解压 `dist/EVA小游戏.zip` 到安装目录
2. 补回本地专用文件：`EVA小游戏.vbs`（来自项目根 `official_launcher.vbs`）+ `desktop.py`
3. 重建快捷方式：桌面 `EVA小游戏.lnk`、`EVA小游戏 - 快捷方式.lnk` 与开始菜单 `EVA小游戏.lnk`
   （目标=vbs，图标=assets/icon_rei.ico，描述含玩法清单）
4. 清理失效/重复的开始菜单项
5. 校验关键文件在位并打印 serve.py 版本
（PS 调用统一走 UTF-16LE+base64，`$ProgressPreference='SilentlyContinue'` 去噪；
 启动器模板改为直接读取文件，避免 VBS 里 `""""` 转义踩坑）

`DEVELOPMENT.md` 增加「发版与本地刷新（脚本化）」章节，写明为什么必须用该脚本刷新。

## 验证证据

### 1. 快捷方式已恢复（探查实测）
桌面：`EVA小游戏.lnk` → `...\EVA小游戏\EVA小游戏.vbs` exists=True
　　　`EVA小游戏 - 快捷方式.lnk` → 同上 exists=True
开始菜单：仅剩 1 个干净的 `EVA小游戏.lnk` → vbs exists=True
（原先失效的 `EVA小游戏 (2).lnk`、`EVA连连看.lnk` 已清理）

### 2. 双击启动链路实测（先杀掉旧窗口与 8765 服务，从零启动）
桌面图标 → vbs → pythonw desktop.py：
- `WINDOW OK: EVA 小游戏 · 明日香 × 绫波丽`（独立应用窗口，无浏览器 UI）
- 安装目录内 serve.py 自启：`/api/version` = **v1.1.8**
- 该服务正常提供 `sudoku.html` / `gallery_panel.js` / `index.html`（均 HTTP 200）

### 3. 脚本自校验
launcher / desktop.py / serve.py / sudoku.html / gallery_panel.js 全部在位，版本 v1.1.8。

## 同步
- git：commit 72494dd（scripts/refresh_local.py、DEVELOPMENT.md）
- 未改动分发包与 Release（v1.1.8 无变化）；分发包保持只有 exe 入口，适合其他玩家

## 备注
以后更新本机版本请用 `python scripts/refresh_local.py`，不要手工解压覆盖安装目录，
否则 vbs 启动器会再次被删除、快捷方式失效。
