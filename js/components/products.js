// Renderer sản phẩm dùng chung: card, grid, slider banner
import { $, $$, formatVND, escapeHtml, starHtml } from '../core/utils.js';
import { wishlist } from '../core/store.js';

export function productCard(p) {
  const wished = wishlist.has(p.id);
  const price = Math.round(p.basePrice * (1 - (p.discountPct || 0) / 100));
  const tags = p.tags || [];
  const badges = [];
  if (tags.includes('bestseller')) badges.push('<span class="badge badge-hot">BEST SELLER</span>');
  if (tags.includes('new')) badges.push('<span class="badge badge-new">MỚI</span>');
  if (p.discountPct > 0) badges.push(`<span class="badge badge-sale">-${p.discountPct}%</span>`);
  else if (tags.includes('sale')) badges.push('<span class="badge badge-sale">SALE</span>');
  return `
  <article class="product-card" data-id="${p.id}">
    <div class="pc-img">
      ${badges.length ? `<div class="pc-badges">${badges.join('')}</div>` : ''}
      <a href="/pages/product.html?id=${p.slug}"><img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy"></a>
      <button class="pc-wish ${wished ? 'on' : ''}" data-wish="${p.id}" data-name="${escapeHtml(p.name)}"
              aria-label="Yêu thích"><i class="fa-${wished ? 'solid' : 'regular'} fa-heart"></i></button>
    </div>
    <div class="pc-body">
      <a href="/pages/product.html?id=${p.slug}" style="display:contents">
        <h3 class="pc-name">${escapeHtml(p.name)}</h3>
      </a>
      <div class="pc-rating">${starHtml(p.rating)}<span>${p.rating} · Đã bán ${p.sold}</span></div>
      <div class="pc-foot">
        <div class="pc-price">${formatVND(price)}${p.discountPct > 0 ? `<del>${formatVND(p.basePrice)}</del>` : ''}</div>
        <button class="pc-add" data-quick-add="${p.id}" aria-label="Thêm vào giỏ"><i class="fa-solid fa-plus"></i></button>
      </div>
    </div>
  </article>`;
}

export function renderGrid(el, products) {
  if (!el) return;
  el.innerHTML = products.map(productCard).join('');
}

// Quick add + wishlist — gắn 1 lần cho container lưới bất kỳ
export function bindGridActions(rootEl, { onWishChange } = {}) {
  if (!rootEl) return;
  rootEl.addEventListener('click', async (e) => {
    // yêu thích
    const wishBtn = e.target.closest('[data-wish]');
    if (wishBtn) {
      const id = Number(wishBtn.dataset.wish);
      wishlist.toggle(id, wishBtn.dataset.name);
      const icon = $('i', wishBtn);
      wishBtn.classList.toggle('on');
      if (icon) icon.className = wishBtn.classList.contains('on')
        ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
      onWishChange?.();
      return;
    }
    // thêm nhanh vào giỏ với cấu hình mặc định
    const addBtn = e.target.closest('[data-quick-add]');
    if (addBtn) {
      const { getMenu, priceOf } = await import('../core/api.js');
      const { cart } = await import('../core/store.js');
      const menu = await getMenu();
      const p = menu.products.find(x => x.id === Number(addBtn.dataset.quickAdd));
      if (!p) return;
      const size = menu.sizes.find(s => s.id === 'M') || menu.sizes[0];
      cart.add({
        id: p.id, slug: p.slug, name: p.name, image: p.image,
        basePrice: p.basePrice, unitPrice: priceOf(p, size.extra),
        qty: 1, size: size.id, ice: '70', sugar: '100', toppings: []
      });
    }
  });

  // giữ badge wishlist đồng bộ
  window.addEventListener('wishlist:change', () => {
    $$('[data-wish]', rootEl).forEach(btn => {
      const on = wishlist.has(Number(btn.dataset.wish));
      btn.classList.toggle('on', on);
      const i = $('i', btn);
      if (i) i.className = on ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    });
  });
}

// Banner slider
export function initBannerSlider(rootSel, banners) {
  const root = $(rootSel);
  if (!root || !banners?.length) return;

  root.innerHTML = `
    <div class="hero-track">
      ${banners.map(b => `
        <div class="hero-slide" style="background-image:url('${b.image}')">
          <div class="container hero-content">
            <h1>${escapeHtml(b.title)}</h1>
            <p>${escapeHtml(b.sub)}</p>
            <a href="${b.link}" class="btn btn-accent">${escapeHtml(b.cta)} <i class="fa-solid fa-arrow-right"></i></a>
          </div>
        </div>`).join('')}
    </div>
    <div class="hero-dots">
      ${banners.map((_, i) => `<button data-slide="${i}" class="${i === 0 ? 'on' : ''}" aria-label="Slide ${i + 1}"></button>`).join('')}
    </div>`;

  const track = $('.hero-track', root);
  const slides = $$('.hero-slide', root);
  const dots = $$('.hero-dots button', root);
  let idx = 0, timer;

  const go = (i) => {
    idx = (i + banners.length) % banners.length;
    track.style.transform = `translateX(-${idx * 100}%)`;
    // bật class .on cho slide hiện tại -> nội dung có hiệu ứng trượt vào
    slides.forEach((s, j) => s.classList.toggle('on', j === idx));
    dots.forEach((d, j) => d.classList.toggle('on', j === idx));
  };
  const play = () => { timer = setInterval(() => go(idx + 1), 5000); };
  const stop = () => clearInterval(timer);

  dots.forEach(d => d.addEventListener('click', () => { stop(); go(Number(d.dataset.slide)); play(); }));
  go(0);
  play();
}
