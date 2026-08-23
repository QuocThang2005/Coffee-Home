// Admin dashboard — dữ liệu demo gộp với đơn/đặt bàn thật từ localStorage
import { $, $$, formatVND, escapeHtml, toast } from '../core/utils.js';
import { user, orders, bookings } from '../core/store.js';
import { getMenu, getVouchers } from '../core/api.js';

const STATUS = {
  new: ['st-new', 'Mới'], preparing: ['st-preparing', 'Đang pha'],
  ready: ['st-ready', 'Sẵn sàng'], shipping: ['st-shipping', 'Đang giao'],
  done: ['st-done', 'Hoàn tất'], cancel: ['st-cancel', 'Đã huỷ']
};

const TITLES = {
  overview: 'Tổng quan hôm nay', orders: 'Quản lý đơn hàng', products: 'Quản lý sản phẩm',
  bookings: 'Lượt đặt bàn', promos: 'Khuyến mãi', customers: 'Khách hàng'
};

// ---- dữ liệu demo ----
const DEMO_ORDERS = [
  { code: 'CH-D9001', customer: { name: 'Nguyễn Thị Lan' }, method: 'delivery', items: [{ qty: 2, name: 'Phin Sữa Đá' }, { qty: 1, name: 'Bánh Mì Que' }], total: 84000, status: 'new', time: '08:12', branchName: null },
  { code: 'CH-D9002', customer: { name: 'Trần Văn Hùng' }, method: 'pickup', branchName: 'CN Nguyễn Huệ', items: [{ qty: 1, name: 'Trà Đào Cam Sả' }], total: 35000, status: 'preparing', time: '08:25', address: null },
  { code: 'CH-D9003', customer: { name: 'Lê Minh Châu' }, method: 'delivery', items: [{ qty: 3, name: 'Trà Sữa Trân Châu' }], total: 129000, status: 'shipping', time: '08:31', address: '25 Hoa Sữa, Phú Nhuận' },
  { code: 'CH-D9004', customer: { name: 'Phạm Khánh Linh' }, method: 'pickup', branchName: 'CN Thảo Điền', items: [{ qty: 1, name: 'Cold Brew Tonic' }, { qty: 1, name: 'Bánh Flan' }], total: 67000, status: 'done', time: '07:58', address: null }
];

const DEMO_BOOKINGS = [
  { code: 'BK-A001', branchName: 'CN Nguyễn Huệ', date: '2026-08-24', time: '18:00', guests: 4, name: 'Nhóm sinh nhật Mai', phone: '09xx111222', note: 'Sinh nhật — cần nến', status: 'confirmed' },
  { code: 'BK-A002', branchName: 'CN Thảo Điền', date: '2026-08-24', time: '10:00', guests: 2, name: 'Ông Bảy', phone: '09xx333444', note: '', status: 'confirmed' }
];

const DEMO_CUSTOMERS = [
  { name: 'Kim Ngân', email: 'ngan@gmail.com', points: 1240, tier: 'Vàng', ordersCount: 38 },
  { name: 'Hữu Đạt', email: 'dat@yahoo.com', points: 320, tier: 'Bạc', ordersCount: 9 },
  { name: 'Thùy Trang', email: 'trang@outlook.com', points: 2650, tier: 'Kim cương', ordersCount: 71 },
  { name: 'Gia Bảo', email: 'bao@gmail.com', points: 85, tier: 'Bạc', ordersCount: 3 }
];

let allOrders = [];
let allBookings = [];
let menu = null;

function pill(status) {
  const [cls, label] = STATUS[status] || STATUS.new;
  return `<span class="status-pill ${cls}">${label}</span>`;
}

/* ---------------- Tổng quan ---------------- */
function renderOverview() {
  const todayOrders = allOrders.filter(o => o.status !== 'cancel');
  const revenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
  const upcoming = allBookings.filter(b => b.status === 'confirmed').length;

  $('#view-overview').innerHTML = `
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-icon" style="background:#e7f3ea;color:var(--c-success)"><i class="fa-solid fa-sack-dollar"></i></div>
        <div><div class="kpi-num">${formatVND(revenue)}</div><div class="kpi-label">Doanh thu hôm nay</div></div></div>
      <div class="kpi"><div class="kpi-icon" style="background:#e8f0fd;color:#2563eb"><i class="fa-solid fa-receipt"></i></div>
        <div><div class="kpi-num">${todayOrders.length}</div><div class="kpi-label">Đơn hàng</div></div></div>
      <div class="kpi"><div class="kpi-icon" style="background:#fdf1dd;color:#b97a1c"><i class="fa-solid fa-chair"></i></div>
        <div><div class="kpi-num">${upcoming}</div><div class="kpi-label">Bàn đã đặt</div></div></div>
      <div class="kpi"><div class="kpi-icon" style="background:#f0e9fb;color:#7c3aed"><i class="fa-solid fa-mug-hot"></i></div>
        <div><div class="kpi-num">${todayOrders.reduce((s, o) => s + o.items.reduce((x, i) => x + i.qty, 0), 0)}</div>
        <div class="kpi-label">Ly nước bán ra</div></div></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Doanh thu 7 ngày gần nhất</h3><span class="muted" style="font-size:.82rem">demo</span></div>
      <div class="chart-bars" id="admin-chart"></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Đơn mới nhất</h3><button class="btn btn-sm btn-outline" data-goto="orders">Xem tất cả →</button></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Mã</th><th>Khách</th><th>Món</th><th>Tổng</th><th>Trạng thái</th></tr></thead>
          <tbody>${allOrders.slice(0, 5).map(orderRow).join('')}</tbody>
        </table>
      </div>
    </div>`;

  // chart
  const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const values = [1250000, 980000, 1420000, 1105000, 1680000, 2250000, 1890000];
  const max = Math.max(...values);
  $('#admin-chart').innerHTML = values.map((v, i) => `
    <div class="chart-bar" style="height:${Math.round(v / max * 100)}%"
         title="${formatVND(v)}"><small>${days[i]}</small></div>`).join('');
}

function orderRow(o) {
  return `
  <tr>
    <td><strong>${o.code}</strong><br><small class="muted">${o.time || ''}</small></td>
    <td>${escapeHtml(o.customer?.name || 'Khách lẻ')}
      ${o.method ? `<br><small class="muted"><i class="fa-solid ${o.method === 'pickup' ? 'fa-store' : 'fa-truck-fast'}"></i> ${o.method === 'pickup' ? escapeHtml(o.branchName || '') : 'giao hàng'}</small>` : ''}</td>
    <td>${o.items.map(i => `${i.qty}× ${escapeHtml(i.name)}`).join('<br>')}</td>
    <td><strong>${formatVND(o.total)}</strong></td>
    <td>${pill(o.status)}</td>
  </tr>`;
}

/* ---------------- Đơn hàng ---------------- */
function renderOrders() {
  $('#view-orders').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>${allOrders.length} đơn hàng</h3></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Mã · Giờ</th><th>Khách</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead>
          <tbody>${allOrders.map((o, i) => `
            <tr>
              <td><strong>${o.code}</strong><br><small class="muted">${o.time || new Date(o.time).toLocaleTimeString('vi-VN') || ''}</small></td>
              <td>${escapeHtml(o.customer?.name || 'Khách lẻ')}<br>
                <small class="muted">${o.method === 'pickup' ? 'Tại quán: ' + escapeHtml(o.branchName || '') : 'Giao: ' + escapeHtml(o.address || '')}</small></td>
              <td>${o.items.map(it => `${it.qty}× ${escapeHtml(it.name)}`).join('<br>')}</td>
              <td><strong>${formatVND(o.total)}</strong></td>
              <td><select class="input" data-status-i="${i}" style="width:auto;padding:7px 10px">
                ${Object.entries(STATUS).map(([k, v]) =>
                  `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v[1]}</option>`).join('')}
              </select></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

/* ---------------- Sản phẩm ---------------- */
function renderProducts() {
  $('#view-products').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>${menu.products.length} món trong thực đơn</h3>
        <span class="muted" style="font-size:.82rem">Chỉnh sửa sẽ lưu tạm local tới khi có backend</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Sản phẩm</th><th>Nhóm</th><th>Giá gốc</th><th>Giảm</th><th>Đã bán</th><th></th></tr></thead>
          <tbody>${menu.products.map(p => `
            <tr>
              <td style="display:flex;align-items:center;gap:11px;min-width:190px">
                <img src="${p.image}" width="44" height="44" style="border-radius:8px" alt="">
                <strong>${escapeHtml(p.name)}</strong></td>
              <td>${escapeHtml(menu.categories.find(c => c.id === p.category)?.name || p.category)}</td>
              <td>${formatVND(p.basePrice)}</td>
              <td>${p.discountPct ? `-${p.discountPct}%` : '—'}</td>
              <td>${p.sold.toLocaleString('vi-VN')}</td>
              <td><button class="btn btn-sm btn-outline" data-edit="${p.slug}"><i class="fa-solid fa-pen"></i> Sửa</button></td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

function openProductModal(slug) {
  const p = menu.products.find(x => x.slug === slug);
  if (!p) return;
  const backdrop = $('#modal-backdrop');
  backdrop.hidden = false;
  requestAnimationFrame(() => backdrop.classList.add('show'));
  backdrop.innerHTML = `
    <div class="modal">
      <h3>Sửa: ${escapeHtml(p.name)}</h3>
      <div class="form-group"><label>Giá gốc (₫)</label><input class="input" id="mp-price" type="number" value="${p.basePrice}"></div>
      <div class="form-group"><label>Giảm giá (%)</label><input class="input" id="mp-disc" type="number" value="${p.discountPct}" min="0" max="90"></div>
      <div class="form-group"><label>Mô tả</label><textarea class="input" id="mp-desc" rows="3">${escapeHtml(p.desc)}</textarea></div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="mp-cancel">Huỷ</button>
        <button class="btn btn-primary" id="mp-save">Lưu thay đổi</button>
      </div>
    </div>`;

  $('#mp-cancel').onclick = closeModal;
  backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };
  $('#mp-save').onclick = () => {
    p.basePrice = Number($('#mp-price').value) || p.basePrice;
    p.discountPct = Math.max(0, Math.min(90, Number($('#mp-disc').value) || 0));
    p.desc = $('#mp-desc').value.trim() || p.desc;
    localStorage.setItem('ch_admin_products', JSON.stringify(
      Object.fromEntries(menu.products.map(x => [x.slug, { basePrice: x.basePrice, discountPct: x.discountPct, desc: x.desc }]))
    ));
    toast(`Đã lưu "${p.name}" (local demo)`, 'success');
    closeModal();
    renderProducts();
  };
}

function closeModal() {
  const backdrop = $('#modal-backdrop');
  backdrop.classList.remove('show');
  setTimeout(() => { backdrop.hidden = true; }, 250);
}

/* ---------------- Đặt bàn ---------------- */
function renderBookings() {
  $('#view-bookings').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>${allBookings.length} lượt đặt bàn</h3></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Mã</th><th>Khách</th><th>Chi nhánh</th><th>Thời gian</th><th>Khách</th><th>Ghi chú</th><th>Trạng thái</th></tr></thead>
          <tbody>${allBookings.map(b => `
            <tr>
              <td><strong>${b.code}</strong></td>
              <td>${escapeHtml(b.name)}<br><small class="muted">${escapeHtml(b.phone || '')}</small></td>
              <td>${escapeHtml(b.branchName)}</td>
              <td>${b.date} · ${b.time}</td>
              <td>${b.guests}</td>
              <td>${escapeHtml(b.note || '—')}</td>
              <td>${b.status === 'cancel'
                ? '<span class="status-pill st-cancel">Đã huỷ</span>'
                : '<span class="status-pill st-ready">Xác nhận</span>'}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

/* ---------------- Khuyến mãi & khách hàng ---------------- */
function renderPromos(vouchers) {
  $('#view-promos').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>${vouchers.length} mã khuyến mãi đang chạy</h3></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Mã</th><th>Tiêu đề</th><th>Kiểu</th><th>Giá trị</th><th>Điều kiện</th><th>HSD</th></tr></thead>
          <tbody>${vouchers.map(v => `
            <tr>
              <td><span class="voucher-code">${v.code}</span></td>
              <td>${escapeHtml(v.title)}<br><small class="muted">${escapeHtml(v.desc)}</small></td>
              <td>{{{TYPE}}}</td>
              <td>${v.type === 'percent' ? v.value + '%' : v.type === 'fixed' ? formatVND(v.value) : '—'}</td>
              <td>${v.minOrder ? formatVND(v.minOrder) : 'Không'}</td>
              <td>${v.until}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`.replace('{{{TYPE}}}', '');
  // điền kiểu voucher
  $$('#view-promos tbody tr').forEach((tr, i) => {
    tr.children[2].textContent = vouchers[i].type;
  });
}

function renderCustomers() {
  const newsletter = JSON.parse(localStorage.getItem('ch_newsletter') || '[]');
  $('#view-customers').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Khách hàng thành viên</h3></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Khách</th><th>Email</th><th>Điểm</th><th>Hạng</th><th>Số đơn</th></tr></thead>
          <tbody>${DEMO_CUSTOMERS.map(c => `
            <tr>
              <td><strong>${c.name}</strong></td>
              <td>${c.email}</td>
              <td style="font-weight:700;color:var(--c-accent)">${c.points.toLocaleString('vi-VN')}</td>
              <td>${pill(c.tier === 'Kim cương' ? 'ready' : c.tier === 'Vàng' ? 'preparing' : 'new').replace('Mới', 'Bạc').replace('Đang pha', 'Vàng').replace('Sẵn sàng', 'Kim cương')}</td>
              <td>${c.ordersCount}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Email đăng ký nhận tin (${newsletter.length})</h3></div>
      ${newsletter.length
        ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${newsletter.map(e => `<span class="chip">${e}</span>`).join('')}</div>`
        : '<p class="muted">Chưa có ai đăng ký nhận tin.</p>'}
    </div>`;
}

/* ---------------- Điều hướng view ---------------- */
function showView(name) {
  $$('.as-links a').forEach(a => a.classList.toggle('on', a.dataset.view === name));
  $$('.admin-view').forEach(v => v.hidden = v.id !== `view-${name}`);
  $('#view-title').textContent = TITLES[name] || '';
}

export default async function init() {
  if (!user.isAdmin()) {
    location.href = '/admin-login.html';
    return;
  }

  menu = await getMenu();
  // override sản phẩm nếu admin từng sửa (local)
  const overrides = JSON.parse(localStorage.getItem('ch_admin_products') || '{}');
  Object.entries(overrides).forEach(([slug, ov]) => {
    const p = menu.products.find(x => x.slug === slug);
    if (p) Object.assign(p, ov);
  });

  // gộp đơn thật (localStorage) lên đầu danh sách demo
  const realOrders = orders.get().map((o, i) => ({
    ...o,
    customer: o.customer || { name: user.get().name },
    time: new Date(o.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) || `-${i}`
  }));
  allOrders = [...realOrders, ...DEMO_ORDERS];
  allBookings = [...bookings.get(), ...DEMO_BOOKINGS];

  const vouchers = await getVouchers();

  renderOverview();
  renderOrders();
  renderProducts();
  renderBookings();
  renderPromos(vouchers);
  renderCustomers();

  $('#admin-nav').addEventListener('click', (e) => {
    const a = e.target.closest('[data-view]');
    if (!a) return;
    e.preventDefault();
    showView(a.dataset.view);
  });

  document.querySelector('.admin-main').addEventListener('click', (e) => {
    const goto = e.target.closest('[data-goto]');
    if (goto) showView(goto.dataset.goto);
    const edit = e.target.closest('[data-edit]');
    if (edit) openProductModal(edit.dataset.edit);
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // đổi trạng thái đơn
  document.querySelector('.admin-main').addEventListener('change', (e) => {
    const sel = e.target.closest('[data-status-i]');
    if (!sel) return;
    const o = allOrders[Number(sel.dataset.statusI)];
    if (o && !o.mock) orders.updateStatus(o.code, sel.value); // đơn thật -> lưu lại
    o && (o.status = sel.value);
    toast(`${o.code} → ${STATUS[sel.value][1]}`, 'success');
  });

  showView('overview');
}
