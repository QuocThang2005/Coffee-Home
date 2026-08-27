import { $, escapeHtml } from '../../core/utils.js';
import { adminApplications, setApplicationStatus, setApplicationReply } from '../../core/api.js';
import { APP_STATUS, fmtTime, openModal, closeModal, toastMsg } from './_helpers.js';

function appPill(status) {
  const [cls, label] = APP_STATUS[status] || APP_STATUS.new;
  return `<span class="status-pill ${cls}">${label}</span>`;
}

export async function loadCareers(state) {
  state.allApps = (await adminApplications()).applications;
  renderCareers(state);
}

function renderCareers(state) {
  const countNew = state.allApps.filter(a => a.status === 'new').length;
  $('#view-careers').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>${state.allApps.length} hồ sơ · ${countNew} chờ duyệt</h3>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Ứng viên</th><th>Vị trí</th><th>Giới thiệu</th><th>Gửi lúc</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>${state.allApps.map(a => `
            <tr>
              <td>${a.id}</td>
              <td>
                <a href="#" class="app-link" data-app-view="${a.id}"><strong>${escapeHtml(a.name)}</strong></a>
                ${a.reply ? '<i class="fa-solid fa-comment-dots fb-replied" title="Đã có phản hồi của quán"></i>' : ''}<br>
                <small class="muted">${escapeHtml(a.phone)}${a.email ? ' · ' + escapeHtml(a.email) : ''}</small>
              </td>
              <td>${escapeHtml(a.position)}</td>
              <td style="max-width:280px"><small>${escapeHtml(a.note || '—')}</small></td>
              <td>${fmtTime(a.createdAt || a.created_at)}</td>
              <td>${appPill(a.status)}</td>
              <td style="white-space:nowrap">
                <button class="btn btn-sm btn-outline" data-app-view="${a.id}" title="Xem chi tiết"><i class="fa-solid fa-eye"></i></button>
                ${a.status !== 'approved' ? `<button class="btn btn-sm btn-outline" data-app-status="${a.id}:approved" style="color:#1d7a3e"><i class="fa-solid fa-check"></i> Duyệt</button>` : ''}
                ${a.status !== 'rejected' ? `<button class="btn btn-sm btn-outline" data-app-status="${a.id}:rejected" style="color:#c0392b"><i class="fa-solid fa-ban"></i> Từ chối</button>` : ''}
                ${a.status !== 'new' ? `<button class="btn btn-sm btn-outline" data-app-status="${a.id}:new" title="Đưa về chờ duyệt"><i class="fa-solid fa-rotate-left"></i></button>` : ''}
              </td>
            </tr>`).join('') || '<tr><td colspan="7" class="muted">Chưa có hồ sơ ứng tuyển nào</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}

export async function changeAppStatus(state, id, status) {
  try {
    await setApplicationStatus(id, status);
    const a = state.allApps.find(x => x.id === Number(id));
    if (a) a.status = status;
    toastMsg(`Hồ sơ #${id} → ${APP_STATUS[status]?.[1] || status}`, 'success');
    renderCareers(state);
    return true;
  } catch (err) {
    toastMsg(err.message || 'Cập nhật thất bại', 'error');
    return false;
  }
}

export function viewApp(state, id) {
  const a = state.allApps.find(x => x.id === Number(id));
  if (!a) return;
  const actions = [
    '<button class="btn btn-outline" id="modal-cancel">Đóng</button>',
    `<button class="btn btn-outline" id="av-save-reply"><i class="fa-solid fa-floppy-disk"></i> Lưu phản hồi</button>`,
    a.status !== 'new'
      ? `<button class="btn btn-outline" id="av-reset"><i class="fa-solid fa-rotate-left"></i> Chờ lại</button>` : '',
    a.status !== 'rejected'
      ? `<button class="btn btn-outline" id="av-reject" style="color:#c0392b"><i class="fa-solid fa-ban"></i> Từ chối</button>` : '',
    a.status !== 'approved'
      ? `<button class="btn btn-primary" id="av-approve"><i class="fa-solid fa-check"></i> Duyệt hồ sơ</button>` : ''
  ].join('');
  openModal(`
    <h3><i class="fa-solid fa-user-plus"></i> Hồ sơ #${a.id} — ${escapeHtml(a.position)}</h3>
    <div class="app-detail">
      <div class="ad-row"><span>Họ tên</span><strong>${escapeHtml(a.name)}</strong></div>
      <div class="ad-row"><span>Số điện thoại</span><strong>${escapeHtml(a.phone)}</strong></div>
      <div class="ad-row"><span>Email</span><strong>${a.email ? escapeHtml(a.email) : '—'}</strong></div>
      <div class="ad-row"><span>Gửi lúc</span><strong>${fmtTime(a.createdAt || a.created_at)}</strong></div>
      <div class="ad-row"><span>Trạng thái</span>${appPill(a.status)}</div>
      <div class="ad-note">
        <label>Giới thiệu bản thân</label>
        <p>${a.note ? escapeHtml(a.note) : '<em class="muted">(Không có lời giới thiệu)</em>'}</p>
      </div>
      <div class="ad-note ad-reply">
        <label><i class="fa-solid fa-reply"></i> Phản hồi của quán gửi ứng viên
          <small class="muted">(lưu nội bộ — gọi điện/nhắn tin theo nội dung này)</small></label>
        <textarea class="input" id="av-reply-text" rows="3" maxlength="1000"
          placeholder="VD: Hẹn phỏng vấn 9h thứ 4 tại chi nhánh Nguyễn Văn Trỗi...">${escapeHtml(a.reply || '')}</textarea>
      </div>
    </div>
    <div class="modal-actions">${actions}</div>`);

  $('#modal-cancel').onclick = closeModal;
  $('#av-save-reply').onclick = async () => {
    const text = $('#av-reply-text').value.trim();
    try {
      await setApplicationReply(a.id, text);
      a.reply = text;
      toastMsg(text ? 'Đã lưu phản hồi cho hồ sơ #' + a.id : 'Đã xoá phản hồi', 'success');
      renderCareers(state);
    } catch (err) {
      toastMsg(err.message || 'Lưu phản hồi thất bại', 'error');
    }
  };
  $('#av-approve') && ($('#av-approve').onclick = async () => {
    if (await changeAppStatus(state, a.id, 'approved')) closeModal();
  });
  $('#av-reject') && ($('#av-reject').onclick = async () => {
    if (await changeAppStatus(state, a.id, 'rejected')) closeModal();
  });
  $('#av-reset') && ($('#av-reset').onclick = async () => {
    if (await changeAppStatus(state, a.id, 'new')) closeModal();
  });
}
