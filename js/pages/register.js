// Tạo tài khoản (mock)
import { $, toast } from '../core/utils.js';
import { register } from '../core/api.js';
import { signInWithGoogle, signInWithFacebook } from '../auth/google-auth.js';

export default function init() {
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
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo tài khoản…';

    await register(name, email);
    toast('Tạo tài khoản thành công — tặng ngay 50 điểm! 🎉', 'success');
    setTimeout(() => location.href = '/index.html', 700);
  });

  $('#btn-google')?.addEventListener('click', () => signInWithGoogle());
  $('#btn-facebook')?.addEventListener('click', () => signInWithFacebook());
}
