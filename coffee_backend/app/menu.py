# Thực đơn — query DB (PostgreSQL/SQLite) hoặc fallback JSON
import json
import re
import unicodedata
from pathlib import Path

MENU_PATH = Path(__file__).resolve().parents[2] / "data" / "products.json"
_cache: dict = {"mtime": None, "data": None}


def _is_db():
    from . import db
    return bool(db.DATABASE_URL) or hasattr(db, "DB_PATH")


def load_menu() -> dict:
    if _is_db():
        return _load_menu_from_db()
    return _load_menu_from_json()


def save_menu(data: dict) -> None:
    """Ghi data — hiện chỉ dùng khi fallback JSON."""
    MENU_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    _cache["data"] = data
    _cache["mtime"] = MENU_PATH.stat().st_mtime


def slugify(name: str) -> str:
    text = unicodedata.normalize("NFD", name)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = text.replace("đ", "d").replace("Đ", "D")
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "mon-moi"


# ---------- DB-backed ----------

def _load_menu_from_db() -> dict:
    from .db import get_conn

    with get_conn() as conn:
        def _q(sql, params=()):
            rows = conn.execute(sql, params).fetchall()
            return [dict(r) for r in rows]

        categories = _q("SELECT id, name, icon FROM categories ORDER BY id")
        sizes = _q("SELECT id, name, extra FROM sizes ORDER BY extra")
        toppings = _q("SELECT id, name, price FROM toppings ORDER BY name")

        products_raw = _q(
            "SELECT id, slug, name, category_id, base_price, discount_pct, "
            "rating, sold, tags, image, description "
            "FROM products WHERE active = 1 ORDER BY id"
        )
        products = []
        for p in products_raw:
            try:
                tags = json.loads(p.get("tags") or "[]")
            except (json.JSONDecodeError, TypeError):
                tags = []
            products.append({
                "id": p["id"],
                "slug": p["slug"],
                "name": p["name"],
                "category": p["category_id"],
                "basePrice": p["base_price"],
                "discountPct": p["discount_pct"],
                "rating": p["rating"],
                "sold": p["sold"],
                "tags": tags,
                "image": p["image"],
                "desc": p["description"],
            })

        branches = _q(
            "SELECT id, name, address, lat, lng, open, phone "
            "FROM branches WHERE active = 1 ORDER BY id"
        )

        vouchers_raw = _q(
            "SELECT code, title, description, type, value, min_order, until "
            "FROM vouchers WHERE active = 1 ORDER BY code"
        )
        vouchers = [{
            "code": v["code"],
            "title": v["title"],
            "desc": v["description"],
            "type": v["type"],
            "value": v["value"],
            "minOrder": v["min_order"],
            "until": v["until"],
        } for v in vouchers_raw]

    return {
        "brand": {
            "name": "Coffee Home",
            "tagline": "Cà phê nhà làm - đậm đà Việt Nam",
            "hotline": "1900 1234",
            "email": "hello@coffeehome.vn",
        },
        "categories": categories,
        "sizes": sizes,
        "iceLevels": [
            {"id": "100", "name": "Đá đầy"},
            {"id": "70", "name": "Đá 70%"},
            {"id": "50", "name": "Đá 50%"},
            {"id": "0", "name": "Không đá"},
        ],
        "sugarLevels": [
            {"id": "100", "name": "Đường đầy đủ"},
            {"id": "70", "name": "Ít đường 70%"},
            {"id": "50", "name": "50%"},
            {"id": "0", "name": "Không đường"},
        ],
        "toppings": toppings,
        "products": products,
        "branches": branches,
        "vouchers": vouchers,
        "banners": _get_banners(),
    }


def _get_banners():
    """Banners giữ nguyên từ JSON — có thể migrate DB sau."""
    try:
        data = json.loads(MENU_PATH.read_text(encoding="utf-8"))
        return data.get("banners", [])
    except Exception:
        return []


# ---------- JSON fallback ----------

def _load_menu_from_json() -> dict:
    mtime = MENU_PATH.stat().st_mtime
    if _cache["data"] is None or _cache["mtime"] != mtime:
        _cache["data"] = json.loads(MENU_PATH.read_text(encoding="utf-8"))
        _cache["mtime"] = mtime
    return _cache["data"]
