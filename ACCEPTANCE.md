# 验收报告 · v1.3.0 发版（拼图 + 接龙 + 更新公告）（2026-09-10）

## 需求
“更新安装包和 release，发布更新公告。”

## 交付
### 1. 版本与产物
- `serve.py` VERSION → **v1.3.0**
- 重新打包：`dist/EVA-MiniGames-Setup-v1.3.0.exe`（154,443,610 B）、
  `dist/EVA小游戏.zip`、`dist/EVA小游戏/`、`dist/EVA小游戏-安装程序.exe`
- 旧包清理：删除 `dist/EVA-MiniGames-Setup-v1.2.0.exe`，dist 仅保留 v1.3.0
- 打包脚本自动同步本机安装目录（v1.3.0）并重建桌面/开始菜单快捷方式

### 2. 包内容校验（zip 内实测）
- serve.py = v1.3.0；`puzzle.html` / `klondike.html` **在包内**；测试文件（*-test.js）未泄漏进包
- 拼图实时图库（api/list）✓、大厅含 puzzle/klondike 入口 ✓、蜘蛛拖拽修复 ✓、扫雷 36×36 ✓

### 3. GitHub Release（更新公告）
- Release **v1.3.0**「EVA 小游戏 v1.3.0 · 新增拼图 & 接龙（玩法达 8 个）」
- 公告正文 727 字：拼图（含实时图库联动）、接龙（三档难度规则）、大厅 8 玩法、安装说明、
  此前特性汇总（扫雷 36×36 / 宽屏布局 / 蜘蛛修复 / 数独 / 图库浮层 / 图标）
- 资产 `EVA-MiniGames-Setup-v1.3.0.exe` 上传成功，远端 154,443,610 B 与本地一致
- 老玩家更新检测会看到「发现新版 v1.3.0」+ 这份公告

### 4. 过程中发现并修复的问题
**GitHub 匿名限流导致更新检查偶发失败**：本机频繁调 api.github.com 触发匿名
60 次/时限制（403 rate limit），`api/update-check` 返回 HTTPError。
修复（serve.py）：`_github_token()` 从本机 git 凭据取 token 附上请求（认证后 5000/时）；
玩家机器无凭据自动回退匿名，行为不变；403 时返回可读 `rate_limited`。
已实测修复后恢复正常。

## 验证证据
- 更新检测：`ok=true current=v1.3.0 latest=v1.3.0 update=false`，url 指向 v1.3.0 资产，
  公告 727 字（含拼图/接龙小节）
- 远端 releases/latest：tag v1.3.0，资产大小一致
- 本机安装目录：serve.py v1.3.0（含限流修复）、大厅 index.html 含两个新入口
- 桌面快捷方式双击启动正常（前一验收已实测，本次构建同链路自动重建）
- 代码推送 main：2c06f51（发版）+ 8440753（限流修复）

## 备注
- GitHub 上旧 Release（v1.2.0 及更早）仍保留；需要清理请明确告知（不可逆）
- 本机 WDAC 仍拦截 exe，本机入口为桌面 vbs → pywebview；安装包供其他电脑使用
