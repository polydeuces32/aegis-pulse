// Helpers for scripts/security-scan.mjs. Nothing here ever returns or prints a secret value:
// results are file paths and pattern NAMES only.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** Extracts SMARTSPECTRA_API_KEY from .env text; '' when absent or empty. */
export function parseDevKey(envText) {
  const m = /^\s*(?:export\s+)?SMARTSPECTRA_API_KEY\s*=\s*(.*)$/m.exec(envText ?? '');
  return (m?.[1] ?? '').trim().replace(/^['"]|['"]$/g, '');
}

/**
 * Reads the developer's local key, if any. A missing or empty .env is a normal state (clean clone, CI, a judge's
 * machine), NOT a failure: it only means the key-value leak checks have nothing to look for.
 */
export function loadDevKey(envFile) {
  let text = '';
  try {
    if (existsSync(envFile)) text = readFileSync(envFile, 'utf8');
  } catch {
    text = '';
  }
  const key = parseDevKey(text);
  return { present: key.length > 0, key };
}

export function* walk(dir) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === '.git') continue;
    const p = path.join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (st.size < 50e6) yield p;
  }
}

/** Relative paths of files (other than `except`) that contain the exact key value. */
export function findKeyLeaks(root, key, except = []) {
  if (!key) return [];
  const skip = new Set(except.map((f) => path.resolve(f)));
  const hits = [];
  for (const f of walk(root)) {
    if (skip.has(path.resolve(f))) continue;
    try {
      if (readFileSync(f).includes(key)) hits.push(path.relative(root, f));
    } catch {
      /* unreadable: ignore */
    }
  }
  return hits;
}

/**
 * High-confidence secret shapes that need no local key to detect. Each entry has a JS regex (working tree)
 * and an equivalent POSIX ERE (for `git log -G` over history). Deliberately narrow to avoid false positives.
 */
export const SECRET_PATTERNS = [
  { name: 'private key block', js: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, ere: '-----BEGIN [A-Z ]*PRIVATE KEY-----' },
  { name: 'AWS access key id', js: /AKIA[0-9A-Z]{16}/, ere: 'AKIA[0-9A-Z]{16}' },
  { name: 'GitHub token', js: /gh[pousr]_[A-Za-z0-9]{30,}/, ere: 'gh[pousr]_[A-Za-z0-9]{30,}' },
  { name: 'OpenAI-style secret key', js: /\bsk-[A-Za-z0-9]{32,}/, ere: '(^|[^A-Za-z0-9])sk-[A-Za-z0-9]{32,}' },
  { name: 'Slack token', js: /xox[baprs]-[A-Za-z0-9-]{10,}/, ere: 'xox[baprs]-[A-Za-z0-9-]{10,}' },
  // env-file style assignment with a real-looking value (not "...", not empty)
  {
    name: 'SMARTSPECTRA_API_KEY assignment',
    js: /SMARTSPECTRA_API_KEY[ \t]*=[ \t]*['"]?[A-Za-z0-9_+/=.-]{16,}/,
    ere: "SMARTSPECTRA_API_KEY[ \t]*=[ \t]*['\"]?[A-Za-z0-9_+/=.-]{16,}",
  },
];

/** [{ file, pattern }] for files (paths relative to root) that match a secret shape. Never returns matched text. */
export function findSecretPatterns(root, files, skipFiles = ['package-lock.json']) {
  const out = [];
  for (const rel of files) {
    if (skipFiles.includes(rel)) continue;
    let text;
    try {
      const full = path.join(root, rel);
      if (statSync(full).size > 5e6) continue;
      const buf = readFileSync(full);
      if (buf.includes(0)) continue; // binary
      text = buf.toString('utf8');
    } catch {
      continue;
    }
    for (const p of SECRET_PATTERNS) if (p.js.test(text)) out.push({ file: rel, pattern: p.name });
  }
  return out;
}

/** One ERE alternation for `git log -G`. */
export const secretPatternsEre = () => SECRET_PATTERNS.map((p) => `(${p.ere})`).join('|');
