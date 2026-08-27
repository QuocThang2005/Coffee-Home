// Copy static assets (css/js/data/images) vào dist sau khi vite build
import { existsSync, cpSync } from 'fs';
import { join } from 'path';

const dist = 'dist';

for (const dir of ['css', 'js', 'data', 'images', 'vendor']) {
  if (existsSync(dir)) {
    cpSync(dir, join(dist, dir), { recursive: true, force: true });
    console.log(`✓ copied ${dir}/`);
  }
}
// config.json chứa googleClientId — trang đăng nhập Google đọc trực tiếp
if (existsSync('config.json')) {
  cpSync('config.json', join(dist, 'config.json'));
  console.log('✓ copied config.json');
}
console.log('postbuild done.');
