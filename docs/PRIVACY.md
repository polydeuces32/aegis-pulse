# Privacy

This document describes what Aegis Pulse does with camera and measurement data, and what the SmartSpectra SDK it embeds does according to Presage's published documents. It is not legal advice.

**Wellness information only.** Aegis Pulse is not a medical device. It does not diagnose, treat or support health decisions. Presage states that SDK metrics are for general wellness and informational purposes, have not been cleared by the FDA, and may not be used for medical diagnosis or treatment. The app is for people aged 18 or older; Presage's terms prohibit using the SDK with anyone under 18.

## Camera consent

- The camera is off at launch. Nothing is requested from macOS until you have granted consent **and** pressed Start.
- On Live Monitor you must tick *"I consent to my camera being used for this session."* and press **Grant consent**, then press **Start measuring** as a separate step. The notice shown before consent lists the data handling below.
- Consent is stored only in the main process's memory. It is never written to disk and ends when you quit; you are asked again on every launch. You can revoke it in Settings while idle.
- The main process enforces this: it refuses Start without consent and denies the camera permission unless consent is granted and a session is active ([SECURITY.md](SECURITY.md)).
- **Stop & release camera** stops the frame pump and every camera track. Measure only yourself, or people who have agreed; Presage's terms require notice and consent for anyone you measure.

## Data flow

| Data | Where it goes | Stored by this app? |
| --- | --- | --- |
| Camera frames | Captured in the app window, sent in memory to the app's main process, handed to the SDK's native library on your Mac | No. Not written to disk. |
| Frames or images to Presage | Per Presage's SDK Privacy Policy, camera images and video are processed on the device and not sent to Presage; face-derived data (landmark positions, colour values) is computed on the device and not sent | — |
| Derived measurements (pulse, breathing, HRV and similar) and session metadata | **Sent by the SDK to Presage** during sessions, per the SDK Privacy Policy section 4.2, so Presage can generate "Insights" with an AI provider. The policy says Insights are generated automatically during SDK sessions and cannot currently be turned off by developers or end users | Not by this app |
| API key, app credentials, attestation token, hashed device identifiers, SDK version, IP address | Sent to Presage to authenticate and to deliver models (policy 4.3) | The key is stored encrypted in your Keychain |
| SDK usage telemetry | **Disabled** in this app (`enableTelemetry: false`). Presage states that turning it off does not turn off authentication, model delivery or Insights | — |
| Readings and waveforms shown in the UI | Renderer memory only (bounded to the last few minutes); the Sessions list of finished sessions is in memory and is discarded when you quit | No |

Aegis Pulse itself sends no data to any server other than through the SDK, contains no analytics, and has no backend. The production Content-Security-Policy sets `connect-src 'none'` for the app window.

**Not independently verified:** I have not captured the SDK's network traffic, so the statements about what the SDK sends rely on Presage's published policy and documentation, not on observation. Before submitting, consider checking with a network monitor and re-reading the current policy.

## Local files

| File | Contents | Retention |
| --- | --- | --- |
| `credentials.bin` | Your API key, encrypted by `safeStorage` (Keychain) | Until you press *Remove key* or delete it |
| `logs/lifecycle.jsonl` (+ one rotated copy) | Timestamps, session id, consent changes, refused starts, phase changes, per-10-second pipeline stats (FPS, latency, frame counts, memory) | Rotates at 256 KiB; at most about twice that on disk |
| `logs/session-<time>-<id>.json` | One counters-only summary per session: duration, end reason, frame counts, latency, and counts of SDK samples (not their values) | Newest 50 kept |

Locations: development runs write to `<project>/logs/`; packaged runs to `~/Library/Application Support/aegis-pulse/logs/`. The files hold no video, no frames, no pulse or breathing values and no waveform samples. They are not encrypted and are created with mode 0600. The app never deletes them for you and never uploads them. To remove everything: delete the `logs` folder and use *Remove key*.

## What Presage says about retention (SDK Privacy Policy, effective November 3, 2026, as retrieved on the date below)

- Insights requests and responses: kept while the developer account is active, deleted within 60 days after it closes.
- Usage records and telemetry: up to 365 days. Logs: up to 365 days; security and audit records up to seven years. Backups expire within 90 days.
- Presage says it does not use end-user measurements, prompts or Insights for marketing, does not use personal information to train its models, and uses only de-identified information for training or research.
- The SDK Privacy Policy lists Amazon Web Services (hosting) and Anthropic, PBC (Insights) among service providers.

Policy and terms can change; read the current versions: <https://presagetech.com/legal/privacy-policy> and <https://smartspectra.presagetech.com/docs/telemetry-and-privacy>. Accessed 2026-11-08.

## Your choices

- Don't grant consent, or Stop, at any time.
- Revoke consent (Settings, while idle) or quit the app.
- Remove the stored key (Settings → Remove key) and delete the local logs.
- Contact Presage about data it holds: <support@presagetech.com> (address from the SDK package licence file).
