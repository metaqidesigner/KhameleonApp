---
name: Jarvis Command Architecture
description: Frontend shell layout, state management, and routing for the Jarvis Command Centre app.
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
- Orb portal: `src/components/orb/JarvisOrbPortal.tsx` → `createPortal(document.body)`

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

## Zustand v5 selector rule — CRITICAL
Never use object-returning selectors — applies to EVERY component at EVERY nesting level (sub-components like Bubble, TaskRunCard, CommandBar etc. are just as affected as top-level components). They break React's getSnapshot contract and cause infinite loops.
```typescript
// CORRECT — one call per value:
const orbStatus    = useJarvisStore(s => s.orbStatus);
const setOrbStatus = useJarvisStore(s => s.setOrbStatus);

// WRONG — new object every render → "Maximum update depth exceeded":
const { orbStatus } = useJarvisStore(s => ({ orbStatus: s.orbStatus }));
```
`useShallow` from `zustand/shallow` is the comparison function, NOT a hook. The hook lives in `zustand/react/shallow` but individual selectors are simpler and always correct. When this bug hits, grep ALL components in the changed files — not just the top-level one named in the React error.

## CSS
- Global Jarvis styles: `src/index.css`
- Orb-specific styles: `src/components/orb/orb.css`
- Web Speech API global types: `src/types/speech.d.ts`
