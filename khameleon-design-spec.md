# Khameleon — design specification

A HUD-style personal assistant interface: a single always-present orb that listens or reads typed commands, and spins up live agent panels for whatever it's asked to do. This spec covers the visual system, core components, and interaction rules needed to take the current mockup to production-grade polish.

## 1. Design principles

**Ambient, not app-like.** The interface should feel like a presence in the room rather than a window you open. Default state is quiet — a soft-breathing orb on a near-black field, not a dashboard full of widgets.

**One idea per surface.** The orb communicates state (idle, listening, working). Task panels communicate progress. History communicates the past. None of these should try to do the others' job.

**Depth through material, not decoration.** Sophistication comes from layered translucency, precise motion timing, and restrained color — not from adding more glow, more particles, or more chrome.

**Color as signal.** Khameleon's identity is an adaptive, color-shifting accent (the "chameleon" mark) — but shifting color must always mean something (state or activity), never run as decoration. A calm idle orb should look calmer than a working one.

## 2. Security and data architecture

This is the core of Khameleon's positioning, not a footnote: **Khameleon is a layer over the tools an organization already uses, not a new place their data lives.**

- **No extraction, no shadow copy.** Khameleon does not pull company or personal data out of Outlook, the CRM, project tools, etc. into a separate Khameleon-owned database. It reads and acts on information where it already lives, through each system's own APIs, live, at the moment it's needed.
- **Manipulation, not migration.** Every action Khameleon takes — drafting an email, updating a task, building a chart — is performed inside or against the existing system of record. Khameleon orchestrates; it doesn't become a new system of record itself.
- **The central router (section 4) orchestrates, it doesn't aggregate.** The reasoning layer that decides which connected tool should handle a request passes information through in real time to do that one job — it is not a data warehouse quietly building a persistent copy of everything it has ever touched.
- **Permissions inherit from the underlying system.** A person using Khameleon can only see or do what they could already see or do directly in Outlook, the CRM, etc. Khameleon never becomes a way to see more than your existing access already allows.
- **History logs actions, not raw content.** The task history (section 4) should record what was done and its outcome (metadata, plain-language summary, timestamps) rather than storing full duplicates of sensitive content — the underlying system remains the source of truth if someone needs to see the original.
- **Live views render, not store.** The live-view preview inside a task panel (section 3) reflects the artifact as it's being built in its native system — it's a live window onto that system, not a cached copy sitting in Khameleon.
- **Org boundaries are inherited, never merged.** Multi-tenant deployment (section 8) must never let one organization's connected data become visible to, or blended with, another's, and the same boundary logic that exists in the underlying tools carries straight through.

This principle should visibly shape product messaging as much as architecture: Khameleon's pitch to an organization is "nothing new to trust with your data — it operates the tools you already trust."

## 3. Visual system

### Base palette

| Token | Hex | Use |
|---|---|---|
| `bg-void` | #05070A | Page/canvas background |
| `bg-field` | #0A0E14 | Panel and card fill |
| `bg-glass` | rgba(255,255,255,0.045) | Glass panel overlay |
| `border-hairline` | rgba(255,255,255,0.10) | Default panel border |
| `border-hairline-strong` | rgba(255,255,255,0.18) | Hover/focus border |
| `text-primary` | #E7ECEF | Titles, primary labels |
| `text-secondary` | #8FA39C | Supporting copy, metadata |
| `text-muted` | #55635E | Timestamps, placeholders |

### Accent ramp (the "chameleon" identity)

Three hues carry meaning rather than rotating decoratively:

| Hue | Hex | Meaning |
|---|---|---|
| Teal | #6FE6BD | Listening, success, active/confirmed |
| Violet | #8C7CF0 | Thinking/processing, completed-task accent |
| Amber | #F0A34C | Attention — not error, but "worth noticing" (e.g. a scheduled task about to run) |
| Coral | #E77A7A | Failure, blocked, needs retry |

The core mark's hue-shift animation (teal → violet → amber) is reserved for the idle/ambient state only — once the assistant is actually doing something, its color should lock to whichever hue matches that state, not keep cycling. Cycling color while actively working reads as instability, not sophistication.

### Typography

**Decided 2026-08-19** (decisions log): a two-font pairing, not a single stack — after comparing Inter, Public Sans, IBM Plex Sans, Work Sans, Manrope, Source Sans 3, Archivo, DM Sans, Figtree, Plus Jakarta Sans, Lexend, and Mulish against office-appropriateness.

- **Plus Jakarta Sans** — display typeface. Used for the brand wordmark, greeting text, and panel headings: anything read once per screen, set 14px or larger. Weights 600/700 only.
- **Inter** — UI typeface. Used for body copy, micro-labels, stat numbers/labels, status pills, buttons, and timestamps/metadata: anything scanned repeatedly or under 13px. Weights 400/600 only.
- **Rule of thumb:** display-sized, once-per-screen text → Plus Jakarta Sans. Small, repeatedly-scanned text → Inter.
- Optional secondary: a monospace face (e.g. IBM Plex Mono, JetBrains Mono) reserved for trace-log timestamps and technical readouts — this is what sells the "instrument panel" feel. Not yet adopted; revisit if the instrument-panel feel needs reinforcing.
- Scale: 11px (micro-labels, timestamps) / 12px (metadata) / 13px (body) / 14–15px (titles, in Jakarta) / 20px+ (brand wordmark, orb's own status word if shown — in Jakarta).
- No italics.
- Letter-spacing: +0.02em to +0.14em on all-caps micro-labels; 0 elsewhere.

### Materials & elevation — "Signal Glass"

**Named 2026-08-19.** Every panel in Khameleon — task panels, mini command/context/status cards, the right rail, filmstrip cards — uses one consistent material, not ad hoc per-panel styling. It's called **Signal Glass**: translucent frosted glass, lit from one consistent source, with a colored glow that always carries meaning rather than decoration (ties directly to the "color as signal" principle in section 1 — hence the name).

**Exact parameters** (defaults; a panel may override individual values for its own importance tier, but the recipe itself never changes):

| Layer | Value |
|---|---|
| Fill | `rgba(255,255,255,0.055)` — translucent white overlay |
| Backdrop blur | `16px` (raise to `20–22px` for a "thicker"/more important panel) |
| Border | `1px solid rgba(255,255,255,0.16)` (`1.25–1.5px` / `0.22` opacity for a more important panel) |
| Corner radius | `14–16px` |
| Box-shadow (drop) | `0 30px 55px rgba(0,0,0,0.5)` (deepen to `0 40px 74px rgba(0,0,0,0.6)` for a raised/important panel) |
| Box-shadow (inner edge) | `inset 0 1px 0 rgba(255,255,255,0.16)` |
| Rim glow (the "signal") | a colored `box-shadow`, not a border — e.g. `0 0 24px rgba(111,230,189,0.16)` for a teal/command panel. Hue always maps to what the panel represents (teal/violet/amber/coral per section 3's accent ramp), never assigned decoratively. |
| Highlight streak | a `::before` pseudo-element, `linear-gradient(122deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 30%)`, covering the full panel — simulates one light source hitting every panel from the same top-left angle. This angle must be identical across every panel on screen; varying it per panel breaks the "single light source" illusion. |
| Top edge line | a `::after` pseudo-element, 1px tall, `linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 35%, rgba(255,255,255,0) 70%)` along the panel's top edge only — the rim catching light. |

**Elevation via the recipe, not new layers.** "Field" (a normal panel) and "Raised" (an actively-focused panel, e.g. an expanded panel or open command bar) are the same Signal Glass recipe with stronger blur/border/shadow values per the ranges above — not a different material. Avoid stacking more than two elevation steps at once — a panel inside a panel inside a panel reads as clutter, not depth.

**Base canvas ("Void")** stays pure dark beneath all Signal Glass panels, but is not textureless — it carries a fixed ambient glow recipe so the whole scene reads as one lit room rather than flat black, and so every panel's Signal Glass has something to catch light from. **Locked 2026-08-19** after the live app's own violet ambient wash made panel text hard to read:

| Layer | Value | Position |
|---|---|---|
| Base | `linear-gradient(180deg, #06080a 0%, #030405 60%, #000000 100%)` | full canvas |
| Teal bloom | `radial-gradient(circle at 15% 10%, rgba(111,230,189,0.16) 0%, rgba(111,230,189,0) 32%)` | top-left |
| Amber bloom | `radial-gradient(circle at 88% 12%, rgba(240,163,76,0.13) 0%, rgba(240,163,76,0) 34%)` | top-right, near the orb |

**No violet ambient bloom on the base canvas.** An earlier pass added a third `rgba(140,124,240,0.14)` violet radial at bottom-center — dropped: at ambient-glow strength it doesn't map to any specific meaning (unlike the rim glows in the table above, which are always tied to a panel's category) and it was strong enough to reduce text contrast on panels sitting over it. Violet stays reserved for what it already means everywhere else in the system — the thinking/processing state and violet-category rim glows — never as a passive background wash.

### Motion

- Standard easing: `cubic-bezier(0.22, 1, 0.36, 1)` (soft overshoot-free ease-out) for anything appearing/disappearing.
- Idle breathing: 3–4s cycle, low amplitude (scale 1.0 → 1.05, opacity 0.55 → 0.9). Should be barely noticeable at a glance.
- State transitions (idle → listening → thinking → done): cross-fade + a brief (150–200ms) scale pulse, never a hard cut.
- Trace-log steps resolve one at a time, each with a ~250ms stagger — this is what makes the panel feel alive rather than instantly populated.
- Panels entering the grid: fade + slide up 8px, 300ms. Panels collapsing to summary cards: height + content cross-fade, 400ms — this transition matters most, since it's the "task completed" moment.

## 4. Core components

### The orb

States, each with a distinct visual signature (not just a color swap):

| State | Visual behavior |
|---|---|
| Idle | Slow breathing glow, hue-shifting ring, no motion in the core mark |
| Listening | Ring animation speeds up slightly, teal locks in, a small waveform ripple appears at the ring's edge in sync with input |
| Thinking | Violet locks in, core mark rotates continuously (not just hue-shifts), ring segments animate inward like a closing aperture |
| Researching | **Added 2026-09-25**, once a research-role agent became a real routing case (see `khameleon-decisions-log.md`). Amber locks in, core mark rotates continuously like Thinking but at a slower cadence — distinguishes "reading/gathering" from "reasoning," which Thinking alone didn't cover |
| Speaking / responding | Violet-teal blend, soft outward pulse synced to response cadence |
| Error | Coral flash (single pulse, not sustained), ring briefly stutters, returns to idle |
| Muted | Ring dims to ~30% opacity, small mic-off glyph replaces the core mark |

### Command bar

Single input, dual-mode by design (not a toggle): a mic affordance on the left that's always live, a text field that's always typeable. Typing suppresses the mic's listening animation; tapping the mic suppresses the text cursor. Placeholder copy should rotate through example commands when idle, to teach capability without a tutorial.

### Task panel (anatomy)

- **Header**: task title (what was asked, in plain language — not a system label), a status badge, a source glyph (mic / clock / bolt for manual / scheduled / event), and elapsed or scheduled time.
- **Trace column**: ordered list of steps, each in one of four states (done / active / pending / error), monospace timestamps optional at 11px.
- **Live-view column**: a live, readable preview of the actual artifact being produced, rendered from its native system rather than a copy (see section 2) — not an abstract progress bar. If Khameleon is drafting an email, show the email forming; if it's scanning SEO data, show the keyword list populating.
- **Footer (conditional)**: only appears on error — a one-line explanation plus an inline retry action. Never a modal.

### Panel grid

- Auto-fit tiling, minimum panel width ~300px, gap 20px.
- Cap visible concurrent panels at a sensible number (suggest 6) before overflow tucks into a "+N more running" chip that expands the grid.
- A finished panel's collapse-to-summary animation should visibly happen in place — don't teleport it to a different area, so the user's eye never loses track of it.

### Summary card

Compact, single row: outcome icon, task name, one-line plain-language result, timestamp, expand chevron. Expanding re-opens the full trace read-only (not re-runnable in place — re-running is a new command).

### History view

Search input plus two independent filter groups (status: all/completed/failed/running; source: manual/scheduled/event) that combine with AND logic. Each row mirrors the summary card format for visual consistency between "just finished" and "from last week."

## 5. Interaction & functional rules

- **Triggers**: manual voice, manual typed, scheduled/recurring, event-triggered. All four produce identical panel/trace/summary behavior — the only difference is the source glyph and metadata line.
- **Concurrency**: unlimited tasks may run; the grid tiles them. No queueing unless a hard resource limit is hit (e.g. too many simultaneous browser-using agents) — in that case, incoming tasks show a `queued` badge rather than being silently delayed.
- **Failure handling**: failures never interrupt other panels or the whole interface. The failing panel shows its inline retry; retry re-attempts from the failed step where feasible, not from scratch.
- **Persistence**: every command, regardless of outcome, lands in history, logged as action + outcome metadata rather than raw content (see section 2). Nothing is discarded on dismiss — dismissing a summary card only removes it from the active view, not the record.

## 6. Window management

Task panels behave as free-floating windows on the canvas — not fixed grid tiles — so they can overlap, be dragged anywhere, and vary in size according to what they're doing.

**Control model — hybrid.** The system auto-arranges every window by default (position, size, stacking order), but any window can be manually dragged, resized, minimized, or maximized at any time. A manual move/resize is treated as an explicit override: the system won't fight the user's placement, but a new status change (e.g. that task later fails) can still pull the window forward or enlarge it — the override only persists until something materially changes.

**What increases a window's prominence** (brought to front and/or enlarged), in order of urgency:

1. **Needs input** — a failed step with an inline retry, or any point where the task is blocked on a decision. Always comes to front regardless of what else is happening.
2. **Actively processing** — whichever task is doing the most visible work right now gets more size/frontmost priority among the remaining windows.
3. **Idle/queued/completed** — recedes; completed tasks auto-minimize to a dock rather than staying on the canvas.

**Minimize/maximize.** Minimizing sends a window to a persistent dock (a row of compact pills, similar in spirit to the summary card) rather than closing it — clicking a dock item restores the window to its last floating position and size. Maximizing expands a window to a large, comfortable reading size and brings it to front; restoring returns it to its prior floating position exactly, not a default.

**Motion**: window moves/resizes animate with the same standard easing as the rest of the system (`cubic-bezier(0.22, 1, 0.36, 1)`), never a hard jump — including the auto-arranging moves, so the user can visually track a window changing importance rather than have it teleport.

## 6.5 Ambient Status and Confirmation Patterns

This section extends the orb states in section 4, the window prominence rules in section 6, the persistence rule in section 5, and the `outlook-draft-email` confirm step in section 12.1 — it does not replace any of them.

### 6.5.1 Layered status visibility

Khameleon uses three levels of status visibility, each with a distinct purpose, so the user learns what matters without being trained to ignore the interface.

- **Ambient badges are the default always-on state.** The orb and lightweight window chrome show only the minimum meaningful state: idle, processing, or needs-input. They never show detailed content, a progress transcript, or a running log. This keeps the background state quiet while still signaling whether the system is active or waiting.
- **An opt-in expandable progress panel is a second tier.** A user can open it explicitly when they want detail, and only then. It is never auto-expanded for routine work. Routine progress stays ambient; only a user request opens the expanded panel.
- **Interrupting notifications are reserved strictly for genuine needs-input moments.** Any intrusive foreground alert is limited to real blockers, real decisions, or hard confirmation requirements. Routine progress, completed steps, and normal background activity do not trigger interrupts. Over-notifying trains users to ignore everything, including the alerts that actually matter.

This pattern keeps the orb and the canvas readable: the normal state is quiet, the detail layer is opt-in, and interruption remains a rare signal for a real decision.

### 6.5.2 Action receipts

The persistence rule in section 5 is extended so that every autonomous action produces a reviewable action receipt, not a transient toast that disappears.

- Every autonomous action must leave a history entry describing what changed, where it changed, which permission scope was used, and the outcome.
- The entry should include the exact action category (draft created, email sent, task updated, web action submitted, etc.), the target object or record, and the scope used to perform it.
- If a real rollback or undo hook exists, the receipt must expose that option directly in the same record. If no rollback exists, the record must still show the action and its owner, so the user can review or re-run safely later.
- A toast is not a substitute for this record. Short-lived transient UI is allowed only as a secondary reminder; the durable record is the source of truth.

This rule closes the gap between "something happened" and "I can verify what happened, undo it if needed, and see which permission made it possible."

### 6.5.3 Confirm gates by reversibility, not task type

Any confirmation decision follows the reversibility of the action, not the tool category.

- **Hard confirm gate**: required for anything expensive, hard to reverse, or affecting someone other than the user. Examples include sending mail to a real recipient, posting a message on behalf of a person, or submitting a change that would be difficult to unwind. The gate must show the exact action, the full real payload, the recipient, and the final diff before execution. It may still be editable in place before the user approves.
- **Quiet action receipt without a gate**: allowed for actions that are local, cheap, and easy to undo. These actions may skip the hard gate and instead become a quiet receipt with a clearly visible undo option afterward. This keeps low-risk actions fast without making the system silent about what it did.
- **The rule is about consequence, not function.** A low-risk local edit is not forced through a hard gate just because it is a typed action or a system call; a high-risk external action is not exempt because it was labeled as a draft or a recommendation. The relevance is the real-world effect.

This extends the existing `outlook-draft-email` confirmation pattern in section 12.1 and makes the same principle reusable for other connectors and agent actions.

### 6.5.4 Intent preview hides nothing being authorized

For any action that triggers a hard confirm gate, the preview must show the actual content being acted on, not a summarized or redacted approximation. The user must see:

- the full real payload;
- the exact recipient or target object;
- the content diff or generated result;
- the permission scope being used;
- a real editable in-place review step before approval.

The rule is explicit: no approve-first-edit-after. A person reviewing a hard-gate action should be able to inspect the exact real content, adjust it if needed, and only then approve. Anything less creates an invisible authorization path and is not acceptable.

This rule should be treated as part of the same safety model as the existing section 2 security and data-architecture requirements: if a user is authorizing real action, they must see the real thing being authorized.

## 7. Layout zones

Free-floating windows still have a default "home" area based on what they're showing, so the screen reads clearly even before anyone drags anything:

- **Side (near the orb)** — work-in-progress. Task panels showing an active trace + live view default here, out of the way of center stage while something is still being made.
- **Center** — the final product. When a task completes, or Khameleon has something finished to present (a report, a drafted document, a finished chart it wants to walk the user through), that window defaults to center stage, sized for focused reading.
- **Right rail** — a persistent, non-floating information column, distinct from the floating windows. It holds three visually separate sub-sections so they're never mistaken for one generic list: a notifications/history feed, the daily briefing/agenda, and connected-systems status. Each sub-section gets its own header, icon, and accent tint so the three are distinguishable at a glance without needing to read labels closely.

These are default placements, not constraints — consistent with the hybrid control model in section 6, any window can be dragged out of its default zone at any time, and it stays where it's put until a status change gives the system reason to move it again.

## 7.5 Live Wall (Assistant tab)

**Added 2026-09-25** — a second, distinct top-level layout, used only for the Assistant tab, alongside (not replacing) the free-floating window canvas model in sections 6-7, which remains the model for the Workspace tab. Ported wholesale from a Replit design exploration (`artifacts/mockup-sandbox/src/components/mockups/live-wall/CommandWall.tsx`) into `artifacts/khameleon-command/src/components/liveWall/CommandWall.tsx`, with every data-bearing element rewired to real app data — see that file's own header comment for the full real-vs-demo breakdown (only the audio-reactive "speaking" visualization stayed non-live, since no real playable output stream exists to analyze; browser TTS drives a real "speaking" state instead).

**Structure:** three fixed glass panels ("Parked orbit" / left, "Work in motion" / center, "Wall status" / right) plus an always-on-top orb window (bottom-right, aligned to the right column's own edges) carrying its own embedded orb, chat input (the same `streamAgentChat` pipeline as the rest of the app), and a manual 7-state override row (idle/listening/thinking/researching/speaking/error/muted). Unlike sections 6-7's model, these three panels are fixed in place — no drag, minimize, or dock behavior exists here. The persistent floating orb (section 4) is suppressed while this page is mounted (`embeddedOrbMountCount`), so only one orb is ever visible.

**Per-column split, locked 2026-09-25, center column completed 2026-09-26** (see `khameleon-decisions-log.md` for both build entries):
- **Left ("Parked orbit")** — work stalled on something outside the agent's control, grouped by *why*: waiting on a reply (shows what/who and when), deliberately deferred, or blocked by another task (shows which one). Distinct from the center column's queue, which just hasn't started yet - a plain `todo` task with no parked reason is queue material, not a parked one, since the queue was built. Each card has a one-action "Resume" (clears the parked reason, returns the task to normal active status) that now genuinely feeds the real queue, not an "Unsorted" holding area.
- **Center ("Work in motion")** — "current focus" (hero, one task at a time - the most recently updated in-progress task, or a `needs_input` one if any exists, which takes priority) plus a "queue" (ordered, real drag-to-reorder, title + Work Domain tag + agent icon only). A `needs_input` focus gets a visually distinct coral treatment, not equal-weighted styling. A thin, fading strip of the last 5 completed tasks sits between them - not its own panel. Completing the focus task auto-promotes the top queue item immediately, with a brief on-screen announcement, no manual confirm. `executingAgentId`/`zdrEndpoint` are real per-task fields, rendered only when actually set - nothing in the task-execution pipeline auto-populates them yet.
- **Right ("Wall status")** — strictly system health, no controls: real per-agent online/offline (no quota/rate-limit — nothing tracks that yet), a single global ZDR indicator (no per-task breakdown — no per-task ZDR field exists), real integration connect/disconnect status, and the "Today's progress" ROI strip. Independently scrollable within a bounded region, since it sits directly above the orb window and unbounded content there renders hidden behind it rather than pushing the window down.
- **Top bar** — icon-first controls that act on the whole wall, not just one column: live/pause, orchestration mode (moved here from the center column), a Work Domain multi-select filter (also moved from the center column), reasoning-visibility default, and an activity-feed slide-out. Labeled on a user's first-ever session (a persisted flag), icons-only after — every icon-only control still carries a hover title regardless.

**Known divergence from Signal Glass — unresolved, flagged rather than silently picked either way:** this layout's `.glass` panels use their own recipe (a teal-tinted gradient fill, a fixed teal border, no per-category rim-glow hue, no highlight-streak/top-edge-line pseudo-elements) instead of the locked Signal Glass recipe above. This was kept exactly as the Replit source defined it, per an explicit request to match that reference precisely rather than reconcile it to the existing material system. Whether Live Wall should eventually be re-skinned in Signal Glass, or is intentionally a second permanent material scoped to this one surface, is an open question — see `KHAMELEON_SPEC.md` §8.

## 8. Charts and data visualization

Khameleon can generate charts appropriate to the person's field and role — informed by their onboarding questionnaire and whichever systems are connected (e.g. a salesperson sees pipeline/revenue trends, a support lead sees ticket volume and resolution time, a project manager sees burndown or velocity).

- **Rendering**: each chart is its own floating window, following all the same window rules as a task panel — draggable, resizable, minimizable to the dock, and dismissible with a swipe-away gesture (a fast drag off the canvas edge), distinct from minimizing since a swipe means "done with this," not "keep for later."
- **Multiplicity**: more than one chart can be open at once — a single briefing might spawn several relevant charts alongside its written/spoken summary.
- **Triggers**: automatically, as part of a proactive briefing or update when relevant data changes, and on demand whenever the user explicitly asks for one.
- **Default placement**: charts open in the side zone as supporting information by default, unless a chart is itself the finished deliverable being presented, in which case it opens centered like any other final product.
- **Data sourcing**: charts are built from a live read of the connected system at the moment they're generated (see section 2) — not from a persisted analytics store Khameleon maintains on its own.

## 9. Accessibility

- Every color pairing (status text on glass background) must hold 4.5:1 contrast minimum — verify teal/violet/amber/coral against `bg-field`, not just against `bg-void`.
- All state changes communicated by color must have a redundant non-color signal (icon shape, motion, or label) for color-blind users — e.g. error is always coral **and** an ✕ glyph **and** a distinct stutter animation.
- Respect `prefers-reduced-motion`: breathing, hue-shift, and ripple animations should collapse to simple opacity cross-fades.
- Voice input requires an equally complete typed path — never a feature only reachable by speaking.

## 10. What "more sophisticated" means in practice

Compared to the current mockup, the production version should:

1. Replace flat gradients with layered, low-opacity glass (multiple stacked semi-transparent layers rather than one gradient).
2. Give every state its own motion signature, not just a color change (see orb states above).
3. Use monospace accents sparingly to add an "instrument" feel without turning the whole UI technical.
4. Tighten the color rule so hue always equals meaning — never decorative cycling once a task is active.
5. Make the collapse-to-summary transition a first-class moment — it's the payoff of every task and deserves its own polish.

## 11. Core architecture — router, agents & skills

This section defines the execution layer behind the UI already specified above: what actually runs when a command comes in, and how new capabilities get added over time. Patterns here are adapted from OpenJarvis (Stanford Hazy Research / SAIL) — a local-first personal AI framework with the most directly comparable agent/skill architecture found in the open-source landscape — reshaped around Khameleon's own constraints (desktop-native, orchestrate-don't-extract security model, task-panel UI).

### 11.1 Agent execution model

**Decision: phased.** Build one execution path for the current prototype; define the contract so more paths can be added later without a rewrite.

- **Phase 1 (now):** a single orchestrator agent — one tool-calling loop — handles every request regardless of trigger type. Contract: `run(input, context) -> Result`, where `Result` carries the final content, an ordered list of step events, and a status.
- **Forward-compatible seam:** the routing contract includes an `agent_type` field from day one, even though only one value (`orchestrator`) exists yet. This is what lets future agent types slot in without changing how the router calls them. Build order once Phase 1 needs more than one type: **`simple` first, then `traced`** (see 11.6) — candidates below, in order of likely need:

| Agent type | When it'd be used | Why not now |
|---|---|---|
| `simple` | Single-shot lookups with no tool calls (e.g. "what's on my calendar today") | Prototype scope is one connector (Outlook); not enough request variety yet to justify a cheaper path |
| `traced` | Multi-step skills where every step must emit to the trace column explicitly | Only one connector's worth of skills exist so far — revisit once the skill catalog (11.2) has enough multi-step entries to need this |
| `sandboxed` | Wraps any agent type with network/mount restrictions | Directly needed once skill import (11.4) is live — an unverified imported skill should never run outside this wrapper |

- **Step-level contract:** each step an agent takes must emit a discrete event (`pending` / `active` / `done` / `error`) matching the task panel's trace column states (section 4) — this is the seam between backend execution and the UI, not a separate concern. It also satisfies the retry-from-failed-step requirement in section 5: a step can only be resumed if it was checkpointed as its own event in the first place.

### 11.2 Skill definition format

**Decision: hybrid — both pipeline and instructional skills are supported**, matching OpenJarvis's `skill.toml` + `SKILL.md` split.

- **Pipeline skills** — an ordered sequence of deterministic tool calls, no model judgment involved. Each step's output can feed the next. First choice for anything well-defined: `outlook-draft-email`, `outlook-summarize-thread`, `outlook-triage-inbox` are natural first candidates, since the decisions log names Outlook/Graph API as the very next build target. Pipeline steps map one-to-one onto trace column rows — this is the most direct payoff of choosing this format.
- **Instructional skills** — markdown guidance the orchestrator agent reads and follows using its own tools and judgment, for tasks that can't be fully predetermined ("help me plan this project," "figure out why this thread is stuck").
- **Hybrid skills** — a pipeline with one or more steps that delegate to instructions instead of a fixed tool call (e.g. `outlook-draft-email`: fetch thread → summarize → *compose reply, using judgment* → present for approval).
- Every skill manifest declares which connector(s) and permission scope it needs up front. This is enforced against section 2's "permissions inherit from the underlying system" rule — a skill's declared scope can never exceed what the user's own connector grant already allows, and the manifest is the place that gets checked.

### 11.3 Skill routing

**Decision: model-driven catalog**, matching OpenJarvis's `<available_skills>` pattern. Every installed skill's name and one-line description are included in the router's context; the orchestrator agent reads that catalog and decides which skill (if any) applies to the incoming command. This keeps the command bar's open-ended, natural-language feel (section 4) intact — no fixed phrasing required.

**Deferred (see 11.6):** scheduled and event-triggered tasks (section 5) already know their target skill at creation time — a recurring "summarize my inbox every morning" task doesn't need to be re-interpreted through the catalog on every run. A fixed-skill-ID shortcut for these trigger types is a real optimization, but it's deliberately held until after the org-wide router ships, once re-routing cost (latency, model calls) at org scale actually justifies it. Every trigger type routes through the model catalog until then.

### 11.4 Skill sourcing & trust tiers

**Decision: open import**, matching OpenJarvis's ability to install a skill from a public registry or any GitHub repo path (`jarvis skill install github:user/repo/path`).

This creates a direct tension with section 2's core pitch — "nothing new to trust with your data." An imported skill is third-party code capable of calling the same connectors (Outlook, CRM, etc.) a first-party skill can. Open import without a trust boundary would mean an org security reviewer's first question — "what code is touching our Outlook?" — has no good answer. To keep both true at once, skills carry a trust tier that gates *execution*, not *import*:

| Trust tier | Import | Execution |
|---|---|---|
| **Verified** | Built and reviewed by Khameleon | Full requested permissions, no sandbox overhead |
| **Org-approved** | Imported, then explicitly approved by an org admin for that deployment | Full requested permissions after approval; the approval event and skill source are recorded in history (section 2's action log), not just the resulting action |
| **Unverified** | Imported, not yet reviewed | Runs only inside the `sandboxed` agent wrapper (11.1) — network/mount restricted. Cannot call a live connector directly; can only propose an action for the user to confirm, never auto-execute |

Importing stays unrestricted — anyone can pull a skill in to try it — but nothing touches a real connected system until it's promoted out of `Unverified`. The admin console already on the roadmap (decisions log, 2026-08-07) is the natural place to manage that promotion.

### 11.5 Catalog storage

**Decision: hybrid — local base, remote override once the admin console exists.** The skill catalog lives as local files on the machine (same directory pattern as the pipeline/instruction skills themselves — section 11.2), matching the single-user prototype scope from the decisions log. On top of that base, the format anticipates an optional remote override list — a channel through which an org admin can push or block specific skill IDs for a deployment — but that override layer isn't built until the admin console itself exists (already on the roadmap, decisions log 2026-08-07). The local catalog format is written so adding the override layer later doesn't require changing how skills are stored or read, only adding a filter on top.

### 11.6 Follow-ups (resolved)

| Question | Resolution | Why |
|---|---|---|
| Build order: `simple` vs. `traced` (11.1) | **`simple` first** | Early real-world usage is assumed to skew toward quick single-shot lookups; `traced` gets added once multi-step skills are in regular enough use to need explicit per-step trace emission beyond what the orchestrator already provides. |
| Fixed-skill-ID shortcut for scheduled/event triggers (11.3) | **Deferred until after the org-wide router ships** | Model-driven catalog routing handles every trigger type for now. The shortcut is a real optimization but only pays for itself at org-scale re-routing cost — same phased logic already applied to the agent execution model in 11.1. |
| Skill catalog storage (11.5) | **Hybrid — resolved above** | — |

## 12. First skills — Outlook

Concrete manifests for the three skills named in section 11.2, scoped to what the single-user prototype (decisions log, 2026-08-07) actually needs: a real connection to Outlook via Microsoft Graph API (OAuth, delegated permissions). All three ship at **Verified** trust tier (11.4) — first-party, not imported.

**Shared connector — Outlook (Microsoft Graph, delegated OAuth):**

| Scope | Used by | Why this scope and not broader |
|---|---|---|
| `Mail.Read` | summarize-thread, triage-inbox | Read-only access to message content; no write access needed for either |
| `Mail.ReadWrite` | draft-email, triage-inbox | Covers creating/updating drafts and folder/flag/category operations — deliberately *not* used to auto-send |
| `Mail.Send` | draft-email (confirm step only) | Requested at OAuth time since the app will eventually call it, but never invoked as part of a pipeline run — see 12.1 |

Note: a Graph API change effective Dec 31, 2026 will require the narrower `Mail-Advanced.ReadWrite` permission for modifying sensitive properties (subject, body, recipients) on already-delivered messages. None of the three skills below modify delivered mail — draft-email only ever creates/edits an unsent draft — so this doesn't apply yet, but flag it if a future skill needs to edit a message after it's been sent/received.

### 12.1 `outlook-draft-email` (hybrid)

| Field | Value |
|---|---|
| Description | Draft a reply to an email thread, using the user's own tone, for their approval |
| Connector | Outlook (`Mail.Read`, `Mail.ReadWrite`; `Mail.Send` reserved, not auto-invoked) |
| Format | Hybrid — deterministic fetch/summarize, instructional compose |
| Trust tier | Verified |

| Step | Type | Action | Output |
|---|---|---|---|
| 1 | Pipeline | Fetch thread via `Mail.Read` | `thread` |
| 2 | Pipeline | Summarize thread context (what's being asked, prior tone) | `context_summary` |
| 3 | Instructional | Compose reply using `context_summary` and the user's tone, per the router agent's judgment | `draft_text` |
| 4 | Pipeline | Write `draft_text` as an Outlook draft via `Mail.ReadWrite` | `draft_id` |
| 5 | *(not part of this skill's pipeline)* | User reviews the draft in the task panel's live-view (section 4) and explicitly confirms send | Separate, single `Mail.Send` call, fired only on that confirmation — never automatic |

Step 5 is intentionally outside the traced pipeline: it's a distinct, user-initiated action rather than something the skill executes on its own, consistent with the manual-typed/manual-voice trigger already being one of the four trigger types in section 5 — a "confirm send" is its own small trigger, not a continuation of the drafting task.

### 12.2 `outlook-summarize-thread` (pipeline)

| Field | Value |
|---|---|
| Description | Produce a plain-language summary of a selected email thread |
| Connector | Outlook (`Mail.Read` only) |
| Format | Pipeline-only — no judgment step needed for a summary, so no instructional fallback |
| Trust tier | Verified |

| Step | Type | Action | Output |
|---|---|---|---|
| 1 | Pipeline | Fetch thread via `Mail.Read` | `thread` |
| 2 | Pipeline | Summarize into plain language (participants, ask, current status) | `summary` |

Simplest of the three — a good first candidate to build, since it exercises the pipeline format end-to-end without needing the instructional fallback or a confirm step.

### 12.3 `outlook-triage-inbox` (hybrid)

| Field | Value |
|---|---|
| Description | Classify unread mail (urgent / FYI / action needed / low priority), extract action items, surface what needs a decision |
| Connector | Outlook (`Mail.Read`, `Mail.ReadWrite` for flagging/categorizing/archiving) |
| Format | Hybrid — deterministic fetch/classify-by-rule, instructional judgment for ambiguous cases |
| Trust tier | Verified |

| Step | Type | Action | Output |
|---|---|---|---|
| 1 | Pipeline | Fetch unread mail via `Mail.Read` | `unread` |
| 2 | Pipeline | Apply rule-based classification where confident (sender, subject patterns, prior handling) | `classified`, `unclassified` |
| 3 | Instructional | For `unclassified` items, classify using judgment (content, apparent urgency) | `classified` (merged) |
| 4 | Pipeline | Flag/categorize/archive via `Mail.ReadWrite` per classification | `actions_taken` |
| 5 | Pipeline | Extract action items into a plain-language list for the summary card (section 4) | `action_items` |

**Trigger note:** this is the clearest candidate for a scheduled trigger (e.g. "every morning at 7am") named in section 5. Per 11.3/11.6, it still routes through the model-driven catalog on every run for now — the fixed-skill-ID shortcut for scheduled triggers stays deferred until after the org-wide router ships, so this skill doesn't get special-cased ahead of that decision.

## 13. Web access

Section 5's concurrency rule already anticipated "browser-using agents" as a resource-limit example, without ever specifying what that meant. Raised explicitly 2026-08-12: two genuinely different capabilities live under "web access," each with its own risk profile and build path.

**Status (2026-08-12): both built** in `khameleon-prototype/` — §13.1 as `electron/webapps.js`, §13.2 as the `web-task` skill on the new `web` connector. Neither has been run for real yet (Electron can't launch in the sandbox this was built in; the same is true of a real headless browser) — see the prototype README for exactly what was and wasn't verified.

### 13.1 User-facing web app windows

**What it is:** the *person* signs into and works inside web apps they already use (Gmail, Slack, Notion, Salesforce, etc.) without leaving Khameleon — not an agent acting on their behalf, just their own browser session rendered inside the canvas.

- **Fits the native-desktop decision (2026-08-07) directly.** Electron's `BrowserView`/`BrowserWindow` renders real Chromium, so this is mostly UI work plus session management, not a new architecture.
- **Stays inside section 2's "orchestrate, don't extract" pitch** as long as each window is a live rendered session, not something Khameleon copies data out of — persisted per-site via Electron's `session.fromPartition`, so sign-in survives restarts like a normal browser profile, entirely local.
- **Real technical caveat:** several identity providers (Google, notably, since ~2017) block OAuth sign-in specifically inside the `<webview>` tag (`disallowed_useragent` error), as a phishing-prevention measure. `BrowserView`/`BrowserWindow` with a standard Chromium user-agent is reported to fare better than `<webview>` for many providers, but this needs verifying per target app — it's provider-specific, not a single fix.
- **Would behave as its own window type** on the canvas — user-driven rather than agent-driven, so no trace column or skill behind it, but can still follow the same draggable/resizable/minimize-to-dock rules (section 6) for visual consistency with task panels.
- **Resolved 2026-08-12:** apps are chosen at signup/onboarding (see §14), not ad hoc-only — matches the decisions log's "hybrid" call on the Composio question. Ad hoc "open X" by name through the command bar can still be added later as a secondary path, but isn't required for the core experience.

### 13.2 Agent web-browsing capability

**What it is:** Khameleon's own agent autonomously navigating and acting on websites on the user's behalf — the actual referent of section 5's "browser-using agents" line. A materially different, higher-risk feature than 13.1, not a variant of it.

- **No fixed scope.** Outlook skills declare bounded Graph API permissions (§11.2/12); the open web has no equivalent bounded grant, so the existing "a skill's declared scope can never exceed the connector's grant" rule doesn't map cleanly and needs its own model.
- **Prompt injection is a live threat here in a way it isn't for a REST API response** — page content can attempt to hijack the agent's instructions. This needs explicit handling before any real-world action is allowed, not just the trust-tier gate that suffices for first-party Outlook skills.
- **This is the natural first real use of the `sandboxed` agent type** already reserved in §11.1 (network/mount restricted, propose-only) — and should follow the same pattern already proven in §12.1: the agent can look and prepare, but a real-world action (submit, send, buy, sign in as the user) needs an explicit human confirmation step outside the traced pipeline, the same way `outlook-draft-email` never auto-sends.
- **Recommendation:** scope this deliberately, after the single-connector prototype and the Electron shell are both proven — not folded into the current build pass.

## 14. Onboarding — required user inputs (running catalog)

Standing instruction from Metqi, 2026-08-12: every spec that implies something the person must actually decide or provide at signup gets tracked here as it's added — not left implicit. "Fully set up to work from immediately" (the goal behind §13's hybrid decision) only holds if onboarding actually asks for everything that goal depends on.

**Already collected** (`khameleon-prototype`'s 3-step wizard, decisions log 2026-08-07):
1. Display name and role/field — personalization now, chart defaults later (§8).
2. Anthropic API key — powers routing (§11.3) and instructional steps (§11.2). Skippable, runs in mock mode without it.
3. Microsoft Graph client ID (+ tenant ID) — Outlook connector (§12). Skippable, runs against local sample mail without it.

**Built 2026-08-12** (per the hybrid decision on app access):
4. **App connections** — signup step 4 (`public/index.html`'s wizard), backed by `src/webapps.ts`'s `WEBAPP_CATALOG` (10 apps to start) and `GET`/`POST /api/webapps`. `data/webapps.json` starts empty and is only ever populated by this explicit choice now — the old hardcoded 3-app seed is gone.
5. **Scheduled task preferences** — signup step 5, an enable/disable toggle + time picker for `outlook-triage-inbox`'s schedule, backed by the existing `PATCH /api/schedules/:id`. No more silent 7am default with zero input.

**Flagged, likely optional:**
6. Chart/report focus (§8) — role already narrows this (a salesperson vs. a support lead), and which systems are connected (item 4) narrows it further. A more specific "what do you want charted" input isn't clearly required yet — revisit once §8 is actually built, not before.

**Not applicable to individual signup:**
7. Trust-tier admin approvals (§11.4) — org/admin-level, only relevant once the org-wide phase (decisions log 2026-08-07) exists.

## 15. Skill Sets

**Extends:** Ambient Status and Confirmation Patterns (confirm-gate tiering, action receipts), workspace model.

### 15.1 Definition

A Skill Set is a bundle of instructions, reference material, and optionally tools/scripts that teaches an agent how to handle a specific class of task (e.g. "Aviation Compliance Review," "Investor Update Drafting"). Skill Sets are workspace-scoped, not global — installing one in a workspace makes it available to agents operating in that workspace only.

### 15.2 Discovery

Two paths, not one:

- Catalog browsing: a searchable directory (curated + org-shared) the user can browse and install from directly.
- Contextual surfacing: when a task in progress matches a not-yet-installed Skill Set closely, the system may surface it inline as a suggestion the user can accept or dismiss with one action. Never auto-installs. A dismissed suggestion does not repeat for the same task thread.

### 15.3 Installation — routes through existing confirm-gate tiering

- Instructions-only Skill Set (no new tool/data access requested): treated as local, cheap, reversible. Skips the hard gate. Installs immediately, logged as an action receipt with a quiet undo (uninstall).
- Skill Set that bundles a new Integration or a write-capable tool: treated as affecting scope beyond the user's existing grants. Requires a hard confirm gate — show exactly which new tool/data access is being requested, not just the Skill Set's name or description, before install completes.

### 15.4 Removal / update

Uninstalling a Skill Set is always local and reversible: no gate, logged as a receipt. If a Skill Set update changes its requested scope (adds a new tool or Integration dependency), the update itself re-triggers a hard gate on the delta only — not a full re-approval of the whole Skill Set.

### 15.5 Authorship & sourcing

**Extends:** Skill Sets (installation, confirm-gate tiering).

Skill Sets may be:

- Authored from scratch by the user (freeform instructions/reference material, optionally scripts).
- Imported from an external source: a GitHub repository, a public URL, or a third-party marketplace.

External-source import is always a hard confirm gate, regardless of what the imported package's own manifest claims to request. Rationale: content from an untrusted external source can't be verified against its stated scope the way internally-authored or catalog-reviewed content can, so it's treated as elevated-risk independent of the reversibility test that governs other install types. The gate must show:

- the source (repo/URL, author if available, last-updated date)
- the full content being imported — instructions, scripts, requested tool/data access — never a summary
- an explicit warning if the package requests write access, credentials, or unrestricted tool/script execution

Imported Skill Sets are versioned. An update from the source requires a new hard gate before it takes effect — never a silent pull.

## 16. Integrations

**Extends:** Ambient Status and Confirmation Patterns (confirm-gate tiering, action receipts, intent preview), orb states (for connection status).

### 16.1 Definition

An Integration is a connection to an external service (email, calendar, CRM, docs, etc.) that exposes that service's actions as tools agents can call. Distinct from a Skill Set: an Integration is a capability grant, a Skill Set is a behavior pattern. A Skill Set may request an Integration as a dependency, but Integrations can also be connected standalone.

### 16.2 Directory & discovery

A browsable, searchable directory of available Integrations. Each listing states plainly, before connection: what data it can read, what actions it can take, and whether those actions are reversible.

### 16.3 Connection flow — always a hard gate

Connecting an Integration always affects something beyond the user's local workspace and is not cheaply reversible (revoking access after data has been read/written doesn't undo the read/write). Per the reversibility rule, this is always a hard confirm gate, with no exceptions by task type:

- Full scope shown before authorization: exact data types and actions being granted, not a generic "this app wants access" summary.
- OAuth or equivalent handoff for credential exchange; Khameleon never collects or stores the credential directly.

### 16.4 Tool exposure to agents

Once connected, an agent's calls to an Integration default to read-only. Any write action against a connected Integration routes through the same confirm-gate tiering as any other autonomous action:

- Expensive / hard-to-reverse / affects someone other than the user (e.g. sending an email, posting to a shared calendar) → hard gate, full real payload and recipient shown, editable in place (per intent preview rule).
- Local / cheap / easily undone (e.g. drafting without sending, reading) → no gate, logged as an action receipt.

### 16.5 Status & disconnection

Each connected Integration shows an ambient badge state (connected / degraded / needs re-auth) consistent with the three-tier status model — no separate notification system for Integration health. Disconnecting is local and reversible: no gate, logged as a receipt, with a note that any already-completed external actions are not undone by disconnection.

### 16.6 Authorship & sourcing

**Extends:** Integrations (connection flow, hard gate).

Integrations may be:

- Selected from a first-party directory (as previously defined).
- Defined by the user pointing Khameleon at an external service definition — an OpenAPI spec, an MCP server URL, a GitHub-hosted connector manifest, etc.

Integrations already always trigger a hard gate at connection. For externally-sourced Integrations, that gate additionally shows: where the definition came from, who published it (if known), and — same as Skill Sets — the full real scope requested, not a paraphrase.

## 17. Work Domains

**Extends:** Skill Sets, Integrations (organizing layer for both).

### 17.1 Definition

A Work Domain is a user-defined label for organizing their own Skill Sets and Integrations around the actual shape of their job. There is no fixed taxonomy. Khameleon ships a set of illustrative examples only (e.g. Business as Usual, People, Governance, Change, Administration, Strategic) as a starting template — users may rename, merge, split, delete, or invent domains freely. Naming convention and structure is entirely up to the user.

### 17.2 Tagging

A Skill Set or Integration may carry zero, one, or multiple Work Domain tags. Tags drive discovery (filtering, contextual surfacing) and carry no fixed permission meaning on their own.

### 17.3 UI surface

Domains render as a user-editable grouping/filter layer, not a mode switch. The agent stays one continuous entity regardless of which domain a Skill Set came from — domains organize the user's library, they don't fork the agent into separate personas (unlike a multi-bot model).

## 18. Provider Access Model (Commercial)

Khameleon does not hold or proxy a shared AI provider key on behalf of users. Each user connects their own access to the AI providers they have available:

- Personal accounts (e.g. Claude free tier, ChatGPT free tier)
- Organisation-provisioned agents (e.g. Microsoft Copilot, Gemini) where the user's employer has licensed and permitted their use

### 18.1 Implications for build

- Per-user credential/connection storage, isolated per account (not a single shared `.env`)
- A connection-management UI: add, view, swap, and revoke provider connections per user
- Provider abstraction must resolve to "whichever providers *this* user has connected," not a fixed global set
- Graceful degradation: a user with only one provider connected must still get sensible behaviour from every feature, not assume any specific provider is present
- No Khameleon-side usage metering/billing for model calls — cost is borne by the user via their own provider account/licence
