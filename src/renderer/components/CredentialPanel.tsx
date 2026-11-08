import { useRef } from 'react';
import type { CredentialStatus, KeySource } from '../../shared/ipc';

const SOURCE_TEXT: Record<KeySource, string> = {
  keychain: 'Saved in the macOS Keychain (encrypted, this user only)',
  environment: 'From an environment variable (development builds only)',
  dotenv: 'From the project .env file (development builds only)',
  none: 'No API key configured',
};

interface Props {
  status: CredentialStatus | null;
  busy: boolean;
  locked: boolean;
  message: string | null;
  notice: string | null;
  onEnterNative: () => void;
  onSaveTyped: (key: string) => void;
  onImport: () => void;
  onRemove: () => void;
}

/**
 * Key entry. The in-app field is UNCONTROLLED on purpose: the typed value is read from the DOM once at submit,
 * the field is cleared immediately, and the value is never put in React state, storage or the URL.
 * Be honest about exposure: while typing, the key is visible to this window's JavaScript. The native dialog
 * (preferred) is owned by the main process, so the key never enters renderer JavaScript.
 */
function KeyEntry({ status, busy, onEnterNative, onSaveTyped, onImport }: Pick<Props, 'status' | 'busy' | 'onEnterNative' | 'onSaveTyped' | 'onImport'>): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const canStore = status?.canStore ?? false;

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    const el = inputRef.current;
    if (!el) return;
    const value = el.value;
    el.value = ''; // clear the field right away, before any async work
    onSaveTyped(value);
  };

  return (
    <div className="keyentry">
      <button type="button" className="primary" onClick={onEnterNative} disabled={busy || !canStore} data-testid="enter-native">
        Enter key securely (macOS dialog)
      </button>
      <p className="note">Recommended. A native macOS prompt run by the app&apos;s main process, so the key never enters this window&apos;s JavaScript.</p>

      <form onSubmit={submit} className="keyform" autoComplete="off">
        <label htmlFor="api-key-input">Or type the key here</label>
        <div className="keyrow">
          <input
            id="api-key-input" ref={inputRef} type="password" autoComplete="off" autoCorrect="off" autoCapitalize="off"
            spellCheck={false} placeholder="Paste your API key" disabled={busy || !canStore} data-testid="key-input"
          />
          <button type="submit" className="primary" disabled={busy || !canStore} data-testid="save-key">Save securely</button>
        </div>
        <p className="note">
          While you type here, the key is visible to this app window&apos;s JavaScript (it is cleared the moment you press Save, never stored in
          page state or storage, and saved only by the main process into the macOS Keychain). Use the macOS dialog above for the strongest isolation.
        </p>
      </form>

      <button type="button" className="ghost" onClick={onImport} disabled={busy || !canStore} data-testid="import-key">
        Import key from clipboard
      </button>
    </div>
  );
}

export function CredentialPanel(p: Props): JSX.Element | null {
  const { status } = p;
  if (!status) return null;
  const notice = p.notice && (
    <div className="banner ok" role="status" data-testid="credential-notice">{p.notice}</div>
  );
  const error = p.message && <div className="banner err" role="alert" data-testid="credential-error">{p.message}</div>;

  if (status.source === 'none') {
    return (
      <section className="consent" data-testid="onboarding" aria-labelledby="key-h">
        <h2 id="key-h">Connect your Presage API key</h2>
        <p className="note">
          Aegis Pulse needs your own free SmartSpectra API key from <strong>physiology.presagetech.com</strong>. It is stored encrypted in your macOS
          Keychain. Presage does not publish a key format, so the SmartSpectra service confirms it is valid when you press Start.
        </p>
        {!status.canStore && (
          <div className="banner err" role="alert">Secure storage is not available on this system, so a key cannot be saved safely.</div>
        )}
        {error}
        {notice}
        <KeyEntry status={status} busy={p.busy} onEnterNative={p.onEnterNative} onSaveTyped={p.onSaveTyped} onImport={p.onImport} />
      </section>
    );
  }
  return (
    <section className="keybar" aria-label="API key" data-testid="keybar">
      <span className="dotkey" aria-hidden="true" />
      <span>
        <strong>API key:</strong> {SOURCE_TEXT[status.source]}
      </span>
      <span className="keybar-actions">
        {status.source === 'keychain' && (
          <button className="ghost" onClick={p.onRemove} disabled={p.busy || p.locked}>Remove key</button>
        )}
      </span>
      {status.canStore && (
        <details className="keychange">
          <summary>{status.source === 'keychain' ? 'Replace key' : 'Save a key to the Keychain'}</summary>
          {p.locked ? <p className="note">Stop the measurement to change the key.</p> : (
            <KeyEntry status={status} busy={p.busy} onEnterNative={p.onEnterNative} onSaveTyped={p.onSaveTyped} onImport={p.onImport} />
          )}
        </details>
      )}
      {notice}
      {error}
    </section>
  );
}
