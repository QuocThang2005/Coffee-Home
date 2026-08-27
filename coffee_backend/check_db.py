# -*- coding: utf-8 -*-
"""Kiem tra suc khoe DB: chay `python check_db.py`"""
import sys
import time

sys.path.insert(0, ".")
from app.db import get_conn  # noqa: E402
from app.security import verify_password  # noqa: E402


def main() -> int:
    for i in range(10):
        with get_conn() as c:
            result = c.execute("PRAGMA integrity_check").fetchone()[0]
            if result != "ok":
                print(f"Lan {i}: HONG - {result}")
                return 1
        time.sleep(0.1)
    print("integrity_check x10: OK")

    with get_conn() as c:
        row = c.execute(
            "SELECT email, salt, pass_hash FROM users WHERE is_admin = 1 LIMIT 1"
        ).fetchone()
    if row is None:
        print("KHONG co tai khoan admin!")
        return 1
    ok = verify_password("admin123", row["salt"], row["pass_hash"])
    print(f"admin {row['email']}: mat khau {'OK' if ok else 'SAI!'}")

    with get_conn() as c:
        orders = c.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
        bookings = c.execute("SELECT COUNT(*) FROM bookings").fetchone()[0]
        customers = c.execute(
            "SELECT COUNT(*) FROM users WHERE is_admin = 0"
        ).fetchone()[0]
    print(f"don hang: {orders} | dat ban: {bookings} | khach hang: {customers}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
