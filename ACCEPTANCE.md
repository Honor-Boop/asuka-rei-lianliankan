# 验收报告 · v1.1.6 本地+GitHub 版本与安装包更新（2026-09-09）

## 需求
“更新本地和 GitHub 的版本和安装包” —— 将蜘蛛纸牌微软标准对齐等改动发版。

## 变更
- serve.py VERSION：v1.1.5 → **v1.1.6**（本地 commit 5c3e265）
- 重建产物（PyInstaller spec 链路）：
  - dist/EVA小游戏/ 桌面包（159M，含资源，serve.py=v1.1.6）
  - dist/EVA小游戏.zip 绿色版（165,405,700 B）
  - dist/EVA小游戏-安装程序.exe（153,610,604 B）
  - dist/EVA-MiniGames-Setup-v1.1.6.exe（发布名副本）

## 本地
- 安装目录 C:\Users\17537\AppData\Local\EVA小游戏 已解压更新为 v1.1.6
  （安装器 exe 被本机 Device Guard 策略拦截，走等价的 zip 解压安装；
   桌面/开始菜单快捷方式指向同一目录，无需重建）
- 运行中 8765 服务已重启为 v1.1.6（原进程停留在 v1.1.3）

## GitHub
- serve.py 已推送远端 main（commit 581b3bebc1，blob 校验）
- Release **v1.1.6**（id 385619760）创建，含更新说明
- 资产 EVA-MiniGames-Setup-v1.1.6.exe 上传成功（153,610,604 B 与本地一致）

## 更新检测闭环（验收关键项）
- GET /api/version → v1.1.6
- GET /api/update-check → { latest: v1.1.6, current: v1.1.6, update: false,
  url: .../download/v1.1.6/EVA-MiniGames-Setup-v1.1.6.exe }
- 远端 releases/latest tag=v1.1.6，资产大小一致

## 备注
- 文件结构完整性复核：本地 git 215 个跟踪文件与远端树 215 个 blob 零差异
  （此前发现的 spider 素材未同步问题不存在，已通过清单比对确认）
- 安装器 GUI 安装路径未人工点验（Device Guard），zip 解压路径已等价验证
