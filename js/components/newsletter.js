// Newsletter — lưu email local (mock), sau này nối POST /api/newsletter
import { toast } from '../core/utils.js';

const KEY = 'ch_newsletter';

export function subscribe(form) {
  const input = form.querySelector('input[type="email"]');
  const email = input?.value.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast('Email chưa đúng định dạng nhé!', 'error');
    input?.focus();
    return;
  }

  const list = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (list.includes(email)) {
    toast('Email này đã đăng ký rồi nha 😉');
    return;
  }
  list.push(email);
  localStorage.setItem(KEY, JSON.stringify(list));
  input.value = '';
  toast('Đăng ký nhận tin thành công! Voucher đầu tiên đang bay tới 🎉', 'success');
}
