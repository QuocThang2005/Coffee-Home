import { $, formatVND, escapeHtml } from '../../core/utils.js';
import { setOrderStatus, setOrderReply } from '../../core/api.js';
import { STATUS, fmtTime, pill, repliedIcon, toastMsg, replyModal } from './_helpers.js';

export function renderOrders(state) {
  const list = state.orderFilter ? state.allOrders.filter(o => o.status === state.orderFilter) : state.allOrders;
  $('#view-orders').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>${list.length} đơn hàng</h3>
        <select class="input" id="order-filter" style="width:auto;padding:7px 10px">
          <option value="">Tất cả trạng thái</option>
          ${Object.entries(STATUS).map(([k, v]) =>
            `<option value="${k}" ${state.orderFilter === k ? 'selected' : ''}>${v[1]}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Mã · Thời gian</th><th>Khách</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>${list.map(o => `
            <tr>
              <td><strong>${o.code}</strong>${o.reply ? repliedIcon() : ''}<br><small class="muted">${fmtTime(o.created_at || o.time)}</small></td>
              <td>${escapeHtml(o.customer?.name || 'Khách lẻ')}<br>
                <small class="muted">${o.method === 'pickup'
                  ? 'Tại quán: ' + escapeHtml(o.branchName || '')
                  : 'Giao: ' + escapeHtml(o.address || '')}${o.customer?.phone ? ' · ' + escapeHtml(o.customer.phone) : ''}</small></td>
              <td>${(o.items || []).map(it =>
                    `${it.qty}× ${escapeHtml(it.name)} <small class="muted">(${it.size})</small>`).join('<br>')}
                ${o.note ? `<br><small class="muted"><i>Ghi chú: ${escapeHtml(o.note)}</i></small>` : ''}</td>
              <td><strong>${formatVND(o.total)}</strong></td>
              <td><select class="input" data-order-status="${o.code}" style="width:auto;padding:7px 10px">
                ${Object.entries(STATUS).map(([k, v]) =>
                  `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v[1]}</option>`).join('')}
              </select></td>
              <td><button class="btn btn-sm btn-outline" data-order-reply="${o.code}" title="Phản hồi của quán"><i class="fa-solid fa-comment-dots"></i></button></td>
            </tr>`).join('') || '<tr><td colspan="6" class="muted">Chưa có đơn nào</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

export async function changeOrderStatus(state, code, status) {
  try {
    await setOrderStatus(code, status);
    const o = state.allOrders.find(x => x.code === code);
    if (o) o.status = status;
    toastMsg(`${code} → ${STATUS[status][1]}`, 'success');
  } catch (err) {
    toastMsg(err.message || 'Đổi trạng thái thất bại', 'error');
  }
}

export function viewOrderReply(state, code) {
  const o = state.allOrders.find(x => x.code === code);
  if (!o) return;
  const infoRows = `
    <div class="ad-row"><span>Khách</span><strong>${escapeHtml(o.customer?.name || 'Khách lẻ')}${o.customer?.phone ? ' · ' + escapeHtml(o.customer.phone) : ''}</strong></div>
    <div class="ad-row"><span>Nhận tại</span><strong>${o.method === 'pickup'
      ? escapeHtml(o.branchName || 'tại quán')
      : 'Giao tới ' + escapeHtml(o.address || '')}</strong></div>
    <div class="ad-row"><span>Món</span><strong>${(o.items || []).map(i =>
      `${i.qty}× ${escapeHtml(i.name)} (${escapeHtml(i.size || 'M')})`).join(', ')}</strong></div>
    <div class="ad-row"><span>Tổng tiền</span><strong>${formatVND(o.total)}</strong></div>
    <div class="ad-row"><span>Trạng thái</span>${pill(o.status)}</div>`;
  replyModal({
    title: `<i class="fa-solid fa-receipt"></i> Đơn ${o.code}`,
    infoRows,
    extraHtml: o.note ? `<div class="ad-note"><label>Ghi chú của khách</label><p>${escapeHtml(o.note)}</p></div>` : '',
    code,
    currentReply: o.reply,
    saveFn: setOrderReply,
    onSave: (text) => { o.reply = text; renderOrders(state); }
  });
}
