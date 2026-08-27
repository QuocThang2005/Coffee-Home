from fastapi import APIRouter, Depends, HTTPException, Request

from ..db import get_conn
from ._common import current_user, require_admin
from ._schemas import RedeemRewardIn

router = APIRouter()


@router.get("/loyalty/tiers")
def list_loyalty_tiers():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM loyalty_tiers ORDER BY min_points").fetchall()
    return {"ok": True, "tiers": [dict(r) for r in rows]}


@router.get("/rewards")
def list_rewards():
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM rewards WHERE active = 1 AND (stock = -1 OR stock > 0) ORDER BY points_cost"
        ).fetchall()
    return {"ok": True, "rewards": [dict(r) for r in rows]}


@router.post("/rewards/redeem")
def redeem_reward(body: RedeemRewardIn, request: Request):
    user = current_user(request)
    with get_conn() as conn:
        reward = conn.execute("SELECT * FROM rewards WHERE id = ? AND active = 1",
                              (body.rewardId,)).fetchone()
        if not reward:
            raise HTTPException(404, "Quà không tồn tại")
        reward = dict(reward)
        if reward["stock"] == 0:
            raise HTTPException(409, "Hết hàng")
        if user["points"] < reward["points_cost"]:
            raise HTTPException(400, f"Cần {reward['points_cost']} điểm, bạn có {user['points']}")

        conn.execute("UPDATE users SET points = points - ? WHERE id = ?",
                      (reward["points_cost"], user["id"]))
        if reward["stock"] > 0:
            conn.execute("UPDATE rewards SET stock = stock - 1 WHERE id = ?", (body.rewardId,))
        conn.execute(
            "INSERT INTO reward_redemptions (user_id, reward_id, points_spent) VALUES (?, ?, ?)",
            (user["id"], body.rewardId, reward["points_cost"]),
        )
        conn.execute(
            "INSERT INTO points_history (user_id, points, type, description) VALUES (?, ?, 'spend', ?)",
            (user["id"], -reward["points_cost"], f"Doi qua: {reward['name']}"),
        )
        conn.commit()
    return {"ok": True, "message": f"Đổi thành công '{reward['name']}'!"}


@router.get("/points/history")
def points_history(request: Request):
    user = current_user(request)
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM points_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
            (user["id"],),
        ).fetchall()
    return {"ok": True, "history": [dict(r) for r in rows]}


@router.get("/admin/points/history")
def admin_points_history(_=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT ph.*, u.name AS user_name FROM points_history ph "
            "LEFT JOIN users u ON u.id = ph.user_id ORDER BY ph.created_at DESC LIMIT 200"
        ).fetchall()
    return {"ok": True, "history": [dict(r) for r in rows]}
