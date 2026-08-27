// Entry riêng cho khu vực quản trị — tối giản, không nạp component trang khách
// (nhạc, chatbot, tìm kiếm, giỏ hàng, tự đăng xuất...). Ít phụ thuộc = ít lỗi.

import { applySavedTheme } from './components/darkmode.js';
import { initToast } from './components/toast.js';

try { applySavedTheme(); } catch (err) { console.warn('[admin] theme:', err); }
try { initToast(); } catch (err) { console.warn('[admin] toast:', err); }

const page = document.body.dataset.page;
if (page) {
  import(/* @vite-ignore */ `/js/pages/${page}.js?v=${Date.now()}`)
    .then(mod => mod.default?.())
    .catch(err => {
      console.error('[admin] Lỗi nạp trang:', err);
      alert('Lỗi tải trang quản trị: ' + (err?.message || 'không xác định') +
        '\nNhấn Ctrl+Shift+R để tải lại trang với mã mới nhất.');
    });
}
