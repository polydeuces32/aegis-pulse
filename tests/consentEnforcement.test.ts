import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Secret } from '../src/main/keystore';
import { allowCamera, allowCameraCheck, type MediaPolicyState } from '../src/main/permissions';
import { SdkSession, type SdkPort } from '../src/main/sdkSession';
import type { AegisEvent, Phase } from '../src/shared/ipc';

// ---- main-process IPC under a fake Electron ----
type Handler = (e: unknown, ...args: unknown[]) => unknown;
const handlers = new Map<string, Handler>();
vi.mock('electron', () => ({
  ipcMain: {
    handle: (ch: string, fn: Handler) => { handlers.set(ch, fn); },
    removeHandler: (ch: string) => { handlers.delete(ch); },
  },
}));
const { registerIpc } = await import('../src/main/ipc');
const { CH } = await import('../src/shared/ipc');

const APP_URL = 'file:///app/out/renderer/index.html';
const ALLOWED = [APP_URL];

function fakeSdk() {
  const calls: string[] = [];
  const sdk = {
    on() { return sdk; },
    useCustomInput() { calls.push('useCustomInput'); return sdk; },
    start() { calls.push('start'); },
    async stopAsync() { calls.push('stopAsync'); },
    async destroy() { calls.push('destroy'); },
    sendFrame() { return true; },
  };
  return { sdk: sdk as unknown as SdkPort, calls };
}

function makeSession() {
  const f = fakeSdk();
  let creates = 0;
  const lifecycle: Array<Record<string, unknown>> = [];
  const session = new SdkSession({
    createSdk: () => { creates++; return f.sdk; },
    decode: () => ({}),
    apiKey: new Secret('K') as never,
    emit: (_e: AegisEvent) => undefined,
    nowMs: () => 1,
    rssBytes: () => 0,
    statsIntervalMs: 60_000,
    teardownTimeoutMs: 10,
    lifecycle: (e: unknown) => lifecycle.push(e as Record<string, unknown>),
  } as never);
  return { session, creates: () => creates, sdkCalls: f.calls, lifecycle };
}

const call = async (ch: string, e: unknown, ...args: unknown[]) => (handlers.get(ch) as Handler)(e, ...args) as Promise<{ ok?: boolean; error?: { kind: string } }>;

// The trusted check compares frame identity, so build frames that really are the window's main frame.
function trustedWindow() {
  const mainFrame = { url: APP_URL };
  const webContents = { mainFrame };
  return {
    win: { webContents } as never,
    ev: { sender: webContents, senderFrame: mainFrame },
    evFromFrame: (frame: unknown) => ({ sender: webContents, senderFrame: frame }),
    evFromOther: (url = APP_URL) => ({ sender: { mainFrame: { url } }, senderFrame: { url } }),
  };
}

beforeEach(() => handlers.clear());

describe('fresh launch and restart', () => {
  it('a new process starts idle with consent NOT granted, and Start is refused', async () => {
    const a = makeSession();
    expect(a.session.snapshot()).toMatchObject({ phase: 'idle', consent: false });
    const r = await a.session.start();
    expect(r).toMatchObject({ ok: false, error: { kind: 'consent' } });
    expect(a.creates()).toBe(0);
    expect(a.sdkCalls).toEqual([]);
  });

  it('consent is not persisted: after a restart (new SdkSession) it is false again, even if the previous run granted it', async () => {
    const first = makeSession();
    first.session.setConsent(true);
    expect(first.session.hasConsent()).toBe(true);
    const second = makeSession(); // simulated relaunch
    expect(second.session.hasConsent()).toBe(false);
    expect((await second.session.start()).ok).toBe(false);
    expect(second.creates()).toBe(0);
  });

  it('granting consent alone never starts anything', async () => {
    const s = makeSession();
    s.session.setConsent(true);
    expect(s.session.snapshot().phase).toBe('idle');
    expect(s.creates()).toBe(0);
  });

  it('every consent change and refused start leaves an audit record in the lifecycle log', async () => {
    const s = makeSession();
    await s.session.start();
    s.session.setConsent(true);
    s.session.setConsent(false);
    const kinds = s.lifecycle.map((e) => `${e['event']}:${e['granted'] ?? e['reason']}`);
    expect(kinds).toEqual(['start-refused:consent', 'consent:true', 'consent:false']);
  });
});

describe('consent revocation', () => {
  it('Start is refused again after consent is revoked', async () => {
    const s = makeSession();
    s.session.setConsent(true);
    s.session.setConsent(false);
    expect(await s.session.start()).toMatchObject({ ok: false, error: { kind: 'consent' } });
    expect(s.creates()).toBe(0);
  });

  it('consent cannot be revoked mid-session, and a second Start does not create a second SDK', async () => {
    const s = makeSession();
    s.session.setConsent(true);
    expect((await s.session.start()).ok).toBe(true);
    expect(s.session.setConsent(false).ok).toBe(false);
    expect(s.session.hasConsent()).toBe(true);
    expect((await s.session.start()).ok).toBe(false);
    expect(s.creates()).toBe(1);
    await s.session.shutdown();
  });
});

describe('camera permission is enforced in the main process (consent AND an active Start)', () => {
  const req = { permission: 'media', mediaTypes: ['video'], url: APP_URL } as const;
  const st = (consent: boolean, phase: Phase): MediaPolicyState => ({ consent, phase, allowedUrls: ALLOWED });

  it('denies the camera on a fresh launch (no consent, idle)', () => {
    expect(allowCamera(req, st(false, 'idle'))).toBe(false);
    expect(allowCameraCheck('media', APP_URL, st(false, 'idle'))).toBe(false);
  });
  it('denies the camera with consent but no Start', () => {
    expect(allowCamera(req, st(true, 'idle'))).toBe(false);
    expect(allowCameraCheck('media', APP_URL, st(true, 'idle'))).toBe(false);
  });
  it('allows the camera only while a consented session is starting or running', () => {
    expect(allowCamera(req, st(true, 'starting'))).toBe(true);
    expect(allowCamera(req, st(true, 'running'))).toBe(true);
    expect(allowCameraCheck('media', APP_URL, st(true, 'running'))).toBe(true);
  });
  it('denies the camera again once stopping, stopped, errored or consent is revoked', () => {
    for (const p of ['stopping', 'idle', 'error'] as const) expect(allowCamera(req, st(true, p))).toBe(false);
    expect(allowCamera(req, st(false, 'running'))).toBe(false);
  });
  it('denies microphone, combined audio+video, other permissions and untrusted pages', () => {
    const on = st(true, 'running');
    expect(allowCamera({ ...req, mediaTypes: ['audio'] }, on)).toBe(false);
    expect(allowCamera({ ...req, mediaTypes: ['video', 'audio'] }, on)).toBe(false);
    expect(allowCamera({ ...req, mediaTypes: [] }, on)).toBe(false);
    expect(allowCamera({ ...req, permission: 'geolocation' }, on)).toBe(false);
    expect(allowCamera({ ...req, url: 'https://evil.example/' }, on)).toBe(false);
    expect(allowCamera({ ...req, url: 'file:///other/index.html' }, on)).toBe(false);
  });
});

describe('direct IPC invocation and multiple windows', () => {
  it('a trusted renderer calling start without consent is refused in main and starts nothing', async () => {
    const s = makeSession();
    const w = trustedWindow();
    registerIpc(w.win, s.session, {} as never, ALLOWED);
    expect(await call(CH.start, w.ev)).toMatchObject({ ok: false, error: { kind: 'consent' } });
    expect(s.creates()).toBe(0);
    expect(s.session.snapshot().phase).toBe('idle');
  });

  it('a second window / foreign sender cannot grant consent, start, stop or push frames', async () => {
    const s = makeSession();
    const w = trustedWindow();
    registerIpc(w.win, s.session, {} as never, ALLOWED);
    const other = w.evFromOther();
    expect(await call(CH.consent, other, true)).toMatchObject({ ok: false });
    expect(s.session.hasConsent()).toBe(false);
    s.session.setConsent(true); // consent granted by the real window's user
    expect(await call(CH.start, other)).toMatchObject({ ok: false });
    expect(s.creates()).toBe(0);
    expect(await call(CH.frame, other, {})).toMatchObject({ accepted: false });
    expect(s.session.snapshot().phase).toBe('idle');
  });

  it('a sub-frame, or a main frame at an unlisted URL, is rejected', async () => {
    const s = makeSession();
    const w = trustedWindow();
    registerIpc(w.win, s.session, {} as never, ALLOWED);
    expect(await call(CH.consent, w.evFromFrame({ url: APP_URL }), true)).toMatchObject({ ok: false }); // not the main frame object
    const bad = trustedWindow();
    handlers.clear();
    registerIpc(bad.win, s.session, {} as never, ALLOWED);
    (bad.ev.senderFrame as { url: string }).url = 'https://evil.example/';
    expect(await call(CH.consent, bad.ev, true)).toMatchObject({ ok: false });
    expect(s.session.hasConsent()).toBe(false);
  });

  it('malformed consent/start arguments are rejected', async () => {
    const s = makeSession();
    const w = trustedWindow();
    registerIpc(w.win, s.session, {} as never, ALLOWED);
    expect(await call(CH.consent, w.ev, 'yes')).toMatchObject({ ok: false });
    expect(await call(CH.consent, w.ev)).toMatchObject({ ok: false });
    expect(await call(CH.start, w.ev, { force: true })).toMatchObject({ ok: false });
    expect(s.session.hasConsent()).toBe(false);
  });

  it('with consent granted by the trusted window, Start works exactly once and a second call is refused', async () => {
    const s = makeSession();
    const w = trustedWindow();
    registerIpc(w.win, s.session, {} as never, ALLOWED);
    expect(await call(CH.consent, w.ev, true)).toMatchObject({ ok: true });
    expect(s.creates()).toBe(0); // consent alone starts nothing
    expect(await call(CH.start, w.ev)).toMatchObject({ ok: true });
    expect(await call(CH.start, w.ev)).toMatchObject({ ok: false });
    expect(s.creates()).toBe(1);
    await s.session.shutdown();
  });
});

describe('renderer ordering', () => {
  it('Start (which authorizes the camera in main) is requested before the camera is opened', () => {
    const hook = readFileSync(path.resolve(__dirname, '..', 'src/renderer/state/useObservatory.ts'), 'utf8');
    const startAt = hook.indexOf('await window.aegis.start()');
    const cameraAt = hook.indexOf('await openCamera()');
    expect(startAt).toBeGreaterThan(0);
    expect(cameraAt).toBeGreaterThan(startAt);
  });
});
