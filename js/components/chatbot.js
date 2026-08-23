// Chatbot hỏi đáp nhanh (rule-based, không cần backend)
import { $, escapeHtml } from '../core/utils.js';
import { getMenu } from '../core/api.js';

const QUICK = ['Gợi ý đồ uống', 'Giờ mở cửa', 'Đặt bàn', 'Khuyến mãi', 'Chi nhánh'];

const RULES = [
  { re: /(giờ|mở cửa|đóng cửa|open)/i, a: 'Quán mở cửa **6:30 - 23:00** hằng ngày, tất cả các chi nhánh nhé! ☕' },
  { re: /(đặt bàn|booking|bàn)/i, a: 'Bạn vào trang <a href="/booking.html"><b>Đặt bàn</b></a>, chọn chi nhánh + giờ là giữ chỗ được ngay, miễn phí nha!' },
  { re: /(khuy[ếe]n m[ãa]i|voucher|giảm giá|ưu đãi|sale)/i, a: 'Hôm nay đang có 4 ưu đãi hot ở <a href="/voucher.html"><b>trang Voucher</b></a> — có mã giảm tới 25.000₫ đó!' },
  { re: /(chi nhánh|địa chỉ|ở đâu|map|bản đồ)/i, a: 'Coffee Home có 3 chi nhánh: Nguyễn Văn Trỗi (Phú Nhuận), Nguyễn Huệ (Q1) và Thảo Điền (Thủ Đức). Xem bản đồ tại <a href="/contact.html"><b>Liên hệ</b></a>.' },
  { re: /(giao hàng|ship|delivery)/i, a: 'Có giao hàng trong bán kính 5km, freeship với đơn từ 50.000₫ (mã FREESHIP) 🛵' },
  { re: /(tích điểm|điểm|thành viên)/i, a: 'Mỗi 10.000₫ đơn hàng = 1 điểm. Đủ điểm đổi nước miễn phí ở tab "Điểm & đổi quà" trong <a href="/account.html"><b>Tài khoản</b></a>.' },
  { re: /(wifi|làm việc|học bài)/i, a: 'Wifi miễn phí 100Mbps, ổ cắm mỗi bàn, khu vực yên tĩnh ở tầng 2 — học bài thoải mái nhé!' }
];

let menuCache = null;

async function botReply(text) {
  for (const r of RULES) if (r.re.test(text)) return r.a;

  // gợi ý theo từ khoá món
  if (/(gợi ý|ngon|uống gì|nên uống|menu|thực đơn|đồ uống)/i.test(text)) {
    menuCache = menuCache || await getMenu().catch(() => null);
    const ps = menuCache?.products?.filter(p => p.tags?.includes('bestseller')) || [];
    return ps.length
      ? 'Gợi ý món bán chạy nhất quán mình nè:\n' + ps.slice(0, 4).map(p => `• ${p.name} — ${p.desc}`).join('\n')
      : 'Bạn thử Phin Sữa Đá hoặc Trà Đào Cam Sả xem, hai món quốc dân của quán đó!';
  }

  if (/^(chào|hello|hi|alo|hey)/i.test(text)) return 'Chào bạn! Mình là trợ lý Coffee Home ☕ Bạn muốn biết về thực đơn, khuyến mãi hay đặt bàn?';

  return 'Mình chưa hiểu ý bạn lắm 🥺 Bạn thử hỏi: "Gợi ý đồ uống", "Giờ mở cửa", "Đặt bàn", "Khuyến mãi" nhé!';
}

export function initChatbot() {
  if ($('#chatbot-fab')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="fab-stack">
      <button class="fab" id="music-fab" style="display:none"></button>
      <div class="chatbot-panel" id="chatbot-panel" role="dialog" aria-label="Chat với quán">
        <div class="cb-head">
          <img src="/images/logo.svg" width="34" height="34" alt="">
          <div><strong>Trợ lý Coffee Home</strong><br><small style="opacity:.8">Trả lời ngay 24/7</small></div>
          <span class="cb-status"><span class="cb-dot"></span>Online</span>
        </div>
        <div class="cb-msgs" id="cb-msgs">
          <div class="cb-msg bot">Xin chào ☕ Mình có thể giúp gì cho bạn?</div>
        </div>
        <div class="cb-chips">${QUICK.map(q => `<button type="button">${q}</button>`).join('')}</div>
        <form class="cb-input" id="cb-form">
          <input type="text" placeholder="Nhập câu hỏi…" autocomplete="off">
          <button type="submit" aria-label="Gửi"><i class="fa-solid fa-paper-plane"></i></button>
        </form>
      </div>
      <button class="fab" id="chatbot-fab" aria-label="Chatbot"><i class="fa-solid fa-comments"></i></button>
    </div>`);

  const panel = $('#chatbot-panel');
  const msgs = $('#cb-msgs');

  const add = (text, who) => {
    msgs.insertAdjacentHTML('beforeend', `<div class="cb-msg ${who}">${who === 'me' ? escapeHtml(text) : text}</div>`);
    msgs.scrollTop = msgs.scrollHeight;
  };

  $('#chatbot-fab').addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) $('input', panel)?.focus();
  });

  const send = async (text) => {
    add(text, 'me');
    const typing = document.createElement('div');
    typing.className = 'cb-msg bot';
    typing.textContent = '…';
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;
    const reply = await botReply(text);
    typing.remove();
    add(reply, 'bot');
  };

  $('#cb-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('input', e.target);
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    send(v);
  });
  $('.cb-chips').addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') send(e.target.textContent);
  });

  // expose cho music component dùng chung fab-stack
  window.__fabStackReady = true;
  window.dispatchEvent(new Event('fabstack:ready'));
}
