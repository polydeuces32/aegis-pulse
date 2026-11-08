// End-to-end check of CredentialService with the REAL macOS Keychain (safeStorage) and REAL clipboard.
// Uses a dummy key and a temp directory. Run via scripts/run-credential-e2e.sh (bundles TS first).
const { app, safeStorage, clipboard } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CredentialService, CredentialStore } = require(process.env.CRED_BUNDLE);
const { KeyHolder } = require(process.env.KEYSTORE_BUNDLE);

app.whenReady().then(() => {
  const r = {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegis-e2e-'));
  const file = path.join(dir, 'credentials.bin');
  const DUMMY = 'e2e-dummy-key-' + Date.now().toString(36) + 'ABCDEF';
  const holder = new KeyHolder();
  const mk = (packaged) => new CredentialService({
    store: new CredentialStore(file, safeStorage), holder, env: { SMARTSPECTRA_API_KEY: 'ENV-DEV-KEY-0123456789' },
    projectRoot: dir, packaged, clipboard, canChange: () => true,
  });
  try {
    let svc = mk(false);
    svc.resolve();
    r.beforeImportSource = svc.status().source;           // environment (dev only, explicit)
    clipboard.writeText(DUMMY);
    r.importResult = svc.importFromClipboard().ok;
    r.sourceAfterImport = svc.status().source;             // keychain
    r.holderHasDummy = holder.reveal() === DUMMY;
    r.clipboardClearedAfterImport = clipboard.readText() === '';
    const raw = fs.readFileSync(file);
    r.fileExists = true;
    r.fileMode = (fs.statSync(file).mode & 0o777).toString(8);
    r.plaintextOnDisk = raw.includes(Buffer.from(DUMMY));
    // "next launch", packaged: must come from the keychain store, and never from env
    const holder2 = new KeyHolder();
    const svc2 = new CredentialService({ store: new CredentialStore(file, safeStorage), holder: holder2, env: { SMARTSPECTRA_API_KEY: 'ENV-DEV-KEY-0123456789' }, projectRoot: dir, packaged: true, clipboard, canChange: () => true });
    svc2.resolve();
    r.packagedRestartSource = svc2.status().source;
    r.packagedRestartKeyMatches = holder2.reveal() === DUMMY;
    r.removeResult = svc2.remove().ok;
    r.packagedAfterRemoveSource = svc2.status().source;    // none: no silent developer fallback
    r.fileGoneAfterRemove = !fs.existsSync(file);
  } catch (e) {
    r.error = String(e && e.message || e).slice(0, 200);
  }
  console.log('E2E ' + JSON.stringify(r));
  app.quit();
});
