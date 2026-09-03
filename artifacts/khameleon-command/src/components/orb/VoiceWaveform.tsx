import { useEffect, useRef } from 'react';

interface InputWaveformProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
  active: boolean;
}

export function InputWaveform({ analyserRef, active }: InputWaveformProps) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      barsRef.current.forEach(b => { if (b) b.style.height = '4px'; });
      return;
    }

    const analyser = analyserRef.current;
    if (!analyser) {
      const animate = () => {
        barsRef.current.forEach((b, i) => {
          if (!b) return;
          const h = 4 + Math.abs(Math.sin(Date.now() / 300 + i)) * 18;
          b.style.height = `${h}px`;
        });
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(rafRef.current);
    }

    const data = new Uint8Array(analyser.frequencyBinCount);
    const animate = () => {
      analyser.getByteFrequencyData(data);
      const slice = Math.floor(data.length / 5);
      barsRef.current.forEach((b, i) => {
        if (!b) return;
        const avg = data.slice(i * slice, (i + 1) * slice).reduce((a, c) => a + c, 0) / slice;
        const h = 4 + (avg / 255) * 20;
        b.style.height = `${h}px`;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, analyserRef]);

  return (
    <div className="orb-input-waveform">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="wave-bar"
          ref={el => { barsRef.current[i] = el; }}
          style={{ height: '4px' }}
        />
      ))}
    </div>
  );
}

interface OutputWaveformProps {
  visible: boolean;
}

export function OutputWaveform({ visible }: OutputWaveformProps) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!visible) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    const phases = [0, 0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6];
    const animate = () => {
      const t = Date.now() / 400;
      barsRef.current.forEach((b, i) => {
        if (!b) return;
        const h = 4 + Math.abs(Math.sin(t + phases[i])) * 14;
        b.style.height = `${h}px`;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [visible]);

  return (
    <div className={`orb-output-waveform${visible ? ' visible' : ''}`}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <div
          key={i}
          className="wave-bar"
          ref={el => { barsRef.current[i] = el; }}
          style={{ height: '4px' }}
        />
      ))}
    </div>
  );
}
