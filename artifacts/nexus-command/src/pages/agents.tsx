import { useJarvisAgents } from '@/hooks/useJarvis';
import { useJarvisStore, type AgentType } from '@/store/jarvisStore';

const AGENT_META: Record<string, { desc: string; badge: string }> = {
  simple:         { desc: 'Single-turn chat with tool use', badge: 'j-badge-blue' },
  orchestrator:   { desc: 'Multi-step planning and delegation', badge: 'j-badge-purple' },
  deep_research:  { desc: 'Extended research with web retrieval', badge: 'j-badge-amber' },
  morning_digest: { desc: 'Scheduled summary of overnight activity', badge: 'j-badge-green' },
  code_assistant: { desc: 'Code review, generation, and debugging', badge: 'j-badge-blue' },
  channel_agent:  { desc: 'Monitors and responds on messaging channels', badge: 'j-badge-gray' },
  proactive_agent:{ desc: 'Background monitoring with scheduled alerts', badge: 'j-badge-amber' },
  operative:      { desc: 'Autonomous multi-tool task execution', badge: 'j-badge-red' },
};

export default function Agents() {
  const { data: agents, isLoading } = useJarvisAgents();
  const { setActiveModule, setSelectedAgent } = useJarvisStore();

  const launch = (id: string) => {
    setSelectedAgent(id as AgentType);
    setActiveModule('chat');
  };

  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Agents</h1>
          <p>Eight built-in reasoning patterns</p>
        </div>
      </div>
      <div className="j-page-content">
        <div className="j-grid-3">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="j-skeleton" style={{ height: 120 }} />
              ))
            : (agents ?? []).map(id => {
                const meta = AGENT_META[id] ?? { desc: 'Jarvis reasoning agent', badge: 'j-badge-gray' };
                return (
                  <div key={id} className="j-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                        {id.replace(/_/g, '_\u200B')}
                      </span>
                      <span className={`j-badge ${meta.badge}`}>{id.split('_')[0]}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#8b949e', margin: 0, flex: 1 }}>{meta.desc}</p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => launch(id)}
                        className="j-btn j-btn-primary"
                        style={{ height: 28, fontSize: 12, flex: 1 }}
                      >
                        ▶ Launch
                      </button>
                      <button className="j-btn" style={{ height: 28, fontSize: 12 }}>⏱ Schedule</button>
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>
    </div>
  );
}
