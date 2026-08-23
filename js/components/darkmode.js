// Dark mode — lưu lựa chọn vào localStorage
export function applySavedTheme() {
  const saved = localStorage.getItem('ch_theme')
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = saved;
}

export function toggleTheme(force) {
  const next = force || (document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  document.documentElement.dataset.theme = next;
  localStorage.setItem('ch_theme', next);
}
