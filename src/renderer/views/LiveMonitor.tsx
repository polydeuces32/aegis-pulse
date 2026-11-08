import { ReadingInstrument } from '../components/Instruments';
import { hintFor, readingStatus } from '../state/quality';
import { computeReadiness } from '../state/readiness';
import type { Observatory } from '../state/useObservatory';
import type { ViewId } from '../state/navigation';

export const PULSE_COLOR = '#ff6b8b';
export const BREATH_COLOR = '#3de0c4';

interface Props {
  o: Observatory;
  /** False while another view is shown. The view stays MOUNTED so the camera preview element is never recreated. */
  visible: boolean;
  agree: boolean;
  onAgree: (v: boolean) => void;
  onNavigate: (v: ViewId) => void;
}

export function LiveMonitor({ o, visible, agree, onAgree, onNavigate }: Props): JSX.Element {
  const active = o.phase === 'starting' || o.phase === 'running' || o.phase === 'stopping';
  const live = o.phase === 'running';
  const needsKey = o.cred?.source === 'none';
  const hint = active && o.validation ? hintFor(o.validation.name, o.validation.hint) : null;
  const pulseStatus = readingStatus(o.pulse, o.phase, o.sinceMs('pulse'));
  const breathStatus = readingStatus(o.breathing, o.phase, o.sinceMs('breathing'));
  const readiness = computeReadiness({ phase: o.phase, pulse: o.pulse, breathing: o.breathing, hintLevel: hint?.level ?? null, runningSec: o.sessionSec });

  return (
    <section className="view live" hidden={!visible} aria-label="Live Monitor" data-testid="view-live">
      {o.cred && needsKey && (
        <div className="callout" data-testid="needs-key">
          <div><strong>API key needed.</strong> Add your Presage key once; it is stored in the macOS Keychain.</div>
          <button type="button" className="primary" onClick={() => onNavigate('settings')}>Open Settings</button>
        </div>
      )}

      {!needsKey && o.cred && !o.consent && (
        <section className="consent" data-testid="consent" aria-labelledby="consent-h">
          <h2 id="consent-h">Before the camera turns on</h2>
          <ul>
            <li>Video is analysed in memory on this Mac. Frames are <strong>never saved or uploaded</strong>.</li>
            <li>The Presage SmartSpectra SDK connects to Presage to authenticate your key. Per Presage&apos;s SDK privacy policy it also sends your derived measurements (pulse, breathing, HRV) and session metadata to Presage &mdash; never video or images. SDK usage telemetry is switched off; that does not stop this.</li>
            <li>Values are what the SDK reports, shown with its own confidence. Nothing is estimated or filled in by this app.</li>
            <li>Wellness information only. This is not a medical device.</li>
          </ul>
          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => onAgree(e.target.checked)} />
            <span>I consent to my camera being used for this session.</span>
          </label>
          <button type="button" className="primary" disabled={!agree} onClick={() => void o.grantConsent()}>Grant consent</button>
        </section>
      )}

      {o.cameraError && <div className="banner err" role="alert" data-testid="camera-error">{o.cameraError}</div>}
      {o.error && (
        <div className="banner err" role="alert" data-testid="error">
          <strong>{o.error.kind.replace('-', ' ')}</strong>: {o.error.message}
          {o.error.retryable ? ' You can press Start to retry.' : ''}
          {o.error.kind === 'authentication' || o.error.kind === 'missing-key' || o.error.kind === 'timeout' ? ' You can enter a different key in Settings.' : ''}
        </div>
      )}

      <div className="live-grid">
        <div className="live-main">
          <section className="viewport" aria-label="Camera preview">
            <video ref={o.videoRef} muted playsInline aria-label="Live camera preview, processed on this device and never saved" />
            {live && <span className="rec"><i aria-hidden="true" /> LIVE &middot; on-device</span>}
            {!active && <div className="idle-note">Camera is off</div>}
          </section>
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
          {!needsKey && o.consent && (
            <div className="controls" aria-label="Session controls">
              <button type="button" className="primary" onClick={() => void o.start()} disabled={o.busy || active || needsKey} data-testid="start">
                Start measuring
              </button>
              <button type="button" className="danger" onClick={() => void o.stop()} disabled={o.busy || !active} data-testid="stop-live">
                Stop &amp; release camera
              </button>
            </div>
          )}
        </div>

        <div className="live-side">
          <div className="instruments">
            <ReadingInstrument title="Pulse" unit="BPM" color={PULSE_COLOR} sig={o.pulse} status={pulseStatus}
              history={o.series.pulseHist} historyLabel="SDK pulse samples, last 2 min" note="" compact />
            <ReadingInstrument title="Breathing" unit="breaths/min" color={BREATH_COLOR} sig={o.breathing} status={breathStatus}
              history={o.series.breathHist} historyLabel="SDK breathing samples, last 2 min" note="" compact />
          </div>
        </div>
      </div>

      <section className={`readiness lvl-${readiness.level}`} aria-label="Measurement readiness" data-testid="readiness">
        <div className="readiness-head">
          <strong>{readiness.headline}</strong>
          <span>{readiness.detail}</span>
        </div>
        <div className="steps-row">
          {([['Pulse', readiness.pulse], ['Breathing', readiness.breathing]] as const).map(([name, st]) => (
            <div key={name} className={`rstep rs-${st.state}`}>
              <div className="rstep-top"><span>{name}</span><span>{st.label}</span></div>
              <progress max={1} value={st.windowProgress} aria-label={`${name} averaging window progress`} />
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
