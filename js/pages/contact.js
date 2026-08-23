// Bản đồ chi nhánh (Leaflet) — contact.html
import { toast } from '../core/utils.js';

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

export default function init() {
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
