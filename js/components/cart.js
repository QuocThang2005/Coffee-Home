// Cart drawer — giỏ hàng trượt từ phải, dùng chung mọi trang
import { $, formatVND, escapeHtml } from '../core/utils.js';
import { cart } from '../core/store.js';

function itemHtml(it, i) {
  return `
  <div class="cd-item">
    <img src="${it.image}" alt="">
    <div style="flex:1;min-width:0">
      <div class="cdi-name">${escapeHtml(it.name)}</div>
      <div class="cdi-opt">${escapeHtml(it.size)} · ${escapeHtml(it.ice)} đá · ${escapeHtml(it.sugar)} đường
        ${it.toppings?.length ? '<br>+' + it.toppings.map(t => escapeHtml(t.name)).join(', +') : ''}
      </div>
      <div class="qty-stepper" data-i="${i}">
        <button type="button" data-act="dec" aria-label="Giảm"><i class="fa-solid fa-minus"></i></button>
        <input type="number" value="${it.qty}" min="1" max="99" aria-label="Số lượng">
        <button type="button" data-act="inc" aria-label="Tăng"><i class="fa-solid fa-plus"></i></button>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:end;gap:4px">
      <div class="cdi-price">${formatVND(it.unitPrice * it.qty)}</div>
      <button type="button" class="cdi-remove" data-act="remove" data-i="${i}"><i class="fa-solid fa-trash-can"></i> Xoá</button>
    </div>
  </div>`;
}

export function renderCart() {
  const items = cart.get();
  const wrap = $('.cd-items');
  if (!wrap) return;

  if (!items.length) {
    wrap.innerHTML = `
      <div class="cd-empty">
        <i class="fa-solid fa-basket-shopping"></i>
        <h3>Giỏ hàng đang trống</h3>
        <p>Ghé thực đơn chọn vài món ngon nhé!</p>
        <a href="/pages/menu.html" class="btn btn-primary mt-2">Xem thực đơn</a>
      </div>`;
  } else {
    wrap.innerHTML = items.map(itemHtml).join('');
  }
  const t = $('#cd-total');
  if (t) t.textContent = formatVND(cart.total());
}

export function toggleCart(open) {
  const drawer = $('#cart-drawer');
  const overlay = $('#cart-overlay');
  if (!drawer) return;
  renderCart();
  drawer.classList.toggle('open', open);
  overlay.classList.toggle('show', open);
  const navOpen = document.getElementById('mobile-nav')?.classList.contains('open');
  document.body.style.overflow = (open || navOpen) ? 'hidden' : '';
}

export function openCart() { toggleCart(true); }

export function initCartDrawer() {
  if ($('#cart-drawer')) return; // đã init
  document.body.insertAdjacentHTML('beforeend', `
    <aside class="cart-drawer" id="cart-drawer" aria-label="Giỏ hàng">
      <div class="cd-head">
        <h3><i class="fa-solid fa-basket-shopping"></i> Giỏ hàng</h3>
        <button class="icon-btn" id="cd-close" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="cd-items"></div>
      <div class="cd-foot">
        <div class="cd-total"><span>Tạm tính</span><span id="cd-total">0₫</span></div>
        <a href="/pages/cart.html" class="btn btn-outline btn-block mb-2">Xem giỏ hàng</a>
        <a href="/pages/checkout.html" class="btn btn-primary btn-block">Thanh toán</a>
      </div>
    </aside>
    <div class="overlay" id="cart-overlay"></div>`);

  $('#cd-close').addEventListener('click', () => toggleCart(false));
  $('#cart-overlay').addEventListener('click', () => toggleCart(false));

  // qty + remove (delegation)
  $('.cd-items').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'remove') {
      cart.remove(Number(btn.dataset.i));
      toggleCart(true); // re-render
      return;
    }
    const stepper = btn.closest('.qty-stepper');
    const i = Number(stepper.dataset.i);
    const input = $('input', stepper);
    let q = Number(input.value) || 1;
    cart.updateQty(i, act === 'inc' ? q + 1 : q - 1);
    toggleCart(true);
  });
  $('.cd-items').addEventListener('change', (e) => {
    if (e.target.tagName !== 'INPUT') return;
    const stepper = e.target.closest('.qty-stepper');
    cart.updateQty(Number(stepper.dataset.i), Number(e.target.value) || 1);
    toggleCart(true);
  });

  window.addEventListener('cart:change', () => {
    const drawer = $('#cart-drawer');
    if (drawer?.classList.contains('open')) renderCart();
  });
}
