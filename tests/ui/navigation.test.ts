import { describe, expect, it } from 'vitest';
import { VIEWS, moveFocusIndex, viewFromShortcut } from '../../src/renderer/state/navigation';
import { SessionTally, steadyPercent } from '../../src/renderer/state/sessionStats';

describe('navigation model', () => {
  it('defines the five required views once each', () => {
    expect(VIEWS.map((v) => v.id)).toEqual(['live', 'lab', 'sessions', 'diagnostics', 'settings']);
  });
  it('moveFocusIndex wraps and handles Home/End; ignores other keys', () => {
    expect(moveFocusIndex(0, 5, 'ArrowUp')).toBe(4);
    expect(moveFocusIndex(4, 5, 'ArrowDown')).toBe(0);
    expect(moveFocusIndex(2, 5, 'Home')).toBe(0);
    expect(moveFocusIndex(2, 5, 'End')).toBe(4);
    expect(moveFocusIndex(2, 5, 'a')).toBeNull();
    expect(moveFocusIndex(0, 0, 'ArrowDown')).toBeNull();
  });
  it('viewFromShortcut needs Alt only and a digit within range', () => {
    const e = { code: 'Digit2', altKey: true, ctrlKey: false, metaKey: false };
    expect(viewFromShortcut(e)).toBe('lab');
    expect(viewFromShortcut({ ...e, altKey: false })).toBeNull();
    expect(viewFromShortcut({ ...e, metaKey: true })).toBeNull();
    expect(viewFromShortcut({ ...e, code: 'Digit9' })).toBeNull();
    expect(viewFromShortcut({ ...e, code: 'KeyA' })).toBeNull();
  });
});

describe('SessionTally', () => {
  const s = (value: number, stable: boolean) => ({ value, confidence: 70, stable, timestampUs: 1 });
  it('counts only what the SDK reported, with no smoothing', () => {
    const t = new SessionTally();
    t.add('pulse', s(70, true)); t.add('pulse', s(80, false)); t.add('pulse', s(60, true));
    expect(t.pulse).toMatchObject({ samples: 3, steadySamples: 2, min: 60, max: 80, last: 60, lastStable: true });
    expect(steadyPercent(t.pulse)).toBe(67);
    expect(steadyPercent(t.breathing)).toBeNull();
    expect(t.breathing.min).toBeNull();
  });
  it('record() snapshots and reset() clears', () => {
    const t = new SessionTally();
    t.add('breathing', s(14, true));
    const r = t.record(1, 30, 9);
    t.reset();
    expect(r.breathing.samples).toBe(1);
    expect(t.breathing.samples).toBe(0);
  });
});
