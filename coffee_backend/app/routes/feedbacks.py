from fastapi import APIRouter, Depends, HTTPException, Request

from ..db import get_conn
from ._common import require_admin
from ._schemas import FeedbackIn

router = APIRouter()

FEEDBACK_STATUS_LABEL = {"new": "Mới", "read": "Đã đọc", "hidden": "Đã ẩn"}


@router.post("/feedbacks")
def create_feedback(body: FeedbackIn):
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO feedbacks (name, contact, rating, message) VALUES (?, ?, ?, ?)",
            (body.name.strip(), body.contact.strip(), body.rating, body.message),
        )
        conn.commit()
        fb_id = cur.lastrowid
    return {"ok": True, "id": fb_id,
            "message": "Cảm ơn bạn đã góp ý! Quán rất trân trọng từng lời của bạn. ☕"}


@router.get("/feedbacks")
def list_feedbacks(_=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM feedbacks ORDER BY id DESC").fetchall()
    return {"ok": True, "feedbacks": [dict(r) for r in rows]}


@router.patch("/feedbacks/{fb_id}/status")
def set_feedback_status(fb_id: int, request: Request, _=Depends(require_admin)):
    status = request.query_params.get("status", "")
    if status not in FEEDBACK_STATUS_LABEL:
        raise HTTPException(422, f"Trạng thái phải là một trong: {', '.join(FEEDBACK_STATUS_LABEL)}")
    with get_conn() as conn:
        cur = conn.execute("UPDATE feedbacks SET status = ? WHERE id = ?", (status, fb_id))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "Không tìm thấy phản hồi")
    return {"ok": True, "id": fb_id, "status": status}
