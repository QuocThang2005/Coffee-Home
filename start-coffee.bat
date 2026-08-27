@echo off
chcp 65001 >nul
title Coffee Home - Server (KHONG dong cua so nay!)
cd /d "%~dp0"
echo ============================================
echo   COFFEE HOME - Frontend + Backend
echo   Frontend : http://localhost:5174
echo   Admin    : http://localhost:5174/admin-login.html
echo   Backend  : http://localhost:8010/docs
echo   --- DE MO CUA SO NAY SUOT QUA TRINH DUNG WEB ---
echo ============================================
echo.
call npm run start
echo.
echo Server da dung. Neu loi 10048 (port ban): chay lenh
echo   Get-Process python,node ^| Stop-Process -Force
echo roi mo lai file nay.
pause
