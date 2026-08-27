import { $, formatVND, escapeHtml } from '../../core/utils.js';
import { getMenu, getAdminStats, getRevenueStats, adminOrders } from '../../core/api.js';
import { fmtTime, pill } from './_helpers.js';

export async function loadOverview(state) {
  const [s, o, rev] = await Promise.all([getAdminStats(), adminOrders(), getRevenueStats(state.chartPeriod)]);
  state.stats = s;
  state.allOrders = o.orders || [];
  if (!state.menu) { try { state.menu = await getMenu(); } catch { /* */ } }
  state.stats._revSeries = rev.series;
  state.stats._revTotal = rev.totalRevenue;
  state.stats._revOrders = rev.totalOrders;
  renderOverview(state);
}

function trendBadge(today, yesterday) {
  let html;
  if (!yesterday && today) html = `<span class="kpi-trend up"><i class="fa-solid fa-arrow-trend-up"></i> Mới</span>`;
  else if (!today) html = `<span class="kpi-trend flat">chưa có đơn hôm nay</span>`;
  else {
    const pct = Math.round((today - yesterday) / (yesterday || 1) * 100);
    const up = pct >= 0;
    html = `<span class="kpi-trend ${up ? 'up' : 'down'}">
      <i class="fa-solid fa-arrow-${up ? 'up' : 'down'}"></i> ${up ? '+' : ''}${pct}% vs HN</span>`;
  }
  return html;
}

function compactVND(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.0', '')}tr`;
  if (v >= 1_000) return `${Math.round(v / 1000)}k`;
  return `${Math.round(v)}`;
}

function renderAreaChart(series, totalRev, totalOrders, period) {
  if (!series?.length) return '<p class="muted">Chưa có dữ liệu doanh thu.</p>';

  const W = 780, H = 260, PAD_L = 52, PAD_R = 16, PAD_T = 18, PAD_B = 40;
  const innerW = W - PAD_L - PAD_R, innerH = H - PAD_T - PAD_B;
  const max = Math.max(...series.map(s => s.revenue), 1);
  const niceMax = max * 1.15;

  const step = innerW / Math.max(series.length - 1, 1);
  const pts = series.map((s, i) => ({
    x: PAD_L + step * i,
    y: PAD_T + innerH * (1 - s.revenue / niceMax),
    ...s
  }));

  const path = pts.map((p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const p0 = pts[i - 1], p1 = pts[i];
    const cx = (p0.x + p1.x) / 2;
    return `C ${cx.toFixed(1)} ${p0.y.toFixed(1)}, ${cx.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }).join(' ');
  const areaPath = `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${PAD_T + innerH} L ${pts[0].x.toFixed(1)} ${PAD_T + innerH} Z`;

  const gridLines = [0.25, .55, .85].map(f => {
    const y = PAD_T + innerH * (1 - f);
    return `<line class="ac-grid-line" x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}"/>
            <text class="ac-val" x="${PAD_L - 8}" y="${y + 3}" text-anchor="end">${compactVND(niceMax * f)}</text>`;
  }).join('');

  const dots = pts.map(p => `
    <circle class="ac-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5"
            fill="var(--c-card)" stroke="var(--c-primary)" stroke-width="2">
      <title>${p.label}: ${formatVND(p.revenue)} · ${p.orders} đơn</title>
    </circle>`).join('');

  const skipEvery = series.length > 14 ? Math.ceil(series.length / 15) : 0;
  const labels = pts.map((p, i) => {
    const today = i === pts.length - 1;
    const show = !skipEvery || i % skipEvery === 0 || today || i === 0;
    if (!show) return '';
    return `<text class="ac-day" x="${p.x.toFixed(1)}" y="${H - 10}" text-anchor="middle"
             font-size="${series.length > 14 ? '8' : '9'}"
             ${today ? 'font-weight="700" fill="var(--c-primary)"' : ''}>${today ? 'Nay' : p.label}</text>`;
  }).join('');

  const periodLabels = { week: '7 ngày', month: '30 ngày', year: 'Năm nay' };
  const btn = (p, label) => `<button class="btn btn-sm ${period === p ? 'btn-primary' : 'btn-outline'}" data-chart-period="${p}">${label}</button>`;

  return `
  <div style="margin-bottom:10px;display:flex;gap:6px;align-items:center">
    <span class="muted" style="font-size:.82rem;margin-right:4px">Thời gian:</span>
    ${btn('week', '7 ngày')}
    ${btn('month', '30 ngày')}
    ${btn('year', 'Năm nay')}
    <span style="flex:1"></span>
    <span class="muted" style="font-size:.82rem">Tổng: <strong>${formatVND(totalRev)}</strong> · ${totalOrders} đơn</span>
  </div>
  <svg class="area-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ doanh thu">
    <defs>
      <linearGradient id="ac-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--c-accent)" stop-opacity=".38"/>
        <stop offset="100%" stop-color="var(--c-accent)" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="ac-line" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="var(--c-primary)"/>
        <stop offset="100%" stop-color="var(--c-accent)"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${areaPath}" fill="url(#ac-fill)"/>
    <path d="${path}" fill="none" stroke="url(#ac-line)" stroke-width="2.5" stroke-linecap="round"/>
    ${dots}${labels}
  </svg>`;
}

function topProductsHtml(stats, menu) {
  const list = stats.topProducts || [];
  if (!list.length) return '<p class="muted">Chưa có đơn nào để thống kê.</p>';
  const maxQty = Math.max(...list.map(p => p.qty), 1);
  const products = menu?.products || [];
  return `<div class="tp-list">${list.map((p, i) => {
    const prod = products.find(x => x.name === p.name);
    const thumb = prod?.image
      ? `<img class="tp-thumb" src="${escapeHtml(prod.image)}" alt="" loading="lazy">`
      : `<span class="tp-avatar">${escapeHtml((p.name[0] || '?').toUpperCase())}</span>`;
    return `
    <div class="tp-item">
      <span class="tp-rank ${i === 0 ? 'r1' : ''}">#${i + 1}</span>
      ${thumb}
      <div class="tp-info">
        <div class="tp-name">${escapeHtml(p.name)}</div>
        <div class="bar tp-bar"><div class="tp-fill" style="width:${Math.max(6, Math.round(p.qty / maxQty * 100))}%"></div></div>
      </div>
      <span class="tp-qty">${p.qty} ly</span>
    </div>`;
  }).join('')}</div>`;
}

function orderRowMini(o) {
  const tbl = o.table_id
    ? `<span class="table-id-chip"><i class="fa-solid fa-table-tennis-paddle-ball"></i> ${escapeHtml(o.table_id)}</span> `
    : '';
  return `
  <tr>
    <td><strong>${o.code}</strong> ${tbl}<br><small class="muted">${fmtTime(o.created_at || o.time)}</small></td>
    <td>${escapeHtml(o.customer?.name || 'Khách lẻ')}</td>
    <td>${(o.items || []).map(i => `${i.qty}× ${escapeHtml(i.name)}`).join('<br>')}</td>
    <td><strong>${formatVND(o.total)}</strong></td>
    <td>${pill(o.status)}</td>
  </tr>`;
}

function renderOverview(state) {
  const t = state.stats.today;
  const series = state.stats._revSeries || state.stats.series || [];
  const weekSum = state.stats._revTotal ?? series.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = state.stats._revOrders ?? series.reduce((s, d) => s + d.orders, 0);
  const todayRev = series.at(-1)?.revenue ?? 0;
  const yestRev = series.at(-2)?.revenue ?? 0;

  $('#view-overview').innerHTML = `
    <div class="kpi-grid">
      <div class="kpi kpi--green">
        <div class="kpi-icon" style="color:#1d7a3e"><i class="fa-solid fa-sack-dollar"></i></div>
        <div><div class="kpi-num">${formatVND(t.revenue)}</div><div class="kpi-label">Doanh thu hôm nay</div>
          ${trendBadge(todayRev, yestRev)}</div>
      </div>
      <div class="kpi kpi--blue">
        <div class="kpi-icon" style="color:#2563eb"><i class="fa-solid fa-receipt"></i></div>
        <div><div class="kpi-num">${t.orders}</div><div class="kpi-label">Đơn hôm nay</div>
          ${trendBadge(series.at(-1)?.orders ?? 0, series.at(-2)?.orders ?? 0)}</div>
      </div>
      <div class="kpi kpi--amber">
        <div class="kpi-icon" style="color:#b97a1c"><i class="fa-solid fa-chair"></i></div>
        <div><div class="kpi-num">${t.upcomingBookings}</div><div class="kpi-label">Bàn đã đặt (sắp tới)</div></div>
      </div>
      <div class="kpi kpi--violet">
        <div class="kpi-icon" style="color:#7c3aed"><i class="fa-solid fa-mug-hot"></i></div>
        <div><div class="kpi-num">${t.cups}</div><div class="kpi-label">Ly nước bán hôm nay</div></div>
      </div>
    </div>

    <div class="ov-grid">
      <div class="panel">
        <div class="panel-head">
          <h3>Doanh thu</h3>
          <span class="ph-sub">Tổng: <strong>${formatVND(weekSum)}</strong> · ${totalOrders} đơn</span>
        </div>
        ${renderAreaChart(series, weekSum, totalOrders, state.chartPeriod)}
      </div>

      <div class="panel">
        <div class="panel-head"><h3>Món bán chạy nhất</h3><button class="btn btn-sm btn-outline" data-goto="products">Sản phẩm →</button></div>
        ${topProductsHtml(state.stats, state.menu)}
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>Đơn mới nhất</h3><button class="btn btn-sm btn-outline" data-goto="orders">Xem tất cả →</button></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Mã</th><th>Khách</th><th>Món</th><th>Tổng</th><th>Trạng thái</th></tr></thead>
          <tbody>${state.allOrders.slice(0, 5).map(orderRowMini).join('')
            || '<tr><td colspan="5" class="muted">Chưa có đơn nào</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

export { renderOverview };
