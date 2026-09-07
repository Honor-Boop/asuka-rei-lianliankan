' EVA Lianliankan refresh launcher:
'   1) kill the local server on 127.0.0.1:8765 (if any)
'   2) start the server again (serves the LATEST files from disk)
'   3) open the game in an Edge/Chrome app window
Option Explicit

Dim fso, sh, dir, i, edge, chrome, up
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

' --- 1) kill old server (port 8765) ---
sh.Run "powershell -NoProfile -Command ""$c = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue; if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }""", 0, True
WScript.Sleep 700

' --- 2) start server ---
sh.CurrentDirectory = dir
sh.Run "cmd /c cd /d """ & dir & """ && start /b python serve.py", 0, False

' --- wait until up ---
up = False
For i = 1 To 14
  WScript.Sleep 500
  On Error Resume Next
  Dim x
  Set x = CreateObject("MSXML2.XMLHTTP")
  x.open "GET", "http://127.0.0.1:8765/index.html", False
  x.send
  If Err.Number = 0 Then up = True
  Err.Clear
  On Error Goto 0
  If up Then Exit For
Next

' --- 3) open game ---
edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
If Not fso.FileExists(edge) Then edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chrome) Then chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

If fso.FileExists(edge) Then
  sh.Run """" & edge & """ --app=http://127.0.0.1:8765/spider.html", 1, False
ElseIf fso.FileExists(chrome) Then
  sh.Run """" & chrome & """ --app=http://127.0.0.1:8765/spider.html", 1, False
Else
  sh.Run "http://127.0.0.1:8765/spider.html", 1, False
End If
