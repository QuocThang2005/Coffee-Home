from fastapi import APIRouter, Depends, HTTPException, Request

from ..db import get_conn
from ._common import require_admin
from ._schemas import ApplicationIn, ReplyIn

router = APIRouter()

APP_STATUS_LABEL = {"new": "Mới", "approved": "Đã duyệt", "rejected": "Từ chối"}


@router.post("/applications")
def create_application(body: ApplicationIn):
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO applications (name, phone, email, position, note) VALUES (?, ?, ?, ?, ?)",
            (body.name.strip(), body.phone, body.email.strip(), body.position.strip(), body.note.strip()),
        )
        conn.commit()
        app_id = cur.lastrowid
    return {"ok": True, "id": app_id,
            "message": "Đã nhận hồ sơ! Quán sẽ liên hệ bạn trong 2-3 ngày làm việc."}


@router.get("/applications")
def list_applications(_=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM applications ORDER BY id DESC").fetchall()
    return {"ok": True, "applications": [dict(r) for r in rows]}


@router.patch("/applications/{app_id}/reply")
def set_application_reply(app_id: int, body: ReplyIn,
                          _=Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.execute("UPDATE applications SET reply = ? WHERE id = ?",
                           (body.reply.strip(), app_id))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "Không tìm thấy hồ sơ ứng tuyển")
    return {"ok": True, "id": app_id, "reply": body.reply.strip()}


@router.patch("/applications/{app_id}/status")
def set_application_status(app_id: int, request: Request, _=Depends(require_admin)):
    status = request.query_params.get("status", "")
    if status not in APP_STATUS_LABEL:
        raise HTTPException(422, f"Trạng thái phải là một trong: {', '.join(APP_STATUS_LABEL)}")
    with get_conn() as conn:
        cur = conn.execute("UPDATE applications SET status = ? WHERE id = ?", (status, app_id))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "Không tìm thấy hồ sơ ứng tuyển")
    return {"ok": True, "id": app_id, "status": status}
