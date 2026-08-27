import { $, escapeHtml } from '../../core/utils.js';
import { fmtTime } from './_helpers.js';

const TIERS = [[2000, 'Kim cương'], [500, 'Vàng'], [0, 'Bạc']];

function tierOf(points) {
  const t = TIERS.find(([min]) => points >= min);
  return `<span class="status-pill st-ready">${t[1]}</span>`;
}

export function renderCustomers(state) {
  let newsletter = [];
  try { newsletter = JSON.parse(localStorage.getItem('ch_newsletter') || '[]'); } catch { /* bỏ qua */ }
  $('#view-customers').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>${state.allUsers.length} khách hàng thành viên</h3></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Khách</th><th>Email</th><th>Điện thoại</th><th>Điểm</th><th>Hạng</th><th>Số đơn</th><th>Ngày tham gia</th></tr></thead>
          <tbody>${state.allUsers.map(u => `
            <tr>
              <td><strong>${escapeHtml(u.name)}</strong></td>
              <td>${escapeHtml(u.email)}</td>
              <td>${escapeHtml(u.phone || '—')}</td>
              <td style="font-weight:700;color:var(--c-accent,#8a5a44)">${(u.points || 0).toLocaleString('vi-VN')}</td>
              <td>${tierOf(u.points || 0)}</td>
              <td>${u.orders_count}</td>
              <td><small class="muted">${fmtTime(u.created_at)}</small></td>
            </tr>`).join('') || '<tr><td colspan="7" class="muted">Chưa có khách hàng nào đăng ký</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>Email đăng ký nhận tin (${newsletter.length})</h3></div>
      ${newsletter.length
        ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${newsletter.map(e => `<span class="chip">${escapeHtml(e)}</span>`).join('')}</div>`
        : '<p class="muted">Chưa có ai đăng ký nhận tin.</p>'}
    </div>`;
}
