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

export function parseEnvKey(text: string): string {
  const m = /^\s*(?:export\s+)?SMARTSPECTRA_API_KEY\s*=\s*(.*)$/m.exec(text);
  const raw = (m?.[1] ?? '').trim();
  return raw.replace(/^['"]|['"]$/g, '').trim();
}

/**
 * Dev: environment variable, else the project's gitignored .env.
 * Packaged: environment only (a secure per-user store is Phase C2+; see README/security notes).
 */
export function loadApiKey(opts: { env: NodeJS.ProcessEnv; projectRoot: string; packaged: boolean }): Secret {
  const fromEnv = (opts.env['SMARTSPECTRA_API_KEY'] ?? '').trim();
  if (fromEnv) return new Secret(fromEnv);
  if (opts.packaged) return new Secret('');
  try {
    return new Secret(parseEnvKey(readFileSync(join(opts.projectRoot, '.env'), 'utf8')));
  } catch {
    return new Secret('');
  }
}
