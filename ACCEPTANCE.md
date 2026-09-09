# 验收报告 · 桌面图标换成纯凌波丽卡通（2026-09-09）

## 需求
图标换成凌波丽卡通图片（原图标为左凌波丽+右明日香双子拼图）。

## 变更
- 用户从 6 张纯凌波丽候选（images/rei_1/2/4/5/6/15 圆角方形 256）中选定 A（rei_1）
- assets/icon.ico 与 icon.png 已替换为纯凌波丽（多尺寸 16-256）
- 正式安装目录新增 icon_rei.ico（新路径强制 Explorer 刷新），同名 icon.ico 同步覆盖
- 桌面「EVA小游戏」「EVA小游戏 - 快捷方式」与开始菜单图标均指向 icon_rei.ico
- 候选文件留档 assets/icon_candidates/rei_icon_A~F.png

## 生效范围
- 本机桌面快捷方式图标立即生效（新路径无缓存问题，ie4uinit 已刷缓存）
- 项目 assets/icon.ico 为后续桌面 exe / 安装器打包源（spec icon 引用），
  下次重建安装包或发版时自动带上新图标；本轮未重发 Release
