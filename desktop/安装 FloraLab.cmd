@echo off
chcp 65001 >nul
set "APPDIR=%LOCALAPPDATA%\FloraLab"
if not exist "%APPDIR%" mkdir "%APPDIR%"
copy /Y "%~dp0FloraLab.ico" "%APPDIR%\FloraLab.ico" >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell; $desktop=[Environment]::GetFolderPath('Desktop'); $start=[Environment]::GetFolderPath('Programs'); foreach($p in @((Join-Path $desktop 'FloraLab Studio.lnk'),(Join-Path $start 'FloraLab Studio.lnk'))){$s=$w.CreateShortcut($p); $s.TargetPath=$env:WINDIR+'\explorer.exe'; $s.Arguments='https://fengzide86.github.io/floralab/'; $s.IconLocation='%LOCALAPPDATA%\FloraLab\FloraLab.ico,0'; $s.WorkingDirectory='%LOCALAPPDATA%\FloraLab'; $s.Description='FloraLab Studio'; $s.Save()}"
echo.
echo FloraLab 已添加到桌面和开始菜单。
echo 以后双击 FloraLab Studio 即可打开。
echo.
pause