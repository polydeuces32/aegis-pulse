import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AegisError, AegisEvent, CredentialStatus, MainStats, Phase, Signal } from '../../shared/ipc';
import { CameraError, FramePump, openCamera, type CaptureStats } from '../capture';
import { Series } from './series';
import { SessionTally, type SessionRecord } from './sessionStats';

export interface ValidationState {
  code: number;
  name: string;
  hint: string;
}

const WAVE_SPAN_US = 30_000_000;
const HIST_SPAN_US = 180_000_000;

/** Single controller for the session: IPC events -> bounded real-data series; camera + frame pump lifecycle. */
export function useObservatory() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [consent, setConsent] = useState(false);
  const [pulse, setPulse] = useState<Signal | null>(null);
  const [breathing, setBreathing] = useState<Signal | null>(null);
  const [packets, setPackets] = useState(0);
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [error, setError] = useState<AegisError | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mainStats, setMainStats] = useState<MainStats | null>(null);
  const [capStats, setCapStats] = useState<CaptureStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [cred, setCred] = useState<CredentialStatus | null>(null);
  const [credMessage, setCredMessage] = useState<string | null>(null);
  const [credBusy, setCredBusy] = useState(false);
  const [credNotice, setCredNotice] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => performance.now());

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pumpRef = useRef<FramePump | null>(null);
  const series = useMemo(
    () => ({
      pulseWave: new Series(4000, WAVE_SPAN_US),
      breathWave: new Series(4000, WAVE_SPAN_US),
      pulseHist: new Series(1000, HIST_SPAN_US),
      breathHist: new Series(1000, HIST_SPAN_US),
      pulseConf: new Series(1000, HIST_SPAN_US),
      breathConf: new Series(1000, HIST_SPAN_US),
    }),
    [],
  );
  const lastTs = useRef({ pulse: -1, breathing: -1 });
  const receivedAt = useRef<{ pulse: number | null; breathing: number | null }>({ pulse: null, breathing: null });
  const packetsRef = useRef(0);
  const runningSince = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const tally = useRef(new SessionTally());
  const recordId = useRef(0);
  const [history, setHistory] = useState<SessionRecord[]>([]); // this app run only; never written to disk

  const clearData = useCallback(() => {
    series.pulseWave.clear();
    series.breathWave.clear();
    series.pulseHist.clear();
    series.breathHist.clear();
    series.pulseConf.clear();
    series.breathConf.clear();
    tally.current.reset();
    lastTs.current = { pulse: -1, breathing: -1 };
    receivedAt.current = { pulse: null, breathing: null };
    packetsRef.current = 0;
    setPulse(null);
    setBreathing(null);
    setPackets(0);
    setValidation(null);
    setMainStats(null);
    setCapStats(null);
  }, [series]);

  const releaseCamera = useCallback(async () => {
    await pumpRef.current?.stop();
    pumpRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    const api = window.aegis;
    void api.credentialStatus().then(setCred);
    void api.getState().then((s) => {
      phaseRef.current = s.phase;
      setPhase(s.phase);
      setConsent(s.consent);
      setError(s.error);
    });
    const off = api.onEvent((e: AegisEvent) => {
      switch (e.type) {
        case 'phase':
          phaseRef.current = e.phase;
          setPhase(e.phase);
          setError(e.error);
          if (e.phase === 'running') runningSince.current = performance.now();
          if (e.phase === 'stopping' || e.phase === 'idle' || e.phase === 'error') setValidation(null); // quality hints are only valid while measuring
          if (e.phase === 'idle' || e.phase === 'error') {
            if (runningSince.current !== null) {
              const rec = tally.current.record(++recordId.current, (performance.now() - runningSince.current) / 1000, packetsRef.current);
              setHistory((h) => [...h, rec].slice(-20));
            }
            runningSince.current = null;
            void releaseCamera(); // camera is always released on stop and on error
          }
          break;
        case 'signals': {
          const now = performance.now();
          packetsRef.current = e.metricPackets;
          if (e.pulse && e.pulse.timestampUs !== lastTs.current.pulse) {
            lastTs.current.pulse = e.pulse.timestampUs;
            receivedAt.current.pulse = now;
            series.pulseHist.push([{ t: e.pulse.timestampUs, v: e.pulse.value }]);
            series.pulseConf.push([{ t: e.pulse.timestampUs, v: e.pulse.confidence }]);
            tally.current.add('pulse', e.pulse);
            setPulse(e.pulse);
          }
          if (e.breathing && e.breathing.timestampUs !== lastTs.current.breathing) {
            lastTs.current.breathing = e.breathing.timestampUs;
            receivedAt.current.breathing = now;
            series.breathHist.push([{ t: e.breathing.timestampUs, v: e.breathing.value }]);
            series.breathConf.push([{ t: e.breathing.timestampUs, v: e.breathing.confidence }]);
            tally.current.add('breathing', e.breathing);
            setBreathing(e.breathing);
          }
          break;
        }
        case 'traces':
          series.pulseWave.push(e.pulseWave);
          series.breathWave.push(e.breathWave);
          break;
        case 'validation':
          if (phaseRef.current === 'starting' || phaseRef.current === 'running') {
            setValidation({ code: e.code, name: e.name, hint: e.hint });
          }
          break;
        case 'stats':
          setMainStats(e.main);
          setPackets(packetsRef.current);
          break;
      }
    });
    const tick = setInterval(() => setNowMs(performance.now()), 1000);
    return () => {
      off();
      clearInterval(tick);
      void releaseCamera();
    };
  }, [releaseCamera, series]);

  const grantConsent = useCallback(async () => {
    const r = await window.aegis.setConsent(true);
    if (r.ok) setConsent(true);
    else setError(r.error);
  }, []);

  const revokeConsent = useCallback(async () => {
    const r = await window.aegis.setConsent(false);
    if (r.ok) setConsent(false);
    else setError(r.error);
  }, []);

  /** Runs one credential action and reports the outcome. Results never contain the key. */
  const runCredential = useCallback(async (action: () => Promise<{ ok: true; saved?: boolean } | { ok: false; error: { message: string } }>, successNotice: string) => {
    setCredBusy(true);
    setCredMessage(null);
    setCredNotice(null);
    try {
      const r = await action();
      if (!r.ok) setCredMessage(r.error.message);
      else if (r.saved !== false) setCredNotice(successNotice); // saved === false means the user cancelled
    } catch {
      setCredMessage('The key could not be saved.');
    }
    setCred(await window.aegis.credentialStatus());
    setCredBusy(false);
  }, []);

  const SAVED = 'API key saved securely in the macOS Keychain. You can start measuring.';
  const importKey = useCallback(() => runCredential(() => window.aegis.importKeyFromClipboard(), SAVED), [runCredential]);
  const enterKeyNative = useCallback(() => runCredential(() => window.aegis.enterKeyNative(), SAVED), [runCredential]);
  // The key is passed straight through and never stored in React state.
  const saveTypedKey = useCallback((key: string) => runCredential(() => window.aegis.saveTypedKey(key), SAVED), [runCredential]);
  const removeKey = useCallback(() => runCredential(() => window.aegis.removeKey(), 'Stored API key removed.'), [runCredential]);

  const start = useCallback(async () => {
    setBusy(true);
    setCameraError(null);
    setError(null);
    clearData();
    try {
      // Main authorizes the camera only for a started session, so Start comes first; a camera failure then ends it.
      const r = await window.aegis.start(); // key stays in main
      if (!r.ok) {
        setError(r.error);
        return;
      }
      try {
        const stream = await openCamera();
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
        const pump = new FramePump(window.aegis, setCapStats);
        pumpRef.current = pump;
        pump.start(stream);
      } catch (e) {
        setCameraError(e instanceof CameraError ? e.message : 'Camera failed to start.');
        await releaseCamera();
        await window.aegis.stop(); // a denied camera never leaves an SDK session running
      }
    } finally {
      setBusy(false);
    }
  }, [clearData, releaseCamera]);

  const stop = useCallback(async () => {
    setBusy(true);
    await releaseCamera(); // stop frames first, then close the SDK session
    await window.aegis.stop();
    setBusy(false);
  }, [releaseCamera]);

  const sinceMs = (k: 'pulse' | 'breathing'): number | null => {
    const at = receivedAt.current[k];
    return at === null ? null : nowMs - at;
  };
  const sessionSec = runningSince.current === null ? 0 : (nowMs - runningSince.current) / 1000;

  const clearHistory = useCallback(() => setHistory([]), []);

  return {
    tally: tally.current, history, clearHistory,
    phase, consent, pulse, breathing, packets, validation, error, cameraError, mainStats, capStats, busy,
    series, videoRef, sinceMs, sessionSec, grantConsent, revokeConsent, start, stop,
    cred, credMessage, credNotice, credBusy, importKey, enterKeyNative, saveTypedKey, removeKey,
  };
}

export type Observatory = ReturnType<typeof useObservatory>;
