import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, ExternalLink } from 'lucide-react';
import { marked } from 'marked';
import { useJarvisStore, type AgentType } from '@/store/jarvisStore';
import { submitCommand } from '@/lib/taskRunApi';

const AGENT_LABELS: Record<AgentType, string> = {
  simple: 'SIMPLE', orchestrator: 'ORCHESTRATOR',
  deep_research: 'RESEARCH', morning_digest: 'MORNING',
  code_assistant: 'CODE', channel_agent: 'CHANNEL',
  proactive_agent: 'PROACTIVE', operative: 'OPERATIVE',
};

// ── Message bubble ────────────────────────────────────────────

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  taskRunId?: string;
}

function Bubble({ msg }: { msg: Msg }) {
  const setActiveTab  = useJarvisStore(s => s.setActiveTab);
  const addActiveTask = useJarvisStore(s => s.addActiveTask);

  const isUser = msg.role === 'user';

  const html = React.useMemo(() => {
    if (isUser) return null;
    try {
      return { __html: marked.parse(msg.content) as string };
    } catch {
      return { __html: msg.content };
    }
  }, [msg.content, isUser]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 2, marginBottom: 10,
    }}>
      <div style={{
        maxWidth: '88%', padding: '8px 12px',
        background: isUser ? 'rgba(0,196,184,0.12)' : 'rgba(8,14,32,0.6)',
        border: `1px solid ${isUser ? 'rgba(0,196,184,0.25)' : 'rgba(120,168,220,0.10)'}`,
        borderRadius: isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
        backdropFilter: 'blur(10px)',
      }}>
        {isUser ? (
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: '#fff' }}>{msg.content}</span>
        ) : (
          <div className="j-prose" style={{ fontSize: 12 }} dangerouslySetInnerHTML={html!} />
        )}
      </div>

      {/* Task link for assistant messages with taskRunId */}
      {msg.taskRunId && (
        <button
          onClick={() => {
            addActiveTask(msg.taskRunId!);
            setActiveTab('tasks');
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,196,184,0.08)', border: '1px solid rgba(0,196,184,0.22)',
            borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
            color: 'var(--j-teal)', fontFamily: 'var(--j-font-mono)', fontSize: 9,
            letterSpacing: '0.08em', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,196,184,0.14)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,196,184,0.08)')}
        >
          <ExternalLink size={9} /> VIEW IN TASKS
        </button>
      )}

      <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 8, color: 'var(--j-text-faint)' }}>
        {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </span>
    </div>
  );
}

// ── Main chat panel ───────────────────────────────────────────

export default function ChatPanel() {
  const chatOpen       = useJarvisStore(s => s.chatOpen);
  const setChatOpen    = useJarvisStore(s => s.setChatOpen);
  const selectedAgent  = useJarvisStore(s => s.selectedAgent);
  const setSelectedAgent = useJarvisStore(s => s.setSelectedAgent);
  const addActiveTask  = useJarvisStore(s => s.addActiveTask);
  const setActiveTab   = useJarvisStore(s => s.setActiveTab);

  const [input, setInput]     = useState('');
  const [msgs, setMsgs]       = useState<Msg[]>([]);
  const [sending, setSending] = useState(false);
  const bodyRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs]);

  const submit = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');

    const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() };
    setMsgs(prev => [...prev, userMsg]);
    setSending(true);

    try {
      const { taskRunId } = await submitCommand(text, { triggerType: 'manual' });

      if (taskRunId) addActiveTask(taskRunId);

      const botMsg: Msg = {
        id: crypto.randomUUID(), role: 'assistant',
        content: taskRunId
          ? `Task queued — I'm working on it now. Each step will run with full tool access.\n\nClick **VIEW IN TASKS** below to watch the live trace.`
          : 'Command submitted.',
        timestamp: Date.now(),
        taskRunId,
      };
      setMsgs(prev => [...prev, botMsg]);

      // Auto-navigate to tasks tab after a short delay
      if (taskRunId) {
        setTimeout(() => {
          setActiveTab('tasks');
          setChatOpen(false);
        }, 1800);
      }
    } catch (err) {
      const botMsg: Msg = {
        id: crypto.randomUUID(), role: 'assistant',
        content: `Failed to submit command: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMsgs(prev => [...prev, botMsg]);
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  return (
    <AnimatePresence>
      {chatOpen && (
        <motion.div
          initial={{ y: 80, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 200,
            width: 380, height: 520, display: 'flex', flexDirection: 'column',
            background: 'rgba(8,14,32,0.88)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(0,196,184,0.18)',
            borderRadius: 16,
            boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 60px rgba(0,196,184,0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
            borderBottom: '1px solid rgba(0,196,184,0.10)',
            background: 'rgba(0,196,184,0.045)',
            flexShrink: 0,
          }}>
            <Bot size={14} style={{ color: 'var(--j-teal)' }} />
            <span style={{ fontFamily: 'var(--j-font-head)', fontSize: 11, color: '#fff', letterSpacing: '0.22em', flex: 1 }}>
              COMMAND INTERFACE
            </span>
            {/* Agent selector */}
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value as AgentType)}
              style={{
                background: 'rgba(0,196,184,0.08)', border: '1px solid rgba(0,196,184,0.2)',
                color: 'var(--j-teal)', fontFamily: 'var(--j-font-mono)', fontSize: 9,
                padding: '2px 6px', borderRadius: 6, cursor: 'pointer', letterSpacing: '0.06em',
              }}
            >
              {Object.entries(AGENT_LABELS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
            <button
              onClick={() => setChatOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-faint)', padding: 0, display: 'flex' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div ref={bodyRef} className="scrollbar-jarvis" style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
            {msgs.length === 0 && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100%', gap: 10, color: 'var(--j-text-faint)',
                fontFamily: 'var(--j-font-mono)', fontSize: 10, textAlign: 'center', letterSpacing: '0.08em',
              }}>
                <Bot size={28} style={{ opacity: 0.3 }} />
                <div>TYPE ANY COMMAND</div>
                <div style={{ fontSize: 9, opacity: 0.6 }}>Each command runs as a tracked task with full tool access</div>
              </div>
            )}
            {msgs.map(m => <Bubble key={m.id} msg={m} />)}
            {sending && (
              <div style={{ display: 'flex', gap: 5, padding: '4px 0' }}>
                {[0, 120, 240].map(d => (
                  <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--j-teal)', animation: `jarvis-pulse 0.8s ease-in-out ${d}ms infinite` }} />
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid rgba(120,168,220,0.08)', flexShrink: 0 }}>
            <input
              className="j-input"
              style={{ flex: 1, height: 38, fontSize: 12, borderRadius: 8 }}
              placeholder="Issue a command…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              disabled={sending}
              autoFocus
            />
            <button
              className="j-btn-primary"
              style={{ height: 38, width: 38, padding: 0, borderRadius: 8, flexShrink: 0 }}
              onClick={submit}
              disabled={!input.trim() || sending}
            >
              <Send size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
