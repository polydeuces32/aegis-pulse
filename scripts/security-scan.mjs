// Security scan. Prints pass/fail and file paths only; NEVER prints the API key.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let failures = 0;
const check = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const read = (p) => readFileSync(path.join(root, p), 'utf8');

const envFile = path.join(root, '.env');
const envText = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
const key = (/^\s*(?:export\s+)?SMARTSPECTRA_API_KEY\s*=\s*(.*)$/m.exec(envText)?.[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
check(key.length > 0, 'API key present in .env (value never printed)');

// 1. The key must not exist in any file outside .env (source, build output, logs, spike bundles)
function* walk(dir) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.git') continue;
    const p = path.join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p); else if (st.size < 50e6) yield p;
  }
}
const hits = [];
for (const f of walk(root)) {
  if (f === envFile) continue;
  if (key && readFileSync(f).includes(key)) hits.push(path.relative(root, f));
}
check(hits.length === 0, `API key absent from all files outside .env (${hits.length ? hits.join(', ') : 'none'})`);

// 2. Renderer + preload bundles
for (const dir of ['out/renderer', 'out/preload']) {
  if (!existsSync(path.join(root, dir))) { check(false, `${dir} exists (run npm run build first)`); continue; }
  let leak = false, env = false;
  for (const f of walk(path.join(root, dir))) {
    const t = readFileSync(f, 'utf8');
    if (key && t.includes(key)) leak = true;
    if (/SMARTSPECTRA_API_KEY|apiKey|process\.env/.test(t)) env = true;
  }
  check(!leak, `${dir} contains no API key value`);
  check(!env, `${dir} has no API-key identifiers or process.env access`);
}

// 3. Renderer source must not reference the key or Node/Electron
const rendererSrc = [...walk(path.join(root, 'src/renderer'))].map((f) => readFileSync(f, 'utf8')).join('\n');
check(!/SMARTSPECTRA|apiKey|require\(|from 'electron'|from "electron"|node:/.test(rendererSrc), 'renderer source has no key/electron/node imports');

// 4. Main window hardening
const main = read('src/main/index.ts');
check(/contextIsolation:\s*true/.test(main), 'contextIsolation: true');
check(/nodeIntegration:\s*false/.test(main), 'nodeIntegration: false');
check(/sandbox:\s*true/.test(main), 'sandbox: true');
check(/webviewTag:\s*false/.test(main), 'webviewTag: false');
check(/setWindowOpenHandler/.test(main) && /will-navigate/.test(main), 'navigation + popups blocked');
check(/setPermissionRequestHandler/.test(main) && /hasConsent\(\)/.test(main), 'camera permission gated on consent');
const session = read('src/main/sdkSession.ts');
check(/enableTelemetry:\s*false/.test(session), 'SDK telemetry explicitly false');
check(/useCustomInput/.test(session), 'custom input pipeline');

// 5. IPC surface
const ipc = read('src/main/ipc.ts');
const handlers = (ipc.match(/ipcMain\.handle\(/g) ?? []).length;
const trustChecks = (ipc.match(/!trusted\(e\)/g) ?? []).length;
check(handlers === 5 && trustChecks === handlers, `all ${handlers} IPC handlers verify sender origin`);
const preload = read('src/preload/index.ts');
check(!/exposeInMainWorld\(\s*['"]\w+['"]\s*,\s*ipcRenderer/.test(preload) && (preload.match(/exposeInMainWorld/g) ?? []).length === 1, 'preload exposes one narrow API, not ipcRenderer');
check(!/ipcRenderer\.send\(|ipcRenderer\.sendSync\(/.test(preload), 'preload uses invoke only');

// 6. Git hygiene
const git = (...a) => { try { return execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };
for (const p of ['.env', 'out/main/index.js', 'logs/session-1.json', 'node_modules/x', 'spike/electron-quickstart/dist/renderer.bundle.js']) {
  check(git('check-ignore', p).trim() !== '', `git ignores ${p}`);
}
const stageable = git('ls-files', '-co', '--exclude-standard').split('\n').filter(Boolean);
check(!stageable.includes('.env'), '.env is not stageable');
const leaked = stageable.filter((f) => { try { return key && readFileSync(path.join(root, f)).includes(key); } catch { return false; } });
check(leaked.length === 0, `no stageable file contains the key (${leaked.length})`);
if (git('rev-parse', '--verify', 'HEAD').trim()) {
  check(git('log', '--all', '--format=%H', `-S${key}`).trim() === '', 'git history contains no key');
} else console.log('INFO  no commits yet; history trivially clean');

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll security checks passed');
process.exit(failures ? 1 : 0);
