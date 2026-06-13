---
name: Jarvis Command Architecture
description: Key decisions for the terminal-native three-column shell replacing the orbital brain canvas.
---

## Design
- GitHub Dark palette (#0d1117 bg), JetBrains Mono for data, 13px UI font
- Three-column shell: TopBar (40px) | NavRail (52px collapsed / 200px expanded) | Main | StatusBar (28px)
- j-* utility CSS classes in index.css (NOT nexus-* — those were deleted)
- No framer-motion except route-level page transitions

## Key files
- Shell: `src/components/AppShell.tsx` (replaces old CanvasLayout.tsx — deleted)
- Store: `src/store/jarvisStore.ts` (replaces nexusStore.ts — deleted)
- API client: `src/lib/jarvisApi.ts` — all calls wrap in safeFetch with offline fallbacks
- Hooks: `src/hooks/useJarvis.ts`

## Deleted files (do not recreate)
- `src/components/BrainCanvas.tsx`
- `src/components/CommandBar.tsx`
- `src/components/Panel.tsx`
- `src/components/layout/CanvasLayout.tsx`
- `src/store/nexusStore.ts`

## Routing
- State-based (not react-router/wouter): `activeModule: ModuleId` in jarvisStore → `<PageRouter>` in AppShell
- Modules: dashboard, chat, inbox, projects, approvals, calendar, research, memory, knowledge, analytics, automations, agents, skills, security, vault, communications, marketplace, settings

## Offline behaviour
- All jarvisApi.ts functions return mock fallbacks when backend is unreachable (404/network error)
- StatusBar shows "● offline" in accent-red
- Dashboard shows "backend offline" banner with `jarvis serve` hint

**Why:** OpenJarvis is local-first — UI must work without a backend and show honest system state at all times.
