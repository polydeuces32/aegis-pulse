# Release audit — Phase D3 (2026-11-08, commit `25edf2e`)

Scope: can this repository be made public as a **source-only** submission, and what stops a **compiled app** from being distributed? Nothing was published, pushed, signed or deleted for this audit.

## 1. Repository state

- Branch `main`, clean working tree at `25edf2e`; 6 commits; no remotes, no tags; 81 tracked files.
- Latest local release candidate: `release/rc1/mac-arm64/Aegis Pulse.app` (built from the D2 working tree, whose code is identical to `25edf2e`; unsigned, ad-hoc seal does not verify). Older `release/mac-arm64` build is stale. `release/` is git-ignored.
- Commit author on every commit is `Giancarlo Vizhnay <75271806+polydeuces32@users.noreply.github.com>` (a GitHub no-reply address). Confirm you are happy for that name to become public.

## 2. Secret, private-data and proprietary-code audit

| Check | Method | Result |
| --- | --- | --- |
| Real API key anywhere in history | fixed-string search of the key across all 6 revisions (count only, value never printed) | **0 hits** |
| Generic secret patterns (AWS, GitHub, Slack, OpenAI-style tokens, private-key blocks, Google keys) across all revisions | regex search | **0 hits** |
| Key-like assignments in code | regex for `api key/secret/token/password = "<16+ chars>"` outside the lockfile | none (test fixtures use obvious dummy values such as `SUPER-SECRET-KEY-0001`; `scripts/auth-probe.mjs` generates a random throwaway key at runtime) |
| Sensitive file types ever committed (`.env`, logs, images, video, `.pem/.p12`, native libraries, `spike/`, `release/`, `out/`) | `git log --all --name-only` | none; the only name matches are the word "credential" in source file names |
| Personal paths / emails in HEAD | search | one harmless fixture path `/Users/x/...` in a test; no real username or email in tracked files |
| Proprietary Presage sample code | `spike/electron-quickstart/` (Presage-licensed, `LicenseRef-Proprietary`) is git-ignored and was never committed; line-level overlap check of tracked `src`, `tests`, `scripts` against every sample file and the SDK README (lines of 35+ characters) | 6 overlaps, all single-line API calls or standard Electron idioms (`sdk.on('processingStatus', …)`, `setWindowOpenHandler(() => ({ action: 'deny' }))`, `requestedMetrics: [...breathingMetrics, ...cardioMetrics]`, `sdk.useCustomInput(FrameTransform.kNone)`); no copied blocks |
| Logs and recordings | tracked tree contains no logs, summaries, screenshots or videos; `logs/` is ignored | clean |

Residual risk: `spike/` and `logs/` exist on disk inside the project folder and are ignored. They will not be pushed, but do not zip or copy the whole folder when publishing. Screenshots taken during review (outside the repo, in a scratch folder) contain a camera preview and readings: **do not publish them**.

## 3. Licences

**Dependencies** (from installed `package.json` files):

| Set | Count | Licences |
| --- | --- | --- |
| Production tree | 24 | BSD-3-Clause 10, MIT 8, Apache-2.0 1, and 5 Presage packages `SEE LICENSE IN LICENSE` (the SDK and its four per-platform runtimes) |
| Full tree (dev + build tools, installed) | 372 installed | mostly MIT/ISC/BSD/Apache-2.0; also BlueOak-1.0.0, 0BSD, CC-BY-4.0, Python-2.0 and WTFPL (dev-only, via build tooling); 71 optional platform packages not installed |

- No copyleft licence in the production dependency tree. FFmpeg (LGPL-2.1+/3) comes inside Presage's platform runtime, not as an npm dependency of this project.
- The packaged test build carries `LICENSE.electron.txt`, `LICENSES.chromium.html`, the SDK `LICENSE`/`NOTICE`/`THIRD_PARTY_*` files and the LGPL texts.
- Electron (MIT) is a build/runtime dependency.

**SDK:** see [LICENSE_REVIEW.md](LICENSE_REVIEW.md). On its face §29.1 of Presage's Terms (effective Nov 2, 2026, also served at the URL named in the SDK `LICENSE`) permits integrating and distributing the SDK in an app with your own key. It is revocable, a separate written agreement would override it, and there is no written confirmation. **Redistribution of a compiled app is therefore treated as unapproved.**

**Recommended licence for this project's own code:** **MIT** (simplest, compatible with every production dependency, fits a contest demo). Apache-2.0 is a good alternative if you want an explicit patent grant. Either licence covers only your code; add a sentence that the SmartSpectra SDK is proprietary, is not included, and is governed by Presage's Terms. **No licence file has been created** — approve a choice and the copyright holder name first. `package.json` also lacks `license`, `repository` and `author` fields; add them with the licence.

## 4. Source-only public repository: what blocks it

| # | Issue | Severity | Fix |
| --- | --- | --- | --- |
| 1 | ~~No licence file~~ | **Resolved in D4:** MIT `LICENSE` (Copyright (c) 2026 Giancarlo Vizhnay), `package.json` `license`/`author` | `repository` field still to add once the URL exists |
| 2 | ~~`npm run check` fails on a fresh clone~~ **Resolved in D4** (scan now skips exact-key checks when there is no `.env` key and still runs secret-pattern checks; verified in a fresh clone). Original finding: `npm run check` (and `npm run scan`) **failed on a fresh clone**: the scan treats "API key present in .env" as a required check. Verified in a clean clone: typecheck, 188 tests, build and `npm audit` (0) pass; only that one scan line fails, so `npm run check` exits 1 | High for judges | Small code change: report it as SKIP when no development key exists. Not done here (D3 allows documentation changes only). Until fixed, the README tells people to run the commands separately |
| 3 | No demo video, no real screenshots | Required by the contest (video); screenshots strongly advised | Record using [DEMO_SCRIPT.md](DEMO_SCRIPT.md); capture per [screenshots/README.md](screenshots/README.md) |
| 4 | Repository not public; remote not configured | Required by the contest | Owner action after the items above |
| 5 | Judges need their own free Presage key | Informational | Documented; provide setup instructions, not a shared key |
| 6 | Contest rules prohibit diagnosis claims | Required | Docs/UI use wellness-only wording; re-read the final post and video |
| 7 | Commit author identity becomes public | Informational | Confirm |

A fresh clone also works without `spike/`, `.env`, `logs/` or any SDK files: `npm ci` installs the SDK from npm.

## 5. Compiled application: what blocks distribution

| # | Issue | Severity |
| --- | --- | --- |
| 1 | SDK redistribution not confirmed in writing | Blocker |
| 2 | No Developer ID signing identity; package unsigned (seal invalid), not notarized — Gatekeeper will block or warn | Blocker for a downloadable app |
| 3 | End-user terms are a draft ([END_USER_TERMS.md](END_USER_TERMS.md)) and not shown in the app; Presage §30.1(g) requires them | Blocker |
| 4 | LGPL notices must ship with each build and the FFmpeg libraries must stay replaceable (not verified for a signed/notarized bundle) | Must verify |
| 5 | Default Electron icon, placeholder bundle id `dev.aegispulse.app` | Polish |
| 6 | Live packaged session with a real key not tested; SDK network traffic never observed | Should test |
| 7 | Hardened-runtime entitlements include `allow-jit`, `allow-unsigned-executable-memory`, `disable-library-validation` | Review before signing |

Recommendation: submit **source only** and say so. The contest requires a public code repository, setup instructions and a demo video, not a downloadable app.

## 6. Prioritized final submission checklist

Items marked **(you)** need your decision or action; I will not do them without approval.

1. ~~Approve a project licence~~ Done in D4 (MIT).
2. **(you)** Email support@presagetech.com asking for written confirmation of §29.1 for your intended use (source-only repo; optional unsigned local builds). Not blocking for a source-only submission, but ask now.
3. ~~Scan fix~~ Done in D4.
4. **(you)** Capture the six screenshots per [screenshots/README.md](screenshots/README.md); check each for private data.
5. **(you)** Record the 2-minute demo with [DEMO_SCRIPT.md](DEMO_SCRIPT.md) (needs the camera and your key; I will not open the camera).
6. **(you)** Decide on tags and prize category; copy the official template headings into [DEV_ARTICLE_DRAFT.md](DEV_ARTICLE_DRAFT.md); fill the video and repository links.
7. **(you)** Make the repository public only after 1–6 (add a remote, push `main`). Re-run the history scan in section 2 against the exact history you push.
8. **(you)** Publish the DEV post with `#presagechallenge` before **November 22, 2026, 11:59 PM PST**.
9. Optional hardening if time remains: observe the SDK's network traffic once to confirm the disclosure; native consent confirmation dialog.
10. Do **not** distribute a compiled app unless items 5.1–5.3 are resolved.
