# Competition submission — Presage SmartSpectra SDK Challenge (DRAFT)

Status: draft. Nothing has been published, pushed or submitted. Do not post until the blockers at the end are closed.

## Official requirements (checked 2026-11-08)

Sources: the [challenge page](https://dev.to/challenges/presage-2026-11-04) and the [contest rules](https://dev.to/page/presage-2026-11-04-contest-rules). Re-read both before submitting; rules can change.

- Submissions due **November 22, 2026, 11:59 PM PST**; winners announced December 10, 2026.
- One entry per participant, individual work only (no teams), participants 18+.
- A published DEV post using the challenge's submission template, with the tag **#presagechallenge**.
- A functional app integrating the SmartSpectra SDK that uses at least one live Presage signal (pulse, breathing rate, HRV, expressions…).
- A **public code repository**, **setup instructions** and a **demo video** (public hosting of the app is optional).
- An explanation of camera consent and data handling, disclosing any storage, sharing, retention, deletion, SDK telemetry or optional AI service use. The challenge page says a "Consent and Data Handling" section is required.
- Not allowed: diagnosis or treatment claims, medical decision-making, covert or non-consensual monitoring (disqualifying).
- If the app needs a login, provide testing credentials and/or testing instructions for judges.
- Judging criteria: use of underlying technology; usability and user experience; originality and creativity. Optional prize categories (note them in the post): *Most Creative or Delightful Use*, *Best Thoughtful Real-World Use*.
- Judges verify SDK use from the public repository and the demo video.
- AI assistance is allowed. Credit non-trivial prior work and open-source code used.

I could read the challenge text but not the template's exact headings; copy the official template from the DEV challenge page when writing the post.

## Eligibility checklist

| Requirement | Status |
| --- | --- |
| Integrates SmartSpectra SDK and uses a live signal | Done (pulse, breathing, both waveforms; verified live) |
| Setup instructions | Done: [INSTALLATION.md](INSTALLATION.md), [README](../README.md) |
| Consent and data handling explained | Done: [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md); put in the post |
| No diagnosis/treatment claims | Docs and UI carry wellness-only wording; re-check the final post and video |
| Public code repository | **Not done** (repository is private and unpushed) |
| Demo video | **Not done** ([DEMO_SCRIPT.md](DEMO_SCRIPT.md) ready) |
| DEV post with template and `#presagechallenge` | **Not done** (draft below) |
| Testing instructions for judges | Drafted below; judges use their own free key |
| Participant is 18+, single entrant, one entry | Owner to confirm |
| Submitted before 2026-11-22 11:59 PM PST | Pending |

## Draft DEV post

**Title:** Aegis Pulse: a consent-first pulse and breathing observatory for the Mac, built on SmartSpectra

**What I built.** Aegis Pulse is an Electron + React + TypeScript desktop app that reads pulse and breathing from a webcam through the Presage SmartSpectra Node.js SDK (3.4.0). It shows the SDK's pulse (12-second average) and breathing (30-second average) readings with the SDK's own confidence and steady / still-settling flag, the SDK's relative pulse waveform and breathing-motion waveform, a readiness strip that explains what the SDK is still waiting for, and live pipeline diagnostics. It is wellness information only: no diagnosis, no stress or emotion scores, nothing estimated by the app.

**Demo.** *[video link]*

**Code.** *[public repository link]*

**How it uses SmartSpectra.** The SDK runs in the Electron main process in custom-input mode. The renderer captures camera frames (about 30 FPS at 1280×720) and sends them over validated IPC; the main process feeds them to `sendFrame`, decodes the SDK's metric packets, and forwards the latest pulse and breathing samples and waveform points to the UI unchanged. See `docs/ARCHITECTURE.md`.

**Consent and Data Handling.**
- The camera is off at launch. You must tick a consent checkbox, press *Grant consent*, and then separately press *Start measuring*. Consent lives only in main-process memory, is asked on every launch, and can be revoked. The main process refuses Start without consent and denies camera permission unless consent is granted and a session is active.
- Video frames are processed in memory on the Mac and are not saved or uploaded by the app. Local logs hold only counters and timings (no readings, no frames).
- The API key is stored encrypted in the macOS Keychain (Electron `safeStorage`); a packaged build ignores `.env`.
- SDK telemetry is disabled (`enableTelemetry: false`). **Disclosure:** according to Presage's SDK Privacy Policy, the SDK still authenticates with Presage and sends derived measurements and session metadata (not images or video) to Presage, which uses an AI provider to generate "Insights"; Presage says this cannot currently be turned off. I have not inspected the network traffic myself. See `docs/PRIVACY.md` for retention details and sources.
- Wellness only; not a medical device; for adults.

**Prize categories.** *Best Thoughtful Real-World Use* (consent, data handling and an honest-by-design UI that never invents or smooths readings). *[Owner decides whether to also enter Most Creative or Delightful Use; I would not claim it without a creative hook.]*

**Testing it yourself (for judges).** You need your own free SmartSpectra key (<https://physiology.presagetech.com/auth/login>); no shared credentials are provided because keys must stay confidential. `git clone … && npm install && npm run dev`, open Settings, save the key, then Live Monitor → consent → Start. Details in `docs/INSTALLATION.md`.

**Verified, and what is not.** One real-camera session of 467.7 s ran at about 30 FPS with 13,955 of 13,955 frames accepted and an IPC p95 of 3 ms; 169 automated tests pass. I did **not** validate the accuracy of the readings against a reference device. Details in `docs/TESTING.md`.

**Tags:** `#presagechallenge` (required). Choose any additional tags allowed by DEV, for example `electron`, `typescript`, `privacy` (check DEV's tag limit when posting).

## Sources and licence review

| Topic | Source | Finding |
| --- | --- | --- |
| Contest rules | <https://dev.to/page/presage-2026-11-04-contest-rules> | Required elements, prohibited content, verification by repo and video |
| Challenge details | <https://dev.to/challenges/presage-2026-11-04> | Dates, judging criteria, categories, FAQ, resource links |
| Presage Terms of Service (effective Nov 2, 2026) | <https://presagetech.com/legal/terms-of-service/> | Part D §29.1: limited, non-exclusive, non-transferable, revocable licence "to integrate the SDK into your applications and to distribute it as part of them, using the API keys we issue"; keys confidential. §30.1: developers must give users an accurate privacy notice including that the SDK sends measurements to Presage which uses an AI provider for Insights; not use the SDK with anyone under 18; not market the app or results as diagnosing/treating; give end users terms that disclaim Presage's warranties and prohibit reverse engineering and diagnostic use; not send PHI. §7.1: no measuring others without required notice and consent; no use for employment/insurance/credit decisions; no emotion inference in workplace/education |
| Presage SDK Privacy Policy (effective Nov 3, 2026) | <https://presagetech.com/legal/privacy-policy> | Images and video stay on device; derived measurements and session identifiers are sent for Insights (§4.2); telemetry off does not stop authentication, model delivery or Insights (§4.4); Insights cannot currently be turned off (§7.4); retention §10 |
| Telemetry doc | <https://smartspectra.presagetech.com/docs/telemetry-and-privacy> | Aggregate-only telemetry, opt-out; developers must disclose it |
| LLM Insights doc | <https://smartspectra.presagetech.com/docs/llm-insights> | Describes the off-device data for that feature; metrics are wellness only, not FDA-cleared |
| Older SDK terms | <https://api.physiology.presagetech.com/termsofservice> (updated 2024-02-02) | Says users may not "create derivative works based on the SDK" and must pass its terms to derivative apps; conflicts in tone with the newer terms |
| SDK package licence | `node_modules/@smartspectra/node-sdk/LICENSE` | Proprietary; points to <https://physiology.presagetech.com/tos>, which returned HTTP 504 when fetched on 2026-11-08 |
| Third-party notices | `node_modules/@smartspectra/node-sdk/NOTICE`, `THIRD_PARTY_FFMPEG.md`, `COPYING.LGPLv*` | Bundled FFmpeg is LGPL (dynamically linked, replaceable shared libraries); Apache components listed |

Reading of the licence position: the newer Terms appear to allow distributing an app that embeds the SDK, but I could not load the document the SDK's own `LICENSE` points to, and the 2024 terms read more restrictively. Treat redistribution as **unconfirmed** until Presage confirms (support@presagetech.com). The repository itself does not contain the SDK; users install it from npm, which avoids redistributing it in source form. A distributed `.app` would embed it.

## Release blockers (unresolved)

1. **No public repository.** Needs your approval to publish, a licence file for this code, a final secret scan, and checking `git log` for sensitive history. The proprietary Presage sample in `spike/` is git-ignored and must stay out of the repository.
2. **No demo video** recorded (script ready).
3. **DEV post not written/published**, and the official template headings need to be copied in.
4. **SDK redistribution and terms unconfirmed** (see above); the app must show end-user terms and a privacy notice meeting ToS §30.1 if it is distributed (the in-app text covers consent and privacy, but there are no end-user terms yet).
5. **Network behaviour of the SDK not observed**; the disclosure relies on Presage's policy.
6. **No Developer ID signing, no notarization** (no signing identity installed); `release/` build is stale (predates the permission fix and five-view redesign), unsigned, default Electron icon, and shares the dev user-data folder. A signed package is not required by the contest rules (the code repository and video are), so this blocks only a distributable download.
7. **No real screenshots** committed (placeholders only).
8. **Consent has no proof of a user gesture** (known limitation; optional native confirmation dialog).
9. **Accuracy not validated** against a reference device; keep all copy free of accuracy or medical claims.
10. Participant eligibility (18+, individual entry) and the one-entry rule are for the owner to confirm.
