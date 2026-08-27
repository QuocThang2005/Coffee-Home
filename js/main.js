// Entry duy nhất của toàn site.
// - Init mọi component dùng chung
// - Auto-import page module theo <body data-page="...">

import { applySavedTheme } from './components/darkmode.js';
import { initHeader } from './components/header.js';
import { initFooter } from './components/footer.js';
import { initToast } from './components/toast.js';
import { initSearch } from './components/search.js';
import { initCartDrawer } from './components/cart.js';
import { initChatbot } from './components/chatbot.js';
import { initMusic } from './components/music.js';
import { initSettings } from './components/settings.js';
import { initIdleLogout } from './components/idle-logout.js';
import { initAdminSync } from './components/admin-sync.js';
import { validateTable, getSettings } from './core/api.js';
import { tableSession } from './core/store.js';

applySavedTheme();

/* ------- QR Table: quét QR → parse ?ban= & t= → xác thực bàn ------- */
async function parseTableParam() {
  const p = new URLSearchParams(location.search);
  const ban = p.get('ban') || p.get('table');
  const t = p.get('t') || p.get('token');
  if (!ban || !t) return;
  // xoá param khỏi URL (không che bookmark / share)
  p.delete('ban'); p.delete('table'); p.delete('t'); p.delete('token');
  const qs = p.toString();
  const clean = location.pathname + (qs ? '?' + qs : '') + location.hash;
  history.replaceState(null, '', clean);

  try {
    const res = await validateTable(ban, t);
    tableSession.set({ id: res.id, name: res.name, seats: res.seats || 0 });
    window.dispatchEvent(new CustomEvent('table:change'));
  } catch {
    tableSession.clear();
  }
}
await parseTableParam();

/* ------- Site settings: marquee + hero banners ------- */
async function initSiteSettings() {
  const s = await getSettings();
  // Marquee
  if (s.marquee_enabled === '0') {
    const el = document.getElementById('site-marquee');
    if (el) el.style.display = 'none';
  }
  const mt = document.getElementById('marquee-text');
  if (mt && s.marquee_text) mt.textContent = s.marquee_text;
  const mr = document.getElementById('site-marquee');
  if (mr) {
    if (s.marquee_bg) mr.style.background = s.marquee_bg;
    if (s.marquee_color) mr.style.color = s.marquee_color;
  }
  // Hero banners
  const heroEl = document.getElementById('home-hero');
  if (heroEl) {
    const videoUrl = s.banner_video_url || '';
    const videoMode = s.banner_video_mode || 'all';
    const videoSlides = new Set();
    if (videoUrl) {
      if (videoMode === 'all') [1,2,3].forEach(i => videoSlides.add(i));
      else videoMode.split(',').map(Number).forEach(i => videoSlides.add(i));
    }
    const slides = [1, 2, 3].map(i => ({
      title: s[`banner_${i}_title`] || '',
      sub:   s[`banner_${i}_sub`]   || '',
      cta:   s[`banner_${i}_cta`]   || 'Xem thêm',
      link:  s[`banner_${i}_link`]  || '/pages/menu.html',
      img:   s[`banner_${i}_image`] || '/images/menu/banner1.jpg',
      on:    s[`banner_${i}_enabled`] !== '0',
    })).filter(sl => sl.on && sl.title);

    const renderSlide = (sl, i, useVideo) => {
      const bg = useVideo ? '' : `style="background-image:url('${sl.img}')"`;
      const media = useVideo
        ? `<video src="${videoUrl}" autoplay muted loop playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>`
        : '';
      return `<div class="hero-slide${i === 0 ? ' active' : ''}" ${bg}>
        ${media}<div class="hero-overlay"></div><div class="hero-caption"><span class="eyebrow">CoffeeHome</span>
        <h2>${sl.title}</h2><p>${sl.sub}</p>
        <a href="${sl.link}" class="btn btn-primary">${sl.cta}</a></div></div>`;
    };

    if (slides.length > 1) {
      heroEl.innerHTML = `<div class="hero-slides">${slides.map((sl, i) =>
        renderSlide(sl, i, videoSlides.has(i + 1))
      ).join('')}</div>`;
      let cur = 0;
      setInterval(() => {
        const all = heroEl.querySelectorAll('.hero-slide');
        if (!all.length) return;
        all[cur].classList.remove('active');
        cur = (cur + 1) % all.length;
        all[cur].classList.add('active');
      }, 5000);
    } else if (slides.length === 1) {
      heroEl.innerHTML = renderSlide(slides[0], 0, videoSlides.has(1));
    }
  }
}
initSiteSettings().catch(() => {});

const inits = [
  initHeader, initFooter, initToast, initSearch,
  initCartDrawer, initChatbot, initMusic,
  initSettings, initIdleLogout, initAdminSync
];

Promise.all(inits.map(fn => {
  try {
    return fn();
  } catch (err) {
    console.error(`[init] ${fn.name}:`, err);
    return null;
  }
})).then(async () => {
  const page = document.body.dataset.page;
  if (!page) return;
  try {
    const mod = await import(/* @vite-ignore */ `/js/pages/${page}.js`);
    await mod.default?.();
  } catch (err) {
    console.warn(`[page] Không nạp được js/pages/${page}.js:`, err?.message);
    document.title = `[LỖI TRANG] ${err?.message || err}`;
  }
  // hiệu ứng chung chạy sau khi trang đã render xong dữ liệu
  try {
    const { initEffects } = await import('./effects.js');
    initEffects();
  } catch (err) {
    console.warn('[fx] Không khởi động được hiệu ứng:', err?.message);
  }
});
