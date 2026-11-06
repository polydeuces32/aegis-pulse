import type { Signal } from '../../shared/ipc';
import type { Series } from '../state/series';
import type { ReadingStatus } from '../state/quality';

const R = 54;
const C = 2 * Math.PI * R;

export function ConfidenceArc({ confidence, color, dim }: { confidence: number | null; color: string; dim: boolean }): JSX.Element {
  const pct = confidence === null ? 0 : Math.max(0, Math.min(100, confidence));
  return (
    <svg viewBox="0 0 128 128" className="arc" aria-hidden="true">
      <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(120,150,190,0.16)" strokeWidth="8" />
      <circle
        cx="64" cy="64" r={R} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 64 64)" opacity={dim ? 0.45 : 1}
        className="arc-fill"
      />
    </svg>
  );
}

export function Sparkline({ series, color, spanSec }: { series: Series; color: string; spanSec: number }): JSX.Element {
  const pts = series.window(spanSec * 1e6);
  const W = 220;
  const H = 36;
  if (pts.length < 2) return <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" />;
  let min = Infinity;
  let max = -Infinity;
  for (const p of pts) {
    if (p.v < min) min = p.v;
    if (p.v > max) max = p.v;
  }
  const range = Math.max(max - min, 4); // keeps tiny real variation from looking dramatic
  const first = (pts[0] as { t: number }).t;
  const span = Math.max((pts[pts.length - 1] as { t: number }).t - first, 1);
  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(((p.t - first) / span) * W).toFixed(1)},${(H - 3 - ((p.v - min) / range) * (H - 6)).toFixed(1)}`)
    .join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface ReadingProps {
  title: string;
  unit: string;
  color: string;
  sig: Signal | null;
  status: ReadingStatus;
  history: Series;
  historyLabel: string;
  note: string;
}

export function ReadingInstrument({ title, unit, color, sig, status, history, historyLabel, note }: ReadingProps): JSX.Element {
  const dim = status.kind === 'preliminary' || status.kind === 'lost' || status.kind === 'idle' || status.kind === 'ended';
  return (
    <section className={`instrument kind-${status.kind}`} aria-label={`${title} reading`}>
      <div className="ring">
        <ConfidenceArc confidence={sig && status.showValue ? sig.confidence : null} color={color} dim={dim} />
        <div className="center">
          <div className="num" data-testid={`value-${title.toLowerCase()}`}>
            {sig && status.showValue ? Math.round(sig.value) : '\u2014'}
          </div>
          <div className="unit">{unit}</div>
        </div>
      </div>
      <div className="detail">
        <h2>{title}</h2>
        <span className={`chip chip-${status.kind}${status.unstableAtEnd ? ' chip-preliminary' : ''}`}>{status.label}</span>
        <dl>
          <dt>SDK confidence</dt>
          <dd>{sig && status.showValue ? `${sig.confidence.toFixed(0)}%` : 'unavailable'}</dd>
          <dt>Stability</dt>
          <dd className={sig && status.showValue && !sig.stable ? 'warn-text' : ''}>{sig && status.showValue ? (sig.stable ? 'stable' : 'not yet stable') : 'unavailable'}</dd>
        </dl>
        <Sparkline series={history} color={color} spanSec={120} />
        <div className="note">{historyLabel}</div>
        <div className="note">{note}</div>
      </div>
    </section>
  );
}
