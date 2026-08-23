// Đồng bộ đa tab: giỏ hàng đổi ở tab khác thì cập nhật badge ngay lập tức
import { cart, wishlist } from '../core/store.js';

export function initAdminSync() {
  window.addEventListener('storage', (e) => {
    if (!e.key?.startsWith('ch_')) return;
    if (e.key === 'ch_cart') window.dispatchEvent(new CustomEvent('cart:change'));
    if (e.key === 'ch_wishlist') window.dispatchEvent(new CustomEvent('wishlist:change'));
    if (e.key === 'ch_user') location.reload();
  });
}
