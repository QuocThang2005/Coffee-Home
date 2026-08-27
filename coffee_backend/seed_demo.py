# Nạp dữ liệu mẫu vào SQLite để dashboard admin có số liệu hiển thị
# Chạy: .venv\Scripts\python.exe seed_demo.py          -> chỉ nạp nếu DB trống
#       .venv\Scripts\python.exe seed_demo.py --force  -> xoá dữ liệu cũ, nạp lại
import sqlite3
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from app.db import get_conn, init_db
from app.menu import load_menu
from app.security import hash_password

FORCE = "--force" in sys.argv


def item_from(product, qty=1, unit_price=None):
    price = unit_price if unit_price is not None else round(
        product["basePrice"] * (1 - product.get("discountPct", 0) / 100))
    return {
        "id": str(product["id"]), "slug": product["slug"], "name": product["name"],
        "qty": qty, "unitPrice": price, "size": "M", "ice": "", "sugar": "",
        "toppings": []
    }


def main():
    init_db()
    with get_conn() as conn:
        have = conn.execute("SELECT COUNT(*) c FROM orders").fetchone()["c"]
        have_apps = conn.execute("SELECT COUNT(*) c FROM applications").fetchone()["c"]
        have_fbs = conn.execute("SELECT COUNT(*) c FROM feedbacks").fetchone()["c"]
        if have and have_apps and have_fbs and not FORCE:
            print(f"DB da co {have} don — bo qua (dung --force de nap lai)")
            return
        if FORCE:
            conn.execute("DELETE FROM bookings")
            conn.execute("DELETE FROM orders")
            conn.execute("DELETE FROM tokens")
            conn.execute("DELETE FROM users WHERE is_admin = 0")
            conn.execute("DELETE FROM applications")
            conn.execute("DELETE FROM feedbacks")

        seed_orders = FORCE or not have
        if not seed_orders:
            print(f"DB da co {have} don — giu nguyen, chi kiem tra ho so ung tuyen")

        if seed_orders:
            menu = load_menu()
            by_slug = {p["slug"]: p for p in menu["products"]}
            branches = menu["branches"]

            # ---- khach hang mau (mat khau: 12345678) ----
            customers = [
                ("Nguyen Thi Lan", "lan.nguyen@gmail.com", "0903111222", 1240),
                ("Tran Huu Dat", "dat.tran@yahoo.com", "0905333444", 320),
                ("Le Thuy Trang", "trang.le@outlook.com", "0938555666", 2650),
                ("Pham Gia Bao", "bao.pham@gmail.com", "0972777888", 85),
                ("Do Kim Ngan", "ngan.do@gmail.com", "0918999000", 980),
            ]
            uids = {}
            for name, email, phone, pts in customers:
                salt, digest = hash_password("12345678")
                cur = conn.execute(
                    """INSERT INTO users (name, email, phone, salt, pass_hash, points)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (name, email, phone, salt, digest, pts),
                )
                uids[email] = cur.lastrowid

            # ---- don hang phan tan 7 ngay ----
            plans = [
                # (ngay_truoc_do, gio, method, branch_idx, slug, qty, total_goc, status, ten_khach, email)
                (6, "08:15", "pickup",    0, "phin-sua-da",      2, None,   "done",      "Nguyen Thi Lan", "lan.nguyen@gmail.com"),
                (6, "09:40", "delivery",  1, "tra-dao",   1, 78000,  "done",      "Tran Huu Dat",   "dat.tran@yahoo.com"),
                (5, "07:50", "pickup",    2, "ca-phe-trung",     1, None,   "done",      "Le Thuy Trang",  "trang.le@outlook.com"),
                (5, "10:22", "pickup",    0, "ba-xiu",          3, None,   "done",      "Pham Gia Bao",   "bao.pham@gmail.com"),
                (4, "08:05", "delivery",  1, "tra-sua-tran-chau", 2, 96000, "done",      "Do Kim Ngan",    "ngan.do@gmail.com"),
                (4, "14:30", "pickup",    2, "cold-brew-tonic",  1, None,   "cancel",    "Khach le",       ""),
                (3, "07:58", "pickup",    0, "phin-sua-da",      1, None,   "done",      "Nguyen Thi Lan", "lan.nguyen@gmail.com"),
                (3, "11:12", "delivery",  0, "banh-mi-que",      2, 66000,  "done",      "Tran Huu Dat",   "dat.tran@yahoo.com"),
                (3, "16:45", "pickup",    1, "espresso",         2, None,   "done",      "Le Thuy Trang",  "trang.le@outlook.com"),
                (2, "08:31", "delivery",  2, "tra-vai",          3, 135000, "shipping",  "Do Kim Ngan",    "ngan.do@gmail.com"),
                (2, "09:18", "pickup",    0, "ca-phe-muoi",  1, None,   "ready",     "Pham Gia Bao",   "bao.pham@gmail.com"),
                (1, "08:12", "delivery",  1, "phin-sua-da",      2, None,   "done",      "Nguyen Thi Lan", "lan.nguyen@gmail.com"),
                (1, "10:04", "pickup",    2, "tra-sua-matcha",      1, None,   "preparing", "Khach le",       ""),
                (1, "13:27", "pickup",    0, "tra-dao",   2, None,   "done",      "Do Kim Ngan",    "ngan.do@gmail.com"),
                (0, "08:25", "pickup",    0, "ba-xiu",          1, None,   "done",      "Tran Huu Dat",   "dat.tran@yahoo.com"),
                (0, "09:02", "delivery",  1, "tra-sua-tran-chau", 1, None,  "new",       "Le Thuy Trang",  "trang.le@outlook.com"),
                (0, "09:47", "pickup",    2, "espresso",         1, None,   "preparing", "Pham Gia Bao",   "bao.pham@gmail.com"),
            ]
            seq = 9000
            for days_ago, hhmm, method, bidx, slug, qty, forced_total, status, cname, cemail in plans:
                p = by_slug.get(slug)
                if not p:
                    continue
                dt = datetime.now() - timedelta(days=days_ago)
                dt = datetime.combine(dt.date(), datetime.strptime(hhmm, "%H:%M").time())
                items = [item_from(p, qty)]
                subtotal = sum(i["unitPrice"] * i["qty"] for i in items)
                total = forced_total if forced_total is not None else subtotal
                ship = 15000 if method == "delivery" else 0
                uid = uids.get(cemail)
                code = f"CH-{seq}"
                seq += 37
                conn.execute(
                    """INSERT INTO orders (code, user_id, customer_name, phone, method, branch_id,
                       branch_name, address, items_json, subtotal, ship_fee, discount, total,
                       voucher_code, note, status, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (code, uid, cname, "", method, str(branches[bidx]["id"]),
                     branches[bidx]["name"], "25 Hoa Sua, Phu Nhuan" if method == "delivery" else "",
                     __import__("json").dumps(items, ensure_ascii=False),
                     subtotal, ship, 0, total + ship, "", "",
                     status, dt.strftime("%Y-%m-%d %H:%M:%S")),
                )

            # ---- dat ban ----
            today = date.today()
            bookings = [
                ("BK-A101", 0, today,                     "18:00", 4, "Nhom sinh nhat Mai", "0901111222", "Sinh nhat - can nen", "confirmed"),
                ("BK-A102", 1, today,                     "10:00", 2, "Ong Bay",            "0903333444", "",                      "confirmed"),
                ("BK-A103", 2, today + timedelta(days=1), "19:30", 6, "Cong ty ABC team building", "0905555666", "Can 2 ban ghep", "confirmed"),
                ("BK-A104", 0, today - timedelta(days=1), "15:00", 2, "Hoang Nam",          "0907777888", "",                      "cancel"),
            ]
            for code, bidx, d, t, guests, name, phone, note, st in bookings:
                conn.execute(
                    """INSERT INTO bookings (code, branch_id, branch_name, date, time, guests,
                       name, phone, email, note, status, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (code, str(branches[bidx]["id"]), branches[bidx]["name"],
                     d.isoformat(), t, guests, name, phone, "", note, st,
                     datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                )

            # vi du phan hoi cua quan cho 1 don + 1 dat ban
            conn.execute(
                "UPDATE bookings SET reply = ? WHERE code = 'BK-A101'",
                ("Da goi xac nhan — khach den som 15 phut, chuan bi ban ghep truoc.",),
            )
            conn.execute(
                "UPDATE orders SET reply = ? WHERE code = 'CH-9000'",
                ("Khach quen — lan sau tang 1 banh mi que.",),
            )

        # ---- ho so ung tuyen mau (nap rieng, khong anh huong don hang) ----
        apps_inserted = 0
        if FORCE or not have_apps:
            apps = [
                ("Pham Minh Quan", "0912345678", "quan.pham@gmail.com", "Barista",
                 "Da lam 1 nam barista o quan chain, biet latte art co ban.", "new", ""),
                ("Vo Thi Hong Nhung", "0938765432", "", "Nhan vien thu ngan / phuc vu",
                 "Sinh vien nam 3, muon lam ca chieu cuoi tuan.", "new",
                 "Chao Nhung, quan se goi ban vao thu 1 tuan sau de hen thu viec nhe."),
                ("Le Van Cuong", "0965111222", "cuong.levan@gmail.com", "Shifter (quan ca)",
                 "2 nam quan ly quan F&B, thuc thu ca truoc va ton kho.", "approved",
                 "Ho so tot! Hen phong van 9h sang thu 4 tai co nguyen Van Troi."),
            ]
            for name, phone, email, pos, note, st, reply in apps:
                conn.execute(
                    """INSERT INTO applications (name, phone, email, position, note, status, reply)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (name, phone, email, pos, note, st, reply),
                )
            apps_inserted = len(apps)

        # ---- phan hoi khach hang mau (nap rieng, khong anh huong don hang) ----
        fbs_inserted = 0
        if FORCE or not have_fbs:
            fbs = [
                ("Nguyen Hoai Thuong", "0938111222", 5,
                 "Ca phe ngon, nhan vien de thuong. Khong gian quat mat, lam viec o day ca buoi chieu rat vui!",
                 "new"),
                ("Tran Duc Manh", "manh.tran@gmail.com", 4,
                 "Do uong ok nhung cuoi tuan dong qua, phai doi 15 phut. Neu co them nhan vien ca chieu T7 CN thi tot.",
                 "read"),
                ("Khach vo danh", "", 1,
                 "Qua tuyen truyen sai su that, khong dung quang cao.",
                 "hidden"),
            ]
            for name, contact, rating, msg, st in fbs:
                conn.execute(
                    """INSERT INTO feedbacks (name, contact, rating, message, status)
                       VALUES (?, ?, ?, ?, ?)""",
                    (name, contact, rating, msg, st),
                )
            fbs_inserted = len(fbs)

        conn.commit()
        print("Seed xong:",
              f"{apps_inserted} ho so ung tuyen moi" if apps_inserted else f"giu {have_apps} ho so ung tuyen cu",
              "|",
              f"{fbs_inserted} phan hoi moi" if fbs_inserted else f"giu {have_fbs} phan hoi cu")


if __name__ == "__main__":
    main()
