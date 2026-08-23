// Entry duy nhất của toàn site.
// - Init mọi component dùng chung
// - Auto-import page module theo <body data-page="...">

import { applySavedTheme } from './components/darkmode.js';
import { initHeader } from './components/header.js';
import { initFooter } from './components/footer.js';
import { initToast } from './components/toast.js';
import { initSearch } from './components/search.js';
import { initCartDrawer } from './components/cart.js';
import { initChatbot } from './components/chatbot.js';
import { initMusic } from './components/music.js';
import { initSettings } from './components/settings.js';
import { initIdleLogout } from './components/idle-logout.js';
import { initAdminSync } from './components/admin-sync.js';

applySavedTheme();

const inits = [
  initHeader, initFooter, initToast, initSearch,
  initCartDrawer, initChatbot, initMusic,
  initSettings, initIdleLogout, initAdminSync
];

Promise.all(inits.map(fn => {
  try {
    return fn();
  } catch (err) {
    console.error(`[init] ${fn.name}:`, err);
    return null;
  }
})).then(async () => {
  const page = document.body.dataset.page;
  if (!page) return;
  try {
    const mod = await import(`/js/pages/${page}.js`);
    await mod.default?.();
  } catch (err) {
    console.warn(`[page] Không nạp được js/pages/${page}.js:`, err?.message);
  }
});
