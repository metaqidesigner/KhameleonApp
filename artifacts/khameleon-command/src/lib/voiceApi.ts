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
