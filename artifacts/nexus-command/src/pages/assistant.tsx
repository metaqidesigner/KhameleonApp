import React from 'react';

const PILLS = [
  { id: 'command', label: 'COMMAND', sub: 'You ask. I execute.',        dot: '#38cf8a' },
  { id: 'context', label: 'CONTEXT', sub: 'I understand what matters.', dot: '#F0A34C' },
  { id: 'status',  label: 'STATUS',  sub: 'I keep you in the loop.',    dot: '#8C7CF0' },
];

/** Small SVG ring progress (r=22, cx/cy=28) */
function FocusRing({ pct }: { pct: number }) {
  const r = 22, cx = 28, cy = 28;
  const circ = 2 * Math.PI * r;
  const dash  = circ * pct;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
      {/* Progress */}
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="#6FE6BD" strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Label */}
      <text x={cx} y={cy + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif"
        fontSize="9" fontWeight="600" fill="rgba(196,212,236,0.80)">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

export default function AssistantHome() {
  return (
    <div className="ac-home">
      {/* ── Three concept pills ─────────────────────────────── */}
      <div className="ac-concept-pills">
        {PILLS.map(pill => (
          <div key={pill.id} className="ac-pill">
            <div className="ac-pill-label">
              <span className="ac-pill-dot" style={{ background: pill.dot }} />
              <span style={{ color: pill.dot }}>{pill.label}</span>
            </div>
            <div className="ac-pill-sub">{pill.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Today's Focus — fixed bottom-left ───────────────── */}
      <div className="ac-focus-card">
        <div className="ac-focus-label">TODAY'S{'\n'}FOCUS</div>
        <div className="ac-focus-ring">
          <FocusRing pct={0.72} />
        </div>
      </div>
    </div>
  );
}
