# -*- coding: utf-8 -*-
"""EVA 连连看 · 安装程序

将内嵌的绿色版压缩包解压到用户选择目录，并创建桌面/开始菜单快捷方式。
支持命令行静默安装（供自动测试）：installer.exe --silent --target D:\\some\\dir
"""
import os
import shutil
import subprocess
import sys
import threading
import zipfile
import tkinter as tk
from tkinter import messagebox, ttk

APP_NAME = "EVA连连看"
BUNDLE = "EVA连连看.zip"
EXE_REL = os.path.join(APP_NAME, "EVA连连看.exe")


def resource_path(name):
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, name)


def default_target():
    return os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), APP_NAME)


def install(target, progress=None):
    """解压安装；progress(text) 可选回调。返回安装目录。"""
    os.makedirs(target, exist_ok=True)
    bundle = resource_path(BUNDLE)
    with zipfile.ZipFile(bundle) as z:
        names = z.namelist()
        for i, n in enumerate(names):
            z.extract(n, target)
            if progress and i % 200 == 0:
                progress("解压中… %d / %d" % (i, len(names)))
    exe = os.path.join(target, EXE_REL)
    if not os.path.isfile(exe):
        raise RuntimeError("安装文件缺失：" + exe)
    return exe


def make_shortcuts(exe):
    """桌面 + 开始菜单快捷方式（PowerShell WScript.Shell）。"""
    ps = (
        "$ws = New-Object -ComObject WScript.Shell;"
        "$desktop = [Environment]::GetFolderPath('Desktop');"
        "$lnk = $ws.CreateShortcut($desktop + '\\" + APP_NAME + ".lnk');"
        "$lnk.TargetPath = '" + exe + "';"
        "$lnk.WorkingDirectory = '" + os.path.dirname(exe) + "';"
        "$lnk.IconLocation = '" + exe + "';"
        "$lnk.Description = 'EVA 连连看 · 明日香×绫波丽（连连看/五珠/扫雷/蜘蛛/观景）';"
        "$lnk.Save();"
        "$menu = $env:APPDATA + '\\Microsoft\\Windows\\Start Menu\\Programs';"
        "$lnk2 = $ws.CreateShortcut($menu + '\\" + APP_NAME + ".lnk');"
        "$lnk2.TargetPath = '" + exe + "';"
        "$lnk2.WorkingDirectory = '" + os.path.dirname(exe) + "';"
        "$lnk2.IconLocation = '" + exe + "';"
        "$lnk2.Save();"
    )
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=False)


def silent_install(target):
    exe = install(target)
    make_shortcuts(exe)
    print("INSTALL_OK:", exe)
    return 0


class App:
    def __init__(self, root):
        self.root = root
        root.title("EVA 连连看 · 安装程序")
        root.resizable(False, False)
        try:
            root.iconbitmap(resource_path("icon.ico"))
        except Exception:
            pass

        frm = ttk.Frame(root, padding=22)
        frm.grid()
        ttk.Label(frm, text="EVA 连连看 安装程序",
                  font=("Microsoft YaHei UI", 15, "bold")).grid(row=0, column=0, columnspan=3, pady=(0, 6))
        ttk.Label(frm, text="连连看 · 五珠对弈 · 使徒扫雷 · 蜘蛛纸牌 · 观景挂机",
                  foreground="#666").grid(row=1, column=0, columnspan=3, pady=(0, 16))

        ttk.Label(frm, text="安装到：").grid(row=2, column=0, sticky="w")
        self.path_var = tk.StringVar(value=default_target())
        ent = ttk.Entry(frm, textvariable=self.path_var, width=46)
        ent.grid(row=2, column=1, padx=6)
        ttk.Button(frm, text="浏览…", command=self.browse).grid(row=2, column=2)

        self.prog = ttk.Progressbar(frm, length=380, mode="indeterminate")
        self.prog.grid(row=3, column=0, columnspan=3, pady=(18, 6), sticky="we")
        self.status = tk.StringVar(value="就绪")
        ttk.Label(frm, textvariable=self.status, foreground="#888").grid(row=4, column=0, columnspan=3)

        btns = ttk.Frame(frm)
        btns.grid(row=5, column=0, columnspan=3, pady=(14, 0))
        self.install_btn = ttk.Button(btns, text="安 装", command=self.do_install)
        self.install_btn.pack(side="left", padx=6)
        ttk.Button(btns, text="退 出", command=root.destroy).pack(side="left", padx=6)

    def browse(self):
        from tkinter import filedialog
        d = filedialog.askdirectory(title="选择安装目录")
        if d:
            self.path_var.set(d)

    def do_install(self):
        target = os.path.abspath(self.path_var.get().strip())
        if not target:
            messagebox.showwarning("提示", "请填写安装目录")
            return
        self.install_btn.config(state="disabled")
        self.prog.start(12)
        self.status.set("正在解压安装…")

        def job():
            try:
                exe = install(target, lambda t: self.status.set(t))
                make_shortcuts(exe)
                self.root.after(0, self.done, exe)
            except Exception as e:
                self.root.after(0, self.fail, str(e))

        threading.Thread(target=job, daemon=True).start()

    def done(self, exe):
        self.prog.stop()
        self.status.set("安装完成 ✓")
        if messagebox.askyesno("完成", "安装完成！\n是否立即运行 EVA 连连看？"):
            try:
                os.startfile(exe)  # noqa
            except Exception:
                pass
        self.root.destroy()

    def fail(self, msg):
        self.prog.stop()
        self.install_btn.config(state="normal")
        self.status.set("安装失败")
        messagebox.showerror("错误", msg)


def main():
    argv = sys.argv[1:]
    if "--silent" in argv:
        target = None
        for i, a in enumerate(argv):
            if a.startswith("--target="):
                target = a.split("=", 1)[1]
        if not target and "--target" in argv:
            target = argv[argv.index("--target") + 1]
        target = target or default_target()
        sys.exit(silent_install(target))
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
