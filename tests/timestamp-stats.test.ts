import { describe, expect, it } from 'vitest';
import { LatencyWindow, RateWindow } from '../src/shared/stats';
import { TimestampAnchor } from '../src/shared/timestamp';

describe('TimestampAnchor', () => {
  it('anchors to epoch microseconds and stays strictly increasing', () => {
    const a = new TimestampAnchor();
    const t1 = a.next(1_000, 5_000);
    const t2 = a.next(34_000, 5_033);
    expect(t1).toBe(5_000_000);
    expect(t2).toBe(5_000_000 + 33_000);
    expect(a.next(34_000, 5_034)).toBe(t2 + 1);
    expect(a.next(10, 5_035)).toBe(t2 + 2);
  });
  it('never goes backwards across reset', () => {
    const a = new TimestampAnchor();
    const last = a.next(900_000, 10_000);
    a.reset();
    expect(a.next(0, 9_000)).toBeGreaterThan(last);
  });
});

describe('stats', () => {
  it('computes rate over a window', () => {
    const r = new RateWindow(5000);
    for (let i = 0; i <= 30; i++) r.mark(i * 33.333);
    expect(r.rate(1000)).toBeCloseTo(30, 0);
  });
  it('drops old marks', () => {
    const r = new RateWindow(1000);
    r.mark(0); r.mark(10);
    expect(r.rate(5000)).toBe(0);
  });
  it('latency percentiles', () => {
    const l = new LatencyWindow(100);
    for (let i = 1; i <= 100; i++) l.add(i);
    const s = l.summary();
    expect(s.n).toBe(100);
    expect(s.p50).toBe(51);
    expect(s.p95).toBe(96);
    expect(s.max).toBe(100);
    expect(new LatencyWindow().summary().n).toBe(0);
  });
  it('bounds memory', () => {
    const l = new LatencyWindow(10);
    for (let i = 0; i < 1000; i++) l.add(i);
    expect(l.summary().n).toBe(10);
  });
});
