@echo off
chcp 65001 >nul
title TamStore Promo Intelligence - Launcher
cd /d %~dp0

echo ============================================
echo   TamStore Promo Intelligence baslayir...
echo ============================================
echo.

py run_app.py

echo.
echo Proqram baglandi.
pause
