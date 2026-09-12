import { useState } from 'react';
import UnifiedCanvas from './canvas';
import { AssistantHome } from './assistant-home';

/**
 * The 'canvas' tab's actual page — a thin switcher between the two home
 * views the mockup's own nav-tabs named: "Assistant" (assistant-home.tsx,
 * the hero-orb build of khameleon-home-implemented.html) and "Workspace"
 * (canvas.tsx, the existing free-floating multi-window layout, unchanged).
 * Local state, not the global activeTab store — this is a sub-choice
 * within one destination, not a new top-level nav item.
 */
export default function Home() {
  const [view, setView] = useState<'assistant' | 'workspace'>('assistant');

  return (
    <div className="kh-home-wrap">
      <div className="kh-home-tabs">
        <button
          type="button"
          className={`kh-home-tab${view === 'assistant' ? ' active' : ''}`}
          onClick={() => setView('assistant')}
        >
          Assistant
        </button>
        <button
          type="button"
          className={`kh-home-tab${view === 'workspace' ? ' active' : ''}`}
          onClick={() => setView('workspace')}
        >
          Workspace
        </button>
      </div>
      <div className="kh-home-body">
        {view === 'assistant' ? <AssistantHome /> : <UnifiedCanvas />}
      </div>
    </div>
  );
}
