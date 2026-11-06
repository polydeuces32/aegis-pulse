import { LatencyWindow, RateWindow } from '../shared/stats';
import type { AegisApi, LatencySummary } from '../shared/ipc';

export interface CaptureStats {
  sentFrames: number;
  acked: number;
  rejected: number;
  droppedBusy: number;
  sendFps: number;
  rttMs: LatencySummary;
  width: number;
  height: number;
}

export type CameraFailure = 'denied' | 'unavailable' | 'unsupported';

export class CameraError extends Error {
  constructor(public readonly failure: CameraFailure, message: string) {
    super(message);
  }
}

/** Acquire the camera. Must only be called after the user has granted consent in the UI. */
export async function openCamera(): Promise<MediaStream> {
  if (typeof MediaStreamTrackProcessor === 'undefined') {
    throw new CameraError('unsupported', 'MediaStreamTrackProcessor is unavailable in this runtime.');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' },
      audio: false,
    });
  } catch (e) {
    const name = e instanceof DOMException ? e.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new CameraError('denied', 'Camera access was denied (check the app prompt and macOS Privacy & Security > Camera).');
    }
    throw new CameraError('unavailable', name === 'NotFoundError' ? 'No camera found.' : 'Camera could not be opened.');
  }
}

/**
 * Bounded frame pump: at most ONE frame in flight (the next is not read-and-sent until main acks),
 * the processor buffer holds a single frame so stale frames are discarded by the browser, and any
 * frame that arrives while a send is pending is closed immediately.
 */
export class FramePump {
  private active = false;
  private inFlight = false;
  private loop: Promise<void> | null = null;
  private reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
  private readonly rate = new RateWindow(5000);
  private readonly rtt = new LatencyWindow();
  private stats = { sent: 0, acked: 0, rejected: 0, busy: 0, w: 0, h: 0 };

  constructor(private readonly api: AegisApi, private readonly onStats: (s: CaptureStats) => void) {}

  start(stream: MediaStream): void {
    const track = stream.getVideoTracks()[0];
    if (!track) throw new CameraError('unavailable', 'Stream has no video track.');
    const processor = new MediaStreamTrackProcessor({ track, maxBufferSize: 1 });
    this.reader = processor.readable.getReader();
    this.active = true;
    this.loop = this.run();
  }

  async stop(): Promise<void> {
    this.active = false;
    try {
      await this.reader?.cancel();
    } catch {
      /* already closed */
    }
    await this.loop;
    this.loop = null;
    this.reader = null;
  }

  private async run(): Promise<void> {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !this.reader) return;
    let lastReport = 0;
    while (this.active) {
      let next: ReadableStreamReadResult<VideoFrame>;
      try {
        next = await this.reader.read();
      } catch {
        break;
      }
      if (next.done) break;
      const vf = next.value;
      try {
        if (this.inFlight) {
          this.stats.busy++;
          continue;
        }
        const w = vf.codedWidth;
        const h = vf.codedHeight;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        ctx.drawImage(vf, 0, 0);
        const img = ctx.getImageData(0, 0, w, h);
        this.inFlight = true;
        const t0 = performance.now();
        this.stats.sent++;
        this.stats.w = w;
        this.stats.h = h;
        const ack = await this.api.sendFrame({
          buffer: img.data.buffer as ArrayBuffer,
          width: w,
          height: h,
          stride: w * 4,
          timestampUs: Math.max(0, Math.trunc(vf.timestamp)),
          sentAtEpochMs: Date.now(),
        });
        this.rtt.add(performance.now() - t0);
        if (ack.accepted) {
          this.stats.acked++;
          this.rate.mark(performance.now());
        } else {
          this.stats.rejected++;
        }
      } catch {
        this.stats.rejected++;
      } finally {
        this.inFlight = false;
        vf.close();
      }
      const now = performance.now();
      if (now - lastReport > 1000) {
        lastReport = now;
        this.onStats({
          sentFrames: this.stats.sent,
          acked: this.stats.acked,
          rejected: this.stats.rejected,
          droppedBusy: this.stats.busy,
          sendFps: Math.round(this.rate.rate(now) * 10) / 10,
          rttMs: this.rtt.summary(),
          width: this.stats.w,
          height: this.stats.h,
        });
      }
    }
  }
}
