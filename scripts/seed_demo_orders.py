# -*- coding: utf-8 -*-
"""Tạo đơn hàng DEMO trải đều các ngày gần nhất để dashboard có biểu đồ sống động.

Dùng:
  python scripts/seed_demo_orders.py            # tạo dữ liệu demo 7 ngày
  python scripts/seed_demo_orders.py --days 14  # tuỳ chỉnh số ngày
  python scripts/seed_demo_orders.py --clean    # XOÁ toàn bộ đơn demo
  python scripts/seed_demo_orders.py --force    # tạo thêm dù đã có demo

Đơn demo có note = 'demo' -> dễ nhận diện và xoá.
Giá tính đúng công thức: round(basePrice*(1-discountPct/100)) + extra size + topping.
"""
import argparse
import json
import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "coffee_backend"))
from app.db import get_conn, DB_PATH  # noqa: E402

MENU = json.loads((ROOT / "data" / "products.json").read_text("utf-8"))
SIZES = {s["id"]: s.get("extra", 0) for s in MENU.get("sizes", [])}
TOPPINGS = MENU.get("toppings", [])
BRANCHES = MENU.get("branches") or []
VOUCHERS = {v["code"].upper(): v for v in MENU.get("vouchers", [])}

NAMES = ["Nguyễn Văn An", "Trần Thị Bích", "Lê Hoàng Nam", "Phạm Thu Hà",
         "Hoàng Minh Tuấn", "Vũ Ngọc Lan", "Đặng Quốc Huy", "Bùi Mai Anh",
         "Phan Trung Dũng", "Ngô Thảo Vy", "Trịnh Bảo Long", "Lý Khánh Chi",
         "Châu Đình Khoa", "Tạ Thu Trang", "Đỗ Gia Hân", "Hà Văn Thịnh"]

rng = random.Random(20260825)


def prod_weight(p):
    tags = p.get("tags") or []
    if "bestseller" in tags:
        return 6
    if "sale" in tags:
        return 3
    return 1


PRODUCT_POOL = [p for p in MENU["products"]]
WEIGHTS = [prod_weight(p) for p in PRODUCT_POOL]


def unit_price(p, size, tops):
    u = round(p["basePrice"] * (1 - (p.get("discountPct") or 0) / 100)) + SIZES.get(size, 0)
    tprices = {t["id"]: t["price"] for t in TOPPINGS}
    u += sum(tprices.get(t["id"], 0) for t in tops)
    return u


def pick_items():
    n = rng.choices([1, 2, 3], weights=[55, 33, 12])[0]
    items, subtotal = [], 0.0
    for _ in range(n):
        p = rng.choices(PRODUCT_POOL, weights=WEIGHTS)[0]
        size = rng.choices(["S", "M", "L"], weights=[25, 55, 20])[0]
        tops = []
        if rng.random() < 0.45:
            k = rng.choices([1, 2], weights=[75, 25])[0]
            tops = rng.sample(TOPPINGS, k=k)
        unit = unit_price(p, size, tops)
        qty = rng.choices([1, 2], weights=[80, 20])[0]
        items.append({
            "id": p["id"], "slug": p["slug"], "name": p["name"], "qty": qty,
            "size": size,
            "toppings": [{"id": t["id"], "name": t["name"]} for t in tops],
            "unitPrice": unit,
        })
        subtotal += unit * qty
    return items, subtotal


def voucher_for(order_day_iso, subtotal):
    """Chọn voucher hợp lệ theo ngày đặt và giá trị đơn (nếu may mắn ~20%)."""
    if rng.random() > 0.20:
        return None, 0.0, False
    d = date.fromisoformat(order_day_iso)
    pool = []
    for code, v in VOUCHERS.items():
        try:
            until = datetime.strptime(v.get("until", ""), "%d/%m/%Y").date()
        except ValueError:
            continue
        if d <= until and subtotal >= (v.get("minOrder") or 0):
            pool.append((code, v))
    if not pool:
        return None, 0.0, False
    code, v = rng.choice(pool)
    discount, freeship = 0.0, False
    if v.get("type") == "percent":
        discount = round(subtotal * (v.get("value") or 0) / 100)
    elif v.get("type") == "fixed":
        discount = float(v.get("value") or 0)
    elif v.get("type") == "freeship":
        freeship = True
    return code, min(discount, subtotal), freeship


def hour_weight(h):
    # cao điểm sáng 7-9, trưa 11-13, chiều 15-17, tối 19-20
    peaks = {(7, 9): 3, (11, 13): 2.4, (15, 17): 1.8, (19, 20): 2.2}
    w = 0.6
    for (a, b), k in peaks.items():
        if a <= h <= b:
            w = k
    return w


def gen_order(d: date, is_today):
    day_iso = d.isoformat()
    items, subtotal = pick_items()
    code_v, discount, freeship = voucher_for(day_iso, subtotal)
    method = "delivery" if rng.random() < 0.32 else "pickup"
    ship_fee = 0.0
    if method == "delivery":
        ship_fee = 0 if (freeship or subtotal >= 99000) else 20000
    total = max(0.0, subtotal - discount) + ship_fee

    if is_today:
        now = datetime.now()
        hh = min(now.hour, rng.randint(7, max(8, now.hour)))
        status = ("done" if hh < now.hour - 1 else
                  rng.choice(["new", "preparing", "ready"]))
        if hh >= now.hour:
            hh = max(7, now.hour - 1)
    else:
        hh = rng.choices(range(6, 22), weights=[hour_weight(h) for h in range(6, 22)])[0]
        status = "done"
    mm = rng.randint(0, 59)
    created = f"{day_iso} {hh:02d}:{mm:02d}:{rng.randint(0, 59):02d}"
    if is_today:
        created = min(created, now.strftime("%Y-%m-%d %H:%M:%S"))

    br = rng.choice(BRANCHES) if BRANCHES else {}
    return {
        "customer_name": rng.choice(NAMES),
        "phone": "09" + "".join(str(rng.randint(0, 9)) for _ in range(8)),
        "method": method,
        "branch_id": br.get("id", ""),
        "branch_name": br.get("name", ""),
        "address": f"Số {rng.randint(1, 300)} đường {rng.randint(1, 99)}, TP.HCM" if method == "delivery" else "",
        "items_json": json.dumps(items, ensure_ascii=False),
        "subtotal": subtotal, "ship_fee": ship_fee, "discount": discount,
        "total": total, "voucher_code": code_v or "", "status": status,
        "created_at": created,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--clean", action="store_true", help="xoá toàn bộ đơn demo")
    ap.add_argument("--force", action="store_true", help="tạo thêm dù đã có đơn demo")
    args = ap.parse_args()

    with get_conn() as conn:
        existing = conn.execute(
            "SELECT COUNT(*) c FROM orders WHERE note = 'demo'").fetchone()["c"]

        if args.clean:
            conn.execute("DELETE FROM orders WHERE note = 'demo'")
            conn.commit()
            print(f"Da xoa {existing} don demo.")
            return

        if existing and not args.force:
            print(f"DB da co {existing} don demo. Dung --force de them hoac --clean de xoá.")
            return

        rows = []
        for i in range(args.days - 1, -1, -1):
            d = date.today() - timedelta(days=i)
            n = rng.randint(4, 9)
            if d.weekday() >= 5:
                n = int(n * 1.6)
            for _ in range(n):
                rows.append(gen_order(d, is_today=(i == 0)))

        codes = set()
        for r in rows:
            while True:
                code = f"CH-{rng.randint(100000, 999999)}"
                if code not in codes and not conn.execute(
                        "SELECT 1 FROM orders WHERE code=?", (code,)).fetchone():
                    codes.add(code)
                    break
            conn.execute(
                """INSERT INTO orders (code, user_id, customer_name, phone, method,
                   branch_id, branch_name, address, items_json, subtotal, ship_fee,
                   discount, total, voucher_code, note, reply, status, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, '',
                           ?, ?)""",
                (code, None, r["customer_name"], r["phone"], r["method"],
                 r["branch_id"], r["branch_name"], r["address"], r["items_json"],
                 r["subtotal"], r["ship_fee"], r["discount"], r["total"],
                 r["voucher_code"], "demo", r["status"], r["created_at"]))

        conn.commit()
        rev = conn.execute(
            """SELECT SUM(total) s FROM orders WHERE note='demo'
               AND status!='cancel' AND date(created_at)>=date('now','localtime','-6 days')"""
        ).fetchone()["s"]
        print(f"Da tao {len(rows)} don demo trong {args.days} ngay.")
        print(f"Doanh thu demo 7 ngay: {int(rev or 0):,}d".replace(",", "."))
        print(f"DB: {DB_PATH}")


if __name__ == "__main__":
    main()
