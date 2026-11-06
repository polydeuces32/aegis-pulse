import type { Phase, Signal } from '../../shared/ipc';

export type HintLevel = 'ok' | 'info' | 'warn';

export interface Hint {
  level: HintLevel;
  title: string;
  action: string;
}

/**
 * Setup/measurement-quality guidance keyed by the documented SDK ValidationCode names.
 * These describe camera, framing and lighting only. They are not health advice.
 */
const HINTS: Record<string, Hint> = {
  kOk: { level: 'ok', title: 'Good signal conditions', action: 'Stay still and keep your face in frame.' },
  kNoFaceFound: { level: 'warn', title: 'No face found', action: 'Face the camera and keep your whole face in frame.' },
  kMultipleFacesFound: { level: 'warn', title: 'More than one face', action: 'Measure one person at a time.' },
  kFaceNotCentered: { level: 'warn', title: 'Face off-center', action: 'Move so your face is in the middle of the frame.' },
  kFaceSizeOutOfRange: { level: 'warn', title: 'Face size out of range', action: 'Adjust your distance from the camera.' },
  kFaceTooClose: { level: 'warn', title: 'Too close', action: 'Move a little farther from the camera.' },
  kFaceTooFar: { level: 'warn', title: 'Too far', action: 'Move a little closer to the camera.' },
  kFaceTooHigh: { level: 'warn', title: 'Face too high in frame', action: 'Lower your head or tilt the screen so your face is centered.' },
  kFaceTooLow: { level: 'warn', title: 'Face too low in frame', action: 'Raise your head or tilt the screen so your face is centered.' },
  kFaceNotForward: { level: 'warn', title: 'Face turned away', action: 'Look toward the camera.' },
  kTooDark: { level: 'warn', title: 'Too dark', action: 'Add soft, even light facing you.' },
  kTooBright: { level: 'warn', title: 'Too bright', action: 'Reduce glare or strong light on your face.' },
  kChestNotVisible: { level: 'info', title: 'Upper chest not visible', action: 'Sit back so your shoulders and chest are in frame.' },
  kCameraTuning: { level: 'info', title: 'Camera adjusting', action: 'Hold still for a moment while exposure settles.' },
  kFrameRateTooLow: { level: 'warn', title: 'Low camera frame rate', action: 'Improve lighting and close other apps using the camera.' },
  kExcessiveMotion: { level: 'warn', title: 'Too much movement', action: 'Sit still, and avoid talking, while measuring.' },
};

export function hintFor(name: string, sdkHint: string): Hint {
  const known = HINTS[name];
  if (known) return known;
  return { level: 'info', title: sdkHint || `Signal check (${name})`, action: 'Keep your face in frame, well lit, and still.' };
}

export type ReadingKind = 'idle' | 'measuring' | 'preliminary' | 'stable' | 'lost' | 'ended';

export interface ReadingStatus {
  kind: ReadingKind;
  label: string;
  showValue: boolean;
  /** True when the last SDK sample of an ended session was not yet stable; must stay visibly flagged. */
  unstableAtEnd?: boolean;
}

/** A sample older than this (renderer receive-time) is treated as lost rather than current. */
export const SIGNAL_LOST_MS = 20_000;

/** Honest state for one reading. Never turns "no data" into a number. */
export function readingStatus(sig: Signal | null, phase: Phase, sinceSampleMs: number | null): ReadingStatus {
  const active = phase === 'starting' || phase === 'running';
  if (!sig) {
    return active
      ? { kind: 'measuring', label: 'Measuring \u2014 waiting for the first SDK sample', showValue: false }
      : { kind: 'idle', label: phase === 'error' ? 'Unavailable' : 'Not measuring', showValue: false };
  }
  if (active && sinceSampleMs !== null && sinceSampleMs > SIGNAL_LOST_MS) {
    return { kind: 'lost', label: 'Signal lost \u2014 last SDK value shown', showValue: true };
  }
  if (!active) {
    return sig.stable
      ? { kind: 'ended', label: 'Session ended \u2014 last SDK value', showValue: true }
      : { kind: 'ended', label: 'Session ended \u2014 last SDK value was NOT yet stable', showValue: true, unstableAtEnd: true };
  }
  if (!sig.stable) return { kind: 'preliminary', label: 'Preliminary \u2014 not yet stable', showValue: true };
  return { kind: 'stable', label: 'Stable', showValue: true };
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
