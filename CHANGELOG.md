# UI Overlay Redesign — Changelog

Scoped to the `ui-overlay-redesign` project.

## 2026-10-09
- Started Phase 0 (ground-truth inventory). `DECISIONS.md` and `OPEN_QUESTIONS.md` created.
- **Phase 0 complete.** `docs/ui-inventory.md` written: full app-shell/chrome catalog, all 16 tabs + 4 orphaned stub pages + 2 dead-code pages, every real vs. stub/decorative/fake control identified (29 flagged items total), full `jarvisStore` state inventory, all global keyboard shortcuts.
- **Phase 1 complete.** Standalone sample built at `artifacts/mockup-sandbox/src/components/mockups/overlay-redesign/OverlayRedesign.tsx` (preview: `/preview/overlay-redesign/OverlayRedesign`). Transparent glass overlay over a mock desktop; left edge (Capture & Extract / Create & Draft) and right edge (Transform & Clean / Ask & Find) stacked toolbar pills, 3 thin outlined icons each, hover tooltips, per-side collapse to a tiny handle; a static suggestion-slot placeholder; the real Chat Window restyled into the glass language (agent route-mode pills, reasoning toggle, live) plus a small (46px) bottom-right Khameleon Head with a right-click "Open full Khameleon" fallback. Both palette options (soft blue/white and Khameleon's existing dark teal) built and live-switchable in the sample per `DECISIONS.md`'s flagged conflict. Screenshots in `docs/ui-sample/`.
- **Phase 2 complete.** `docs/ui-parity.md` written — 64 rows (13 Covered, 10 Relocated, 26 Gap, 15 Dropped) comparing every Phase 0 function against the new design. Proposed one uniform home for nearly all Gaps ("Open full Khameleon," built into the sample) and flagged it as the one big decision the whole parity result hinges on. Stopping here per the brief — no Phase 3 work started.

## 2026-10-10
- Sample extended with live comparison toggles: top/bottom bar (Option 3), top/bottom floating icons (Option 4), bare icons with no pill/oval (Option 5), plus a stronger hover effect (~1.55× scale with overshoot, brightness boost) on every icon. Newton decided all variants become user options.
- **Gap review complete** (`docs/gap-review.md`): all 18 questions answered, with a running list of genuinely new builds (capture, procedure comparison, automatic detection, etc.) kept separate from relocations. Outcome: no full fallback app needed; two panels (Settings, Workspace) plus Skills.
- Old UI preserved as git tag `legacy-dashboard-ui` (local, not yet pushed).
