import { useCallback, useEffect, useRef, useState } from 'react';
import { useJarvisStore } from '@/store/jarvisStore';

export interface UseVoiceReturn {
  voiceInputAvailable: boolean;
  voiceOutputAvailable: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  interim: string;
  analyserRef: React.RefObject<AnalyserNode | null>;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  speak: (text: string) => void;
  cancelSpeech: () => void;
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
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    if (!voiceOutputAvailable) return;
    const load = () => setAvailableVoices(window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en')));
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
      // mic access denied — continue without waveform
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
        if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
        autoSendTimerRef.current = setTimeout(() => {
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
    utterance.rate = voiceSettings.rate;
    utterance.pitch = voiceSettings.pitch;
    utterance.volume = voiceSettings.volume;
    utterance.lang = voiceSettings.lang;

    const preferred = [
      'Google UK English Male',
      'Microsoft Ryan Online (Natural) - English (United Kingdom)',
      'Daniel',
      'Alex',
    ];
    const voices = availableVoices;
    for (const name of preferred) {
      const v = voices.find(v => v.name === name);
      if (v) { utterance.voice = v; break; }
    }
    if (!utterance.voice && voiceSettings.voice) {
      const v = voices.find(v => v.name === voiceSettings.voice);
      if (v) utterance.voice = v;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setOrbStatus('speaking');
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setOrbStatus('online');
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setOrbStatus('online');
    };

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
    analyserRef,
    startListening,
    stopListening,
    toggleListening,
    speak,
    cancelSpeech,
    availableVoices,
  };
}
