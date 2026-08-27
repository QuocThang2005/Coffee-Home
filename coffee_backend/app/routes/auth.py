import json
import os
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, Request

from ..db import get_conn, now_sql
from ..security import hash_password, new_token, verify_password
from ._common import _public_user, current_user
from ._schemas import RegisterIn, LoginIn, GoogleAuthIn

router = APIRouter()


@router.post("/auth/register")
def register(body: RegisterIn):
    salt, digest = hash_password(body.password)
    try:
        with get_conn() as conn:
            cur = conn.execute(
                "INSERT INTO users (name, email, salt, pass_hash, points) VALUES (?, ?, ?, ?, 50)",
                (body.name, body.email.lower(), salt, digest),
            )
            token = new_token()
            conn.execute(
                f"INSERT INTO tokens (token, user_id, expires_at) VALUES (?, ?, {now_sql(30)})",
                (token, cur.lastrowid),
            )
            conn.commit()
            row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    except get_exception_class():
        raise HTTPException(409, "Email đã được dùng")
    return {"ok": True, "token": token, "user": _public_user(row), "welcomePoints": 50}


@router.post("/auth/login")
def login(body: LoginIn):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (body.email.lower(),)
        ).fetchone()
    if not row or not verify_password(body.password, row["salt"], row["pass_hash"]):
        raise HTTPException(401, "Email hoặc mật khẩu không đúng")
    token = new_token()
    with get_conn() as conn:
        conn.execute(
            f"INSERT INTO tokens (token, user_id, expires_at) VALUES (?, ?, {now_sql(30)})",
            (token, row["id"]),
        )
        conn.commit()
    return {"ok": True, "token": token, "user": _public_user(row)}


@router.get("/auth/me")
def me(user=Depends(current_user)):
    return {"ok": True, "user": _public_user(user)}


@router.get("/auth/google/client-id")
def google_client_id():
    """Frontend lấy Client ID từ đây — cấu hình duy nhất nằm ở config.json."""
    return {"clientId": os.environ.get("GOOGLE_CLIENT_ID", "").strip()}


@router.post("/auth/google")
def auth_google(body: GoogleAuthIn):
    """Nhận ID token từ Google Identity Services, xác minh rồi phát token phiên."""
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(
            501,
            "Server chưa cấu hình GOOGLE_CLIENT_ID — dán Client ID vào config.json rồi chạy lại start",
        )

    try:
        req = urllib.request.Request(
            "https://oauth2.googleapis.com/tokeninfo?id_token=" + body.credential
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            info = json.loads(resp.read().decode())
    except Exception:
        raise HTTPException(401, "Token Google không hợp lệ hoặc đã hết hạn")

    if info.get("aud") != client_id:
        raise HTTPException(401, "Token không phát hành cho ứng dụng này")
    if str(info.get("email_verified", "")).lower() != "true":
        raise HTTPException(401, "Email Google chưa được xác minh")

    email = info["email"].lower()
    name = info.get("name") or email.split("@")[0]

    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row is None:
            cur = conn.execute(
                "INSERT INTO users (name, email, salt, pass_hash, points) VALUES (?, ?, '', '', 50)",
                (name, email),
            )
            row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
        token = new_token()
        conn.execute(
            f"INSERT INTO tokens (token, user_id, expires_at) VALUES (?, ?, {now_sql(30)})",
            (token, row["id"]),
        )
        conn.commit()
    return {"ok": True, "token": token, "user": _public_user(row), "welcomePoints": 50}


@router.post("/auth/logout")
def logout(request: Request, user=Depends(current_user)):
    token = request.headers["Authorization"].removeprefix("Bearer ").strip()
    with get_conn() as conn:
        conn.execute("DELETE FROM tokens WHERE token = ?", (token,))
        conn.commit()
    return {"ok": True}
