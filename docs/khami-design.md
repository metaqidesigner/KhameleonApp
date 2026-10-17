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

## How work flows

1. **Khami does everything first, offline.**
2. **When a task is beyond Khami** (long or nuanced writing, complex reasoning) or it isn't confident, it asks: *"This one's tricky — use [Claude / your company's AI] for it?"* — using whatever the user actually has. A setting chooses: always ask (default), escalate automatically, or never escalate.
3. **Confidential work never leaves the computer** — Khami won't escalate it, even if asked.
4. **Nothing else available or no internet** — Khami does its best and says plainly when an answer may be weaker.

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
