import { useEffect, useRef } from "react";

// The analyser is connected to the SAME audio element that the listener hears.
// A future Khameleon output stream can replace the demo element's src.
export function useOrbOutputAudio(onEnded: () => void) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const reset = () => {
      cancelAnimationFrame(frameRef.current);
      orbRef.current?.style.setProperty("--voice-level", "0");
      orbRef.current?.style.setProperty("--voice-pitch", ".5");
    };
    const ended = () => { reset(); onEndedRef.current(); };
    audio.addEventListener("ended", ended);
    return () => {
      audio.removeEventListener("ended", ended);
      audio.pause();
      reset();
      void contextRef.current?.close();
    };
  }, []);

  function sample() {
    const analyser = analyserRef.current;
    const audio = audioRef.current;
    if (!analyser || !audio || audio.paused) return;
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    let power = 0;
    for (const sample of samples) power += sample * sample;
    const rms = Math.sqrt(power / samples.length);
    const level = Math.min(1, Math.max(0, (rms - 0.008) * 7));

    // Autocorrelation estimates the fundamental of voiced frames, rather
    // than treating volume or a preset loop as a stand-in for vocal pitch.
    let bestLag = 0;
    let bestCorrelation = 0;
    if (rms > 0.015) {
      const rate = contextRef.current?.sampleRate ?? 48000;
      const minLag = Math.floor(rate / 420);
      const maxLag = Math.min(Math.floor(rate / 85), samples.length / 2);
      for (let lag = minLag; lag <= maxLag; lag += 2) {
        let correlation = 0, normA = 0, normB = 0;
        for (let i = 0; i < 1024; i += 2) {
          const a = samples[i], b = samples[i + lag];
          correlation += a * b;
          normA += a * a;
          normB += b * b;
        }
        const score = correlation / (Math.sqrt(normA * normB) || 1);
        if (score > bestCorrelation) { bestCorrelation = score; bestLag = lag; }
      }
    }
    const pitch = bestCorrelation > 0.45 && bestLag
      ? Math.max(0, Math.min(1, ((contextRef.current?.sampleRate ?? 48000) / bestLag - 85) / 335))
      : 0.5;
    const orb = orbRef.current;
    if (orb) {
      const current = Number(orb.style.getPropertyValue("--voice-level")) || 0;
      const smoothed = current * 0.65 + level * 0.35;
      orb.style.setProperty("--voice-level", String(smoothed));
      orb.style.setProperty("--voice-pitch", String(pitch));
      orb.style.setProperty("--voice-shift-x", `${(pitch - 0.5) * 10}px`);
      orb.style.setProperty("--voice-shift-y", `${(0.5 - pitch) * 8}px`);
      orb.style.setProperty("--voice-scale", String(1.015 + smoothed * 0.22));
      orb.style.setProperty("--voice-angle", `${(pitch - 0.5) * 14}deg`);
      orb.style.setProperty("--voice-dust-opacity", String(0.4 + smoothed * 0.6));
    }
    frameRef.current = requestAnimationFrame(sample);
  }

  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!contextRef.current) {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaElementSource(audio).connect(analyser);
      analyser.connect(context.destination);
      contextRef.current = context;
      analyserRef.current = analyser;
    }
    await contextRef.current.resume();
    audio.currentTime = 0;
    await audio.play();
    cancelAnimationFrame(frameRef.current);
    sample();
  }

  function stop() {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    cancelAnimationFrame(frameRef.current);
    orbRef.current?.style.setProperty("--voice-level", "0");
  }

  return { audioRef, orbRef, play, stop };
}