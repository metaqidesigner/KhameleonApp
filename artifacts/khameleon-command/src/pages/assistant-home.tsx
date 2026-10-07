import { CommandWall } from '@/components/liveWall/CommandWall';

/**
 * The "Assistant" tab — now the "Live Wall" design ported from the
 * Replit design project's CommandWall.tsx (see that component's own
 * header comment for exactly what's real vs. what stayed decorative).
 * "Workspace" (the existing free-floating multi-window canvas) stays a
 * separate, unmodified tab, switched via pages/home.tsx.
 */
export function AssistantHome() {
  return <CommandWall />;
}

export default AssistantHome;
