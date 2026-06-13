import { useState } from 'react';
import { Play, Clock, Zap } from 'lucide-react';

interface Automation {
  id: string;
  name: string;
  trigger: string;
  description: string;
  status: 'Active' | 'Disabled';
  lastExecution: string;
}

const MOCK_AUTOMATIONS: Automation[] = [
  { id: '1', name: 'Morning Digest', trigger: 'schedule:07:00', description: 'Daily briefing from emails, calendar, and news', status: 'Active', lastExecution: new Date(Date.now() - 3600 * 1000 * 14).toISOString() },
  { id: '2', name: 'Memory Auto-Index', trigger: 'schedule:22:00', description: 'Index new documents added to watched folders', status: 'Active', lastExecution: new Date(Date.now() - 3600 * 1000 * 2).toISOString() },
  { id: '3', name: 'Slack Digest', trigger: 'channel:slack', description: 'Summarise unread Slack messages every hour', status: 'Disabled', lastExecution: new Date(Date.now() - 3600 * 1000 * 48).toISOString() },
];

export default function Automations() {
  const [automations, setAutomations] = useState<Automation[]>(MOCK_AUTOMATIONS);
  const [running, setRunning] = useState<string | null>(null);

  const toggle = (id: string) => {
    setAutomations(a => a.map(au =>
      au.id === id ? { ...au, status: au.status === 'Active' ? 'Disabled' : 'Active' } : au
    ));
  };

  const run = async (id: string) => {
    setRunning(id);
    await new Promise(r => setTimeout(r, 1500));
    setRunning(null);
    setAutomations(a => a.map(au => au.id === id ? { ...au, lastExecution: new Date().toISOString() } : au));
  };

  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Automations</h1>
          <p>Scheduled and event-driven agent workflows</p>
        </div>
        <button className="j-btn j-btn-primary">+ New Automation</button>
      </div>
      <div className="j-page-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {automations.map(auto => (
            <div key={auto.id} className="j-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{auto.name}</span>
                  <span className={`j-badge ${auto.status === 'Active' ? 'j-badge-green' : 'j-badge-gray'}`}>{auto.status}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#58a6ff', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Zap style={{ width: 10, height: 10 }} />{auto.trigger}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#8b949e', margin: 0 }}>{auto.description}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#484f58', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock style={{ width: 10, height: 10 }} />
                  {new Date(auto.lastExecution).toLocaleDateString()}
                </span>
                <button
                  onClick={() => toggle(auto.id)}
                  style={{
                    width: 36, height: 20, borderRadius: 10,
                    background: auto.status === 'Active' ? 'rgba(63,185,80,0.2)' : '#21262d',
                    border: `1px solid ${auto.status === 'Active' ? '#3fb950' : '#30363d'}`,
                    cursor: 'pointer', padding: 0, position: 'relative',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2,
                    left: auto.status === 'Active' ? 16 : 2,
                    width: 14, height: 14, borderRadius: '50%',
                    background: auto.status === 'Active' ? '#3fb950' : '#484f58',
                    transition: 'left 0.15s',
                  }} />
                </button>
                <button
                  onClick={() => run(auto.id)}
                  disabled={running === auto.id || auto.status !== 'Active'}
                  className="j-btn j-btn-primary"
                  style={{ height: 28, fontSize: 12, padding: '0 12px' }}
                >
                  <Play style={{ width: 12, height: 12 }} />
                  {running === auto.id ? 'Running…' : 'Run'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
