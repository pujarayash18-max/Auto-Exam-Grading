@echo off
title AutoExam - Cloudflare Public HTTPS Tunnel
echo ========================================================
echo   Starting Cloudflare Public HTTPS Tunnel for AutoExam
echo ========================================================
echo [*] Forwarding to local platform (http://localhost:80)...
echo [*] Establishing encrypted HTTPS tunnel...
echo.
echo Look for your temporary public URL below:
echo (e.g. https://xxxx-xxxx-xxxx.trycloudflare.com)
echo ========================================================
echo.
"%~dp0tools\cloudflared.exe" tunnel --url http://localhost:80
pause

