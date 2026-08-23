// Facebook OAuth stub (chia sẻ logic với google-auth)
import { toast } from '../core/utils.js';

export async function signInWithFacebook() {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch('/api/auth/facebook/start', { signal: ctrl.signal });
    if (res.redirected) {
      location.href = res.url;
      return;
    }
  } catch { /* chưa có backend */ }
  toast('Đăng nhập Facebook sẽ hoạt động sau khi nối backend OAuth 🔐');
}
