import { $, escapeHtml } from '../../core/utils.js';
import { adminFeedbacks, setFeedbackStatus } from '../../core/api.js';
import { FEEDBACK_STATUS, fmtTime, openModal, closeModal, toastMsg } from './_helpers.js';

function fbPill(status) {
  const [cls, label] = FEEDBACK_STATUS[status] || FEEDBACK_STATUS.new;
  return `<span class="status-pill ${cls}">${label}</span>`;
}

function starIcons(n) {
  let out = '';
  for (let i = 1; i <= 5; i++) {
    out += `<i class="fa-${i <= n ? 'solid' : 'regular'} fa-star"></i>`;
  }
  return `<span class="fb-rating" title="${n}/5 sao">${out}</span>`;
}

export async function loadFeedbacks(state) {
  state.allFeedbacks = (await adminFeedbacks()).feedbacks;
  renderFeedbacks(state);
}

function renderFeedbacks(state) {
  const countNew = state.allFeedbacks.filter(f => f.status === 'new').length;
  const avg = state.allFeedbacks.length
    ? (state.allFeedbacks.reduce((s, f) => s + f.rating, 0) / state.allFeedbacks.length).toFixed(1)
    : '—';
  $('#view-feedback').innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>${state.allFeedbacks.length} phản hồi · ${countNew} mới · điểm trung bình ${avg}/5</h3></div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Khách</th><th>Sao</th><th>Nội dung</th><th>Gửi lúc</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>${state.allFeedbacks.map(f => `
            <tr>
              <td>${f.id}</td>
              <td>
                <a href="#" class="app-link" data-fb-view="${f.id}"><strong>${escapeHtml(f.name)}</strong></a><br>
                <small class="muted">${escapeHtml(f.contact || '')}</small>
              </td>
              <td>${starIcons(f.rating)}</td>
              <td style="max-width:300px"><small>${escapeHtml(f.message.length > 80 ? f.message.slice(0, 80) + '…' : f.message)}</small></td>
              <td>${fmtTime(f.createdAt || f.created_at)}</td>
              <td>${fbPill(f.status)}</td>
              <td style="white-space:nowrap">
                <button class="btn btn-sm btn-outline" data-fb-view="${f.id}" title="Xem chi tiết"><i class="fa-solid fa-eye"></i></button>
                ${f.status !== 'read' ? `<button class="btn btn-sm btn-outline" data-fb-status="${f.id}:read" style="color:#1d7a3e" title="Đánh dấu đã đọc"><i class="fa-solid fa-envelope-open"></i></button>` : ''}
                ${f.status !== 'hidden'
                  ? `<button class="btn btn-sm btn-outline" data-fb-status="${f.id}:hidden" style="color:#c0392b" title="Ẩn phản hồi"><i class="fa-solid fa-eye-slash"></i></button>`
                  : `<button class="btn btn-sm btn-outline" data-fb-status="${f.id}:new" title="Bỏ ẩn"><i class="fa-solid fa-rotate-left"></i></button>`}
              </td>
            </tr>`).join('') || '<tr><td colspan="7" class="muted">Chưa có phản hồi nào</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

export async function changeFbStatus(state, id, status) {
  try {
    await setFeedbackStatus(id, status);
    const f = state.allFeedbacks.find(x => x.id === Number(id));
    if (f) f.status = status;
    toastMsg(`Phản hồi #${id} → ${FEEDBACK_STATUS[status]?.[1] || status}`, 'success');
    renderFeedbacks(state);
    return true;
  } catch (err) {
    toastMsg(err.message || 'Cập nhật thất bại', 'error');
    return false;
  }
}

export function viewFeedback(state, id) {
  const f = state.allFeedbacks.find(x => x.id === Number(id));
  if (!f) return;
  openModal(`
    <h3><i class="fa-solid fa-comment-dots"></i> Phản hồi #${f.id}</h3>
    <div class="ad-row" style="margin-bottom:10px">${starIcons(f.rating)}</div>
    <div class="app-detail">
      <div class="ad-row"><span>Khách</span><strong>${escapeHtml(f.name)}</strong></div>
      <div class="ad-row"><span>Liên hệ</span><strong>${f.contact ? escapeHtml(f.contact) : '—'}</strong></div>
      <div class="ad-row"><span>Gửi lúc</span><strong>${fmtTime(f.createdAt || f.created_at)}</strong></div>
      <div class="ad-row"><span>Trạng thái</span>${fbPill(f.status)}</div>
      <div class="ad-note">
        <label>Nội dung</label>
        <p>${escapeHtml(f.message)}</p>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" id="modal-cancel">Đóng</button>
      ${f.status !== 'hidden'
        ? `<button class="btn btn-outline" id="fv-hide" style="color:#c0392b"><i class="fa-solid fa-eye-slash"></i> Ẩn</button>` : ''}
      ${f.status !== 'read'
        ? `<button class="btn btn-primary" id="fv-read"><i class="fa-solid fa-envelope-open"></i> Đã đọc</button>` : ''}
    </div>`);

  $('#modal-cancel').onclick = closeModal;
  $('#fv-read') && ($('#fv-read').onclick = async () => {
    if (await changeFbStatus(state, f.id, 'read')) closeModal();
  });
  $('#fv-hide') && ($('#fv-hide').onclick = async () => {
    if (await changeFbStatus(state, f.id, 'hidden')) closeModal();
  });
}
