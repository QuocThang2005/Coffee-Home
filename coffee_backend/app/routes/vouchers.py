from fastapi import APIRouter, Depends, HTTPException

from ..db import get_conn, get_exception_class
from ._common import require_admin
from ._schemas import VoucherIn, VoucherPatch

router = APIRouter()


@router.post("/vouchers")
def create_voucher(body: VoucherIn, _=Depends(require_admin)):
    with get_conn() as conn:
        try:
            conn.execute(
                "INSERT INTO vouchers (code, title, description, type, value, min_order, until) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (body.code, body.title, body.desc, body.type, body.value,
                 body.minOrder, body.until),
            )
            conn.commit()
        except get_exception_class():
            raise HTTPException(409, f"Mã {body.code} đã tồn tại")
    voucher = body.model_dump()
    return {"ok": True, "voucher": voucher}


@router.patch("/vouchers/{code}")
def update_voucher(code: str, body: VoucherPatch, _=Depends(require_admin)):
    db_map = {"title": "title", "desc": "description", "type": "type",
              "value": "value", "minOrder": "min_order", "until": "until"}
    set_clauses, params = [], []
    for fe_key, db_key in db_map.items():
        val = getattr(body, fe_key, None)
        if val is not None:
            set_clauses.append(f"{db_key} = ?")
            params.append(val)
    if not set_clauses:
        raise HTTPException(400, "Không có thay đổi")
    params.append(code.upper())
    with get_conn() as conn:
        cur = conn.execute(f"UPDATE vouchers SET {', '.join(set_clauses)} WHERE code = ?", params)
        conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(404, f"Không tìm thấy voucher {code}")
    return {"ok": True, "code": code.upper()}


@router.delete("/vouchers/{code}")
def delete_voucher(code: str, _=Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.execute("UPDATE vouchers SET active = 0 WHERE code = ? AND active = 1", (code.upper(),))
        conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(404, f"Không tìm thấy voucher {code}")
    return {"ok": True, "deleted": code.upper()}
