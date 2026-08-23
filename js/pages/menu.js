// Thực đơn: lọc theo nhóm · tìm kiếm · sắp xếp
import { $, $$, getParam } from '../core/utils.js';
import { getMenu } from '../core/api.js';
import { renderGrid, bindGridActions } from '../components/products.js';

let all = [];
let cat = 'all';
let q = '';
let sort = 'popular';

function apply() {
  let list = all.filter(p =>
    (cat === 'all' || p.category === cat) &&
    (!q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q))
  );

  switch (sort) {
    case 'gia-tang': list.sort((a, b) => a.basePrice - b.basePrice); break;
    case 'gia-giam': list.sort((a, b) => b.basePrice - a.basePrice); break;
    case 'name': list.sort((a, b) => a.name.localeCompare(b.name, 'vi')); break;
    default: list.sort((a, b) => b.sold - a.sold);
  }

  renderGrid($('#menu-grid'), list);
  $('#menu-count').textContent = `Hiển thị ${list.length} món`;
  $('#menu-empty').hidden = list.length > 0;
}

export default async function init() {
  all = (await getMenu()).products;

  // mở sẵn nhóm từ query ?cat=
  const fromUrl = getParam('cat');
  if (fromUrl) {
    cat = fromUrl;
    $$('#category-chips .chip').forEach(c =>
      c.classList.toggle('on', c.dataset.cat === cat));
  }

  $('#category-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    cat = chip.dataset.cat;
    $$('#category-chips .chip').forEach(c => c.classList.toggle('on', c === chip));
    apply();
  });

  $('#menu-search').addEventListener('input', (e) => {
    q = e.target.value.trim().toLowerCase();
    apply();
  });

  $('#menu-sort').addEventListener('change', (e) => {
    sort = e.target.value;
    apply();
  });

  bindGridActions($('#menu-grid'));
  apply();
}
