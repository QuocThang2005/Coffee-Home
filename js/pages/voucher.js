// Trang voucher: copy mã · dùng ngay
import { $, formatVND, toast } from '../core/utils.js';
import { getVouchers } from '../core/api.js';
import { appliedVoucher } from '../core/store.js';

const UNIT = {
  percent: v => `<span class="vl-value">-${v.value}%</span><small>Giảm giá</small>`,
  fixed: v => `<span class="vl-value">${formatVND(v.value)}</span><small>Giảm giá</small>`,
  freeship: () => `<span class="vl-value">0₫</span><small>Miễn phí ship</small>`,
  gift: () => `<span class="vl-value">1+1</span><small>Tặng món</small>`
};

function cardHtml(v) {
  return `
  <div class="voucher-card">
    <div class="voucher-left">${(UNIT[v.type] || UNIT.percent)(v)}</div>
    <div class="voucher-body">
      <h3>${v.title}</h3>
      <p>${v.desc}</p>
      <div class="voucher-foot">
        <span class="voucher-code">${v.code}</span>
        <button class="btn btn-outline btn-sm" data-copy="${v.code}"><i class="fa-regular fa-copy"></i> Copy</button>
        <a class="btn btn-primary btn-sm" href="/menu.html" data-use="${v.code}">Dùng ngay</a>
      </div>
      <div class="voucher-exp mt-1"><i class="fa-regular fa-clock"></i> HSD: ${v.until}
        ${v.minOrder ? ` · Đơn tối thiểu ${formatVND(v.minOrder)}` : ''}</div>
    </div>
  </div>`;
}

export default async function init() {
  const vouchers = await getVouchers();
  $('#voucher-list').innerHTML = vouchers.map(cardHtml).join('');

  $('#voucher-list').addEventListener('click', async (e) => {
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) {
      try {
        await navigator.clipboard.writeText(copyBtn.dataset.copy);
        toast(`Đã copy mã ${copyBtn.dataset.copy}`, 'success');
      } catch {
        toast('Trình duyệt chặn clipboard — copy tay giúp quán nhé', 'warn');
      }
    }
    const useBtn = e.target.closest('[data-use]');
    if (useBtn) {
      const v = vouchers.find(x => x.code === useBtn.dataset.use);
      if (v) {
        appliedVoucher.set(v);
        toast(`Đang mang theo mã ${v.code} — chọn đồ đi! 🎫`, 'success');
      }
    }
  });
}
