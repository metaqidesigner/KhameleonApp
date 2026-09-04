import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Send, Volume2, X } from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';
import {
  streamAgentChat,
  FALLBACK_ROSTER,
  getRoster,
  type AgentConfig,
  type ChatMessage,
} from '@/lib/agentsApi';
import { getOnboardingStatus } from '@/lib/jarvisApi';
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

// Kept in sync with AssistantCard.tsx's identical greeting - same
// personalization rule (design-spec.md §14 item 1): real name when set,
// omitted entirely otherwise, never a placeholder standing in for it.
function getGreeting(name: string | null): { title: string; sub: string } {
  const h = new Date().getHours();
  const timeGreeting =
    h >= 5  && h < 12 ? 'Good morning'   :
    h >= 12 && h < 18 ? 'Good afternoon' : 'Good evening';
  const title = name ? `${timeGreeting}, ${name}.` : `${timeGreeting}.`;
  return { title, sub: 'How can I help you blend in today?' };
}

export function OrbChatPanel({ style, onClose }: Props) {
  const orbActiveAgentId    = useJarvisStore(s => s.orbActiveAgentId);
  const setOrbActiveAgentId = useJarvisStore(s => s.setOrbActiveAgentId);
  const orbStatus           = useJarvisStore(s => s.orbStatus);
  const setOrbStatus        = useJarvisStore(s => s.setOrbStatus);
  const voiceEnabled        = useJarvisStore(s => s.voiceEnabled);
  const voiceSettings       = useJarvisStore(s => s.voiceSettings);
  const pushAgentEvent      = useJarvisStore(s => s.pushAgentEvent);
  const pendingVoiceQuery   = useJarvisStore(s => s.pendingVoiceQuery);
  const setPendingVoiceQuery = useJarvisStore(s => s.setPendingVoiceQuery);

  const [roster, setRoster]     = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [messages, setMessages] = useState<OrbMsg[]>([]);
  const [input, setInput]       = useState('');
  const [streaming, setStreaming] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLInputElement>(null);
  const stopStreamRef   = useRef<(() => void) | null>(null);
  const streamBufRef    = useRef('');
  const voicesRef       = useRef<SpeechSynthesisVoice[]>([]);

  // Orb amplitude refs
  const coreRef = useRef<HTMLDivElement>(null);
  const ampRafRef = useRef<number>(0);

  // Countdown state for auto-send
  const [countdown, setCountdown] = useState<{ progress: number } | null>(null);
  const countdownRafRef = useRef<number | null>(null);
  const countdownStartRef = useRef<number>(0);

  const greeting = getGreeting(displayName);

  useEffect(() => {
    getOnboardingStatus().then(s => setDisplayName(s.profile.displayName));
  }, []);

  useEffect(() => {
    getRoster().then(setRoster).catch(() => {});
    if ('speechSynthesis' in window) {
      getVoices().then(v => { voicesRef.current = v; });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speaking amplitude pulse
  useEffect(() => {
    cancelAnimationFrame(ampRafRef.current);
    if (orbStatus !== 'speaking') {
      if (coreRef.current) coreRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
      return;
    }
    const animate = () => {
      if (coreRef.current) {
        const t = Date.now() / 1000;
        const amp =
          0.45 * Math.abs(Math.sin(t * 3.1)) +
          0.30 * Math.abs(Math.sin(t * 5.7 + 1.2)) +
          0.25 * Math.abs(Math.sin(t * 2.1 + 0.7));
        coreRef.current.style.transform = `translate(-50%, -50%) scale(${1 + amp * 0.14})`;
      }
      ampRafRef.current = requestAnimationFrame(animate);
    };
    ampRafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ampRafRef.current);
  }, [orbStatus]);

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
    setOrbStatus('thinking');
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
        speakResponse(fullResponse, voiceSettings);
      },
      (err) => {
        setStreaming(false);
        const isOffline = err.includes('unreachable') || err.includes('fetch') || err.includes('network');
        if (isOffline) {
          setOrbStatus('offline');
        } else {
          // Coral flash, then settle back to idle — spec §4: "single pulse, not sustained".
          setOrbStatus('error');
          setTimeout(() => setOrbStatus('online'), 900);
        }
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
    analyserRef, startListening, toggleListening,
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

  const activeAgent = roster.find(a => a.id === orbActiveAgentId) ?? roster[0];
  const hasMessages = messages.length > 0;

  return (
    <div className="orb-chat-panel j-panel j-panel-thick" style={style}>
      <button className="orb-chat-close-btn" onClick={onClose} title="Close">
        <X size={14} />
      </button>

      {/* Orb Visual Area */}
      <div className="orb-chat-visual-area">
        <div style={{ position: 'relative', width: 90, height: 90, transform: 'scale(1.15)' }}>
          <div className={`jarvis-orb-container ${voiceEnabled ? orbStatus : 'muted'}`}>
            <div className={`orb-glow ${voiceEnabled ? orbStatus : 'muted'}`} />
            <div className="orb-arc orb-arc-1" />
            <div className="orb-arc orb-arc-2" />
            <div className="orb-ring orb-ring-outer"><div className="orb-moon" /></div>
            <div className="orb-ring orb-ring-inner"><div className="orb-beacon" /></div>
            <div className="orb-core" ref={coreRef} />
            {!voiceEnabled && <MicOff size={16} className="orb-muted-icon" />}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="orb-chat-content-area">
        {!hasMessages ? (
          <div className="orb-chat-greeting">
            <div className="orb-chat-greeting-title">{greeting.title}</div>
            <div className="orb-chat-greeting-sub">{greeting.sub}</div>
          </div>
        ) : (
          <div className="orb-chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`orb-chat-msg ${msg.role === 'user' ? 'orb-chat-msg-user' : msg.role === 'error' ? 'orb-chat-msg-error' : 'orb-chat-msg-assistant'}`}>
                {msg.role === 'assistant' && !msg.content && streaming ? (
                  <span className="orb-chat-typing">PROCESSING...</span>
                ) : (
                  msg.content
                )}
                {msg.role === 'assistant' && msg.content && (
                  <div className="orb-chat-msg-footer">
                    <span>{(msg.agentId ?? orbActiveAgentId).toUpperCase()}</span>
                    {msg.latencyMs != null && <span>{msg.latencyMs}ms</span>}
                    {msg.tokens   != null && <span>{msg.tokens} tok</span>}
                    {msg.costUsd  != null && msg.costUsd > 0 && <span>${msg.costUsd.toFixed(4)}</span>}
                    {msg.wasSpoken && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Volume2 size={10} /> SPOKEN</span>}
                    {'speechSynthesis' in window && (
                      <button
                        className="orb-chat-msg-speak-btn"
                        title="Replay"
                        onClick={() => speakResponse(msg.content, voiceSettings)}
                      >
                        <Volume2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="orb-chat-input-container">
        <div className="orb-chat-input-wrapper">
          <button
            className={`orb-chat-mic-btn ${isListening ? 'listening' : ''}`}
            title={voiceInputAvailable ? (isListening ? 'Stop listening' : 'Voice input') : 'Voice input requires Chrome or Edge'}
            disabled={!voiceInputAvailable}
            onClick={toggleListening}
          >
            {isListening ? (
              <InputWaveform analyserRef={analyserRef} active={isListening} />
            ) : (
              <Mic size={14} />
            )}
          </button>

          {pendingTranscript ? (
            <>
              <div className="orb-chat-pending-text">
                {pendingTranscript}
              </div>
              <button onClick={cancelAutoSend} className="orb-chat-cancel-btn">
                X CANCEL
              </button>
            </>
          ) : isListening && interim ? (
            <div className="orb-chat-pending-text interim">
              Hearing: {interim}…
            </div>
          ) : (
            <input
              ref={inputRef}
              className="orb-chat-input"
              placeholder="Ask anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(input); }}
              disabled={streaming}
            />
          )}

          <button
            className="orb-chat-send-btn"
            disabled={streaming || (!input.trim() && !isListening && !pendingTranscript)}
            onClick={() => handleSend(input)}
          >
            <Send size={14} strokeWidth={2.2} />
          </button>

          {pendingTranscript && countdown && (
            <div className="orb-chat-countdown-bar-container">
              <div
                className="orb-chat-countdown-bar-fill"
                style={{ width: `${(1 - countdown.progress) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Agents Row */}
        <div className="orb-chat-agents-row">
          <span className="orb-chat-agents-label">CONNECTED</span>
          {roster.slice(0, 6).map(agent => (
            <button
              key={agent.id}
              className={`orb-chat-agent-pill ${agent.id === orbActiveAgentId ? 'active' : ''}`}
              onClick={() => setOrbActiveAgentId(agent.id)}
              style={{
                borderColor: agent.id === orbActiveAgentId
                  ? (AGENT_COLORS[agent.id] ?? 'var(--j-teal)')
                  : undefined,
                color: agent.id === orbActiveAgentId
                  ? (AGENT_COLORS[agent.id] ?? 'var(--j-teal)')
                  : undefined,
              }}
            >
              {agent.initials}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
