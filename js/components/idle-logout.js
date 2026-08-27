// Tự động đăng xuất sau 30 phút không hoạt động (bảo mật phiên)
import { user, session, onUserLogout } from '../core/store.js';
import { toast } from '../core/utils.js';

const IDLE_MS = 30 * 60 * 1000;
let timer = null;
let warned = false;

function reset() {
  warned = false;
  clearTimeout(timer);
  if (!user.isLoggedIn()) return;
  timer = setTimeout(() => {
    onUserLogout(); // cất giỏ của user này + xoá giỏ/voucher đang hiển thị
    session.clear();
    user.clear();
    toast('Bạn đã bị đăng xuất do không hoạt động quá lâu', 'warn', 4000);
    window.dispatchEvent(new CustomEvent('cart:change'));
  }, IDLE_MS);
}

export function initIdleLogout() {
  ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, () => {
      // throttle nhẹ: chỉ reset mỗi phút hoặc khi có warn
      if (!timer || warned) reset();
    }, { passive: true })
  );
  reset();
}
