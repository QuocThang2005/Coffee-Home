import json

from fastapi import APIRouter, Depends, HTTPException, Request

from ..db import get_conn
from ..security import new_order_code
from ._common import (
    _broadcast_sync, _branch_name, _price_order, _TABLES,
    current_user, require_admin, ORDER_STATUSES,
)
from ._schemas import OrderIn, ReplyIn

router = APIRouter()


@router.get("/orders/mine")
def my_orders(user=Depends(current_user)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, code DESC",
            (user["id"],),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        raw = d.pop("items_json", "[]")
        try:
            d["items"] = json.loads(raw or "[]")
        except ValueError:
            d["items"] = []
        out.append(d)
    return {"ok": True, "orders": out}


@router.patch("/orders/{code}/reply")
def set_order_reply(code: str, body: ReplyIn,
                    _=Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.execute("UPDATE orders SET reply = ? WHERE code = ?",
                           (body.reply.strip(), code))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "Không tìm thấy đơn hàng")
    return {"ok": True, "code": code, "reply": body.reply.strip()}


@router.get("/tables/{table_id}/validate")
def validate_table(table_id: str, token: str = ""):
    t = _TABLES.get(table_id)
    if not t:
        raise HTTPException(404, "Bàn không tồn tại")
    if t.get("token") != token:
        raise HTTPException(403, "Token bàn không hợp lệ")
    return {"ok": True, "id": t["id"], "name": t["name"], "seats": t.get("seats", 0)}


@router.post("/orders")
def create_order(body: OrderIn, request: Request):
    try:
        uid = current_user(request)["id"]
    except HTTPException:
        uid = None

    items, subtotal, ship_fee, discount, total = _price_order(body)

    code = new_order_code()
    with get_conn() as conn:
        while conn.execute("SELECT 1 FROM orders WHERE code = ?", (code,)).fetchone():
            code = new_order_code()

        branch_id = int(body.branchId) if body.branchId else None
        points = round(total / 10000)
        conn.execute(
            """INSERT INTO orders
               (code, user_id, customer_name, phone, method, branch_id, branch_name,
                address, items_json, subtotal, ship_fee, discount, total, voucher_code,
                note, table_id, payment_method)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                code, uid, body.customer.name or "Khách lẻ", body.customer.phone,
                body.method, branch_id,
                _branch_name(body.branchId), body.address.strip(),
                json.dumps(items, ensure_ascii=False),
                subtotal, ship_fee, discount, total,
                body.voucherCode.upper(), body.note.strip(),
                body.tableId, body.paymentMethod,
            ),
        )
        if uid:
            conn.execute("UPDATE users SET points = points + ? WHERE id = ?", (points, uid))
        conn.commit()

    tbl_name = _TABLES.get(body.tableId, {}).get("name", "") if body.tableId else ""
    _broadcast_sync({
        "type": "new_order", "code": code,
        "table_id": body.tableId, "table_name": tbl_name,
        "customer": body.customer.name or "Khách lẻ",
        "total": total, "items_count": len(items),
    })

    return {
        "ok": True,
        "code": code,
        "status": "new",
        "points": points if uid else 0,
        "message": "Đã nhận đơn — Coffee Home đang pha món của bạn ☕",
    }


@router.get("/orders")
def list_orders(status: str | None = None, _=Depends(require_admin)):
    sql = "SELECT * FROM orders"
    args: tuple = ()
    if status:
        sql += " WHERE status = ?"
        args = (status,)
    sql += " ORDER BY created_at DESC"
    with get_conn() as conn:
        rows = conn.execute(sql, args).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["items"] = json.loads(d.pop("items_json"))
        d["customer"] = {"name": d.pop("customer_name"), "phone": d.pop("phone")}
        out.append(d)
    return {"ok": True, "orders": out}


@router.get("/orders/{code}")
def get_order_by_code(code: str):
    """Public lookup — khách theo dõi đơn bằng mã."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT code, customer_name, phone, method, branch_id, branch_name, "
            "address, subtotal, ship_fee, discount, total, voucher_code, note, "
            "status, payment_method, created_at FROM orders WHERE code = ?",
            (code.upper().strip(),),
        ).fetchone()
    if not row:
        raise HTTPException(404, "Không tìm thấy đơn hàng")
    d = dict(row)
    with get_conn() as conn:
        items = conn.execute(
            "SELECT product_name, qty, unit_price, size, ice, sugar, toppings_json "
            "FROM order_items WHERE order_code = ? ORDER BY id",
            (code.upper().strip(),),
        ).fetchall()
        d["items"] = [dict(i) for i in items]
        history = conn.execute(
            "SELECT status, note, created_at FROM order_status_history "
            "WHERE order_code = ? ORDER BY created_at",
            (code.upper().strip(),),
        ).fetchall()
        d["history"] = [dict(h) for h in history]
        branch = None
        if d.get("branch_id"):
            branch = conn.execute(
                "SELECT id, name, address, lat, lng, open, phone FROM branches WHERE id = ?",
                (d["branch_id"],),
            ).fetchone()
    d["branch"] = dict(branch) if branch else None
    return {"ok": True, "order": d}


@router.patch("/orders/{code}/status")
def set_order_status(code: str, status: str, _=Depends(require_admin)):
    if status not in ORDER_STATUSES:
        raise HTTPException(422, f"Trạng thái phải thuộc {ORDER_STATUSES}")
    with get_conn() as conn:
        cur = conn.execute("UPDATE orders SET status = ? WHERE code = ?", (status, code))
        conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(404, f"Không tìm thấy đơn {code}")
    _broadcast_sync({"type": "status_changed", "code": code, "status": status})
    return {"ok": True, "code": code, "status": status}


@router.get("/orders/{code}/history")
def order_status_history(code: str, _=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM order_status_history WHERE order_code = ? ORDER BY created_at",
            (code,),
        ).fetchall()
    return {"ok": True, "history": [dict(r) for r in rows]}


@router.get("/orders/{code}/payments")
def order_payments(code: str, _=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM payments WHERE order_code = ? ORDER BY created_at",
            (code,),
        ).fetchall()
    return {"ok": True, "payments": [dict(r) for r in rows]}
