# 会话快照（SESSION NOTES）

本文件按 `context-compression` 技能追加会话快照：只记录「继续执行所必需」的信息（目标、已确认决定、当前状态、待办、关键位置），过程性叙述一律省略。

---

## 2026-09-17 快照 · EVA 小游戏 v1.4.1

**目标**：维护 EVA 小游戏合集（9 个玩法），持续新增玩法、调整视觉、发版并同步本机安装。

**已确认决定**
- 项目路径以 **`D:\zcode-projects\eva-lianliankan`** 为准；原工作区路径 `C:\Users\17537\.zcode\workspace\default\eva-lianliankan` 已作废（09-13 13:30 被移动，工作区现仅剩 `lianliankan-desktop`、`shizheng-news`）
- 本机入口走 vbs → `pythonw desktop.py`（pywebview 独立窗口）：本机 WDAC 会拦截无签名 exe
- 发版统一走 `scripts/build_release.py`（构建 → 拷资源 → zip → 安装器 → 发布命名 → **自动同步本机安装目录与桌面/开始菜单快捷方式**）
- 推送远端走 `scripts/api_push_files.py`（Git Data API）：直连 `git push` 常被本机代理阻断

**当前状态**
- 版本 **v1.4.1**，三处一致：`serve.py` = 本机安装目录 = GitHub Release
- 9 个玩法：连连看 `index` / 五珠 `gomoku` / 观景 `view` / 蜘蛛 `spider` / 扫雷 `mine` / 数独 `sudoku` / 拼图 `puzzle` / 接龙 `klondike` / 三消 `match3`
- 回归测试 **42 项全过**：蜘蛛 11 / 数独 5 / 拼图 8 / 接龙 8 / 三消 10
- 扫雷玻璃面板 + 方块 EVA 元素（commit `92a2cf4`）仅在本机/仓库，**未打包进安装包**
- git 工作区干净，HEAD `8a5daf6`

**待办**
1. 扫雷视觉改动是否发 v1.4.2（打包 + Release + 本地同步）
2. GitHub 旧 Release（≤ v1.3.0）未清理 —— 需明确授权（不可逆）
3. ZCode 框架缺陷（任务完成后反复空调用不停止）反馈报告已入仓，待提交智谱官方

**关键位置**
- `serve.py:56` VERSION；`:60` `_github_token()`（匿名限流修复）；`:75` `check_update()`
- `deco.js:17` `--deco-gutter` 让位；`:351-356` `window.__decoGutter`
- `background.js:132/134` `__bgCurrentItem` / `__bgShowSrc`
- `gallery_panel.js:118/141/268` 底部图库入口注入与页内浮层
- `index.html:236/501/1411` 三消入口 CSS / 按钮 / 路由
- `mine.html:35` `.glass` 玻璃面板；`:100/109` 方块 EVA 伪元素；`:287` 36×36·200
- `match3.html:310/330/470` genBoard / findMatches / resolveBoard；`:665` 宝石预加载
- 构建脚本：`scripts/build_release.py`、`scripts/refresh_local.py`、`scripts/api_push_files.py`

---

## 2026-09-17 快照 · 增量（健康检查 + 环境限制）

- **全项目体检通过、无真实错误**：HTML 内联脚本 10 页 / JS 3 个 / Python 19 个语法全 OK；页面本地引用无缺失；大厅 9 入口路由有效；素材齐（牌面 52/52、宝石 6/6、角色图 28）；回归测试 42/42；版本三处一致 v1.4.1；安装目录与项目 10 个核心文件 md5 逐个一致；10 页 HTTP 200；壁纸轮换正常（39 张）
- 两处「疑似问题」确认为正常：各页 2 张 img 失败 = 装饰灯箱/图库灯箱的**空占位**；观景页无装饰栏 = 该页有意不加载 deco.js
- **环境限制**：本会话 memory MCP 已断开（`mcp__memory__*` 均返回 Tool not found，headroom MCP 正常）→ 持久性结论改由本文件承担；后续会话 memory 恢复后可补写
- 本文件即跨会话的「项目状态 + 已确认决定」权威来源

---

## 2026-09-17 快照 · 增量 2（memory MCP 修复 + 记忆已更新）

- **memory MCP 不可用的根因**：npx 缓存目录 `_npx\15b07286cbcc3329` 是残缺安装，缺 `zod` 依赖 →
  服务启动即退出（ERR_MODULE_NOT_FOUND，退出码 1）→ 无工具注册 → `mcp__memory__*` 报 Tool not found
- **修复**：删除该缓存目录让 npx 重装（重装后 zod 齐全，服务握手正常返回 `memory-server v0.6.3`）；
  另注意 MCP 连接在会话启动时建立，中途断开不会自动重连 → 需重启 ZCode 才能在本会话恢复工具
- **记忆已更新**（通过 stdio 直接驱动官方 memory 服务写入，等价于工具调用）：`EVA小游戏项目` 现有 13 条观察项，
  含新路径、v1.4.1 状态、9 玩法、42 项测试、发版/推送流程、SESSION-NOTES 权威来源、memory 缓存修复经验；
  旧路径条目与测试写入已删除干净
- 数据完整性：`memory.json` 为 **JSONL 行式存储**（每行一个对象），用整体 JSON 解析会误报 "Extra data"
- 排查要点：同批次里写入与读回会**竞态**（读可能先于写被处理）→ 校验必须另起一次服务运行读回
