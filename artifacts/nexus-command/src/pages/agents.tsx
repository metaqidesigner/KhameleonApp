import React, { useState } from 'react';
import Roster from './agents/Roster';
import AgentChat from './agents/AgentChat';
import MultiAgent from './agents/MultiAgent';
import Compare from './agents/Compare';
import Council from './agents/Council';
import AgentSettings from './agents/AgentSettings';

type AgentSubTab = 'roster' | 'chat' | 'multi' | 'compare' | 'council' | 'settings';

const SUB_TABS: { id: AgentSubTab; label: string }[] = [
  { id: 'roster',   label: 'ROSTER'      },
  { id: 'chat',     label: 'CHAT'        },
  { id: 'multi',    label: 'MULTI-AGENT' },
  { id: 'compare',  label: 'COMPARE'     },
  { id: 'council',  label: 'COUNCIL'     },
  { id: 'settings', label: 'SETTINGS'    },
];

export default function Agents() {
  const [subTab, setSubTab] = useState<AgentSubTab>('roster');
  const [chatAgentId, setChatAgentId] = useState<string>('claude');

  function handleSelectAgent(id: string) {
    if (id !== '__new__') setChatAgentId(id);
    setSubTab(id === '__new__' ? 'settings' : 'chat');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* sub-nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px', background: 'rgba(0,4,12,0.6)', borderBottom: '1px solid rgba(0,212,255,0.1)', flexShrink: 0 }}>
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              padding: '4px 12px',
              fontFamily: 'var(--j-font-ui)',
              fontSize: 10,
              letterSpacing: '0.08em',
              color: subTab === t.id ? 'var(--j-cyan)' : 'var(--j-text-muted)',
              background: subTab === t.id ? 'rgba(0,212,255,0.08)' : 'transparent',
              border: 'none',
              borderBottom: subTab === t.id ? '2px solid var(--j-cyan)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
              height: 28,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {subTab === 'roster'   && <Roster   onSelectAgent={handleSelectAgent} />}
        {subTab === 'chat'     && <AgentChat key={chatAgentId} />}
        {subTab === 'multi'    && <MultiAgent />}
        {subTab === 'compare'  && <Compare />}
        {subTab === 'council'  && <Council />}
        {subTab === 'settings' && <AgentSettings />}
      </div>
    </div>
  );
}
