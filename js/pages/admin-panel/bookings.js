import { $, escapeHtml } from '../../core/utils.js';
import { setBookingStatus, setBookingReply } from '../../core/api.js';
import { repliedIcon, toastMsg, replyModal } from './_helpers.js';

export function renderBookings(state) {
  $('#view-bookings').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>${state.allBookings.length} lượt đặt bàn</h3></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Mã</th><th>Khách</th><th>Chi nhánh</th><th>Thời gian</th><th>Số khách</th><th>Ghi chú</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>${state.allBookings.map(b => `
            <tr>
              <td><strong>${b.code}</strong>${b.reply ? repliedIcon() : ''}</td>
              <td>${escapeHtml(b.name)}<br><small class="muted">${escapeHtml(b.phone || '')}</small></td>
              <td>${escapeHtml(b.branchName || b.branchId)}</td>
              <td>${escapeHtml(b.date)} · ${escapeHtml(b.time)}</td>
              <td>${b.guests}</td>
              <td>${escapeHtml(b.note || '—')}</td>
              <td>${b.status === 'cancel'
                ? '<span class="status-pill st-cancel">Đã huỷ</span>'
                : '<span class="status-pill st-ready">Đã xác nhận</span>'}</td>
              <td><button class="btn btn-sm btn-outline" data-booking-toggle="${b.code}">
                ${b.status === 'cancel' ? '<i class="fa-solid fa-check"></i> Xác nhận' : '<i class="fa-solid fa-ban"></i> Huỷ'}
              </button>
              <button class="btn btn-sm btn-outline" data-booking-reply="${b.code}" title="Phản hồi của quán"><i class="fa-solid fa-comment-dots"></i></button></td>
            </tr>`).join('') || '<tr><td colspan="8" class="muted">Chưa có lượt đặt bàn nào</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

export async function toggleBooking(state, code) {
  const b = state.allBookings.find(x => x.code === code);
  if (!b) return;
  const next = b.status === 'cancel' ? 'confirmed' : 'cancel';
  try {
    await setBookingStatus(code, next);
    b.status = next;
    toastMsg(`${code} → ${next === 'cancel' ? 'đã huỷ' : 'đã xác nhận'}`, 'success');
    renderBookings(state);
  } catch (err) {
    toastMsg(err.message || 'Cập nhật thất bại', 'error');
  }
}

export function viewBookingReply(state, code) {
  const b = state.allBookings.find(x => x.code === code);
  if (!b) return;
  const infoRows = `
    <div class="ad-row"><span>Khách</span><strong>${escapeHtml(b.name)}${b.phone ? ' · ' + escapeHtml(b.phone) : ''}</strong></div>
    <div class="ad-row"><span>Chi nhánh</span><strong>${escapeHtml(b.branchName || b.branchId)}</strong></div>
    <div class="ad-row"><span>Thời gian</span><strong>${escapeHtml(b.date)} · ${escapeHtml(b.time)} · ${b.guests} khách</strong></div>
    <div class="ad-row"><span>Trạng thái</span>${b.status === 'cancel'
      ? '<span class="status-pill st-cancel">Đã huỷ</span>'
      : '<span class="status-pill st-ready">Đã xác nhận</span>'}</div>`;
  replyModal({
    title: `<i class="fa-solid fa-chair"></i> ${b.code}`,
    infoRows,
    extraHtml: b.note ? `<div class="ad-note"><label>Ghi chú của khách</label><p>${escapeHtml(b.note)}</p></div>` : '',
    code,
    currentReply: b.reply,
    saveFn: setBookingReply,
    onSave: (text) => { b.reply = text; renderBookings(state); }
  });
}
