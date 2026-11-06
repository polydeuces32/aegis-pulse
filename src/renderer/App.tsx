import { useEffect, useState } from 'react';
import { ReadingInstrument } from './components/Instruments';
import { Waveform } from './components/Waveform';
import { formatClock, hintFor, readingStatus } from './state/quality';
import { useObservatory } from './state/useObservatory';

const PULSE_COLOR = '#ff6b8b';
const BREATH_COLOR = '#3de0c4';
const fmt = (n: number | undefined, d = 0): string => (n === undefined ? '\u2014' : n.toFixed(d));

export function App(): JSX.Element {
  const o = useObservatory();
  const [agree, setAgree] = useState(false);
  const [announce, setAnnounce] = useState('');

  const active = o.phase === 'starting' || o.phase === 'running' || o.phase === 'stopping';
  const live = o.phase === 'running';
  const pulseStatus = readingStatus(o.pulse, o.phase, o.sinceMs('pulse'));
  const breathStatus = readingStatus(o.breathing, o.phase, o.sinceMs('breathing'));
  const hint = active && o.validation ? hintFor(o.validation.name, o.validation.hint) : null;

  // Screen-reader summary, refreshed at most every 10 s so it is not noisy.
  useEffect(() => {
    const id = setInterval(() => {
      setAnnounce(
        live
          ? `Pulse ${o.pulse ? Math.round(o.pulse.value) + ' beats per minute, ' + (o.pulse.stable ? 'stable' : 'preliminary') : 'not yet available'}. ` +
              `Breathing ${o.breathing ? Math.round(o.breathing.value) + ' breaths per minute, ' + (o.breathing.stable ? 'stable' : 'preliminary') : 'not yet available'}.`
          : '',
      );
    }, 10_000);
    return () => clearInterval(id);
  }, [live, o.pulse, o.breathing]);

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <div>
            <h1>Aegis Pulse</h1>
            <p>Human Signal Observatory</p>
          </div>
        </div>
        <div className="top-right">
          <span className="clock" aria-label="Session time">{formatClock(o.sessionSec)}</span>
          <span className={`phase phase-${o.phase}`} data-testid="phase" role="status">
            <i aria-hidden="true" /> {o.phase.toUpperCase()}
          </span>
        </div>
      </header>

      <main>
        {!o.consent ? (
          <section className="consent" data-testid="consent" aria-labelledby="consent-h">
            <h2 id="consent-h">Before the camera turns on</h2>
            <ul>
              <li>Video is analysed in memory on this Mac. Frames are <strong>never saved or uploaded</strong>.</li>
              <li>The Presage SmartSpectra SDK contacts Presage only to validate the API key and subscription. SDK telemetry is switched off.</li>
              <li>Values are what the SDK reports, shown with its own confidence. Nothing is estimated or filled in by this app.</li>
              <li>Wellness information only. This is not a medical device.</li>
            </ul>
            <label className="check">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I consent to my camera being used for this session.</span>
            </label>
            <button className="primary" disabled={!agree} onClick={() => void o.grantConsent()}>Grant consent</button>
          </section>
        ) : (
          <section className="controls" aria-label="Session controls">
            <button className="primary" onClick={() => void o.start()} disabled={o.busy || active} data-testid="start">
              Start measuring
            </button>
            <button className="danger" onClick={() => void o.stop()} disabled={o.busy || !active} data-testid="stop">
              Stop &amp; release camera
            </button>
            <button className="ghost" onClick={() => void o.revokeConsent()} disabled={active}>Revoke consent</button>
          </section>
        )}

        {o.cameraError && <div className="banner err" role="alert" data-testid="camera-error">{o.cameraError}</div>}
        {o.error && (
          <div className="banner err" role="alert" data-testid="error">
            <strong>{o.error.kind.replace('-', ' ')}</strong>: {o.error.message}
            {o.error.retryable ? ' You can press Start to retry.' : ''}
          </div>
        )}

        <div className="stage">
          <section className="viewport" aria-label="Camera preview">
            <video ref={o.videoRef} muted playsInline aria-label="Live camera preview, processed on this device and never saved" />
            <div className="reticle" aria-hidden="true"><i /><i /><i /><i /></div>
            {live && <span className="rec"><i aria-hidden="true" /> LIVE &middot; on-device</span>}
            {!active && <div className="idle-note">Camera is off</div>}
            <div className={`quality ${hint ? `q-${hint.level}` : 'q-none'}`} data-testid="quality" aria-live="polite">
              {hint ? (
                <>
                  <strong>{hint.title}</strong>
                  <span>{hint.action}</span>
                </>
              ) : (
                <span>{live ? 'Checking signal quality\u2026' : 'Signal quality is shown only while measuring.'}</span>
              )}
            </div>
          </section>

          <div className="instruments">
            <ReadingInstrument
              title="Pulse" unit="BPM" color={PULSE_COLOR} sig={o.pulse} status={pulseStatus}
              history={o.series.pulseHist} historyLabel="SDK pulse samples, last 2 min"
              note="Rolling 12-second average from the SDK."
            />
            <ReadingInstrument
              title="Breathing" unit="breaths/min" color={BREATH_COLOR} sig={o.breathing} status={breathStatus}
              history={o.series.breathHist} historyLabel="SDK breathing samples, last 2 min"
              note="30-second average; confidence starts at 0 until the window fills."
            />
          </div>
        </div>

        <div className="waves">
          <section className="panel" aria-label="Relative pulse waveform">
            <h3>Relative pulse waveform <span className="tag">shape only</span></h3>
            <Waveform series={o.series.pulseWave} color={PULSE_COLOR} spanSec={10} active={live}
              label="Relative pulse waveform from the SDK, 10 second window. Shape only, not a blood pressure measurement."
              emptyText="No waveform yet" />
            <p className="note">SDK arterial trace in arbitrary units. It shows timing and shape only &mdash; it is not a blood-pressure measurement.</p>
          </section>
          <section className="panel" aria-label="Breathing motion waveform">
            <h3>Breathing motion <span className="tag">relative</span></h3>
            <Waveform series={o.series.breathWave} color={BREATH_COLOR} spanSec={20} active={live}
              label="Upper-chest breathing motion trace from the SDK, 20 second window, relative units."
              emptyText="No waveform yet" />
            <p className="note">SDK upper-chest motion trace in relative units. Best when still, not talking, and the camera is steady.</p>
          </section>
        </div>

        <details className="panel pipeline" data-testid="stats">
          <summary>Pipeline diagnostics</summary>
          <table>
            <tbody>
              <tr><td>Capture size</td><td>{o.capStats ? `${o.capStats.width}\u00d7${o.capStats.height}` : '\u2014'}</td></tr>
              <tr><td>Accepted FPS (main / renderer)</td><td>{fmt(o.mainStats?.acceptedFps, 1)} / {fmt(o.capStats?.sendFps, 1)}</td></tr>
              <tr><td>Round-trip p50 / p95 (ms)</td><td>{o.capStats ? `${fmt(o.capStats.rttMs.p50, 1)} / ${fmt(o.capStats.rttMs.p95, 1)}` : '\u2014'}</td></tr>
              <tr><td>IPC transit p50 / p95 (ms)</td><td>{o.mainStats ? `${fmt(o.mainStats.transitMs.p50, 1)} / ${fmt(o.mainStats.transitMs.p95, 1)}` : '\u2014'}</td></tr>
              <tr><td>sendFrame() p50 / p95 (ms)</td><td>{o.mainStats ? `${fmt(o.mainStats.sendFrameMs.p50, 1)} / ${fmt(o.mainStats.sendFrameMs.p95, 1)}` : '\u2014'}</td></tr>
              <tr><td>Dropped: busy / stale / invalid / SDK</td><td>{o.capStats && o.mainStats ? `${o.capStats.droppedBusy} / ${o.mainStats.droppedStale} / ${o.mainStats.droppedInvalid} / ${o.mainStats.sdkRejected}` : '\u2014'}</td></tr>
              <tr><td>SDK metric packets</td><td>{o.packets}</td></tr>
              <tr><td>Main memory (MB)</td><td>{fmt(o.mainStats?.rssMb)}</td></tr>
            </tbody>
          </table>
        </details>

        <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      </main>

      <footer className="disclaimer" role="note">
        <strong>Wellness information only.</strong> Not a medical device; not for diagnosis, treatment or health decisions.
        Readings can be wrong when you move, talk, or lighting flickers. Values are exactly what the SmartSpectra SDK reports.
      </footer>
    </div>
  );
}
