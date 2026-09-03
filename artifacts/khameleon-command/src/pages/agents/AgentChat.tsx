import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, ChevronDown, Wrench, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import JPanel from '@/components/JPanel';
import {
  getRoster, streamAgentChat, FALLBACK_ROSTER, STATUS_COLOR,
  type AgentConfig, type ChatMessage, type ToolEvent,
} from '@/lib/agentsApi';

// ── Message types ─────────────────────────────────────────────
type MsgRole = 'user' | 'assistant' | 'tool_event';

interface Message {
  role: MsgRole;
  content: string;
  agentId?: string;
  latencyMs?: number;
  tokens?: number;
  costUsd?: number;
  toolEvent?: ToolEvent;
  isError?: boolean;
}

// ── Tool event bubble ─────────────────────────────────────────
function ToolEventBubble({ event }: { event: ToolEvent }) {
  const [expanded, setExpanded] = useState(false);
  const isStart  = event.type === 'tool_start';
  const isResult = event.type === 'tool_result';
  const isError  = event.type === 'tool_error';

  const iconColor = isError ? 'var(--j-red)' : isResult ? 'var(--j-green)' : '#c9a84c';
  const icon = isError
    ? <XCircle size={11} />
    : isResult
      ? <CheckCircle2 size={11} />
      : <Loader2 size={11} style={{ animation: 'jarvis-spin 1s linear infinite' }} />;

  const label = isStart
    ? `Calling ${event.name}…`
    : isResult
      ? `${event.name} → ${event.durationMs}ms`
      : `${event.name} failed`;

  return (
    <div
      onClick={() => (isResult || isError) && setExpanded(e => !e)}
      style={{
        display: 'inline-flex', flexDirection: 'column', gap: 3, maxWidth: '75%',
        padding: '5px 10px',
        background: `color-mix(in srgb, ${iconColor} 5%, transparent)`,
        border: `1px solid color-mix(in srgb, ${iconColor} 22%, transparent)`,
        cursor: (isResult || isError) ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: iconColor, display: 'flex', alignItems: 'center' }}>{icon}</span>
        <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-muted)', letterSpacing: '0.06em' }}>
          {label}
        </span>
        {(isResult || isError) && (
          <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', marginLeft: 'auto' }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {expanded && isResult && event.result && (
        <pre style={{
          margin: 0, padding: '6px 8px',
          fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text)',
          background: 'rgba(0,4,12,0.6)', border: '1px solid rgba(0,212,255,0.1)',
          maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {event.result}
        </pre>
      )}
      {expanded && isError && event.error && (
        <pre style={{
          margin: 0, padding: '6px 8px',
          fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-red)',
          background: 'rgba(192,21,42,0.06)', border: '1px solid rgba(192,21,42,0.15)',
          maxHeight: 120, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {event.error}
        </pre>
      )}
      {isStart && event.input && Object.keys(event.input).length > 0 && (
        <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', paddingLeft: 4 }}>
          {Object.entries(event.input).map(([k, v]) => (
            <span key={k} style={{ marginRight: 8 }}>
              {k}={String(v).slice(0, 40)}{String(v).length > 40 ? '…' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function AgentChat() {
  const [roster,     setRoster]    = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [agentId,    setAgentId]   = useState('claude');
  const [messages,   setMessages]  = useState<Message[]>([]);
  const [input,      setInput]     = useState('');
  const [streaming,  setStreaming] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const stopRef      = useRef<(() => void) | null>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getRoster().then(r => setRoster(r)).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const agent = roster.find(a => a.id === agentId) ?? roster[0];

  function send() {
    if (!input.trim() || streaming) return;
    const userMsg: Message = { role: 'user', content: input.trim() };

    // Build chat history (skip tool_event bubbles — they're display only)
    const chatHistory: ChatMessage[] = [
      ...messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userMsg.content },
    ];

    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', agentId }]);
    setInput('');
    setStreaming(true);

    const stop = streamAgentChat(
      agentId,
      chatHistory,
      // onToken
      (token) => setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = { ...last, content: last.content + token };
        }
        return next;
      }),
      // onDone
      (done) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, latencyMs: done.latencyMs, tokens: done.tokens, costUsd: done.costUsd };
          }
          return next;
        });
        // Persist session ID for conversation continuity
        if (done.sessionId) sessionIdRef.current = done.sessionId;
        setStreaming(false);
      },
      // onError — streamAgentChat swallowed this into a silent
      // setStreaming(false) before: the assistant bubble pushed at the
      // start of send() would stay empty forever with no indication
      // anything had gone wrong. Fill it with the real error instead.
      (err) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: `Failed to get a response: ${err}`, isError: true };
          }
          return next;
        });
        setStreaming(false);
      },
      // onToolEvent — insert a tool_event bubble *before* the streaming assistant message
      (event) => setMessages(prev => {
        // Insert tool event bubble just before the last (streaming) assistant message
        const idx = prev.length - 1;
        const bubble: Message = { role: 'tool_event', content: '', toolEvent: event };
        return [...prev.slice(0, idx), bubble, prev[idx]];
      }),
      // sessionId — continue the current session if we have one
      sessionIdRef.current,
    );
    stopRef.current = stop;
  }

  function clearChat() {
    setMessages([]);
    sessionIdRef.current = undefined;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 6 }}>

      {/* ── Agent picker ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(0,4,12,0.8)', border: '1px solid rgba(0,212,255,0.12)', position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: agent?.color ?? '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 700, color: '#000' }}>
          {agent?.initials ?? '?'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#fff', letterSpacing: '0.08em' }}>{agent?.name ?? '—'}</span>
            {agent?.useTools && (
              <span title="Tool-use enabled" style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#c9a84c', fontSize: 8 }}>
                <Wrench size={9} /> TOOLS
              </span>
            )}
          </div>
          <div className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-muted)' }}>{agent?.model ?? '—'}</div>
        </div>
        <button className="j-btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 9 }} onClick={() => setShowPicker(p => !p)}>
          SWITCH <ChevronDown size={9} />
        </button>

        {showPicker && (
          <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, background: 'rgba(0,4,12,0.97)', border: '1px solid rgba(0,212,255,0.25)', minWidth: 210, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
            {roster.map(a => (
              <div key={a.id}
                onClick={() => { setAgentId(a.id); setShowPicker(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', background: a.id === agentId ? 'rgba(0,212,255,0.08)' : 'transparent', borderBottom: '1px solid rgba(0,212,255,0.05)' }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR.standby, flexShrink: 0 }} />
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--j-font-ui)', fontSize: 9, fontWeight: 700, color: '#000' }}>{a.initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: '#fff' }}>{a.name}</span>
                    {a.useTools && <Wrench size={8} style={{ color: '#c9a84c' }} />}
                  </div>
                  <div className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-muted)' }}>{a.model}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Message list ── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }} className="scrollbar-jarvis">
        {messages.length === 0 ? (
          <div className="j-empty" style={{ margin: 'auto', flexDirection: 'column', gap: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: agent?.color ?? '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--j-font-ui)', fontSize: 16, fontWeight: 700, color: '#000' }}>
              {agent?.initials ?? '?'}
            </div>
            <span>DIRECT CHANNEL TO {agent?.name ?? 'AGENT'}</span>
            {agent?.useTools && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#c9a84c' }} className="j-mono">
                <Wrench size={9} /> TOOL ACCESS ENABLED — CAN READ/WRITE FILES, RUN BUILDS, INSPECT LOGS
              </div>
            )}
          </div>
        ) : messages.map((msg, i) => {
          if (msg.role === 'tool_event' && msg.toolEvent) {
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 4, animation: 'jarvis-fadein 0.15s ease both' }}>
                <ToolEventBubble event={msg.toolEvent} />
              </div>
            );
          }
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 3, animation: 'jarvis-fadein 0.2s ease both' }}>
              <div style={{
                maxWidth: '82%', padding: '8px 12px',
                background: msg.isError ? 'rgba(192,21,42,0.06)' : msg.role === 'user' ? 'rgba(192,21,42,0.10)' : 'rgba(0,212,255,0.05)',
                border: `1px solid ${msg.isError ? 'rgba(192,21,42,0.25)' : msg.role === 'user' ? 'rgba(192,21,42,0.28)' : 'rgba(0,212,255,0.14)'}`,
                fontFamily: msg.role === 'user' ? 'var(--j-font-ui)' : 'var(--j-font-mono)',
                fontSize: 12, color: msg.isError ? 'var(--j-red)' : 'var(--j-text)', lineHeight: 1.65,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.content}
                {msg.role === 'assistant' && streaming && i === messages.length - 1 && (
                  <span style={{ display: 'inline-block', width: 2, height: 12, background: 'var(--j-cyan)', marginLeft: 2, animation: 'jarvis-blink 1s infinite' }} />
                )}
              </div>
              {msg.role === 'assistant' && msg.latencyMs != null && (
                <div style={{ display: 'flex', gap: 8 }} className="j-mono">
                  {[
                    `${msg.latencyMs}ms`,
                    msg.tokens ? `${msg.tokens} tok` : '',
                    msg.costUsd ? `$${msg.costUsd.toFixed(5)}` : '',
                  ].filter(Boolean).map((v, vi) => (
                    <span key={vi} style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>{v}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Input row ── */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button className="j-btn-ghost" style={{ height: 36, width: 36, padding: 0, flexShrink: 0 }} onClick={clearChat} title="Clear conversation">
          <Trash2 size={13} />
        </button>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={`Message ${agent?.name ?? 'agent'}… (Shift+Enter for newline)`}
          style={{ flex: 1, height: 36, padding: '8px 12px', background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--j-text)', fontFamily: 'var(--j-font-mono)', fontSize: 12, resize: 'none', outline: 'none' }}
        />
        {streaming ? (
          <button className="j-btn-ghost" style={{ height: 36, width: 36, padding: 0, flexShrink: 0, borderColor: 'rgba(192,21,42,0.4)' }} onClick={() => stopRef.current?.()} title="Stop generation">
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
