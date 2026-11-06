import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
  appendFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { LifecycleEvent, SessionSummary } from './sdkSession';

/** Filesystem operations, injectable so failure paths are testable. */
export interface FsOps {
  mkdirSync: typeof mkdirSync;
  openSync: typeof openSync;
  writeSync: typeof writeSync;
  fsyncSync: typeof fsyncSync;
  closeSync: typeof closeSync;
  renameSync: typeof renameSync;
  unlinkSync: typeof unlinkSync;
  readdirSync: typeof readdirSync;
  statSync: typeof statSync;
  appendFileSync: typeof appendFileSync;
}

const realFs: FsOps = { mkdirSync, openSync, writeSync, fsyncSync, closeSync, renameSync, unlinkSync, readdirSync, statSync, appendFileSync };

export interface SessionLoggerOptions {
  dir: string;
  maxLifecycleBytes?: number;
  maxSessionFiles?: number;
  fs?: FsOps;
  /** Receives non-secret failure notes (message only) so failures are visible without breaking anything. */
  onError?: (msg: string) => void;
}

export const LIFECYCLE_FILE = 'lifecycle.jsonl';

/**
 * Local, bounded, secret-free session logging.
 *  - lifecycle.jsonl: one JSON line per event (timestamps, state transitions, rates, latencies, counts).
 *    Rotated to lifecycle.1.jsonl at maxLifecycleBytes, so at most ~2x that size exists.
 *  - session-<time>-<id>.json: one atomic summary per session (temp file + fsync + rename).
 *    Only the newest maxSessionFiles are kept.
 * Every public method swallows errors: logging can never block or break camera shutdown.
 */
export class SessionLogger {
  private readonly dir: string;
  private readonly maxBytes: number;
  private readonly maxFiles: number;
  private readonly fs: FsOps;
  private readonly onError: (msg: string) => void;

  constructor(opts: SessionLoggerOptions) {
    this.dir = opts.dir;
    this.maxBytes = opts.maxLifecycleBytes ?? 256 * 1024;
    this.maxFiles = opts.maxSessionFiles ?? 50;
    this.fs = opts.fs ?? realFs;
    this.onError = opts.onError ?? (() => undefined);
  }

  lifecycle(e: LifecycleEvent): void {
    try {
      this.fs.mkdirSync(this.dir, { recursive: true });
      const file = join(this.dir, LIFECYCLE_FILE);
      this.rotateIfNeeded(file);
      this.fs.appendFileSync(file, `${JSON.stringify(e)}\n`, { mode: 0o600 });
    } catch (err) {
      this.fail('lifecycle write failed', err);
    }
  }

  /** Returns the final path, or null if the summary could not be written. */
  writeSummary(s: SessionSummary): string | null {
    const name = `session-${new Date(s.startedAtEpochMs).toISOString().replace(/[:.]/g, '-')}-${s.sessionId.slice(0, 8)}.json`;
    const finalPath = join(this.dir, name);
    const tmpPath = `${finalPath}.tmp`;
    let fd: number | null = null;
    try {
      this.fs.mkdirSync(this.dir, { recursive: true });
      fd = this.fs.openSync(tmpPath, 'w', 0o600);
      this.fs.writeSync(fd, JSON.stringify(s, null, 2));
      this.fs.fsyncSync(fd);
      this.fs.closeSync(fd);
      fd = null;
      this.fs.renameSync(tmpPath, finalPath); // atomic on the same filesystem: readers never see a partial file
      this.prune();
      return finalPath;
    } catch (err) {
      if (fd !== null) {
        try { this.fs.closeSync(fd); } catch { /* ignore */ }
      }
      try { this.fs.unlinkSync(tmpPath); } catch { /* nothing to clean */ }
      this.fail('summary write failed', err);
      return null;
    }
  }

  private rotateIfNeeded(file: string): void {
    try {
      if (this.fs.statSync(file).size >= this.maxBytes) this.fs.renameSync(file, join(this.dir, 'lifecycle.1.jsonl'));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') this.fail('lifecycle rotate failed', err);
    }
  }

  private prune(): void {
    try {
      const all = this.fs.readdirSync(this.dir);
      for (const n of all) if (/^session-.*\.json\.tmp$/.test(n)) this.fs.unlinkSync(join(this.dir, n));
      const files = all.filter((n) => /^session-.*\.json$/.test(n)).sort();
      for (const n of files.slice(0, Math.max(0, files.length - this.maxFiles))) this.fs.unlinkSync(join(this.dir, n));
    } catch (err) {
      this.fail('prune failed', err);
    }
  }

  private fail(what: string, err: unknown): void {
    try {
      this.onError(`${what}: ${(err as NodeJS.ErrnoException)?.code ?? 'error'}`);
    } catch {
      /* never throw from the logger */
    }
  }
}
