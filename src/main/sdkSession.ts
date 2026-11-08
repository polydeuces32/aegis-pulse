import { randomUUID } from 'node:crypto';
import {
  FrameTransform,
  PixelFormat,
  ProcessingStatus,
  SmartSpectraErrorCode,
  SmartSpectraLogLevel,
  ValidationCode,
  breathingMetrics,
  cardioMetrics,
  type SmartSpectraOptions,
  type SmartSpectraSDK,
} from '@smartspectra/node-sdk';
import {
  LIMITS,
  type AegisError,
  type AegisEvent,
  type ErrorKind,
  type FrameAck,
  type FramePayload,
  type MainStats,
  type Phase,
  type Result,
  type Signal,
  type Snapshot,
} from '../shared/ipc';
import { LatencyWindow, RateWindow } from '../shared/stats';
import { TimestampAnchor } from '../shared/timestamp';
import type { Secret } from './keystore';
import { extractSignals, extractTraces, type DecodedMetricsLike } from './metrics';

/** Exactly the SDK surface this app uses (real types, so signature drift fails typecheck). */
export type SdkPort = Pick<
  SmartSpectraSDK,
  'on' | 'useCustomInput' | 'start' | 'stopAsync' | 'destroy' | 'sendFrame'
>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type EndReason = 'stop' | 'error' | 'shutdown';

/** Aggregate, value-free record of one session. Contains no physiological readings, frames or secrets. */
export interface SessionSummary {
  sessionId: string;
  startedAtEpochMs: number;
  endedAtEpochMs: number;
  durationSec: number;
  endReason: EndReason;
  errorKind: ErrorKind | null;
  stats: MainStats;
  counts: {
    metricPackets: number;
    pulseSamples: number;
    pulseStable: number;
    breathingSamples: number;
    breathingStable: number;
    pulseWavePoints: number;
    breathWavePoints: number;
  };
}

/** Lifecycle log events: timestamps, state transitions, rates, latencies and counts only. */
export type LifecycleEvent =
  | { ts: number; sessionId: string; event: 'consent'; granted: boolean }
  | { ts: number; sessionId: string; event: 'start-refused'; reason: 'consent' | 'state' | 'missing-key' }
  | { ts: number; sessionId: string; event: 'phase'; phase: Phase; errorKind: ErrorKind | null }
  | {
      ts: number;
      sessionId: string;
      event: 'stats';
      acceptedFps: number;
      transitP95Ms: number;
      sendFrameP95Ms: number;
      framesReceived: number;
      framesAccepted: number;
      droppedInvalid: number;
      droppedStale: number;
      droppedNotRunning: number;
      sdkRejected: number;
      rssMb: number;
    }
  | { ts: number; sessionId: string; event: 'teardown-timeout'; step: string }
  | { ts: number; sessionId: string; event: 'app'; what: 'ready' | 'quit' };

export interface SessionDeps {
  createSdk: (options: SmartSpectraOptions) => SdkPort;
  decode: (buf: Buffer) => DecodedMetricsLike;
  apiKey: Pick<Secret, 'present' | 'reveal' | 'redact'>;
  emit: (e: AegisEvent) => void;
  nowMs: () => number;
  rssBytes: () => number;
  onSummary?: (s: SessionSummary) => void;
  lifecycle?: (e: LifecycleEvent) => void;
  newId?: () => string;
  statsIntervalMs?: number;
  /** Max time to wait for each native stop/destroy before moving on (native stop can block). */
  teardownTimeoutMs?: number;
  /** Fail a session stuck in STARTING (no SDK 'running' status) after this long. Default 30 s. */
  startupTimeoutMs?: number;
}

const VALIDATION_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(ValidationCode).map(([k, v]) => [v, k]),
);

const ERROR_MAP: Record<number, { kind: ErrorKind; text: string }> = {
  [SmartSpectraErrorCode.kAuthenticationFailed]: { kind: 'authentication', text: 'Authentication failed. Check the API key.' },
  [SmartSpectraErrorCode.kCreditExhausted]: { kind: 'quota', text: 'SmartSpectra usage quota exhausted.' },
  [SmartSpectraErrorCode.kNetworkError]: { kind: 'network', text: 'Network error. SmartSpectra must reach its server to validate the key.' },
  [SmartSpectraErrorCode.kServerError]: { kind: 'server', text: 'SmartSpectra server error.' },
  [SmartSpectraErrorCode.kInputUnavailable]: { kind: 'input', text: 'Input unavailable.' },
  [SmartSpectraErrorCode.kProcessingFailed]: { kind: 'processing', text: 'SDK processing failed.' },
  [SmartSpectraErrorCode.kFrameConversionFailed]: { kind: 'processing', text: 'Frame conversion failed.' },
  [SmartSpectraErrorCode.kNonMonotonicTimestamp]: { kind: 'timing', text: 'Frame timestamps were not increasing.' },
  [SmartSpectraErrorCode.kTimestampGap]: { kind: 'timing', text: 'Gap in frame timestamps.' },
  [SmartSpectraErrorCode.kInvalidState]: { kind: 'state', text: 'SDK was in an invalid state.' },
  [SmartSpectraErrorCode.kConfigurationFailed]: { kind: 'processing', text: 'SDK configuration failed.' },
};

const RETRYABLE: ReadonlySet<ErrorKind> = new Set<ErrorKind>(['network', 'server', 'timing', 'processing', 'timeout']);

export class SdkSession {
  private phase: Phase = 'idle';
  private sdk: SdkPort | null = null;
  private consent = false;
  private lastError: AegisError | null = null;
  private pulse: Signal | null = null;
  private breathing: Signal | null = null;
  private metricPackets = 0;
  private pulseWavePoints = 0;
  private breathWavePoints = 0;
  private anchor = new TimestampAnchor();
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private sessionId = '-';
  private statsTicks = 0;
  private stopReason: EndReason = 'stop';
  private seen = { pulseTs: -1, breathingTs: -1, pulse: 0, pulseStable: 0, breathing: 0, breathingStable: 0 };
  private counters = this.freshCounters();
  private fps = new RateWindow(5000);
  private transit = new LatencyWindow();
  private sendMs = new LatencyWindow();
  private teardown: Promise<void> = Promise.resolve();

  constructor(private readonly deps: SessionDeps) {}

  private freshCounters() {
    return { received: 0, accepted: 0, invalid: 0, stale: 0, notRunning: 0, sdkRejected: 0 };
  }

  snapshot(): Snapshot {
    return {
      phase: this.phase,
      consent: this.consent,
      pulse: this.pulse,
      breathing: this.breathing,
      metricPackets: this.metricPackets,
      error: this.lastError,
    };
  }

  setConsent(granted: boolean): Result {
    if (!granted && this.phase !== 'idle' && this.phase !== 'error') {
      return { ok: false, error: this.err('state', 'Stop the measurement before revoking consent.', false) };
    }
    this.consent = granted;
    this.emitLifecycle({ event: 'consent', granted }); // audit trail: who/when consent changed, in the main process
    return { ok: true };
  }

  hasConsent(): boolean {
    return this.consent;
  }

  async start(): Promise<Result> {
    if (!this.consent) {
      this.emitLifecycle({ event: 'start-refused', reason: 'consent' });
      return { ok: false, error: this.err('consent', 'Camera consent has not been granted.', false) };
    }
    if (this.phase !== 'idle' && this.phase !== 'error') {
      this.emitLifecycle({ event: 'start-refused', reason: 'state' });
      return { ok: false, error: this.err('state', `Cannot start while ${this.phase}.`, false) };
    }
    if (!this.deps.apiKey.present) {
      return this.fail(this.err('missing-key', 'SMARTSPECTRA_API_KEY is not configured in the main process.', false));
    }
    await this.teardown; // native SDK state is process-global; wait for any prior teardown
    this.resetRun();
    this.sessionId = (this.deps.newId ?? randomUUID)();
    this.startedAt = this.deps.nowMs();
    this.setPhase('starting', null);
    let sdk: SdkPort;
    try {
      sdk = this.deps.createSdk({
        apiKey: this.deps.apiKey.reveal(),
        requestedMetrics: [...breathingMetrics, ...cardioMetrics],
        enableAccumulatedOutput: false,
        enableTelemetry: false, // explicit opt-out
        logLevel: SmartSpectraLogLevel.kWarning,
      });
      this.sdk = sdk;
      this.wire(sdk);
      sdk.useCustomInput(FrameTransform.kNone);
      sdk.start();
    } catch (e) {
      const err = this.mapThrown(e);
      this.lastError = err;
      this.summarize('error');
      await this.retire();
      return this.fail(err);
    }
    this.statsTimer = setInterval(() => this.tick(), this.deps.statsIntervalMs ?? 1000);
    this.startupTimer = setTimeout(() => {
      if (this.phase === 'starting') {
        void this.failRunning(this.err('timeout', 'SmartSpectra did not start measuring within 30 seconds. With SDK 3.4.0 this is how a rejected (invalid or expired) API key usually appears, and it can also mean the service is unreachable. Check your network, or replace the API key, then try again.', true));
      }
    }, this.deps.startupTimeoutMs ?? 30_000);
    return { ok: true };
  }

  async stop(): Promise<Result> {
    if (this.phase === 'idle') return { ok: true };
    if (this.phase === 'stopping') {
      await this.teardown;
      return { ok: true };
    }
    const fromError = this.phase === 'error';
    if (!fromError) {
      this.setPhase('stopping', null);
      this.summarize(this.stopReason); // collect before teardown: must not depend on the native stop returning
    }
    await this.retire();
    this.lastError = null;
    this.setPhase('idle', null);
    return { ok: true };
  }

  /** Called by the IPC layer with an already schema-validated frame. */
  handleFrame(frame: FramePayload): FrameAck {
    this.counters.received++;
    const now = this.deps.nowMs();
    if (!this.sdk || (this.phase !== 'starting' && this.phase !== 'running')) {
      this.counters.notRunning++;
      return { accepted: false, reason: 'not-running' };
    }
    const transit = now - frame.sentAtEpochMs;
    this.transit.add(Math.max(0, transit));
    if (transit > LIMITS.staleMs) {
      this.counters.stale++;
      return { accepted: false, reason: 'stale' };
    }
    const ts = this.anchor.next(frame.timestampUs, now);
    const t0 = this.deps.nowMs();
    try {
      const ok = this.sdk.sendFrame(Buffer.from(frame.buffer), frame.width, frame.height, frame.stride, PixelFormat.kRGBA, ts);
      this.sendMs.add(this.deps.nowMs() - t0);
      if (!ok) {
        this.counters.sdkRejected++;
        return { accepted: false, reason: 'sdk-rejected' };
      }
    } catch {
      this.counters.sdkRejected++;
      return { accepted: false, reason: 'sdk-rejected' };
    }
    this.counters.accepted++;
    this.fps.mark(now);
    return { accepted: true };
  }

  async shutdown(): Promise<void> {
    this.stopReason = 'shutdown';
    if (this.phase !== 'idle') await this.stop();
    await this.teardown;
  }

  // ---------------- internals ----------------

  private wire(sdk: SdkPort): void {
    sdk.on('processingStatus', (status) => {
      if (status === ProcessingStatus.kRunning && this.phase === 'starting') {
        if (this.startupTimer) clearTimeout(this.startupTimer);
        this.startupTimer = null;
        this.setPhase('running', null);
      }
    });
    sdk.on('validationStatus', (code, _ts, hint) => {
      this.deps.emit({ type: 'validation', code, name: VALIDATION_NAMES[code] ?? `Code${code}`, hint: String(hint ?? '') });
    });
    sdk.on('metrics', (buf) => this.onMetrics(buf));
    sdk.on('error', (code, message) => {
      const mapped = ERROR_MAP[code];
      void this.failRunning(
        this.err(mapped?.kind ?? 'unknown', this.deps.apiKey.redact(mapped?.text ?? message), RETRYABLE.has(mapped?.kind ?? 'unknown')),
      );
    });
  }

  private onMetrics(buf: Buffer): void {
    let decoded: DecodedMetricsLike;
    try {
      decoded = this.deps.decode(buf);
    } catch {
      return; // undecodable packet: ignore, never invent a value
    }
    this.metricPackets++;
    const { pulse, breathing } = extractSignals(decoded);
    if (pulse) {
      this.pulse = pulse;
      if (pulse.timestampUs !== this.seen.pulseTs) {
        this.seen.pulseTs = pulse.timestampUs;
        this.seen.pulse++;
        if (pulse.stable) this.seen.pulseStable++;
      }
    }
    if (breathing) {
      this.breathing = breathing;
      if (breathing.timestampUs !== this.seen.breathingTs) {
        this.seen.breathingTs = breathing.timestampUs;
        this.seen.breathing++;
        if (breathing.stable) this.seen.breathingStable++;
      }
    }
    this.deps.emit({ type: 'signals', pulse: this.pulse, breathing: this.breathing, metricPackets: this.metricPackets });
    const { pulseWave, breathWave } = extractTraces(decoded);
    if (pulseWave.length > 0 || breathWave.length > 0) {
      this.pulseWavePoints += pulseWave.length;
      this.breathWavePoints += breathWave.length;
      this.deps.emit({ type: 'traces', pulseWave, breathWave });
    }
  }

  private tick(): void {
    const stats = this.mainStats();
    this.deps.emit({ type: 'stats', main: stats });
    if (++this.statsTicks % 10 === 0) {
      this.emitLifecycle({
        event: 'stats', acceptedFps: stats.acceptedFps, transitP95Ms: stats.transitMs.p95, sendFrameP95Ms: stats.sendFrameMs.p95,
        framesReceived: stats.framesReceived, framesAccepted: stats.framesAccepted, droppedInvalid: stats.droppedInvalid,
        droppedStale: stats.droppedStale, droppedNotRunning: stats.droppedNotRunning, sdkRejected: stats.sdkRejected, rssMb: stats.rssMb,
      });
    }
    if (this.deps.rssBytes() > LIMITS.maxRssBytes) {
      void this.failRunning(this.err('memory-limit', 'Memory limit exceeded; measurement stopped.', false));
    }
  }

  mainStats(): MainStats {
    return {
      framesReceived: this.counters.received,
      framesAccepted: this.counters.accepted,
      droppedInvalid: this.counters.invalid,
      droppedStale: this.counters.stale,
      droppedNotRunning: this.counters.notRunning,
      sdkRejected: this.counters.sdkRejected,
      acceptedFps: Math.round(this.fps.rate(this.deps.nowMs()) * 10) / 10,
      transitMs: this.transit.summary(),
      sendFrameMs: this.sendMs.summary(),
      rssMb: Math.round(this.deps.rssBytes() / 1048576),
      metricPackets: this.metricPackets,
      pulseWavePoints: this.pulseWavePoints,
      breathWavePoints: this.breathWavePoints,
    };
  }

  noteInvalid(): void {
    this.counters.received++;
    this.counters.invalid++;
  }

  private async failRunning(error: AegisError): Promise<void> {
    if (this.phase === 'idle' || this.phase === 'stopping' || this.phase === 'error') return;
    this.lastError = error;
    this.setPhase('stopping', error);
    this.summarize('error');
    await this.retire();
    this.setPhase('error', error);
  }

  private fail(error: AegisError): Result {
    this.lastError = error;
    this.setPhase('error', error);
    return { ok: false, error };
  }

  /** Stop + destroy the SDK; serializes teardown so the next start waits for it. */
  private retire(): Promise<void> {
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.statsTimer = null;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
    const sdk = this.sdk;
    this.sdk = null;
    if (!sdk) return this.teardown;
    this.teardown = this.teardown.then(async () => {
      const limit = this.deps.teardownTimeoutMs ?? 5000;
      const bounded = async (label: string, p: Promise<void>): Promise<void> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            this.emitLifecycle({ event: 'teardown-timeout', step: label });
            resolve();
          }, limit);
        });
        try { await Promise.race([p, timeout]); } catch { /* already stopped / idempotent */ } finally { clearTimeout(timer); }
      };
      await bounded('stopAsync', sdk.stopAsync());
      await bounded('destroy', sdk.destroy());
    });
    return this.teardown;
  }

  private summarize(reason: EndReason): void {
    if (this.startedAt === 0) return;
    const startedAt = this.startedAt;
    this.startedAt = 0;
    const endedAt = this.deps.nowMs();
    const summary: SessionSummary = {
      sessionId: this.sessionId,
      startedAtEpochMs: startedAt,
      endedAtEpochMs: endedAt,
      durationSec: Math.round((endedAt - startedAt) / 100) / 10,
      endReason: reason,
      errorKind: this.lastError?.kind ?? null,
      stats: this.mainStats(),
      counts: {
        metricPackets: this.metricPackets,
        pulseSamples: this.seen.pulse,
        pulseStable: this.seen.pulseStable,
        breathingSamples: this.seen.breathing,
        breathingStable: this.seen.breathingStable,
        pulseWavePoints: this.pulseWavePoints,
        breathWavePoints: this.breathWavePoints,
      },
    };
    this.safe(() => this.deps.onSummary?.(summary)); // logging must never block shutdown
  }

  /** Lifecycle logging is best-effort and can never throw into the session logic. */
  private emitLifecycle(e: DistributiveOmit<LifecycleEvent, 'ts' | 'sessionId'>): void {
    this.safe(() => this.deps.lifecycle?.({ ts: this.deps.nowMs(), sessionId: this.sessionId, ...e } as LifecycleEvent));
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch {
      /* swallowed on purpose */
    }
  }

  private resetRun(): void {
    this.lastError = null;
    this.pulse = null;
    this.breathing = null;
    this.metricPackets = 0;
    this.pulseWavePoints = 0;
    this.breathWavePoints = 0;
    this.seen = { pulseTs: -1, breathingTs: -1, pulse: 0, pulseStable: 0, breathing: 0, breathingStable: 0 };
    this.stopReason = 'stop';
    this.statsTicks = 0;
    this.counters = this.freshCounters();
    this.fps = new RateWindow(5000);
    this.transit = new LatencyWindow();
    this.sendMs = new LatencyWindow();
    this.anchor.reset();
  }

  private setPhase(phase: Phase, error: AegisError | null): void {
    this.phase = phase;
    this.emitLifecycle({ event: 'phase', phase, errorKind: error?.kind ?? null });
    this.deps.emit({ type: 'phase', phase, error });
  }

  private mapThrown(e: unknown): AegisError {
    const code = typeof (e as { code?: unknown })?.code === 'number' ? ((e as { code: number }).code) : -1;
    const mapped = ERROR_MAP[code];
    const raw = e instanceof Error ? e.message : String(e);
    return this.err(mapped?.kind ?? 'unknown', this.deps.apiKey.redact(mapped?.text ?? raw), RETRYABLE.has(mapped?.kind ?? 'unknown'));
  }

  private err(kind: ErrorKind, message: string, retryable: boolean): AegisError {
    return { kind, message, retryable };
  }
}
