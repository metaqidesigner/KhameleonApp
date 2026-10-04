import { useCallback, useEffect, useRef, useState } from 'react';
import { useJarvisStore } from '@/store/jarvisStore';

export interface UseVoiceReturn {
  voiceInputAvailable: boolean;
  voiceOutputAvailable: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  interim: string;
  pendingTranscript: string | null;
  analyserRef: React.RefObject<AnalyserNode | null>;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  speak: (text: string) => void;
  cancelSpeech: () => void;
  cancelAutoSend: () => void;
  availableVoices: SpeechSynthesisVoice[];
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/_(.+?)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\$/g, 'dollars')
    .replace(/%/g, ' percent')
    .replace(/\bms\b/g, ' milliseconds')
    .replace(/\btok\b/g, ' tokens');
}

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
// Calls POST /api/voice/tts, streams the audio/mpeg response, plays via Web Audio.
// Returns a stop() function that aborts playback. Throws on error so the caller
// can fall back to speechSynthesis.
async function playElevenLabs(
  text: string,
  voiceId: string,
  modelId: string,
  rate: number,
  volume: number,
  onStart: () => void,
  onEnd: () => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice_id: voiceId, model_id: modelId, speed: rate }),
    signal,
  });

  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  if (signal.aborted) return;

  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(arrayBuffer);
  if (signal.aborted) { ctx.close(); return; }

  // Volume previously had no effect on the ElevenLabs path at all - the
  // source connected straight to destination. A real gain node closes that.
  const gain = ctx.createGain();
  gain.gain.value = volume;

  const source = ctx.createBufferSource();
  source.buffer = decoded;
  source.connect(gain);
  gain.connect(ctx.destination);

  onStart();

  await new Promise<void>((resolve) => {
    source.onended = () => resolve();
    signal.addEventListener('abort', () => { source.stop(); ctx.close(); resolve(); });
    source.start(0);
  });

  ctx.close();
  onEnd();
}

export function useVoice(
  onTranscript: (text: string) => void,
  onListenStart?: () => void,
  onListenEnd?: () => void,
): UseVoiceReturn {
  const voiceSettings = useJarvisStore(s => s.voiceSettings);
  const setOrbStatus  = useJarvisStore(s => s.setOrbStatus);
  const autoSpeak     = useJarvisStore(s => s.autoSpeak);

  const [voiceInputAvailable] = useState(() =>
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
  const [voiceOutputAvailable] = useState(() =>
    typeof window !== 'undefined' && 'speechSynthesis' in window
  );
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [interim, setInterim]         = useState('');
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices]     = useState<SpeechSynthesisVoice[]>([]);

  const recognitionRef     = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const analyserRef        = useRef<AnalyserNode | null>(null);
  const audioCtxRef        = useRef<AudioContext | null>(null);
  const autoSendTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');
  const ttsAbortRef        = useRef<AbortController | null>(null);

  // Async voices load (Chrome loads them lazily)
  useEffect(() => {
    if (!voiceOutputAvailable) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
      if (v.length) setAvailableVoices(v);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [voiceOutputAvailable]);

  const stopMicStream = useCallback(() => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
    }
  }, []);

  const cancelAutoSend = useCallback(() => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    setPendingTranscript(null);
    finalTranscriptRef.current = '';
  }, []);

  const startListening = useCallback(async () => {
    if (!voiceInputAvailable || isListening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch {
      // mic denied — continue without waveform
    }

    const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition as typeof window.SpeechRecognition
      || (window as unknown as Record<string, unknown>).webkitSpeechRecognition as typeof window.SpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = voiceSettings.lang;

    finalTranscriptRef.current = '';

    rec.onstart = () => {
      setIsListening(true);
      setOrbStatus('listening');
      onListenStart?.();
    };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let final = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interimText += e.results[i][0].transcript;
      }
      if (final) finalTranscriptRef.current += final;
      setInterim(interimText);
    };

    rec.onend = () => {
      setIsListening(false);
      setInterim('');
      setOrbStatus('online');
      stopMicStream();
      onListenEnd?.();

      const text = finalTranscriptRef.current.trim();
      if (text) {
        setPendingTranscript(text);
        autoSendTimerRef.current = setTimeout(() => {
          setPendingTranscript(null);
          onTranscript(text);
          finalTranscriptRef.current = '';
        }, voiceSettings.autoSendDelay);
      }
    };

    rec.onerror = () => {
      setIsListening(false);
      setInterim('');
      setOrbStatus('online');
      stopMicStream();
      onListenEnd?.();
    };

    recognitionRef.current = rec;
    rec.start();
  }, [voiceInputAvailable, isListening, voiceSettings, setOrbStatus, onTranscript, onListenStart, onListenEnd, stopMicStream]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
    setPendingTranscript(null);
    stopMicStream();
    setIsListening(false);
    setInterim('');
  }, [stopMicStream]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  // ── speak: ElevenLabs first, speechSynthesis fallback ──────────────────────
  const speak = useCallback((rawText: string) => {
    if (!autoSpeak) return;

    // Cancel any in-flight TTS
    ttsAbortRef.current?.abort();
    window.speechSynthesis.cancel();

    const text = stripMarkdown(rawText).slice(0, voiceSettings.maxSpeakLength);
    const full = rawText.length > voiceSettings.maxSpeakLength
      ? text + '... response continues in panel'
      : text;

    const ctrl = new AbortController();
    ttsAbortRef.current = ctrl;

    const onStart = () => { setIsSpeaking(true); setOrbStatus('speaking'); };
    const onEnd   = () => {
      if (!ctrl.signal.aborted) {
        setIsSpeaking(false);
        setOrbStatus('online');
      }
    };

    // Try ElevenLabs; fall back to speechSynthesis on any error
    playElevenLabs(
      full,
      voiceSettings.elevenLabsVoiceId,
      voiceSettings.elevenLabsModelId,
      voiceSettings.rate,
      voiceSettings.volume,
      onStart,
      onEnd,
      ctrl.signal,
    ).catch(() => {
      if (ctrl.signal.aborted) return;
      // Fallback: Web Speech API
      if (!('speechSynthesis' in window)) return;

      const utterance = new SpeechSynthesisUtterance(full);
      utterance.rate   = voiceSettings.rate;
      utterance.pitch  = voiceSettings.pitch;
      utterance.volume = voiceSettings.volume;
      utterance.lang   = voiceSettings.lang;

      const preferred = [
        'Google UK English Male',
        'Microsoft Ryan Online (Natural) - English (United Kingdom)',
        'Microsoft Guy Online (Natural) - English (United States)',
        'Daniel',
        'Alex',
      ];
      let sel: SpeechSynthesisVoice | null = null;
      for (const name of preferred) {
        sel = availableVoices.find(v => v.name === name) ?? null;
        if (sel) break;
      }
      if (!sel && voiceSettings.voice) sel = availableVoices.find(v => v.name === voiceSettings.voice) ?? null;
      if (!sel) sel = availableVoices.find(v => v.lang.startsWith('en')) ?? null;
      if (sel) utterance.voice = sel;

      utterance.onstart = onStart;
      utterance.onend   = onEnd;
      utterance.onerror = onEnd;

      // Chrome bug: TTS pauses after ~15s
      const keepAlive = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearInterval(keepAlive);
        }
      }, 10000);
      utterance.onend = () => { clearInterval(keepAlive); onEnd(); };

      window.speechSynthesis.speak(utterance);
    });
  }, [autoSpeak, voiceSettings, availableVoices, setOrbStatus]);

  const cancelSpeech = useCallback(() => {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setOrbStatus('online');
  }, [setOrbStatus]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
      ttsAbortRef.current?.abort();
      stopMicStream();
    };
  }, [stopMicStream]);

  return {
    voiceInputAvailable,
    voiceOutputAvailable,
    isListening,
    isSpeaking,
    interim,
    pendingTranscript,
    analyserRef,
    startListening,
    stopListening,
    toggleListening,
    speak,
    cancelSpeech,
    cancelAutoSend,
    availableVoices,
  };
}
