import { CredentialPanel } from '../components/CredentialPanel';
import type { Observatory } from '../state/useObservatory';

export interface Prefs {
  largeText: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
}

interface Props {
  o: Observatory;
  prefs: Prefs;
  onPrefs: (p: Prefs) => void;
}

export function Settings({ o, prefs, onPrefs }: Props): JSX.Element {
  const active = o.phase === 'starting' || o.phase === 'running' || o.phase === 'stopping';
  const toggle = (k: keyof Prefs) => (e: React.ChangeEvent<HTMLInputElement>): void => onPrefs({ ...prefs, [k]: e.target.checked });
  return (
    <section className="view settings" aria-label="Settings" data-testid="view-settings">
      <section aria-label="API key and Keychain">
        <h2 className="section-h">API key &amp; Keychain</h2>
        <CredentialPanel
          status={o.cred} busy={o.credBusy} locked={active} message={o.credMessage} notice={o.credNotice}
          onEnterNative={() => void o.enterKeyNative()} onSaveTyped={(k) => void o.saveTypedKey(k)}
          onImport={() => void o.importKey()} onRemove={() => void o.removeKey()}
        />
      </section>

      <section className="panel" aria-label="Privacy and consent">
        <h2>Privacy &amp; consent</h2>
        <ul className="plain">
          <li>Video is analysed in memory on this Mac. Frames are never saved or uploaded.</li>
          <li>The SmartSpectra SDK connects to Presage to authenticate the key and deliver models. Per Presage&apos;s SDK privacy policy it also sends derived measurements (pulse, breathing, HRV) and session metadata to Presage, never video or images. SDK usage telemetry is switched off; that does not stop these.</li>
          <li>Readings and waveforms are not written to disk. Only pipeline counters and timings are logged locally.</li>
          <li>Wellness information only. Not a medical device.</li>
        </ul>
        <p>
          Camera consent: <strong data-testid="consent-state">{o.consent ? 'granted for this run' : 'not granted'}</strong>{' '}
          <button type="button" className="ghost" onClick={() => void o.revokeConsent()} disabled={!o.consent || active} data-testid="revoke">
            Revoke consent
          </button>
        </p>
        {active && <p className="note">Stop the measurement to change consent.</p>}
        {!o.consent && <p className="note">Grant consent from the Live Monitor view before measuring.</p>}
      </section>

      <section className="panel" aria-label="Accessibility">
        <h2>Accessibility</h2>
        <label className="check"><input type="checkbox" checked={prefs.largeText} onChange={toggle('largeText')} data-testid="pref-large" /><span>Larger text and numbers</span></label>
        <label className="check"><input type="checkbox" checked={prefs.reduceMotion} onChange={toggle('reduceMotion')} data-testid="pref-motion" /><span>Reduce motion (no pulsing or animated transitions)</span></label>
        <label className="check"><input type="checkbox" checked={prefs.highContrast} onChange={toggle('highContrast')} data-testid="pref-contrast" /><span>Higher contrast</span></label>
        <p className="note">Navigate with Tab, arrow keys in the sidebar, or Alt+1 to Alt+5. These preferences apply until you quit the app. macOS &ldquo;Reduce motion&rdquo; is always respected.</p>
      </section>
    </section>
  );
}
