# UI Parity Comparison — Old Dashboard vs. New Overlay

> **Update 2026-10-10:** the Gap rows below have been reviewed one by one with Newton — see `docs/gap-review.md`, which supersedes them. Outcome: no "Open full Khameleon" fallback; gaps are homed in the toolbars, chat, a Skills panel, a Settings panel and a Workspace panel. This document will be re-run against the real implementation in Phase 3.

Phase 2 of the `ui-overlay-redesign` project. One row per function identified in `docs/ui-inventory.md` (Phase 0). Status is one of: **Covered** (works the same, possibly restyled), **Relocated** (real home found elsewhere in the new design, and added to the Phase 1 sample where practical), **Gap** (no home yet — proposed below, needs Newton's decision), **Dropped** (needs explicit approval — listed with why).

**Framing, stated honestly up front:** the old UI is a 16-tab dashboard; the new UI is a 4-toolbar action overlay + one chat window + one small head. These are different *kinds* of interface — a dashboard is for browsing/managing state, an overlay is for taking quick action on whatever's already on screen. Nearly every pure browsing/management screen (Tasks, Projects, Calendar, Inbox, Settings, Vault, Security, Analytics, Agents roster/compare/council, Skills catalog, Memory browsing, Approvals history) has **no natural home in four slim toolbars** — there isn't a design trick that fixes this, it's a real consequence of the shape change. The proposed, uniform answer for all of them is the same: **"Open full Khameleon"**, a new option on the Khameleon Head's right-click menu (built into the Phase 1 sample) that opens the existing dashboard, completely unchanged, as a secondary surface. The overlay doesn't replace the dashboard — it sits in front of it for quick actions, with the full app one click away for everything else. This is the single biggest decision in this document; everything below assumes it unless you say otherwise.

---

## App shell / chrome

| Old function | Where it lives today | Where it lives in the new UI | Status | Notes |
|---|---|---|---|---|
| TopBar search → Command Palette | `TopBar.tsx` | Cmd/Ctrl+K kept as a global shortcut; "Ask & Find" toolbar's chat-bubble icon opens the same Chat box | Covered | Cheap to keep both; no reason to drop a working shortcut. |
| TopBar bell (notifications) | `TopBar.tsx` | — | **Dropped** | Was already decorative — no click handler, no real data. Nothing to migrate. |
| TopBar "More" (⋯) | `TopBar.tsx` | — | **Dropped** | Already decorative, no menu behind it. |
| TopBar theme toggle | `TopBar.tsx` | "Open full Khameleon" → Settings → Appearance | Gap → Relocated | Minor; not overlay-shaped (a whole-app theme doesn't make sense to toggle from an edge pill). |
| TopBar account menu (multi-user) | `TopBar.tsx` | "Open full Khameleon" → Security tab | Gap → Relocated | Account management is inherently a full-screen task. |
| Left sidebar nav (Canvas/Tasks/Agents/Analytics/Comms/Approvals/Settings) | `LeftSidebar.tsx` | "Open full Khameleon" menu item | Gap → Relocated | A persistent icon rail doesn't fit a transparent overlay; one entry point replaces seven. |
| Command Palette's 14-tab module search | `CommandPalette.tsx` | "Open full Khameleon," or ask Khameleon directly in chat ("open my tasks") | Gap → Relocated | Chat-driven navigation is arguably *better* here than a palette — worth trying in Phase 3. |
| Command Palette's 4 fake ACTIONS | `CommandPalette.tsx` | — | **Dropped** | Already fake (all four silently just opened the Canvas tab). Not resurrected. |
| System Status panel (query/latency/cost/energy/engine/model/uptime) | `canvas.tsx` (Live Wall right column) | Condensed into the Chat box as a small header stat strip; full detail via "Open full Khameleon" | Gap → proposed, **not yet added to sample** | A 6-number dashboard panel doesn't fit a 320px chat window header either — needs its own design pass, flagging rather than guessing. |
| Agent Activity panel | `canvas.tsx` | Chat box's reasoning toggle (added to sample) covers *this agent's* activity; the full cross-agent log needs "Open full Khameleon" | Relocated + Gap | Partially covered live in the sample (reasoning trace line). |
| Khameleon feed ticker | `NewsTicker.tsx`, global chrome | "Open full Khameleon"; optionally a collapsed footer strip in the Chat box | Gap | A scrolling ticker is a dashboard-chrome idiom, doesn't read as "overlay." Proposing to drop the always-on ticker and keep the data reachable on request. |
| `jarvisStore` chat window state (bounds/docked/route-mode/reasoning) | `jarvisStore.ts` | Same concepts, new chat box (bounds/palette/reasoning state already real in the sample) | Covered | |
| Cmd/Ctrl+J, Cmd/Ctrl+Shift+D | `ChatWindow.tsx` | Carry over unchanged to the new Chat box | Covered | |
| Dual Cmd/Ctrl+J binding (Chat Window vs. orb popup) | `ChatWindow.tsx` + `JarvisOrb.tsx` | N/A — only one chat surface exists in the new design | **Dropped** (the bug, not the shortcut) | The redesign itself fixes this collision by construction — there's only one chat window now, not two. |
| Dead Cmd/Ctrl+B sidebar shortcut | `components/ui/sidebar.tsx` | — | **Dropped** | Already dead code, unused component. |
| Voice / wake-word system | `useVoice.ts`, `VoiceController.tsx` | Unchanged — mic button on the Chat box, wake word still runs globally | Covered | Voice is independent of window shape; nothing about it needs to change. |
| Mic permission modal | `VoiceController.tsx` | Unchanged | Covered | |
| NeedsInputWatcher (the one real notification) | `NeedsInputWatcher.tsx`, bottom-right banner | Same banner, repositioned (the Head now occupies the old bottom-right corner) | Relocated | Needs a real position decision in Phase 3 — top-right is the obvious alternative, flagging not deciding here. |
| Dead toast system | `use-toast.ts`, `toast.tsx` | — | **Dropped** | Already fully unused; no reason to migrate dead code into a new UI. |
| Onboarding wizard | `OnboardingWizard.tsx` | Unchanged — still a full-screen first-run flow, runs before/independent of the overlay | Covered | |

## Canvas / Live Wall

| Old function | Where it lives today | Where it lives in the new UI | Status | Notes |
|---|---|---|---|---|
| Decorative top nav ("Work mode"/"Agents"/"Research") | `CommandWall.tsx` | — | **Dropped** | Already fake, no click handlers. |
| Live/Pause toggle | `CommandWall.tsx` | — | **Dropped** | Already cosmetic-only. |
| Orchestration-mode picker (decorative one on Live Wall) | `CommandWall.tsx` | — | **Dropped** | Fake; superseded by the *real* route-mode picker, which is Covered above (it was always on the Chat Window, not here). |
| Work-Domain filter | `CommandWall.tsx` top bar | "Open full Khameleon"; a lightweight version could live in chat later | Gap | Low priority — Work Domains mainly matter for Skills/Integrations browsing, both full-screen destinations anyway. |
| Reasoning-visibility toggle | `CommandWall.tsx` top bar | Chat box header (added to sample, sparkle icon) | Relocated | |
| Activity-feed slide-out | `CommandWall.tsx` | "Open full Khameleon" | Gap | |
| Parked orbit (left column) | `CommandWall.tsx` | "Open full Khameleon" → Tasks | Gap | A parked-tasks list needs real screen space; no overlay-shaped version proposed. |
| Work in motion / Queue / current focus (center column) | `CommandWall.tsx` | "Open full Khameleon" → Tasks | Gap | |
| Wall status (right column: health, per-agent dots, connectors, progress) | `CommandWall.tsx` | Same proposal as System Status above | Gap | |
| Orb overlay chat window (bottom-right of Live Wall) | `CommandWall.tsx` | **This is what the new Chat box + Head directly replace** | Covered | The clearest 1:1 replacement in the whole comparison — this is the feature the redesign is built around. |

## Agents

| Old function | Where it lives today | Where it lives in the new UI | Status | Notes |
|---|---|---|---|---|
| Single-agent chat | `pages/agents/AgentChat.tsx` | **This is the new Chat box** | Covered | |
| Roster (list/edit agents) | `pages/agents/Roster.tsx` | "Open full Khameleon" → Agents | Gap | |
| Multi-Agent (parallel/vote broadcast) | `MultiAgent.tsx` | Chat box's route-mode pills (Parallel/Vote, added to sample) cover the *action*; the dedicated comparison-grid view stays full-screen | Relocated + Gap | |
| Compare | `Compare.tsx` | "Open full Khameleon" → Agents → Compare | Gap | A side-by-side results table needs real width. |
| Council | `Council.tsx` | Chat box's "Council" route-mode pill (added to sample) covers running one; the multi-round transcript view stays full-screen | Relocated + Gap | |
| Agent Settings (CRUD) | `AgentSettings.tsx` | "Open full Khameleon" → Agents → Settings | Gap | |

## Research, Memory, Communications, Analytics

| Old function | Where it lives today | Where it lives in the new UI | Status | Notes |
|---|---|---|---|---|
| Run a research query | `pages/research.tsx` | "Ask & Find" toolbar (question-mark icon) or directly in chat | Relocated | The *action* fits the overlay; the trace-log/history view doesn't. |
| Research history/trace log | `pages/research.tsx` | "Open full Khameleon" → Research | Gap | |
| "SAVE TO MEMORY" toggle (already fake) | `pages/research.tsx` | — | **Dropped** | Never worked; not resurrected. |
| Memory semantic search | `pages/memory.tsx` | "Ask & Find" toolbar (search icon) | Relocated | |
| Memory index control / agent-history browsing | `pages/memory.tsx` | "Open full Khameleon" → Memory | Gap | |
| Comms "Channels" (already labeled PLANNED) | `pages/communications.tsx` | — | **Dropped** (stays dropped) | It was never built; the redesign doesn't change that status. |
| Comms "Data Connectors" | `pages/communications.tsx` | "Open full Khameleon" → Integrations (same relocation it already does today) | Gap | |
| Analytics charts/matrix | `pages/analytics.tsx` | "Open full Khameleon" → Analytics | Gap | Charts need real width; no overlay-shaped version proposed. |
| Analytics "Energy over time" (already a bug) | `pages/analytics.tsx` | — | **Dropped** | Mislabeled duplicate chart; fix in the real page if/when rebuilt, not a redesign concern. |

## Security, Vault, Skills, Integrations, Approvals

| Old function | Where it lives today | Where it lives in the new UI | Status | Notes |
|---|---|---|---|---|
| Access Control / Team Accounts | `pages/security.tsx` | "Open full Khameleon" → Security | Gap | |
| Credential Vault Status / Guardrails / Audit Log | `pages/security.tsx` | "Open full Khameleon" → Security | Gap | |
| Vault (secrets CRUD) | `pages/vault.tsx` | "Open full Khameleon" → Vault | Gap | |
| Skills catalog / author / import | `pages/skills.tsx` | "Open full Khameleon" → Skills | Gap | |
| Integrations directory + custom OpenAPI/MCP import | `pages/integrations.tsx` | "Open full Khameleon" → Integrations | Gap | Genuinely too complex (forms, confirm gates, operation lists) for an edge toolbar. |
| Outlook/Gmail draft-email (compose) | `pages/approvals.tsx` | **"Create & Draft" toolbar** (pen icon) | **Relocated — the clearest real win of the new design** | This is exactly the kind of "act on what's on screen" task the overlay is built for. |
| Outlook-summarize-thread | `pages/approvals.tsx` | "Ask & Find" or "Capture & Extract" toolbar | Relocated | |
| Outlook-triage-inbox (classify/flag/archive) | `pages/approvals.tsx` | **"Transform & Clean" toolbar** (funnel icon) | Relocated | |
| Tone-rewrite | `pages/approvals.tsx` (via Mobile Briefing / drafts) | **"Transform & Clean" toolbar** (sparkle icon) | Relocated | |
| Approvals demo button (already fake) | `pages/approvals.tsx` | — | **Dropped** | Already explicitly labeled a demo; not resurrected. |
| Approvals inbox browsers + Action History | `pages/approvals.tsx` | "Open full Khameleon" → Approvals | Gap | |

## Tasks, Projects, Calendar, Inbox, Work Domains

| Old function | Where it lives today | Where it lives in the new UI | Status | Notes |
|---|---|---|---|---|
| My Tasks (full CRUD, Decompose, Skill Set suggestions) | `pages/tasks.tsx` | "Open full Khameleon" → Tasks | Gap | |
| Commands (command bar + TaskRun tracking) | `pages/tasks.tsx` | Overlay toolbars + chat directly replace the *need* for a separate command bar | Covered (by replacement, not migration) | |
| Auto Triggers (real digest + 2 fake static placeholders) | `pages/tasks.tsx` | Real digest: "Open full Khameleon" → Settings. Fake placeholders: not resurrected. | Gap / **Dropped** | |
| Projects (list + detail) | `pages/projects/*` | "Open full Khameleon" → Projects | Gap | |
| Calendar (read-only event list) | `pages/calendar.tsx` | "Open full Khameleon" → Calendar | Gap | |
| Inbox (unified read list) | `pages/inbox.tsx` | "Open full Khameleon" → Inbox | Gap | |
| Work Domains management (`WorkDomainFilterBar`) | shared component, Skills/Integrations pages | "Open full Khameleon" | Gap | |

## Settings, Onboarding, orphaned/dead code

| Old function | Where it lives today | Where it lives in the new UI | Status | Notes |
|---|---|---|---|---|
| All 9 Settings sections | `pages/settings.tsx` | "Open full Khameleon" → Settings | Gap | |
| Onboarding wizard | `OnboardingWizard.tsx` | Unchanged | Covered | (listed again here for completeness) |
| 4 orphaned stub pages (chat/automations/knowledge-graph/marketplace) | `pages/*.tsx` | — | **Dropped** | Already unreachable from the running app; the redesign doesn't need to carry dead weight forward. |
| `not-found.tsx`, `dashboard.tsx` | `pages/*.tsx` | — | **Dropped** | Already orphaned dead code. |

---

## Summary counts

| Status | Count |
|---|---|
| **Covered** | 13 |
| **Relocated** | 10 |
| **Gap** (proposed home, not yet built) | 26 |
| **Dropped** (needs your explicit approval) | 15 |

**Total rows: 64.**

## Everything that needs your decision

**The one big structural decision:** approve (or reject) the "Open full Khameleon" pattern as the catch-all home for every Gap above. If you reject it, every one of those 26 Gap rows needs a different real answer before Phase 3 can start — there's no version of this redesign where a 16-tab dashboard's worth of content fits into four 3-icon toolbars on its own.

**Items proposed as Dropped — please confirm each is actually fine to lose, not just "it was already fake so I assumed it didn't matter":**
1. TopBar bell, TopBar "More," Command Palette's 4 fake actions, Live Wall's 3 decorative top-bar controls, the already-dead toast system, the dead Cmd/Ctrl+B shortcut, Comms' already-PLANNED Channels, Analytics' buggy duplicate chart, Approvals' demo button, Research's fake "save to memory" toggle, Tasks' 2 static placeholder triggers, and the 4 orphaned stub pages + 2 dead-code pages — **all of these were already non-functional before this redesign**, so "Dropped" here just means "not specially resurrected," not "a working feature was cut." Flagging each individually anyway, per the brief's own rule that every Drop needs explicit sign-off.

**Items genuinely still open, no proposal made yet (flagged, not guessed):**
- A concrete design for condensing System Status / Agent Activity / the feed ticker into something overlay-shaped, if you want them to survive in spirit rather than move wholesale into "Open full Khameleon."
- Exact repositioning of the NeedsInputWatcher banner now that the Head occupies its old corner.
- Whether Work-Domain filtering deserves a lightweight overlay-native version or is fine living only in the full app.

**Also still open from Phase 1 itself (see `OPEN_QUESTIONS.md`):**
- Electron vs. Tauri for the real desktop overlay shell.
- Palette: Option A (soft blue/white, matches your reference image) vs. Option B (Khameleon's existing dark teal) — both built and live-switchable in the sample.
