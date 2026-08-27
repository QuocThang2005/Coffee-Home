import json
import os
import tempfile
import uuid
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile

from ..db import get_conn, today_sql, days_ago_sql, date_col, IS_POSTGRESQL
from ._common import vn_today, require_admin
from ._schemas import SettingsIn

router = APIRouter()

def _upload_dir(subdir: str = "") -> Path:
    d = Path(os.environ.get("UPLOAD_DIR", tempfile.gettempdir())) / "uploads"
    if subdir:
        d = d / subdir
    d.mkdir(parents=True, exist_ok=True)
    return d

ALLOWED_VIDEO_EXT = {".mp4", ".webm", ".ogg", ".mov"}
MAX_VIDEO_MB = 50
ALLOWED_QR_EXT = {".jpg", ".jpeg", ".png", ".webp", ".svg"}
MAX_QR_MB = 5


@router.get("/admin/stats")
def admin_stats(_=Depends(require_admin)):
    today = vn_today()
    with get_conn() as conn:
        rows_today = conn.execute(
            f"""SELECT items_json, total FROM orders
               WHERE {date_col('created_at')} = {today_sql()} AND status != 'cancel'"""
        ).fetchall()
        series_rows = conn.execute(
            f"""SELECT {date_col('created_at')} d, SUM(total) revenue, COUNT(*) n
               FROM orders
               WHERE status != 'cancel' AND {date_col('created_at')} >= {days_ago_sql(6)}
               GROUP BY d"""
        ).fetchall()
        upcoming = conn.execute(
            f"SELECT COUNT(*) c FROM bookings WHERE status = 'confirmed' AND {date_col('date')} >= {today_sql()}"
        ).fetchone()["c"]
        customers_total = conn.execute(
            "SELECT COUNT(*) c FROM users WHERE is_admin = 0"
        ).fetchone()["c"]
        orders_total = conn.execute("SELECT COUNT(*) c FROM orders").fetchone()["c"]
        top_rows = conn.execute(
            "SELECT items_json FROM orders WHERE status != 'cancel'"
        ).fetchall()

    revenue = sum(r["total"] for r in rows_today)
    cups = 0
    for r in rows_today:
        cups += sum(int(it.get("qty", 0)) for it in json.loads(r["items_json"]))

    by_day = {r["d"]: {"revenue": r["revenue"] or 0, "orders": r["n"]} for r in series_rows}
    series = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        info = by_day.get(d.isoformat(), {})
        series.append({
            "date": d.isoformat(),
            "label": ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][d.weekday()],
            "revenue": info.get("revenue", 0),
            "orders": info.get("orders", 0),
        })

    top: dict[str, int] = {}
    for r in top_rows:
        for it in json.loads(r["items_json"]):
            top[it["name"]] = top.get(it["name"], 0) + int(it.get("qty", 0))
    top_products = sorted(top.items(), key=lambda kv: kv[1], reverse=True)[:5]

    return {
        "ok": True,
        "today": {
            "revenue": revenue,
            "orders": len(rows_today),
            "cups": cups,
            "upcomingBookings": upcoming,
        },
        "totals": {"customers": customers_total, "orders": orders_total},
        "series": series,
        "topProducts": [{"name": n, "qty": q} for n, q in top_products],
    }


@router.get("/admin/stats/revenue")
def admin_stats_revenue(period: str = "week", _=Depends(require_admin)):
    """Doanh thu theo khoang thoi gian: week (7 ngay), month (30 ngay), year (12 thang)."""
    today = vn_today()
    with get_conn() as conn:
        if period == "month":
            rows = conn.execute(
                f"""SELECT {date_col('created_at')} d, SUM(total) revenue, COUNT(*) n
                   FROM orders
                   WHERE status != 'cancel' AND {date_col('created_at')} >= {days_ago_sql(30)}
                   GROUP BY d ORDER BY d"""
            ).fetchall()
            by_key = {str(r["d"]): {"revenue": r["revenue"] or 0, "orders": r["n"]} for r in rows}
            series = []
            for i in range(30, -1, -1):
                d = today - timedelta(days=i)
                key = d.isoformat()
                info = by_key.get(key, {})
                series.append({
                    "date": key,
                    "label": f"{d.day}/{d.month}",
                    "revenue": info.get("revenue", 0),
                    "orders": info.get("orders", 0),
                })

        elif period == "year":
            if IS_POSTGRESQL:
                rows = conn.execute(
                    f"""SELECT SUBSTRING((DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'))::text FROM 1 FOR 7) m,
                               SUM(total) revenue, COUNT(*) n
                       FROM orders
                       WHERE status != 'cancel' AND DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') >= DATE_TRUNC('year', (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
                       GROUP BY m ORDER BY m"""
                ).fetchall()
            else:
                rows = conn.execute(
                    f"""SELECT SUBSTR(date(created_at), 1, 7) m,
                               SUM(total) revenue, COUNT(*) n
                       FROM orders
                       WHERE status != 'cancel' AND date(created_at) >= date('now','localtime','start of year')
                       GROUP BY m ORDER BY m"""
                ).fetchall()
            by_key = {r["m"]: {"revenue": r["revenue"] or 0, "orders": r["n"]} for r in rows}
            month_names = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"]
            series = []
            for m in range(1, 13):
                key = f"{today.year}-{m:02d}"
                info = by_key.get(key, {})
                series.append({
                    "date": key,
                    "label": month_names[m - 1],
                    "revenue": info.get("revenue", 0),
                    "orders": info.get("orders", 0),
                })
        else:  # week
            rows = conn.execute(
                f"""SELECT {date_col('created_at')} d, SUM(total) revenue, COUNT(*) n
                   FROM orders
                   WHERE status != 'cancel' AND {date_col('created_at')} >= {days_ago_sql(6)}
                   GROUP BY d"""
            ).fetchall()
            by_key = {str(r["d"]): {"revenue": r["revenue"] or 0, "orders": r["n"]} for r in rows}
            series = []
            for i in range(6, -1, -1):
                d = today - timedelta(days=i)
                key = d.isoformat()
                info = by_key.get(key, {})
                series.append({
                    "date": key,
                    "label": ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][d.weekday()],
                    "revenue": info.get("revenue", 0),
                    "orders": info.get("orders", 0),
                })

    total_rev = sum(s["revenue"] for s in series)
    total_orders = sum(s["orders"] for s in series)
    return {"ok": True, "series": series, "totalRevenue": total_rev, "totalOrders": total_orders, "period": period}


@router.get("/users")
def list_users(_=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT u.id, u.name, u.email, u.phone, u.points, u.created_at,
                      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders_count
               FROM users u WHERE u.is_admin = 0 ORDER BY u.id DESC"""
        ).fetchall()
    return {"ok": True, "users": [dict(r) for r in rows]}


@router.get("/settings")
def get_public_settings():
    """Public endpoint — frontend load settings cho footer, marquee, banners."""
    with get_conn() as conn:
        rows = conn.execute("SELECT key, value FROM site_settings").fetchall()
    return {"ok": True, "settings": {r["key"]: r["value"] for r in rows}}


@router.get("/admin/settings")
def admin_get_settings(_=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute("SELECT key, value FROM site_settings").fetchall()
    return {"ok": True, "settings": {r["key"]: r["value"] for r in rows}}


@router.put("/admin/settings")
def admin_update_settings(body: SettingsIn, _=Depends(require_admin)):
    with get_conn() as conn:
        for k, v in body.settings.items():
            conn.execute(
                "INSERT INTO site_settings (key, value) VALUES (?, ?) "
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                (k, str(v)),
            )
        conn.commit()
    return {"ok": True, "count": len(body.settings)}


@router.post("/admin/upload-video")
async def admin_upload_video(file: UploadFile, _=Depends(require_admin)):
    ext = Path(file.filename or "video.mp4").suffix.lower()
    if ext not in ALLOWED_VIDEO_EXT:
        raise HTTPException(400, f"Định dạng không hỗ trợ. Chỉ nhận: {', '.join(ALLOWED_VIDEO_EXT)}")
    data = await file.read()
    if len(data) > MAX_VIDEO_MB * 1024 * 1024:
        raise HTTPException(400, f"Video tối đa {MAX_VIDEO_MB}MB")
    upload_dir = _upload_dir("videos")
    fname = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
    (upload_dir / fname).write_bytes(data)
    return {"ok": True, "url": f"/uploads/videos/{fname}"}


@router.post("/admin/upload-qr")
async def admin_upload_qr(file: UploadFile, _=Depends(require_admin)):
    ext = Path(file.filename or "qr.png").suffix.lower()
    if ext not in ALLOWED_QR_EXT:
        raise HTTPException(400, f"Chỉ nhận: {', '.join(ALLOWED_QR_EXT)}")
    data = await file.read()
    if len(data) > MAX_QR_MB * 1024 * 1024:
        raise HTTPException(400, f"Ảnh tối đa {MAX_QR_MB}MB")
    upload_dir = _upload_dir("qrcode")
    fname = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
    (upload_dir / fname).write_bytes(data)
    return {"ok": True, "url": f"/uploads/qrcode/{fname}"}


@router.get("/admin/branches")
def list_branches_admin(_=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT b.*, (SELECT COUNT(*) FROM branch_tables t WHERE t.branch_id = b.id) AS table_count "
            "FROM branches b ORDER BY b.id"
        ).fetchall()
    return {"ok": True, "branches": [dict(r) for r in rows]}


@router.get("/admin/branches/{branch_id}/tables")
def list_branch_tables(branch_id: int, _=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM branch_tables WHERE branch_id = ? ORDER BY id", (branch_id,)
        ).fetchall()
    return {"ok": True, "tables": [dict(r) for r in rows]}


@router.get("/notifications")
def list_notifications(request: Request):
    from ._common import current_user
    user = current_user(request)
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
            (user["id"],),
        ).fetchall()
    return {"ok": True, "notifications": [dict(r) for r in rows]}


@router.patch("/notifications/{nid}/read")
def mark_notification_read(nid: int, request: Request):
    from ._common import current_user
    user = current_user(request)
    with get_conn() as conn:
        conn.execute(
            "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?",
            (nid, user["id"]),
        )
        conn.commit()
    return {"ok": True}


@router.get("/admin/audit-logs")
def list_audit_logs(_=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT a.*, u.name AS user_name FROM audit_logs a "
            "LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 200"
        ).fetchall()
    return {"ok": True, "logs": [dict(r) for r in rows]}
