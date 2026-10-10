# New Builds Review — Decisions

Newton's rule (2026-10-10): before any implementation, each new build is reviewed one at a time with a recommendation and alternatives. Source list: `docs/gap-review.md` → "New builds required." Every build targets the overlay UI first and is mirrored into the Classic (old dashboard) UI — see `DECISIONS.md`.

| # | Build | Decision |
|---|---|---|
| 0 | How the two UIs stay in sync | **One app, two layouts, shared logic.** Backend calls, data, settings and logic are written once and shared; only the views are built per layout. A setting switches Overlay ↔ Classic. Desktop app defaults to Overlay; a plain browser always gets Classic (a browser can't float a see-through layer over other programs). Every change checked against both layouts before push, with `docs/ui-parity.md` updated. Classic can be deleted later by removing its view files and the setting — shared logic is untouched. Open for later: what browser-only users get if Classic is ever removed. |
