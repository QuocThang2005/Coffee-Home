// Copy static assets (css/js/data/images) vào dist sau khi vite build
import { existsSync, cpSync } from 'fs';
import { join } from 'path';

const dist = 'dist';

for (const dir of ['css', 'js', 'data', 'images']) {
  if (existsSync(dir)) {
    cpSync(dir, join(dist, dir), { recursive: true, force: true });
    console.log(`✓ copied ${dir}/`);
  }
}
console.log('postbuild done.');
