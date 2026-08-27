// Chay toan bo: Docker PostgreSQL + Backend (FastAPI) + Frontend (Vite)
// Su dung: npm run start
import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const conf = JSON.parse(readFileSync(path.join(root, 'config.json'), 'utf8'));
const py = path.join(root, 'coffee_backend', '.venv', 'Scripts', 'python.exe');

// ---- 1. Khoi Docker PostgreSQL ----
const DB_CONTAINER = 'coffee-db';
const DB_PORT = '5433';
const DB_URL = process.env.DATABASE_URL || 'postgresql://coffee:coffee123@127.0.0.1:5433/coffee_home';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';

function startDocker() {
  try {
    const ps = execSync('docker inspect -f "{{.State.Running}}" ' + DB_CONTAINER, { encoding: 'utf8' }).trim();
    if (ps === 'true') {
      console.log('[db]   Container "' + DB_CONTAINER + '" dang chay.');
      return;
    }
  } catch {
    // container chua ton tai
  }

  console.log('[db]   Dang khoi dong container PostgreSQL...');
  try {
    execSync(`docker start ${DB_CONTAINER}`, { stdio: 'inherit' });
    console.log('[db]   Da khoi dong.');
  } catch {
    console.log('[db]   Container khong ton tai. Dang tao moi...');
    try {
      execSync(
        `docker run -d --name ${DB_CONTAINER} -p ${DB_PORT}:5432 -e POSTGRES_USER=coffee -e POSTGRES_PASSWORD=coffee123 -e POSTGRES_DB=coffee_home -v "${path.join(root, 'pg_hba.conf')}:/etc/postgresql/pg_hba.conf" postgres:16-alpine`,
        { stdio: 'inherit' }
      );
      console.log('[db]   Da tao container moi.');
    } catch (e) {
      console.error('[db]   Loi tao container:', e.message);
    }
  }

  // cho PostgreSQL san sang (max 10s)
  for (let i = 0; i < 20; i++) {
    try {
      execSync(`docker exec ${DB_CONTAINER} pg_isready -U coffee`, { encoding: 'utf8', timeout: 2000 });
      console.log('[db]   PostgreSQL san sang.');
      return;
    } catch { /* cho */ }
    execSync('timeout /t 1 >nul 2>&1 || ping 127.0.0.1 -n 2 >nul');
  }
  console.log('[db]   Canh bao: PostgreSQL co the chua san sang.');
}

startDocker();

// ---- 2. Khoi Backend + Frontend ----
const kids = [];
const colors = { backend: '\x1b[36m', frontend: '\x1b[35m' };

function run(name, cmd, args, cwd, extraEnv = {}) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, FORCE_COLOR: '0', ...extraEnv } });
  const tag = name === 'backend' ? '[api] ' : '[web] ';
  const pipe = (stream) => stream.on('data', (d) => {
    const text = String(d).replace(/\x1b\[[0-9;]*m/g, '');
    process.stdout.write(colors[name] + text.split(/(?<=\n)/).map((l) => l && tag + l).join('') + '\x1b[0m');
  });
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('error', (e) => console.error(tag, 'Khong chay duoc:', e.message));
  child.on('exit', (code) => console.log(`${tag} da dung (code ${code ?? ''})`));
  kids.push(child);
}

if (!existsSync(py)) {
  console.error('[api] Khong tim thay .venv — tao venv truoc theo coffee_backend/README.md');
}

const backendEnv = {
  GOOGLE_CLIENT_ID: conf.googleClientId || '',
  DATABASE_URL: DB_URL,
};
if (GEMINI_KEY) backendEnv.GEMINI_API_KEY = GEMINI_KEY;

run('backend', py, ['-m', 'uvicorn', 'app.main:app', '--port', String(conf.backendPort), '--reload'],
  path.join(root, 'coffee_backend'), backendEnv);
run('frontend', process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')], root);

console.log(`\n  Frontend : http://localhost:${conf.frontendPort}`);
console.log(`  Admin    : http://localhost:${conf.frontendPort}/admin/admin-login.html`);
console.log(`  Backend  : http://localhost:${conf.backendPort}/docs`);
console.log(`  Database : PostgreSQL (Docker, port ${DB_PORT})`);
console.log(`  Chatbot  : Gemini AI (gemini-3.6-flash)`);
if (!GEMINI_KEY) console.log('  ⚠ CHUA SET GEMINI_API_KEY — chatbot se tra loi mac dinh');
console.log('  (Dong cua so nay = tat tat ca)\n');

function killAll() {
  kids.forEach((k) => { try { k.kill(); } catch { /* bo qua */ } });
}
for (const sig of ['SIGINT', 'SIGBREAK', 'SIGTERM']) {
  process.on(sig, () => { killAll(); process.exit(0); });
}
process.on('exit', killAll);
