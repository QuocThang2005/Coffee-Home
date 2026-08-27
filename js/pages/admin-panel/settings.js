import { $, escapeHtml } from '../../core/utils.js';
import { adminGetSettings, adminUpdateSettings, adminUploadVideo, adminUploadQR } from '../../core/api.js';
import { toastMsg } from './_helpers.js';

let settingsData = {};
let settingsTab = 'banner';

function field(key, label, type = 'text', opts = {}) {
  const val = settingsData[key] ?? opts.default ?? '';
  const ph = opts.placeholder || '';
  if (type === 'toggle') {
    return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px">
      <input type="checkbox" data-key="${key}" ${val === '1' || val === 'true' ? 'checked' : ''}
        style="width:18px;height:18px;accent-color:var(--c-primary)">
      <span>${label}</span></label>`;
  }
  if (type === 'textarea') {
    return `<div class="form-group"><label>${label}</label>
      <textarea class="input" data-key="${key}" rows="${opts.rows || 3}" placeholder="${ph}" style="width:100%;box-sizing:border-box">${escapeHtml(val)}</textarea></div>`;
  }
  return `<div class="form-group"><label>${label}</label>
    <input type="${type}" class="input" data-key="${key}" value="${escapeHtml(val)}" placeholder="${ph}"></div>`;
}

export async function loadSettings() {
  const view = $('#view-settings');
  try {
    const res = await adminGetSettings();
    settingsData = res.settings || {};
  } catch { settingsData = {}; }
  renderSettings();
}

function renderSettings() {
  const view = $('#view-settings');
  const tabs = [
    { id: 'banner', icon: 'fa-image', label: 'Banner & Marquee' },
    { id: 'payment', icon: 'fa-credit-card', label: 'Thanh toán' },
    { id: 'contact', icon: 'fa-address-book', label: 'Liên hệ & MXH' },
  ];
  view.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid var(--c-border);padding-bottom:12px">
      ${tabs.map(t => `<button class="btn ${settingsTab === t.id ? 'btn-primary' : 'btn-outline'} btn-sm settings-tab" data-stab="${t.id}">
        <i class="fa-solid ${t.icon}"></i> ${t.label}
      </button>`).join('')}
    </div><div id="settings-panel"></div>`;
  view.querySelectorAll('.settings-tab').forEach(btn => {
    btn.addEventListener('click', () => { settingsTab = btn.dataset.stab; renderSettings(); });
  });
  const panel = $('#settings-panel');
  if (settingsTab === 'banner') renderBannerSettings(panel);
  else if (settingsTab === 'payment') renderPaymentSettings(panel);
  else renderContactSettings(panel);
}

function renderBannerSettings(panel) {
  const videoUrl = settingsData.banner_video_url || '';
  const videoMode = settingsData.banner_video_mode || 'all';

  panel.innerHTML = `
    <div class="panel">
      <h3><i class="fa-solid fa-bolt"></i> Thanh chạy thông báo (Marquee)</h3>
      <div class="mt-2">
        ${field('marquee_enabled', 'Bật thanh chạy', 'toggle')}
        ${field('marquee_text', 'Nội dung thông báo', 'text', { placeholder: 'Tuần này: giảm 15% Phin Sữa Đá ...' })}
        <div style="display:flex;gap:12px;margin-top:8px">
          <div class="form-group"><label>Màu nền</label><div style="display:flex;gap:8px;align-items:center">
            <input type="color" data-key="marquee_bg" value="${settingsData.marquee_bg || '#0d6efd'}" style="width:40px;height:36px;border:none;cursor:pointer">
            <input type="text" class="input" data-key="marquee_bg" value="${escapeHtml(settingsData.marquee_bg || '')}" style="width:120px"></div></div>
          <div class="form-group"><label>Màu chữ</label><div style="display:flex;gap:8px;align-items:center">
            <input type="color" data-key="marquee_color" value="${settingsData.marquee_color || '#ffffff'}" style="width:40px;height:36px;border:none;cursor:pointer">
            <input type="text" class="input" data-key="marquee_color" value="${escapeHtml(settingsData.marquee_color || '')}" style="width:120px"></div></div>
        </div>
        <div id="marquee-preview" style="margin-top:12px;padding:10px;border-radius:8px;text-align:center;font-size:.9rem;overflow:hidden;white-space:nowrap;background:${settingsData.marquee_bg || 'var(--c-primary)'};color:${settingsData.marquee_color || '#fff'}">
          ${escapeHtml(settingsData.marquee_text || '')}</div>
      </div>
    </div>

    <div class="panel mt-3">
      <h3><i class="fa-solid fa-images"></i> Hero Banner Slider</h3>
      <p class="muted" style="font-size:.82rem;margin-top:4px">Slideshow ở trang chủ. Tối đa 3 slide.</p>
      <div class="mt-2" style="display:grid;gap:20px">
        ${[1,2,3].map(i => `
          <div style="border:1px solid var(--c-border);border-radius:12px;padding:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
              <strong>Slide ${i}</strong>${field(`banner_${i}_enabled`, 'Bật', 'toggle')}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              ${field(`banner_${i}_title`, 'Tiêu đề', 'text')}
              ${field(`banner_${i}_sub`, 'Mô tả', 'text')}
              ${field(`banner_${i}_cta`, 'Nút CTA', 'text')}
              ${field(`banner_${i}_link`, 'Link', 'text', { placeholder: '/pages/...' })}
              ${field(`banner_${i}_image`, 'Ảnh nền (URL)', 'text', { placeholder: '/images/menu/banner1.jpg' })}
            </div></div>`).join('')}
      </div>
    </div>

    <div class="panel mt-3">
      <h3><i class="fa-solid fa-video"></i> Video Hero (thay thế banner)</h3>
      <p class="muted" style="font-size:.82rem;margin-top:4px">Tải lên video để thay thế một hoặc toàn bộ banner hình ảnh.</p>
      <div class="mt-2">
        <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div>
            <label style="font-weight:600;font-size:.88rem;display:block;margin-bottom:6px">Thay thế slide nào?</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${[
                { val: 'all', label: 'Tất cả 3 slide' },
                { val: '1', label: 'Slide 1' },
                { val: '2', label: 'Slide 2' },
                { val: '3', label: 'Slide 3' },
                { val: '1,2', label: 'Slide 1 + 2' },
                { val: '2,3', label: 'Slide 2 + 3' },
              ].map(o => `<label style="display:flex;align-items:center;gap:4px;font-size:.85rem;cursor:pointer">
                <input type="radio" name="video-mode" value="${o.val}" ${videoMode === o.val ? 'checked' : ''} style="accent-color:var(--c-primary)">
                ${o.label}</label>`).join('')}
            </div>
          </div>
          <div>
            <label style="font-weight:600;font-size:.88rem;display:block;margin-bottom:6px">Video</label>
            <input type="file" id="video-upload-input" accept="video/mp4,video/webm,video/ogg" style="display:none">
            <button class="btn btn-outline btn-sm" id="btn-pick-video"><i class="fa-solid fa-upload"></i> Chọn video (MP4/WebM, tối đa 50MB)</button>
          </div>
        </div>
        ${videoUrl ? `
          <div style="margin-top:14px;border-radius:10px;overflow:hidden;border:1px solid var(--c-border);position:relative;max-width:560px">
            <video src="${videoUrl}" controls muted style="width:100%;max-height:240px;object-fit:cover;display:block"></video>
            <button class="btn btn-sm btn-outline" id="btn-remove-video" style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.55);color:#fff;border-color:rgba(255,255,255,.3)">
              <i class="fa-solid fa-trash"></i> Xóa video</button>
          </div>
        ` : `<p class="muted mt-2" style="font-size:.82rem" id="video-status">Chưa có video.</p>`}
      </div>
    </div>`;

  /* ---- events ---- */
  const sync = (key, fn) => panel.querySelectorAll(`[data-key="${key}"]`).forEach(el => el.addEventListener('input', fn));
  sync('marquee_text', e => { settingsData.marquee_text = e.target.value; const p = $('#marquee-preview'); if (p) p.textContent = e.target.value; });
  sync('marquee_bg', e => { settingsData.marquee_bg = e.target.value; const p = $('#marquee-preview'); if (p) p.style.background = e.target.value; });
  sync('marquee_color', e => { settingsData.marquee_color = e.target.value; const p = $('#marquee-preview'); if (p) p.style.color = e.target.value; });

  // video upload
  const pickBtn = $('#btn-pick-video');
  const fileInput = $('#video-upload-input');
  if (pickBtn && fileInput) {
    pickBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files[0];
      if (!f) return;
      pickBtn.disabled = true;
      pickBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải…';
      try {
        const res = await adminUploadVideo(f);
        settingsData.banner_video_url = res.url;
        const mode = panel.querySelector('input[name="video-mode"]:checked');
        settingsData.banner_video_mode = mode ? mode.value : 'all';
        toastMsg('Tải video thành công!', 'success');
        renderBannerSettings(panel);
      } catch (err) {
        toastMsg('Lỗi tải video: ' + (err.message || 'Thử lại'), 'error');
        pickBtn.disabled = false;
        pickBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Chọn video (MP4/WebM, tối đa 50MB)';
      }
    });
  }

  // remove video
  const rmBtn = $('#btn-remove-video');
  if (rmBtn) rmBtn.addEventListener('click', () => {
    settingsData.banner_video_url = '';
    renderBannerSettings(panel);
  });

  addSaveBtn(panel);
}

function renderPaymentSettings(panel) {
  const bankQr = settingsData.payment_bank_qr || '';
  const momoQr = settingsData.payment_momo_qr || '';

  panel.innerHTML = `
    <div class="panel">
      <h3><i class="fa-solid fa-money-bill-wave"></i> Tiền mặt (COD)</h3>
      <div class="mt-2">${field('payment_cod_enabled', 'Cho phép thanh toán tiền mặt', 'toggle')}</div>
    </div>

    <div class="panel mt-3">
      <h3><i class="fa-solid fa-building-columns"></i> Chuyển khoản ngân hàng</h3>
      <div class="mt-2">
        ${field('payment_bank_enabled', 'Cho phép chuyển khoản', 'toggle')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
          ${field('payment_bank_name', 'Ngân hàng', 'text', { placeholder: 'MB Bank' })}
          ${field('payment_bank_number', 'Số tài khoản', 'text')}
          ${field('payment_bank_holder', 'Chủ tài khoản', 'text')}
          ${field('payment_bank_branch', 'Chi nhánh', 'text')}
        </div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--c-border)">
          <label style="font-weight:600;font-size:.88rem;display:block;margin-bottom:6px"><i class="fa-solid fa-image"></i> Ảnh QR chuyển khoản</label>
          <p class="muted" style="font-size:.8rem;margin-bottom:8px">Tải lên mã QR để khách hàng quét khi thanh toán chuyển khoản.</p>
          <input type="file" id="qr-bank-input" accept="image/*" style="display:none">
          <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" id="btn-pick-qr-bank"><i class="fa-solid fa-upload"></i> Chọn ảnh QR</button>
            ${bankQr ? `<div style="position:relative;border:1px solid var(--c-border);border-radius:8px;overflow:hidden">
              <img src="${bankQr}" style="max-width:180px;max-height:180px;display:block;object-fit:contain;background:#fff;padding:4px">
              <button class="btn btn-sm btn-outline" data-rm-qr="payment_bank_qr" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.55);color:#fff;border-color:rgba(255,255,255,.3);font-size:.72rem"><i class="fa-solid fa-xmark"></i></button>
            </div>` : '<span class="muted" style="font-size:.82rem" id="qr-bank-status">Chưa có ảnh QR.</span>'}
          </div>
        </div>
      </div>
    </div>

    <div class="panel mt-3">
      <h3><i class="fa-solid fa-qrcode"></i> Ví điện tử (MoMo / ZaloPay / VNPay)</h3>
      <div class="mt-2">
        ${field('payment_momo_enabled', 'Cho phép thanh toán MoMo/ZaloPay/VNPay', 'toggle')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
          ${field('payment_momo_number', 'Số tài khoản/Ví', 'text')}
          ${field('payment_momo_name', 'Tên hiển thị', 'text')}
        </div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--c-border)">
          <label style="font-weight:600;font-size:.88rem;display:block;margin-bottom:6px"><i class="fa-solid fa-image"></i> Ảnh QR ví điện tử</label>
          <p class="muted" style="font-size:.8rem;margin-bottom:8px">Tải lên mã QR để khách hàng quét khi thanh toán qua ví.</p>
          <input type="file" id="qr-momo-input" accept="image/*" style="display:none">
          <div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" id="btn-pick-qr-momo"><i class="fa-solid fa-upload"></i> Chọn ảnh QR</button>
            ${momoQr ? `<div style="position:relative;border:1px solid var(--c-border);border-radius:8px;overflow:hidden">
              <img src="${momoQr}" style="max-width:180px;max-height:180px;display:block;object-fit:contain;background:#fff;padding:4px">
              <button class="btn btn-sm btn-outline" data-rm-qr="payment_momo_qr" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.55);color:#fff;border-color:rgba(255,255,255,.3);font-size:.72rem"><i class="fa-solid fa-xmark"></i></button>
            </div>` : '<span class="muted" style="font-size:.82rem" id="qr-momo-status">Chưa có ảnh QR.</span>'}
          </div>
        </div>
      </div>
    </div>

    <div class="panel mt-3">
      <h3><i class="fa-solid fa-truck"></i> Phí vận chuyển</h3>
      <div class="mt-2" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        ${field('ship_fee', 'Phí ship (VND)', 'number')}
        ${field('ship_free_min_order', 'Miễn ship từ (VND)', 'number')}
        ${field('ship_free_radius_km', 'Bán kính giao (km)', 'number')}
      </div>
    </div>`;

  /* QR upload handlers */
  async function handleQrUpload(file, key) {
    const res = await adminUploadQR(file);
    settingsData[key] = res.url;
    renderPaymentSettings(panel);
  }
  async function bindQrPick(inputId, btnId, key) {
    const inp = $(inputId);
    const btn = $(btnId);
    if (!inp || !btn) return;
    btn.addEventListener('click', () => inp.click());
    inp.addEventListener('change', async () => {
      const f = inp.files[0];
      if (!f) return;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải…';
      try { await handleQrUpload(f, key); toastMsg('Tải QR thành công!', 'success'); }
      catch (err) { toastMsg('Lỗi: ' + (err.message || 'Thử lại'), 'error'); btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-upload"></i> Chọn ảnh QR'; }
    });
  }
  bindQrPick('#qr-bank-input', '#btn-pick-qr-bank', 'payment_bank_qr');
  bindQrPick('#qr-momo-input', '#btn-pick-qr-momo', 'payment_momo_qr');

  panel.querySelectorAll('[data-rm-qr]').forEach(btn => {
    btn.addEventListener('click', () => {
      settingsData[btn.dataset.rmQr] = '';
      renderPaymentSettings(panel);
    });
  });

  addSaveBtn(panel);
}

function renderContactSettings(panel) {
  panel.innerHTML = `
    <div class="panel">
      <h3><i class="fa-solid fa-store"></i> Thông tin cơ sở</h3>
      <div class="mt-2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${field('site_name', 'Tên quán', 'text')}
        ${field('site_tagline', 'Slogan', 'text')}
        ${field('site_hotline', 'Hotline', 'text')}
        ${field('site_email', 'Email', 'email')}</div>
    </div>
    <div class="panel mt-3">
      <h3><i class="fa-solid fa-clock"></i> Giờ mở cửa</h3>
      <div class="mt-2" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        ${field('site_hours_weekday', 'Thứ 2 - Thứ 6', 'text', { placeholder: '06:30 - 22:30' })}
        ${field('site_hours_saturday', 'Thứ 7', 'text', { placeholder: '07:00 - 23:00' })}
        ${field('site_hours_sunday', 'Chủ nhật', 'text', { placeholder: '07:00 - 22:00' })}</div>
    </div>
    <div class="panel mt-3">
      <h3><i class="fa-solid fa-share-nodes"></i> Mạng xã hội</h3>
      <div class="mt-2" style="display:grid;gap:10px">
        ${field('site_facebook', 'Facebook', 'url', { placeholder: 'https://facebook.com/...' })}
        ${field('site_instagram', 'Instagram', 'url', { placeholder: 'https://instagram.com/...' })}
        ${field('site_tiktok', 'TikTok', 'url', { placeholder: 'https://tiktok.com/@...' })}
        ${field('site_youtube', 'YouTube', 'url', { placeholder: 'https://youtube.com/@...' })}
        ${field('site_google_maps', 'Google Maps', 'url', { placeholder: 'https://maps.app.goo.cl/...' })}</div>
    </div>
    <div class="panel mt-3">
      <h3><i class="fa-solid fa-copyright"></i> Footer</h3>
      <div class="mt-2">${field('site_copyright', 'Copyright text', 'text')}</div>
    </div>`;
  addSaveBtn(panel);
}

function addSaveBtn(panel) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:20px;display:flex;gap:10px;align-items:center';
  wrap.innerHTML = `<button class="btn btn-primary" id="btn-save-settings"><i class="fa-solid fa-floppy-disk"></i> Lưu cài đặt</button><span id="settings-msg" style="font-size:.82rem"></span>`;
  panel.appendChild(wrap);
  $('#btn-save-settings').addEventListener('click', async () => {
    const data = {};
    panel.querySelectorAll('[data-key]').forEach(el => {
      data[el.dataset.key] = el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value;
    });
    // include non-input settings (video URL, mode, QR images) from settingsData
    ['banner_video_url', 'banner_video_mode', 'payment_bank_qr', 'payment_momo_qr'].forEach(k => {
      if (settingsData[k] !== undefined) data[k] = settingsData[k];
    });
    const radio = panel.querySelector('input[name="video-mode"]:checked');
    if (radio) data.banner_video_mode = radio.value;
    const btn = $('#btn-save-settings');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu…';
    try {
      await adminUpdateSettings(data);
      Object.assign(settingsData, data);
      toastMsg('Đã lưu cài đặt!', 'success');
      $('#settings-msg').innerHTML = '<span style="color:var(--c-success)"><i class="fa-solid fa-check"></i> Đã lưu</span>';
    } catch (err) {
      toastMsg('Lỗi: ' + (err.message || 'Không lưu được'), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu cài đặt';
    }
  });
}

