export type ViewId = 'live' | 'lab' | 'sessions' | 'diagnostics' | 'settings';

export interface ViewDef {
  id: ViewId;
  label: string;
  hint: string;
}

export const VIEWS: readonly ViewDef[] = [
  { id: 'live', label: 'Live Monitor', hint: 'Camera, pulse, breathing' },
  { id: 'lab', label: 'Signal Lab', hint: 'Waveforms and confidence' },
  { id: 'sessions', label: 'Sessions', hint: 'This session, this run' },
  { id: 'diagnostics', label: 'Diagnostics', hint: 'Pipeline health' },
  { id: 'settings', label: 'Settings', hint: 'Key, privacy, access' },
];

/** Next focus index for arrow/Home/End keys in the sidebar (wraps). Null = key not handled. */
export function moveFocusIndex(current: number, count: number, key: string): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return (current + 1) % count;
    case 'ArrowUp':
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** Alt+1..5 jumps to a view. Uses the physical key code so macOS Option-composed characters do not matter. */
export function viewFromShortcut(e: { code: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean }): ViewId | null {
  if (!e.altKey || e.ctrlKey || e.metaKey) return null;
  const m = /^Digit([1-9])$/.exec(e.code);
  if (!m) return null;
  return VIEWS[Number(m[1]) - 1]?.id ?? null;
}
