import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AegisError, AegisEvent, MainStats, Phase, Signal } from '../../shared/ipc';
import { CameraError, FramePump, openCamera, type CaptureStats } from '../capture';
import { Series } from './series';

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
    }),
    [],
  );
  const lastTs = useRef({ pulse: -1, breathing: -1 });
  const receivedAt = useRef<{ pulse: number | null; breathing: number | null }>({ pulse: null, breathing: null });
  const packetsRef = useRef(0);
  const runningSince = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('idle');

  const clearData = useCallback(() => {
    series.pulseWave.clear();
    series.breathWave.clear();
    series.pulseHist.clear();
    series.breathHist.clear();
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
            setPulse(e.pulse);
          }
          if (e.breathing && e.breathing.timestampUs !== lastTs.current.breathing) {
            lastTs.current.breathing = e.breathing.timestampUs;
            receivedAt.current.breathing = now;
            series.breathHist.push([{ t: e.breathing.timestampUs, v: e.breathing.value }]);
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

  const start = useCallback(async () => {
    setBusy(true);
    setCameraError(null);
    setError(null);
    clearData();
    try {
      const stream = await openCamera(); // camera first: a denied camera never touches the SDK
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
      const r = await window.aegis.start(); // key stays in main
      if (!r.ok) {
        setError(r.error);
        await releaseCamera();
        return;
      }
      const pump = new FramePump(window.aegis, setCapStats);
      pumpRef.current = pump;
      pump.start(stream);
    } catch (e) {
      setCameraError(e instanceof CameraError ? e.message : 'Camera failed to start.');
      await releaseCamera();
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

  return {
    phase, consent, pulse, breathing, packets, validation, error, cameraError, mainStats, capStats, busy,
    series, videoRef, sinceMs, sessionSec, grantConsent, revokeConsent, start, stop,
  };
}
