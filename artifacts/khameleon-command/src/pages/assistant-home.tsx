import { AssistantCard } from '@/components/AssistantCard';
import { ActiveTaskWindow } from '@/components/ActiveTaskWindow';
import { SignalGlassTile } from '@/components/SignalGlassTile';
import { TodaysFocusPanel } from '@/components/TodaysFocusPanel';
import { ActivityFilmstrip } from '@/components/ActivityFilmstrip';
import { ConnectedToolsRow } from '@/components/ConnectedToolsRow';
import { PILLS } from '@/pages/canvas';
import { useJarvisStore } from '@/store/jarvisStore';

/**
 * The "Assistant" tab — a faithful build of khameleon-home-implemented.html
 * (the approved reference mockup), with every slot wired to real data
 * instead of the mockup's fixed placeholders:
 *   - mini-col      → the same live Command/Context/Status tiles as Workspace
 *   - center        → the real chat+orb (AssistantCard), replaced by the
 *                     real live task trace (ActiveTaskWindow) the moment a
 *                     task is actually running — design-spec.md §6/§7's
 *                     "actively processing gets frontmost priority" rule
 *   - right column  → TodaysFocusPanel, reading the real /tasks/daily feed
 *   - filmstrip     → ActivityFilmstrip, the five most recently touched
 *                     real tasks
 * "Workspace" (the existing free-floating multi-window canvas) stays a
 * separate, unmodified tab — this page doesn't replace it, it sits
 * alongside it, matching the mockup's own "Assistant | Workspace" tabs.
 */
export function AssistantHome() {
  const activeTaskIds = useJarvisStore(s => s.activeTaskIds);
  const hasActiveTask = activeTaskIds.length > 0;

  return (
    <div className="kh-home scrollbar-jarvis">
      <div className="kh-flare kh-flare-teal" />
      <div className="kh-flare kh-flare-amber" />

      <div className="kh-layout">
        <div className="kh-mini-col">
          {PILLS.map(pill => (
            <SignalGlassTile key={pill.id} {...pill} />
          ))}
        </div>

        <div className="kh-center-col">
          <ActiveTaskWindow />
        </div>

        <TodaysFocusPanel />
      </div>

      <ActivityFilmstrip />

      {/* Not part of the grid above - a fixed overlay pinned to the
          viewport's bottom-right corner, sitting over the mini-col/
          filmstrip rather than sharing column space with them. Only
          the idle hero; once a task is actually running, ActiveTaskWindow
          (in the grid) takes the spotlight instead. */}
      {!hasActiveTask && (
        <div className="kh-hero-overlay">
          <AssistantCard />
          <ConnectedToolsRow />
        </div>
      )}
    </div>
  );
}

export default AssistantHome;
