# UI Overlay Redesign — Decisions Log

Scoped specifically to the `ui-overlay-redesign` project (replacing khameleon-command's dashboard UI with a transparent overlay). The project's main, long-running decision journal is `khameleon-decisions-log.md` — this file doesn't replace or duplicate it; it exists because the redesign brief explicitly asked for a dedicated decisions file for this effort. Anything here that becomes permanent gets folded into the main log too once Phase 3 ships.

---

## 2026-10-09 — "nexus-command" resolved to "khameleon-command"

The brief referred to the main UI as `artifacts/nexus-command`. Checked directly: `artifacts/nexus-command/` exists but contains only a stray `node_modules` directory — no source, no package.json, not tracked by git, not gitignored. It's leftover cruft from before the documented 2026-08-24 "Nexus Command → Khameleon Command" rename. The real, current main UI is `artifacts/khameleon-command`. Proceeding on that basis; flagged to Newton for confirmation rather than silently assumed.

Separately: `artifacts/mockup-sandbox/src/components/mockups/nexus-canvas/NexusCanvas.tsx` exists — an unrelated earlier (Aug 22) exploratory mockup (a brain/neuron-network dashboard visualization with fake data). Not connected to the real app, not reused for this redesign unless asked. Named here only to avoid confusion with "nexus-command."

## 2026-10-10 — Both UIs stay live: overlay primary, every change mirrored into the old UI

Newton's standing rule from here on: all new development targets the new overlay UI first, and every change is also mirrored into the old dashboard UI so it never goes stale or loses functionality, in case of a switch back. This supersedes the "frozen snapshot" idea below — the `legacy-dashboard-ui` tag stays as a reference point for the pre-redesign state, but the old UI itself is kept running and maintained alongside the new one. Also: push to GitHub as work happens (replacing the brief's "don't push until I say so"), and review each new build with recommendations and alternatives before implementing it. How the two UIs share code to make mirroring cheap is the first build decision (see the build review).

## 2026-10-10 — Gap review complete: no full fallback app; old UI preserved as a git tag

All 18 gap-review questions answered (`docs/gap-review.md`). Outcome: the "Open full Khameleon" fallback proposed in `docs/ui-parity.md` is **not** needed — every gap found a home in the toolbars, chat, suggestion slot, a Skills panel, a Settings panel (set-up-once tabs) and a Workspace panel (Tasks, Domains & documents, Status). `docs/gap-review.md` supersedes the Gap rows in `docs/ui-parity.md`.

Newton asked to keep the old UI stored so it can come back later. Preserved as annotated git tag **`legacy-dashboard-ui`** on commit `bf9703b` (the last commit before any redesign implementation; the only uncommitted work at that point was redesign docs and the mockup sample, none of which touch the old UI). Chosen over copying the old frontend into a separate folder, which would silently fall out of date against backend changes and double the code to maintain. Caveat: restoring later may need small fixes if the backend changes in between — mitigated by Phase 3's rule that api-server contracts stay unchanged. The tag is local until pushed to GitHub.

## 2026-10-10 — Layout/style variants become user-selectable options, not one fixed design

After reviewing the sample, Newton decided the variants explored in Phase 1 should all ship as user choices in the real implementation, rather than picking one:
- **Palette:** soft blue/white or Khameleon's existing dark teal.
- **Edge chrome:** left/right toolbars only; plus a top/bottom bar; or plus top/bottom floating icon pills.
- **Icon style:** glass pill backgrounds, or bare icons (no oval at all, drop-shadow for legibility).
- **Hover:** every icon scales to ~1.55× with a slight overshoot and brightens on hover (applies in every variant).

Implication for Phase 3: these need a real preferences surface and persisted settings (they're currently sample-only toggles in the bottom-left corner of the mockup). Where that surface lives is tied to gap-review Question 1.

## 2026-10-09 — Phase 1 sample location: `artifacts/mockup-sandbox`

The brief suggested this location "or similar." Verified it's real, working infrastructure (Vite + React + Tailwind + shadcn/radix components already installed), with a `mockupPreviewPlugin.ts` that auto-discovers any component dropped under `src/components/mockups/<name>/` and serves it standalone at `/preview/<name>` — exactly the "standalone, runnable sample" Phase 1 asks for, no new scaffolding needed. Using it as-is.
