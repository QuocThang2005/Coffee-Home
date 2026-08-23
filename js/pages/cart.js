// Trang giỏ hàng: bảng chi tiết · voucher · tổng tiền
import { $, $$, formatVND, escapeHtml, toast } from '../core/utils.js';
import { cart, appliedVoucher } from '../core/store.js';
import { getVouchers } from '../core/api.js';

let vouchers = [];

function rowHtml(it, i) {
  return `
  <tr>
    <td style="display:flex;align-items:center;gap:12px;min-width:220px">
      <img src="${it.image}" alt="" width="52" height="52" style="border-radius:9px">
      <div>
        <a href="/product.html?id=${it.slug}"><strong>${escapeHtml(it.name)}</strong></a>
        <div class="muted" style="font-size:.78rem">${escapeHtml(it.size)} · ${escapeHtml(it.ice)} đá · ${escapeHtml(it.sugar)}
          ${it.toppings?.length ? '<br>+' + it.toppings.map(t => escapeHtml(t.name)).join(', +') : ''}
        </div>
      </div>
    </td>
    <td>${formatVND(it.unitPrice)}</td>
    <td><div class="qty-stepper" data-i="${i}">
      <button type="button" data-act="dec"><i class="fa-solid fa-minus"></i></button>
      <input type="number" value="${it.qty}" min="1" max="99" data-i="${i}">
      <button type="button" data-act="inc"><i class="fa-solid fa-plus"></i></button>
    </div></td>
    <td><strong>${formatVND(it.unitPrice * it.qty)}</strong></td>
    <td><button class="icon-btn" data-act="remove" data-i="${i}" aria-label="Xoá"
        style="color:var(--c-danger)"><i class="fa-solid fa-trash-can"></i></button></td>
  </tr>`;
}

function totals() {
  const subtotal = cart.total();
  const v = appliedVoucher.get();
  let discount = 0;
  if (v && subtotal >= (v.minOrder || 0)) {
    if (v.type === 'percent') discount = Math.round(subtotal * v.value / 100);
    else if (v.type === 'fixed') discount = v.value;
  }
  const total = Math.max(0, subtotal - discount);
  return { subtotal, discount, total };
}

function render() {
  const items = cart.get();
  $('#cart-area').style.display = items.length ? '' : 'none';
  $('#cart-empty').hidden = items.length > 0;

  $('#cart-table-wrap').innerHTML = `
    <table class="data-table">
      <thead><tr><th>Sản phẩm</th><th>Đơn giá</th><th>Số lượng</th><th>Tạm tính</th><th></th></tr></thead>
      <tbody>${items.map(rowHtml).join('')}</tbody>
    </table>`;

  const label = $('#cart-count-label');
  if (label) label.textContent = items.length ? `${items.length} loại món` : '';

  const t = totals();
  $('#cart-subtotal').textContent = formatVND(t.subtotal);
  $('#cart-discount').textContent = '-' + formatVND(t.discount);
  $('#cart-total').textContent = formatVND(t.total);
}

export default async function init() {
  vouchers = await getVouchers();
  render();

  // qty & remove
  $('#cart-table-wrap').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const i = Number(btn.dataset.i);
    if (btn.dataset.act === 'remove') {
      cart.remove(i);
      toast('Đã xoá món khỏi giỏ');
      return;
    }
    const input = $(`input[data-i="${i}"]`);
    cart.updateQty(i, (Number(input.value) || 1) + (btn.dataset.act === 'inc' ? 1 : -1));
  });
  $('#cart-table-wrap').addEventListener('change', (e) => {
    if (e.target.matches('input[type=number]')) {
      cart.updateQty(Number(e.target.dataset.i), Number(e.target.value) || 1);
    }
  });

  window.addEventListener('cart:change', render);

  // voucher
  const saved = appliedVoucher.get();
  if (saved) {
    $('#voucher-code').value = saved.code;
    $('#voucher-hint').textContent = `Đang dùng mã ${saved.code}`;
  }
  $('#apply-voucher').addEventListener('click', () => {
    const code = $('#voucher-code').value.trim().toUpperCase();
    const v = vouchers.find(x => x.code === code);
    const subtotal = cart.total();
    if (!v) {
      appliedVoucher.clear();
      $('#voucher-hint').textContent = '';
      toast(`Mã "${code || '—'}" không tồn tại`, 'error');
      render();
      return;
    }
    if (subtotal < (v.minOrder || 0)) {
      toast(`Mã ${v.code} cần đơn tối thiểu ${formatVND(v.minOrder)}`, 'warn');
      return;
    }
    appliedVoucher.set(v);
    $('#voucher-hint').textContent = `Áp dụng thành công: ${v.title}`;
    toast(`Đã áp dụng mã ${v.code} 🎉`, 'success');
    render();
  });
}
