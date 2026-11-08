import { vi } from 'vitest';
import { Series } from '../../src/renderer/state/series';
import { SessionTally } from '../../src/renderer/state/sessionStats';
import type { Phase, Signal } from '../../src/shared/ipc';
import type { Observatory } from '../../src/renderer/state/useObservatory';

export const sig = (value: number, confidence = 80, stable = true, timestampUs = 1): Signal => ({ value, confidence, stable, timestampUs });

/** A stand-in for the single session controller. Every action is a spy so tests can prove views never call them. */
export function makeObservatory(over: Partial<Observatory> & { phase?: Phase } = {}): Observatory {
  const tally = new SessionTally();
  tally.add('pulse', sig(72, 85, true));
  tally.add('pulse', sig(75, 80, false));
  tally.add('breathing', sig(15, 60, true));
  const video = document.createElement('video');
  const o = {
    phase: 'running' as Phase,
    consent: true,
    pulse: sig(72),
    breathing: sig(15, 60),
    packets: 42,
    validation: null,
    error: null,
    cameraError: null,
    mainStats: null,
    capStats: null,
    busy: false,
    series: {
      pulseWave: new Series(100, 30e6), breathWave: new Series(100, 30e6),
      pulseHist: new Series(100, 180e6), breathHist: new Series(100, 180e6),
      pulseConf: new Series(100, 180e6), breathConf: new Series(100, 180e6),
    },
    videoRef: { current: video },
    sinceMs: () => 500,
    sessionSec: 33,
    grantConsent: vi.fn(async () => undefined),
    revokeConsent: vi.fn(async () => undefined),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    cred: { source: 'keychain', canStore: true },
    credMessage: null, credNotice: null, credBusy: false,
    importKey: vi.fn(async () => undefined), enterKeyNative: vi.fn(async () => undefined),
    saveTypedKey: vi.fn(async () => undefined), removeKey: vi.fn(async () => undefined),
    tally, history: [], clearHistory: vi.fn(),
    ...over,
  };
  return o as unknown as Observatory;
}
