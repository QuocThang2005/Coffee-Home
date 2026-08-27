// Đăng nhập — gọi /api/auth/login, backend tắt thì fallback mock
import { $, toast } from '../core/utils.js';
import { login } from '../core/api.js';
import { user, onUserLogin } from '../core/store.js';
import { signInWithGoogle, signInWithFacebook } from '../auth/google-auth.js';

export default function init() {
  // nếu bị chuyển tới từ trang thanh toán (?next=...) thì sau khi đăng nhập quay lại đó
  const next = new URLSearchParams(location.search).get('next');
  const dest = next && next.startsWith('/') ? next : '/index.html';
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
    const btnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng nhập…';

    try {
      const res = await login(email, pass);
      if (res.user) { user.set(res.user); onUserLogin(res.user); }
      else throw new Error('Phản hồi không hợp lệ');
      toast(`Chào mừng trở lại! ☕`, 'success');
      setTimeout(() => location.href = dest, 600);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = btnHtml;
      if (err.status) toast(err.message || 'Email hoặc mật khẩu không đúng', 'error');
      else {
        // backend chưa chạy — đăng nhập demo offline
        const name = email.split('@')[0].replace(/[._]/g, ' ');
        const mock = { name, email, points: 120, isAdmin: false };
        user.set(mock);
        onUserLogin(mock);
        toast('Backend chưa chạy — đăng nhập chế độ offline', 'warn');
        setTimeout(() => location.href = dest, 900);
      }
    }
  });

  $('#btn-google')?.addEventListener('click', () => signInWithGoogle());
  $('#btn-facebook')?.addEventListener('click', () => signInWithFacebook());
}
