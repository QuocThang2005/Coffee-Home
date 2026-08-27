// Tạo tài khoản — gọi /api/auth/register, backend tắt thì fallback mock
import { $, toast } from '../core/utils.js';
import { register } from '../core/api.js';
import { user, onUserLogin } from '../core/store.js';
import { signInWithGoogle, signInWithFacebook } from '../auth/google-auth.js';

export default function init() {
  // nếu được gửi từ trang thanh toán (?next=...) thì sau khi đăng ký quay lại đó
  const next = new URLSearchParams(location.search).get('next');
  const dest = next && next.startsWith('/') ? next : '/index.html';
  document.getElementById('rg-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#rg-name').value.trim();
    const email = $('#rg-email').value.trim().toLowerCase();
    const phone = $('#rg-phone').value.trim().replace(/\D/g, '');
    const pass = $('#rg-pass').value;
    const pass2 = $('#rg-pass2').value;
    const agree = $('#rg-agree').checked;

    let ok = true;
    const mark = (sel, bad) => { $(sel)?.closest('.form-group').classList.toggle('invalid', bad); };

    mark('#fg-rname', name.length < 2); ok &&= name.length >= 2;
    mark('#fg-remail', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)); ok &&= /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (phone) { mark('#fg-rphone', phone.length < 9); ok &&= phone.length >= 9; }
    mark('#fg-rpass', pass.length < 8); ok &&= pass.length >= 8;
    mark('#fg-rpass2', pass2 !== pass); ok &&= pass2 === pass;
    $('#rg-agree-error').hidden = agree; ok &&= agree;

    if (!ok) return toast('Kiểm tra lại thông tin đánh dấu * nhé!', 'warn');

    const btn = $('button[type="submit"]', e.target);
    const btnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo tài khoản…';

    try {
      const res = await register(name, email, pass);
      if (res.user) { user.set(res.user); onUserLogin(res.user); }
      toast('Tạo tài khoản thành công — tặng ngay 50 điểm! 🎉', 'success');
      setTimeout(() => location.href = dest, 700);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = btnHtml;
      if (err.status) toast(err.message || 'Không tạo được tài khoản', 'error');
      else {
        // backend chưa chạy — tạo tài khoản demo offline
        const mock = { name, email, points: 50, isAdmin: false };
        user.set(mock);
        onUserLogin(mock);
        toast('Backend chưa chạy — tài khoản chỉ lưu trên máy này', 'warn');
        setTimeout(() => location.href = dest, 900);
      }
    }
  });

  $('#btn-google')?.addEventListener('click', () => signInWithGoogle());
  $('#btn-facebook')?.addEventListener('click', () => signInWithFacebook());
}
