#!/bin/bash
# ============================================
# Coffee Home — Production Deployment Script
# Chạy trên Ubuntu/Debian server
# ============================================
set -e

APP_DIR="/var/www/coffee_home"
DB_DIR="/var/data"
SERVICE_NAME="coffee-home"

echo "=========================================="
echo " Coffee Home — Deployment"
echo "=========================================="

# ---- 1. Install dependencies ----
echo "[1/7] Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv nginx certbot python3-certbot-nginx

# ---- 2. Create directories ----
echo "[2/7] Setting up directories..."
mkdir -p "$APP_DIR" "$DB_DIR"
cp -r . "$APP_DIR/"

# ---- 3. Python venv + pip ----
echo "[3/7] Installing Python dependencies..."
cd "$APP_DIR/coffee_backend"
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -q

# ---- 4. Nginx ----
echo "[4/7] Configuring Nginx..."
cp "$APP_DIR/nginx-coffee.conf" /etc/nginx/sites-available/coffee-home.conf
ln -sf /etc/nginx/sites-available/coffee-home.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# ---- 5. SSL (Let's Encrypt) ----
echo "[5/7] Setting up SSL..."
echo "  Enter domain (e.g., coffeehome.vn):"
read -r DOMAIN
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" || true

# ---- 6. Systemd service ----
echo "[6/7] Creating systemd service..."
cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=Coffee Home API
After=network.target

[Service]
Type=exec
WorkingDirectory=$APP_DIR/coffee_backend
Environment=COFFEE_ENV=production
EnvironmentFile=$APP_DIR/.env
ExecStart=$APP_DIR/coffee_backend/venv/bin/gunicorn app.main:app \\
    --workers 4 \\
    --worker-class uvicorn.workers.UvicornWorker \\
    --bind 127.0.0.1:8010 \\
    --timeout 60 \\
    --access-logfile /var/log/$SERVICE_NAME-access.log \\
    --error-logfile /var/log/$SERVICE_NAME-error.log
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# ---- 7. Start ----
echo "[7/7] Starting services..."
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
systemctl restart nginx

echo ""
echo "=========================================="
echo " Deployment complete!"
echo ""
echo " Service: systemctl status $SERVICE_NAME"
echo " Logs:    journalctl -u $SERVICE_NAME -f"
echo " Nginx:   nginx -t"
echo "=========================================="
