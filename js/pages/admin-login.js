// Trang đăng nhập quản trị — viết lại, tối giản & chống vòng lặp.
// Nguyên tắc: token sai/hết hạn -> XOÁ NGAY. Chỉ chuyển sang dashboard khi /auth/me xác nhận thành công.

import { $ } from '../core/utils.js';
import { login, fetchMe } from '../core/api.js';

const ADMIN_EMAIL = 'admin@coffeehome.vn';

function showError(msg) {
  const el = $('#al-error');
  if (el) el.textContent = msg || '';
}

function setStatus(html) {
  const el = $('#al-status');
  if (el) el.innerHTML = html;
}

function goDashboard() {
  location.replace('/admin/admin.html');
}

export default async function init() {
  // Có token cũ -> thử xác thực luôn
  const token = localStorage.getItem('ch_admin_token');
  if (token) {
    try {
      const res = await fetchMe();
      if (res?.user?.isAdmin) return goDashboard();
      // đúng token nhưng không phải admin -> xoá
      localStorage.removeItem('ch_admin_token');
    } catch (err) {
      localStorage.removeItem('ch_admin_token'); // token hỏng/hết hạn: xoá bất kể lý do -> hết loop
      if (!err.status) {
        setStatus('<i class="fa-solid fa-triangle-exclamation" style="color:#b97a1c"></i> Backend chưa chạy — hãy mở start-coffee.bat rồi tải lại trang (F5)');
      }
    }
  }
  localStorage.removeItem('ch_admin_user'); // dọn rác user demo cũ

  setStatus('Backend: <a href="/api/health" target="_blank">kiểm tra</a> · chưa chạy thì mở <b>start-coffee.bat</b>');

  $('#al-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = $('#al-user').value.trim();
    const pass = $('#al-pass').value;
    const btn = $('#al-submit');
    const oldHtml = btn.innerHTML;

    showError('');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang kiểm tra…';

    try {
      let email;
      if (raw.includes('@')) email = raw.toLowerCase();
      else if (raw.toLowerCase() === 'admin') email = ADMIN_EMAIL;
      else throw Object.assign(new Error('Chỉ chấp nhận "admin" hoặc email đầy đủ'), { status: 401 });

      const res = await login(email, pass);
      if (!res.user?.isAdmin) {
        localStorage.removeItem('ch_admin_token');
        throw new Error('Tài khoản này không có quyền quản trị');
      }
      // KHÔNG gọi user.set ở đây — đó là khóa của khách; admin dùng ch_admin_user
      localStorage.setItem('ch_admin_user', JSON.stringify(res.user));
      setTimeout(goDashboard, 300);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = oldHtml;
      if (err.status === 401) showError(err.message || 'Sai tài khoản hoặc mật khẩu!');
      else if (!err.status) showError('Không kết nối được backend — mở start-coffee.bat và giữ cửa sổ đó mở, rồi F5 trang này.');
      else showError(err.message || `Lỗi ${err.status}`);
    }
  });
}
