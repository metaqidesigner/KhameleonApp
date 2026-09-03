import React from 'react';

interface SignalGlassTileProps {
  id: string;
  label: string;
  sub: string;
  dot: string;
}

export function SignalGlassTile({ id, label, sub, dot }: SignalGlassTileProps) {
  return (
    <div className={`kh-mini kh-mini-${id}`}>
      <div className="kh-mini-label">
        <span className="kh-mini-dot" style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />
        {label}
      </div>
      <div className="kh-mini-body">{sub}</div>
    </div>
  );
}
