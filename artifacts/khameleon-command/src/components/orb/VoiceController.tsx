import { useCallback, useEffect, useRef, useState } from 'react';
import { useKhameleonStore } from '@/store/khameleonStore';
import { MicPermissionModal } from './MicPermissionModal';

// Exported so Settings' Voice section can read the same key for display
// (granted/denied/not-yet-asked) without duplicating the string literal.
export const MIC_KEY = 'jarvis_mic_granted'; // old working name kept so the saved choice survives
const WAKE_PHRASES = ['hello khameleon', 'hey khameleon', 'ok khameleon', 'khameleon'];

type WakeStatus = 'idle' | 'waiting' | 'listening' | 'blocked';

function getSR() {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as typeof SpeechRecognition | undefined;
}

export function VoiceController() {
  const wakeWordActive      = useKhameleonStore(s => s.wakeWordActive);
  const wakeWordBlocked     = useKhameleonStore(s => s.wakeWordBlocked);
  const setWakeWordBlocked  = useKhameleonStore(s => s.setWakeWordBlocked);
  const setOrbStatus        = useKhameleonStore(s => s.setOrbStatus);
  const openOrbChat         = useKhameleonStore(s => s.openOrbChat);
  const setPendingVoiceQuery = useKhameleonStore(s => s.setPendingVoiceQuery);
  const voiceSettings       = useKhameleonStore(s => s.voiceSettings);
  const orbStatus           = useKhameleonStore(s => s.orbStatus);
  // Lives in the store (not local state) so Settings' Voice section can
  // reopen this after a user skips it the first time - see the store
  // comment on micPermissionModalOpen for why.
  const showModal           = useKhameleonStore(s => s.micPermissionModalOpen);
  const setShowModal        = useKhameleonStore(s => s.setMicPermissionModalOpen);

  const [wakeStatus, setWakeStatus] = useState<WakeStatus>('idle');

  const wakeRecRef      = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const queryRecRef     = useRef<InstanceType<typeof SpeechRecognition> | null>(null);
  const isQueryActiveRef = useRef(false);
  const prevOrbStatus   = useRef(orbStatus);
  const shouldRestartRef = useRef(false);

  const inputAvailable = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startWakeListener = useCallback(() => {
    const SR = getSR();
    if (!SR || !wakeWordActive || wakeWordBlocked || isQueryActiveRef.current) return;

    wakeRecRef.current?.abort();

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = voiceSettings.lang;

    rec.onstart = () => setWakeStatus('waiting');

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join(' ')
        .toLowerCase()
        .trim();

      const triggered = WAKE_PHRASES.some(p => transcript.includes(p));
      if (!triggered) return;

      rec.stop();
      wakeRecRef.current = null;
      setOrbStatus('listening');
      openOrbChat();

      let query = transcript;
      WAKE_PHRASES.forEach(p => { query = query.replace(p, '').trim(); });

      if (query.length > 2) {
        shouldRestartRef.current = true;
        setTimeout(() => setPendingVoiceQuery(query), 400);
      } else {
        startQueryListener();
      }
    };

    rec.onend = () => {
      if (wakeWordActive && !isQueryActiveRef.current && wakeRecRef.current === rec) {
        wakeRecRef.current = null;
        setTimeout(startWakeListener, 300);
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed') {
        setWakeWordBlocked(true);
        setWakeStatus('blocked');
        return;
      }
      if (wakeWordActive && !isQueryActiveRef.current) {
        setTimeout(startWakeListener, 500);
      }
    };

    rec.start();
    wakeRecRef.current = rec;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeWordActive, wakeWordBlocked, voiceSettings.lang]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startQueryListener = useCallback(() => {
    const SR = getSR();
    if (!SR) return;

    isQueryActiveRef.current = true;
    setWakeStatus('listening');

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = voiceSettings.lang;
    let finalText = '';

    rec.onresult = (e: SpeechRecognitionEvent) => {
      finalText = Array.from(e.results).map(r => r[0].transcript).join('').trim();
    };

    rec.onend = () => {
      isQueryActiveRef.current = false;
      queryRecRef.current = null;
      if (finalText.length > 1) {
        shouldRestartRef.current = true;
        openOrbChat();
        setPendingVoiceQuery(finalText);
      } else {
        setOrbStatus('online');
        setTimeout(startWakeListener, 300);
      }
      setWakeStatus('waiting');
    };

    rec.onerror = () => {
      isQueryActiveRef.current = false;
      queryRecRef.current = null;
      setOrbStatus('online');
      setTimeout(startWakeListener, 500);
      setWakeStatus('waiting');
    };

    rec.start();
    queryRecRef.current = rec;
  }, [voiceSettings.lang, setPendingVoiceQuery, setOrbStatus, startWakeListener]);

  // A direct Orb click starts voice even when the typed popup is closed.
  useEffect(() => {
    const startFromOrb = () => startQueryListener();
    window.addEventListener('khameleon-orb-start-listening', startFromOrb);
    return () => window.removeEventListener('khameleon-orb-start-listening', startFromOrb);
  }, [startQueryListener]);

  // Restart wake listener after TTS finishes
  useEffect(() => {
    if (prevOrbStatus.current === 'speaking' && orbStatus === 'online') {
      if (wakeWordActive && !wakeWordBlocked && shouldRestartRef.current) {
        shouldRestartRef.current = false;
        const t = setTimeout(startWakeListener, 600);
        return () => clearTimeout(t);
      }
    }
    prevOrbStatus.current = orbStatus;
    return undefined;
  }, [orbStatus, wakeWordActive, wakeWordBlocked, startWakeListener]);

  // Boot sequence on mount. Voice is something people switch on in
  // Settings → Voice (which opens the microphone prompt); it never pops up
  // on first run (download decisions, step 2, 2026-10-20 - the first-run
  // setup stays short, and on-device voice replaces browser speech later).
  useEffect(() => {
    if (!inputAvailable) return;

    const stored = localStorage.getItem(MIC_KEY);
    if (stored === 'true') {
      startWakeListener();
    } else if (stored === 'denied') {
      setWakeWordBlocked(true);
      setWakeStatus('blocked');
    } else {
      setWakeStatus('blocked'); // not switched on yet
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to wakeWordActive toggle
  useEffect(() => {
    if (!inputAvailable) return;
    if (wakeWordActive && !wakeWordBlocked && localStorage.getItem(MIC_KEY) === 'true') {
      startWakeListener();
    } else if (!wakeWordActive) {
      wakeRecRef.current?.stop();
      wakeRecRef.current = null;
      setWakeStatus('idle');
    }
  }, [wakeWordActive, wakeWordBlocked, inputAvailable, startWakeListener]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wakeRecRef.current?.abort();
      queryRecRef.current?.abort();
    };
  }, []);

  const handleGrant = useCallback(() => {
    setShowModal(false);
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        localStorage.setItem(MIC_KEY, 'true');
        startWakeListener();
      })
      .catch(() => {
        localStorage.setItem(MIC_KEY, 'denied');
        setWakeWordBlocked(true);
        setWakeStatus('blocked');
      });
  }, [startWakeListener, setWakeWordBlocked]);

  const handleSkip = useCallback(() => {
    setShowModal(false);
    localStorage.setItem(MIC_KEY, 'denied');
    setWakeWordBlocked(true);
    setWakeStatus('blocked');
  }, [setWakeWordBlocked]);

  const indicatorLabel = wakeWordBlocked
    ? null  // blocked is now the silent default; user enables voice from Settings
    : wakeStatus === 'listening'
      ? '🎤 HEARING YOU...'
      : wakeStatus === 'waiting'
        ? "👂 LISTENING FOR 'HELLO KHAMELEON'"
        : null;

  const indicatorColor = wakeWordBlocked
    ? 'rgba(192,21,42,0.5)'
    : wakeStatus === 'listening'
      ? '#c9a84c'
      : 'rgba(0,212,255,0.4)';

  return (
    <>
      {showModal && <MicPermissionModal onGranted={handleGrant} onSkipped={handleSkip} />}

      {indicatorLabel && (
        <div
          style={{
            position: 'fixed',
            bottom: 36,
            left: 14,
            zIndex: 9997,
            fontFamily: 'var(--j-font-mono)',
            fontSize: 10,
            color: indicatorColor,
            letterSpacing: '0.08em',
            pointerEvents: 'none',
            animation: wakeStatus === 'waiting' ? 'khameleon-wake-pulse 2s ease-in-out infinite' : undefined,
          }}
        >
          {indicatorLabel}
        </div>
      )}
    </>
  );
}
