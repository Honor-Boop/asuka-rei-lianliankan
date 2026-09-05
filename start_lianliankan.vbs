' EVA Lianliankan desktop launcher:
'   1) start local HTTP server (python) on 127.0.0.1:8765 if not running
'   2) open the game in an Edge/Chrome app window (fallback: default browser)
' ASCII-only on purpose (VBScript reads ANSI codepage).
Option Explicit

Dim fso, sh, http, up, i, edge, chrome, dir, py
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

up = ServerUp()
If Not up Then
  sh.CurrentDirectory = dir
  sh.Run "cmd /c cd /d """ & dir & """ && start /b python -m http.server 8765 --bind 127.0.0.1", 0, False
  For i = 1 To 12
    WScript.Sleep 500
    If ServerUp() Then Exit For
  Next
End If

' Edge app mode (window without browser chrome)
edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
If Not fso.FileExists(edge) Then edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chrome) Then chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

If fso.FileExists(edge) Then
  sh.Run """" & edge & """ --app=http://127.0.0.1:8765/index.html", 1, False
ElseIf fso.FileExists(chrome) Then
  sh.Run """" & chrome & """ --app=http://127.0.0.1:8765/index.html", 1, False
Else
  sh.Run "http://127.0.0.1:8765/index.html", 1, False
End If
