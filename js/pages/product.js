// Chi tiết món: tùy chọn size/đá/đường/topping + thêm giỏ
import { $, $$, formatVND, escapeHtml, getParam, starHtml, toast } from '../core/utils.js';
import { getMenu, priceOf } from '../core/api.js';
import { cart, wishlist } from '../core/store.js';
import { productCard, bindGridActions } from '../components/products.js';

let p = null;
let menu = null;
const sel = { size: 'M', ice: '70', sugar: '100', toppings: new Set() };

function currentUnitPrice() {
  const size = menu.sizes.find(s => s.id === sel.size);
  const tops = [...sel.toppings].map(id => menu.toppings.find(t => t.id === id));
  return priceOf(p, size.extra, tops);
}

function refresh() {
  $('#p-price').textContent = formatVND(currentUnitPrice());
  $$('#toppings-checks input').forEach(cb => {
    cb.closest('.check-row').classList.toggle('on', false);
  });
}

function optionPills(containerSel, items, activeId, onPick) {
  $(containerSel).innerHTML = items.map(o => `
    <button type="button" class="opt-pill ${o.id === activeId ? 'on' : ''}" data-id="${o.id}">
      ${o.name}${o.extra ? ` <small>+${formatVND(o.extra)}</small>` : ''}
    </button>`).join('');

  $(containerSel).addEventListener('click', (e) => {
    const btn = e.target.closest('.opt-pill');
    if (!btn) return;
    $$('.opt-pill', $(containerSel)).forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    onPick(btn.dataset.id);
    refresh();
  });
}

export default async function init() {
  menu = await getMenu();
  const slug = getParam('id');
  p = menu.products.find(x => x.slug === slug)
    || menu.products[0]; // không có id thì hiện món đầu tiên

  document.title = `${p.name} | Coffee Home`;

  const catName = menu.categories.find(c => c.id === p.category)?.name || '';
  const wished = wishlist.has(p.id);
  const price = Math.round(p.basePrice * (1 - (p.discountPct || 0) / 100));
  const related = menu.products.filter(x => x.category === p.category && x.id !== p.id).slice(0, 4);

  $('#product-detail').innerHTML = `
  <div style="display:grid;grid-template-columns:minmax(280px,460px) 1fr;gap:44px;align-items:start" class="product-layout">
    <div style="position:relative">
      <img src="${p.image}" alt="${escapeHtml(p.name)}"
           style="border-radius:18px;box-shadow:var(--shadow);aspect-ratio:1/1;object-fit:cover;background:var(--c-cream)">
    </div>

    <div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        ${p.tags?.includes('bestseller') ? '<span class="badge badge-hot">BEST SELLER</span>' : ''}
        ${p.discountPct > 0 ? `<span class="badge badge-sale">-${p.discountPct}%</span>` : ''}
        ${p.tags?.includes('new') ? '<span class="badge badge-new">MỚI</span>' : ''}
        <span class="muted" style="font-size:.78rem;text-transform:uppercase;letter-spacing:1px">${escapeHtml(catName)}</span>
      </div>

      <h1 style="font-size:clamp(1.5rem,3vw,2.1rem)">${escapeHtml(p.name)}</h1>
      <div class="pc-rating mt-1" style="font-size:.95rem">${starHtml(p.rating)}
        <span>${p.rating} · Đã bán ${p.sold.toLocaleString('vi-VN')}</span></div>
      <p class="mt-2" style="font-size:1.02rem">${escapeHtml(p.desc)}</p>

      <h2 class="pc-price" id="p-price" style="font-size:1.7rem;margin-top:18px">${formatVND(price)}</h2>

      <div class="form-group mt-3"><label>Kích cỡ</label><div class="opt-pills" id="size-pills"></div></div>
      <div class="form-group"><label>Lượng đá</label><div class="opt-pills" id="ice-pills"></div></div>
      <div class="form-group"><label>Đường</label><div class="opt-pills" id="sugar-pills"></div></div>
      <div class="form-group"><label>Topping</label><div id="toppings-checks" style="display:flex;flex-wrap:wrap;gap:9px"></div></div>

      <div style="display:flex;gap:14px;align-items:center;margin-top:22px;flex-wrap:wrap">
        <div class="qty-stepper">
          <button type="button" data-q="-1" aria-label="Giảm"><i class="fa-solid fa-minus"></i></button>
          <input type="number" id="qty-input" value="1" min="1" max="99">
          <button type="button" data-q="1" aria-label="Tăng"><i class="fa-solid fa-plus"></i></button>
        </div>
        <button class="btn btn-primary" id="add-cart"><i class="fa-solid fa-basket-shopping"></i> Thêm vào giỏ</button>
        <button class="btn btn-accent" id="buy-now">Mua ngay</button>
        <button class="pc-wish ${wished ? 'on' : ''}" id="wish-btn"
                style="position:static;width:46px;height:46px;font-size:1.05rem" aria-label="Yêu thích">
          <i class="fa-${wished ? 'solid' : 'regular'} fa-heart"></i>
        </button>
      </div>
    </div>
  </div>

  <section class="mt-4">
    <h3 class="mb-2">Khách nói gì về "${escapeHtml(p.name)}"</h3>
    <div class="grid-cards">
      <div class="info-card"><strong>Minh Anh ⭐⭐⭐⭐⭐</strong><p>"Đúng vị quán hay uống, đặt trước 15 phút tới là nhận liền, tiện hẳn!"</p></div>
      <div class="info-card"><strong>Thanh Tùng ⭐⭐⭐⭐⭐</strong><p>"Đá đường chuẩn gu, topping nhiều. Sẽ gọi lại thường xuyên."</p></div>
      <div class="info-card"><strong>Hải Yến ⭐⭐⭐⭐</strong><p>"Đóng gói cẩn thận, giao nhanh. Mong có thêm size XXL 😄"</p></div>
    </div>
  </section>

  ${related.length ? `
  <section class="mt-4">
    <h3 class="mb-2">Có thể bạn cũng thích</h3>
    <div class="grid-products" id="related-grid"></div>
  </section>` : ''}`;

  // tuỳ chọn
  optionPills('#size-pills', menu.sizes, sel.size, (id) => sel.size = id);
  optionPills('#ice-pills', menu.iceLevels, sel.ice, (id) => sel.ice = id);
  optionPills('#sugar-pills', menu.sugarLevels, sel.sugar, (id) => sel.sugar = id);

  $('#toppings-checks').innerHTML = menu.toppings.map(t => `
    <label class="check-row">
      <input type="checkbox" value="${t.id}"> ${escapeHtml(t.name)}
      <span class="cr-price">+${formatVND(t.price)}</span>
    </label>`).join('');
  $('#toppings-checks').addEventListener('change', () => {
    sel.toppings = new Set([...$$('#toppings-checks input:checked')].map(i => i.value));
    refresh();
  });

  // qty
  $$('[data-q]').forEach(btn => btn.addEventListener('click', () => {
    const input = $('#qty-input');
    input.value = Math.max(1, Math.min(99, (Number(input.value) || 1) + Number(btn.dataset.q)));
  }));

  // thêm giỏ / mua ngay
  const buildItem = () => {
    const size = menu.sizes.find(s => s.id === sel.size);
    const ICE = { '100': 'đá đầy', '70': '70% đá', '50': '50% đá', '0': 'không đá' };
    const SUGAR = { '100': 'đường đầy đủ', '70': '70% đường', '50': '50% đường', '0': 'không đường' };
    const tops = [...sel.toppings].map(id => menu.toppings.find(t => t.id === id));
    return {
      id: p.id, slug: p.slug, name: p.name, image: p.image,
      basePrice: p.basePrice, unitPrice: priceOf(p, size.extra, tops),
      qty: Number($('#qty-input').value) || 1,
      size: size.id, ice: ICE[sel.ice], sugar: SUGAR[sel.sugar], toppings: tops
    };
  };
  $('#add-cart').addEventListener('click', () => cart.add(buildItem()));
  $('#buy-now').addEventListener('click', () => { cart.add(buildItem(), true); location.href = '/checkout.html'; });

  $('#wish-btn').addEventListener('click', () => {
    wishlist.toggle(p.id, p.name);
    const btn = $('#wish-btn'), icon = $('i', btn);
    btn.classList.toggle('on');
    icon.className = btn.classList.contains('on') ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
  });

  // related
  const rg = $('#related-grid');
  if (rg) {
    rg.innerHTML = related.map(productCard).join('');
    bindGridActions(rg);
  }

  refresh();
}
