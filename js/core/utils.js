// Tiện ích dùng chung toàn trang

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function formatVND(n) {
  return Number(n || 0).toLocaleString('vi-VN') + '₫';
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// "4.8" -> chuỗi sao Font Awesome
export function starHtml(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.4;
  let html = '';
  for (let i = 0; i < full; i++) html += '<i class="fa-solid fa-star"></i>';
  if (half) html += '<i class="fa-solid fa-star-half-stroke"></i>';
  for (let i = full + (half ? 1 : 0); i < 5; i++) html += '<i class="fa-regular fa-star"></i>';
  return html;
}

// Bắn toast toàn cục — components/toast.js lắng nghe và hiển thị
export function toast(msg, type = 'info', timeout = 2800) {
  window.dispatchEvent(new CustomEvent('toast', {
    detail: { msg, type, timeout }
  }));
}

// Chọn 1 phần tử ngẫu nhiên (dùng cho dữ liệu mock)
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Mã đơn/đặt bàn dạng CH-XXXXXX
export function genCode(prefix = 'CH') {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
