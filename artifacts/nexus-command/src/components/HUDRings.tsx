import React from 'react';
import { Clock, Activity, Cpu } from 'lucide-react';
import type { JarvisHealth, JarvisTelemetry } from '@/lib/jarvisApi';

interface HUDRingsProps {
  health: JarvisHealth;
  telemetry: JarvisTelemetry;
}

// ── Geometry helpers ─────────────────────────────────────────

const CX = 100, CY = 100;   // SVG center
const R  = 78;               // gauge arc radius
const START_DEG = 150;       // SVG angle for arc start (8 o'clock area)
const TOTAL_SPAN = 240;      // degrees clockwise (8 o'clock → top → right → 4 o'clock area)
const N_SEGS = 44;           // number of segments
const FILL_FRAC = 0.70;      // each segment fills 70% of its slot

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcD(r: number, a: number, b: number): string {
  const s = polar(CX, CY, r, a);
  const e = polar(CX, CY, r, b);
  const large = (b - a) > 180 ? 1 : 0;
  return `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// ── Color gradient: teal → green → lime → amber → orange → coral ─

const COLOR_STOPS: [number, number, number][] = [
  [0, 196, 184],   // teal
  [56, 207, 138],  // green
  [156, 204, 44],  // lime
  [226, 170, 52],  // amber
  [249, 115, 22],  // orange
  [226, 90, 110],  // coral
];

function segColor(frac: number): string {
  const n = COLOR_STOPS.length - 1;
  const t = Math.min(1, Math.max(0, frac)) * n;
  const i = Math.floor(t);
  const f = t - i;
  const a = COLOR_STOPS[Math.min(i, n)];
  const b = COLOR_STOPS[Math.min(i + 1, n)];
  return `rgb(${Math.round(a[0] + f * (b[0] - a[0]))},${Math.round(a[1] + f * (b[1] - a[1]))},${Math.round(a[2] + f * (b[2] - a[2]))})`;
}

// ── The gauge SVG ─────────────────────────────────────────────

function GaugeSVG() {
  const OUTER_TICK_R  = R + 7;
  const LONG_TICK_END = R + 14;
  const SHORT_TICK_END = R + 10;

  return (
    <svg width={200} height={200} style={{ display: 'block' }}>
      {/* Dim background track */}
      <path
        d={arcD(R, START_DEG, START_DEG + TOTAL_SPAN)}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={9}
      />

      {/* Colored segments */}
      {Array.from({ length: N_SEGS }, (_, i) => {
        const a = START_DEG + (i / N_SEGS) * TOTAL_SPAN;
        const b = START_DEG + ((i + FILL_FRAC) / N_SEGS) * TOTAL_SPAN;
        const color = segColor(i / (N_SEGS - 1));
        const opacity = 0.85 + (i / (N_SEGS - 1)) * 0.15; // slight intensity ramp
        return (
          <path
            key={i}
            d={arcD(R, a, b)}
            fill="none"
            stroke={color}
            strokeWidth={9}
            strokeLinecap="butt"
            opacity={opacity}
          />
        );
      })}

      {/* Outer tick marks */}
      {Array.from({ length: N_SEGS + 1 }, (_, i) => {
        const angle = START_DEG + (i / N_SEGS) * TOTAL_SPAN;
        const isLong = i % 8 === 0;
        const p1 = polar(CX, CY, OUTER_TICK_R, angle);
        const p2 = polar(CX, CY, isLong ? LONG_TICK_END : SHORT_TICK_END, angle);
        return (
          <line
            key={`tick-${i}`}
            x1={p1.x.toFixed(2)} y1={p1.y.toFixed(2)}
            x2={p2.x.toFixed(2)} y2={p2.y.toFixed(2)}
            stroke={isLong ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)'}
            strokeWidth={isLong ? 1.2 : 0.7}
          />
        );
      })}

      {/* Inner faint ring */}
      <circle cx={CX} cy={CY} r={R - 14} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />

      {/* Crosshairs */}
      <line x1={CX - R + 20} y1={CY} x2={CX + R - 20} y2={CY} stroke="rgba(255,255,255,0.04)" strokeWidth={0.8} />
      <line x1={CX} y1={CY - R + 20} x2={CX} y2={CY + R - 20} stroke="rgba(255,255,255,0.04)" strokeWidth={0.8} />
    </svg>
  );
}

// ── Uptime formatter ─────────────────────────────────────────

function fmtUptime(s: number): string {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

// ── Main component ────────────────────────────────────────────

export default function HUDRings({ health }: HUDRingsProps) {
  const isOnline = health.status !== 'offline';
  const queries   = isOnline ? (health.total_queries ?? 0) : 'STANDBY';
  const latency   = health.avg_latency_ms ?? 0;
  const uptime    = health.uptime ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {/* Gauge + side stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* SVG gauge with center text overlay */}
        <div style={{ position: 'relative', width: 200, height: 200, flexShrink: 0 }}>
          <GaugeSVG />
          {/* Center overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontFamily: 'var(--j-font-mono)',
              fontSize: isOnline ? 38 : 18,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}>
              {queries}
            </div>
            <div style={{
              fontFamily: 'var(--j-font-ui)',
              fontSize: 9,
              color: 'rgba(196,212,236,0.45)',
              textTransform: 'uppercase',
              letterSpacing: '0.22em',
              marginTop: 5,
            }}>
              {isOnline ? 'Queries' : 'Offline'}
            </div>
            {/* Online pulse dot */}
            <div style={{
              width: 5, height: 5, borderRadius: '50%', marginTop: 8,
              background: isOnline ? 'var(--j-green)' : 'var(--j-coral)',
              boxShadow: isOnline ? '0 0 8px var(--j-green)' : 'none',
              animation: isOnline ? 'jarvis-pulse 2s ease-in-out infinite' : undefined,
            }} />
          </div>
        </div>

        {/* Side stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Uptime */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={13} style={{ color: 'rgba(196,212,236,0.35)', flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 15, color: '#fff', letterSpacing: '-0.01em' }}>
                {fmtUptime(uptime)}
              </div>
            </div>
          </div>
          {/* Latency */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={13} style={{ color: 'rgba(196,212,236,0.35)', flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 15, color: '#fff', letterSpacing: '-0.01em' }}>
                {latency.toFixed(0)}ms
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Engine label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Cpu size={11} style={{ color: 'rgba(0,196,184,0.55)' }} />
        <span style={{
          fontFamily: 'var(--j-font-mono)', fontSize: 11,
          color: 'rgba(196,212,236,0.45)', letterSpacing: '0.04em',
        }}>
          {health.engine || 'offline'}
        </span>
      </div>
    </div>
  );
}
