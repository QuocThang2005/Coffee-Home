// Footer dùng chung + newsletter
import { $ } from '../core/utils.js';

const YEAR = new Date().getFullYear();

const HTML = `
<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-about">
        <a class="logo" href="/index.html" style="color:#fff">
          <img src="/images/logo.svg" alt=""><span>Coffee<b style="color:#d7a86e">Home</b></span>
        </a>
        <p>Cà phê nhà làm - đậm đà Việt Nam. Hạt Arabica & Robusta tuyển chọn, rang mộc mỗi sáng,
           phục vụ bằng cả tâm huyết của một gia đình yêu cà phê.</p>
        <div class="footer-social">
          <a href="#" aria-label="Facebook"><i class="fa-brands fa-facebook-f"></i></a>
          <a href="#" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
          <a href="#" aria-label="TikTok"><i class="fa-brands fa-tiktok"></i></a>
          <a href="#" aria-label="YouTube"><i class="fa-brands fa-youtube"></i></a>
        </div>
      </div>

      <div>
        <h4>Khám phá</h4>
        <ul>
          <li><a href="/menu.html">Thực đơn</a></li>
          <li><a href="/booking.html">Đặt bàn</a></li>
          <li><a href="/voucher.html">Ưu đãi hôm nay</a></li>
          <li><a href="/blog.html">Blog pha chế</a></li>
          <li><a href="/about.html">Câu chuyện quán</a></li>
        </ul>
      </div>

      <div>
        <h4>Hỗ trợ</h4>
        <ul>
          <li><a href="/guide.html">Hướng dẫn đặt nước</a></li>
          <li><a href="/faq.html">Câu hỏi thường gặp</a></li>
          <li><a href="/policy-shipping.html">Giao hàng</a></li>
          <li><a href="/policy-member.html">Thành viên & tích điểm</a></li>
          <li><a href="/careers.html">Tuyển dụng</a></li>
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
          <li><i class="fa-solid fa-phone" style="color:#d7a86e;margin-right:8px"></i>Hotline: 1900 1234</li>
          <li class="mt-1"><i class="fa-solid fa-envelope" style="color:#d7a86e;margin-right:8px"></i>hello@coffeehome.vn</li>
          <li class="mt-1"><i class="fa-solid fa-clock" style="color:#d7a86e;margin-right:8px"></i>Mở cửa: 6:30 - 23:00</li>
        </ul>
      </div>
    </div>

    <div class="footer-bottom">
      <span>© ${YEAR} Coffee Home. Đồ án web - làm với ❤️ tại TP.HCM.</span>
      <span><i class="fa-brands fa-cc-visa"></i>&nbsp; <i class="fa-brands fa-cc-mastercard"></i>&nbsp; <i class="fa-solid fa-qrcode"></i> Momo · ZaloPay · VNPay</span>
    </div>
  </div>
</footer>`;

export function initFooter() {
  const root = $('#footer');
  if (!root) return;
  root.innerHTML = HTML;

  root.addEventListener('submit', async (e) => {
    if (e.target.id !== 'newsletter-form') return;
    e.preventDefault();
    const m = await import('./newsletter.js');
    m.subscribe(e.target);
  });
}
