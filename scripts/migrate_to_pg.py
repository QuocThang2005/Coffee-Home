"""Migrate SQLite data → PostgreSQL.

Usage:
  docker compose up -d
  set DATABASE_URL=postgresql://coffee:coffee123@127.0.0.1:5433/coffee_home
  python scripts/migrate_to_pg.py
"""
import json
import os
import sqlite3
from pathlib import Path

import psycopg2
import psycopg2.extras

# Thêm coffee_backend vào path để import db
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "coffee_backend"))

DB_URL = os.environ.get("DATABASE_URL", "")
SQLITE_PATH = Path(__file__).resolve().parents[1] / "coffee_backend" / "data" / "coffee.db"

if not DB_URL:
    print("ERROR: dat env DATABASE_URL truoc!");
    raise SystemExit(1)

if not SQLITE_PATH.exists():
    print(f"ERROR: khong tim thay SQLite DB tai {SQLITE_PATH}");
    raise SystemExit(1)

print(f"SQLite: {SQLITE_PATH}")
print(f"PostgreSQL: {DB_URL}")

# Step 1: Tạo schema trong PostgreSQL
print("\n--- Tao schema ---")
os.environ["DATABASE_URL"] = DB_URL  # cho db.py biết
from app.db import SCHEMA_POSTGRESQL
pg = psycopg2.connect(DB_URL)
pg.autocommit = True
cur = pg.cursor()
cur.execute(SCHEMA_POSTGRESQL)
# Thêm migration columns
for table in ("applications", "orders", "bookings"):
    try:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS reply TEXT DEFAULT ''")
    except Exception:
        pass
try:
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id TEXT DEFAULT ''")
    cur.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT ''")
except Exception:
    pass
cur.close()
pg.close()
print("Schema OK")

# Step 2: Migrate data
print("\n--- Migrate data ---")
sqlite = sqlite3.connect(SQLITE_PATH)
sqlite.row_factory = sqlite3.Row

pg = psycopg2.connect(DB_URL)
pg.autocommit = False

TABLES = ["users", "tokens", "orders", "bookings", "applications", "feedbacks"]

total_rows = 0
for table in TABLES:
    rows = sqlite.execute(f"SELECT * FROM {table}").fetchall()
    if not rows:
        print(f"  {table}: 0 dong — bo qua")
        continue

    cols = list(rows[0].keys())
    placeholders = ", ".join(["%s"] * len(cols))
    col_names = ", ".join(cols)
    sql = f"INSERT INTO {table} ({col_names}) VALUES ({placeholders})"

    cur = pg.cursor()
    for row in rows:
        values = [json.dumps(v) if isinstance(v, (dict, list)) else v for v in row]
        cur.execute(sql, values)
    cur.close()
    total_rows += len(rows)
    print(f"  {table}: {len(rows)} dong")

pg.commit()
print(f"\nDone! Tong cong {total_rows} dong da migrate.")
sqlite.close()
pg.close()
