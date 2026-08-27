import { $, formatVND, escapeHtml, toast } from '../core/utils.js';
import { getOrder, getBranches } from '../core/api.js';

const STATUS_LABELS = {
  new: { text: 'Mới đặt', icon: 'fa-solid fa-bell', color: 'var(--c-info)' },
  preparing: { text: 'Đang chuẩn bị', icon: 'fa-solid fa-mug-hot', color: 'var(--c-accent)' },
  ready: { text: 'Sẵn sàng', icon: 'fa-solid fa-check-circle', color: '#10b981' },
  shipping: { text: 'Đang giao', icon: 'fa-solid fa-truck', color: 'var(--c-primary)' },
  done: { text: 'Hoàn thành', icon: 'fa-solid fa-flag-checkered', color: 'var(--c-success)' },
  cancel: { text: 'Đã hủy', icon: 'fa-solid fa-xmark-circle', color: 'var(--c-danger)' },
};
const STATUS_ORDER = ['new', 'preparing', 'ready', 'shipping', 'done'];

let map = null;
let branchLayer = null;
let orderMarker = null;
let geojsonLayer = null;

function vietnamBounds() {
  return L.latLngBounds([8.0, 100.0], [24.0, 120.0]);
}

function initMap() {
  if (map) return;
  map = L.map('tracking-map', {
    center: [10.79, 106.70],
    zoom: 12,
    maxZoom: 18,
    minZoom: 5,
    zoomControl: true,
  });

  // Google Satellite basemap
  const googleSat = L.tileLayer(
    'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&key=AIzaSyBfNn0c5kW5K-q6iW9Y8u8J9X0v1S2d3e4',
    { subdomains: '0123', attribution: 'Google Satellite', maxZoom: 20 }
  );

  // Google Road basemap
  const googleRoad = L.tileLayer(
    'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=AIzaSyBfNn0c5kW5K-q6iW9Y8u8J9X0v1S2d3e4',
    { subdomains: '0123', attribution: 'Google Road', maxZoom: 20 }
  );

  // OpenStreetMap fallback (always works)
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OpenStreetMap', maxZoom: 19,
  });

  // Default: Google road, fallback to OSM
  googleRoad.addTo(map);
  osm.addTo(map);

  L.control.layers({
    'Google Road': googleRoad,
    'Google Satellite': googleSat,
    'OpenStreetMap': osm,
  }, null, { position: 'topright' }).addTo(map);

  branchLayer = L.layerGroup().addTo(map);
}

function loadGeoJSON() {
  if (geojsonLayer) return;
  try {
    fetch('/data/vietnam-islands.geojson')
      .then(r => r.json())
      .then(data => {
        geojsonLayer = L.geoJSON(data, {
          style: (f) => {
            if (f.geometry.type === 'Polygon') {
              return { color: '#e44', weight: 2, fillColor: '#fcc', fillOpacity: 0.15, dashArray: '6 3' };
            }
            return {};
          },
          pointToLayer: (f, latlng) => {
            return L.circleMarker(latlng, {
              radius: 6, color: '#e44', fillColor: '#fcc', fillOpacity: 0.7, weight: 2,
            });
          },
          onEachFeature: (f, layer) => {
            if (f.properties?.name) {
              layer.bindTooltip(f.properties.name, { permanent: false, direction: 'top' });
            }
          },
        }).addTo(map);
      })
      .catch(() => {});
  } catch { /* offline */ }
}

function addBranchMarkers(branches) {
  branchLayer.clearLayers();
  const icon = L.divIcon({
    className: '',
    html: '<div style="background:var(--c-primary);color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.3)"><i class="fa-solid fa-store"></i></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  branches.forEach(b => {
    if (!b.lat || !b.lng) return;
    const m = L.marker([b.lat, b.lng], { icon })
      .bindPopup(`<strong>${escapeHtml(b.name)}</strong><br>${escapeHtml(b.address)}<br><small>${escapeHtml(b.phone || '')} · ${escapeHtml(b.open || '')}</small>`);
    branchLayer.addLayer(m);
  });
}

function fitAll(branchCoords, orderCoord) {
  const bounds = L.latLngBounds(branchCoords);
  if (orderCoord) bounds.extend(orderCoord);
  map.fitBounds(bounds.pad(0.15));
}

function renderOrderInfo(order) {
  const st = STATUS_LABELS[order.status] || STATUS_LABELS.new;
  const itemsHtml = (order.items || []).map(i =>
    `<div style="display:flex;justify-content:space-between;font-size:.88rem;padding:3px 0;border-bottom:1px solid var(--c-border)">
      <span>${escapeHtml(i.product_name)} <span class="muted">x${i.qty}</span></span>
      <span>${formatVND(i.unit_price * i.qty)}</span>
    </div>`
  ).join('');

  const methodLabel = order.method === 'pickup' ? 'Tại quán' : 'Giao hàng';
  const location = order.method === 'pickup'
    ? (order.branch_name || '—')
    : (order.address || '—');

  $('#order-info').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <span style="background:${st.color};color:#fff;padding:4px 12px;border-radius:20px;font-size:.82rem;font-weight:600">
        <i class="${st.icon}"></i> ${st.text}
      </span>
      <span class="muted" style="font-size:.82rem">#${escapeHtml(order.code)}</span>
    </div>
    <div style="font-size:.9rem">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="muted">Khách:</span><strong>${escapeHtml(order.customer_name || '—')}</strong></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="muted">Hình thức:</span><span>${methodLabel}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="muted">Địa điểm:</span><span style="text-align:right;max-width:200px">${escapeHtml(location)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="muted">Thanh toán:</span><span>${order.payment_method === 'cod' ? 'Tiền mặt' : order.payment_method || '—'}</span></div>
      ${itemsHtml ? `<div style="margin-top:10px;border-top:1px solid var(--c-border);padding-top:8px"><strong>Chi tiết:</strong>${itemsHtml}</div>` : ''}
      <div style="display:flex;justify-content:space-between;margin-top:8px;border-top:1px solid var(--c-border);padding-top:8px;font-weight:700">
        <span>Tổng:</span><span style="color:var(--c-primary)">${formatVND(order.total)}</span>
      </div>
    </div>`;
}

function renderTimeline(order) {
  const currentIdx = STATUS_ORDER.indexOf(order.status);
  const isCanceled = order.status === 'cancel';
  const history = order.history || [];
  const timeMap = {};
  history.forEach(h => { timeMap[h.status] = h.created_at; });

  let html = '<strong style="display:block;margin-bottom:10px">Tiến trình đơn hàng</strong>';
  STATUS_ORDER.forEach((s, i) => {
    const info = STATUS_LABELS[s];
    const reached = isCanceled ? s === 'new' : i <= currentIdx;
    const active = s === order.status;
    const time = timeMap[s] ? new Date(timeMap[s]).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';
    html += `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;opacity:${reached ? 1 : 0.4}">
      <div style="min-width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;
        background:${active ? info.color : reached ? 'var(--c-border)' : '#eee'};color:${active ? '#fff' : 'var(--c-muted)'}">
        <i class="${info.icon}"></i>
      </div>
      <div>
        <div style="font-size:.85rem;font-weight:${active ? 700 : 400}">${info.text}</div>
        ${time ? `<div style="font-size:.72rem;color:var(--c-muted)">${time}</div>` : ''}
      </div>
    </div>`;
  });

  if (isCanceled) {
    html += `<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
      <div style="min-width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;background:var(--c-danger);color:#fff">
        <i class="fa-solid fa-xmark-circle"></i>
      </div>
      <div><div style="font-size:.85rem;font-weight:700;color:var(--c-danger)">Đã hủy</div>
        ${timeMap.cancel ? `<div style="font-size:.72rem;color:var(--c-muted)">${new Date(timeMap.cancel).toLocaleString('vi-VN')}</div>` : ''}
      </div>
    </div>`;
  }

  $('#status-timeline').innerHTML = html;
}

function addOrderMarker(order) {
  if (orderMarker) { map.removeLayer(orderMarker); orderMarker = null; }

  const orderCoord = order.branch?.lat && order.branch?.lng
    ? [order.branch.lat, order.branch.lng]
    : null;

  if (!orderCoord && order.method === 'pickup') return;
  if (order.method === 'delivery' && !order.address) return;

  const st = STATUS_LABELS[order.status] || STATUS_LABELS.new;
  const icon = L.divIcon({
    className: '',
    html: `<div style="background:${st.color};color:#fff;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 3px 10px rgba(0,0,0,.35);border:3px solid #fff">
      <i class="${st.icon}"></i>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  const coord = orderCoord || [10.79, 106.70];
  orderMarker = L.marker(coord, { icon })
    .bindPopup(`<strong>${escapeHtml(order.code)}</strong><br>${st.text}`)
    .addTo(map);
}

export default async function init() {
  const btn = $('#btn-track');
  const input = $('#tracking-input');

  // Check URL param ?code=
  const params = new URLSearchParams(location.search);
  const presetCode = params.get('code');
  if (presetCode) {
    input.value = presetCode.toUpperCase();
    btn.click();
  }

  btn.addEventListener('click', async () => {
    const code = input.value.trim().toUpperCase();
    if (!code) { toast('Nhập mã đơn hàng', 'warn'); return; }

    const msg = $('#tracking-msg');
    const result = $('#tracking-result');
    const noResult = $('#no-result');
    result.style.display = 'none';
    noResult.style.display = 'none';
    msg.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tìm đơn...';

    try {
      initMap();
      const [orderRes, branches] = await Promise.all([
        getOrder(code),
        getBranches(),
      ]);

      const order = orderRes.order;
      msg.innerHTML = '';
      result.style.display = 'block';
      noResult.style.display = 'none';

      loadGeoJSON();
      addBranchMarkers(branches);

      const branchCoords = branches
        .filter(b => b.lat && b.lng)
        .map(b => [b.lat, b.lng]);
      const orderCoord = order.branch?.lat && order.branch?.lng
        ? [order.branch.lat, order.branch.lng] : null;

      addOrderMarker(order);
      fitAll(branchCoords, orderCoord);
      renderOrderInfo(order);
      renderTimeline(order);

      setTimeout(() => map.invalidateSize(), 200);
    } catch (err) {
      msg.innerHTML = `<span style="color:var(--c-danger)"><i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(err.message || 'Không tìm thấy đơn hàng')}</span>`;
      result.style.display = 'none';
      noResult.style.display = 'block';
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); btn.click(); }
  });
}
