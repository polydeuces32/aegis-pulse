/**
 * Maps VideoFrame.timestamp (microseconds, page-relative media clock) to strictly-increasing
 * Unix-epoch microseconds, as the SDK requires. Mirrors the documented behavior of the stock
 * renderer binding (anchor on first frame, +1us ratchet). Survives session restarts: reset()
 * re-anchors but keeps the last emitted value so output never goes backwards.
 */
export class TimestampAnchor {
  private offsetUs: number | null = null;
  private last = 0;

  reset(): void {
    this.offsetUs = null;
  }

  next(rawUs: number, nowMs: number): number {
    if (this.offsetUs === null) this.offsetUs = nowMs * 1000 - rawUs;
    let ts = rawUs + this.offsetUs;
    if (ts <= this.last) ts = this.last + 1;
    this.last = ts;
    return ts;
  }
}
