// Search overlay — tìm món theo tên, Enter mở trang đầu tiên
import { $, escapeHtml, formatVND, debounce } from '../core/utils.js';
import { getMenu } from '../core/api.js';

let items = [];
let results = [];

function render(q) {
  const box = $('#search-results');
  if (!box) return;
  q = q.trim().toLowerCase();
  if (!q) {
    box.innerHTML = '<div class="sr-none">Gõ tên món bạn muốn tìm…</div>';
    return;
  }
  results = items.filter(p =>
    p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
  ).slice(0, 8);

  if (!results.length) {
    box.innerHTML = `<div class="sr-none">Không tìm thấy món nào khớp "<b>${escapeHtml(q)}</b>"</div>`;
    return;
  }
  box.innerHTML = results.map(p => `
    <a class="sr-item" href="/product.html?id=${p.slug}">
      <img src="${p.image}" alt="">
      <div><strong>${escapeHtml(p.name)}</strong><span class="sr-cat">${escapeHtml(p.desc)}</span></div>
      <span class="sr-price">${formatVND(p.basePrice)}</span>
    </a>`).join('');
}

function open() {
  $('#search-overlay')?.classList.add('show');
  setTimeout(() => $('#search-input')?.focus(), 60);
}

function close() {
  $('#search-overlay')?.classList.remove('show');
}

export async function initSearch() {
  if (!$('#search-overlay')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="search-overlay" id="search-overlay" role="dialog" aria-label="Tìm kiếm">
        <div class="search-box">
          <input id="search-input" type="search" placeholder="Tìm món, ví dụ: phin sữa đá…" autocomplete="off">
          <div class="search-results" id="search-results">
            <div class="sr-none">Gõ tên món bạn muốn tìm…</div>
          </div>
        </div>
      </div>`);
  }

  const overlay = $('#search-overlay');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  $('#search-input').addEventListener('input', debounce((e) => render(e.target.value), 200));
  $('#search-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && results.length) location.href = `/product.html?id=${results[0].slug}`;
  });

  try {
    items = (await getMenu()).products;
  } catch { /* bỏ qua */ }
}

export function openSearch() { open(); }
