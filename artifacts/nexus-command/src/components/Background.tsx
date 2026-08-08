import { useJarvisStore } from '@/store/jarvisStore';

/** Circuit board trace paths that overlay the dark background */
function CircuitTraces() {
  const c = '#00c4b8'; // teal
  const p = '#7860c2'; // violet
  const o = (n: number) => ({ opacity: n });

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1280 720"
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
    >
      {/* ── LEFT CLUSTER (teal traces) ───────────────── */}
      {/* Main vertical spine */}
      <line x1="32" y1="60"  x2="32" y2="560" stroke={c} strokeWidth="1" {...o(0.12)} />
      {/* Horizontal branches off spine */}
      <line x1="32" y1="130" x2="100" y2="130" stroke={c} strokeWidth="1" {...o(0.10)} />
      <line x1="100" y1="130" x2="100" y2="190" stroke={c} strokeWidth="1" {...o(0.09)} />
      <line x1="100" y1="190" x2="145" y2="190" stroke={c} strokeWidth="1" {...o(0.08)} />

      <line x1="32" y1="260" x2="80"  y2="260" stroke={c} strokeWidth="1" {...o(0.10)} />
      <line x1="80" y1="260" x2="80"  y2="330" stroke={c} strokeWidth="1" {...o(0.09)} />
      <line x1="80" y1="330" x2="115" y2="330" stroke={c} strokeWidth="1" {...o(0.07)} />

      <line x1="32" y1="410" x2="62"  y2="410" stroke={c} strokeWidth="1" {...o(0.09)} />
      <line x1="62" y1="410" x2="62"  y2="460" stroke={c} strokeWidth="1" {...o(0.08)} />

      <line x1="32" y1="510" x2="85"  y2="510" stroke={c} strokeWidth="1" {...o(0.08)} />

      {/* Secondary thin spine at x=14 */}
      <line x1="14" y1="180" x2="14" y2="500" stroke={c} strokeWidth="0.75" {...o(0.07)} />
      <line x1="14" y1="290" x2="32" y2="290" stroke={c} strokeWidth="0.75" {...o(0.07)} />

      {/* Via dots — teal */}
      {[
        [32, 130], [100, 130], [100, 190], [145, 190],
        [32, 260], [80,  260], [80,  330],
        [32, 410], [62,  410], [62,  460],
        [32, 510],
        [14, 290], [32, 290],
      ].map(([x, y], i) => (
        <circle key={`tc-${i}`} cx={x} cy={y} r={i % 3 === 0 ? 2.5 : 2}
          fill={c} opacity={0.22} />
      ))}

      {/* ── RIGHT CLUSTER (violet traces, behind panels) ── */}
      <line x1="1252" y1="50"  x2="1252" y2="420" stroke={p} strokeWidth="1" {...o(0.13)} />
      <line x1="1218" y1="160" x2="1252" y2="160" stroke={p} strokeWidth="1" {...o(0.11)} />
      <line x1="1218" y1="160" x2="1218" y2="300" stroke={p} strokeWidth="1" {...o(0.09)} />
      <line x1="1185" y1="300" x2="1218" y2="300" stroke={p} strokeWidth="1" {...o(0.08)} />
      <line x1="1252" y1="320" x2="1280" y2="320" stroke={p} strokeWidth="1" {...o(0.07)} />

      {/* Via dots — violet */}
      {[
        [1252, 160], [1218, 160], [1218, 300], [1185, 300], [1252, 320],
      ].map(([x, y], i) => (
        <circle key={`pc-${i}`} cx={x} cy={y} r={2}
          fill={p} opacity={0.22} />
      ))}

      {/* ── SCATTERED DOTS (right side, near panel edge) ── */}
      {[
        [966, 198], [982, 198], [998, 198],
        [966, 214], [982, 214],
        [966, 230],
      ].map(([x, y], i) => (
        <circle key={`d-${i}`} cx={x} cy={y} r={1.5}
          fill={p} opacity={0.16} />
      ))}

      {/* ── BOTTOM-LEFT traces (near orb area, bottom-right) ── */}
      <line x1="1100" y1="680" x2="1200" y2="680" stroke={c} strokeWidth="0.75" {...o(0.10)} />
      <line x1="1200" y1="650" x2="1200" y2="680" stroke={c} strokeWidth="0.75" {...o(0.09)} />
      <circle cx="1200" cy="680" r="2" fill={c} opacity={0.18} />
      <circle cx="1100" cy="680" r="1.5" fill={c} opacity={0.14} />
    </svg>
  );
}

export default function Background() {
  const scanLines = useJarvisStore(s => s.scanLinesEnabled);
  return (
    <div
      className="j-bg-layer"
      style={scanLines ? {} : { '--j-scanlines': 'none' } as React.CSSProperties}
    >
      <CircuitTraces />
    </div>
  );
}
