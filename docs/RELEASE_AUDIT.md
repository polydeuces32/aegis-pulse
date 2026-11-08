# Release audit — Phase D9 (2026-11-08, baseline `48db4a6`)

Scope: can this repository be made public as a **source-only** submission, and what stops a **compiled app** from being distributed? Nothing was published, pushed, uploaded, signed or distributed for this audit. The commit that contains this file is the "D9 checkpoint" (see `git log`); the audit was verified against baseline `48db4a6` plus the D9 documentation, metadata and `.gitignore` changes.

## 1. Repository state

- Branch `main`; no remotes, no tags. Baseline `48db4a6` has 10 commits and 95 tracked files; the D9 checkpoint adds one commit.
- Planned (not verified, not created) repository URL: `https://github.com/polydeuces32/aegis-pulse`. `package.json` `repository`, `homepage` and `bugs` point at it.
- Commit author on every commit is `Giancarlo Vizhnay <75271806+polydeuces32@users.noreply.github.com>` (GitHub no-reply address). That name becomes public on push.
- The demo video (`~/Movies/Aegis-Pulse-Demo/final-demo.mp4`, silent, 50.53 s) and all raw recordings live outside the repo and are git-ignored by extension.
- Local, ignored, never committed: `.env`, `logs/`, `spike/` (Presage sample, proprietary header), `release/`, `out/`, `node_modules/`. Do not zip or copy the whole project folder when publishing.
- `release/` holds unsigned local test builds. Nothing is distributed.

## 2. Secret, private-data and proprietary-code audit

| Check | Method | Result |
| --- | --- | --- |
| Secret patterns across all revisions (private-key blocks, AWS, GitHub, Slack, OpenAI-style tokens) | regex over every revision | **0 hits** |
| Real API key in history | not re-run in D8/D9 (needs `.env`, which was deliberately not read); D3 ran an exact-value search across all revisions: 0 hits. `npm run scan` repeats it on a machine that has a key | see note |
| Sensitive file types ever committed (`.env`, logs, video, `.pem/.p12`, native libraries, `spike/`, `release/`, `out/`) | `git log --all --name-only` | none; only the six reviewed PNGs |
| Personal paths and emails | regex over every revision | fixture path `/Users/x/...` in `tests/paths.test.ts`; Presage support address in docs; one npm maintainer address in a lockfile deprecation notice |
| Proprietary Presage sample code | `spike/` was never committed; D3 line-level overlap check found six single-line API idioms, no copied blocks | clean |
| Raw screenshots and recordings | `.gitignore` blocks media extensions, `Screenshot*`, `Screen Shot*`, `Screen Recording*`, `*-raw.png`, and everything under `docs/screenshots/` except `README.md` and the six named publication PNGs | verified with `git check-ignore` |

Note: a clean-clone `npm run scan` skips the exact-key checks (no key present) and still runs the secret-pattern checks. Re-run `npm run scan` once on the development machine, where `.env` exists, immediately before pushing; it never prints the key.

## 3. Licences

- **This project:** MIT, Copyright (c) 2026 Giancarlo Vizhnay (`LICENSE`, `package.json`).
- **Dependencies** (from installed `package.json` files, D3): production tree 24 packages: BSD-3-Clause 10, MIT 8, Apache-2.0 1, and 5 Presage packages under `SEE LICENSE IN LICENSE` (the SDK and its per-platform runtimes). Full installed tree 372 packages, mostly MIT/ISC/BSD/Apache-2.0, plus dev-only BlueOak-1.0.0, 0BSD, CC-BY-4.0, Python-2.0, WTFPL. No copyleft in the production npm tree; FFmpeg (LGPL) arrives inside Presage's runtime, not as an npm dependency of this project.
- **SDK:** proprietary, not in this repository, installed from npm with `npm ci`; the user needs their own API key. See [LICENSE_REVIEW.md](LICENSE_REVIEW.md). §29.1 of Presage's Terms (effective Nov 2, 2026) appears to permit integration and distribution with your own key, but it is revocable and there is no written confirmation. **TODO:** email support@presagetech.com for written confirmation. Not needed for a source-only repo.

## 4. Source-only public repository: status

| # | Item | Status |
| --- | --- | --- |
| 1 | Licence file | Done (MIT) |
| 2 | `npm ci` and `npm run check` on a fresh clone with no `.env` and no key | Done: typecheck, 188 of 188 tests (18 files), build and scan pass (re-verified in D9, see [TESTING.md](TESTING.md)) |
| 3 | Six publication screenshots | Done and reviewed at full size in D6 and D8: no face, key text, paths or other windows; the Live Monitor preview is covered by an opaque panel |
| 4 | Demo video | Rendered locally: silent, 50.53 s, 1458x1160, preview masked in every frame. It starts with an already-running session (consent and Start are not in the footage) and shows breathing as preliminary. **TODO:** host it and add the link |
| 5 | README, installation and testing docs | Updated to `npm ci` and the planned URL; stale draft wording removed |
| 6 | Repository created and public | **Not done.** Owner action |
| 7 | DEV post | Draft only ([DEV_ARTICLE_DRAFT.md](DEV_ARTICLE_DRAFT.md)); official template headings still to be copied in; confirm the challenge is still accepting submissions (due Nov 22, 2026, 11:59 PM PST) |
| 8 | Judges need their own free Presage key | Documented; no key is shared |
| 9 | No diagnosis or treatment claims | Wellness-only wording in docs, UI, captions and video; re-read the final post |
| 10 | Commit author identity becomes public | Confirm before push |

## 5. Compiled application: what blocks distribution

| # | Issue | Severity |
| --- | --- | --- |
| 1 | SDK redistribution not confirmed in writing | Blocker |
| 2 | No Developer ID signature; unsigned, not notarized | Blocker for a downloadable app |
| 3 | End-user terms are a draft ([END_USER_TERMS.md](END_USER_TERMS.md)), contact field unresolved, not shown in the app; Presage §30.1(g) requires them | Blocker |
| 4 | LGPL notices must ship with each build and FFmpeg libraries must stay replaceable (not verified for a signed bundle) | Must verify |
| 5 | Default Electron icon, placeholder bundle id `dev.aegispulse.app` | Polish |
| 6 | Packaged session with a real key not tested; SDK network traffic never observed | Should test |
| 7 | Hardened-runtime entitlements include `allow-jit`, `allow-unsigned-executable-memory`, `disable-library-validation` | Review before signing |

Recommendation: submit **source only** and say so. The contest requires a public repository, setup instructions and a demo video, not a downloadable app.

## 6. Publication steps (all require explicit owner approval; none done)

1. Run `npm run check` and `npm run scan` on the development machine; confirm `git status` is clean and `git ls-files` lists no media.
2. Create an empty public GitHub repository `polydeuces32/aegis-pulse` (no README, licence or .gitignore); set the description and topics.
3. `git remote add origin https://github.com/polydeuces32/aegis-pulse.git` and `git push -u origin main` (no tags, no releases, no binaries).
4. View the repository logged out: LICENSE, images and file list; then update the "planned URL" wording in README, INSTALLATION and the article.
5. Upload the silent demo video and add its link to the article.
6. Copy the DEV template headings, add `#presagechallenge`, publish before the deadline.
