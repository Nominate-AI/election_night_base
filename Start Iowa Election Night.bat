@echo off
title Iowa Election Night Tracker
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Node.js is not installed. Install it from https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo.
echo  Iowa Election Night Tracker
echo  ===========================
echo.

echo  Stopping any old copy still on port 8090...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8090 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul
timeout /t 2 /nobreak >nul

echo  Starting the server - keep this window OPEN.
echo  Your browser will open in a few seconds.
echo  To quit: close this window.
echo.

start "" cmd /c "ping 127.0.0.1 -n 5 >nul && start http://localhost:8090/"

node ia-server.js
echo.
echo  Server stopped.
pause
