// Hiệu ứng dùng chung mọi trang khách:
// - reveal khi cuộn (IntersectionObserver, tự gắn class .rv)
// - ripple khi bấm nút
// - header đổ bóng khi cuộn + nút lên đầu trang
// - marquee thanh ưu đãi (nhân đôi track để chạy liền mạch)
// - hạt cà phê bay trong hero
// - toast "hoạt động live" mô phỏng đơn hàng đang vào

import { $, $$, pick } from './core/utils.js';
import { getMenu } from './core/api.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- reveal khi cuộn ---------- */

const REVEAL_SELECTORS = [
  '.section-head', '.section-head-row', '.info-card', '.product-card',
  '.step', '.review-card', '.voucher-card', '.post-card',
  '.stats-strip > div', '#deal-list > *', '.gallery-strip img'
].join(',');

function initReveal() {
  const els = $$(REVEAL_SELECTORS).filter(el => !el.closest('.admin-layout'));
  if (!els.length || REDUCED) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('rv-in');
      io.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });

  // gom nhóm theo cha để xếp delay so le
  const groups = new Map();
  for (const el of els) {
    el.classList.add('rv');
    const parent = el.parentElement;
    if (!groups.has(parent)) groups.set(parent, 0);
    const i = groups.get(parent);
    if (i < 8) el.style.setProperty('--d', `${i * 70}ms`);
    groups.set(parent, i + 1);
    io.observe(el);
  }

  // phần tử đang trong màn hình lúc tải trang -> hiện ngay cho nhanh
  requestAnimationFrame(() => {
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add('rv-in');
    });
  });
}

/* ---------- ripple nút bấm ---------- */

function initRipple() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn, .pc-add, #to-top');
    if (!btn || REDUCED) return;
    const rect = btn.getBoundingClientRect();
    const d = Math.max(rect.width, rect.height) * 1.1;
    const span = document.createElement('span');
    span.className = 'btn-ripple';
    span.style.cssText =
      `width:${d}px;height:${d}px;left:${e.clientX - rect.left - d / 2}px;top:${e.clientY - rect.top - d / 2}px`;
    btn.appendChild(span);
    setTimeout(() => span.remove(), 600);
  });
}

/* ---------- header shadow + nút lên đầu ---------- */

function initScrollUi() {
  let top = document.getElementById('to-top');
  if (!top) {
    top = document.createElement('button');
    top.id = 'to-top';
    top.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
    top.setAttribute('aria-label', 'Lên đầu trang');
    top.addEventListener('click', () => scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));
    document.body.appendChild(top);
  }

  const headerWrap = $('#header');
  const onScroll = () => {
    const y = scrollY;
    top.classList.toggle('show', y > 560);
    const bar = headerWrap?.firstElementChild;
    if (bar) bar.classList.toggle('header-scrolled', y > 24);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- marquee thanh ưu đãi ---------- */

function initMarquee() {
  // thanh promo là div có icon bolt ngay sau hero — chuyển thành marquee mượt
  const bars = $$('main > div[style*="background:var(--c-primary)"]');
  for (const bar of bars) {
    if (bar.querySelector('.fx-marquee')) continue;
    const text = bar.innerHTML.trim();
    bar.innerHTML =
      `<div class="fx-marquee">
         <div class="fx-marquee-track">${text}</div>
         <div class="fx-marquee-track" aria-hidden="true">${text}</div>
       </div>`;
    bar.style.padding = '9px 0';
    bar.style.fontSize = '.85rem';
    bar.style.textAlign = 'left';
  }
}

/* ---------- hạt cà phê bay trong hero ---------- */

function initHeroBeans() {
  const hero = $('.hero');
  if (!hero || REDUCED) return;
  if ($$('.bean', hero).length) return;
  for (let i = 0; i < 7; i++) {
    const b = document.createElement('span');
    b.className = 'bean';
    const size = 10 + Math.random() * 18;
    b.style.cssText =
      `width:${size}px;height:${size * 1.25}px;left:${5 + Math.random() * 90}%;top:${8 + Math.random() * 78}%;` +
      `animation-duration:${7 + Math.random() * 9}s;animation-delay:-${Math.random() * 8}s`;
    hero.appendChild(b);
  }
}

/* ---------- toast hoạt động live ---------- */

const LIVE_NAMES = ['Minh Anh', 'Quốc Bảo', 'Thu Hà', 'Gia Huy', 'Bảo Trâm', 'Hoàng Nam', 'Kim Chi', 'Thanh Tùng', 'Ngọc Diệp', 'Tuấn Kiệt'];
const LIVE_AREAS = ['Quận 1', 'Bình Thạnh', 'Thủ Đức', 'Quận 3', 'Phú Nhuận', 'Gò Vấp'];

function showLiveToast({ img, icon, html }) {
  let t = document.getElementById('live-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'live-toast';
    document.body.appendChild(t);
  }
  t.innerHTML = `${img ? `<img src="${img}" alt="">` : `<span class="lt-icon"><i class="fa-solid ${icon}"></i></span>`}<div>${html}</div>`;
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => t.classList.remove('show'), 4200);
}

async function initLiveActivity() {
  if (REDUCED || sessionStorage.getItem('ch_live_off')) return;
  try {
    const menu = await getMenu();
    const products = menu.products.filter(p => !p.discountPct || p.discountPct < 50);
    if (!products.length) return;
    let shown = 0;

    const pop = () => {
      if (document.hidden || shown >= 4) return;
      const p = pick(products);
      const name = pick(LIVE_NAMES);
      const area = pick(LIVE_AREAS);
      const mins = 2 + Math.floor(Math.random() * 20);
      showLiveToast({
        img: p.image,
        html: `<b>${name} vừa đặt ${p.name}</b>
               <small>${area} · ${mins} phút trước</small>`
      });
      shown++;
    };

    setTimeout(pop, 6500);
    setInterval(() => { if (Math.random() < 0.55) pop(); }, 17000);
  } catch { /* không có menu thì bỏ qua */ }
}

/* ---------- khởi động ---------- */

export function initEffects() {
  try { initReveal(); } catch (e) { console.warn('[fx] reveal:', e); }
  try { initRipple(); } catch (e) { console.warn('[fx] ripple:', e); }
  try { initScrollUi(); } catch (e) { console.warn('[fx] scroll-ui:', e); }
  try { initMarquee(); } catch (e) { console.warn('[fx] marquee:', e); }

  // chờ slider render xong rồi mới thả hạt cà phê vào hero
  setTimeout(() => {
    try { initHeroBeans(); } catch (e) { console.warn('[fx] beans:', e); }
  }, 60);

  try { initLiveActivity(); } catch (e) { console.warn('[fx] live:', e); }
}
