import { $, formatVND, escapeHtml } from '../../core/utils.js';
import { createProduct, updateProduct, deleteProduct } from '../../core/api.js';
import { openModal, closeModal, toastMsg } from './_helpers.js';

async function uploadProductImage(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/admin/upload-product-image', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ch_admin_token') || ''}` }, body: form });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Upload thất bại'); }
  return (await res.json()).url;
}

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
  const tagStr = tags.join(', ');
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
    <div class="form-group"><label>Ảnh sản phẩm</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input class="input" id="mp-img" value="${p ? escapeHtml(p.image) : '/images/logo.svg'}" style="flex:1" placeholder="URL hoặc upload bên dưới">
        <label class="btn btn-sm btn-outline" style="cursor:pointer;white-space:nowrap;margin:0">
          <i class="fa-solid fa-upload"></i> Chọn ảnh
          <input type="file" id="mp-img-file" accept="image/*" style="display:none">
        </label>
      </div>
      <div id="mp-img-preview" style="margin-top:8px">
        ${p?.image ? `<img src="${escapeHtml(p.image)}" style="max-width:120px;border-radius:8px" alt="">` : ''}
      </div>
    </div>
    <div class="form-group"><label>Mô tả</label><textarea class="input" id="mp-desc" rows="3">${p ? escapeHtml(p.desc) : ''}</textarea></div>
    <div class="form-group"><label>Tags (phân tách bằng dấu phẩy)</label>
      <input class="input" id="mp-tags" value="${escapeHtml(tagStr)}" placeholder="Ví dụ: bestseller, new,.sale, hot">
      <small class="muted" style="font-size:.78rem">Dùng tag <code>bestseller</code> để hiển thị Best Seller, <code>new</code> cho Món Mới trên trang chủ. Tag tùy ý khác cũng được.</small>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" id="modal-cancel">Huỷ</button>
      <button class="btn btn-primary" id="mp-save">${p ? 'Lưu thay đổi' : 'Thêm món'}</button>
    </div>`);

  // Upload image from file
  $('#mp-img-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      toastMsg('Đang upload ảnh...', 'info');
      const url = await uploadProductImage(file);
      $('#mp-img').value = url;
      $('#mp-img-preview').innerHTML = `<img src="${url}" style="max-width:120px;border-radius:8px" alt="">`;
      toastMsg('Upload ảnh thành công', 'success');
    } catch (err) {
      toastMsg(err.message || 'Upload thất bại', 'error');
    }
  });

  // Preview on URL change
  $('#mp-img')?.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    $('#mp-img-preview').innerHTML = url ? `<img src="${url}" style="max-width:120px;border-radius:8px" alt="" onerror="this.style.display='none'">` : '';
  });

  $('#mp-save').onclick = async () => {
    const tagInput = $('#mp-tags').value.trim();
    const newTags = tagInput ? tagInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
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
