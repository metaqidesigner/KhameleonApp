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
