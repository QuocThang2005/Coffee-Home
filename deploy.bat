@echo off
REM ============================================
REM  Coffee Home — Deploy Production (Docker)
REM ============================================
setlocal
set COMPOSE=docker-compose -f docker-compose.prod.yml

echo [1/5] Checking .env ...
if not exist .env (
    echo [ERROR] .env not found. Copy .env.example to .env and fill in values.
    exit /b 1
)

echo [2/5] Building backend image ...
%COMPOSE% build backend
if errorlevel 1 exit /b 1

echo [3/5] Running database migrations ...
%COMPOSE% run --rm backend python -c "from app.db import init_db; init_db()"
if errorlevel 1 exit /b 1

echo [4/5] Starting all services ...
%COMPOSE% up -d
if errorlevel 1 exit /b 1

echo [5/5] Health check ...
timeout /t 5 /nobreak >nul
curl -sf http://localhost:8010/api/health >nul 2>&1
if errorlevel 1 (
    echo [WARN] Backend not ready yet, waiting more ...
    timeout /t 10 /nobreak >nul
)

echo.
echo ============================================
echo  Coffee Home deployed successfully!
echo  Backend:   http://localhost:8010
echo  Frontend:  http://localhost (via nginx)
echo  API docs:  http://localhost:8010/docs
echo ============================================
echo.
echo To view logs:  %COMPOSE% logs -f
echo To stop:       %COMPOSE% down

endlocal
