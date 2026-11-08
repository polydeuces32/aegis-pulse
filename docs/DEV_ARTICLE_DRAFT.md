# DEV article draft — Presage SmartSpectra SDK Challenge

> **Draft, unpublished.** Resolve the TODO items, copy the official DEV submission template headings from the [challenge page](https://dev.to/challenges/presage-2026-11-04) (the template is only visible in the DEV new-post editor), and tick the blockers in [RELEASE_AUDIT.md](RELEASE_AUDIT.md) before posting. Every statement below is backed by this repository or by a cited source; do not add claims that are not.
> Required tag: `#presagechallenge`. DEV allows a limited number of tags per post; check the limit when posting.

---

# Aegis Pulse: a consent-first pulse and breathing observatory for the Mac

*Wellness information only. Not a medical device. Not clinically validated.*

## What I built

Aegis Pulse is a macOS desktop app (Electron, React, TypeScript) that turns a webcam into a live view of two signals from the Presage SmartSpectra SDK (Node.js binding, v3.4.0):

- **Pulse**, the SDK's 12-second average, and **breathing**, its 30-second average, each with the SDK's own confidence score and its steady / still-settling flag.
- The SDK's **relative pulse waveform** and **breathing-motion waveform**, plotted exactly as received (no smoothing, no generated points), plus confidence trends over the last two minutes.
- A **readiness strip** and SDK-driven **signal-quality hints** that say what the SDK is still waiting for (for example, staying still while the averaging windows fill).
- Five views (Live Monitor, Signal Lab, Sessions, Diagnostics, Settings), a persistent RUNNING/IDLE indicator, and a Stop button reachable from every view.

It deliberately does **not** compute stress scores, emotions or anything diagnostic, and it shows only what the SDK reports.

**Demo video:** TODO: add the hosted link (the video is rendered locally and not uploaded yet).  
**Code:** TODO: confirm and link the public repository once published. Planned URL: <https://github.com/polydeuces32/aegis-pulse> (not yet verified as published).  
**Screenshots:** the six images in `docs/screenshots/publication/` (upload them to DEV; alt text suggestions are in `docs/screenshots/README.md`)

## About the demo video

A silent (no audio track), 50.53-second screen recording, cropped to the app window, with captions added afterwards. What it shows, and what it does not:

- **It starts with a session that is already RUNNING** (timer 00:02). The recording does **not** show the consent step or the Start click; those are described in this post and shown in the screenshots (the consent notice and the Settings privacy block). I did not stage or fake them.
- **Live SDK signal:** pulse appears at about 9.5 s and shows 92 to 93 BPM, labelled stable by the SDK, until Stop. These are the values the SDK reported, not validated against any reference device.
- **Breathing is preliminary.** The first reading (17 breaths/min) appears at about 8.5 s and drifts to 14 during the clip; the app labels it "Preliminary, not yet stable" the whole time, and so does the video. I do not call it stable.
- **Stop:** the video shows *Stop & release camera* (at about 15.7 s): the camera turns off and the status returns to IDLE. The remaining time shows Signal Lab, Settings, Diagnostics and Sessions after Stop.
- **Camera preview hidden:** an opaque panel covers the camera preview in every frame where it was visible, so no face appears in the video. The panel is a post-production edit and is labelled as such.
- **Privacy line on every frame:** derived measurements (pulse, breathing) and session metadata are transmitted to Presage.

## How SmartSpectra is used

The SDK runs in the Electron **main process** in custom-input mode. The renderer opens the camera and sends frames (about 30 FPS at 1280×720) over validated IPC; the main process calls `sendFrame`, decodes the SDK's metric packets, and forwards the latest pulse and breathing samples and waveform points unchanged. Architecture and the frame flow are in `docs/ARCHITECTURE.md`.

## Consent and Data Handling

- **Camera consent.** The camera is off at launch. You tick a consent checkbox, press *Grant consent*, and then separately press *Start measuring*. Consent is kept only in the main process's memory, is asked again on every launch, and can be revoked. The main process refuses Start without consent and denies the camera permission unless consent is granted **and** a session is active. *Stop & release camera* ends the session and releases every camera track.
- **Video.** Frames are processed in memory on your Mac. The app does not save or upload them. According to Presage's SDK Privacy Policy, camera images and video are not sent to Presage either.
- **Measurements are sent to Presage.** According to Presage's SDK Privacy Policy (effective November 3, 2026), the SDK sends derived measurements (such as pulse and breathing rate) and session metadata to Presage during a session so Presage can generate AI "Insights" with an AI provider; Presage states this is automatic and cannot currently be turned off, and that it also authenticates the app and delivers models. **I have not inspected the SDK's network traffic myself**; this description relies on Presage's published policy.
- **SDK telemetry** is disabled in the app (`enableTelemetry: false`). Presage states that turning telemetry off does not turn off authentication, model delivery or Insights.
- **Local storage.** The only things written to disk are your API key (encrypted with Electron `safeStorage`, i.e. the macOS Keychain) and bounded local logs that contain counters and timings only: no readings, no waveforms, no frames. Finished-session summaries shown in the Sessions view live in memory and disappear when you quit. You can delete the logs and the stored key at any time.
- **Sharing and AI use by this app:** none. There is no backend, no analytics and no account. The only AI service involved is Presage's, as described above.
- Adults only (18+). Measure only yourself or people who have agreed.

Details and sources: `docs/PRIVACY.md`, `docs/SECURITY.md`.

## What is verified, and what is not

Verified on one Apple Silicon Mac (macOS 26.6.2), one person, one camera:

- A real-camera session of 467.7 seconds: 13,955 of 13,955 frames accepted, none dropped for invalid, stale or SDK-rejected reasons, about 30 FPS, IPC p95 of 3 ms; one SDK session and one camera track throughout, including while I navigated all five views; the camera released on Stop.
- 188 automated tests pass (consent and camera-permission enforcement, IPC validation, credential storage, UI navigation, and more), typecheck and build pass, the security scan passes, and `npm audit` reports 0 vulnerabilities.

**Not verified:** the accuracy of the pulse and breathing values. I did not compare them with a reference device, so I make no accuracy or clinical claim. They are exactly what the SDK reports. Test details and limits: `docs/TESTING.md`.

## Honest limitations and disclosures

- **Not a medical device.** Wellness information only; no diagnosis, treatment or health decisions. Presage describes the SDK metrics the same way and says they are not FDA-cleared for diagnosis.
- **No clinical validation** of the readings (see above).
- **Unsigned macOS packaging.** There is no Developer ID signature and no notarization. A local unsigned test build exists but is not distributed; the supported way to run the app is from source.
- **Redistribution is not confirmed.** Presage's Terms of Service §29.1 appears to allow integrating and distributing the SDK in an app with your own key, but the grant is revocable and I have no written confirmation, so this project shares **source only** and does not distribute a compiled app or the SDK. You install the SDK from npm with your own free key.
- **Consent has no proof of a user gesture.** The main process enforces consent and Start, but cannot tell a real click from software that drives the UI.
- Responsive layouts below about 860 px wide were not checked visually; only macOS arm64 was tested.

## Try it (for judges)

You need your own free SmartSpectra API key: <https://physiology.presagetech.com/auth/login>. I am not sharing a key, because keys must stay confidential.

```bash
git clone https://github.com/polydeuces32/aegis-pulse.git   # planned URL; TODO: confirm once published
cd aegis-pulse
npm ci
npm run dev
```

Open **Settings**, choose *Enter key securely (macOS dialog)* and paste your key. Then **Live Monitor** → tick consent → *Grant consent* → *Start measuring*, sit still facing the camera (pulse after about 12 s, breathing after about 30 s), and press *Stop & release camera* when done. Full instructions: `docs/INSTALLATION.md`.

## Prize categories

- **Best Thoughtful Real-World Use:** consent enforced in the main process, honest data handling, a UI that never invents or smooths readings.
- TODO (decision): *Most Creative or Delightful Use*: claim only if there is a genuine creative hook; otherwise leave it out.

## Credits

Presage SmartSpectra SDK (proprietary; not included in the repository), Electron, React, Vite, Vitest. Built with AI coding assistance, which the challenge allows. TODO (optional): if you embed an agent session, check the transcript for keys and personal data first.

## TODO before posting

- [ ] Host the silent demo video and add its link (not uploaded).
- [ ] Confirm the repository is public and add its URL (planned: https://github.com/polydeuces32/aegis-pulse).
- [ ] Confirm on the challenge page that submissions are still open (due November 22, 2026, 11:59 PM PST; the page header read "Challenge Status: Live Ended").
- [ ] Copy the official DEV template headings and tag `#presagechallenge`.
- [ ] Email support@presagetech.com for written confirmation of Terms of Service §29.1 (SDK redistribution); not needed for source-only, needed before distributing any compiled app.
- [ ] End-user terms ([END_USER_TERMS.md](END_USER_TERMS.md)) remain a draft for legal review; the `[contact]` field is intentionally unresolved.
- [ ] Re-read the final post and video for any diagnosis, treatment or accuracy claim.
