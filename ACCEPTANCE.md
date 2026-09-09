# 验收报告 · 更新弹窗展示更新说明 + v1.1.7 发布（2026-09-09）

## 需求
其他玩家点击更新时，弹窗需说明本次更新内容（此前只有固定提示语）。

## 代码改动（commit cea9974，已推远端 main 70950a45a8）
- serve.py check_update：返回 GitHub Release body 前 3000 字符作为 notes；
  显式 utf-8 解码，修复 Windows locale 下中文乱码（json.load → read+decode+json.loads）
- deco.js：「发现新版本」弹窗新增可滚动说明区 #updNotes（44vh，pre-wrap），
  markdown 轻清洗（去 # / * _ `）后 textContent 安全展示；无说明时隐藏该区
- serve.py VERSION → v1.1.7

## 端到端验证（浏览器真实触发 update=true 状态）
- 加载页 2.5s 自动检测 → 版本角标 has-update、显示 v1.1.7
- 点击角标 → 弹窗 show=true，含「本次更新内容」区，说明文本正确渲染
- 下载按钮已绑定（window.open 资产 URL），「暂不更新」可关闭

## v1.1.7 产物与发布
- dist/EVA小游戏-安装程序.exe / EVA-MiniGames-Setup-v1.1.7.exe（153,611,824 B）
- 本地安装目录 AppData\Local\EVA小游戏 已解压更新（VERSION=v1.1.7、deco.js 含 updNotes）
- GitHub Release v1.1.7（id 385623466）资产上传成功，大小与本地一致
- 更新检测闭环：current=v1.1.7 == latest=v1.1.7 → update=false；
  老玩家（≤v1.1.6）检测将 update=true，弹窗展示 v1.1.7 更新说明后跳转下载

## 备注
- 本机安装器 exe 仍受 Device Guard 策略拦截，沿用 zip 解压等价安装
