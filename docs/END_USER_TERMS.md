# End-user terms — DRAFT for legal review

> **Draft only.** Written to reflect Presage Terms §30.1 and §7.1; not reviewed by a lawyer, not yet shown in the app, and not an approved document. Placeholders are in [brackets]. Do not distribute with a build until reviewed.

## Aegis Pulse — Terms of Use and Notice

**Who provides this app.** Aegis Pulse is provided by [Owner name / contact]. These terms are between you and [Owner name], not Presage. They govern your use of Aegis Pulse.

### 1. Wellness information only
Aegis Pulse shows pulse and breathing readings that the Presage SmartSpectra software development kit ("Presage technology") produces from your camera. It is for general wellness and informational purposes. It is **not a medical device** and does not diagnose, treat, cure, mitigate or prevent any disease or condition, and must not be used for medical decisions or in an emergency. Readings are estimates and can be wrong, especially when you move, talk, or the lighting changes. Do not rely on them for any health decision. In an emergency, call your local emergency number.

### 2. Who may use it
You must be at least 18 years old. Do not use Aegis Pulse to measure anyone under 18. Only measure yourself, or other adults who have been told how the app works and have agreed. You must not use readings to make or support decisions about a person's employment, insurance, credit, housing, education or eligibility for benefits, or to infer people's emotions in a workplace or school.

### 3. Camera and consent
The camera stays off until you grant consent in the app **and** press Start. Consent lasts only until you quit the app. Press "Stop & release camera" at any time. Aegis Pulse does not record or save video or images.

### 4. What data goes where (privacy notice)
- Your video frames are processed in memory on your Mac by the Presage technology. According to Presage's SDK Privacy Policy, camera images and video are not sent to Presage.
- **The Presage technology sends information to Presage during a session**, including your derived measurements (such as pulse and breathing, and possibly heart-rate variability), session identifiers and technical data used to authenticate the app and deliver models (for example your API key, hashed device identifiers, SDK version and IP address). Presage uses an AI provider to generate "Insights" from measurements; Presage states this happens automatically and cannot currently be turned off. SDK usage telemetry is switched off in this app, but that does not stop the transfers above. Presage's handling of that information is described in its SDK Privacy Policy: <https://presagetech.com/legal/privacy-policy>.
- Aegis Pulse itself has no server, no analytics and no account. It keeps your API key encrypted in the macOS Keychain, and it writes local log files that contain counters and timings only (no readings and no video), under `~/Library/Application Support/Aegis Pulse/logs/`. You can delete them, and remove the stored key in Settings.
- Do not enter names, contact details or other personal information anywhere in the app. The app does not send prompts to Presage.
- Do not use the app to handle protected health information.

### 5. Your API key
You need your own SmartSpectra API key, which is subject to Presage's Terms of Service (<https://presagetech.com/legal/terms-of-service>, Part D). Keep it confidential. The app stores it only in your macOS Keychain.

### 6. Presage technology
The app contains Presage technology. As to Presage technology, and to the extent permitted by law: it is provided "as is" without warranties of any kind, and Presage is not liable to you for it. You must not copy, modify, reverse engineer, decompile or extract the source code, models or algorithms of the Presage technology, or use it to build a competing product. You must not use Aegis Pulse or the Presage technology for diagnosis or treatment. [Third-party components, including FFmpeg under the LGPL, are listed in the app's notices.]

### 7. Disclaimer and liability
To the fullest extent permitted by law, Aegis Pulse is provided "as is" and "as available", without warranties of any kind, and [Owner name] is not liable for indirect, incidental or consequential damages arising from its use. [Local-law, jurisdiction and dispute-resolution clauses to be added by counsel.]

### 8. Questions
Questions about Aegis Pulse, these terms or your data in this app: [contact]. Questions about data held by Presage: <support@presagetech.com>.

---

## Mapping to Presage Terms §30.1 (for the reviewer)

| §30.1 item | Where this draft addresses it | Status |
| --- | --- | --- |
| (a) accurate privacy notice | §4 | Drafted; counsel to confirm completeness |
| (b) tell users measurements go to Presage / AI Insights | §4, and the in-app consent and Settings text | Drafted and implemented in the UI |
| (c) other consents required by law | §2, §3 | Counsel to review (e.g. biometric laws) |
| (d) no PHI | §4 | Drafted |
| (e) no unneeded prompt text | §4 (the app sends no prompts) | Drafted |
| (f) under-18 | §2 | Drafted; the app has no age gate |
| (g) end-user terms with Presage disclaimers and reverse-engineering / diagnostic bans | §1, §6, §7 | Drafted |
| (h) direct users to the developer | §8 | Placeholder contact needed |
| (i) no diagnosis/treatment marketing | §1 | Drafted; keep all marketing copy consistent |

Not yet done: show these terms in the app (an acceptance step), add the owner's identity and contact, add governing-law clauses.
