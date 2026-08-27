# Coffee Home ☕

Web đặt nước & đặt bàn quán cà phê — frontend Vite MPA (HTML/CSS/JS thuần) + backend FastAPI.

**Công nghệ:** Vite · JavaScript ES modules (không framework) · FastAPI · SQLite · Google Identity Services · Font Awesome tự host.

## Tính năng

**Khách hàng**
- Đặt nước (giỏ hàng, voucher, giao hàng / mang đi) & đặt bàn theo chi nhánh
- Đăng nhập thường + **Google OAuth 2.0**, phiên khách/admin tách biệt an toàn
- Trang tài khoản: lịch sử đơn/bàn **cập nhật trạng thái realtime** (polling 15s có thông báo khi quán xác nhận → pha chế → ship → hoàn tất)
- Tuyển dụng: nộp đơn làm việc; Liên hệ: gửi đánh giá sao kèm phản hồi

**Quản trị** (`/admin.html` — 1 file JS, ~8 view)
- Dashboard thống kê doanh thu/đơn/bàn, quản lý sản phẩm & tồn kho, voucher, khách hàng
- Xử lý đơn/bàn: đổi trạng thái + ghi **phản hồi nội bộ** hiển thị về phía khách
- Duyệt/từ chối hồ sơ ứng tuyển, xem & phân loại phản hồi khách hàng (mới/đã đọc/ẩn)

## Chạy dự án (1 lệnh duy nhất)

> **Double-click `start-coffee.bat`** — hoặc trong terminal:

```bash
npm run start
```

- Frontend : http://localhost:5174
- Admin    : http://localhost:5174/admin-login.html  (`admin` / `admin123`)
- Backend  : http://localhost:8010/docs

⚠️ **Đóng cửa sổ server = tắt web.** Trang chỉ hoạt động khi server đang chạy.
⚠️ Chỉ mở trang qua **http://localhost:5174** — không mở file .html trực tiếp từ ổ đĩa.

## Cấu hình cổng — 1 nơi duy nhất

Sửa **`config.json`** ở thư mục gốc (`frontendPort`, `backendPort`) — vite và start-all tự đọc.

## Lệnh khác

```bash
npm run dev        # chỉ chạy frontend (không cần backend)
npm run build      # build ra dist/ (+ copy static)
npm run preview    # xem bản build
```

Dự liệu mẫu cho dashboard admin:

```powershell
cd coffee_backend
.venv\Scripts\python.exe seed_demo.py --force   # nạp đơn/bàn/khách hàng mẫu
```

## Cấu trúc

```
├── config.json            # ⚙️ port frontend/backend (chỉnh tại đây)
├── start-coffee.bat       # 🚀 double-click để chạy tất cả
├── *.html                 # ~24 trang MPA
├── css/                   # styles.css (theme) + responsive.css
├── js/
│   ├── main.js            # entry, auto-import page theo data-page
│   ├── core/              # api · store · utils (token: ch_token khách / ch_admin_token quản trị)
│   ├── components/        # header · footer · cart · toast · chatbot...
│   └── pages/             # logic riêng từng trang (admin.js = dashboard)
├── vendor/fontawesome/    # font-awesome TỰ HOST (không phụ thuộc CDN)
├── data/products.json     # thực đơn + voucher (backend đọc/ghi trực tiếp)
├── scripts/               # start-all.js · postbuild.js
├── debug-admin.html       # trang kiểm tra API nhanh (mở qua :5174)
└── coffee_backend/        # FastAPI + SQLite — auth, orders, bookings,
                            # applications, feedbacks, replies (data/coffee.db)
```

## Quy ước thêm trang mới

1. Tạo `<ten>.html` — nhớ set `<body data-page="ten">`
2. Tạo `js/pages/ten.js`, export default function init — `main.js` tự gọi
3. Vite tự quét `*.html`, không cần sửa gì thêm
lệnh chạy font + back + docker
$env:GEMINI_API_KEY="your-api-key-here"
npm run start