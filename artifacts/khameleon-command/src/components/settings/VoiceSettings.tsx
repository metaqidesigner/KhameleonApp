import { useEffect, useState } from 'react';
import { useJarvisStore } from '@/store/jarvisStore';
import { MIC_KEY } from '@/components/orb/VoiceController';
import { getTtsStatus, getElevenLabsVoices, previewVoice, type ElevenLabsVoice } from '@/lib/voiceApi';
import { useUi, Label, Hint, Group, type Tone } from './ui';

/** Settings > Voice (gap review Q18, unchanged features): microphone, wake word, speed, volume, voice, preview. */
export function VoiceSettings({ tone }: { tone: Tone }) {
  const { t, input, btn } = useUi(tone);
  const wakeWordActive = useJarvisStore(s => s.wakeWordActive);
  const setWakeWordActive = useJarvisStore(s => s.setWakeWordActive);
  const setMicModal = useJarvisStore(s => s.setMicPermissionModalOpen);
  const voice = useJarvisStore(s => s.voiceSettings);
  const setVoice = useJarvisStore(s => s.setVoiceSettings);
  const [mic, setMic] = useState<'granted' | 'denied' | 'unknown'>('unknown');
  const [tts, setTts] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(MIC_KEY); } catch { /* storage blocked */ }
    setMic(stored === 'true' ? 'granted' : stored === 'denied' ? 'denied' : 'unknown');
    getTtsStatus().then(s => setTts(s.configured)).catch(() => {});
    getElevenLabsVoices().then(setVoices).catch(() => {});
  }, []);

  const slider = (label: string, value: number, min: number, max: number, onChange: (v: number) => void) => (
    <Group>
      <Label tone={tone}>{label}</Label>
      <input type="range" aria-label={label} min={min} max={max} step={0.05} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%', accentColor: tone === 'overlay' ? '#6FE6BD' : 'var(--j-cyan)' }} />
    </Group>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Group>
        <Label tone={tone}>Microphone</Label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: mic === 'granted' ? t.good : mic === 'denied' ? t.bad : t.muted, flex: 1 }}>
            {mic === 'granted' ? 'Allowed' : mic === 'denied' ? 'Not allowed' : 'Not asked yet'}
          </span>
          {mic !== 'granted' && <button type="button" style={btn()} onClick={() => setMicModal(true)}>{mic === 'denied' ? 'Ask again' : 'Allow'}</button>}
        </div>
      </Group>
      <Group>
        <Label tone={tone}>Wake word ("Hello Khameleon")</Label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[true, false].map(v => (
            <button key={String(v)} type="button" aria-pressed={wakeWordActive === v} disabled={mic !== 'granted'} onClick={() => setWakeWordActive(v)}
              style={{ ...btn(wakeWordActive === v), opacity: mic === 'granted' ? 1 : 0.5 }}>{v ? 'On' : 'Off'}</button>
          ))}
        </div>
        {mic !== 'granted' && <Hint tone={tone}>Allow the microphone first.</Hint>}
      </Group>
      {slider(`Speaking speed - ${voice.rate.toFixed(2)}×`, voice.rate, 0.7, 1.2, v => setVoice({ rate: v }))}
      {slider(`Volume - ${Math.round(voice.volume * 100)}%`, voice.volume, 0, 1, v => setVoice({ volume: v }))}
      <Group>
        <Label tone={tone}>Voice</Label>
        {tts === false || voices.length === 0
          ? <Hint tone={tone}>Using your computer's built-in voice.</Hint>
          : (
            <select aria-label="Voice" value={voice.elevenLabsVoiceId} onChange={e => setVoice({ elevenLabsVoiceId: e.target.value })} style={input}>
              {voices.map(v => <option key={v.voiceId} value={v.voiceId}>{v.name}</option>)}
            </select>
          )}
      </Group>
      <div>
        <button type="button" style={btn()} disabled={playing} onClick={() => { setPlaying(true); void previewVoice('This is how I will sound.', voice.elevenLabsVoiceId, voice.elevenLabsModelId, voice.rate, voice.pitch, voice.volume).finally(() => setPlaying(false)); }}>
          {playing ? 'Playing…' : 'Hear a sample'}
        </button>
      </div>
    </div>
  );
}
