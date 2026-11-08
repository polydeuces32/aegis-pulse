import type { Signal } from '../../shared/ipc';

export interface ChannelTally {
  samples: number;
  steadySamples: number;
  min: number | null;
  max: number | null;
  last: number | null;
  lastConfidence: number | null;
  lastStable: boolean | null;
}

export interface SessionRecord {
  id: number;
  durationSec: number;
  metricPackets: number;
  pulse: ChannelTally;
  breathing: ChannelTally;
}

const empty = (): ChannelTally => ({ samples: 0, steadySamples: 0, min: null, max: null, last: null, lastConfidence: null, lastStable: null });

/**
 * Counts and ranges of the values the SDK actually reported during ONE session. Nothing is averaged, smoothed or
 * inferred, and it holds no waveform data. It lives in renderer memory only and is reset when a session starts.
 */
export class SessionTally {
  pulse: ChannelTally = empty();
  breathing: ChannelTally = empty();

  reset(): void {
    this.pulse = empty();
    this.breathing = empty();
  }

  add(channel: 'pulse' | 'breathing', s: Signal): void {
    const t = this[channel];
    t.samples++;
    if (s.stable) t.steadySamples++;
    t.min = t.min === null ? s.value : Math.min(t.min, s.value);
    t.max = t.max === null ? s.value : Math.max(t.max, s.value);
    t.last = s.value;
    t.lastConfidence = s.confidence;
    t.lastStable = s.stable;
  }

  record(id: number, durationSec: number, metricPackets: number): SessionRecord {
    return { id, durationSec, metricPackets, pulse: { ...this.pulse }, breathing: { ...this.breathing } };
  }
}

/** Share of reported samples the SDK flagged steady, as a whole percent; null when there are no samples. */
export const steadyPercent = (t: ChannelTally): number | null => (t.samples === 0 ? null : Math.round((t.steadySamples / t.samples) * 100));
