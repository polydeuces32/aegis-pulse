import type { Signal, TracePoint } from '../shared/ipc';

interface RawSample {
  value?: number | null;
  stable?: boolean | null;
  confidence?: number | null;
  timestamp?: number | { toString(): string } | null;
}

export interface DecodedMetricsLike {
  breathing?: { rate?: RawSample[] | null; upperTrace?: RawSample[] | null } | null;
  cardio?: { pulseRate?: RawSample[] | null; arterialPressureTrace?: RawSample[] | null } | null;
}

function toSignal(s: RawSample | undefined): Signal | null {
  if (!s || typeof s.value !== 'number' || !Number.isFinite(s.value)) return null;
  const ts = Number(s.timestamp ?? 0);
  const conf = typeof s.confidence === 'number' && Number.isFinite(s.confidence) ? s.confidence : 0;
  return {
    value: s.value,
    confidence: Math.min(100, Math.max(0, conf)),
    stable: s.stable === true,
    timestampUs: Number.isFinite(ts) ? ts : 0,
  };
}

/** Latest real SDK sample per metric from one decoded packet; null when the packet has none. Never synthesizes. */
export function extractSignals(m: DecodedMetricsLike): { pulse: Signal | null; breathing: Signal | null } {
  const pr = m.cardio?.pulseRate;
  const br = m.breathing?.rate;
  return {
    pulse: pr && pr.length > 0 ? toSignal(pr[pr.length - 1]) : null,
    breathing: br && br.length > 0 ? toSignal(br[br.length - 1]) : null,
  };
}

const MAX_TRACE_POINTS = 512;

function toTrace(samples: RawSample[] | null | undefined): TracePoint[] {
  if (!samples || samples.length === 0) return [];
  const out: TracePoint[] = [];
  for (const s of samples.slice(-MAX_TRACE_POINTS)) {
    const t = Number(s.timestamp ?? NaN);
    if (typeof s.value === 'number' && Number.isFinite(s.value) && Number.isFinite(t)) out.push({ t, v: s.value });
  }
  return out;
}

/**
 * Real waveform samples from one packet. pulseWave is the SDK's RELATIVE arterial waveform
 * (shape only; not blood pressure). breathWave is the SDK's upper-chest breathing trace.
 */
export function extractTraces(m: DecodedMetricsLike): { pulseWave: TracePoint[]; breathWave: TracePoint[] } {
  return { pulseWave: toTrace(m.cardio?.arterialPressureTrace), breathWave: toTrace(m.breathing?.upperTrace) };
}
