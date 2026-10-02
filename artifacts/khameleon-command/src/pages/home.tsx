import { AssistantHome } from './assistant-home';

/**
 * The 'canvas' tab's page. Used to switch between "Assistant" (the Live
 * Wall) and "Workspace" (canvas.tsx's older free-floating multi-window
 * layout) - Workspace was removed per Newton's request (2026-10-01) so
 * every visit to this tab is the Live Wall directly, no sub-switcher.
 * canvas.tsx itself is untouched - still used for its shared constants
 * (FocusRing, DAY_SECTIONS) and the unreachable dashboard.tsx re-export.
 */
export default function Home() {
  return <AssistantHome />;
}
