import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findKeyLeaks, findSecretPatterns, loadDevKey, parseDevKey, secretPatternsEre } from '../scripts/scan-lib.mjs';

const repo = path.resolve(__dirname, '..');
const dirs: string[] = [];
const tmp = (): string => {
  const d = mkdtempSync(path.join(tmpdir(), 'aegis-scan-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

// Secret-shaped strings are built at runtime so this test file itself never matches the scanner's patterns.
const FAKE_KEY = ['synthetic', 'test', 'key', '0123456789abcdef'].join('-'); // not a real credential
const awsId = (): string => 'AKIA' + 'A'.repeat(16);
const ghToken = (): string => 'ghp_' + 'a'.repeat(36);
const pemHeader = (): string => '-----BEGIN ' + 'RSA PRIVATE KEY-----';
const keyAssign = (): string => 'SMARTSPECTRA_API_KEY' + '=' + 'x'.repeat(24);

describe('dev key detection', () => {
  it('parses plain, exported, quoted and empty assignments', () => {
    expect(parseDevKey('SMARTSPECTRA_API_KEY=abc123')).toBe('abc123');
    expect(parseDevKey('export SMARTSPECTRA_API_KEY="abc 123"')).toBe('abc 123');
    expect(parseDevKey("SMARTSPECTRA_API_KEY='k'")).toBe('k');
    expect(parseDevKey('SMARTSPECTRA_API_KEY=')).toBe('');
    expect(parseDevKey('# SMARTSPECTRA_API_KEY=commented\nOTHER=1')).toBe('');
    expect(parseDevKey('')).toBe('');
  });

  it('a clean checkout (no .env) reports "no key" and that is not an error', () => {
    const d = tmp();
    const r = loadDevKey(path.join(d, '.env'));
    expect(r).toEqual({ present: false, key: '' });
    expect(findKeyLeaks(d, r.key)).toEqual([]); // nothing to search for, nothing flagged
  });

  it('an empty .env counts as no key; a populated one is present', () => {
    const d = tmp();
    writeFileSync(path.join(d, '.env'), 'SMARTSPECTRA_API_KEY=\n');
    expect(loadDevKey(path.join(d, '.env')).present).toBe(false);
    writeFileSync(path.join(d, '.env'), `SMARTSPECTRA_API_KEY=${FAKE_KEY}\n`);
    expect(loadDevKey(path.join(d, '.env'))).toEqual({ present: true, key: FAKE_KEY });
  });

  it('never throws on an unreadable path', () => {
    expect(loadDevKey(tmp())).toEqual({ present: false, key: '' }); // a directory, not a file
  });
});

describe('secret-exposure detection', () => {
  it('finds a leaked key value outside .env, reports only paths, and ignores the .env itself', () => {
    const d = tmp();
    mkdirSync(path.join(d, 'src'));
    writeFileSync(path.join(d, '.env'), `SMARTSPECTRA_API_KEY=${FAKE_KEY}\n`);
    writeFileSync(path.join(d, 'src', 'oops.ts'), `const k = '${FAKE_KEY}';\n`);
    writeFileSync(path.join(d, 'src', 'fine.ts'), 'export const x = 1;\n');
    const hits = findKeyLeaks(d, FAKE_KEY, [path.join(d, '.env')]);
    expect(hits).toEqual([path.join('src', 'oops.ts')]);
    expect(JSON.stringify(hits)).not.toContain(FAKE_KEY);
  });

  it('detects secret shapes without any local key, and never echoes the matched text', () => {
    const d = tmp();
    const files = { 'a.ts': `x = '${awsId()}'`, 'b.ts': `t = '${ghToken()}'`, 'c.pem': pemHeader(), 'd.env': keyAssign() };
    for (const [n, c] of Object.entries(files)) writeFileSync(path.join(d, n), c);
    writeFileSync(path.join(d, 'clean.ts'), 'export const ok = true;');
    const hits = findSecretPatterns(d, [...Object.keys(files), 'clean.ts']);
    expect(hits.map((h) => h.file).sort()).toEqual(['a.ts', 'b.ts', 'c.pem', 'd.env']);
    const dump = JSON.stringify(hits);
    for (const s of [awsId(), ghToken(), pemHeader(), keyAssign()]) expect(dump).not.toContain(s);
  });

  it('does not flag placeholders, documentation or colon-style test fixtures', () => {
    const d = tmp();
    const ok = {
      'env.example': 'SMARTSPECTRA_API_KEY=\n',
      'doc.md': 'Set SMARTSPECTRA_API_KEY=... in .env (never commit it).',
      'fixture.cjs': "env: { SMARTSPECTRA_API_KEY: 'ENV-DEV-KEY-0123456789' }",
      'short.sh': 'SMARTSPECTRA_API_KEY=short',
    };
    for (const [n, c] of Object.entries(ok)) writeFileSync(path.join(d, n), c);
    expect(findSecretPatterns(d, Object.keys(ok))).toEqual([]);
  });

  it('the git-history pattern (ERE) matches the same shapes and not clean commits', () => {
    const d = tmp();
    const git = (...a: string[]) => execFileSync('git', ['-C', d, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    git('init', '-q');
    writeFileSync(path.join(d, 'clean.txt'), 'hello\n');
    git('add', '-A');
    git('commit', '-qm', 'clean');
    expect(git('log', '--all', '--format=%h', '-E', `-G${secretPatternsEre()}`).trim()).toBe('');
    writeFileSync(path.join(d, 'leak.txt'), `${awsId()}\n`);
    git('add', '-A');
    git('commit', '-qm', 'leak');
    expect(git('log', '--all', '--format=%h', '-E', `-G${secretPatternsEre()}`).trim()).not.toBe('');
  });
});

// ---- end-to-end: the real scan script against a copy of the project ----
function scanSandbox(): string {
  const d = tmp();
  cpSync(path.join(repo, 'src'), path.join(d, 'src'), { recursive: true });
  cpSync(path.join(repo, 'scripts'), path.join(d, 'scripts'), { recursive: true });
  cpSync(path.join(repo, '.gitignore'), path.join(d, '.gitignore'));
  // stub build output so the scan's "build first" checks pass without a real build
  for (const [dir, file] of [['renderer', 'index.html'], ['preload', 'index.js'], ['main', 'index.js']] as const) {
    mkdirSync(path.join(d, 'out', dir), { recursive: true });
    writeFileSync(path.join(d, 'out', dir, file), '// stub\n');
  }
  const git = (...a: string[]) => execFileSync('git', ['-C', d, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { stdio: 'ignore' });
  git('init', '-q');
  git('add', '-A');
  git('commit', '-qm', 'sandbox');
  return d;
}
const runScan = (d: string) => spawnSync('node', [path.join(d, 'scripts', 'security-scan.mjs')], { cwd: d, encoding: 'utf8' });

describe('security-scan.mjs end to end', () => {
  it('passes on a clean checkout with NO .env and says the key checks were skipped', () => {
    const d = scanSandbox();
    expect(existsSync(path.join(d, '.env'))).toBe(false);
    const r = runScan(d);
    expect(r.stdout, r.stdout).not.toMatch(/^FAIL/m);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('no development key in .env');
    expect(r.stdout).toMatch(/^SKIP .*API key absent/m);
    expect(r.stdout).toContain('All security checks passed');
    expect(r.stdout).not.toContain('API key present in .env'); // the old failing check is gone
  });

  it('still enforces the structural checks without a key (hardening flags, IPC trust, camera policy)', () => {
    const d = scanSandbox();
    const r = runScan(d);
    for (const m of ['contextIsolation: true', 'sandbox: true', 'IPC handlers verify sender origin', 'camera permission gated on consent', 'SDK telemetry explicitly false']) {
      expect(r.stdout).toContain(m);
    }
    // weaken a protection in the sandbox copy: the scan must now fail
    const idx = path.join(d, 'src', 'main', 'index.ts');
    writeFileSync(idx, readFileSync(idx, 'utf8').replace('sandbox: true', 'sandbox: false'));
    const r2 = runScan(d);
    expect(r2.status).toBe(1);
    expect(r2.stdout).toMatch(/^FAIL .*sandbox: true/m);
  });

  it('fails when the developer key value is exposed in a source file, without printing the key', () => {
    const d = scanSandbox();
    writeFileSync(path.join(d, '.env'), `SMARTSPECTRA_API_KEY=${FAKE_KEY}\n`);
    writeFileSync(path.join(d, 'src', 'main', 'leak.ts'), `export const k = '${FAKE_KEY}';\n`);
    const r = runScan(d);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^FAIL .*API key absent from all files outside \.env \(.*leak\.ts/m);
    expect(r.stdout + r.stderr).not.toContain(FAKE_KEY);
    expect(r.stdout).toContain('development key found in .env');
  });

  it('with a key configured and nothing leaked, the exact-value checks run and pass', () => {
    const d = scanSandbox();
    writeFileSync(path.join(d, '.env'), `SMARTSPECTRA_API_KEY=${FAKE_KEY}\n`);
    const r = runScan(d);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^PASS .*API key absent from all files outside \.env/m);
    expect(r.stdout).toMatch(/^PASS .*git history contains no key/m);
    expect(r.stdout + r.stderr).not.toContain(FAKE_KEY);
  });

  it('fails on a secret-shaped string even when there is no .env key (clean-clone exposure)', () => {
    const d = scanSandbox();
    writeFileSync(path.join(d, 'src', 'main', 'oops.ts'), `export const t = '${ghToken()}';\n`);
    const r = runScan(d);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^FAIL .*no secret-shaped strings.*oops\.ts: GitHub token/m);
    expect(r.stdout + r.stderr).not.toContain(ghToken());
  });

  it('fails when a secret-shaped string is already in committed history', () => {
    const d = scanSandbox();
    const git = (...a: string[]) => execFileSync('git', ['-C', d, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { stdio: 'ignore' });
    writeFileSync(path.join(d, 'old.txt'), `${awsId()}\n`);
    git('add', '-A');
    git('commit', '-qm', 'oops');
    rmSync(path.join(d, 'old.txt'));
    git('add', '-A');
    git('commit', '-qm', 'remove');
    const r = runScan(d);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/^FAIL .*git history has no secret-shaped strings \(commits:/m);
  });
});
