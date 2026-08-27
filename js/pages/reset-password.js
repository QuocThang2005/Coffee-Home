// Đặt lại mật khẩu (mock)
import { $, toast } from '../core/utils.js';

export default function init() {
  document.getElementById('rp-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = $('#rp-pass').value;
    const confirm = $('#rp-confirm').value;

    const strong = pass.length >= 8 && /[A-Z]/.test(pass) && /\d/.test(pass);
    $('#rp-pass').closest('.form-group').classList.toggle('invalid', !strong);
    $('#rp-confirm').closest('.form-group').classList.toggle('invalid', pass !== confirm);

    if (!strong) return toast('Mật khẩu cần 8+ ký tự, có chữ hoa và số', 'warn');
    if (pass !== confirm) return toast('Mật khẩu nhập lại chưa khớp', 'error');

    toast('Đặt lại mật khẩu thành công! Mời bạn đăng nhập.', 'success');
    setTimeout(() => location.href = '/auth/login.html', 800);
  });
}
