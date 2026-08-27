from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..db import get_conn
from ._common import current_user, require_admin
from ._schemas import ReviewIn

router = APIRouter()


@router.post("/reviews")
def create_review(body: ReviewIn, request: Request):
    try:
        uid = current_user(request)["id"]
    except HTTPException:
        uid = None
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO reviews (user_id, product_id, order_code, rating, title, message) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (uid, body.productId, body.orderCode, body.rating, body.title.strip(), body.message.strip()),
        )
        conn.commit()
        review_id = cur.lastrowid
        avg_row = conn.execute(
            "SELECT AVG(rating)::numeric(3,2) AS avg_r, COUNT(*)::int AS cnt "
            "FROM reviews WHERE product_id = ? AND status = 'visible'",
            (body.productId,),
        ).fetchone()
        if avg_row and avg_row["cnt"]:
            conn.execute(
                "UPDATE products SET rating = ?, sold = COALESCE(sold,0) WHERE id = ?",
                (float(avg_row["avg_r"]), body.productId),
            )
            conn.commit()
    return {"ok": True, "id": review_id}


@router.get("/products/{product_id}/reviews")
def list_product_reviews(product_id: int):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT r.id, r.rating, r.title, r.message, r.created_at, u.name AS user_name "
            "FROM reviews r LEFT JOIN users u ON u.id = r.user_id "
            "WHERE r.product_id = ? AND r.status = 'visible' ORDER BY r.id DESC",
            (product_id,),
        ).fetchall()
        images_map = {}
        if rows:
            ids = [r["id"] for r in rows]
            ph = ",".join(["?"] * len(ids))
            img_rows = conn.execute(
                f"SELECT review_id, url FROM review_images WHERE review_id IN ({ph}) ORDER BY sort_order",
                ids,
            ).fetchall()
            for img in img_rows:
                images_map.setdefault(img["review_id"], []).append(img["url"])
        avg_row = conn.execute(
            "SELECT AVG(rating)::numeric(3,2) AS avg_r, COUNT(*)::int AS cnt "
            "FROM reviews WHERE product_id = ? AND status = 'visible'",
            (product_id,),
        ).fetchone()
    reviews = []
    for r in rows:
        d = dict(r)
        d["images"] = images_map.get(r["id"], [])
        reviews.append(d)
    return {
        "ok": True,
        "reviews": reviews,
        "avgRating": float(avg_row["avg_r"]) if avg_row and avg_row["cnt"] else 0,
        "totalReviews": avg_row["cnt"] if avg_row else 0,
    }


@router.get("/reviews")
def list_all_reviews(_=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT r.*, u.name AS user_name, p.name AS product_name "
            "FROM reviews r "
            "LEFT JOIN users u ON u.id = r.user_id "
            "LEFT JOIN products p ON p.id = r.product_id "
            "ORDER BY r.id DESC"
        ).fetchall()
    return {"ok": True, "reviews": [dict(r) for r in rows]}


@router.patch("/reviews/{review_id}/status")
def update_review_status(review_id: int, status: str = Query(...), _=Depends(require_admin)):
    if status not in ("visible", "hidden"):
        raise HTTPException(400, "Status phải là 'visible' hoặc 'hidden'")
    with get_conn() as conn:
        cur = conn.execute("UPDATE reviews SET status = ? WHERE id = ?", (status, review_id))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "Không tìm thấy đánh giá")
    return {"ok": True}


@router.delete("/reviews/{review_id}")
def delete_review(review_id: int, _=Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM reviews WHERE id = ?", (review_id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "Không tìm thấy đánh giá")
    return {"ok": True, "deleted": review_id}
