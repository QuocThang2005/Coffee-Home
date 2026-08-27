@echo off
REM ============================================
REM  Coffee Home — SSL Setup (Let's Encrypt)
REM  Run once before first deploy with HTTPS
REM ============================================
setlocal
set COMPOSE=docker-compose -f docker-compose.prod.yml

if "%DOMAIN%"=="" set DOMAIN=coffeehome.vn
if "%EMAIL%"=="" (
    echo [ERROR] Set EMAIL env var: set EMAIL=your@email.com
    exit /b 1
)

echo [1/3] Starting nginx (port 80) for domain verification ...
%COMPOSE% up -d nginx

echo [2/3] Requesting SSL certificate for %DOMAIN% ...
%COMPOSE% run --rm certbot certonly --webroot ^
    --webroot-path=/var/www/certbot ^
    -d %DOMAIN% -d www.%DOMAIN% ^
    --email %EMAIL% ^
    --agree-tos --no-eff-email --force-renewal

echo [3/3] Restarting nginx with SSL ...
%COMPOSE% restart nginx

echo.
echo SSL certificate installed for %DOMAIN%
echo Site should be accessible at https://%DOMAIN%

endlocal
