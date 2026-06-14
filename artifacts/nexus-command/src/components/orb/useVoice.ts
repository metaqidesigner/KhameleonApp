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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interim, setInterim] = useState('');
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const recognitionRef    = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const autoSendTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');

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

  const speak = useCallback((rawText: string) => {
    if (!voiceOutputAvailable || !autoSpeak) return;
    window.speechSynthesis.cancel();

    const text = stripMarkdown(rawText).slice(0, voiceSettings.maxSpeakLength);
    const full = rawText.length > voiceSettings.maxSpeakLength
      ? text + '... response continues in panel'
      : text;

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
    const voices = availableVoices;
    let sel: SpeechSynthesisVoice | null = null;
    for (const name of preferred) {
      sel = voices.find(v => v.name === name) ?? null;
      if (sel) break;
    }
    if (!sel && voiceSettings.voice) sel = voices.find(v => v.name === voiceSettings.voice) ?? null;
    if (!sel) sel = voices.find(v => v.lang.startsWith('en')) ?? null;
    if (sel) utterance.voice = sel;

    utterance.onstart = () => { setIsSpeaking(true); setOrbStatus('speaking'); };
    utterance.onend   = () => { setIsSpeaking(false); setOrbStatus('online'); };
    utterance.onerror = () => { setIsSpeaking(false); setOrbStatus('online'); };

    // Chrome bug: TTS pauses after ~15s
    const keepAlive = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } else {
        clearInterval(keepAlive);
      }
    }, 10000);

    window.speechSynthesis.speak(utterance);
  }, [voiceOutputAvailable, autoSpeak, voiceSettings, availableVoices, setOrbStatus]);

  const cancelSpeech = useCallback(() => {
    if (!voiceOutputAvailable) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setOrbStatus('online');
  }, [voiceOutputAvailable, setOrbStatus]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
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
