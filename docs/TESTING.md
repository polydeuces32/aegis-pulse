# Testing

## Commands

```bash
npm install
npm run typecheck     # tsc for main/preload/shared/tests and for renderer/tests
npm test              # vitest run (188 tests in 18 files)
npm run build         # electron-vite build -> out/
npm run scan          # security scan (needs the build; reads .env only to check the key is not leaked)
npm audit             # dependency advisories
npm run check         # typecheck + tests + build + scan
```

`npm run scan` prints PASS/FAIL/SKIP lines and file paths only; it never prints the API key. If your `.env` has a development key, the scan also looks for that exact value in every file, in tracked-or-stageable files and in git history. If there is no `.env` or no key (a clean clone, CI, a judge's machine) those exact-value checks print SKIP and are not failures. Key-independent checks always run: hardening and IPC/credential structure, and secret-shaped strings (private-key blocks, AWS/GitHub/Slack/OpenAI-style tokens, `SMARTSPECTRA_API_KEY=<value>` assignments) in stageable files, in `out/` and in git history. Without a configured key the app itself refuses to measure (`missing-key`, no SDK created).

Optional real-Keychain check (uses a dummy key and a temporary directory, never your real key):

```bash
bash scripts/run-credential-e2e.sh
```

## Results at the time of writing

Environment: Apple Silicon Mac, macOS 26.6.2, Node v26.13.0, npm 11.20.0, Electron 43.8.7, SmartSpectra SDK 3.4.0.

| Check | Result |
| --- | --- |
| `npm run typecheck` | passes |
| `npm test` | 188 of 188 pass, 18 files |
| `npm run build` | succeeds |
| `npm run scan` | all checks pass |
| `npm audit` | 0 vulnerabilities |

Test files (tests per file): `securityScan` 14, `consentEnforcement` 17, `credentials` 23, `ipc` 14, `sdkSession` 14, `keystore-metrics` 11, `renderer-state` 12, `nativePrompt` 9, `readiness` 9, `lifecycle` 8, `reliability` 8, `sessionLog` 8, `timestamp-stats` 6, `viewSingleton` 5, `camera` 3, `paths` 3, `ui/shell` 19, `ui/navigation` 5.

## Methodology

- **Unit and integration tests (vitest).** The SDK is replaced with a fake that records calls, so the tests cover session logic, not the real SDK. Areas: IPC validation and sender trust (with a fake Electron `ipcMain`), consent and camera permission rules (fresh launch, restart, revocation, foreign senders, malformed arguments), credential storage and priority, metric extraction (never synthesizes values), timestamp anchoring, readiness and quality logic, session logging failures, camera error mapping, and a "second Start creates no second SDK" test.
- **UI tests (vitest + jsdom).** The real `AppShell` is rendered with a fake session controller whose actions are spies. They check view switching while running (same `<video>` node, no Start/Stop call), keyboard navigation (arrows, Home/End, Alt+digit), sidebar collapse, the always-visible RUNNING/IDLE indicator, Stop and disclaimer, and that the Sessions, Signal Lab, Diagnostics and Settings views render controller data. A source-scan test asserts there is one `useObservatory()` call, one `openCamera`, one `FramePump` and one `new SmartSpectraSDK`.
- **Live checks with the real SDK and camera** (development build, on the author's Mac, one person, one machine). Scripted checks drove the app through the Chrome DevTools port (read-only state queries, plus a passive in-page recorder); the consent, Start, navigation and Stop steps in the final run were performed by a person with the mouse.

## Verified live results

Final verified session (one run, 2026-11-08):

| Item | Observed |
| --- | --- |
| Launch | idle, consent false, camera off (video source empty) |
| Sequence in lifecycle log | `ready`, `consent true`, `starting`, `running`, then after about 7.8 minutes `stopping` and `idle` (about 0.7 s) |
| Session | exactly one session id and one `starting` event |
| Camera | one `<video>`, one video track, state `live` during the session; video source cleared after Stop |
| Navigation | all five views visited while RUNNING; same video node and same track throughout; phase stayed RUNNING |
| Duration | 467.7 s, end reason `stop` |
| Frames (session summary) | 13,955 received, 13,955 accepted; 0 invalid, 0 stale, 0 not-running, 0 SDK-rejected |
| Frame rate | 29.7–30.1 FPS accepted across 46 periodic samples (29.8 in the summary) |
| IPC transit | p50 3 ms, p95 3 ms, max 7 ms (rolling window of 300 frames); `sendFrame` p95 1 ms |
| Main-process memory | 346 MB at session end |
| Capture size | 1280×720 (earlier run) |

The last periodic log line before Stop showed 13,786 frames; the final summary shows 13,955. "Dropped frames: zero" covers invalid, stale, not-running and SDK-rejected frames in the main process; the renderer's busy-drop counter is shown in Diagnostics but was not recorded in the log.

Camera authorization probes (development build, IPC calls only):

| Probe | Result |
| --- | --- |
| Fresh launch state | `idle`, consent `false` |
| Start without consent | rejected in main (`kind: consent`) |
| `getUserMedia` without consent | `NotAllowedError` |
| Consent granted, no Start, `getUserMedia` | `NotAllowedError` |
| Start after consent revoked | rejected |
| Consent, then separate Start, then Stop | legitimate session, camera released |

## Local release-candidate package checks (`release/rc1`, 2026-11-08)

Build: `npm run build`, then `CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dir --arm64 --publish never --config.directories.output=release/rc1`. The package is unsigned (its ad-hoc seal does not verify: `codesign --verify` fails) and was launched anyway for testing only; it must not be distributed.

| Check | Result |
| --- | --- |
| Launches on macOS 26.6.2 arm64 | PASS |
| Own data folder (`~/Library/Application Support/Aegis Pulse`); development folder untouched (key file and 3 log files unchanged) | PASS |
| Started with `SMARTSPECTRA_API_KEY` set to a dummy value: key source `none`, i.e. the environment is ignored | PASS |
| Fresh state: IDLE, consent false, camera off, "needs key" callout, no consent card, no Start button | PASS |
| Start without consent rejected; `getUserMedia` without consent: `NotAllowedError` | PASS |
| Consent only, then `getUserMedia`: `NotAllowedError` | PASS |
| Consent but no key, then Start: rejected with `missing-key`, no session, camera stayed off | PASS |
| Packaged-store round trip with a dummy key: save, source `keychain`, remove, source `none` | PASS |
| Artifact scan: developer key value absent from every file; no `.env`, logs, `credentials.bin`, certificates, `.git*`, `spike`, `tests`, `docs`, `scripts`, `src`; only the macOS arm64 SDK payload; LGPL and SDK notice files present | PASS |
| Live camera session in the packaged build | NOT RUN (needs a real key entered by its owner) |
| Code signature valid / notarized | FAIL / not attempted (no identity; out of scope) |

## Fresh-clone check

See the D4 result below.

## What the readings mean, and what has not been validated

- **User-observed:** during the live runs the developer saw the app display pulse and breathing values that the SDK flagged as stable, with its own confidence scores, and saw the waveform views populated with SDK samples. That is an observation of the app working, not a measurement of accuracy. The values are not recorded in this repository.
- **Not validated:** the accuracy of pulse, breathing or waveforms against a reference device (ECG, pulse oximeter, chest belt) has **not** been tested. No claim of accuracy, sensitivity or clinical validity is made. The numbers are exactly what the SDK reports; Presage owns that algorithm.
- **Performance** figures come from one machine, one camera, one person, one 7.8-minute session, indoor lighting. They show that this app's frame pipeline kept up at about 30 FPS; they say nothing about other hardware.

## Limitations

- Fake-SDK tests do not exercise Presage's library; only the live checks do, and those were not automated.
- The live checks are not reproducible by script from this repository: the DevTools drivers and recorder used during review were scratch files and are not committed. A person can reproduce them by following [DEMO_SCRIPT.md](DEMO_SCRIPT.md) and reading `logs/lifecycle.jsonl`.
- The local release-candidate package (`release/rc1`) had a scripted launch check only; see the results below. The older `release/mac-arm64` build predates the permission fix and the five-view UI.
- Responsive layouts below about 860 px wide were checked through CSS and unit tests, not by eye.
- Network traffic of the SDK was not inspected.
- Only macOS arm64 was tested.
