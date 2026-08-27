// Chi tiết món: tùy chọn size/đá/đường/topping + thêm giỏ
import { $, $$, formatVND, escapeHtml, getParam, starHtml, toast } from '../core/utils.js';
import { getMenu, priceOf, getVouchers, getProductReviews, submitReview } from '../core/api.js';
import { cart, wishlist, appliedVoucher } from '../core/store.js';
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

      <div class="voucher-input-row" id="voucher-row" style="display:flex;gap:8px;align-items:center;margin-top:14px">
        <div style="flex:1;position:relative">
          <input type="text" id="voucher-input" class="input" placeholder="Nhập mã giảm giá…"
                 style="padding:10px 14px;padding-right:38px;text-transform:uppercase;font-weight:600;letter-spacing:1px">
          <i class="fa-solid fa-ticket" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--c-muted)"></i>
        </div>
        <button type="button" class="btn btn-outline" id="btn-apply-voucher" style="white-space:nowrap;padding:10px 16px">
          <i class="fa-solid fa-check"></i> Áp dụng
        </button>
      </div>
      <div id="voucher-msg" style="font-size:.82rem;margin-top:6px;min-height:20px"></div>

      <div class="action-row" style="display:flex;gap:14px;align-items:center;margin-top:22px;flex-wrap:wrap">
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
    <div id="reviews-section"><p class="muted">Đang tải đánh giá...</p></div>

    <div id="review-form-box" class="info-card" style="margin-top:18px;display:none">
      <h4 class="mb-1">Viết đánh giá</h4>
      <div id="review-stars" class="review-stars-input" style="font-size:1.5rem;cursor:pointer;display:flex;gap:4px;margin-bottom:8px">
        ${[1,2,3,4,5].map(i => `<i class="fa-regular fa-star" data-val="${i}"></i>`).join('')}
      </div>
      <input type="text" id="review-title" class="input" placeholder="Tiêu đề (tùy chọn)" maxlength="100" style="margin-bottom:8px">
      <textarea id="review-message" class="input" rows="3" placeholder="Chia sẻ cảm nhận của bạn..." maxlength="2000" style="resize:vertical"></textarea>
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
        <button class="btn btn-accent" id="btn-submit-review"><i class="fa-solid fa-paper-plane"></i> Gửi đánh giá</button>
        <span id="review-msg" style="font-size:.82rem"></span>
      </div>
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

  // voucher
  const vouchers = await getVouchers();
  const voucherMsg = $('#voucher-msg');
  const voucherInput = $('#voucher-input');

  // hiển thị voucher đang áp dụng (nếu có từ trang khác)
  const prevVoucher = appliedVoucher.get();
  if (prevVoucher) {
    voucherInput.value = prevVoucher.code;
    voucherMsg.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--c-success)"></i> Đã áp mã <strong>${prevVoucher.code}</strong>`;
  }

  $('#btn-apply-voucher').addEventListener('click', () => {
    const code = voucherInput.value.trim().toUpperCase();
    if (!code) {
      voucherMsg.innerHTML = `<span style="color:var(--c-danger)">Nhập mã giảm giá trước</span>`;
      return;
    }
    const found = vouchers.find(v => v.code.toUpperCase() === code);
    if (!found) {
      voucherMsg.innerHTML = `<span style="color:var(--c-danger)"><i class="fa-solid fa-circle-xmark"></i> Mã "${code}" không tồn tại</span>`;
      appliedVoucher.clear();
      return;
    }
    // kiểm tra hạn
    if (found.until) {
      const until = found.until.split('/').reverse().join('-');
      if (new Date() > new Date(until)) {
        voucherMsg.innerHTML = `<span style="color:var(--c-danger)"><i class="fa-solid fa-circle-xmark"></i> Mã "${code}" đã hết hạn</span>`;
        appliedVoucher.clear();
        return;
      }
    }
    appliedVoucher.set(found);
    const desc = found.type === 'percent' ? `Giảm ${found.value}%`
      : found.type === 'fixed' ? `Giảm ${formatVND(found.value)}`
      : found.type === 'freeship' ? 'Miễn phí ship' : 'Tặng món';
    voucherMsg.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--c-success)"></i> <strong>${found.code}</strong> — ${desc}${found.minOrder ? ` (đơn tối thiểu ${formatVND(found.minOrder)})` : ''}`;
    toast(`Đã áp mã ${found.code}`, 'success');
  });

  // enter cũng áp dụng
  voucherInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('#btn-apply-voucher').click(); }
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
  $('#buy-now').addEventListener('click', () => { cart.add(buildItem(), true); location.href = '/pages/checkout.html'; });

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

  // ---- Reviews ----
  const REV_SEC = $('#reviews-section');
  const FORM_BOX = $('#review-form-box');
  let selectedRating = 0;

  async function loadReviews() {
    try {
      const res = await getProductReviews(p.id);
      const reviews = res.reviews || [];
      if (!reviews.length) {
        REV_SEC.innerHTML = '<p class="muted">Chưa có đánh giá nào cho sản phẩm này.</p>';
      } else {
        const avgHtml = res.totalReviews
          ? `<div class="pc-rating mb-2" style="font-size:.9rem">${starHtml(res.avgRating)} <span>${res.avgRating} · ${res.totalReviews} đánh giá</span></div>`
          : '';
        REV_SEC.innerHTML = avgHtml + '<div class="grid-cards">' + reviews.map(r => {
          const stars = '⭐'.repeat(r.rating);
          const date = r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '';
          return `<div class="info-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <strong>${escapeHtml(r.user_name || 'Khách')} ${stars}</strong>
              <span class="muted" style="font-size:.75rem">${date}</span>
            </div>
            ${r.title ? `<div style="font-weight:600;margin-bottom:2px">${escapeHtml(r.title)}</div>` : ''}
            <p style="margin:0">"${escapeHtml(r.message)}"</p>
          </div>`;
        }).join('') + '</div>';
      }
    } catch {
      REV_SEC.innerHTML = '<p class="muted">Không thể tải đánh giá.</p>';
    }
  }
  loadReviews();

  const authT = localStorage.getItem('ch_token');
  if (authT) {
    FORM_BOX.style.display = 'block';

    const stars = $$('#review-stars i');
    stars.forEach(icon => {
      icon.addEventListener('click', () => {
        selectedRating = Number(icon.dataset.val);
        stars.forEach(s => {
          s.className = Number(s.dataset.val) <= selectedRating ? 'fa-solid fa-star' : 'fa-regular fa-star';
        });
      });
      icon.addEventListener('mouseenter', () => {
        const v = Number(icon.dataset.val);
        stars.forEach(s => { s.style.color = Number(s.dataset.val) <= v ? '#f59e0b' : ''; });
      });
      icon.addEventListener('mouseleave', () => {
        stars.forEach(s => { s.style.color = ''; });
      });
    });

    $('#btn-submit-review').addEventListener('click', async () => {
      if (!selectedRating) { toast('Chọn số sao trước', 'warn'); return; }
      const message = $('#review-message').value.trim();
      if (message.length < 5) { toast('Nhận xét tối thiểu 5 ký tự', 'warn'); return; }
      const btn = $('#btn-submit-review');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      try {
        await submitReview({
          productId: p.id,
          rating: selectedRating,
          title: $('#review-title').value.trim(),
          message
        });
        toast('Gửi đánh giá thành công!', 'success');
        $('#review-message').value = '';
        $('#review-title').value = '';
        selectedRating = 0;
        stars.forEach(s => { s.className = 'fa-regular fa-star'; });
        loadReviews();
      } catch (err) {
        toast(err.message || 'Gửi thất bại', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi đánh giá';
      }
    });
  }
}
