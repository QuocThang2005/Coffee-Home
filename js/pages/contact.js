// Bản đồ chi nhánh (Leaflet) + form phản hồi — contact.html
import { toast } from '../core/utils.js';
import { submitFeedback } from '../core/api.js';

const BRANCHES = [
  { name: 'Coffee Home Nguyễn Văn Trỗi', lat: 10.8002, lng: 106.6845, address: '128 Nguyễn Văn Trỗi, Phú Nhuận' },
  { name: 'Coffee Home Nguyễn Huệ', lat: 10.7769, lng: 106.7048, address: '57 Nguyễn Huệ, Quận 1' },
  { name: 'Coffee Home Thảo Điền', lat: 10.8095, lng: 106.7315, address: '92 Xuân Thủy, Thảo Điền, Thủ Đức' }
];

function initMap() {
  if (typeof L === 'undefined') return false;
  const map = L.map('map').setView([10.7930, 106.6950], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  BRANCHES.forEach(b => {
    L.marker([b.lat, b.lng])
      .addTo(map)
      .bindPopup(`<strong>${b.name}</strong><br>${b.address}`);
  });

  return true;
}

const STAR_LABELS = { 1: 'Không hài lòng', 2: 'Tạm', 3: 'Ổn', 4: 'Ngon!', 5: 'Tuyệt vời! ☕' };

function initFeedback() {
  const stars = document.querySelectorAll('#fb-stars [data-star]');
  let rating = 0;

  const paint = (n) => stars.forEach((s, i) => {
    s.className = i < n ? 'fa-solid fa-star' : 'fa-regular fa-star';
  });

  stars.forEach(s => {
    s.addEventListener('mouseenter', () => paint(Number(s.dataset.star)));
    s.addEventListener('click', () => {
      rating = Number(s.dataset.star);
      document.getElementById('fb-star-label').textContent = STAR_LABELS[rating];
    });
  });
  document.getElementById('fb-stars')?.addEventListener('mouseleave', () => paint(rating));

  const form = document.getElementById('feedback-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('fb-name').value.trim(),
      contact: document.getElementById('fb-contact').value.trim(),
      rating,
      message: document.getElementById('fb-msg').value.trim()
    };
    const badName = data.name.length < 2;
    const badMsg = data.message.length < 5;
    document.getElementById('fg-fb-name').classList.toggle('invalid', badName);
    document.getElementById('fg-fb-msg').classList.toggle('invalid', badMsg);
    if (!rating) { toast('Bạn chưa chấm sao cho quán nhé', 'warn'); return; }
    if (badName || badMsg) { toast('Vui lòng kiểm tra lại các ô đánh dấu đỏ', 'warn'); return; }

    const btn = document.getElementById('fb-submit');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...';
    try {
      const res = await submitFeedback(data);
      form.hidden = true;
      const done = document.getElementById('feedback-success');
      document.getElementById('feedback-success-msg').textContent =
        res.message || 'Cảm ơn bạn đã góp ý!';
      done.hidden = false;
      done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (ex) {
      toast(ex.message || 'Gửi phản hồi thất bại — thử lại nhé', 'error', 4000);
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-comment-dots"></i> Gửi phản hồi';
    }
  });

  document.getElementById('fb-again')?.addEventListener('click', () => {
    document.getElementById('feedback-success').hidden = true;
    form.hidden = false;
    form.reset();
    rating = 0;
    paint(0);
    document.getElementById('fb-star-label').textContent = 'Chạm để chấm sao';
    document.getElementById('fb-submit').disabled = false;
    document.getElementById('fb-submit').innerHTML = '<i class="fa-solid fa-comment-dots"></i> Gửi phản hồi';
  });

  ['fb-name', 'fb-msg'].forEach(id =>
    document.getElementById(id)?.addEventListener('input', e =>
      e.target.closest('.form-group')?.classList.remove('invalid')));
}

export default function init() {
  initFeedback();

  // leaflet.js là script defer trong head — chờ tới khi có L
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (initMap() || tries > 40) {
      clearInterval(timer);
      if (tries > 40) toast('Không tải được bản đồ (mất mạng?)', 'warn');
    }
  }, 250);
}
