# Khameleon UI Ground-Truth Inventory

Phase 0 of the `ui-overlay-redesign` project. Every screen, panel, window, control, shortcut, voice trigger, notification, setting, and status indicator in the current `artifacts/khameleon-command` frontend, with the real backend dependency (or honest "fake/stub" flag) for each. Compiled by reading the actual code, not assumed from memory — file:line citations throughout.

**Status:** Phase 0 complete — app shell/chrome and every individual page merged in below.

**Routing model:** there is no URL router for the main app (`App.tsx` just mounts `AppShell`, or `MobileBriefing` under `/briefing`). All 16 tabs are `lazy()`-imported in `AppShell.tsx` and switched by `jarvisStore.activeTab` — no 17th tab exists anywhere. `LeftSidebar.tsx` only shows icons for 6 of the 16 (canvas/tasks/agents/analytics/comms/approvals + settings); the other 9 (research/memory/security/vault/skills/integrations/projects/calendar/inbox) are reachable only via Cmd/Ctrl+K — not unreachable, just not icon-visible. The one exception: `pages/projects` uses real `wouter` URL routing internally (`/projects`, `/projects/:id`) — the only page in the app that does.

---

## App shell / chrome

Everything in `AppShell.tsx` that's always mounted, plus the global nav/shortcut/notification systems. File paths relative to `artifacts/khameleon-command/src/` unless marked `[api-server]`.

**Always-mounted tree** (`components/AppShell.tsx:66-94`): `Background`, `TopBar`, `LeftSidebar`, `PageRouter` (the active tab's content), `NewsTicker`, `CommandPalette`, `ChatWindow`, `JarvisOrbPortal` (floating orb, "always present" per its own comment), `NeedsInputWatcher`, `VoiceController`, `OnboardingWizard` (renders `null` unless open — mounted but inert).

**Tab routing is not a real router** — `activeTab` lives in `jarvisStore` (persisted to `localStorage['jarvis-ui']`); `PageRouter` is a chain of `{activeTab === 'x' && <X/>}` conditionals, no URL changes. 16 lazy-loaded tabs: `canvas` (→ `pages/canvas.tsx`'s `UnifiedCanvas`, 816 lines — `pages/home.tsx` is just a 13-line re-export), `agents`, `research`, `memory`, `comms`→`pages/communications`, `analytics`, `security`, `vault`, `skills`, `integrations`, `approvals`, `settings`, `tasks`, `projects`, `calendar`, `inbox`.

### TopBar (`components/TopBar.tsx`)

Left: static teal-hexagon brand mark + "Khameleon" wordmark (134-148). Right-side icon row (150-167):
- **Search** (152-154) — real, opens Command Palette.
- **Bell/notifications** (155-161) — **decorative.** No click handler; a static coral dot always renders regardless of any real state. Not wired to anything.
- **"More" (⋯)** (162-164) — **decorative.** No handler, no menu.
- **Theme toggle** (7-29, 165) — real but shallow: toggles a `light` class + `localStorage['khameleon-theme']`. Inconsistent with Settings → Appearance's own "THEME" toggle, which is hardcoded on/no-op (see Settings below) — two different mechanisms that don't agree.
- **Account menu** (54-129, 166) — real once multi-user accounts mode is active (dropdown with name/email, "Account settings" → jumps to Security tab, real logout). On a single-user/no-accounts instance it's still just the old decorative `<User>` icon, now conditionally so.

No clock, no engine/model indicator, and no Cmd/Ctrl+K hint text live in TopBar itself.

### Left sidebar (`components/LeftSidebar.tsx`)

6 icon buttons + a pinned Settings button at the bottom: Canvas, Tasks, Agents, Analytics, Comms ("Messages"), Approvals, Settings. Icon-only with tooltips — **no live status badges or counts anywhere**, despite a `jarvisStore.ts` comment claiming `activeTaskIds` "drives the badge on the TASKS tab" (store comment line 94) — no such badge actually exists in the sidebar; the comment describes unbuilt intent.

**Real nav gap:** Command Palette's module list has 14 entries (including Projects, Calendar, Inbox, Research, Memory, Vault, Integrations, Security) that have **no sidebar entry at all** — those tabs are reachable only via Cmd/Ctrl+K. Matches a prior decisions-log finding.

### System Status / Agent Activity panels — live inside the Canvas tab, not chrome

Flagging this explicitly since they're easy to assume are shell-level: both are floating windows rendered by `pages/canvas.tsx`, not `AppShell.tsx`.

- **System Status** (`canvas.tsx:448-483`) — query/latency/cost/energy metric boxes + Engine/Model/Uptime rows, from real `GET /api/health` + `GET /api/telemetry` [api-server `routes/health.ts`, `routes/telemetry.ts`] via `useJarvisHealth()`/`useJarvisTelemetry()`. Real backend-computed numbers, not hardcoded on the frontend — **but**: (a) the `engine`/`model` values themselves are hardcoded string literals server-side (`"replit-ai"`, `"claude-3-5-sonnet / gpt-4o"`, `health.ts:21-22`), not a live reflection of which model actually answered a given query; (b) `energy_wh` is an explicit rough proxy (`cost_usd * 0.003`), not measured; (c) a static "Listening for 'Hello Khameleon'" caption (472-480) always renders regardless of the real wake-word state (the real indicator lives separately in `VoiceController.tsx`); (d) on fetch failure, falls back to honest zeroed `OFFLINE_HEALTH`/`MOCK_TELEMETRY` constants, never fake-but-plausible numbers.
- **Agent Activity** (`canvas.tsx:486-525`) — reads `jarvisStore.agentHistory` (capped at 50, populated client-side as real queries complete elsewhere in the app). Real per-session data, not persisted — resets on reload.
- **Khameleon feed ticker** (`components/NewsTicker.tsx`) — **this one is real chrome**, mounted in `AppShell.tsx:78`. Real `GET /api/feed` [api-server `routes/feed.ts`], same underlying metrics store as Agent Activity. Honest offline fallback string when empty/unreachable, not fake activity. Scroll speed is user-configurable (Settings → Appearance).

### Command Palette (`components/CommandPalette.tsx`)

Cmd/Ctrl+K opens it (global listener, always mounted) — this shortcut didn't exist before a 2026-10-02 fix (previously only the TopBar Search button opened it). Escape closes.

Searches two flat lists: `MODULES` (14 tab entries, selecting one calls `setActiveTab`) and `ACTIONS` — 4 entries ("RUN MORNING DIGEST", "INITIATE DEEP RESEARCH", "INDEX MEMORY PATH", "RUN DIAGNOSTICS") that **all just navigate to the Canvas tab** regardless of label — none actually performs the labeled action. Worth flagging clearly for the redesign since they look like real actions. No result selected + text typed + Enter → opens the Chat Window instead.

**Old agent-picker — confirmed fully gone**, not just hidden: no `AgentType`/`selectedAgent`/agent pill row anywhere in the live file, matches the 2026-10-02 removal already logged in `khameleon-decisions-log.md`.

### `jarvisStore.ts` — full state inventory

**Persisted** (`localStorage['jarvis-ui']`): `activeTab`, `canvasWindowsMinimized`, `canvasWindowsPositions`, `canvasWindowModels`, `panelLayouts`, `scanLinesEnabled`, `cornerBracketsEnabled`, `tickerSpeed`, `orbPosition`, `orbMinimized`, `orbActiveAgentId`, `voiceEnabled`, `autoSpeak`, `voiceSettings`, `chatWindowBounds`, `chatWindowDocked`, `chatWindowMinimized`, `chatReasoningDefault`, `chatRouteMode`, `chatLastDomainId`, `chatLastThreadId`.

**Ephemeral (reset on reload):** `chatOpen`, `chatMessages`, `isStreaming`, `agentHistory`, `commandPaletteOpen`, `activeTaskIds`, `taskRevision`, `orbStatus`, `orbChatOpen`, `embeddedOrbMountCount`, `wakeWordActive`, `wakeWordBlocked`, `pendingVoiceQuery`, `micPermissionModalOpen`, `onboardingWizardOpen`.

Grouped by feature: **Chat window** (bounds/docked/minimized/reasoning-default/route-mode/last-domain/last-thread/messages/streaming); **Orb/voice** (status/position/minimized/chat-open/mount-count/active-agent/enabled/auto-speak/wake-word-active/wake-word-blocked/pending-query/full voice settings object/mic-permission-modal); **Canvas window layout** (minimized/positions/shared models — the shared-model type is imported from the separate `khameleon-window-agent` package); **Task tracking** (active ids, revision counter); **Agent history**; **Nav/chrome** (active tab, palette open); **Appearance** (scan lines, corner brackets, ticker speed); **Onboarding**; **Panel layouts** (grid-style, generic).

### Global keyboard shortcuts — full list

| Shortcut | Where | Effect |
|---|---|---|
| Cmd/Ctrl+K | always | opens Command Palette |
| Escape | always | closes Command Palette |
| Cmd/Ctrl+J | while Chat Window open | focuses composer, un-minimizes |
| Cmd/Ctrl+Shift+D | while Chat Window open | toggles dock/float |
| **Cmd/Ctrl+J (second binding)** | always (`JarvisOrb.tsx`) | opens the **orb's own** separate chat popup |
| Escape | always (outside inputs) | closes orb context menu / cancels in-flight speech |
| Cmd/Ctrl+B | always, but **dead code** — `components/ui/sidebar.tsx` is unused shadcn boilerplate with zero imports anywhere else in the app | toggles a sidebar that isn't the one actually rendered |

**Flag for the redesign:** two independent, always-live global handlers both bound to Cmd/Ctrl+J (Chat Window vs. the orb's own popup) — a real collision risk worth resolving, not replicating.

### Voice / wake-word system

Real speech I/O, not stubbed — requires a Chromium-family browser (`SpeechRecognition` support).
- **`useVoice` hook**: input via Web Speech API; output tries real **ElevenLabs TTS** first (`POST /api/voice/tts`, real Web Audio gain node for volume — previously volume had no effect at all on this path, now fixed), falls back to browser `speechSynthesis` on any error, with a documented Chrome-bug keep-alive workaround (prevents silent cutoff after ~15s) and a hardcoded preferred-voice-name list.
- **Wake word** (`components/orb/VoiceController.tsx`, always mounted): phrases `"hello khameleon"/"hey khameleon"/"ok khameleon"/"khameleon"`, real continuous recognition. Mic permission state persisted (`localStorage['jarvis_mic_granted']`). **Confirmed historical bug, now fixed:** the permission modal used to be fully built but had no code path that ever showed it — wake word was silently inert for every user by default. Now shows correctly on first boot. A real, accurate "👂 LISTENING FOR 'HELLO KHAMELEON'" indicator renders bottom-left — unlike the Canvas tab's decorative static caption noted above, this one genuinely reflects live state.

### Notifications

**TopBar bell is decorative** (see above) — the only click-driven "notification" surface in the whole app that actually works is `components/NeedsInputWatcher.tsx` (always mounted): polls real tasks with `status:'needs_input'` every 20s, shows a dismissible bottom-right banner per newly-needs-input task, auto-dismisses after 8s. Its own doc comment candidly explains the app already has a fully-built generic toast system (`hooks/use-toast.ts` + `components/ui/toast.tsx`) that is **completely unused** (zero imports anywhere) — a real pre-existing Radix animation bug made it unusable, so this bespoke banner was built instead rather than fixing the dead scaffolding.

### Settings (`pages/settings.tsx`)

9 sections: GENERAL, ENGINE, API KEYS, APPEARANCE, VOICE, CONNECTORS, MEMORY, TELEMETRY, ADVANCED.
- **GENERAL** — real profile fields + real Morning Digest schedule editor (`GET/PUT /api/scheduler/config` — used to be gated behind an unset env var making it unusable; now real). Two disabled stub fields: Workspace Name, Language.
- **ENGINE** — mostly informational + a real "check server status" button.
- **API KEYS** — real per-provider key management.
- **APPEARANCE** — real toggles (scan lines, corner brackets, ticker speed); a hardcoded no-op "THEME" toggle (`value={true}, onChange={() => {}}`) and a disabled "FONT SIZE" control (font sizes are hardcoded px throughout `index.css`, not driven by one variable).
- **VOICE** — real wake-word toggle, real TTS preview with fallback, real mic-permission re-prompt flow.
- **CONNECTORS** — real OAuth connect (hard-gated per §16.3) / disconnect / status for every provider.
- **MEMORY / TELEMETRY / ADVANCED** — **entirely stub**, by the component's own doc comment: these used to show fake-looking editable fields with no save path at all; now honestly rendered read-only, showing the server's hardcoded defaults (e.g. Memory: max chunks 10000; Telemetry: retention 30 days; Advanced: API timeout 30000ms).

Account/security settings (multi-user accounts, access control) live on the separate Security page, not in Settings at all — a deliberate choice logged earlier this session to avoid adding new chrome.

### Onboarding wizard (`components/OnboardingWizard.tsx`)

5 skippable steps: Name → API Key → Outlook (optional OAuth) → Digest (schedule) → Done (mentions the wake phrase, warns mic access will be requested on first real use). Triggers automatically on boot if the server-tracked `onboardingComplete` flag is false; also manually reopenable from Settings → General. This is confirmed as a fresh, real rebuild — design-spec §14 described an older 5-step wizard that was never actually built in this repo; this isn't a revival of lost UI, it's new.

### Confirmed fake/stub/dead items (app shell)

1. TopBar bell — decorative, no handler.
2. TopBar "More" (⋯) — decorative, no menu.
3. Command Palette's 4 ACTIONS — all silently just navigate to Canvas regardless of label.
4. `components/ui/sidebar.tsx` — entire unused shadcn sidebar + its own dead Cmd/Ctrl+B shortcut.
5. `hooks/use-toast.ts` + `components/ui/toast.tsx` — fully built, zero-consumer toast system.
6. Canvas tab's "Listening for 'Hello Khameleon'" caption — static text, not bound to real wake-word state.
7. Settings → Appearance "THEME" toggle — hardcoded no-op.
8. Settings → Appearance "FONT SIZE" — disabled, not wired.
9. Settings → General "Workspace Name"/"Language" — disabled, not wired.
10. Settings → Memory/Telemetry/Advanced — fully read-only hardcoded defaults.
11. `/api/health`'s `engine`/`model` fields — real endpoint, hardcoded values.
12. `energy_wh` everywhere it appears — a derived approximation, not measured.
13. Dual Cmd/Ctrl+J bindings — real collision risk (not fake, but a redesign hazard).

---

## Floating Chat Window

`src/components/chatWindow/ChatWindow.tsx` (~700+ lines) — the primary way a user talks to agents. Real, free-floating, draggable, resizable, dockable to the right rail, minimizable, closable.

**Chrome:**
- Drag-to-move header (disabled while docked), double-click resets position (`newBounds()`)
- Dock/float toggle, minimize, close
- Agent strip: pills for every roster agent + "Auto-route," live status dot per agent (online/busy/standby/offline from a real `GET /api/agents/:id/status` call), pin-to-agent
- Route-mode selector: Single / Parallel / Vote / Council (`ROUTE_MODE_LABELS`/`ROUTE_MODE_DESCRIPTIONS` in `types.ts`)
- Reasoning toggle (default collapsed, per design-spec's "show your reasoning" principle)
- ZDR badge — **honest gap, not fabricated**: always hidden (`zdrKnown={false}` hardcoded at the `AgentStrip` call site) because no live per-message ZDR signal exists anywhere in the backend yet

**Composer:** text input, voice-input mic button (shares one real `useVoice` session with the empty-state's head button), route-mode pills, Cmd/Ctrl+Enter or Enter-to-send, Shift+Enter for newline

**Message rendering:** user/assistant bubbles, `answeredBy` agent badge, `routedForReason` label, reasoning steps (real tool-call events mapped via `toolEventsToReasoning()` in `chatWindowApi.ts` — **never fabricated placeholder "thinking" text**), meta row (durationMs/costUsd/energyWh, each `n/a` when not reported rather than guessed)

**Empty state:** big clickable head avatar (voice toggle), wake-word status dot, work-domain filter chips, 4 role-aware starter cards (`starterCardsForRole()`), a "Parked" resume card (top parked task), and (as of 2026-10-07) a **"Resume this morning's briefing" card** — real: checks `GET /api/agent-conversations/sessions?agentId=briefing&limit=1` for a session from the last 18h, and on click loads the real conversation history via `GET /api/agent-conversations?sessionId=...` and carries that session forward for new messages

**Real backend wiring (all four route modes, no stubs):**
- Single: `streamAgentChat()` → `POST /api/agents/:id/ask` (SSE), now correctly threads a real `sessionId` for continuity (fixed 2026-10-07 — previously generated server-side every turn and silently discarded client-side)
- Parallel/Vote: `askAll()` → `POST /api/agents/ask-all`
- Council: **no distinct backend** — aliases `askAll(mode:'vote')`, same as the standalone Council page. Not a gap introduced here; matches existing behavior elsewhere in the app.

**Live Task Card:** real `TaskRunCard` rendered inline for any task id in `jarvisStore`'s `activeTaskIds`, polling `GET /api/task-runs/:id`.

**Keyboard shortcuts (window must be open):** Cmd/Ctrl+J focuses composer, Cmd/Ctrl+Shift+D toggles dock/float.

**Known dead code, confirmed removed:** `CommandPalette.tsx`'s old `AgentType`/`selectedAgent` concept was deleted 2026-10-02 (its only consumer, the old fixed `ChatPanel`, was deleted when this window replaced it).

---

## Orb / Voice System

- `useVoice` hook (`src/components/orb/useVoice.ts`) — wraps real browser `SpeechRecognition`/`SpeechSynthesis` (or ElevenLabs TTS when configured in Settings → Voice; falls back to Web Speech honestly, not silently, when ElevenLabs isn't set up or the account's quota 503s).
- Wake word ("Hello Khameleon") — real, but **Chrome/Edge only** (`wakeWordBlocked` state surfaces this honestly in the UI rather than pretending it works everywhere); toggled in Settings → Voice.
- `HeadAvatar` — the Khameleon Head mascot image/animation, used as the Chat Window empty-state's big voice button and (separately) as a persistent small widget elsewhere in the shell — **app-shell pass will confirm exact persistent placement/sizing**, since the brief now wants this made small/non-intrusive in the new design.
- First-run **microphone permission modal** ("KHAMELEON requires microphone access...") — real, gates wake-word; has a Skip path. Appears on first real interaction with voice-capable UI, confirmed via live Playwright testing this session (it intercepts clicks until dismissed — a real, if minor, UX rough edge worth knowing about for the redesign).

---

## Integrations

`src/pages/integrations.tsx` — directory of first-party Integrations (`GET /api/integrations`, real connection status joined live from `oauth_tokens` via `getConnectorStatusMap()`), each with a hard `ConnectIntegrationGate` confirm step before OAuth redirect (design-spec §16.3), work-domain tagging, disconnect.

**New as of 2026-10-07:** "IMPORT CUSTOM" — real OpenAPI 3.x (JSON) spec or MCP server import. `ImportCustomIntegration.tsx` does a real preview-then-confirm flow: parses the spec for real, shows the real discovered operations (method-color-coded) in a `ConfirmGate`, only then saves. OpenAPI operations become real callable tools in the backend's agentic loop (read-only/GET only execute; writes are disclosed but refuse to run — no per-operation confirm-gate UI exists yet for arbitrary imported writes). MCP servers are passed directly to Claude's native MCP connector support. Custom integrations list with per-item disconnect, `GET/POST/DELETE /api/custom-integrations`.

---

## Mobile Morning Briefing

`src/pages/mobile/MobileBriefing.tsx` — separate PWA entry point at `/briefing` (own `manifest.json`, installable, real icon, installability-only service worker — doesn't cache the live briefing data itself). **Not part of the main desktop shell/AppShell** — a standalone mobile-first page, audio-predominant by design (per design-spec, built for commute use).

- Real tiered assembly: urgent (task urgency + awaiting-confirmation drafts) / FYI / heads-up, from `GET /api/briefing/today`
- Voice-driven "send it" / "skip" / "change the tone" on drafted email replies, for both Outlook and Gmail (tone-rewrite parity shipped 2026-10-07) — real `sendOutlookDraft`/`rewriteGmailDraft`/etc. calls, with a manual `ConfirmGate` review always available as a non-voice fallback
- Real session logging as of 2026-10-07 (`logBriefingTurn()` → `POST /api/briefing/session/log`) so the desktop Chat Window can resume the conversation later
- **Known, named gap, not yet closed:** true background/lock-screen audio — no Wake Lock or Media Session API groundwork exists anywhere in this app. Audio stops if the phone locks or the tab backgrounds. (This is the subject Newton is currently deciding whether to build next, separately from this UI redesign.)

---

## Canvas / Live Wall (real content, since the Chat Window/orb internals are covered above)

`activeTab==='canvas'` → `pages/home.tsx` → `AssistantHome` → `components/liveWall/CommandWall.tsx` (804 lines) — the real, current three-column "Live Wall," fixed 1388×800 design size, uniformly scaled to fit the viewport.

**Orphaned sibling, confirmed dead:** `pages/canvas.tsx` (816 lines, `UnifiedCanvas`) is the *old* free-floating multi-window "Workspace" layout, removed from the UI 2026-10-01. Nothing renders it. `pages/dashboard.tsx` re-exports it but is itself never imported anywhere — orphaned two layers deep. Kept alive only because it still exports shared constants (`PILLS`, `DAY_SECTIONS`, `FocusRing`) actually used by the real Live Wall.

**Top bar:** brand mark + wordmark. A **decorative nav row** ("Work mode"/"Overview"/"Agents"/"Research") with no click handlers at all. A **cosmetic-only** Live/Pause toggle (doesn't pause polling or anything else). A **fully decorative** orchestration-mode picker (Single/Parallel/Vote/Council) — state is set but never read by any API call, distinct from the real Parallel/Vote modes on the Agents→Multi-Agent page. A real Work-Domain filter. A real reasoning-visibility toggle. A real activity-feed slide-out.

**Left column "Parked orbit":** real — tasks with `status='blocked'` or a `parkedReason`, grouped by reason, each with a real "Resume" button.

**Center column "Work in motion":** real "Current focus" hero (prioritizes `needs_input` over `in_progress`), a recently-completed chip trail, a real drag-to-reorder Queue (writes `queuePosition`). Auto-promotes the top queued task to `in_progress` after 4s with no manual confirm when nothing's focused.

**Right column "Wall status":** real health/telemetry stats, real per-agent online/offline dots, a static "ZDR endpoint active" badge, real connector status, real task-completion count.

**Orb overlay window** (bottom-right of this layout): real chat input on the same `streamAgentChat()` pipeline as everywhere else. The 7-button status row (idle/listening/thinking/researching/speaking/error/muted) is a real manual override, not audio-reactive (a bundled analyser hook exists but is unwired per its own header comment). Footer ticker is real, built from `agentHistory`.

---

## Agents (Roster / Chat / Multi-Agent / Compare / Council / Settings)

`pages/agents.tsx` — 6 real sub-tabs, all hitting `agentsApi.ts` (`/api/agents/*`):
- **Roster** — agent list with live status/metrics; honest offline fallback (`FALLBACK_ROSTER`, 6 hardcoded agents) only if the backend is unreachable, not shown as fake-live data.
- **Chat** — single-agent streaming chat with live tool-call bubbles, errors now render inline (a documented real bug fix).
- **Multi-Agent** — real parallel/vote broadcast to N agents, judge-verdict block in vote mode.
- **Compare** — real side-by-side N-agent comparison with fastest/cheapest highlighting.
- **Council** — real multi-round deliberation (`askAll(...,'vote')` per round), marked "BETA."
- **Settings** — real roster CRUD (create/update/delete custom agents).

---

## Research (`pages/research.tsx`)

Query + options (max iterations, web search toggle, "SAVE TO MEMORY" toggle) → `POST /api/research`. **Bug found:** "SAVE TO MEMORY" is never actually sent to the backend — pure decoration. Output: real markdown render, a real trace log of actual tool calls made (not scripted), model/latency/tokens/cost footer.

---

## Memory (`pages/memory.tsx`)

Three real, backend-backed panels, no fake data found: Memory Index Control (path → index, real stats), Agent History (real sessions grouped by `sessionId`, expandable), Memory Retrieval (real semantic search with relevance scores).

---

## Communications (`pages/communications.tsx`)

Unusually self-honest page. "CHANNELS" panel is explicitly badged **"PLANNED"** / "NOT YET BUILT" — 14 messaging channels (Discord, Slack, WhatsApp, etc.) shown as inert dimmed tiles with no backend; the file's own comments note a prior fake "CONNECT" button (local-state-only) was deliberately removed. "DATA CONNECTORS" panel is real (`GET /api/connectors`), unconnected tiles just jump to the Integrations tab rather than faking a local connect.

---

## Analytics (`pages/analytics.tsx`)

Real 14-day query-volume chart and latency-distribution buckets from real telemetry, not `Math.random()`. Real computed p95 latency (replaced a prior fake `avg*1.8` guess). **Bug found:** the "Energy over time" mini chart actually renders the same cost data a second time with a different line color — mislabeled duplicate, not real energy data. Honest all-zero fallback only when telemetry is unreachable.

---

## Security (`pages/security.tsx`)

- **Access Control** — real, shows current auth mode (shared-password vs. real accounts), real signup (first signup on a password-gated instance becomes admin and converts the whole instance to accounts mode), real logout.
- **Team Accounts** (admin + accounts-mode only) — real account list with active/deactivated toggle; this is the multi-user access-control UI from the hosted-mode work.
- **Credential Vault Status** — real SET/NOT SET badges + revoke per provider key; duplicates part of Settings → API Keys (that one can set keys, this one can only view/revoke).
- **Guardrails** — now genuinely tied to real backend guardrail code (injection scanner, rate limiter, file policy, SSRF protection, audit log); the file's own comment documents this used to unconditionally show all 5 as "ACTIVE" regardless of reality.
- **Security Audit Log** — real `agentHistory` table, but every row's STATUS column is hardcoded to "SUCCESS" since only successful completions are ever pushed into that store — it can structurally never show a failure.

---

## Vault (`pages/vault.tsx`)

Real encrypted secrets (AES-256-GCM); the whole page refuses to function with a blocking "ENCRYPTION NOT CONFIGURED" state if the server key isn't set, rather than silently falling back to plaintext. **Gaps found:** the backend's `owner` field has no form input at all (always saved empty); the backend supports `updateVaultItem` (PATCH) but there is **no edit UI anywhere** — items can only be created or deleted, never edited, despite the API supporting it. Reveal/hide and access-log are real and server-logged.

---

## Skills / Skill Sets (`pages/skills.tsx`)

Real author/import form, hard `ConfirmGate` before any requested-tool or non-authored-source install counts (§15.5). **Gap found:** seeded "available" starter Skill Sets are listed in the catalog but have **no install action anywhere on this page** — the action-button logic only handles `pending`/`installed` states, even though a working `installSkillSetFromCatalog()` API exists and is actually used elsewhere (the Tasks page's skill-suggestion flow). A user can see a starter Skill Set here and literally cannot install it from this screen.

---

## Approvals (`pages/approvals.tsx`)

Real, substantial page. The top "Demo: Approve Email" button is explicitly, honestly labeled a demo (hardcoded fake payload, never actually sends). Everything else is real: two live inbox browsers (Outlook/Gmail) feeding real draft-email pipelines (fetch → summarize → compose → create draft → gated send with an editable `ConfirmGate`, or reject/discard), real thread-summarize (no gate, reversible), real triage-inbox (classify/flag/archive + create real tasks + real **Undo** that reverses the mailbox changes and deletes the created tasks). Action History is real durable receipts (`GET /api/action-receipts`) — replaced two previously-hardcoded illustrative rows per the file's own comment.

---

## Settings (`pages/settings.tsx`) — full section detail

The file has a genuinely good convention: a `NotYetWired` component that explicitly labels every stub control rather than letting it look functional.

- **GENERAL** — real profile + real Morning Digest hour/minute picker (`PUT /api/scheduler/config` — used to be locked behind an unset env var, now a real in-app control). "Workspace Name"/"Language" explicitly disabled/`NotYetWired`.
- **ENGINE** — used to be a fully fake local-inference config form with a "TEST CONNECTION" button that always reported the same hardcoded result regardless of input; now reduced to one honest pointer to where model config actually lives, plus one real server-status check.
- **API KEYS** — real per-provider save/clear, real rate-limit numbers for Anthropic/OpenAI pulled from actual response headers (not guessed).
- **APPEARANCE** — "THEME" toggle is hardcoded on with a no-op handler (dark mode is simply mandatory); "FONT SIZE" is fully disabled (hardcoded 13px everywhere in CSS); scan lines / corner brackets / ticker speed are all real.
- **VOICE** — gated behind browser speech support; real mic-permission flow, real wake-word toggle, real rate/pitch/volume (pitch has an honest caveat: doesn't affect ElevenLabs output, only the browser fallback), real ElevenLabs voice picker when configured, real TTS preview with fallback.
- **CONNECTORS** — real OAuth connect/disconnect for Google/Microsoft/Spotify, always gated per §16.3. **Inconsistency found:** the Google connector's own gate text says "nothing reads Gmail/Calendar/Drive/Contacts data yet" — stale, since real Gmail read/draft/send is live on the Approvals page. The disclosure a user sees before connecting understates what connecting it actually grants. Also includes a real Spotify now-playing widget and a real weather default-location form.
- **MEMORY / TELEMETRY / ADVANCED** — fully read-only, hardcoded server defaults, each clearly labeled `NotYetWired` (used to be fake-editable inputs with no save path at all).

---

## Tasks (`pages/tasks.tsx`) — My Tasks + Commands sub-tabs

**My Tasks:** full real CRUD (filter/group/search, create with subtask parenting, due dates, priority/category/recurrence), real "Decompose" (streams the task to the real orchestrator agent to generate 3-8 real subtasks), real inline Skill Set suggestion install/dismiss per task (§15.2).

**Commands:** real command bar (text or real browser speech-to-text) → `POST /api/command`, live-tracked `TaskRun`s, searchable command history with re-run. Embedded **AutoTriggers** widget: shows the real digest schedule (footer text pointing to env vars is now **stale**, since Settings→General has a real in-app picker that supersedes it), plus two explicitly-placeholder "EVENT-TRIGGERED" rows ("New email arrives" / "Calendar event starting") — dimmed, non-interactive, no backend at all.

---

## Projects (`pages/projects/*`)

Was fully orphaned until a 2026-09-03 audit (not a valid tab id, no nav link anywhere) — now wired in, reachable via Cmd/Ctrl+K. The only page using real `wouter` URL routing (`/projects`, `/projects/:id`). Real list (cards with progress bars, real create-project dialog) and real detail view (active tasks, risks card). A "Required connectors" panel lists 5 honestly-disabled "Coming soon" buttons (GitHub Issues, Linear, Notion, Jira, TickTick). **Gaps found:** `risks`/`tags` are real DB fields rendered on the detail page, but the create dialog never collects them, so they're always empty unless set via direct API call; the detail page has no add/edit-task control at all — fully read-only once a project exists.

---

## Calendar (`pages/calendar.tsx`)

Real (live Google/Outlook fetch with local-DB fallback) — replaced an old 7-line stub with a looping fake "CONNECTING..." animation. Purely read-only: events grouped by day, no create/edit/delete-event controls anywhere. **Gap found:** the data type carries `aiPrep`/`relatedProject`/`actionItems` fields that are never rendered anywhere on the page.

---

## Inbox (`pages/inbox.tsx`)

Real (live Gmail/Outlook with local-DB fallback), also replaced an old stub. Aggregated read list. Mark-as-read only actually works for `source==='local'` items — Gmail/Outlook items show a static, non-clickable read indicator since their opaque provider ids can't map to a local DB row for the patch to target. Distinct from the Approvals page's inbox *browsers* (those are action-oriented pickers for the draft-email skills; this is a unified read list). **Gap found:** `classification`/`aiRecommendation`/`relatedProject`/`priorityScore`/`isArchived` fields all exist and are API-supported but none are ever rendered or exposed as a control here.

---

## Work Domains

No standalone page — managed entirely inline via a shared `WorkDomainFilterBar` component + `useWorkDomains()` hook, used on both Skills and Integrations. "ALL" + one chip per domain (filters the list below), plus a "MANAGE DOMAINS" toggle revealing inline rename/delete and an add-new input. Built-ins are tagged "(built-in)" but have no special frontend protection against rename/delete. Selecting a domain is explicitly *not* a mode switch — only narrows the visible list, never changes which agent/persona is active.

---

## Orphaned / dead pages found under `src/pages/` not otherwise covered

Four fully orphaned "coming soon" stub pages — not imported by AppShell's lazy map, not in the Command Palette's module list, **not reachable from anywhere in the running app**: `chat.tsx`, `automations.tsx`, `knowledge-graph.tsx`, `marketplace.tsx`. All four render the same shared `JarvisStubPage` component: an animated radar/spinner, "CONNECTING TO KHAMELEON NETWORK..." pulsing text, a list of "required connectors" each with a **non-functional CONNECT button (no onClick at all)**, and shimmer-skeleton placeholder rows. This is the canonical "fake connecting forever" pattern — it's what Calendar and Inbox both used to look like before they got real pages.

Also orphaned: `not-found.tsx` (a static 404 panel with nothing that could ever route to it — there's no router outside Projects' internal wouter use) and `dashboard.tsx` (dead re-export of the dead `canvas.tsx`/`UnifiedCanvas`).

---

## Full summary of fake/decorative/broken items found (entire app)

**App shell:**
1. TopBar bell — decorative, no handler.
2. TopBar "More" (⋯) — decorative, no menu.
3. Command Palette's 4 ACTIONS — all silently just navigate to Canvas regardless of label.
4. `components/ui/sidebar.tsx` — entire unused shadcn sidebar + its own dead Cmd/Ctrl+B shortcut.
5. `hooks/use-toast.ts` + `components/ui/toast.tsx` — fully built, zero-consumer toast system.
6. Canvas/Live Wall top bar's "Listening for 'Hello Khameleon'" captions — static text in two places, not bound to real wake-word state.
7. Settings → Appearance "THEME" toggle — hardcoded no-op.
8. Settings → Appearance "FONT SIZE" — disabled, not wired.
9. Settings → General "Workspace Name"/"Language" — disabled, not wired.
10. Settings → Memory/Telemetry/Advanced — fully read-only hardcoded defaults.
11. `/api/health`'s `engine`/`model` fields — real endpoint, hardcoded values server-side.
12. `energy_wh` everywhere it appears — a derived approximation, not measured.
13. Dual Cmd/Ctrl+J bindings (Chat Window vs. orb popup) — real collision risk.

**Live Wall:**
14. Top nav "Work mode"/"Agents"/"Research" buttons — no click handlers at all.
15. Live/Pause toggle — cosmetic only.
16. Orchestration-mode picker (Single/Parallel/Vote/Council) — state-only, never read by any API call.

**Pages:**
17. Research "SAVE TO MEMORY" toggle — never sent to the backend.
18. Analytics "Energy over time" chart — mislabeled duplicate of the cost chart.
19. Settings → Connectors Google gate text — stale, understates real Gmail access.
20. Tasks → Commands → Auto Triggers "New email arrives"/"Calendar event starting" — explicit static placeholders, no backend.
21. Tasks → Commands → Auto Triggers digest footer text — stale, superseded by Settings' real picker.
22. Skills page — seeded starter Skill Sets have no install action anywhere on the page despite a working install API.
23. Vault — no `owner` field input (always empty); no edit UI despite a real update API existing.
24. Inbox — 5 real, API-supported fields never rendered or exposed as controls.
25. Calendar — 3 real fields (`aiPrep`/`relatedProject`/`actionItems`) never rendered.
26. Projects — `risks`/`tags` never collected at creation (always empty unless set via API); no add/edit-task UI on the detail page.
27. Security Audit Log — STATUS column structurally always shows "SUCCESS" (failures never reach this store).
28. Four fully orphaned stub pages (`chat.tsx`, `automations.tsx`, `knowledge-graph.tsx`, `marketplace.tsx`) using the shared "fake connecting forever" `JarvisStubPage` pattern with non-functional CONNECT buttons — unreachable from the running app.
29. `not-found.tsx`, `dashboard.tsx` — orphaned dead code, zero reachability.

All file paths above are relative to `artifacts/khameleon-command/src/` unless marked `[api-server]`.
