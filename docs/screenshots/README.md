# Screenshots — shot list (placeholders until captured)

**No real screenshots are committed. Nothing in this folder is a real capture yet.** Capture them yourself on a build of the current commit, then add the files and update the README table. Do not edit values in an image.

## Capture rules

- Window size about 1296×900. Use `Cmd-Shift-4`, then `Space`, then click the app window (captures only that window).
- Run from a fresh launch (`npm run dev`) with the key already saved. Never show the key, `.env`, a Keychain or key-entry dialog.
- The camera preview shows a face. Either use someone who has agreed, or crop/blur the preview. Do not put pulse or breathing values in captions as accuracy claims.
- Check each file before committing: no notifications, other windows, usernames, or the clock if you want it neutral. Save PNG, under about 500 KB each.

## Required shots

| # | File | View and state | Must be visible | Must not be visible |
| --- | --- | --- | --- | --- |
| 1 | `01-live-idle-consent.png` | Live Monitor, IDLE, consent card shown | IDLE pill, *Camera is off*, the data-handling bullets incl. "derived measurements … to Presage", consent checkbox and Grant consent | Any face (camera is off) |
| 2 | `02-live-running.png` | Live Monitor, RUNNING, pulse and breathing both showing values | RUNNING pill, pulse and breathing with trust + steadiness, readiness strip, footer disclaimer | Identifiable face unless the person agreed |
| 3 | `03-signal-lab.png` | Signal Lab after about 60 s of running | Both waveforms and both confidence trends populated, the "not a blood-pressure measurement" note | Face (not in this view) |
| 4 | `04-sessions.png` | Sessions, with one finished session in the list | Current-session table and the earlier-sessions table, the "kept in memory only" note | — |
| 5 | `05-diagnostics.png` | Diagnostics while RUNNING | Phase, key source `keychain`, telemetry `disabled`, FPS, IPC p50/p95, dropped counters | — |
| 6 | `06-settings.png` | Settings, idle, key saved | Keychain status line (no key), Privacy & consent text, consent state, accessibility toggles | Key field contents, key-entry dialogs |

Optional: `07-stop-idle.png` (after Stop, IDLE and camera off) as a before/after pair with #2.

## After capturing

- [ ] Open every image at full size and read it for private data.
- [ ] `git status` shows only the six or seven PNGs plus the README table edit.
- [ ] Alt text for each image says what it shows, not what it proves (for example "Signal Lab showing the SDK's pulse and breathing waveforms").
