import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Send, Plus } from 'lucide-react';
import { marked } from 'marked';
import { useJarvisStore, type AgentType } from '@/store/jarvisStore';
import { streamChat } from '@/lib/jarvisApi';
import { useJarvisHealth } from '@/hooks/useJarvis';

const AGENTS: { id: AgentType; label: string }[] = [
  { id: 'simple',         label: 'Simple' },
  { id: 'orchestrator',   label: 'Orchestrator' },
  { id: 'deep_research',  label: 'Research' },
  { id: 'code_assistant', label: 'Code' },
  { id: 'morning_digest', label: 'Morning Digest' },
];

function fmt(v: number | undefined, d = 0, suf = '') {
  if (v === undefined) return null;
  return v.toFixed(d) + suf;
}

export default function Chat() {
  const {
    chatSessions, activeSessionId, selectedAgent,
    setSelectedAgent, appendMessage, setStreaming,
    isStreaming, pushAgentEvent, newSession, setActiveSession, activeModule,
  } = useJarvisStore();
  const { data: health } = useJarvisHealth();

  const [input, setInput] = useState('');
  const [showSessions, setShowSessions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const activeSession = chatSessions.find(s => s.id === activeSessionId) ?? chatSessions[0];
  const isOffline = health?.status !== 'online';

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages?.length]);

  const send = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: text,
      timestamp: Date.now(),
    };
    appendMessage(activeSession.id, userMsg);
    setStreaming(true);

    const aiId = crypto.randomUUID();
    appendMessage(activeSession.id, { id: aiId, role: 'assistant', content: '', timestamp: Date.now() });

    let acc = '';
    const t0 = Date.now();
    cleanupRef.current = streamChat(
      text, selectedAgent,
      (token) => {
        acc += token;
        useJarvisStore.setState(st => ({
          chatSessions: st.chatSessions.map(s =>
            s.id === activeSession.id
              ? { ...s, messages: s.messages.map(m => m.id === aiId ? { ...m, content: acc } : m) }
              : s
          ),
        }));
      },
      (payload) => {
        setStreaming(false);
        useJarvisStore.setState(st => ({
          chatSessions: st.chatSessions.map(s =>
            s.id === activeSession.id
              ? { ...s, messages: s.messages.map(m =>
                  m.id === aiId
                    ? { ...m, content: acc, model: payload.model ?? undefined, latencyMs: payload.latency_ms, tokens: payload.tokens, costUsd: payload.cost_usd, energyWh: payload.energy_wh }
                    : m
                )}
              : s
          ),
        }));
        pushAgentEvent({
          id: crypto.randomUUID(), prompt: text, response: acc,
          model: payload.model ?? 'unknown', agent: selectedAgent,
          ts: t0, durationMs: Date.now() - t0,
        });
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [input]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Session sidebar */}
      {showSessions && (
        <div style={{
          width: 200, flexShrink: 0,
          borderRight: '1px solid #30363d',
          display: 'flex', flexDirection: 'column',
          background: '#0d1117',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', borderBottom: '1px solid #30363d',
          }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sessions</span>
            <button
              onClick={() => { const id = newSession(selectedAgent); setActiveSession(id); }}
              style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <Plus style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }} className="scrollbar-thin">
            {chatSessions.map(s => {
              const first = s.messages.find(m => m.role === 'user');
              const label = first ? first.content.slice(0, 28) + (first.content.length > 28 ? '…' : '') : 'New session';
              const active = s.id === activeSessionId;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSession(s.id)}
                  style={{
                    width: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-start', gap: 2,
                    padding: '8px 12px',
                    background: active ? '#21262d' : 'none',
                    border: 'none',
                    borderLeft: active ? '2px solid #58a6ff' : '2px solid transparent',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 12, color: active ? '#e6edf3' : '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', whiteSpace: 'nowrap' }}>{label}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#484f58' }}>{new Date(s.createdAt).toLocaleTimeString()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Offline banner */}
        {isOffline && (
          <div style={{
            padding: '8px 16px', background: 'rgba(248,81,73,0.1)',
            borderBottom: '1px solid rgba(248,81,73,0.3)',
            fontSize: 12, fontFamily: 'var(--font-mono)', color: '#f85149',
          }}>
            Backend offline — run <code style={{ background: '#21262d', padding: '0 4px', borderRadius: 3 }}>jarvis serve</code> or configure API keys in Settings
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }} className="scrollbar-thin">
          {activeSession?.messages.length === 0 && (
            <div className="j-empty" style={{ marginTop: 60 }}>
              <span style={{ fontSize: 16 }}>⬡</span>
              <span>Ask Jarvis anything</span>
              <span style={{ fontSize: 11, color: '#484f58' }}>⌘K for quick commands · Shift+Enter for newline</span>
            </div>
          )}
          {(activeSession?.messages ?? []).map((msg, i) => {
            const isUser = msg.role === 'user';
            const isLast = i === (activeSession?.messages.length ?? 0) - 1;
            const isStreaming_ = isLast && !isUser && isStreaming;

            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
                <div style={{
                  maxWidth: '80%',
                  padding: isUser ? '8px 12px' : '0',
                  background: isUser ? '#21262d' : 'transparent',
                  border: isUser ? '1px solid #30363d' : 'none',
                  borderLeft: isUser ? undefined : '2px solid #58a6ff',
                  paddingLeft: isUser ? undefined : 12,
                  borderRadius: isUser ? '6px 6px 0 6px' : 0,
                }}>
                  {isUser ? (
                    <span style={{ fontSize: 13, color: '#e6edf3' }}>{msg.content}</span>
                  ) : (
                    <div
                      className="j-prose"
                      dangerouslySetInnerHTML={{ __html: marked.parse(msg.content || '') as string }}
                    />
                  )}
                  {isStreaming_ && (
                    <span style={{ display: 'inline-block', width: 8, height: 14, background: '#58a6ff', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'blink 1s step-end infinite' }} />
                  )}
                </div>

                {/* Message metadata */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#484f58' }}>
                  <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  {msg.agentType && <span className="j-badge j-badge-purple">{msg.agentType}</span>}
                  {!isUser && msg.model && (
                    <>
                      <span>·</span>
                      <span>{msg.model}</span>
                      {msg.latencyMs && <><span>·</span><span>{msg.latencyMs}ms</span></>}
                      {msg.tokens   && <><span>·</span><span>{msg.tokens} tok</span></>}
                      {msg.costUsd !== undefined && <><span>·</span><span>${msg.costUsd.toFixed(4)}</span></>}
                      {msg.energyWh !== undefined && <><span>·</span><span>{msg.energyWh.toFixed(3)} Wh</span></>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{ borderTop: '1px solid #30363d', background: '#161b22', padding: '10px 16px', flexShrink: 0 }}>
          {/* Agent selector */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {AGENTS.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedAgent(a.id)}
                className={`j-pill ${selectedAgent === a.id ? 'j-pill-active' : ''}`}
              >
                {a.label}
              </button>
            ))}
            <button
              onClick={() => setShowSessions(v => !v)}
              className="j-pill"
              style={{ marginLeft: 'auto', color: '#484f58' }}
            >
              {showSessions ? 'hide sessions' : 'sessions'}
            </button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Jarvis..."
            rows={1}
            style={{
              width: '100%', background: 'transparent', border: 'none',
              outline: 'none', resize: 'none', color: '#e6edf3',
              fontSize: 13, fontFamily: 'var(--font-ui)',
              lineHeight: 1.5, maxHeight: 200, overflow: 'auto',
            }}
          />

          {/* Bottom row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#484f58' }}>
              {input.length > 0 && `${input.length} chars`}
            </span>
            <button
              onClick={send}
              disabled={!input.trim() || isStreaming}
              className="j-btn j-btn-primary"
              style={{ height: 28, padding: '0 14px' }}
            >
              <Send style={{ width: 13, height: 13 }} />
              {isStreaming ? 'Streaming…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
