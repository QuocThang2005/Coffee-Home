// Trang chủ: slider · nhóm món · best sellers · món mới · số liệu · chi nhánh
// voucher · 4 bước · gallery · blog teaser
import { $, $$, formatVND, escapeHtml, toast } from '../core/utils.js';
import { getMenu, getBranches } from '../core/api.js';
import { appliedVoucher } from '../core/store.js';
import { initBannerSlider, renderGrid, bindGridActions } from '../components/products.js';
import { POSTS } from './blog-data.js';

const GALLERY = [
  '/images/pexels-alexfu-1659037.jpg',
  '/images/pexels-pixabay-459489.jpg',
  '/images/pexels-pixabay-414605.jpg',
  '/images/pexels-conojeghuo-111159.jpg',
  '/images/pexels-fotios-photos-228183.jpg',
  '/images/pexels-dutumong-2226091.jpg'
];

function initCountUp() {
  const nums = $$('[data-count]');
  if (!nums.length) return;
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    nums.forEach(el => {
      const target = parseFloat(el.dataset.count);
      const decimals = Number(el.dataset.decimals) || 0;
      const t0 = performance.now();
      const dur = 1400;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = (target * eased).toLocaleString('vi-VN', {
          minimumFractionDigits: decimals, maximumFractionDigits: decimals
        });
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.35 });
  io.observe($('.stats-strip'));
}

const DEAL_UNIT = {
  percent: v => `<span class="vl-value">-${v.value}%</span><small>Giảm giá</small>`,
  fixed: v => `<span class="vl-value">${formatVND(v.value)}</span><small>Giảm giá</small>`,
  freeship: () => `<span class="vl-value">0₫</span><small>Miễn phí ship</small>`,
  gift: () => `<span class="vl-value">1+1</span><small>Tặng món</small>`
};

export default async function init() {
  const menu = await getMenu();

  initBannerSlider('#home-hero', menu.banners);

  // chips danh mục -> menu.html?cat=
  $('#home-cats').innerHTML = menu.categories.map(c => `
    <a class="chip" href="/menu.html?cat=${c.id}">
      <i class="fa-solid ${c.icon}"></i> ${escapeHtml(c.name)}
    </a>`).join('');

  // best sellers: tag bestseller trước rồi tới sold cao
  const best = [...menu.products]
    .sort((a, b) => {
      const ba = a.tags?.includes('bestseller') ? 1 : 0;
      const bb = b.tags?.includes('bestseller') ? 1 : 0;
      if (ba !== bb) return bb - ba;
      return b.sold - a.sold;
    })
    .slice(0, 8);
  renderGrid($('#best-grid'), best);
  bindGridActions($('#best-grid'));

  // món mới: tag new trước, lấp đầy bằng rating cao nhất
  const isNew = p => p.tags?.includes('new') ? 1 : 0;
  const fresh = [...menu.products]
    .sort((a, b) => isNew(b) - isNew(a) || b.rating - a.rating)
    .slice(0, 6);
  renderGrid($('#new-row'), fresh);
  bindGridActions($('#new-row'));

  // con số chạy lên khi lướt tới
  initCountUp();

  // chi nhánh
  const branches = await getBranches();
  $('#branch-cards').innerHTML = branches.map(b => `
    <div class="info-card">
      <div class="ic-icon"><i class="fa-solid fa-location-dot"></i></div>
      <h3>${escapeHtml(b.name)}</h3>
      <ul>
        <li><i class="fa-solid fa-map-pin" style="color:var(--c-accent);margin-right:8px"></i>${escapeHtml(b.address)}</li>
        <li class="mt-1"><i class="fa-solid fa-clock" style="color:var(--c-accent);margin-right:8px"></i>${escapeHtml(b.open)}</li>
        <li class="mt-1"><i class="fa-solid fa-phone" style="color:var(--c-accent);margin-right:8px"></i>${escapeHtml(b.phone)}</li>
      </ul>
      <a href="/booking.html" class="btn btn-outline btn-sm mt-2">Đặt bàn ở đây</a>
    </div>`).join('');

  // voucher nổi bật (3 mã đầu)
  $('#deal-list').innerHTML = menu.vouchers.slice(0, 3).map(v => `
    <div class="voucher-card">
      <div class="voucher-left">${(DEAL_UNIT[v.type] || DEAL_UNIT.percent)(v)}</div>
      <div class="voucher-body">
        <h3>${escapeHtml(v.title)}</h3>
        <p>${escapeHtml(v.desc)}</p>
        <div class="voucher-foot">
          <span class="voucher-code">${v.code}</span>
          <button class="btn btn-outline btn-sm" data-copy="${v.code}"><i class="fa-regular fa-copy"></i> Copy</button>
          <button class="btn btn-primary btn-sm" data-use="${v.code}">Dùng ngay</button>
        </div>
      </div>
    </div>`).join('');

  $('#deal-list').addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      try {
        await navigator.clipboard.writeText(copyBtn.dataset.copy);
        toast(`Đã copy mã ${copyBtn.dataset.copy}`, 'success');
      } catch {
        toast('Trình duyệt chặn clipboard — copy tay giúp quán nhé', 'warn');
      }
    }
    const useBtn = e.target.closest('[data-use]');
    if (useBtn) {
      appliedVoucher.set(menu.vouchers.find(v => v.code === useBtn.dataset.use));
      toast('Đã áp mã — chọn món nào!', 'success');
      location.href = '/menu.html';
    }
  });

  // gallery không gian quán
  $('#gallery-strip').innerHTML = GALLERY.map(src =>
    `<img src="${src}" alt="Không gian Coffee Home" loading="lazy">`).join('');

  // blog teaser
  $('#blog-teaser').innerHTML = POSTS.slice(0, 3).map(p => `
    <article class="post-card">
      <img class="pc-cover" src="${p.image}" alt="" loading="lazy">
      <div class="post-body">
        <div class="post-meta">
          <span><i class="fa-regular fa-calendar"></i>${new Date(p.date).toLocaleDateString('vi-VN')}</span>
          <span><i class="fa-regular fa-clock"></i>${p.readMin} phút đọc</span>
        </div>
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.excerpt)}</p>
        <a class="read-more" href="/blog-post.html?id=${p.slug}">Đọc tiếp <i class="fa-solid fa-arrow-right-long"></i></a>
      </div>
    </article>`).join('');
}
