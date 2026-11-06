import { describe, expect, it } from 'vitest';
import { Series } from '../src/renderer/state/series';
import { SIGNAL_LOST_MS, formatClock, hintFor, readingStatus } from '../src/renderer/state/quality';
import { extractTraces } from '../src/main/metrics';
import type { Signal } from '../src/shared/ipc';

const sig = (over: Partial<Signal> = {}): Signal => ({ value: 70, confidence: 90, stable: true, timestampUs: 1, ...over });

describe('Series', () => {
  it('keeps only strictly newer, finite points (dedupe, no generation)', () => {
    const s = new Series(100, 1e9);
    expect(s.push([{ t: 1, v: 1 }, { t: 1, v: 9 }, { t: 0, v: 5 }, { t: NaN, v: 1 }, { t: 2, v: Infinity }, { t: 3, v: 3 }])).toBe(2);
    expect(s.points).toEqual([{ t: 1, v: 1 }, { t: 3, v: 3 }]);
  });
  it('bounds by count and by time span', () => {
    const s = new Series(5, 1e9);
    s.push(Array.from({ length: 20 }, (_, i) => ({ t: i + 1, v: i })));
    expect(s.length).toBe(5);
    const t = new Series(1000, 10);
    t.push(Array.from({ length: 30 }, (_, i) => ({ t: i, v: i })));
    expect(t.points[0]?.t).toBeGreaterThanOrEqual(19);
  });
  it('window returns the trailing span only', () => {
    const s = new Series(100, 1e9);
    s.push(Array.from({ length: 10 }, (_, i) => ({ t: i * 10, v: i })));
    expect(s.window(25).map((p) => p.t)).toEqual([70, 80, 90]);
    expect(new Series(1, 1).window(5)).toEqual([]);
  });
});

describe('readingStatus', () => {
  it('no sample is never a value', () => {
    expect(readingStatus(null, 'running', null)).toMatchObject({ kind: 'measuring', showValue: false });
    expect(readingStatus(null, 'idle', null)).toMatchObject({ kind: 'idle', showValue: false });
    expect(readingStatus(null, 'error', null).label).toBe('Unavailable');
  });
  it('unstable is preliminary, stable is stable', () => {
    expect(readingStatus(sig({ stable: false }), 'running', 100).kind).toBe('preliminary');
    expect(readingStatus(sig(), 'running', 100).kind).toBe('stable');
  });
  it('old sample is lost; ended session is labeled as last value', () => {
    expect(readingStatus(sig(), 'running', SIGNAL_LOST_MS + 1).kind).toBe('lost');
    expect(readingStatus(sig(), 'idle', 0)).toMatchObject({ kind: 'ended', showValue: true });
    expect(readingStatus(sig(), 'idle', 0).label).toMatch(/session ended/i);
  });
  it('ended session keeps an unstable last value clearly flagged', () => {
    const r = readingStatus(sig({ stable: false, confidence: 34 }), 'idle', 0);
    expect(r.unstableAtEnd).toBe(true);
    expect(r.label).toMatch(/NOT yet stable/);
    expect(readingStatus(sig(), 'idle', 0).unstableAtEnd).toBeUndefined();
    expect(readingStatus(sig({ stable: false }), 'error', 0).kind).toBe('ended');
  });
});

describe('hints and formatting', () => {
  it('maps documented codes to actionable camera/lighting guidance', () => {
    expect(hintFor('kTooDark', '').action).toMatch(/light/i);
    expect(hintFor('kExcessiveMotion', '').level).toBe('warn');
    expect(hintFor('kOk', '').level).toBe('ok');
  });
  it('falls back safely for unknown codes', () => {
    expect(hintFor('kNew', 'sdk text').title).toBe('sdk text');
  });
  it('hint text contains no health claims', () => {
    for (const n of ['kNoFaceFound', 'kTooDark', 'kExcessiveMotion', 'kChestNotVisible']) {
      const h = hintFor(n, '');
      expect(`${h.title} ${h.action}`).not.toMatch(/diagnos|stress|heart (attack|disease)|doctor|medical|treat/i);
    }
  });
  it('formats the session clock', () => expect(formatClock(75)).toBe('01:15'));
});

describe('extractTraces', () => {
  it('returns only real finite samples and caps count', () => {
    const many = Array.from({ length: 2000 }, (_, i) => ({ value: i, timestamp: i + 1 }));
    const r = extractTraces({ cardio: { arterialPressureTrace: many }, breathing: { upperTrace: [{ value: NaN, timestamp: 1 }, { value: 2, timestamp: 2 }] } });
    expect(r.pulseWave).toHaveLength(512);
    expect(r.breathWave).toEqual([{ t: 2, v: 2 }]);
    expect(extractTraces({})).toEqual({ pulseWave: [], breathWave: [] });
  });
});
