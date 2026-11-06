import { describe, expect, it } from 'vitest';
import { ProcessingStatus, SmartSpectraErrorCode } from '@smartspectra/node-sdk';
import { Secret } from '../src/main/keystore';
import { SdkSession, type LifecycleEvent, type SdkPort, type SessionSummary } from '../src/main/sdkSession';

const KEY = 'LIFECYCLE-SECRET-KEY-9999';
type Handler = (...a: never[]) => void;

function fakeSdk(opts: { startThrows?: unknown } = {}) {
  const handlers = new Map<string, Handler>();
  const calls: string[] = [];
  const sdk = {
    on(e: string, cb: Handler) { handlers.set(e, cb); return sdk; },
    useCustomInput() { return sdk; },
    start() { calls.push('start'); if (opts.startThrows) throw opts.startThrows; },
    async stopAsync() { calls.push('stopAsync'); },
    async destroy() { calls.push('destroy'); },
    sendFrame() { return true; },
  };
  return { sdk: sdk as unknown as SdkPort, handlers, calls };
}

function harness(opts: { startThrows?: unknown; throwingSinks?: boolean } = {}) {
  const f = fakeSdk(opts);
  const lifecycle: LifecycleEvent[] = [];
  const summaries: SessionSummary[] = [];
  let now = 1_000_000;
  let n = 0;
  const session = new SdkSession({
    createSdk: () => f.sdk,
    decode: (b) => JSON.parse(b.toString()),
    apiKey: new Secret(KEY),
    emit: () => undefined,
    nowMs: () => (now += 10),
    rssBytes: () => 1,
    statsIntervalMs: 10_000,
    teardownTimeoutMs: 20,
    newId: () => `session-${++n}`,
    lifecycle: (e) => { if (opts.throwingSinks) throw new Error('disk full'); lifecycle.push(e); },
    onSummary: (s) => { if (opts.throwingSinks) throw new Error('disk full'); summaries.push(s); },
  });
  session.setConsent(true);
  return { session, f, lifecycle, summaries };
}

const phases = (l: LifecycleEvent[]): string[] => l.filter((e) => e.event === 'phase').map((e) => (e as { phase: string }).phase);

describe('lifecycle logging', () => {
  it('normal Stop logs starting -> running -> stopping -> idle with one session id and one summary', async () => {
    const h = harness();
    await h.session.start();
    (h.f.handlers.get('processingStatus') as unknown as (s: number) => void)(ProcessingStatus.kRunning);
    const metrics = h.f.handlers.get('metrics') as unknown as (b: Buffer) => void;
    metrics(Buffer.from(JSON.stringify({ cardio: { pulseRate: [{ value: 71, confidence: 80, stable: true, timestamp: 5 }] }, breathing: { rate: [{ value: 14, confidence: 10, stable: false, timestamp: 6 }] } })));
    await h.session.stop();
    expect(phases(h.lifecycle)).toEqual(['starting', 'running', 'stopping', 'idle']);
    expect(new Set(h.lifecycle.filter((e) => e.event === 'phase').map((e) => e.sessionId))).toEqual(new Set(['session-1']));
    expect(h.summaries).toHaveLength(1);
    expect(h.summaries[0]).toMatchObject({ sessionId: 'session-1', endReason: 'stop', errorKind: null });
    expect(h.summaries[0]?.counts).toMatchObject({ metricPackets: 1, pulseSamples: 1, pulseStable: 1, breathingSamples: 1, breathingStable: 0 });
    expect(h.session.snapshot().phase).toBe('idle');
  });

  it('repeated Stop is idempotent: one summary, one idle, one destroy', async () => {
    const h = harness();
    await h.session.start();
    await h.session.stop();
    await h.session.stop();
    await h.session.stop();
    expect(h.summaries).toHaveLength(1);
    expect(phases(h.lifecycle).filter((p) => p === 'idle')).toHaveLength(1);
    expect(h.f.calls.filter((c) => c === 'destroy')).toHaveLength(1);
  });

  it('a second session gets a new id and its own summary', async () => {
    const h = harness();
    await h.session.start(); await h.session.stop();
    await h.session.start(); await h.session.stop();
    expect(h.summaries.map((s) => s.sessionId)).toEqual(['session-1', 'session-2']);
  });

  it('failing log sinks never block Stop or camera teardown', async () => {
    const h = harness({ throwingSinks: true });
    expect((await h.session.start()).ok).toBe(true);
    expect((await h.session.stop()).ok).toBe(true);
    expect(h.f.calls).toEqual(expect.arrayContaining(['stopAsync', 'destroy']));
    expect(h.session.snapshot().phase).toBe('idle');
  });

  it('a failed start (auth) still logs ERROR and writes a summary', async () => {
    const h = harness({ startThrows: Object.assign(new Error(`bad ${KEY}`), { code: SmartSpectraErrorCode.kAuthenticationFailed }) });
    const r = await h.session.start();
    expect(r.ok).toBe(false);
    expect(phases(h.lifecycle)).toEqual(['starting', 'error']);
    expect(h.summaries).toHaveLength(1);
    expect(h.summaries[0]).toMatchObject({ endReason: 'error', errorKind: 'authentication' });
  });

  it('SDK error during a run logs STOPPING then ERROR with an error summary', async () => {
    const h = harness();
    await h.session.start();
    (h.f.handlers.get('error') as unknown as (c: number, m: string, r: boolean) => void)(SmartSpectraErrorCode.kNetworkError, KEY, true);
    await new Promise((r) => setTimeout(r, 50));
    expect(phases(h.lifecycle)).toEqual(['starting', 'stopping', 'error']);
    expect(h.summaries[0]).toMatchObject({ endReason: 'error', errorKind: 'network' });
  });

  it('shutdown while running ends with reason "shutdown"', async () => {
    const h = harness();
    await h.session.start();
    await h.session.shutdown();
    expect(h.summaries[0]?.endReason).toBe('shutdown');
    expect(phases(h.lifecycle).at(-1)).toBe('idle');
  });

  it('lifecycle events and summaries never contain the key or physiological values', async () => {
    const h = harness();
    await h.session.start();
    (h.f.handlers.get('metrics') as unknown as (b: Buffer) => void)(Buffer.from(JSON.stringify({ cardio: { pulseRate: [{ value: 71.123, confidence: 88.5, stable: true, timestamp: 1 }] } })));
    await h.session.stop();
    const text = JSON.stringify([h.lifecycle, h.summaries]);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain('71.123');
    expect(text).not.toContain('88.5');
    expect(text).not.toMatch(/"(value|confidence|buffer|apiKey)"/);
  });
});
