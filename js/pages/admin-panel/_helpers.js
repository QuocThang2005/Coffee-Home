import { $, escapeHtml } from '../../core/utils.js';

const STATUS = {
  new: ['st-new', 'Mới'], preparing: ['st-preparing', 'Đang pha'],
  ready: ['st-ready', 'Sẵn sàng'], shipping: ['st-shipping', 'Đang giao'],
  done: ['st-done', 'Hoàn tất'], cancel: ['st-cancel', 'Đã huỷ']
};

const APP_STATUS = {
  new: ['st-new', 'Mới'],
  approved: ['st-done', 'Đã duyệt'],
  rejected: ['st-cancel', 'Từ chối']
};

const FEEDBACK_STATUS = {
  new: ['st-new', 'Mới'],
  read: ['st-done', 'Đã đọc'],
  hidden: ['st-cancel', 'Đã ẩn']
};

function pill(status) {
  const [cls, label] = STATUS[status] || STATUS.new;
  return `<span class="status-pill ${cls}">${label}</span>`;
}

function fmtTime(s) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d)
    ? String(s)
    : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function isAuthError(err) { return err?.status === 401 || err?.status === 403; }
function isNetError(err) { return !err?.status; }

function netBanner() {
  return `
  <div class="panel" style="border-left:4px solid #c0392b;margin-bottom:16px">
    <strong><i class="fa-solid fa-triangle-exclamation"></i> Không kết nối được backend</strong>
    <p class="muted" style="margin:.4rem 0 .6rem;font-size:.9rem">
      Mở <code>start-coffee.bat</code> ở thư mục gốc, chờ dòng
      <code>Uvicorn running on http://127.0.0.1:8010</code>, rồi bấm nút bên dưới.
    </p>
    <button class="btn btn-sm btn-primary" data-retry><i class="fa-solid fa-rotate"></i> Thử kết nối lại</button>
  </div>`;
}

function errBox(err) {
  if (isNetError(err)) return netBanner();
  return `
  <div class="panel" style="border-left:4px solid #b97a1c;margin-bottom:16px">
    <strong>Lỗi ${err.status}</strong>
    <p class="muted" style="margin:.4rem 0 .6rem">${escapeHtml(err.message || 'Không rõ nguyên nhân')}</p>
    <button class="btn btn-sm btn-primary" data-retry><i class="fa-solid fa-rotate"></i> Thử lại</button>
  </div>`;
}

function toastMsg(text, type = 'info') {
  try { import('../../core/utils.js').then(m => m.toast(text, type)); }
  catch { alert(text); }
}

function openModal(html) {
  const backdrop = $('#modal-backdrop');
  backdrop.hidden = false;
  requestAnimationFrame(() => backdrop.classList.add('show'));
  backdrop.innerHTML = `<div class="modal">${html}</div>`;
  $('#modal-cancel')?.addEventListener('click', closeModal);
  backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };
}

function closeModal() {
  const backdrop = $('#modal-backdrop');
  backdrop.classList.remove('show');
  setTimeout(() => { backdrop.hidden = true; }, 250);
}

function repliedIcon() {
  return '<i class="fa-solid fa-comment-dots fb-replied" title="Đã có phản hồi của quán"></i>';
}

function replyModal({ title, infoRows, extraHtml, code, currentReply, saveFn, onSave }) {
  openModal(`
    <h3>${title}</h3>
    <div class="app-detail">
      ${infoRows}
      ${extraHtml || ''}
      <div class="ad-note ad-reply">
        <label><i class="fa-solid fa-reply"></i> Phản hồi của quán
          <small class="muted">(ghi chú nội bộ — gọi điện/nhắn tin theo nội dung này)</small></label>
        <textarea class="input" id="rp-text" rows="3" maxlength="1000"
          placeholder="VD: Đã gọi xác nhận khách đến trong 15 phút...">${escapeHtml(currentReply || '')}</textarea>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" id="modal-cancel">Đóng</button>
      <button class="btn btn-primary" id="rp-save"><i class="fa-solid fa-floppy-disk"></i> Lưu phản hồi</button>
    </div>`);
  $('#modal-cancel').onclick = closeModal;
  $('#rp-save').onclick = async () => {
    const text = $('#rp-text').value.trim();
    try {
      await saveFn(code, text);
      onSave?.(text);
      toastMsg(text ? 'Đã lưu phản hồi' : 'Đã xoá phản hồi', 'success');
      closeModal();
    } catch (err) {
      toastMsg(err.message || 'Lưu phản hồi thất bại', 'error');
    }
  };
}

export { STATUS, APP_STATUS, FEEDBACK_STATUS, pill, fmtTime, isAuthError, isNetError, netBanner, errBox, toastMsg, openModal, closeModal, repliedIcon, replyModal };
