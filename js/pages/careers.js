// Form ứng tuyển — careers.html
// Gửi hồ sơ tới backend (bảng applications), admin duyệt trong dashboard.
import { toast } from '../core/utils.js';
import { submitApplication } from '../core/api.js';

const val = (id) => document.getElementById(id)?.value.trim() || '';

function markInvalid(fgId, bad) {
  document.getElementById(fgId)?.classList.toggle('invalid', bad);
  return !bad;
}

function validate(data) {
  let ok = true;
  ok = markInvalid('fg-ap-name', data.name.length < 2) && ok;
  ok = markInvalid('fg-ap-phone', !/^\d{9,12}$/.test(data.phone)) && ok;
  const otherFg = document.getElementById('fg-ap-position-other');
  const posFgId = otherFg && !otherFg.hidden ? 'fg-ap-position-other' : 'fg-ap-position';
  ok = markInvalid(posFgId, !data.position) && ok;
  if (data.email && !data.email.includes('@')) {
    toast('Email không hợp lệ', 'warn');
    return false;
  }
  return ok;
}

export default function init() {
  // nút "Ứng tuyển ngay" ở các thẻ vị trí: chọn sẵn vị trí rồi cuộn xuống form
  document.querySelectorAll('[data-apply]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sel = document.getElementById('ap-position');
      if (sel && btn.dataset.apply) {
        sel.value = btn.dataset.apply;
        sel.dispatchEvent(new Event('change'));
      }
    });
  });

  // gỡ highlight lỗi khi người dùng sửa lại
  ['ap-name', 'ap-phone'].forEach(id =>
    document.getElementById(id)?.addEventListener('input', e =>
      e.target.closest('.form-group')?.classList.remove('invalid')));
  document.getElementById('ap-position')?.addEventListener('change', e => {
    e.target.closest('.form-group')?.classList.remove('invalid');
    const otherFg = document.getElementById('fg-ap-position-other');
    if (otherFg) otherFg.hidden = e.target.value !== '_other';
    if (otherFg && otherFg.hidden) markInvalid('fg-ap-position-other', false);
  });
  document.getElementById('ap-position-other')?.addEventListener('input', e =>
    e.target.closest('.form-group')?.classList.remove('invalid'));

  const form = document.getElementById('apply-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawPos = val('ap-position');
    const data = {
      name: val('ap-name'),
      phone: val('ap-phone'),
      email: val('ap-email'),
      position: rawPos === '_other' ? val('ap-position-other') : rawPos,
      note: val('ap-note')
    };
    if (!validate(data)) { toast('Vui lòng kiểm tra lại các ô đánh dấu đỏ', 'warn'); return; }

    const btn = document.getElementById('ap-submit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';
    try {
      const res = await submitApplication(data);
      form.hidden = true;
      const ok = document.getElementById('apply-success');
      document.getElementById('apply-success-msg').textContent =
        res.message || 'Quán sẽ liên hệ bạn trong 2-3 ngày làm việc.';
      ok.hidden = false;
      ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (ex) {
      toast(ex.message || 'Gửi hồ sơ thất bại — thử lại nhé', 'error', 4000);
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gửi hồ sơ ứng tuyển';
    }
  });
}
