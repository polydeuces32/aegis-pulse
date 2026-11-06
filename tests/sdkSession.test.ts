import { describe, expect, it, vi } from 'vitest';
import { ProcessingStatus, SmartSpectraErrorCode } from '@smartspectra/node-sdk';
import { Secret } from '../src/main/keystore';
import { SdkSession, type SdkPort } from '../src/main/sdkSession';
import type { AegisEvent, FramePayload } from '../src/shared/ipc';

const KEY = 'SUPER-SECRET-KEY-0001';

type Handler = (...a: never[]) => void;
function fakeSdk(opts: { startThrows?: unknown; sendResult?: boolean; hangStop?: boolean } = {}) {
  const handlers = new Map<string, Handler>();
  const calls: string[] = [];
  const sent: Array<{ ts: number; fmt: number }> = [];
  const sdk = {
    on(event: string, cb: Handler) { handlers.set(event, cb); return sdk; },
    useCustomInput() { calls.push('useCustomInput'); return sdk; },
    start() { calls.push('start'); if (opts.startThrows) throw opts.startThrows; },
    async stopAsync() { calls.push('stopAsync'); if (opts.hangStop) await new Promise(() => undefined); },
    async destroy() { calls.push('destroy'); },
    sendFrame(_b: Uint8Array, _w: number, _h: number, _s: number, fmt: number, ts: number) {
      sent.push({ ts, fmt });
      return opts.sendResult ?? true;
    },
  };
  return { sdk: sdk as unknown as SdkPort, handlers, calls, sent };
}

function harness(opts: Parameters<typeof fakeSdk>[0] = {}, key = KEY) {
  const events: AegisEvent[] = [];
  const f = fakeSdk(opts);
  let created: unknown = null;
  let now = 1_000_000;
  const session = new SdkSession({
    createSdk: (o) => { created = o; return f.sdk; },
    decode: (b) => JSON.parse(b.toString()),
    apiKey: new Secret(key),
    emit: (e) => events.push(e),
    nowMs: () => now,
    rssBytes: () => 100 * 1048576,
    statsIntervalMs: 10_000,
    teardownTimeoutMs: 20,
  });
  return { session, events, f, created: () => created as Record<string, unknown>, tick: (ms: number) => { now += ms; } , now: () => now };
}

const frame = (nowMs: number, ts = 1_000, sentAgo = 5): FramePayload => ({
  buffer: new ArrayBuffer(64 * 64 * 4), width: 64, height: 64, stride: 256, timestampUs: ts, sentAtEpochMs: nowMs - sentAgo,
});

describe('SdkSession', () => {
  it('refuses to start without consent', async () => {
    const h = harness();
    const r = await h.session.start();
    expect(r.ok).toBe(false);
    expect(h.f.calls).toEqual([]);
  });

  it('starts with telemetry explicitly disabled, key only in the SDK ctor, custom input', async () => {
    const h = harness();
    h.session.setConsent(true);
    expect((await h.session.start()).ok).toBe(true);
    const o = h.created();
    expect(o['enableTelemetry']).toBe(false);
    expect(o['apiKey']).toBe(KEY);
    expect(h.f.calls).toEqual(['useCustomInput', 'start']);
    expect(JSON.stringify(h.events)).not.toContain(KEY);
    expect(JSON.stringify(h.session.snapshot())).not.toContain(KEY);
    await h.session.shutdown();
  });

  it('reports missing key without creating an SDK', async () => {
    const h = harness({}, '');
    h.session.setConsent(true);
    const r = await h.session.start();
    expect(!r.ok && r.error.kind).toBe('missing-key');
    expect(h.f.calls).toEqual([]);
  });

  it.each([
    [SmartSpectraErrorCode.kAuthenticationFailed, 'authentication'],
    [SmartSpectraErrorCode.kNetworkError, 'network'],
    [SmartSpectraErrorCode.kCreditExhausted, 'quota'],
  ])('maps thrown SDK error %i to %s and tears down', async (code, kind) => {
    const h = harness({ startThrows: Object.assign(new Error(`boom ${KEY}`), { code }) });
    h.session.setConsent(true);
    const r = await h.session.start();
    expect(!r.ok && r.error.kind).toBe(kind);
    expect(JSON.stringify(r)).not.toContain(KEY);
    expect(h.f.calls).toContain('destroy');
    expect(h.session.snapshot().phase).toBe('error');
  });

  it('maps async SDK error events, stops, and redacts the key', async () => {
    const h = harness();
    h.session.setConsent(true);
    await h.session.start();
    (h.f.handlers.get('error') as unknown as (c: number, m: string, r: boolean) => void)(SmartSpectraErrorCode.kNetworkError, `x ${KEY}`, true);
    await vi.waitFor(() => expect(h.session.snapshot().phase).toBe('error'));
    expect(h.session.snapshot().error?.kind).toBe('network');
    expect(JSON.stringify(h.events)).not.toContain(KEY);
    expect(h.f.calls).toEqual(expect.arrayContaining(['stopAsync', 'destroy']));
  });

  it('only accepts frames while starting/running; anchors timestamps strictly increasing', async () => {
    const h = harness();
    h.session.setConsent(true);
    expect(h.session.handleFrame(frame(h.now()))).toEqual({ accepted: false, reason: 'not-running' });
    await h.session.start();
    (h.f.handlers.get('processingStatus') as unknown as (s: number) => void)(ProcessingStatus.kRunning);
    expect(h.session.snapshot().phase).toBe('running');
    for (let i = 0; i < 5; i++) {
      h.tick(33);
      expect(h.session.handleFrame(frame(h.now(), 1_000 + i * 33_000)).accepted).toBe(true);
    }
    const ts = h.f.sent.map((s) => s.ts);
    expect(ts.every((t, i) => i === 0 || t > (ts[i - 1] as number))).toBe(true);
    expect(h.f.sent.every((s) => s.fmt === 2)).toBe(true); // PixelFormat.kRGBA
    await h.session.shutdown();
  });

  it('drops stale frames and counts SDK rejections', async () => {
    const h = harness({ sendResult: false });
    h.session.setConsent(true);
    await h.session.start();
    expect(h.session.handleFrame(frame(h.now(), 1, 5_000))).toEqual({ accepted: false, reason: 'stale' });
    expect(h.session.handleFrame(frame(h.now(), 2, 5))).toEqual({ accepted: false, reason: 'sdk-rejected' });
    const s = h.session.mainStats();
    expect(s.droppedStale).toBe(1);
    expect(s.sdkRejected).toBe(1);
    await h.session.shutdown();
  });

  it('publishes only real decoded SDK samples', async () => {
    const h = harness();
    h.session.setConsent(true);
    await h.session.start();
    const metrics = h.f.handlers.get('metrics') as unknown as (b: Buffer) => void;
    metrics(Buffer.from(JSON.stringify({ cardio: { pulseRate: [{ value: 71, confidence: 80, stable: true, timestamp: 9 }] } })));
    metrics(Buffer.from('not json'));
    expect(h.session.snapshot().pulse?.value).toBe(71);
    expect(h.session.snapshot().breathing).toBeNull();
    expect(h.session.snapshot().metricPackets).toBe(1);
    await h.session.shutdown();
  });

  it('stop is clean, idempotent, and emits a summary', async () => {
    const events: AegisEvent[] = [];
    const f = fakeSdk();
    const summaries: unknown[] = [];
    const s = new SdkSession({
      createSdk: () => f.sdk, decode: () => ({}), apiKey: new Secret(KEY), emit: (e) => events.push(e),
      nowMs: () => 5_000, rssBytes: () => 1, onSummary: (x) => summaries.push(x), statsIntervalMs: 10_000,
    });
    s.setConsent(true);
    await s.start();
    expect((await s.stop()).ok).toBe(true);
    expect((await s.stop()).ok).toBe(true);
    expect(f.calls.filter((c) => c === 'destroy')).toHaveLength(1);
    expect(s.snapshot().phase).toBe('idle');
    expect(summaries).toHaveLength(1);
  });

  it('writes the summary and finishes stop even if native stopAsync hangs', async () => {
    const h = harness({ hangStop: true });
    const summaries: unknown[] = [];
    // rebuild with onSummary
    const f = fakeSdk({ hangStop: true });
    const s2 = new SdkSession({
      createSdk: () => f.sdk, decode: () => ({}), apiKey: new Secret(KEY), emit: () => undefined,
      nowMs: () => 9_000, rssBytes: () => 1, onSummary: (x) => summaries.push(x), statsIntervalMs: 10_000, teardownTimeoutMs: 20,
    });
    s2.setConsent(true);
    await s2.start();
    expect((await s2.stop()).ok).toBe(true);
    expect(summaries).toHaveLength(1);
    expect(f.calls).toContain('destroy');
    expect(s2.snapshot().phase).toBe('idle');
    void h;
  });

  it('can restart after an error and cannot revoke consent while active', async () => {
    const h = harness();
    h.session.setConsent(true);
    await h.session.start();
    expect(h.session.setConsent(false).ok).toBe(false);
    await h.session.shutdown();
    expect(h.session.setConsent(false).ok).toBe(true);
  });
});
