import { formatClock } from '../state/quality';
import { steadyPercent, type ChannelTally } from '../state/sessionStats';
import type { Observatory } from '../state/useObservatory';

const dash = '\u2014';
const num = (n: number | null): string => (n === null ? dash : String(Math.round(n)));

function Channel({ name, unit, t }: { name: string; unit: string; t: ChannelTally }): JSX.Element {
  const steady = steadyPercent(t);
  return (
    <tr>
      <th scope="row">{name}</th>
      <td>{t.samples}</td>
      <td>{steady === null ? dash : `${steady}%`}</td>
      <td>{t.min === null ? dash : `${num(t.min)}\u2013${num(t.max)} ${unit}`}</td>
      <td>{t.last === null ? dash : `${num(t.last)} ${unit}${t.lastStable === false ? ' (settling)' : ''}`}</td>
    </tr>
  );
}

export function Sessions({ o }: { o: Observatory }): JSX.Element {
  const running = o.phase === 'running' || o.phase === 'starting';
  return (
    <section className="view sessions" aria-label="Sessions" data-testid="view-sessions">
      <section className="panel" aria-label="Current session">
        <h2>{running ? 'Current session' : 'Current session (not measuring)'}</h2>
        <dl className="stats">
          <dt>Elapsed</dt><dd>{formatClock(o.sessionSec)}</dd>
          <dt>SDK metric packets</dt><dd>{o.packets}</dd>
        </dl>
        <table className="datatable">
          <caption className="sr-only">Readings the SDK reported during the current session</caption>
          <thead><tr><th scope="col">Signal</th><th scope="col">SDK updates</th><th scope="col">Flagged steady</th><th scope="col">Range reported</th><th scope="col">Latest</th></tr></thead>
          <tbody>
            <Channel name="Pulse" unit="BPM" t={o.tally.pulse} />
            <Channel name="Breathing" unit="br/min" t={o.tally.breathing} />
          </tbody>
        </table>
        <p className="note">Counts and ranges of values the SDK reported. They are not averaged, scored or interpreted by this app.</p>
      </section>

      <section className="panel" aria-label="Earlier sessions this run">
        <h2>Earlier sessions in this app run</h2>
        {o.history.length === 0 ? (
          <p className="note" data-testid="no-history">No finished sessions yet.</p>
        ) : (
          <table className="datatable" data-testid="history">
            <thead><tr><th scope="col">#</th><th scope="col">Length</th><th scope="col">Pulse updates</th><th scope="col">Breathing updates</th><th scope="col">Last pulse</th><th scope="col">Last breathing</th></tr></thead>
            <tbody>
              {[...o.history].reverse().map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.id}</th>
                  <td>{formatClock(r.durationSec)}</td>
                  <td>{r.pulse.samples}</td>
                  <td>{r.breathing.samples}</td>
                  <td>{r.pulse.last === null ? dash : `${num(r.pulse.last)} BPM`}</td>
                  <td>{r.breathing.last === null ? dash : `${num(r.breathing.last)} br/min`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="row-actions">
          <button type="button" className="ghost" onClick={o.clearHistory} disabled={o.history.length === 0}>Clear this list</button>
        </div>
        <p className="note">
          Kept in memory only and discarded when you quit. Raw readings and waveforms are not saved. The app writes a separate local file of
          pipeline counters and timings (no vital-sign values) when a session ends.
        </p>
      </section>
    </section>
  );
}
