import type { LatencySummary } from './ipc';

/** Events-per-second over a sliding window. */
export class RateWindow {
  private marks: number[] = [];
  constructor(private readonly windowMs: number) {}
  mark(nowMs: number): void {
    this.marks.push(nowMs);
    this.trim(nowMs);
  }
  rate(nowMs: number): number {
    this.trim(nowMs);
    if (this.marks.length < 2) return 0;
    const first = this.marks[0] as number;
    const span = Math.max(nowMs - first, 1);
    return ((this.marks.length - 1) * 1000) / Math.min(span, this.windowMs);
  }
  private trim(nowMs: number): void {
    const cutoff = nowMs - this.windowMs;
    let i = 0;
    while (i < this.marks.length && (this.marks[i] as number) < cutoff) i++;
    if (i > 0) this.marks.splice(0, i);
  }
}

/** Bounded ring of latency samples with percentile summary. */
export class LatencyWindow {
  private samples: number[] = [];
  constructor(private readonly max = 300) {}
  add(ms: number): void {
    if (!Number.isFinite(ms)) return;
    this.samples.push(ms);
    if (this.samples.length > this.max) this.samples.shift();
  }
  summary(): LatencySummary {
    const n = this.samples.length;
    if (n === 0) return { n: 0, p50: 0, p95: 0, max: 0 };
    const s = [...this.samples].sort((a, b) => a - b);
    const at = (p: number): number => s[Math.min(n - 1, Math.floor(p * n))] as number;
    return { n, p50: round(at(0.5)), p95: round(at(0.95)), max: round(s[n - 1] as number) };
  }
}

const round = (v: number): number => Math.round(v * 100) / 100;
