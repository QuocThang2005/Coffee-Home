import { $, $$, formatVND, escapeHtml } from '../../core/utils.js';
import {
  getMenu, getVouchers, fetchMe, connectAdminWS,
  getAdminStats, getRevenueStats, adminOrders,
  adminBookings, adminUsers,
  logoutApi
} from '../../core/api.js';

import { isAuthError, isNetError, errBox, toastMsg, closeModal, STATUS } from './_helpers.js';
import { loadOverview } from './overview.js';
import { renderOrders, changeOrderStatus, viewOrderReply } from './orders.js';
import { renderProducts, productModal, removeProduct } from './products.js';
import { renderBookings, toggleBooking, viewBookingReply } from './bookings.js';
import { loadCareers } from './careers.js';
import { loadFeedbacks } from './feedback.js';
import { renderPromos, voucherModal, removeVoucher } from './promos.js';
import { renderCustomers } from './customers.js';
import { loadSettings } from './settings.js';

/* ================= state ================= */

const state = {
  stats: null,
  allOrders: [],
  allBookings: [],
  allApps: [],
  allFeedbacks: [],
  allUsers: [],
  menu: null,
  vouchers: [],
  orderFilter: '',
  currentView: 'overview',
  chartPeriod: 'week',
  _showView: null
};

const TITLES = {
  overview: 'Tổng quan hôm nay', orders: 'Quản lý đơn hàng', products: 'Quản lý sản phẩm',
  bookings: 'Lượt đặt bàn', careers: 'Hồ sơ ứng tuyển', feedback: 'Phản hồi khách hàng',
  promos: 'Khuyến mãi', customers: 'Khách hàng', settings: 'Cài đặt trang web'
};

/* ================= boot / xác thực ================= */

function bootFail(message) {
  localStorage.removeItem('ch_admin_token');
  localStorage.removeItem('ch_admin_user');
  $('#admin-boot-msg').innerHTML = message;
  $('#admin-boot-login').hidden = false;
}

/* ================= loaders ================= */

async function loadOrders() {
  if (!state.menu) state.menu = await getMenu(true);
  state.allOrders = (await adminOrders()).orders;
  renderOrders(state);
}

async function loadProducts() {
  state.menu = await getMenu(true);
  renderProducts(state);
}

async function loadBookings() {
  state.allBookings = (await adminBookings()).bookings;
  renderBookings(state);
}

async function loadPromos() {
  if (!state.menu) state.menu = await getMenu(true);
  state.vouchers = await getVouchers();
  renderPromos(state);
}

async function loadCustomers() {
  state.allUsers = (await adminUsers()).users;
  renderCustomers(state);
}

const LOADERS = {
  overview: () => loadOverview(state),
  orders: loadOrders,
  products: loadProducts,
  bookings: loadBookings,
  careers: () => loadCareers(state),
  feedback: () => loadFeedbacks(state),
  promos: loadPromos,
  customers: loadCustomers,
  settings: loadSettings
};

/* ================= điều hướng view ================= */

function showView(name) {
  state.currentView = name;
  $$('#admin-nav a').forEach(a => a.classList.toggle('on', a.dataset.view === name));
  $$('.admin-view').forEach(v => { v.hidden = v.id !== `view-${name}`; });
  $('#view-title').textContent = TITLES[name] || '';

  const view = $(`#view-${name}`);
  view.innerHTML = `<p class="muted"><i class="fa-solid fa-circle-notch fa-spin"></i> Đang tải…</p>`;

  LOADERS[name]?.().catch(err => {
    if (isAuthError(err)) {
      localStorage.removeItem('ch_admin_token');
      localStorage.removeItem('ch_admin_user');
      view.innerHTML = `
        <div class="panel" style="border-left:4px solid #c0392b">
          <strong>Phiên hết hạn hoặc không đủ quyền.</strong>
          <p class="muted" style="margin:.4rem 0 .6rem">Bấm nút để đăng nhập lại.</p>
          <a class="btn btn-sm btn-primary" href="/admin/admin-login.html">Đăng nhập lại</a>
        </div>`;
      return;
    }
    view.innerHTML = errBox(err);
  });
}

// Wire _showView for sub-modules that need to trigger a view refresh
state._showView = showView;

/* ================= sự kiện ================= */

function bindEvents() {
  $('#admin-nav').addEventListener('click', (e) => {
    const a = e.target.closest('[data-view]');
    if (!a) return;
    e.preventDefault();
    showView(a.dataset.view);
  });

  $('.admin-main').addEventListener('click', (e) => {
    if (e.target.closest('[data-retry]')) return showView(state.currentView);
    const periodBtn = e.target.closest('[data-chart-period]');
    if (periodBtn) {
      state.chartPeriod = periodBtn.dataset.chartPeriod;
      loadOverview(state);
      return;
    }
    const goto = e.target.closest('[data-goto]');
    if (goto) return showView(goto.dataset.goto);
    if (e.target.closest('#add-product')) return productModal(state);
    if (e.target.closest('#add-voucher')) return voucherModal(state);
    const edit = e.target.closest('[data-edit]');
    if (edit) return productModal(state, edit.dataset.edit);
    const delP = e.target.closest('[data-del-product]');
    if (delP) return removeProduct(state, delP.dataset.delProduct);
    const bt = e.target.closest('[data-booking-toggle]');
    if (bt) return toggleBooking(state, bt.dataset.bookingToggle);
    const brp = e.target.closest('[data-booking-reply]');
    if (brp) return viewBookingReply(state, brp.dataset.bookingReply);
    const orp = e.target.closest('[data-order-reply]');
    if (orp) return viewOrderReply(state, orp.dataset.orderReply);
    const as = e.target.closest('[data-app-status]');
    if (as) {
      const [id, status] = as.dataset.appStatus.split(':');
      return changeAppStatus(state, id, status);
    }
    const av = e.target.closest('[data-app-view]');
    if (av) {
      e.preventDefault();
      return viewApp(state, av.dataset.appView);
    }
    const fs = e.target.closest('[data-fb-status]');
    if (fs) {
      const [id, status] = fs.dataset.fbStatus.split(':');
      return changeFbStatus(state, id, status);
    }
    const fv = e.target.closest('[data-fb-view]');
    if (fv) {
      e.preventDefault();
      return viewFeedback(state, fv.dataset.fbView);
    }
    const editV = e.target.closest('[data-edit-voucher]');
    if (editV) return voucherModal(state, editV.dataset.editVoucher);
    const delV = e.target.closest('[data-del-voucher]');
    if (delV) return removeVoucher(state, delV.dataset.delVoucher);
  });

  $('.admin-main').addEventListener('change', (e) => {
    const sel = e.target.closest('[data-order-status]');
    if (sel) return changeOrderStatus(state, sel.dataset.orderStatus, sel.value);
    if (e.target.id === 'order-filter') {
      state.orderFilter = e.target.value;
      renderOrders(state);
    }
  });

  $('#admin-refresh').addEventListener('click', () => showView(state.currentView));

  $('#admin-logout').addEventListener('click', async () => {
    try { await import('../../core/api.js').then(m => m.logoutApi()); } catch { /* bỏ qua */ }
    localStorage.removeItem('ch_admin_token');
    localStorage.removeItem('ch_admin_user');
    location.replace('/admin/admin-login.html');
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

/* ================= init ================= */

export default async function init() {
  $('#admin-boot-login').addEventListener('click', () => location.replace('/admin/admin-login.html'));

  const token = localStorage.getItem('ch_admin_token');
  if (!token) return bootFail('Bạn chưa đăng nhập quản trị.');

  let me;
  try {
    const res = await fetchMe();
    me = res.user;
  } catch (err) {
    if (isNetError(err)) {
      return bootFail(
        'Không kết nối được backend.<br>Mở <b>start-coffee.bat</b>, chờ dòng ' +
        '<code>Uvicorn running…</code> rồi bấm F5.'
      );
    }
    return bootFail(isAuthError(err)
      ? 'Phiên đăng nhập đã hết hạn. Bấm nút bên dưới để đăng nhập lại.'
      : `Lỗi ${err.status}: ${escapeHtml(err.message || '')}`);
  }

  if (!me?.isAdmin) return bootFail('Tài khoản này không có quyền quản trị.');

  // OK -> vào dashboard: XOÁ HỂN màn chờ khỏi DOM
  document.getElementById('admin-boot')?.remove();
  $('#admin-app').hidden = false;
  $('#admin-who').textContent = me.name || me.email || 'Admin';

  bindEvents();
  showView('overview');

  // WebSocket real-time: nhận đơn mới + cập nhật trạng thái từ bất kỳ ai
  connectAdminWS((evt) => {
    if (evt.type === 'new_order') {
      const label = evt.table_name ? ` · ${evt.table_name}` : '';
      toast(`Đơn mới ${evt.code}${label} — ${formatVND(evt.total)}`, 'success', 6000);
    } else if (evt.type === 'status_changed') {
      if (state.currentView === 'orders') loadOrders();
      if (state.currentView === 'overview') loadOverview(state);
    }
    if (evt.type === 'new_order') {
      if (state.currentView === 'overview') loadOverview(state);
      if (state.currentView === 'orders') loadOrders();
    }
  });
}

/* ================= imports used by bindEvents ================= */

import { changeAppStatus, viewApp } from './careers.js';
import { changeFbStatus, viewFeedback } from './feedback.js';
