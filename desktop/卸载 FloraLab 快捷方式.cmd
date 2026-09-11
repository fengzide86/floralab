@echo off
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$desktop=[Environment]::GetFolderPath('Desktop'); $start=[Environment]::GetFolderPath('Programs'); Remove-Item -LiteralPath (Join-Path $desktop 'FloraLab Studio.lnk') -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath (Join-Path $start 'FloraLab Studio.lnk') -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath (Join-Path $env:LOCALAPPDATA 'FloraLab') -Recurse -Force -ErrorAction SilentlyContinue"
echo FloraLab 快捷方式已移除。
pause