import { useRef } from 'react';
import type { Phase } from '../../shared/ipc';
import { VIEWS, moveFocusIndex, type ViewId } from '../state/navigation';
import { formatClock } from '../state/quality';

const ICONS: Record<ViewId, string> = {
  live: 'M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z',
  lab: 'M3 12h3l3-8 4 16 3-8h5',
  sessions: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5',
  diagnostics: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7-3l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6 8.5 4 8l-1 3 2 1v2l-2 1 1 3 2-.5L7.5 19l-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z',
};

function Icon({ id }: { id: ViewId }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[id]} />
    </svg>
  );
}

interface SidebarProps {
  view: ViewId;
  collapsed: boolean;
  onSelect: (v: ViewId) => void;
  onToggle: () => void;
}

/** Persistent navigation. Arrow keys / Home / End move between items; Enter or Space opens one. */
export function Sidebar({ view, collapsed, onSelect, onToggle }: SidebarProps): JSX.Element {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (e: React.KeyboardEvent, index: number): void => {
    const next = moveFocusIndex(index, VIEWS.length, e.key);
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
  };
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} id="sidebar" data-testid="sidebar">
      <div className="brand">
        <span className="logo" aria-hidden="true" />
        {!collapsed && (
          <div>
            <strong>Aegis Pulse</strong>
            <p>Human Signal Observatory</p>
          </div>
        )}
      </div>
      <nav aria-label="Views">
        <ul>
          {VIEWS.map((v, i) => (
            <li key={v.id}>
              <button
                type="button" ref={(el) => { refs.current[i] = el; }}
                className={`navitem${v.id === view ? ' current' : ''}`}
                aria-current={v.id === view ? 'page' : undefined}
                aria-label={collapsed ? v.label : undefined}
                title={`${v.label} (Alt+${i + 1})`}
                tabIndex={v.id === view ? 0 : -1}
                data-testid={`nav-${v.id}`}
                onClick={() => onSelect(v.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
              >
                <Icon id={v.id} />
                {!collapsed && (
                  <span className="navtext">
                    <span>{v.label}</span>
                    <small>{v.hint}</small>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <button type="button" className="collapse" onClick={onToggle} aria-expanded={!collapsed} aria-controls="sidebar" data-testid="collapse">
        <span aria-hidden="true">{collapsed ? '\u00bb' : '\u00ab'}</span>
        <span className={collapsed ? 'sr-only' : ''}>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
      </button>
    </aside>
  );
}

const STATE_LABEL: Record<Phase, string> = { idle: 'IDLE', starting: 'STARTING', running: 'RUNNING', stopping: 'STOPPING', error: 'ERROR' };

interface TopBarProps {
  title: string;
  phase: Phase;
  sessionSec: number;
  busy: boolean;
  onStop: () => void;
}

/** Always visible: global RUNNING/IDLE state and a Stop control that works from every view. */
export function TopBar({ title, phase, sessionSec, busy, onStop }: TopBarProps): JSX.Element {
  const active = phase === 'starting' || phase === 'running' || phase === 'stopping';
  return (
    <header className="top">
      <h1>{title}</h1>
      <div className="top-right">
        <span className="clock" aria-label="Session time">{formatClock(sessionSec)}</span>
        <span className={`phase phase-${phase}`} data-testid="phase" role="status" aria-label={`Measurement state: ${STATE_LABEL[phase]}`}>
          <i aria-hidden="true" /> {STATE_LABEL[phase]}
        </span>
        <button type="button" className="danger" onClick={onStop} disabled={busy || !active} data-testid="stop">
          Stop &amp; release camera
        </button>
      </div>
    </header>
  );
}

export function Disclaimer(): JSX.Element {
  return (
    <footer className="disclaimer" role="note" data-testid="disclaimer">
      <strong>Wellness information only.</strong> Not a medical device; not for diagnosis, treatment or health decisions.
      Readings can be wrong when you move, talk, or lighting flickers. Values are exactly what the SmartSpectra SDK reports.
    </footer>
  );
}
