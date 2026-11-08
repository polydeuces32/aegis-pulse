// Shared IPC contract: channel names, wire types, and pure validators.
// No imports, no Node/Electron APIs: bundled into main, preload (sandboxed) and renderer.

export const CH = {
  getState: 'aegis:get-state',
  consent: 'aegis:consent',
  start: 'aegis:start',
  stop: 'aegis:stop',
  frame: 'aegis:frame',
  event: 'aegis:event',
  credStatus: 'aegis:cred-status',
  credImport: 'aegis:cred-import',
  credRemove: 'aegis:cred-remove',
  credEnter: 'aegis:cred-enter',
  credSaveTyped: 'aegis:cred-save-typed',
} as const;

export const LIMITS = {
  minDim: 64,
  maxWidth: 1920,
  maxHeight: 1080,
  bytesPerPixel: 4, // RGBA
  maxFrameBytes: 1920 * 1080 * 4,
  staleMs: 250, // drop frames whose renderer->main transit exceeds this
  maxClockSkewMs: 1000, // future-dated sentAt beyond this is invalid
  maxRssBytes: 2 * 1024 * 1024 * 1024,
} as const;

export type Phase = 'idle' | 'starting' | 'running' | 'stopping' | 'error';

export type ErrorKind =
  | 'authentication'
  | 'quota'
  | 'network'
  | 'server'
  | 'input'
  | 'processing'
  | 'timing'
  | 'state'
  | 'missing-key'
  | 'consent'
  | 'credential'
  | 'timeout'
  | 'memory-limit'
  | 'unknown';

export interface AegisError {
  kind: ErrorKind;
  message: string;
  retryable: boolean;
}

/** One real SDK sample. confidence is the SDK's percentage in [0,100]. */
export interface Signal {
  value: number;
  confidence: number;
  stable: boolean;
  timestampUs: number;
}

export interface LatencySummary {
  n: number;
  p50: number;
  p95: number;
  max: number;
}

/** One real SDK trace sample (time in SDK microseconds, value in SDK-relative units). */
export interface TracePoint {
  t: number;
  v: number;
}

export interface MainStats {
  framesReceived: number;
  framesAccepted: number;
  droppedInvalid: number;
  droppedStale: number;
  droppedNotRunning: number;
  sdkRejected: number;
  acceptedFps: number;
  transitMs: LatencySummary;
  sendFrameMs: LatencySummary;
  rssMb: number;
  metricPackets: number;
  pulseWavePoints: number;
  breathWavePoints: number;
}

export interface Snapshot {
  phase: Phase;
  consent: boolean;
  pulse: Signal | null;
  breathing: Signal | null;
  metricPackets: number;
  error: AegisError | null;
}

export type Result = { ok: true } | { ok: false; error: AegisError };

/** saved=false with ok=true means the user cancelled; nothing changed. Never carries the key. */
export type CredentialResult = { ok: true; saved: boolean } | { ok: false; error: AegisError };

/** Upper bound on a typed key crossing IPC (the SDK itself clamps keys to 1024). */
export const MAX_TYPED_KEY_CHARS = 1024;

/** saveTypedKey takes exactly one string argument within bounds; anything else is rejected. */
export function validateTypedKeyArg(args: readonly unknown[]): string | null {
  if (args.length !== 1) return null;
  const v = args[0];
  return typeof v === 'string' && v.length <= MAX_TYPED_KEY_CHARS + 64 ? v : null;
}

export type FrameAck =
  | { accepted: true }
  | { accepted: false; reason: 'invalid' | 'stale' | 'not-running' | 'sdk-rejected' };

export type AegisEvent =
  | { type: 'phase'; phase: Phase; error: AegisError | null }
  | { type: 'signals'; pulse: Signal | null; breathing: Signal | null; metricPackets: number }
  | { type: 'traces'; pulseWave: TracePoint[]; breathWave: TracePoint[] }
  | { type: 'validation'; code: number; name: string; hint: string }
  | { type: 'stats'; main: MainStats };

export interface FramePayload {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  stride: number;
  /** VideoFrame.timestamp in microseconds (renderer media clock). Anchored/ratcheted in main. */
  timestampUs: number;
  /** Date.now() at send time in the renderer, used only to measure IPC transit/staleness. */
  sentAtEpochMs: number;
}

export type KeySource = 'keychain' | 'environment' | 'dotenv' | 'none';

/** Never contains the key itself. */
export interface CredentialStatus {
  source: KeySource;
  /** macOS Keychain-backed encryption is available, so a key can be stored safely. */
  canStore: boolean;
}

export interface AegisApi {
  getState(): Promise<Snapshot>;
  setConsent(granted: boolean): Promise<Result>;
  start(): Promise<Result>;
  stop(): Promise<Result>;
  sendFrame(frame: FramePayload): Promise<FrameAck>;
  onEvent(cb: (e: AegisEvent) => void): () => void;
  credentialStatus(): Promise<CredentialStatus>;
  /** Main process reads the clipboard itself; the key never enters renderer JavaScript. */
  importKeyFromClipboard(): Promise<CredentialResult>;
  removeKey(): Promise<Result>;
  /** Preferred: native macOS hidden-input dialog run by the main process; the key never enters renderer JavaScript. */
  enterKeyNative(): Promise<CredentialResult>;
  /** In-app password field. The key IS visible to renderer JavaScript during entry. */
  saveTypedKey(key: string): Promise<CredentialResult>;
}

// ---------- validators (all take `unknown`) ----------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function isArrayBuffer(v: unknown): v is ArrayBuffer {
  return Object.prototype.toString.call(v) === '[object ArrayBuffer]';
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

export type FrameCheck = { ok: true; frame: FramePayload } | { ok: false; reason: string };

export function validateFrame(input: unknown, nowEpochMs: number): FrameCheck {
  if (!isRecord(input)) return { ok: false, reason: 'not-object' };
  const { buffer, width, height, stride, timestampUs, sentAtEpochMs } = input;
  if (!isArrayBuffer(buffer)) return { ok: false, reason: 'buffer-type' };
  if (!isInt(width) || !isInt(height)) return { ok: false, reason: 'dimension-type' };
  if (width < LIMITS.minDim || width > LIMITS.maxWidth || height < LIMITS.minDim || height > LIMITS.maxHeight) {
    return { ok: false, reason: 'dimension-range' };
  }
  if (!isInt(stride) || stride !== width * LIMITS.bytesPerPixel) return { ok: false, reason: 'stride' };
  if (buffer.byteLength !== stride * height || buffer.byteLength > LIMITS.maxFrameBytes) {
    return { ok: false, reason: 'byte-length' };
  }
  if (!isInt(timestampUs) || timestampUs < 0) return { ok: false, reason: 'timestamp' };
  if (!isInt(sentAtEpochMs) || sentAtEpochMs - nowEpochMs > LIMITS.maxClockSkewMs) {
    return { ok: false, reason: 'sent-at' };
  }
  return { ok: true, frame: { buffer, width, height, stride, timestampUs, sentAtEpochMs } };
}

/** Only `granted: boolean` is accepted for consent calls. */
export function validateConsentArg(input: unknown): boolean | null {
  return typeof input === 'boolean' ? input : null;
}

/** start/stop take no arguments; reject anything else to keep the surface narrow. */
export function validateNoArgs(args: readonly unknown[]): boolean {
  return args.length === 0;
}

/** Exact-match URL allow-list (ignores hash/search). */
export function isTrustedUrl(url: string, allowed: readonly string[]): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const stripped = `${u.protocol}//${u.host}${u.pathname}`;
  return allowed.some((a) => {
    try {
      const au = new URL(a);
      return stripped === `${au.protocol}//${au.host}${au.pathname}`;
    } catch {
      return false;
    }
  });
}
