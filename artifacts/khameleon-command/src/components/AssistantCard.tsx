import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, MicOff } from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';
import {
  streamAgentChat,
  FALLBACK_ROSTER,
  getRoster,
  type AgentConfig,
  type ChatMessage,
} from '@/lib/agentsApi';
import type { VoiceSettings } from '@/store/jarvisStore';
// reuse orb visual styles (JarvisOrb.tsx imports this too, but we need it standalone on the assistant page)
import './orb/orb.css';

const PREFERRED_VOICES = [
  'Google UK English Male',
  'Microsoft Ryan Online (Natural) - English (United Kingdom)',
  'Daniel', 'Alex',
];

interface AcMsg {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  agentId?: string;
}

function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise(resolve => {
    const v = window.speechSynthesis.getVoices();
    if (v.length > 0) { resolve(v); return; }
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
  });
}

function getGreeting(): { title: string; sub: string } {
  const h = new Date().getHours();
  const title =
    h >= 5  && h < 12 ? 'Good morning.'   :
    h >= 12 && h < 18 ? 'Good afternoon.' : 'Good evening.';
  return { title, sub: 'How can I help you blend in today?' };
}

const AGENT_COLORS: Record<string, string> = {
  claude:     '#c9a84c',
  gpt4o:      '#00d4ff',
  gemini:     '#3fb950',
  openrouter: '#a78bfa',
  local:      '#f97316',
  minimax:    '#ec4899',
};

export function AssistantCard() {
  const orbStatus           = useJarvisStore(s => s.orbStatus);
  const setOrbStatus        = useJarvisStore(s => s.setOrbStatus);
  const orbActiveAgentId    = useJarvisStore(s => s.orbActiveAgentId);
  const setOrbActiveAgentId = useJarvisStore(s => s.setOrbActiveAgentId);
  const voiceEnabled        = useJarvisStore(s => s.voiceEnabled);
  const voiceSettings       = useJarvisStore(s => s.voiceSettings);
  const pushAgentEvent      = useJarvisStore(s => s.pushAgentEvent);

  const [roster, setRoster]     = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [messages, setMessages] = useState<AcMsg[]>([]);
  const [input, setInput]       = useState('');
  const [streaming, setStreaming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const stopStreamRef  = useRef<(() => void) | null>(null);
  const streamBufRef   = useRef('');
  const voicesRef      = useRef<SpeechSynthesisVoice[]>([]);
  const coreRef        = useRef<HTMLDivElement>(null);
  const ampRafRef      = useRef<number>(0);

  const greeting = getGreeting();

  useEffect(() => {
    getRoster().then(setRoster).catch(() => {});
    if ('speechSynthesis' in window) getVoices().then(v => { voicesRef.current = v; });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Speaking amplitude pulse (same logic as JarvisOrb)
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

  // TTS
  const speakResponse = useCallback((text: string, settings: VoiceSettings) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text
      .replace(/#{1,6}\s/g, '').replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1')
      .replace(/```[\s\S]*?```/g, 'code block omitted')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/\n+/g, '. ').trim().slice(0, settings.maxSpeakLength);
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = settings.rate; utterance.pitch = settings.pitch;
    utterance.volume = settings.volume; utterance.lang = settings.lang;
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
    let sel: SpeechSynthesisVoice | null = null;
    for (const name of PREFERRED_VOICES) { sel = voices.find(v => v.name === name) ?? null; if (sel) break; }
    if (!sel && settings.voice) sel = voices.find(v => v.name === settings.voice) ?? null;
    if (!sel) sel = voices.find(v => v.lang.startsWith('en')) ?? null;
    if (sel) utterance.voice = sel;
    utterance.onstart = () => setOrbStatus('speaking');
    utterance.onend   = () => setOrbStatus('online');
    utterance.onerror = () => setOrbStatus('online');
    const keepAlive = setInterval(() => {
      if (window.speechSynthesis.speaking) { window.speechSynthesis.pause(); window.speechSynthesis.resume(); }
      else clearInterval(keepAlive);
    }, 10000);
    window.speechSynthesis.speak(utterance);
  }, [setOrbStatus]);

  // Send
  const handleSend = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: AcMsg = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    setOrbStatus('thinking');
    streamBufRef.current = '';

    const history: ChatMessage[] = [
      ...messages.filter(m => m.role !== 'error')
        .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content })),
      { role: 'user' as const, content: trimmed },
    ];

    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', agentId: orbActiveAgentId }]);

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
        const full = streamBufRef.current;
        pushAgentEvent({
          id: assistantId, prompt: trimmed, response: full,
          model: done.model, agent: orbActiveAgentId,
          ts: Date.now(), durationMs: done.latencyMs, tokens: done.tokens, costUsd: done.costUsd,
        });
        speakResponse(full, voiceSettings);
      },
      (err) => {
        setStreaming(false);
        const offline = err.includes('unreachable') || err.includes('fetch') || err.includes('network');
        if (offline) {
          setOrbStatus('offline');
        } else {
          // Coral flash, then settle back to idle — spec §4: "single pulse, not sustained".
          setOrbStatus('error');
          setTimeout(() => setOrbStatus('online'), 900);
        }
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, role: 'error' as const, content: offline ? 'CONNECTION LOST' : `AGENT ERROR — ${err}` }
            : m
        ));
      },
    );
  }, [streaming, messages, orbActiveAgentId, setOrbStatus, voiceSettings, pushAgentEvent, speakResponse]);

  const hasMessages = messages.length > 0;

  const orbEl = (
    <div style={{ position: 'relative', width: 90, height: 90 }}>
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
  );

  const askBarEl = (
    <div className="ac-input-wrap">
      <input
        ref={inputRef}
        className="ac-input"
        placeholder="Ask anything..."
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSend(input); }}
        disabled={streaming}
      />
      <button
        className="ac-send-btn"
        disabled={streaming || !input.trim()}
        onClick={() => handleSend(input)}
        title="Send"
      >
        <Send size={13} strokeWidth={2.2} />
      </button>
    </div>
  );

  const agentsRowEl = (
    <div className="ac-agents-row">
      <span className="ac-connected-label">Connected</span>
      {roster.slice(0, 5).map(agent => (
        <button
          key={agent.id}
          className={`ac-agent-pill${agent.id === orbActiveAgentId ? ' active' : ''}`}
          title={agent.name}
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
      <span className="ac-tool-add" title="Add a connection">+</span>
    </div>
  );

  const messagesEl = (
    <div className="ac-messages">
      {messages.map(msg => (
        <div key={msg.id} className={
          msg.role === 'user' ? 'ac-msg-user' :
          msg.role === 'error' ? 'ac-msg-error' : 'ac-msg-assistant'
        }>
          {msg.role === 'assistant' && !msg.content && streaming
            ? <span style={{ opacity: 0.45, fontFamily: 'var(--j-font-mono)', fontSize: 10 }}>PROCESSING…</span>
            : msg.content}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );

  return (
    <div className="ac-card">
      <div className="ac-orb-area">{orbEl}</div>
      {!hasMessages ? (
        <div className="ac-greeting">
          <div className="ac-greeting-title">{greeting.title}</div>
          <div className="ac-greeting-sub">{greeting.sub}</div>
        </div>
      ) : messagesEl}
      <div className="ac-input-row">{askBarEl}</div>
      {agentsRowEl}
    </div>
  );
}
