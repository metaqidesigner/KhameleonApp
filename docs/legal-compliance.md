# Third-party licences and legal compliance

Required by Newton, 2026-10-17. **This must be completed during the final code clean-up, before Khameleon is sold or distributed to anyone outside development.** It is also listed in `SELF_HOSTING.md` ("What this first pass does not cover") and in the pre-launch checklist.

This document is the technical record of what Khameleon uses from third parties and what each licence requires. It is not legal advice; a lawyer should review it before launch.

## Rules Khameleon follows

1. **Khameleon carries only its own brand.** The only outside names a user sees in everyday use are the AI engines their organisation has approved (e.g. Claude, an Azure-hosted model). No other company's name, logo or branding appears in the product.
2. **Required notices live in one place**: *About Khameleon → Licences* in the app (and `THIRD_PARTY_LICENSES.md` in the repository). Keeping a notice there is not branding; it's a legal obligation.
3. **Only commercially usable licences.** Code, models and content must allow commercial use (e.g. MIT, Apache 2.0, BSD). Anything "all rights reserved", "non-commercial", "research only" or without any licence is not used.
4. **No third-party trademarks in branding.** Licences like Apache 2.0 don't grant trademark rights. Naming a provider only to say Khameleon works with it (e.g. "your organisation's Claude key") is generally acceptable; logos and anything implying endorsement are not.
5. **Changed third-party material is marked as changed** where its licence requires it (Apache 2.0 §4(b)).
6. **Skills users install from outside sources** (Get skills) show their licence before install; restricted licences are refused; skills with no stated licence carry a warning. Programs inside such skills are never run.
7. **Integrations users connect** (Get integrations) are third-party services under their own terms. Khameleon shows who publishes each one and where it runs, never claims a listing is "official", and the user chooses what to connect. Data the AI sends to a connected integration is governed by that service's terms - say so in Khameleon's terms of use.

## What Khameleon uses today (to be completed in the clean-up)

| Component | Used for | Licence | Obligation |
|---|---|---|---|
| Qwen 2.5 Instruct 1.5B and 7B (Alibaba Cloud) | Khami's built-in language brain | Apache 2.0 | Include licence and notice; no use of Alibaba/Qwen branding |
| llama.cpp (ggml authors) | Runs Khami's brain | MIT | Include copyright and licence |
| node-llama-cpp (Gilad S.) | Connects Khameleon to llama.cpp | MIT | Include copyright and licence |
| Anthropic "internal-comms" skill | Adapted into Khameleon's **Internal communications** skill | Apache 2.0 | Include licence and notice; state that it was modified |
| Anthropic "skill-creator" skill | Adapted (instructions only) into Khameleon's **Skill writer** skill | Apache 2.0 | Include licence and notice; state that it was modified |
| Model Context Protocol SDK | Khameleon's own Integrations client | MIT | Include copyright and licence |
| tesseract.js | Reads text from scanned documents | Apache 2.0 | Include licence and notice |
| pdf-parse | Reads text from PDFs | Apache 2.0 | Include licence and notice |
| mammoth | Reads text from Word (.docx) procedure documents (Build 5, added 2026-10-19) | BSD-2-Clause | Include copyright notice and licence text |
| Tesseract English language data (tessdata, downloaded once by tesseract.js) | On-device OCR of scanned documents | Apache 2.0 | Include notice; note in the clean-up whether to ship it inside the installer (so OCR never needs a first-time download) |
| Electron | Desktop app | MIT (plus bundled Chromium notices) | Ship Electron's own licence files |
| Khameleon input helper (own code, `apps/khameleon-shell/native/mac/KhameleonInput.swift`) | Capture full recording and replay (2026-10-19) | Khameleon's own - uses only Apple's system frameworks (Accessibility, Quartz Events) | No third-party licence. Privacy: records clicks and typing only while the user records, never password fields; say so in the privacy notice. Corporate security tools may flag input monitoring - document it for IT |
| React, Vite, Express, Drizzle, Zustand and other npm packages | App and server | Mostly MIT/ISC/Apache — full list to be generated | Generate full list from `pnpm run licenses` at clean-up |
| Microsoft 365 Copilot Chat API (Microsoft Graph, preview) | Copilot as the main agent when an organisation provides it | Microsoft APIs Terms of Use / Graph terms (not an open licence) | Preview: Microsoft says not supported for production - confirm status before launch; each user needs a Copilot licence; respect Microsoft's API terms and Copilot data handling; name "Microsoft 365 Copilot" only to describe what Khameleon connects to, no logos |
| Anthropic SDK (`@anthropic-ai/sdk`) | Talking to Claude when an organisation has it | MIT | Include copyright and licence |
| OpenAI SDK (`openai`) | GPT, Gemini (compatible interface) and **Azure OpenAI** | Apache 2.0 | Include licence and notice |
| Azure OpenAI Service (Microsoft) | The organisation's own OpenAI models in its Azure account (step 5, added 2026-10-19) | The organisation's Microsoft Azure agreement / Product Terms (not an open licence) | Customer-supplied: the organisation's own resource, deployment and key; Khameleon only connects to it. Name "Azure OpenAI" only to describe what it connects to, no logos. Data sent is governed by the organisation's Azure terms - say so in Khameleon's terms of use |

**Not used, by decision:** Anthropic's Word/PDF/PowerPoint/Excel skills (restricted licence); Anthropic's doc-coauthoring skill (no licence - Khameleon's own **Document co-writing** was written from scratch); Llama models (licence conditions); Ollama (not needed); MiniMax and OpenRouter (removed).

## Clean-up checklist (before launch)

- [x] Generate the complete dependency licence list - done 2026-10-20: `pnpm run licenses` (= `node scripts/generate-licenses.mjs`) builds `THIRD_PARTY_LICENSES.md` from what ships (server, desktop app and libraries' production packages + every package bundled into the frontend + models, fonts, Chromium, OCR data, adapted skills), with each licence text and NOTICE. 348 packages + 6 items. Re-run before every release.
- [x] Remove any dependency whose licence isn't commercially usable - none found (2026-10-20); the generator now **fails** on any licence outside the commercial-use allow-list (`pnpm run licenses:check`). jszip is "MIT OR GPL-3.0" - used under MIT.
- [x] Confirm every AI model offered for download has a commercial-use licence - Qwen2.5-1.5B-Instruct-GGUF and Qwen2.5-7B-Instruct-GGUF confirmed Apache-2.0 on Hugging Face (2026-10-20). Re-check if a model is added.
- [x] Full licence texts ship inside the app (2026-10-20): served as `/third-party-licenses.txt` and shown under About Khameleon → Licences → "All third-party licences"; the desktop installer also carries `THIRD_PARTY_LICENSES.md` (electron-builder extraResources), next to Electron's `LICENSE.electron.txt` and Chromium's `LICENSES.chromium.html` - confirmed in a packaged Mac build 2026-10-20 (pre-launch step A5). Windows build to confirm in A7.
- [x] Search the product for third-party names and branding (2026-10-20): removed user-visible "Jarvis" (a Marvel trademark - leftover project name in offline messages and the Projects page), "built on Replit" (link previews) and "Replit Secrets"/"replit-ai" (setup text, an engine label, a server error). Remaining names only describe what Khameleon connects to (Gmail, Outlook, Google, Spotify, Microsoft 365 Copilot, Claude/GPT/Gemini when the organisation provides them). "Jarvis" survives only in internal code names, not shown to users - rename during code clean-up (A4).
- [x] Check the skills shipped with Khameleon (2026-10-20): the two adapted skills keep their Apache-2.0 notice and "modified" statement (THIRD_PARTY_LICENSES.md, About → Licences); a test fails if any shipped skill names a third party.
- [ ] Review terms of service for every AI provider Khameleon can connect to (Anthropic, OpenAI, Google, Microsoft Azure) for anything affecting how Khameleon may use or present them.
- [ ] Check whether Microsoft's Copilot Chat API has left preview and what its production terms require (licensing, data handling, branding) before relying on it for paying customers.
- [ ] Khameleon's own terms of use: users are responsible for the skills they install and the integrations they connect; connected services' own terms apply to data sent to them.
- [ ] Public MCP directory (registry.modelcontextprotocol.io): check its terms of use for listing/showing its entries in a commercial product.
- [ ] Azure OpenAI: confirm Khameleon's terms of use state that the organisation's own Azure agreement governs data sent to its Azure OpenAI deployment, and that confidential conversations are never sent (step 5 lock).
- [ ] Privacy notice: automatic task detection (Build 6) - off by default; when on, keeps a local log of app/window switches (no typing/screens/clicks) for the chosen period; content watching reads window text on the device, judged only by the on-device AI; banking/password/private windows left out by default. Check workplace monitoring rules (e.g. GDPR/employee monitoring) for organisations that might switch it on for staff.
- [x] Fonts (2026-10-20): Inter and Plus Jakarta Sans were loaded from Google Fonts on every launch (sends users' IP addresses to Google - a GDPR risk - and fails offline); now shipped with the app (OFL-1.1, notice included). The app makes no outside requests when it opens.
- [ ] Images in the app (`public/khameleon-head.webp`, `nebula-core.png`, `opengraph.jpg`, the icons): confirm who made them and that Khameleon owns or may use them commercially (Newton).
- [ ] Legal review of this document and the licences page.
- [x] Draft terms of use and privacy notice for the lawyer (2026-10-20, pre-launch A6): `docs/legal/terms-of-use-draft.md`, `docs/legal/privacy-notice-draft.md` - written from what the code actually does (data stays on the user's computer / organisation's server; nothing sent to [company]; outside AIs only if switched on, never confidential work; email only sent after the user presses send; Capture and detection user-controlled). Each ends with questions for the reviewer. Needs: company name, contact, jurisdiction, liability cap, retention defaults - then legal review.
- [ ] **Voice input may send audio off the computer** (found 2026-10-20): the wake word and dictation use the browser's built-in speech recognition, which in Google Chrome sends audio to Google. Conflicts with "confidential work never leaves the computer" and the no-third-party rule. Decide: disclose, switch voice off by default with a warning, or replace with on-device speech recognition (privacy notice question 1).
