# Architecture

Aegis Pulse is an Electron app with three isolated parts. The camera is opened in the renderer; the SmartSpectra SDK, the API key and all authorization decisions live in the main process.

```
 Renderer (sandboxed, contextIsolation)           Preload                Main process (Node)
 ───────────────────────────────────────          ───────────            ─────────────────────────────────────
 React UI (five views)                             contextBridge          registerIpc()  ← validates every call
 useObservatory()  ← the ONE session controller    window.aegis  ───────► SdkSession     ← phase machine, consent, SDK
   openCamera() → MediaStream → <video>            (typed, narrow)        CredentialService + KeyHolder (Keychain)
   FramePump: MediaStreamTrackProcessor                                   permissions.ts (camera policy)
     → OffscreenCanvas → RGBA ArrayBuffer ──aegis:frame──────────────────► validateFrame → sdk.sendFrame()
   Series (bounded real samples) ◄──aegis:event── signals/traces/validation/stats/phase ◄── SDK 'metrics' events
                                                                           SessionLogger → local counters only
                                                                           @smartspectra/node-sdk (native libs)
```

## Source map

| Path | Role |
| --- | --- |
| `src/main/index.ts` | App entry (`out/main/index.js`): BrowserWindow with `contextIsolation`, `sandbox`, no `nodeIntegration`, no `webview`; blocks navigation and popups; installs the camera permission policy; wires the SDK factory, credentials, logger; graceful shutdown on quit. |
| `src/main/sdkSession.ts` | `SdkSession`: the only owner of the SDK instance and of consent. Phase machine `idle → starting → running → stopping → idle` (or `error`), frame handling, metric decoding, stats, teardown with timeouts. |
| `src/main/permissions.ts` | Pure camera policy used by the Electron permission handlers. |
| `src/main/ipc.ts` | The only IPC handlers; verifies the sender frame and URL, validates arguments. |
| `src/main/credentials.ts`, `keystore.ts`, `nativePrompt.ts` | API-key storage, resolution, redacting `Secret`/`KeyHolder`, native macOS key dialog. |
| `src/main/metrics.ts` | Extracts latest pulse/breathing samples and waveform points from decoded SDK packets; never synthesizes values. |
| `src/main/sessionLog.ts` | Bounded local logs: `lifecycle.jsonl` and one counters-only summary per session. |
| `src/preload/index.ts` | Exposes `window.aegis` (the typed API in `src/shared/ipc.ts`); no generic `ipcRenderer`. |
| `src/shared/ipc.ts` | Channel names, wire types, pure validators (shared by all three parts). |
| `src/renderer/App.tsx` | `App()` creates the controller once; `AppShell` renders sidebar, top bar, views, disclaimer. |
| `src/renderer/state/useObservatory.ts` | The session controller hook: IPC events → bounded series; camera and frame-pump lifecycle; credential actions. |
| `src/renderer/capture.ts` | `openCamera()` and `FramePump`. |
| `src/renderer/views/*`, `components/*` | Live Monitor, Signal Lab, Sessions, Diagnostics, Settings; sidebar/top bar/disclaimer. |

## SDK lifecycle

1. **Launch:** main creates `SdkSession` with consent `false` and phase `idle`. No SDK instance exists and the camera is off. Consent is held only in main-process memory and is never persisted.
2. **Consent:** the user ticks the checkbox and presses *Grant consent* → `aegis:consent(true)` → `SdkSession.setConsent` (logged as a `consent` lifecycle event). Consent alone starts nothing and does not unlock the camera.
3. **Start:** *Start measuring* → `aegis:start`. `SdkSession.start()` refuses unless consent is granted and the phase is `idle`/`error` and a key is present. It then creates exactly one SDK (`enableTelemetry: false`, requested breathing + cardio metrics, custom input), phase `starting`. A 30-second startup timer turns "never reached running" into a `timeout` error (with SDK 3.4.0 this is how a rejected key usually appears).
4. **Camera:** only after Start succeeds the renderer calls `getUserMedia` (video only). Main allows it because consent is granted **and** the phase is `starting`/`running`. If the camera fails, the renderer calls Stop.
5. **Running:** the SDK reports `processingStatus: kRunning` → phase `running`; metric packets are decoded and forwarded.
6. **Stop:** *Stop & release camera* (top bar or Live Monitor) → the renderer stops the frame pump and every camera track, then `aegis:stop` → SDK `stopAsync` + `destroy`, each bounded by a timeout → phase `idle`. A counters-only summary is written before teardown.
7. **Quit/close:** `before-quit` shuts the session down first (`endReason: shutdown`).

Concurrency guards: a second `start` while not idle/error is refused (no second SDK); consent cannot be revoked while a session is active; the next start waits for any previous teardown; main-process memory above 2 GiB ends the session.

## Frame flow

1. `MediaStreamTrackProcessor` yields `VideoFrame`s from the single camera track (requested 1280×720 ideal, 30 fps ideal).
2. The frame is drawn to an `OffscreenCanvas` and read as RGBA (`getImageData`). If the previous frame is still awaiting its acknowledgement the new frame is dropped and counted (`droppedBusy`), so the pipeline never queues.
3. The ArrayBuffer is sent with `aegis:frame` as `{ buffer, width, height, stride, timestampUs, sentAtEpochMs }`.
4. Main validates sender, size limits (64 px minimum, at most 1920×1080×4 bytes), clock skew and staleness (frames older than 250 ms in transit are dropped), then `TimestampAnchor` converts the media-clock timestamp to strictly increasing Unix microseconds as the SDK requires, and `sdk.sendFrame(..., kRGBA, ts)` is called.
5. SDK `metrics` events are decoded (`decodeMetrics`) and emitted to the renderer as `signals` (latest pulse/breathing) and `traces` (waveform points). `validationStatus` events become quality hints. Stats are emitted about once a second.

The renderer keeps data in bounded `Series` (deduplicated, monotonic, capped by count and time span). They hold only samples received from the SDK.

## IPC boundary

Channels (`src/shared/ipc.ts`): `aegis:get-state`, `aegis:consent`, `aegis:start`, `aegis:stop`, `aegis:frame`, `aegis:event` (main → renderer), and credential channels `aegis:cred-status`, `-import`, `-remove`, `-enter`, `-save-typed`. Every handler checks that the sender is this window's top frame at an allow-listed URL, validates argument count and shape, and returns secret-free data. The API key never crosses the boundary: credential results contain only status and messages.

## Views and state

`AppShell` owns only UI state (current view, sidebar collapsed, accessibility toggles). The Live Monitor is always mounted (hidden when another view is selected) so the `<video>` element and its stream survive navigation; the other views mount on demand, which also means their canvases animate only while visible. Alt+1 to Alt+5 switch views; the sidebar supports arrow keys, Home and End.

## Build and packaging

`electron-vite` builds main, preload and renderer into `out/`. The SDK is an external dependency of the main bundle. A strict Content-Security-Policy is injected into the production renderer HTML only. `electron-builder.yml` (local unsigned arm64 `dir` target, `asar: false` because the SDK loads native libraries by file path) is a test-build recipe, not a release pipeline; see [SECURITY.md](SECURITY.md) and [COMPETITION_SUBMISSION.md](COMPETITION_SUBMISSION.md) for release blockers.
