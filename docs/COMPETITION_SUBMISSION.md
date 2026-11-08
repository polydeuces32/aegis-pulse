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
| Public code repository | **Not done** (repository is private and unpushed; history audit clean, licence file missing: [RELEASE_AUDIT.md](RELEASE_AUDIT.md)) |
| Demo video | **Not done** ([DEMO_SCRIPT.md](DEMO_SCRIPT.md) ready) |
| DEV post with template and `#presagechallenge` | **Not done** (draft: [DEV_ARTICLE_DRAFT.md](DEV_ARTICLE_DRAFT.md)) |
| Testing instructions for judges | In the article draft; judges use their own free key |
| Participant is 18+, single entrant, one entry | Owner to confirm |
| Submitted before 2026-11-22 11:59 PM PST | Pending |

## Draft DEV post

The full article draft now lives in [DEV_ARTICLE_DRAFT.md](DEV_ARTICLE_DRAFT.md). The prioritized checklist and the public-repository audit are in [RELEASE_AUDIT.md](RELEASE_AUDIT.md).

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
| SDK package licence | `node_modules/@smartspectra/node-sdk/LICENSE` | Proprietary; points to <https://physiology.presagetech.com/tos>, which (rendered in a browser) shows the same November 2, 2026 Terms including §29.1. See [LICENSE_REVIEW.md](LICENSE_REVIEW.md) |
| Third-party notices | `node_modules/@smartspectra/node-sdk/NOTICE`, `THIRD_PARTY_FFMPEG.md`, `COPYING.LGPLv*` | Bundled FFmpeg is LGPL (dynamically linked, replaceable shared libraries); Apache components listed |

Reading of the licence position: the Terms the SDK's own `LICENSE` points to (effective November 2, 2026, §29.1) appear on their face to allow distributing an app that embeds the SDK, but the grant is revocable, a separate written agreement would control, and the 2024 terms read more restrictively. Treat redistribution as **unconfirmed** until Presage confirms (support@presagetech.com); see [LICENSE_REVIEW.md](LICENSE_REVIEW.md). The repository itself does not contain the SDK; users install it from npm, which avoids redistributing it in source form. A distributed `.app` would embed it.

## Release blockers (unresolved)

1. **No public repository.** Needs your approval to publish and a licence file for this code (MIT recommended, not created). The history scan was clean on 2026-11-08; re-run it on the exact history you push. The proprietary Presage sample in `spike/` is git-ignored and must stay out of the repository.
2. **No demo video** recorded (script ready).
3. **DEV post not written/published**, and the official template headings need to be copied in.
4. **SDK redistribution unconfirmed in writing** ([LICENSE_REVIEW.md](LICENSE_REVIEW.md)); end-user terms are only a draft ([END_USER_TERMS.md](END_USER_TERMS.md)) and are not yet shown in the app (ToS §30.1(g)).
5. **Network behaviour of the SDK not observed**; the disclosure relies on Presage's policy.
6. **No Developer ID signing, no notarization** (no signing identity installed); a local release candidate exists (`release/rc1`, five-view UI and permission fix) but is unsigned, ad-hoc only, has the default Electron icon, and has had only a limited launch test. A signed package is not required by the contest rules (the code repository and video are), so this blocks only a distributable download.
7. **No real screenshots** committed (placeholders only).
8. **Consent has no proof of a user gesture** (known limitation; optional native confirmation dialog).
9. **Accuracy not validated** against a reference device; keep all copy free of accuracy or medical claims.
10. Participant eligibility (18+, individual entry) and the one-entry rule are for the owner to confirm.
