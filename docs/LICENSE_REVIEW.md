# SDK licence review (draft, not legal advice)

Question: may a build of Aegis Pulse that embeds the SmartSpectra SDK be distributed? This compares the licence file shipped inside the installed package with Presage's Terms of Service. **No redistribution approval is assumed.**

## Documents compared

| Document | Where | Date |
| --- | --- | --- |
| Installed SDK licence | `node_modules/@smartspectra/node-sdk/LICENSE` (version 3.4.0) | © 2026 |
| Presage Terms of Service | Rendered at <https://physiology.presagetech.com/tos> (the URL the SDK licence names) and <https://presagetech.com/legal/terms-of-service/> | Effective November 2, 2026 |
| Third-party notices | `node_modules/@smartspectra/node-sdk/{NOTICE,THIRD_PARTY_NOTICES.txt,THIRD_PARTY_FFMPEG.md,COPYING.LGPLv2.1,COPYING.LGPLv3}` and the same LGPL files in `node_modules/@smartspectra/node-sdk-darwin-arm64/` | — |
| Older SDK terms | <https://api.physiology.presagetech.com/termsofservice> ("last updated February 2, 2024") | Returned HTTP 403 when requested on 2026-11-08; previously read from a search snippet only |

Retrieved 2026-11-08. The `physiology.presagetech.com/tos` page is a JavaScript app; the earlier fetch failures (HTTP 504 and an empty shell) were a fetching problem, not a missing page. Read in a browser, it shows the same Terms, effective November 2, 2026, including Section 29.1 with the same wording as the presagetech.com copy.

## What each says

**SDK `LICENSE`:** the software "is proprietary to Presage and is made available solely under Presage's Terms of Service" at `physiology.presagetech.com/tos`; use "constitutes acceptance of those Terms"; no licence to Presage trademarks, names or logos; provided "AS IS".

**Terms §29.1 (Developers):** "Subject to these Terms, Presage grants you a limited, non-exclusive, non-transferable, revocable license to integrate the SDK into your applications and to distribute it as part of them, using the API keys we issue. Keep your API keys confidential. A separate written license agreement with Presage, if any, controls."

**Terms §30.1 (obligations when you distribute)**, summarised: give End Users an accurate privacy notice including what the SDK sends to Presage; tell them the SDK sends measurements and any prompt text to Presage, which uses an AI provider for Insights; obtain required consents; send no PHI; keep unneeded data out of prompts; not use the SDK with anyone under 18; give End Users terms that make clear the developer's terms (not Presage's) govern the app and that, as to Presage technology and to the extent permitted by law, disclaim warranties and liability on Presage's behalf and prohibit reverse engineering and diagnostic or treatment use; direct End Users to the developer for questions; and not market the app or its results as diagnosing or treating any condition. **§7.1** also bars reverse engineering, building competing products, resale or sublicensing except as the Terms permit, measuring others without required notice and consent, and use with anyone under 18.

## Assessment

- **No direct conflict found.** The licence file defers to the Terms, and the Terms (§29.1) on their face permit integrating and distributing the SDK inside an app, using API keys Presage issues.
- **Unresolved points that stop me calling it approved:**
  1. The grant is "limited, non-exclusive, non-transferable, **revocable**" and "subject to these Terms"; the Terms can change (§20) and a separate written agreement "controls" if one exists. There is no written confirmation from Presage that this project's intended distribution is covered.
  2. Acceptance: the licence says use constitutes acceptance of the Terms. The Terms define a "Developer" account holder; the project owner must be a registered developer holding their own key. The key must not ship in the app.
  3. The 2024 SDK terms (now unreachable) read more restrictively ("not create derivative works based on the SDK"; pass those terms to derivative apps). Confirm they are superseded by the November 2, 2026 Terms.
  4. §30.1(g) requires end-user terms with specific disclaimers; a draft is in [END_USER_TERMS.md](END_USER_TERMS.md) and needs review.
  5. §30.1(b) disclosure of measurement upload and Insights is in the consent and Settings screens; whether the legal consent standard is met for your audience is a legal question.
  6. Third-party components: FFmpeg is LGPL (dynamically linked shared libraries, replaceable). A distributed app must carry the LGPL texts and notices and not prevent replacing those libraries. Apache-licensed components are listed in `NOTICE`. The local test build copies these files with the package; confirm in each release artifact.
  7. The contest scenario (a source repository without the SDK) is a different matter from distributing a `.app` that contains the SDK; the repository does not contain the SDK, users install it from npm.
- **Recommended:** email Presage (support@presagetech.com), describe the intended distribution (a free competition demo app, source-only repository, optional unsigned local builds) and ask for written confirmation that §29.1 covers it and that the 2024 terms are superseded. Until then, do not distribute a built `.app` containing the SDK.

## Project licence (added 2026-11-08)

The repository's own code is licensed under the MIT License, Copyright (c) 2026 Giancarlo Vizhnay (`LICENSE`, `package.json` `license` and `author`). That licence covers only the code authored in this repository. It does **not** cover, relicense or modify the terms of the SmartSpectra SDK, which stays under Presage's Terms of Service and its own notice files; the SDK is not part of the repository. `package.json` carries no `repository` field because no public repository URL has been verified (the GitHub URL guessed from the commit email returns 404).
