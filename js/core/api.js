// Lớp API — mọi call đi qua đây.
// Backend FastAPI chưa có nên mỗi hàm thử gọi /api trước (timeout ngắn),
// thất bại thì fallback về data/products.json hoặc mock local.

const API_BASE = '/api';
const TIMEOUT = 1500;

async function req(path, options = {}, timeoutMs = TIMEOUT) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      ...options
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

/* ---------------- Hành động (mock khi chưa có backend) ---------------- */

export async function submitOrder(payload) {
  try {
    return await req('/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    }, 2000);
  } catch {
    // Mock: lưu local, trả kết quả giả lập thành công
    const { orders, user } = await import('./store.js');
    const { genCode } = await import('./utils.js');
    const order = { ...payload, code: genCode(), status: 'new', time: new Date().toISOString(), mock: true };
    orders.add(order);
    user.addPoints(Math.round(payload.total / 10000));
    return { ok: true, mock: true, code: order.code, points: Math.round(payload.total / 10000) };
  }
}

export async function submitBooking(payload) {
  try {
    return await req('/bookings', { method: 'POST', body: JSON.stringify(payload) }, 2000);
  } catch {
    const { bookings } = await import('./store.js');
    const { genCode } = await import('./utils.js');
    const booking = { ...payload, code: genCode('BK'), status: 'confirmed', mock: true };
    bookings.add(booking);
    return { ok: true, mock: true, code: booking.code };
  }
}

export async function login(email, _password) {
  try {
    return await req('/auth/login', { method: 'POST', body: JSON.stringify({ email }) });
  } catch {
    // Mock login: chấp nhận mọi email hợp lệ
    const { user } = await import('./store.js');
    const name = email.split('@')[0].replace(/[._]/g, ' ');
    const u = { name, email, points: 120, isAdmin: false };
    user.set(u);
    return { ok: true, mock: true, user: u };
  }
}

export async function register(name, email) {
  const { user } = await import('./store.js');
  const u = { name, email, points: 50, isAdmin: false };
  user.set(u);
  return { ok: true, mock: true, user: u };
}
