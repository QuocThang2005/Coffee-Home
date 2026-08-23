// Toast toàn cục — lắng nghe event từ utils.toast()
import { $, $$, escapeHtml } from '../core/utils.js';

const ICONS = {
  info: 'fa-circle-info',
  success: 'fa-circle-check',
  error: 'fa-circle-xmark',
  warn: 'fa-triangle-exclamation'
};

function show({ msg, type = 'info', timeout = 2800 }) {
  let container = $('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = `toast t-${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<i class="fa-solid ${ICONS[type] || ICONS.info}"></i><div>${escapeHtml(msg)}</div>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 350);
  }, timeout);
}

export function initToast() {
  window.addEventListener('toast', (e) => show(e.detail));
}
