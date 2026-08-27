# Toàn bộ endpoint /api/* mà frontend coffee_home gọi tới
import asyncio
import json
import os
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field, field_validator

from .db import get_conn, now_sql, today_sql, days_ago_sql, date_col, get_exception_class, IS_POSTGRESQL
from .menu import load_menu, save_menu, slugify
from .chatbot import chat_reply, chat_reply_stream
from .security import hash_password, new_booking_code, new_order_code, new_token, verify_password

router = APIRouter(prefix="/api")

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


# ---------------- models ----------------

class CustomerIn(BaseModel):
    name: str = ""
    phone: str = ""
    email: str = ""


class OrderItemIn(BaseModel):
    id: str
    slug: str = ""
    name: str
    qty: int = Field(gt=0, le=99)
    unitPrice: float = Field(ge=0)
    size: str = "M"
    ice: str = ""
    sugar: str = ""
    toppings: list[dict[str, Any]] = []


class OrderIn(BaseModel):
    customer: CustomerIn
    method: Literal["pickup", "delivery"]
    branchId: str = ""
    address: str = ""
    items: list[OrderItemIn] = Field(min_length=1)
    subtotal: float = Field(ge=0)
    shipFee: float = Field(default=0, ge=0)
    discount: float = Field(default=0, ge=0)
    total: float = Field(gt=0)
    voucherCode: str = ""
    note: str = ""
    tableId: str = ""
    paymentMethod: str = ""

    @field_validator("address")
    @classmethod
    def delivery_needs_address(cls, v: str, info) -> str:
        if info.data.get("method") == "delivery" and not v.strip():
            raise ValueError("Đơn giao hàng cần địa chỉ")
        return v


class BookingIn(BaseModel):
    branchId: str
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    guests: int = Field(ge=1, le=20)
    name: str = Field(min_length=2)
    phone: str = Field(pattern=r"^\d{9,12}$")
    email: str = ""
    note: str = ""


class RegisterIn(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=8)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthIn(BaseModel):
    credential: str = Field(min_length=20)


class ApplicationIn(BaseModel):
    name: str = Field(min_length=2)
    phone: str = Field(pattern=r"^\d{9,12}$")
    email: str = ""
    position: str = Field(min_length=2)
    note: str = ""

    @field_validator("email")
    @classmethod
    def email_optional(cls, v: str) -> str:
        v = v.strip()
        if v and "@" not in v:
            raise ValueError("Email không hợp lệ")
        return v


class FeedbackIn(BaseModel):
    name: str = Field(min_length=2)
    contact: str = Field(default="", max_length=120)
    rating: int = Field(ge=1, le=5)
    message: str = Field(min_length=5, max_length=1000)

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Nội dung phản hồi không được để trống")
        return v.strip()


class ReplyIn(BaseModel):
    reply: str = Field(max_length=1000)


class ProductIn(BaseModel):
    name: str = Field(min_length=2)
    category: str = Field(min_length=2)
    basePrice: float = Field(ge=0)
    discountPct: int = Field(default=0, ge=0, le=90)
    desc: str = ""
    image: str = ""
    tags: list[str] = []
    sold: int = Field(default=0, ge=0)
    rating: float = Field(default=4.5, ge=0, le=5)


class ProductPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2)
    category: str | None = None
    basePrice: float | None = Field(default=None, ge=0)
    discountPct: int | None = Field(default=None, ge=0, le=90)
    desc: str | None = None
    image: str | None = None
    tags: list[str] | None = None


class VoucherIn(BaseModel):
    code: str = Field(min_length=3, max_length=20)
    title: str = Field(min_length=2)
    desc: str = ""
    type: Literal["percent", "fixed", "freeship", "gift"]
    value: float = Field(default=0, ge=0)
    minOrder: float = Field(default=0, ge=0)
    until: str = ""

    @field_validator("code")
    @classmethod
    def upper_code(cls, v: str) -> str:
        return v.strip().upper()


class VoucherPatch(BaseModel):
    title: str | None = Field(default=None, min_length=2)
    desc: str | None = None
    type: Literal["percent", "fixed", "freeship", "gift"] | None = None
    value: float | None = Field(default=None, ge=0)
    minOrder: float | None = Field(default=None, ge=0)
    until: str | None = None


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


# ---------------- menu & health ----------------

@router.get("/health")
def health():
    return {"ok": True, "service": "coffee-backend"}


# ---------------- chatbot ----------------

class ChatIn(BaseModel):
    messages: list[dict[str, str]] = Field(min_length=1, max_length=20)


def _sse_generator(messages):
    """Generate SSE stream from chat_reply_stream."""
    yield "data: {}\n\n"
    for event in chat_reply_stream(messages):
        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/chat")
def chat(body: ChatIn):
    """Nhan conversation history, tra ve SSE stream tu Gemini AI."""
    return StreamingResponse(
        _sse_generator(body.messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/drinks")
def drinks():
    return load_menu()


# ---------------- auth ----------------

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

    # xác minh ID token qua Google (không cần thêm thư viện ngoài)
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
            # tài khoản Google: không có mật khẩu local
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


# ---------------- feedbacks (phan hoi khach hang) ----------------

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


# ---------------- applications (tuyển dụng) ----------------

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


# ---------------- orders ----------------

SHIP_FEE = 20_000          # phí giao hàng mặc định
FREE_SHIP_FROM = 99_000    # đơn lớn được freeship không cần voucher


def _find_voucher(code: str) -> dict | None:
    """Tra voucher trong products.json — tự loại mã hết hạn hoặc không tồn tại."""
    code = (code or "").strip().upper()
    if not code:
        return None
    for v in load_menu().get("vouchers", []):
        if str(v.get("code", "")).upper() != code:
            continue
        until = v.get("until")  # định dạng dd/mm/yyyy
        if until:
            try:
                if date.today() > datetime.strptime(until, "%d/%m/%Y").date():
                    return None
            except ValueError:
                pass
        return v
    return None


def _price_order(body: OrderIn) -> tuple[list[dict], float, float, float, float]:
    """Tính lại toàn bộ tiền từ products.json phía server.

    Client chỉ gửi danh sách món + lựa chọn; mọi con số tiền tệ
    (unitPrice/subtotal/discount/shipFee/total) đều bị bỏ qua.
    Trả về (items đã gắn giá đúng, subtotal, ship_fee, discount, total).
    """
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
        # cùng công thức với priceOf() ở frontend
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


# ---------------- Gọi món tại bàn (QR table) ----------------

@router.get("/tables/{table_id}/validate")
def validate_table(table_id: str, token: str = ""):
    t = _TABLES.get(table_id)
    if not t:
        raise HTTPException(404, "Bàn không tồn tại")
    if t.get("token") != token:
        raise HTTPException(403, "Token bàn không hợp lệ")
    return {"ok": True, "id": t["id"], "name": t["name"], "seats": t.get("seats", 0)}


# ---------------- orders ----------------

@router.post("/orders")
def create_order(body: OrderIn, request: Request):
    # nhận diện người dùng nếu có token (không bắt buộc)
    try:
        uid = current_user(request)["id"]
    except HTTPException:
        uid = None

    # chống gian lận: tính lại giá/voucher/phí ship ngay trên server
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

    # phát sự kiện real-time đến màn Admin / Bếp
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


def _branch_name(branch_id: str) -> str:
    if not branch_id:
        return ""
    with get_conn() as conn:
        row = conn.execute("SELECT name FROM branches WHERE id = ? AND active = 1", (branch_id,)).fetchone()
    return dict(row)["name"] if row else ""


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


# ---------------- bookings ----------------

@router.post("/bookings")
def create_booking(body: BookingIn):
    code = new_booking_code()
    with get_conn() as conn:
        while conn.execute("SELECT 1 FROM bookings WHERE code = ?", (code,)).fetchone():
            code = new_booking_code()
        # trùng ngày + giờ + chi nhánh quá 6 bàn thì từ chối
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


# ---------------- admin: thống kê & khách hàng ----------------

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


# ---------------- admin: product (DB) ----------------

@router.post("/products")
def create_product(body: ProductIn, _=Depends(require_admin)):
    menu = load_menu()
    if body.category not in {c["id"] for c in menu["categories"]}:
        raise HTTPException(422, f"Nhóm không hợp lệ — phải thuộc {[c['id'] for c in menu['categories']]}")

    slug = slugify(body.name)
    existing = {p["slug"] for p in menu["products"]}
    n = 2
    while slug in existing:
        slug = f"{slugify(body.name)}-{n}"
        n += 1

    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO products (slug, name, category_id, base_price, discount_pct, "
            "rating, sold, tags, image, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (slug, body.name.strip(), body.category, body.basePrice,
             body.discountPct, body.rating, body.sold,
             json.dumps(body.tags, ensure_ascii=False),
             body.image or "/images/logo.svg", body.desc.strip()),
        )
        conn.commit()
        pid = cur.lastrowid

    product = {
        "id": pid, "slug": slug, "name": body.name.strip(),
        "category": body.category, "basePrice": body.basePrice,
        "discountPct": body.discountPct, "rating": body.rating,
        "sold": body.sold, "tags": body.tags,
        "image": body.image or "/images/logo.svg", "desc": body.desc.strip(),
    }
    return {"ok": True, "product": product}


@router.patch("/products/{slug}")
def update_product(slug: str, body: ProductPatch, _=Depends(require_admin)):
    menu = load_menu()
    product = next((p for p in menu["products"] if p["slug"] == slug), None)
    if not product:
        raise HTTPException(404, f"Không tìm thấy món {slug}")
    if body.category and body.category not in {c["id"] for c in menu["categories"]}:
        raise HTTPException(422, "Nhóm không hợp lệ")

    changes = body.model_dump(exclude_unset=True)
    db_map = {
        "name": "name", "category": "category_id",
        "basePrice": "base_price", "discountPct": "discount_pct",
        "desc": "description", "image": "image",
    }
    set_clauses, params = [], []
    for fe_key, db_key in db_map.items():
        if fe_key in changes and changes[fe_key] is not None:
            val = changes[fe_key].strip() if isinstance(changes[fe_key], str) else changes[fe_key]
            set_clauses.append(f"{db_key} = ?")
            params.append(val)
    if "tags" in changes and changes["tags"] is not None:
        set_clauses.append("tags = ?")
        params.append(json.dumps(changes["tags"], ensure_ascii=False))
    if not set_clauses:
        return {"ok": True, "product": product}
    params.append(slug)
    with get_conn() as conn:
        conn.execute(f"UPDATE products SET {', '.join(set_clauses)} WHERE slug = ?", params)

    product.update({k: changes[k] for k in changes if changes[k] is not None})
    return {"ok": True, "product": product}


@router.delete("/products/{slug}")
def delete_product(slug: str, _=Depends(require_admin)):
    with get_conn() as conn:
        cur = conn.execute("UPDATE products SET active = 0 WHERE slug = ? AND active = 1", (slug,))
        conn.commit()
    if cur.rowcount == 0:
        raise HTTPException(404, f"Không tìm thấy món {slug}")
    return {"ok": True, "deleted": slug}


# ---------------- admin: voucher (DB) ----------------

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


# ---------------- reviews ----------------

class ReviewIn(BaseModel):
    productId: int
    orderCode: str = ""
    rating: int = Field(ge=1, le=5)
    title: str = ""
    message: str = Field(min_length=5, max_length=2000)


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


# ---------------- site settings ----------------

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


class SettingsIn(BaseModel):
    settings: dict[str, str]


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


ALLOWED_VIDEO_EXT = {".mp4", ".webm", ".ogg", ".mov"}
MAX_VIDEO_MB = 50


@router.post("/admin/upload-video")
async def admin_upload_video(file: UploadFile, _=Depends(require_admin)):
    ext = Path(file.filename or "video.mp4").suffix.lower()
    if ext not in ALLOWED_VIDEO_EXT:
        raise HTTPException(400, f"Định dạng không hỗ trợ. Chỉ nhận: {', '.join(ALLOWED_VIDEO_EXT)}")
    data = await file.read()
    if len(data) > MAX_VIDEO_MB * 1024 * 1024:
        raise HTTPException(400, f"Video tối đa {MAX_VIDEO_MB}MB")
    import uuid, time
    upload_dir = Path(__file__).resolve().parents[1] / "uploads" / "videos"
    upload_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
    (upload_dir / fname).write_bytes(data)
    return {"ok": True, "url": f"/uploads/videos/{fname}"}


ALLOWED_QR_EXT = {".jpg", ".jpeg", ".png", ".webp", ".svg"}
MAX_QR_MB = 5


@router.post("/admin/upload-qr")
async def admin_upload_qr(file: UploadFile, _=Depends(require_admin)):
    ext = Path(file.filename or "qr.png").suffix.lower()
    if ext not in ALLOWED_QR_EXT:
        raise HTTPException(400, f"Chỉ nhận: {', '.join(ALLOWED_QR_EXT)}")
    data = await file.read()
    if len(data) > MAX_QR_MB * 1024 * 1024:
        raise HTTPException(400, f"Ảnh tối đa {MAX_QR_MB}MB")
    import uuid, time
    upload_dir = Path(__file__).resolve().parents[1] / "uploads" / "qrcode"
    upload_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
    (upload_dir / fname).write_bytes(data)
    return {"ok": True, "url": f"/uploads/qrcode/{fname}"}


# ---------------- loyalty & points ----------------

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


class RedeemRewardIn(BaseModel):
    rewardId: int


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


# ---------------- order status history ----------------

@router.get("/orders/{code}/history")
def order_status_history(code: str, _=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM order_status_history WHERE order_code = ? ORDER BY created_at",
            (code,),
        ).fetchall()
    return {"ok": True, "history": [dict(r) for r in rows]}


# ---------------- payments ----------------

@router.get("/orders/{code}/payments")
def order_payments(code: str, _=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM payments WHERE order_code = ? ORDER BY created_at",
            (code,),
        ).fetchall()
    return {"ok": True, "payments": [dict(r) for r in rows]}


# ---------------- notifications ----------------

@router.get("/notifications")
def list_notifications(request: Request):
    user = current_user(request)
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
            (user["id"],),
        ).fetchall()
    return {"ok": True, "notifications": [dict(r) for r in rows]}


@router.patch("/notifications/{nid}/read")
def mark_notification_read(nid: int, request: Request):
    user = current_user(request)
    with get_conn() as conn:
        conn.execute(
            "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?",
            (nid, user["id"]),
        )
        conn.commit()
    return {"ok": True}


# ---------------- audit logs (admin) ----------------

@router.get("/admin/audit-logs")
def list_audit_logs(_=Depends(require_admin)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT a.*, u.name AS user_name FROM audit_logs a "
            "LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 200"
        ).fetchall()
    return {"ok": True, "logs": [dict(r) for r in rows]}


# ---------------- branches admin ----------------

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
