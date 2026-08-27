// Dark mode — lưu lựa chọn vào localStorage
function syncThemeColor() {
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) {
    m = document.createElement('meta');
    m.name = 'theme-color';
    document.head.appendChild(m);
  }
  // trùng màu header (--c-card) cho thanh URL hòa với giao diện
  m.content = document.documentElement.dataset.theme === 'dark' ? '#2a1e17' : '#ffffff';
}

export function applySavedTheme() {
  const saved = localStorage.getItem('ch_theme')
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = saved;
  syncThemeColor();
}

export function toggleTheme(force) {
  const next = force || (document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  document.documentElement.dataset.theme = next;
  localStorage.setItem('ch_theme', next);
  syncThemeColor();
}
