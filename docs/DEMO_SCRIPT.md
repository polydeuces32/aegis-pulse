# Demo script (about 2 minutes)

Goal: show a live SmartSpectra signal, the consent flow, and clean camera release. Judges verify SDK use from the repository and the video ([challenge page](https://dev.to/challenges/presage-2026-11-04)), so keep the readings and the Diagnostics view on screen.

## Before recording

- `npm install`, key saved in Settings (Keychain). Never show the key; do not open `.env`.
- Quit other apps using the camera. Sit in steady, even light facing the camera, face and upper chest in frame.
- Window about 1296×900. Close notification popups. Record only your own face (or someone who has agreed).
- Do a full dry run first: pulse needs about 12 s and breathing about 30 s of stillness before they settle.
- Start from a fresh launch: `npm run dev`.

## Shots

| Time | Action (exact UI) | Say |
| --- | --- | --- |
| 0:00 | App open on **Live Monitor**. Point at the *Camera is off* label, the **IDLE** pill and the disabled **Stop & release camera** button. | "Aegis Pulse reads pulse and breathing from a webcam with Presage's SmartSpectra SDK. It starts idle with the camera off. Wellness information only, not a medical device." |
| 0:10 | Press **Alt+5** (Settings). Show *API key: Saved in the macOS Keychain* and the Privacy & consent list. | "The key lives in the macOS Keychain and never reaches the UI. The SDK also sends derived measurements to Presage; video never leaves the Mac. Telemetry is off." |
| 0:25 | Press **Alt+1** (Live Monitor). Tick *I consent to my camera being used for this session.* Press **Grant consent**. | "Consent is mine to give, per launch, and enforced in the main process." |
| 0:35 | Press **Start measuring**. Allow the macOS camera prompt if shown. | "Start is a separate step; only now does the camera open." |
| 0:45 | Show the readiness strip filling and the **RUNNING** pill. Wait for the pulse number (about 12 s). | "Readiness tells you what the SDK still needs, for example staying still." |
| 0:55 | Point at pulse: value, *How much to trust it*, *Steadiness*. (Breathing needs about 30 s; it is shown again at 1:35.) | "Values are exactly what the SDK reports, with its own confidence and a steady or still-settling flag. Nothing is filled in." |
| 1:05 | Press **Alt+2** (Signal Lab). Show the pulse waveform and breathing-motion waveform, then the confidence trends. | "These are the SDK's relative waveforms: shape only, not blood pressure." |
| 1:20 | Press **Alt+3** (Sessions), then **Alt+4** (Diagnostics). Point at FPS, IPC p95 and dropped frames. | "Switching views never restarts the camera or the SDK session. About 30 frames per second, a few milliseconds of IPC." |
| 1:35 | Press **Alt+1** (Live Monitor). Point at both pulse and breathing with their trust and steadiness lines. | "Same session, same camera stream: nothing restarted." |
| 1:45 | Press **Stop & release camera** in the top bar. Show **IDLE** and *Camera is off*. | "Stop is always one click away, from any view, and releases the camera." |
| 1:55 | Show the footer disclaimer. | "Wellness only: no diagnosis, no stress or emotion scores. Code and docs are in the repository." |

## Notes

- If pulse shows "—" or *Still settling*, keep still and avoid talking; do not cut the take to hide it.
- Do not claim accuracy. Say "what the SDK reports".
- Show the real consent step; do not pre-grant it off camera.
- After recording, check the video frames for the API key, personal data or notifications before publishing.

## Two-minute recording checklist

Tick every line before pressing record; each "Proof on screen" item is something a judge should be able to see.

### Preflight (not recorded)

- [ ] `npm run check` passes; no other Aegis Pulse window open (`Cmd-Q` any previous instance).
- [ ] Key already saved (Settings shows *Saved in the macOS Keychain*). `.env` and Keychain dialogs stay off screen.
- [ ] Fresh launch with `npm run dev`: top bar shows **IDLE**, Live Monitor says *Camera is off*.
- [ ] Camera free, steady light, face and upper chest in frame, nothing else personal visible behind you.
- [ ] Notifications off (Do Not Disturb), menu bar clean, window about 1296×900, system audio off if no voice-over.
- [ ] Screen recorder set to the app window only (not full screen).
- [ ] Know the order: Alt+5, Alt+1, consent, Start, Alt+2, Alt+3, Alt+4, Alt+1, Stop.

### Timed checklist

| Clock | Do | Proof on screen | Done |
| --- | --- | --- | --- |
| 0:00–0:10 | Show Live Monitor, point at IDLE and *Camera is off* | IDLE pill, disabled Stop | [ ] |
| 0:10–0:25 | Alt+5; show Keychain status line and the Privacy & consent list | text "Saved in the macOS Keychain", the sentence about derived measurements sent to Presage | [ ] |
| 0:25–0:35 | Alt+1; tick consent; **Grant consent** | checkbox ticked, consent granted | [ ] |
| 0:35–0:45 | **Start measuring** (allow macOS camera prompt if shown) | RUNNING pill, preview appears | [ ] |
| 0:45–1:05 | Wait for pulse; point at value, trust, steadiness; readiness strip | a pulse number with confidence and *Steady* or *Still settling* | [ ] |
| 1:05–1:20 | Alt+2 Signal Lab | pulse and breathing-motion waveforms moving | [ ] |
| 1:20–1:35 | Alt+3 Sessions, Alt+4 Diagnostics | FPS about 30, IPC p95 in ms, dropped counters | [ ] |
| 1:35–1:45 | Alt+1 | both pulse and breathing visible, same preview, still RUNNING | [ ] |
| 1:45–1:55 | **Stop & release camera** | IDLE, *Camera is off* | [ ] |
| 1:55–2:00 | Show footer disclaimer | "Wellness information only" | [ ] |

### After recording

- [ ] Watch the whole file: no API key, no `.env`, no Keychain dialog, no notifications, no other people, no private windows.
- [ ] The video does not claim accuracy, diagnosis or clinical use, and says measurements go to Presage.
- [ ] If pulse or breathing never settled, re-record rather than cutting; do not edit values.
- [ ] Export, then host it where the challenge accepts it (check the DEV template).
