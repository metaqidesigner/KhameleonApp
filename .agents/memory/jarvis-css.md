---
name: Jarvis CSS Conventions
description: CSS variables and class names for the Jarvis/NEXUS HUD design system.
---

# Jarvis CSS Conventions

## CSS Variables that DO exist
- `var(--j-green)` = #3fb950
- `var(--j-cyan)` = #00d4ff
- `var(--j-red)` = #c0152a
- `var(--j-text)`, `var(--j-text-muted)`, `var(--j-text-faint)`
- `var(--j-font-head)`, `var(--j-font-mono)`, `var(--j-font-ui)`

## CSS Variables that do NOT exist
- `--j-gold` → use `#c9a84c` directly

## JPanel component
- Props: title, icon, badge (default: 'CLASSIFIED'), action, headerVariant, children, className, style, noPadding
- `action` prop renders before the badge in the header

## CSS Classes available
- `.j-badge`, `.j-badge-cyan`, `.j-badge-red`, `.j-badge-classified`
- `.j-btn-primary`, `.j-btn-ghost`
- `.j-panel`, `.j-panel-header`, `.j-panel-body`
- `.j-table`, `.j-table-header`
- `.j-metric`, `.j-metric-header`, `.j-metric-value`, `.j-metric-sub`
- `.j-empty` — centered empty state
- `.j-mono` — monospace text
- `.scrollbar-jarvis` — custom scrollbar
- `.j-corner` — corner bracket decoration

## CSS Animations (keyframes)
- `jarvis-spin` — 360deg rotation
- `jarvis-spin-r` — reverse rotation
- `jarvis-blink` — cursor blink
- `jarvis-pulse` — opacity pulse
- `jarvis-scan`, `jarvis-shimmer`, `jarvis-flicker`, `jarvis-fadein`, `marquee`, `radar-spin`, `row-flash`
