# Khami — Design

Decided by Newton, 2026-10-17. Replaces the earlier Build 15 ("Skills anywhere") wording in `docs/build-review.md`.

## What Khami is

Khami is Khameleon's own AI agent and **the main AI in Khameleon** — not a fallback. Most organisations won't give their staff access to Claude, so Khameleon must do its work without it. Claude, Azure OpenAI (common in Copilot organisations), GPT and others are optional extras, used only when a user has access and a task genuinely needs more.

## How it's built (option 1, with option 2 later)

- **The agent is ours.** Planning, tools, skills, memory, document reading (including OCR), app control, capture and replay — our own code, branded Khami, running fully offline.
- **The language brain is built in and invisible.** An open model with a commercial-use licence (Apache 2.0 / MIT — e.g. Qwen 2.5) is packaged inside Khami. Users never choose, see or set it up; it's part of Khami. Its notice appears in the licence list only.
- **Code first.** Anything that can be done exactly by plain code is done that way — matching figures, sums and totals, replaying recorded steps, reading documents, rules-based sorting. The brain is used for understanding requests and writing.
- **Later (option 2):** train Khami's own brain on top of the open model using Khameleon's real work tasks (reconciliations, invoices, minutes, procedures), so it becomes better at our jobs than the original. Cost in the thousands, not millions; worth doing once real users and examples exist.
- **Rejected:** training a brain from scratch (millions, and still weaker); no brain at all (can't understand requests or write).

## Where Khami's brain runs (decided 2026-10-17)

**On each person's computer by default, with an option to run it on the organisation's own Khameleon server.** Individuals get a fully offline Khami on their laptop; organisations can run one powerful copy on their Khameleon server for everyone - work still never leaves the company, and staff with older laptops get the stronger brain. Rejected: computer-only (limited by each laptop); server-only (no longer offline away from the office).

## Khameleon first, Copilot first among outside AIs (decided 2026-10-18)

Newton (revising the same-day "Copilot is the main agent" idea): **Khameleon comes first** - Khami handles the work - and **outside AIs come second**, with **Microsoft 365 Copilot the first choice among them** because it's what most organisations provide. So: Khami leads the chat's agent row and is the default; Copilot sits next and is the first AI Khami escalates to (the escalation step, step 5, will offer "Use Copilot for this?" before any other outside AI); then Claude, GPT and others the organisation has added. If Khami isn't set up, the chat defaults to Copilot when it's connected. Confidential work never leaves the computer.

How it connects: Microsoft's **Copilot Chat API** (Microsoft Graph, `/beta/copilot/conversations`) - currently a preview that Microsoft says isn't supported for production. Needs a work account with a Microsoft 365 Copilot licence, and the admin-approved read permissions Microsoft lists (Sites.Read.All, Mail.Read, People.Read.All, OnlineMeetingTranscript.Read.All, Chat.Read, ChannelMessage.Read.All, ExternalItem.Read.All). Copilot answers using the user's own Microsoft 365 data. It can't use Khameleon's tools or integrations; skills are passed to it as instructions. Each Khameleon turn starts a fresh Copilot conversation with earlier turns passed as context.

## How work flows

1. **Khami does everything first, offline.**
2. **When a task is beyond Khami** (long or nuanced writing, complex reasoning) or it isn't confident, it asks: *"This one's tricky — use [Claude / your company's AI] for it?"* — using whatever the user actually has. A setting chooses: always ask (default), escalate automatically, or never escalate.
3. **Confidential work never leaves the computer** — Khami won't escalate it, even if asked.
4. **Nothing else available or no internet** — Khami does its best and says plainly when an answer may be weaker.

### Built (step 5, 2026-10-19)

- **Tricky work** is spotted by plain code (long writing, careful reasoning, very long requests) and by Khami's own "I'm not sure" answers. Khami then offers the first outside AI the user has - Microsoft 365 Copilot, then the organisation's Azure OpenAI, then Claude, GPT, Gemini. Settings > AI: ask first (default), hand over automatically, or never.
- **Confidential lock:** a lock in the chat, or automatic when a message includes bank/card/NI numbers, pay, health or HR-case details, passwords, passport/date-of-birth details, or is marked confidential. Enforced on the server for the chat and every feature using the shared AI helper (`lib/askAI.ts`).
- **Azure OpenAI** is an outside AI an admin sets up in Settings > AI.
- **GPT, Gemini and Azure use the same safe tools** as Khami and the chat (function calling, `agents/openAiToolLoop.ts`).

## Carried over from earlier decisions

- Skills work with Khami: Khameleon picks the matching skill itself and hands Khami the steps (Claude keeps its own proven way when it's the one answering).
- **Integrations** (Claude's "connectors"/MCP) are run by Khameleon itself so they work with Khami and any other AI. Remote integrations need internet; local ones work offline.
- Claude Skills can be imported straight into My skills.
- The Khami brain downloads during first-run setup with a progress bar: **Standard** (~1 GB, most machines) or **Better** (~4–5 GB, needs 16 GB memory). Not bundled in the installer.
- Azure OpenAI is supported as an optional engine for Copilot organisations; a direct Microsoft 365 Copilot connection is researched before committing.
- Agents vs engines: Khameleon's agents are named by job (Khameleon, Planner, Inbox & Calendar, Researcher, Capture, Procedure Checker, Operator — line-up to be confirmed). AI companies' models are engines in Settings, not "agents" in the chat. MiniMax and OpenRouter to be removed; Llama avoided (licence conditions).

## What this changes about the existing app

Almost every AI feature built so far is hard-wired to Claude (chat, planning, research, email drafting/summarising/sorting, task runner, skill suggester, desktop control). Each one has to move onto a single engine layer so it runs on Khami by default.

## Honest limits

- Khami's built-in brain is much smaller than Claude. Good at structured, well-defined work (especially with a skill to follow); weaker at long, subtle writing and complex reasoning — which is exactly where escalation comes in.
- Running the brain needs a reasonably modern machine; Standard runs on most, Better needs 16 GB memory.
- Licences: every model offered is checked for commercial use when added; notices shipped; legal review before selling (see pre-launch checklist).

## Brain comparison (2026-10-17, this Mac: ~9 GB memory)

Same six tasks on each brain, via Khami in the running app.

| Task | Standard (1.5B) | Better (7B) |
|---|---|---|
| Load time | 3 s | 12 s |
| Quick fact (bank reconciliation) | 2 s, correct | 8 s, correct |
| Meeting minutes, no skill | 11 s, repetitive | 34 s, cleaner |
| Meeting minutes, following a skill | 43 s, repeated sections | 29 s, clean and well structured |
| "What team do I work in?" after "I work in finance" | wrong | wrong |
| Reconcile two invoice lists | 3 s, **wrong items and wrong difference** | 21 s, found INV-102 (−$45) and INV-105, **missed INV-103** |
| Polish an email | 2 s, kept "ASAP", signed "Khami" | 13 s, polite and professional, signed "Khami" |

Takeaways:
- Better is clearly better at writing and structure; 4–8× slower on a 9 GB machine (8–34 s per answer).
- **Neither brain can be trusted with exact matching or sums** — confirms the code-first rule: reconciliation and invoice checks must be done by code, with the brain only explaining the result.
- Skills help structure (cleaner minutes with Better).
- Both miss simple inferences ("finance" → "team") — escalation is needed for nuanced questions.
- Fix: Khami signs emails as "Khami" — instructions must say never to sign on the user's behalf as Khami.
