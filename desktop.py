# -*- coding: utf-8 -*-
"""EVA 小游戏 · 桌面独立程序入口

- 若 8765 端口空闲：本程序内嵌启动本地服务（自带壁纸 API），关闭窗口时一并退出
- 若已有服务（旧版桌面程序/手动 serve）在跑：直接复用，关闭窗口不影响它
- 用 pywebview(WebView2) 打开独立应用窗口，无浏览器 UI
"""
import os
import socket
import sys
import threading

def app_base():
    """程序根目录：打包后 = exe 所在目录；开发时 = 项目目录。"""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


BASE = app_base()
if BASE not in sys.path:
    sys.path.insert(0, BASE)

PORT = 8765


def port_open(port):
    s = socket.socket()
    s.settimeout(0.4)
    try:
        s.connect(("127.0.0.1", port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def main():
    own_server = None
    if not port_open(PORT):
        import serve
        from pathlib import Path
        serve.ROOT = Path(BASE)         # 数据/资源以程序目录为根
        serve.MANAGED = True            # 托管模式：RESTART 不自杀宿主
        own_server = serve.start_server(PORT)
        # 等就绪
        for _ in range(20):
            if port_open(PORT):
                break
            import time
            time.sleep(0.2)

    import webview

    window = webview.create_window(
        "EVA 小游戏 · 明日香 × 绫波丽",
        "http://127.0.0.1:%d/index.html" % PORT,
        width=1560, height=940,
        min_size=(1180, 720),
        background_color="#1b1544",
    )
    webview.start()

    # 窗口关闭：仅退出自己内嵌的服务
    if own_server is not None:
        try:
            own_server.shutdown()
            own_server.server_close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
