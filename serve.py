# -*- coding: utf-8 -*-
"""Local static server for the desktop launcher (port 8765).

Same as `python -m http.server` but sends no-cache headers, so browser
always picks up the latest manifest.js / images after gallery updates.
"""
import http.server

PORT = 8765


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):  # 后台静默运行，不刷日志
        pass


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
        httpd.serve_forever()
