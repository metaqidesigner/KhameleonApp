# Status Report — Khameleon Floating Chat Window

**Date:** 2026-10-02
**Branch:** `design/home-implemented-glass` (PR #1, not `main`)

## What was requested

A free-floating, draggable, resizable, dockable (to the right rail), minimizable, closable Chat Window — "the main way a user talks to their agents" — per a detailed external spec covering window chrome, an agent strip, a message area (bubbles, reasoning blocks, action cards, meta lines, live task cards), an empty state, a composer with a route-mode control (Single/Parallel/Vote/Council), a docked variant, accessibility requirements, and data-honesty rules ("never fabricate a number, show n/a if real data isn't available").

The spec explicitly required ground-truthing every assumption about the repo before building, logging discrepancies, and proceeding on the least-risky path rather than stopping — stopping only where something would be hard to undo or the repo contradicted the design in an architecture-changing way.

## What was built

- **New module** `src/components/chatWindow/`: `types.ts`, `useWindowDrag.ts` (drag/resize/dock-snap mechanics, written from scratch — no reusable window manager existed anywhere in the repo), `chatWindowApi.ts` (route-mode backend wiring), `ChatWindow.tsx` (~700 lines, the full component).
- **Deleted** the old fixed `ChatPanel.tsx` after confirming zero remaining real references, and mounted `ChatWindow` in its place in `AppShell.tsx`.
- **Added** the real global Cmd/Ctrl+K listener to `CommandPalette.tsx` — the spec assumed it already existed; it didn't.
- **Relocated** `TaskRunCard` into the already-shared `TaskRunParts.tsx` so the live task card can reuse it without pulling the lazy-loaded Tasks page into the main bundle.
- **Added** persisted chat-window state to `jarvisStore.ts` (bounds, docked, minimized, reasoning-default, route mode, last domain/thread).
- **Bundled** real local variable-font files (Space Grotesk, JetBrains Mono) rather than a CDN link.
- **Wired** real reasoning data: found during verification that the already-built reasoning expand/collapse UI had no backend data source anywhere in the app; connected it to each agent's genuine tool-call events/records instead of leaving it inert or fabricating step text.

Full discrepancy log, architecture decisions, and both real bugs found/fixed during verification are in `khameleon-decisions-log.md` (2026-10-02, two entries: ground-truth, then build).

## What's reused, not rebuilt

`ConfirmGate.tsx` (action cards), `TaskRunCard` (live task cards), the real roster/agent API, real Work Domains, the real `useVoice` hook and wake-word state, and the Live Wall's own parked-task logic for the empty state. All four route modes call genuinely real backend endpoints (`streamAgentChat`, `askAll`) — none are stubbed.

## Known gaps and scope decisions (logged, not hidden)

- **Council has no distinct backend** — it aliases `askAll(mode:'vote')`, matching how the existing `Council.tsx` page already behaves. Not a new limitation introduced by this build.
- **ZDR per-message status** has no live backend signal anywhere in the app; shown as absent rather than fabricated.
- **`CommandPalette`'s old `AgentType`/`selectedAgent` concept** is now functionally disconnected (its only consumer, the old `ChatPanel`, was deleted). Left as an inert no-op rather than reconciling two different "agent" concepts that share a name — a separate, larger decision than this build.
- **Reasoning expand/collapse** could not be exercised live end-to-end in this sandbox without a real provider key actually triggering a tool call. Covered instead by 4 unit tests on the real mapping function (`toolEventsToReasoning`) plus confirmation that the UI correctly shows nothing when no tool call occurred (n/a-by-omission, not fabricated).

## Verification

- **Automated:** 77/77 vitest tests passing (10 drag/resize, 10 route-mode wiring including 4 new reasoning-mapping tests, plus the pre-existing suite). `tsc --noEmit` clean.
- **Live (Playwright against the real dev server, zero console/page errors throughout):** empty state, send message (real honest error with no provider key — `0ms $0.0000 n/a`, correct attribution/routing reason), drag, resize, dock to right rail (conversation persists through the transition), float back, minimize, restore, close/reopen, and `prefers-reduced-motion` (the `chat-reduced-motion` class applies only under that media preference, confirmed via two separate browser contexts).

## Deliverables

- `khameleon-head.webp` — integrated via import/static asset, not a URL.
- This `STATUS_REPORT.md`.
- `khameleon-decisions-log.md` and `KHAMELEON_SPEC.md` updated (ground truth + build entries, Shipped/Changelog lines).
- Small, logically-grouped commits on `design/home-implemented-glass`, not `main`. Not pushed — awaiting confirmation per this session's established pattern.

## Re-verified in the real self-hosted Docker deployment (2026-10-02, follow-up pass)

The Chat Window code above was already committed when this pass started — no app code changed here. This closes the loop on whether it actually works the way a real self-hosted user would run it: `docker compose build && docker compose up -d --no-deps khameleon` against the existing `Dockerfile`/`docker-compose.yml` (built in an earlier session, see `khameleon-decisions-log.md` 2026-09-09/10), then driven live with Playwright against the running container on a genuinely fresh database (empty roster, no onboarding completed, no provider key set) — the actual first-run state a stranger following `SELF_HOSTING.md` would hit.

- Build succeeded (`Successfully tagged khameleonapp-khameleon:latest`), container redeployed and healthy, confirmed serving the Chat Window's own bundled font files (`/fonts/space-grotesk-variable.woff2`, `/fonts/jetbrains-mono-variable.woff2`) from the fresh image — proof the deployed container is actually running this feature, not a stale image.
- Drove the full checklist against the container exactly as done earlier against the dev server: empty state, send a message, drag, resize, dock, float back, minimize, restore, close/reopen. Zero console/page errors throughout.
- With no provider key configured (the real, honest first-run state — not simulated), sending a message correctly routed to CLAUDE and surfaced **"Error: Anthropic API key not configured"** with honest `0ms $0.0000 n/a`, rather than a fabricated success. This is the same honest-failure path verified against the dev server earlier, now confirmed to hold in the actual packaged container a real self-hosting user would run.
- No reasoning block appeared, correctly — no tool call occurred (no agent could run at all without a key), so there was nothing real to show. Consistent with the "n/a-by-omission, never fabricated" rule.

## Three fixes from live review (2026-10-02, second follow-up)

Newton's live review of the above surfaced three real issues, fixed with his explicit sign-off before each step (proposal reviewed and approved, then a sample built and screenshotted, then implemented and redeployed):

1. **Visibility** — the window's stored position/size was never re-checked against the real viewport after its first-ever computation, so it could land partly or fully off-screen with no way back. Fixed with a new `fitToViewport()` function wired to run on open and on browser resize, plus a double-click-to-reset fallback. A second, related bug of my own was caught while building this fix: the fresh-session default path skipped the new fit logic entirely, so a brand-new session on a short browser window still clipped — fixed.
2. **Borderless** — removed the floating/docked window's teal border per Newton's explicit choice, so it reads as part of the Live Wall rather than a separate app window. Deepened the box-shadow to keep edge separation without a hard line.
3. **Head-to-talk** — the empty-state's big head is now a real button wired to the same voice-input session as the composer's mic button, with a pulsing glow while listening.

**A workflow gap of this session's own making, caught and logged rather than papered over:** the very first "I can't see the chat box" report traced not to the viewport bug above but to a simpler cause — Newton was reviewing at `localhost:4001`, which was still the Docker container built hours earlier, while these fixes were only ever verified in a side dev server on a different port. Caught via `docker compose ps`'s container age, not assumed. Fixed by stopping the stale container, running the dev server directly on port 4001 for fast iteration during the fix/approve loop, then rebuilding and redeploying the real Docker container once Newton confirmed the fixes looked right — closing the loop properly rather than leaving the approved fix only in dev.

**Verification:** 83/83 vitest tests passing (6 new for `fitToViewport`), `tsc --noEmit` clean. Live-verified via Playwright against the rebuilt, redeployed Docker container itself (not just dev): a 1200×620 browser window now fits the chat box fully with margin (previously would have clipped off the bottom), the head button is present and wired, and the computed `border-width` is genuinely `0px`. Zero console errors.
