// Settings panel: theme · giảm chuyển động · xoá dữ liệu local
import { $ } from '../core/utils.js';
import { toggleTheme } from './darkmode.js';

export function initSettings() {
  if ($('#settings-fab')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="settings-panel" id="settings-panel" role="dialog" aria-label="Cài đặt">
      <h4><span>Cài đặt</span>
        <button class="icon-btn" id="sp-close" style="width:30px;height:30px"><i class="fa-solid fa-xmark"></i></button>
      </h4>
      <div class="set-row">
        <span><i class="fa-regular fa-moon"></i> Chế độ tối</span>
        <label class="switch">
          <input type="checkbox" id="set-dark" ${document.documentElement.dataset.theme === 'dark' ? 'checked' : ''}>
          <span class="sw-track"></span>
        </label>
      </div>
      <div class="set-row">
        <span><i class="fa-solid fa-feather"></i> Giảm chuyển động</span>
        <label class="switch">
          <input type="checkbox" id="set-motion">
          <span class="sw-track"></span>
        </label>
      </div>
      <div class="set-row">
        <span><i class="fa-solid fa-broom"></i> Xoá dữ liệu cục bộ</span>
        <button class="btn btn-sm btn-outline" id="set-clear">Xoá</button>
      </div>
    </div>
    <button class="fab" id="settings-fab" aria-label="Cài đặt"
            style="position:fixed;left:18px;bottom:22px;z-index:1200;width:44px;height:44px;font-size:.95rem;background:var(--c-card);color:var(--c-text)">
      <i class="fa-solid fa-gear"></i>
    </button>`);

  const panel = $('#settings-panel');
  $('#settings-fab').addEventListener('click', () => panel.classList.toggle('open'));
  $('#sp-close').addEventListener('click', () => panel.classList.remove('open'));

  $('#set-dark').addEventListener('change', (e) => {
    toggleTheme(e.target.checked ? 'dark' : 'light');
  });

  const motionInput = $('#set-motion');
  motionInput.checked = document.body.classList.contains('reduce-motion');
  motionInput.addEventListener('change', () => {
    document.body.classList.toggle('reduce-motion', motionInput.checked);
    localStorage.setItem('ch_motion', motionInput.checked ? 'reduce' : 'full');
  });
  if (localStorage.getItem('ch_motion') === 'reduce') document.body.classList.add('reduce-motion');

  $('#set-clear').addEventListener('click', () => {
    Object.keys(localStorage).filter(k => k.startsWith('ch_')).forEach(k => localStorage.removeItem(k));
    toast('Đã xoá toàn bộ dữ liệu cục bộ', 'success');
    setTimeout(() => location.reload(), 800);
  });
}
