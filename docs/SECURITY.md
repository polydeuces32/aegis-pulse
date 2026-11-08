# Security

Scope: the Aegis Pulse desktop app on macOS. This is a self-review, not an independent audit.

## Assets and threat model

| Asset | Threats considered | Main controls |
| --- | --- | --- |
| SmartSpectra API key | Leak via renderer code, bundles, logs, git history, error messages, packaged app | Key lives only in the main process (`KeyHolder`/`Secret`, redacted when printed or serialized); stored encrypted with `safeStorage`; never sent over IPC; error text is redacted; security scan checks bundles and history |
| Camera | Camera turned on without the user's explicit consent and Start | Consent and Start enforced in the main process; camera permission policy requires both (below) |
| Video frames / readings | Persistence or disclosure by this app | Held in memory only; local logs hold counters and timings, never readings or frames |
| The app's own window | Script injection, navigation to remote content, abuse of IPC | Sandbox, context isolation, no Node in the renderer, CSP, sender validation |

Out of scope: a malicious process running as the same macOS user, a compromised macOS or Electron, the Presage service and its handling of data (see [PRIVACY.md](PRIVACY.md)), physical access.

## Credential handling

Key resolution order (`src/main/credentials.ts`):

1. A key saved in the per-user encrypted file `credentials.bin` (Electron `safeStorage`, backed by the macOS Keychain).
2. `SMARTSPECTRA_API_KEY` environment variable: **unpackaged runs only**.
3. A project `.env` file: **unpackaged runs only**.
4. None: the UI shows an "API key needed" prompt and Start is refused.

- A packaged app never reads the environment or `.env`, so a developer key cannot be picked up implicitly. This is covered by tests and by `scripts/run-credential-e2e.sh` (real `safeStorage`, dummy key, in a temporary directory).
- There is **no plaintext fallback**: if `safeStorage` is unavailable (or on Linux uses the `basic_text` backend) the key is not saved. The file is written atomically with mode 0600 in a 0700 directory.
- Entry paths: a native macOS hidden-input dialog run by the main process (preferred: the key never enters renderer JavaScript; static `osascript` script, no shell, key not in argv); clipboard import (clipboard cleared afterwards if unchanged); typed in-app field (an uncontrolled `<input type="password">` that is cleared on submit and never held in React state; **while typing, the key is visible to the page's JavaScript**).
- `reveal()` on the key is reachable only from `src/main/keystore.ts` and `src/main/sdkSession.ts` (checked by `npm run scan`).
- The key is passed to the SDK constructor once per session. It is not logged; the lifecycle log and session summaries contain no key.
- The key cannot be changed while a session is active.

## Window and IPC hardening

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webviewTag: false`, `webSecurity: true`; window-open and navigation are denied.
- The preload exposes a fixed, typed `window.aegis` API; no generic `ipcRenderer`.
- Every IPC handler requires the sender to be this window's main frame at an allow-listed URL, validates arguments (including strict frame validation and size limits), and returns secret-free data. Tests exercise foreign senders, sub-frames, unlisted URLs and malformed arguments.
- Production builds inject a strict CSP (`default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `connect-src 'none'`, no frames or objects). The development server runs without the CSP.
- The renderer uses no web storage (checked by the scan).

## Consent and camera enforcement

All enforcement is in the Electron main process (`src/main/sdkSession.ts`, `src/main/permissions.ts`, `src/main/index.ts`); React state is only a mirror.

- **Fresh launch:** phase `idle`, consent `false`, no SDK, camera off. Consent is not persisted anywhere, so a restart always starts without consent.
- **Start** is refused (`kind: consent`) unless consent is true in main, and refused unless the phase is `idle` or `error`; a second Start cannot create a second SDK.
- **Camera permission** (`allowCamera`/`allowCameraCheck`) is granted only if all hold: the request is for video only (never audio), it comes from our own page URL, consent is granted, **and** a session is `starting` or `running`. Consent alone does not open the camera. This closed a gap found during review: earlier, consent alone was enough for a page script to open the camera.
- **Order:** Start is requested before the camera is opened, so main can authorize the camera for a started session.
- **Stop** releases the frame pump and every camera track, then ends the SDK session. Consent cannot be revoked mid-session.
- **Audit trail:** every consent change, refused start and phase change is written to the local lifecycle log (event, time, session id; no readings).

## Verification performed

- Automated: 169 tests including consent and permission enforcement, direct IPC calls from untrusted senders, second-window senders, restart, revocation, and single-SDK-instance checks ([TESTING.md](TESTING.md)).
- Live (development build, macOS 26.6.2): fresh launch idle with consent false; Start without consent rejected; `getUserMedia` without consent denied; `getUserMedia` with consent but without Start denied; consent, then Start, then Stop gave one session, one camera track, and the track and video source were released. Details in [TESTING.md](TESTING.md).
- `npm run scan` asserts, among others: hardening flags, key absent from sources/bundles/git history, `.env` ignored, telemetry flag present, camera policy present.
- `npm audit`: 0 vulnerabilities at the time of writing.

## Known limitations

1. **No proof of a user gesture.** Main cannot distinguish a real click from a script or OS-level automation that calls the same IPC. A script inside the app's own page (excluded by the CSP in production builds) or software that can drive your desktop could grant consent and press Start. During review, real (trusted) input events from outside the app produced consent and Start; the app cannot tell whether a person or automation sent them. A native confirmation dialog on consent would raise the bar; it is not implemented.
2. **Typed key exposure.** The in-app key field exposes the key to renderer JavaScript during typing. Use the native dialog.
3. **Development key in `.env` is plaintext** on disk (git-ignored). Use the Keychain.
4. **Packaged builds are unsigned and not notarized.** No Developer ID identity is installed. The test build is ad-hoc signed. The entitlements (`build/entitlements.mac.plist`) include `allow-jit`, `allow-unsigned-executable-memory`, `disable-library-validation` (needed to load Presage's bundled libraries) and camera access.
5. **Packaged build shares the development user-data folder** (`~/Library/Application Support/aegis-pulse`), so on one machine it can find a key saved by the dev build.
6. **`asar` is disabled** in the test build because the SDK loads native libraries by path; app files are readable on disk.
7. **The SDK is native code with its own network access.** What it sends is governed by Presage; this app has not inspected the network traffic ([PRIVACY.md](PRIVACY.md)).
8. **Logs are not encrypted.** They contain counters and timings only, with 0600 permissions.
9. **A slow first-time macOS camera prompt** can exceed the 30-second SDK startup timeout, which then ends the session with a timeout error.
10. **The CSP applies to production builds only.**

Report a vulnerability by contacting the repository owner (add a contact in the public repository before submission).
