# Demo plan — silent, two minutes

A silent screen recording of the real app, with short text captions and no narration, no microphone and no footage of you. Everything on screen is authentic Aegis Pulse; the only additions are captions and a solid privacy panel over the camera preview (see "Privacy design").

Files: this plan, [`docs/demo/captions.srt`](demo/captions.srt) (caption text and target timings), [`docs/demo/render-demo.sh`](demo/render-demo.sh) (adds the preview mask and captions and strips all audio). Screenshots: [screenshots/README.md](screenshots/README.md).

## Privacy design

- **No footage of the developer.** The Live Monitor preview shows whoever is in front of the camera. After recording, the preview rectangle is covered by a solid panel reading "Camera preview hidden for privacy" for every moment the Live Monitor is on screen. The caption at shot 6 says so. A weak blur is not used: it can leave a face recognizable.
- **No microphone.** Record with the microphone set to None, and the render step removes every audio stream anyway.
- **No key, no private logs.** The app never renders the key (only "Saved in the macOS Keychain"), and none of the five views shows file paths, logs or your user name; Diagnostics shows counters and timings only. Hide the key-entry dialog (never open it while recording), the terminal and `.env`.
- **Record only the app.** Use full-screen mode so the desktop, menu bar and Dock are not in the recording.

## Environment and safe macOS recording steps

Do these once, before the rehearsal.

1. **Fresh launch from source:** quit every Aegis Pulse instance (Cmd-Q), then `npm run dev`. A fresh launch is IDLE with no consent, so the consent card appears on Live Monitor. The Settings view must already show your key as saved in the Keychain; if it asks for a key, add it in Settings now, off camera and not recorded.
2. **First-camera prompt:** if macOS has never allowed the camera for this app, the system prompt (it will say "Electron" in development) appears at the first Start. Clear it in the rehearsal, not in the take.
3. **Quiet the Mac:** turn on a Focus mode / Do Not Disturb, quit chat, mail and browser windows, hide any menu-bar items you do not want seen.
4. **Full-screen the app:** click the green button (or Control-Command-F). Only the app is visible; the menu bar and Dock hide.
5. **Light and framing:** steady, even front lighting, face and upper chest in frame, plain background. You will sit still for about a minute and a half; avoid talking.
6. **Screen recorder (no microphone):** press Shift-Command-5 → *Options* → set **Microphone: None**, choose a **Save to** folder **outside this repository** (for example `~/Movies`), turn *Show Mouse Clicks* on if you like, timer off. Choose **Record Entire Screen** and click **Record**.
7. **Stop:** press Control-Command-Esc (the menu-bar stop icon is hidden in full screen).
8. **Trim:** open the file in QuickTime Player and trim only the first and last moments (Edit → Trim) so it starts on the Live Monitor and ends on the disclaimer shot. Do not cut or speed up the middle.
9. **Keep recordings out of Git:** `.gitignore` now ignores `*.mov`, `*.mp4`, `*.m4v`, `*.webm`, `*.wav` and `recordings/`.

## What needs you (manual camera interaction)

I will not turn the camera on. You must: grant consent (checkbox + button), press Start, allow any macOS camera prompt, sit still facing the camera while the readings settle, press Stop. The five Alt-key view changes and the clicks are yours as well. Rehearse once without recording so the timing is natural.

## Shot-by-shot plan (120 s)

Keys: Alt+1 Live Monitor, Alt+2 Signal Lab, Alt+3 Sessions, Alt+4 Diagnostics, Alt+5 Settings. Target times are for the finished video; real readings take as long as they take, so the captions are re-timed to your actual recording before rendering (below). Captions are 2 lines, shown for at least 5 s.

| # | Time | Your action | On screen (proof) | Caption (exact text in `captions.srt`) |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:08 | Do nothing. Live Monitor, fresh launch. | IDLE pill, *Camera is off*, the consent card, disabled Stop | "Aegis Pulse: pulse and breathing from a webcam, using the Presage SmartSpectra SDK" then "Camera is off. Nothing runs until you consent." |
| 2 | 0:08–0:22 | Alt+5. Hold. Slowly move the pointer along the "API key" line and the Privacy & consent list. | "Saved in the macOS Keychain"; the sentences about derived measurements going to Presage and telemetry off | "Your API key lives in the macOS Keychain and is never shown in the app" then "Video stays on this Mac. The SDK sends derived measurements (pulse, breathing) and session metadata to Presage. Telemetry is off." |
| 3 | 0:22–0:32 | Alt+1. Tick the consent checkbox, press **Grant consent**. | Consent card, ticked box, Start button appears | "Consent is explicit, asked on every launch, and enforced in the app's main process" |
| 4 | 0:32–0:42 | Press **Start measuring** (allow the macOS prompt in the rehearsal, not here). | RUNNING pill, preview (masked in post), readiness strip filling | "Start is a separate step. Only now does the camera open. (Camera preview hidden for privacy.)" |
| 5 | 0:42–0:51 | Sit still. Point at the readiness strip. | Readiness text and progress bars | "Readiness shows what the SDK still needs: stay still and face the camera" |
| 6 | 0:51–1:00 | Point at pulse: value, *How much to trust it*, *Steadiness*. | A pulse number with trust and steady/still-settling | "Values are the SDK's own, with its confidence and a steady / still-settling flag. Nothing is filled in." |
| 7 | 1:00–1:14 | Alt+2. Hold. | Both waveforms and confidence trends moving | "Signal Lab: the SDK's relative waveforms, plotted as received. Shape only, not blood pressure." |
| 8 | 1:15–1:25 | Alt+3. Hold. | Current-session table with SDK update counts | "Sessions: counts from this session only. Kept in memory, discarded when you quit." |
| 9 | 1:25–1:35 | Alt+4. Hold. | FPS, IPC p50/p95, dropped counters, telemetry *disabled* | "Diagnostics: live frame rate, IPC latency and dropped-frame counters" |
| 10 | 1:35–1:45 | Alt+1. Point at both readings. | Pulse and breathing both showing, still RUNNING, same preview | "Switching views never restarts the camera or the SDK session" |
| 11 | 1:45–1:55 | Press **Stop & release camera** (top bar). | STOPPING then IDLE, *Camera is off* | "Stop & release camera: one click, from any view. Back to IDLE, camera off." |
| 12 | 1:55–2:00 | Hold; footer disclaimer visible. | "Wellness information only…" footer, IDLE | "Wellness information only. Not a medical device. Not clinically validated. Measurements are sent to Presage." |

Rules for captions: only claim what is visible. If breathing has not settled by shot 10, extend shot 5–6 rather than caption it as settled. Do not caption any number as "accurate" or "correct". If Diagnostics shows any dropped frames, the caption already makes no "zero dropped" claim, so leave it.

## Produce the file (after you record)

1. Send me the path of your trimmed recording, or run these yourself. Measure the preview rectangle on one Live Monitor frame: `PREVIEW_BOX=x:y:w:h` in the recording's pixels.
2. List the Live Monitor intervals in seconds (shots 1, 3–6, 10–12 normally): `LIVE_SEGMENTS="0-8,22-51,95-120"`.
3. Re-time `docs/demo/captions.srt` to the actual moments (I can do this from the frames).
4. Render:
   ```bash
   PREVIEW_BOX=x:y:w:h LIVE_SEGMENTS="0-8,22-51,95-120" \
     docs/demo/render-demo.sh ~/Movies/raw.mov ~/Movies/aegis-pulse-demo.mp4
   ```
   `ffmpeg` is required (`brew install ffmpeg`, or set `FFMPEG=`). Output is H.264, video only. The script was tested on a synthetic test pattern (mask on/off windows, captions, audio stripped); it has not been run on real footage.
5. Verify: `ffprobe -v error -show_entries stream=codec_type -of csv=p=0 aegis-pulse-demo.mp4` must print only `video`.

## QA checklist before publishing

- [ ] Watch the whole video at full size: no key, no `.env`, no dialog with a key, no notifications, no other windows, no terminal, no user name.
- [ ] The preview mask covers the camera preview in every Live Monitor frame (scrub shots 1, 3–6, 10–12).
- [ ] No audio stream; no voice; no face.
- [ ] The Settings shot shows the sentence that derived measurements are sent to Presage, and the final caption repeats it.
- [ ] No caption claims accuracy, diagnosis, stress, emotion or clinical use.
- [ ] Pulse and breathing values on screen came from this recording session (not edited).
- [ ] Length 2:00 or less; captions readable on a phone-size player.
- [ ] Raw recording kept outside the repository; delete the raw copy (it contains your face) only when you decide to.
