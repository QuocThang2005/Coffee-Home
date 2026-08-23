import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Moi file .html o goc = 1 trang (MPA)
const pages = Object.fromEntries(
  readdirSync(__dirname)
    .filter((f) => f.endsWith('.html'))
    .map((f) => [f, resolve(__dirname, f)])
);

export default defineConfig({
  appType: 'mpa',
  build: {
    outDir: 'dist',
    rollupOptions: { input: pages }
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:8001',
      '/uploads': 'http://localhost:8001'
    }
  }
});
