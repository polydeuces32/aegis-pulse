import type { Observatory } from '../state/useObservatory';

const dash = '\u2014';
const fmt = (n: number | undefined, d = 0): string => (n === undefined ? dash : n.toFixed(d));

export function Diagnostics({ o }: { o: Observatory }): JSX.Element {
  const m = o.mainStats;
  const c = o.capStats;
  const keySource = o.cred?.source ?? dash;
  return (
    <section className="view diagnostics" aria-label="Diagnostics" data-testid="view-diagnostics">
      <section className="panel" aria-label="SDK state">
        <h2>SDK state</h2>
        <dl className="stats">
          <dt>Session phase</dt><dd data-testid="diag-phase">{o.phase}</dd>
          <dt>Camera consent</dt><dd>{o.consent ? 'granted' : 'not granted'}</dd>
          <dt>API key source</dt><dd>{keySource}</dd>
          <dt>SDK metric packets</dt><dd>{o.packets}</dd>
          <dt>Telemetry</dt><dd>disabled</dd>
        </dl>
      </section>

      <section className="panel" aria-label="Errors">
        <h2>Errors</h2>
        {o.error || o.cameraError ? (
          <ul className="plain" data-testid="diag-errors">
            {o.error && <li><strong>{o.error.kind}</strong>: {o.error.message}{o.error.retryable ? ' (retryable)' : ''}</li>}
            {o.cameraError && <li><strong>camera</strong>: {o.cameraError}</li>}
          </ul>
        ) : (
          <p className="note" data-testid="diag-no-errors">No errors reported.</p>
        )}
      </section>

      <section className="panel pipeline" aria-label="Pipeline" data-testid="stats">
        <h2>Pipeline</h2>
        <table className="datatable">
          <caption className="sr-only">Frame pipeline statistics</caption>
          <tbody>
            <tr><th scope="row">Capture size</th><td>{c ? `${c.width}\u00d7${c.height}` : dash}</td></tr>
            <tr><th scope="row">Accepted FPS (main / renderer)</th><td>{fmt(m?.acceptedFps, 1)} / {fmt(c?.sendFps, 1)}</td></tr>
            <tr><th scope="row">Round-trip p50 / p95 (ms)</th><td>{c ? `${fmt(c.rttMs.p50, 1)} / ${fmt(c.rttMs.p95, 1)}` : dash}</td></tr>
            <tr><th scope="row">IPC transit p50 / p95 (ms)</th><td>{m ? `${fmt(m.transitMs.p50, 1)} / ${fmt(m.transitMs.p95, 1)}` : dash}</td></tr>
            <tr><th scope="row">sendFrame() p50 / p95 (ms)</th><td>{m ? `${fmt(m.sendFrameMs.p50, 1)} / ${fmt(m.sendFrameMs.p95, 1)}` : dash}</td></tr>
            <tr><th scope="row">Dropped: busy / stale / invalid / SDK</th><td>{c && m ? `${c.droppedBusy} / ${m.droppedStale} / ${m.droppedInvalid} / ${m.sdkRejected}` : dash}</td></tr>
            <tr><th scope="row">Frames received / accepted</th><td>{m ? `${m.framesReceived} / ${m.framesAccepted}` : dash}</td></tr>
            <tr><th scope="row">Main-process memory (MB)</th><td>{fmt(m?.rssMb)}</td></tr>
          </tbody>
        </table>
        <p className="note">Updated about once a second while measuring.</p>
      </section>
    </section>
  );
}
