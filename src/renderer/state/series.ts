export interface Point {
  t: number;
  v: number;
}

/**
 * Bounded, monotonic time series of REAL SDK samples. Points whose time is not strictly newer than the
 * last stored point are discarded (dedupe), and storage is capped by count and by time span. It never
 * interpolates, smooths, or generates points.
 */
export class Series {
  private pts: Point[] = [];
  constructor(private readonly maxPoints: number, private readonly maxSpanUs: number) {}

  push(points: readonly Point[]): number {
    let added = 0;
    for (const p of points) {
      if (!Number.isFinite(p.t) || !Number.isFinite(p.v)) continue;
      const last = this.pts[this.pts.length - 1];
      if (last && p.t <= last.t) continue;
      this.pts.push({ t: p.t, v: p.v });
      added++;
    }
    if (added > 0) this.trim();
    return added;
  }

  clear(): void {
    this.pts = [];
  }

  get length(): number {
    return this.pts.length;
  }

  get points(): readonly Point[] {
    return this.pts;
  }

  last(): Point | undefined {
    return this.pts[this.pts.length - 1];
  }

  /** Points within the trailing spanUs of the newest point. */
  window(spanUs: number): Point[] {
    const last = this.last();
    if (!last) return [];
    const from = last.t - spanUs;
    let i = this.pts.length;
    while (i > 0 && (this.pts[i - 1] as Point).t >= from) i--;
    return this.pts.slice(i);
  }

  private trim(): void {
    const last = this.pts[this.pts.length - 1];
    if (!last) return;
    const from = last.t - this.maxSpanUs;
    let drop = 0;
    while (drop < this.pts.length && (this.pts[drop] as Point).t < from) drop++;
    if (this.pts.length - drop > this.maxPoints) drop = this.pts.length - this.maxPoints;
    if (drop > 0) this.pts.splice(0, drop);
  }
}
