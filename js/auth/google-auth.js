// Stub OAuth Google/Facebook — hoạt động thật sau khi backend cung cấp /api/auth/*
import { toast } from '../core/utils.js';

async function tryBackend(provider) {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 1200);
    const res = await fetch(`/api/auth/${provider}/start`, { signal: ctrl.signal });
    if (res.redirected) {
      location.href = res.url;
      return true;
    }
  } catch { /* chưa có backend */ }
  return false;
}

export async function signInWithGoogle() {
  if (await tryBackend('google')) return;
  toast('Đăng nhập Google sẽ hoạt động sau khi nối backend OAuth 🔐');
}

export async function signInWithFacebook() {
  if (await tryBackend('facebook')) return;
  toast('Đăng nhập Facebook sẽ hoạt động sau khi nối backend OAuth 🔐');
}
