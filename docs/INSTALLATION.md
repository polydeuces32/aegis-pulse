# Installation

## Requirements

| Item | Requirement | Verified on |
| --- | --- | --- |
| Hardware | Apple Silicon Mac (arm64) with a webcam | arm64, macOS 26.6.2 |
| Node.js | 20 or newer (`@smartspectra/node-sdk` declares `node >=20`) | v26.13.0 |
| npm | Bundled with Node | 11.20.0 |
| Network | Outbound access to Presage services while measuring | — |
| API key | Free SmartSpectra key: <https://physiology.presagetech.com/auth/login> | — |

Only macOS arm64 is supported by this project. The SDK itself also ships Linux and Windows runtimes; they are not used or tested here.

## Install and run

```bash
git clone <repository-url> aegis-pulse
cd aegis-pulse
npm install
npm run dev
```

`npm install` fetches the proprietary SmartSpectra SDK and its native runtime (`@smartspectra/node-sdk-darwin-arm64`) from npm; the SDK is not part of this repository. npm may print an "install-scripts … not yet covered by allowScripts" warning for packages such as `koffi` and `esbuild`; the project installs and runs with it.

Production-style run: `npm run build` then `npm start` (runs `electron-vite preview`).

## First run

1. The window opens **IDLE** with the camera off.
2. Open **Settings** (sidebar or Alt+5). Under *API key & Keychain* choose **Enter key securely (macOS dialog)** and paste your key into the hidden-input prompt. It is saved encrypted via Electron `safeStorage` (macOS Keychain). Alternatives in the same panel: *Import key from clipboard* (the clipboard is cleared if it still holds the key) or typing into the in-app field (less isolated, see [SECURITY.md](SECURITY.md)).
3. Open **Live Monitor** (Alt+1). Read the notice, tick the consent checkbox, press **Grant consent**.
4. Press **Start measuring**. macOS may ask for camera access the first time. Allow it, and stay still facing the camera: the pulse reading appears after the SDK's 12-second window fills and breathing after its 30-second window.
5. Press **Stop & release camera** (top bar or Live Monitor) when finished. The state returns to IDLE and the camera light turns off.

Consent lasts until you quit the app; you are asked again on every launch. You can revoke it in Settings while idle.

### Development-only key via `.env`

```bash
cp .env.example .env      # then set SMARTSPECTRA_API_KEY=... in .env
```

`.env` is git-ignored and read only by unpackaged runs. A key saved in the Keychain always wins over `SMARTSPECTRA_API_KEY` and `.env`. Never commit or paste a key into an issue.

## Where files go

| What | Development run | Packaged run |
| --- | --- | --- |
| Encrypted key `credentials.bin` | `~/Library/Application Support/aegis-pulse/` | `~/Library/Application Support/Aegis Pulse/` (separate, starts empty) |
| Lifecycle log and session summaries | `<project>/logs/` | `~/Library/Application Support/Aegis Pulse/logs/` |

A packaged app never reads or migrates the development folder, so it starts without a key and you onboard it separately. Nothing is copied or deleted between the two.

To remove the key use **Settings → Remove key**. To delete logs, delete the `logs` folder yourself; the app never deletes them.

## Local test build (optional, unsigned)

`npm run pack` builds an unsigned arm64 app into `release/` (git-ignored; it replaces `release/mac-arm64`). To keep an existing build, pass another folder: `CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dir --arm64 --publish never --config.directories.output=release/rc1`. It is for local testing only: it is not signed with a Developer ID, not notarized, and the committed `electron-builder.yml` sets no icon. Do not distribute it.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| "API key needed" on Live Monitor | No key stored. Open Settings and save one. |
| Start sits in STARTING, then a *timeout* error after 30 s | With SDK 3.4.0 a rejected, expired or over-quota key usually looks like this; so can no network. Check your connection, then replace the key. |
| *authentication* error | Key rejected by the SDK. Re-enter it. |
| Camera error "denied" | Allow the app under System Settings → Privacy & Security → Camera, then press Start again. Camera access is requested only after Start. |
| Camera error "unavailable" | No camera found or it is in use by another app. |
| Secure storage not available | `safeStorage` cannot encrypt on this system, so the key is not saved (there is no plaintext fallback). |
| Pulse or breathing shows "—" or *Still settling* | Normal during the averaging windows. Sit still, face the camera with face and chest in frame, steady light, do not talk. |
| `ELECTRON_RUN_AS_NODE` set in your shell and the app exits immediately | Unset it (`env -u ELECTRON_RUN_AS_NODE npm run dev`). |
| Port or window already open | Quit any previous Aegis Pulse instance (Cmd-Q) and start again. |
| `npm install` fails on native modules | Use Node 20+, a clean `node_modules`, and check you are on arm64 (`uname -m`). |

If the SDK reports an error, the message appears on Live Monitor and in Diagnostics. Error text is scrubbed of the key before display or logging.
