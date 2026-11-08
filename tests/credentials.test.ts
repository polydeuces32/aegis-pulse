import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CredentialService, CredentialStore, type SafeStorageLike } from '../src/main/credentials';
import { KeyHolder } from '../src/main/keystore';
import type { PromptOutcome } from '../src/main/nativePrompt';

const KEY = 'PRESAGE-USER-KEY-0123456789';

/** Fake "keychain": reversible, but the ciphertext does not contain the plaintext. */
function fakeSafe(available = true): SafeStorageLike {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (s) => Buffer.from(Buffer.from(s).reverse().toString('base64')),
    decryptString: (b) => {
      const s = b.toString();
      if (!/^[A-Za-z0-9+/=]+$/.test(s)) throw new Error('corrupt'); // real safeStorage throws on corrupt data
      return Buffer.from(Buffer.from(s, 'base64').reverse()).toString();
    },
  };
}

function setup(opts: { available?: boolean; packaged?: boolean; env?: NodeJS.ProcessEnv; dotenv?: string; clip?: string; canChange?: boolean; prompt?: () => Promise<PromptOutcome>; saveFails?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'aegis-cred-'));
  if (opts.dotenv) writeFileSync(join(dir, '.env'), `SMARTSPECTRA_API_KEY=${opts.dotenv}\n`);
  const holder = new KeyHolder();
  let clip = opts.clip ?? '';
  let cleared = false;
  const credFile = opts.saveFails ? join(dir, 'blocker', 'credentials.bin') : join(dir, 'ud', 'credentials.bin');
  if (opts.saveFails) writeFileSync(join(dir, 'blocker'), 'x'); // a FILE where a directory is needed: mkdir/write fails
  const store = new CredentialStore(credFile, fakeSafe(opts.available ?? true));
  const svc = new CredentialService({
    store, holder, env: opts.env ?? {}, projectRoot: dir, packaged: opts.packaged ?? false,
    clipboard: { readText: () => clip, clear: () => { clip = ''; cleared = true; } },
    ...(opts.prompt ? { prompt: opts.prompt } : {}),
    canChange: () => opts.canChange ?? true,
  });
  svc.resolve();
  return { svc, holder, store, dir, file: credFile, setClip: (c: string) => { clip = c; }, wasCleared: () => cleared, clip: () => clip };
}

describe('CredentialStore', () => {
  it('round-trips, is owner-only, and never stores plaintext', () => {
    const t = setup();
    expect(t.store.save(KEY)).toBe(true);
    expect(statSync(t.file).mode & 0o077).toBe(0);
    expect(readFileSync(t.file).includes(Buffer.from(KEY))).toBe(false);
    expect(t.store.load().reveal()).toBe(KEY);
    expect(t.store.clear()).toBe(true);
    expect(t.store.hasStored()).toBe(false);
  });
  it('refuses to save (no plaintext fallback) when encryption is unavailable', () => {
    const t = setup({ available: false });
    expect(t.store.canStore()).toBe(false);
    expect(t.store.save(KEY)).toBe(false);
    expect(existsSync(t.file)).toBe(false);
  });
  it('treats basic_text (obfuscation-only) backends as unavailable', () => {
    const s = { ...fakeSafe(), getSelectedStorageBackend: () => 'basic_text' };
    expect(new CredentialStore('/tmp/x', s).canStore()).toBe(false);
  });
  it('a corrupt file behaves as no key and does not throw', () => {
    const t = setup();
    t.store.save(KEY);
    writeFileSync(t.file, 'garbage\u0000\u0001');
    expect(t.store.load().present).toBe(false);
  });
});

describe('CredentialService', () => {
  it('imports from the clipboard, stores in the keychain store, and clears the clipboard', () => {
    const t = setup({ clip: `  ${KEY}\n` });
    expect(t.svc.status()).toEqual({ source: 'none', canStore: true });
    expect(t.svc.importFromClipboard()).toEqual({ ok: true, saved: true });
    expect(t.svc.status().source).toBe('keychain');
    expect(t.holder.reveal()).toBe(KEY);
    expect(t.wasCleared()).toBe(true);
    expect(t.clip()).toBe('');
  });
  it('rejects clipboard text that does not look like a key, without storing anything', () => {
    for (const bad of ['', '   ', 'line one\nline two\nline three']) {
      const t = setup({ clip: bad });
      const r = t.svc.importFromClipboard();
      expect(r.ok).toBe(false);
      expect(t.svc.status().source).toBe('none');
      expect(existsSync(t.file)).toBe(false);
    }
  });
  it('does not save or clear while a session is active', () => {
    const t = setup({ clip: KEY, canChange: false });
    expect(t.svc.importFromClipboard().ok).toBe(false);
    expect(t.svc.remove().ok).toBe(false);
    expect(t.holder.present).toBe(false);
  });
  it('error results never contain the key', () => {
    const t = setup({ clip: KEY, available: false });
    expect(JSON.stringify(t.svc.importFromClipboard())).not.toContain(KEY);
  });
  it('stored key beats environment and .env; remove falls back explicitly (dev only)', () => {
    const t = setup({ env: { SMARTSPECTRA_API_KEY: 'ENV-KEY-0123456789' }, dotenv: 'DOTENV-KEY-0123456789', clip: KEY });
    expect(t.svc.status().source).toBe('environment');
    t.svc.importFromClipboard();
    expect(t.svc.status().source).toBe('keychain');
    expect(t.holder.reveal()).toBe(KEY);
    t.svc.remove();
    expect(t.svc.status().source).toBe('environment');
  });
  it('uses .env only when no env var and not packaged, and reports the source', () => {
    expect(setup({ dotenv: 'DOTENV-KEY-0123456789' }).svc.status().source).toBe('dotenv');
  });
  it('a PACKAGED app never reads env or .env: no silent developer-key fallback', () => {
    const t = setup({ packaged: true, env: { SMARTSPECTRA_API_KEY: 'ENV-KEY-0123456789' }, dotenv: 'DOTENV-KEY-0123456789' });
    expect(t.svc.status().source).toBe('none');
    expect(t.holder.present).toBe(false);
  });
  it('restores a previously stored key on the next launch', () => {
    const t = setup({ clip: KEY });
    t.svc.importFromClipboard();
    const holder2 = new KeyHolder();
    const svc2 = new CredentialService({ store: t.store, holder: holder2, env: {}, projectRoot: t.dir, packaged: true, clipboard: { readText: () => '', clear: () => undefined }, canChange: () => true });
    svc2.resolve();
    expect(svc2.status().source).toBe('keychain');
    expect(holder2.reveal()).toBe(KEY);
  });
});

describe('typed key entry (in-app field, saved by main)', () => {
  it('VALID input is trimmed, stored in the keychain store, and becomes the active key', () => {
    const t = setup();
    expect(t.svc.saveTyped(`  ${KEY}  `)).toEqual({ ok: true, saved: true });
    expect(t.svc.status().source).toBe('keychain');
    expect(t.holder.reveal()).toBe(KEY);
    expect(readFileSync(t.file).includes(Buffer.from(KEY))).toBe(false);
  });
  it('EMPTY input is refused with a clear message and stores nothing', () => {
    for (const empty of ['', '    ', undefined, null]) {
      const t = setup();
      const r = t.svc.saveTyped(empty);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error.message).toMatch(/No key was entered/);
      expect(existsSync(t.file)).toBe(false);
      expect(t.svc.status().source).toBe('none');
    }
  });
  it('INVALID input (multi-line, control characters, oversize, wrong type) is refused and stores nothing', () => {
    for (const [bad, msg] of [['a\nb', /several lines/], ['bad\u0007key', /control characters/], ['x'.repeat(1025), /1024/], [12345, /No key was entered/]] as const) {
      const t = setup();
      const r = t.svc.saveTyped(bad);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error.message).toMatch(msg);
      expect(existsSync(t.file)).toBe(false);
      expect(t.holder.present).toBe(false);
    }
  });
  it('SECURE-STORAGE FAILURE: unavailable encryption refuses to save, no plaintext fallback, key not activated', () => {
    const t = setup({ available: false });
    const r = t.svc.saveTyped(KEY);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.message).toMatch(/Secure storage/);
    expect(existsSync(t.file)).toBe(false);
    expect(t.holder.present).toBe(false);
    expect(JSON.stringify(r)).not.toContain(KEY);
  });
  it('SECURE-STORAGE FAILURE: a write error leaves the previous state untouched and reports it', () => {
    const t = setup({ saveFails: true });
    const r = t.svc.saveTyped(KEY);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.message).toMatch(/could not be saved securely/);
    expect(t.holder.present).toBe(false);
    expect(JSON.stringify(r)).not.toContain(KEY);
  });
  it('is refused while a session is active', () => {
    const t = setup({ canChange: false });
    expect(t.svc.saveTyped(KEY).ok).toBe(false);
    expect(t.holder.present).toBe(false);
  });
  it('the development .env fallback still works and the stored key still wins', () => {
    const t = setup({ dotenv: 'DOTENV-KEY-0123456789' });
    expect(t.svc.status().source).toBe('dotenv');
    t.svc.saveTyped(KEY);
    expect(t.svc.status().source).toBe('keychain');
    t.svc.remove();
    expect(t.svc.status().source).toBe('dotenv');
  });
});

describe('native main-process dialog entry', () => {
  it('entered key is saved; the result carries no key', async () => {
    const t = setup({ prompt: async () => ({ status: 'entered', value: KEY }) });
    const r = await t.svc.enterNatively();
    expect(r).toEqual({ ok: true, saved: true });
    expect(t.svc.status().source).toBe('keychain');
    expect(t.holder.reveal()).toBe(KEY);
  });
  it('cancel changes nothing and is not an error', async () => {
    const t = setup({ prompt: async () => ({ status: 'cancelled' }) });
    expect(await t.svc.enterNatively()).toEqual({ ok: true, saved: false });
    expect(t.svc.status().source).toBe('none');
    expect(existsSync(t.file)).toBe(false);
  });
  it('empty or invalid native input is refused', async () => {
    for (const value of ['', '  ', 'a\nb']) {
      const t = setup({ prompt: async () => ({ status: 'entered', value }) });
      expect((await t.svc.enterNatively()).ok).toBe(false);
      expect(existsSync(t.file)).toBe(false);
    }
  });
  it('dialog failure, unavailable platform, missing prompt and secure-storage failure are reported without the key', async () => {
    for (const prompt of [async () => ({ status: 'error' as const }), async () => ({ status: 'unavailable' as const }), undefined]) {
      const t = setup(prompt ? { prompt } : {});
      expect((await t.svc.enterNatively()).ok).toBe(false);
    }
    const t = setup({ available: false, prompt: async () => ({ status: 'entered', value: KEY }) });
    const r = await t.svc.enterNatively();
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain(KEY);
  });
});
