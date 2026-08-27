// Đăng nhập Google thật — Google Identity Services (GIS).
// Client ID đọc trực tiếp từ /config.json (vite + dist đều phục vụ file này).
// Flow: bấm nút Google -> popup chọn tài khoản -> nhận ID token
//       -> POST /api/auth/google -> backend xác minh -> nhận token phiên.

import { toast } from '../core/utils.js';
import { onUserLogin } from '../core/store.js';

let gisReady = null;    // promise tải script GIS 1 lần
let clientIdCache = ''; // nhớ Client ID sau lần đầu lấy

async function getClientId() {
  if (clientIdCache) return clientIdCache;
  const res = await fetch('/config.json');
  const conf = await res.json();
  clientIdCache = (conf.googleClientId || '').trim();
  return clientIdCache;
}

function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisReady) {
    gisReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = () => { gisReady = null; reject(new Error('Không tải được Google Sign-In (kiểm tra mạng)')); };
      document.head.appendChild(s);
    });
  }
  return gisReady;
}

function nextDestination() {
  const next = new URLSearchParams(location.search).get('next');
  return next && next.startsWith('/') ? next : '/index.html';
}

export async function signInWithGoogle() {
  let CLIENT_ID = '';
  try {
    CLIENT_ID = await getClientId();
  } catch {
    toast('Không kết nối được backend — hãy chạy start-coffee.bat trước', 'error');
    return;
  }
  if (!CLIENT_ID) {
    toast('Chưa cấu hình Google Client ID — dán vào config.json rồi tải lại trang', 'warn', 4200);
    return;
  }
  try {
    await loadGis();
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: async (response) => {
        try {
          const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Lỗi ${res.status}`);
          }
          const data = await res.json();
          if (!data.user) throw new Error('Phản hồi không hợp lệ');
          localStorage.setItem('ch_token', data.token);
          localStorage.setItem('ch_user', JSON.stringify(data.user));
          onUserLogin(data.user);
          toast(`Chào mừng ${data.user.name || 'bạn'}! ☕`, 'success');
          setTimeout(() => location.href = nextDestination(), 600);
        } catch (err) {
          toast(err.message || 'Đăng nhập Google thất bại', 'error', 4000);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true
    });
    // mở hộp thoại chọn tài khoản Google (người dùng vừa bấm nút nên được phép)
    google.accounts.id.prompt((notification) => {
      // nếu trình duyệt chặn One Tap thì fallback sang nút chính thức nhúng tại chỗ
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        renderInlineButton();
      }
    });
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Dự phòng: nhúng nút Google chính thức ngay dưới nút trang có sẵn
function renderInlineButton() {
  const host =
    document.getElementById('google-inline') ||
    document.getElementById('btn-google')?.parentElement;
  if (!host || host.querySelector('.g_id_signin')) return;
  const div = document.createElement('div');
  div.className = 'g_id_signin mt-2';
  div.dataset.type = 'standard';
  div.dataset.size = 'large';
  div.dataset.width = '320';
  div.dataset.theme = 'outline';
  div.dataset.text = 'continue_with';
  div.dataset.shape = 'pill';
  div.dataset.logo_alignment = 'center';
  host.appendChild(div);
  google.accounts.id.renderButton(div, {
    type: 'standard', size: 'large', width: 320,
    theme: 'outline', text: 'continue_with', shape: 'pill'
  });
}

// Facebook: chưa nối OAuth (cần Meta Developer App) — giữ chỗ để trang login/register không lỗi
export async function signInWithFacebook() {
  toast('Đăng nhập Facebook sẽ có ở phiên bản sau 🔐', 'info');
}
