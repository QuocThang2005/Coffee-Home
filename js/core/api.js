// Lớp API — mọi call đi qua đây.
// Dữ liệu đọc (menu, banner...) có fallback về data/products.json khi backend
// chưa chạy; còn các hành động (đặt hàng, đặt bàn...) luôn báo lỗi thật,
// tuyệt đối không trả thành công giả.

const API_BASE = '/api';
const TIMEOUT = 15000;

// Khu vực /admin* dùng cặp khóa riêng để phiên admin KHÔNG xung đột
// với phiên khách hàng trong cùng trình duyệt.
const authKey = () => (location.pathname.startsWith('/admin') ? 'ch_admin_token' : 'ch_token');

function authHeaders(extra = {}) {
  const t = localStorage.getItem(authKey());
  return t ? { ...extra, Authorization: `Bearer ${t}` } : extra;
}

async function req(path, options = {}, timeoutMs = TIMEOUT) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const isForm = options.body instanceof FormData;
    const defaultHeaders = isForm ? {} : { 'Content-Type': 'application/json' };
    const res = await fetch(API_BASE + path, {
      ...options,
      headers: authHeaders({ ...defaultHeaders, ...(options.headers || {}) }),
      signal: ctrl.signal
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        const d = body?.detail;
        if (typeof d === 'string') msg = d;
        else if (Array.isArray(d)) {
          // FastAPI 422: liệt kê từng ô bị từ chối cho dễ hiểu
          msg = d.map(e => {
            const field = (e.loc || []).slice(-1)[0];
            const reason = String(e.msg || '').replace(/^Value error,\s*/, '');
            return field ? `${field}: ${reason}` : reason;
          }).join(' · ');
        }
      } catch { /* giữ nguyên HTTP status */ }
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- Dữ liệu menu ---------------- */

let cache = null;

export async function getMenu(force = false) {
  if (cache && !force) return cache;
  try {
    const data = await req('/drinks');
    if (Array.isArray(data?.products)) cache = data;
  } catch { /* chưa có backend */ }
  if (!cache) {
    const res = await fetch('/data/products.json');
    cache = await res.json();
  }
  return cache;
}

export async function getProduct(slug) {
  const menu = await getMenu();
  return menu.products.find(p => p.slug === slug) || null;
}

export async function getBranches() {
  const menu = await getMenu();
  return menu.branches;
}

export async function getVouchers() {
  const menu = await getMenu();
  return menu.vouchers;
}

export function priceOf(p, sizeExtra = 0, toppings = []) {
  const base = Math.round(p.basePrice * (1 - (p.discountPct || 0) / 100));
  return base + sizeExtra + toppings.reduce((s, t) => s + t.price, 0);
}

/* ---------------- Hành động ---------------- */

// LƯU Ý: không có chế độ mock — đặt hàng/đặt bàn thất bại phải báo lỗi thật,
// tuyệt đối không trả thành công giả (trước đây làm dữ liệu mất bí mật).

export async function submitOrder(payload) {
  return req('/orders', {
    method: 'POST',
    body: JSON.stringify(payload)
  }, 15000);
}

export async function submitBooking(payload) {
  return req('/bookings', { method: 'POST', body: JSON.stringify(payload) }, 15000);
}

/* ---------------- Gọi món tại bàn (QR) ---------------- */

export async function validateTable(tableId, token) {
  return req(`/tables/${encodeURIComponent(tableId)}/validate?token=${encodeURIComponent(token)}`, {}, 4000);
}

let _adminWs = null;

/**
 * Kết nối WebSocket admin — nhận sự kiện new_order / status_changed real-time.
 * Trả về { close() } để ngắt kết nối khi离开 trang.
 */
export function connectAdminWS(onEvent) {
  if (_adminWs) _adminWs.close();
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws/admin`);
  _adminWs = ws;
  ws.onmessage = (ev) => {
    try { onEvent(JSON.parse(ev.data)); } catch { /* bỏ qua */ }
  };
  ws.onerror = () => {};
  ws.onclose = () => { _adminWs = null; };
  return { close() { ws.close(); _adminWs = null; } };
}

export async function login(email, password) {
  const res = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }, 2500);
  if (res.token) localStorage.setItem(authKey(), res.token); // admin area -> khóa riêng
  return res;
}

export async function googleLogin(credential) {
  const res = await req('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential })
  }, 6000);
  if (res.token) localStorage.setItem(authKey(), res.token);
  return res;
}

export async function register(name, email, password) {
  const res = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password })
  }, 2500);
  if (res.token) localStorage.setItem(authKey(), res.token);
  return res;
}

export async function fetchMe() {
  return req('/auth/me', {}, 2000);
}

export async function logoutApi() {
  try { await req('/auth/logout', { method: 'POST' }, 1500); } catch { /* bỏ qua */ }
}

/* ---------------- Admin ---------------- */

export async function getAdminStats() {
  return req('/admin/stats', {}, 2500);
}

export async function getRevenueStats(period = 'week') {
  return req(`/admin/stats/revenue?period=${encodeURIComponent(period)}`, {}, 2500);
}

export async function adminOrders(status = '') {
  return req(`/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`, {}, 2500);
}

export async function setOrderStatus(code, status) {
  return req(`/orders/${encodeURIComponent(code)}/status?status=${status}`, { method: 'PATCH' }, 2500);
}

export async function adminBookings() {
  return req('/bookings', {}, 2500);
}

export async function setBookingStatus(code, status) {
  return req(`/bookings/${encodeURIComponent(code)}/status?status=${status}`, { method: 'PATCH' }, 2500);
}

export async function adminUsers() {
  return req('/users', {}, 2500);
}

export async function createProduct(payload) {
  return req('/products', { method: 'POST', body: JSON.stringify(payload) }, 3000);
}

export async function updateProduct(slug, payload) {
  return req(`/products/${encodeURIComponent(slug)}`, { method: 'PATCH', body: JSON.stringify(payload) }, 3000);
}

export async function deleteProduct(slug) {
  return req(`/products/${encodeURIComponent(slug)}`, { method: 'DELETE' }, 3000);
}

export async function createVoucher(payload) {
  return req('/vouchers', { method: 'POST', body: JSON.stringify(payload) }, 3000);
}

export async function updateVoucher(code, payload) {
  return req(`/vouchers/${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify(payload) }, 3000);
}

export async function deleteVoucher(code) {
  return req(`/vouchers/${encodeURIComponent(code)}`, { method: 'DELETE' }, 3000);
}

// ---- ung tuyen (tuyen dung) ----
export async function submitApplication(payload) {
  return req('/applications', { method: 'POST', body: JSON.stringify(payload) }, 4000);
}
export async function adminApplications() {
  return req('/applications', {}, 2500);
}
export async function setApplicationStatus(id, status) {
  return req(`/applications/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PATCH' }, 2500);
}
export async function setApplicationReply(id, reply) {
  return req(`/applications/${id}/reply`, { method: 'PATCH', body: JSON.stringify({ reply }) }, 2500);
}
export async function setOrderReply(code, reply) {
  return req(`/orders/${encodeURIComponent(code)}/reply`, { method: 'PATCH', body: JSON.stringify({ reply }) }, 2500);
}
export async function setBookingReply(code, reply) {
  return req(`/bookings/${encodeURIComponent(code)}/reply`, { method: 'PATCH', body: JSON.stringify({ reply }) }, 2500);
}

// ---- lich su ca nhan (don/ban cua toi) ----
export async function getMyOrders() {
  const res = await req('/orders/mine', {}, 4000);
  return res.orders || [];
}
export async function getOrder(code) {
  return req(`/orders/${encodeURIComponent(code)}`, {}, 5000);
}
export async function getMyBookings() {
  const res = await req('/bookings/mine', {}, 4000);
  return res.bookings || [];
}
export async function cancelMyBooking(code) {
  return req(`/bookings/mine/${encodeURIComponent(code)}/cancel`, { method: 'PATCH' }, 4000);
}

// ---- phan hoi khach hang ----
export async function submitFeedback(payload) {
  return req('/feedbacks', { method: 'POST', body: JSON.stringify(payload) }, 4000);
}
export async function adminFeedbacks() {
  return req('/feedbacks', {}, 2500);
}
export async function setFeedbackStatus(id, status) {
  return req(`/feedbacks/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PATCH' }, 2500);
}

// ---- danh gia san pham ----
export async function getProductReviews(productId) {
  return req(`/products/${productId}/reviews`, {}, 5000);
}
export async function submitReview(payload) {
  return req('/reviews', { method: 'POST', body: JSON.stringify(payload) }, 5000);
}
export async function adminReviews() {
  return req('/reviews', {}, 2500);
}
export async function setReviewStatus(id, status) {
  return req(`/reviews/${id}/status?status=${encodeURIComponent(status)}`, { method: 'PATCH' }, 2500);
}
export async function deleteReview(id) {
  return req(`/reviews/${id}`, { method: 'DELETE' }, 2500);
}

// ---- site settings ----
let _settingsCache = null;
let _settingsTs = 0;
export async function getSettings(force = false) {
  const now = Date.now();
  if (_settingsCache && !force && now - _settingsTs < 60000) return _settingsCache;
  try {
    const res = await req('/settings', {}, 3000);
    _settingsCache = res.settings || {};
    _settingsTs = now;
  } catch {
    _settingsCache = _settingsCache || {};
  }
  return _settingsCache;
}
export async function adminGetSettings() {
  return req('/admin/settings', {}, 3000);
}
export async function adminUpdateSettings(settings) {
  return req('/admin/settings', { method: 'PUT', body: JSON.stringify({ settings }) }, 5000);
}
export async function adminUploadVideo(file) {
  const fd = new FormData();
  fd.append('file', file);
  return req('/admin/upload-video', { method: 'POST', body: fd }, 60000);
}
export async function adminUploadQR(file) {
  const fd = new FormData();
  fd.append('file', file);
  return req('/admin/upload-qr', { method: 'POST', body: fd }, 30000);
}
