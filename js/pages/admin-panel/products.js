import { $, formatVND, escapeHtml } from '../../core/utils.js';
import { createProduct, updateProduct, deleteProduct } from '../../core/api.js';
import { openModal, closeModal, toastMsg } from './_helpers.js';

export function renderProducts(state) {
  $('#view-products').innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>${state.menu.products.length} món trong thực đơn</h3>
        <button class="btn btn-sm btn-primary" id="add-product"><i class="fa-solid fa-plus"></i> Thêm món</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Sản phẩm</th><th>Nhóm</th><th>Giá gốc</th><th>Giảm</th><th>Đã bán</th><th>Tags</th><th></th></tr></thead>
          <tbody>${state.menu.products.map(p => {
            const tags = p.tags || [];
            const tagHtml = tags.length ? tags.map(t => `<span class="status-pill st-new" style="font-size:.72rem">${t}</span>`).join(' ') : '—';
            return `<tr>
              <td style="display:flex;align-items:center;gap:11px;min-width:190px">
                <img src="${escapeHtml(p.image)}" width="44" height="44" style="border-radius:8px" alt="">
                <strong>${escapeHtml(p.name)}</strong></td>
              <td>${escapeHtml(state.menu.categories.find(c => c.id === p.category)?.name || p.category)}</td>
              <td>${formatVND(p.basePrice)}</td>
              <td>${p.discountPct ? `-${p.discountPct}%` : '—'}</td>
              <td>${(p.sold || 0).toLocaleString('vi-VN')}</td>
              <td>${tagHtml}</td>
              <td style="white-space:nowrap">
                <button class="btn btn-sm btn-outline" data-edit="${p.slug}"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-sm btn-outline" data-del-product="${p.slug}" style="color:#c0392b"><i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>`}).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

export function productModal(state, slug = null) {
  const p = slug ? state.menu.products.find(x => x.slug === slug) : null;
  const tags = p?.tags || [];
  openModal(`
    <h3>${p ? `Sửa: ${escapeHtml(p.name)}` : 'Thêm món mới'}</h3>
    <div class="form-group"><label>Tên món *</label><input class="input" id="mp-name" value="${p ? escapeHtml(p.name) : ''}"></div>
    <div class="form-group"><label>Nhóm *</label>
      <select class="input" id="mp-cat">
        ${state.menu.categories.map(c =>
          `<option value="${c.id}" ${p?.category === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
      </select></div>
    <div class="form-group"><label>Giá gốc (₫) *</label><input class="input" id="mp-price" type="number" min="0" value="${p?.basePrice ?? ''}"></div>
    <div class="form-group"><label>Giảm giá (%)</label><input class="input" id="mp-disc" type="number" min="0" max="90" value="${p?.discountPct ?? 0}"></div>
    <div class="form-group"><label>Ảnh (đường dẫn)</label><input class="input" id="mp-img" value="${p ? escapeHtml(p.image) : '/images/logo.svg'}"></div>
    <div class="form-group"><label>Mô tả</label><textarea class="input" id="mp-desc" rows="3">${p ? escapeHtml(p.desc) : ''}</textarea></div>
    <div class="form-group"><label>Hiển thị trên trang chủ</label>
      <div style="display:flex;gap:16px;margin-top:6px">
        <label style="display:flex;gap:6px;align-items:center;cursor:pointer">
          <input type="checkbox" id="mp-tag-bestseller" ${tags.includes('bestseller') ? 'checked' : ''}> Best Seller
        </label>
        <label style="display:flex;gap:6px;align-items:center;cursor:pointer">
          <input type="checkbox" id="mp-tag-new" ${tags.includes('new') ? 'checked' : ''}> Món mới
        </label>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" id="modal-cancel">Huỷ</button>
      <button class="btn btn-primary" id="mp-save">${p ? 'Lưu thay đổi' : 'Thêm món'}</button>
    </div>`);

  $('#mp-save').onclick = async () => {
    const newTags = [];
    if ($('#mp-tag-bestseller').checked) newTags.push('bestseller');
    if ($('#mp-tag-new').checked) newTags.push('new');
    const payload = {
      name: $('#mp-name').value.trim(),
      category: $('#mp-cat').value,
      basePrice: Number($('#mp-price').value),
      discountPct: Math.max(0, Math.min(90, Number($('#mp-disc').value) || 0)),
      image: $('#mp-img').value.trim(),
      desc: $('#mp-desc').value.trim(),
      tags: newTags
    };
    if (!payload.name || !(payload.basePrice > 0)) return toastMsg('Cần tên món và giá hợp lệ', 'error');
    try {
      if (p) await updateProduct(p.slug, payload);
      else await createProduct(payload);
      toastMsg(p ? `Đã lưu "${payload.name}"` : `Đã thêm "${payload.name}"`, 'success');
      closeModal();
      state._showView('products');
    } catch (err) {
      toastMsg(err.message || 'Không lưu được món', 'error');
    }
  };
}

export async function removeProduct(state, slug) {
  const p = state.menu.products.find(x => x.slug === slug);
  if (!confirm(`Xoá món "${p?.name || slug}" khỏi thực đơn?`)) return;
  try {
    await deleteProduct(slug);
    toastMsg(`Đã xoá "${p?.name || slug}"`, 'success');
    state._showView('products');
  } catch (err) {
    toastMsg(err.message || 'Không xoá được món', 'error');
  }
}
