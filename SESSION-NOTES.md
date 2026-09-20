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

---

## 2026-09-17 快照 · 增量 3（v1.4.2 已发版 · 待办 1 完成）

- **待办 1 已完成**：v1.4.2（扫雷玻璃面板 + 方块 EVA 元素）已于上会话末尾发版并验收
  （提交 `6270641` 发版 + `667bd92` 验收），版本三处一致：serve.py = 本机安装目录 = GitHub Release
- 远程 main = `e8f6899`，与本地 HEAD `667bd92` **内容一致、SHA 不同**（Git Data API 重建历史的正常现象）；
  远端有意不含 `反馈_ZCode重复空闲缺陷.md` 与 `.gitignore` 的 `.tmp-*` 规则（推送清单未列入，内部报告不进公开仓库）
- 本会话 `git fetch origin main` 成功（此前仅 push 被代理阻断，fetch 可用，可作为远程比对手段）
- **剩余待办**：
  1. GitHub 旧 Release（≤ v1.3.0 及 v1.4.0/1）清理 —— 不可逆，需用户明确授权
  2. ZCode 框架缺陷反馈报告（`反馈_ZCode重复空闲缺陷.md`，仅本地）待提交智谱官方 —— 外向动作，等用户指示
- memory 中版本观察已同步为 v1.4.2

---

## 2026-09-20 快照 · 增量 4（v1.5.0：新增弹幕射击 + 塔防，玩法总数 11）

**目标（本次）**：用户问「还有什么有趣可以写的游戏」→ 选定 **EVA 出击·弹幕射击** 与 **使徒来袭·塔防**，
授权发版 v1.5.0。选这两个是为补上项目唯一空白——**实时动作与策略类**（此前 9 个全是回合制解谜/牌类）。

**已确认决定**
- 新玩法一律 **Canvas 实时渲染**（逻辑分辨率 + CSS 等比缩放；`layout()` 量 `#stageWrap` 实际宽度，
  避免 `__decoGutter` 的单边/双倍历史坑）；监听 `resize` + `decochange`
- **零新素材**策略：6 张圆形角色徽章 PNG（`assets/match3/*.png`）做塔防炮台图标与 HUD 头像，
  使徒/机体全部 Canvas 程序化几何绘制；音效沿用项目 WebAudio `beep()` 合成器
- 两页都接 `window.__decoSyncRate(v0–400, berserk)`：弹幕页同步率实时驱动、暴走切红；塔防页随波次与本部耐久上升
- 操作：弹幕页 = 方向键/WASD/拖拽 + Shift 精确 + `P` 暂停（**火力自动射击**）；塔防页 = 点格建造/升级/拆除 +
  `Esc` 取消 + `1–4` 快捷建造 + 空格提前呼叫
- 塔防平衡（探针验证过三档均可通关，见 ACCEPTANCE）：初始经费 460/420/420、击杀奖励 20/34/60/40/450、
  血量成长 10%/波、Boss 护甲 11（原 14 让零号机几乎无效）、使徒級 25 波/18 耐久/1.15 血倍

**当前状态**
- 版本 **v1.5.0**；玩法 **11 个**（新增 `shmup.html`、`tower.html`）；测试 **7 套 94 项**（新增 shmup 24 + tower 28）
- 页面注册链路：`index.html` 三处（卡片 + 路由 if + 主题色 CSS）；构建脚本通配根目录 `*.html` → 新页自动进包
- 实机验证（浏览器，两页）：无启动异常、移动/边界钳制/拖拽/建造/升级/战斗/波次推进全通，HUD 与内部状态一致，
  deco 同步率面板确认被驱动到 155.5%
- `document.hidden` 环境下 rAF 被节流 → 长流程验证改用**确定性推进**（在页面里直接循环调 `update(0.05)`）

**待办（沿用增量 3，均需用户决策）**
1. GitHub 旧 Release（≤ v1.3.0 及 v1.4.0/1/2）清理 —— 不可逆，需明确授权
2. ZCode 框架缺陷反馈报告待提交智谱官方 —— 外向动作

**关键位置**
- `shmup.html`：配置 `DIFFS/TYPES/P`；纯逻辑段（镜像源）；`updateSync/hurtPlayer` 同步率与力场；`updateBoss` 三段形态
- `tower.html`：`WAVE_PLAN/TOWERS/ANGELS/WAY_GRID`；纯逻辑段；`updateTowers` 选靶与 AoE；`build/upgrade/sell`
- `shmup-test.js`（24 项）/ `tower-test.js`（28 项）：镜像校验脚本见 ACCEPTANCE.md 记录的方法

---

## 2026-09-20 快照 · 增量 5（反馈报告已提交后按用户要求关闭 / Release 不清理）

- **待办 2 的处理结果（注意：勿重复提交）**：本缺陷**此前用户已通过 ZCode 应用内反馈渠道提交过**；
  本次经授权提交到官方 GitHub 仓库后，用户说明「之前反馈过了」→ 已**自行关闭**并留言说明重复：
  → https://github.com/zai-org/feedback/issues/740（closed / not_planned，2026-09-20）
  - **今后不要再向任何渠道重复提交本缺陷**。查重不能只看 GitHub：先前的反馈走应用内渠道，不生成公开 issue，
    所以 `zai-org/feedback` 里搜不到同类条目
  - 删除 issue 只有仓库管理员可做（REST API 无删除接口），作者只能关闭；彻底删除需维护者操作
  - 若将来确需重提：正文已按官方 bug_report 模板写好（本地 `反馈_ZCode重复空闲缺陷.md`），
    必填字段＝类别（工具调用/MCP）、框架（ZCode Agent 自研）、严重程度（Major）、复现频率（偶现）、版本、环境
  - 版本核对：缺陷首现 2026-09-12；日志显示 09-15~09-19 为 **0.16.5**；提交时 **0.16.9**
  - 提交渠道备忘：应用内「反馈」入口 / bigmodel 控制台工单（需登录，非自动化可完成）/
    公开 GitHub 仓库 `zai-org/feedback`（可自动化，附自动受理机器人回复）
- **待办 1 已由用户明确否决**：GitHub 旧 Release **不清理**（曾被授权后又被叫停，勿再执行）
- 本地报告 `反馈_ZCode重复空闲缺陷.md` 已写入提交与关闭记录（该文件仍**仅存本地**，不进公开仓库）
