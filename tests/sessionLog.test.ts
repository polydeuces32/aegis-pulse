import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as realFs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIFECYCLE_FILE, SessionLogger, type FsOps } from '../src/main/sessionLog';
import type { LifecycleEvent, SessionSummary } from '../src/main/sdkSession';

const tmp = (): string => mkdtempSync(join(tmpdir(), 'aegis-log-'));
const stats = { framesReceived: 10, framesAccepted: 10, droppedInvalid: 0, droppedStale: 0, droppedNotRunning: 0, sdkRejected: 0,
  acceptedFps: 30, transitMs: { n: 1, p50: 3, p95: 4, max: 5 }, sendFrameMs: { n: 1, p50: 0, p95: 1, max: 1 }, rssMb: 300,
  metricPackets: 5, pulseWavePoints: 1, breathWavePoints: 1 };
const summary = (id = 'abcdef12-0000-4000-8000-000000000000', at = 1_700_000_000_000): SessionSummary => ({
  sessionId: id, startedAtEpochMs: at, endedAtEpochMs: at + 5000, durationSec: 5, endReason: 'stop', errorKind: null, stats,
  counts: { metricPackets: 5, pulseSamples: 2, pulseStable: 1, breathingSamples: 1, breathingStable: 0, pulseWavePoints: 1, breathWavePoints: 1 },
});
const evt = (n: number): LifecycleEvent => ({ ts: n, sessionId: 's', event: 'phase', phase: 'running', errorKind: null });

describe('SessionLogger.writeSummary', () => {
  it('writes an atomic, parseable summary with a unique name and leaves no temp file', () => {
    const dir = tmp();
    const log = new SessionLogger({ dir });
    const p1 = log.writeSummary(summary('11111111-aaaa'));
    const p2 = log.writeSummary(summary('22222222-bbbb'));
    expect(p1).not.toBeNull();
    expect(p1).not.toBe(p2);
    expect(JSON.parse(readFileSync(p1 as string, 'utf8')).sessionId).toBe('11111111-aaaa');
    expect(readdirSync(dir).filter((n) => n.endsWith('.tmp'))).toEqual([]);
    expect(statSync(p1 as string).mode & 0o077).toBe(0); // owner-only
  });

  it('creates a missing (nested) log directory', () => {
    const dir = join(tmp(), 'a', 'b', 'logs');
    expect(existsSync(dir)).toBe(false);
    const p = new SessionLogger({ dir }).writeSummary(summary());
    expect(p && existsSync(p)).toBe(true);
  });

  it('returns null and reports (without throwing) when the directory cannot be created', () => {
    const base = tmp();
    const blocker = join(base, 'not-a-dir');
    writeFileSync(blocker, 'x');
    const errors: string[] = [];
    const log = new SessionLogger({ dir: join(blocker, 'logs'), onError: (m) => errors.push(m) });
    expect(() => log.lifecycle(evt(1))).not.toThrow();
    expect(log.writeSummary(summary())).toBeNull();
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it('leaves neither a partial nor a final file when the atomic rename fails', () => {
    const dir = tmp();
    const failing: FsOps = { ...(realFs as unknown as FsOps), renameSync: () => { throw Object.assign(new Error('boom'), { code: 'EIO' }); } };
    const errors: string[] = [];
    const log = new SessionLogger({ dir, fs: failing, onError: (m) => errors.push(m) });
    expect(log.writeSummary(summary())).toBeNull();
    expect(readdirSync(dir)).toEqual([]);
    expect(errors[0]).toContain('EIO');
  });

  it('keeps only the newest N session files', () => {
    const dir = tmp();
    const log = new SessionLogger({ dir, maxSessionFiles: 3 });
    for (let i = 0; i < 6; i++) log.writeSummary(summary(`0000000${i}-x`, 1_700_000_000_000 + i * 1000));
    const files = readdirSync(dir).filter((n) => n.startsWith('session-')).sort();
    expect(files).toHaveLength(3);
    expect(files[0]).toContain('00000003');
  });

  it('serializes no physiological values, frames or key-like fields', () => {
    const text = JSON.stringify(summary());
    expect(text).not.toMatch(/"(value|confidence|apiKey|buffer|stable":\s*true)/);
    expect(Object.keys(summary().counts).every((k) => typeof (summary().counts as Record<string, number>)[k] === 'number')).toBe(true);
  });
});

describe('SessionLogger.lifecycle', () => {
  it('appends one JSON line per event', () => {
    const dir = tmp();
    const log = new SessionLogger({ dir });
    log.lifecycle(evt(1));
    log.lifecycle(evt(2));
    const lines = readFileSync(join(dir, LIFECYCLE_FILE), 'utf8').trim().split('\n');
    expect(lines.map((l) => JSON.parse(l).ts)).toEqual([1, 2]);
  });

  it('is size-bounded by rotation', () => {
    const dir = tmp();
    const log = new SessionLogger({ dir, maxLifecycleBytes: 500 });
    for (let i = 0; i < 200; i++) log.lifecycle(evt(i));
    const total = readdirSync(dir).reduce((n, f) => n + statSync(join(dir, f)).size, 0);
    expect(total).toBeLessThan(500 * 2 + 200);
    expect(existsSync(join(dir, 'lifecycle.1.jsonl'))).toBe(true);
  });
});
