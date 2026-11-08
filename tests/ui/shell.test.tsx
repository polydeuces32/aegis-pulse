// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppShell } from '../../src/renderer/App';
import { VIEWS, type ViewId } from '../../src/renderer/state/navigation';
import { makeObservatory } from './helpers';
import type { Observatory } from '../../src/renderer/state/useObservatory';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  // jsdom has no canvas / rAF drawing; the waveform effect only needs a context-less canvas to no-op.
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const mount = (o: Observatory, initialView?: ViewId): void => {
  act(() => root.render(<AppShell o={o} initialView={initialView} />));
};
const q = <T extends Element = HTMLElement>(sel: string): T => host.querySelector<T>(sel) as T;
const click = (el: Element): void => { act(() => { (el as HTMLElement).click(); }); };
const key = (el: Element, k: string): void => {
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });
};
const visibleViews = (): string[] =>
  [...host.querySelectorAll<HTMLElement>('[data-testid^="view-"]')].filter((e) => !e.hidden).map((e) => e.dataset['testid'] as string);

describe('navigation and view switching', () => {
  it('renders five navigation items and marks the current view', () => {
    mount(makeObservatory());
    const items = host.querySelectorAll('nav button');
    expect(items).toHaveLength(5);
    expect(q('[data-testid="nav-live"]').getAttribute('aria-current')).toBe('page');
    expect(q('[data-testid="nav-lab"]').getAttribute('aria-current')).toBeNull();
  });

  it('switching views while RUNNING never starts/stops the session and keeps the same <video> node', () => {
    const o = makeObservatory();
    mount(o);
    const video = q('video');
    expect(video).toBeTruthy();
    for (const v of VIEWS) {
      click(q(`[data-testid="nav-${v.id}"]`));
      expect(visibleViews()).toEqual([`view-${v.id}`]);
      expect(q('video')).toBe(video); // same element: preview is never recreated
      expect(host.contains(video)).toBe(true);
      expect(q('[data-testid="phase"]').textContent).toContain('RUNNING');
    }
    click(q('[data-testid="nav-live"]'));
    expect(visibleViews()).toEqual(['view-live']);
    expect(o.start).not.toHaveBeenCalled();
    expect(o.stop).not.toHaveBeenCalled();
  });

  it('keeps the consent checkbox state and Live Monitor DOM when leaving and returning', () => {
    mount(makeObservatory({ consent: false }));
    const box = q<HTMLInputElement>('.check input');
    act(() => box.click());
    expect(box.checked).toBe(true);
    click(q('[data-testid="nav-diagnostics"]'));
    click(q('[data-testid="nav-live"]'));
    expect(q<HTMLInputElement>('.check input')).toBe(box);
    expect(box.checked).toBe(true);
  });

  it('shows the global RUNNING/IDLE state, Stop control and disclaimer in every view', () => {
    const o = makeObservatory();
    mount(o);
    for (const v of VIEWS) {
      click(q(`[data-testid="nav-${v.id}"]`));
      expect(q('[data-testid="phase"]').textContent).toContain('RUNNING');
      const stop = q<HTMLButtonElement>('[data-testid="stop"]');
      expect(stop.disabled).toBe(false);
      expect(q('[data-testid="disclaimer"]').textContent).toContain('Wellness information only');
    }
  });

  it('global Stop works from a non-live view and calls the single controller once', () => {
    const o = makeObservatory();
    mount(o, 'diagnostics');
    click(q('[data-testid="stop"]'));
    expect(o.stop).toHaveBeenCalledTimes(1);
    expect(o.start).not.toHaveBeenCalled();
  });

  it('shows IDLE and a disabled Stop when not measuring', () => {
    mount(makeObservatory({ phase: 'idle' }), 'settings');
    expect(q('[data-testid="phase"]').textContent).toContain('IDLE');
    expect(q<HTMLButtonElement>('[data-testid="stop"]').disabled).toBe(true);
  });

  it('Alt+digit shortcuts switch views', () => {
    mount(makeObservatory());
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit4', altKey: true, bubbles: true })); });
    expect(visibleViews()).toEqual(['view-diagnostics']);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', altKey: true, bubbles: true })); });
    expect(visibleViews()).toEqual(['view-live']);
  });
});

describe('keyboard accessibility', () => {
  it('arrow keys, Home and End move focus through the sidebar with wrap-around; only the current item is in the tab order', () => {
    mount(makeObservatory());
    const live = q<HTMLButtonElement>('[data-testid="nav-live"]');
    expect(live.tabIndex).toBe(0);
    expect(q<HTMLButtonElement>('[data-testid="nav-lab"]').tabIndex).toBe(-1);
    act(() => live.focus());
    key(live, 'ArrowDown');
    expect(document.activeElement).toBe(q('[data-testid="nav-lab"]'));
    key(document.activeElement as Element, 'End');
    expect(document.activeElement).toBe(q('[data-testid="nav-settings"]'));
    key(document.activeElement as Element, 'ArrowDown');
    expect(document.activeElement).toBe(q('[data-testid="nav-live"]'));
    key(document.activeElement as Element, 'ArrowUp');
    expect(document.activeElement).toBe(q('[data-testid="nav-settings"]'));
    key(document.activeElement as Element, 'Home');
    expect(document.activeElement).toBe(q('[data-testid="nav-live"]'));
  });

  it('moving focus does not change the view until an item is activated', () => {
    mount(makeObservatory());
    key(q('[data-testid="nav-live"]'), 'ArrowDown');
    expect(visibleViews()).toEqual(['view-live']);
  });

  it('collapsing the sidebar keeps every item labelled and exposes aria-expanded', () => {
    mount(makeObservatory());
    const toggle = q('[data-testid="collapse"]');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    for (const v of VIEWS) expect(q(`[data-testid="nav-${v.id}"]`).getAttribute('aria-label')).toBe(v.label);
  });
});

describe('views show real controller data', () => {
  it('Sessions shows the in-memory tally and persists across view switches', () => {
    const o = makeObservatory();
    mount(o, 'sessions');
    const text = q('[data-testid="view-sessions"]').textContent ?? '';
    expect(text).toContain('42'); // metric packets
    expect(text).toContain('50%'); // 1 of 2 pulse samples flagged steady
    click(q('[data-testid="nav-lab"]'));
    click(q('[data-testid="nav-sessions"]'));
    expect(q('[data-testid="view-sessions"]').textContent).toContain('50%');
    expect(q('[data-testid="no-history"]')).toBeTruthy();
  });

  it('Live shows measured values from the SDK, or an em dash when there is none', () => {
    mount(makeObservatory());
    expect(q('[data-testid="value-pulse"]').textContent).toBe('72');
    click(q('[data-testid="nav-live"]'));
    act(() => root.render(<AppShell o={makeObservatory({ pulse: null, breathing: null })} />));
    expect(q('[data-testid="value-pulse"]').textContent).toBe('\u2014');
  });

  it('Signal Lab renders both waveforms and both confidence trends, with the shape-only caveat', () => {
    mount(makeObservatory(), 'lab');
    const t = q('[data-testid="view-lab"]');
    expect(t.querySelectorAll('canvas')).toHaveLength(4);
    expect(t.textContent).toContain('not a blood-pressure measurement');
    expect(q('[data-testid="explain"]')).toBeTruthy();
  });

  it('Diagnostics reports errors and key source but never any key', () => {
    mount(makeObservatory({ error: { kind: 'authentication', message: 'Key rejected.', retryable: false } as never }), 'diagnostics');
    const t = q('[data-testid="view-diagnostics"]').textContent ?? '';
    expect(t).toContain('Key rejected.');
    expect(t).toContain('keychain');
    expect(t).toContain('disabled'); // telemetry
  });

  it('Settings exposes credential status, consent controls and accessibility toggles; toggles apply', () => {
    const o = makeObservatory({ phase: 'idle' });
    mount(o, 'settings');
    expect(q('[data-testid="keybar"]')).toBeTruthy();
    expect(q('[data-testid="consent-state"]').textContent).toContain('granted');
    click(q('[data-testid="revoke"]'));
    expect(o.revokeConsent).toHaveBeenCalledTimes(1);
    click(q('[data-testid="pref-large"]'));
    expect(q('.shell').className).toContain('pref-large');
    click(q('[data-testid="pref-motion"]'));
    expect(q('.shell').className).toContain('pref-motion');
  });

  it('Settings blocks revoking consent while measuring', () => {
    mount(makeObservatory(), 'settings');
    expect(q<HTMLButtonElement>('[data-testid="revoke"]').disabled).toBe(true);
  });

  it('Live asks for a key (without showing key entry) when none is configured', () => {
    const o = makeObservatory({ phase: 'idle', cred: { source: 'none', canStore: true } });
    mount(o);
    expect(q('[data-testid="needs-key"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="key-input"]')).toBeNull();
    click(host.querySelector('[data-testid="needs-key"] button') as Element);
    expect(visibleViews()).toEqual(['view-settings']);
    expect(q('[data-testid="onboarding"]')).toBeTruthy();
  });
});
