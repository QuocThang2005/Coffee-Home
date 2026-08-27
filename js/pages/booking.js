// Đặt bàn: chọn chi nhánh · ngày · slot giờ (mock bận/trống)
import { $, $$, toast } from '../core/utils.js';
import { getBranches, submitBooking } from '../core/api.js';
import { user } from '../core/store.js';

const OPEN_HOURS = Array.from({ length: 13 }, (_, i) => 9 + i); // 9:00 → 21:00

// "bàn đã có người" giả lập ổn định theo ngày+giờ (không đổi mỗi lần render)
function isBusy(dateStr, hour) {
  let h = 0;
  const s = dateStr + hour;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 997;
  return h % 5 === 0; // ~20% slot bận
}

let chosenSlot = null;

function renderSlots(dateStr) {
  const wrap = $('#bk-time-slots');
  const now = new Date();
  const isToday = dateStr === now.toISOString().slice(0, 10);

  wrap.innerHTML = OPEN_HOURS.map(h => {
    const label = `${String(h).padStart(2, '0')}:00`;
    const past = isToday && h <= now.getHours();
    const busy = past || isBusy(dateStr, h);
    return `<button type="button" class="chip" data-hour="${h}" ${busy ? 'disabled style="opacity:.4;text-decoration:line-through"' : ''}>${label}</button>`;
  }).join('');
  chosenSlot = null;
}

export default async function init() {
  const branches = await getBranches();
  $('#bk-branch').innerHTML =
    '<option value="">— chọn chi nhánh —</option>' +
    branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

  // ngày: min hôm nay, mặc định hôm nay
  const today = new Date();
  const iso = d => d.toLocaleDateString('sv-SE'); // yyyy-mm-dd local
  const dateInput = $('#bk-date');
  dateInput.min = iso(today);
  dateInput.value = iso(today);
  renderSlots(dateInput.value);

  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    if (dateInput.value < dateInput.min) { dateInput.value = dateInput.min; }
    renderSlots(dateInput.value);
  });

  $('#bk-time-slots').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip[data-hour]');
    if (!chip || chip.disabled) return;
    $$('#bk-time-slots .chip').forEach(c => c.classList.remove('on'));
    chip.classList.add('on');
    chosenSlot = chip.textContent;
    $('#fg-bk-slot').classList.remove('invalid');
  });

  const u = user.get();
  if (u) {
    $('#bk-name').value = u.name;
    $('#bk-phone').value = u.phone || '';
  }

  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const branchId = Number($('#bk-branch').value);
    const name = $('#bk-name').value.trim();
    const phone = $('#bk-phone').value.trim().replace(/\D/g, '');

    let ok = true;
    $('#bk-branch').closest('.form-group').classList.toggle('invalid', !branchId); ok &&= !!branchId;
    setInvalid('#fg-bk-date', !dateInput.value); ok &&= !!dateInput.value;
    $('#fg-bk-slot').classList.toggle('invalid', !chosenSlot); ok &&= !!chosenSlot;
    $('#fg-bk-name').classList.toggle('invalid', !name); ok &&= !!name;
    const badPhone = phone.length < 9;
    $('#fg-bk-phone').classList.toggle('invalid', badPhone); ok &&= !badPhone;
    if (!ok) return toast('Điền đủ thông tin đánh dấu * nhé!', 'warn');

    const btn = $('#btn-book');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang giữ bàn…';

    const branch = branches.find(b => b.id === branchId);
    let res;
    try {
      // khớp chặt với model BookingIn của backend — branchId là chuỗi, không gửi null
      res = await submitBooking({
        branchId: String(branchId),
        date: dateInput.value,
        time: chosenSlot,
        guests: Number($('#bk-guests').value),
        name,
        phone,
        note: $('#bk-note').value.trim()
      });
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-chair"></i> Đặt bàn';
      toast(err.status
        ? (err.message || 'Đặt bàn thất bại, vui lòng thử lại')
        : 'Không kết nối được quán — hãy chắc chắn start-coffee.bat đang chạy', 'error', 5000);
      return;
    }

    document.getElementById('booking-form').hidden = true;
    document.querySelector('.page-hero h1').textContent = 'Đặt bàn trước';
    $('#bs-code').textContent = res.code || 'BK-DEMO01';
    $('#bs-info').textContent =
      `${branch.name} · ${$('#bk-guests').options[$('#bk-guests').selectedIndex].text} · ${dateInput.value} lúc ${chosenSlot}. ` +
      'Quán sẽ gọi xác nhận trong ít phút!';
    const success = $('#booking-success');
    success.hidden = false;
    window.scrollTo({ top: 0 });
  });
}

function setInvalid(sel, bad) {
  $(sel).classList.toggle('invalid', bad);
}
