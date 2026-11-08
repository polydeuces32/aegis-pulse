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
