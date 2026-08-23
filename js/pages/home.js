// Trang chủ: slider · nhóm món · best sellers · chi nhánh
import { $, formatVND, escapeHtml } from '../core/utils.js';
import { getMenu, getBranches } from '../core/api.js';
import { initBannerSlider, renderGrid, bindGridActions } from '../components/products.js';

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

  const grid = $('#best-grid');
  renderGrid(grid, best);
  bindGridActions(grid);

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
}
