@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   AutoExam Grading System - Starting Services
echo ========================================================

:: Check if docker is responding
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [i] Docker daemon is not active. Starting Docker Desktop...
    if exist "C:\Users\%USERNAME%\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe" (
        start "" "C:\Users\%USERNAME%\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
    ) else if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    ) else (
        echo [!] Docker Desktop executable not found in default paths.
        echo     Please start Docker Desktop manually from the Start Menu.
    )

    echo [*] Waiting for Docker daemon to become ready...
    :wait_docker
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 (
        echo     ...still waiting for Docker Desktop to boot up...
        goto wait_docker
    )
    echo [✓] Docker daemon is now online!
)

echo [*] Launching all project containers via Docker Compose...
docker compose up -d

echo ========================================================
echo   Project Status:
echo ========================================================
docker compose ps

echo.
echo ========================================================
echo   Application URLs:
echo   - Frontend Portal:    http://localhost:3000
echo   - Reverse Proxy:      http://localhost (Port 80)
echo   - Backend API Docs:   http://localhost:8000/docs
echo   - YouPI Payment API:  http://localhost:6100
echo   - YouPI Checkout:     http://localhost:7000
echo.
echo   For Remote Mobile / Public HTTPS Testing:
echo   Run "start-tunnel.bat" to launch the Cloudflare tunnel
echo ========================================================
