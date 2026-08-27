CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- Use individual INSERT OR IGNORE for SQLite compatibility
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('marquee_enabled', '1');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('marquee_text', 'Tuần này: giảm 15% Phin Sữa Đá · Freeship đơn từ 50k (mã FREESHIP) · Tích điểm x2 cuối tuần');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('marquee_bg', 'var(--c-primary)');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('marquee_color', '#fff');

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('payment_cod_enabled', '1');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('payment_bank_enabled', '1');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('payment_bank_name', 'MB Bank');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('payment_bank_number', '984318931843');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('payment_bank_holder', 'CÔNG TY TNHH COFFEE HOME');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('payment_bank_branch', 'TP.HCM');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('payment_momo_enabled', '1');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('payment_momo_number', '');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('payment_momo_name', 'Coffee Home');

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('ship_fee', '20000');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('ship_free_min_order', '50000');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('ship_free_radius_km', '5');

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_name', 'Coffee Home');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_tagline', 'Cà phê nhà làm - đậm đà Việt Nam');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_hotline', '1900 1234');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_email', 'hello@coffeehome.vn');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_hours_weekday', '06:30 - 22:30');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_hours_saturday', '07:00 - 23:00');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_hours_sunday', '07:00 - 22:00');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_copyright', 'Coffee Home. Đồ án web - làm với ❤️ tại TP.HCM.');

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_facebook', '');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_instagram', '');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_tiktok', '');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_youtube', '');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_google_maps', '');

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_1_enabled', '1');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_1_title', 'Phin Sữa Đá - Gu nhà là đây');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_1_sub', 'Đậm đà chuẩn vị, giảm ngay 15% tuần này');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_1_cta', 'Đặt ngay');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_1_link', '/pages/product.html?id=phin-sua-da');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_1_image', '/images/menu/banner1.jpg');

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_2_enabled', '1');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_2_title', 'Đặt bàn trước - Đón ưu đãi');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_2_sub', 'Giữ chỗ miễn phí tại 3 chi nhánh, tích điểm x2 cuối tuần');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_2_cta', 'Đặt bàn');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_2_link', '/pages/booking.html');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_2_image', '/images/menu/banner2.jpg');

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_3_enabled', '1');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_3_title', 'Thành viên Coffee Home');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_3_sub', 'Tích điểm đổi quà, voucher độc quyền mỗi tháng');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_3_cta', 'Tham gia');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_3_link', '/auth/register.html');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('banner_3_image', '/images/menu/banner3.jpg');
