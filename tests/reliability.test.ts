import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessingStatus, SmartSpectraErrorCode } from '@smartspectra/node-sdk';
import { Secret } from '../src/main/keystore';
import { SdkSession, type SdkPort } from '../src/main/sdkSession';

const KEY = 'RELIABILITY-KEY-0123456789';
type Handler = (...a: never[]) => void;

function fakeSdk(startThrows?: unknown) {
  const handlers = new Map<string, Handler>();
  const calls: string[] = [];
  const sdk = {
    on(e: string, cb: Handler) { handlers.set(e, cb); return sdk; },
    useCustomInput() { return sdk; },
    start() { calls.push('start'); if (startThrows) throw startThrows; },
    async stopAsync() { calls.push('stopAsync'); },
    async destroy() { calls.push('destroy'); },
    sendFrame() { return true; },
  };
  return { sdk: sdk as unknown as SdkPort, handlers, calls };
}

function make(opts: { key?: string; startThrows?: unknown; startupTimeoutMs?: number } = {}) {
  const sdks: ReturnType<typeof fakeSdk>[] = [];
  let created = 0;
  const session = new SdkSession({
    createSdk: () => { created++; const f = fakeSdk(created === 1 ? opts.startThrows : undefined); sdks.push(f); return f.sdk; },
    decode: () => ({}), apiKey: new Secret(opts.key ?? KEY), emit: () => undefined, nowMs: () => Date.now(), rssBytes: () => 1,
    statsIntervalMs: 10_000, teardownTimeoutMs: 20, startupTimeoutMs: opts.startupTimeoutMs ?? 30_000,
  });
  return { session, sdks };
}

afterEach(() => { vi.useRealTimers(); });

describe('credentials', () => {
  it('a missing key never reaches the SDK and is reported as missing-key', async () => {
    const t = make({ key: '' });
    t.session.setConsent(true);
    const r = await t.session.start();
    expect(!r.ok && r.error.kind).toBe('missing-key');
    expect(t.sdks).toHaveLength(0);
  });
  it('an invalid key (SDK auth failure) is reported as authentication and the session can be retried', async () => {
    const t = make({ startThrows: Object.assign(new Error('x'), { code: SmartSpectraErrorCode.kAuthenticationFailed }) });
    t.session.setConsent(true);
    const first = await t.session.start();
    expect(!first.ok && first.error.kind).toBe('authentication');
    expect((await t.session.start()).ok).toBe(true); // second attempt uses a fresh SDK
    await t.session.shutdown();
  });
});

describe('consent, restart and cleanup', () => {
  it('Start is refused after consent is revoked and no SDK is created', async () => {
    const t = make();
    t.session.setConsent(true);
    t.session.setConsent(false);
    const r = await t.session.start();
    expect(!r.ok && r.error.kind).toBe('consent');
    expect(t.sdks).toHaveLength(0);
  });
  it('consent cannot be revoked mid-session', async () => {
    const t = make();
    t.session.setConsent(true);
    await t.session.start();
    expect(t.session.setConsent(false).ok).toBe(false);
    await t.session.shutdown();
  });
  it('Start/Stop/Start/Stop cycles tear down every SDK exactly once', async () => {
    const t = make();
    t.session.setConsent(true);
    for (let i = 0; i < 3; i++) {
      expect((await t.session.start()).ok).toBe(true);
      expect((await t.session.stop()).ok).toBe(true);
    }
    expect(t.sdks).toHaveLength(3);
    for (const s of t.sdks) expect(s.calls.filter((c) => c === 'destroy')).toHaveLength(1);
    expect(t.session.snapshot().phase).toBe('idle');
  });
  it('a network error mid-session ends the session, releases the SDK and allows restart', async () => {
    const t = make();
    t.session.setConsent(true);
    await t.session.start();
    (t.sdks[0]?.handlers.get('error') as unknown as (c: number, m: string, r: boolean) => void)(SmartSpectraErrorCode.kNetworkError, 'down', true);
    await vi.waitFor(() => expect(t.session.snapshot().phase).toBe('error'));
    expect(t.session.snapshot().error).toMatchObject({ kind: 'network', retryable: true });
    expect(t.sdks[0]?.calls).toContain('destroy');
    expect((await t.session.start()).ok).toBe(true);
    await t.session.shutdown();
  });
});

describe('SDK startup timeout', () => {
  it('fails a session stuck in STARTING with a retryable timeout error and cleans up', async () => {
    vi.useFakeTimers();
    const t = make({ startupTimeoutMs: 5000 });
    t.session.setConsent(true);
    await t.session.start();
    await vi.advanceTimersByTimeAsync(5100);
    expect(t.session.snapshot().phase).toBe('error');
    expect(t.session.snapshot().error).toMatchObject({ kind: 'timeout', retryable: true });
    expect(t.sdks[0]?.calls).toContain('destroy');
  });
  it('does not fire once the SDK reports RUNNING', async () => {
    vi.useFakeTimers();
    const t = make({ startupTimeoutMs: 5000 });
    t.session.setConsent(true);
    await t.session.start();
    (t.sdks[0]?.handlers.get('processingStatus') as unknown as (s: number) => void)(ProcessingStatus.kRunning);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(t.session.snapshot().phase).toBe('running');
    await t.session.shutdown();
  });
});
