@echo off
title MAHI POS Printer Bridge
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed on this PC.
  echo Install Node.js LTS, then run this file again.
  echo.
  pause
  exit /b 1
)
echo Starting MAHI POS Printer Bridge...
node server.js
pause
