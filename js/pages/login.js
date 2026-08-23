// Đăng nhập (mock — mọi email hợp lệ đều vào được tới khi có backend)
import { $, toast } from '../core/utils.js';
import { login } from '../core/api.js';
import { signInWithGoogle, signInWithFacebook } from '../auth/google-auth.js';

export default function init() {
  // nút hiện/ẩn mật khẩu
  $('#lg-toggle-pass')?.addEventListener('click', () => {
    const input = $('#lg-pass');
    const icon = $('#lg-toggle-pass i');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    icon.className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
  });

  document.getElementById('lg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#lg-email').value.trim().toLowerCase();
    const pass = $('#lg-pass').value;

    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    $('#fg-email').classList.toggle('invalid', !okEmail);
    if (!okEmail) return toast('Email chưa đúng định dạng', 'warn');
    if (pass.length < 6) {
      $('#fg-pass').classList.add('invalid');
      return toast('Mật khẩu tối thiểu 6 ký tự', 'warn');
    }

    const btn = $('button[type="submit"]', e.target);
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng nhập…';

    await login(email, pass);
    toast(`Chào mừng trở lại! ☕`, 'success');
    setTimeout(() => location.href = '/index.html', 600);
  });

  $('#btn-google')?.addEventListener('click', () => signInWithGoogle());
  $('#btn-facebook')?.addEventListener('click', () => signInWithFacebook());
}
