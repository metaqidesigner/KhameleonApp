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

const PREFERRED_VOICES = [
  'Google UK English Male',
  'Microsoft Ryan Online (Natural) - English (United Kingdom)',
  'Microsoft Guy Online (Natural) - English (United States)',
  'Daniel',
  'Alex',
];

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

function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    const v = window.speechSynthesis.getVoices();
    if (v.length > 0) { resolve(v); return; }
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
  });
}

export function OrbChatPanel({ style, onClose }: Props) {
  const orbActiveAgentId    = useJarvisStore(s => s.orbActiveAgentId);
  const setOrbActiveAgentId = useJarvisStore(s => s.setOrbActiveAgentId);
  const orbStatus           = useJarvisStore(s => s.orbStatus);
  const setOrbStatus        = useJarvisStore(s => s.setOrbStatus);
  const voiceSettings       = useJarvisStore(s => s.voiceSettings);
  const pushAgentEvent      = useJarvisStore(s => s.pushAgentEvent);
  const pendingVoiceQuery   = useJarvisStore(s => s.pendingVoiceQuery);
  const setPendingVoiceQuery = useJarvisStore(s => s.setPendingVoiceQuery);

  const [roster, setRoster]     = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [messages, setMessages] = useState<OrbMsg[]>([]);
  const [input, setInput]       = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const stopStreamRef   = useRef<(() => void) | null>(null);
  const streamBufRef    = useRef('');
  const voicesRef       = useRef<SpeechSynthesisVoice[]>([]);

  // Countdown state for auto-send
  const [countdown, setCountdown] = useState<{ progress: number } | null>(null);
  const countdownRafRef = useRef<number | null>(null);
  const countdownStartRef = useRef<number>(0);

  useEffect(() => {
    getRoster().then(setRoster).catch(() => {});
    if ('speechSynthesis' in window) {
      getVoices().then(v => { voicesRef.current = v; });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── TTS with orbStatus wiring + Chrome keepalive ──────────────────────────
  const speakResponse = useCallback((text: string, settings: VoiceSettings) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const clean = text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/```[\s\S]*?```/g, 'code block omitted')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\$/g, 'dollars')
      .replace(/%/g, 'percent')
      .replace(/\bms\b/g, 'milliseconds')
      .replace(/\btok\b/g, 'tokens')
      .replace(/\n+/g, '. ')
      .trim()
      .slice(0, settings.maxSpeakLength);

    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate   = settings.rate;
    utterance.pitch  = settings.pitch;
    utterance.volume = settings.volume;
    utterance.lang   = settings.lang;

    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
    let sel: SpeechSynthesisVoice | null = null;
    for (const name of PREFERRED_VOICES) {
      sel = voices.find(v => v.name === name) ?? null;
      if (sel) break;
    }
    if (!sel && settings.voice) sel = voices.find(v => v.name === settings.voice) ?? null;
    if (!sel) sel = voices.find(v => v.lang.startsWith('en')) ?? null;
    if (sel) utterance.voice = sel;

    utterance.onstart = () => setOrbStatus('speaking');
    utterance.onend   = () => setOrbStatus('online');
    utterance.onerror = () => setOrbStatus('online');

    // Chrome bug: TTS pauses after ~15s without this
    const keepAlive = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        clearInterval(keepAlive);
      }
    }, 10000);

    window.speechSynthesis.speak(utterance);
  }, [setOrbStatus]);

  // ── Send handler ──────────────────────────────────────────────────────────
  const handleSend = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: OrbMsg = {
      id: crypto.randomUUID(), role: 'user', content: trimmed, ts: Date.now(),
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
    setMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', agentId: orbActiveAgentId, ts: Date.now(),
    }]);

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
        const fullResponse = streamBufRef.current;
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, latencyMs: done.latencyMs, tokens: done.tokens, costUsd: done.costUsd, wasSpoken: true }
            : m
        ));
        pushAgentEvent({
          id: assistantId,
          prompt: trimmed,
          response: fullResponse,
          model: done.model,
          agent: orbActiveAgentId,
          ts: Date.now(),
          durationMs: done.latencyMs,
          tokens: done.tokens,
          costUsd: done.costUsd,
        });
        // Orb chat always speaks — voice-first by design
        speakResponse(fullResponse, voiceSettings);
      },
      (err) => {
        setStreaming(false);
        setOrbStatus('online');
        const isOffline = err.includes('unreachable') || err.includes('fetch') || err.includes('network');
        if (isOffline) setOrbStatus('offline');
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, role: 'error' as const, content: isOffline
                ? 'CONNECTION LOST — Backend unreachable.'
                : `AGENT ERROR — ${err}` }
            : m
        ));
      },
    );
  }, [streaming, messages, orbActiveAgentId, setOrbStatus, voiceSettings, pushAgentEvent, speakResponse]);

  // Pick up queries injected by VoiceController
  useEffect(() => {
    if (!pendingVoiceQuery) return;
    setPendingVoiceQuery(null);
    handleSend(pendingVoiceQuery);
  }, [pendingVoiceQuery, setPendingVoiceQuery, handleSend]);

  // ── Voice mic input ───────────────────────────────────────────────────────
  const handleTranscript = useCallback((text: string) => {
    setInput(text);
    handleSend(text);
  }, [handleSend]);

  const {
    voiceInputAvailable, isListening, interim,
    pendingTranscript, cancelAutoSend,
    analyserRef, toggleListening,
  } = useVoice(handleTranscript);

  // Countdown progress bar animation
  useEffect(() => {
    if (!pendingTranscript) {
      setCountdown(null);
      if (countdownRafRef.current != null) cancelAnimationFrame(countdownRafRef.current);
      return;
    }
    countdownStartRef.current = performance.now();
    const duration = voiceSettings.autoSendDelay;

    const tick = () => {
      const elapsed = performance.now() - countdownStartRef.current;
      const progress = Math.min(elapsed / duration, 1);
      setCountdown({ progress });
      if (progress < 1) countdownRafRef.current = requestAnimationFrame(tick);
    };
    countdownRafRef.current = requestAnimationFrame(tick);
    return () => { if (countdownRafRef.current != null) cancelAnimationFrame(countdownRafRef.current); };
  }, [pendingTranscript, voiceSettings.autoSendDelay]);

  // Cancel auto-send on ESC
  useEffect(() => {
    if (!pendingTranscript) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelAutoSend(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingTranscript, cancelAutoSend]);

  const statusColor = orbStatus === 'listening' ? '#c9a84c'
    : orbStatus === 'offline'  ? '#c0152a'
    : '#00d4ff';

  const activeAgent = roster.find(a => a.id === orbActiveAgentId) ?? roster[0];

  return (
    <div className="orb-chat-panel" style={style}>
      {/* Header */}
      <div className="orb-chat-header">
        <div className="orb-status-dot" style={{ background: statusColor }} />
        <span className="orb-chat-header-title">KHAMELEON</span>
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
            QUERY KHAMELEON TO BEGIN
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
                {msg.tokens   != null && <span>{msg.tokens} tok</span>}
                {msg.costUsd  != null && msg.costUsd > 0 && <span>${msg.costUsd.toFixed(4)}</span>}
                {msg.wasSpoken && <span>🔊 SPOKEN</span>}
                {'speechSynthesis' in window && (
                  <button
                    className="orb-msg-speak-btn"
                    title="Replay"
                    onClick={() => speakResponse(msg.content, voiceSettings)}
                  >🔊</button>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="orb-chat-input-area" style={{ flexDirection: 'column', gap: 0 }}>
        {/* Countdown bar */}
        {pendingTranscript && countdown && (
          <div style={{ width: '100%', marginBottom: 4 }}>
            <div style={{ position: 'relative', height: 2, background: 'rgba(0,212,255,0.12)', borderRadius: 1, overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${(1 - countdown.progress) * 100}%`,
                background: 'var(--j-cyan)',
                transition: 'width 50ms linear',
              }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
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

          {pendingTranscript ? (
            <>
              <div style={{
                flex: 1, fontFamily: 'var(--j-font-mono)', fontSize: 10,
                color: 'rgba(0,212,255,0.7)', padding: '0 4px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {pendingTranscript}
              </div>
              <button
                onClick={cancelAutoSend}
                style={{
                  padding: '3px 8px', fontFamily: 'var(--j-font-mono)', fontSize: 9,
                  letterSpacing: '0.1em', background: 'transparent',
                  border: '1px solid rgba(192,21,42,0.5)', color: 'rgba(192,21,42,0.8)',
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                ✕ CANCEL
              </button>
            </>
          ) : isListening && interim ? (
            <div style={{
              flex: 1, fontFamily: 'var(--j-font-mono)', fontSize: 10,
              color: 'rgba(0,212,255,0.5)', padding: '0 4px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              Hearing: {interim}…
            </div>
          ) : (
            <input
              ref={inputRef}
              className="orb-text-input"
              placeholder="QUERY KHAMELEON..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(input); }}
              disabled={streaming}
            />
          )}

          <button
            className="orb-send-btn"
            disabled={streaming || (!input.trim() && !isListening && !pendingTranscript)}
            onClick={() => handleSend(input)}
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
