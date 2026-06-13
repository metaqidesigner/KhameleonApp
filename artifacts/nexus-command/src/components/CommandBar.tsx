import { useState, useRef, useEffect, useCallback } from 'react';
import { Command, Send, Mic, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { marked } from 'marked';
import { streamChat } from '@/lib/jarvisApi';
import { useNexusStore } from '@/store/nexusStore';
import { useJarvisHealth } from '@/hooks/useJarvis';
import { cn } from '@/lib/utils';

const AGENTS = [
  { id: 'simple', label: 'Simple' },
  { id: 'orchestrator', label: 'Orchestrator' },
  { id: 'deep_research', label: 'Research' },
  { id: 'code_assistant', label: 'Code' },
];

interface CommandBarProps {
  width: number;
}

export function CommandBar({ width }: CommandBarProps) {
  const [input, setInput] = useState('');
  const [agentMode, setAgentMode] = useState('simple');
  const [responseText, setResponseText] = useState('');
  const [responseModel, setResponseModel] = useState<string | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { setStreaming, isStreaming, pushAgentEvent } = useNexusStore();
  const { data: health } = useJarvisHealth();
  const isOffline = health?.status === 'offline' || !health;

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') setOverlayOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close overlay on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setOverlayOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isStreaming) return;

    const prompt = input.trim();
    setInput('');
    setResponseText('');
    setResponseModel(null);
    setOverlayOpen(true);
    setStreaming(true);

    const startTs = Date.now();
    let accumulated = '';

    const cleanup = streamChat(
      prompt,
      agentMode,
      (token) => {
        accumulated += token;
        setResponseText(accumulated);
      },
      (model) => {
        setStreaming(false);
        setResponseModel(model);
        pushAgentEvent({
          id: crypto.randomUUID(),
          prompt,
          response: accumulated,
          model: model ?? 'unknown',
          agent: agentMode,
          ts: startTs,
          durationMs: Date.now() - startTs,
        });
        cleanup();
      },
    );
  }, [input, agentMode, isStreaming, setStreaming, pushAgentEvent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const renderedHtml = responseText
    ? (marked.parse(responseText) as string)
    : '';

  return (
    <div style={{
      position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      width: Math.min(width * 0.5, 640), zIndex: 50,
    }}>
      {/* Offline warning */}
      {isOffline && (
        <div style={{
          marginBottom: 8,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10, padding: '7px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: 'rgba(239,68,68,0.9)',
        }}>
          <AlertTriangle style={{ width: 12, height: 12, flexShrink: 0 }} />
          <span>Backend offline — set ANTHROPIC_API_KEY or install Ollama, then restart</span>
        </div>
      )}

      {/* Agent selector pills */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
        {AGENTS.map(a => (
          <button
            key={a.id}
            onClick={() => setAgentMode(a.id)}
            className={cn(
              'nexus-pill',
              agentMode === a.id ? 'nexus-pill-cyan' : 'nexus-pill-ghost',
            )}
            style={{ cursor: 'pointer', fontSize: 10, padding: '3px 10px' }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Response overlay */}
      <AnimatePresence>
        {overlayOpen && (
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22 }}
            style={{
              marginBottom: 10,
              background: 'rgba(2,10,22,0.97)', backdropFilter: 'blur(24px)',
              border: '1px solid rgba(0,212,255,0.18)', borderRadius: 16,
              maxHeight: '40vh', overflowY: 'auto',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5), 0 0 30px rgba(0,212,255,0.06)',
              padding: '16px 20px',
              position: 'relative',
            }}
            className="scrollbar-hide"
          >
            <button
              onClick={() => setOverlayOpen(false)}
              style={{
                position: 'absolute', top: 10, right: 10,
                width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(200,220,240,0.6)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X style={{ width: 12, height: 12 }} />
            </button>

            {isStreaming && !responseText && (
              <div style={{ display: 'flex', gap: 6, padding: '4px 0' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#00d4ff',
                    animation: `nexus-thinking 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            )}

            {responseText && (
              <div
                className="nexus-prose"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
                style={{ fontSize: 13, lineHeight: 1.65, color: 'rgba(210,235,250,0.9)' }}
              />
            )}

            {responseModel && (
              <div style={{
                marginTop: 12, paddingTop: 10,
                borderTop: '1px solid rgba(0,212,255,0.08)',
                fontSize: 10, color: 'rgba(0,212,255,0.4)',
                fontFamily: 'var(--font-mono)', textAlign: 'right', letterSpacing: '0.1em',
              }}>
                MODEL: {responseModel.toUpperCase()}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(3,14,28,0.92)', backdropFilter: 'blur(20px)',
        border: `1px solid ${isStreaming ? 'rgba(0,212,255,0.4)' : 'rgba(0,212,255,0.2)'}`,
        borderRadius: 40, padding: '11px 20px',
        boxShadow: isStreaming
          ? '0 0 30px rgba(0,212,255,0.18), 0 8px 32px rgba(0,0,0,0.4)'
          : '0 0 30px rgba(0,212,255,0.08), 0 8px 32px rgba(0,0,0,0.4)',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}>
        <Command style={{ width: 15, height: 15, color: 'rgba(0,212,255,0.6)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'rgba(200,230,250,0.9)', fontSize: 13, fontFamily: 'inherit',
          }}
          placeholder={
            isStreaming
              ? 'Nexus is thinking…'
              : "Ask Nexus Command anything…  e.g. 'Prepare me for tomorrow'"
          }
        />
        <button
          onClick={() => { /* stub */ }}
          style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.14)',
            color: 'rgba(0,212,255,0.5)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label="Voice input"
        >
          <Mic style={{ width: 12, height: 12 }} />
        </button>
        <button
          onClick={handleSubmit}
          disabled={isStreaming || !input.trim()}
          style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: input.trim() && !isStreaming ? 'rgba(0,212,255,0.18)' : 'rgba(0,212,255,0.06)',
            border: `1px solid ${input.trim() && !isStreaming ? 'rgba(0,212,255,0.5)' : 'rgba(0,212,255,0.14)'}`,
            color: input.trim() && !isStreaming ? '#00d4ff' : 'rgba(0,212,255,0.3)',
            cursor: input.trim() && !isStreaming ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          aria-label="Send"
        >
          <Send style={{ width: 12, height: 12 }} />
        </button>
        <kbd style={{
          fontSize: 10, color: 'rgba(0,212,255,0.35)', background: 'rgba(0,212,255,0.08)',
          border: '1px solid rgba(0,212,255,0.12)', borderRadius: 6,
          padding: '2px 7px', fontFamily: 'monospace', flexShrink: 0,
        }}>⌘K</kbd>
      </div>
    </div>
  );
}
