import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Main-process-only API key holder. The key never leaves this module except through
 * reveal(), which is called exactly once: when constructing the SDK. toString/toJSON/
 * inspect are redacted so accidental logging or serialization cannot leak it.
 */
export class Secret {
  readonly #value: string;
  constructor(value: string) {
    this.#value = value;
  }
  get present(): boolean {
    return this.#value.length > 0;
  }
  reveal(): string {
    return this.#value;
  }
  /** Remove every occurrence of the secret from arbitrary text. */
  redact(text: string): string {
    return this.#value ? text.split(this.#value).join('[redacted]') : text;
  }
  toString(): string {
    return '[Secret]';
  }
  toJSON(): string {
    return '[Secret]';
  }
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return '[Secret]';
  }
}

/** Mutable holder so a key imported at runtime reaches the SDK session without restarting. Same read API as Secret. */
export class KeyHolder {
  #secret = new Secret('');
  set(secret: Secret): void {
    this.#secret = secret;
  }
  get present(): boolean {
    return this.#secret.present;
  }
  reveal(): string {
    return this.#secret.reveal();
  }
  redact(text: string): string {
    return this.#secret.redact(text);
  }
  toString(): string {
    return '[KeyHolder]';
  }
  toJSON(): string {
    return '[KeyHolder]';
  }
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return '[KeyHolder]';
  }
}

/** SDK 3.4.0 clamps apiKey to 1024 characters internally; longer input is refused rather than silently truncated. */
export const MAX_API_KEY_CHARS = 1024;

export type ApiKeyCheck = { ok: true; key: string } | { ok: false; reason: 'empty' | 'multiline' | 'control' | 'too-long' };

/**
 * Presage publishes NO key format (no prefix, length or alphabet). The only documented hygiene point is that stray
 * whitespace from copy/paste is a common mistake, so we trim. Beyond that we refuse only input that cannot be a
 * single-line credential: empty, line breaks / control characters, or longer than the SDK itself accepts.
 * Real validity is decided by the SmartSpectra server when a session starts.
 */
export function checkApiKey(raw: unknown): ApiKeyCheck {
  if (typeof raw !== 'string') return { ok: false, reason: 'empty' };
  const key = raw.trim();
  if (key.length === 0) return { ok: false, reason: 'empty' };
  if (/[\r\n]/.test(key)) return { ok: false, reason: 'multiline' };
  if (/[\u0000-\u001f\u007f]/.test(key)) return { ok: false, reason: 'control' };
  if (key.length > MAX_API_KEY_CHARS) return { ok: false, reason: 'too-long' };
  return { ok: true, key };
}

export function loadEnvKey(env: NodeJS.ProcessEnv): Secret {
  return new Secret((env['SMARTSPECTRA_API_KEY'] ?? '').trim());
}

export function loadDotenvKey(projectRoot: string): Secret {
  try {
    return new Secret(parseEnvKey(readFileSync(join(projectRoot, '.env'), 'utf8')));
  } catch {
    return new Secret('');
  }
}

export function parseEnvKey(text: string): string {
  const m = /^\s*(?:export\s+)?SMARTSPECTRA_API_KEY\s*=\s*(.*)$/m.exec(text);
  const raw = (m?.[1] ?? '').trim();
  return raw.replace(/^['"]|['"]$/g, '').trim();
}
