# 验收报告 · v1.4.2 发版（扫雷界面半透明 + 方块 EVA 元素）（2026-09-17）

## 需求
用户选定待办项「扫雷玻璃面板 + 方块 EVA 元素（92a2cf4）未打包 → 是否发 v1.4.2」并下达「更新」。

## 交付
### 1. 版本与产物
- `serve.py` VERSION → **v1.4.2**
- 重新打包：`dist/EVA-MiniGames-Setup-v1.4.2.exe`（154,531,048 B）、`dist/EVA小游戏.zip`、绿色版目录
- 旧包清理：删除 v1.4.1，dist 仅保留 v1.4.2
- 打包脚本自动同步本机安装目录（v1.4.2）并重建桌面/开始菜单快捷方式

### 2. 包内校验（zip 内实测）
- serve.py = v1.4.2
- 扫雷：含玻璃面板（`.glass` + `backdrop-filter`）✓、含方块 EVA 伪元素（NERV 警示纹 + 力场六边形）✓、36×36 难度 ✓
- 三消：角色头像宝石（`GEM_IMGS`）✓、宝石图 6 张在包内 ✓、测试文件未泄漏 ✓

### 3. GitHub Release（更新公告）
- Release **v1.4.2**「EVA 小游戏 v1.4.2 · 扫雷界面半透明 + 方块 EVA 元素」
- 公告 602 字，含玻璃面板 / 盖牌 NERV 条纹 / 六边形力场 / 翻开格纹理说明，并汇总此前版本特性
- 资产 `EVA-MiniGames-Setup-v1.4.2.exe` 上传成功，远端 154,531,048 B 与本地一致

## 验证证据
- 更新检测：`ok=true current=v1.4.2 latest=v1.4.2 update=false`，公告含「半透明」说明
   （即旧版本客户端会正确看到升级提示）
- 远端 releases/latest：tag v1.4.2，资产大小一致
- 本机安装目录：serve.py = v1.4.2，mine.html 含玻璃面板与方块 EVA 样式
- 代码推送 main（commit f057caa0ed）

## 备注
- 本机 WDAC 仍拦截无签名 exe，本机入口为桌面 vbs → pywebview；安装包供其他电脑使用
- GitHub 旧 Release（≤ v1.3.0 及 v1.4.0/1）仍保留，未做删除
