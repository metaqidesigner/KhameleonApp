import { useEffect, useRef } from 'react';

interface BrainCanvasProps {
  w: number;
  h: number;
  isStreaming?: boolean;
  activeAngle?: number | null;
  connectedModules?: number;
  isOffline?: boolean;
}

export function BrainCanvas({
  w, h,
  isStreaming = false,
  activeAngle = null,
  connectedModules = 0,
  isOffline = false,
}: BrainCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ isStreaming, activeAngle, connectedModules, isOffline });
  propsRef.current = { isStreaming, activeAngle, connectedModules, isOffline };

  useEffect(() => {
    if (!w || !h) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = w / 2, cy = h / 2;
    const brainR = Math.min(w, h) * 0.2;
    const N = Math.min(70 + connectedModules * 4, 140);

    const neurons = Array.from({ length: N }, () => {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.pow(Math.random(), 0.6) * brainR * 0.9;
      return {
        x: cx + Math.cos(ang) * dist,
        y: cy + Math.sin(ang) * dist,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: 1.2 + Math.random() * 2.8,
        pulse: Math.random() * Math.PI * 2,
        speed: 0.018 + Math.random() * 0.035,
        brightness: 0.5 + Math.random() * 0.5,
      };
    });

    const conns: { a: number; b: number; signal: number; signalSpeed: number; active: boolean }[] = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = neurons[i].x - neurons[j].x;
        const dy = neurons[i].y - neurons[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < brainR * 0.48) {
          conns.push({ a: i, b: j, signal: 0, signalSpeed: 0.005 + Math.random() * 0.015, active: false });
        }
      }
    }

    let frame = 0;
    let raf: number;
    // bloom on load
    let bloomAlpha = 1.0;

    const draw = () => {
      const { isStreaming, activeAngle, isOffline } = propsRef.current;
      const speedMult = isOffline ? 0.2 : isStreaming ? 3 : 1;
      const opacityMult = isOffline ? 0.4 : 1;

      ctx.clearRect(0, 0, w, h);

      // Ambient glow
      const amb = ctx.createRadialGradient(cx, cy, 0, cx, cy, brainR * 1.8);
      amb.addColorStop(0, `rgba(0,90,180,${0.1 * opacityMult})`);
      amb.addColorStop(0.5, `rgba(0,40,80,${0.05 * opacityMult})`);
      amb.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = amb;
      ctx.fillRect(0, 0, w, h);

      // Bloom on load
      if (bloomAlpha > 0) {
        const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, brainR * 1.5);
        bloom.addColorStop(0, `rgba(0,212,255,${bloomAlpha * 0.35})`);
        bloom.addColorStop(0.4, `rgba(0,130,210,${bloomAlpha * 0.12})`);
        bloom.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bloom;
        ctx.fillRect(0, 0, w, h);
        bloomAlpha = Math.max(0, bloomAlpha - 0.012);
      }

      // Fire signals
      const fireRate = Math.round(6 / speedMult);
      if (frame % Math.max(1, fireRate) === 0 && conns.length) {
        const fireBatch = isStreaming ? 4 : 1;
        for (let b = 0; b < fireBatch; b++) {
          const c = conns[Math.floor(Math.random() * conns.length)];
          if (!c.active) { c.active = true; c.signal = 0; }
        }
      }

      // Connections
      for (const c of conns) {
        const na = neurons[c.a], nb = neurons[c.b];
        const dx = nb.x - na.x, dy = nb.y - na.y;

        if (c.active) {
          c.signal += c.signalSpeed * speedMult;
          if (c.signal >= 1) { c.active = false; c.signal = 0; }

          const sx = na.x + dx * c.signal, sy = na.y + dy * c.signal;

          ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
          ctx.strokeStyle = isStreaming
            ? `rgba(0,255,180,${0.55 * opacityMult})`
            : `rgba(0,212,255,${0.45 * opacityMult})`;
          ctx.lineWidth = isStreaming ? 1.6 : 1.2; ctx.stroke();

          const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 7);
          sg.addColorStop(0, 'rgba(180,240,255,0.95)');
          sg.addColorStop(0.4, isStreaming ? 'rgba(0,255,160,0.7)' : 'rgba(0,212,255,0.6)');
          sg.addColorStop(1, 'rgba(0,212,255,0)');
          ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
        } else {
          const dist = Math.sqrt(dx * dx + dy * dy);
          const op = Math.max(0, (0.14 - dist / (brainR * 7)) * opacityMult);
          ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
          ctx.strokeStyle = `rgba(0,130,210,${op})`; ctx.lineWidth = 0.5; ctx.stroke();
        }
      }

      // Neurons
      for (const n of neurons) {
        n.pulse += n.speed * speedMult;
        const pm = 0.75 + 0.25 * Math.sin(n.pulse);
        const r = n.r * pm;
        const alpha = (0.55 + 0.45 * pm) * n.brightness * opacityMult;

        const ng = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 5);
        ng.addColorStop(0, `rgba(0,212,255,${alpha * 0.9})`);
        ng.addColorStop(0.35, `rgba(0,160,230,${alpha * 0.35})`);
        ng.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(n.x, n.y, r * 5, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = `rgba(200,245,255,${alpha})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();

        n.x += n.vx; n.y += n.vy;
        const ex = n.x - cx, ey = n.y - cy;
        const ed = Math.sqrt(ex * ex + ey * ey);
        if (ed > brainR * 0.92) { n.vx -= (ex / ed) * 0.06; n.vy -= (ey / ed) * 0.06; }
        if (ed < 8) { n.vx += (Math.random() - 0.5) * 0.15; n.vy += (Math.random() - 0.5) * 0.15; }
      }

      // Active module beam
      if (activeAngle !== null) {
        const beamRad = (activeAngle - 90) * (Math.PI / 180);
        const beamPulse = 0.5 + 0.5 * Math.sin(frame * 0.063); // 1 Hz at 60fps
        const beamLen = Math.min(w, h) * 0.5;
        const bx = cx + Math.cos(beamRad) * beamLen;
        const by = cy + Math.sin(beamRad) * beamLen;
        const beam = ctx.createLinearGradient(cx, cy, bx, by);
        beam.addColorStop(0, `rgba(0,212,255,${0.22 * beamPulse})`);
        beam.addColorStop(0.6, `rgba(0,212,255,${0.08 * beamPulse})`);
        beam.addColorStop(1, 'rgba(0,212,255,0)');
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by);
        ctx.strokeStyle = beam; ctx.lineWidth = 2 + beamPulse * 1.5; ctx.stroke();
      }

      // Expanding pulse rings
      const t = frame * 0.01;
      const ringCount = isStreaming ? 6 : 4;
      for (let i = 0; i < ringCount; i++) {
        const phase = ((t + i / ringCount) % 1);
        const rr = brainR * (1.05 + phase * 0.7);
        const alpha = (1 - phase) * 0.22 * opacityMult;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.strokeStyle = isStreaming ? `rgba(0,255,180,${alpha})` : `rgba(0,212,255,${alpha})`;
        ctx.lineWidth = 1.5; ctx.stroke();
      }

      // Streaming gold pulse ring
      if (isStreaming) {
        const gPhase = ((t * 1.6) % 1);
        const grr = brainR * (1.05 + gPhase * 0.5);
        const galpha = (1 - gPhase) * 0.3;
        ctx.beginPath(); ctx.arc(cx, cy, grr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(201,168,76,${galpha})`; ctx.lineWidth = 2; ctx.stroke();
      }

      // Static boundary + rotating arcs
      ctx.beginPath(); ctx.arc(cx, cy, brainR * 1.02, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,212,255,${0.1 * opacityMult})`; ctx.lineWidth = 1; ctx.stroke();

      const arcAng = frame * 0.004;
      ctx.beginPath();
      ctx.arc(cx, cy, brainR * 1.1, arcAng, arcAng + Math.PI * 0.6);
      ctx.strokeStyle = `rgba(0,212,255,${0.18 * opacityMult})`; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, brainR * 1.1, arcAng + Math.PI, arcAng + Math.PI * 1.4);
      ctx.strokeStyle = `rgba(201,168,76,${0.15 * opacityMult})`; ctx.lineWidth = 1.5; ctx.stroke();

      frame++;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [w, h, connectedModules]);

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
    />
  );
}
