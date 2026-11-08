import type { Phase, Signal } from '../../shared/ipc';
import type { HintLevel } from './quality';

/** Documented SDK averaging windows: pulse is a 12 s average, breathing a 30 s average. */
export const PULSE_WINDOW_SEC = 12;
export const BREATHING_WINDOW_SEC = 30;

export type StepState = 'off' | 'waiting' | 'settling' | 'ready';

export interface Step {
  state: StepState;
  label: string;
  /** 0..1 elapsed share of the SDK's documented averaging window. Time-based, not a measurement. */
  windowProgress: number;
}

export interface Readiness {
  level: 'idle' | 'progress' | 'attention' | 'ready';
  headline: string;
  detail: string;
  pulse: Step;
  breathing: Step;
}

export interface ReadinessInput {
  phase: Phase;
  pulse: Signal | null;
  breathing: Signal | null;
  hintLevel: HintLevel | null;
  runningSec: number;
}

function step(sig: Signal | null, active: boolean, windowSec: number, runningSec: number): Step {
  const progress = Math.max(0, Math.min(1, runningSec / windowSec));
  if (!active) return { state: 'off', label: 'Not measuring', windowProgress: 0 };
  if (!sig) return { state: 'waiting', label: 'Waiting for first SDK reading', windowProgress: progress };
  if (!sig.stable) return { state: 'settling', label: 'Settling \u2014 treat as preliminary', windowProgress: progress };
  return { state: 'ready', label: 'Ready \u2014 stable', windowProgress: 1 };
}

/** Derived only from real SDK stability flags and elapsed time. It never produces or alters a reading. */
export function computeReadiness(i: ReadinessInput): Readiness {
  const active = i.phase === 'starting' || i.phase === 'running';
  const pulse = step(i.pulse, active, PULSE_WINDOW_SEC, i.runningSec);
  const breathing = step(i.breathing, active, BREATHING_WINDOW_SEC, i.runningSec);

  if (!active) {
    return { level: 'idle', headline: 'Not measuring', detail: 'Start a session to begin. Camera and SDK are off.', pulse, breathing };
  }
  if (i.phase === 'starting') {
    return { level: 'progress', headline: 'Starting up', detail: 'Connecting to the SmartSpectra SDK\u2026', pulse, breathing };
  }
  if (pulse.state === 'ready' && breathing.state === 'ready') {
    return { level: 'ready', headline: 'Ready \u2014 pulse and breathing are stable', detail: 'Keep still and facing the camera for the best readings.', pulse, breathing };
  }
  if (i.hintLevel === 'warn') {
    return { level: 'attention', headline: 'Adjust your setup', detail: 'Follow the guidance on the camera, then stay still. Readings settle once conditions are good.', pulse, breathing };
  }
  if (pulse.state === 'ready') {
    const left = Math.max(0, Math.ceil(BREATHING_WINDOW_SEC - i.runningSec));
    return {
      level: 'progress',
      headline: 'Pulse is stable \u2014 breathing is still settling',
      detail: left > 0 ? `Breathing uses a 30-second window. About ${left} s more of staying still and quiet.` : 'Stay still and avoid talking while breathing settles.',
      pulse,
      breathing,
    };
  }
  return {
    level: 'progress',
    headline: 'Measuring \u2014 readings are settling',
    detail: 'Pulse uses a 12-second window and breathing a 30-second window. Sit still, face the camera, keep your face and chest in frame.',
    pulse,
    breathing,
  };
}

export type ConfidenceBand = 'low' | 'medium' | 'high';

/** Display grouping of the SDK's 0-100 confidence score (the bands are this app's wording, not an SDK rating). */
export function confidenceWords(confidence: number): { band: ConfidenceBand; text: string } {
  const band: ConfidenceBand = confidence >= 70 ? 'high' : confidence >= 40 ? 'medium' : 'low';
  const word = band === 'high' ? 'High' : band === 'medium' ? 'Medium' : 'Low';
  return { band, text: `${word} (${Math.round(confidence)}%)` };
}

export const stabilityWords = (stable: boolean): string => (stable ? 'Steady' : 'Still settling');
