import { defineConfig } from 'vite';
import { resolve, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, readFileSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const conf = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const backend = `http://localhost:${conf.backendPort}`;

// Quet tat ca .html trong root + pages/ + auth/ + admin/ + debug/
function findHtml(dir, base) {
  const entries = [];
  for (const f of readdirSync(dir)) {
    const full = resolve(dir, f);
    if (statSync(full).isDirectory()) {
      entries.push(...findHtml(full, base));
    } else if (f.endsWith('.html')) {
      const key = relative(base, full).replace(/\\/g, '/');
      entries.push([key, full]);
    }
  }
  return entries;
}
const pages = Object.fromEntries(findHtml(__dirname, __dirname));

export default defineConfig({
  appType: 'mpa',
  // Client ID Google OAuth — frontend đọc qua hằng __GOOGLE_CLIENT_ID__
  define: {
    __GOOGLE_CLIENT_ID__: JSON.stringify(conf.googleClientId || ''),
    __API_BASE_URL__: JSON.stringify(conf.apiBaseUrl || '')
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: { input: pages }
  },
  server: {
    port: conf.frontendPort,
    strictPort: true,
    proxy: {
      '/api': backend,
      '/uploads': backend,
      '/ws': { target: `ws://localhost:${conf.backendPort}`, ws: true }
    }
  }
});
