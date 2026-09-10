# 验收报告 · v1.1.9 更新发版 + 清理旧版本（2026-09-10）

## 需求
“更新，并删掉其他版本。”

## 交付
### 1. 全量重打包（v1.1.9）
用 `scripts/build_release.py` 一条命令完成：
桌面程序（PyInstaller）→ 拷资源（排除 `*-test.js`）→ 绿色版 zip → 内嵌 zip 的单文件安装程序
→ 发布命名副本 → **自动同步本机安装目录并重建快捷方式**。

| 产物 | 大小 | 说明 |
| --- | --- | --- |
| `dist/EVA-MiniGames-Setup-v1.1.9.exe` | 154,421,406 B | 发布用安装包 |
| `dist/EVA小游戏-安装程序.exe` | 154,421,406 B | 同一构建原始名（内容一致） |
| `dist/EVA小游戏.zip` | 166,187,986 B | 绿色版（390 条目） |
| `dist/EVA小游戏/` | — | 绿色版目录 |

### 2. 包内容校验（关键）
- zip 内 `spider.html` **含本次拖拽修复**（`movable` 标记、被压牌 `slot-card.blocked` 样式均在）
- zip 内 `serve.py` 版本 = **v1.1.9**
- index.html / sudoku.html / gallery_panel.js / EVA小游戏.exe 均在包内

### 3. 清理旧版本
删除 `dist/EVA-MiniGames-Setup-v1.1.6.exe`、`v1.1.7.exe`、`v1.1.8.exe`；
`dist/` 现在**只保留 v1.1.9** 的安装包 + 当前绿色版 zip/目录。

### 4. GitHub Release
- 新建 Release **v1.1.9**「EVA 小游戏 v1.1.9 · 蜘蛛纸牌拖拽修复」，说明 347 字
- 资产 `EVA-MiniGames-Setup-v1.1.9.exe` 上传成功，远端 154,421,406 B 与本地一致
- 代码推送 main（commit 789de6e05c）
- 说明：**旧 Release（v1.1.6/v1.1.7/v1.1.8 等）仍保留在 GitHub 上**，未做删除
  （删除线上 Release 属不可逆操作，如需要请明确告知）

### 5. 闭环与启动链路（实测）
- 更新检测（当前版本程序）：`current=v1.1.9 latest=v1.1.9 update=false`，
  url 指向 v1.1.9 资产；更新说明正确返回（347 字，含「蜘蛛纸牌：修复牌拖不动」小节）
- 本机安装目录：serve.py = v1.1.9，spider.html 含拖拽修复
- 桌面快捷方式启动链路：双击桌面 `EVA小游戏` → 独立窗口「EVA 小游戏 · 明日香 × 绫波丽」，
  安装目录服务 `/api/version` = **v1.1.9**
- 构建时脚本自动关闭了运行中的游戏实例（3 个 pythonw）以释放安装目录，属预期行为

## 备注
- 本机 WDAC 仍拦截 exe，安装包适用于其他电脑；本机用桌面图标（vbs → pywebview）
- 临时开发服务脚本已清理；开发预览服务运行在 8768
