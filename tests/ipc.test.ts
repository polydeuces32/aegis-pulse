import { describe, expect, it } from 'vitest';
import { LIMITS, isTrustedUrl, validateConsentArg, validateFrame, validateNoArgs } from '../src/shared/ipc';

const frame = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  buffer: new ArrayBuffer(640 * 480 * 4),
  width: 640,
  height: 480,
  stride: 640 * 4,
  timestampUs: 1_000_000,
  sentAtEpochMs: 1_000,
  ...over,
});

describe('validateFrame', () => {
  it('accepts a well-formed frame', () => expect(validateFrame(frame(), 1_000).ok).toBe(true));
  it.each([
    ['non-object', null],
    ['array', []],
    ['string', 'x'],
  ])('rejects %s', (_n, v) => expect(validateFrame(v, 0).ok).toBe(false));
  it('rejects wrong buffer type', () => {
    expect(validateFrame(frame({ buffer: new Uint8Array(640 * 480 * 4) }), 1_000).ok).toBe(false);
    expect(validateFrame(frame({ buffer: 'abc' }), 1_000).ok).toBe(false);
  });
  it('rejects bad dimensions', () => {
    for (const w of [0, 63, LIMITS.maxWidth + 1, 640.5, NaN, '640'])
      expect(validateFrame(frame({ width: w }), 1_000).ok).toBe(false);
    expect(validateFrame(frame({ height: LIMITS.maxHeight + 1 }), 1_000).ok).toBe(false);
  });
  it('rejects stride / byte length mismatch', () => {
    expect(validateFrame(frame({ stride: 640 * 3 }), 1_000).ok).toBe(false);
    expect(validateFrame(frame({ buffer: new ArrayBuffer(10) }), 1_000).ok).toBe(false);
  });
  it('rejects oversize buffers', () => {
    const w = LIMITS.maxWidth, h = LIMITS.maxHeight;
    expect(validateFrame(frame({ width: w, height: h, stride: w * 4, buffer: new ArrayBuffer(w * h * 4) }), 1_000).ok).toBe(true);
    expect(validateFrame(frame({ width: w, height: h, stride: w * 4, buffer: new ArrayBuffer(w * h * 4 + 4) }), 1_000).ok).toBe(false);
  });
  it('rejects bad timestamps', () => {
    for (const t of [-1, 1.5, NaN, Infinity, '1', Number.MAX_SAFE_INTEGER + 2])
      expect(validateFrame(frame({ timestampUs: t }), 1_000).ok).toBe(false);
  });
  it('rejects far-future sentAt but tolerates small skew', () => {
    expect(validateFrame(frame({ sentAtEpochMs: 1_000 + LIMITS.maxClockSkewMs + 1 }), 1_000).ok).toBe(false);
    expect(validateFrame(frame({ sentAtEpochMs: 1_500 }), 1_000).ok).toBe(true);
  });
  it('strips unknown extra properties', () => {
    const r = validateFrame(frame({ apiKey: 'leak', evil: 1 }), 1_000);
    expect(r.ok && Object.keys(r.frame).sort()).toEqual(['buffer', 'height', 'sentAtEpochMs', 'stride', 'timestampUs', 'width']);
  });
});

describe('small validators', () => {
  it('consent arg must be boolean', () => {
    expect(validateConsentArg(true)).toBe(true);
    expect(validateConsentArg(false)).toBe(false);
    for (const v of ['true', 1, null, undefined, {}]) expect(validateConsentArg(v)).toBeNull();
  });
  it('no-args', () => {
    expect(validateNoArgs([])).toBe(true);
    expect(validateNoArgs([1])).toBe(false);
  });
  it('trusted urls', () => {
    const allowed = ['file:///app/out/renderer/index.html'];
    expect(isTrustedUrl('file:///app/out/renderer/index.html#x', allowed)).toBe(true);
    expect(isTrustedUrl('file:///app/out/renderer/other.html', allowed)).toBe(false);
    expect(isTrustedUrl('https://evil.example/', allowed)).toBe(false);
    expect(isTrustedUrl('not a url', allowed)).toBe(false);
    expect(isTrustedUrl('http://localhost:5173/', ['http://localhost:5173/'])).toBe(true);
    expect(isTrustedUrl('http://localhost:5174/', ['http://localhost:5173/'])).toBe(false);
  });
});
