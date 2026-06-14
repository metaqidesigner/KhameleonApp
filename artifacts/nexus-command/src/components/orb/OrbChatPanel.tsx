import { useCallback, useEffect, useRef, useState } from 'react';
import { useJarvisStore } from '@/store/jarvisStore';
import {
  streamAgentChat,
  FALLBACK_ROSTER,
  getRoster,
  type AgentConfig,
  type ChatMessage,
} from '@/lib/agentsApi';
import type { VoiceSettings } from '@/store/jarvisStore';
import { useVoice } from './useVoice';
import { InputWaveform } from './VoiceWaveform';

const AGENT_COLORS: Record<string, string> = {
  claude:     '#c9a84c',
  gpt4o:      '#00d4ff',
  gemini:     '#3fb950',
  openrouter: '#a78bfa',
  local:      '#f97316',
  minimax:    '#ec4899',
};

interface OrbMsg {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  agentId?: string;
  ts: number;
  latencyMs?: number;
  tokens?: number;
  costUsd?: number;
  wasSpoken?: boolean;
}

interface Props {
  style?: React.CSSProperties;
  onClose: () => void;
}

function speakText(text: string, voiceSettings: VoiceSettings) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const { rate, pitch, volume, maxSpeakLength, lang } = voiceSettings;
  const stripped = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .slice(0, maxSpeakLength);
  const utterance = new SpeechSynthesisUtterance(stripped);
  utterance.rate = rate; utterance.pitch = pitch; utterance.volume = volume; utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

export function OrbChatPanel({ style, onClose }: Props) {
  const orbActiveAgentId   = useJarvisStore(s => s.orbActiveAgentId);
  const setOrbActiveAgentId = useJarvisStore(s => s.setOrbActiveAgentId);
  const orbStatus           = useJarvisStore(s => s.orbStatus);
  const setOrbStatus        = useJarvisStore(s => s.setOrbStatus);
  const autoSpeak           = useJarvisStore(s => s.autoSpeak);
  const voiceSettings       = useJarvisStore(s => s.voiceSettings);
  const pushAgentEvent      = useJarvisStore(s => s.pushAgentEvent);

  const [roster, setRoster] = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [messages, setMessages] = useState<OrbMsg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);
  const streamBufRef = useRef('');

  useEffect(() => {
    getRoster().then(setRoster).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: OrbMsg = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      ts: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setOrbStatus('speaking');
    streamBufRef.current = '';

    const history: ChatMessage[] = [
      ...messages
        .filter(m => m.role !== 'error')
        .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content })),
      { role: 'user' as const, content: trimmed },
    ];

    const assistantId = crypto.randomUUID();
    const placeholder: OrbMsg = {
      id: assistantId,
      role: 'assistant',
      content: '',
      agentId: orbActiveAgentId,
      ts: Date.now(),
    };
    setMessages(prev => [...prev, placeholder]);

    stopStreamRef.current = streamAgentChat(
      orbActiveAgentId,
      history,
      (token) => {
        streamBufRef.current += token;
        const buf = streamBufRef.current;
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: buf } : m));
      },
      (done) => {
        setStreaming(false);
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, latencyMs: done.latencyMs, tokens: done.tokens, costUsd: done.costUsd }
            : m
        ));
        pushAgentEvent({
          id: assistantId,
          prompt: trimmed,
          response: streamBufRef.current,
          model: done.model,
          agent: orbActiveAgentId,
          ts: Date.now(),
          durationMs: done.latencyMs,
          tokens: done.tokens,
          costUsd: done.costUsd,
        });
        if (autoSpeak) {
          speakText(streamBufRef.current, voiceSettings);
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, wasSpoken: true } : m));
        } else {
          setOrbStatus('online');
        }
        if (!autoSpeak) setOrbStatus('online');
      },
      (err) => {
        setStreaming(false);
        setOrbStatus('online');
        const isOffline = err.includes('unreachable') || err.includes('fetch') || err.includes('network');
        if (isOffline) setOrbStatus('offline');
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, role: 'error' as const, content: isOffline
                ? 'CONNECTION LOST — Backend unreachable. Check engine configuration.'
                : `AGENT ERROR — ${err}` }
            : m
        ));
      },
    );
  }, [streaming, messages, orbActiveAgentId, setOrbStatus, autoSpeak, voiceSettings, pushAgentEvent]);

  const handleTranscript = useCallback((text: string) => {
    setInput(text);
    handleSend(text);
  }, [handleSend]);

  const { voiceInputAvailable, isListening, interim, analyserRef, toggleListening } = useVoice(handleTranscript);

  const statusColor = orbStatus === 'online' ? '#00d4ff'
    : orbStatus === 'speaking' ? '#00d4ff'
    : orbStatus === 'listening' ? '#c9a84c'
    : '#c0152a';

  const activeAgent = roster.find(a => a.id === orbActiveAgentId) ?? roster[0];

  return (
    <div className="orb-chat-panel" style={style}>
      {/* Header */}
      <div className="orb-chat-header">
        <div className="orb-status-dot" style={{ background: statusColor }} />
        <span className="orb-chat-header-title">J.A.R.V.I.S</span>
        <span className="orb-chat-header-agent">AGENT: {activeAgent?.name ?? orbActiveAgentId.toUpperCase()}</span>
        <span className="orb-chat-header-status" style={{ color: orbStatus === 'offline' ? '#ef4444' : '#3fb950' }}>
          ● {orbStatus.toUpperCase()}
        </span>
        <span className="j-badge j-badge-classified" style={{ fontSize: 8, padding: '1px 5px' }}>CLASSIFIED</span>
        <button className="orb-chat-close" onClick={onClose}>✕</button>
      </div>

      {/* Agent selector */}
      <div className="orb-agent-selector">
        {roster.slice(0, 6).map(agent => (
          <button
            key={agent.id}
            className={`orb-agent-pill${agent.id === orbActiveAgentId ? ' active' : ''}`}
            onClick={() => setOrbActiveAgentId(agent.id)}
          >
            <span className="orb-agent-pill-dot" style={{ background: AGENT_COLORS[agent.id] ?? agent.color }} />
            {agent.initials}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="orb-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'rgba(0,212,255,0.3)', letterSpacing: '0.1em' }}>
            QUERY JARVIS TO BEGIN
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`orb-msg ${msg.role === 'user' ? 'orb-msg-user' : msg.role === 'error' ? 'orb-msg-error' : 'orb-msg-assistant'}`}>
            {msg.role === 'assistant' && !msg.content && streaming ? (
              <span className="orb-typing">PROCESSING...</span>
            ) : msg.content}
            {msg.role === 'assistant' && msg.content && (
              <div className="orb-msg-footer">
                <span>{(msg.agentId ?? orbActiveAgentId).toUpperCase()}</span>
                {msg.latencyMs != null && <span>{msg.latencyMs}ms</span>}
                {msg.tokens != null && <span>{msg.tokens} tok</span>}
                {msg.costUsd != null && msg.costUsd > 0 && <span>${msg.costUsd.toFixed(4)}</span>}
                {msg.wasSpoken && <span>🔊 SPOKEN</span>}
                {'speechSynthesis' in window && (
                  <button
                    className="orb-msg-speak-btn"
                    title="Replay"
                    onClick={() => speakText(msg.content, voiceSettings)}
                  >🔊</button>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="orb-chat-input-area">
        <button
          className={`orb-mic-btn${isListening ? ' listening' : ''}`}
          title={voiceInputAvailable ? (isListening ? 'Stop listening' : 'Voice input') : 'Voice input requires Chrome or Edge'}
          disabled={!voiceInputAvailable}
          onClick={toggleListening}
        >
          {isListening ? (
            <InputWaveform analyserRef={analyserRef} active={isListening} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
              {!voiceInputAvailable && <line x1="4" y1="4" x2="20" y2="20" stroke="#c0152a"/>}
            </svg>
          )}
        </button>

        {isListening && interim ? (
          <div style={{ flex: 1, fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'rgba(0,212,255,0.5)', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Hearing: {interim}...
          </div>
        ) : (
          <input
            ref={inputRef}
            className="orb-text-input"
            placeholder="QUERY JARVIS..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend(input); }}
            disabled={streaming}
          />
        )}

        <button
          className="orb-send-btn"
          disabled={streaming || (!input.trim() && !isListening)}
          onClick={() => handleSend(input)}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
