# Third-party licences

Khameleon uses the open-source software, models and materials below. The same notices are shown in the app under **About Khameleon → Licences** (`artifacts/khameleon-command/src/lib/licences.ts`). Rules and the pre-launch clean-up checklist: `docs/legal-compliance.md`.

**This list is not yet complete.** The full dependency list (every npm package, plus Electron/Chromium's bundled notices) is generated during the pre-launch clean-up.

| Component | Used for | Licence | Copyright | Changes |
|---|---|---|---|---|
| Qwen 2.5 Instruct (1.5B and 7B) | Khami's built-in language model | Apache 2.0 | Copyright 2024 Alibaba Cloud | — |
| llama.cpp | Runs Khami on the user's computer | MIT | Copyright (c) 2023-2026 The ggml authors | — |
| node-llama-cpp | Connects Khameleon to llama.cpp | MIT | Copyright (c) 2023 Gilad S. | — |
| internal-comms skill | Basis of Khameleon's "Internal communications" skill | Apache 2.0 | Copyright 2025 Anthropic, PBC | Rewritten and adapted for Khameleon |
| skill-creator skill | Basis of Khameleon's "Skill writer" skill | Apache 2.0 | Copyright 2025 Anthropic, PBC | Instructions only; rewritten and adapted for Khameleon |
| Model Context Protocol TypeScript SDK | Connecting to integrations | MIT | Copyright (c) 2024 Anthropic, PBC | — |
| Anthropic TypeScript SDK (`@anthropic-ai/sdk`) | Connecting to Claude when an organisation provides it | MIT | Copyright 2023 Anthropic, PBC. | — |
| tesseract.js | Reading text from scanned documents and photos | Apache 2.0 | tesseract.js contributors | — |
| pdf-parse | Reading text from PDFs | Apache 2.0 | pdf-parse contributors | — |
| Electron | Desktop app | MIT | Copyright (c) Electron contributors | — |
| React | User interface | MIT | Copyright (c) Meta Platforms, Inc. and affiliates. | — |

The full Apache 2.0 and MIT licence texts are included in the app (About Khameleon → Licences → "Show licence text") and must also ship as files inside the installed app before launch (clean-up checklist).

Not used, by decision: Anthropic's Word/PDF/PowerPoint/Excel skills (restricted licence), Anthropic's doc-coauthoring skill (no licence; Khameleon's "Document co-writing" was written from scratch), Llama models, Ollama, MiniMax, OpenRouter.
