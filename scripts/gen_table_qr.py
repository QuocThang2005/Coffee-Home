#!/usr/bin/env python3
"""Tạo QR code cho từng bàn — chạy: python scripts/gen_table_qr.py"""

import json, os, sys

try:
    import qrcode
    from qrcode.image.styledpil import StyledPilImage
    from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
except ImportError:
    print("Chưa cài qrcode: pip install qrcode[pil]")
    sys.exit(1)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLES_PATH = os.path.join(ROOT, "data", "tables.json")
OUT_DIR = os.path.join(ROOT, "images", "qr-tables")

with open(TABLES_PATH, encoding="utf-8") as f:
    tables = json.load(f)["tables"]

os.makedirs(OUT_DIR, exist_ok=True)

# Site URL — chỉnh ở đây nếu deploy
SITE = os.environ.get("SITE_URL", "http://localhost:5174")

for t in tables:
    url = f"{SITE}/pages/menu.html?ban={t['id']}&t={t['token']}"
    qr = qrcode.QRCode(
        box_size=12,
        border=3,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),
    )
    name_tag = f"{t['id']}.png"
    path = os.path.join(OUT_DIR, name_tag)
    img.save(path)
    print(f"  {t['id']} -> {path}")

print(f"Done! {len(tables)} QR codes saved in {OUT_DIR}")
print(f"Scan QR to: menu.html?ban=T1&t=... to test.")
