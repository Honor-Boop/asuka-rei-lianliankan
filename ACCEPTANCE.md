# 验收报告 · v1.1.8 整合发版（数独 + 图库扩展 + 图标）（2026-09-10）

## 需求
“整合前面和刚刚的修改，更新安装包和 release，写出更新内容。”

## 整合内容（v1.1.8）
1. **9×9 数独**（新玩法）：唯一解生成器、三档难度（44/34/27 提示格）、候选数、即错提醒、
   提示、撤销、计时与最佳记录、结算横幅
2. **图库扩展**：新增 `gallery_panel.js` 浮层组件（角色筛选 / 缩略图墙 / 灯箱翻页 /
   设为背景 / 跳完整图库 / G 键），并接入 6 个页面；入口为**页面底部的连连看同款页脚链接**
3. **凌波丽图标**（桌面快捷方式 + 打包 exe + 安装程序统一）
4. `background.js` 新增 `__bgCurrentItem()` / `__bgShowSrc()`

## 交付产物
| 产物 | 大小 | 说明 |
| --- | --- | --- |
| `dist/EVA小游戏/` | — | 桌面绿色版目录，serve.py VERSION=v1.1.8，含 sudoku.html / gallery_panel.js |
| `dist/EVA小游戏.zip` | 166,187,395 B | 390 个条目 |
| `dist/EVA小游戏-安装程序.exe` | 154,421,705 B | 单文件安装程序（内嵌上述 zip，凌波丽图标） |
| `dist/EVA-MiniGames-Setup-v1.1.8.exe` | 154,421,705 B | 发布命名副本 |

新增 `scripts/build_release.py` 固化打包流程（构建 → 拷资源 → zip → 内嵌安装程序 → 发布命名），
含关键资源在位校验与 serve.py 版本一致性校验；`scripts/release_notes_v1.1.8.md` 为 Release 说明源文件。

## 验证证据

### 1. 打包产物完整性
`build_release.py` 输出：bundled VERSION=v1.1.8；关键资源校验通过
（sudoku.html / spider.html / gallery_panel.js / deco.js / background.js / serve.py 全部在位）。

### 2. 安装目录副本实跑（用 dist 解压后的副本另起 8766 端口）
`/api/version` = v1.1.8；sudoku.html 200(32,493B) / spider.html 200 / gallery_panel.js 200 / index.html 200。
逐页加载 index / sudoku / spider / mine / gomoku / view：底部图例文字均为
「明日香 × 绫波丽 · 🖼 壁纸图库」，点击均就地打开图库浮层并渲染 39 张缩略图。

### 3. 本地更新
安装目录已解压更新为 v1.1.8（sudoku.html / gallery_panel.js 在位）；运行中服务重启为 v1.1.8。

### 4. 真实用户更新场景（模拟旧版客户端，8767 端口报 v1.1.7）
- 角标显示 v1.1.7、`has-update` 高亮，title「发现新版 v1.1.8，点击更新」
- 点击弹窗：`show=true`，正文「当前版本 v1.1.7，发现新版本 v1.1.8。下载安装包覆盖安装即可（存档与图库保留）。」
- 更新说明区 932 字、可滚动（max-height 348px），含数独 / 图库扩展 / 蜘蛛纸牌 三节

### 5. GitHub Release
- Release **v1.1.8**「EVA 小游戏 v1.1.8 · 数独 + 图库扩展」，说明 967 字（来自 notes 文件）
- 资产 `EVA-MiniGames-Setup-v1.1.8.exe` 上传成功，远端大小 154,421,705 B 与本地一致
- 更新检测闭环：current=v1.1.8 == latest=v1.1.8 → `update=false`；url 指向 v1.1.8 资产

## 备注
- 本机 WDAC 策略仍拦截 exe 直接运行（安装目录用 zip 解压方式更新，效果等价）；
  其他玩家机器无此策略，安装包可正常双击安装
- 测试用的临时服务（8766/8767）与脚本已清理
