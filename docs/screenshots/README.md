# Screenshots — compositions and privacy checklist

**Six publication-ready screenshots are committed in [`publication/`](publication/)** (`01-consent.png`, `02-live-running.png`, `03-signal-lab.png`, `04-sessions.png`, `05-diagnostics.png`, `06-settings.png`). Only the camera preview in 02 was altered (opaque panel); no value, waveform or label was edited. Raw captures stay outside the repo (`~/Pictures/aegis-originals/`, which includes one with a face) and must never be committed. The sections below are the composition guide and checklist for re-capturing.

## Capture setup

- Same setup as the demo: fresh `npm run dev`, Focus mode on, app in full screen (Control-Command-F), key already saved.
- Capture the whole screen with Shift-Command-3 (full-screen mode means only the app is in it), or one window with Shift-Command-4, Space, click. Save outside the repo first (for example `~/Pictures/aegis`), check, then copy in.
- Views: Alt+1 Live Monitor, Alt+2 Signal Lab, Alt+3 Sessions, Alt+4 Diagnostics, Alt+5 Settings.
- Take shots 2–5 from one running session so the numbers are consistent; shot 1 and 6 need no camera.

## The six compositions

| # | File | Capture when | Composition (what fills the frame) | Visible proof | Must not be visible |
| --- | --- | --- | --- | --- | --- |
| 1 | `01-consent.png` | Fresh launch, before consent | Live Monitor, full window: left the idle preview area ("Camera is off"), the consent card with its four bullets and the unticked checkbox | IDLE pill, "Camera is off", the bullet that the SDK sends derived measurements and session metadata to Presage, Grant consent button | — (camera is off) |
| 2 | `02-live-running.png` | About 60–90 s after Start, when pulse AND breathing both show | Live Monitor, full window: preview (cover it, see below), pulse and breathing rings, trust and steadiness lines, readiness strip, footer | RUNNING pill, both readings with "How much to trust it" and "Steadiness", readiness strip, footer disclaimer | Your face (cover the preview) |
| 3 | `03-signal-lab.png` | Same session, after 60 s or more | Signal Lab, full window: four panels (pulse waveform, breathing motion, pulse and breathing confidence) populated, the "not a blood-pressure measurement" note, "How to read these numbers" | Waveforms with data, shape-only wording | — |
| 4 | `04-sessions.png` | After one Stop and a second short session, or after one finished session | Sessions, full window: current-session table (SDK updates, steady share, range, latest) and the "Earlier sessions in this app run" table with one row, and the memory-only note | Table headers, the "kept in memory only" sentence | — |
| 5 | `05-diagnostics.png` | While RUNNING, 30 s or more after Start | Diagnostics, full window: SDK state panel (phase, consent, key source, telemetry), Errors panel, Pipeline table | `Telemetry disabled`, FPS about 30, IPC p50/p95, dropped counters | — |
| 6 | `06-settings.png` | Idle, key saved | Settings, full window: "API key & Keychain" bar (no key text), Privacy & consent block, consent state, accessibility toggles | "Saved in the macOS Keychain", the Presage data-transfer sentence | The key-entry field contents, any key dialog, Replace-key section expanded |

Alt text suggestions (describe, do not claim accuracy): 1 "Aegis Pulse before consent: camera off, consent notice listing what is sent to Presage"; 2 "Live Monitor while measuring, showing SDK pulse and breathing values with confidence and steadiness"; 3 "Signal Lab with the SDK's relative pulse and breathing waveforms"; 4 "Sessions view with this session's SDK update counts"; 5 "Diagnostics view with frame rate and latency counters"; 6 "Settings view with Keychain status and privacy notes".

## Covering the camera preview (shot 2 only)

Use a solid rectangle, not blur. Find the preview rectangle (x, y, width, height in image pixels), then:

```bash
ffmpeg -i 02-raw.png -vf "drawbox=x=X:y=Y:w=W:h=H:color=0x0b0f14@1:t=fill" 02-live-running.png
```

(or Markup in Preview → Rectangle, filled, opaque). Open the result at 100 % and confirm no part of a face remains. Delete the raw capture when done.

## Privacy checklist (every image)

- [ ] Opened at full size and read for: key text, `.env`, key-entry or Keychain dialogs, notifications, menu-bar items, other windows, user name, file paths.
- [ ] Camera preview fully covered in shot 2 (and absent in 1 and 6).
- [ ] Numbers are as the app showed them; no captions that call them accurate, correct or medical.
- [ ] PNG, about 1440 px wide or more, under about 500 KB each if possible.
- [ ] `git status` shows only the six PNGs plus the README edit; no raw captures, no recordings.
- [ ] Never run the native key-entry dialog or open the Replace-key section while capturing.
