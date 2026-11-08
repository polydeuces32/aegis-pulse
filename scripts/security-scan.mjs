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
const perms = read('src/main/permissions.ts');
check(/s\.consent && cameraWindowOpen\(s\.phase\)/.test(perms) && /allowCamera\(/.test(main), 'camera permission also requires an active, explicitly started session (main process)');
const session = read('src/main/sdkSession.ts');
check(/enableTelemetry:\s*false/.test(session), 'SDK telemetry explicitly false');
check(/useCustomInput/.test(session), 'custom input pipeline');

// 5. IPC surface
const ipc = read('src/main/ipc.ts');
const handlers = (ipc.match(/ipcMain\.handle\(/g) ?? []).length;
const trustChecks = (ipc.match(/!trusted\(e\)/g) ?? []).length;
check(handlers >= 8 && trustChecks === handlers, `all ${handlers} IPC handlers verify sender origin`);
const preload = read('src/preload/index.ts');
check(!/exposeInMainWorld\(\s*['"]\w+['"]\s*,\s*ipcRenderer/.test(preload) && (preload.match(/exposeInMainWorld/g) ?? []).length === 1, 'preload exposes one narrow API, not ipcRenderer');
check(!/ipcRenderer\.send\(|ipcRenderer\.sendSync\(/.test(preload), 'preload uses invoke only');

// 5b. Credential architecture
const creds = read('src/main/credentials.ts');
const idx = read('src/main/index.ts');
check(/safeStorage/.test(idx) && /canStore\(\)/.test(creds), 'credentials use Electron safeStorage and refuse to save when encryption is unavailable');
check(/if \(!this\.d\.packaged\)/.test(creds), 'env/.env developer keys are read only in unpackaged builds');
check(/packaged:\s*app\.isPackaged/.test(idx), 'packaged flag comes from app.isPackaged');
check(!/writeFileSync\([^)]*(key|apiKey|secret)[^)]*,\s*(key|apiKey|raw)\b/i.test(creds), 'no plaintext key write in credentials.ts');
const keyReaders = ['src/main/index.ts', 'src/main/ipc.ts', 'src/main/sdkSession.ts', 'src/main/sessionLog.ts', 'src/preload/index.ts'].filter((f) => /readFileSync\([^)]*\.env/.test(read(f)));
check(keyReaders.length === 0, `.env is read only by keystore.ts (offenders: ${keyReaders.join(', ') || 'none'})`);
check(!/navigator\.clipboard|clipboard\.(read|write)/.test(rendererSrc) && /clipboard\.readText/.test(creds), 'clipboard API is used only in the main process');
check(!/reveal\(\)/.test(rendererSrc + read('src/preload/index.ts') + read('src/main/ipc.ts')), 'key reveal() is not reachable from renderer, preload or IPC layer');
check(!/credentials\.bin|userData/.test(rendererSrc), 'renderer never references the credential file');
const revealCalls = [...walk(path.join(root, 'src'))].filter((f) => /reveal\(\)/.test(readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
check(revealCalls.every((f) => ['src/main/sdkSession.ts', 'src/main/keystore.ts', 'src/main/credentials.ts'].includes(f)), `reveal() used only in main-process key plumbing (${revealCalls.join(', ')})`);
// 5c. Key-entry hygiene
const panel = read('src/renderer/components/CredentialPanel.tsx');
check(!/useState|useReducer/.test(panel), 'key entry component holds no React state (uncontrolled input)');
check(/type="password"/.test(panel) && /autoComplete="off"/.test(panel), 'in-app key field is a password input with autocomplete off');
check(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(rendererSrc), 'renderer uses no web storage');
check(/value = el\.value;\s*\n\s*el\.value = ''/.test(panel), 'typed key is cleared from the field immediately on submit');
const np = read('src/main/nativePrompt.ts');
check(/execFile\(/.test(np) && !/(^|[^.\w])(exec|execSync|spawnSync)\(|shell:\s*true/.test(np), 'native prompt uses execFile without a shell');
check(!/\$\{/.test(np.slice(np.indexOf('PROMPT_SCRIPT'), np.indexOf('const TIMEOUT_MS'))), 'native prompt script has no interpolation');
// distributable assets: build output must carry no credential material
const outFiles = existsSync(path.join(root, 'out')) ? [...walk(path.join(root, 'out'))] : [];
check(outFiles.length > 0 && !outFiles.some((f) => /(^|\/)\.env|credentials\.bin|\.pem$|\.p12$/.test(f)), 'out/ (distributable assets) contains no .env, credential file or certificates');

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
