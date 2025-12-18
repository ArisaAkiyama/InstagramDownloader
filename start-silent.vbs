Set WshShell = CreateObject("WScript.Shell") 
WshShell.CurrentDirectory = "D:\Project\ProjectDownloaderIG\" 
WshShell.Run "cmd /c cd /d D:\Project\ProjectDownloaderIG\ && node server.js", 0, False 
Set WshShell = Nothing 
