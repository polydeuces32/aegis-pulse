// Probes Electron safeStorage (macOS Keychain-backed) with a dummy string. Never touches the real API key.
const { app, safeStorage } = require('electron');
app.whenReady().then(() => {
  const out = { available: false };
  try {
    out.available = safeStorage.isEncryptionAvailable();
    out.backend = safeStorage.getSelectedStorageBackend ? safeStorage.getSelectedStorageBackend() : 'n/a (macOS Keychain)';
    if (out.available) {
      const enc = safeStorage.encryptString('dummy-probe-value');
      out.roundTrip = safeStorage.decryptString(enc) === 'dummy-probe-value';
      out.ciphertextHasPlaintext = enc.includes(Buffer.from('dummy-probe-value'));
    }
  } catch (e) {
    out.error = String(e && e.message ? e.message : e).slice(0, 200);
  }
  console.log('PROBE ' + JSON.stringify(out));
  app.quit();
});
