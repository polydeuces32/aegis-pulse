# Aegis Pulse — Human Signal Observatory

A macOS desktop app (Electron + React + TypeScript) that shows **pulse** and **breathing** readings, and the SDK's relative **pulse** and **breathing-motion waveforms**, from a webcam using the [Presage SmartSpectra SDK](https://smartspectra.presagetech.com/docs) (Node.js binding, v3.4.0).

> **Wellness information only.** Aegis Pulse is not a medical device and makes no diagnostic, treatment or health-decision claims. The SmartSpectra SDK metrics are described by Presage as general-wellness information that has not been cleared by the FDA. Readings can be wrong when you move, talk, or lighting flickers.

Status: **competition draft, not yet public.** Open items are listed in [docs/COMPETITION_SUBMISSION.md](docs/COMPETITION_SUBMISSION.md).

## Disclosures

- **Measurements are sent to Presage.** Per Presage's SDK Privacy Policy, the SDK sends derived measurements (for example pulse and breathing) and session metadata to Presage during a session, and uses an AI provider for "Insights"; images and video are not sent. SDK telemetry is off in this app, which Presage says does not stop this. I have not inspected the SDK's network traffic. See [docs/PRIVACY.md](docs/PRIVACY.md).
- **No clinical validation.** Accuracy of the readings has not been checked against any reference device. Wellness information only.
- **No compiled app is distributed.** The macOS packaging config here produces an **unsigned, un-notarized** local test build only, and Presage's redistribution terms are not confirmed in writing ([docs/LICENSE_REVIEW.md](docs/LICENSE_REVIEW.md)). Run from source.
- **The SmartSpectra SDK is proprietary Presage software.** It is not in this repository; `npm install` fetches it, and you need your own API key.

## What it does (implemented)

| Area | Behaviour |
| --- | --- |
| Live Monitor | Camera preview, pulse (SDK 12-second average) and breathing (SDK 30-second average) with the SDK's confidence and steady / still-settling flag, a readiness strip, SDK signal-quality hints, Start and Stop. |
| Signal Lab | Larger relative pulse waveform (last 10 s), breathing-motion waveform (last 20 s), confidence trends for both signals (last 2 min, 0–100 % scale), quality explanation. Samples are plotted as received; the app does no smoothing and generates no points. |
| Sessions | Counts and ranges of values the SDK reported in the current session, plus a list of finished sessions that lives in memory only until you quit. |
| Diagnostics | Frame rate, IPC latency (p50/p95), dropped frames, main-process memory, SDK phase, errors. |
| Settings | API-key onboarding (Keychain), privacy and consent controls, accessibility toggles. |
| Always visible | RUNNING / IDLE indicator, a Stop button that works from every view, and the wellness disclaimer. |

Switching views never stops or restarts the camera or the SDK session: the session controller is created once and the camera `<video>` element stays mounted.

## What it does not do

- No diagnosis, treatment advice, stress score, emotion or expression inference.
- HRV and other SDK metrics are not displayed.
- No readings, waveforms or video are written to disk.
- No account, backend, cloud storage or database of its own.

## Privacy in one paragraph

Camera frames are processed in memory on your Mac and are not saved by this app. The SDK talks to Presage's servers: it authenticates your key and, according to Presage's published SDK privacy policy, sends derived measurements (for example pulse and breathing rate) and session metadata to Presage; it does not send images or video. SDK usage telemetry is switched off in this app, but Presage states that turning it off does not stop authentication, model delivery or those measurement uploads. Details and sources: [docs/PRIVACY.md](docs/PRIVACY.md). Consent is asked every launch and is enforced in the Electron main process: see [docs/SECURITY.md](docs/SECURITY.md).

## Screenshots

No screenshots are committed yet. The files below are **placeholders, not real captures**; capture them yourself (without showing your face, readings or API key if you publish them) and replace the placeholders. See [docs/screenshots/README.md](docs/screenshots/README.md).

| View | Intended file |
| --- | --- |
| Live Monitor (running) | `docs/screenshots/live-monitor.png` — *placeholder* |
| Signal Lab | `docs/screenshots/signal-lab.png` — *placeholder* |
| Diagnostics | `docs/screenshots/diagnostics.png` — *placeholder* |
| Settings | `docs/screenshots/settings.png` — *placeholder* |

## Prerequisites

- Apple Silicon Mac (arm64) running macOS. Developed and tested on macOS 26.6.2 (arm64) only.
- Node.js 20 or newer (the SDK's `engines` requirement). Tested with Node v26.13.0 and npm 11.20.0.
- A webcam and permission for the app to use it.
- A free SmartSpectra API key from <https://physiology.presagetech.com/auth/login>.
- Network access to Presage (the SDK needs it to run).

## Start

```bash
git clone <repository-url> aegis-pulse     # replace with the public URL once published
cd aegis-pulse
npm install
npm run dev
```

Then open **Settings** (sidebar, or Alt+5) and choose **Enter key securely (macOS dialog)**. The key is stored in the macOS Keychain via Electron `safeStorage`. For development only you may instead put `SMARTSPECTRA_API_KEY=...` in a `.env` file (copy `.env.example`); a saved Keychain key always takes priority, and packaged builds ignore `.env`.

To measure: Live Monitor, tick the consent checkbox, **Grant consent**, **Start measuring**, then **Stop & release camera** when done. Full instructions and troubleshooting: [docs/INSTALLATION.md](docs/INSTALLATION.md).

Other commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development app with hot reload |
| `npm run build` then `npm start` | Production build, then run it via `electron-vite preview` |
| `npm run typecheck` | Type-check main and renderer |
| `npm test` | Run the test suite (188 tests) |
| `npm run scan` | Security scan (run after `npm run build`) |
| `npm run check` | Typecheck + tests + build + scan. Passes on a clean clone with no `.env` and no API key |
| `npm run pack` | Local unsigned arm64 build into `release/` (not for distribution) |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Installation](docs/INSTALLATION.md)
- [Security](docs/SECURITY.md)
- [Privacy](docs/PRIVACY.md)
- [Testing and verified results](docs/TESTING.md)
- [Demo script](docs/DEMO_SCRIPT.md)
- [Competition submission draft](docs/COMPETITION_SUBMISSION.md)
- [Release audit and submission checklist](docs/RELEASE_AUDIT.md)
- [DEV article draft](docs/DEV_ARTICLE_DRAFT.md)
- [SDK licence review](docs/LICENSE_REVIEW.md) (redistribution is **not** confirmed)
- [End-user terms (draft, for legal review)](docs/END_USER_TERMS.md)

## Licence

- **Original code in this repository: MIT**, Copyright (c) 2026 Giancarlo Vizhnay. See [LICENSE](LICENSE).
- **The Presage SmartSpectra SDK is not covered by that licence.** `@smartspectra/node-sdk` 3.4.0 is proprietary Presage software, made available under Presage's Terms of Service; it is **not** included in this repository (`npm install` fetches it) and you need your own API key. Its own licence and notice files stay inside the installed package (`node_modules/@smartspectra/node-sdk/`): `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.txt`, `THIRD_PARTY_FFMPEG.md` and the LGPL texts (the SDK runtime bundles FFmpeg under the LGPL plus Apache-licensed components). Using the SDK is subject to Presage's terms, not the MIT licence; see [docs/LICENSE_REVIEW.md](docs/LICENSE_REVIEW.md).
- Other dependencies keep their own licences (the production tree is MIT, BSD-3-Clause and Apache-2.0).
