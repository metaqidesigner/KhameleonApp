import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Copy, ChevronDown } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { getRoster, streamAgentChat, FALLBACK_ROSTER, STATUS_COLOR, type AgentConfig, type ChatMessage } from '@/lib/agentsApi';

interface Message { role: 'user' | 'assistant'; content: string; agentId?: string; latencyMs?: number; tokens?: number; costUsd?: number; }

export default function AgentChat() {
  const [roster, setRoster] = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [agentId, setAgentId] = useState('claude');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getRoster().then(r => { setRoster(r); }).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const agent = roster.find(a => a.id === agentId) ?? roster[0];

  function send() {
    if (!input.trim() || streaming) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const chatHistory: ChatMessage[] = [...messages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: userMsg.content }];
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', agentId }]);
    setInput('');
    setStreaming(true);

    const stop = streamAgentChat(
      agentId,
      chatHistory,
      (token) => setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last) next[next.length - 1] = { ...last, content: last.content + token };
        return next;
      }),
      (done) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last) next[next.length - 1] = { ...last, latencyMs: done.latencyMs, tokens: done.tokens, costUsd: done.costUsd };
          return next;
        });
        setStreaming(false);
      },
      (_err) => setStreaming(false),
    );
    stopRef.current = stop;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 6 }}>
      {/* agent picker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(0,4,12,0.8)', border: '1px solid rgba(0,212,255,0.12)', position: 'relative' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: agent?.color ?? '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--j-font-head)', fontSize: 10, fontWeight: 700, color: '#000' }}>
          {agent?.initials ?? '?'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--j-font-head)', fontSize: 12, color: '#fff', letterSpacing: '0.08em' }}>{agent?.name ?? '—'}</div>
          <div className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-muted)' }}>{agent?.model ?? '—'}</div>
        </div>
        <button className="j-btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 9 }} onClick={() => setShowPicker(p => !p)}>
          SWITCH <ChevronDown size={9} />
        </button>
        {showPicker && (
          <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, background: 'rgba(0,4,12,0.97)', border: '1px solid rgba(0,212,255,0.25)', minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
            {roster.map(a => (
              <div key={a.id}
                onClick={() => { setAgentId(a.id); setShowPicker(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', background: a.id === agentId ? 'rgba(0,212,255,0.08)' : 'transparent', borderBottom: '1px solid rgba(0,212,255,0.05)' }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR.standby, flexShrink: 0 }} />
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--j-font-head)', fontSize: 9, fontWeight: 700, color: '#000' }}>{a.initials}</div>
                <div>
                  <div style={{ fontFamily: 'var(--j-font-head)', fontSize: 11, color: '#fff' }}>{a.name}</div>
                  <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-muted)' }}>{a.model}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }} className="scrollbar-jarvis">
        {messages.length === 0 ? (
          <div className="j-empty" style={{ margin: 'auto' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: agent?.color ?? '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--j-font-head)', fontSize: 16, fontWeight: 700, color: '#000' }}>{agent?.initials ?? '?'}</div>
            DIRECT CHANNEL TO {agent?.name ?? 'AGENT'} — SEND A MESSAGE
          </div>
        ) : messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 3 }}>
            <div style={{ maxWidth: '82%', padding: '8px 12px', background: msg.role === 'user' ? 'rgba(192,21,42,0.12)' : 'rgba(0,212,255,0.05)', border: `1px solid ${msg.role === 'user' ? 'rgba(192,21,42,0.3)' : 'rgba(0,212,255,0.15)'}`, fontFamily: msg.role === 'user' ? 'var(--j-font-ui)' : 'var(--j-font-mono)', fontSize: 12, color: 'var(--j-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {msg.content}
              {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                <span style={{ display: 'inline-block', width: 2, height: 12, background: 'var(--j-cyan)', marginLeft: 2, animation: 'jarvis-blink 1s infinite' }} />
              )}
            </div>
            {msg.role === 'assistant' && msg.latencyMs && (
              <div style={{ display: 'flex', gap: 8 }} className="j-mono">
                {[`${msg.latencyMs}ms`, msg.tokens ? `${msg.tokens} tok` : '', msg.costUsd ? `$${msg.costUsd.toFixed(5)}` : ''].filter(Boolean).map((v, vi) => (
                  <span key={vi} style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>{v}</span>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="j-btn-ghost" style={{ height: 36, width: 36, padding: 0, flexShrink: 0 }} onClick={() => setMessages([])}>
          <Trash2 size={13} />
        </button>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={`Message ${agent?.name ?? 'agent'}...`}
          style={{ flex: 1, height: 36, padding: '8px 12px', background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--j-text)', fontFamily: 'var(--j-font-mono)', fontSize: 12, resize: 'none', outline: 'none' }}
        />
        {streaming ? (
          <button className="j-btn-ghost" style={{ height: 36, width: 36, padding: 0, flexShrink: 0, borderColor: 'rgba(192,21,42,0.4)' }} onClick={() => stopRef.current?.()}>
            <span style={{ width: 10, height: 10, background: 'var(--j-red)', display: 'block' }} />
          </button>
        ) : (
          <button className="j-btn-primary" style={{ height: 36, width: 36, padding: 0, flexShrink: 0 }} onClick={send} disabled={!input.trim()}>
            <Send size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
