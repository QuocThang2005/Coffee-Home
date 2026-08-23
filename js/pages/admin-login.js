// Đăng nhập quản trị — demo: admin / 123456
import { $, toast } from '../core/utils.js';
import { user } from '../core/store.js';

export default function init() {
  document.getElementById('al-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = $('#al-user').value.trim();
    const pass = $('#al-pass').value;

    if (username === 'admin' && pass === '123456') {
      user.set({ name: 'Quản trị viên', email: 'admin@coffeehome.vn', points: 0, isAdmin: true });
      toast('Đăng nhập quản trị thành công', 'success');
      setTimeout(() => location.href = '/admin.html', 500);
    } else {
      $('#al-pass').closest('.form-group')?.classList.add('invalid');
      toast('Sai tên đăng nhập hoặc mật khẩu!', 'error');
    }
  });
}
