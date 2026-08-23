// Header + mobile nav: inject vào #header trên mọi trang
import { $ } from '../core/utils.js';
import { cart, user, wishlist } from '../core/store.js';
import { openSearch } from './search.js';
import { toggleTheme } from './darkmode.js';

const LINKS = [
  { href: '/index.html', label: 'Trang chủ', icon: 'fa-house', match: '/' },
  { href: '/menu.html', label: 'Thực đơn', icon: 'fa-mug-hot' },
  { href: '/booking.html', label: 'Đặt bàn', icon: 'fa-chair', new: true },
  { href: '/voucher.html', label: 'Ưu đãi', icon: 'fa-ticket', new: true },
  { href: '/blog.html', label: 'Blog', icon: 'fa-newspaper' },
  { href: '/contact.html', label: 'Liên hệ', icon: 'fa-location-dot' }
];

function html() {
  const u = user.get();
  const path = location.pathname;
  const isActive = (l) =>
    l.match === '/' ? path === '/' || path.endsWith('index.html') : path.endsWith(l.href);

  return `
  <header class="site-header">
    <div class="container">
      <a class="logo" href="/index.html">
        <img src="/images/logo.svg" alt="Coffee Home">
        <span>Coffee<b>Home</b></span>
      </a>

      <nav class="main-nav" aria-label="Điều hướng chính">
        <ul>
          ${LINKS.map(l => `
            <li><a href="${l.href}" class="${isActive(l) ? 'active' : ''}">
              ${l.label}${l.new ? '<sup style="color:var(--c-accent);font-size:.6rem;font-weight:800"> NEW</sup>' : ''}
            </a></li>`).join('')}
        </ul>
      </nav>

      <div class="header-actions">
        <button class="icon-btn" id="btn-search" aria-label="Tìm kiếm"><i class="fa-solid fa-magnifying-glass"></i></button>
        <button class="icon-btn" id="btn-theme" aria-label="Đổi giao diện sáng/tối"><i class="fa-regular fa-moon"></i></button>
        <a class="icon-btn" href="/wishlist.html" aria-label="Yêu thích">
          <i class="fa-regular fa-heart"></i>
          <span class="cart-count wl-count" ${wishlist.get().length ? '' : 'hidden'}>${wishlist.get().length}</span>
        </a>
        <button class="icon-btn" id="btn-cart" aria-label="Giỏ hàng">
          <i class="fa-solid fa-basket-shopping"></i>
          <span class="cart-count">${cart.count()}</span>
        </button>

        <div class="user-menu" id="user-menu">
          <button class="icon-btn" id="btn-user" aria-label="Tài khoản">
            <i class="fa-${u ? 'solid' : 'regular'} fa-user"></i>
          </button>
          <div class="um-dropdown">
            ${u ? `
              <div class="um-head">
                <strong>${u.name}</strong>
                <small>${u.email}</small>
                <small class="um-points"><i class="fa-solid fa-star"></i> ${u.points || 0} điểm tích luỹ</small>
              </div>
              <a href="/account.html"><i class="fa-solid fa-user-pen"></i> Tài khoản của tôi</a>
              <a href="/account.html?tab=orders"><i class="fa-solid fa-receipt"></i> Đơn hàng của tôi</a>
              <a href="/account.html?tab=points"><i class="fa-solid fa-gift"></i> Điểm & đổi quà</a>
              ${u.isAdmin ? '<a href="/admin.html"><i class="fa-solid fa-gauge-high"></i> Trang quản trị</a>' : ''}
              <button id="btn-logout"><i class="fa-solid fa-right-from-bracket"></i> Đăng xuất</button>
            ` : `
              <div class="um-head"><strong>Xin chào!</strong><small>Đăng nhập để tích điểm</small></div>
              <a href="/login.html"><i class="fa-solid fa-right-to-bracket"></i> Đăng nhập</a>
              <a href="/register.html"><i class="fa-solid fa-user-plus"></i> Tạo tài khoản</a>
            `}
          </div>
        </div>

        <button class="icon-btn burger" id="btn-burger" aria-label="Menu"><i class="fa-solid fa-bars"></i></button>
      </div>
    </div>
  </header>

  <nav class="mobile-nav" id="mobile-nav" aria-label="Menu di động">
    <button class="icon-btn mn-close" id="btn-mn-close" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
    <ul>
      ${LINKS.map(l => `<li><a href="${l.href}" class="${isActive(l) ? 'active' : ''}"><i class="fa-solid ${l.icon}"></i> ${l.label}</a></li>`).join('')}
      <li><a href="${u ? '/account.html' : '/login.html'}"><i class="fa-solid fa-user"></i> ${u ? 'Tài khoản' : 'Đăng nhập'}</a></li>
    </ul>
  </nav>
  <div class="overlay" id="nav-overlay"></div>`;
}

export function initHeader() {
  const root = $('#header');
  if (!root) return;
  root.innerHTML = html();

  // tìm kiếm
  $('#btn-search')?.addEventListener('click', openSearch);

  // theme
  $('#btn-theme')?.addEventListener('click', () => {
    toggleTheme();
    const i = $('#btn-theme i');
    if (i) i.className = document.documentElement.dataset.theme === 'dark'
      ? 'fa-solid fa-sun' : 'fa-regular fa-moon';
  });
  // set icon đúng lúc load
  const ti = $('#btn-theme i');
  if (ti && document.documentElement.dataset.theme === 'dark') ti.className = 'fa-solid fa-sun';

  // user dropdown
  const um = $('#user-menu');
  $('#btn-user')?.addEventListener('click', (e) => {
    e.stopPropagation();
    um.classList.toggle('open');
  });
  document.addEventListener('click', () => um?.classList.remove('open'));
  $('#btn-logout')?.addEventListener('click', () => {
    user.clear();
    window.location.href = '/index.html';
  });

  // cart drawer (preload module, không tự mở)
  import('./cart.js');
  $('#btn-cart')?.addEventListener('click', async () => {
    const m = await import('./cart.js');
    m.toggleCart(true);
  });

  // mobile nav
  const overlay = $('#nav-overlay');
  const setNav = (open) => {
    $('#mobile-nav').classList.toggle('open', open);
    overlay.classList.toggle('show', open);
  };
  $('#btn-burger')?.addEventListener('click', () => setNav(true));
  $('#btn-mn-close')?.addEventListener('click', () => setNav(false));
  overlay.addEventListener('click', () => setNav(false));

  // đồng bộ badge khi giỏ/wishlist thay đổi
  const refreshBadges = () => {
    const cc = $('#btn-cart .cart-count');
    if (cc) cc.textContent = cart.count();
    const wc = $('.wl-count');
    if (wc) {
      wc.textContent = wishlist.get().length;
      wc.hidden = wishlist.get().length === 0;
    }
  };
  window.addEventListener('cart:change', refreshBadges);
  window.addEventListener('wishlist:change', refreshBadges);
}
