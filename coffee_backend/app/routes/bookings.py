from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn
from ..security import new_booking_code
from ._common import _branch_name, current_user, require_admin
from ._schemas import BookingIn, ReplyIn

router = APIRouter()


@router.get("/bookings/mine")
def my_bookings(user=Depends(current_user)):
    conds, args = [], []
    if (user["phone"] or "").strip():
        conds.append("phone = ?")
        args.append(user["phone"].strip())
    if (user["email"] or "").strip():
        conds.append("email = ?")
        args.append(user["email"].strip())
    if not conds:
        return {"ok": True, "bookings": []}
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM bookings WHERE {' OR '.join(conds)} ORDER BY created_at DESC", args,
        ).fetchall()
    return {"ok": True, "bookings": [dict(r) for r in rows]}


@router.patch("/bookings/mine/{code}/cancel")
def cancel_my_booking(code: str, user=Depends(current_user)):
    with get_conn() as conn:
        row = conn.execute("SELECT phone, email FROM bookings WHERE code = ?", (code,)).fetchone()
        if not row:
            raise HTTPException(404, "Không tìm thấy lượt đặt bàn")
        mine = ((user["phone"] and row["phone"] == user["phone"])
                or (user["email"] and row["email"] == user["email"]))
        if not mine:
            raise HTTPException(403, "Đây không phải lượt đặt bàn của bạn")
        conn.execute("UPDATE bookings SET status = 'cancel' WHERE code = ?", (code,))
        conn.commit()
    return {"ok": True, "code": code}


@router.patch("/bookings/{code}/reply")
def set_booking_reply(code: str, body: ReplyIn,
                      _=Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.execute("UPDATE bookings SET reply = ? WHERE code = ?",
                           (body.reply.strip(), code))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "Không tìm thấy lượt đặt bàn")
    return {"ok": True, "code": code, "reply": body.reply.strip()}


@router.post("/bookings")
def create_booking(body: BookingIn):
    code = new_booking_code()
    with get_conn() as conn:
        while conn.execute("SELECT 1 FROM bookings WHERE code = ?", (code,)).fetchone():
            code = new_booking_code()
        busy = conn.execute(
            "SELECT COUNT(*) c FROM bookings WHERE branch_id = ? AND date = ? AND time = ? AND status='confirmed'",
            (int(body.branchId) if body.branchId else None, body.date, body.time),
        ).fetchone()["c"]
        if busy >= 6:
            raise HTTPException(409, "Khung giờ này đã đầy — vui lòng chọn giờ khác")
        conn.execute(
            """INSERT INTO bookings (code, branch_id, branch_name, date, time, guests, name, phone, email, note)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                code, int(body.branchId) if body.branchId else None, _branch_name(body.branchId), body.date, body.time,
                body.guests, body.name, body.phone, body.email, body.note.strip(),
            ),
        )
        conn.commit()
    return {"ok": True, "code": code, "status": "confirmed",
            "message": "Đặt bàn thành công — hẹn gặp bạn tại Coffee Home!"}


@router.get("/bookings")
def list_bookings(_=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM bookings ORDER BY created_at DESC").fetchall()
    return {"ok": True, "bookings": [dict(r) for r in rows]}


@router.patch("/bookings/{code}/status")
def set_booking_status(code: str, status: Literal["confirmed", "cancel"],
                       _=Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.execute("UPDATE bookings SET status = ? WHERE code = ?", (status, code))
        conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(404, f"Không tìm thấy đặt bàn {code}")
    return {"ok": True, "code": code, "status": status}
