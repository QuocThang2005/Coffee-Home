// Dữ liệu blog + trang danh sách bài viết
import { $, escapeHtml } from '../core/utils.js';

export const POSTS = [
  {
    slug: 'cach-uong-ca-phe-sai-gon',
    title: '7 kiểu uống cà phê của người Sài Gòn — bạn đã thử hết chưa?',
    date: '2026-08-18',
    author: 'Thảo Nhi',
    readMin: 6,
    image: '/images/menu/blog-1.jpg',
    excerpt: 'Từ phin sữa đá quốc dân đến bạc xỉu "người mới bắt đầu" — khám phá văn hoá cà phê Sài Gòn qua từng ly.',
    content: `
<p>Nói đến Sài Gòn là nói đến cà phê. Từ quán vỉa hè ghế nhựa đến specialty coffee có điều hòa mát rượi, thành phố này uống cà phê theo cách riêng của mình.</p>
<h2>1 · Phin sữa đá — quốc hồn quốc túy</h2>
<p>Cà phê robusta rang đậm nhỏ giọt qua phin, quyện cùng sữa đặc và đá viên. Đơn giản nhưng không gì thay thế được. Mẹo nhỏ: để ph nhỏ giọt hết khoảng 5 phút, đừng khuấy vội!</p>
<h2>2 · Bạc xỉu cho ai sợ đắng</h2>
<p>"Bạc xỉu" (bạc tỷ xỉu tỷ) thực chất là nhiều sữa ít cà phê — ngọt béo, dễ uống, là cánh cửa đầu tiên đưa người ta vào thế giới cà phê.</p>
<h2>3 · Cà phê trứng Hà Nội phiên bản Sài Gòn</h2>
<p>Lòng đỏ trứng gà đánh bông với sữa đặc phủ trên espresso. Ở Sài Gòn người ta hay dùng lạnh thay vì nóng.</p>
<h2>4-7 · Còn lại thì sao?</h2>
<ul>
<li><strong>Cà phê muối:</strong> kem muối mặn ngọt phủ trên cà phê — trend chưa hạ nhiệt.</li>
<li><strong>Cold brew:</strong> ủ lạnh 18 tiếng, ít chua, hậu ngọt dài.</li>
<li><strong>Espresso tonic:</strong> vị chua nhẹ sảng khoái rất hợp trưa Sài Gòn.</li>
<li><strong>Cà phê cốt dừa:</strong> như một ly kem dừa có cồn... à nhầm, có caffeine!</li>
</ul>
<p>Ghé Coffee Home là bạn thử được cả 7 kiểu trên cùng một menu đó. Uống thử và kể chúng mình nghe gu của bạn nhé!</p>`
  },
  {
    slug: 'rang-moc-la-gi',
    title: 'Rang mộc là gì mà ai cũng khen?',
    date: '2026-08-10',
    author: 'Anh Quân (Barista trưởng)',
    readMin: 4,
    image: '/images/menu/blog-2.jpg',
    excerpt: 'Không bơ, không phụ gia — chỉ có hạt xanh và lửa. Tìm hiểu vì sao rang mộc giữ trọn hương vị gốc của cà phê.',
    content: `
<p>Rang mộc là phương pháp rang cà phê <strong>không thêm bất kỳ nguyên liệu nào</strong> vào hạt — không bơ, không đường, không hương liệu như kiểu rang "dầu" truyền thống cũ.</p>
<h2>Vì sao rang mộc ngon hơn?</h2>
<p>Khi không bị lớp gia vị che lấp, các nốt hương tự nhiên của từng vùng trồng hiện rõ: Cầu Đất có chua thanh trái cây, Buôn Ma Thuột đậm đà hạt điều rang...</p>
<h2>Rang mộc khó ở chỗ nào?</h2>
<p>Phụ thuộc hoàn toàn vào kinh nghiệm của người rang: nghe tiếng "nổ" first crack, ngửi mùi chuyển từ cỏ sang bánh mì nướng, và rút hạt đúng thời điểm. Sai 30 giây là cả mẻ mất vị.</p>
<p>Tại Coffee Home, mỗi tuần roaster của chúng tôi rang 2 mẻ nhỏ vừa đủ dùng — nên ly cà phê của bạn luôn ở độ tươi 3–7 ngày sau rang, lúc hương vị đỉnh nhất.</p>`
  },
  {
    slug: 'cong-thuc-tra-dao-cam-sa',
    title: 'Hé lộ công thức Trà Đào Cam Sả chuẩn quán',
    date: '2026-07-28',
    author: 'Thảo Nhi',
    readMin: 5,
    image: '/images/menu/blog-3.jpg',
    excerpt: 'Đào vàng juicy, cam tươi, sả đập dập — công thức đầy đủ để bạn tự làm tại nhà khi nhớ vị quán.',
    content: `
<p>Món quốc dân mùa hè này thật ra tự làm tại nhà cực dễ nếu nắm đúng tỷ lệ. Đây là công thức chúng tôi dùng ở quán (đã chia đôi số lượng cho 2 ly).</p>
<h2>Nguyên liệu</h2>
<ul>
<li>2 quả đào vàng (tươi hoặc hộp), cắt múi</li>
<li>200ml trà đen pha đặc, để nguội</li>
<li>Nước cốt 1/2 quả cam + vài lát cam mỏng</li>
<li>2 cây sả đập dập, cắt khúc</li>
<li>25ml siro đường (tăng giảm tuỳ khẩu vị)</li>
<li>Đá viên đủ đầy</li>
</ul>
<h2>Các bước</h2>
<ol>
<li>Ướp đào với siro + sả 15 phút cho thấm thơm.</li>
<li>Cho đá vào ly, đổ trà, nước cốt cam.</li>
<li>Thêm đào đã ướp cùng chút nước sốt siro đào.</li>
<li>Đậy lắc nhẹ (hoặc khuấy) — xong!</li>
</ol>
<p>Bí quyết của quán: <strong>không lắc quá mạnh</strong> để giữ miếng đào nguyên hình, và phải dùng sả tươi đập dập chứ không dùng tinh dầu sả.</p>`
  },
  {
    slug: 'mo-rong-chi-nhanh-thao-dien',
    title: 'Chính thức mở rộng: Coffee Home Thảo Điền khai trương!',
    date: '2026-07-01',
    author: 'Ban biên tập',
    readMin: 3,
    image: '/images/menu/blog-4.jpg',
    excerpt: 'Chi nhánh thứ ba với sân vườn xanh, khu làm việc yên tĩnh và ưu đãi 20% suốt tuần lễ khai trương.',
    content: `
<p>Sau 3 tháng sửa chữa, <strong>Coffee Home Thảo Điền</strong> chính thức mở cửa tại 92 Xuân Thủy — cách cầu Sài Gòn chỉ 5 phút chạy xe.</p>
<h2>Có gì mới ở đây?</h2>
<ul>
<li>Sân vườn 200m² với cây xanh và khu ngồi ngoài trời</li>
<li>Tầng 2 là "quiet zone" dành cho ai làm việc, học tập</li>
<li>Chỗ gửi ô tô rộng rãi — hiếm có ở khu Thảo Điền!</li>
<li>Mở sớm hơn: 06:30 sáng cho hội tập thể dục xong</li>
</ul>
<h2>Ưu đãi khai trương</h2>
<p>Suốt tuần đầu tiên: giảm <strong>20% toàn menu</strong>, tặng topping cho 100 khách đầu tiên mỗi ngày. Đặt bàn trước để chắc chắn có chỗ đẹp nhé!</p>`
  },
  {
    slug: 'chon-hat-theo-gu',
    title: 'Uống thế nào cho đúng gu? Chọn hạt theo tính cách',
    date: '2026-06-15',
    author: 'Anh Quân (Barista trưởng)',
    readMin: 5,
    image: '/images/menu/blog-5.jpg',
    excerpt: 'Thích ngọt? Ghét chua? Cần tỉnh táo tối đa? Bí kíp chọn đồ uống không cần hỏi ai.',
    content: `
<p>Nhiều khách hỏi "quán ơi uống gì ngon?" — câu trả lời phụ thuộc vào gu của bạn nhiều hơn là menu. Dưới đây là cheat sheet của barista:</p>
<h2>Bạn thích ngọt, không đắng →</h2>
<p>Bạc xỉu, trà sữa khoai môn, đá xay caramel. Tránh espresso và cold brew.</p>
<h2>Bạn cần tỉnh táo tối đa →</h2>
<p>Espresso double shot hoặc cold brew (caffeine cao nhưng êm dạ hơn). Phin đen đá cũng là lựa chọn kinh điển.</p>
<h2>Bạn thích vị chua trái cây →</h2>
<p>Arabica Cầu Đất rang nhẹ: cold brew tonic, pour-over. Chua ở đây là "acidity" tươi vui kiểu chanh berry, không phải chua hư.</p>
<h2>Bạn muốn "trải nghiệm" →</h2>
<p>Cà phê muối, cà phê trứng, espresso tonic — những món lai giữa quen và lạ, hợp buổi chiều buồn chán.</p>
<p>Cứ đưa barista biết mood hôm nay, chúng tôi pha cho ly "đúng người đúng lúc"! ☕</p>`
  }
];

export default async function init() {
  const grid = $('#posts-grid');
  if (!grid) return;

  grid.innerHTML = POSTS.map(p => `
    <article class="post-card">
      <img class="pc-cover" src="${p.image}" alt="" loading="lazy">
      <div class="post-body">
        <div class="post-meta">
          <span><i class="fa-regular fa-calendar"></i>${new Date(p.date).toLocaleDateString('vi-VN')}</span>
          <span><i class="fa-regular fa-clock"></i>${p.readMin} phút đọc</span>
        </div>
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.excerpt)}</p>
        <a class="read-more" href="/pages/blog-post.html?id=${p.slug}">Đọc tiếp <i class="fa-solid fa-arrow-right-long"></i></a>
      </div>
    </article>`).join('');

  $('#posts-loading').hidden = true;
}
