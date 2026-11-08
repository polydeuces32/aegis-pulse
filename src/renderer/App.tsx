import { useEffect, useState } from 'react';
import { Disclaimer, Sidebar, TopBar } from './components/Chrome';
import { VIEWS, viewFromShortcut, type ViewId } from './state/navigation';
import { useObservatory, type Observatory } from './state/useObservatory';
import { Diagnostics } from './views/Diagnostics';
import { LiveMonitor } from './views/LiveMonitor';
import { Sessions } from './views/Sessions';
import { Settings, type Prefs } from './views/Settings';
import { SignalLab } from './views/SignalLab';

/** The ONLY place the session controller (camera + SDK lifecycle) is created. Views receive it as a prop. */
export function App(): JSX.Element {
  const o = useObservatory();
  return <AppShell o={o} />;
}

export function AppShell({ o, initialView = 'live' }: { o: Observatory; initialView?: ViewId }): JSX.Element {
  const [view, setView] = useState<ViewId>(initialView);
  const [collapsed, setCollapsed] = useState(false);
  const [agree, setAgree] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ largeText: false, reduceMotion: false, highContrast: false });
  const [announce, setAnnounce] = useState('');
  const live = o.phase === 'running';

  // Alt+1..5 view shortcuts. View state is local to the shell: changing it never touches the session controller.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const v = viewFromShortcut(e);
      if (v) {
        e.preventDefault();
        setView(v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  const title = VIEWS.find((v) => v.id === view)?.label ?? '';
  const cls = ['shell', collapsed ? 'nav-collapsed' : '', prefs.largeText ? 'pref-large' : '', prefs.reduceMotion ? 'pref-motion' : '', prefs.highContrast ? 'pref-contrast' : ''].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <a className="skip" href="#content" onClick={(e) => { e.preventDefault(); document.getElementById('content')?.focus(); }}>Skip to content</a>
      <Sidebar view={view} collapsed={collapsed} onSelect={setView} onToggle={() => setCollapsed((c) => !c)} />
      <div className="workspace">
        <TopBar title={title} phase={o.phase} sessionSec={o.sessionSec} busy={o.busy} onStop={() => void o.stop()} />
        <main id="content" tabIndex={-1}>
          {/* Live Monitor stays mounted (just hidden) so the camera <video> survives every view change. */}
          <LiveMonitor o={o} visible={view === 'live'} agree={agree} onAgree={setAgree} onNavigate={setView} />
          {view === 'lab' && <SignalLab o={o} />}
          {view === 'sessions' && <Sessions o={o} />}
          {view === 'diagnostics' && <Diagnostics o={o} />}
          {view === 'settings' && <Settings o={o} prefs={prefs} onPrefs={setPrefs} />}
          <p className="sr-only" role="status" aria-live="polite">{announce}</p>
        </main>
        <Disclaimer />
      </div>
    </div>
  );
}
