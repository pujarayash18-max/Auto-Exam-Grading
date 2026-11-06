@echo off
title AutoExam - Cloudflare Public HTTPS Tunnel
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\start-tunnel.ps1"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [*] Falling back to standard tunnel launcher...
    "%~dp0tools\cloudflared.exe" tunnel --url http://localhost:80 --no-prechecks
)
pause
