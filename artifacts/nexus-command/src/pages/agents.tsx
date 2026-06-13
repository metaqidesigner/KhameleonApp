import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Zap, Brain, Code, Radio, Cpu, Eye, Network, Send, X } from 'lucide-react';
import { useJarvisAgents } from '@/hooks/useJarvis';
import { streamChat } from '@/lib/jarvisApi';
import { useNexusStore } from '@/store/nexusStore';
import { marked } from 'marked';

const AGENT_META: Record<string, { icon: React.FC<{ style?: React.CSSProperties }>, color: string, glow: string, description: string }> = {
  simple:          { icon: Bot,     color: '#00d4ff', glow: '0,212,255',   description: 'Fast single-turn responses. Best for quick questions and lookups.' },
  orchestrator:    { icon: Network, color: '#a855f7', glow: '168,85,247',  description: 'Coordinates multiple agents to solve complex, multi-step problems.' },
  deep_research:   { icon: Brain,   color: '#38bdf8', glow: '56,189,248',  description: 'Performs thorough web research and synthesises a detailed report.' },
  morning_digest:  { icon: Zap,     color: '#c9a84c', glow: '201,168,76',  description: 'Summarises your day — calendar, emails, tasks, and priorities.' },
  code_assistant:  { icon: Code,    color: '#10b981', glow: '16,185,129',  description: 'Writes, reviews, and debugs code across all major languages.' },
  channel_agent:   { icon: Radio,   color: '#38bdf8', glow: '56,189,248',  description: 'Monitors and responds across communication channels.' },
  proactive_agent: { icon: Eye,     color: '#f59e0b', glow: '245,158,11',  description: 'Autonomously watches for events and triggers actions.' },
  operative:       { icon: Cpu,     color: '#ef4444', glow: '239,68,68',   description: 'Executes complex tool chains with full system access.' },
};

function AgentChat({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string; model?: string }[]>([]);
  const [input, setInput] = useState('');
  const { isStreaming, setStreaming, pushAgentEvent } = useNexusStore();

  const send = () => {
    if (!input.trim() || isStreaming) return;
    const prompt = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', text: prompt }]);
    setStreaming(true);
    let acc = '';
    setMessages(m => [...m, { role: 'ai', text: '' }]);
    const ts = Date.now();
    const cleanup = streamChat(prompt, agentId,
      (token) => { acc += token; setMessages(m => { const copy = [...m]; copy[copy.length - 1] = { role: 'ai', text: acc }; return copy; }); },
      (model) => {
        setStreaming(false);
        setMessages(m => { const copy = [...m]; copy[copy.length - 1] = { role: 'ai', text: acc, model: model ?? undefined }; return copy; });
        pushAgentEvent({ id: crypto.randomUUID(), prompt, response: acc, model: model ?? 'unknown', agent: agentId, ts, durationMs: Date.now() - ts });
        cleanup();
      },
    );
  };

  return (
    <div style={{ marginTop: 16, background: 'rgba(0,10,20,0.6)', border: '1px solid rgba(0,212,255,0.12)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(0,212,255,0.08)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.1em' }}>CHAT · {agentId.toUpperCase()}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(200,220,240,0.5)', cursor: 'pointer', padding: 4 }}><X style={{ width: 14, height: 14 }} /></button>
      </div>
      <div style={{ minHeight: 120, maxHeight: 260, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }} className="scrollbar-hide">
        {messages.length === 0 && <div style={{ color: 'rgba(130,170,200,0.4)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Send a message to start…</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '82%', padding: '9px 13px', borderRadius: 10,
              background: m.role === 'user' ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${m.role === 'user' ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.07)'}`,
              fontSize: 12, color: 'rgba(210,235,250,0.9)', lineHeight: 1.55,
            }}>
              {m.role === 'ai' ? <div className="nexus-prose" dangerouslySetInnerHTML={{ __html: marked.parse(m.text) as string }} style={{ fontSize: 12 }} /> : m.text}
              {m.model && <div style={{ fontSize: 9.5, color: 'rgba(0,212,255,0.35)', marginTop: 5, fontFamily: 'var(--font-mono)' }}>{m.model}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(0,212,255,0.08)', display: 'flex', gap: 8 }}>
        <input className="nexus-input" style={{ fontSize: 12, padding: '7px 12px' }} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} disabled={isStreaming} placeholder="Ask this agent…" />
        <button className="nexus-btn" style={{ padding: '7px 14px', flexShrink: 0 }} onClick={send} disabled={isStreaming || !input.trim()}>
          <Send style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </div>
  );
}

export default function Agents() {
  const { data: agents, isLoading } = useJarvisAgents();
  const [openChat, setOpenChat] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#00d4ff', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>AI Agents</h2>
        <p style={{ fontSize: 12, color: 'rgba(130,170,200,0.55)', lineHeight: 1.5 }}>Launch any Jarvis agent type. Each agent has specialised capabilities for different tasks.</p>
      </div>

      {isLoading ? (
        <div className="nexus-grid-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="nexus-card nexus-shimmer" style={{ height: 130 }} />)}</div>
      ) : (
        <div className="nexus-grid-2">
          {(agents ?? []).map((agentId, i) => {
            const meta = AGENT_META[agentId] ?? { icon: Bot, color: '#00d4ff', glow: '0,212,255', description: 'General purpose agent.' };
            const { icon: Icon } = meta;
            const isOpen = openChat === agentId;
            return (
              <motion.div key={agentId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="nexus-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: `rgba(${meta.glow},0.12)`, border: `1px solid rgba(${meta.glow},0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon style={{ width: 17, height: 17, color: meta.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(220,240,255,0.95)', letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>{agentId.replace(/_/g, ' ').toUpperCase()}</div>
                      <div style={{ fontSize: 11, color: 'rgba(130,170,200,0.6)', marginTop: 3, lineHeight: 1.4 }}>{meta.description}</div>
                    </div>
                  </div>
                  <button className="nexus-btn" style={{ flexShrink: 0, padding: '6px 14px', fontSize: 11, borderColor: `rgba(${meta.glow},0.4)`, color: meta.color, background: `rgba(${meta.glow},0.1)` }}
                    onClick={() => setOpenChat(isOpen ? null : agentId)}>
                    {isOpen ? 'Close' : 'Launch'}
                  </button>
                </div>
                {isOpen && <AgentChat agentId={agentId} onClose={() => setOpenChat(null)} />}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
