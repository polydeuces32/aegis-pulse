import { Waveform } from '../components/Waveform';
import { confidenceWords, stabilityWords } from '../state/readiness';
import { hintFor } from '../state/quality';
import type { Observatory } from '../state/useObservatory';
import { BREATH_COLOR, PULSE_COLOR } from './LiveMonitor';

const CONF_RANGE = [0, 100] as const;

export function SignalLab({ o }: { o: Observatory }): JSX.Element {
  const live = o.phase === 'running';
  const active = live || o.phase === 'starting';
  const hint = active && o.validation ? hintFor(o.validation.name, o.validation.hint) : null;
  const row = (name: string, sig: Observatory['pulse']): JSX.Element => (
    <li>
      <strong>{name}</strong>:{' '}
      {sig && live
        ? `${Math.round(sig.value)} \u2014 trust: ${confidenceWords(sig.confidence).text}; ${stabilityWords(sig.stable).toLowerCase()}`
        : 'no current SDK reading'}
    </li>
  );
  return (
    <section className="view lab" aria-label="Signal Lab" data-testid="view-lab">
      <div className="lab-grid">
        <section className="panel" aria-label="Relative pulse waveform">
          <h2>Relative pulse waveform <span className="tag">shape only</span></h2>
          <Waveform series={o.series.pulseWave} color={PULSE_COLOR} spanSec={10} active={live} tall
            label="Relative pulse waveform from the SDK, 10 second window. Shape only, not a blood pressure measurement." emptyText="No waveform yet" />
          <p className="note">SDK arterial trace in arbitrary units, last 10 s. It shows timing and shape only &mdash; it is not a blood-pressure measurement.</p>
        </section>
        <section className="panel" aria-label="Breathing motion waveform">
          <h2>Breathing motion <span className="tag">relative</span></h2>
          <Waveform series={o.series.breathWave} color={BREATH_COLOR} spanSec={20} active={live} tall
            label="Upper-chest breathing motion trace from the SDK, 20 second window, relative units." emptyText="No waveform yet" />
          <p className="note">SDK upper-chest motion trace in relative units, last 20 s. Best when still, not talking, and the camera is steady.</p>
        </section>
        <section className="panel" aria-label="Pulse confidence trend">
          <h2>Pulse confidence <span className="tag">SDK 0&ndash;100%</span></h2>
          <Waveform series={o.series.pulseConf} color={PULSE_COLOR} spanSec={120} active={live} fixedRange={CONF_RANGE}
            label="Pulse confidence reported by the SDK over the last 2 minutes, scale 0 to 100 percent." emptyText="No confidence samples yet" />
          <p className="note">One point per SDK pulse update, last 2 min. Not smoothed.</p>
        </section>
        <section className="panel" aria-label="Breathing confidence trend">
          <h2>Breathing confidence <span className="tag">SDK 0&ndash;100%</span></h2>
          <Waveform series={o.series.breathConf} color={BREATH_COLOR} spanSec={120} active={live} fixedRange={CONF_RANGE}
            label="Breathing confidence reported by the SDK over the last 2 minutes, scale 0 to 100 percent." emptyText="No confidence samples yet" />
          <p className="note">Starts at 0 until the SDK&apos;s 30-second window fills.</p>
        </section>
      </div>

      <section className="panel quality-explain" aria-label="Signal quality" data-testid="lab-quality">
        <h2>Signal quality right now</h2>
        {hint ? <p><strong>{hint.title}.</strong> {hint.action}</p> : <p className="note">{live ? 'Checking signal quality\u2026' : 'Signal quality is shown only while measuring.'}</p>}
        <ul className="plain">{row('Pulse', o.pulse)}{row('Breathing', o.breathing)}</ul>
      </section>

      <details className="panel explain" open data-testid="explain">
        <summary>How to read these numbers</summary>
        <ul>
          <li><strong>Pulse</strong> is the SDK&apos;s average heart rate over the last 12 seconds. <strong>Breathing</strong> is its average over the last 30 seconds.</li>
          <li><strong>How much to trust it</strong> is the SDK&apos;s own 0&ndash;100% score. We group it as Low (&lt;40%), Medium (40&ndash;69%) and High (70%+) for readability; those groups are this app&apos;s wording, not an SDK rating.</li>
          <li><strong>Steady</strong> means the SDK considers the reading settled. <strong>Still settling</strong> means treat it as preliminary.</li>
          <li>Waveforms are plotted from the samples received; this app adds no smoothing and generates no points.</li>
          <li>Movement, talking, chewing, flickering light or a handheld camera can produce wrong readings that still look confident.</li>
        </ul>
      </details>
    </section>
  );
}
