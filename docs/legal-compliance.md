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
| Electron | Desktop app | MIT (plus bundled Chromium notices) | Ship Electron's own licence files |
| React, Vite, Express, Drizzle, Zustand and other npm packages | App and server | Mostly MIT/ISC/Apache — full list to be generated | Generate full list from `pnpm licenses` at clean-up |
| Microsoft 365 Copilot Chat API (Microsoft Graph, preview) | Copilot as the main agent when an organisation provides it | Microsoft APIs Terms of Use / Graph terms (not an open licence) | Preview: Microsoft says not supported for production - confirm status before launch; each user needs a Copilot licence; respect Microsoft's API terms and Copilot data handling; name "Microsoft 365 Copilot" only to describe what Khameleon connects to, no logos |
| Anthropic SDK (`@anthropic-ai/sdk`) | Talking to Claude when an organisation has it | MIT | Include copyright and licence |
| OpenAI SDK (`openai`) | GPT, Gemini (compatible interface) and **Azure OpenAI** | Apache 2.0 | Include licence and notice |
| Azure OpenAI Service (Microsoft) | The organisation's own OpenAI models in its Azure account (step 5, added 2026-10-19) | The organisation's Microsoft Azure agreement / Product Terms (not an open licence) | Customer-supplied: the organisation's own resource, deployment and key; Khameleon only connects to it. Name "Azure OpenAI" only to describe what it connects to, no logos. Data sent is governed by the organisation's Azure terms - say so in Khameleon's terms of use |

**Not used, by decision:** Anthropic's Word/PDF/PowerPoint/Excel skills (restricted licence); Anthropic's doc-coauthoring skill (no licence - Khameleon's own **Document co-writing** was written from scratch); Llama models (licence conditions); Ollama (not needed); MiniMax and OpenRouter (removed).

## Clean-up checklist (before launch)

- [ ] Generate the complete dependency licence list (`pnpm licenses list --prod` for every package, plus Electron/Chromium notices) and add it to `THIRD_PARTY_LICENSES.md`.
- [ ] Remove any dependency whose licence isn't commercially usable, or replace it.
- [ ] Confirm every AI model offered for download still has a commercial-use licence; record its notice.
- [ ] Make sure the full licence texts actually ship inside the installed app (not only in the repository), and that *About Khameleon → Licences* shows them.
- [ ] Search the product for third-party names and branding; remove any outside the allowed cases above.
- [ ] Check the skills shipped with Khameleon: adapted ones keep their notice and "modified" statement; new ones contain no copied text.
- [ ] Review terms of service for every AI provider Khameleon can connect to (Anthropic, OpenAI, Google, Microsoft Azure) for anything affecting how Khameleon may use or present them.
- [ ] Check whether Microsoft's Copilot Chat API has left preview and what its production terms require (licensing, data handling, branding) before relying on it for paying customers.
- [ ] Khameleon's own terms of use: users are responsible for the skills they install and the integrations they connect; connected services' own terms apply to data sent to them.
- [ ] Public MCP directory (registry.modelcontextprotocol.io): check its terms of use for listing/showing its entries in a commercial product.
- [ ] Azure OpenAI: confirm Khameleon's terms of use state that the organisation's own Azure agreement governs data sent to its Azure OpenAI deployment, and that confidential conversations are never sent (step 5 lock).
- [ ] Legal review of this document and the licences page.
