// State trung tâm: giỏ hàng · wishlist · user · đơn hàng mock
// Lưu localStorage với prefix ch_ , phát event để các component đồng bộ

import { toast } from './utils.js';

const K = {
  cart: 'ch_cart',
  wishlist: 'ch_wishlist',
  user: 'ch_user',
  orders: 'ch_orders',
  bookings: 'ch_bookings'
};

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('store:change', { detail: { key } }));
}

/* ---------------- Giỏ hàng ---------------- */
// item: { id, slug, name, image, basePrice, unitPrice, qty, size, ice, sugar, toppings:[{id,name,price}] }

export const cart = {
  get: () => read(K.cart, []),
  save(items) { write(K.cart, items); },
  count() { return this.get().reduce((s, it) => s + it.qty, 0); },
  total() { return this.get().reduce((s, it) => s + it.unitPrice * it.qty, 0); },

  add(item, silent = false) {
    const items = this.get();
    // trùng món + đúng cấu hình thì cộng số lượng
    const sig = JSON.stringify([item.id, item.size, item.ice, item.sugar, (item.toppings || []).map(t => t.id)]);
    const found = items.find(it =>
      JSON.stringify([it.id, it.size, it.ice, it.sugar, (it.toppings || []).map(t => t.id)]) === sig
    );
    if (found) found.qty += item.qty;
    else items.push(item);
    this.save(items);
    if (!silent) toast(`Đã thêm "${item.name}" vào giỏ`, 'success');
    window.dispatchEvent(new CustomEvent('cart:change'));
  },

  updateQty(index, qty) {
    const items = this.get();
    if (!items[index]) return;
    items[index].qty = Math.max(1, Math.min(99, qty));
    this.save(items);
    window.dispatchEvent(new CustomEvent('cart:change'));
  },

  remove(index) {
    const items = this.get();
    items.splice(index, 1);
    this.save(items);
    window.dispatchEvent(new CustomEvent('cart:change'));
  },

  clear() {
    write(K.cart, []);
    window.dispatchEvent(new CustomEvent('cart:change'));
  }
};

/* ---------------- Wishlist ---------------- */

export const wishlist = {
  get: () => read(K.wishlist, []),
  has(id) { return this.get().includes(id); },
  toggle(id, name = '') {
    let list = this.get();
    if (list.includes(id)) {
      list = list.filter(x => x !== id);
      toast(`Đã bỏ "${name}" khỏi yêu thích`);
    } else {
      list.push(id);
      toast(`Đã thêm "${name}" vào yêu thích`, 'success');
    }
    write(K.wishlist, list);
    window.dispatchEvent(new CustomEvent('wishlist:change'));
  }
};

/* ---------------- User ---------------- */

export const user = {
  get: () => read(K.user, null),
  set(u) { write(K.user, u); },
  clear() { localStorage.removeItem(K.user); },
  isLoggedIn() { return !!this.get(); },
  isAdmin() { return !!this.get()?.isAdmin; },
  addPoints(n) {
    const u = this.get();
    if (!u) return;
    u.points = (u.points || 0) + n;
    this.set(u);
  }
};

/* ---------------- Đơn hàng / đặt bàn (mock tới khi có backend) ---------------- */

export const orders = {
  get: () => read(K.orders, []),
  add(order) { write(K.orders, [order, ...this.get()]); },
  updateStatus(code, status) {
    const list = this.get().map(o => o.code === code ? { ...o, status } : o);
    write(K.orders, list);
  }
};

export const bookings = {
  get: () => read(K.bookings, []),
  add(b) { write(K.bookings, [b, ...this.get()]); },
  cancel(code) {
    const list = this.get().map(b => b.code === code ? { ...b, status: 'cancel' } : b);
    write(K.bookings, list);
  }
};

/* ---------------- Voucher đã áp dụng (truyền cart -> checkout) ---------------- */

export const appliedVoucher = {
  get: () => read('ch_voucher', null),
  set(v) { write('ch_voucher', v); },
  clear() { localStorage.removeItem('ch_voucher'); }
};
