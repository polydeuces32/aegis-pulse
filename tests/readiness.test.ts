import { describe, expect, it } from 'vitest';
import { BREATHING_WINDOW_SEC, computeReadiness, confidenceWords, stabilityWords } from '../src/renderer/state/readiness';
import type { Signal } from '../src/shared/ipc';

const sig = (stable: boolean, confidence = 90): Signal => ({ value: 70, confidence, stable, timestampUs: 1 });
const base = { hintLevel: null, runningSec: 5 } as const;

describe('computeReadiness', () => {
  it('is idle when not measuring, with no progress', () => {
    const r = computeReadiness({ ...base, phase: 'idle', pulse: null, breathing: null });
    expect(r.level).toBe('idle');
    expect(r.pulse.state).toBe('off');
    expect(r.pulse.windowProgress).toBe(0);
  });
  it('waits for real samples; never reports ready without them', () => {
    const r = computeReadiness({ ...base, phase: 'running', pulse: null, breathing: null });
    expect(r.pulse.state).toBe('waiting');
    expect(r.level).toBe('progress');
  });
  it('unstable samples are settling (preliminary), only stable becomes ready', () => {
    expect(computeReadiness({ ...base, phase: 'running', pulse: sig(false), breathing: null }).pulse.state).toBe('settling');
    expect(computeReadiness({ ...base, phase: 'running', pulse: sig(true), breathing: null }).pulse.state).toBe('ready');
  });
  it('pulse ready but breathing not: explains the 30-second window with a countdown', () => {
    const r = computeReadiness({ phase: 'running', pulse: sig(true), breathing: sig(false, 0), hintLevel: null, runningSec: 10 });
    expect(r.headline).toMatch(/Pulse is stable/);
    expect(r.detail).toMatch(/20 s/);
  });
  it('is ready only when BOTH are stable', () => {
    const r = computeReadiness({ ...base, phase: 'running', pulse: sig(true), breathing: sig(true) });
    expect(r.level).toBe('ready');
    expect(computeReadiness({ ...base, phase: 'running', pulse: sig(true), breathing: sig(false) }).level).not.toBe('ready');
  });
  it('a warning hint turns the state into attention, unless already ready', () => {
    expect(computeReadiness({ ...base, phase: 'running', pulse: null, breathing: null, hintLevel: 'warn' }).level).toBe('attention');
    expect(computeReadiness({ ...base, phase: 'running', pulse: sig(true), breathing: sig(true), hintLevel: 'warn' }).level).toBe('ready');
  });
  it('window progress is time-based and clamped', () => {
    const r = computeReadiness({ phase: 'running', pulse: null, breathing: null, hintLevel: null, runningSec: BREATHING_WINDOW_SEC * 3 });
    expect(r.breathing.windowProgress).toBe(1);
    expect(computeReadiness({ ...base, phase: 'running', pulse: null, breathing: null, runningSec: -4 }).breathing.windowProgress).toBe(0);
  });
});

describe('plain-language labels', () => {
  it('groups the SDK confidence score into bands', () => {
    expect(confidenceWords(95).band).toBe('high');
    expect(confidenceWords(70).band).toBe('high');
    expect(confidenceWords(69.9).band).toBe('medium');
    expect(confidenceWords(40).band).toBe('medium');
    expect(confidenceWords(33.6)).toEqual({ band: 'low', text: 'Low (34%)' });
  });
  it('stability words', () => {
    expect(stabilityWords(true)).toBe('Steady');
    expect(stabilityWords(false)).toBe('Still settling');
  });
});
