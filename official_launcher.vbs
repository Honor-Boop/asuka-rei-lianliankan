' EVA MiniGames OFFICIAL launcher (installed copy).
'   Uses pywebview (WebView2 runtime, same renderer as the official exe):
'   a real standalone app window - NO Edge/Chrome browser, no browser UI.
'   1) if 127.0.0.1:8765 is not running, desktop.py starts the bundled server
'      from THIS folder (serve.py here); otherwise it reuses the running one
'   2) opens the game in its own window via pythonw desktop.py
' NOTE: exe entry is blocked on some machines by App Control policy; VBS is not.
Option Explicit

Dim fso, sh, http, dir, py, pyw
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

Function ServerUp()
  On Error Resume Next
  Err.Clear
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.open "GET", "http://127.0.0.1:8765/index.html", False
  http.send
  ServerUp = (Err.Number = 0)
  On Error Goto 0
End Function

' launch the game window (desktop.py handles server start/reuse itself)
sh.CurrentDirectory = dir
sh.Run "cmd /c cd /d """ & dir & """ && start """" pythonw desktop.py", 0, False
