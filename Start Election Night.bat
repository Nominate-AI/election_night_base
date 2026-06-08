@echo off
title GA Election Night Tracker
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  Node.js is not installed. Install from https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo.
echo  GA Election Night Tracker
echo  =======================
echo.

echo  Stopping any old copy still on port 8080...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul
timeout /t 2 /nobreak >nul

echo  Starting fresh server — keep this window OPEN.
echo  Browser tabs will open in a few seconds.
echo  To quit: close this window.
echo.

start "" cmd /c "ping 127.0.0.1 -n 5 >nul && start http://localhost:8080/"
start "" cmd /c "ping 127.0.0.1 -n 10 >nul && if exist \"%~dp0GA Live Tracker (Hancock-Lowndes).xlsx\" start \"\" \"%~dp0GA Live Tracker (Hancock-Lowndes).xlsx\""

node server.js
echo.
echo  Server stopped.
pause
