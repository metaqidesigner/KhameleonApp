import React from 'react';
import type { JarvisHealth, JarvisTelemetry } from '@/lib/jarvisApi';

interface HUDRingsProps {
  health: JarvisHealth;
  telemetry: JarvisTelemetry;
}

function fmtUptime(s: number): string {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function TickRing({ r, total = 72 }: { r: number; total?: number }) {
  const ticks = Array.from({ length: total }, (_, i) => i);
  const cx = 120, cy = 120;
  return (
    <g>
      {ticks.map(i => {
        const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
        const len = i % 6 === 0 ? 6 : 3;
        const x1 = cx + (r - 2) * Math.cos(angle);
        const y1 = cy + (r - 2) * Math.sin(angle);
        const x2 = cx + (r - 2 - len) * Math.cos(angle);
        const y2 = cy + (r - 2 - len) * Math.sin(angle);
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="rgba(0,212,255,0.7)"
            strokeWidth={i % 6 === 0 ? 1.5 : 0.8}
          />
        );
      })}
    </g>
  );
}

function Arc({ cx, cy, r, startDeg, endDeg, color }: {
  cx: number; cy: number; r: number;
  startDeg: number; endDeg: number; color: string;
}) {
  const toRad = (d: number) => (d - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return (
    <path
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
      fill="none"
      stroke={color}
      strokeWidth={4}
      strokeLinecap="round"
    />
  );
}

const AGENT_COLORS: Record<string, string> = {
  simple:          '#00d4ff',
  orchestrator:    '#c9a84c',
  deep_research:   '#c0152a',
  morning_digest:  '#3fb950',
  code_assistant:  '#a78bfa',
  channel_agent:   '#f97316',
  proactive_agent: '#14b8a6',
  operative:       '#ec4899',
};

export default function HUDRings({ health, telemetry }: HUDRingsProps) {
  const cx = 120, cy = 120;
  const outerR = 100, midR = 78, innerR = 54;

  // build mid-ring arcs from by_agent data
  const agentEntries = Object.entries(telemetry.by_agent);
  const total = agentEntries.reduce((a, [, s]) => a + s.queries, 0) || 1;
  let cursor = 0;
  const arcs = agentEntries.map(([agent, s]) => {
    const pct = s.queries / total;
    const span = pct * 340;
    const start = cursor;
    cursor += span + 4;
    return { agent, start, end: start + span };
  });

  const isOnline = health.status !== 'offline';
  const tps = health.tokens_per_sec ?? 0;
  const pulseOpacity = isOnline ? Math.min(1, 0.3 + tps / 80) : 0.2;

  const radialLabels = [
    { label: `${(tps).toFixed(1)} tok/s`,       angle: 0   },
    { label: `${health.avg_latency_ms ?? 0}ms`,  angle: 90  },
    { label: health.engine || '—',               angle: 180 },
    { label: fmtUptime(health.uptime),           angle: 270 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative', width: 240, height: 240 }}>
        {/* Outer ring — spinning */}
        <div style={{ position: 'absolute', inset: 0, animation: 'jarvis-spin 24s linear infinite' }}>
          <svg width={240} height={240}>
            <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(0,212,255,0.15)" strokeWidth={1} />
            <TickRing r={outerR} total={72} />
          </svg>
        </div>
        {/* Mid ring — counter-spinning with agent arcs */}
        <div style={{ position: 'absolute', inset: 0, animation: 'jarvis-spin-r 18s linear infinite' }}>
          <svg width={240} height={240}>
            <circle cx={cx} cy={cy} r={midR} fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth={1} />
            {arcs.length > 0
              ? arcs.map(a => (
                  <Arc key={a.agent} cx={cx} cy={cy} r={midR}
                    startDeg={a.start} endDeg={a.end}
                    color={AGENT_COLORS[a.agent] ?? '#00d4ff'} />
                ))
              : (
                // default decorative arcs when no data
                <>
                  <Arc cx={cx} cy={cy} r={midR} startDeg={10} endDeg={120} color="#00d4ff" />
                  <Arc cx={cx} cy={cy} r={midR} startDeg={130} endDeg={200} color="#c0152a" />
                  <Arc cx={cx} cy={cy} r={midR} startDeg={210} endDeg={350} color="#c9a84c" />
                </>
              )
            }
          </svg>
        </div>
        {/* Inner ring — pulsing */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <svg width={240} height={240}>
            <circle cx={cx} cy={cy} r={innerR} fill="none"
              stroke="#00d4ff"
              strokeWidth={1.5}
              opacity={pulseOpacity}
              style={{ animation: isOnline ? 'jarvis-pulse 2s ease-in-out infinite' : undefined }}
            />
            <circle cx={cx} cy={cy} r={innerR - 10} fill="none"
              stroke="rgba(0,212,255,0.2)"
              strokeWidth={0.8}
            />
            {/* Cross-hairs */}
            <line x1={cx - innerR + 4} y1={cy} x2={cx + innerR - 4} y2={cy}
              stroke="rgba(0,212,255,0.2)" strokeWidth={0.7} />
            <line x1={cx} y1={cy - innerR + 4} x2={cx} y2={cy + innerR - 4}
              stroke="rgba(0,212,255,0.2)" strokeWidth={0.7} />
          </svg>
        </div>
        {/* Center text */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--j-font-mono)', fontSize: 28, color: '#fff', lineHeight: 1,
          }}>
            {isOnline ? (health.total_queries ?? 0) : 'STANDBY'}
          </div>
          <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 9, color: 'var(--j-text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em', marginTop: 4 }}>
            {isOnline ? 'QUERIES' : 'OFFLINE'}
          </div>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', marginTop: 6,
            background: isOnline ? 'var(--j-green)' : 'var(--j-red)',
            animation: isOnline ? 'jarvis-pulse 1.5s ease-in-out infinite' : undefined,
          }} />
        </div>
        {/* Radial labels */}
        {radialLabels.map((l, i) => {
          const a = l.angle;
          const labelR = outerR + 20;
          const rad = (a - 90) * Math.PI / 180;
          const lx = cx + labelR * Math.cos(rad);
          const ly = cy + labelR * Math.sin(rad);
          return (
            <div key={i} style={{
              position: 'absolute',
              left: lx, top: ly,
              transform: 'translate(-50%,-50%)',
              fontFamily: 'var(--j-font-mono)',
              fontSize: 9,
              color: 'var(--j-text-muted)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}>
              {l.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
