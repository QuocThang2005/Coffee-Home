# Coffee Home ☕

Web đặt nước & đặt bàn quán cà phê — frontend Vite MPA (HTML/CSS/JS thuần) + backend FastAPI (giai đoạn sau).

## Tính năng frontend hiện có

- **24 trang** MPA: trang chủ, thực đơn, chi tiết món, giỏ hàng, thanh toán (nhận tại quầy / giao hàng + GPS), wishlist, tài khoản + điểm tích luỹ, đặt bàn, voucher, blog, liên hệ + bản đồ, admin dashboard...
- Giỏ hàng / wishlist / user lưu `localStorage` (`js/core/store.js`)
- Dark mode, chatbot hỏi đáp nhanh, tìm kiếm overlay, mini cart drawer
- Dữ liệu fallback từ `data/products.json` khi chưa có backend

## Chạy dự án

```bash
npm install
npm run dev        # http://localhost:5174
npm run build      # build ra dist/ (+ copy static)
npm run preview    # xem bản build
```

Backend FastAPI sẽ chạy ở cổng **8001** — dev server đã proxy sẵn `/api` và `/uploads`.

## Cấu trúc

```
├── *.html              # 24 trang
├── css/                # styles.css (theme) + responsive.css
├── js/
│   ├── main.js         # entry duy nhất, auto-import page theo data-page
│   ├── core/           # api · store · utils
│   ├── components/     # header · footer · cart · toast · chatbot...
│   ├── pages/          # logic riêng từng trang
│   └── auth/           # google-auth · facebook-auth
├── data/products.json  # dữ liệu fallback
├── images/             # svg placeholder (thay ảnh thật sau)
├── scripts/postbuild.js
└── backend/            # FastAPI (sẽ làm tiếp)
```

## Quy ước thêm trang mới

1. Tạo `<ten>.html` — nhớ set `<body data-page="ten">`
2. Tạo `js/pages/ten.js`, export default function init — `main.js` tự gọi
3. Thêm input vào `vite.config.js` không cần làm gì (tự quét `*.html`)
