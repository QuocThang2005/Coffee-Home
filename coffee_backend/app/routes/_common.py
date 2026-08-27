import asyncio
import json
import os
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect

from ..db import get_conn, now_sql, today_sql, days_ago_sql, date_col, get_exception_class, IS_POSTGRESQL
from ..menu import load_menu, save_menu, slugify
from ..chatbot import chat_reply, chat_reply_stream
from ..security import hash_password, new_booking_code, new_order_code, new_token, verify_password
from ._schemas import OrderIn

_VN_TZ = timezone(timedelta(hours=7))

def vn_today():
    return datetime.now(_VN_TZ).date()

ORDER_STATUSES = ("new", "preparing", "ready", "shipping", "done", "cancel")

# ---------------- tables ----------------

def _load_tables() -> dict:
    """Load branch_tables tu DB hoac fallback JSON."""
    try:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT t.id, t.name, t.seats, t.token, b.id AS branch_id "
                "FROM branch_tables t JOIN branches b ON b.id = t.branch_id "
                "WHERE t.active = 1"
            ).fetchall()
        tables = {}
        for r in rows:
            r = dict(r)
            tid = f"T{r['id']}"
            tables[tid] = {"id": tid, "name": r["name"], "seats": r["seats"],
                           "token": r["token"], "branch_id": r["branch_id"]}
        return tables
    except Exception:
        tables_path = Path(__file__).resolve().parents[2] / "data" / "tables.json"
        try:
            return {t["id"]: t for t in json.loads(tables_path.read_text("utf-8")).get("tables", [])}
        except Exception:
            return {}

_TABLES = _load_tables()

# ---------------- WebSocket: kết nối real-time tới Admin/Bếp ----------------
_active_ws: set = set()
_ws_lock = asyncio.Lock()
_main_loop: asyncio.AbstractEventLoop | None = None


def _set_main_loop(loop: asyncio.AbstractEventLoop):
    global _main_loop
    _main_loop = loop


def _broadcast_sync(data: dict):
    """Gửi sự kiện đến tất cả admin đang kết nối WS — thread-safe từ sync endpoint."""
    if not _main_loop or _main_loop.is_closed():
        return
    msg = json.dumps(data, ensure_ascii=False)

    async def _do():
        async with _ws_lock:
            dead = set()
            for ws in _active_ws:
                try:
                    await ws.send_text(msg)
                except Exception:
                    dead.add(ws)
            _active_ws.difference_update(dead)

    asyncio.run_coroutine_threadsafe(_do(), _main_loop)

# ---------------- auth helpers ----------------

def _public_user(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "phone": row["phone"],
        "points": row["points"],
        "isAdmin": bool(row["is_admin"]),
    }


def current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Chưa đăng nhập")
    token = auth.removeprefix("Bearer ").strip()
    with get_conn() as conn:
        row = conn.execute(
            f"""SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id
               WHERE t.token = ? AND t.expires_at > {now_sql()}""",
            (token,),
        ).fetchone()
    if not row:
        raise HTTPException(401, "Token không hợp lệ hoặc đã hết hạn")
    return row


def require_admin(user=Depends(current_user)):
    if not user["is_admin"]:
        raise HTTPException(403, "Chỉ quản trị viên")
    return user


# ---------------- orders helpers ----------------

SHIP_FEE = 20_000
FREE_SHIP_FROM = 99_000


def _find_voucher(code: str) -> dict | None:
    """Tra voucher trong products.json — tự loại mã hết hạn hoặc không tồn tại."""
    code = (code or "").strip().upper()
    if not code:
        return None
    for v in load_menu().get("vouchers", []):
        if str(v.get("code", "")).upper() != code:
            continue
        until = v.get("until")
        if until:
            try:
                if date.today() > datetime.strptime(until, "%d/%m/%Y").date():
                    return None
            except ValueError:
                pass
        return v
    return None


def _price_order(body: OrderIn) -> tuple[list[dict], float, float, float, float]:
    """Tính lại toàn bộ tiền từ products.json phía server."""
    menu = load_menu()
    size_extra = {str(s.get("id")): s.get("extra", 0) for s in menu.get("sizes", [])}
    topping_price: dict[str, float] = {}
    for t in menu.get("toppings", []):
        topping_price[str(t.get("id"))] = t.get("price", 0)
        topping_price[t.get("name", "")] = t.get("price", 0)

    catalog: dict[str, dict] = {}
    for p in menu.get("products", []):
        catalog[str(p["id"])] = p
        catalog[p.get("slug", "")] = p

    items_out: list[dict] = []
    subtotal = 0.0
    for it in body.items:
        p = catalog.get(str(it.id)) or catalog.get(it.slug)
        if p is None:
            raise HTTPException(400, f"Món '{it.name}' không có trong thực đơn")
        unit = (round(p["basePrice"] * (1 - (p.get("discountPct") or 0) / 100))
                + size_extra.get(it.size, 0))
        for t in it.toppings:
            key = str(t.get("id") or t.get("name") or "")
            unit += topping_price.get(key, 0)
        row = it.model_dump()
        row["unitPrice"] = unit
        items_out.append(row)
        subtotal += unit * it.qty

    discount = 0.0
    v = _find_voucher(body.voucherCode)
    freeship = False
    if v and subtotal >= (v.get("minOrder") or 0):
        if v.get("type") == "percent":
            discount = round(subtotal * (v.get("value") or 0) / 100)
        elif v.get("type") == "fixed":
            discount = float(v.get("value") or 0)
        elif v.get("type") == "freeship":
            freeship = True

    ship_fee = 0.0
    if body.method == "delivery":
        ship_fee = 0 if (freeship or subtotal >= FREE_SHIP_FROM) else SHIP_FEE

    total = max(0.0, subtotal - discount) + ship_fee
    return items_out, subtotal, ship_fee, discount, total


def _branch_name(branch_id: str) -> str:
    if not branch_id:
        return ""
    with get_conn() as conn:
        row = conn.execute("SELECT name FROM branches WHERE id = ? AND active = 1", (branch_id,)).fetchone()
    return dict(row)["name"] if row else ""
