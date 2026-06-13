import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot } from 'lucide-react';
import { marked } from 'marked';
import { useJarvisStore, type AgentType } from '@/store/jarvisStore';
import { streamChat } from '@/lib/jarvisApi';
import { KNOWN_AGENTS } from '@/lib/jarvisApi';

const AGENT_LABELS: Record<AgentType, string> = {
  simple: 'SIMPLE', orchestrator: 'ORCHESTRATOR',
  deep_research: 'RESEARCH', morning_digest: 'MORNING',
  code_assistant: 'CODE', channel_agent: 'CHANNEL',
  proactive_agent: 'PROACTIVE', operative: 'OPERATIVE',
};

export default function ChatPanel() {
  const {
    chatOpen, setChatOpen,
    chatMessages, appendMessage, updateLastMessage,
    isStreaming, setStreaming,
    selectedAgent, setSelectedAgent,
  } = useJarvisStore();

  const [input, setInput] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [chatMessages]);

  const submit = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: text,
      timestamp: Date.now(),
    };
    appendMessage(userMsg);

    const botMsg = {
      id: crypto.randomUUID(),
      role: 'assistant' as const,
      content: '',
      agentType: selectedAgent,
      timestamp: Date.now(),
    };
    appendMessage(botMsg);
    setStreaming(true);

    stopRef.current = streamChat(
      text,
      selectedAgent,
      (token) => updateLastMessage({ content: useJarvisStore.getState().chatMessages.slice(-1)[0].content + token }),
      (done) => {
        updateLastMessage({
          model: done.model ?? undefined,
          latencyMs: done.latency_ms,
          tokens: done.tokens,
          costUsd: done.cost_usd,
          energyWh: done.energy_wh,
        });
        setStreaming(false);
      },
    );
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  return (
    <AnimatePresence>
      {chatOpen && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            bottom: 32 + 8, left: '50%',
            transform: 'translateX(-50%)',
            width: 560,
            maxHeight: '60vh',
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(0,4,12,0.97)',
            border: '1px solid rgba(0,212,255,0.4)',
            boxShadow: '0 0 40px rgba(0,212,255,0.2), 0 24px 60px rgba(0,0,0,0.85)',
          }}
        >
          {/* Corner brackets */}
          <div style={{ position: 'absolute', top: -1, left: -1, width: 14, height: 14, borderTop: '2px solid #00d4ff', borderLeft: '2px solid #00d4ff', zIndex: 1, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderBottom: '2px solid #00d4ff', borderRight: '2px solid #00d4ff', zIndex: 1, pointerEvents: 'none' }} />

          {/* Header */}
          <div className="j-panel-header" style={{ cursor: 'default', flexShrink: 0 }}>
            <span className="j-panel-title">
              <Bot size={14} color="var(--j-red)" />
              JARVIS INTERFACE
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {(KNOWN_AGENTS as unknown as AgentType[]).slice(0, 5).map(a => (
                <button
                  key={a}
                  onClick={() => setSelectedAgent(a)}
                  style={{
                    fontFamily: 'var(--j-font-mono)', fontSize: 8,
                    padding: '2px 6px', textTransform: 'uppercase',
                    cursor: 'pointer', border: '1px solid',
                    letterSpacing: '0.06em',
                    background: selectedAgent === a ? 'var(--j-red)' : 'transparent',
                    borderColor: selectedAgent === a ? 'var(--j-red)' : 'rgba(0,212,255,0.25)',
                    color: selectedAgent === a ? '#fff' : 'var(--j-text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  {AGENT_LABELS[a]}
                </button>
              ))}
              <button
                onClick={() => { setChatOpen(false); stopRef.current?.(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={bodyRef}
            className="scrollbar-jarvis"
            style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200 }}
          >
            {chatMessages.length === 0 && (
              <div style={{ color: 'var(--j-text-faint)', fontFamily: 'var(--j-font-mono)', fontSize: 11, textAlign: 'center', padding: 20 }}>
                // JARVIS INTERFACE READY — QUERY AWAITING //
              </div>
            )}
            {chatMessages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', animation: 'jarvis-fadein 0.2s ease both' }}>
                <div style={{
                  maxWidth: '88%',
                  padding: '8px 12px',
                  background: msg.role === 'user' ? 'rgba(192,21,42,0.15)' : 'transparent',
                  border: msg.role === 'user' ? '1px solid rgba(192,21,42,0.3)' : 'none',
                  borderLeft: msg.role === 'assistant' ? '2px solid var(--j-cyan)' : undefined,
                  paddingLeft: msg.role === 'assistant' ? 10 : undefined,
                }}>
                  {msg.role === 'assistant' ? (
                    <div
                      className="j-prose"
                      dangerouslySetInnerHTML={{ __html: (marked.parse(msg.content || '') as string) + (isStreaming && msg === chatMessages[chatMessages.length - 1] ? '<span class="j-blink" style="color:var(--j-cyan);font-weight:700">▌</span>' : '') }}
                    />
                  ) : (
                    <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 13, color: 'var(--j-text)' }}>{msg.content}</span>
                  )}
                </div>
                {msg.role === 'assistant' && msg.model && (
                  <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-muted)', marginTop: 2, paddingLeft: 12 }}>
                    {msg.model} · {msg.latencyMs}ms · {msg.tokens} tok · ${(msg.costUsd ?? 0).toFixed(4)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ borderTop: '1px solid rgba(0,212,255,0.18)', background: 'rgba(0,4,8,0.9)', padding: '8px 12px', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input
              className="j-input"
              style={{ flex: 1 }}
              placeholder="QUERY JARVIS..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              disabled={isStreaming}
            />
            <button
              className="j-btn-primary"
              style={{ height: 34, padding: '0 14px', fontSize: 11 }}
              onClick={submit}
              disabled={isStreaming || !input.trim()}
            >
              <Send size={12} />
              TRANSMIT
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
