// Thanh toán: pickup/delivery · GPS · voucher · đặt hàng
import { $, $$, formatVND, escapeHtml, toast } from '../core/utils.js';
import { cart, user, appliedVoucher } from '../core/store.js';
import { getBranches, getVouchers, submitOrder } from '../core/api.js';

let branches = [];

const PAY_LABEL = { cod: 'Tiền mặt khi nhận', bank: 'Chuyển khoản', momo: 'Ví điện tử' };

function method() {
  return $('input[name="method"]:checked').value;
}

function toggleMethodUI() {
  const isPickup = method() === 'pickup';
  $$('.pickup-only').forEach(el => el.style.display = isPickup ? '' : 'none');
  $$('.delivery-only').forEach(el => el.style.display = isPickup ? 'none' : '');
  calc();
}

function shipFee() {
  if (method() === 'pickup') return 0;
  const v = appliedVoucher.get();
  const subtotal = cart.total();
  if (v?.type === 'freeship' && subtotal >= (v.minOrder || 0)) return 0;
  if (subtotal >= 99000) return 0; // ưu đãi đơn lớn
  return 20000;
}

function discount() {
  const v = appliedVoucher.get();
  const subtotal = cart.total();
  if (!v || subtotal < (v.minOrder || 0)) return { amount: 0, name: '' };
  let amount = 0;
  if (v.type === 'percent') amount = Math.round(subtotal * v.value / 100);
  else if (v.type === 'fixed') amount = v.value;
  return { amount, name: v.code };
}

function calc() {
  const items = cart.get();
  $('#sum-items').innerHTML = items.map(it => `
    <div class="sum-row" style="align-items:start">
      <span>${it.qty} × ${escapeHtml(it.name)}
        <small class="muted" style="display:block;font-size:.76rem">${escapeHtml(it.size)}</small>
      </span>
      <span>${formatVND(it.unitPrice * it.qty)}</span>
    </div>`).join('');

  const d = discount();
  const fee = shipFee();
  const total = Math.max(0, cart.total() - d.amount) + fee;

  $('#sum-subtotal').textContent = formatVND(cart.total());
  $('#sum-discount').firstChild.textContent = '-' + formatVND(d.amount) + ' ';
  $('#sum-voucher-name').textContent = d.name ? `(${d.name})` : '';
  $('#sum-ship').textContent = method() === 'pickup' ? 'Miễn phí' : formatVND(fee);
  $('#sum-grandtotal').textContent = formatVND(total);

  $('#btn-place-order').disabled = !items.length;
  return total;
}

function setInvalid(id, bad) {
  $(id).classList.toggle('invalid', bad);
}

export default async function init() {
  // giỏ trống -> về giỏ hàng
  if (!cart.get().length) {
    location.href = '/cart.html';
    return;
  }

  branches = await getBranches();
  $('#branch-select').innerHTML =
    '<option value="">— chọn chi nhánh —</option>' +
    branches.map(b => `<option value="${b.id}">${escapeHtml(b.name)} — ${escapeHtml(b.address)}</option>`).join('');

  // điền sẵn từ tài khoản
  const u = user.get();
  if (u) {
    $('#co-name').value = u.name;
    $('#co-phone').value = u.phone || '';
  }

  $$('input[name="method"]').forEach(r => r.addEventListener('change', toggleMethodUI));
  toggleMethodUI();

  // GPS
  $('#btn-gps').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Thiết bị không hỗ trợ GPS', 'error');
    toast('Đang lấy vị trí…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        $('#co-lat').value = pos.coords.latitude.toFixed(6);
        $('#co-lng').value = pos.coords.longitude.toFixed(6);
        toast(`Đã định vị: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`, 'success');
      },
      () => toast('Không lấy được vị trí — bạn nhập địa chỉ giúp quán nhé', 'warn'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  window.addEventListener('cart:change', calc);

  // submit
  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = $('#co-name').value.trim();
    const phone = $('#co-phone').value.trim().replace(/\D/g, '');
    const pickup = method() === 'pickup';
    const branchId = Number($('#branch-select').value);
    const address = $('#co-address').value.trim();

    let ok = true;
    setInvalid('#fg-name', !name); ok &&= !!name;
    setInvalid('#fg-phone', phone.length < 9); ok &&= phone.length >= 9;
    if (pickup) {
      setInvalid('#branch-select', !branchId); ok &&= !!branchId;
      $('#branch-select').closest('.form-group').classList.toggle('invalid', !branchId);
    } else {
      setInvalid('#fg-phone', false);
      $('#co-address').closest('.form-group').classList.toggle('invalid', address.length < 8);
      ok &&= address.length >= 8;
    }
    if (!ok) return toast('Kiểm tra lại các ô đánh dấu * nhé!', 'warn');

    const branch = branches.find(b => b.id === branchId);
    const total = calc();
    const btn = $('#btn-place-order');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý…';

    const res = await submitOrder({
      customer: { name, phone },
      method: method(),
      branchId: branchId || null,
      branchName: branch?.name || null,
      address: address || null,
      lat: $('#co-lat').value || null,
      lng: $('#co-lng').value || null,
      time: pickup ? $('#co-time').value : null,
      note: $('#co-note').value.trim() || null,
      payment: $('input[name="payment"]:checked').value,
      voucherCode: appliedVoucher.get()?.code || null,
      items: cart.get(),
      subtotal: cart.total(),
      discount: discount().amount,
      shippingFee: shipFee(),
      total
    });

    // dọn giỏ + voucher sau khi đặt
    cart.clear();
    appliedVoucher.clear();

    $('#os-code').textContent = res.code || 'CH-DEMO01';
    $('#os-points').textContent = res.points
      ? `Bạn được tặng +${res.points} điểm cho đơn này 🎉` : '';
    document.querySelector('#checkout-form').hidden = true;
    const hero = document.querySelector('.page-hero');
    if (hero) hero.hidden = true;
    $('#checkout-success').hidden = false;
    window.scrollTo({ top: 0 });
  });
}
