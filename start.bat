@echo off
title Punch Prime
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed. Opening the download page...
  echo  Install the "LTS" version, then double-click start.bat again.
  start https://nodejs.org/en/download
  pause
  exit /b
)
if not exist node_modules (
  echo Installing for the first time - this takes 1-2 minutes...
  call npm install
)
echo.
echo  Starting Punch Prime... your browser will open in a few seconds.
echo  Keep this window open while you use the app. Close it to stop.
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"
call npm run dev
pause
