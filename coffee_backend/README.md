# Coffee Home — Backend API

FastAPI phục vụ frontend `coffee_home` (Vite dev tại cổng 5174, proxy `/api` và `/uploads` sang đây).

## Chạy

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8010 --reload
```

- Swagger UI: http://localhost:8010/docs
- Health: http://localhost:8010/api/health

## Endpoint chính

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/drinks` | Thực đơn đầy đủ (đọc từ `../coffee_home/data/products.json`) |
| POST | `/api/orders` | Tạo đơn hàng → `{ok, code, points}` |
| PATCH | `/api/orders/{code}/status?status=` | Đổi trạng thái đơn (admin) |
| POST | `/api/bookings` | Đặt bàn → `{ok, code}` |
| PATCH | `/api/bookings/{code}/status?status=` | Xác nhận/huỷ bàn (admin) |
| POST | `/api/auth/register` | Đăng ký (+50 điểm) → `{token, user}` |
| POST | `/api/auth/login` | Đăng nhập → `{token, user}` |
| GET | `/api/auth/me` | Thông tin user theo Bearer token |
| POST | `/api/auth/logout` | Đăng xuất (xoá token) |
| GET | `/api/admin/stats` | KPI tổng quan + doanh thu 7 ngày + món bán chạy (admin) |
| GET | `/api/users` | Danh sách khách hàng (admin) |
| POST/PATCH/DELETE | `/api/products[/{slug}]` | CRUD sản phẩm — ghi ra `products.json` (admin) |
| POST/PATCH/DELETE | `/api/vouchers[/{code}]` | CRUD voucher — ghi ra `products.json` (admin) |

Các endpoint admin yêu cầu header `Authorization: Bearer <token>` của tài khoản có quyền quản trị.

## Quản trị viên mặc định

Lần chạy đầu, hệ thống tự tạo tài khoản quản trị:

```
email:    admin@coffeehome.vn
password: lấy từ ADMIN_PASSWORD (biến môi trường) hoặc adminPassword (config.json)
          — nếu không cấu hình gì sẽ là admin123 (kèm cảnh báo trong log)
```

Hãy đặt `adminPassword` trong `config.json` trước khi chạy lần đầu để tránh dùng mật khẩu mặc định.

## Phiên đăng nhập

Token hết hạn sau **30 ngày**; token cũ tự bị dọn khi khởi động server.

## Lưu ý

- Dữ liệu lưu SQLite tại `data/coffee.db` (tự khởi tạo lần chạy đầu).
- Thực đơn lấy trực tiếp từ frontend nên sửa `products.json` là backend phản ánh ngay.
- Đơn/đặt bàn của **khách vãng lai không cần đăng nhập** vẫn tạo được; nếu có Bearer token thì đơn được gắn với user và cộng điểm.
