// Quên mật khẩu — gửi link đặt lại (mock)
import { $, toast } from '../core/utils.js';

export default function init() {
  document.getElementById('fp-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#fp-email').value.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $('#fg-femail')?.classList.add('invalid');
      return toast('Email chưa đúng định dạng', 'warn');
    }

    $('#fp-form').hidden = true;
    document.querySelector('.divider-or')?.setAttribute('hidden', '');
    $('#fp-done').hidden = false;
    toast(`Đã gửi link đặt lại tới ${email}`, 'success');
  });
}
