const BASE = import.meta.env.VITE_API_URL || '/api';

export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
}

export async function getTtsStatus(): Promise<{ configured: boolean }> {
  const res = await fetch(`${BASE}/voice/tts/status`);
  if (!res.ok) return { configured: false };
  return res.json();
}

/** Empty array (not a throw) when ElevenLabs isn't configured - callers fall back to a plain text input. */
export async function getElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const res = await fetch(`${BASE}/voice/voices`);
  if (!res.ok) return [];
  return res.json();
}

/** Plays a short sample through the real /api/voice/tts path with the current settings, falling back to speechSynthesis exactly like useVoice.ts does - so "preview" reflects what you'll actually hear. */
export async function previewVoice(text: string, voiceId: string, modelId: string, rate: number, pitch: number, volume: number): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/voice/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id: voiceId, model_id: modelId, speed: rate }),
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const source = ctx.createBufferSource();
    source.buffer = decoded;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
  } catch {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    window.speechSynthesis.speak(utterance);
  }
}
