// Tài khoản: hồ sơ · đơn hàng · đặt bàn · điểm · địa chỉ (+ map)
import { $, $$, formatVND, escapeHtml, getParam, toast } from '../core/utils.js';
import { user, orders, bookings } from '../core/store.js';
import { getMenu } from '../core/api.js';

const STATUS_VN = {
  new: '<span class="status-pill st-new">Mới</span>',
  preparing: '<span class="status-pill st-preparing">Đang pha</span>',
  ready: '<span class="status-pill st-ready">Sẵn sàng</span>',
  shipping: '<span class="status-pill st-shipping">Đang giao</span>',
  done: '<span class="status-pill st-done">Hoàn tất</span>',
  cancel: '<span class="status-pill st-cancel">Đã huỷ</span>'
};

function initTabs() {
  const btns = $$('.tab-btn');
  const show = (name) => {
    btns.forEach(b => b.classList.toggle('on', b.dataset.tab === name));
    $$('.tab-pane').forEach(pn =>
      pn.classList.toggle('on', pn.id === `tab-${name}`));
  };
  btns.forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
  const fromUrl = getParam('tab');
  show(fromUrl || 'profile');
}

function renderOrders(menu) {
  const list = orders.get();
  const el = $('#orders-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-receipt"></i>
      <h3>Chưa có đơn nào</h3><p>Đơn đầu tiên sẽ cho bạn 50 điểm chào mừng đó!</p>
      <a class="btn btn-primary mt-2" href="/menu.html">Đặt nước ngay</a></div>`;
    return;
  }
  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Mã đơn</th><th>Món</th><th>Nhận</th><th>Tổng</th><th>Trạng thái</th></tr></thead>
      <tbody>${list.map(o => `
        <tr>
          <td><strong>${o.code}</strong></td>
          <td>${o.items.map(i => `${i.qty}× ${escapeHtml(i.name)}`).join('<br>')}</td>
          <td>${o.method === 'pickup'
            ? `${escapeHtml(o.branchName || '')}<br><small class="muted">${o.time || ''}</small>`
            : `Giao:<br><small class="muted">${escapeHtml(o.address || '')}</small>`}</td>
          <td>${formatVND(o.total)}</td>
          <td>${STATUS_VN[o.status] || STATUS_VN.new}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}

function renderBookings() {
  const list = bookings.get();
  const el = $('#bookings-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-chair"></i>
      <h3>Chưa có lượt đặt bàn nào</h3>
      <a class="btn btn-primary mt-2" href="/booking.html">Đặt bàn trước</a></div>`;
    return;
  }
  el.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Mã</th><th>Chi nhánh</th><th>Thời gian</th><th>Số khách</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody>${list.map(b => `
        <tr>
          <td><strong>${b.code}</strong></td>
          <td>${escapeHtml(b.branchName)}</td>
          <td>${b.date} · ${b.time}</td>
          <td>${b.guests} khách</td>
          <td>${b.status === 'cancel' ? STATUS_VN.cancel : STATUS_VN.ready}</td>
          <td>${b.status !== 'cancel' ? `<button class="btn btn-sm btn-outline" data-cancel="${b.code}">Huỷ bàn</button>` : ''}</td>
        </tr>`).join('')}</tbody>
    </table>`;

  $$('[data-cancel]', el).forEach(btn => btn.addEventListener('click', () => {
    bookings.cancel(btn.dataset.cancel);
    toast('Đã huỷ bàn. Hẹn gặp bạn lần sau!', 'warn');
    renderBookings();
  }));
}

function renderPoints(list) {
  // lịch sử điểm: chào mừng + mỗi mock/mock order
  const rows = [{ time: 'Tài khoản mới', label: 'Điểm chào mừng 🎉', points: 50 }];
  orders.get().forEach((o, i) => {
    rows.push({ time: new Date(o.time).toLocaleString('vi-VN'), label: `Đơn ${o.code}`, points: Math.round((o.total || 0) / 10000) });
  });

  $('#points-history').innerHTML = `
    <table class="data-table">
      <thead><tr><th>Thời gian</th><th>Nội dung</th><th>Điểm</th></tr></thead>
      <tbody>${rows.map(r => `
        <tr><td>${r.time}</td><td>${r.label}</td>
        <td style="color:var(--c-success);font-weight:700">+${r.points}</td></tr>`).join('')}</tbody>
    </table>`;
}

function renderAddresses() {
  const addresses = [
    { icon: 'fa-house', title: 'Nhà', detail: '25 Hoa Sữa, P.7, Phú Nhuận — mặc định' },
    { icon: 'fa-building', title: 'Công ty', detail: 'Lô T2-7 đường D1, Khu công nghệ cao, Thủ Đức' },
    { icon: 'fa-school', title: 'Trường', detail: '227 Nguyễn Văn Cừ, Q.5' }
  ];
  $('#address-list').innerHTML = addresses.map(a => `
    <div class="info-card">
      <div class="ic-icon"><i class="fa-solid ${a.icon}"></i></div>
      <h3>${a.title}</h3>
      <p>${a.detail}</p>
    </div>`).join('');
}

export default async function init() {
  // chưa đăng nhập -> login
  if (!user.isLoggedIn()) {
    location.href = '/login.html';
    return;
  }

  const u = user.get();
  $('#acc-hi').textContent = u.name;
  $('#acc-points-num').textContent = u.points ?? 0;

  $('#pf-name').value = u.name;
  $('#pf-email').value = u.email;
  $('#pf-phone').value = u.phone || '';

  document.getElementById('profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    u.name = $('#pf-name').value.trim() || u.name;
    u.phone = $('#pf-phone').value.trim();
    user.set(u);
    toast('Đã lưu thông tin!', 'success');
  });

  const menu = await getMenu();
  renderOrders(menu);
  renderBookings();
  renderPoints();
  renderAddresses();
  initTabs();

  // map nhẹ ở tab địa chỉ (Leaflet nếu load được)
  try {
    if (typeof L !== 'undefined') {
      const map = L.map('acc-map').setView([10.7930, 106.6900], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);
    }
  } catch { /* offline thì bỏ qua */ }
}
