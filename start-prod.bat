@echo off
REM ============================================
REM  Coffee Home — Production Start Script
REM  Chạy từ thư mục gốc project
REM ============================================
setlocal

set COFFEE_ENV=production
set COFFEE_DB=%~dp0coffee_backend\data\coffee.db

REM ---- Yêu cầu env vars ----
if "%ADMIN_PASSWORD%"=="" (
    echo [ERROR] Thieu env ADMIN_PASSWORD
    echo         set ADMIN_PASSWORD=MatKhauManh_123!
    exit /b 1
)

if "%ALLOWED_ORIGINS%"=="" (
    set ALLOWED_ORIGINS=http://localhost:8010
    echo [WARN] Su dung ALLOWED_ORIGINS mac dinh: %ALLOWED_ORIGINS%
)

set BACKEND_PORT=8010
set WORKERS=4

echo ============================================
echo  Coffee Home — Production Mode
echo  Port:      %BACKEND_PORT%
echo  Workers:   %WORKERS%
echo  DB:        %COFFEE_DB%
echo ============================================

REM ---- Kill old process on port ----
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%BACKEND_PORT%" ^| findstr "LISTENING" 2^>nul') do (
    echo Dung process %%a tren port %BACKEND_PORT%...
    taskkill /F /PID %%a 2>nul
)

REM ---- Start gunicorn ----
cd /d "%~dp0coffee_backend"
python -m gunicorn app.main:app ^
    --workers %WORKERS% ^
    --worker-class uvicorn.workers.UvicornWorker ^
    --bind 0.0.0.0:%BACKEND_PORT% ^
    --timeout 60 ^
    --access-logfile - ^
    --error-logfile - ^
    --log-level info

endlocal
