// Thanh toán: pickup/delivery · GPS · voucher · đặt hàng
import { $, $$, formatVND, escapeHtml, toast } from '../core/utils.js';
import { cart, user, appliedVoucher, tableSession } from '../core/store.js';
import { getBranches, getVouchers, submitOrder, getSettings } from '../core/api.js';

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
    location.href = '/pages/cart.html';
    return;
  }

  const table = tableSession.get();

  //mode gọi món tại bàn: KHÔNG bắt buộc đăng nhập
  if (!table && !user.isLoggedIn()) {
    const form = $('#checkout-form');
    if (form) {
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.style.cssText = 'max-width:520px;margin:0 auto;text-align:center;padding:38px 30px';
      panel.innerHTML = `
        <i class="fa-solid fa-lock fa-2x" style="color:var(--c-accent)"></i>
        <h2 style="margin:14px 0 8px">Đăng nhập để thanh toán</h2>
        <p class="muted">Bạn cần có tài khoản Coffee Home để đặt nước — vừa để xác nhận đơn,
           vừa để tích điểm và xem lại lịch sử mua hàng.</p>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:18px;flex-wrap:wrap">
          <a href="/auth/login.html?next=%2Fpages%2Fcheckout.html" class="btn btn-primary"><i class="fa-solid fa-right-to-bracket"></i> Đăng nhập</a>
          <a href="/auth/register.html?next=%2Fpages%2Fcheckout.html" class="btn btn-outline">Tạo tài khoản — tặng 50 điểm</a>
        </div>`;
      form.hidden = true;
      form.parentElement.insertBefore(panel, form);
    }
    return;
  }

  // --- Chế độ tại bàn: ẩn chọn phương thức, tự gán pickup, hiển thị banner bàn ---
  if (table) {
    const methodCards = $('input[name="method"]')?.closest('.panel');
    if (methodCards) {
      methodCards.innerHTML = `
        <h3>Gọi món tại bàn</h3>
        <div class="table-badge-panel">
          <i class="fa-solid fa-table-tennis-paddle-ball"></i>
          <strong>${escapeHtml(table.name)}</strong>
          ${table.seats ? `<span class="muted">${table.seats} ghế</span>` : ''}
        </div>`;
    }
    // đặt phương thức pickup im lặng
    const pickupRadio = $('input[name="method"][value="pickup"]');
    if (pickupRadio) pickupRadio.checked = true;

    // ẩn phần giao hàng + GPS + giờ lấy
    $$('.delivery-only').forEach(el => el.style.display = 'none');
    $$('.pickup-only').forEach(el => el.style.display = 'none');
  }

  branches = await getBranches();
  if (!table) {
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
  }

  // GPS — lấy vị trí + reverse geocode fill địa chỉ
  if (!table) {
    $('#btn-gps').addEventListener('click', () => {
      if (!navigator.geolocation) return toast('Thiết bị không hỗ trợ GPS', 'error');
      const statusEl = $('#gps-status');
      const btnEl = $('#btn-gps');
      btnEl.disabled = true;
      btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lấy…';
      statusEl.textContent = '';
      toast('Đang lấy vị trí…');

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          $('#co-lat').value = lat.toFixed(6);
          $('#co-lng').value = lng.toFixed(6);
          statusEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

          // Reverse geocode qua Nominatim (OpenStreetMap)
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`,
              { headers: { 'Accept': 'application/json' } }
            );
            const data = await res.json();
            if (data.display_name) {
              const addr = $('#co-address');
              if (addr && !addr.value.trim()) {
                addr.value = data.display_name;
                toast('Đã tự điền địa chỉ từ GPS', 'success');
              } else {
                toast(`Vị trí: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'success');
              }
            }
          } catch {
            toast(`Đã định vị: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'success');
          }
          btnEl.disabled = false;
          btnEl.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Dùng vị trí hiện tại';
        },
        (err) => {
          btnEl.disabled = false;
          btnEl.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Dùng vị trí hiện tại';
          if (err.code === 1) toast('Bạn từ chối quyền truy cập vị trí', 'warn');
          else toast('Không lấy được vị trí — vui lòng nhập địa chỉ thủ công', 'warn');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  // Hiển thị QR thanh toán khi chọn bank / momo
  let paySettings = {};
  try { const s = await getSettings(); paySettings = s; } catch {}

  const qrBox = $('#payment-qr-box');
  const qrImg = $('#payment-qr-img');
  const qrLabel = $('#payment-qr-label');
  const qrHint = $('#payment-qr-hint');

  function showPaymentQr(type) {
    if (!qrBox) return;
    if (type === 'bank') {
      const qr = paySettings.payment_bank_qr;
      if (!qr) { qrBox.style.display = 'none'; return; }
      qrBox.style.display = '';
      qrImg.src = qr;
      qrLabel.textContent = `Quét mã QR qua app ngân hàng để chuyển khoản`;
      const bankInfo = [paySettings.payment_bank_name, paySettings.payment_bank_number, paySettings.payment_bank_holder].filter(Boolean).join(' · ');
      qrHint.textContent = bankInfo || 'Sau khi chuyển khoản, bấm Đặt hàng để xác nhận';
    } else if (type === 'momo') {
      const qr = paySettings.payment_momo_qr;
      if (!qr) { qrBox.style.display = 'none'; return; }
      qrBox.style.display = '';
      qrImg.src = qr;
      qrLabel.textContent = `Quét mã QR qua ví điện tử`;
      const momoInfo = [paySettings.payment_momo_name, paySettings.payment_momo_number].filter(Boolean).join(' · ');
      qrHint.textContent = momoInfo || 'Sau khi thanh toán, bấm Đặt hàng để xác nhận';
    } else {
      qrBox.style.display = 'none';
    }
  }

  $$('input[name="payment"]').forEach(r => r.addEventListener('change', () => showPaymentQr(r.value)));
  showPaymentQr('cod');

  window.addEventListener('cart:change', calc);

  // submit
  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = $('#co-name')?.value.trim() || '';
    const phone = $('#co-phone')?.value.trim().replace(/\D/g, '') || '';
    const pickup = table ? true : method() === 'pickup';
    const branchId = table ? '' : Number($('#branch-select').value);
    const address = table ? '' : $('#co-address')?.value.trim() || '';
    const paymentMethod = $('input[name="payment"]:checked')?.value || 'cod';

    if (!table) {
      let ok = true;
      setInvalid('#fg-name', !name); ok &&= !!name;
      setInvalid('#fg-phone', phone.length < 9); ok &&= phone.length >= 9;
      if (pickup) {
        setInvalid('#branch-select', !branchId); ok &&= !!branchId;
        $('#branch-select')?.closest('.form-group')?.classList.toggle('invalid', !branchId);
      } else {
        setInvalid('#fg-phone', false);
        $('#co-address')?.closest('.form-group')?.classList.toggle('invalid', address.length < 8);
        ok &&= address.length >= 8;
      }
      if (!ok) return toast('Kiểm tra lại các ô đánh dấu * nhé!', 'warn');
    }

    const branch = table ? null : branches.find(b => b.id === branchId);
    const total = calc();
    const btn = $('#btn-place-order');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý…';

    let res;
    try {
      res = await submitOrder({
        customer: { name: name || 'Khách lẻ', phone },
        method: pickup ? 'pickup' : 'delivery',
        branchId: branchId ? String(branchId) : (table ? '' : ''),
        address,
        voucherCode: appliedVoucher.get()?.code || '',
        note: $('#co-note')?.value.trim() || '',
        items: cart.get().map(it => ({ ...it, id: String(it.id) })),
        subtotal: cart.total(),
        shipFee: pickup ? 0 : shipFee(),
        discount: discount().amount,
        total,
        tableId: table?.id || '',
        paymentMethod,
      });
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-mug-hot"></i> Đặt hàng';
      toast(err.status
        ? (err.message || 'Đặt hàng thất bại, vui lòng thử lại')
        : 'Không kết nối được quán — hãy chắc chắn start-coffee.bat đang chạy', 'error', 5000);
      return;
    }

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
