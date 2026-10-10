# Gap Review — Decisions

Running record of Newton's answers while reviewing the Gap items from `docs/ui-parity.md`. Guiding principle (Newton, 2026-10-10): Khameleon should do a few things really well rather than carry everything forward at an average level. Whether a full fallback app ("Open full Khameleon") is needed gets decided at the end, based on what survives this review.

Layout/style variants (palette, edge chrome, bare vs pill icons, hover) are user-selectable options — see `DECISIONS.md`, 2026-10-10.

| # | Item | Decision |
|---|---|---|
| 1 | Theme toggle + account menu | **One small settings icon** (4th icon on "Ask & Find", or chat-window corner) opening a small panel: theme, layout/style choices, and account/login (account section only when multi-user accounts are on). |
| 3 | Work Domains | **Keep, repurposed as the link between captured skills and company documentation.** Each domain holds its procedure documents (e.g. Finance → finance manual, reconciliation procedure). A captured skill is filed under a domain (Khameleon suggests, user confirms), and the procedure comparison runs against that domain's documents only. The active domain also gives automatic detection context. See memory note on the skill-capture vision. |
| 4 | Tasks (to-do manager, focus/queue/parked, commands, digest schedule) | **Keep the full task manager**, in a panel opened from the settings icon, with every current feature intact (manual create with category/priority/recurrence/due date, group/filter, subtasks, "Decompose", Skill Set suggestions, focus/queue/parked, command history). |
| 5 | Agents screens (Roster, Compare, Agent Settings) | **Fold into existing places.** Agent setup becomes an "Agents" tab in the settings panel (add/edit/remove, keys). The chat's agent picker shows each agent's live status. Compare becomes how Parallel mode displays results (side-by-side answer cards in chat). Per-agent performance numbers join the Status tab (Q2). Reason: multi-vendor agent setup is core to Khameleon's positioning; Roster/Compare duplicated what chat can show. |
| 6 | Research results and history | **Research lives in the chat.** Started from the "Ask & Find" question-mark icon or chat; report appears in the conversation (with "open as document" for long ones); the reasoning toggle shows each step; every result auto-saved to memory so it can be asked for later. Separate Research page dropped. Note: this makes "save to memory" real — the current page's toggle never worked. |
| 7 | Memory (index control, conversation history, search) | **Spread to where it's used.** Adding documents happens inside each Work Domain (e.g. settings → Domains → Finance → add procedures), plus a general "add to memory" for anything outside a domain. Past conversations become a reopenable list in the chat window (reusing the session-resume plumbing built for the Morning Briefing). Search stays on the "Ask & Find" toolbar; storage stats move to the Status tab. Separate Memory page dropped. |
| 8 | Messages page "Data Connectors" panel | **Dropped.** It duplicated the Integrations page's connection status; status lives only wherever Integrations ends up (Q13). The never-built "Channels" panel on the same page was already on the drop list. |
| 9 | Analytics | **Merged into the Status tab** as a "Trends" section: questions over time, cost over time, per-agent table. Response-speed (latency distribution) chart and the broken "Energy over time" chart (which actually showed cost data) dropped. Not chosen but flagged: "time saved by captured skills" value metrics would suit the skill-capture vision once skills exist. |
| 10 | Security page | **Spread to where it belongs.** Access control + team accounts → settings panel's account section (Q1). Credential status → merged into key management in the Agents tab (Q5). Audit log → merged with the Status tab's activity log (Q2), fixed to record failures (today every row is hardcoded "SUCCESS"). Guardrails → kept as a short read-only "Security" section in the settings panel (trust signal for IT/security reviewers). Separate Security page dropped. |
| 11 | Vault | **Kept as a "Credentials" section in the settings panel, linked to skills.** A captured skill can use a stored login (e.g. the third-party web app in the reconciliation example), and Khameleon asks before using it (at least the first time). Missing edit feature added (backend PATCH already exists, no UI today). |
| 12 | Skills | **A dedicated Skills panel, one click from a toolbar** — new 4th icon on "Capture & Extract" ("My skills"). Skills grouped by domain; each shows its steps, its procedure-comparison result ("matches" / "differs at step 3" / "no procedure found"), and run/edit/delete. New captures land here automatically. Hand-authoring and importing (with the existing confirm gate) stay. Starter-skill install bug fixed. Newton: "be mindful of the things that still need to be built" — see "New builds required" below. |
| 13 | Integrations | **A "Connections" tab in the settings panel** holding the directory (connect/disconnect/status) and the custom OpenAPI/MCP import. In the Skills panel, each skill shows which connections it needs and offers to connect any that are missing. |
| 14 | Approvals (inbox pickers, action history) | **Act on what's open, with a picker as fallback.** Toolbar actions (draft reply, summarise, sort inbox) work on the email the user has open; when Khameleon can't tell which one (always, until screen/selection detection is built), it shows a small list of recent messages. Action history (with Undo) merges into the single activity log in the Status tab. Separate Approvals page dropped. |
| 15 | Projects | **Folded into the task manager.** "Project" becomes something a task belongs to; the task manager groups by project and shows per-project progress. Standalone Projects page, the never-collected risks/tags fields, and the five do-nothing "coming soon" connector buttons dropped. |
| 16 | Calendar | **Drop the calendar view; keep calendar access; add meeting prep.** Khameleon can read the user's calendar so they can ask about their schedule in chat (new — chat has no calendar tool today). Before a meeting, Khameleon prepares a short brief (attendees, related emails, action items) and surfaces it in chat, using the calendar fields that exist but are never shown today (`aiPrep`, `actionItems`, `relatedProject`). |
| 17 | Inbox | **Drop the inbox view; keep inbox access in chat; add proactive urgent flags.** User can ask "anything urgent?" and Khameleon answers using the existing inbox-sorting (triage) skill (new — chat has no inbox tool today). When something genuinely urgent arrives, Khameleon flags it through the suggestion slot at the top of the screen — kept rare so it doesn't become a nuisance. |
| 18 | Remaining Settings sections | **Three tabs kept, the rest dropped.** **Profile** (name/role, morning digest time, redo first-run setup), **Look & layout** (real theme + palette/layout/icon choices), **Voice** (mic access, wake word, speed/pitch/volume, voice choice, preview — unchanged). Server status check → Status tab. Dropped: Engine section, scan lines, panel corners, ticker speed, the no-op theme toggle and disabled font-size control, disabled workspace-name/language boxes, read-only Memory/Telemetry/Advanced defaults, Spotify now-playing, weather default location. |
| Final | Is a full fallback app ("Open full Khameleon") needed? | **No.** Every gap found a home. The overflow is organised as two panels plus Skills: a **Settings** panel (set-up-once: Profile, Look & layout, Voice, Account, Agents, Connections, Credentials, Security) opened from the settings icon, and a **Workspace** panel (day-to-day: Tasks, Domains & documents, Status) opened from the Khameleon head (right-click, so a normal click still opens chat). Skills panel stays on its own toolbar icon. **Old UI preserved permanently** as git tag `legacy-dashboard-ui` (commit `bf9703b`) so it can be restored later. |
| 2 | Status numbers, activity log, feed ticker | **Keep everything, behind the settings icon** in a "Status" tab: queries, latency, cost, energy, model, uptime, plus the activity log. Out of sight until opened. Follow-up for Phase 3: "energy" (a cost-derived estimate) and "model" (hardcoded server-side) aren't real measurements — fix them or label them honestly before they ship in the new Status tab. |

## New builds required (not relocations)

Everything the decisions above need that doesn't exist today. Kept separate so Phase 3 planning can size it honestly — relocating an existing feature is cheap, these aren't.

**Core skill-capture workflow (the heart of the product):**
- **Capture** — record what the user does when they ask Khameleon to "capture" (e.g. the reconciliation) and turn it into reusable skill steps. (Q12)
- **Procedure comparison** — compare a skill's steps against its domain's company procedure documents and report "matches" / "differs at step N" / "no procedure found." (Q3, Q12)
- **Automatic task detection** — recognise a real work task on screen and offer to capture it. Largest of these; planned but needs its own plan. (Q3, `OPEN_QUESTIONS.md`)
- **Domains hold procedure documents** — attach documents to a Work Domain; capture suggests a domain for each new skill. (Q3, Q7)
- **Skills use stored logins** — a skill can draw a credential from the Vault, with Khameleon asking before it does. (Q11)
- **Skills know their connections** — each skill records which connections it needs; the Skills panel shows them and offers to connect missing ones. (Q13)

**Acting on what's on screen:**
- **Know which email is open** — detect the message the user has open/selected in Outlook or Gmail (screen reading, or asking the app for its current selection) so toolbar actions apply to it directly. Until built, the recent-messages picker is shown every time. (Q14)

**Calendar:**
- **Chat can read the calendar** — a calendar tool for the chat's agent ("what's on this afternoon?"). Calendar data currently only feeds the page being dropped. (Q16)
- **Meeting prep** — before a meeting, prepare a short brief (attendees, related emails, action items) and surface it in chat. (Q16)

**Inbox:**
- **Chat can check the inbox** — "anything urgent?" answered via the existing triage skill. (Q17)
- **Proactive urgent flags** — genuinely urgent mail surfaced in the suggestion slot; needs a real "urgent enough to interrupt" threshold so it stays rare. First real use of the suggestion slot. (Q17)

**Smaller new pieces:**
- Action history Undo carried into the merged activity log. (Q14)
- Task manager: group by project and show per-project progress. (Q15)
- Settings panel itself (the small panel behind the settings icon), with its tabs: look & layout options, account, Status, Agents, Credentials, Security, task manager. (Q1, Q2, Q4, Q5, Q10, Q11)
- Persisted user preferences for palette / edge layout / bare icons. (`DECISIONS.md`, 2026-10-10)
- Head icon live-state display was *not* chosen (Q2 went to option 3), so not required.
- Past-conversations list in the chat window (reuses existing session-resume plumbing). (Q7)
- Research auto-saves results to memory. (Q6)
- Parallel mode shows side-by-side answer cards in chat; agent picker shows live status. (Q5)
- Merged activity/audit log that records failures, not just successes. (Q10)
- Vault edit UI (backend already supports it). (Q11)
- Fix: starter-skill install button. (Q12)
- Fix or honestly label "energy" and "model" figures before they ship in the Status tab. (Q2)
