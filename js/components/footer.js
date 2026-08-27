// Footer dùng chung + newsletter — load settings từ DB
import { $ } from '../core/utils.js';
import { getSettings } from '../core/api.js';

const YEAR = new Date().getFullYear();

function footerHtml(s) {
  const tagline = s.site_tagline || 'Cà phê nhà làm - đậm đà Việt Nam';
  const hotline = s.site_hotline || '1900 1234';
  const email = s.site_email || 'hello@coffeehome.vn';
  const hours = [s.site_hours_weekday, s.site_hours_saturday, s.site_hours_sunday].filter(Boolean).join(' · ') || '6:30 - 23:00';
  const copyright = s.site_copyright || 'Coffee Home. Đồ án web - làm với ❤️ tại TP.HCM.';
  const fb = s.site_facebook || '#';
  const ig = s.site_instagram || '#';
  const tt = s.site_tiktok || '#';
  const yt = s.site_youtube || '#';
  const hasSocial = fb !== '#' || ig !== '#' || tt !== '#' || yt !== '#';

  return `
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-about">
        <a class="logo" href="/index.html" style="color:#fff">
          <img src="/images/logo.svg" alt=""><span>Coffee<b style="color:#d7a86e">Home</b></span>
        </a>
        <p>${tagline}. Hạt Arabica & Robusta tuyển chọn, rang mộc mỗi sáng,
           phục vụ bằng cả tâm huyết của một gia đình yêu cà phê.</p>
        ${hasSocial ? `<div class="footer-social">
          ${fb !== '#' ? `<a href="${fb}" target="_blank" rel="noopener" aria-label="Facebook"><i class="fa-brands fa-facebook-f"></i></a>` : ''}
          ${ig !== '#' ? `<a href="${ig}" target="_blank" rel="noopener" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>` : ''}
          ${tt !== '#' ? `<a href="${tt}" target="_blank" rel="noopener" aria-label="TikTok"><i class="fa-brands fa-tiktok"></i></a>` : ''}
          ${yt !== '#' ? `<a href="${yt}" target="_blank" rel="noopener" aria-label="YouTube"><i class="fa-brands fa-youtube"></i></a>` : ''}
        </div>` : ''}
      </div>
      <div>
        <h4>Khám phá</h4>
        <ul>
          <li><a href="/pages/menu.html">Thực đơn</a></li>
          <li><a href="/pages/booking.html">Đặt bàn</a></li>
          <li><a href="/pages/voucher.html">Ưu đãi hôm nay</a></li>
          <li><a href="/pages/blog.html">Blog pha chế</a></li>
          <li><a href="/pages/about.html">Câu chuyện quán</a></li>
        </ul>
      </div>
      <div>
        <h4>Hỗ trợ</h4>
        <ul>
          <li><a href="/pages/guide.html">Hướng dẫn đặt nước</a></li>
          <li><a href="/pages/faq.html">Câu hỏi thường gặp</a></li>
          <li><a href="/pages/policy-shipping.html">Giao hàng</a></li>
          <li><a href="/pages/policy-member.html">Thành viên & tích điểm</a></li>
          <li><a href="/pages/careers.html">Tuyển dụng</a></li>
        </ul>
      </div>
      <div>
        <h4>Nhận tin khuyến mãi</h4>
        <p style="font-size:.9rem;opacity:.85">Đăng ký để không bỏ lỡ voucher độc quyền mỗi tuần.</p>
        <form class="newsletter-form" id="newsletter-form" novalidate>
          <input type="email" placeholder="Email của bạn" aria-label="Email đăng ký nhận tin" required>
          <button type="submit"><i class="fa-solid fa-paper-plane"></i></button>
        </form>
        <ul class="mt-3" style="opacity:.85;font-size:.88rem">
          <li><i class="fa-solid fa-phone" style="color:#d7a86e;margin-right:8px"></i>Hotline: ${hotline}</li>
          <li class="mt-1"><i class="fa-solid fa-envelope" style="color:#d7a86e;margin-right:8px"></i>${email}</li>
          <li class="mt-1"><i class="fa-solid fa-clock" style="color:#d7a86e;margin-right:8px"></i>Mở cửa: ${hours}</li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${YEAR} ${copyright}</span>
      <span><i class="fa-brands fa-cc-visa"></i>&nbsp; <i class="fa-brands fa-cc-mastercard"></i>&nbsp; <i class="fa-solid fa-qrcode"></i> Momo · ZaloPay · VNPay</span>
    </div>
  </div>
</footer>`;
}

export async function initFooter() {
  const root = $('#footer');
  if (!root) return;
  const s = await getSettings();
  root.innerHTML = footerHtml(s);
  root.addEventListener('submit', async (e) => {
    if (e.target.id !== 'newsletter-form') return;
    e.preventDefault();
    const m = await import('./newsletter.js');
    m.subscribe(e.target);
  });
}
