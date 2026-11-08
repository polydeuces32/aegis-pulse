import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AegisError, CredentialResult, CredentialStatus, KeySource, Result } from '../shared/ipc';
import { KeyHolder, Secret, checkApiKey, loadDotenvKey, loadEnvKey, type ApiKeyCheck } from './keystore';
import type { PromptOutcome } from './nativePrompt';

/** The subset of Electron's safeStorage we use (macOS: key material lives in the Keychain). */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
  getSelectedStorageBackend?(): string;
}

const credError = (message: string): { ok: false; error: AegisError } => ({
  ok: false,
  error: { kind: 'credential', message, retryable: false },
});

const REASON_TEXT = {
  empty: 'No key was entered. Paste the key from the Presage developer portal.',
  multiline: 'The text spans several lines, so it cannot be a single API key. Copy only the key and try again.',
  control: 'The text contains control characters, so it cannot be an API key. Copy only the key and try again.',
  'too-long': 'The text is longer than the SDK accepts for an API key (1024 characters). Copy only the key.',
} as const;

/**
 * Per-user encrypted key file. Encryption is delegated to the OS keychain via safeStorage.
 * There is NO plaintext fallback: if encryption is unavailable the key is not stored at all.
 */
export class CredentialStore {
  constructor(private readonly file: string, private readonly safe: SafeStorageLike) {}

  canStore(): boolean {
    try {
      if (!this.safe.isEncryptionAvailable()) return false;
      // Linux "basic_text" means obfuscation only; treat as unavailable.
      return this.safe.getSelectedStorageBackend?.() !== 'basic_text';
    } catch {
      return false;
    }
  }

  hasStored(): boolean {
    return existsSync(this.file);
  }

  load(): Secret {
    try {
      if (!this.canStore() || !existsSync(this.file)) return new Secret('');
      return new Secret(this.safe.decryptString(readFileSync(this.file)));
    } catch {
      return new Secret(''); // corrupt or unreadable: behave as "no key", never throw
    }
  }

  save(key: string): boolean {
    if (!this.canStore()) return false;
    const tmp = `${this.file}.tmp`;
    try {
      mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
      writeFileSync(tmp, this.safe.encryptString(key), { mode: 0o600 });
      renameSync(tmp, this.file);
      chmodSync(this.file, 0o600);
      return true;
    } catch {
      try { unlinkSync(tmp); } catch { /* nothing to clean */ }
      return false;
    }
  }

  clear(): boolean {
    try {
      if (existsSync(this.file)) unlinkSync(this.file);
      return true;
    } catch {
      return false;
    }
  }
}

export interface ClipboardLike {
  readText(): string;
  clear(): void;
}

export interface CredentialServiceDeps {
  store: CredentialStore;
  holder: KeyHolder;
  env: NodeJS.ProcessEnv;
  projectRoot: string;
  packaged: boolean;
  clipboard: ClipboardLike;
  /** Native hidden-input dialog run by the main process (macOS). Optional so tests can omit it. */
  prompt?: () => Promise<PromptOutcome>;
  /** False while a measurement session is active: the key must not change mid-session. */
  canChange: () => boolean;
}

/**
 * Key resolution order (explicit, never silent):
 *   1. per-user Keychain-backed stored key
 *   2. SMARTSPECTRA_API_KEY environment variable   (unpackaged development runs only)
 *   3. project .env file                           (unpackaged development runs only)
 *   4. none -> the UI shows onboarding and Start reports missing-key
 * A packaged app never reads (2) or (3), so a developer key can never ship or be picked up implicitly.
 */
export class CredentialService {
  private source: KeySource = 'none';
  constructor(private readonly d: CredentialServiceDeps) {}

  resolve(): void {
    const stored = this.d.store.load();
    if (stored.present) return this.use(stored, 'keychain');
    if (!this.d.packaged) {
      const env = loadEnvKey(this.d.env);
      if (env.present) return this.use(env, 'environment');
      const dot = loadDotenvKey(this.d.projectRoot);
      if (dot.present) return this.use(dot, 'dotenv');
    }
    this.use(new Secret(''), 'none');
  }

  status(): CredentialStatus {
    return { source: this.source, canStore: this.d.store.canStore() };
  }

  /** Common save path for every entry method. Error messages never contain the key. */
  private saveKey(raw: unknown): CredentialResult {
    if (!this.d.canChange()) return credError('Stop the measurement before changing the API key.');
    if (!this.d.store.canStore()) return credError('Secure storage (macOS Keychain) is not available, so the key was not saved.');
    const check: ApiKeyCheck = checkApiKey(raw);
    if (!check.ok) return credError(REASON_TEXT[check.reason]);
    if (!this.d.store.save(check.key)) return credError('The key could not be saved securely. Nothing was stored.');
    this.resolve();
    return { ok: true, saved: true };
  }

  importFromClipboard(): CredentialResult {
    let raw = '';
    try {
      raw = this.d.clipboard.readText();
    } catch {
      return credError('Could not read the clipboard.');
    }
    const r = this.saveKey(raw);
    if (r.ok) {
      try {
        if (this.d.clipboard.readText().trim() === raw.trim()) this.d.clipboard.clear(); // do not leave the key on the clipboard
      } catch { /* best effort */ }
    }
    return r;
  }

  /** Preferred path: the key is typed into a native macOS dialog owned by the main process. */
  async enterNatively(): Promise<CredentialResult> {
    if (!this.d.prompt) return credError('The native key dialog is not available on this system.');
    if (!this.d.canChange()) return credError('Stop the measurement before changing the API key.');
    if (!this.d.store.canStore()) return credError('Secure storage (macOS Keychain) is not available, so the key was not saved.');
    const out = await this.d.prompt();
    switch (out.status) {
      case 'entered': return this.saveKey(out.value);
      case 'cancelled': return { ok: true, saved: false };
      case 'unavailable': return credError('The native key dialog is not available on this system.');
      default: return credError('The key dialog failed. You can type the key into the field in the app instead.');
    }
  }

  /** Fallback: key typed into the app window. The renderer necessarily sees it during entry. */
  saveTyped(raw: unknown): CredentialResult {
    return this.saveKey(raw);
  }

  remove(): Result {
    if (!this.d.canChange()) return credError('Stop the measurement before changing the API key.');
    if (!this.d.store.clear()) return credError('The stored key could not be removed.');
    this.resolve();
    return { ok: true };
  }

  private use(secret: Secret, source: KeySource): void {
    this.d.holder.set(secret);
    this.source = source;
  }
}
