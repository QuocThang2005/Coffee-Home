import { $, formatVND, escapeHtml } from '../../core/utils.js';
import { createVoucher, updateVoucher, deleteVoucher } from '../../core/api.js';
import { openModal, closeModal, toastMsg } from './_helpers.js';

const VOUCHER_TYPES = { percent: 'Giảm %', fixed: 'Giảm tiền', freeship: 'Freeship', gift: 'Mua tặng' };

export function renderPromos(state) {
  $('#view-promos').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>${state.vouchers.length} mã khuyến mãi</h3>
        <button class="btn btn-sm btn-primary" id="add-voucher"><i class="fa-solid fa-plus"></i> Thêm mã</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Mã</th><th>Tiêu đề</th><th>Kiểu</th><th>Giá trị</th><th>Điều kiện</th><th>HSD</th><th></th></tr></thead>
          <tbody>${state.vouchers.map(v => `
            <tr>
              <td><span class="voucher-code">${escapeHtml(v.code)}</span></td>
              <td>${escapeHtml(v.title)}<br><small class="muted">${escapeHtml(v.desc)}</small></td>
              <td>${VOUCHER_TYPES[v.type] || v.type}</td>
              <td>${v.type === 'percent' ? v.value + '%' : v.type === 'fixed' ? formatVND(v.value) : '—'}</td>
              <td>${v.minOrder ? formatVND(v.minOrder) : 'Không'}</td>
              <td>${escapeHtml(v.until)}</td>
              <td style="white-space:nowrap">
                <button class="btn btn-sm btn-outline" data-edit-voucher="${v.code}"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-outline" data-del-voucher="${v.code}" style="color:#c0392b"><i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

export function voucherModal(state, code = null) {
  const v = code ? state.vouchers.find(x => x.code === code) : null;
  openModal(`
    <h3>${v ? `Sửa mã: ${escapeHtml(v.code)}` : 'Thêm mã giảm giá'}</h3>
    ${v ? '' : '<div class="form-group"><label>Mã *</label><input class="input" id="mv-code" placeholder="VD: SALE20" style="text-transform:uppercase"></div>'}
    <div class="form-group"><label>Tiêu đề *</label><input class="input" id="mv-title" value="${v ? escapeHtml(v.title) : ''}"></div>
    <div class="form-group"><label>Mô tả</label><input class="input" id="mv-desc" value="${v ? escapeHtml(v.desc) : ''}"></div>
    <div class="form-group"><label>Kiểu</label>
      <select class="input" id="mv-type">
        ${Object.entries(VOUCHER_TYPES).map(([k, label]) =>
          `<option value="${k}" ${v?.type === k ? 'selected' : ''}>${label}</option>`).join('')}
      </select></div>
    <div class="form-group"><label>Giá trị (% hoặc ₫)</label><input class="input" id="mv-value" type="number" min="0" value="${v?.value ?? 0}"></div>
    <div class="form-group"><label>Đơn tối thiểu (₫)</label><input class="input" id="mv-min" type="number" min="0" value="${v?.minOrder ?? 0}"></div>
    <div class="form-group"><label>Hạn sử dụng</label><input class="input" id="mv-until" value="${v ? escapeHtml(v.until) : ''}" placeholder="31/12/2026"></div>
    <div class="modal-actions">
      <button class="btn btn-outline" id="modal-cancel">Huỷ</button>
      <button class="btn btn-primary" id="mv-save">${v ? 'Lưu thay đổi' : 'Thêm mã'}</button>
    </div>`);

  $('#mv-save').onclick = async () => {
    const payload = {
      title: $('#mv-title').value.trim(),
      desc: $('#mv-desc').value.trim(),
      type: $('#mv-type').value,
      value: Number($('#mv-value').value) || 0,
      minOrder: Number($('#mv-min').value) || 0,
      until: $('#mv-until').value.trim()
    };
    if (!payload.title) return toastMsg('Cần tiêu đề mã', 'error');
    try {
      if (v) await updateVoucher(v.code, payload);
      else await createVoucher({ ...payload, code: $('#mv-code').value.trim().toUpperCase() });
      toastMsg(v ? 'Đã lưu thay đổi' : 'Đã thêm mã giảm giá', 'success');
      closeModal();
      state._showView('promos');
    } catch (err) {
      toastMsg(err.message || 'Không lưu được mã', 'error');
    }
  };
}

export async function removeVoucher(state, code) {
  if (!confirm(`Xoá mã "${code}"?`)) return;
  try {
    await deleteVoucher(code);
    toastMsg(`Đã xoá mã ${code}`, 'success');
    state._showView('promos');
  } catch (err) {
    toastMsg(err.message || 'Không xoá được mã', 'error');
  }
}
